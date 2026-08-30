-- GROVIA: additional social-provider fields
-- Run this once in Supabase SQL Editor.

alter table public.grovia_social_accounts
  add column if not exists provider_account_id text,
  add column if not exists provider_username text,
  add column if not exists provider_display_name text,
  add column if not exists access_token text,
  add column if not exists refresh_token text,
  add column if not exists token_expires_at timestamptz,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create unique index if not exists grovia_social_accounts_user_platform_idx
  on public.grovia_social_accounts(user_id, platform);
