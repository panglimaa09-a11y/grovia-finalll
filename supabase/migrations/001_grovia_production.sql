-- GROVIA production schema. Additive only; no demo rows.
create extension if not exists pgcrypto;
create table if not exists public.grovia_profiles(id uuid primary key references auth.users(id) on delete cascade,display_name text,avatar_url text,timezone text not null default 'Asia/Jakarta',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.grovia_social_accounts(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,platform text not null,handle text,followers bigint not null default 0,engagement_rate numeric(8,3) not null default 0,status text not null default 'connected',token_expires_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.grovia_content_items(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,title text not null,format text,status text not null default 'draft',platforms text[] not null default '{}',body jsonb not null default '{}',created_at timestamptz not null default now(),published_at timestamptz);
create table if not exists public.grovia_scheduled_posts(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,content_id uuid references public.grovia_content_items(id) on delete set null,platform text not null,scheduled_at timestamptz not null,status text not null default 'scheduled',created_at timestamptz not null default now());
create table if not exists public.grovia_analytics_daily(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,metric_date date not null,followers bigint not null default 0,reach bigint not null default 0,views bigint not null default 0,watch_time_minutes numeric(14,2) not null default 0,engagement_rate numeric(8,3) not null default 0,created_at timestamptz not null default now(),unique(user_id,metric_date));
create table if not exists public.grovia_subscriptions(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,plan text not null,status text not null default 'active',monthly_price numeric(14,2) not null default 0,period_end timestamptz,created_at timestamptz not null default now());
create table if not exists public.grovia_ai_usage(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,credits_used integer not null default 0 check(credits_used>=0),feature text,created_at timestamptz not null default now());
create table if not exists public.grovia_admin_roles(user_id uuid primary key references auth.users(id) on delete cascade,role text not null check(role in('super_admin','admin','operator')),active boolean not null default true,created_at timestamptz not null default now());
create table if not exists public.grovia_audit_logs(id uuid primary key default gen_random_uuid(),actor_user_id uuid references auth.users(id) on delete set null,action text not null,target_type text,target_id text,result text not null default 'success',metadata jsonb not null default '{}',created_at timestamptz not null default now());

create index if not exists grovia_social_user_idx on public.grovia_social_accounts(user_id);
create index if not exists grovia_content_user_idx on public.grovia_content_items(user_id,created_at desc);
create index if not exists grovia_schedule_user_idx on public.grovia_scheduled_posts(user_id,scheduled_at);
create index if not exists grovia_analytics_user_idx on public.grovia_analytics_daily(user_id,metric_date desc);
create index if not exists grovia_sub_user_idx on public.grovia_subscriptions(user_id,created_at desc);
create index if not exists grovia_ai_user_idx on public.grovia_ai_usage(user_id,created_at desc);
create index if not exists grovia_audit_idx on public.grovia_audit_logs(created_at desc);

alter table public.grovia_profiles enable row level security;
alter table public.grovia_social_accounts enable row level security;
alter table public.grovia_content_items enable row level security;
alter table public.grovia_scheduled_posts enable row level security;
alter table public.grovia_analytics_daily enable row level security;
alter table public.grovia_subscriptions enable row level security;
alter table public.grovia_ai_usage enable row level security;
alter table public.grovia_admin_roles enable row level security;
alter table public.grovia_audit_logs enable row level security;

drop policy if exists grovia_profiles_own on public.grovia_profiles;create policy grovia_profiles_own on public.grovia_profiles for all using(auth.uid()=id) with check(auth.uid()=id);
drop policy if exists grovia_social_own on public.grovia_social_accounts;create policy grovia_social_own on public.grovia_social_accounts for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists grovia_content_own on public.grovia_content_items;create policy grovia_content_own on public.grovia_content_items for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists grovia_schedule_own on public.grovia_scheduled_posts;create policy grovia_schedule_own on public.grovia_scheduled_posts for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists grovia_analytics_own on public.grovia_analytics_daily;create policy grovia_analytics_own on public.grovia_analytics_daily for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists grovia_sub_own on public.grovia_subscriptions;create policy grovia_sub_own on public.grovia_subscriptions for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists grovia_ai_own on public.grovia_ai_usage;create policy grovia_ai_own on public.grovia_ai_usage for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists grovia_admin_roles_none on public.grovia_admin_roles;create policy grovia_admin_roles_none on public.grovia_admin_roles for all using(false) with check(false);
drop policy if exists grovia_audit_logs_none on public.grovia_audit_logs;create policy grovia_audit_logs_none on public.grovia_audit_logs for all using(false) with check(false);

create or replace function public.grovia_set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end; $$;
drop trigger if exists grovia_profiles_updated_at on public.grovia_profiles;create trigger grovia_profiles_updated_at before update on public.grovia_profiles for each row execute function public.grovia_set_updated_at();
drop trigger if exists grovia_social_updated_at on public.grovia_social_accounts;create trigger grovia_social_updated_at before update on public.grovia_social_accounts for each row execute function public.grovia_set_updated_at();
