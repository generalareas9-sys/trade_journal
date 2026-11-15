

-- ==============================================================================
-- TradeJournal Payment Verification Migration
-- ==============================================================================

-- 1. Add rejection reason column.
alter table public.manual_payment_requests
  add column if not exists rejection_reason text;


-- 2. Enable Row Level Security.
alter table public.manual_payment_requests
  enable row level security;


-- 3. Allow customers to read only their own payment requests.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'manual_payment_requests'
      and policyname = 'manual_payment_requests_select_own'
  ) then
    create policy manual_payment_requests_select_own
      on public.manual_payment_requests
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;
end;
$$;

grant select on public.manual_payment_requests to authenticated;


-- 4. Restrict customer inserts to their own pending requests.
drop policy if exists manual_payment_requests_insert_own
  on public.manual_payment_requests;

create policy manual_payment_requests_insert_own
  on public.manual_payment_requests
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and status = 'pending'
    and reviewed_at is null
    and reviewed_by is null
    and rejection_reason is null
  );


-- 5. Enable Realtime for payment requests.
do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_publication
    where pubname = 'supabase_realtime'
  ) then
    raise exception 'The supabase_realtime publication is missing.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'manual_payment_requests'
  ) then
    alter publication supabase_realtime
      add table public.manual_payment_requests;
  end if;
end;
$$;


-- 6. Create the transactional payment resolution function.
create or replace function public.resolve_manual_payment_request(
  p_request_id uuid,
  p_action text,
  p_admin_id uuid,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.manual_payment_requests%rowtype;
  v_existing_subscription public.subscriptions%rowtype;
  v_now timestamptz := pg_catalog.now();
  v_activated_at timestamptz;
  v_expires_at timestamptz;
  v_reason text;
begin

  -- Validate action.
  if p_action is null or p_action not in ('approve', 'reject') then
    raise exception 'Invalid payment action.';
  end if;

  -- Validate administrator ID.
  if p_admin_id is null then
    raise exception 'An authorized administrator is required.';
  end if;

  -- Validate rejection reason.
  v_reason := nullif(pg_catalog.btrim(p_rejection_reason), '');

  if p_action = 'reject' and v_reason is null then
    raise exception 'A rejection reason is required.';
  end if;

  if pg_catalog.length(v_reason) > 1000 then
    raise exception 'Rejection reason must be 1000 characters or fewer.';
  end if;


  -- Lock payment request.
  select *
    into v_request
    from public.manual_payment_requests
   where id = p_request_id
   for update;

  if not found then
    raise exception 'Payment request not found.';
  end if;


  -- 7. Handle already-resolved requests.
  -- Explicit conditions avoid the previous SQL syntax error.
  if (p_action = 'approve' and v_request.status = 'approved')
     or (p_action = 'reject' and v_request.status = 'rejected') then

    if p_action = 'approve' then
      select *
        into v_existing_subscription
        from public.subscriptions
       where user_id = v_request.user_id;

      v_activated_at := coalesce(
        v_request.reviewed_at,
        v_existing_subscription.created_at
      );

      v_expires_at := v_existing_subscription.current_period_end;
    end if;

    return pg_catalog.jsonb_build_object(
      'status', v_request.status,
      'already_resolved', true,
      'request_id', v_request.id,
      'user_id', v_request.user_id,
      'plan', v_request.plan,
      'period', v_request.period,
      'method', v_request.method,
      'transaction_reference', v_request.tx_reference,
      'rejection_reason', v_request.rejection_reason,
      'activated_at', v_activated_at,
      'expires_at', v_expires_at
    );
  end if;


  -- Prevent conflicting resolutions.
  if v_request.status <> 'pending' then
    raise exception
      'This payment request has already been resolved.';
  end if;


  -- 8. Reject payment request.
  if p_action = 'reject' then

    update public.manual_payment_requests
       set status = 'rejected',
           rejection_reason = v_reason,
           reviewed_at = v_now,
           reviewed_by = p_admin_id
     where id = v_request.id;

    return pg_catalog.jsonb_build_object(
      'status', 'rejected',
      'already_resolved', false,
      'request_id', v_request.id,
      'user_id', v_request.user_id,
      'plan', v_request.plan,
      'period', v_request.period,
      'method', v_request.method,
      'transaction_reference', v_request.tx_reference,
      'rejection_reason', v_reason
    );
  end if;


  -- 9. Approve payment request.
  -- Serialize subscription changes for this customer.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(v_request.user_id::text)
  );

  select *
    into v_existing_subscription
    from public.subscriptions
   where user_id = v_request.user_id
   for update;


  -- Preserve remaining active subscription time.
  v_activated_at := v_now;

  if v_existing_subscription.status = 'active'
     and v_existing_subscription.current_period_end > v_now then
    v_activated_at := v_existing_subscription.current_period_end;
  end if;


  -- Calculate expiry.
  v_expires_at := v_activated_at
    + case
        when v_request.period = 'yearly'
          then interval '365 days'
        else interval '30 days'
      end;


  -- 10. Activate or extend subscription.
  insert into public.subscriptions (
    user_id,
    plan,
    period,
    status,
    current_period_end,
    provider,
    updated_at
  )
  values (
    v_request.user_id,
    v_request.plan,
    v_request.period,
    'active',
    v_expires_at,
    v_request.method,
    v_now
  )
  on conflict (user_id) do update
    set plan = excluded.plan,
        period = excluded.period,
        status = excluded.status,
        current_period_end = excluded.current_period_end,
        provider = excluded.provider,
        updated_at = excluded.updated_at;


  -- 11. Record payment only once.
  if not exists (
    select 1
      from public.payments
     where raw ->> 'manual_request_id' = v_request.id::text
  ) then

    insert into public.payments (
      user_id,
      plan,
      period,
      amount,
      currency,
      provider,
      status,
      tx_ref,
      raw
    )
    values (
      v_request.user_id,
      v_request.plan,
      v_request.period,
      v_request.amount,
      v_request.currency,
      v_request.method,
      'paid',
      'manual_' || v_request.method || '_' || v_request.id::text,
      pg_catalog.jsonb_build_object(
        'manual_request_id', v_request.id,
        'tx_reference', v_request.tx_reference,
        'approved_by', p_admin_id,
        'approved_at', v_now,
        'activated_at', v_activated_at,
        'expires_at', v_expires_at
      )
    );

  end if;


  -- 12. Mark request as approved.
  update public.manual_payment_requests
     set status = 'approved',
         rejection_reason = null,
         reviewed_at = v_now,
         reviewed_by = p_admin_id
   where id = v_request.id;


  -- 13. Return approval details.
  return pg_catalog.jsonb_build_object(
    'status', 'approved',
    'already_resolved', false,
    'request_id', v_request.id,
    'user_id', v_request.user_id,
    'plan', v_request.plan,
    'period', v_request.period,
    'method', v_request.method,
    'transaction_reference', v_request.tx_reference,
    'activated_at', v_activated_at,
    'expires_at', v_expires_at
  );

end;
$$;


-- 14. Restrict execution to service_role.
revoke all on function public.resolve_manual_payment_request(
  uuid, text, uuid, text
) from public, anon, authenticated;

grant execute on function public.resolve_manual_payment_request(
  uuid, text, uuid, text
) to service_role;


-- ==============================================================================
-- MIGRATION COMPLETE
-- ==============================================================================
