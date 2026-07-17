-- Historico de rodadas da projecao hidrologica de Mucum.

alter table public.dashboard_snapshots
drop constraint if exists dashboard_snapshots_snapshot_key_check;

alter table public.dashboard_snapshots
add constraint dashboard_snapshots_snapshot_key_check
check (snapshot_key in ('context', 'current', 'forecast', 'projection'));

create table if not exists public.hydrological_projection_runs (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'mucum',
  model_version text not null,
  generated_at timestamptz not null,
  base_time timestamptz not null,
  horizon_hours integer not null default 72,
  current_level_m numeric,
  likely_peak_level_m numeric,
  likely_peak_at timestamptz,
  confidence_pct integer,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (horizon_hours > 0 and horizon_hours <= 168),
  check (confidence_pct is null or confidence_pct between 0 and 100)
);

alter table public.hydrological_projection_runs enable row level security;

drop policy if exists "public read hydrological projections" on public.hydrological_projection_runs;
create policy "public read hydrological projections"
on public.hydrological_projection_runs for select
using (true);

create index if not exists idx_hydrological_projection_runs_latest
on public.hydrological_projection_runs(scope, generated_at desc);

create index if not exists idx_hydrological_projection_runs_verification
on public.hydrological_projection_runs(scope, base_time, horizon_hours);
