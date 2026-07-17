# Deploy na VPS com Docker e Easypanel

## Arquitetura

O projeto usa um unico container e uma unica porta:

```text
Navegador
  -> HTTPS / dominio no Easypanel
  -> container Hydro ANA :3000
     -> arquivos web do Expo em / e demais caminhos
     -> proxy Node nas rotas /api/*
        -> ANA
        -> Supabase
```

O navegador usa `/api` no mesmo dominio. As credenciais `ANA_*` e a chave
`SUPABASE_SERVICE_ROLE_KEY` existem somente no processo Node e nao entram no
bundle web.

## Teste com Docker

Crie `.env` a partir de `.env.example` e mantenha o arquivo fora do Git.

Com Docker Compose:

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f app
```

Acesse:

```text
http://IP_DA_VPS:8080
http://IP_DA_VPS:8080/api/health
```

Sem Docker Compose:

```bash
docker build \
  --build-arg EXPO_PUBLIC_PROXY_URL= \
  --build-arg EXPO_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co \
  --build-arg EXPO_PUBLIC_SUPABASE_ANON_KEY=SUA_ANON_KEY \
  -t hydro-ana:latest .

docker run -d \
  --name hydro-ana \
  --restart unless-stopped \
  --env-file .env \
  -e PORT=3000 \
  -p 8080:3000 \
  hydro-ana:latest
```

## Instalacao do Easypanel

Use preferencialmente uma VPS Ubuntu nova, com pelo menos 2 GB de RAM. As
portas 80 e 443 precisam estar livres e abertas no firewall.

```bash
curl -sSL https://get.docker.com | sh

docker run --rm -it \
  -v /etc/easypanel:/etc/easypanel \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  easypanel/easypanel setup
```

Documentacao oficial: https://easypanel.io/docs

## Criacao do servico

1. Envie este projeto para um repositorio Git privado.
2. No Easypanel, crie um projeto chamado `hydro-ana`.
3. Adicione um servico do tipo `App`, por exemplo `painel`.
4. Em `Source`, conecte o repositorio e selecione a branch de producao.
5. Em `Build`, selecione `Dockerfile` e informe `Dockerfile` como caminho.
6. Em `Environment`, cole e preencha o modelo de `deploy/easypanel.env.example`.
7. Deixe `EXPO_PUBLIC_PROXY_URL` vazio. Assim o frontend usa `/api` no mesmo dominio.
8. Em `Domains`, adicione o dominio e configure `Proxy Port` como `3000`.
9. Marque o dominio principal e habilite HTTPS.
10. Clique em `Deploy`.

As variaveis `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` sao
publicas e entram no bundle durante o build. Nao use o prefixo `EXPO_PUBLIC_`
na chave `SUPABASE_SERVICE_ROLE_KEY` nem nas credenciais ANA.

## DNS

No provedor do dominio, crie um registro apontando para o IP da VPS:

```text
Tipo: A
Nome: painel (ou @)
Valor: IP_PUBLICO_DA_VPS
```

Depois adicione no Easypanel o dominio correspondente, por exemplo
`painel.seudominio.com.br`. O Easypanel configura o proxy e o certificado
Let's Encrypt.

## Validacao

Depois do deploy, verifique:

```text
https://painel.seudominio.com.br/api/health
```

Resposta esperada:

```json
{
  "status": "ok",
  "service": "hydro-ana"
}
```

No painel, valide as abas `Chuvas`, `Rios e vazao`, `Barragens` e `Projecao`.
Nos logs do servico, confirme que nao existem erros de autenticacao ANA ou de
conexao com o Supabase.

## Atualizacoes e rollback

Ative `Auto Deploy` somente depois do primeiro deploy validado. Cada push na
branch configurada gerara uma nova imagem. Em caso de falha, use o historico de
deploys do Easypanel para voltar para a versao anterior.

O container nao precisa de volume: historico, snapshots e configuracoes ficam
no Supabase. Logs devem ser acompanhados pelo Easypanel.

## Seguranca

- Nunca envie `.env` ao Git.
- Nunca coloque `SUPABASE_SERVICE_ROLE_KEY`, `ANA_IDENTIFICADOR` ou `ANA_SENHA`
  em variaveis `EXPO_PUBLIC_*`.
- Use repositorio privado.
- Antes de liberar o painel administrativo publicamente, proteja o acesso com
  autenticacao da aplicacao ou uma camada de acesso no dominio.
- Mantenha somente 22, 80 e 443 liberadas no firewall da VPS.
