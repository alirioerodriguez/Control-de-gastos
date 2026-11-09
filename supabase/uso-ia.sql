-- v7.4 · Tope diario y cupo mensual de uso de la IA (proyecto de Mis Cuentas)
--
-- uso_ia: una fila por cada pedido que pasa por la función gemini-proxy (solo quién, cuándo y qué tipo,
--   nada de lo que se dictó o fotografió).
--   1) Seguridad: corta en 200 pedidos cada 24 horas por usuario.
--   2) Modelo de negocio: en el plan gratis permite 15 relecturas ('relectura') y 1 resumen de tarjeta
--      ('resumen_pdf') por mes calendario.

create table if not exists public.uso_ia (
  id       bigint generated always as identity primary key,
  user_id  uuid not null references auth.users(id) on delete cascade,
  at       timestamptz not null default now(),
  tipo     text not null default 'relectura' check (tipo in ('relectura', 'resumen_pdf'))
);

alter table public.uso_ia add column if not exists tipo text not null default 'relectura';
alter table public.uso_ia drop constraint if exists uso_ia_tipo_check;
alter table public.uso_ia add constraint uso_ia_tipo_check check (tipo in ('relectura', 'resumen_pdf'));

create index if not exists uso_ia_user_at_idx on public.uso_ia (user_id, at);
create index if not exists uso_ia_user_tipo_at_idx on public.uso_ia (user_id, tipo, at);

alter table public.uso_ia enable row level security;
revoke all on public.uso_ia from anon, authenticated;
