-- Enlace con honorapp (app de cobros a pacientes). Idempotente: se puede correr más de una vez.
-- Los cobros de honorapp llegan como ingresos: un movimiento por mes y moneda (origen_ref 'honorapp:AAAA-MM:ARS').
-- Los manda la función supabase/functions/honorapp, que comparte una clave secreta (ENLACE_SECRETO) con honorapp.

alter table public.transactions add column if not exists origen text;
alter table public.transactions add column if not exists origen_ref text;
create unique index if not exists transactions_origen_ref_idx on public.transactions (user_id, origen_ref) where origen_ref is not null;

create table if not exists public.enlace_honorapp (
  user_id      uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  cuenta_ars   text,
  cuenta_usd   text,
  activo       boolean not null default true,
  ultimo_envio timestamptz,
  created_at   timestamptz not null default now()
);
alter table public.enlace_honorapp enable row level security;
drop policy if exists "enlace propio" on public.enlace_honorapp;
create policy "enlace propio" on public.enlace_honorapp
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Gmail: gmail.com y googlemail.com son la misma casilla, y no distingue puntos ni lo que va después de «+».
create or replace function public.mail_canonico(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when split_part(lower(trim(p_email)), '@', 2) in ('gmail.com', 'googlemail.com')
      then replace(split_part(split_part(lower(trim(p_email)), '@', 1), '+', 1), '.', '') || '@gmail.com'
    else lower(trim(p_email))
  end;
$$;

-- Busca la cuenta por mail confirmado (solo la usa la función, con service_role).
create or replace function public.usuario_por_mail(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users
  where public.mail_canonico(email) = public.mail_canonico(p_email) and email_confirmed_at is not null
  order by created_at
  limit 1;
$$;
revoke all on function public.usuario_por_mail(text) from public, anon, authenticated;
grant execute on function public.usuario_por_mail(text) to service_role;
