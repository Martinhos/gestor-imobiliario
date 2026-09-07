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
precedência sobre o partilhado — e para os webhooks e canais do Discord
o `_DEV` é obrigatório quando o servidor de dev é outro: o deploy resolve
cada destino no Discord e recusa sair com um que aponte para o servidor
errado (passo «Conferir o destino dos avisos»). Os nomes enganam:
`DISCORD_DEV_WEBHOOK` é o canal de quem programa; `DISCORD_DEV_WEBHOOK_DEV`
é esse canal no servidor de dev.

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

## Um colaborador nunca entra em participants
`canAccessHouse`/`participantsOf` (worker/src/lib/acesso.js) significam
SÓ dono + comproprietários, e é isso que conta nas quotas, nas propostas
e nas «contas entre proprietários». Um colaborador (cargo) entra por
`acessoACasa`, que devolve o grau — e é o que as escritas e os anexos
consultam. Se um dia alguém «simplificar» e meter os colaboradores em
participants, passam a ter quota, a aparecer no splitwise e a poder
propor divisões. A regra é: o servidor decide, o cliente esconde — o
`/api/state` já manda a casa despida (`projetarCasa`), os registos
filtrados por kind (`projetarRegisto`) e o perfil dos outros a `null`
para quem não é comproprietário de casa comum; esconder no cliente é só
cortesia, nunca a barreira. Ao acrescentar um campo sensível à casa ou a
um kind novo, a pergunta é «que permissão o abre?» — e a resposta escreve-se
em worker/src/lib/permissoes.js antes de escrever no cliente.

## Um anexo sem kind é só de donos
A migração 0014 acrescentou `files.record_kind`/`record_id` sem os
preencher: todos os anexos anteriores ficaram com kind NULL, e o mesmo
acontece a qualquer id de kind que o servidor não conheça. `acessoAoAnexo`
(worker/src/files.js) trata isso como «não classificado»: sai para o dono e
os comproprietários, e para nenhum cargo — nem com file.view — porque não
se sabe que permissão o abre (o CC de um inquilino pede tenant.view, o PDF
de um contrato contract.view). O kind só aparece quando o registo volta a
ser gravado (`linkFiles`), e aí o anexo passa a seguir a regra dele. Não
«corrigir» o ramo `rk === ''` para cair em file.view: era assim, e mostrava
os CC digitalizados a quem só marca visitas. Pela mesma razão, o filtro do
`linkFiles` depende de quem grava (o `estrito` que os chamadores passam
como `!!acesso.collab`): dono e comproprietário movem os anexos deles, os
soltos e qualquer anexo já nesta casa — é assim que os anexos antigos sem
kind ganham kind ao regravar o registo, incluindo os que o OUTRO
comproprietário carregou; um colaborador só move os dele, os soltos, ou os
já presos a ESTE registo pelo tuplo completo (casa, kind, id), o mesmo que
`regraDosAnexos` compara. Comparar só (casa, id) não chega: os ids de
registo são do cliente e repetem-se entre kinds — um tx com o id da ficha
do inquilino (ou o da casa, que qualquer colaborador conhece) re-etiquetava
o CC (ou o documento da hipoteca) para um kind que o cargo lê. E juntar
anexos a um registo exige file.add (`regraDosAnexos`), mesmo quando o anexo
foi carregado solto, sem `?casa=`.

## Confirmar um planeado alheio não é reescrevê-lo
rec.add é «Adicionar e confirmar planeados», e confirmar o planeado do dono
é um put desse planeado (o cliente manda-o inteiro com o next avançado;
silenciar mexe em muted). A exceção em `regraDoRegisto` deixa o put passar,
mas o que se grava passa por `planeadoAGravar`/`fundirPlaneado`
(worker/src/lib/acesso.js e permissoes.js): só `next`, `until` e `muted`
entram do que veio; nome, cadência, montante, imóvel, contrato e fim ficam
como o dono os deixou. Uma reescrita com amount/propertyId/tx trocados não
dá erro — não tem efeito nesses campos —, e um put atrasado sobre um
planeado que o dono já apagou leva 403 em vez de o ressuscitar. Não
«simplificar» para aceitar o put inteiro: a renda do dono passava a 5 €
noutro imóvel e a confirmação seguinte gerava o movimento errado.
O contrário também morde: confirmar um planeado que termina («uma só vez»,
ou o next seguinte passa o `end` — a renda automática do último mês de um
contrato com fim) é apagá-lo no cliente (`recAdvance`), e um del recusado
com 403 era engolido, o pull trazia o planeado de volta «por confirmar» e a
segunda confirmação duplicava o movimento. Por isso o del de um rec alheio
passa com rec.add SÓ quando `planeadoTermina` diz que sim, com a aritmética
de `nextDate` portada em texto (`proximaData`, sem Date nem toISOString: o
worker não sabe o fuso de quem escreveu a data). Sem fim, ou com o fim
ainda longe, continua 403 «Só podes alterar ou apagar o que tu criaste…».

## Patches em ficheiros com UTF-8 no Windows
Aplicar edições por heredoc bash corrompe acentos e emoji. Os patches
escrevem-se num ficheiro .py (UTF-8) e corre-se esse ficheiro — nunca
código com texto acentuado por stdin.
