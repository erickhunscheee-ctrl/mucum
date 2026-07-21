# Plano de Contingencia de Mucum - referencia da plataforma

Documentos analisados:

- `PLANO DE CONTINGENCIA DE MUCUM - DEFESA CIVIL 17.07 - FINAL.pdf`, Prefeitura Municipal de Mucum, julho de 2026, 95 paginas. Esta e a referencia operacional mais recente.
- `PLANO DE CONTIGENCIA 3.pdf`, Prefeitura Municipal de Mucum, 88 paginas. Usado como fonte complementar para historico e fichas territoriais que nao aparecem na versao final.

Este resumo registra apenas dados operacionais necessarios ao sistema. Nomes, telefones e mapas de pessoas vulneraveis nao devem ser expostos em rotas publicas, snapshots ou no app do morador.

## Gatilhos hidrologicos

Fonte principal: paginas 31 a 35 do plano final.

| Cota | Estagio | Resposta minima |
| --- | --- | --- |
| 5 m | Normal | Monitoramento de rotina e atualizacao de recursos. |
| 7 m | Alerta Moderado | Intensificar monitoramento e comunicacao preventiva. |
| 9 m | Alerta Alto | Ativar Comite de Crise, monitoramento horario e preparacao logistica. |
| 15 m | Alerta Muito Alto | Ativar SCI e Posto de Comando, preparar alojamentos e retirar vulneraveis preventivamente. |
| 18 m | Alerta Maximo | Evacuar areas mapeadas, abrir alojamentos, acionar socorro e restringir areas inundaveis. |

O painel deve sempre diferenciar nivel observado, pico provavel e cenario maximo. Uma projecao nunca deve emitir ordem automatica de evacuacao.

## Referencias de nivel

Fonte: pagina 23.

- SGB/CPRM pos-setembro de 2023: atencao 5 m, alerta 9 m, inundacao 18 m.
- Regua fisica municipal pos-maio de 2024: atencao 3 m, alerta 7 m, inundacao 16 m.
- SGB/CPRM antes de setembro de 2023: atencao 5 m, alerta 10 m, inundacao 18 m.

Essas cotas nao podem ser misturadas. Toda leitura, grafico, regra e notificacao precisa exibir a referencia usada.

## Capacidade e exposicao

Fontes: paginas 60 a 68 do plano final e paginas 57 a 60 do plano complementar.

- O resumo de capacidades informa oito alojamentos e 446 pessoas, mas a tabela detalhada lista nove alojamentos e 506 pessoas. A divergencia deve ser confirmada pela Prefeitura.
- Dois pontos de encontro dedicados, capacidade documental total de 200 pessoas. O plano final tambem considera todos os alojamentos como pontos de encontro.
- Quatro territorios detalhados, total agregado de 832 pessoas e 208 edificacoes: Sao Jose, Centro/Rua Luis Signori, Centro e Fatima.
- Seis rotas no plano final: duas com inutilizacao em 20 m, uma em 22 m e tres descritas como fora da mancha de inundacao, condicionadas a verificacao de campo.

## Monitoramento e evacuacao do plano final

Fontes: paginas 28 a 30, 44 a 47 e 56.

- Cinco equipamentos municipais acompanham os rios Taquari e Guapore, incluindo reguas e sensores eletronicos.
- A Ponte Rodoferroviaria Brochado da Rocha possui sensor automatico e camera 360 graus.
- Tres pluviometros municipais: Linha 13 de Maio (`431260901A`), Cidade Alta (`431260902A`) e Centro (`431260903A`).
- Cadencia intensificada: a cada 60 minutos a partir de 9 m, 30 minutos a partir de 15 m e 15 minutos a partir de 18 m.
- Evacuacao territorial escalonada nas cotas 16, 18, 20 e 22 m, com margem operacional de 3 m para antecipar a retirada.
- O plano destaca Santa Tereza, chuva nas cabeceiras e vazoes das barragens como referencias para decidir a antecipacao.

O plano determina que casas de familiares ou amigos sejam a primeira opcao e que alojamentos coletivos sejam usados como ultimo recurso.

## Contribuintes hidrologicos usados no painel

O escopo de chuva foi separado por relacao com Mucum:

- Influencia principal: sistema do Rio das Antas e bacia do Rio Carreiro.
- Contribuicao local critica: Rio Guapore, cuja foz fica proxima ao sul urbano e deve ser analisada separadamente por efeito local e represamento.
- Tributarios de montante: Tainhas, Camisas, Lajeado Grande, Sao Marcos, Quebra-Dentes, da Prata e Turvo.
- Drenagem local: Arroio Mucum e Arroio da Braba, quando houver estacao ou fonte local disponivel.
- Ponto de controle: Rio Taquari na estacao Mucum `86510000`.
- Contexto a jusante: Forqueta, Jacare e Taquari-Mirim, visiveis para consulta mas fora da chuva que chega primeiro a Mucum.

O catalogo compartilhado esta em `shared/mucum-contributors.json`. A revisao cruzou a lista estadual G040 com a area contribuinte de 16.000 km2 da estacao Mucum. Municipios sao usados como indice de cobertura; o modelo nao deve tratar a area municipal inteira como se toda ela drenasse para Mucum.

Foram incluidos municipios antes ausentes no catalogo, principalmente no Carreiro, Prata, Turvo e baixo Guapore: Andre da Rocha, Camargo, Casca, Doutor Ricardo, Gentil, Guabiju, Montauri, Muitos Capoes, Nova Alvorada, Nova Araca, Parai, Protasio Alves, Santo Antonio do Palma, Sao Domingos do Sul, Sao Jorge, Vila Maria e Vista Alegre do Prata.

Encantado, Roca Sales, Colinas, Arroio do Meio, Lajeado, Estrela, Bom Retiro do Sul e Taquari permanecem fora da entrada de chuva que chega primeiro a estacao Mucum. O Guapore e mantido como contribuicao local critica separada, pois sua confluencia e o remanso podem afetar a area urbana sem equivaler diretamente a cota da estacao `86510000`.

## Cheias de referencia

Fonte: paginas 57 a 60.

- 1912: 20,50 m.
- 05/05/1941: 19,06 m.
- 06/09/2023: 26,11 m.
- 08/11/2023: 23,20 m.
- 01/05/2024: 26,10 m.
- 12/05/2024: 20,80 m.

Antes de usar esses eventos para calibracao matematica, deve-se confirmar o datum e a regua associados a cada cota historica.

## Pendencias encontradas no documento

- A tabela meteorologica da pagina 34 salta de `>100-150 mm/24h` para `>250 mm/24h`; a faixa entre 150 e 250 mm precisa ser validada.
- O resumo de capacidades e a tabela de alojamentos divergem entre 8/446 e 9/506.
- A tabela de evacuacao repete o quarteirao 71 na faixa de 18 m do Bairro Fatima; confirmar a numeracao no mapa oficial.
- As fichas territoriais usam o COBRADE `1.2.1.0.0` para inundacao, enquanto o diagnostico usa `1.3.2.1.1`; confirmar o codigo oficial antes da publicacao.
- A ficha de Fatima ainda contem um marcador pedindo inclusao de parametros e etapas de resposta.
- Mapas de evacuacao e vulnerabilidade devem passar por validacao geoespacial antes de alimentar navegacao publica.
- Contatos pessoais do plano devem ficar em tabela privada, acessivel apenas a usuarios autenticados com perfil operacional.

## Aplicacao no sistema

- `src/features/contingency`: dados offline e tela de apoio operacional.
- `supabase/20260718_contingency_plan.sql`: base original do plano; precisa receber a revisao final antes de ser aplicada novamente em producao.
- Os niveis legados de 16 m a 19 m sao desativados pela migration e substituidos pelos estagios do plano de 2026.
- A projecao continua experimental e deve ser combinada com boletins ANA, SGB/CPRM, CEMADEN, INMET e decisao da Defesa Civil.
