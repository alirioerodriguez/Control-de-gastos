# Revisión de seguridad de Mis Cuentas

Última revisión: 09/11/2026, sobre la app publicada (control-de-gastos-lyart-theta.vercel.app), el proyecto de Supabase y el código.

## Qué se probó y resultado

| Prueba | Resultado |
|---|---|
| Reglas de la base (RLS) en las 27 tablas | ✅ Cada cuenta ve y cambia solo lo suyo. Lo compartido entre dos personas (`shared_txns`) solo lo ven los dos miembros de un par aceptado. La persona invitada solo puede cambiar el `estado` del par (permiso por columna). |
| Cuenta ajena simulada en la base real | ✅ 0 filas en todas las tablas (en la base hay 236 movimientos y 48 categorías de otras cuentas). |
| **Con una cuenta real** (sesión de Alirio, por la API publicada) | ✅ 0 filas ajenas en 18 tablas, cambiar movimientos ajenos: 0 afectados, crear uno a nombre de otra cuenta: rechazado (403), enlace de grupo inventado: rechazado, resultados de pruebas sin ser admin: rechazado. Sin sesión: no devuelve nada. |
| Grupos por enlace (funciones `grupo_enlace_*`, públicas a propósito) | ✅ El enlace tiene 192 bits al azar (`crypto.getRandomValues`) y la base exige 24 caracteres o más; topes de 60 personas, 500 gastos y montos razonables. Quien tiene el enlace puede ver y cargar gastos del grupo: es lo que se busca. |
| Buscar a alguien por mail para compartir | ✅ Pide sesión, solo encuentra cuentas con mail confirmado y tiene tope de 20 búsquedas por hora. |
| Función `honorapp` | ✅ Exige la clave compartida con honorapp (comparación sin filtrar por tiempo). |
| Inserción de código (XSS) | ✅ Todo texto que viene de otra persona (apodos, nombres y gastos de grupos, QR de pago) pasa por `esc()` o `textContent`; las páginas públicas `grupos.html` y `evento.html` también escapan. |
| Claves secretas en la web | ✅ Solo la clave pública `anon`. La de Gemini vive en la función `gemini-proxy`. |
| Librerías | ✅ Los 4 avisos de `npm audit` son de la herramienta de línea de comandos de Vercel; no viajan en la app (es HTML estático). |

## Qué se corrigió

1. **IA sin tope.** `gemini-proxy` aceptaba cualquier modelo `gemini-…` y pedidos sin límite. Como el registro es abierto, cualquiera podía crearse una cuenta y gastar la cuota de Gemini. Ahora solo acepta los dos modelos que usa la app y corta en 200 pedidos por persona cada 24 horas (tabla `uso_ia`, ver `supabase/uso-ia.sql`).
2. **Encabezados de seguridad en la web** (`vercel.json`): no se puede meter la app dentro de otra página, `nosniff`, y la dirección completa (que al entrar con Google lleva un código de un solo uso) no viaja a otros sitios.

## Pendiente

- **Publicar el tope de la IA:** correr `supabase/uso-ia.sql` en el SQL Editor y volver a publicar la función `gemini-proxy` (con verificación de JWT, como hasta ahora). El orden no importa: si la función se publica antes que la tabla, sigue andando sin tope.
- **Protección contra contraseñas filtradas** de Supabase: requiere el plan Pro.
