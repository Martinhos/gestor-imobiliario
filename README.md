# Gestor Imobiliário

Versão web (PWA, multi-utilizador) da app Android de gestão de imóveis: imóveis, contratos,
inquilinos, proprietários, movimentos, créditos à habitação, projeções e avaliação.

## Como funciona a partilha

1. Cada utilizador cria conta (email + palavra-passe) e recebe um **id curto** (ex.: `A7KQ2MPX`).
2. Em **Definições → Conta e partilha**, um utilizador adiciona o id do outro; o outro aceita.
3. Dentro da conexão, **cada utilizador escolhe que casas suas partilha** com o outro.
   Uma casa partilhada leva consigo os contratos, movimentos, recorrentes e pessoas associadas,
   e o outro utilizador pode ver e editar; apagar a casa e gerir a partilha é só do dono.

**Os proprietários são os utilizadores.** Cada um preenche os seus dados (nome, NIF, CC,
contactos — usados nos contratos em PDF) em **Definições → O meu perfil**. Uma casa não
partilhada pertence 100% ao dono e não mostra divisão; numa casa partilhada, os utilizadores
com acesso são comproprietários (partes iguais por omissão) e qualquer um pode **propor uma
nova divisão de percentagens — que só entra em vigor quando todos os outros a confirmarem**.

## Arquitetura

| Peça | Tecnologia |
|---|---|
| Frontend | PWA estática em [`web/`](web) (a app original + [`web/cloud.js`](web/cloud.js) com sessão e sincronização) |
| API | Cloudflare Worker ([`worker/src/`](worker/src)) — sem dependências |
| Base de dados | Cloudflare D1 (SQLite) — migrações em [`migrations/`](migrations) |
| Sessões | Cloudflare Workers KV |
| Infra | Terraform ([`terraform/`](terraform)) cria a D1 e o KV |
| CI/CD | GitHub Actions ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)): terraform apply → migrações → `wrangler deploy` a cada push no `main` |

Tudo dentro dos planos gratuitos do Cloudflare (Workers, D1, KV).

A sincronização é por entidade com "última escrita ganha": o cliente guarda um snapshot do que
enviou e, a cada gravação, envia só as diferenças para `POST /api/sync`. O estado visível vem de
`GET /api/state` (casas próprias + partilhadas + registos + conexões).

## Desenvolvimento local

```bash
npm install
npx wrangler d1 migrations apply gestor-imobiliario --local
npx wrangler dev
```

## Ambientes

| | Produção | Dev |
|---|---|---|
| Ramo | `main` | `dev` |
| Endereço | gestor-imobiliario.martinhos.workers.dev | gestor-imobiliario-dev.martinhos.workers.dev |
| Base de dados | `gestor-imobiliario` | `gestor-imobiliario-dev` |
| Contas | até 2000 | até 50 |
| Entrada com Google | sim | não (o endereço não está autorizado na Google) |
| Avisos no Discord | erros e pedidos, mais o resumo diário | erros e pedidos, marcados com `[dev]` |

### Um bot do Discord só para dev

O endereço das interações pertence à **aplicação** do Discord, não ao
servidor. Um segundo servidor com o mesmo bot continua a falar com a
produção — por isso um bot de dev tem mesmo de ser uma segunda aplicação.

No Discord:

1. **Developer Portal → New Application**, por exemplo *Gestor Imobiliário ·
   dev*. Em **Bot**, criar o bot e copiar o token.
2. **General Information → Interactions Endpoint URL**:
   `https://gestor-imobiliario-dev.martinhos.workers.dev/api/discord`.
   O Discord assina um pedido de teste e só aceita se o worker de dev já
   estiver publicado com a chave pública desta aplicação.
3. Criar o servidor de dev e convidar lá este bot (`applications.commands` e
   `bot`), com os cargos correspondentes.

Nos segredos do repositório, com o sufixo `_DEV`. O que não estiver definido
cai no valor partilhado, por isso basta definir o que difere:

| Segredo | Para quê |
|---|---|
| `DISCORD_APP_ID_DEV`, `DISCORD_BOT_TOKEN_DEV` | registar os comandos na aplicação de dev |
| `DISCORD_PUBLIC_KEY_DEV` | o worker de dev verificar as assinaturas dela |
| `DISCORD_GUILD_ID_DEV` | registar no servidor de dev (aparecem de imediato) |
| `DISCORD_MASTER_DEV`, `DISCORD_ADMINS_DEV`, `DISCORD_DEVS_DEV`, `DISCORD_SUPORTE_DEV` | os cargos do servidor de dev |
| `DISCORD_DEV_WEBHOOK_DEV`, `DISCORD_DEV_CHANNEL_DEV`, `DISCORD_SUPORTE_*_DEV` | os canais do servidor de dev |

A partir daí o deploy de dev regista os comandos na aplicação de dev, e o de
produção na de produção — deixam de se pisar. O `/comandos` passa a dizer no
rodapé com que ambiente se está a falar; em produção não diz nada, porque só
há um.

Para registar à mão: **Actions → Comandos do Discord**, e escolher o bot.

**O fluxo de uma alteração com migração** — que é onde o ambiente de dev
ganha o seu sustento:

```bash
git checkout -b dev            # ou: git checkout dev && git merge main
# … escrever o código e a migração …
git push -u origin dev         # publica em dev e aplica lá a migração
```

Testa na app de dev. Se a migração fizer o que devia e nada partiu, junta a
produção:

```bash
git checkout main && git merge dev && git push
```

Os dados de exemplo criam-se dentro da própria app: entra na app de dev com
uma conta de teste e usa **Visão geral → Carregar exemplo**.

Nota: a infraestrutura dos dois ambientes é criada pelo Terraform a partir do
`main`. Um deploy de `dev` só lê os ids que já existem no estado, por isso o
`main` tem de correr uma vez antes do primeiro deploy de dev.

## Deploy (uma vez)

1. Criar um API token no Cloudflare (template "Edit Cloudflare Workers" + permissões D1:Edit e Workers KV Storage:Edit).
2. Definir os segredos no GitHub: `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`.
3. Push para `main` — o workflow trata do resto. O estado do Terraform fica versionado no
   repositório (contém apenas ids de recursos, nenhum segredo).

## Entrada com Google

O botão "Continuar com Google" aparece automaticamente quando `GOOGLE_CLIENT_ID`
estiver preenchido em [`wrangler.toml`](wrangler.toml): em
[console.cloud.google.com](https://console.cloud.google.com) → APIs & Services →
Credentials → *Create OAuth client ID* (tipo **Web application**), adiciona
`https://gestor-imobiliario.martinhos.workers.dev` às *Authorized JavaScript
origins* e copia o Client ID.

**Não é preciso client secret**: usa-se o fluxo de ID token do Google Identity
Services — o browser recebe um JWT assinado pelo Google e o worker valida a
assinatura contra as chaves públicas (JWKS), o emissor e a audiência. O secret só
seria necessário no fluxo de *authorization code* feito no servidor. Quem já tinha
conta por palavra-passe pode passar a entrar com o mesmo email pelo Google.

## Migrar dados da app Android

Na app Android: **Definições → Dados → Guardar cópia** (exporta um `.json`).
Na web, depois de criares conta: **Definições → Dados → Abrir cópia** e escolhe o ficheiro —
os dados são carregados e sincronizados para a tua conta.

## Limitações conhecidas

- Anexos (fotos e documentos) ficam apenas no aparelho onde foram adicionados (IndexedDB);
  não são sincronizados entre aparelhos nem incluídos na partilha (passar para R2 é o próximo passo).
- Notificações de movimentos por confirmar existiam via alarmes Android; na web o aviso aparece ao abrir a app.
