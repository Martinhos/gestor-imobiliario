# Armadilhas conhecidas

Coisas que já morderam alguém neste projeto. Cada uma custou uma tarde;
ler isto custa cinco minutos.

## O guião do /equipa é um String.raw
Todo o JavaScript do back office vive em worker/src/equipa-guiao.js, num
String.raw, e o worker serve-o tal e qual em `/equipa/guiao.js` (só a quem
tem sessão de equipa): o que se escreve é o que o browser recebe, e uma
quebra ou uma plica escapada escrevem-se como em qualquer JavaScript. Viveu
num template literal normal, em que o servidor cozia o texto antes de o
servir — uma quebra escrita com uma barra só virava uma quebra verdadeira a
meio de uma string, SyntaxError no browser e a página inteira morta em «A
carregar…». Ficam três regras. Nem crases nem `${` lá dentro, que é o que um
String.raw ainda interpreta. Nenhum `on…=` nem `style=` no HTML que o guião
monta: a página vive debaixo da CSP_ESTRITA, sem `'unsafe-inline'`, e o
browser não os corre nem os aplica, sem erro nenhum no servidor. Um clique
escreve-se com `comAcao('nome', [valores])` (o Enter num campo com
`ligarA('enter', …)`, o change com `ligarA('mudar', …)`), que dá
`data-acao="nome"` e os valores em `data-arg`, `data-arg2` e `data-arg3`,
cada um pelo `esc()`; o nome tem de estar na tabela `ACOES`, que é a única
coisa que os três ouvintes do document chamam; e a aparência vai por classes
do CSS_EQUIPA. O equipa-guiao.test.js confere as crases e faz parse do guião
gerado por papel — se rebentar aí, foi isto —, e o csp-paginas.test.js
confere que nem a página nem o guião trazem nada que a CSP recuse. E os
dados da sessão entram no `<script type="application/json">` pelo
`paraScript` da vista, nunca por um JSON.stringify cru: um nome com
`</script>` fechava o bloco.

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
Mudar um secret no GitHub não muda nada no worker: são os passos «Juntar os segredos» e «Publicar o worker e os segredos» do deploy que os gravam,
junto com o código, numa versão só do worker. Depois de corrigir um secret,
corre o deploy do ambiente certo — senão o worker continua com o valor antigo
(foi assim que a validação do endpoint do Discord «falhou» com a chave
certa no GitHub e a errada no worker). E o contrário não acontece sozinho:
o deploy junta os segredos aos que o worker já tem, e um que saia do GitHub
continua no worker até alguém o apagar lá, à mão.

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
ser partilhado. Sem a TESTE_CHAVE (nem o token do bot) num worker, o
ambiente de teste recusa em vez de assinar: o /t/entrar responde 503 com
uma página a dizer o que falta, o /test responde com o aviso, e a rota do
back office também dá 503 — chegou a assinar com uma chave escrita no
código, que qualquer um podia usar. No ambiente de dev, qualquer secret `<NOME>_DEV` tem
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
código com texto acentuado por stdin. E um escape de barra-u para as
quebras U+2028 e U+2029, escrito por uma ferramenta de edição, pode chegar
ao ficheiro como o próprio carácter — invisível, e um fim de linha para
quem o ler. Escreve-se `String.fromCharCode(0x2028, 0x2029)`, como faz o
`paraScript` (equipa-vista.js).

## O pepper das palavras-passe não se muda nem se apaga
Com `PASS_PEPPER` no worker, cada palavra-passe nova entra no PBKDF2 como
HMAC(pepper, palavra-passe) e fica com `pass_v = 2`
(worker/src/auth.js:palavraNova); uma entrada certa com um hash antigo
refaz-se nessa versão. Depois de publicado, o pepper faz parte de todas
essas palavras-passe: mudá-lo ou apagá-lo tranca fora todas as contas com
`pass_v = 2`, sem outro erro que «palavra-passe errada». O do dev é outro
(`PASS_PEPPER_DEV`), e o dev nunca recebe o de produção. E as iterações do
PBKDF2 não sobem: os Workers recusam acima de 100 mil (o comentário do
worker/src/auth.js diz onde isso está escrito).

## A sessão vive no cookie
A app entra e fica entrada pelo cookie HttpOnly que o servidor põe
(worker/src/auth.js:sessionCookie); o token já não vem no corpo das
respostas nem se guarda no aparelho — só fora de produção, e a pedido do
cabeçalho `X-Rendorium-Token: 1`, para os fluxos de teste
(worker/src/auth.js:tokenNoCorpo). Duas consequências. Um browser que
bloqueie os cookies do próprio site deixa de manter a sessão, e não há
alternativa: é o preço de o token não estar ao alcance de um script. E os
aparelhos com a versão anterior ainda mandam Bearer: o servidor tenta o
Bearer e, se já não servir, o cookie, e sair fecha as duas sessões. Não
«simplificar» para só um dos dois enquanto houver aparelhos antigos.

## O selo do estado não pode ser barato
O `GET /api/state` leva um ETag e responde 304 sem corpo a um
`If-None-Match` igual (worker/src/rotas/estado.js). Duas coisas mordem. A
Cloudflare põe `W/` à frente do ETag quando comprime a resposta, e o
`If-None-Match` que volta traz esse `W/` (e pode ser uma lista): compara-se
sem ele. E um selo barato — a data da última escrita, um contador — dava 304
com a resposta diferente, porque o estado depende de nomes e perfis de
outras contas, de serviços que o back office liga e desliga, de cargos e de
convites que expiram com o tempo. Enquanto não houver uma versão por
utilizador subida em todas essas escritas, o selo é o hash da própria
resposta.

## As escritas passam por um sítio só
O REST (rotas/casas.js) e o sync (rotas/sync.js) tinham as mesmas regras de
escrita copiadas linha a linha, e já tinham divergido: o REST não gastava o
travão que o sync gasta. Agora os dois passam por
worker/src/lib/escritas.js:aplicarOp. Uma regra nova de escrita — uma
permissão, um campo que o servidor protege — escreve-se lá, e só lá.

## Num script clássico, só function e var ficam em window
O registo dos serviços guarda NOMES de funções e resolve-os por
`window[nome]` (servicos.js:funcaoDeTopo). Num script clássico só `function`
e `var` de topo ficam em `window`: uma `const` ou uma `let` de topo existe no
âmbito global, mas `window.nome` dá `undefined`. Uma vista registada que
passe a `const x = () =>` deixa de carregar — o separador pinta «não
carregou» (servicos.js:vistaNaoCarregouHtml), e um teste resolve todos os
nomes do registo (testes/correcao-base.test.js).

## Um anexo só abre no browser se for imagem ou PDF
O servidor decide à saída, pelo tipo gravado: só JPEG, PNG, WebP, GIF e PDF
abrem no sítio (worker/src/files.js:TIPOS_NO_SITIO); tudo o resto sai como
`application/octet-stream`, para descarregar, e toda a resposta de um anexo
leva a sua própria CSP, com sandbox (worker/src/lib/http.js:CSP_ANEXO). Não
alargar a lista a `text/html`, `image/svg+xml` nem a outro tipo que corra
código: um anexo é escrito por quem usa e aberto por outros na mesma casa.

## A conta SISTEMA não é uma conta
Os relatos que chegam sem utilizador ficam na conta `SISTEMA`
(worker/src/lib/relatos.js:CONTA_SISTEMA), que nasce apagada: não entra, não
conta no `MAX_USERS` e não recebe correio. Não a «limpar», nem a tratar como
uma conta a sério — os pedidos antigos sem pessoa vivem nela.

## O hash de um script em linha conta os fins de linha
Os dois scripts em linha do web/index.html entram na CSP por `sha256` do texto
exato entre as etiquetas (worker/src/index.js:HASHES_EM_LINHA, e o mesmo no
web/_headers). O texto inclui os fins de linha: o mesmo ficheiro em CRLF dá
outro hash, e com o hash errado o browser recusa o script sem um único erro do
lado do servidor — a armadilha de erros e a cura do arranque deixavam de
correr, que é precisamente quem havia de contar que alguma coisa correu mal.
Calcula-se sempre sobre o texto normalizado a LF, que é como o `.gitattributes`
o guarda e como ele chega a produção; o testes/csp.test.js confere isso e que
os dois sítios têm os mesmos hashes. Mexer num desses scripts — mesmo só um
espaço — obriga a refazer os dois.

E há um hash que não é nosso: o da folha que o botão de entrada com Google
injeta na página. Está lá porque sem ele o browser recusa-a e o botão passa de
72px para 357px de altura. Esse caduca sozinho, no dia em que o Google mudar a
biblioteca — e o sintoma não é um erro, é o botão a crescer. Quem o apanha é o
percurso da interface, que falha em qualquer recusa da CSP que não venha das
conhecidas (testes/ui/percorrer.js:RUIDO_DE_FORA); se ele acusar uma recusa
nova vinda de accounts.google.com, é isto, e o remédio é recalcular o hash a
partir da mensagem da consola, que o traz escrito.

## O `el.style.x = ''` já não desfaz o que agora é uma classe
O que era `style="display:none"` no HTML passou a uma classe utilitária
(estilos.css:.u-d-none e as vizinhas). A diferença que morde: `el.style.display
= ''` apaga um estilo em linha, mas NÃO apaga uma classe — o elemento fica
escondido para sempre, sem erro nenhum. Sempre que o JavaScript escreve e
repõe uma propriedade num elemento, essa propriedade não pode vir de um
utilitário: ou o par passa todo a `classList` (movimento.js:amtResetSync é o
exemplo), ou o estado inicial passa a uma regra que o `el.style` continue a
vencer — foi o que se fez aos dois botões do cabeçalho, que nascem vazios e se
escondem por `:empty` (estilos.css:#hdrBell, index.html:#hdrBell). Antes de pôr
um utilitário num elemento, procura-se quem lhe escreve no `.style`.

## Um predicado em texto no Playwright é um eval
`page.evaluate('…')` e `page.waitForFunction('…')` com TEXTO são avaliados
dentro da página, e a CSP nunca teve `'unsafe-eval'`: dá um `EvalError` e o
percurso morre onde calhar — ora no arranque, ora a meio, o que parecia
intermitência. Passa-se sempre uma FUNÇÃO, que o Playwright entrega pelo
protocolo e corre sem eval nenhum, com os valores a ir por argumento e não
interpolados no texto (testes/ui/percorrer.js, o `fazer` de cada cena e o
testes/ui/invariantes.js:dentroDaPagina). O preço é que os nomes da app que essas funções
chamam passam a ser código de verdade para o ESLint: entram na lista do
eslint.config.mjs:NA_PAGINA, senão o `no-undef` acusa-os.

## Um elemento fora do documento não responde a um clique por código
Os eventos declarados ligam-se preguiçosamente, por um ouvinte de captura no
`window` (web/app/eventos.js): quando o evento passa, cada elemento do caminho
que tenha o atributo ganha o seu ouvinte. Um elemento que ainda não está no
documento — acabado de criar com `innerHTML`, antes de ser inserido — não tem
caminho até ao `window`, e um `el.click()` feito por código não corre a ação.
Com um `on…=` corria. Insere-se o elemento primeiro, ou chama-se a função
diretamente. O mesmo vale para a outra diferença: no MESMO elemento, um
`addEventListener` que a app ponha antes do primeiro evento corre ANTES da
ação, e não depois.

## O wrangler dev e as migrações na mesma pasta
Com o `wrangler dev` de pé, um `wrangler d1 migrations apply … --persist-to`
sobre a mesma pasta de estado mata o servidor (SQLITE_IOERR_TRUNCATE); o
`d1 execute` não. Pára-se o servidor, migra-se, e volta-se a levantar. E um
`wrangler dev` em fundo com a saída num pipe (`| head`) morre calado quando
o pipe fecha.
