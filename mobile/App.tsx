import { useCallback, useEffect, useRef, useState, type ComponentType, type Ref } from 'react';
import { ActivityIndicator, Alert, BackHandler, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewProps } from 'react-native-webview';
import type { ShouldStartLoadRequest, WebViewMessageEvent, WebViewNavigation, WebViewOpenWindowEvent } from 'react-native-webview/lib/WebViewTypes';
import { APP } from './config';
import { actualizarWidget } from './widget/actualizar';
import { esValido, limpiar } from './widget/datos';
import { POLYFILL_VOZ, pedidoVoz, useVozNativa } from './voz';
import { entrarConApple } from './apple';
import { Barra, Inicio, Movimientos, PlanNativo, esMovs, esPlan, esResumen, type Movs, type Pestana, type Plan, type Resumen } from './nativo';

// La app muestra la web publicada: cada cambio que se publica llega solo, sin volver a compilar.
// Lo que agrega: ingreso con Google (Google no lo permite dentro de una vista web), descargas de
// Excel/PDF con el menú de compartir del teléfono, enlaces externos (WhatsApp, mail) en su app,
// botón atrás de Android, aviso de sin conexión y el widget de la pantalla de inicio (carpeta widget/).

type WebViewHandle = WebView<{}>;
const RNWebView = WebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewHandle> }>;

SplashScreen.preventAutoHideAsync().catch(() => {});

const ORIGEN = new URL(APP.sitio).origin;
const esPropia = (url: string) =>
  url.startsWith(ORIGEN) || url.startsWith('about:') || url.startsWith('data:') || url.startsWith('blob:');

// Descargas: las páginas arman el archivo en memoria (blob:) y lo "descargan" con un enlace. En el iPhone eso
// no hace nada dentro de una app, así que se intercepta y se le pasa el archivo a la app.
const PUENTE = `(function () {
  if (window.__puenteApp) return; window.__puenteApp = true;
  var revocar = URL.revokeObjectURL.bind(URL);
  URL.revokeObjectURL = function (u) { setTimeout(function () { revocar(u); }, 60000); };
  function enviar(a) {
    var nombre = a.getAttribute('download') || 'archivo';
    fetch(a.href).then(function (r) { return r.blob(); }).then(function (b) {
      var fr = new FileReader();
      fr.onload = function () { window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'archivo', nombre: nombre, datos: fr.result })); };
      fr.readAsDataURL(b);
    }).catch(function () {});
  }
  var esArchivo = function (a) { return a && a.hasAttribute && a.hasAttribute('download') && /^(blob:|data:)/.test(a.href); };
  var click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (esArchivo(this)) return enviar(this); return click.apply(this, arguments); };
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (esArchivo(a)) { e.preventDefault(); enviar(a); }
  }, true);
})(); true;`;

async function guardarYCompartir(nombre: string, datos: string) {
  const base64 = datos.slice(datos.indexOf(',') + 1);
  const archivo = new File(Paths.cache, nombre.replace(/[\\/:*?"<>|]/g, '_'));
  if (archivo.exists) archivo.delete();
  await archivo.write(base64, { encoding: 'base64' });
  await Sharing.shareAsync(archivo.uri, { dialogTitle: nombre });
}

// Los widgets abren la app con miscuentas://nuevo («+ Gasto»), ingreso, voz, presupuesto o inicio, y los atajos del ícono con
// miscuentas://nuevo o miscuentas://voz (plugins/atajos-android.js). Los enlaces del sitio
// (por ejemplo, el de un evento que llega por WhatsApp) también abren la app, en esa página.
const accionDe = (url: string | null | undefined) => {
  const m = url && /^miscuentas:\/\/(nuevo|voz|ingreso|presupuesto)/.exec(url);
  return m ? (m[1] as 'nuevo' | 'voz' | 'ingreso' | 'presupuesto') : null;
};
const delSitio = (url: string | null | undefined) => (url && url.startsWith(ORIGEN + '/') ? url : null);

// Le avisa a la web, antes de que cargue, que la app dibuja su propia barra y su Inicio (ver «APP NATIVA» en index.html)
const SHELL = 'window.__shellNativo = true; true;';

// Pantalla de la web → pestaña de la barra nativa (Ahorros y Fijos viven dentro de Plan, el resto dentro de Más)
function pestanaDe(w: string): Pestana | null {
  if (w === 'app' || w === 'cuentas') return 'app';
  if (w === 'movs') return 'movs';
  if (w === 'tar' || w === 'meta' || w === 'metas') return 'tar';
  if (w === 'mas' || w === 'sub' || w === 'cal') return 'mas';
  return null;
}

export default function App() {
  return <SafeAreaProvider><Pantalla /></SafeAreaProvider>;
}

function Pantalla() {
  const web = useRef<WebViewHandle>(null);
  const insets = useSafeAreaInsets();
  // Lo que manda la web: el resumen (null = sin sesión) y en qué pantalla está
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [movs, setMovs] = useState<Movs | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  // El Plan nativo es la portada de «Plan»; al tocar una parte (Tarjetas, Ahorros…) se ve esa pantalla de la web
  const [planNativo, setPlanNativo] = useState(true);
  const [seccion, setSeccion] = useState<{ w: string; dentro: boolean } | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const js = useCallback((codigo: string) => web.current?.injectJavaScript(`${codigo}; true;`), []);
  const cargada = useRef(false);
  // Si la app estaba cerrada y se abrió desde «+ Gasto» o un atajo, la web arranca ya con ?accion=nuevo (o voz).
  const [inicio, setInicio] = useState<string | null>(null);
  useEffect(() => {
    Linking.getInitialURL()
      .then((u) => setInicio(accionDe(u) ? `${APP.sitio}?accion=${accionDe(u)}` : delSitio(u) || APP.sitio))
      .catch(() => setInicio(APP.sitio));
    const sub = Linking.addEventListener('url', ({ url }) => {
      const accion = accionDe(url);
      if (accion && cargada.current) web.current?.injectJavaScript(`window.__accionDesdeApp && window.__accionDesdeApp('${accion}'); true;`);
      else if (!accion && delSitio(url)) web.current?.injectJavaScript(`location.href = ${JSON.stringify(url)}; true;`);
    });
    return () => sub.remove();
  }, []);
  const [canGoBack, setCanGoBack] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const enGoogle = useRef(false);
  useVozNativa(web);

  useEffect(() => {
    const t = setTimeout(() => { setLoading(false); SplashScreen.hideAsync().catch(() => {}); }, 8000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) { web.current?.goBack(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  // Google: se abre la web en la ventana segura del sistema; la web entra con Google y vuelve a la app
  // con la sesión (APP.esquema://auth#access_token=…&refresh_token=…), que se carga en la vista web.
  const entrarConGoogle = useCallback(async () => {
    if (enGoogle.current) return;
    enGoogle.current = true;
    try {
      const r = await WebBrowser.openAuthSessionAsync(`${ORIGEN}/?ingresoApp=google`, `${APP.esquema}://auth`);
      if (r.type !== 'success') return;
      const p = new URLSearchParams(r.url.split('#')[1] || r.url.split('?')[1] || '');
      const at = p.get('access_token');
      const rt = p.get('refresh_token');
      if (!at || !rt) {
        Alert.alert('No se pudo entrar con Google', p.get('error') || 'Probá de nuevo.');
        return;
      }
      web.current?.injectJavaScript(
        `window.__sesionDesdeApp(${JSON.stringify(at)}, ${JSON.stringify(rt)}).then(function(){ location.replace(${JSON.stringify(ORIGEN + '/')}); }); true;`,
      );
    } finally {
      enGoogle.current = false;
    }
  }, []);

  const onShouldStart = useCallback((req: ShouldStartLoadRequest) => {
    // Respaldo: si la página intenta ir a Google desde la vista web, se hace con la ventana del sistema
    if (/\/auth\/v1\/authorize|accounts\.google\.com/.test(req.url)) { entrarConGoogle(); return false; }
    if (req.isTopFrame === false || esPropia(req.url)) return true;
    Linking.openURL(req.url).catch(() => {});
    return false;
  }, [entrarConGoogle]);

  const onOpenWindow = useCallback((e: WebViewOpenWindowEvent) => {
    Linking.openURL(e.nativeEvent.targetUrl).catch(() => {});
  }, []);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    let msg: { type?: string; nombre?: string; datos?: unknown; title?: string; text?: string; url?: string };
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (msg.type === 'google') entrarConGoogle();
    else if (msg.type === 'apple') entrarConApple(web);
    else if (msg.type === 'resumen') setResumen(esResumen(msg.datos) ? msg.datos : null);
    else if (msg.type === 'movs') setMovs(esMovs(msg.datos) ? msg.datos : null);
    else if (msg.type === 'plan') setPlan(esPlan(msg.datos) ? msg.datos : null);
    else if (msg.type === 'seccion') {
      const d = msg.datos as { w?: unknown; dentro?: unknown } | undefined;
      if (d && typeof d.w === 'string') {
        setSeccion({ w: d.w, dentro: !!d.dentro });
        if (!['tar', 'metas', 'meta', 'sub'].includes(d.w)) setPlanNativo(true);
      }
    }
    else if (msg.type === 'refrescado') setRefrescando(false);
    else if (msg.type === 'archivo' && msg.nombre && typeof msg.datos === 'string')
      guardarYCompartir(msg.nombre, msg.datos).catch(() => Alert.alert('No se pudo guardar el archivo', 'Probá de nuevo.'));
    else if (msg.type === 'share')
      Share.share({ title: msg.title, message: [msg.text, msg.url].filter(Boolean).join('\n') }).catch(() => {});
    else if (msg.type === 'voz')
      pedidoVoz(web, msg as Parameters<typeof pedidoVoz>[1]);
    else if (msg.type === 'widget')
      actualizarWidget(msg.datos === null ? null : esValido(msg.datos) ? limpiar(msg.datos) : null);
  }, [entrarConGoogle]);

  const retry = () => { setFailed(false); setLoading(true); web.current?.reload(); };

  // La barra y el Inicio nativos aparecen solo con sesión y en las pantallas principales de la web
  const conBarra = !!resumen && !!seccion?.dentro;
  const enInicio = !!resumen && seccion?.w === 'app';
  const enMovs = !!resumen && !!movs && seccion?.w === 'movs';
  const enPlan = !!resumen && !!plan && planNativo && seccion?.w === 'tar';
  const ir = useCallback((p: Pestana) => { if (p === 'tar') setPlanNativo(true); js(`window.__irA && window.__irA('${p}')`); }, [js]);
  const accion = useCallback((a: 'nuevo' | 'voz') => js(`window.__accionDesdeApp && window.__accionDesdeApp('${a}')`), [js]);
  const refrescar = useCallback(() => {
    setRefrescando(true);
    js('window.__refrescarDesdeApp && window.__refrescarDesdeApp()');
    setTimeout(() => setRefrescando(false), 10000); // por si la web no contesta
  }, [js]);

  return (
    <>
      <StatusBar style={APP.barraClara ? 'light' : 'dark'} />
      <SafeAreaView style={[styles.root, { backgroundColor: APP.fondo }]} edges={['top', 'left', 'right']}>
        <View style={styles.root}>
        {inicio && <RNWebView
          ref={web}
          source={{ uri: inicio }}
          style={[styles.web, { backgroundColor: APP.fondo }]}
          applicationNameForUserAgent={APP.agente}
          originWhitelist={['*']}
          injectedJavaScriptBeforeContentLoaded={SHELL + PUENTE + POLYFILL_VOZ}
          onShouldStartLoadWithRequest={onShouldStart}
          onOpenWindow={onOpenWindow}
          setSupportMultipleWindows
          onMessage={onMessage}
          onNavigationStateChange={(s: WebViewNavigation) => setCanGoBack(s.canGoBack)}
          onLoadEnd={() => { cargada.current = true; setLoading(false); SplashScreen.hideAsync().catch(() => {}); }}
          onError={() => { setFailed(true); setLoading(false); SplashScreen.hideAsync().catch(() => {}); }}
          onContentProcessDidTerminate={() => web.current?.reload()}
          onRenderProcessGone={() => web.current?.reload()}
          domStorageEnabled
          javaScriptEnabled
          sharedCookiesEnabled
          allowsBackForwardNavigationGestures
          allowsInlineMediaPlayback
          decelerationRate="normal"
          overScrollMode="never"
        />}
        {enInicio && resumen && (
          <View style={[styles.cover, styles.pantalla]}>
            <Inicio r={resumen} cargar={() => accion('nuevo')} dictar={() => accion('voz')} verMovs={() => ir('movs')}
              ocultar={() => js('window.__ocultarDesdeApp && window.__ocultarDesdeApp()')} refrescar={refrescar} refrescando={refrescando} />
          </View>
        )}
        {enMovs && movs && (
          <View style={[styles.cover, styles.pantalla]}>
            <Movimientos m={movs} refrescar={refrescar} refrescando={refrescando}
              pedir={(p) => js(`window.__movsDesdeApp && window.__movsDesdeApp(${JSON.stringify(p)})`)}
              abrir={(k, id) => js(`window.__abrirMovDesdeApp && window.__abrirMovDesdeApp(${JSON.stringify(k)}, ${JSON.stringify(id)})`)} />
          </View>
        )}
        {enPlan && plan && (
          <View style={[styles.cover, styles.pantalla]}>
            <PlanNativo p={plan} refrescar={refrescar} refrescando={refrescando}
              pedir={(q) => { setPlanNativo(false); js(`window.__planDesdeApp && window.__planDesdeApp(${JSON.stringify(q)})`); }} />
          </View>
        )}
        {loading && !failed && (
          <View style={[styles.cover, { backgroundColor: APP.fondo }]} pointerEvents="none"><ActivityIndicator color={APP.acento} /></View>
        )}
        {failed && (
          <View style={[styles.cover, { backgroundColor: APP.fondo }]}>
            <Text style={[styles.title, { color: APP.texto }]}>Sin conexión</Text>
            <Text style={styles.text}>Revisá tu internet y probá de nuevo.</Text>
            <Pressable style={[styles.btn, { backgroundColor: APP.acento }]} onPress={retry}><Text style={[styles.btnText, { color: (APP as { textoBoton?: string }).textoBoton ?? '#ffffff' }]}>Reintentar</Text></Pressable>
          </View>
        )}
        </View>
        {conBarra && !failed && (
          <Barra actual={seccion ? pestanaDe(seccion.w) : null} ir={ir} cargar={() => accion('nuevo')} dictar={() => accion('voz')} abajo={insets.bottom} />
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  web: { flex: 1 },
  // Las pantallas nativas ocupan todo el ancho (cover centra y deja margen, que es para los avisos)
  pantalla: { alignItems: 'stretch', justifyContent: 'flex-start', padding: 0, backgroundColor: APP.fondo },
  cover: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  text: { color: '#8a8580', fontSize: 15, textAlign: 'center', marginBottom: 20 },
  btn: { borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12 },
  btnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
});
