# Diário de decisões

O que se decidiu, o que partiu e o que se aprendeu, com a data. As regras que
saíram daqui vivem no docs/design.md, escritas no presente e sem história; o
porquê comprido, as medições, os post-mortems e as correções de correções
ficam aqui, por ordem de data. Uma entrada não se reescreve quando deixa de
ser verdade: acrescenta-se uma nota com a data, ou uma entrada nova — e a
regra muda no design.md.

Como no design.md, as citações são ficheiro:símbolo, e o testes/docs.test.js
confere que cada uma aponta para código que existe.

Índice:

- 2026-09-08 · As formas dos gráficos deixam de ser paragens do Tab
- 2026-09-09 · O que aparece tarde, e o que não devia aparecer já
- 2026-09-09 · «Não tens nada» e «ainda não sabemos» são coisas diferentes
- 2026-09-09 · Os dados de exemplo, só onde fazem sentido
- 2026-09-09 · E o que a app FAZ antes de saber
- 2026-09-09 · A caixa de quem sai é a mesma caixa
- 2026-09-09 · A fita arranca do sítio
- 2026-09-09 · Não há planos
- 2026-09-09 · Ver a montra antes de a publicar
- 2026-09-09 · Um carregamento não pode misturar versões
- 2026-09-09 · A mesma consequência apanhou o dev — só produção guarda
- 2026-09-10 · «Quem manda na altura de trocar é a app» — só que a app não tinha como
- 2026-09-10 · A cache guardava coisas que não são a app
- 2026-09-10 · A cura não pode curar offline
- 2026-09-10 · Publicar sem subir a versão é publicar para meio de um carregamento
- 2026-09-10 · O ecrã que tranca a app não trancava nada
- 2026-09-10 · As ferramentas, e o que ficou de fora
- 2026-09-12 · A chave da navegação partiu produção
- 2026-09-13 · O addDays deixa de recuar um dia no verão
- 2026-09-15 · A avaliação de 2026-09-14, e o que ela mudou nas regras
- 2026-09-15 · A CSP sem «unsafe-inline»: os eventos e os estilos saem do HTML
- 2026-09-24 · O repositório passou a público
- 2026-09-24 · A app de dev instala-se ao lado da de produção

## 2026-09-08 · As formas dos gráficos deixam de ser paragens do Tab
A lista das dívidas tinha como «média» uma coisa que se via a usar o teclado:
cada barra e cada arco de cada gráfico era uma paragem do Tab anunciada como
botão — catorze das trinta e nove na visão geral —, porque o tornarFocavel
(vistas.js:tornarFocavel) dá tabindex e role=button a tudo o que tem onclick,
e cada forma tinha um para abrir o balão da dica.

Fechou-se no gráfico e não no tornarFocavel: o balão saiu de vez (a legenda e
as linhas já diziam o que ele repetia), as barras, as linhas e as barras
horizontais deixaram de ter onclick, e o gráfico ganhou uma descrição só
(graficos.js:descricaoDoGrafico). Medido: de 37 formas alcançáveis pelo Tab
para zero. A regra está em «Um gráfico lê-se com o dedo», no design.md.

A entrada ficou na lista das dívidas até 2026-09-15, a citar como caminho da
dica um ajudante que já ninguém chamava (o hit do graficos.js, apagado nesse
dia). Na lista ficou só o que resta dela: as fatias do donut e os itens da
legenda, que têm toque a sério — entrar na categoria.

## 2026-09-09 · O que aparece tarde, e o que não devia aparecer já
Ao abrir a visão geral havia cerca de um segundo em que o ecrã dizia duas
coisas erradas.

**O sino anunciava um número que ainda não sabia.** A conta sai em parte do
que está guardado no aparelho e em parte do que o servidor manda
(notificacoes.js:notifConta). Ao abrir, a app pinta com o que tem em casa — e
se esses planeados já foram confirmados noutro lado, o sino anuncia um atraso
que já não existe, e corrige-se um segundo depois. Um número errado durante
um segundo é pior do que nenhum, pela mesma razão que o selo de sincronização
tem três estados: o silêncio era ambíguo.

A primeira tentativa fez o crachá esperar pelo `CW._pulled` («já falámos com o
servidor»), e não chegou: **a raiz não era o sino**. Está em arranque.js, antes
de haver servidor nenhum. A app corre o `syncAllContractRecs` sobre o que está
guardado no aparelho e decide dali o que falta confirmar; se essa renda já foi
confirmada noutro lado, o aparelho ainda não sabe. Nasce um «por confirmar» que
não existe — e **três sítios** o afirmavam: o crachá do sino, o cartão dos
movimentos por confirmar (planeados.js:pendingCard) e o aviso dos 600 ms do
arranque. Um segundo depois o estado chega, o `render` refaz tudo, e as três
coisas desaparecem à frente de quem estava a olhar.

O trabalho do arranque fica: é preciso, e o pull corrige-o. O que passa a
esperar é o que a app **afirma**, pela mesma regra nos três sítios
(espera.js:sabemosOEstado). O aviso do arranque, além de esperar, só conta
as rendas nessa altura — contá-las antes era guardar o número errado.

**E a espera tem de acabar.** Medir «o servidor já falou» era o erro seguinte:
sem rede isso nunca acontece, e o sino ficava calado *para sempre* num aparelho
offline — trocar um erro de um segundo por um silêncio permanente é mau
negócio. Acaba em três alturas (nucleo.js:fimDaEspera): o servidor falou, o
pedido falhou, ou já passaram seis segundos e a rede ficou pendurada. Nas duas
últimas o que está no aparelho é tudo o que há, e diz-se.

O `CW._pulled` fica como está, e distinto: a página dos cargos precisa dele
para não confundir «não tens colaboradores» com «ainda não sabemos», e aí a
resposta certa é dizer que se está à espera — coisa que um crachá não sabe
fazer. Numa app sem nuvem, ou sem sessão iniciada, não há espera nenhuma.

### E o guarda não valia na pintura que interessa

A primeira versão do guarda perguntava «há `window.CW`?». O `app/arranque.js`
corre **antes** do `cloud/nucleo.js` (é a ordem do index.html), e na primeira
pintura — a única que se vê antes de o servidor falar — o `CW` ainda não
existe. O guarda respondia «não há nuvem, diz tudo» exatamente no instante em
que devia calar-se, e o sintoma continuava lá, intacto.

A pergunta certa não é «a nuvem já carregou?», é **«há sessão?»** — e isso
sabe-se do aparelho, sem depender de ordem nenhuma: a sessão está no
localStorage muito antes de a nuvem a ler (espera.js:haSessao). A chave
passou a viver em dados.js, com o resto do armazenamento, e o cloud/nucleo.js
usa a mesma — duas verdades sobre onde está a sessão seria pior do que o
problema.

Pelo caminho, mais dois do mesmo: o crachá dos «Planeados» no menu e na barra
de baixo contava a mesma lista velha (navegacao.js:buildNav), e o tecto de seis
segundos estava armado dentro do `startSync`, que só corre depois de o
`GET /api/me` responder — com esse pedido pendurado, o tecto nunca chegava a
existir. Passa a armar-se onde a sessão se lê, que é onde se sabe que há por
que esperar.

## 2026-09-09 · «Não tens nada» e «ainda não sabemos» são coisas diferentes
A base local vive numa chave só — `gi_v13` (dados.js) —, e não uma por conta.
Terminar sessão não a limpa, e por isso o `finishLogin` tem de a apagar quando
quem entra é outra pessoa (entrada.js): a alternativa era mostrar os imóveis de
um a outro. Está certo.

O que estava errado era o que vinha a seguir. A app pintava essa base vazia e
afirmava **«Ainda não há nada registado»** a quem tem doze imóveis, com um
botão de **«Carregar exemplo»** ao lado — e o `seed()` não acrescenta:
substitui a base inteira e acaba em `save()`, que a nuvem embrulha para agendar
um envio (nucleo.js). A frase era falsa e o botão era uma armadilha.

E não é «uma vez por aparelho», como cheguei a dizer: é em **todos os logins**
de quem partilha o aparelho com outra conta, mais a navegação privada, o
armazenamento limpo pelo browser, a app reinstalada, e todos os arranques num
aparelho onde o armazenamento está cheio ou vedado.

Nove ecrãs afirmavam o vazio: a visão geral, os imóveis, os contratos, os
inquilinos, os proprietários, os movimentos, as visitas, os créditos e a
avaliação. Passam todos pelo `esperaDoServidor()` (espera.js), que só fala
quando não se sabe **mesmo** nada — sessão à espera do primeiro estado e base
local inteiramente vazia. Quem tem dados cá nunca o vê; uma conta nova vê-o um
instante antes do «ainda não há nada registado» verdadeiro. Duas frases certas,
em vez de uma errada.

É o molde que a página dos cargos já usava (partilha.js), e pela mesma razão:
dizer «não tens» a quem tem parece perda de dados.

Junto com isto, o `finishLogin` passou a limpar o `CW.state`: ele não está
guardado no aparelho, mas sobrevivia a uma troca de conta na mesma página, e
quem entrava a seguir via os cargos, os colaboradores e as ligações de quem
saiu até o primeiro estado chegar.

## 2026-09-09 · Os dados de exemplo, só onde fazem sentido
Em produção não se carregam dados de exemplo: quem chega à app a sério deve
encontrá-la vazia e ser levado pelos primeiros passos. O ambiente vem do
servidor (`/api/auth/config` devolve `env.ENV_NAME` ou `'producao'`), e até a
resposta chegar vale `'producao'` — o lado seguro.

O que mudou foi **onde** se decide. O botão chegou a ser apagado do DOM depois
de cada `render`, e isso tinha um furo: a pesquisa das listas repinta pela via
parcial (vistas.js:refrescarListasVivas), que não passa pelo `render`, e por lá
o botão voltava — bastava escrever uma letra na pesquisa dos imóveis. Agora
pergunta-se **antes de escrever** (espera.js:podeExemplo). Perguntar antes
de escrever não tem furos; o embrulho do `seed` fica como fecho, para o caso de
alguém lá chegar por outro caminho.

**A variação do ano anterior chegava tarde.** Estava à espera de tempo morto —
`requestIdleCallback` com 400 ms de tecto — e num arranque cheio o tempo morto
não chega. Passa para o **quadro seguinte**: não bloqueia a primeira pintura e
ninguém vê a espera. Num separador escondido o quadro nunca corre, e aí
pinta-se já: não há pintura nenhuma para atrasar e ninguém está a ver.

**E o ano não cabia.** A silhueta, a percentagem e o «2025: 8 100 €» numa
linha de 22px: o terceiro era o último a caber e o primeiro a ser cortado
pelas reticências — desaparecia, e sem ele a percentagem não diz de que
números fala (é o mesmo princípio do «face a»). Passa para a linha de baixo, e
o cartão cresce com ele (estilos.css:.kserie). A altura continua **dada**, e
não a do conteúdo: a caixa nasce vazia e é enchida depois, e sem uma altura
fixa tudo o que está por baixo saltava quando a variação aparecesse.

Medido depois, em 375px: a caixa com 38px, a silhueta e a percentagem em cima,
o ano e o valor em baixo, nada cortado. E em cinco separadores, entre os 30ms
e os 1230ms depois de pintar, mais nada muda — o único movimento tardio que
resta é a contagem dos números, que é deliberada.

## 2026-09-09 · E o que a app FAZ antes de saber
Calar o que a app afirma resolveu metade. A outra metade é o que ela **faz** a
partir do mesmo estado pré-pull — e aí três coisas eram irreversíveis. Vieram
todas de uma auditoria em paralelo, com cada achado posto à prova por dois
céticos; sete sobreviveram, de dezasseis levantados.

**O push apagava por diferença.** O retrato do servidor (`snap`) é por
utilizador e **não** se apaga ao sair; o db é apagado no `finishLogin` quando
quem entra é outra conta. Base vazia mais retrato cheio lê-se como «apagou
tudo», e o `pushNow` gerava um `del` para cada chave. Bastava um `save()` na
janela entre entrar e o estado chegar — o `notifPartilha` grava a marca de
leitura logo na primeira contagem — para o envio partir. As remoções por
diferença passam a esperar pelo primeiro estado (nucleo.js:pushNow); os `put`
seguem, porque acrescentar não destrói nada. E o `finishLogin` larga também o
retrato: sem retrato não há sequer diferença para ler.

**Arrumar a despensa chegava à nuvem.** O `cleanFiles` decide o que é órfão a
partir do db, e no arranque o db é o que está no aparelho. Pior: o `idbDel`
está embrulhado pela nuvem para mandar um `DELETE /api/files/:id`, porque
«apagar o anexo» é apagá-lo em todo o lado. Uma arrumação local podia assim
destruir no servidor fotos, PDF de contratos e documentos de hipotecas que este
aparelho ainda não sabia que existiam. Separaram-se as duas operações: o
`idbDelLocal` deita fora o blob **daqui**, e é esse que a limpeza usa; e a
limpeza espera por saber antes de decidir o que é lixo.

**Os lembretes do telemóvel ficavam com a versão velha.** São agendados no
arranque, e o `applyState` grava com `rawSet` — que não passa pelo `save()`,
onde o `scheduleReminders` vive. Uma renda confirmada no computador continuava
a tocar no telemóvel no dia certo. Passa a reagendar-se a seguir ao db novo.

**E o arranque derivava às escuras.** O `syncAllContractRecs` e o
`syncAllLoanRecs` não são leituras: escrevem em `db.recurring`. Criam a renda
planeada, movem o cursor — e **apagam**: as duas deitam fora as recorrências
automáticas cujo contrato ou cuja hipoteca já não aparecem no db. No arranque o
db é o que está neste aparelho, e aí «já não aparece» quer muitas vezes dizer
«ainda não sei que existe»: o estado do servidor não chegou, ou chegou sem os
movimentos de um imóvel onde o cargo não abre as finanças. O `save()` a seguir
gravava isso no disco e agendava um envio — e um colaborador com `rec.add`
pode gravar o `next` de um planeado alheio, portanto a decisão tomada às
escuras subia.

Chegou a pôr-se a hipótese de a app ficar **só de leitura sem rede**. Não é a
regra certa, por três razões. Não é o problema: a escrita é automática, não é
de ninguém, e acontece com rede e sem rede. O `navigator.onLine` mente
exatamente no caso que interessa — wifi de hotel com portal cativo, TCP aceite,
resposta que nunca chega. E o `web/sw.js` promete o contrário logo na primeira
linha: «a app abre offline (a API sincroniza quando voltar a rede)» — é offline
que mais se precisa de escrever, na cave do prédio ou no imóvel sem cobertura.

O estado em que a app não deve **decidir** não é «sem rede»: é «antes de
saber». As derivações passam para o `derivarDoArranque` (arranque.js), atrás do
mesmo guarda. E adiar não custa nada offline, porque a espera tem tecto: sem
rede o pedido falha depressa e a espera acaba logo; no pior caso são seis
segundos; sem sessão nenhuma, corre na mesma linha.

E dois ecrãs continuavam a afirmar o que o sino já calava: o cartão dos
**Prazos** (um aviso silenciado noutro aparelho reaparecia, com selo vermelho)
e o `decoratePending`, que escreve «1 movimento por confirmar» nos cartões dos
contratos. Este último era o pior de todos: tinha lá o botão **Confirmar**, e
confirmar um fantasma criava a renda em duplicado — o `rendaJaLancada` não via
o movimento verdadeiro, porque ele ainda não tinha chegado.

## 2026-09-09 · A caixa de quem sai é a mesma caixa
A fita dos separadores saltava antes de deslizar: o ecrã dava um pulo, parecia
assentar um pouco mais abaixo, e só depois começava a correr para o lado.

Medido no browser, no instante zero da travessia: um cartão que estava em
y=282 aparecia em y=252, 15px mais à esquerda e 30px mais largo. A causa é o
`velho` — a caixa para onde os filhos do `#view` são mudados enquanto ele
repinta. Era um `<div>` pelado, e o `#view` tem a classe `.wrap`, que é quem
lhe dá o espaçamento lateral. Sem ela o conteúdo estica-se de encosto a
encosto, as linhas voltam a partir noutro sítio, os blocos encurtam, e tudo o
que está em baixo sobe. O olho lê isso como um salto — e o deslize, que só
começa no quadro seguinte, aparece depois dele.

A classe vai copiada do próprio `#view`, e não escrita à mão: se um dia o
`.wrap` mudar de nome ou ganhar companhia, isto acompanha. Menos o `.entra` —
essa é a que manda os gráficos desenharem-se de novo, e quem está a sair não
volta a entrar em cena. A largura leva `box-sizing:border-box`, senão o
espaçamento reposto empurrava o conteúdo para fora da medida que foi tirada.

Depois da correção, o mesmo cartão fica em y=282, x=15, com 345px — salto zero
nos três eixos.

## 2026-09-09 · A fita arranca do sítio
Corrigido o salto, ficava o arranque: a travessia entrava a andar, sem
aceleração nenhuma.

As duas fitas — a dos separadores (`deslizarPainel`) e a das listas
(`correrAFita`) — usavam a `--curva-entra`, que é a curva de quem **chega**:
sai à velocidade máxima e vai abrandando. Num elemento que aparece, está
certo. Numa fita que estava parada, não. Medido no browser, na mesma animação,
com uma curva e com a outra:

| tempo | `--curva-entra` | `--curva-fita` |
|---|---|---|
| 17 ms | **17%** do caminho | 1% |
| 34 ms | **30%** | 3% |
| 68 ms | 50% | 13% |
| 102 ms | 64% | 37% |

Trinta por cento do percurso em dois fotogramas: é isso que se lê como um
empurrão.

A curva nova sai das duas que já existiam — o arranque da `--curva-sai`
(`.4,0`) com a chegada da `--curva-entra` (`.2,1`) —, o que lhe dá velocidade
zero à partida **e** à chegada. E é **uma só** para os dois painéis de
propósito: eles viajam agarrados, e curvas diferentes abriam uma fenda entre
eles a meio do caminho.

O `aplicarContinuidade` fica com a `--curva-entra`: as peças soltas que se
acompanham entre repinturas estão mesmo a chegar a um sítio, e para essas a
curva de chegada é a certa.

## 2026-09-09 · Não há planos
Havia três escalões — `free` (3 imóveis, sem contratos nem planeados), `plus`
(10) e `pro` (sem limite) —, um interruptor no back office que marcava a data
em que passavam a valer, e um aviso de 30 dias que os Termos prometiam. Estava
tudo escrito e suspenso pelo modo de demonstração.

A intenção mudou: é um projeto pessoal, e a utilização é gratuita sem escalões
nem limites. Saiu tudo.

**A remoção espalhou-se por quinze ficheiros**, e a ordem importava: o módulo
dos planos era importado estaticamente por `lib/acesso.js`, `rotas/casas.js` e
`rotas/sync.js`, portanto apagá-lo primeiro rebentava o arranque do worker. Primeiro o back office, depois os chamadores e o cliente, e só no fim o
ficheiro.

Três coisas que valem a regra, e que um levantamento cuidadoso apanhou antes de
partirem alguma coisa:

**A coluna `users.plan` não se apaga.** A D1 não tem `DROP COLUMN` reversível, e
o `restaurar.js` constrói o `INSERT` com as colunas do despejo — uma coluna a
menos partia a reposição de qualquer cópia tirada antes disto. Deixa de se ler,
que custa zero e mantém a porta aberta.

**O 403 fica.** O ramo do 402 vivia colado ao do 403 na mesma cadeia de
`else-if`, e o do 403 é o que diz a quem escreve num imóvel de colaboração sem
permissão que o registo não subiu. Levá-lo à frente devolvia o bug que o
comentário do `recusaRegisto` diz ter sido corrigido.

**O `lib/limites.js` não é dos planos.** Estava arrumado no mesmo capítulo da
documentação, mas é o travão contra força bruta. O capítulo passou a chamar-se
o que é.

E os Termos deixaram de prometer o que já não existe: a §3 perdeu a suspensão
dos limites e o aviso dos 30 dias, e a §6 passou de «Utilização gratuita e
limites» a «Utilização gratuita», com os três marcadores substituídos pela
única frase que continua verdadeira.

## 2026-09-09 · Ver a montra antes de a publicar
A página de entrada só era servida no domínio raiz, portanto a única maneira de
a ver era **publicá-la**: o `dev.rendorium.com` servia a app, e o servidor local
também. Quem lhe mexesse escrevia às cegas.

Passa a haver **`/montra`** em qualquer endereço. Em produção é um atalho
inofensivo para o que já está em «/»; fora dela é a única porta, porque a raiz
do dev tem de continuar a ser a app — é para isso que esse ambiente serve. Os
documentos legais respondem em todo o lado pela mesma razão, e não colidem com
nada: a app é uma página só, sem rotas.

Fora do domínio raiz as duas páginas levam `noindex` e não declaram `canonical`
nem `og`. Duas cópias da mesma página indexadas são uma a competir com a outra,
e um `og` que aponta para produção a partir do dev mente a quem partilhar a
ligação. Nos documentos, o «início» aponta para `/montra` em vez de «/» — ali a
raiz é a app.

Chegou a pôr-se a hipótese de um comando do Discord para isto. Não é a forma
certa: o problema não era faltar um atalho, era não haver **para onde apontar**.
Os comandos do bot existem para o que precisa de identidade ou de estado — uma
sessão de teste com um token por pessoa; uma página pública é um endereço, e um
endereço que nunca muda é um favorito.

## 2026-09-09 · Um carregamento não pode misturar versões
A v31 chegou a produção e a app **não arrancava**: `ReferenceError` em cadeia —
`LS_SESSAO`, `CW`, `ic`, `go`, `idbPut` — e um ecrã em branco.

A prova de que era mistura de versões está numa linha só. O
`LS_SESSAO is not defined` em `cloud/nucleo.js:4` só é possível com o
`nucleo.js` da **v31** (a única versão com `var LS_USER = LS_SESSAO`) e o
`dados.js` da **v30** (a única sem a constante) — no mesmo carregamento.

Duas causas, ambas no service worker:

**O `skipWaiting()`.** O worker novo assumia o controlo a meio do
carregamento: os primeiros `<script>` vinham do worker antigo, servidos da
cache da versão anterior; os seguintes do novo. Como os endereços dos
ficheiros não levam versão no nome, nada detetava a troca. É o motivo pelo
qual não se chama `skipWaiting()` sem ficheiros versionados no endereço.

**O `caches.match(pedido)` sem `cacheName`.** Procura em *todas* as caches. Um
`fetch` que falhasse era respondido com o ficheiro da versão anterior, em
silêncio, enquanto os irmãos vinham da rede já com a nova.

O worker passa a servir tudo da **mesma cache**, cheia de uma vez no
`install`, e o worker novo **espera**. Quem manda na altura de trocar é a app,
que já tinha esse caminho: o `verificarVersao` lê o `/versao.json`, limpa as
caches e recarrega uma vez, à vista.

> Este último parágrafo estava errado quando se escreveu, e ficou assim uma
> semana: a app não tinha canal nenhum para mandar o worker trocar, e a versão
> nova chegava por um efeito lateral. Está corrigido mais abaixo, em «Quem manda
> na altura de trocar é a app — só que a app não tinha como».

### E quem já estava partido não se curava sozinho

Esta é a metade que importa mais. Um arranque que falha assim é um ecrã em
branco — e o código que sabe atualizar a app é precisamente o que não chegou a
carregar. Sem mais nada, essas pessoas ficavam presas até fecharem tudo.

Por isso o `index.html` ganhou uma rede de segurança **inline e antes de todos
os `<script>`**, que não depende de ficheiro nenhum: um `<script>` que não
carrega, ou um símbolo que devia existir e não existe, limpam o que está
guardado, largam o service worker e recarregam. Uma vez por sessão — uma
recarga que não resolve não se repete.

Testado como se testa uma cura: envenenou-se a cache com um `dados.js` sem a
constante, reproduzindo a avaria exata de produção. A rede apanhou-a, limpou,
recarregou, e a app arrancou.

Uma consequência a registar: com cache primeiro, um servidor local serviria
ficheiros velhos até a versão mudar. O service worker deixa de se registar em
`localhost` — localhost não é uma publicação.

## 2026-09-09 · A mesma consequência apanhou o dev — só produção guarda
Ficou escrito aqui que o dev mantinha a cache «que é onde as travessias entre
versões a sério se exercitam». **O raciocínio estava errado**, e custou um dia
de trabalho invisível: as travessias acontecem quando a VERSÃO muda, e no dev
ela não muda — publica-se dezenas de vezes com a mesma. A cache chama-se pela
versão, portanto nunca rodava, e o ambiente congelava no primeiro carregamento
dessa versão. Publicava-se, atualizava-se a página, e não acontecia nada: a
cache respondia antes da rede.

Agora só produção guarda. Fora dela o worker existe — o PWA instala-se, o
manifesto vale — mas deixa passar tudo à rede: sempre fresco, e sem poder
misturar versões porque não guarda nenhuma. O caminho da cache exercita-se onde
importa, que é onde há utilizadores e onde a versão sobe a cada publicação.

E a regra diz quem **não** é produção, não quem é. Esteve ao contrário —
`hostname === 'app.rendorium.com'` — e uma auditoria antes de promover apanhou
o que isso deixava de fora: o `wrangler.toml` liga o `workers.dev` **à mão**,
com o comentário de que as instalações antigas (PWA e APK) apontam para lá e
não podem partir. Essas pessoas estão em produção, e a regra tratava-as como se
não estivessem: perderiam o offline, em silêncio.

Os ambientes que **não** são produção sabem-se todos — o localhost, o
`dev.rendorium.com` e o endereço do worker de dev. Os de produção, não: há os
de hoje e os que ficaram de ontem. Por isso a lista é a dos primeiros. E o
teste passou a correr a regra em vez de fixar o literal, porque fixar o literal
foi precisamente o que não apanhou a omissão.

E a transição desenrasca-se sozinha: fora de produção o worker novo assume já
(`skipWaiting`, seguro aqui porque não há cache a proteger) e apaga **todas** as
caches no `activate`. Quem ficou preso numa publicação anterior sai na primeira
navegação, sem ter de limpar nada à mão. Medido: duas caches com ficheiros
envenenados, uma navegação, e ficam zero.

## 2026-09-10 · «Quem manda na altura de trocar é a app» — só que a app não tinha como
Ficou escrito aqui, e no `web/sw.js`, que tirar o `skipWaiting()` era seguro
porque a app decidia a troca. **Metade disso não existia.** Uma auditoria
adversarial ao caminho inteiro — seis levantamentos independentes, cada achado
entregue a um cético com o ónus de o derrubar — foi buscar a frase ao código e
não a encontrou: em todo o `web/` não havia um `postMessage`, um
`registration.waiting`, um `controllerchange` nem um ouvinte de `message` no
worker. As únicas chamadas ao service worker eram registar, `update()` e
`unregister()`.

E o passo que faltava não é acessório: **um `location.reload()` não promove um
worker em espera.** O documento antigo e o novo sobrepõem-se, o registo nunca
fica sem clientes, e o passo de ativação não corre — é a razão de existir do
`skipWaiting` e do «Update on reload» das ferramentas do browser.

O que a app fazia era outra coisa, por efeito lateral: apagava **todas** as
caches e recarregava. Como o worker antigo continuava a mandar e a cache dele
tinha desaparecido, tudo ia à rede, e da rede vinha a versão nova. Funcionava,
e trazia três consequências que ninguém tinha visto:

- a cache que se apagava incluía a que o worker em espera **acabara de encher**
  no `install` dele — a versão nova inteira, gravada de uma vez. O `install`
  corre uma só vez por worker, e um `caches.open` sobre um nome apagado devolve
  uma cache nova e vazia, sem se queixar;
- o worker antigo recriava a cache com o nome da versão **antiga** e enchia-a
  ficheiro a ficheiro com o que a rede desse, que já era a versão nova. A
  atomicidade do `addAll` — a invariante que resolveu a v31 — deixava de valer
  para lá do primeiro carregamento;
- e o botão «Atualizar» destruía a única cópia local **antes** de saber se havia
  substituta. Sem rede, quem lhe carregasse ficava sem app. O ecrã que tranca a
  app por a versão ser velha demais leva a esse botão, e não a mais nenhum.

Agora pede-se. O worker atende um `{tipo:'assumir'}` e só nessa mensagem chama
`skipWaiting()`. A diferença para o que partiu a v31 é toda: aquele acontecia a
meio de um carregamento; este só acontece depois de a app já ter decidido
recarregar, portanto não há carregamento nenhum para partir.

E a troca vale mais do que evitar o estrago. Um worker que chega a «em espera» é
a **prova** de que a versão nova está inteira em disco, porque o `install` dele é
um `addAll`, que só termina com todos os ficheiros lá dentro. Trocar por ali é
arrancar de uma cache construída de uma vez — que era, desde o início, a razão de
o desenho ser este.

O machado fica, porque continua a ser preciso: quando não há worker em espera, é
ele que faz a versão nova chegar a um separador que ficou aberto. Mas passa a
poupar a cache da versão para onde se vai, deixa de ficar pendurado num `update()`
sem tecto, e no botão só corre depois de o servidor responder — com uma sonda
curta, porque uma rede que fica à espera não é uma rede. E o `activate` de
qualquer worker que ative com a cache vazia volta a enchê-la, de uma vez.

Uma nota sobre o registo: passou a `updateViaCache: 'none'`. O valor por omissão
é `'imports'`, e o `sw.js` é igual entre versões de propósito — o que muda é o
`/avisos.js` que ele importa. Detetar a versão nova ficava a depender dos
cabeçalhos de cache de um ficheiro.

## 2026-09-10 · A cache guardava coisas que não são a app
A mesma auditoria trouxe um segundo grupo de achados, todos com a mesma raiz: a
regra do `fetch` era uma **lista de exclusões** — guardava-se tudo o que não
fosse `/api/`, `/versao.json` ou de outro método. O que passa por lá é mais do
que parece, porque o Cache API **não lê `Cache-Control` nenhum**: um
`no-store` do servidor não impede nada.

O caso que dói: o back office `/equipa` responde no mesmo endereço da app e está
dentro do âmbito do worker. A página do já autenticado sai com 200 e ia para a
cache **com a sessão da equipa lá dentro**, para depois ser servida do disco sem
o servidor ser consultado — e, quando a sessão expirasse, um ciclo de recargas.
Ironicamente a página do não autenticado escapava por acaso, porque sai com 401.
Pelo mesmo caminho entravam o `/termos`, o `/privacidade`, a montra e o APK, e
nada tinha tecto: a cache crescia até a quota estoirar, que é exatamente onde o
`install` do worker seguinte deixa de caber.

Agora é uma **lista de permissão**: `SHELL.indexOf(url.pathname) < 0` e sai. A
cache tem o tamanho que o `install` lhe deu e mais nada. Acrescentou-se também
uma verificação de origem, que faltava — o filtro era só por caminho.

E há um segundo defeito, este independente de tudo o resto e sem precisar de
worker nenhum a trocar. O `Cache.match` compara o **URL inteiro, query
incluída**, e a `SHELL` só tem `/` e `/index.html`. Qualquer aterragem com
parâmetros — e são as ligações que o produto envia por email: `?entrar=`,
`?repor=`, `?convite=`, `?ligar=`, `?criar=1` — falhava **sempre** na cache e ia
buscar o `index.html` à rede, enquanto os `<script src>` que ele referencia,
sendo caminhos sem query, acertavam na cache da versão antiga. Metade de cada
versão na mesma página: a avaria da v31, por uma porta que ninguém tinha olhado.
Bastava uma cache coerente e uma publicação pelo meio.

A chave de uma navegação passa a ser sempre `/index.html`, seja qual for o
endereço que a pessoa clicou. De caminho, deixam de ficar gravados em disco, como
chaves de cache, endereços que levam segredos lá dentro — o contrário do que o
resto do código faz de propósito (o `history.replaceState` que tira o token da
barra, o `mascararTokens` dos relatos, o `Referrer-Policy: no-referrer`).

> Nota de 2026-09-12: esta chave partiu produção. O `/index.html` redireciona
> para «/», e o browser recusa a resposta guardada numa navegação; a chave
> passou a ser o «/» — ver «2026-09-12 · A chave da navegação partiu produção».

Dois pormenores da mesma leva: guarda-se só `status === 200` (o `res.ok` abrange
o 206, e uma resposta parcial guardada é uma resposta partida), e o falhanço do
`put` passa a ser apanhado — ele comunica-o devolvendo uma promessa rejeitada, e
o `try/catch` que lá estava não apanhava nada.

### Dois hostnames que caíam do lado errado

O `run_worker_first = ["/"]` faz com que só a raiz passe pelo worker: o
`rendorium.com/index.html` e os `/app/*.js` são servidos direto dos ficheiros, e
o redirecionamento para o `app.rendorium.com` nunca chega a correr para esses
caminhos. Ou seja, **a app existe no domínio da montra** — e o domínio da montra
não estava no `SEM_CACHE`. Um service worker com âmbito `/` acabaria a servir a
montra da cache da app. Agora o apex e o `www` não guardam, e a app nem sequer
regista lá o worker.

O outro é o `hn.indexOf('gestor-imobiliario-dev.') !== 0`. Os endereços de
pré-visualização de versão do Cloudflare levam o nome do worker **a seguir a um
prefixo** (`<versão>-gestor-imobiliario-dev.…`), portanto o `indexOf` devolvia 9
e eles caíam do lado de produção. Testa-se o nome como rótulo, e o teste corre a
regra com os três casos — o endereço normal do dev, o de pré-visualização, e o
de produção, que tem de continuar a guardar.

### A lista SHELL, amarrada nos dois sentidos

O CI já confirmava um dos sentidos, e só para os módulos: cada `web/app/*.js` e
`web/cloud/*.js` tem de aparecer no `index.html` **e** no `sw.js`. Faltava o
resto — o `avisos.js`, o `legal.js`, o manifesto, os ícones — e faltava o sentido
contrário: uma entrada na `SHELL` que não corresponda a ficheiro nenhum rebenta
o `addAll` **inteiro**, porque o `addAll` é tudo ou nada, e a cache fica vazia.
Agora que a `SHELL` é também a lista de permissão do `fetch`, uma omissão passou
a tirar um ficheiro da cache em silêncio — razão a mais para a prender.

## 2026-09-10 · A cura não pode curar offline
A rede de segurança do arranque é a ação mais destrutiva que a app tem: apaga
**todas** as caches e faz `unregister` de **todos** os service workers. Fazia-o
sem perguntar se havia rede — e sem rede o que está guardado é a única cópia da
app que existe. O que era «meia app partida» passava a «nenhuma app», sem volta
enquanto a rede não voltasse. Os dois guardas que lá estavam não travavam nada:
o `readyState` ainda é `loading`, porque os `<script>` estão no fim do `body`.

Agora sai à porta com `navigator.onLine === false`, **antes de marcar seja o que
for** — sair sem gastar a tentativa é o que deixa a cura disponível para quando
houver rede. Só o `=== false` é de confiança: o `onLine` a `true` mente com
frequência (portal cativo, wifi sem rota), por isso ele trava mas não autoriza.

E a marca passa a guardar **quando** se curou, não só **que** se curou. O
comentário dizia «uma vez por sessão», mas numa app instalada a sessão não é uma
visita: o `sessionStorage` sobrevive a recargas e a janela pode ficar aberta
semanas. Uma cura gasta numa segunda-feira desarmava a rede de segurança para o
resto da vida daquele separador. Dez minutos, e volta a armar-se.

## 2026-09-10 · Publicar sem subir a versão é publicar para meio de um carregamento
O maior dos achados que tinham ficado por verificar, e que ao ser verificado se
revelou pior do que estava escrito.

A premissa é o desenho: a cache offline **chama-se pela versão**
(`gi-shell-v<VERSAO>`), e a versão sai da primeira entrada do `web/avisos.js`.
Isso trocou uma dependência humana por outra — já não é preciso lembrar-se de
subir um número dentro do `sw.js`, mas passou a ser preciso lembrar-se de
escrever uma entrada nas novidades. E **nada o obrigava**.

Publicar sem subir a versão parecia ser apenas «não chega a ninguém»: quem tem a
app instalada continua a ser servido da cache que já tem, e a app nunca pergunta
nada, porque o `/versao.json` responde o mesmo número. Mau, mas silencioso.

Não é isso. É pior. O `install` do worker novo faz
`caches.open(CACHE).then((c) => c.addAll(SHELL))` — e com a versão na mesma,
`CACHE` é **o nome da cache que o worker antigo está a usar neste momento**. O
`addAll` sobrepõe-lhe as entradas por baixo. Uma página que começou a carregar
com os ficheiros velhos passa a receber os novos a meio do carregamento. É
exatamente a avaria da v31, por uma porta que não tem nada a ver com trocas de
worker.

Duas medidas, e as duas fazem falta:

**O `install` deixa de encher por cima.** Só enche uma cache vazia. Uma cache com
conteúdo e este nome é a de quem está a servir, e não se toca. Assim a falha
volta a ser silenciosa em vez de destrutiva — que é o pior que ela pode ser sem
depender de um passo do CI. O `install` mantém-se **sem `.catch()`**, de
propósito: é o falhanço do `addAll` a abortar o `install` que faz de «este worker
chegou a estar em espera» a prova de que a versão nova está inteira em disco.

**E o CI recusa a publicação** (`scripts/chegada.js`). Compara os ficheiros que a
cache guarda — a lista sai do `SHELL` do próprio `sw.js`, mais o `sw.js`, que
manda nela — entre esta árvore e a da publicação anterior. Se algum mudou e a
versão não subiu, não sai, e diz quais e o que fazer. Corre em dois sítios: no
*pull request* de promoção, que avisa cedo, e no `deploy`, imediatamente antes de
publicar, que é o que conta.

A regra só se aplica às promoções. Nos ramos de trabalho a versão sobe uma vez, no
fim, e não a cada alteração — que é como a casa já trabalhava.

## 2026-09-10 · O ecrã que tranca a app não trancava nada
O último dos oito, e o mais fácil de ver depois de apontado. O ecrã que tranca a
app quando a versão desce abaixo da mínima nascia com `z-index: 198` — **por
baixo** do ecrã de entrada, que é 200. Invisível a quem ainda não entrou; e é
justamente por causa dessas pessoas que a versão se verifica de propósito sem
sessão, como o comentário do fim do `novidades.js` diz: «quem está preso no ecrã
de entrada por causa de um erro já corrigido também precisa».

O mais dado a pensar é que este bug já tinha sido encontrado e corrigido ao lado,
no ecrã de reposição de palavra-passe, e o comentário dele di-lo em três linhas:
«abria por baixo do ecrã de entrada e ninguém o via — a ligação do email parecia
não fazer nada. **O mesmo bug do ecrã de atualização, o mesmo remédio.**» O
remédio foi aplicado a um e não ao outro.

Os portões vivem em JS, com o `z-index` escrito à mão em cada um, e por isso não
passavam por nenhuma das regras da escada das camadas, que lê o CSS. Agora
passam: um teste lê os números dos quatro e prende a ordem.

E, já que o ecrã diz que a app não pode ser usada: o ciclo de sincronização de
30 segundos continuava armado por trás dele, a empurrar o estado local para o
servidor a partir de uma versão declarada inutilizável. Se ela é velha demais
para se usar, é velha demais para escrever.

## 2026-09-10 · As ferramentas, e o que ficou de fora
Perguntou-se que ferramentas gratuitas se podiam trazer para facilitar a vida
de quem programa, opera, atende e usa. A resposta veio de um levantamento por
seis lentes com um cético por recomendação, e as três perguntas do cético eram
as que decidem tudo aqui: **é mesmo gratuito, e permanente? funciona com
repositório privado? encaixa num projeto sem passo de compilação, com 43
globais, e sem servidor sempre ligado?** A maior parte do que toda a gente
recomenda cai na segunda pergunta — CodeQL, o secret scanning do GitHub, o
`dependency-review`, o Codecov acima de 250 envios por mês — porque só é grátis
em repositórios públicos, e o Rendorium não é.

O que entrou, por ordem de proveito a dividir pelo custo de entrada:

**A fatura, primeiro.** Medido pela API do GitHub: 226 artefactos vivos, 1,9 GB
contra os 500 MB do plano, todos capturas do percurso guardadas em corridas
verdes que ninguém abre. E ~1 300 dos 2 000 minutos por mês, sem `concurrency`
em dois dos três workflows. Quatro linhas de YAML. O `cancel-in-progress` é só
em *pull request*, porque um push a `main` é uma promoção e tem de acabar —
senão fica um check «cancelled» precisamente onde o guarda da chegada corre.

**Os tokens saíam nos logs.** A linha automática de invocação dos Workers Logs
grava o URL em bruto, e as ligações que se entregam às pessoas levam o segredo
no endereço (`/?convite=…`, `/?ligar=…`). O código mascara tokens em tudo o que
escreve; esta linha passava por fora. `invocation_logs = false` nos dois
ambientes — a observabilidade não é herdável entre eles —, e cada relato passa
a deixar um registo estruturado e mascarado, para o `dev` não ficar às escuras.

**Os testes dizem o que cobrem e o que colide.** Cobertura nativa do
`node:test` com limiares inteiros, e uma verdade sobre o que o número mede: o
arnês carrega o `web/` em `vm` e a cobertura não o vê — é sobre `worker/` e
`scripts/`, um terço do código. E o guarda de globais, nos dois sentidos: a
leitura do texto apanha `var` e `function` duplicados entre os 43 ficheiros; o
`carregarTudo()` avalia a app inteira, nuvem incluída, no mesmo contexto — onde
um `const` repetido rebenta como no browser. Havia uma colisão real, `var css`
em três ficheiros de `cloud/`, precisamente a parte que o arnês não carregava.

> Nota de 2026-09-15: a cobertura já vê o `web/` — o arnês passou a dar a cada
> módulo um endereço de ficheiro (testes/arnes.js). E há uma configuração do
> ESLint (eslint.config.mjs) com um passo no CI que trava: a primeira leitura
> (323 acusações) foi triada até zero, e o eslint@10.10.0 e o globals@16.5.0
> ficam fixados às versões provadas.

**Quatro olhos.** `gitleaks` e `actionlint` como binários fixados à versão e ao
byte, com o checksum conferido antes de correr — não pelas *actions* deles, que
pedem chaves de licença ou mudam de runtime. O `shellcheck` do runner apontou
catorze coisas de nível *info* e *style* no bash do deploy, e uma a sério; a
resposta certa foi travar só a partir de *warning*, não reescrever 18 KB que
funcionam para calar sugestões. Um `madge --circular` encontrou dois ciclos no
worker; a causa era a mesma nos dois — o `worker/src/discord.js` tinha coisas
lidas de mais do que um lado — e saíram para `worker/src/lib/papeis.js` e
`worker/src/lib/bot.js`. O guarda dos ciclos ficou como teste, sem download.

**O worker mede-se.** As cinco consultas D1 mais pesadas no resumo diário — e
importa mais desde 2026-09-01, porque passar dos 5M de linhas lidas deixou de
ser um aviso e passou a ser a app em baixo até à meia-noite. O Analytics Engine,
que está no plano gratuito, com um ponto por pedido e um por relato, sempre com
a rota genérica e nunca com um id de pessoa — o código ficou, a ligação espera:
o Analytics Engine tem de ser ligado uma vez na conta, à mão, e com a ligação
declarada antes disso o deploy é recusado (código 10089), como aconteceu ao dev
à primeira. E o batimento para fora: o alarme
da casa é a ausência de linhas no `op_log`, mas quem deteta a ausência é o
próprio cron — se ele morrer, ninguém dá por isso. Um GET a um URL opaco, só
depois de o trabalho ter corrido bem, é a única peça que não pode ser feita de
dentro da Cloudflare.

**Os testes à prova de mutação.** Com ~800 testes verdes, a pergunta que fica é
se eles verificam alguma coisa ou se só passam por lá. O Stryker altera o código
de propósito e vê se algum teste se queixa. Corre à mão, nunca no CI, sobre o
que é lógica pura e bem coberta — o worker inteiro levaria horas a medir
sobretudo ficheiros que falam com a D1 e o Discord, onde um mutante sobreviver
diz pouco.

A primeira corrida, sobre `worker/src/lib`, a salvaguarda e o guarda da chegada:
2 023 mutantes, **70,7 % mortos** (77,8 % entre o código coberto), em 15
minutos. O número que interessa não é esse — é a lista. O
`worker/src/lib/relatos.js` fica em **38,7 %**: o caminho que recebe um erro,
decide se abre um pedido ou engorda o que existe, e se avisa quem programa, tem
64 mutantes a sobreviver — os testes tocam-lhe, mas não o verificam. O
`worker/src/lib/bot.js` em 0 %, sem teste nenhum, como se esperava de uma
chamada HTTP. Do outro lado, `worker/src/lib/permissoes.js` e
`worker/src/lib/medidas.js` acima de 84 %. É por aqui que se escreve o próximo
teste — e não por onde a cobertura de linhas manda, que dava o
`worker/src/lib/relatos.js` como bem coberto.

### O que ficou de fora, e porquê

**`tsc --noEmit`** com `jsconfig.json`: 474 erros, 470 dos quais são a
arquitetura — as guardas `module.exports` fazem-no ler módulos onde há scripts
(237 «cannot find name»), o `CW` é um saco (165), e o embrulhar por reatribuição
dá 35 «cannot assign to function». Ferramenta que luta contra a casa. Apanhou
uma chave duplicada num literal, que se corrigiu, e ficou por aí.

**Sentry** é genuinamente grátis e até encaixa sem *build* — descartado por ser
o item que mais facilmente derrama dados pessoais numa app cheia de nomes de
inquilinos e valores de renda; a região UE só se escolhe na criação da
organização. **SonarQube Cloud** é grátis até 50 000 linhas e há 40 244: a
margem acaba a curto prazo, e é o único caso em que o código privado passaria a
ser analisado fora da máquina. **Codecov** dá repositórios privados mas 250
envios por mês, e o `Testes` correu 319 vezes em 30 dias.

## 2026-09-12 · A chave da navegação partiu produção
A app em app.rendorium.com deixou de abrir a quem já a tinha usado: o Chrome
mostrava «Não é possível aceder a este site», sem uma linha na consola da
página. O servidor, a D1 e o KV estavam bons; uma visita num browser limpo
carregava, e só a navegação SEGUINTE — já servida pelo service worker —
falhava.

A causa era a chave das navegações, que a entrada de 2026-09-10 tinha passado
a `/index.html`. Os assets do Cloudflare respondem ao `/index.html` com um
307 para «/»; o `addAll` do install segue o redirecionamento e guarda a
resposta marcada como redirecionada; e o browser recusa entregar uma resposta
redirecionada a uma navegação. Fora de produção o worker não guarda nada, e o
percurso do CI corre em 127.0.0.1 — nenhum dos dois o podia ver.

Corrigiu-se no mesmo dia, como v36: a chave é o «/», o `/index.html` saiu da
SHELL (sw.js:SHELL), e uma resposta redirecionada que já esteja numa cache é
refeita sem a marca antes de ser servida (sw.js:inteira). O testes/sw.test.js
corre o sw.js num contexto com cache e fetch fingidos, que é o único sítio
onde isto se vê antes de produção.

O que fica: nunca pôr na SHELL um caminho que os assets redirecionam (o
`/index.html`, uma pasta sem barra). E, para diagnosticar «não abre» em
produção, abre-se a app duas vezes num browser limpo: a primeira carrega
sempre, ainda sem worker.

## 2026-09-13 · O addDays deixa de recuar um dia no verão
O addDays (formato.js:addDays) construía a data em hora local e devolvia-a
pelo toISOString: meia-noite local no verão virava o dia anterior, e a janela
next..until ao avançar um planeado (planeados.js:recAdvance) e o lembrete «Em
atraso» do Android (dados.js:scheduleReminders) recuavam um dia. Passou a
montar o AAAA-MM-DD a partir das partes locais, como o pzAddDias
(prazos.js:pzAddDias) e o today() (formato.js:today) já faziam; um teste de
revisão (testes/revisao-cliente.test.js) prende-o.

Ficou na lista das dívidas marcado «Resolvida» até 2026-09-15, dentro de uma
secção que abre com «não está corrigido». Saiu nesse dia: uma dívida que fecha
sai da lista no mesmo commit, e vem para aqui com a data.

## 2026-09-15 · A avaliação de 2026-09-14, e o que ela mudou nas regras
Sete revisores avaliaram o projeto a 2026-09-14 — 124 achados. A 2026-09-15
cada um foi posto à prova contra o código, e o que se manteve foi corrigido,
cada correção com um teste que falhava antes dela. O que isso mudou nas regras
já está escrito nas secções delas, no presente; aqui fica onde procurar, para
quem der pela diferença:

- a leitura do estado passou a uma fusão a três com o retrato como base, com
  um selo (ETag, e um 304 quando nada mudou), e a sessão passou a viver no
  cookie HttpOnly em vez de um token guardado no aparelho — «A sincronização:
  o que é daqui e o que é do servidor»;
- o capital em dívida de uma hipoteca deriva-se do capital da data de início,
  e o fim da taxa fixa tem um relógio só — «O capital em dívida deriva-se»;
- a renda planeada conta só rendas, pelo mês a que respeitam, e a caução deixou
  de passar por renda do primeiro mês — «A renda planeada e as rendas já
  lançadas»;
- o calendário e os prazos abrem a ficha, e não o formulário — «Tocar num
  registo é lê-lo»;
- a raiz das Definições é uma só, e é dados (definicoes.js:DEF_LINHAS); a
  Amortização é dos Créditos (creditos.js:amortModal); a base ganhou o ecrã
  «não carregou», distinto do «desligado»; e a pasta web/cloud/ é a segunda
  camada — «A app em serviços»;
- a regra dos nomes — «Escrita»;
- proibições novas, cada uma com o defeito que a trouxe: new Function e eval, um
  id num on…= sem jsq, texto de quem usa num summary sem esc, um object URL sem
  quem o revogue — «O que não se faz».

E três coisas de arrumação. O diário saiu do design.md para este ficheiro, e as
dívidas pagas saíram da lista. O editor rico saiu da app, e com ele a regra de
não meter uma caixa contenteditable dentro de um <label>, que já não tinha a
que se aplicar. A cobertura dos testes passou a contar o web/ (o arnês dá-lhe
um endereço de ficheiro, testes/arnes.js), e há uma configuração do ESLint com
um passo no CI que trava, com o eslint@10.10.0 e o globals@16.5.0 fixados.

## 2026-09-15 · A CSP sem «unsafe-inline»: os eventos e os estilos saem do HTML
A app pedia ao browser que corresse o que estava escrito dentro do próprio
HTML: centenas de atributos `on…=` e de `style=`. Isso obriga a política a
trazer `'unsafe-inline'` no `script-src` e no `style-src` — e com ele a CSP
deixa de valer contra a única coisa que existe para travar: um pedaço de HTML
que alguém consiga injetar traz o seu próprio código, e ele corre. A app é de
senhorios, com dados de inquilinos e valores de contratos, e boa parte do que
aparece no ecrã é texto escrito por pessoas: nomes, notas, etiquetas.

O trabalho foi de tradução, sem mudar nada do que se vê ou se faz. Cada `on…=`
passou a um dos cinco atributos declarados, lidos por um mecanismo da app
(web/app/eventos.js) e não pelo browser. Cada `style=` passou a uma classe —
utilitária quando era uma declaração só, do módulo quando as declarações se
sobrepunham — numa folha a sério (web/estilos.css), que era o bloco de estilos
de 812 linhas do index.html; o que vinha dos dados (uma largura, uma cor, um
atraso) passou a atributos que um observador aplica no `el.style`, que é CSSOM
e a política deixa passar (web/app/estilos-calculados.js). As regras ficaram
escritas no presente nas secções novas do design.md.

Três decisões que custaram a tomar.

A primeira: uma gramática, e não um interpretador. O valor de um `data-click`
podia ir a um `new Function`, e era meia hora de trabalho — mas a política
também não tem `'unsafe-eval'` e, sobretudo, isso devolvia ao atacante
exatamente o que se lhe estava a tirar. O eventos.js:analisarAcao lê uma
gramática pequena — chamadas, `&&`, `||`, `!`, textos, números — e mais nada.
O que não cabe lá passou a ser uma função com nome no ficheiro que a usa, e a
ação chama-a: é de onde vieram o calendario.js:calMarcarVisita (um objeto
`{date:…}` não cabe numa ação), o creditos.js:pagarCreditoDaHipoteca, o
contrato.js:ctRegistarRenda, o painel-geral.js:dashVerSemImovel e o
notificacoes.js:notifPedidoAceitar (o `window.CW&&…` também não cabe). Cada
uma faz o que o atributo fazia, pela mesma ordem.

A segunda: os nomes fecham-se no arranque. Uma ação só chama o que a app
declara no topo, e a lista fecha-se no `DOMContentLoaded`: o que um script de
fora pendura no `window` depois disso fica de fora, e um `window.x` posto
dentro de uma função também. Os três sítios que precisam de despachar por nome
— o `onchange` de um sel(), o apagar de um anexo, a chamada a um serviço —
passam todos pelo eventos.js:funcaoDaApp, o único sítio da app onde se lê
`window[nome]` com um nome vindo de fora. E todo o valor que circula numa ação
passa pelo eventos.js:acaoValor: uma função nativa, o `window`, o `document` ou
um nó do DOM nunca circulam, nem quando é uma função da app que os devolve — a
revisão achou o caminho de um `var` da app que guardava um nó até ao
`ownerDocument.defaultView`, e é esse que o acaoValor fecha.

A terceira: fechar o limite das funções que recebem HTML, em vez de o
documentar. Uma ação chega ao openModal e aos irmãos, e isso vale por uma
injeção de HTML: um `iframe` com `srcdoc` corre qualquer script desta origem
com acesso ao `parent`, e a CSP não o trava — o srcdoc herda-a e o `script-src
'self'` aceita os ficheiros da app. Procurou-se em web/ e nenhuma janela usa
`iframe`, `meta`, `base`, `object` ou `embed` de propósito; passaram a ser
tirados de todo o HTML que entra numa janela, num sítio só
(componentes.js:semEtiquetasQueCorrem). Não substitui o escape, que continua a
ser a primeira defesa, mas tira a porta.

O que se aprendeu pelo caminho está nas armadilhas: o hash de um script em
linha conta os fins de linha; um `el.style.x = ''` apaga um estilo em linha mas
não apaga uma classe; e um predicado em texto passado ao Playwright é um eval,
que a política recusa — o percurso da interface passou a passar funções
(testes/ui/percorrer.js).

E uma coisa que só o browser disse, e que nenhum teste de texto podia ter
apanhado: tirar o `'unsafe-inline'` do `style-src` partia o botão de entrada
com Google. A biblioteca deles injeta uma folha na página, o browser passou a
recusá-la, e o botão saltou de 72px para 357px de altura — medido contra a
mesma página sem CSP nenhuma. Ficou o sha256 dessa folha na política: não abre
a porta a mais nada, ao contrário do `'unsafe-inline'`, e devolve o botão aos
72px exatos. O preço é depender de um terceiro — quando o Google mudar a
biblioteca o hash caduca e o botão volta a crescer —, e por isso o caso está
nas armadilhas com o sintoma e o remédio. Os dois atributos de estilo que a
mesma biblioteca escreve ficaram recusados de propósito: um hash não cobre um
atributo sem `'unsafe-hashes'`, que abriria a porta a todos, e medimos que não
mudam nada do que se vê.

A prova é de três lados, e nenhum chega sozinho: o testes/csp.test.js varre a
app à procura do que a política recusaria e confere os hashes nos dois sítios
onde ela vive; o percurso corre a app inteira no browser com a política nova, e
uma recusa aparece como erro de consola e falha-o; e as fotografias dos mesmos
estados, antes e depois, dizem se alguma coisa mudou no ecrã.

## 2026-09-24 · O repositório passou a público

O que era defensável num repositório fechado deixou de o ser, e duas coisas
mudaram de sítio no mesmo dia.

**A chave de assinatura do APK.** Estava versionada, com a palavra-passe em
claro no build.gradle, e o comentário explicava porquê: uma chave fixa é o que
deixa a atualização instalar por cima da anterior. Com o repositório público,
qualquer pessoa passava a poder assinar um APK com a identidade da app, e o
Android aceitá-lo-ia como atualização — por sideload, que é precisamente como
esta app se distribui. A chave foi substituída por uma nova, que vive nos
segredos do GitHub e nunca no repositório; o Gradle lê-a de fora e recusa-se a
compilar um release sem ela. A antiga conta-se como perdida para sempre, e
reescrever o histórico não mudaria isso. O preço está na app, no botão de
descarregar: quem já tem a app instalada tem de a desinstalar antes de instalar
o APK novo, e quem não tem conta na nuvem deve guardar uma cópia primeiro.

**O estado do Terraform.** Era commitado pelo próprio deploy. Hoje não tem
segredo nenhum — são ids de recursos —, mas um estado é um ficheiro que por
natureza acaba por apanhar atributos sensíveis, e num repositório público isso
é uma questão de tempo. Passou a viver num balde R2 só dele. O deploy traz-o
antes do Terraform e volta a guardá-lo depois de um apply que mude alguma
coisa, com uma cópia datada ao lado. Se o estado não estiver lá, o deploy para
em vez de continuar: sem ele, o plano proporia criar de novo a base e os baldes,
e o que protege os dados é precisamente o estado saber que eles já existem.

## 2026-09-24 · A app de dev instala-se ao lado da de produção

O ambiente de dev existia para se testar no browser, mas no telemóvel não
havia como o ter: o APK só saía do `main`, com o domínio de produção escrito
na concha, e a PWA de dev.rendorium.com instalava-se com o mesmo nome e o
mesmo ícone da de produção — dois ícones iguais no ecrã inicial, sem se saber
qual era qual. Passa a haver uma app de dev com a sua cara, que se instala AO
LADO da de produção, e nunca por cima.

**O que separa as duas.** No Android é o `applicationId`, não a assinatura: o
flavor `dev` tem o sufixo `.dev`, e dois pacotes diferentes coexistem seja qual
for a chave. O HOST deixa de estar escrito na `MainActivity` e vem do
`BuildConfig` de cada flavor; o nome é «Rendorium DEV» e o ícone é âmbar, com
«DEV» a traço por baixo da casa, no source set do flavor. Na PWA é a origem: o
`id` do manifesto é «/», que resolve contra app.rendorium.com num caso e
dev.rendorium.com no outro, e o browser trata-as como duas apps.

**A identidade de dev nasce no worker, não em ficheiros à parte.** Os
ficheiros de web/ são os mesmos nos dois ambientes; fora de produção o worker
reescreve ao passar o manifesto e a página «/» — o nome, o título, o nome no
iPhone e os ícones (worker/src/lib/identidade.js:identidadeDeDev). O manifesto
passou a entrar no `run_worker_first` para chegar ao worker. Só o `<head>`
declarativo muda: os scripts em linha ficam iguais, e os sha256 da CSP
continuam a bater. Em produção não muda um byte, e um teste lê os dois casos
de ponta a ponta (testes/app-dev-web.test.js). O pedido vai aos assets sem
as condições do browser (If-None-Match, If-Modified-Since): o ficheiro do
manifesto é o de produção e a etiqueta dele também, portanto um browser que
já o tivesse em cache recebia dos assets um 304 sem corpo, e não havia nada
para reescrever — a PWA de dev instalava-se «Rendorium» com os ícones verdes,
e assim ficava, porque o ficheiro não muda entre publicações. A resposta de
dev leva a sua própria etiqueta (a do ficheiro, com «-dev»), e o 304 faz-se no
worker contra essa (identidade.js:etiquetaDeDev). Os ícones de dev saem do mesmo
desenho que os de produção (make-icons.js:makeIcon), com a geometria do vetor
Android replicada em píxeis, para a PWA e o APK de dev terem a mesma cara.

**A assinatura.** Não é preciso uma chave diferente para as apps coexistirem,
mas o APK de dev passou a compilar-se a cada push ao `dev`, e assinar isso com
a chave de produção era pô-la a rodar no runner dezenas de vezes por semana
sem necessidade. O flavor `dev` aceita uma chave própria — os segredos
`ANDROID_KEYSTORE_DEV_B64` e `ANDROID_KEYSTORE_DEV_PASS`, ou as entradas
`dev*` do keystore.properties — e cai na fixa quando ela não existe, dizendo-o
no resumo do deploy. Uma chave de dev conta-se como descartável: perdê-la
custa uma desinstalação da app de dev, e mais nada.

**O que se diz a quem descarrega.** O cartão «App para Android» das
Definições (cloud/partilha.js:cartaoDaAppNoTelemovel) explica, fora de
produção, que o APK é o Rendorium DEV e que se instala ao lado. A regra do
service worker não muda: fora de produção não guarda nada (sw.js:GUARDA), por
isso os ícones de dev não entram na SHELL nem contam para a chegada.
