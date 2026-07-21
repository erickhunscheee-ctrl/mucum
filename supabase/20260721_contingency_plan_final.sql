-- Atualiza a base operacional para o plano final de 17/07/2026 (95 paginas).
-- Contatos pessoais permanecem fora das tabelas publicas.

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
