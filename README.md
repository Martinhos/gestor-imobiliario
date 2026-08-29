# Gestor Imobiliário

Versão web (PWA, multi-utilizador) da app Android de gestão de imóveis: imóveis, contratos,
inquilinos, proprietários, movimentos, créditos à habitação, projeções e avaliação.

## Como funciona a partilha

1. Cada utilizador cria conta (email + palavra-passe) e recebe um **id curto** (ex.: `A7KQ2MPX`).
2. Em **Definições → Conta e partilha**, um utilizador adiciona o id do outro; o outro aceita.
3. Dentro da conexão, **cada utilizador escolhe que casas suas partilha** com o outro.
   Uma casa partilhada leva consigo os contratos, movimentos, recorrentes e pessoas associadas,
   e o outro utilizador pode ver e editar; apagar a casa e gerir a partilha é só do dono.

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

## Deploy (uma vez)

1. Criar um API token no Cloudflare (template "Edit Cloudflare Workers" + permissões D1:Edit e Workers KV Storage:Edit).
2. Definir os segredos no GitHub: `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`.
3. Push para `main` — o workflow trata do resto. O estado do Terraform fica versionado no
   repositório (contém apenas ids de recursos, nenhum segredo).

## Migrar dados da app Android

Na app Android: **Definições → Dados → Guardar cópia** (exporta um `.json`).
Na web, depois de criares conta: **Definições → Dados → Abrir cópia** e escolhe o ficheiro —
os dados são carregados e sincronizados para a tua conta.

## Limitações conhecidas

- Anexos (fotos e documentos) ficam apenas no aparelho onde foram adicionados (IndexedDB);
  não são sincronizados entre aparelhos nem incluídos na partilha (passar para R2 é o próximo passo).
- Notificações de movimentos por confirmar existiam via alarmes Android; na web o aviso aparece ao abrir a app.
