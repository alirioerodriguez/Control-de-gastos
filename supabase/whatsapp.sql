-- Mis Cuentas por WhatsApp (plan Plus). Idempotente: se puede correr más de una vez.
-- El usuario manda sus gastos al número de Mis Cuentas (texto, audio o foto del ticket) y la función
-- supabase/functions/whatsapp los guarda con origen 'whatsapp' y origen_ref 'wa:<id del mensaje>'.
-- Pasos de Meta y secretos: supabase/whatsapp.md.

-- 1) Plan del usuario. Solo lo cambia el servidor (service_role o el editor SQL), nunca la app:
--    el mismo criterio que profiles_admin_fijo usa con es_admin.
alter table public.profiles add column if not exists plan text not null default 'gratis';
alter table public.profiles drop constraint if exists profiles_plan_check;
alter table public.profiles add constraint profiles_plan_check check (plan in ('gratis', 'plus'));

create or replace function public.profiles_plan_fijo()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then new.plan := 'gratis';
    elsif new.plan is distinct from old.plan then new.plan := old.plan;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists profiles_plan_fijo on public.profiles;
create trigger profiles_plan_fijo before insert or update on public.profiles
  for each row execute function public.profiles_plan_fijo();

-- 2) Las compras con tarjeta también pueden venir de WhatsApp (con cuotas).
alter table public.card_purchases add column if not exists origen text;
alter table public.card_purchases add column if not exists origen_ref text;
create unique index if not exists card_purchases_origen_ref_idx on public.card_purchases (user_id, origen_ref) where origen_ref is not null;

-- 3) Número vinculado: uno por cuenta y una cuenta por número. telefono es el wa_id de Meta (solo dígitos, ej. 5491122334455).
--    La app lo puede ver y desconectar; vincular solo lo hace la función, cuando llega el código por WhatsApp.
create table if not exists public.whatsapp_vinculos (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  telefono    text not null unique check (telefono ~ '^\d{8,15}$'),
  vinculado_at timestamptz not null default now()
);
alter table public.whatsapp_vinculos enable row level security;
drop policy if exists "vinculo propio: ver" on public.whatsapp_vinculos;
create policy "vinculo propio: ver" on public.whatsapp_vinculos
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "vinculo propio: desconectar" on public.whatsapp_vinculos;
create policy "vinculo propio: desconectar" on public.whatsapp_vinculos
  for delete to authenticated using (user_id = (select auth.uid()));

-- 4) Códigos de 6 dígitos para vincular. Vencen a los 15 minutos. Sin políticas: nadie los lee desde la app,
--    se piden con whatsapp_codigo() y los consume la función (service_role).
create table if not exists public.whatsapp_codigos (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  codigo    text not null unique check (codigo ~ '^\d{6}$'),
  expira_at timestamptz not null
);
alter table public.whatsapp_codigos enable row level security;

create or replace function public.whatsapp_codigo()
returns json
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_codigo text;
  v_expira timestamptz := now() + interval '15 minutes';
begin
  if v_uid is null then raise exception 'Sin sesión.'; end if;
  if not exists (select 1 from public.profiles where user_id = v_uid and (plan = 'plus' or es_admin)) then
    raise exception 'WhatsApp es parte de Mis Cuentas Plus.';
  end if;
  delete from public.whatsapp_codigos where expira_at < now();
  loop
    v_codigo := lpad((floor(random() * 1000000))::int::text, 6, '0');
    begin
      insert into public.whatsapp_codigos (user_id, codigo, expira_at) values (v_uid, v_codigo, v_expira)
        on conflict (user_id) do update set codigo = excluded.codigo, expira_at = excluded.expira_at;
      exit;
    exception when unique_violation then
      null; -- otro usuario tiene ese código ahora mismo: se prueba otro
    end;
  end loop;
  return json_build_object('codigo', v_codigo, 'expira_at', v_expira);
end $$;
revoke all on function public.whatsapp_codigo() from public, anon;
grant execute on function public.whatsapp_codigo() to authenticated;

-- 5) Registro de mensajes recibidos. La clave es el id de Meta: si Meta reintenta el webhook, no se carga dos veces.
--    Sirve también para DESHACER (tabla y fila que creó cada mensaje), para frenar a quien prueba códigos
--    y para contar respuestas del mes (las primeras 1.000 de servicio son gratis). Solo la usa la función.
create table if not exists public.whatsapp_mensajes (
  id         text primary key,
  telefono   text not null,
  user_id    uuid references auth.users (id) on delete cascade,
  tipo       text,
  resultado  text,
  tabla      text,
  fila_id    uuid,
  deshecho   boolean not null default false,
  respondido boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_mensajes_tel_idx on public.whatsapp_mensajes (telefono, created_at desc);
create index if not exists whatsapp_mensajes_user_idx on public.whatsapp_mensajes (user_id, created_at desc);
alter table public.whatsapp_mensajes enable row level security;
