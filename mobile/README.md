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

Identificador: `ar.alirio.miscuentas` (el mismo que la app de Android de Google Play).

## Probar en el iPhone (gratis)
```bash
cd mobile && npm install && npx expo start
```
Escaneá el QR con la cámara del iPhone (con Expo Go instalado) o abrila desde Expo Go.

## Compilar
Necesitás `eas-cli` (`npm install -g eas-cli`) y la cuenta de Expo. La primera vez: `eas login` y `eas init`.
- iPhone de prueba: `npm run build:ios` (pide la cuenta de Apple Developer).
- App Store: `npm run build:tienda` y después `npm run subir:tienda`.
- Android: la de Google Play sigue siendo la versión web empaquetada (TWA). Esta app también compila para
  Android (`npm run build:android`), pero no hace falta.
