-- Eliminar mi cuenta (lo pide Google Play). Idempotente: se puede correr más de una vez.
-- Borra el usuario de auth.users, y todas las tablas con user_id → auth.users (on delete cascade) se van con él:
-- accounts, cards, card_purchases, card_installments, card_statements, transactions, transfers, categories,
-- budgets, recurring, savings_goals, savings_entries, savings_valuations, contacts, split_expenses,
-- shared_pairs (y sus shared_txns), profiles, enlace_honorapp, pruebas.
-- busquedas_mail no tiene llave a auth.users: se borra a mano.
-- Las fotos del bucket avatars (carpeta <user_id>/) las borra la app antes de llamar a esta función:
-- Supabase no deja borrar storage.objects desde SQL.
-- El trigger cuenta_en_uso ya deja pasar el borrado en cascada (mira si el usuario sigue existiendo).

create or replace function public.eliminar_mi_cuenta()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Tenés que iniciar sesión para eliminar tu cuenta' using errcode = '42501';
  end if;
  delete from public.busquedas_mail where user_id = v_uid;
  delete from auth.users where id = v_uid;
end $$;

revoke all on function public.eliminar_mi_cuenta() from public, anon;
grant execute on function public.eliminar_mi_cuenta() to authenticated;
