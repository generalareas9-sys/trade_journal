-- TradeJournal schema. Safe to re-run against a Supabase project.
-- Run this script in the Supabase SQL Editor as a project administrator.

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  broker text not null default '',
  currency text not null default 'USD',
  created_at timestamptz not null default now()
);

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  account_id uuid references public.accounts (id) on delete set null,
  symbol text not null,
  side text not null,
  entry_time timestamptz not null,
  exit_time timestamptz,
  entry_price numeric,
  exit_price numeric,
  size numeric not null default 0,
  fees numeric not null default 0,
  pnl numeric not null default 0,
  risk_amount numeric,
  rrr numeric,
  strategy text,
  tags text[] not null default '{}'::text[],
  session text,
  pre_analysis text,
  followed_rules text,
  entry_condition_met text,
  management text,
  exit_condition text,
  result text,
  psych_before text,
  psych_after text,
  risk_management text,
  stop_loss_system text,
  take_profit_system text,
  notes text,
  screenshot_before text,
  screenshot_after text,
  import_batch_id text,
  is_demo boolean not null default false,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  mood text,
  pre_market text,
  post_trade text,
  rules jsonb not null default '{}'::jsonb,
  constraint journal_entries_user_id_entry_date_key unique (user_id, entry_date)
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  body text not null default '',
  folder text,
  updated_at timestamptz not null default now()
);

create table if not exists public.playbooks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  description text not null default '',
  entry_rules jsonb not null default '[]'::jsonb,
  exit_rules jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '{}'::jsonb
);

create table if not exists public.profiles (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null default '',
  settings jsonb not null default '{}'::jsonb
);

create index if not exists accounts_user_id_created_at_idx
  on public.accounts (user_id, created_at desc);
create index if not exists trades_user_id_entry_time_idx
  on public.trades (user_id, entry_time desc);
create index if not exists trades_user_id_account_id_idx
  on public.trades (user_id, account_id);
create index if not exists trades_user_id_import_batch_id_idx
  on public.trades (user_id, import_batch_id)
  where import_batch_id is not null;
create index if not exists trades_user_id_demo_idx
  on public.trades (user_id, is_demo)
  where is_demo;
create index if not exists journal_entries_user_id_entry_date_idx
  on public.journal_entries (user_id, entry_date desc);
create index if not exists notes_user_id_updated_at_idx
  on public.notes (user_id, updated_at desc);
create index if not exists playbooks_user_id_name_idx
  on public.playbooks (user_id, name);

alter table public.accounts enable row level security;
alter table public.trades enable row level security;
alter table public.journal_entries enable row level security;
alter table public.notes enable row level security;
alter table public.playbooks enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "accounts_select_own" on public.accounts;
create policy "accounts_select_own" on public.accounts
  for select using (auth.uid() = user_id);
drop policy if exists "accounts_insert_own" on public.accounts;
create policy "accounts_insert_own" on public.accounts
  for insert with check (auth.uid() = user_id);
drop policy if exists "accounts_update_own" on public.accounts;
create policy "accounts_update_own" on public.accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "accounts_delete_own" on public.accounts;
create policy "accounts_delete_own" on public.accounts
  for delete using (auth.uid() = user_id);

drop policy if exists "trades_select_own" on public.trades;
create policy "trades_select_own" on public.trades
  for select using (auth.uid() = user_id);
drop policy if exists "trades_insert_own" on public.trades;
create policy "trades_insert_own" on public.trades
  for insert with check (auth.uid() = user_id);
drop policy if exists "trades_update_own" on public.trades;
create policy "trades_update_own" on public.trades
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "trades_delete_own" on public.trades;
create policy "trades_delete_own" on public.trades
  for delete using (auth.uid() = user_id);

drop policy if exists "journal_entries_select_own" on public.journal_entries;
create policy "journal_entries_select_own" on public.journal_entries
  for select using (auth.uid() = user_id);
drop policy if exists "journal_entries_insert_own" on public.journal_entries;
create policy "journal_entries_insert_own" on public.journal_entries
  for insert with check (auth.uid() = user_id);
drop policy if exists "journal_entries_update_own" on public.journal_entries;
create policy "journal_entries_update_own" on public.journal_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "journal_entries_delete_own" on public.journal_entries;
create policy "journal_entries_delete_own" on public.journal_entries
  for delete using (auth.uid() = user_id);

drop policy if exists "notes_select_own" on public.notes;
create policy "notes_select_own" on public.notes
  for select using (auth.uid() = user_id);
drop policy if exists "notes_insert_own" on public.notes;
create policy "notes_insert_own" on public.notes
  for insert with check (auth.uid() = user_id);
drop policy if exists "notes_update_own" on public.notes;
create policy "notes_update_own" on public.notes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "notes_delete_own" on public.notes;
create policy "notes_delete_own" on public.notes
  for delete using (auth.uid() = user_id);

drop policy if exists "playbooks_select_own" on public.playbooks;
create policy "playbooks_select_own" on public.playbooks
  for select using (auth.uid() = user_id);
drop policy if exists "playbooks_insert_own" on public.playbooks;
create policy "playbooks_insert_own" on public.playbooks
  for insert with check (auth.uid() = user_id);
drop policy if exists "playbooks_update_own" on public.playbooks;
create policy "playbooks_update_own" on public.playbooks
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "playbooks_delete_own" on public.playbooks;
create policy "playbooks_delete_own" on public.playbooks
  for delete using (auth.uid() = user_id);

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = user_id);
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = user_id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "profiles_delete_own" on public.profiles;
create policy "profiles_delete_own" on public.profiles
  for delete using (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', false)
on conflict (id) do update set public = false;

drop policy if exists "screenshots_select_own" on storage.objects;
create policy "screenshots_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "screenshots_insert_own" on storage.objects;
create policy "screenshots_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "screenshots_update_own" on storage.objects;
create policy "screenshots_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'screenshots' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "screenshots_delete_own" on storage.objects;
create policy "screenshots_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'screenshots' and (storage.foldername(name))[1] = auth.uid()::text);
