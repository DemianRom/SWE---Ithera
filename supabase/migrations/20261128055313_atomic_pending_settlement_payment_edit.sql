create function public.update_pending_settlement_payment(
  p_payment_id bigint,
  p_group_id bigint,
  p_creator_id bigint,
  p_amount numeric,
  p_payment_method text,
  p_note text,
  p_proof_document_id uuid
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.settlement_payments
  set amount = p_amount,
      payment_method = p_payment_method,
      note = p_note,
      paid_at = now()
  where id = p_payment_id
    and group_id = p_group_id
    and created_by_user_id = p_creator_id
    and status = 'pendiente_validacion';

  if not found then
    return false;
  end if;

  delete from public.settlement_payment_documents
  where settlement_payment_id = p_payment_id;

  if p_proof_document_id is not null then
    insert into public.settlement_payment_documents (settlement_payment_id, trip_document_id)
    values (p_payment_id, p_proof_document_id);
  end if;

  return true;
end;
$$;

revoke execute on function public.update_pending_settlement_payment(bigint, bigint, bigint, numeric, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.update_pending_settlement_payment(bigint, bigint, bigint, numeric, text, text, uuid)
  to service_role;
