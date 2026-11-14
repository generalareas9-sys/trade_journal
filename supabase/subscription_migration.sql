
-- ==============================================================================
-- TradeJournal Subscription & Payments Migration
-- Safe to run in Supabase SQL Editor.
-- ==============================================================================

-- 1. SUBSCRIPTIONS TABLE
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  plan text not null default 'essential',
  period text not null default 'monthly',
  status text not null default 'inactive',
  current_period_end timestamptz not null,
  provider text not null default 'chapa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ensure existing tables also use inactive as the default.
alter table public.subscriptions
alter column status set default 'inactive';

-- Subscription indexes
create index if not exists subscriptions_user_id_idx
on public.subscriptions (user_id);

create index if not exists subscriptions_status_idx
on public.subscriptions (status, current_period_end);


-- 2. PAYMENTS TABLE
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null,
  period text not null default 'monthly',
  amount numeric not null,
  currency text not null default 'ETB',
  provider text not null default 'chapa',
  status text not null default 'pending',
  tx_ref text unique not null,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Payment indexes
create index if not exists payments_user_id_idx
on public.payments (user_id, created_at desc);

create index if not exists payments_tx_ref_idx
on public.payments (tx_ref);

create index if not exists payments_status_idx
on public.payments (status);


-- 3. MANUAL PAYMENT REQUESTS TABLE
create table if not exists public.manual_payment_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  method text not null,
  plan text not null,
  period text not null default 'monthly',
  amount numeric not null,
  currency text not null default 'USD',
  tx_reference text not null,
  screenshot_url text,
  status text not null default 'pending',
  notes text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

-- Manual payment indexes
create index if not exists manual_payment_requests_user_id_idx
on public.manual_payment_requests (user_id, created_at desc);

create index if not exists manual_payment_requests_status_idx
on public.manual_payment_requests (status, created_at desc);


-- 4. ENABLE ROW LEVEL SECURITY
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.manual_payment_requests enable row level security;


-- 5. SUBSCRIPTION SECURITY POLICIES
-- Users can only read their own subscriptions.
-- Writes are reserved for trusted backend operations.

drop policy if exists "subscriptions_select_own"
on public.subscriptions;

create policy "subscriptions_select_own"
on public.subscriptions
for select
using (auth.uid() = user_id);


-- 6. PAYMENT SECURITY POLICIES
-- Users can only read their own payments.
-- Writes are reserved for trusted backend operations.

drop policy if exists "payments_select_own"
on public.payments;

create policy "payments_select_own"
on public.payments
for select
using (auth.uid() = user_id);


-- 7. MANUAL PAYMENT REQUEST SECURITY POLICIES
-- Users can read their own requests.

drop policy if exists "manual_payment_requests_select_own"
on public.manual_payment_requests;

create policy "manual_payment_requests_select_own"
on public.manual_payment_requests
for select
using (auth.uid() = user_id);

-- Users can submit their own payment requests.

drop policy if exists "manual_payment_requests_insert_own"
on public.manual_payment_requests;

create policy "manual_payment_requests_insert_own"
on public.manual_payment_requests
for insert
with check (auth.uid() = user_id);


-- 8. PRIVATE STORAGE BUCKET FOR PAYMENT PROOFS
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id)
do update set public = false;


-- 9. STORAGE SECURITY POLICIES
-- Users can only view their own payment proof files.

drop policy if exists "payment_proofs_select_own"
on storage.objects;

create policy "payment_proofs_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
);


-- Users can only upload files into their own folder.

drop policy if exists "payment_proofs_insert_own"
on storage.objects;

create policy "payment_proofs_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'payment-proofs'
  and (storage.foldername(name))[1] = auth.uid()::text
);


-- ==============================================================================
-- MIGRATION COMPLETE
-- ==============================================================================
