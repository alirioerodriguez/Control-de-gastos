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
- Android: la de Google Play sigue siendo la versión web empaquetada (TWA). **La TWA no tiene widget**: para que
  el widget llegue a Google Play hay que subir esta app (`eas build --platform android --profile production`,
  mismo identificador `ar.alirio.miscuentas`, firmada con la misma clave de subida que la TWA) en lugar de la TWA.
  Para probarla antes: `npm run build:android` genera un APK que se instala directo.

### Widget: antes de publicar
- iOS: el widget usa el App Group `group.ar.alirio.miscuentas`. EAS lo da de alta solo en la cuenta de Apple
  al compilar con credenciales manejadas por EAS; si no, hay que crearlo a mano en developer.apple.com y
  habilitarlo para `ar.alirio.miscuentas` y `ar.alirio.miscuentas.ExpoWidgetsTarget`. Mínimo iOS 16.4.
- Probar en un teléfono: agregar el widget, abrir la app con sesión (aparecen las cifras), activar «ocultar
  montos» (aparece •••••), tocar «+ Gasto» con la app cerrada y abierta, y cerrar sesión (el widget pide abrir la app).
