create table if not exists public.grovia_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid,
  action text not null,
  result text not null default 'success',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists grovia_audit_logs_created_at_idx
  on public.grovia_audit_logs(created_at desc);

create index if not exists grovia_audit_logs_action_idx
  on public.grovia_audit_logs(action);

alter table public.grovia_audit_logs enable row level security;

-- Admin routes use the server-side service role. Do not add a public SELECT policy.
-- Optional authenticated self-audit policy is intentionally omitted for privacy.
