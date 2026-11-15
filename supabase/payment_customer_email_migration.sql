-- Log customer payment approval and rejection emails.
-- Safe to re-run; this migration does not delete or modify payment requests.

create table if not exists public.payment_email_notifications (
  id uuid primary key default gen_random_uuid(),
  payment_request_id uuid not null
    references public.manual_payment_requests (id) on delete cascade,
  event text not null check (event in ('approved', 'rejected')),
  recipient text,
  provider_message_id text,
  status text not null default 'pending'
    check (status in ('pending', 'sending', 'sent', 'failed')),
  error text,
  attempts integer not null default 0
    check (attempts between 0 and 3),
  delivery_key uuid not null default gen_random_uuid(),
  subscription_start_at timestamptz,
  subscription_end_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint payment_email_notifications_request_event_unique
    unique (payment_request_id, event)
);

alter table public.payment_email_notifications enable row level security;
revoke all on table public.payment_email_notifications from public, anon, authenticated;
grant all on table public.payment_email_notifications to service_role;

create index if not exists payment_email_notifications_status_updated_idx
  on public.payment_email_notifications (status, updated_at);
