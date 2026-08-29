create table if not exists public.grovia_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  timezone text not null default 'Asia/Jakarta',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.grovia_profiles enable row level security;
drop policy if exists grovia_profiles_own on public.grovia_profiles;
create policy grovia_profiles_own on public.grovia_profiles
for all using (auth.uid() = id) with check (auth.uid() = id);

create table if not exists public.grovia_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'free',
  status text not null default 'active',
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists grovia_subscriptions_user_idx on public.grovia_subscriptions(user_id, created_at desc);
alter table public.grovia_subscriptions enable row level security;
drop policy if exists grovia_subscriptions_own on public.grovia_subscriptions;
create policy grovia_subscriptions_own on public.grovia_subscriptions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.grovia_ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  feature text not null default 'ai_content',
  credits_used integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists grovia_ai_usage_user_idx on public.grovia_ai_usage(user_id, created_at desc);
alter table public.grovia_ai_usage enable row level security;
drop policy if exists grovia_ai_usage_own on public.grovia_ai_usage;
create policy grovia_ai_usage_own on public.grovia_ai_usage
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into public.grovia_profiles(id)
select id from auth.users
on conflict (id) do nothing;

insert into public.grovia_subscriptions(user_id, plan, status)
select id, 'free', 'active' from auth.users
on conflict do nothing;
