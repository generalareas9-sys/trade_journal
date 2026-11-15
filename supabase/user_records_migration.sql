-- Add per-user persistence for AI chat history, backtest snapshots, and risk calculations.
-- Safe to re-run; this migration does not remove existing data or weaken existing RLS.

create table if not exists public.ai_conversation_history (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  messages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint ai_conversation_history_messages_check
    check (
      case
        when jsonb_typeof(messages) = 'array' then jsonb_array_length(messages) <= 30
        else false
      end
    )
);

create table if not exists public.backtest_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  strategy text not null,
  symbol text not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint backtest_snapshots_snapshot_check
    check (jsonb_typeof(snapshot) = 'object')
);

create table if not exists public.risk_calculations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default 'Risk calculation',
  inputs jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint risk_calculations_title_check
    check (char_length(btrim(title)) between 1 and 120),
  constraint risk_calculations_inputs_check
    check (jsonb_typeof(inputs) = 'object'),
  constraint risk_calculations_results_check
    check (jsonb_typeof(results) = 'object')
);

create index if not exists backtest_snapshots_user_created_at_idx
  on public.backtest_snapshots (user_id, created_at desc);
create index if not exists risk_calculations_user_created_at_idx
  on public.risk_calculations (user_id, created_at desc);

alter table public.ai_conversation_history enable row level security;
alter table public.backtest_snapshots enable row level security;
alter table public.risk_calculations enable row level security;

revoke all on table public.ai_conversation_history from anon;
revoke all on table public.backtest_snapshots from anon;
revoke all on table public.risk_calculations from anon;
grant select, insert, update, delete on table public.ai_conversation_history to authenticated;
grant select, insert, update, delete on table public.backtest_snapshots to authenticated;
grant select, insert, update, delete on table public.risk_calculations to authenticated;

drop policy if exists ai_conversation_history_select_own on public.ai_conversation_history;
create policy ai_conversation_history_select_own on public.ai_conversation_history
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists ai_conversation_history_insert_own on public.ai_conversation_history;
create policy ai_conversation_history_insert_own on public.ai_conversation_history
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists ai_conversation_history_update_own on public.ai_conversation_history;
create policy ai_conversation_history_update_own on public.ai_conversation_history
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists ai_conversation_history_delete_own on public.ai_conversation_history;
create policy ai_conversation_history_delete_own on public.ai_conversation_history
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists backtest_snapshots_select_own on public.backtest_snapshots;
create policy backtest_snapshots_select_own on public.backtest_snapshots
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists backtest_snapshots_insert_own on public.backtest_snapshots;
create policy backtest_snapshots_insert_own on public.backtest_snapshots
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists backtest_snapshots_update_own on public.backtest_snapshots;
create policy backtest_snapshots_update_own on public.backtest_snapshots
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists backtest_snapshots_delete_own on public.backtest_snapshots;
create policy backtest_snapshots_delete_own on public.backtest_snapshots
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists risk_calculations_select_own on public.risk_calculations;
create policy risk_calculations_select_own on public.risk_calculations
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists risk_calculations_insert_own on public.risk_calculations;
create policy risk_calculations_insert_own on public.risk_calculations
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists risk_calculations_update_own on public.risk_calculations;
create policy risk_calculations_update_own on public.risk_calculations
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists risk_calculations_delete_own on public.risk_calculations;
create policy risk_calculations_delete_own on public.risk_calculations
  for delete to authenticated using (auth.uid() = user_id);
