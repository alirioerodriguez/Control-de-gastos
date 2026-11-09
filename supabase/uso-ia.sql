-- v7.3 · Tope de uso de la IA (proyecto de Mis Cuentas)
--
-- uso_ia: una fila por cada pedido que pasa por la función gemini-proxy (solo quién y cuándo, nada
--   de lo que se dictó o fotografió). La función cuenta las de las últimas 24 horas y corta en 200:
--   el registro es abierto, así que sin tope cualquiera podría crearse una cuenta y gastar la cuota de
--   Gemini. Sin políticas: solo la usa la función (service_role). Se borra sola al eliminar la cuenta.

create table if not exists public.uso_ia (
  id       bigint generated always as identity primary key,
  user_id  uuid not null references auth.users(id) on delete cascade,
  at       timestamptz not null default now()
);
create index if not exists uso_ia_user_at_idx on public.uso_ia (user_id, at);

alter table public.uso_ia enable row level security;
revoke all on public.uso_ia from anon, authenticated;
