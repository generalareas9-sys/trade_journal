-- TradeJournal admin email notification support.
-- Run the Vault secret setup in the deployment notes before enabling the trigger.

create table if not exists public.email_notification_events (
  event_key text primary key check (length(event_key) between 1 and 256),
  event_type text not null check (event_type in (
    'registration',
    'payment-submitted',
    'payment-approved',
    'payment-rejected'
  )),
  status text not null check (status in ('sending', 'sent', 'failed')),
  attempts integer not null default 1 check (attempts > 0),
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.email_notification_events enable row level security;
revoke all on table public.email_notification_events from anon, authenticated;
grant all on table public.email_notification_events to service_role;

create extension if not exists pg_net;

create or replace function public.enqueue_registration_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  project_url text;
  webhook_secret text;
begin
  if new.email is null or new.email = '' then
    raise log 'TradeJournal registration notification skipped: auth user % has no email.', new.id;
    return new;
  end if;

  select decrypted_secret into project_url
  from vault.decrypted_secrets
  where name = 'tradejournal_project_url'
  limit 1;

  select decrypted_secret into webhook_secret
  from vault.decrypted_secrets
  where name = 'tradejournal_registration_webhook_secret'
  limit 1;

  if project_url is null or webhook_secret is null then
    raise log 'TradeJournal registration notification is not configured in Supabase Vault.';
    return new;
  end if;

  perform net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/notify-registration',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-registration-webhook-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'schema', 'auth',
      'table', 'users',
      'record', jsonb_build_object(
        'id', new.id,
        'email', new.email,
        'created_at', new.created_at
      )
    )
  );
  return new;
exception
  when others then
    raise log 'Could not enqueue TradeJournal registration notification for user %: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists notify_tradejournal_registration on auth.users;
create trigger notify_tradejournal_registration
after insert on auth.users
for each row
execute function public.enqueue_registration_notification();
