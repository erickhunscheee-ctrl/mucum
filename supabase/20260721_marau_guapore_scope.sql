-- Inclui Marau e o sistema Capingui no contribuinte local critico do Guapore.

update public.monitoring_stations
set upstream_of_mucum = false,
    contributor_key = 'guapore',
    contribution_role = 'local_critical',
    influence_priority = 98,
    updated_at = now()
where
  translate(upper(coalesce(city_name, '')), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC') = 'MARAU'
  or translate(upper(coalesce(river_name, '')), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC') ~
    'RIO GUAPORE|RIO CAPIGUI|ARROIO MARAU|RIO MARAU|ARROIO CAMARGO';
