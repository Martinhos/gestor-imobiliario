# Armadilhas conhecidas

Coisas que já morderam alguém neste projeto. Cada uma custou uma tarde;
ler isto custa cinco minutos.

## O guião do /equipa vive num template literal
Todo o JavaScript do back office (equipa-vista.js) é TEXTO dentro de um
template literal do servidor. Um `\n` simples numa string é cozido pelo
servidor num newline real dentro do guião servido — SyntaxError no browser
e a página inteira morta em «A carregar…». Escreve `\\n` e `\\'`, como o
resto do ficheiro. Há um teste (equipa-guiao.test.js) que faz parse do
guião gerado por papel — se rebentar aí, foi isto.

## node:sqlite não aceita ?1 repetido
A D1 aceita parâmetros numerados (`?1` usado duas vezes); o node:sqlite
dos testes não — dá «column index out of range». O duplo de teste
(testes/lib/bd.js) traduz automaticamente, mas se vires esse erro num
teste novo, é quase de certeza SQL com parâmetros numerados a passar por
um caminho que não traduz.

## Os assets respondem antes do worker
Por omissão, um pedido que bata num ficheiro estático (ex.: `/` →
index.html) é servido SEM o worker correr. O host-branching (landing no
apex, app no resto) só funciona porque `run_worker_first = ["/"]` está no
wrangler.toml. Se adicionares outra rota que colida com um ficheiro
estático, tens de a acrescentar lá.

## Definir routes desliga o workers.dev
`custom_domain = true` no wrangler.toml desativa o endereço workers.dev
por omissão — e as instalações antigas vivem lá. O `workers_dev = true`
explícito é obrigatório e não pode sair.

## Os secrets só chegam ao worker num deploy
Mudar um secret no GitHub não muda nada no worker: é o passo «Publicar
segredos» do deploy que os grava. Depois de corrigir um secret, corre o
deploy do ambiente certo — senão o worker continua com o valor antigo
(foi assim que a validação do endpoint do Discord «falhou» com a chave
certa no GitHub e a errada no worker).

## Cada token do Cloudflare no seu sítio
O token de deploy (conta inteira: workers, D1, KV, R2, DNS) vive só no
GitHub Actions e NUNCA entra no runtime de um worker. O worker recebe
tokens dedicados e mínimos (CF_EMAIL_TOKEN para o Email Routing,
CF_ANALYTICS_TOKEN só de leitura). Já houve um fallback que publicava o
token de deploy no worker — não voltar a isso.

## Bots separados, chave partilhada
Produção e dev têm aplicações Discord distintas (o endpoint das
interações é da aplicação, não do servidor), logo tokens de bot
diferentes. As ligações do /test são assinadas com a TESTE_CHAVE — a
mesma nos dois ambientes — precisamente porque o token do bot deixou de
ser partilhado. No ambiente de dev, qualquer secret `<NOME>_DEV` tem
precedência sobre o partilhado.

## Objetos indexados por input do utilizador
`ACOES[acao]` com `acao = 'constructor'` devolve uma função herdada — e
chamada com `(env, …)` já devolveu o env inteiro, segredos incluídos.
Usa sempre `Object.prototype.hasOwnProperty.call(mapa, chave)` antes de
indexar com o que vem de fora.

## O correio tem regras próprias
`enviarEmail` é um no-op sem RESEND_API_KEY (a app funciona na mesma);
fora de produção o assunto leva o prefixo do ambiente; e um destinatário
`@teste.rendorium.com` é redirecionado — para o email do dev que criou a
conta (registado via /test email:…) ou para test@rendorium.com. Nunca
assumas que o destinatário final é o que passaste.

## Mudar o legal.js implica subir a versão
Qualquer alteração de substância aos termos ou à privacidade exige subir
`VERSION` no web/legal.js E `TERMS_VERSION` no worker/src/lib/http.js
(iguais). É isso que faz a app pedir nova aceitação a toda a gente — o
mecanismo prometido na secção de alterações dos próprios termos.

## Patches em ficheiros com UTF-8 no Windows
Aplicar edições por heredoc bash corrompe acentos e emoji. Os patches
escrevem-se num ficheiro .py (UTF-8) e corre-se esse ficheiro — nunca
código com texto acentuado por stdin.
