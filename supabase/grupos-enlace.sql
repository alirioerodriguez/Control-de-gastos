-- Grupos compartidos por enlace (eventos: cumpleaños, asados). Correr DESPUÉS de grupos.sql. Idempotente.
--
-- Quien arma el grupo genera un enlace secreto y lo manda por WhatsApp. Con ese enlace, sin cuenta, cada amigo:
--   · se suma con su nombre (o elige quién es de la lista),
--   · dice cuántos van con él,
--   · carga lo que pagó (se reparte entre todos según cuántos van) y puede borrar solo lo que cargó él,
--   · anota «ya le pagué» de lo que él debe.
-- No puede: borrar el grupo, sacar gente, marcar invitados ni tocar los gastos de otros. Eso queda para el dueño.
-- Si el amigo tiene cuenta en Mis Cuentas y está logueado, su persona del grupo queda vinculada a su usuario y el grupo
-- le aparece en la app («Grupos donde te sumaron»).
--
-- Todo entra por funciones (rpc) que validan el enlace; las tablas siguen cerradas por RLS (solo el dueño).

alter table grupos add column if not exists enlace text;
create unique index if not exists grupos_enlace on grupos (enlace) where enlace is not null;
alter table grupos drop constraint if exists grupos_enlace_largo;
alter table grupos add constraint grupos_enlace_largo check (enlace is null or length(enlace) >= 24);

-- Un gasto «entre todos» (también los que se sumen después) se guarda sin lista de participantes.
alter table grupo_gastos alter column participantes drop not null;
alter table grupo_gastos drop constraint if exists grupo_gastos_todos_check;
alter table grupo_gastos add constraint grupo_gastos_todos_check check (participantes is not null or reparto = 'asistentes');
-- quién lo cargó por el enlace (para que solo esa persona lo pueda borrar desde ahí)
alter table grupo_gastos add column if not exists cargado_por uuid references grupo_miembros(id) on delete set null;
alter table grupo_liquidaciones add column if not exists cargado_por uuid references grupo_miembros(id) on delete set null;

-- El control «el grupo es tuyo» pasa a comparar con el dueño de la fila: para las escrituras directas es lo mismo
-- (RLS obliga user_id = auth.uid()), y deja que las funciones del enlace escriban a nombre del dueño del grupo.
create or replace function grupo_es_propio() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from grupos where id = new.grupo_id and user_id = new.user_id) then
    raise exception 'El grupo no es tuyo';
  end if;
  return new;
end $$;

-- ---------- funciones del enlace ----------

create or replace function _grupo_de_enlace(p_enlace text) returns grupos language plpgsql security definer set search_path = public as $$
declare g grupos;
begin
  select * into g from grupos where enlace = p_enlace and p_enlace is not null and length(p_enlace) >= 24;
  if not found then raise exception 'Este enlace no existe o lo cambiaron. Pedile uno nuevo a quien armó el grupo.' using errcode = 'P0002'; end if;
  return g;
end $$;

create or replace function _miembro_del_grupo(p_grupo uuid, p_miembro uuid) returns grupo_miembros language plpgsql security definer set search_path = public as $$
declare m grupo_miembros;
begin
  select * into m from grupo_miembros where id = p_miembro and grupo_id = p_grupo;
  if not found then raise exception 'Esa persona no está en el grupo.' using errcode = 'P0002'; end if;
  return m;
end $$;

-- Todo lo que hace falta para mostrar el grupo. Sin user_id de nadie.
create or replace function grupo_por_enlace(p_enlace text) returns json language plpgsql stable security definer set search_path = public as $$
declare g grupos;
begin
  g := _grupo_de_enlace(p_enlace);
  return json_build_object(
    'grupo', json_build_object('id', g.id, 'nombre', g.nombre),
    'miembros', coalesce((select json_agg(json_build_object('id', id, 'nombre', nombre, 'cuantos', cuantos, 'invitado', invitado,
                  'soyYo', auth.uid() is not null and vinculo_user_id = auth.uid()) order by nombre) from grupo_miembros where grupo_id = g.id), '[]'),
    'gastos', coalesce((select json_agg(json_build_object('id', id, 'fecha', fecha, 'descripcion', descripcion, 'monto', monto, 'moneda', moneda,
                  'pagador', pagador, 'pagadores', pagadores, 'participantes', participantes, 'reparto', reparto, 'detalle', detalle,
                  'cargado_por', cargado_por) order by fecha, id) from grupo_gastos where grupo_id = g.id), '[]'),
    'liqs', coalesce((select json_agg(json_build_object('id', id, 'de', de, 'a', a, 'monto', monto, 'moneda', moneda, 'fecha', fecha))
                  from grupo_liquidaciones where grupo_id = g.id), '[]'));
end $$;

-- Sumarse con un nombre (si ya está ese nombre, devuelve esa persona). Con cuenta, la vincula.
create or replace function grupo_enlace_sumarme(p_enlace text, p_nombre text) returns uuid language plpgsql security definer set search_path = public as $$
declare g grupos; m grupo_miembros; n text := btrim(coalesce(p_nombre, ''));
begin
  g := _grupo_de_enlace(p_enlace);
  if length(n) = 0 or length(n) > 40 then raise exception 'Escribí tu nombre (hasta 40 letras).'; end if;
  select * into m from grupo_miembros where grupo_id = g.id and lower(nombre) = lower(n);
  if not found then
    if (select count(*) from grupo_miembros where grupo_id = g.id) >= 60 then raise exception 'El grupo ya tiene 60 personas.'; end if;
    insert into grupo_miembros (grupo_id, user_id, nombre) values (g.id, g.user_id, n) returning * into m;
  end if;
  if auth.uid() is not null and auth.uid() <> g.user_id and m.vinculo_user_id is null then
    update grupo_miembros set vinculo_user_id = auth.uid() where id = m.id;
  end if;
  return m.id;
end $$;

-- «Soy yo» sobre alguien que ya estaba en la lista: con cuenta, lo vincula (si nadie lo hizo antes).
create or replace function grupo_enlace_soy(p_enlace text, p_miembro uuid) returns void language plpgsql security definer set search_path = public as $$
declare g grupos; m grupo_miembros;
begin
  g := _grupo_de_enlace(p_enlace);
  m := _miembro_del_grupo(g.id, p_miembro);
  if auth.uid() is not null and auth.uid() <> g.user_id and m.vinculo_user_id is null then
    update grupo_miembros set vinculo_user_id = auth.uid() where id = m.id;
  end if;
end $$;

create or replace function grupo_enlace_asistencia(p_enlace text, p_miembro uuid, p_cuantos int) returns void language plpgsql security definer set search_path = public as $$
declare g grupos; m grupo_miembros;
begin
  g := _grupo_de_enlace(p_enlace);
  m := _miembro_del_grupo(g.id, p_miembro);
  if p_cuantos is null or p_cuantos < 0 or p_cuantos > 99 then raise exception 'Cuántos van: de 0 a 99.'; end if;
  update grupo_miembros set cuantos = p_cuantos where id = m.id;
end $$;

-- Lo que pagó esa persona: se reparte entre todos según cuántos van.
create or replace function grupo_enlace_gasto(p_enlace text, p_miembro uuid, p_descripcion text, p_monto numeric, p_moneda text)
returns uuid language plpgsql security definer set search_path = public as $$
declare g grupos; m grupo_miembros; nuevo uuid;
begin
  g := _grupo_de_enlace(p_enlace);
  m := _miembro_del_grupo(g.id, p_miembro);
  if p_monto is null or p_monto <= 0 or p_monto > 100000000 then raise exception 'El monto tiene que ser mayor a 0.'; end if;
  if coalesce(p_moneda, '') not in ('ARS', 'USD') then raise exception 'Moneda desconocida.'; end if;
  if (select count(*) from grupo_gastos where grupo_id = g.id) >= 500 then raise exception 'El grupo ya tiene 500 gastos.'; end if;
  insert into grupo_gastos (grupo_id, user_id, descripcion, monto, moneda, pagador, participantes, reparto, cargado_por)
    values (g.id, g.user_id, left(btrim(coalesce(p_descripcion, '')), 80), round(p_monto, 2), p_moneda, m.id, null, 'asistentes', m.id)
    returning id into nuevo;
  return nuevo;
end $$;

create or replace function grupo_enlace_borrar_gasto(p_enlace text, p_miembro uuid, p_gasto uuid) returns void language plpgsql security definer set search_path = public as $$
declare g grupos;
begin
  g := _grupo_de_enlace(p_enlace);
  perform _miembro_del_grupo(g.id, p_miembro);
  delete from grupo_gastos where id = p_gasto and grupo_id = g.id and cargado_por = p_miembro;
  if not found then raise exception 'Solo podés borrar los gastos que cargaste vos.'; end if;
end $$;

-- «Ya le pagué»: solo lo que debe esa persona (de = ella).
create or replace function grupo_enlace_pague(p_enlace text, p_miembro uuid, p_a uuid, p_monto numeric, p_moneda text) returns uuid language plpgsql security definer set search_path = public as $$
declare g grupos; nuevo uuid;
begin
  g := _grupo_de_enlace(p_enlace);
  perform _miembro_del_grupo(g.id, p_miembro);
  perform _miembro_del_grupo(g.id, p_a);
  if p_a = p_miembro then raise exception 'No te podés pagar a vos.'; end if;
  if p_monto is null or p_monto <= 0 or p_monto > 100000000 then raise exception 'El monto tiene que ser mayor a 0.'; end if;
  if coalesce(p_moneda, '') not in ('ARS', 'USD') then raise exception 'Moneda desconocida.'; end if;
  insert into grupo_liquidaciones (grupo_id, user_id, de, a, monto, moneda, cargado_por)
    values (g.id, g.user_id, p_miembro, p_a, round(p_monto, 2), p_moneda, p_miembro) returning id into nuevo;
  return nuevo;
end $$;

create or replace function grupo_enlace_borrar_pago(p_enlace text, p_miembro uuid, p_pago uuid) returns void language plpgsql security definer set search_path = public as $$
declare g grupos;
begin
  g := _grupo_de_enlace(p_enlace);
  perform _miembro_del_grupo(g.id, p_miembro);
  delete from grupo_liquidaciones where id = p_pago and grupo_id = g.id and cargado_por = p_miembro;
  if not found then raise exception 'Solo podés deshacer los pagos que anotaste vos.'; end if;
end $$;

-- Para quien tiene cuenta: los grupos de otros donde está vinculado.
create or replace function grupos_donde_me_sumaron() returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('nombre', g.nombre, 'enlace', g.enlace) order by g.creado desc), '[]')
  from grupos g
  where g.enlace is not null and g.user_id <> auth.uid()
    and exists (select 1 from grupo_miembros m where m.grupo_id = g.id and m.vinculo_user_id = auth.uid());
$$;

-- Las funciones internas no se llaman de afuera; las del enlace, sí (con o sin cuenta).
revoke all on function _grupo_de_enlace(text), _miembro_del_grupo(uuid, uuid) from public, anon, authenticated;
revoke all on function grupo_es_propio() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'grupo_por_enlace(text)', 'grupo_enlace_sumarme(text, text)', 'grupo_enlace_soy(text, uuid)',
    'grupo_enlace_asistencia(text, uuid, int)', 'grupo_enlace_gasto(text, uuid, text, numeric, text)',
    'grupo_enlace_borrar_gasto(text, uuid, uuid)', 'grupo_enlace_pague(text, uuid, uuid, numeric, text)',
    'grupo_enlace_borrar_pago(text, uuid, uuid)'] loop
    execute format('revoke all on function %s from public', f);
    execute format('grant execute on function %s to anon, authenticated', f);
  end loop;
end $$;
revoke all on function grupos_donde_me_sumaron() from public, anon;
grant execute on function grupos_donde_me_sumaron() to authenticated;
