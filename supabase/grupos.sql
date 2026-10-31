-- Gastos de grupo (viajes, salidas): grupos con integrantes que NO necesitan cuenta, gastos con quién pagó y entre
-- quiénes se reparte, y pagos ya hechos entre ellos. Idempotente: se puede correr más de una vez.
-- Los cálculos (reparto, saldos, quién le paga a quién) los hace `grupo.js` en el navegador; acá solo se guardan los datos.
-- Cada fila es de quien creó el grupo (user_id = auth.uid()). Compartirlo con otros usuarios es un paso posterior.

create table if not exists grupos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null default '',
  creado timestamptz not null default now()
);

create table if not exists grupo_miembros (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null check (length(trim(nombre)) > 0),
  -- si la persona tiene la app, se puede vincular con su usuario más adelante
  vinculo_user_id uuid references auth.users(id) on delete set null
);

create table if not exists grupo_gastos (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fecha date not null default current_date,
  descripcion text not null default '',
  monto numeric(14, 2) not null check (monto > 0),
  moneda text not null default 'ARS' check (moneda in ('ARS', 'USD')),
  pagador uuid references grupo_miembros(id) on delete restrict,
  -- si pagaron varios: { "<id miembro>": monto }. Si es null, pagó `pagador` solo.
  pagadores jsonb,
  -- ids de los miembros entre los que se reparte
  participantes uuid[] not null check (cardinality(participantes) > 0),
  reparto text not null default 'igual' check (reparto in ('igual', 'partes', 'porcentajes', 'montos')),
  detalle jsonb,
  check (pagador is not null or pagadores is not null)
);

create table if not exists grupo_liquidaciones (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references grupos(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fecha date not null default current_date,
  de uuid not null references grupo_miembros(id) on delete restrict,
  a uuid not null references grupo_miembros(id) on delete restrict,
  monto numeric(14, 2) not null check (monto > 0),
  moneda text not null default 'ARS' check (moneda in ('ARS', 'USD')),
  check (de <> a)
);

create index if not exists grupo_miembros_grupo on grupo_miembros (grupo_id);
create index if not exists grupo_gastos_grupo on grupo_gastos (grupo_id, fecha);
create index if not exists grupo_liquidaciones_grupo on grupo_liquidaciones (grupo_id);

alter table grupos enable row level security;
alter table grupo_miembros enable row level security;
alter table grupo_gastos enable row level security;
alter table grupo_liquidaciones enable row level security;

do $$
declare t text;
begin
  foreach t in array array['grupos', 'grupo_miembros', 'grupo_gastos', 'grupo_liquidaciones'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = t || '_propias') then
      execute format('create policy %I on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_propias', t);
    end if;
  end loop;
end $$;

-- Un gasto, un miembro o un pago solo pueden colgar de un grupo propio (evita colgar filas del grupo de otra persona).
create or replace function grupo_es_propio() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from grupos where id = new.grupo_id and user_id = auth.uid()) then
    raise exception 'El grupo no es tuyo';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['grupo_miembros', 'grupo_gastos', 'grupo_liquidaciones'] loop
    if not exists (select 1 from pg_trigger where tgname = t || '_grupo_propio') then
      execute format('create trigger %I before insert or update on %I for each row execute function grupo_es_propio()', t || '_grupo_propio', t);
    end if;
  end loop;
end $$;
