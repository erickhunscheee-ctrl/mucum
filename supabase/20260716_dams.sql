-- Barragens e leituras operacionais para painel de Mucum.
-- Rode no Supabase SQL Editor se o schema principal ja foi criado.

create table if not exists public.dams (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid references public.municipalities(id) on delete cascade,
  name text not null,
  river_name text,
  operator_name text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  upstream_of_mucum boolean not null default true,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dam_readings (
  id uuid primary key default gen_random_uuid(),
  dam_id uuid not null references public.dams(id) on delete cascade,
  measured_at timestamptz not null,
  inflow_m3s numeric(12, 3),
  outflow_m3s numeric(12, 3),
  reservoir_level_m numeric(10, 3),
  spillway_status text,
  source text not null default 'manual',
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (dam_id, measured_at)
);

create trigger dams_set_updated_at
before update on public.dams
for each row execute function public.set_updated_at();

alter table public.dams enable row level security;
alter table public.dam_readings enable row level security;

create policy "public read active dams" on public.dams
for select using (is_active = true or public.is_admin_or_operator());

create policy "public read dam readings" on public.dam_readings
for select using (true);

create policy "admin full access dams" on public.dams
for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

create policy "admin full access dam readings" on public.dam_readings
for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

create index if not exists idx_dams_active_upstream on public.dams(is_active, upstream_of_mucum);
create index if not exists idx_dam_readings_dam_time on public.dam_readings(dam_id, measured_at desc);

create or replace view public.v_latest_dam_readings
with (security_invoker = true) as
select distinct on (d.id)
  d.id as dam_id,
  d.name as dam_name,
  d.river_name,
  d.operator_name,
  d.upstream_of_mucum,
  r.measured_at,
  r.inflow_m3s,
  r.outflow_m3s,
  r.reservoir_level_m,
  r.spillway_status,
  r.source,
  r.raw_payload
from public.dams d
left join public.dam_readings r on r.dam_id = d.id
where d.is_active = true
order by d.id, r.measured_at desc nulls last;
