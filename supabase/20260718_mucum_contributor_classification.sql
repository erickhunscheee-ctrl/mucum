-- Classifica estacoes pela relacao hidrologica com Mucum.
-- Guapore e relevante como influencia local, mas nao como montante puro.

alter table public.monitoring_stations
  add column if not exists contributor_key text,
  add column if not exists contribution_role text,
  add column if not exists influence_priority integer not null default 0;

update public.monitoring_stations
set upstream_of_mucum = false,
    contributor_key = null,
    contribution_role = 'unknown',
    influence_priority = 0,
    updated_at = now();

update public.monitoring_stations
set upstream_of_mucum = true,
    updated_at = now()
where
  translate(upper(coalesce(city_name, '')), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC') !~
    'ENCANTADO|ROCA SALES|COLINAS|ARROIO DO MEIO|LAJEADO|ESTRELA|BOM RETIRO|TAQUARI'
  and translate(upper(coalesce(river_name, '')), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC') !~
    'FORQUETA|JACARE|TAQUARI-MIRIM|RIO GUAPORE'
  and (
    translate(upper(coalesce(city_name, '')), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC') ~
      'MUCUM|SAO JOSE DOS AUSENTES|CAMBARA DO SUL|BOM JESUS|JAQUIRANA|VACARIA|SAO FRANCISCO DE PAULA|MONTE ALEGRE DOS CAMPOS|MUITOS CAPOES|ESMERALDA|PINHAL DA SERRA|LAGOA VERMELHA|CASEIROS|IBIRAIARAS|DAVID CANABARRO|CIRIACO|MULITERNO|VANINI|SERAFINA CORREA|CASCA|SAO DOMINGOS DO SUL|GUAPORE|DOIS LAJEADOS|ANTA GORDA|NOVA BASSANO|NOVA PRATA|VILA FLORES|VERANOPOLIS|COTIPORA|FAGUNDES VARELA|BENTO GONCALVES|MONTE BELO DO SUL|SANTA TEREZA|NOVA ROMA DO SUL|ANTONIO PRADO|IPE|SAO MARCOS|FLORES DA CUNHA|CARLOS BARBOSA|GARIBALDI'
    or translate(upper(coalesce(river_name, '')), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC') ~
      'RIO DAS ANTAS|TAINHAS|CAMISAS|LAJEADO GRANDE|SAO MARCOS|QUEBRA-DENTES|QUEBRA DENTES|RIO DA PRATA|RIO TURVO|RIO CARREIRO'
  );

update public.monitoring_stations
set contributor_key = case
      when translate(upper(coalesce(river_name, '')), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC') ~ 'RIO CARREIRO' then 'carreiro'
      when translate(upper(coalesce(river_name, '')), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC') ~ 'RIO TAINHAS' then 'tainhas'
      when translate(upper(coalesce(river_name, '')), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC') ~ 'RIO CAMISAS' then 'camisas'
      when translate(upper(coalesce(river_name, '')), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC') ~ 'LAJEADO GRANDE' then 'lajeado_grande'
      when translate(upper(coalesce(river_name, '')), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC') ~ 'RIO SAO MARCOS' then 'sao_marcos'
      when translate(upper(coalesce(river_name, '')), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC') ~ 'QUEBRA-DENTES|QUEBRA DENTES' then 'quebra_dentes'
      when translate(upper(coalesce(river_name, '')), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC') ~ 'RIO DA PRATA|RIO PRATA' then 'prata'
      when translate(upper(coalesce(river_name, '')), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC') ~ 'RIO TURVO' then 'turvo'
      when translate(upper(coalesce(river_name, '')), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC') ~ 'RIO DAS ANTAS' then 'antas'
      else contributor_key
    end,
    contribution_role = case
      when translate(upper(coalesce(river_name, '')), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC') ~ 'RIO CARREIRO|RIO DAS ANTAS' then 'main_upstream'
      else 'tributary_upstream'
    end,
    influence_priority = case
      when translate(upper(coalesce(river_name, '')), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC') ~ 'RIO CARREIRO|RIO DAS ANTAS' then 100
      else 80
    end,
    updated_at = now()
where upstream_of_mucum = true;

update public.monitoring_stations
set upstream_of_mucum = false,
    contributor_key = 'guapore',
    contribution_role = 'local_critical',
    influence_priority = 98,
    updated_at = now()
where translate(upper(coalesce(river_name, '')), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC') ~ 'RIO GUAPORE';

update public.monitoring_stations
set upstream_of_mucum = false,
    contributor_key = case
      when translate(upper(coalesce(river_name, '')), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC') ~ 'FORQUETA' then 'forqueta'
      when translate(upper(coalesce(river_name, '')), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC') ~ 'JACARE' then 'jacare'
      else 'taquari_mirim'
    end,
    contribution_role = 'downstream_context',
    influence_priority = 0,
    updated_at = now()
where translate(upper(coalesce(river_name, '')), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC') ~ 'FORQUETA|JACARE|TAQUARI-MIRIM';

-- A estacao de saida de Mucum fica no escopo e funciona como ponto de referencia.
update public.monitoring_stations
set upstream_of_mucum = true,
    contributor_key = 'taquari_mucum',
    contribution_role = 'outlet',
    influence_priority = 100,
    updated_at = now()
where ana_code = '86510000';

create index if not exists idx_monitoring_stations_contributor
on public.monitoring_stations(contributor_key, contribution_role, influence_priority desc);
