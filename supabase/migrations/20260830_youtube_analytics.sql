alter table public.grovia_analytics_daily
  add column if not exists subscribers_gained integer not null default 0;

create index if not exists grovia_analytics_user_date_idx
  on public.grovia_analytics_daily(user_id, metric_date desc);
