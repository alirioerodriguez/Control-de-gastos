import { useCallback, useEffect, useRef, useState, type ComponentType, type Ref } from 'react';
import { ActivityIndicator, Alert, BackHandler, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as WebBrowser from 'expo-web-browser';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewProps } from 'react-native-webview';
import type { ShouldStartLoadRequest, WebViewMessageEvent, WebViewNavigation, WebViewOpenWindowEvent } from 'react-native-webview/lib/WebViewTypes';
import { APP } from './config';

// La app muestra la web publicada: cada cambio que se publica llega solo, sin volver a compilar.
// Lo que agrega: ingreso con Google (Google no lo permite dentro de una vista web), descargas de
// Excel/PDF con el menú de compartir del teléfono, enlaces externos (WhatsApp, mail) en su app,
// botón atrás de Android y aviso de sin conexión.

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

export default function App() {
  const web = useRef<WebViewHandle>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const enGoogle = useRef(false);

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
    let msg: { type?: string; nombre?: string; datos?: string; title?: string; text?: string; url?: string };
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (msg.type === 'google') entrarConGoogle();
    else if (msg.type === 'archivo' && msg.nombre && msg.datos)
      guardarYCompartir(msg.nombre, msg.datos).catch(() => Alert.alert('No se pudo guardar el archivo', 'Probá de nuevo.'));
    else if (msg.type === 'share')
      Share.share({ title: msg.title, message: [msg.text, msg.url].filter(Boolean).join('\n') }).catch(() => {});
  }, [entrarConGoogle]);

  const retry = () => { setFailed(false); setLoading(true); web.current?.reload(); };

  return (
    <SafeAreaProvider>
      <StatusBar style={APP.barraClara ? 'light' : 'dark'} />
      <SafeAreaView style={[styles.root, { backgroundColor: APP.fondo }]} edges={['top', 'left', 'right']}>
        <RNWebView
          ref={web}
          source={{ uri: APP.sitio }}
          style={[styles.web, { backgroundColor: APP.fondo }]}
          applicationNameForUserAgent={APP.agente}
          originWhitelist={['*']}
          injectedJavaScriptBeforeContentLoaded={PUENTE}
          onShouldStartLoadWithRequest={onShouldStart}
          onOpenWindow={onOpenWindow}
          setSupportMultipleWindows
          onMessage={onMessage}
          onNavigationStateChange={(s: WebViewNavigation) => setCanGoBack(s.canGoBack)}
          onLoadEnd={() => { setLoading(false); SplashScreen.hideAsync().catch(() => {}); }}
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
        />
        {loading && !failed && (
          <View style={[styles.cover, { backgroundColor: APP.fondo }]} pointerEvents="none"><ActivityIndicator color={APP.acento} /></View>
        )}
        {failed && (
          <View style={[styles.cover, { backgroundColor: APP.fondo }]}>
            <Text style={[styles.title, { color: APP.texto }]}>Sin conexión</Text>
            <Text style={styles.text}>Revisá tu internet y probá de nuevo.</Text>
            <Pressable style={[styles.btn, { backgroundColor: APP.acento }]} onPress={retry}><Text style={styles.btnText}>Reintentar</Text></Pressable>
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  web: { flex: 1 },
  cover: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  text: { color: '#8a8580', fontSize: 15, textAlign: 'center', marginBottom: 20 },
  btn: { borderRadius: 999, paddingHorizontal: 22, paddingVertical: 12 },
  btnText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
});
