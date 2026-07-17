-- Hydro ANA / Mucum initial Supabase schema
-- Run this file in Supabase SQL Editor.

create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'operator', 'viewer', 'resident');
create type public.station_kind as enum ('rain', 'river_level', 'flow', 'telemetry');
create type public.alert_status as enum ('draft', 'active', 'resolved', 'cancelled');
create type public.notification_channel as enum ('push', 'whatsapp', 'sms', 'email');
create type public.notification_status as enum ('pending', 'sent', 'failed', 'cancelled');

create table public.municipalities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state_code char(2) not null,
  ibge_code text,
  river_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, state_code)
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'resident',
  full_name text,
  phone text,
  whatsapp text,
  municipality_id uuid references public.municipalities(id),
  neighborhood_id uuid,
  street_id uuid,
  preferred_shelter_id uuid,
  accepts_push boolean not null default true,
  accepts_whatsapp boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    'resident',
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create table public.neighborhoods (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  name text not null,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (municipality_id, name)
);

create table public.streets (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  neighborhood_id uuid references public.neighborhoods(id) on delete set null,
  name text not null,
  flood_risk_notes text,
  closes_at_river_level_m numeric(8, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (municipality_id, name)
);

create table public.shelters (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  neighborhood_id uuid references public.neighborhoods(id) on delete set null,
  name text not null,
  address text,
  capacity integer,
  contact_name text,
  contact_phone text,
  whatsapp text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_neighborhood_id_fkey
  foreign key (neighborhood_id) references public.neighborhoods(id) on delete set null;

alter table public.profiles
  add constraint profiles_street_id_fkey
  foreign key (street_id) references public.streets(id) on delete set null;

alter table public.profiles
  add constraint profiles_preferred_shelter_id_fkey
  foreign key (preferred_shelter_id) references public.shelters(id) on delete set null;

create table public.escape_routes (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  neighborhood_id uuid references public.neighborhoods(id) on delete set null,
  shelter_id uuid references public.shelters(id) on delete set null,
  name text not null,
  origin_description text,
  destination_description text,
  route_url text,
  distance_m integer,
  closes_at_river_level_m numeric(8, 2),
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.critical_points (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  neighborhood_id uuid references public.neighborhoods(id) on delete set null,
  street_id uuid references public.streets(id) on delete set null,
  name text not null,
  point_type text not null default 'street',
  description text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  starts_flooding_at_m numeric(8, 2),
  blocks_route_at_m numeric(8, 2),
  related_route_id uuid references public.escape_routes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.alert_levels (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  name text not null,
  severity integer not null check (severity between 0 and 10),
  color_hex char(7) not null,
  min_river_level_m numeric(8, 2),
  max_river_level_m numeric(8, 2),
  public_message text not null,
  operator_message text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (municipality_id, name)
);

create table public.monitoring_stations (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid references public.municipalities(id) on delete cascade,
  ana_code text not null,
  name text not null,
  kind public.station_kind not null,
  river_name text,
  state_code char(2),
  city_name text,
  basin_code text,
  sub_basin_code text,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  upstream_of_mucum boolean not null default false,
  priority integer not null default 0,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ana_code, kind)
);

create table public.station_readings (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.monitoring_stations(id) on delete cascade,
  measured_at timestamptz not null,
  river_level_m numeric(10, 3),
  rainfall_mm numeric(10, 3),
  flow_m3s numeric(12, 3),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (station_id, measured_at)
);

create table public.rainfall_aggregates (
  id uuid primary key default gen_random_uuid(),
  station_id uuid not null references public.monitoring_stations(id) on delete cascade,
  window_hours integer not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  rainfall_mm numeric(10, 3) not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (station_id, window_hours, starts_at, ends_at)
);

create table public.ana_api_responses (
  id uuid primary key default gen_random_uuid(),
  endpoint_key text,
  request_url text not null,
  request_params jsonb not null default '{}'::jsonb,
  http_status integer,
  api_code integer,
  api_status text,
  api_message text,
  response_payload jsonb not null,
  fetched_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

create table public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  alert_level_id uuid references public.alert_levels(id) on delete set null,
  name text not null,
  rule_type text not null,
  threshold_value numeric(12, 3) not null,
  threshold_unit text not null,
  window_hours integer,
  station_id uuid references public.monitoring_stations(id) on delete set null,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.alert_events (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  alert_level_id uuid references public.alert_levels(id) on delete set null,
  status public.alert_status not null default 'draft',
  title text not null,
  message text not null,
  river_level_m numeric(8, 2),
  rainfall_summary text,
  trend text,
  source text not null default 'manual',
  started_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.alert_event_neighborhoods (
  alert_event_id uuid not null references public.alert_events(id) on delete cascade,
  neighborhood_id uuid not null references public.neighborhoods(id) on delete cascade,
  primary key (alert_event_id, neighborhood_id)
);

create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  label text not null,
  contact_type text not null,
  phone text,
  whatsapp text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  alert_event_id uuid references public.alert_events(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  channel public.notification_channel not null,
  destination text not null,
  message text not null,
  status public.notification_status not null default 'pending',
  provider_response jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.profile_devices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  push_token text not null,
  device_label text,
  last_seen_at timestamptz not null default now(),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (push_token)
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger municipalities_set_updated_at
before update on public.municipalities
for each row execute function public.set_updated_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger neighborhoods_set_updated_at
before update on public.neighborhoods
for each row execute function public.set_updated_at();

create trigger streets_set_updated_at
before update on public.streets
for each row execute function public.set_updated_at();

create trigger shelters_set_updated_at
before update on public.shelters
for each row execute function public.set_updated_at();

create trigger escape_routes_set_updated_at
before update on public.escape_routes
for each row execute function public.set_updated_at();

create trigger critical_points_set_updated_at
before update on public.critical_points
for each row execute function public.set_updated_at();

create trigger alert_levels_set_updated_at
before update on public.alert_levels
for each row execute function public.set_updated_at();

create trigger monitoring_stations_set_updated_at
before update on public.monitoring_stations
for each row execute function public.set_updated_at();

create trigger alert_rules_set_updated_at
before update on public.alert_rules
for each row execute function public.set_updated_at();

create trigger alert_events_set_updated_at
before update on public.alert_events
for each row execute function public.set_updated_at();

create trigger emergency_contacts_set_updated_at
before update on public.emergency_contacts
for each row execute function public.set_updated_at();

create trigger profile_devices_set_updated_at
before update on public.profile_devices
for each row execute function public.set_updated_at();

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'resident'::public.app_role
  );
$$;

create or replace function public.is_admin_or_operator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin'::public.app_role, 'operator'::public.app_role);
$$;

alter table public.municipalities enable row level security;
alter table public.profiles enable row level security;
alter table public.neighborhoods enable row level security;
alter table public.streets enable row level security;
alter table public.shelters enable row level security;
alter table public.escape_routes enable row level security;
alter table public.critical_points enable row level security;
alter table public.alert_levels enable row level security;
alter table public.monitoring_stations enable row level security;
alter table public.station_readings enable row level security;
alter table public.rainfall_aggregates enable row level security;
alter table public.ana_api_responses enable row level security;
alter table public.alert_rules enable row level security;
alter table public.alert_events enable row level security;
alter table public.alert_event_neighborhoods enable row level security;
alter table public.emergency_contacts enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.profile_devices enable row level security;

create policy "public read municipalities" on public.municipalities
for select using (true);

create policy "public read local reference data" on public.neighborhoods
for select using (true);

create policy "public read streets" on public.streets
for select using (true);

create policy "public read shelters" on public.shelters
for select using (is_active = true or public.is_admin_or_operator());

create policy "public read escape routes" on public.escape_routes
for select using (is_active = true or public.is_admin_or_operator());

create policy "public read critical points" on public.critical_points
for select using (true);

create policy "public read alert levels" on public.alert_levels
for select using (is_active = true or public.is_admin_or_operator());

create policy "public read stations" on public.monitoring_stations
for select using (is_active = true or public.is_admin_or_operator());

create policy "public read readings" on public.station_readings
for select using (true);

create policy "public read rainfall aggregates" on public.rainfall_aggregates
for select using (true);

create policy "admin read api responses" on public.ana_api_responses
for select using (public.is_admin_or_operator());

create policy "public read active alerts" on public.alert_events
for select using (status = 'active' or public.is_admin_or_operator());

create policy "public read alert neighborhoods" on public.alert_event_neighborhoods
for select using (true);

create policy "public read emergency contacts" on public.emergency_contacts
for select using (is_active = true or public.is_admin_or_operator());

create policy "user read own profile" on public.profiles
for select using (id = auth.uid() or public.is_admin_or_operator());

create policy "user update own profile" on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

create policy "admin full access municipalities" on public.municipalities
for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

create policy "admin full access profiles" on public.profiles
for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

create policy "admin full access neighborhoods" on public.neighborhoods
for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

create policy "admin full access streets" on public.streets
for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

create policy "admin full access shelters" on public.shelters
for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

create policy "admin full access escape routes" on public.escape_routes
for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

create policy "admin full access critical points" on public.critical_points
for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

create policy "admin full access alert levels" on public.alert_levels
for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

create policy "admin full access stations" on public.monitoring_stations
for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

create policy "admin full access readings" on public.station_readings
for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

create policy "admin full access rainfall aggregates" on public.rainfall_aggregates
for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

create policy "admin full access api responses" on public.ana_api_responses
for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

create policy "admin full access alert rules" on public.alert_rules
for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

create policy "admin full access alert events" on public.alert_events
for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

create policy "admin full access alert event neighborhoods" on public.alert_event_neighborhoods
for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

create policy "admin full access emergency contacts" on public.emergency_contacts
for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

create policy "admin full access notification outbox" on public.notification_outbox
for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

create policy "user read own devices" on public.profile_devices
for select using (profile_id = auth.uid() or public.is_admin_or_operator());

create policy "user insert own devices" on public.profile_devices
for insert with check (profile_id = auth.uid());

create policy "user update own devices" on public.profile_devices
for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy "admin full access profile devices" on public.profile_devices
for all using (public.is_admin_or_operator()) with check (public.is_admin_or_operator());

create index idx_profiles_municipality on public.profiles(municipality_id);
create index idx_neighborhoods_municipality on public.neighborhoods(municipality_id);
create index idx_streets_neighborhood on public.streets(neighborhood_id);
create index idx_shelters_neighborhood on public.shelters(neighborhood_id);
create index idx_escape_routes_neighborhood on public.escape_routes(neighborhood_id);
create index idx_critical_points_neighborhood on public.critical_points(neighborhood_id);
create index idx_monitoring_stations_active on public.monitoring_stations(is_active, upstream_of_mucum);
create index idx_station_readings_station_time on public.station_readings(station_id, measured_at desc);
create index idx_rainfall_aggregates_station_window on public.rainfall_aggregates(station_id, window_hours, ends_at desc);
create index idx_ana_api_responses_endpoint_time on public.ana_api_responses(endpoint_key, fetched_at desc);
create index idx_alert_events_status_time on public.alert_events(status, started_at desc);
create index idx_notification_outbox_status on public.notification_outbox(status, created_at);
create index idx_profile_devices_profile on public.profile_devices(profile_id, is_active);

create or replace view public.v_latest_station_readings
with (security_invoker = true) as
select distinct on (s.id)
  s.id as station_id,
  s.ana_code,
  s.name as station_name,
  s.kind,
  s.river_name,
  s.upstream_of_mucum,
  s.priority,
  r.measured_at,
  r.river_level_m,
  r.rainfall_mm,
  r.flow_m3s,
  r.raw_payload
from public.monitoring_stations s
left join public.station_readings r on r.station_id = s.id
where s.is_active = true
order by s.id, r.measured_at desc nulls last;

create or replace view public.v_upstream_rain_status
with (security_invoker = true) as
select
  s.id as station_id,
  s.ana_code,
  s.name as station_name,
  s.river_name,
  s.priority,
  a.window_hours,
  a.starts_at,
  a.ends_at,
  a.rainfall_mm
from public.monitoring_stations s
join public.rainfall_aggregates a on a.station_id = s.id
where s.is_active = true
  and s.upstream_of_mucum = true
  and s.kind in ('rain', 'telemetry');

create or replace view public.v_active_alerts
with (security_invoker = true) as
select
  e.id,
  e.municipality_id,
  e.status,
  e.title,
  e.message,
  e.river_level_m,
  e.rainfall_summary,
  e.trend,
  e.source,
  e.started_at,
  l.name as alert_level_name,
  l.severity,
  l.color_hex
from public.alert_events e
left join public.alert_levels l on l.id = e.alert_level_id
where e.status = 'active';

insert into public.municipalities (name, state_code, ibge_code, river_name)
values ('Mucum', 'RS', null, 'Rio Taquari')
on conflict (name, state_code) do nothing;

with mucum as (
  select id from public.municipalities where name = 'Mucum' and state_code = 'RS'
)
insert into public.alert_levels (
  municipality_id,
  name,
  severity,
  color_hex,
  min_river_level_m,
  max_river_level_m,
  public_message,
  operator_message,
  sort_order
)
select id, 'Normal', 0, '#2f9e44', null, 15.99,
  'Situacao normal. Acompanhe os canais oficiais.',
  'Sem nivel de alerta operacional.',
  0
from mucum
union all
select id, 'Atencao 16m', 3, '#f08c00', 16.00, 16.99,
  'Nivel de atencao. Fique atento aos avisos oficiais e revise sua rota de fuga.',
  'Iniciar monitoramento reforcado a partir de 16m.',
  1
from mucum
union all
select id, 'Alerta 17m', 5, '#e67700', 17.00, 17.99,
  'Alerta de cheia. Moradores em areas de risco devem se preparar para deslocamento.',
  'Validar abrigos, rotas e comunicacao por bairro.',
  2
from mucum
union all
select id, 'Alerta 18m', 7, '#d9480f', 18.00, 18.99,
  'Alerta elevado. Siga orientacoes da Defesa Civil e evite areas proximas ao rio.',
  'Considerar acionamento de rotas e alertas segmentados.',
  3
from mucum
union all
select id, 'Evacuacao', 9, '#c92a2a', 19.00, null,
  'Risco severo de cheia. Procure rota segura e abrigo indicado pelas autoridades.',
  'Prioridade maxima: notificacao, abrigos e rotas.',
  4
from mucum
on conflict (municipality_id, name) do nothing;

with mucum as (
  select id from public.municipalities where name = 'Mucum' and state_code = 'RS'
)
insert into public.emergency_contacts (municipality_id, label, contact_type, phone, whatsapp, sort_order)
select id, 'Defesa Civil', 'emergency', null, null, 1 from mucum
union all
select id, 'Prefeitura Municipal', 'municipal', null, null, 2 from mucum;
