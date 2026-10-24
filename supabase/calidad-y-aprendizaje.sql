-- v6.8 · Calidad de la carga y aprendizaje (proyecto de Mis Cuentas)
--
-- cargas_calidad: una fila por cada movimiento guardado desde la voz o la foto. Dice de dónde
--   salió cada dato (intérprete local, IA, QR de ARCA, QR de pago) y qué campos tuvo que
--   corregir la persona. NO guarda montos, comercios, textos dictados ni nada personal:
--   sólo nombres de campos y de orígenes. Sirve para saber dónde falla la carga.
-- aprendizajes: lo que la app aprende de las correcciones de cada persona ("el chino" →
--   Supermercado, "cotó" → Coto). Es de cada usuario y sólo lo ve él.
-- Las dos se borran solas al eliminar la cuenta (cascade desde auth.users).

create table if not exists public.cargas_calidad (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  creado      timestamptz not null default now(),
  entrada     text not null check (entrada in ('voz','foto','pdf')),
  con_ia      boolean not null default false,
  qr          text check (qr in ('arca','pago')),
  movimientos smallint not null default 1 check (movimientos between 1 and 20),
  corregidos  text[] not null default '{}',
  fuentes     jsonb not null default '{}'::jsonb,
  version     text
);
alter table public.cargas_calidad enable row level security;
create policy "cargo mis registros" on public.cargas_calidad for insert to authenticated with check (user_id = auth.uid());
create policy "veo mis registros"   on public.cargas_calidad for select to authenticated using (user_id = auth.uid());
create index if not exists cargas_calidad_creado on public.cargas_calidad (creado);
create index if not exists cargas_calidad_user on public.cargas_calidad (user_id);

create table if not exists public.aprendizajes (
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo        text not null check (tipo in ('categoria','comercio')),
  clave       text not null check (char_length(clave) between 2 and 60),
  valor       text not null check (char_length(valor) between 1 and 60),
  veces       integer not null default 1,
  actualizado timestamptz not null default now(),
  primary key (user_id, tipo, clave)
);
alter table public.aprendizajes enable row level security;
create policy "mis aprendizajes" on public.aprendizajes for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Para el dueño de la app (en el editor SQL de Supabase, que ve todo):
--   ¿qué campo se corrige más, y según de dónde vino?
--   select c.campo, fuentes->>c.campo as origen, count(*)
--   from public.cargas_calidad, unnest(corregidos) as c(campo)
--   group by 1,2 order by 3 desc;
--   ¿qué porcentaje de cargas no necesitó ninguna corrección?
--   select entrada, con_ia, round(100.0*avg((cardinality(corregidos)=0)::int),1) as pct_sin_correcciones, count(*)
--   from public.cargas_calidad group by 1,2;
