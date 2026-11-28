create function public.assert_settlement_payment_proof_trip(p_group_id bigint, p_proof_document_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_proof_document_id is null then
    return;
  end if;

  -- Mantiene el viaje del documento estable hasta guardar el vínculo.
  perform 1
  from public.trip_documents
  where id = p_proof_document_id and trip_id = p_group_id
  for share;

  if not found then
    raise exception 'Comprobante de pago invalido' using errcode = 'PZ001';
  end if;
end;
$$;

create function public.create_pending_settlement_payment(
  p_group_id bigint,
  p_from_user_id bigint,
  p_to_user_id bigint,
  p_creator_id bigint,
  p_amount numeric,
  p_payment_method text,
  p_note text,
  p_proof_document_id uuid
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  payment_id bigint;
begin
  perform public.assert_settlement_payment_proof_trip(p_group_id, p_proof_document_id);

  insert into public.settlement_payments (
    group_id, from_user_id, to_user_id, created_by_user_id, amount, payment_method, note
  )
  values (p_group_id, p_from_user_id, p_to_user_id, p_creator_id, p_amount, p_payment_method, p_note)
  returning id into payment_id;

  if p_proof_document_id is not null then
    insert into public.settlement_payment_documents (settlement_payment_id, trip_document_id)
    values (payment_id, p_proof_document_id);
  end if;

  return payment_id;
end;
$$;

create or replace function public.update_pending_settlement_payment(
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

  perform public.assert_settlement_payment_proof_trip(p_group_id, p_proof_document_id);

  delete from public.settlement_payment_documents
  where settlement_payment_id = p_payment_id;

  if p_proof_document_id is not null then
    insert into public.settlement_payment_documents (settlement_payment_id, trip_document_id)
    values (p_payment_id, p_proof_document_id);
  end if;

  return true;
end;
$$;

revoke execute on function public.assert_settlement_payment_proof_trip(bigint, uuid)
  from public, anon, authenticated;
revoke execute on function public.create_pending_settlement_payment(bigint, bigint, bigint, bigint, numeric, text, text, uuid)
  from public, anon, authenticated;
revoke execute on function public.update_pending_settlement_payment(bigint, bigint, bigint, numeric, text, text, uuid)
  from public, anon, authenticated;

grant execute on function public.assert_settlement_payment_proof_trip(bigint, uuid)
  to service_role;
grant execute on function public.create_pending_settlement_payment(bigint, bigint, bigint, bigint, numeric, text, text, uuid)
  to service_role;
grant execute on function public.update_pending_settlement_payment(bigint, bigint, bigint, numeric, text, text, uuid)
  to service_role;
