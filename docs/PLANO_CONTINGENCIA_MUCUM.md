# Plano de Contingencia de Mucum - referencia da plataforma

Documento analisado: `PLANO DE CONTIGENCIA 3.pdf`, Prefeitura Municipal de Mucum, versao 2026, 88 paginas.

Este resumo registra apenas dados operacionais necessarios ao sistema. Nomes, telefones e mapas de pessoas vulneraveis nao devem ser expostos em rotas publicas, snapshots ou no app do morador.

## Gatilhos hidrologicos

Fonte: paginas 20 a 23.

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

Fontes: paginas 43 a 49 e 57 a 60.

- Oito alojamentos temporarios, capacidade documental total de 446 pessoas.
- Seis pontos de encontro, capacidade documental total de 480 pessoas.
- Quatro territorios detalhados, total agregado de 832 pessoas e 208 edificacoes: Sao Jose, Centro/Rua Luis Signori, Centro e Fatima.
- Sete rotas com cota de inutilizacao entre 18 m e 28 m importadas para a plataforma.

O plano determina que casas de familiares ou amigos sejam a primeira opcao e que alojamentos coletivos sejam usados como ultimo recurso.

## Contribuintes hidrologicos usados no painel

O escopo de chuva foi separado por relacao com Mucum:

- Influencia principal: sistema do Rio das Antas e bacia do Rio Carreiro.
- Contribuicao local critica: Rio Guapore, cuja foz fica proxima ao sul urbano e deve ser analisada separadamente por efeito local e represamento.
- Tributarios de montante: Tainhas, Camisas, Lajeado Grande, Sao Marcos, Quebra-Dentes, da Prata e Turvo.
- Drenagem local: Arroio Mucum e Arroio da Braba, quando houver estacao ou fonte local disponivel.
- Ponto de controle: Rio Taquari na estacao Mucum `86510000`.
- Contexto a jusante: Forqueta, Jacare e Taquari-Mirim, visiveis para consulta mas fora da chuva que chega primeiro a Mucum.

O catalogo compartilhado esta em `shared/mucum-contributors.json`. O painel mostra todos os contribuintes mesmo quando nao existe leitura ativa, evitando que ausencia de estacao seja confundida com ausencia de risco.

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

- A tabela meteorologica da pagina 22 salta de `>100-150 mm/24h` para `>250 mm/24h`; a faixa entre 150 e 250 mm precisa ser validada.
- As fichas territoriais usam o COBRADE `1.2.1.0.0` para inundacao, enquanto o diagnostico usa `1.3.2.1.1`; confirmar o codigo oficial antes da publicacao.
- A ficha de Fatima ainda contem um marcador pedindo inclusao de parametros e etapas de resposta.
- Mapas de evacuacao e vulnerabilidade devem passar por validacao geoespacial antes de alimentar navegacao publica.
- Contatos pessoais do plano devem ficar em tabela privada, acessivel apenas a usuarios autenticados com perfil operacional.

## Aplicacao no sistema

- `src/features/contingency`: dados offline e tela de apoio operacional.
- `supabase/20260718_contingency_plan.sql`: plano, estagios, historico, areas, pontos de encontro, alojamentos e rotas.
- Os niveis legados de 16 m a 19 m sao desativados pela migration e substituidos pelos estagios do plano de 2026.
- A projecao continua experimental e deve ser combinada com boletins ANA, SGB/CPRM, CEMADEN, INMET e decisao da Defesa Civil.
