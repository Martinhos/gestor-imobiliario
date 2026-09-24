# Rendorium

> Nome interno (worker, bases, repositório): `gestor-imobiliario` — não mudou de propósito: renomear infraestrutura viva é risco sem ganho.

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
| Frontend | PWA estática em [`web/`](web): a base em [`web/app/`](web/app) e um serviço por separador (o catálogo em [`web/app/servicos.js`](web/app/servicos.js)), mais [`web/cloud/`](web/cloud) com sessão e sincronização |
| API | Cloudflare Worker ([`worker/src/`](worker/src)) — sem dependências |
| Base de dados | Cloudflare D1 (SQLite) — migrações em [`migrations/`](migrations) |
| Sessões | Cloudflare Workers KV; no browser a sessão vai num cookie HttpOnly, e o token não se guarda no aparelho |
| Anexos | Cloudflare R2 — fotos e documentos, sincronizados entre aparelhos e partilhados com a casa, com as regras de acesso de [`docs/armadilhas.md`](docs/armadilhas.md); as cópias diárias da base também vivem lá |
| Infra | Terraform ([`terraform/`](terraform)) cria as duas D1, os dois KV e os dois R2 (produção e dev); as bases e os baldes têm `prevent_destroy` |
| CI/CD | GitHub Actions ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)), a cada push no `main` (produção) e no `dev`: espera pelo «Testes» verde desse commit → plano do terraform, recusado se destruir alguma coisa → migrações → worker e segredos numa versão só → confirma que o endereço responde a versão nova → etiqueta `publicado` |

Tudo dentro dos planos gratuitos do Cloudflare (Workers, D1, KV, R2).

A sincronização é por entidade com "última escrita ganha": o cliente guarda um retrato do que o
servidor já tem (um resumo por entidade) e, a cada gravação, envia só as diferenças para
`POST /api/sync`. O estado visível vem de `GET /api/state` (casas próprias + partilhadas + registos +
conexões), que responde 304 quando nada mudou desde a última leitura; o cliente adota-o sem perder
o que ainda não enviou. Ver «A sincronização» em [`docs/design.md`](docs/design.md); a história das
decisões está em [`docs/decisoes.md`](docs/decisoes.md).

A app está dividida em serviços: cada separador da barra lateral (menos as Definições, que são a
base) tem manifesto próprio em `web/app/servicos.js` e regista-se na base ao carregar, em vez de a
base o nomear. O suporte pode ligar ou desligar cada serviço a um utilizador no back office
(`/equipa`, ficha do utilizador): o servidor guarda a escolha (`user_services`), deixa de mandar os
registos desse serviço e recusa escritas neles; na app o separador some. Desligar um serviço desliga
os que dependem dele (sem Imóveis não há Contratos). Ver «A app em serviços» em
[`docs/design.md`](docs/design.md).

## Desenvolvimento local

```bash
npm install                # instala o wrangler e gera worker/src/docs-gerados.js
npx wrangler d1 migrations apply gestor-imobiliario --local
npm run dev                # volta a gerar a documentação e levanta o wrangler dev
```

O `worker/src/docs-gerados.js` (a documentação que o `/equipa/docs` serve) não está no git:
sai de `node scripts/gerar-docs.js`, e o `wrangler dev` não arranca sem ele. O `npm install` e o
`npm run dev` geram-no; quem levantar o `wrangler dev` à mão corre o gerador antes.

## Ambientes

| | Produção | Dev |
|---|---|---|
| Ramo | `main` | `dev` |
| Endereço | app.rendorium.com (e o antigo workers.dev, que continua a servir as instalações feitas lá) | dev.rendorium.com (e o antigo workers.dev) |
| Landing | rendorium.com e www — servida pelo worker (worker/src/landing.js) | — |
| Base de dados | `gestor-imobiliario` | `gestor-imobiliario-dev` |
| Contas | até 2000 | até 50 |
| Entrada com Google | sim | não (o endereço não está autorizado na Google) |
| Avisos no Discord | erros e pedidos, mais o resumo diário | erros e pedidos, marcados com `[dev]` |

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

O deploy de produção espera pelo «Testes» desse commit e só publica se ele ficar verde.

Os dados de exemplo criam-se dentro da própria app: entra na app de dev com
uma conta de teste e usa **Visão geral → Carregar exemplo**.

Nota: a infraestrutura dos dois ambientes é criada pelo Terraform a partir do
`main`. Um deploy de `dev` só lê os ids que já existem no estado, por isso o
`main` tem de correr uma vez antes do primeiro deploy de dev. O estado vive no
R2 e não no repositório (ver **Deploy (uma vez)**, ponto 3).

## Deploy (uma vez)

1. Criar um API token no Cloudflare com, na conta: **Workers Scripts: Edit**, **D1: Edit**,
   **Workers KV Storage: Edit** e **Workers R2 Storage: Edit**; e na zona `rendorium.com`:
   **Workers Routes: Edit** e **DNS: Edit** (o deploy cria os domínios personalizados). É o token
   de deploy: vive só no GitHub e nunca entra num worker ([`docs/armadilhas.md`](docs/armadilhas.md)).
2. Definir os segredos no GitHub: `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`. Os do Discord,
   os do correio e o `PASS_PEPPER` (o pepper das palavras-passe; `PASS_PEPPER_DEV` para o dev) são
   opcionais — o deploy publica os que existirem. O pepper é um valor aleatório comprido e, uma vez
   publicado, **nunca se muda nem se apaga**: as palavras-passe guardadas com ele deixavam de entrar.
   A chave de assinatura do APK vive nos segredos `ANDROID_KEYSTORE_B64` e `ANDROID_KEYSTORE_PASS`
   ([`android/README.md`](android/README.md)).
3. O estado do Terraform vive num balde R2 só dele, e **não** no repositório — este é público, e um
   estado acaba sempre por apanhar atributos sensíveis. Uma vez, a partir de uma cópia local:

   ```bash
   npx wrangler@4 r2 bucket create gestor-imobiliario-infra --remote
   npx wrangler@4 r2 object put gestor-imobiliario-infra/terraform.tfstate \
     --file terraform/terraform.tfstate --remote
   ```

   O deploy traz-o antes de correr o Terraform e volta a guardá-lo, com uma cópia datada, quando o
   apply muda alguma coisa. Se não estiver lá, o deploy **para**: sem estado, o plano proporia criar
   de novo a base e os baldes. Para um arranque de raiz, corre o workflow à mão com
   `terraform_sem_estado` ligado.
4. Push para `main` — o workflow trata do resto.

## Se uma publicação correu mal

Depois do `wrangler deploy`, o deploy confirma que o endereço do ambiente responde o `/versao.json`
acabado de gerar e a raiz com 200 (passo «Confirmar que a publicação responde»).

- **O worker novo responde com erro (5xx):** o próprio deploy volta à versão anterior
  (`wrangler rollback`) e avisa no canal de quem programa. Resta corrigir.
- **Não se confirmou por outra razão** (continua a responder a versão antiga, ou não responde):
  o deploy falha e avisa, mas não recua sozinho — decide uma pessoa.
- **Recuar à mão:** no painel da Cloudflare, Workers & Pages → `gestor-imobiliario` (ou
  `gestor-imobiliario-dev`) → Deployments → na versão anterior, **Rollback**. É o caminho sem token
  no portátil; com o token de deploy à mão, é `npx wrangler rollback` (mais `--env dev` no dev).
- **Voltar a publicar o mesmo conteúdo** (um deploy que falhou a meio): Actions → Deploy → Run
  workflow, no ramo `main`.

O que o recuo não desfaz:

- As **migrações da D1 não recuam**: o código anterior passa a correr sobre o esquema novo — funciona
  porque as migrações deste projeto só acrescentam. Uma migração errada corrige-se com outra.
- **Quem já abriu a versão nova fica com ela**: a app só se atualiza quando o `/versao.json` diz um
  número MAIOR do que o seu. Uma avaria na app corrige-se para a frente — a correção, uma entrada
  nova em `web/avisos.js` (sobe a versão) e a promoção de sempre.
- Um `git revert` da promoção faz a versão descer, e o guarda da chegada recusa-o («a versão
  DESCEU»): reverte-se o código, mas a versão sobe na mesma.
- A etiqueta `publicado` fica na publicação que se recuou; a seguinte tem de subir a versão acima
  dela, que é o que faz a correção chegar a quem a apanhou.

## Entrada com Google

O botão "Continuar com Google" aparece automaticamente quando `GOOGLE_CLIENT_ID`
estiver preenchido em [`wrangler.toml`](wrangler.toml): em
[console.cloud.google.com](https://console.cloud.google.com) → APIs & Services →
Credentials → *Create OAuth client ID* (tipo **Web application**), adiciona às
*Authorized JavaScript origins* `https://app.rendorium.com` e o endereço antigo
`https://gestor-imobiliario.martinhos.workers.dev` (onde vivem as instalações feitas
antes do domínio) — e `https://dev.rendorium.com`, se quiseres o botão no dev — e copia o
Client ID.

**Não é preciso client secret**: usa-se o fluxo de ID token do Google Identity
Services — o browser recebe um JWT assinado pelo Google e o worker valida a
assinatura contra as chaves públicas (JWKS), o emissor e a audiência. O secret só
seria necessário no fluxo de *authorization code* feito no servidor. Quem já tinha
conta por palavra-passe pode passar a entrar com o mesmo email pelo Google.

## Migrar dados da app Android

Na app Android: **Definições → Dados → Guardar cópia** (exporta um `.json`).
Na web, depois de criares conta: **Definições → Importar e cópias → Abrir cópia** e escolhe o ficheiro —
os dados são carregados e sincronizados para a tua conta.

## Limitações conhecidas

- Notificações de movimentos por confirmar existiam via alarmes Android; na web o aviso aparece ao abrir a app.
- A página Declaração resume o Anexo F (quadro 4.1) e lembra os prazos da AT, mas não entrega nada à AT
  nem lê o Portal das Finanças — o Modelo 2, os recibos eletrónicos e a declaração fazem-se lá.
