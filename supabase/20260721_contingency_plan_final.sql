-- Atualiza a base operacional para o plano final de 17/07/2026 (95 paginas).
-- Contatos pessoais permanecem fora das tabelas publicas.
-- Este arquivo e autocontido para projetos onde a migration de 18/07 ainda nao foi aplicada.

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
alter table public.meeting_points enable row level security;

drop policy if exists "public read contingency plans" on public.contingency_plans;
create policy "public read contingency plans" on public.contingency_plans
for select using (status = 'active');

drop policy if exists "public read contingency stages" on public.contingency_operational_stages;
create policy "public read contingency stages" on public.contingency_operational_stages
for select using (true);

drop policy if exists "public read meeting points" on public.meeting_points;
create policy "public read meeting points" on public.meeting_points
for select using (is_active = true);

with mucum as (
  select id from public.municipalities where name = 'Mucum' and state_code = 'RS' limit 1
)
insert into public.contingency_plans
  (municipality_id, title, version, source_file, status, reviewed_at, notes)
select id,
  'Plano de Contingencia do Municipio de Mucum',
  '2026',
  'PLANO DE CONTINGENCIA DE MUCUM - DEFESA CIVIL 17.07 - FINAL.pdf',
  'active',
  '2026-07-21',
  'Plano final de 95 paginas. Dados publicos sem contatos pessoais.'
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
  '["Monitoramento de rotina","Atualizar contatos e recursos"]'::jsonb, 0, 33 from plan
union all select id, 'moderate', 'Alerta Moderado', 7, '#0277BD', null,
  '["Intensificar monitoramento","Informar secretarias e parceiros","Divulgar comunicados preventivos"]'::jsonb, 1, 33 from plan
union all select id, 'high', 'Alerta Alto', 9, '#ED8B00', 'Preparacao para evacuacao',
  '["Ativar Comite de Crise","Monitoramento horario","Preparar logistica"]'::jsonb, 2, 33 from plan
union all select id, 'very-high', 'Alerta Muito Alto', 15, '#ED8B00', 'Evacuacao preventiva',
  '["Ativar SCI e Posto de Comando","Preparar alojamentos e transporte","Retirar pessoas vulneraveis"]'::jsonb, 3, 33 from plan
union all select id, 'maximum', 'Alerta Maximo', 18, '#C62828', 'Evacuacao obrigatoria',
  '["Evacuar areas mapeadas","Abrir alojamentos e acionar socorro","Restringir areas inundaveis"]'::jsonb, 4, 33 from plan
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
update public.contingency_plans
set source_file = 'PLANO DE CONTINGENCIA DE MUCUM - DEFESA CIVIL 17.07 - FINAL.pdf',
    reviewed_at = '2026-07-21',
    notes = 'Plano final de 95 paginas. Historico e fichas territoriais do plano complementar permanecem identificados como fonte secundaria. Divergencia documental: resumo indica 8 alojamentos/446 pessoas e tabela detalhada indica 9/506.',
    updated_at = now()
where municipality_id = (select id from mucum) and version = '2026';

with plan as (
  select cp.id from public.contingency_plans cp
  join public.municipalities m on m.id = cp.municipality_id
  where m.name = 'Mucum' and m.state_code = 'RS' and cp.version = '2026'
)
update public.contingency_operational_stages
set source_page = 33, updated_at = now()
where plan_id = (select id from plan);

with mucum as (
  select id from public.municipalities where name = 'Mucum' and state_code = 'RS' limit 1
)
insert into public.shelters
  (municipality_id, name, address, capacity, families_capacity, activation_stage, source_reference, notes)
select id, 'Salao Comunitario Bras Charleo', 'Linha Bras Charleo - Interior', 60, 15,
  'Conforme estrategia municipal; alojamento como ultimo recurso',
  'Plano final de 17/07/2026, paginas 60-63',
  'Sem coordenadas no documento. Confirmar local e disponibilidade em campo.'
from mucum
where not exists (
  select 1 from public.shelters s
  where s.municipality_id = mucum.id and s.name = 'Salao Comunitario Bras Charleo'
);

with mucum as (
  select id from public.municipalities where name = 'Mucum' and state_code = 'RS' limit 1
)
update public.meeting_points
set is_active = false, updated_at = now()
where municipality_id = (select id from mucum);

with mucum as (
  select id from public.municipalities where name = 'Mucum' and state_code = 'RS' limit 1
), points(name, address, capacity, latitude, longitude, accessibility_notes) as (
  values
    ('Hospital Beneficente Nossa Senhora Aparecida', 'Rua Joao Dalazen, 94 - Centro', 100, -29.1652832, -51.8718423, 'Acessivel; area aberta com cobertura frontal.'),
    ('Posto Sander', 'RS-129, km 85 - Fatima', 100, -29.1579388, -51.8622800, 'Acessivel e coberto.')
)
insert into public.meeting_points
  (municipality_id, name, address, capacity, latitude, longitude, accessibility_notes, source_reference, is_active)
select m.id, p.name, p.address, p.capacity, p.latitude, p.longitude, p.accessibility_notes,
  'Plano final de 17/07/2026, paginas 63-64', true
from mucum m cross join points p
on conflict (municipality_id, name) do update set
  address = excluded.address,
  capacity = excluded.capacity,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  accessibility_notes = excluded.accessibility_notes,
  source_reference = excluded.source_reference,
  is_active = true,
  updated_at = now();

with mucum as (
  select id from public.municipalities where name = 'Mucum' and state_code = 'RS' limit 1
)
update public.escape_routes
set is_active = false, updated_at = now()
where municipality_id = (select id from mucum);

with mucum as (
  select id from public.municipalities where name = 'Mucum' and state_code = 'RS' limit 1
), routes(name, access_type, origin_description, destination_description, distance_m, estimated_minutes, closes_at_river_level_m) as (
  values
    ('Rota 01 - Proximidades da Olaria Deconto', 'Pavimentada e pedestres', 'Rua Julio Zarpelon e Curtume CBR', 'Hospital e CTG Sentinela da Tradicao', 1000, 20, 20.00),
    ('Rota 02 - Igreja Matriz, Centro e Fatima', 'Pavimentada e pedestres', 'Igreja Matriz e Rua General Osorio', 'RS-129 e Salao Cidade Alta', 3000, 35, null),
    ('Rota 03 - Saida do Bairro Fatima', 'Pavimentada e pedestres', 'Avenida Sao Cristovao', 'RS-129 e Salao Cidade Alta', 2500, 30, 20.00),
    ('Rota 04 - Avenida Santa Lucia', 'Pavimentada e mista', 'Avenida Santa Lucia e Estacao Ferroviaria', 'Jose Marcolin e RS-129', 8000, 30, 22.00),
    ('Rota 05 - Estacao Ferroviaria pelos trilhos', 'Trilha e pedestres', 'Estacao Ferroviaria', 'Hospital e RS-129', 500, 15, null),
    ('Rota 06 - Saida da cidade', 'Pavimentada e mista', 'Hospital e Rua Presidente Kennedy', 'RS-129', 2000, 20, null)
)
insert into public.escape_routes
  (municipality_id, name, access_type, origin_description, destination_description, distance_m, estimated_minutes, closes_at_river_level_m, source_reference, notes, is_active)
select m.id, r.name, r.access_type, r.origin_description, r.destination_description, r.distance_m,
  r.estimated_minutes, r.closes_at_river_level_m,
  'Plano final de 17/07/2026, paginas 64-68',
  'Disponibilidade depende de verificacao em campo; rota sem cota indicada esta descrita como fora da mancha de inundacao.',
  true
from mucum m cross join routes r
where not exists (
  select 1 from public.escape_routes existing
  where existing.municipality_id = m.id and existing.name = r.name
);

with mucum as (
  select id from public.municipalities where name = 'Mucum' and state_code = 'RS' limit 1
)
update public.escape_routes
set is_active = true, source_reference = 'Plano final de 17/07/2026, paginas 64-68', updated_at = now()
where municipality_id = (select id from mucum)
  and name like 'Rota 0%';
