-- Seed inicial de barragens/UHEs a montante de Mucum na bacia Taquari-Antas.
-- Rode depois de `supabase/20260716_dams.sql`.
-- Valide operador, coordenadas e fonte operacional antes de usar em alerta oficial.

insert into public.dams (
  municipality_id,
  name,
  river_name,
  operator_name,
  upstream_of_mucum,
  is_active,
  notes
)
select
  m.id,
  seed.name,
  seed.river_name,
  seed.operator_name,
  true,
  true,
  seed.notes
from public.municipalities m
cross join (
  values
    (
      'UHE Castro Alves',
      'Rio das Antas',
      'CERAN / consorcio a validar',
      'Seed inicial para monitoramento a montante de Mucum; validar dados operacionais de vazao.'
    ),
    (
      'UHE Monte Claro',
      'Rio das Antas',
      'CERAN / consorcio a validar',
      'Seed inicial para monitoramento a montante de Mucum; validar dados operacionais de vazao.'
    ),
    (
      'UHE 14 de Julho',
      'Rio das Antas',
      'CERAN / consorcio a validar',
      'Seed inicial para monitoramento a montante de Mucum; validar status operacional, historico de colapso parcial em 2024 e dados de vazao.'
    )
) as seed(name, river_name, operator_name, notes)
where (
  m.ibge_code = '4312609'
  or (lower(m.name) in ('mucum', 'muçum') and m.state_code = 'RS')
)
and not exists (
  select 1
  from public.dams d
  where d.municipality_id = m.id
    and d.name = seed.name
);
