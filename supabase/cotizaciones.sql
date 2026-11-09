-- v7.4 · Cotización del dólar del día en cada movimiento (Dólar MEP de referencia)
-- Idempotente: se puede correr dos veces sin romper nada.
-- La tabla `transactions` ya tiene RLS por `user_id = auth.uid()`.

alter table public.transactions add column if not exists dolar_dia numeric(12, 2);
