# Hydro ANA

Aplicacao Expo para consultar dados hidrologicos da ANA. A primeira entrega foca na web, mantendo a mesma base para Android e iOS.

## Deploy

O container de producao serve o Expo Web e o proxy ANA/Supabase na mesma porta, sem expor credenciais ao navegador. As instrucoes para Docker, VPS, DNS e Easypanel estao em `docs/DEPLOY_VPS_EASYPANEL.md`.

## Comandos

```bash
npm.cmd run proxy
npm.cmd run web
npm.cmd run typecheck
npm.cmd run build:web
npm.cmd run serve:web
```

No PowerShell desta maquina, use `npm.cmd` porque `npm.ps1` pode ser bloqueado pela politica de execucao.

## Ambiente

Configure `.env` ou `.env.local`:

```bash
ANA_IDENTIFICADOR=seu_usuario_ana
ANA_SENHA=sua_senha_ana
EXPO_PUBLIC_PROXY_URL=http://localhost:3001
EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
```

`EXPO_PUBLIC_*` pode ser usado no app/web. `SUPABASE_SERVICE_ROLE_KEY` fica somente no proxy local/servidor.

Para testar o banco:

```bash
npm.cmd run check:supabase
```

Para testar se o proxy local esta ativo:

```bash
npm.cmd run check:proxy
```

Ou abra no navegador:

```txt
http://localhost:3001/api/health
```

Para testar uma consulta ANA e salvar o retorno bruto no Supabase:

```bash
npm.cmd run check:ana-save
```

Para testar no navegador, deixe dois terminais abertos:

```bash
npm.cmd run proxy
```

```bash
npm.cmd run web
```

Para testar com credenciais locais sem expor usuario/senha no navegador, crie `.env.local`:

```bash
ANA_IDENTIFICADOR=seu_usuario_ana
ANA_SENHA=sua_senha_ana
```

Depois deixe os campos Identificador/Senha vazios na tela e clique em Autenticar. O proxy vai buscar o token usando o `.env.local`.

## API ANA

A integracao usa a documentacao oficial em:

- https://www.ana.gov.br/hidrowebservice/swagger-ui/index.html#/

Endpoints iniciais configurados:

- `HidroInventarioEstacoes/v1`
- `HidroUF/v1`
- `HidroBacia/v1`
- `HidroSubBacia/v1`
- `HidroRio/v1`
- `HidroMunicipio/v1`
- `HidroEntidade/v1`
- `HidroSerieChuva/v1`
- `HidroSerieCotas/v1`
- `HidroSerieVazao/v1`
- `HidroinfoanaSerieTelemetricaAdotada/v2`
- `HidroinfoanaSerieTelemetricaDetalhada/v2`

## Modo admin

A aba `Admin` carrega catalogos da ANA e mostra o retorno bruto completo. Quando a resposta traz parametros reaproveitaveis, como codigo de estacao, codigo de bacia ou UF, a tela exibe botoes em `Parametros encontrados` para aplicar esses valores nos filtros de outras consultas.

A API exige token Bearer. A tela aceita token manual e tambem chama `OAUth/v1` com `Identificador` e `Senha`.
O campo usado para consultar os endpoints protegidos e `items.tokenautenticacao`; o campo `items.token` tambem vem no OAuth, mas nao autentica as consultas de dados.

Para diagnosticar a autenticacao sem imprimir credenciais ou token:

```bash
npm.cmd run check:ana-auth
```

Para descobrir/revalidar o contexto ANA de Mucum:

```bash
npm.cmd run check:mucum-context
```

Para validar chuva atual, nivel/vazao e barragens via proxy:

```bash
npm.cmd run check:mucum-current
```

Essa rota tambem agrega chuva regional da bacia Taquari-Antas/sub-bacia 86, usando estacoes pluviometricas priorizadas a montante de Mucum.

No desenvolvimento web, as chamadas passam pelo proxy `http://localhost:3001/api/ana`, porque a ANA bloqueia requisicoes cross-origin diretas por CORS. No container de producao, painel e `/api` usam o mesmo dominio. Em Android/iOS, o app continua apontando para o backend configurado para o ambiente.

Rotas locais do proxy:

- `GET /api/health`
- `GET /api/ana/*`
- `GET /api/mucum/context`
- `GET /api/mucum/current`
  - aceita `?rainWindowHours=24`, `168` ou `720` para chuva acumulada de dia, semana ou mes.
  - aceita `?refresh=true` para forcar uma nova consulta e atualizar o snapshot.
- `GET /api/mucum/forecast`
  - previsao de chuva por coordenadas da bacia usando Open-Meteo.
- `GET /api/mucum/projection`
  - projecao de nivel e vazao em Mucum para 72 horas, com cenarios minimo, provavel e maximo.
  - aceita `?refresh=true` para gerar uma nova rodada.

Para validar somente o calculo com dados controlados, sem iniciar o proxy:

```bash
npm.cmd run check:mucum-projection-model
```

Com o proxy ativo, valide a rota completa:

```bash
npm.cmd run check:mucum-projection
```

## Projecao hidrologica

O painel `Projecao` usa uma abordagem hibrida:

- 4 horas: equacao de propagacao do SGB com Linha Jose Julio, quando as entradas estao disponiveis.
- 6 horas: equacao de propagacao do SGB com a vazao defluente da UHE 14 de Julho como alternativa.
- 6 a 72 horas: chuva ensemble GFS ponderada na area contribuinte, modelo chuva-vazao conceitual, curva-chave de Mucum e sinal diario GloFAS com peso reduzido.
- Vacaria: cabeceira direta do Antas, incluida na chuva ponderada que alimenta o modelo chuva-vazao.
- Marau: sinal local critico do sistema Marau-Capingui-Guapore, exibido separadamente sem conversao direta em nivel de Mucum ate calibrar o efeito de remanso.
- cenarios: P10/minimo, mediana/provavel e P90/maximo, combinados com diferentes coeficientes de escoamento.
- confianca: atualidade, entradas hidrologicas, ensemble, cobertura da bacia e reducao progressiva pelo horizonte.

As cotas operacionais exibidas para a estacao `86510000` sao 5 m (atencao), 9 m (alerta) e 18 m (inundacao), conforme materiais atuais do SGB. As cotas usam a referencia local da regua da estacao.

Esta projecao e apoio a decisao e nao substitui os boletins oficiais do SGB, ANA, Defesa Civil ou operadores das UHEs. Antes de uso operacional, o modelo de 6 a 72 horas precisa ser calibrado e verificado com rodadas historicas e niveis posteriormente observados.

Para habilitar o snapshot e o historico de cada rodada, rode no Supabase:

```sql
-- conteudo de supabase/20260718_hydrological_projections.sql
```

## Plano de contingencia

A aba `Plano de contingencia` cruza o nivel observado e os cenarios projetados com os estagios municipais de 5, 7, 9, 15 e 18 m. Ela tambem apresenta cheias historicas, capacidade agregada, territorios expostos e disponibilidade das rotas conforme a cota.

Os dados estruturados funcionam offline. Para disponibiliza-los no Supabase e substituir os niveis legados conflitantes, rode:

```sql
-- conteudo de supabase/20260718_contingency_plan.sql
```

A analise, as paginas de origem e as pendencias de validacao estao em `docs/PLANO_CONTINGENCIA_MUCUM.md`. Contatos pessoais presentes no documento nao foram importados para tabelas publicas.

## Cache do dashboard

Antes de usar os snapshots compartilhados, rode no Supabase:

```sql
-- conteudo de supabase/20260717_dashboard_snapshots.sql
```

O painel usa duas camadas de cache:

- `dashboard_snapshots` no Supabase guarda contexto, dados atuais por periodo e previsao.
- `hydrological_projection_runs` preserva cada rodada para auditoria e futura verificacao do erro.
- AsyncStorage guarda o ultimo painel no dispositivo para web, Android e iOS.

Ao abrir, o app mostra imediatamente os dados locais e atualiza ANA, barragens e previsao em segundo plano. O indicador acima do dashboard informa o horario e se a origem e atualizada, snapshot, historico ou cache local.

Sem a migration, o proxy continua funcionando com consulta direta e cache local, mas nao compartilha snapshots entre dispositivos.

Para corrigir a classificacao historica das estacoes que realmente ficam a montante de Mucum, rode tambem:

```sql
-- conteudo de supabase/20260717_mucum_upstream_scope.sql
```

Essa migration remove Encantado, Roca Sales, Forqueta e outros pontos a jusante do indicador `upstream_of_mucum`, mantendo-os apenas como contexto geral da bacia.

Depois, execute `supabase/20260718_mucum_contributor_classification.sql` para adicionar a classificacao por contribuinte, destacar Antas, Carreiro e Guapore e manter os rios a jusante separados do escopo de chuva que afeta Mucum.

Para incluir estacoes existentes de Marau no sistema local critico do Guapore, execute tambem `supabase/20260721_marau_guapore_scope.sql`.

O arquivo `shared/mucum-contributors.json` organiza o escopo em:

- sistema Antas e Carreiro como influencias principais;
- Guapore, Marau e Capingui como contribuicao local critica;
- tributarios de montante e drenagem local;
- Forqueta, Jacare e Taquari-Mirim como contexto a jusante.

Na aba `Chuvas`, as cidades prioritarias mostram o acumulado do periodo selecionado e a previsao de 72h. A aba `Rios e vazao` mantem a lista completa, inclusive quando um tributario esta sem estacao ativa.

O bloco `Cidades no comparativo` permite marcar varias cidades. O grafico compara o acumulado observado no periodo ativo (`24h`, `7d` ou `30d`) com a previsao das proximas `72h`; Santa Tereza, Guapore, Marau, Jaquirana e Vacaria formam a selecao prioritaria inicial.

## Barragens

Para habilitar a area de barragens, rode no Supabase:

```sql
-- conteudo de supabase/20260716_dams.sql
```

Depois cadastre registros em `dams`. A rota `/api/mucum/current` tambem consulta estacoes telemetricas da ANA associadas as UHEs e grava leituras em `dam_readings`. O painel mostra entrada, saida, nivel do reservatorio e status do vertedouro pela view `v_latest_dam_readings`.

A rota `/api/mucum/current` tambem salva historico consolidado no Supabase:

- `monitoring_stations`
- `station_readings`
- `rainfall_aggregates`

Assim dados anteriores ja consultados ficam persistidos e podem ser reaproveitados para desempenho e historico.

Para criar um seed inicial das UHEs a montante no Rio das Antas:

```sql
-- conteudo de supabase/20260716_seed_dams_taquari_antas.sql
```

As vazoes automaticas sao derivadas de estacoes telemetricas ANA com nomes de UHE/barramento, como Castro Alves, Monte Claro e 14 de Julho. Elas servem como referencia hidrologica e nao substituem boletim operacional oficial da usina.

## Proximas etapas

- Confirmar credenciais reais da ANA e o formato exato do token retornado.
- Adicionar autenticacao antes de liberar o painel administrativo publicamente.
- Evoluir para build Android/iOS com Expo EAS quando a interface web estiver validada.

## Estilização e Padrões Visuais (Verda Admin)

A aplicação passou por uma reformulação visual completa para adotar o sistema de design "Verda Admin". O objetivo é criar uma experiência premium, responsiva e focada em dashboards de monitoramento.

Principais características:
- **Layout Baseado em Cards:** A interface é organizada em painéis (`styles.panel`) e cards (`styles.card`) com sombras suaves e bordas arredondadas.
- **Sistema de Cores Semântico:** As cores são usadas para indicar o status dos parâmetros hidrológicos, em conjunto com componentes como `StatusBadge`.
  - **Verde (`#1D9E75`) / Blue (`#176b75`):** Normal / Estável ou Neutro
  - **Amarelo (`#F59E0B` / `#d97706`):** Atenção / Alerta
  - **Vermelho (`#EF4444` / `#b91c1c`):** Crítico
- **Tipografia e Hierarquia:** Uso de títulos com cores mais escuras (`#102a36`) e legendas mais sutis (`#5a6b74`), melhorando o escaneamento visual da página.
- **React Native Web (StyleSheet):** Todo o visual projetado originalmente em CSS (`admin-dashboard.css` e `shared.css`) foi mapeado diretamente para o `StyleSheet` do React Native. O layout se ajusta automaticamente dependendo da largura (`isNarrow`).

Essas diretrizes de estilo devem ser seguidas para qualquer novo componente adicionado ao painel.
