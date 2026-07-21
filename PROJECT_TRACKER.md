# Hydro ANA / Mucum - Acompanhamento

Este arquivo acompanha decisoes, entregas e proximas tarefas do projeto. Atualize sempre que uma feature importante entrar.

## Objetivo

Construir uma solucao para Mucum com:

- App mobile para moradores acompanharem alerta, rio, chuva, abrigos e rotas.
- Painel web admin para Defesa Civil/operacao gerenciar cadastros, estacoes, alertas e dados da ANA.
- Backend/proxy para autenticar na ANA, salvar retornos brutos e alimentar o Supabase.

## Decisoes tecnicas

- Base unica Expo/React Native para web, Android e iOS.
- Supabase como banco, auth e camada REST.
- Proxy local Node para evitar CORS da ANA e proteger chaves/credenciais.
- Retornos brutos da ANA salvos em `ana_api_responses`.
- Cotas oficiais atuais de Mucum: atencao 5m, alerta 9m e inundacao 18m, com referencia local da estacao.
- Projecao hibrida: modelo de propagacao SGB no curto prazo e cenarios experimentais chuva-vazao ate 72h.

## Entregas feitas

- [x] Base Expo web/mobile criada.
- [x] Proxy ANA com token correto `tokenautenticacao`.
- [x] Integracao Supabase validada com `anon` e `service_role`.
- [x] Schema Supabase inicial criado.
- [x] Historico bruto de chamadas ANA em `ana_api_responses`.
- [x] Aba Admin inicial com catalogos ANA.
- [x] CRUD admin inicial para bairros, abrigos, rotas de fuga e pontos criticos.
- [x] Rota `/api/mucum/context` para carregar contexto ANA de Mucum automaticamente.
- [x] Sidebar e tela de visao geral/monitoramento no painel.
- [x] Rota `/api/health` e tratamento de erro robusto no proxy.
- [x] Rota `/api/mucum/current` com chuva atual, nivel, vazao e barragens.
- [x] Agregacao de chuva regional da bacia Taquari-Antas/sub-bacia 86.
- [x] Seletor de chuva acumulada por dia, semana ou mes no dashboard.
- [x] Rota `/api/mucum/forecast` e painel de chuva prevista.
- [x] Sincronizacao automatica de leituras de UHEs/barragens via estacoes telemetricas ANA.
- [x] Cache historico de telemetria em `monitoring_stations`, `station_readings` e `rainfall_aggregates`.
- [x] Grafico Chart.js comparando chuva e nivel do rio no painel de Mucum.
- [x] Remocao do acesso manual/token da tela web; consultas usam o proxy.
- [x] Refatoracao inicial do dashboard em `src/features/mucum` com chart web/native.
- [x] Remocao do bloco legado do dashboard que havia ficado no `App.tsx`.
- [x] Dashboard segmentado em abas de visao geral, monitoramento, chuvas, rios, barragens e estacoes.
- [x] Graficos Chart.js dedicados para chuva regional, previsao horaria, evolucao do rio e vazao das barragens.
- [x] Cache persistente local com carregamento imediato e atualizacao em segundo plano.
- [x] Snapshots compartilhados do dashboard por periodo de chuva no Supabase.
- [x] Indicador de ultima atualizacao e origem dos dados no painel.
- [x] Filtro global de periodo observado aplicado aos acumulados e graficos historicos.
- [x] Graficos compactos com altura limitada pela viewport.
- [x] Nova identidade visual de Mucum aplicada ao painel, graficos e estados semanticos.
- [x] Tipografia Source Sans 3 aplicada globalmente nos pesos 400, 500, 600 e 700.
- [x] Chuva regional por cidade com acumulados de 24h, 7d e 30d, picos diarios e comparacao com previsao.
- [x] Escopo hidrologico de Mucum separado entre montante e contexto geral da bacia.
- [x] Grafico geral de nivel por rio com uma cor e legenda para cada serie disponivel.
- [x] Motor de projecao hidrologica para Mucum com cenarios minimo, provavel e maximo.
- [x] Equacoes SGB de 4h/6h, curva-chave de Mucum, ensemble GFS e sinal GloFAS integrados.
- [x] Aba de projecao com picos, cotas cruzadas, confianca por horizonte e fatores da rodada.
- [x] Historico auditavel de rodadas em `hydrological_projection_runs`.
- [x] Plano de Contingencia de Mucum 2026 analisado e convertido em referencia operacional estruturada.
- [x] Tela de contingencia com estagio atual/projetado, acoes, cheias historicas, rotas e capacidades.
- [x] Migration de contingencia com estagios oficiais, areas de risco, pontos de encontro, alojamentos e rotas.
- [x] Catalogo unico de contribuintes hidrologicos compartilhado entre proxy e painel.
- [x] Destaque de Antas, Carreiro e Guapore com cidades, chuva observada e previsao de 72h.
- [x] Consulta completa dos tributarios e separacao visual dos rios a jusante.
- [x] Selecao multipla de cidades para comparar chuva observada no periodo e previsao de 72h.
- [x] Quadro explicito de chuva observada nas cabeceiras por cidade, sistema formador, pico diario e estacao utilizada.
- [x] Redundancia pluviometrica por cidade, consultando ate cinco estacoes ANA e incluindo fonte convencional quando disponivel.
- [x] Ampliacao da previsao meteorologica para 27 pontos, incluindo as cidades prioritarias do Antas, Carreiro e Tainhas.
- [x] Container unico de producao servindo Expo Web e proxy `/api` na porta 3000.
- [x] Guia de deploy para Docker, VPS e Easypanel sem credenciais privadas no bundle.
- [x] Migration de barragens em `supabase/20260716_dams.sql`.
- [x] Seed inicial de UHEs a montante em `supabase/20260716_seed_dams_taquari_antas.sql`.

## Em andamento

- [ ] Login Supabase no painel.
- [x] Monitoramento com ultimas leituras e chuva a montante.
- [ ] Publicacao manual de alertas.
- [ ] Validar manualmente as estacoes priorizadas com Defesa Civil/operador local.
- [ ] Rodar migration `supabase/20260716_dams.sql` no Supabase e cadastrar barragens.
- [ ] Rodar seed `supabase/20260716_seed_dams_taquari_antas.sql` e validar UHEs/operador/fonte de vazao.
- [x] Alimentar leituras de barragens com telemetria ANA associada as UHEs.
- [ ] Validar com operador local se os codigos ANA mapeados representam entrada/saida operacional desejada.
- [ ] Rodar migration `supabase/20260717_dashboard_snapshots.sql` no Supabase.
- [ ] Rodar migration `supabase/20260717_mucum_upstream_scope.sql` para corrigir o historico de estacoes.
- [ ] Rodar migration `supabase/20260718_mucum_contributor_classification.sql` para classificar todos os contribuintes e separar o contexto a jusante.
- [ ] Rodar migration `supabase/20260718_hydrological_projections.sql` para habilitar snapshots e historico da projecao.
- [ ] Rodar migration `supabase/20260718_contingency_plan.sql` e validar os registros com a Defesa Civil.
- [ ] Calibrar e verificar o horizonte de 6 a 72h com eventos historicos e operacao da Defesa Civil/SGB.
- [ ] Confirmar datum/regua das cotas historicas antes de usa-las na calibracao do modelo.
- [ ] Validar a lacuna de 150 a 250 mm/24h e o COBRADE divergente encontrados no plano.

## Proximas tarefas

1. Criar cadastros locais no painel admin.
2. Criar login e controle de acesso por perfil.
3. Criar tela de monitoramento operacional.
4. Validar estacoes ANA a montante de Mucum com equipe local.
5. Criar tela mobile do morador.
6. Implementar notificacoes push.

## Contexto ANA identificado

- Municipio ANA: `24125000`
- Municipio IBGE: `4312609`
- Nome ANA: `MUÇUM`
- Bacia: `8`
- Sub-bacia: `86 - RIO TAQUARI`
- Rios priorizados:
  - `86001000 - RIO TAQUARI`
  - `86100000 - RIO DAS ANTAS`
  - `86131000 - RIO CARREIRO`
  - `86210000 - RIO GUAPORÉ`
  - `86230000 - RIO FORQUETA`

## Historico de alteracoes

- 2026-07-16: Criado schema Supabase e bootstrap admin.
- 2026-07-16: Integrado Supabase no projeto e validado insert em `ana_api_responses`.
- 2026-07-16: Criado este tracker para acompanhar evolucao do projeto.
- 2026-07-16: Adicionado service e UI inicial para cadastros locais no painel Admin.
- 2026-07-16: Adicionada rota de contexto de Mucum, sidebar e carregamento automatico Supabase/ANA.
- 2026-07-16: Adicionado health check do proxy e mensagens melhores para falha de conexao local.
- 2026-07-16: Adicionada area operacional de chuva atual, nivel/vazao e barragens.
- 2026-07-16: Adicionada agregacao de chuva regional Taquari-Antas e seed inicial de UHEs a montante.
- 2026-07-16: Adicionada sincronizacao de barragens pela ANA com estacoes de UHE/barramento.
- 2026-07-16: Adicionado seletor de acumulado de chuva 24h/7d/30d.
- 2026-07-16: Integrada previsao de chuva por coordenadas com Open-Meteo.
- 2026-07-16: Adicionado cache historico Supabase para leituras ANA e agregados de chuva.
- 2026-07-16: Adicionado Chart.js para comparacao chuva x nivel e sidebar mais lateralizada no painel.
- 2026-07-17: Extraido dashboard de Mucum para feature reutilizavel, hook de carregamento e componente de chart por plataforma.
- 2026-07-17: Removido bloco legado do dashboard do `App.tsx` apos extracao para `src/features/mucum`.
- 2026-07-17: Reorganizado painel em telas tematicas e adicionados graficos operacionais para reduzir a densidade da visao geral.
- 2026-07-17: Adicionados snapshots Supabase, cache local multiplataforma e atualizacao silenciosa do dashboard.
- 2026-07-17: Periodo observado unificado em 24h/7d/30d, chuva regional acumulada pela janela e graficos responsivos mais baixos.
- 2026-07-17: Aplicada identidade visual de Mucum com tema centralizado, paleta institucional e cores semanticas de monitoramento.
- 2026-07-17: Padronizada tipografia Source Sans 3 com fallback web, fontes embarcadas e tamanho minimo de 14px.
- 2026-07-17: Ampliada chuva regional para todas as cidades com melhor estacao ativa, series diarias, picos e cidade em destaque com observado x previsto.
- 2026-07-17: Refinado escopo a montante de Mucum, removidos pontos a jusante do risco de chuva e criado comparativo de nivel por rio com legenda de cores.
- 2026-07-17: Criada projecao hibrida de 72h com equacoes SGB, curva-chave, chuva ensemble, GloFAS, cenarios e indice de confianca.
- 2026-07-17: Estruturado o Plano de Contingencia 2026 em uma tela operacional e migration Supabase, sem expor contatos pessoais.
- 2026-07-17: Classificados todos os contribuintes de Mucum, com Guapore como critico local e Forqueta/Jacare/Taquari-Mirim apenas como contexto a jusante.
- 2026-07-17: Adicionado comparativo multisselecao de chuva observada e prevista por cidade, com Nova Bassano corrigida para o sistema Carreiro.
- 2026-07-17: Preparado deploy em container unico para VPS/Easypanel e removida a rota que devolvia o token ANA ao navegador.
