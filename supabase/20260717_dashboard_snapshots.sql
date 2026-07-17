-- Snapshots prontos para abrir o dashboard sem aguardar APIs externas.

create table if not exists public.dashboard_snapshots (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'mucum',
  snapshot_key text not null,
  rain_window_hours integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  data_updated_at timestamptz not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope, snapshot_key, rain_window_hours),
  check (snapshot_key in ('context', 'current', 'forecast', 'projection')),
  check (rain_window_hours in (0, 24, 168, 720))
);

alter table public.dashboard_snapshots enable row level security;

drop policy if exists "public read dashboard snapshots" on public.dashboard_snapshots;
create policy "public read dashboard snapshots"
on public.dashboard_snapshots for select
using (true);

drop policy if exists "admin full access dashboard snapshots" on public.dashboard_snapshots;
create policy "admin full access dashboard snapshots"
on public.dashboard_snapshots for all
using (public.is_admin_or_operator())
with check (public.is_admin_or_operator());

create index if not exists idx_dashboard_snapshots_lookup
on public.dashboard_snapshots(scope, snapshot_key, rain_window_hours, fetched_at desc);

drop trigger if exists dashboard_snapshots_set_updated_at on public.dashboard_snapshots;
create trigger dashboard_snapshots_set_updated_at
before update on public.dashboard_snapshots
for each row execute function public.set_updated_at();
