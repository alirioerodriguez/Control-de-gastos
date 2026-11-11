# Mis Cuentas por WhatsApp: puesta en marcha

El usuario le escribe al número de Mis Cuentas (texto, audio o foto del ticket) y el gasto se guarda en su cuenta.
Es la única función paga (plan **Plus**); el resto de la app sigue gratis.

- Base de datos: `supabase/whatsapp.sql`
- Función (webhook): `supabase/functions/whatsapp/` (`index.ts` + `interprete.ts`, copia del intérprete del dictado)
- Pantalla: app → **Más → WhatsApp**

Investigación de costos y requisitos de Meta: `CONTROL_DE_FACTURACION/docs/investigacion/whatsapp.md`.

## Cuánto cuesta

Como el usuario escribe primero, todas las respuestas son **mensajes de servicio** (no hacen falta plantillas):
- Las **primeras 1.000 por mes y por número son gratis**. Después, unos **USD 0,026** cada una (tarifa de Argentina desde el 01/10/2026).
- Recibir mensajes no cuesta.
- Cada carga genera **una** respuesta. "Gracias", "ok", etc. no se contestan, y a un número sin vincular se le contesta una vez cada 12 horas.
- Gemini (audios, fotos y frases raras) cobra aparte, en la cuenta de Google del `GEMINI_API_KEY`.

Respuestas del mes (para controlar el cupo gratis):

```sql
select count(*) from public.whatsapp_mensajes where respondido and created_at >= date_trunc('month', now());
```

## Secretos (Supabase → Edge Functions → Secrets)

| Secreto | De dónde sale |
|---|---|
| `WHATSAPP_TOKEN` | Token **permanente** del usuario del sistema (paso 6). El temporal de la consola dura 24 h. |
| `WHATSAPP_PHONE_ID` | *Phone number ID* del número (WhatsApp → API Setup). No es el número de teléfono. |
| `WHATSAPP_APP_SECRET` | App → Settings → Basic → **App secret**. Valida la firma `X-Hub-Signature-256`. |
| `WHATSAPP_VERIFY_TOKEN` | Un texto largo al azar que inventás vos y repetís en la configuración del webhook. |
| `GEMINI_API_KEY` | El mismo de `gemini-proxy`. Sin él, solo funcionan los mensajes de texto que entiende el intérprete local. |

Opcionales: `WHATSAPP_GRAPH_VERSION` (por defecto `v23.0`) y `WHATSAPP_GEMINI_MODELO` (por defecto prueba `gemini-3.5-flash-lite` y después `gemini-2.5-flash-lite`).

> `gemini-proxy` está publicada desde el 09/11/2026 (v2), pero `GEMINI_API_KEY` todavía no está cargado como secreto en Supabase (11/11/2026). Sin él, por WhatsApp solo andan los mensajes de texto.

## Pruebas

- `node tests/whatsapp-interprete.test.js`: el intérprete de texto de la función (la misma lógica que el dictado).
- El SQL se probó el 11/11/2026 en un Postgres local (PGlite) con 18 casos: plan que la app no puede cambiar, códigos, vínculos solo propios, sin duplicados y `eliminar_mi_cuenta`.

## Pasos en Meta

1. **Portfolio comercial** en business.facebook.com (si no existe).
2. **App** en developers.facebook.com → *Create app* → caso de uso **WhatsApp** → asociarla al portfolio.
3. En *WhatsApp → API Setup* Meta da un **número de prueba**. Agregá tu celular en la lista de destinatarios permitidos.
   - Si al responder aparece el error **131030** (número no permitido), agregá tu número en los dos formatos: `+54 9 11 …` y `+54 11 …`. Pasa con los celulares argentinos.
4. Publicar la base y la función (ver abajo) y cargar los secretos.
5. **Webhook**: *WhatsApp → Configuration → Webhook → Edit*
   - Callback URL: `https://qrtypgsyyxioakqibwmz.supabase.co/functions/v1/whatsapp`
   - Verify token: el mismo valor que `WHATSAPP_VERIFY_TOKEN`.
   - *Webhook fields*: suscribir **messages**.
6. **Token permanente**: Business settings → *System users* → crear uno (Admin) → *Add assets*: la app y la cuenta de WhatsApp → *Generate token* con permisos `whatsapp_business_messaging` y `whatsapp_business_management`. Ese es `WHATSAPP_TOKEN`.
7. **Número real** (cuando funcione con el de prueba): una línea que **no tenga WhatsApp** (puede ser un chip prepago), nombre visible "Mis Cuentas", PIN de dos pasos. Cambiá `WHATSAPP_PHONE_ID` por el del número nuevo.
8. **Método de pago** en la cuenta de WhatsApp Business (para cuando se pasen los 1.000 gratis).
9. **Verificar el negocio** (sube los límites; puede tardar días). Para responder no hace falta: el límite de 250 por día es para conversaciones que inicia el negocio.
10. En `index.html`, poné el número en `WHATSAPP_NUMERO` (solo dígitos, ej. `5491122334455`). Con eso aparecen los botones que abren el chat con el código ya escrito.

## Publicar

```bash
# 1) base (una sola vez; es idempotente)
#    correr supabase/whatsapp.sql en el editor SQL, o como migración
# 2) función: sin verificación de JWT, porque Meta no manda uno (la seguridad es la firma)
supabase functions deploy whatsapp --no-verify-jwt --project-ref qrtypgsyyxioakqibwmz
```

## Darle Plus a alguien (hasta que haya cobros)

La app no puede cambiar `profiles.plan` (lo frena el trigger `profiles_plan_fijo`); se hace desde el editor SQL:

```sql
update public.profiles set plan = 'plus' where user_id = (select id from auth.users where email = 'alguien@mail.com');
```

Los administradores (`es_admin`) ya lo tienen sin cambiar nada.

## Cómo funciona

1. **Conectar**: en *Más → WhatsApp* el usuario toca *Conectar WhatsApp*; `whatsapp_codigo()` da un código de 6 dígitos que vence a los 15 minutos. Lo manda al número ("Conectar 123456" o solo "123456"). La función lo busca, guarda el número en `whatsapp_vinculos` y contesta. Un número por cuenta y una cuenta por número. Después de 5 códigos equivocados en una hora, ese número queda frenado una hora.
2. **Cargar**: texto → intérprete local (el mismo del dictado: monto, comercio, cuenta, tarjeta, cuotas, fecha, categoría). Si no encuentra el monto, va a Gemini. Audio y foto → Gemini (si el audio trae lo que dijo, también pasa por el intérprete local).
   - Con tarjeta o en cuotas → `card_purchases` + `card_installments` (respeta el día de cierre).
   - Lo demás → `transactions`, en la cuenta que nombró, o la última que usó para ese tipo.
   - Todo con `origen = 'whatsapp'` y `origen_ref = 'wa:<id del mensaje>'`. Si Meta reintenta el webhook, no se duplica (clave de `whatsapp_mensajes` e índice único de `origen_ref`).
   - Ahorros y gastos compartidos todavía no: contesta que se carguen desde la app.
3. **DESHACER** (o "borrar"): borra lo último cargado por WhatsApp en los últimos 7 días.
4. **Sin Plus**: contesta que es parte de Plus y no carga nada.
5. Más de 40 mensajes por hora desde un número: se ignoran (protege el costo de Meta y de Gemini).

## Pendientes

- Cobro de la suscripción Plus (Mercado Pago u otro) y que cambie `profiles.plan` solo, desde el servidor.
- Términos y política de privacidad: avisar que los mensajes pasan por Meta y por Google (Gemini) y que se guarda el número de teléfono.
- `whatsapp_mensajes` guarda el número de quien escribe aunque no tenga cuenta: definir cada cuánto se borran esos registros.
