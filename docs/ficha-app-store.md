# Ficha de App Store — Mis Cuentas

Textos para pegar en App Store Connect cuando la membresía de Apple Developer esté activa. Escrita el 21/11/2026 a partir de `ficha-google-play.md`. Límites de Apple (https://developer.apple.com/app-store/product-page/, leído el 21/11/2026): nombre 30 caracteres, subtítulo 30, texto promocional 170, palabras clave 100 en total (separadas por comas, sin espacios). La descripción admite hasta 4.000 caracteres (límite de App Store Connect, sin verificar en la página de hoy).

Paquete: `ar.alirio.miscuentas` (mismo que en Android). La compila EAS con el perfil `production` y la sube a TestFlight (`npm run build:tienda` y `npm run subir:tienda` en `mobile/`).

## Nombre (30)
Mis Cuentas: gastos y cuotas

## Subtítulo (30)
Dicta, carga y divide gastos

> Apple lo muestra debajo del nombre. En tuteo, igual que la ficha de Google Play.

## Texto promocional (170)
Nuevo: Inicio, Movimientos, Plan y Más hechos para el iPhone, widgets en la pantalla de inicio y entrada con Apple. Dicta tus gastos y ordena tus cuotas en minutos.

## Palabras clave (100)
presupuesto,finanzas,ahorro,tarjeta,dividir,deudas,dolar,mep,inflacion,billetera,splitwise,viajes,resumen

> No repetir palabras que ya están en el nombre o el subtítulo (Apple ya las indexa). «splitwise» es nombre de otra app: Apple puede rechazar marcas ajenas en las palabras clave (guía 2.3.7); si la rechazan, cambiarla por «grupos».

## Descripción

¿Quieres empezar a anotar tus gastos pero ya tienes diez compras en cuotas rodando? Mis Cuentas te ordena en minutos.

CARGA EN SEGUNDOS
• Dicta el gasto como lo dirías: «gasté 15 lucas en el súper», «voy por la 7 de 12». Entiende lucas, palos y cuotas.
• Escanea el QR de una factura o de un servicio y se carga solo.
• Sube el PDF del resumen de tu tarjeta (Visa, Mastercard, Amex o Naranja) y tienes tus cuotas ordenadas.
• Carga en dos pasos simples: primero el monto, después la categoría.
• Widgets en la pantalla de inicio: lo disponible del mes, tus últimos movimientos, lo que viene y tus presupuestos, con un botón para cargar un gasto.

TUS CUENTAS CLARAS
• Inicio con lo disponible, lo gastado y lo ingresado del mes.
• Plan del mes: lo que viene (tarjetas, fijos y aportes a tus metas), tus presupuestos y tus ahorros.
• Movimientos con filtros por mes, tipo, cuenta y categoría, y un buscador en toda tu historia.
• Los impuestos que te cobra la tarjeta, separados, y cuánto te ahorras pagando los consumos en dólares con dólar MEP.
• Tu año en pesos de hoy (ajustado por la inflación de INDEC) o en dólares del día de cada gasto.
• Calculadora de topes de reintegro: cuánto pagar con cada billetera para no perder descuentos.

GASTOS COMPARTIDOS
• Grupos y viajes con tu pareja, tu familia o tus amigos, aunque no tengan la app.
• Reparte en partes iguales, por porcentaje o por montos exactos.
• «Saldar cuentas» te dice quién le paga a quién con la menor cantidad de transferencias.
• Manda el resumen de la deuda por WhatsApp en un toque.

TU PRIVACIDAD
• Entras con Apple, con Google o con tu correo.
• El dictado usa el reconocimiento de voz del iPhone y los QR se leen en el teléfono.
• Solo si activas el refuerzo con inteligencia artificial, el texto o la foto del ticket se envían a Google Gemini para leerlos.
• Ocultar montos con un toque, para abrir la app delante de otras personas.
• No vendemos tus datos ni mostramos publicidad. Puedes descargarlos o borrar tu cuenta desde la app cuando quieras.

Mis Cuentas es un registro: no se conecta a tu banco, no mueve dinero ni hace pagos.

## Datos de la app
- **Categoría principal:** Finanzas. **Secundaria:** Productividad.
- **Clasificación por edad:** responder «No» a todo el cuestionario (sin contenido sensible, sin compras, sin chat abierto). Queda en 4+; el público real es mayor de 18.
- **Precio:** gratis. Sin compras dentro de la app por ahora (el «Plus» de WhatsApp no se ofrece en iPhone hasta que haya compra con Apple: guía 3.1.1).
- **URL de soporte:** https://control-de-gastos-lyart-theta.vercel.app
- **URL de privacidad:** https://control-de-gastos-lyart-theta.vercel.app/privacidad.html
- **Cifrado (export compliance):** ya declarado en `mobile/app.json` (`ITSAppUsesNonExemptEncryption: false`, solo HTTPS).

## Privacidad de la app (App Store Connect → Privacidad de la app)
Datos que se recogen, **vinculados a la persona**, para **funcionalidad de la app**, sin rastreo:
- **Información de contacto:** correo; nombre (si lo pone).
- **Información financiera:** «Otra información financiera» (ingresos, gastos, cuotas, ahorros que carga la persona).
- **Contenido del usuario:** fotos (tickets), otro contenido del usuario (PDF de resúmenes), solo para leerlos.
- **Identificadores:** ID de usuario (el de la cuenta).
- **Audio:** no se recoge. El dictado lo transcribe el reconocimiento de voz del sistema y la app solo recibe el texto.
- **Datos de uso o diagnóstico:** solo si la app guarda errores en «Diagnóstico». Revisar antes de enviar; si no salen del teléfono, no se declaran.
- **Rastreo:** no. No hay publicidad ni SDK de terceros que sigan a la persona.

## Para la revisión de Apple
- **Cuenta de prueba:** Apple pide una cuenta con datos para revisar. Crear una cuenta de correo nueva solo para esto, cargarle unos meses de movimientos inventados y poner el usuario y la contraseña **directamente en App Store Connect** (Notas de revisión → Información de inicio de sesión). No anotarlos en este archivo.
- **Notas para el revisor (pegar):**
  > Mis Cuentas is a personal expense tracker for Argentina. It does not connect to banks, move money or process payments. Native screens: Home, Transactions, Plan and More (bottom tab bar), Sign in with Apple, voice dictation with the iOS speech recognizer, and home screen widgets. Some detail screens (editing a transaction, settings) are shared with our web app.
- **Regla 4.2 (no ser solo una web):** Inicio, Movimientos, Plan y Más son nativos, más widgets, dictado con el reconocimiento del iPhone y entrada con Apple. Es lo que se suele pedir; igual puede haber una primera respuesta pidiendo más.
- **Regla 5.1.1 (ix) (finanzas por una persona y no una empresa):** habla de apps que *prestan servicios* financieros regulados (bancos, pagos, cripto). Mis Cuentas es un registro personal que no presta servicios ni mueve dinero, por eso conviene dejarlo claro en la descripción y en las notas. Si Apple igual pide una organización, la salida es publicarla con una cuenta de empresa (necesita D-U-N-S); se decide si llega a pasar.
- **Regla 4.8:** ya tiene «Iniciar sesión con Apple». Falta activar el proveedor Apple en Supabase con `ar.alirio.miscuentas` en «Client IDs» (ver estado de Mis Cuentas).

## Capturas (iPhone 6,9")
Apple pide al menos una captura de 1320 × 2868 (o 1290 × 2796). Con el APK o TestFlight instalado, sacar con una cuenta de ejemplo inventada:
1. Inicio con lo disponible del mes (texto arriba: «Tus cuentas del mes, claras»).
2. Dictado de un gasto («Dicta: "15 lucas en el súper"»).
3. Plan del mes con lo que viene y los presupuestos.
4. Movimientos con el buscador.
5. Widgets en la pantalla de inicio.
6. Grupo de viaje con «Saldar cuentas».

## Antes de enviar
- Cada punto de la descripción tiene que estar en la versión que se envía. Si algo se saca de la app, se saca de acá.
- Probar en TestFlight: entrar con Apple, dictar, leer un QR, los cuatro widgets y que las hojas (cuenta, dictado) no queden tapadas.
