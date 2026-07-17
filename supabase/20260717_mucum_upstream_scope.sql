-- Corrige o escopo operacional: somente estacoes que drenam para Mucum.

update public.monitoring_stations
set upstream_of_mucum = false,
    updated_at = now();

update public.monitoring_stations
set upstream_of_mucum = true,
    updated_at = now()
where
  translate(upper(coalesce(city_name, '')), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC') !~
    'ENCANTADO|ROCA SALES|COLINAS|ARROIO DO MEIO|LAJEADO|ESTRELA|BOM RETIRO|TAQUARI'
  and translate(upper(coalesce(river_name, '')), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC') !~
    'FORQUETA|TAQUARI-MIRIM'
  and (
    translate(upper(coalesce(city_name, '')), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC') ~
      'MUCUM|SAO JOSE DOS AUSENTES|CAMBARA DO SUL|BOM JESUS|JAQUIRANA|VACARIA|SAO FRANCISCO DE PAULA|MONTE ALEGRE DOS CAMPOS|MUITOS CAPOES|ESMERALDA|PINHAL DA SERRA|LAGOA VERMELHA|CASEIROS|IBIRAIARAS|DAVID CANABARRO|CIRIACO|MULITERNO|VANINI|SERAFINA CORREA|CASCA|SAO DOMINGOS DO SUL|GUAPORE|DOIS LAJEADOS|ANTA GORDA|NOVA BASSANO|NOVA PRATA|VILA FLORES|VERANOPOLIS|COTIPORA|FAGUNDES VARELA|BENTO GONCALVES|MONTE BELO DO SUL|SANTA TEREZA|NOVA ROMA DO SUL|ANTONIO PRADO|IPE|SAO MARCOS|FLORES DA CUNHA|CARLOS BARBOSA|GARIBALDI'
    or translate(upper(coalesce(river_name, '')), 'ÁÀÂÃÉÊÍÓÔÕÚÜÇ', 'AAAAEEIOOOUUC') ~
      'RIO DAS ANTAS|TAINHAS|CAMISAS|LAJEADO GRANDE|SAO MARCOS|QUEBRA-DENTES|QUEBRA DENTES|RIO DA PRATA|RIO CARREIRO|RIO GUAPORE'
  );

-- A estacao de saida de Mucum deve permanecer dentro do escopo.
update public.monitoring_stations
set upstream_of_mucum = true,
    updated_at = now()
where ana_code = '86510000';
