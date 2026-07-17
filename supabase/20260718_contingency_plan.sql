-- Estrutura operacional extraida do Plano de Contingencia de Mucum/RS (2026).
-- Telefones e nomes pessoais do documento nao sao publicados por esta migration.

create table if not exists public.contingency_plans (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  title text not null,
  version text not null,
  source_file text not null,
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  reviewed_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (municipality_id, version)
);

create table if not exists public.contingency_operational_stages (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.contingency_plans(id) on delete cascade,
  code text not null,
  name text not null,
  river_level_m numeric(8, 2) not null,
  color_hex char(7) not null,
  alarm text,
  mandatory_actions jsonb not null default '[]'::jsonb,
  sort_order integer not null,
  source_page integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, code)
);

create table if not exists public.historical_flood_events (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  event_date date not null,
  label text not null,
  peak_level_m numeric(8, 2) not null,
  level_reference text not null,
  deaths integer,
  missing_people integer,
  source_page integer not null,
  notes text,
  created_at timestamptz not null default now(),
  unique (municipality_id, event_date, label)
);

create table if not exists public.contingency_risk_areas (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.contingency_plans(id) on delete cascade,
  name text not null,
  people_exposed integer,
  buildings_exposed integer,
  risk_description text not null,
  source_page integer not null,
  validation_status text not null default 'documented' check (validation_status in ('documented', 'pending_review', 'validated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, name)
);

create table if not exists public.meeting_points (
  id uuid primary key default gen_random_uuid(),
  municipality_id uuid not null references public.municipalities(id) on delete cascade,
  name text not null,
  address text,
  capacity integer,
  latitude numeric(10, 7),
  longitude numeric(10, 7),
  accessibility_notes text,
  is_active boolean not null default true,
  source_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (municipality_id, name)
);

alter table public.shelters
  add column if not exists families_capacity integer,
  add column if not exists activation_stage text,
  add column if not exists source_reference text;

alter table public.escape_routes
  add column if not exists access_type text,
  add column if not exists estimated_minutes integer,
  add column if not exists source_reference text;

alter table public.contingency_plans enable row level security;
alter table public.contingency_operational_stages enable row level security;
alter table public.historical_flood_events enable row level security;
alter table public.contingency_risk_areas enable row level security;
alter table public.meeting_points enable row level security;

drop policy if exists "public read contingency plans" on public.contingency_plans;
create policy "public read contingency plans" on public.contingency_plans for select using (status = 'active');
drop policy if exists "public read contingency stages" on public.contingency_operational_stages;
create policy "public read contingency stages" on public.contingency_operational_stages for select using (true);
drop policy if exists "public read flood history" on public.historical_flood_events;
create policy "public read flood history" on public.historical_flood_events for select using (true);
drop policy if exists "public read contingency risk areas" on public.contingency_risk_areas;
create policy "public read contingency risk areas" on public.contingency_risk_areas for select using (true);
drop policy if exists "public read meeting points" on public.meeting_points;
create policy "public read meeting points" on public.meeting_points for select using (is_active = true);

drop policy if exists "operator manage contingency plans" on public.contingency_plans;
create policy "operator manage contingency plans" on public.contingency_plans for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text in ('admin', 'operator')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text in ('admin', 'operator')));
drop policy if exists "operator manage contingency stages" on public.contingency_operational_stages;
create policy "operator manage contingency stages" on public.contingency_operational_stages for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text in ('admin', 'operator')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text in ('admin', 'operator')));
drop policy if exists "operator manage flood history" on public.historical_flood_events;
create policy "operator manage flood history" on public.historical_flood_events for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text in ('admin', 'operator')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text in ('admin', 'operator')));
drop policy if exists "operator manage contingency risk areas" on public.contingency_risk_areas;
create policy "operator manage contingency risk areas" on public.contingency_risk_areas for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text in ('admin', 'operator')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text in ('admin', 'operator')));
drop policy if exists "operator manage meeting points" on public.meeting_points;
create policy "operator manage meeting points" on public.meeting_points for all
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text in ('admin', 'operator')))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role::text in ('admin', 'operator')));

update public.municipalities
set ibge_code = '4312609', updated_at = now()
where name = 'Mucum' and state_code = 'RS';

with mucum as (
  select id from public.municipalities where name = 'Mucum' and state_code = 'RS' limit 1
)
insert into public.contingency_plans (municipality_id, title, version, source_file, status, reviewed_at, notes)
select id, 'Plano de Contingencia do Municipio de Mucum', '2026', 'PLANO DE CONTIGENCIA 3.pdf', 'active', '2026-07-17',
  'Dados estruturados sem contatos pessoais. Validar revisoes futuras com a Defesa Civil.'
from mucum
on conflict (municipality_id, version) do update set
  title = excluded.title,
  source_file = excluded.source_file,
  status = excluded.status,
  reviewed_at = excluded.reviewed_at,
  notes = excluded.notes,
  updated_at = now();

with plan as (
  select cp.id from public.contingency_plans cp
  join public.municipalities m on m.id = cp.municipality_id
  where m.name = 'Mucum' and m.state_code = 'RS' and cp.version = '2026'
)
insert into public.contingency_operational_stages
  (plan_id, code, name, river_level_m, color_hex, alarm, mandatory_actions, sort_order, source_page)
select id, 'normal', 'Normal', 5, '#2E7D32', null,
  '["Monitoramento de rotina","Atualizar contatos e recursos"]'::jsonb, 0, 21 from plan
union all select id, 'moderate', 'Alerta Moderado', 7, '#0277BD', null,
  '["Intensificar monitoramento","Informar secretarias e instituicoes parceiras","Divulgar comunicados preventivos"]'::jsonb, 1, 21 from plan
union all select id, 'high', 'Alerta Alto', 9, '#ED8B00', 'Preparacao para evacuacao',
  '["Ativar Comite de Crise","Monitoramento horario","Preparar logistica para possivel evacuacao"]'::jsonb, 2, 21 from plan
union all select id, 'very-high', 'Alerta Muito Alto', 15, '#ED8B00', 'Evacuacao preventiva',
  '["Ativar SCI e Posto de Comando","Preparar alojamentos e transporte","Retirar preventivamente pessoas vulneraveis"]'::jsonb, 3, 21 from plan
union all select id, 'maximum', 'Alerta Maximo', 18, '#C62828', 'Evacuacao obrigatoria',
  '["Evacuar areas mapeadas","Abrir alojamentos e acionar socorro","Suspender circulacao em areas inundaveis"]'::jsonb, 4, 21 from plan
on conflict (plan_id, code) do update set
  name = excluded.name,
  river_level_m = excluded.river_level_m,
  color_hex = excluded.color_hex,
  alarm = excluded.alarm,
  mandatory_actions = excluded.mandatory_actions,
  sort_order = excluded.sort_order,
  source_page = excluded.source_page,
  updated_at = now();

with mucum as (
  select id from public.municipalities where name = 'Mucum' and state_code = 'RS' limit 1
)
insert into public.historical_flood_events
  (municipality_id, event_date, label, peak_level_m, level_reference, deaths, missing_people, source_page, notes)
select id, '1912-01-01', 'Cheia de 1912', 20.50, 'Cota historica municipal', null, null, 57, 'Documento informa apenas o ano.' from mucum
union all select id, '1941-05-05', 'Cheia de 1941', 19.06, 'Cota historica municipal', null, null, 57, null from mucum
union all select id, '2023-09-06', 'Cheia de setembro de 2023', 26.11, 'Cota historica citada no plano', 18, 2, 57, 'Obitos e desaparecidos associados ao evento de 04/09/2023.' from mucum
union all select id, '2023-11-08', 'Cheia de novembro de 2023', 23.20, 'Cota historica citada no plano', null, null, 57, null from mucum
union all select id, '2024-05-01', 'Cheia de maio de 2024', 26.10, 'Cota historica citada no plano', null, null, 57, null from mucum
union all select id, '2024-05-12', 'Repiquete de maio de 2024', 20.80, 'Cota historica citada no plano', null, null, 57, null from mucum
on conflict (municipality_id, event_date, label) do update set
  peak_level_m = excluded.peak_level_m,
  level_reference = excluded.level_reference,
  deaths = excluded.deaths,
  missing_people = excluded.missing_people,
  source_page = excluded.source_page,
  notes = excluded.notes;

with plan as (
  select cp.id from public.contingency_plans cp
  join public.municipalities m on m.id = cp.municipality_id
  where m.name = 'Mucum' and m.state_code = 'RS' and cp.version = '2026'
)
insert into public.contingency_risk_areas
  (plan_id, name, people_exposed, buildings_exposed, risk_description, source_page, validation_status)
select id, 'Bairro Sao Jose', 552, 138, 'Planicie de inundacao dos rios Taquari e Guapore, com efeito de represamento do Guapore.', 57, 'documented' from plan
union all select id, 'Centro - Rua Luis Signori', 80, 20, 'Ocupacao urbana ribeirinha sujeita a inundacao sazonal.', 58, 'documented' from plan
union all select id, 'Bairro Centro', 100, 25, 'Inundacao sazonal, erosao e instabilidade das margens.', 59, 'documented' from plan
union all select id, 'Bairro Fatima', 100, 25, 'Arroio da Braba, ponte da Avenida Sao Cristovao e influencia do Rio Taquari.', 60, 'pending_review' from plan
on conflict (plan_id, name) do update set
  people_exposed = excluded.people_exposed,
  buildings_exposed = excluded.buildings_exposed,
  risk_description = excluded.risk_description,
  source_page = excluded.source_page,
  validation_status = excluded.validation_status,
  updated_at = now();

with mucum as (
  select id from public.municipalities where name = 'Mucum' and state_code = 'RS' limit 1
), shelters_seed(name, address, capacity, families_capacity, latitude, longitude) as (
  values
    ('Igreja Matriz de Nossa Senhora da Purificacao', 'Rua Barao do Rio Branco, 430 - Centro', 30, 10, -29.1649261, -51.8678250),
    ('EMEF Jardim Cidade Alta', 'Rua Nulvio Moriggi, 10 - Jardim Cidade Alta', 60, 15, -29.1549488, -51.8624482),
    ('CTG Sentinela da Tradicao', 'Rua Presidente Costa e Silva, 197 - Centro', 80, 20, -29.1650343, -51.8746521),
    ('Centro Pastoral', 'Rua Jose Bonifacio, 241 - Centro', 32, 8, -29.1649597, -51.8687201),
    ('Salao Comunitario Cidade Alta', 'Rua Nulvio Moriggi, 21 - Jardim Cidade Alta', 140, 35, -29.1545968, -51.8626037),
    ('EMEI Pingo de Gente', 'Rua Presidente Costa e Silva, 400 - Centro', 40, 10, -29.1653025, -51.8756336),
    ('Salao Comunitario Jose Marcolin', 'Rua Clovis Nelson Predebom, 26 - Bairro Guapore', 36, 9, -29.1616734, -51.8793304),
    ('Estacao Ferroviaria de Mucum', 'Avenida Santa Lucia - Bairro Guapore', 28, 6, -29.1559909, -51.8844970)
)
insert into public.shelters
  (municipality_id, name, address, capacity, families_capacity, latitude, longitude, activation_stage, source_reference, notes)
select m.id, s.name, s.address, s.capacity, s.families_capacity, s.latitude, s.longitude,
  'Conforme estrategia municipal; abrigo como ultimo recurso', 'Plano de Contingencia 2026, paginas 43-45',
  'Contato operacional deve permanecer em area autenticada.'
from mucum m cross join shelters_seed s
where not exists (
  select 1 from public.shelters existing where existing.municipality_id = m.id and existing.name = s.name
);

with mucum as (
  select id from public.municipalities where name = 'Mucum' and state_code = 'RS' limit 1
), points(name, address, capacity, latitude, longitude, accessibility_notes) as (
  values
    ('Hospital Beneficente Nossa Senhora Aparecida', 'Rua Joao Dalazen, 94 - Centro', 100, -29.1652832, -51.8718423, 'Acessivel; area aberta com cobertura frontal.'),
    ('Igreja Matriz de Nossa Senhora da Purificacao', 'Rua General Osorio - Centro', 50, -29.1651263, -51.8682370, 'Acessivel e coberto.'),
    ('Salao Comunitario Jardim Cidade Alta', 'Rua Nulvio Moriggi, 186 - Jardim Cidade Alta', 100, -29.1554409, -51.8621909, 'Acessivel, coberto e apto a receber abrigados.'),
    ('Salao Comunitario Jose Marcolin', 'Rua Clovis Predebon, 26 - Bairro Guapore', 30, -29.1618436, -51.8796637, 'Acessivel e coberto.'),
    ('Posto Sander', 'RS-129, km 85 - Fatima', 100, -29.1579388, -51.8622800, 'Acessivel e coberto.'),
    ('CTG Sentinela da Tradicao', 'Rua Presidente Costa e Silva, 255 - Centro', 100, -29.1650365, -51.8747444, 'Acessivel e apto a servir de abrigo.')
)
insert into public.meeting_points
  (municipality_id, name, address, capacity, latitude, longitude, accessibility_notes, source_reference)
select m.id, p.name, p.address, p.capacity, p.latitude, p.longitude, p.accessibility_notes,
  'Plano de Contingencia 2026, paginas 45-46'
from mucum m cross join points p
on conflict (municipality_id, name) do update set
  address = excluded.address,
  capacity = excluded.capacity,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  accessibility_notes = excluded.accessibility_notes,
  source_reference = excluded.source_reference,
  updated_at = now();

with mucum as (
  select id from public.municipalities where name = 'Mucum' and state_code = 'RS' limit 1
), routes(name, access_type, origin_description, destination_description, distance_m, estimated_minutes, closes_at_river_level_m) as (
  values
    ('Av. Santa Lucia', 'Misto', 'Trevo', 'Estacao Ferroviaria', 1000, 15, 22.00),
    ('Fundos do Loteamento Jose Marcolin', 'Pedestres', 'Decibal Moveis', 'Carrocerias Mucum', 500, 15, 24.00),
    ('Rua Fernando de Marchi e Rua Presidente Kennedy', 'Misto', 'Hospital Beneficente Nossa Senhora Aparecida', 'RS-129', 860, 15, 25.00),
    ('Curtume CBR', 'Pedestres', 'Rua Julio Zarpelon', 'Rua Fernando de Marchi', 1000, 20, 20.00),
    ('Igreja Matriz ate o Hospital', 'Misto', 'Igreja Matriz', 'Hospital pela Rua Jose Bonifacio', 400, 5, 22.00),
    ('Loteamento em Fatima ate General Osorio', 'Pedestres', 'Loteamento em Fatima', 'Rua General Osorio', 250, 15, 28.00),
    ('Saida de Fatima', 'Pedestres', 'Av. Sao Cristovao com Av. Nossa Senhora de Fatima', 'RS-129', 370, 10, 18.00)
)
insert into public.escape_routes
  (municipality_id, name, access_type, origin_description, destination_description, distance_m, estimated_minutes, closes_at_river_level_m, source_reference, notes)
select m.id, r.name, r.access_type, r.origin_description, r.destination_description, r.distance_m, r.estimated_minutes,
  r.closes_at_river_level_m, 'Plano de Contingencia 2026, paginas 47-49',
  'A disponibilidade deve ser confirmada em campo antes da orientacao publica.'
from mucum m cross join routes r
where not exists (
  select 1 from public.escape_routes existing where existing.municipality_id = m.id and existing.name = r.name
);

with mucum as (
  select id from public.municipalities where name = 'Mucum' and state_code = 'RS' limit 1
)
update public.alert_levels
set is_active = false, updated_at = now()
where municipality_id = (select id from mucum)
  and name in ('Atencao 16m', 'Alerta 17m', 'Alerta 18m', 'Evacuacao');

with mucum as (
  select id from public.municipalities where name = 'Mucum' and state_code = 'RS' limit 1
)
insert into public.alert_levels
  (municipality_id, name, severity, color_hex, min_river_level_m, max_river_level_m, public_message, operator_message, sort_order, is_active)
select id, 'Normal', 0, '#2E7D32', null, 6.99, 'Situacao normal. Acompanhe os canais oficiais.', 'Monitoramento de rotina; referencia operacional de 5 m.', 0, true from mucum
union all select id, 'Alerta Moderado', 3, '#0277BD', 7.00, 8.99, 'Condicao de atencao. Acompanhe os comunicados oficiais.', 'Intensificar monitoramento e informar parceiros.', 1, true from mucum
union all select id, 'Alerta Alto', 5, '#ED8B00', 9.00, 14.99, 'Risco provavel. Prepare-se para possivel mobilizacao.', 'Ativar Comite de Crise e monitoramento horario.', 2, true from mucum
union all select id, 'Alerta Muito Alto', 7, '#ED8B00', 15.00, 17.99, 'Risco iminente. Siga as orientacoes da Defesa Civil.', 'Ativar SCI, Posto de Comando e retirada preventiva de vulneraveis.', 3, true from mucum
union all select id, 'Alerta Maximo', 10, '#C62828', 18.00, null, 'Evacuacao das areas mapeadas conforme ordem oficial.', 'Executar evacuacao, abrir alojamentos e restringir areas inundaveis.', 4, true from mucum
on conflict (municipality_id, name) do update set
  severity = excluded.severity,
  color_hex = excluded.color_hex,
  min_river_level_m = excluded.min_river_level_m,
  max_river_level_m = excluded.max_river_level_m,
  public_message = excluded.public_message,
  operator_message = excluded.operator_message,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

create index if not exists idx_contingency_stages_plan_order
on public.contingency_operational_stages(plan_id, sort_order);
create index if not exists idx_historical_flood_events_municipality_date
on public.historical_flood_events(municipality_id, event_date desc);
create index if not exists idx_contingency_risk_areas_plan
on public.contingency_risk_areas(plan_id);
create index if not exists idx_meeting_points_municipality_active
on public.meeting_points(municipality_id, is_active);
