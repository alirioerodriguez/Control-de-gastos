# Mis Cuentas · app para iPhone y Android

App hecha con Expo 58. Muestra la web publicada (`https://control-de-gastos-lyart-theta.vercel.app`), así cada
cambio que se publica en la web llega solo a la app, sin volver a compilarla.

Lo que agrega sobre la web:
- **Ingreso con Google**: Google no deja iniciar sesión dentro de la vista web de una app. La app abre la web en
  la ventana segura del sistema con `?ingresoApp=google`, la web entra con Google y le devuelve la sesión a la app
  (`miscuentas://auth#…`). Ver «PUENTE CON LA APP» en `index.html` y `entrarConGoogle` en `App.tsx`.
- **CSV y PDF**: las descargas se interceptan y se abren con el menú de compartir del teléfono
  (guardar en Archivos, WhatsApp, mail).
- WhatsApp y mail se abren en su app; botón atrás de Android; aviso de sin conexión.
- **Dictado por voz**: si la vista web no trae reconocimiento de voz (Android), `voz.ts` le inyecta uno que usa
  el del teléfono y devuelve los resultados igual que el del navegador. La web no cambia.
- **Enlaces del sitio**: abrir un enlace de `control-de-gastos-lyart-theta.vercel.app` abre la app en esa página.
- **Widget de la pantalla de inicio** (carpeta `widget/`): muestra el Disponible y lo gastado en el mes, con un
  botón «+ Gasto» que abre el formulario. La web le manda las cifras ya escritas (`datosWidget` en `index.html`)
  y respeta «ocultar montos». iOS usa `expo-widgets` (`ResumenIOS.tsx`); Android usa
  `react-native-android-widget` (`ResumenAndroid.tsx`), porque en Android los botones de `expo-widgets` no abren
  la app. Tocar el widget abre `miscuentas://inicio`; «+ Gasto» abre `miscuentas://nuevo`.

Identificador: `ar.alirio.miscuentas` (el mismo que la app de Android de Google Play).

## Probar en el iPhone (gratis)
```bash
cd mobile && npm install && npx expo start
```
Escaneá el QR con la cámara del iPhone (con Expo Go instalado) o abrila desde Expo Go.
**Expo Go no muestra widgets**: para probar el widget hace falta una compilación (`npm run build:ios` o
`npm run build:android`).

## Compilar
Necesitás `eas-cli` (`npm install -g eas-cli`) y la cuenta de Expo. La primera vez: `eas login` y `eas init`.
- iPhone de prueba: `npm run build:ios` (pide la cuenta de Apple Developer).
- App Store: `npm run build:tienda` y después `npm run subir:tienda`.
- Android (Google Play): **esta app reemplaza a la TWA** (la web empaquetada), con el mismo identificador
  `ar.alirio.miscuentas`. Ver «Reemplazar la TWA en Google Play» más abajo.
- APK de prueba para instalar directo en un Android: `npm run build:android`.

### Reemplazar la TWA en Google Play
Qué gana Android con el cambio: el widget, y los enlaces del sitio (por ejemplo, el de un evento que llega por
WhatsApp) siguen abriendo la app como con la TWA. Qué podía perderse y está resuelto: el dictado por voz (la
vista web de Android no lo trae; `voz.ts` usa el reconocedor del teléfono) y la foto del ticket (permiso de cámara).

1. **Número de versión**: `android.versionCode` en `app.json` está en 1000. Tiene que ser mayor que el de la
   última versión de la TWA (Play Console → Explorador de paquetes de apps). Si la TWA usa uno mayor, subilo.
2. **Firma**: Play solo acepta la app firmada con la misma clave de subida que la TWA.
   - Si tenés el archivo de la clave de la TWA (`.keystore`/`.jks`, con su contraseña y alias): `eas credentials`
     → Android → production → subir ese keystore.
   - Si no lo tenés: dejá que EAS cree una clave nueva y pedí en Play Console «Restablecer la clave de subida»
     (Configuración → Integridad de la app) con el certificado que te da `eas credentials`. Google tarda unos días.
   - La clave de **firma de la app** la guarda Google (Play App Signing) y no cambia: por eso
     `.well-known/assetlinks.json` sigue sirviendo y los enlaces del sitio abren la app.
3. Compilar: `npm run build:play` (genera el .aab).
4. Subir: `npm run subir:play` (va a «Prueba interna» como borrador; necesita la clave de servicio de Google Play
   configurada en EAS) o subir el .aab a mano en Play Console.
5. Probar desde «Prueba interna» antes de pasarla a producción: ingreso con Google, dictado por voz, foto de
   ticket, descarga de Excel/PDF, el enlace de un evento abierto desde WhatsApp y el widget.

### Widget: antes de publicar
- iOS: el widget usa el App Group `group.ar.alirio.miscuentas`. EAS lo da de alta solo en la cuenta de Apple
  al compilar con credenciales manejadas por EAS; si no, hay que crearlo a mano en developer.apple.com y
  habilitarlo para `ar.alirio.miscuentas` y `ar.alirio.miscuentas.ExpoWidgetsTarget`. Mínimo iOS 16.4.
- Probar en un teléfono: agregar el widget, abrir la app con sesión (aparecen las cifras), activar «ocultar
  montos» (aparece •••••), tocar «+ Gasto» con la app cerrada y abierta, y cerrar sesión (el widget pide abrir la app).
