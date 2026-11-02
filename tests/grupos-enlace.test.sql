-- Pruebas del enlace de grupos sobre un Postgres local que imita a Supabase (roles anon/authenticated, auth.uid()).
-- Cómo correrlo: base vacía con los roles y auth.uid() de Supabase, luego grupos.sql, grupos-enlace.sql y este archivo con psql -At.
-- Cada línea tiene que empezar con «ok»; si alguna dice «MAL», algo se rompió.
\set ON_ERROR_STOP 1
\set QUIET 1
create or replace function pg_temp.debe_fallar(sql text, patron text) returns text language plpgsql as $$
begin
  begin execute sql; exception when others then
    if sqlerrm ~* patron then return 'ok  falla como debe: ' || sqlerrm; end if;
    return 'MAL falló con otro error: ' || sqlerrm;
  end;
  return 'MAL no falló: ' || sql;
end $$;
grant execute on function pg_temp.debe_fallar(text,text) to anon, authenticated;

-- DUEÑO (usuario 1) arma el cumple con enlace
set role authenticated; set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
insert into grupos (id, nombre) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Cumple de Juan');
insert into grupo_miembros (id, grupo_id, nombre) values ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001','Lu'),
  ('bbbbbbbb-0000-0000-0000-000000000002','aaaaaaaa-0000-0000-0000-000000000001','Juan');
update grupo_miembros set invitado = true where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select pg_temp.debe_fallar($$update grupos set enlace = 'corto' where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$, 'grupos_enlace_largo');
update grupos set enlace = 'enlace-secreto-de-prueba-123456' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
insert into grupo_gastos (grupo_id, descripcion, monto, pagador, participantes, reparto) values ('aaaaaaaa-0000-0000-0000-000000000001','Carne',60000,'bbbbbbbb-0000-0000-0000-000000000001',null,'asistentes');
select pg_temp.debe_fallar($$insert into grupo_gastos (grupo_id, monto, pagador, participantes, reparto) values ('aaaaaaaa-0000-0000-0000-000000000001',1,'bbbbbbbb-0000-0000-0000-000000000001',null,'igual')$$, 'todos_check');

-- AMIGO SIN CUENTA (anon)
reset request.jwt.claim.sub; set role anon;
\echo '-- anónimo'
select pg_temp.debe_fallar($$select grupo_por_enlace('adivinando-enlaces-al-azar-xxxx')$$, 'no existe');
select pg_temp.debe_fallar($$select grupo_por_enlace(null)$$, 'no existe');
select case when (select count(*) from grupos) = 0 then 'ok  anónimo no ve la tabla grupos directo' else 'MAL anónimo ve grupos' end;
select pg_temp.debe_fallar($$insert into grupos (nombre, user_id) values ('x','11111111-1111-1111-1111-111111111111')$$, 'row-level security|permission');
select pg_temp.debe_fallar($$select _grupo_de_enlace('enlace-secreto-de-prueba-123456')$$, 'permission denied');
select pg_temp.debe_fallar($$select grupos_donde_me_sumaron()$$, 'permission denied');
select 'ok  Mati se suma: ' || (grupo_enlace_sumarme('enlace-secreto-de-prueba-123456', '  Mati ') is not null);
select case when grupo_enlace_sumarme('enlace-secreto-de-prueba-123456','mati') = grupo_enlace_sumarme('enlace-secreto-de-prueba-123456','MATI') then 'ok  mismo nombre = misma persona (no duplica)' else 'MAL duplicó' end;
select pg_temp.debe_fallar($$select grupo_enlace_sumarme('enlace-secreto-de-prueba-123456', '   ')$$, 'nombre');
select pg_temp.debe_fallar($$select grupo_enlace_sumarme('enlace-secreto-de-prueba-123456', repeat('x',41))$$, 'nombre');
\gset
select grupo_enlace_sumarme('enlace-secreto-de-prueba-123456','Mati') as mati \gset
select grupo_enlace_asistencia('enlace-secreto-de-prueba-123456', :'mati', 2);
select pg_temp.debe_fallar(format($$select grupo_enlace_asistencia('enlace-secreto-de-prueba-123456', %L, 100)$$, :'mati'), '0 a 99');
select pg_temp.debe_fallar(format($$select grupo_enlace_asistencia('enlace-secreto-de-prueba-123456', %L, -1)$$, :'mati'), '0 a 99');
select grupo_enlace_gasto('enlace-secreto-de-prueba-123456', :'mati', 'Torta', 18000.555, 'ARS') as torta \gset
select pg_temp.debe_fallar(format($$select grupo_enlace_gasto('enlace-secreto-de-prueba-123456', %L, 'x', 0, 'ARS')$$, :'mati'), 'mayor a 0');
select pg_temp.debe_fallar(format($$select grupo_enlace_gasto('enlace-secreto-de-prueba-123456', %L, 'x', 10, 'EUR')$$, :'mati'), 'Moneda');
select pg_temp.debe_fallar($$select grupo_enlace_gasto('enlace-secreto-de-prueba-123456', 'bbbbbbbb-0000-0000-0000-00000000dead', 'x', 10, 'ARS')$$, 'no está en el grupo');
-- miembro de OTRO grupo no sirve con este enlace: se prueba más abajo con el grupo del usuario 3
select pg_temp.debe_fallar(format($$select grupo_enlace_borrar_gasto('enlace-secreto-de-prueba-123456', %L, (select null::uuid))$$, :'mati'), 'Solo podés borrar');
\echo '-- Mati intenta borrar la carne que cargó el dueño'
select pg_temp.debe_fallar(format($$select grupo_enlace_borrar_gasto('enlace-secreto-de-prueba-123456', %L, '%s')$$, :'mati',
  (select g->>'id' from json_array_elements(grupo_por_enlace('enlace-secreto-de-prueba-123456')->'gastos') g where g->>'descripcion'='Carne')), 'Solo podés borrar');
select grupo_enlace_pague('enlace-secreto-de-prueba-123456', :'mati', 'bbbbbbbb-0000-0000-0000-000000000001', 5000, 'ARS') as pago \gset
select pg_temp.debe_fallar(format($$select grupo_enlace_pague('enlace-secreto-de-prueba-123456', %L, %L, 5, 'ARS')$$, :'mati', :'mati'), 'vos');
select grupo_por_enlace('enlace-secreto-de-prueba-123456')::text ~ 'user_id' as filtra_user_id \gset
select case when :'filtra_user_id' = 'f' then 'ok  la respuesta no expone user_id' else 'MAL expone user_id' end;
select grupo_enlace_borrar_pago('enlace-secreto-de-prueba-123456', :'mati', :'pago');
select 'ok  ' || json_array_length(grupo_por_enlace('enlace-secreto-de-prueba-123456')->'miembros') || ' personas, ' ||
  json_array_length(grupo_por_enlace('enlace-secreto-de-prueba-123456')->'gastos') || ' gastos, monto torta redondeado: ' ||
  (select g->>'monto' from json_array_elements(grupo_por_enlace('enlace-secreto-de-prueba-123456')->'gastos') g where g->>'descripcion'='Torta');

-- AMIGO CON CUENTA (usuario 2): se vincula y ve el grupo en su app
set role authenticated; set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
\echo '-- con cuenta'
select grupo_enlace_sumarme('enlace-secreto-de-prueba-123456','Vale') as vale \gset
select case when (select m->>'soyYo' from json_array_elements(grupo_por_enlace('enlace-secreto-de-prueba-123456')->'miembros') m where m->>'nombre'='Vale') = 'true' then 'ok  Vale quedó vinculada a su cuenta' else 'MAL no vinculó' end;
select case when grupos_donde_me_sumaron()::text like '%Cumple de Juan%' then 'ok  le aparece en «Grupos donde te sumaron»' else 'MAL no aparece' end;
select case when (select count(*) from grupos) = 0 and (select count(*) from grupo_gastos) = 0 then 'ok  igual no puede leer las tablas del dueño directo' else 'MAL ve tablas ajenas' end;
update grupo_miembros set invitado = false;
reset role; select case when (select invitado from grupo_miembros where id='bbbbbbbb-0000-0000-0000-000000000002') then 'ok  un amigo con cuenta no puede sacarle el «invitado» a Juan' else 'MAL' end; set role authenticated;
-- usuario 2 intenta colgar un gasto de un grupo ajeno poniéndose como dueño de la fila
select pg_temp.debe_fallar($$insert into grupo_gastos (grupo_id, monto, pagador, participantes, reparto) values ('aaaaaaaa-0000-0000-0000-000000000001',1,'bbbbbbbb-0000-0000-0000-000000000001',null,'asistentes')$$, 'no es tuyo');
-- usuario 2 se vincula a Lu, que ya está vinculada? Lu no tiene vínculo: probar que no puede robar a Vale
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select grupo_enlace_soy('enlace-secreto-de-prueba-123456', :'vale');
select case when (select m->>'soyYo' from json_array_elements(grupo_por_enlace('enlace-secreto-de-prueba-123456')->'miembros') m where m->>'nombre'='Vale') = 'false' then 'ok  otro usuario no puede quedarse con la persona de Vale' else 'MAL robó el vínculo' end;
-- usuario 3 arma su propio grupo y prueba usar a Mati (de otro grupo) con su enlace
insert into grupos (id, nombre, enlace) values ('aaaaaaaa-0000-0000-0000-000000000003','Otro','enlace-del-usuario-tres-0000000');
select pg_temp.debe_fallar(format($$select grupo_enlace_gasto('enlace-del-usuario-tres-0000000', %L, 'x', 10, 'ARS')$$, :'mati'), 'no está en el grupo');

-- DUEÑO: ve todo lo cargado por el enlace, y al cambiar el enlace el viejo deja de andar
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
\echo '-- dueño'
select 'ok  el dueño ve ' || count(*) || ' personas (Lu, Juan, Mati, Vale)' from grupo_miembros where grupo_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select 'ok  el dueño ve el gasto de Mati: ' || descripcion || ' ' || monto from grupo_gastos where cargado_por is not null;
update grupos set enlace = 'enlace-nuevo-despues-de-cambiar-1' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
reset role; set role anon; reset request.jwt.claim.sub;
select pg_temp.debe_fallar($$select grupo_por_enlace('enlace-secreto-de-prueba-123456')$$, 'no existe');
