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
- 2026-09-29 · Um grupo partilha-se como grupo, e a vista geral começa pela jornada
- 2026-10-08 · O IRS ganha uma versão por ano, e a Declaração deixa de deduzir a mais
- 2026-10-12 · O que tinha ficado de fora do IRS entra
- 2026-10-17 · Uma cara nova, desenhada antes de escrita
- 2026-10-19 · Os erros dos robôs não são pedidos
- 2026-10-19 · A cara nova depois de usada, e a Declaração fica em dev
- 2026-10-20 · As listas imitam os Movimentos, e a nuvem diz se liga
- 2026-10-20 · A terceira volta da v40: sem saltos, por quartos, e sem o filtro de proprietário
- 2026-10-20 · A quarta volta da v40: o realce que o Samsung escurece, as fotos em carrossel e os quartos a partir do fim
- 2026-10-20 · A quinta volta da v40: o carrossel dos separadores, uma seleção só, os Inquilinos e as Visitas selecionáveis, o Anular que se afasta e o Início que não é uma casa
- 2026-10-22 · Um proprietário é uma conta: a lista das partilhas e o realce que ficava preso
- 2026-10-22 · O realce que ainda ficava, a ligação repetida e as listas por origem
- 2026-10-22 · Os Grupos nas Casas, a página Segurança e os títulos das secções sempre
- 2026-10-22 · Os grupos selecionáveis, o novo grupo no + e as folhas que se arrastam para fechar
- 2026-10-22 · Apagar um imóvel que não criei é sair dele
- 2026-10-22 · Duas escritas na mesma casa não se esmagam
- 2026-10-23 · A montra diz o valor nos primeiros segundos
- 2026-10-25 · A casa partilhada funde em vez de gravar por cima, e as tarefas guardam-se de uma vez
- 2026-10-25 · Os registos fundem como a casa
- 2026-10-25 · As miniaturas sobem com as fotos
- 2026-10-25 · Transferir a propriedade é um pedido que o outro aceita
- 2026-10-25 · As fotos a descer mostram que estão a chegar
- 2026-10-25 · Passar o controlo, não a propriedade
- 2026-10-26 · Passar o controlo pede a ligação a todos os comproprietários
- 2026-10-26 · Passar o controlo precisa do sim de todos os comproprietários
- 2026-10-27 · A app apresenta-se, e o ícone passa a cobalto
- 2026-10-28 · «Transferir o controlo», «Descarregar» e as frases sem género
- 2026-10-28 · Os tickets de QA
- 2026-10-28 · As sessões de teste no back office
- 2026-10-28 · Quem fecha uma apresentação a meio é perguntado, uma vez
- 2026-10-28 · Trinta sessões numa conta de teste
- 2026-10-28 · A segunda ronda de tickets de QA: o ano inteiro, os donos no seletor, os grupos nos filtros
- 2026-10-28 · Os tickets de QA com três estados: novos, em resolução, resolvidos
- 2026-10-28 · A pílula do QA no back office, com o qa.js da app
- 2026-10-28 · A hipoteca que começa no futuro
- 2026-10-28 · O dev só abre pela ligação do /test
- 2026-10-28 · A terceira ronda de tickets de QA
- 2026-10-28 · A APK de dev abre as ligações do /test
- 2026-10-28 · Os pedidos das pessoas decidem-se antes, e a resposta é da equipa
- 2026-10-29 · O rasto das pessoas, debaixo de um pseudónimo
- 2026-10-29 · A quarta ronda de QA e o email dos planeados em atraso
- 2026-10-29 · O «?» da Ajuda no lugar da nuvem

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

## 2026-09-29 · Um grupo partilha-se como grupo, e a vista geral começa pela jornada

Seis pedidos do Martinho num só dia, e duas decisões de produto que ficam
aqui com o porquê.

**Os grupos partilhados.** A partilha era casa a casa, dentro de uma ligação
aceite entre duas contas. Um grupo de casas que se quer partilhar com a
família obrigava a N escolhas de casas com N pessoas, e uma casa nova no
grupo não chegava a ninguém. Passa a haver grupos partilhados: quem está no
grupo é comproprietário de todas as casas dele, e a regra entra no mesmo
sítio que já decidia as partilhas por ligação (worker/src/lib/acesso.js:participantsOf),
por isso as quotas, as propostas, o sino e o cliente inteiro não souberam de
nada. Três escolhas: (1) entra-se por uma ligação multi-uso com prazo de
sete dias, e quem a abre fica com um pedido que o dono aceita ou recusa (a
migração 0018; web/cloud/grupos.js:CW.grupoAceitarPedido); (2) qualquer
membro põe no grupo casas suas, porque um grupo em que só o dono põe casas é
uma partilha por ligação com outro nome — e quem entra aceita no modal que as
casas que puser ficam com todos; (3) um movimento atribuído a um grupo
parte-se por imóvel ao guardar, e cada parte vive no seu imóvel
(movimento.js:parteId). Um grupo privado que se partilha mantém o id
(web/cloud/grupos.js:CW.grupoPartilhar), para os planeados e os modelos que o
apontam continuarem a apontar.

A primeira versão, no mesmo dia, fazia as duas coisas ao contrário, e o
Martinho corrigiu-as. Entrava-se SEM o dono aceitar, com o argumento de que é
o dono que distribui a ligação; mas uma ligação enviada à pessoa errada dava
logo as casas todas, e um pedido pendente custa ao dono um toque. E o
movimento de grupo ficava inteiro nos registos de quem o registou: os outros
membros não o viam, e os saldos entre proprietários de cada um discordavam.
Partido por imóvel, cada parte chega a quem partilha esse imóvel; as partes
levam o lote (o id, quantas são, o total, o alvo e a divisão), a lista mostra
o lote numa linha (lista-movimentos.js:linhasDaLista), e as contas de um lote
ficam como foram gravadas mesmo que o grupo mude depois. Os movimentos de
grupo antigos partem-se no arranque com os mesmos números
(movimento.js:migrarMovimentosDeGrupo); uma renda de grupo com retenção passa
a contar no Anexo F de cada imóvel, pelo titular dele.

**A jornada.** A vista geral pedia um imóvel e, criado ele, mostrava quatro
indicadores a 0 € e dois gráficos vazios com o cartão dos primeiros passos por
cima. O Martinho perguntou se fazia sentido pedir os movimentos antes de
mostrar cartões a zero, e não faz: enquanto não há movimentos a vista geral é
a jornada — a fita dos passos com o atual em destaque
(guia.js:cartaoPassos) — mais o portefólio quando já há imóveis
(painel-geral.js:vDashboard). O primeiro movimento traz os números.

**O resto, mais pequeno.** No formulário do movimento, com mais do que um
proprietário à escolha, o meu nome leva «(eu)» (acessos.js:rotuloDoDono).
O imóvel de um movimento tem duas opções que antes eram uma: «Sem imóvel»,
que não é de imóvel nenhum e conta só nos totais da vista geral, e «Todos os
imóveis», que se parte pelos imóveis que eu tinha na data do movimento
(saldos.js:imoveisDeTodos) e conta em cada um. A opção vazia chamava-se
«Todos os imóveis» e servia para as duas; os movimentos que já a tinham ficam
«Sem imóvel», para nenhum número antigo mudar. Num acerto a opção vazia
continua «Todos os imóveis», porque um acerto sem imóvel é mesmo de todos. E
nos Colaboradores sem imóveis o cartão «Colaboradores», cujo vazio mandava
criar uma ligação de convite que não se pode criar, deixa de se escrever
(partilha.js:colaboradoresCard).

## 2026-10-08 · O IRS ganha uma versão por ano, e a Declaração deixa de deduzir a mais
O Martinho pediu duas coisas: ter a certeza de que a feature do IRS está bem
feita, e uma versão das regras por ano, com o nome do ano. Começou por uma
pesquisa (o Doutor Finanças como guia, confirmado no impresso e nas
instruções oficiais do Anexo F, no CIRS e no Diário da República), e a
pesquisa achou na app coisas ditas mal:

- o não habitacional pagava 25 % na estimativa — a lei diz 28 % (CIRS art.
  72.º n.º 1 e)); e a redução pela duração aplicava-se a qualquer contrato
  longo, quando é só da habitação permanente;
- não havia a taxa de 10 % das rendas até 2 300 €/mês, criada pelo DL 97/2026
  com efeitos desde 1 de janeiro de 2026 — a renda líquida de quase todos os
  contratos de 2026 estava subestimada;
- os contratos ainda no regime de 2019 (começados entre 2019 e 6 de outubro
  de 2023) ficavam com os 15 % da Lei 56/2023 quando ficam com o regime antigo
  até renovarem; e as renovações iguais (−2 pontos cada) não contavam;
- tudo ia ao «quadro 4.1», quando os contratos com redução pela duração vão
  ao 4.2, com o 4.2A;
- os gastos de um imóvel com um contrato declarado e outro não declarado
  caíam todos no declarado — deduzia-se o dobro; e o condomínio pago com a
  casa vazia contava, quando só conta o período arrendado.

As regras de cada ano passaram para uma versão por ano dos rendimentos
(irs.js:irsAno; a regra está no design.md, «As regras do IRS têm uma versão
por ano»). Decisões que não se leem no código: o nome é o ano dos
rendimentos (o Martinho pode preferir o da entrega — renomear é barato); não
há versão de 2024 nem anteriores, que usam a de 2025 com as datas recuadas e
o aviso de que não é a do ano; a versão de 2026 é provisória enquanto não sair
a portaria do Modelo 3 (fevereiro ou março de 2027), e a de 2027 nasce do
scripts/nova-versao-irs.js quando o Orçamento for publicado — a proposta
entregue a 2026-10-08 não mexe na categoria F. Os 10 % aplicam-se também à
habitação não permanente, porque a lei só pede «exclusivamente habitação» (o
Doutor Finanças diz que pede permanente; seguiu-se a lei). A finalidade por
indicar continua a assumir-se habitação, mas a redução pela duração passa a
pedi-la como falta. As renovações «de igual duração» lêem-se como do mesmo
escalão que o contrato. A coluna escolhida à mão numa despesa passa por cima
da regra do período arrendado. E as rendas de anos anteriores ficam na linha
(a lei conta-as no ano em que se recebem) e são só apontadas para o quadro 8.

Ficou de fora, para o Martinho decidir: o simulador do englobamento (precisa
dos outros rendimentos da pessoa), o quadro 9 do AIMI, os códigos do quadro
10, o titular A/B da tributação conjunta, a dispensa dos recibos e o Modelo 44,
as isenções do RSAA e dos programas municipais, e os n.ºs 23 e 24 do art.
72.º (os limites da renda e o bónus da renda mais baixa).

## 2026-10-12 · O que tinha ficado de fora do IRS entra
O que a versão por ano deixou para o Martinho decidir (entrada de
2026-10-08) entrou a pedido dele («faz tudo»), por dois agentes, um do lado
do contrato e outro da página Declaração.

No contrato: as comunicações de fevereiro já feitas (o aviso do ano
cala-se), a isenção de um programa de arrendamento acessível (0 %, quadro
6D), as duas perguntas dos n.os 23 e 24 do art. 72.º e o «Renovar…» que
guarda a renovação em vez de mudar o fim. Na Declaração: o cartão «A tua
situação» (conjunta, titular A/B, dispensa dos recibos, outros rendimentos),
o quadro 9 do AIMI, o 6D, a comunicação no 4.2A, o 4.2B e o 4.2C, o
simulador do englobamento e o Modelo 44.

Decisões que não se leem no código. No n.º 24 leu-se «5 %» da renda
anterior (a pesquisa escrevia «5 p.p.»), a partir de 1/1/2024 como o n.º 23,
só no período inicial e nunca abaixo de 5 % — a letra daria 0 % num contrato
de 20 anos. No n.º 23 «Não sei» conta a redução, para não mudar a taxa de
todos os contratos de 2024 sem a pessoa ter dito nada. Os contratos isentos
ficam na linha do 4.1, e não à parte como o pedido ao agente dizia, porque as
instruções do quadro 6D pedem «o campo do quadro 4.1, onde o imóvel foi
identificado» — saem só do líquido e do imposto. O AIMI que abate é estimado
pelo VPT dos prédios da app e limitado ao imposto estimado das rendas, a
leitura prudente do CIMI art. 135.º-I. As parcelas a abater dos escalões não
vêm na lei: calculam-se para a tabela ser contínua, e o teste confere-as com
as taxas médias publicadas de 2026. O código do RSAA no 6D fica por conhecer
até sair o Anexo F de 2026. Um imóvel dos dois cônjuges em conjunta diz «A/B»
sem titular escolhido.

Uma mudança de comportamento: o período inicial passou a acabar na véspera
da primeira renovação (irs.js:irsPeriodos) — com o «Renovar…» a levar o fim
para a frente, um contrato de 5 anos renovado por mais 5 lia-se como um de
10 e ficava com 10 % em vez de 15 %. Os contratos antigos, com o fim
original, dão o mesmo que antes.

## 2026-10-17 · Uma cara nova, desenhada antes de escrita
A Rendorium mudou de cara inteira de uma vez, a partir de um canvas do Claude
Design («Rendorium — app», sessenta pranchetas: a linguagem, os ecrãs no
telemóvel e no computador, os estados, a montra e as páginas legais, os
emails e o back office). Fez-se por uma árvore de quinze folhas — a fundação,
a casca, nove folhas de ecrãs e três de fora da app —, cada uma com o seu
contrato, as suas provas no browser contra as pranchetas e a sua lista de
conformidade, e uma revisão adversária no fim. As regras novas vivem no
design.md; aqui fica o porquê das que custaram.

O vermelho deixou de ser o negativo. Uma despesa a vermelho lia-se como um
erro, e um atraso não se distinguia de um gasto normal: o dinheiro passou a
ter três cores (o que entra, o que sai, a prestação — estilos.css:--in,
estilos.css:--out, estilos.css:--loan) e o vermelho ficou só para o perigo
(estilos.css:.perigo). O cobalto da marca passou a ser só a ação: o verde
antigo fazia de botão, de positivo e de «em vigor» ao mesmo tempo. As séries
dos gráficos deixaram de ter hex à mão (tema.js:COR_SERIE), o que fechou duas
dívidas antigas de uma vez.

As letras são da casa e servem-se da casa. A CSP só deixa font-src 'self', e
um Google Fonts pedia abrir a CSP a um terceiro e mandar-lhe o IP de cada
pessoa: a Geist e a Bricolage Grotesque vivem em web/fonts/, variáveis e só
com o latino, pré-carregadas e na concha do service worker (sw.js:SHELL),
com swap para nunca haver texto invisível.

A navegação arrumou-se em cinco grupos do dia a dia (navegacao.js:NAV_GROUPS)
e a barra de baixo em áreas (navegacao.js:AREAS): Casas e Dinheiro juntam
três separadores cada, e lembram-se do último. «Pessoas» é uma porta para os
Inquilinos e os Proprietários (navegacao.js:PESSOAS), que continuam serviços
à parte — um serviço desligado não pode deixar meia porta acesa. Os Grupos e
os Colaboradores saíram do menu para as Definições: são arrumação da conta, e
o menu tinha opções a mais. O FAB saiu de todos os ecrãs: cobria o último
cartão de cada lista e no computador repetia a ação que o cabeçalho passou a
ter (navegacao.js:pintarAcaoDoCabecalho); cria-se no + da barra e no «Criar»
da barra lateral, que abrem a mesma folha (navegacao.js:abrirAdicionar). O
estado da sincronização subiu ao cabeçalho (cloud/entrada.js:setSyncBadge) e
o sino passou a «Pede atenção», onde o que está por confirmar se confirma sem
sair dali (notificacoes.js:atencaoCorpo).

A montra deixou as capturas. Seis imagens que envelheciam a cada mudança da
app, em claro e escuro, deram lugar a maquetes de HTML e CSS com números que
fecham (landing.js:RECEITA_MES) e barras geradas dos dados
(landing.js:alturasDasBarras), porque a página não tem JavaScript nem
atributos de estilo. Fica uma captura só, a imagem de partilha, que as redes
mostram sem correr CSS (scripts/capturas.js:CAPTURAS).

Os emails vestiram a linguagem sem nada de fora — nem imagens, nem letras —,
porque o Gmail e o Outlook cortam o que vem de fora e as letras não chegam lá:
as cores do contrato vão escritas por extenso (correio.js:COR) e a marca é
uma tabela (correio.js:marca). O back office ficou com a barra lateral
grafite, de propósito diferente do azul-noite da app, e perdeu o último
confirm(): desligar um serviço pergunta no próprio cartão e diz quem cai junto
(equipa-guiao.js:mostrarAvisoDesligar).

Os ecrãs trouxeram três decisões que o desenho não mostra. O que não destrói
não leva vermelho: «Recusar desta vez» um planeado não apaga nada, e passou
do botão vermelho para o ⋯ da linha (planeados.js:pendMenuItens). Os números
que mudam uma página da Análise — o yield exigido, o horizonte, o aumento
das rendas, a inflação — saíram do painel dos filtros para a própria página
(a caixa .ana-pin, que saiu a 2026-10-20 para a janela da roda dentada):
escondidos lá, mudavam todos os números sem se ver porquê. E o «Partilhar» passou a estar no cartão de cada grupo
(definicoes.js:cartaoDoGrupo), o que tornou inútil o «Partilhar um grupo que
já tens», que listava os privados à parte: as portas passaram de três a
duas.

Fechou a dívida das cirurgias da nuvem sobre o HTML da app. A secção dos
proprietários do formulário do imóvel era trocada por expressão regular, e a
expressão deixara de casar a 2026-10-01, quando o título passou a
«Proprietários e quota-parte (%, opcional)»: sem erro nenhum, quem tinha
conta via a secção local, com as quotas escritas à mão, em vez das quotas
por proposta. O formulário pede agora a secção a um ponto de extensão
(imovel.js:donosDoFormulario), que a nuvem preenche quando há sessão. O
embrulho do cartão por confirmar, que acrescentava o «Recusar» ao lado do
botão de silenciar, deixou de casar quando o Silenciar foi para o ⋯, e saiu:
o «Recusar desta vez» e o «Preencher N em falta» vêm das linhas do próprio
cartão, e os cartões dos contratos usam as mesmas linhas
(cloud/painel.js:pendBlock).

As linhas das listas deixaram o ⋮, como no canvas: a ficha já tinha as
mesmas opções no ⋯ e no «Editar», tocar na linha abre-a, e o toque longo
continua. O que custou foi a regra do percurso que pedia um botão dentro de
cada linha com toque longo («o gesto tem sempre um caminho visível ao
lado»): queria dizer um caminho visível e dizia um botão, e passou a aceitar
a linha focável que abre a ficha (testes/ui/invariantes.js). Nos Movimentos a
seleção ficou com portas à vista — o «Selecionar vários» no cabeçalho e, no
ecrã largo, as caixas da tabela —, e a barra das ações, que o canvas punha
entre os totais e a tabela, flutua no fundo: ali empurrava a lista ~56px ao
primeiro visto (cloud/selecao.js:selBarraHtml). O título do mês ganhou
classe própria (estilos.css:.mov-mes), e a metade dos Movimentos da dívida
dos cabeçalhos com um utilitário por cima fechou.

O caminho curto dos Movimentos (lista-movimentos.js:refrescarMovimentos)
trazia um defeito desde a casca nova: refazia a vista sem a faixa do âmbito
e sem os separadores da área, e a primeira tecla da pesquisa levava os
separadores do telemóvel. Passou a refazer o mesmo molde que o render, como
a via parcial das outras listas (vistas.js:refrescarListasVivas). E trocar
de tipo no segmentado do formulário de um movimento limpa o que só o tipo
antigo tinha (movimento.js:limparDoTipo): escondidos pelo tipo novo, uma
hipoteca, um contrato ou uma coluna do Anexo F ficavam gravados sem ninguém
os ver.

Nos Contratos, a linha ganhou dois andares (lista-contratos.js:ctLinha): o
de fora recebe o bloco dos por confirmar que a nuvem pendura
(cloud/painel.js:decoratePending), o de dentro abre a ficha, e assim o toque
no Confirmar não chega ao que abre. O cabeçalho de cada imóvel ganhou classe
própria (estilos.css:.ct-grupo-cab), e com ele fechou a outra metade da
dívida dos cabeçalhos com um utilitário por cima. O PDF do contrato vestiu
as cores do tema claro (contrato-pdf.js:PDF_COR) mas ficou na Helvetica: a
Geist e a Bricolage só entravam embutidas, a partir dos woff2, que vêm em
Brotli e o escritor do PDF teria de desfazer, e a Helvetica é uma das
catorze letras que todo o leitor de PDF já tem.

Na conta, os portões — a entrada, os termos novos, a versão velha demais —
estão acima do aviso e das janelas, e isso escondia duas coisas. O
«Esqueci-me da palavra-passe» pedia o email com o prompt() do browser, o
último da app, que no WebView do Android podia devolver null sem aparecer, e
a resposta ia num aviso por trás do ecrã de entrada; agora aponta o campo, e
a resposta fica escrita no próprio ecrã (entrada.js:esqueci). E «Não aceito
— apagar a conta» abria a confirmação por baixo do ecrã dos termos, e o
toque não fazia nada que se visse; a janela que um portão abre leva agora a
classe que a põe por cima dele (estilos.css:.modal.sobre-portao). O pedido
ao suporte levava a versão dos termos em vez da da app, e chegava a dizer
«v2026-09-09»; leva o VERSAO (ajuda.js:CW.sendTicket). Com estes ecrãs
fecharam as dívidas do prompt(), dos emojis e dos vistos escritos como
caracteres (entrada.js:pintarRequisitos), e os caminhos que os textos
ensinam passaram a ser os das Definições, «Definições → Grupos» e
«Definições → Colaboradores e cargos».

A revisão adversária do fim foi um revisor por folha, com capturas contra as
pranchetas, e um cético por achado, a tentar derrubá-lo antes de ele contar:
ficaram 136 achados confirmados em dez folhas, a casca e as nove de ecrãs.
Os que mais pesaram não eram de aspeto, eram contas erradas com cara nova:
o plano de amortização contava anos de doze prestações a partir de hoje, e
não anos civis (creditos.js:yearRows); o total dos por confirmar somava
entradas e saídas como positivas (planeados.js:pendTotal); a confirmação de
apagar uma seleção somava os valores sem sinal, e dizia «1 305,00 €» com a
barra a dizer «+1 195,00 €» (cloud/selecao.js:CW.selApagar); e os chips dos
Contratos contavam contratos fora do âmbito que a lista não mostrava
(ambito.js:visiveis). Nenhuma destas se via numa prancheta, que tem os
números certos por construção: só uma revisão que lia os números, e não só o
desenho, as apanhava. Da mesma revisão saíram regras que valem para lá da folha
onde nasceram: gravar não tira o foco a quem usa o teclado (o render troca a
vista inteira, e o foco caía no body), uma grelha ao lado da navegação
lateral parte-se pela largura do cartão e não pela do ecrã, um botão nunca
vive dentro de um elemento tocável, e o realce de passar por cima só existe
com rato, porque num ecrã de dedo largo ficava preso.

## 2026-10-19 · Os erros dos robôs não são pedidos
Os doze pedidos abertos no back office eram todos relatos automáticos, sem
uma pessoa por trás: dez «… is not defined» no arranque (NAV_GROUPS,
driveOpen, CW, vSettings, registarServico e outros), uma cura do arranque e
uma promessa rejeitada no registo do service worker. Quase todos diziam
«Chrome 153 · Android 6.0.1», que não existe — o Chrome deixou o Android 6
há muito, e esse par é a cara do Googlebot de telemóvel —, e a promessa
rejeitada passava pelo wrsParams, o renderizador do Google. Na versão em
produção cada símbolo em falta está definido num script que carrega antes de
quem o usa; o erro só nasce quando um script anterior não chegou, ou chegou
de outra versão, que é o que o renderizador faz com a cache e o orçamento
dele. Nenhuma pessoa o vê, e cada passagem reabria os pedidos fechados.

A porta fecha-se no servidor (rotas/relatos.js:deRobo): um relato cujo
user-agent, o do cabeçalho ou o que o browser mandou, é de um robô
conhecido, ou cuja stack passa pelo wrsParams, recebe ok e não se grava,
não vai ao Discord e não gasta o tecto do endereço. No servidor e não no
cliente porque apanha também as cópias antigas da app que os robôs guardam.
Os robôs vão nomeados um a um: um /bot/ solto apanhava os telemóveis da
Cubot. O HeadlessChrome fica de fora da lista, porque é o browser dos
percursos de teste, e um erro que lá apareça é para ver.

## 2026-10-19 · A cara nova depois de usada, e a Declaração fica em dev
A v40 ainda não foi publicada, e o Martinho usou-a primeiro em dev. Do que
apontou saíram quatro folhas (os Créditos, os filtros, o deslizar entre
separadores e o modelo sem montante) e três mudanças à mão. As regras vivem
no design.md; aqui fica o porquê.

A Declaração sai de produção. O Martinho ainda não confirmou todas as contas
dela, e uma conta do IRS errada à vista de quem declara é pior do que não a
ter. Fica em dev, onde se continua a conferir. Faz-se no catálogo, com o
soDev (servicos.js:SERVICOS), e não desligando-a conta a conta no back
office: um interruptor por conta deixava de fora as contas novas e voltava
a ligar-se à mão. A pergunta é uma só (servicos.js:servicoForaDoAmbiente),
feita onde já se pergunta se um serviço está ligado
(servicos.js:servicoLigado, acessos.js:separadoresEscondidos), e por isso
todos os caminhos que já respeitam um serviço desligado a respeitam também.
Até o servidor dizer o ambiente vale 'producao', o lado seguro: o pior que
acontece em dev é a Declaração aparecer um instante depois. Por isso o
cloud/guia.js refaz a barra quando o ambiente chega, e repõe a página
guardada: o restorePage do arranque correu sem saber que ela existia, e em
dev um recarregamento na Declaração caía na visão geral.

O plano da hipoteca mostra o primeiro ano mês a mês e o resto ano a ano
(creditos.js:planoLinhas), a pedido do Martinho. O ano que se vive paga-se
mês a mês, e é aí que se quer ver cada prestação; os anos seguintes só
interessam pela soma. Os meses contam a partir da primeira prestação (a
próxima por confirmar), e não de janeiro, para a primeira linha ser sempre
a próxima a pagar. A taxa saiu da coluna própria: a 375px a tabela já rolava
com seis colunas, e a coluna nova, a do que se paga, é a que explica o salto
de uma mista; a taxa lê-se onde muda. As barras da dívida do resumo leem-se
com o dedo pela maquinaria do graficos.js, e não por uma própria
(creditos.js:credBarrasLer): o mesmo gesto, a mesma leitura no canto e as
mesmas regras em toda a app. O desenho ficou, porque o Martinho gosta dele;
só a leitura e a guia ganharam as cores da barra lateral.

O «Limpar» e o «Fechar» dos filtros desapareciam ao rolar um painel
comprido, e o botão dos filtros, primário com o painel aberto, ficava no
telemóvel da cor do cabeçalho, justamente quando era a maneira de fechar.
O pé (vistas.js:fpanelPe) é pegajoso dentro da caixa que já rolava, e não
um cartão partido num corpo que rola e num pé fora dele, como o .sheet:
o cloud/filtros.js segue as listas abertas dos seletores pelo scroll de
`.fpanel .card`, e com outro elemento a rolar elas ficavam paradas enquanto
a caixa andava; e num painel curto o pé assenta logo a seguir aos filtros
sem regra nenhuma a mais. O preço é a caixa não ter padding em baixo e o pé
levar margens negativas para ir de lado a lado. Pelo caminho, escolher a
ordenação no fundo do painel atirava a caixa para o topo, porque o render a
refazia; agora volta à rolagem em que estava (vistas.js:reporRolagemDoPainel).

Deslizar de lado entre os separadores das Casas e do Dinheiro usa a fita da
barra de baixo (continuidade.js:deslizarPainel), e não um vizinho pintado ao
lado. O calendário mostra os meses vizinhos a espreitar porque um mês é uma
grelha pequena; pintar o separador vizinho inteiro enquanto se arrasta era
um render a mais por gesto, e um painel de quinhentas linhas. O nome do
vizinho no vazio diz para onde se vai, e a fita, ao largar, mostra-o a
chegar de onde o dedo deixou a página. «O que rola de lado» mede-se, não se
nomeia (navegacao.js:sepRolaDeLado): uma lista de classes envelhecia a cada
ecrã novo. Só o dedo e a caneta, porque num computador com a janela
estreita arrastar com o rato é selecionar texto; e as bordas de 20px ficam
ao voltar do Android e do Safari, que nasce lá.

> Nota de 2026-10-20: o vizinho passou a ser pintado de verdade enquanto o
> dedo arrasta, a pedido do Martinho («o conteúdo deve ser como um
> carroucel», «a barra de cima não deve ir»), e o nome no vazio ficou só para
> quem pede menos movimento — ver «2026-10-20 · A quinta volta da v40».

O modelo pode ficar sem montante (movimento.js:txMontanteOpcional). O
Martinho nem sempre sabe quanto vai pagar — a luz, a água, uma obra —, e o
modelo serve para não reescrever a descrição, o imóvel, a categoria e a
divisão; o valor escreve-se no dia. Só o modelo que se guarda sozinho fica
sem montante: tudo o que regista um movimento continua a exigi-lo, porque
um movimento de 0 € não tem sentido nas contas. Grava-se 0, e não vazio nem
null, para o normTx e as vistas não mudarem, que já tratam o 0 como «sem
montante». A distribuição da prestação sai do modelo sem montante, em vez de
se gravar a calculada: o movimento que nasce dele calcula a sua com o
montante e a dívida desse dia, e uma distribuição velha seria ruído. As
somas da divisão por valores ficam para o movimento: sem total não há como
as conferir, e recusar o modelo obrigava a inventar um montante.

Dois acertos de desenho. No calendário, um vizinho de seis semanas tem mais
uma fila do que um mês de cinco, e durante o arrasto ela ficava por cima da
legenda: a grelha corta agora em altura enquanto se arrasta
(estilos.css:#calDias.arrasta, overflow-y:clip), e a fila só aparece depois
de largar, quando a fita abre o espaço. Clip, e não hidden, para os
vizinhos continuarem a espreitar dos lados. Na barra lateral, o espaço de
baixo vivia no padding do #nav, e o sticky do fundo parava acima dele: os
grupos viam-se a passar por baixo e pelos lados do fundo. O #nav ficou sem
padding em baixo, e o fundo leva o espaço e a área segura por dentro, com
margens de -14px (estilos.css:.nav-fundo).

## 2026-10-20 · As listas imitam os Movimentos, e a nuvem diz se liga
A segunda volta do Martinho pela v40 em dev. Do que apontou saíram seis
folhas (as listas em duas, as etiquetas, os Colaboradores, as tarefas e a
nuvem) e duas mudanças à mão: a linha «A tua situação fiscal» saiu das
Definições, porque levava para fora delas, à página do IRS · Anexo F, onde a
situação já vive; e o «Movimentos · N» passou à frente na ficha do imóvel.
As regras vivem no design.md; aqui fica o porquê.

Os Movimentos são o modelo, e as outras listas imitam-nos. O Martinho
queixava-se de que, nos Movimentos, o botão dos filtros do cabeçalho era o
«Selecionar vários» e o painel era diferente dos outros, e pediu-o igual. A
resposta foi a contrária da pergunta: os Movimentos ficam como estão — «os
outros menus é que o devem imitar: filtros rápidos, e botão de filtros mais
completos». Por isso há um componente só (vistas.js:lfCabeca), que veste as
classes dos Movimentos, em vez de copiar o markup para cada lista: imitar à
letra é usar o mesmo desenho, e uma cópia afasta-se ao primeiro ajuste. Os
chips rápidos são seletores, o menu da casa vestido de chip, e não as filas
de chips de estado que os Imóveis, os Contratos, os Planeados e os Créditos
tinham: com dois feitios de chip a fila não se lia como uma só. As
contagens por estado passaram para as escolhas do chip («Em vigor · 3») e
não se perderam. Os chips escolheram-se pelo que já existia e é mais usado
(nos Imóveis o arrendamento só no ecrã largo, para a fila caber numa linha
aos 390px). O funil não conta a pesquisa, que está à vista ao lado. A barra
fica no documento na via parcial, em vez de sair e voltar como a dos
Movimentos (lista-movimentos.js:txGuardarNo): um nó que sai do documento
perde o foco, e o teclado do telemóvel fechava-se a meio de uma palavra. E
fica por cima do que filtra, não sempre no topo: o cartão «Por confirmar»
dos Planeados e o resumo dos Créditos não seguem os filtros, e um chip por
cima deles dizia o contrário. Nos Créditos a coluna passou a ser a mesma em
todos os ecrãs (as liquidadas por baixo das ativas, atrás de um botão): com
o estado num chip, «Ativas e liquidadas» tem de mostrar as duas, e os chips
Ativas / Liquidadas do computador escolhiam uma ou a outra e contradiziam o
filtro. Os intervalos das Visitas passaram a campos da grelha com o nome
inteiro à vista, como o «De» e o «Até» dos Movimentos, para o leitor de ecrã
ouvir o que se vê. Fecha a dívida do «✕» em texto na pesquisa das listas: o
limpar é o ic('x'), com o nome «Limpar a pesquisa» (vistas.js:lfBarraHtml).

O «Limpar» e o «Fechar» vão no topo do painel das listas, ao lado do título,
como nos Movimentos. Desfaz o pé preso ao fundo da véspera nas listas: o
Martinho escolheu o feitio dos Movimentos, e um painel com os botões em
cima e outro com eles em baixo era o que ele tinha pedido para acabar. O pé
(vistas.js:fpanelPe) fica só nas análises, que ele pediu para não mudarem.

O «Selecionar vários» fica no cabeçalho dos Imóveis e dos Contratos, as
listas que têm seleção de vários; nas outras cinco o botão do cabeçalho sai
(vistas.js:LF_COM_CABECALHO). Abrir o mesmo painel que o funil ao lado da
pesquisa eram dois botões para a mesma coisa. O «Selecionar vários» é da
camada da seleção e não da base (cloud/selecao-listas.js:selLCabecalho),
porque a nuvem repõe o título e o nome do botão depois de cada render e só
quem corre depois dela o pode vestir; sem a camada, o botão continua a abrir
o painel. Em seleção, o cabeçalho segue o dos Movimentos — a caixa de tudo e
a contagem no lugar do título —, porque o toque longo o deixava vazio, só
com o hambúrguer e a nuvem.

Nas etiquetas dos Movimentos basta uma (lista-movimentos.js:txTemEtiqueta):
foi o que o Martinho pediu, «várias, basta uma». As etiquetas marcam coisas
diferentes («Urgente», «Dedutível»), e a pergunta habitual é «mostra-me o
que é urgente ou dedutível». Contam como um filtro no funil, como as datas:
o número diz quantas escolhas de filtro há, e cinco etiquetas não são cinco
filtros. O chip rápido só aparece com etiquetas escolhidas, porque o menu
da casa é de escolha única e a fila do telemóvel já enche uma linha. Um
filtro comum não guarda etiquetas, e por isso aplicá-lo limpa as escolhidas
(definicoes.js:aplicarFiltroComum): somadas ao comum, o chip dele não
aparecia ligado e o filtro não era o que se tinha escolhido. Apagar uma
etiqueta tira-a do filtro (definicoes.js:delTag); as escolhidas que deixam
de existir por outro caminho continuam no painel, para se poderem desligar.

O «Movimentos · N» é o primeiro chip da ficha do imóvel, aceso a cobalto e
com a contagem (imovel.js:imvAcoesRapidas): o Martinho pediu-o «mais
saliente». É o que mais se procura na ficha, e no fim da fila, que rola de
lado, ficava fora de vista.

Os Colaboradores são das Pessoas. O Martinho procurava-os lá, e estavam nas
Definições desde o canvas de 2026-10, como «arrumação da conta». Quem ajuda
a gerir é gente, como os inquilinos e os proprietários: passaram a terceiro
segmento das Pessoas (navegacao.js:PESSOAS), e a linha «Colaboradores e
cargos» saiu das Definições. A contagem é de pessoas e só aparece depois de
o servidor responder (cloud/colaboradores.js:contarColaboradores): um «0»
antes disso afirmava o que ainda não se sabe. O resumo da linha que saiu
(pessoas e convites) ficou como subtítulo do ecrã no computador.

As tarefas. A secção criada no formulário grava-se com a tarefa, e não logo
(tarefas.js:tfSecNovas): gravar logo repintava a janela da lista por baixo
do formulário e deixava uma secção vazia a quem cancelasse. A tarefa
agarrada flutua acima do dedo, porque debaixo dele tapava o que o pedido
manda mostrar — a linha entre as duas tarefas e o nome da secção acesa. A
alternativa ao arrasto é a própria pega, um botão que abre o «Mover tarefa»
(tarefas.js:tfMoverTarefa): um ⋯ por tarefa acrescentava um terceiro alvo a
cada linha de 358px. O recolhido é do aparelho, como a gaveta: um telemóvel
e um computador pedem arrumações diferentes. E uma secção recolhida continua
a ser alvo, como o pedido diz, com um aviso a dizer para onde foi a tarefa.

A nuvem diz se está ligada. O Martinho pediu-a laranja com um relógio
enquanto a app tenta ligar, verde quando liga, vermelha com uma cruz quando
não liga, e laranja de novo em cada nova tentativa. O laranja é o --out, e
não o --warn: o --warn é âmbar acastanhado, era a cor do «Sem ligação» de
antes, e os dois lado a lado confundiam-se; os pares dão 4,5:1 ou mais nos
dois temas. O relógio senta-se na base da nuvem, que abre para ele: um
relógio inteiro lá dentro, no traço de 1.8 e a 18px, era uma mancha. Não
roda: uma peça a girar no cabeçalho até 45 segundos, ou de 30 em 30 sem
rede, era ruído. Sem ligação, o ciclo tenta a cada 30 segundos
(cloud/nucleo.js:syncCycle) em vez de esperar pelo intervalo de leitura,
que chega a meia hora parado: é o «laranja de novo em cada nova tentativa»,
e o vermelho não fica mais tempo do que a falta de rede; sem rede, um
pedido falhado não chega ao servidor e não gasta a D1. No telemóvel o «A
ligar» da abertura é só o ícone, e a tentativa depois de uma falha fica com
a faixa, laranja, para o cabeçalho não mexer de 30 em 30 segundos. À vista,
«Sem ligação ao servidor»; o «— sincroniza mais tarde» ficou no aria-label:
com ele a frase tinha 340px e, entre 901 e 1024px, comia o título do ecrã.

O segmentado do destino e do tipo de arrendamento desliza, e o formulário
cresce (pedido do Martinho no mesmo dia: «devem deslizar em vez de fazer pop
no outro lado, e o ecrã deve crescer»). O realce passou a peça própria porque
a repintura do formulário troca o segmentado inteiro, e uma transição CSS no
botão velho nunca chegava a correr: a peça nova nasce no sítio novo e
anima-se a partir do velho. A altura vai pela única caixa onde os campos
mudam (o primeiro grupo), como no painel do dia do calendário — uma caixa
só, e não a janela inteira, que no computador está centrada e saltaria de
sítio a cada fotograma.

## 2026-10-20 · A terceira volta da v40: sem saltos, por quartos, e sem o filtro de proprietário
A terceira volta do Martinho pela v40 em dev, no mesmo dia. Do que apontou
saíram seis folhas — o formulário e a ficha do imóvel, os contratos e as
visitas, a seleção nos Planeados, o cartão da Agenda, as Projeções e a
Avaliação, e o filtro de proprietário — e duas mudanças à mão: o ⋯ aberto
fecha ao rolar (web/app/arranque.js, o ouvinte de scroll na captura), e o
«Selecionar vários» e as opções de uma análise ganharam ícone próprio
(icones.js:caixaVisto, icones.js:roda). Quatro perguntas foram ao Martinho
antes de se escrever código, e as respostas estão abaixo. As regras vivem no
design.md; aqui fica o porquê.

O formulário do imóvel saltava ao passar a Uso próprio ou a Imóvel inteiro
(«o UI salta, faz uma animação estranha»). Mediram-se três defeitos,
fotograma a fotograma, antes de se mexer: numa grelha a encolher, a altura
a mais repartia-se pelas linhas (o nome descia 70px, a morada 210px, o
segmentado 280px, e voltavam); medir depois de pintar prendia o scroll ao
fundo novo, e o conteúdo saltava 303px; e o que saía sumia de golpe,
deixando um vazio a encolher. A caixa que cresce
(continuidade.js:crescerEmAltura) passou a acompanhar as peças lá dentro
(continuidade.js:acompanharPartes), pela chave data-parte, em vez de só
animar a altura: animar só a altura era o que deixava o vazio. O que sai
fica dentro da caixa, que o recorta, e não na camada de saída das listas,
que vive por baixo das janelas.

O realce do segmentado tem de se ver no escuro («o slider desapareceu em
modo escuro»). No escuro a escolha acesa era o --card, mais escuro do que o
trilho, com uma sombra que lá não se vê. Passou ao --line2 sem sombra, 1.52:1
contra o trilho — e em todos os segmentados, não só no do formulário: o
tipo do movimento, o tema, o «pago por» e as abas da área tinham o mesmo
defeito, e um segmentado que se visse e os outros não era pior. No claro
fica como sempre: o branco com a sombra lê-se.

As Projeções e a Avaliação só com os chips e a roda dentada. O Martinho
escolheu «B · só os chips»: sem pesquisa (numa análise não há o que
procurar), sem funil e sem painel, com o chip «Imóvel» no sítio da barra das
outras listas. O lfCabeca põe sempre a pesquisa e o funil e guarda o estado
no lf(k) de uma lista, e o foco de uma análise é do serviço (projProp,
repProp): ensiná-lo a ler o estado de fora e a calar metade do que faz era
dobrar o componente, e o chip com as mesmas classes (vistas.js:anaChips) dá
o mesmo desenho. Os números da projeção não são filtros: estavam na página,
numa barra, e competiam com o chip no topo. A roda abre uma janela, e não um
painel ancorado, porque são poucos campos e no telemóvel a folha de baixo é
o sítio das opções; o desenho é o das Definições › Valores por omissão,
porque são os mesmos valores, e uma terceira forma de os escrever era ruído.
Gravam ao escrever, e não só ao sair: o Escape fecha a janela sem passar
pelo blur, e perguntava «Sair sem guardar?» de um valor que o resto da app
diz que já está gravado. A roda volta a escrever o nome numa microtarefa
(vistas.js:pintarRoda), porque as camadas da seleção, que correm depois do
render, ainda despem o botão pela marca e não pelo valor; sai quando elas
compararem pelo valor, como o cloud/painel.js:patchHdr já faz
(cloud/painel.js:HDR_CONCLUIR).

O filtro global de proprietário saiu de todo. O Martinho escolheu «tirar de
todo»: sai da gaveta, da faixa por cima da vista e dos filtros das listas,
das análises e dos filtros comuns. Era um estado escondido que mudava todos
os números da app (a quota-parte) a partir de um sítio só, com uma faixa
para o lembrar; com dois ou três donos, quem quer saber de um procura-o ou
abre a ficha dele. O ownerFilter ficou, como titular do IRS · Anexo F: a
declaração é por titular (é ele que entrega o anexo), e o fisco.js lê o
titular dali — tirá-lo partia o IRS, e dar ao titular um estado próprio é
trabalho do fisco.js. Para não haver um filtro escondido, o render e a
mudança de separador largam-no fora do IRS (ambito.js:ambitoSemDono): a
regra é «fora do IRS é sempre ''», e não «ninguém o escreve», que um atalho
antigo ou um filtro comum guardado podiam desmentir. A canalização
(ambito.js:visiveis, ambito.js:scope, a quota do saldos.js:sh) ficou: com o
ownerFilter vazio é a identidade, e tirá-la era refazer as contas da quota
em seis ficheiros e uma dúzia de testes de aritmética sem mudar nada do que
se vê. O «Ver a app na quota de …» da ficha do proprietário saiu com ele:
sem o filtro, levava à Visão geral e não mudava nada.

O cartão «Por confirmar» na Agenda. O crachá da Agenda contava os planeados
vencidos e não silenciados, mas a Agenda não mostrava nenhum: o Martinho via
um «1» no ícone sem perceber de onde vinha. Pediu, «no calendário, por baixo
de marcar visita e movimento recorrente, um cartão abatível com os por
confirmar». O cartão usa as linhas dos Planeados para confirmar ali mesmo, e
o crachá passou a contar pela mesma função que o cartão mostra
(calendario.js:calPendentes): o número do ícone e o do cartão não podem
discordar. Abre fechado, com uma chave sua: nos Planeados a lista é a razão
de lá se ir, na Agenda é um aparte do mês.

O toque longo nos Planeados abre as opções. O Martinho respondeu que o
toque longo abre as opções, com «Selecionar vários» no fim
(planeados.js:lpPortaSelecao); nos Imóveis e nos Contratos continua a
selecionar. Em seleção, o toque longo marca como o toque: nos Imóveis e nos
Contratos voltava a entrar e deitava fora o que estava marcado.

Ou planeados ou modelos na seleção, nunca os dois. As ações não são as
mesmas (um modelo não se silencia), e uma barra que servisse os dois teria
de explicar a cada toque o que fazia a cada um. Tocar no outro tipo sem
marcas troca; com marcas avisa e não as deita fora — perder uma seleção de
cinco por um toque ao lado era pior do que um aviso. O Silenciar e o
Reativar só aparecem com os marcados todos no mesmo estado, como o Martinho
pediu («silenciar todos se estiverem todos ativos, reativar todos se
estiverem todos silenciados»): um «alternar» trocava uns para um lado e
outros para o outro. As regras de apagar um planeado (planeados.js:recTirar,
planeados.js:recRepor) passaram a viver uma vez em planeados.js, usadas pelo
delRec e pela seleção: a seleção tinha de fazer aos automáticos exatamente o
que o delRec faz, e duas cópias divergiam à primeira mudança.

O contrato da casa inteira é recusado num imóvel com quartos arrendados. O
pedido do Martinho: uma casa arrendada por quartos com quartos já
arrendados não pode ter um contrato da casa toda; o que se arrenda são os
quartos que sobram. O formulário abria no «Imóvel inteiro» e deixava
escolher um quarto já arrendado «para o contrato seguinte», e quem gravava
sem reparar criava um contrato da casa toda por cima dos dos quartos. Agora
abre no primeiro quarto livre, os arrendados não se escolhem, e o guardar
recusa a casa inteira (contrato.js:ctSaver): o contrato seguinte de um
quarto faz-se quando o de agora acabar, ou renovando-o. Os arrendados ficam
à vista, desligados, em vez de desaparecer: dizem porque é que o quarto não
está na escolha, e sem nenhum livre explicam a frase de que não há contrato
novo possível. A exceção é o que já estava gravado — um contrato antigo da
casa inteira, ou um quarto partilhado por dois contratos, continua a
editar-se (contrato.js:ctInteiroGravado), para não trancar dados de antes da
regra. No contacto do senhorio, o telefone não parte a meio e o email e o
nome partem onde for preciso: um «912 345 / 678» lê-se mal, e por isso não
é só um overflow-wrap no texto todo.

Fica uma questão em aberto, levantada pela folha da Agenda. A regra da casa
diz que a --curva-sai serve o que se fecha (ver «Movimento», no design.md),
e as secções da gaveta fecham nela (estilos.css:.navsec-corpo). Mas o guia
do movimento (/animate) desaconselha numa interface curvas que arrancam
devagar: a --curva-sai (cubic-bezier(.4,0,1,1)) atrasa o instante para que
se está a olhar. O cartão «Por confirmar» da Agenda abre e fecha na
--curva-entra (estilos.css:.cal-pend-corpo), e as duas dobras que se veem
iguais fecham hoje com curvas diferentes. Falta decidir se a regra continua,
ou se passa a valer só para o que sai do ecrã a deslizar (a gaveta, o
toast).

## 2026-10-20 · A quarta volta da v40: o realce que o Samsung escurece, as fotos em carrossel e os quartos a partir do fim
A quarta volta do Martinho pela v40 em dev, ainda no mesmo dia. Saíram cinco
folhas — o realce dos segmentados, as fotos em carrossel, as datas dos
contratos por quartos, o toque longo dos Planeados e o botão de partilha da
Avaliação — e duas mudanças à mão: o Início e o Fim da visita em duas
colunas iguais (estilos.css:.vis-par), e o fecho dos ⋯ ao rolar
(web/app/arranque.js) a pôr o aria-expanded do botão a false, pelo
componentes.js:menuExpandido, como o clique fora já fazia. As regras vivem
no design.md; aqui fica o porquê.

**O seletor do imóvel não se via no telemóvel do Martinho.** «Não consigo
ver (tenho modo escuro no OS e tem um efeito diferente no tema da aplicação
do que só o tema escuro ou tema claro).» A pergunta que desfez o mistério
foi qual o browser: o Samsung Internet, com o tema da app em Automático e o
telemóvel em escuro — e a app aparecia clara. O que se aprendeu:

- O Samsung Internet tem um modo escuro próprio que escurece as páginas à
  força, transformando as cores que o autor escreveu, sem lhe pedir licença
  (o blog da Samsung chama-lhe «Force Dark Mode», o nome do Chrome:
  https://developer.samsung.com/internet/blog/en/2020/12/15/dark-mode-in-samsung-internet).
  Nesse modo a página ouve prefers-color-scheme:light, e o Automático da app
  pinta o claro — que o browser depois inverte. O mesmo blog descreve uma
  escolha experimental entre só escurecer à força, só a media query, ou
  preferir a media query quando o site declara o color-scheme; na versão que
  o Martinho tem, é o «Definições → Labs → Usar o tema escuro do site».
- Há programadores a dar com o mesmo: o tema escuro do site passado por cima
  pelo escuro do Samsung Internet
  (https://forum.developer.samsung.com/t/websites-dark-mode-gets-overridden-by-samsung-internets-default-dark-mode/22937).
  O meta color-scheme, que no Chrome do Android chega para desligar o
  escurecimento no claro («only light», ver o design.md), no Samsung
  Internet não chega.
- O WebView do Android tem as mesmas peças com outros nomes: o
  prefers-color-scheme vem do tema da app (isLightTheme), e o escurecimento
  algorítmico só corre quando a app o deixa e o autor não o desliga; com o
  escurecimento só do browser, a media query de escuro dá falso
  (https://developer.android.com/guide/webapps/dark-theme). A app Android
  já desliga o escurecimento no seu WebView; no browser, quem decide é o
  browser.
- A página não consegue saber que está a ser escurecida: o getComputedStyle
  continua a dar as cores claras, porque o filtro é da pintura. No
  Chromium, o escurecimento forçado liga-se com
  `--blink-settings=forceDarkModeEnabled=true`; o
  `--enable-features=WebContentsForceDark` não faz nada no headless shell, e
  o contraste só se mede nos pixeis da captura.

Medido assim: o fundo do realce (o branco com sombra sobre a pista quase
branca) caía a 1.1:1 da pista — dois pretos quase iguais —; uma sombra por
dentro ficava no cobalto escuro, a 2.5:1; uma borda no cobalto, que para o
filtro é cor da frente, passava a azul claro a 3.3:1. Ficou o contorno de
2px no --accent, com o fundo --accent-soft e o texto --accent-text, o
desenho que os chips e as opções já tinham, em todos os segmentados e nos
dois temas: o defeito era o mesmo em todos, e o realce do escuro da volta
anterior (o --line2, 1.52:1) era também só luz. O tipo do movimento acende
o contorno no cobalto e só o texto na cor do dinheiro, porque o verde e o
laranja, escurecidos à força, ficam escuros contra a pista (2.1:1 e 2.7:1).
Ponderado: o --accent-text no contorno dava 4.1:1 sob o escurecimento, mais
margem, mas o --accent já passa o 3:1 do WCAG para componentes; fica
registado, se o aparelho mostrar pouco. Como a app não sabe que a escurecem,
a nota nas Definições → Tema aparece só no Samsung Internet e só em
Automático (definicoes.js:notaDoSamsung): diz onde se desliga, ou que se
escolha o Escuro da app. Uma nota para todos falava de um problema que a
maioria não tem.

**As fotos de um imóvel em carrossel, com volta, e as setas só no
computador.** «A ver as fotos, quero poder fazer scroll lateral entre elas.
No final faz loop.» O gesto é o do calendário e dos separadores (o eixo aos
10px, um quarto da largura ou um sacudir), para o dedo não ter de aprender
um terceiro. O palco tem tamanho fixo e a foto cabe inteira: com fotos ao
alto e ao comprido no mesmo imóvel, a janela saltava de altura a cada
passagem, e a fita não pode correr numa caixa que muda a meio; o quadrado é
o meio-termo entre as da sala (ao comprido) e as do telemóvel (ao alto).
Duas curvas na mesma fita: das setas parte parada; largada por um dedo já
vai à velocidade dele, e uma curva que arranca a zero travava no instante
em que o dedo saía. As setas veem-se só com rato — no dedo o gesto é o
caminho, e duas setas por cima da foto tapavam-na —, e ficam para o leitor
de ecrã e para o Tab. O teclado passa sem fita, que um atalho de teclado não
anima. Com uma foto só não há carrossel: setas e «1 de 1» eram ruído.

**O Início e o Fim da visita enchem a linha.** «Não ficam centrados. Quero
que preencham o espaço disponível de forma uniforme.» As duas colunas da
largura da hora, encostadas à esquerda, deixavam um vazio à direita; duas
colunas iguais (repeat(2,minmax(0,1fr))) repartem a linha.

**A casa inteira e os quartos arrendados voltam a escolher-se, a partir do
fim.** A volta anterior tinha tirado o «Imóvel inteiro» de um imóvel com
quartos arrendados; o Martinho corrigiu: um contrato da casa inteira, ou de
um quarto arrendado, faz-se desde que comece no dia do último fim dos
contratos dos quartos (o do contrato mais longo), ou depois. É o caso de
quem já sabe quem entra quando os quartos vagarem. O dia do fim conta,
porque foi assim que o pedido o disse. Um contrato sem data de fim bloqueia
(resposta do Martinho): sem fim não há data a partir da qual a casa fique
livre, e o chip da casa inteira nem aparece, que nenhuma data o mudaria. A
escolha não se perde ao mudar o início: quem recua a data vê o erro junto
do campo e decide, e trocá-la sozinha esconderia a mudança. A data de cada
quarto lê-se no chip dele, e a frase fica para a casa inteira e para a
regra — uma lista de quartos e datas, com quatro quartos, ninguém a lia.

Sem quartos livres, o contrato abre no 1.º quarto da lista que tenha fim,
com o início nesse fim (resposta do Martinho). A ordem da ficha é a que a
pessoa conhece; «o que vaga primeiro» mudava de quarto conforme as datas.
Tocar num chip «livre a …» muda o início para essa data (outra resposta),
em vez de obrigar a ir ao campo da data, e um aviso di-lo. Para o toque
chegar, o chip deixou de ser disabled e passou a aria-disabled, com o
rótulo «livre a …, toca para começar nessa data»; só o «já arrendado» sem
fim fica disabled, porque não há data para onde ir.

**O toque longo dos Planeados e dos Modelos entra na seleção, como no resto
da app.** «O longpress dos planeados deve ter o mesmo comportamento que o
resto da app.» Substitui a resposta da volta anterior, em que abria as
opções com «Selecionar vários» no fim: o mesmo gesto a fazer coisas
diferentes conforme a lista obrigava a aprender cada ecrã, e as opções de
um só já estavam todas no ⋯ da ficha, a um toque. O «editar no fundo» do
pedido é a barra de sempre — Silenciar com todos ativos, Reativar com todos
silenciados, e Apagar. Entra-se mesmo num planeado que não posso silenciar
nem apagar, como nos imóveis: as ações da barra recusam com a razão e
contam os que ficam de fora.

**O «Partilhar» da Avaliação num menu, atrás do ícone dos três pontos
ligados.** «O partilhar ou exportar CSV deve estar dentro de um botão de
partilha, com icon de partilha.» Os dois botões de texto ocupavam uma linha
só deles no telemóvel; um botão de ícone cabe na linha do chip, e a página
ganha essa altura. O menu é o da casa, escrito à mão, porque o
componentes.js:menu leva sempre o ⋯ e o nome «Opções»; abre pelo mesmo
menuOpen, para fechar e se posicionar como os outros. O ícone é o dos três
pontos ligados (icones.js:partilhar), e não a seta a sair da caixa: a app
vive no Android (a app e o Samsung Internet), onde a partilha é esse sinal,
e a seta para cima ao lado do «down» das descargas lia-se como «carregar».

**Os menus ⋯ têm aria-expanded e fecham com o Escape.** Ao rever o botão de
partilha viu-se que nenhum ⋯ da casa dizia ao leitor de ecrã se estava
aberto, e que o Escape não o fechava (só o sel() e as janelas o ouviam). O
botão nasce com aria-expanded="false" e muda ao abrir e ao fechar, pelo
clique fora, pelo scroll ou pelo Escape (componentes.js:menuEscape), que
devolve o foco ao botão e deixa a janela de baixo onde está. O fecho ao
rolar tirava o .on sem passar pelo closePops, e o botão ficava a dizer
«aberto» com o menu fechado: foi a mudança à mão no arranque.

## 2026-10-20 · A quinta volta da v40: o carrossel dos separadores, uma seleção só, os Inquilinos e as Visitas selecionáveis, o Anular que se afasta e o Início que não é uma casa
A quinta volta do Martinho pela v40 em dev, ainda no mesmo dia. Saíram
quatro folhas — o carrossel dos separadores com as abas paradas, a seleção
dos Movimentos como a das Casas, os Inquilinos e as Visitas selecionáveis
(com a barra dos Planeados), e o cartão do «Anular» que se puxa para baixo —
e uma mudança à mão: o ícone do Início e a marca. As regras vivem no
design.md; aqui fica o porquê.

**Deslizar entre os separadores de uma área é um carrossel.** «Quando faço
scroll lateral nos movimentos, casas, etc, a barra de cima não deve ir. Deve
deslizar para o submenu correspondente. O conteúdo deve ser como um
carroucel.» Reverte o que se tinha decidido no dia 19 (a nota está lá, em
«A cara nova depois de usada»): o vizinho pinta-se de verdade enquanto o
dedo arrasta (vistas.js:pintarVistaAParte), e as abas da área ficam paradas
por cima, com o realce a correr entre as duas (navegacao.js:abasPolegarEm).
O custo que antes nos fez recusar — um render a mais por gesto — paga-se uma
vez por lado e por gesto, no arranque (navegacao.js:sepVizinho), e mediu-se:
com os dados de exemplo, 3 a 16ms a 1x e 11 a 80ms com o processador a um
quarto; o pior é ter os Movimentos como vizinho (~80ms de JavaScript e um
fotograma de ~200ms a 4x), menos do que o render que qualquer ida aos
Movimentos já custa nesse processador (220 a 330ms). A pintura é o render de
sempre, e não um esboço: um vizinho sem os pendentes por confirmar mudava de
forma no fotograma em que chegava.

As abas saíram do #view para a casa delas (index.html:#abasArea,
navegacao.js:abasAssentar), porque um nó que se repinta por cima de si mesmo
não desliza o realce, e porque o arrasto e a fita movem o #view inteiro. De
área para área elas entram com o conteúdo (continuidade.js:abasNaFita): são
a cabeça de outra página. Os Inquilinos, os Proprietários e os Colaboradores
ficam fora da fila, como antes. A espreita do nome ficou só no caminho sem
movimento.

**Os Movimentos selecionam-se como as Casas.** «O modo de seleção multipla
no menu casas é diferente do do menu dinheiro. Quero que seja igual ao das
casas, tendo em conta os botões que já existem. Mantém os botões, muda o
feel e visual.» A resposta do Martinho fixou o modelo: o das Casas, em todo
o lado. Saíram o deslize do nome do mês — o FLIP à mão do cloud/selecao.js,
com os fantasmas das caixas na camada de saída da continuidade — e as caixas
por mês, que só os Movimentos tinham; o título do mês ficou igual dentro e
fora da seleção, sem caixa e sem se colar ao topo. As caixas entram a
desvanecer como as das Casas (cloud/selecao.js:selCaixasEntram), e sair é
sem animação, como lá. O «⋯» que o botão do cabeçalho era em seleção saiu,
com o menu das ações que abria: as ações estão todas na barra do fundo.

A barra passou a ser a delas — × Cancelar, a contagem ao meio, as ações — e
foi para o body (cloud/selecao.js:selBarraPor), para não andar com o #view.
No telemóvel ficou em duas linhas, como na prévia que o Martinho escolheu:
os quatro botões dos Movimentos (Categoria, Etiquetas, Editar, Apagar) não
cabiam numa linha com o Cancelar e a contagem a 375px, e com o ícone por
cima de um rótulo curto cabem lado a lado. O toque longo em seleção passou a
marcar, como nas Casas: antes voltava a entrar na seleção e deitava fora o
que estava marcado. A linha marcada ganhou o realce dos cartões das Casas, e
o contorno, que é cor da frente, distingue-a no escurecimento forçado do
Samsung Internet (ver a volta anterior).

**Os Inquilinos e as Visitas selecionam-se; os Proprietários não.** «As
pessoas e visitas também devem ser selecionáveis. Para as visitas, para
além de apagar vários, devo poder marcar como realizada ou como falta. Para
as pessoas, devo poder apagar várias.» O pedido dos proprietários — ver as
casas partilhadas com ele e as percentagens — já existia: a ficha tem
«Imóveis e quota-parte», e cada imóvel abre a ficha dele. O Martinho («Não
vi que já existia») deixou-a como está, e a seleção nas Pessoas é só nos
Inquilinos. As visitas da Visão geral usam a mesma linha, mas não se
selecionam: a seleção é do separador das Visitas.

Quem não se pode levar não se marca (cloud/selecao-listas.js:selLRecusa):
marcar e só ouvir a recusa no fim era um botão que serve para ouvir «não
podes»; assim o toque diz porquê logo ali. Apagar vários inquilinos tem
Anular, ao contrário do delPerson de um só, porque é o padrão da barra e
são vários de uma vez; por isso os documentos esperam pelo fim do Anular
para sair do IndexedDB (cloud/selecao-listas.js:selLApagarInquilinos).

A barra dos Planeados escondia a contagem no telemóvel, e o Cancelar
encolhia para só o ×, porque não cabiam ao lado de três botões. Com as
ações numa segunda linha (estilos.css:.sel-l-duas) — a forma da prévia que o
Martinho escolheu para os Movimentos —, cabem a contagem, o nome do
Cancelar e as ações a 375px; as Visitas, com Realizada, Falta e Apagar,
usam a mesma.

**O cartão do «Anular» puxa-se para baixo.** «Devo poder deslizar para
baixo o cartão que aparece que permite anular quando apago alguma coisa.
Posso querer ver alguma coisa que está por detrás dele.» Fechá-lo é só tirar
o cartão da frente — por isso não anula (seria a ação contrária ao gesto)
nem liquida mais cedo: os seis segundos de arrependimento não mudam por se
ter afastado o cartão. O prazo pausa com o dedo pousado
(componentes.js:avisoPousar) porque o «Anular» à vista com o desfazer já
liquidado repunha um registo sem os ficheiros do IndexedDB. Só o dedo e a
caneta arrastam (componentes.js:AVISO_PONTEIROS): com o rato, arrastar é
selecionar texto, e no computador o aviso não tapa o que tapa no telemóvel.

**O Início deixou de ser uma casa, e a marca voltou a ser.** «O icon de
inicio e de casas na barra de navegação são demasiado parecidos.» A casa do
Início e a casa das Casas, lado a lado na barra de baixo, liam-se como o
mesmo destino; o Início passou a ser os quatro mosaicos do ícone `painel`
(icones.js:ic, navegacao.js:BARRA_ROTULO). No mesmo pedido: «Quero que o
icon da aplicação na gaveta seja como o antigo. o mesmo formato, não
necessariamente a mesma cor.» A marca (estilos.css:.marca) voltou a ser a
casa do ícone da app — o telhado com beirais, as paredes e a porta pequena,
o `home` do icones.js:ic —, em branco no quadrado cobalto: a forma é a dos
ícones da PWA e do Android, e a cor fica a da cara nova.

## 2026-10-22 · Um proprietário é uma conta: a lista das partilhas e o realce que ficava preso

**O realce que ficava preso.** «Quando clico em qualquer botão, até eu
clicar em mais algum, aquele fica com cor de highlight. Uma cor mais clara.»
A regra já dizia que o realce de passar por cima só existe com rato, mas
dezassete :hover de base — o .btn e as variantes, o .iconbtn, o .chip, as
opções dos menus e dos seletores, o .card.tap — tinham ficado fora do
@media(hover:hover). No Android o :hover cola-se ao último elemento tocado
até se tocar noutro sítio, e o botão fica com o --tint até lá. Foram todos
para dentro do portão, e o fecho da gaveta deixou de precisar do desfazer
no dedo; o testes/estilos.test.js chumba um :hover solto.

**Um proprietário é uma conta.** «O meu nome não deve estar listado. É uma
lista de proprietários com que tenho casas partilhadas»; e, perguntado o que
fazer às fichas feitas à mão: «Não é suposto haver fichas criadas à mão. Só
contas reais.» Com sessão — que em produção é sempre — o db.owners já se
refazia só dos perfis do servidor (cloud/nucleo.js:rebuildDb), as fichas à
mão nunca subiam e caíam na leitura seguinte, e as quotas de uma casa
partilhada já só mudavam por proposta (cloud/utilizadores.js:cwOwnersBlock).
O que sobrava eram as portas que criavam uma ficha fantasma — o + e o
cabeçalho, o vazio da lista, o «Criar novo» do formulário do imóvel — e
saíram. Por isso apagar as fichas que havia não pediu migração: no servidor
o KINDS_RETIRADOS já as apagava, e no aparelho não sobrevivem a uma leitura.

A lista (pessoas.js:donosComPartilha) é a das outras contas com quem
partilho: uma casa em comum, uma ligação ativa — o Martinho quis que uma
ligação sem casas também apareça — ou um grupo partilhado. Ficam de fora eu
e quem só é referido nos movimentos (contas apagadas, ex-comproprietários),
que continua no db.owners para o «Pago por» se ler. O selo «Tem conta» saiu
da linha: na lista todos têm.

**O cadeado deu lugar ao botão.** A nota «só quem tem a conta o edita…
desfaz a partilha em Pessoas → Proprietários» mandava o utilizador para
outro sítio fazer o que queria fazer ali. O rodapé da ficha de outro com
conta leva «Editar casas partilhadas» (pessoas.js:casasPartilhadasDaFicha):
a ligação abre as «Casas partilhadas» dela; quem só partilha comigo por um
grupo não tem ligação, e aí abre os meus imóveis do grupo
(cloud/grupos.js:CW.casasDoGrupoCom) — a escolha do Martinho entre isso,
nada, ou um botão para ligar. A ação vem da nuvem por um gancho
(pessoas.js:partilhaComDono), porque a base não chama funções de serviço sem
guarda.

## 2026-10-22 · O realce que ainda ficava, a ligação repetida e as listas por origem

**O realce continua: o foco e a caneta.** «O realce continua. Estou a
experimentar nas abas dos menus casas e dinheiro», e depois: «Seleciono uma
aba (contratos, imóveis, etc) e faço scroll para o lado. A aba que selecionei
permanece com highlight.» Reproduzido com toques a sério (Playwright com
hasTouch e toques pelo CDP): depois de tocar em «Contratos» e deslizar para
Pessoas, o <a> de Contratos continuava com :focus e :hover. O Chrome não pinta
nenhum dos dois; o Samsung Internet do Martinho pinta. Duas causas. O foco: um
toque dá-o ao elemento, e as abas vivem fora do #view, por isso o foco ficava
lá depois de o conteúdo deslizar. E o :hover: as abas são um <nav>, e o nav
a:hover da barra lateral apanha-as; alguns Galaxy com caneta respondem
(hover:hover) num ecrã de dedo, e o portão da correção de 16d279b não chegava.
Agora o toque larga o foco (eventos.js:largarFocoDoToque) — antes de a ação
correr, porque depois era tarde para o gatilho do openModal e para as
repinturas que devolvem o foco ao nó novo — e o portão do rato pede também
(pointer:fine), o mesmo que a landing e as páginas legais já usavam. O
teclado não muda: o click dele não tem ponteiro. Não há Samsung nesta
máquina: a prova é o reprodutor com toques reais, não o browser dele.

**A ligação aparecia duas vezes.** «A outra conta com que partilho casas
aparece duas vezes. Na listagem tipo contactos (a 1a lista, e é onde deve
ficar) e antes de inserir o id de outro user.» O cartão de baixo dos
Proprietários repetia as ligações ativas que a lista de cima já mostra; ficou
para o que ainda não é ligação — os convites por responder, o campo, os
pedidos e a ligação de partilha (partilha.js:comproprietariosCorpo). «Não
quero que diga "o id dele". Mas "o id do outro utilizador"»: o rótulo, a dica
e o erro do campo vazio. O «Remover ligação», que vivia no ⋯ da linha que
saiu, foi para onde o Martinho o pôs: «Fica num kebab no topo da ficha do
proprietário. Ao lado do x para fechar» (pessoas.js:removerLigacaoDaFicha).
Removida, a ficha fecha se ele saiu da lista; se continua por um grupo, fica
aberta e repinta-se — por isso o rodapé da ficha passou a ler-se a cada
repinte, em vez de ficar a apontar para a ligação que já não existe.

**As listas por origem.** «Quero que as casas na lista de imóveis, os
inquilinos, as visitas e os contratos, estejam divididos em 3 secções. "Os
meus ...", "partilhados comigo", "em que colaboro". Deve haver o filtro
correspondente.» Numa lista misturada, uma casa onde só se tem um cargo
parecia nossa. A origem lê-se do imóvel (acessos.js:origemDaCasa), e o
Martinho escolheu: as Próximas/Passadas das visitas e os grupos por imóvel dos
contratos ficam dentro de cada secção; com uma origem só não há títulos — é o
caso de quase toda a gente, e um título que não separa nada é ruído. O chip
«Origem» decide se aparece pela lista inteira e não pelo que a pesquisa deixa,
para não aparecer e sumir a cada tecla; um valor guardado que deixou de
servir sai do estado, para o funil não contar um filtro que não se vê.

## 2026-10-22 · Os Grupos nas Casas, a página Segurança e os títulos das secções sempre

**Os Grupos são uma aba das Casas.** «Os grupos devem ser uma aba em casas»,
e o Martinho escolheu o lugar: a seguir aos Imóveis (navegacao.js:AREAS,
navegacao.js:NAV_GROUPS). Os grupos juntam casas e eram procurados ao lado
delas; nas Definições eram uma porta escondida atrás de um toque a mais. Saíram
das Definições (definicoes.js:DEF_LINHAS já não tem a linha, e a porta das
Definições não acende neles), perderam a cabeça das subpáginas — têm as abas
das Casas por cima, como os outros separadores da área —, e o crachá dos
pedidos para entrar passou para a aba e para a linha da gaveta. Os textos que
ensinam o caminho dizem «Casas → Grupos» (web/cloud/grupos.js:desfechoDoGrupo,
entrada.js:modalGrupo). Os caminhos velhos — o goSet('groups') e a página
guardada — continuam a levar ao separador, para nenhum atalho antigo dar na
raiz sem explicação. São da base: nenhum serviço desligado os esconde.

**A página «Conta e partilha» passou a «Segurança».** «O menu Conta e Partilha
deve mudar o nome para segurança e só deve ter a parte da segurança lá
dentro», e «No menu Conta e Partilha, o meu codigo de partilha deve migrar
para os proprietários». A página tem agora só a palavra-passe, as sessões e o
apagar da conta (partilha.js:vCloud); o perfil está no cartão do topo das
Definições, e os comproprietários e os grupos deixaram de ter porta lá. O id,
com «Copiar», está nas Pessoas › Proprietários, logo acima do campo onde se
escreve o do outro (partilha.js:comproprietariosCorpo), porque é o mesmo
gesto: dar o meu, escrever o do outro. Sem o separador dos Proprietários nesta
conta, a partilha entre contas não tinha outra casa, por isso fica na
Segurança numa secção à parte, «Partilhar com outras contas» — o pedido era
sobre o caso normal. O aviso do serviço Colaboradores desligado foi para os
Proprietários (partilha.js:comproprietariosHtml), que é onde agora se vem
procurar o id. O «Terminar sessão» diz «Entraste como <email>», para se saber
de que conta se sai. O «Copiar» dizia «copiado» mesmo quando o browser
recusava a cópia; agora diz o id (partilha.js:CW.copyId). O cartão da conta no
fundo da gaveta abre a janela «O meu perfil» (navegacao.js:abrirOMeuPerfil):
mostra o nome e o email, que é o que se muda no perfil, e já não havia a
página da conta para onde levava. O caminho no aviso legal passou a
«Definições → Segurança» (legal.js) sem subir a versão dos termos: é o nome
do menu, não uma mudança dos termos.

**Os títulos das secções por origem aparecem sempre.** «Os nomes das secções
que tiverem itens devem aparecer sempre. Se uma secção não tem itens, não
aparece.» Desfaz a escolha da entrada de cima (com uma origem só não havia
títulos): a lista de quem só tem casas suas passa a dizer de quem são, como
dirá quando chegar a primeira partilha, e o ecrã não muda de forma quando a
segunda origem aparece (vistas.js:listaPorOrigem). A secção única mantém os
ids de sempre das listas vivas («imoveis», «inquilinos», «visitas:Próximas»,
«contratos»), e não `imoveis:meu`: nada fora da lista muda, e no caso comum a
pesquisa continua pela via parcial (vistas.js:refrescarListasVivas), com o
mesmo nó do cartão. A troca de ids só acontece quando a lista passa de uma
origem a duas, ou o filtro «Origem» se liga, e aí faz-se o render normal.

## 2026-10-22 · Os grupos selecionáveis, o novo grupo no + e as folhas que se arrastam para fechar

**Os grupos selecionam-se como as outras listas.** O Martinho: «Os grupos
devem ser seleccionáveis. Checkbox no canto e long press. Shortpress, abre
modal de edição. O botão de editar desaparece», e trocar o tipo sai da
seleção. Decidido com ele: os partilhados comportam-se como os privados (o
«Abrir o grupo» também sai); a barra só tem o Apagar; num partilhado meu
apagar é no servidor, e num de outro é sair. Os botões que ficam dentro do
cartão (Partilhar, Aceitar, Recusar, a ligação) ficam inertes na seleção e
não escondidos: escondê-los encolhia os cartões ao entrar e o cartão fugia de
debaixo do dedo; ativos, um toque para marcar podia aceitar um pedido ou
desativar a ligação. Uma só confirmação para todos, com o que acontece a cada
lado, e os pedidos ao servidor sem a confirmação de cada um
(cloud/selecao-listas.js:selLApagarGrupos) — eram N janelas seguidas. O aviso
do fim espera pelas respostas: um aviso de erro a seguir ao do Anular
apagava o Anular. Apagar vários limpa agora também os filtros da Visão geral
e do proprietário que apontavam para eles (definicoes.js:gruposApagarLocal);
o delGroup antigo só limpava o dos Movimentos. O botão de «Sair de 1 grupo»
diz «Confirmar», como o «Sair do grupo» de um só: o confirmModal só tira o
verbo de Apagar/Remover/Eliminar/Terminar, e um «Sair» vermelho ficou por
decidir.

**Criar um grupo é no +.** «O botão + em baixo deve ter a opção de criar um
novo grupo (imóveis, proprietários ou contratos). A seleção do tipo de grupo
deve ser num sub menu de seleção para não encher muito o modal.» Os botões
«Novo grupo de …» e «Novo grupo partilhado» saíram do cabeçalho do
separador; o vazio de cada tipo guarda o seu. Por isso o «Grupo» do + está
para toda a gente que vê o separador, sem serviço nem cargo
(acessos.js:ACOES_DE_ADICIONAR) — sem ele, quem só colabora e já tem um grupo
não teria onde criar o segundo; um cargo que só vê passa a ter o +, só com o
«Grupo». Nos Grupos o destaque «neste ecrã» é o tipo à vista
(acessos.js:acaoNaturalDoEcra), para criar um grupo de contratos num toque
quando se está a ver os contratos. O título da escolha é «Novo grupo» e não
«Novo grupo de…»: a quarta opção, «Partilhado», não é um tipo.

**As folhas arrastam-se para baixo para fechar.** «Todos os modals que têm a
barra em cima devem ser arrastáveis para baixo para fechar.» A barra estava
lá desde o redesign a prometer o gesto que o Android e o iPhone ensinam, e
não o cumpria. Decidido com ele: pelo cabeçalho sempre, pelo corpo só no
topo do scroll; num formulário mexido, ao largar pergunta «Sair sem
guardar?» como o X. O arrasto é o do «Anular» (as mesmas contas, os mesmos
ponteiros, o mesmo sacudir — componentes.js:avisoFechaAoLargar), para os dois
gestos de puxar para baixo se sentirem iguais. O rodapé não agarra: é onde
estão Guardar e Cancelar, e um arrasto que começasse num deles era um toque
falhado a fechar a janela. Um cartão com toque longo no corpo nunca arranca
o arrasto (componentes.js:FOLHA_NAO_ARRANCA), para o segurar continuar a ser
segurar.

**As abas da área com a largura do texto.** «As abas das casas ficaram com a mesma
largura e agora, com mais um item, tenho de fazer scroll para o lado.» Com os
Grupos, a fila das Casas passou a cinco colunas iguais, cada uma da largura de
«Contratos», e não cabia aos 390px. O Martinho escolheu a largura pelo texto, a
encher a linha, e rolar só como último recurso. Medido: com a letra de sempre as
cinco ocupam 339px, e há 358 aos 390 e 343 aos 375; com um número numa aba
passam a 372. Por isso a fila aperta-se (13px, 4px de enchimento) só quando não
cabe (navegacao.js:abasApertar), e não por uma largura de ecrã: aos 390 sem
número fica a letra de sempre. O realce deixou de supor colunas iguais e mede a
aba (navegacao.js:abasPolegarEm); anima o transform e a largura, e não um
clip-path, que lhe cortava o contorno.

## 2026-10-22 · Apagar um imóvel que não criei é sair dele

**Apagar da minha lista é deixar de colaborar.** O Martinho: «Um colaborador
que apague um imóvel em que está a colaborar da sua lista de imóveis, está a
indicar que não pretende colaborar mais nesse imóvel. Logo esse imóvel deve
deixar de estar indicado como colaborado no lado do proprietário.» Até aqui,
o «Apagar» de um imóvel de outra pessoa só existia na seleção das Casas, e
só apagava no aparelho: o envio para o servidor não manda o apagar das casas
dos outros (cloud/nucleo.js:pushNow), e por isso o imóvel voltava na
sincronização seguinte e o dono continuava a ver o colaborador. Agora sai-se
mesmo no servidor (worker/src/rotas/casas.js:sairComoColaborador), e só
desse imóvel: o «Deixar de colaborar» que já havia saía de todas as casas
desse dono de uma vez, porque a colaboração é uma linha por dono e cargo.

**O nome fica «Apagar», e a confirmação diz o resto.** Decidido com ele: o
«Apagar imóvel» vermelho de sempre, sem Anular. A frase diz que as
permissões são retiradas, que não se desfaz, e que para voltar é preciso um
convite novo do dono (imovel.js:imvFraseSaida). Na seleção, o título começa
sempre por «Apagar», mesmo só com imóveis dos outros, porque o confirmModal
só pinta de vermelho um título que começa por Apagar, Remover, Eliminar ou
Terminar. O «Sair de N grupos» dos grupos continua «Confirmar».

**O comproprietário também sai, e a quota dele vai para os outros.** «Remover
a compropriedade. A propriedade desse utilizador é dividida por quotas pelos
restantes.» A quota de quem sai vai para os que ficam, na proporção das
deles (worker/src/lib/acesso.js:redistribuirQuotas). É a primeira escrita
das quotas que não passa por uma proposta aceite, e é de propósito: quem sai
não tem de pedir licença aos outros para sair, e uma proposta pendente sem
ele deixava a casa com uma quota de alguém que já não é participante. Por
isso a proposta pendente apaga-se na mesma escrita. Os saldos e o IRS
continuam calculados pelas quotas atuais, também nos movimentos passados,
como depois de um «Remover ligação»; a confirmação di-lo. Quotas por data
ficam para outra vez.

**Quem chegou por um grupo sai só daquela casa.** Decidido com ele: fica no
grupo. A pertença a um grupo é uma linha só para todas as casas dele, e por
isso a saída guarda-se à parte, em `house_exits` (migração 0019), e todas as
consultas que dão casas por grupo a respeitam
(worker/src/lib/acesso.js:SAIU_DA_CASA). Sair também tira um cargo que a
pessoa tivesse na mesma casa: sem isso, a precedência dono > comproprietário
> colaborador devolvia-lhe a casa como colaborador. Só o criador a partilhar
outra vez desfaz a saída. Voltar a ser aceite no grupo não a desfaz, e
regravar o mesmo conjunto de casas do grupo também não: o cliente regrava o
conjunto inteiro a cada mudança.

**Os avisos são a primeira notificação de um utilizador para outro.** O sino
era todo feito no aparelho, com os dados que já lá estavam. Uma saída não
deixa nada nesses dados, porque a pessoa simplesmente desaparece da casa. Por
isso o servidor guarda um aviso por destinatário (`house_events`), com os
nomes escritos no momento, e manda-os no /api/state durante 90 dias. O sino
mostra-os na atividade das casas partilhadas, com a mesma marca de leitura
(notificacoes.js:notifSaidas). Ficam nessa secção e não numa à parte: o
cloud/painel.js:pedidosNaPilha reconhece o cartão pelo título, e um segundo
cartão partia a junção com os pedidos.

## 2026-10-22 · Duas escritas na mesma casa não se esmagam

O Martinho perguntou se, para dois comproprietários a sair do mesmo imóvel ao
mesmo tempo (ou duas pessoas a aceitar o mesmo convite), fazia sentido uma
fila resolvida item a item. A ideia de pôr em fila as escritas sobre o mesmo
item estava certa, mas uma fila do Cloudflare (Queues) não era a ferramenta. É
assíncrona: a resposta chegava antes de a saída acontecer, e a confirmação
«Saíste de…» já não podia esperar por ela nem dizer o erro do servidor.
Entrega a mesma mensagem mais de uma vez, e cada item tinha de poder correr
duas vezes. E era mais uma peça para configurar e testar no dev e na
produção. Quem serializa mesmo por imóvel no Cloudflare são os Durable
Objects, um por casa: pesado demais para três escritas.

O que se fez foi gravar só se ninguém tiver gravado entretanto. Os dados da
casa são um JSON que se lê, se muda e se grava inteiro, e havia três sítios
onde duas leituras ao mesmo tempo davam uma escrita perdida: a saída de um
comproprietário, a aprovação de uma proposta, e a gravação da ficha pelo
cliente, que a meio de uma saída repunha a quota de quem tinha saído.
Medido: sem a verificação, os testes de cruzamento acabam com as quotas
50/30/20 de volta (testes/revisao-da-casa.test.js). Cada escrita leva uma
revisão nova e diz sobre que revisão escreveu, e um trigger da base recusa-a
quando a casa já mudou (worker/src/lib/acesso.js:gravarCasa, migração 0020).
Um trigger, e não uma condição em cada instrução: a recusa desfaz o lote
inteiro, e as saídas, as partilhas e os avisos que iam com a casa também não
ficam. A revisão é um id ao acaso e não um número que sobe, porque duas
escritas sobre a mesma revisão escreviam o mesmo número seguinte e o trigger
deixava passar as duas.

Aceitar o mesmo convite duas vezes já estava resolvido: o convite gasta-se
numa só instrução (`UPDATE … WHERE used_at IS NULL`), e só um dos dois
pedidos o consegue gastar.

## 2026-10-23 · A montra diz o valor nos primeiros segundos

O Martinho quis que quem abre o rendorium.com perceba logo o que a app faz,
que vantagem tem e como se aplica aos seus imóveis. A montra abria com «O teu
portefólio de arrendamento, arrumado» e uma grelha de seis cartões, «O que
faz»: dizia que arruma, não porque é que isso importa. A vantagem que o
Martinho apontou é a dos planeados: nenhum pagamento, nem a falta dele, passa
despercebido. Passou a ser o título («Nenhuma renda te passa despercebida»),
com o chapéu a dizer o que é e o subtítulo a dizer como. «O que faz» deu lugar
a «Do imóvel à renda, tudo ligado»: o Martinho propôs «Gere o teu portfólio
de forma integrada», e a frase escolhida mostra o que «integrada» quer dizer
(o contrato cria a renda, o imóvel cria o IMI). A seguir, cada ecrã que
entrega a vantagem (Imóveis, Contratos, Planeados) tem a sua secção, com
um telemóvel a imitar a app (landing.js:ECRAS). Dos seis cartões ficam três,
os que não têm ecrã. O Anexo F saiu, e com ele o IRS dos metadados: a
Declaração só existe em dev, e a montra de produção não pode prometer o que a
produção não tem (testes/landing.test.js guarda-o). O título e a descrição
levam os termos que um senhorio escreve no Google («gestão de arrendamento»,
«rendas em atraso», «controlo de rendas»), dentro do que os motores mostram
sem cortar.

## 2026-10-25 · A casa partilhada funde em vez de gravar por cima, e as tarefas guardam-se de uma vez

O Martinho adicionou tarefas e 16 fotos a uma casa partilhada com outra
conta; vista da outra conta, não tinha nada, e quando voltou à dele tinha
perdido tudo. A produção mostrou a casa gravada inteira, sem elas, num envio
que gravou as duas casas partilhadas no mesmo lote: o aparelho da outra conta
tinha cópias das duas de antes das fotos, e as duas diferiam do retrato
porque a v40 passou a acrescentar as tarefas a cada casa ao carregar. Diferir
do retrato era «mudei aqui», e a casa subia inteira por cima. As fotos
ficaram no armazenamento e na tabela files, presas à casa; as tarefas não
ficaram em lado nenhum.

A resposta do Martinho foi «fundir sem perder»: cada envio só muda o que essa
pessoa mudou, campo a campo, tarefa a tarefa, foto a foto; se as duas mudaram
a mesma coisa, fica a última; nunca se apaga o que a outra conta adicionou.
Cada envio da casa passou a dizer que versão leu (a base, guardada no
aparelho), e o servidor funde a três. A base vai só com os campos que
mudaram: com a casa inteira duas vezes, o pedido dobrava. A fusão é o mesmo
código nos dois lados (o cliente funde ao ler), comparado por um teste, em
vez de duas versões que divergiam com o tempo. Um envio sem base (as versões
de antes) só junta, e por isso a versão mínima subiu para a 41: essas versões
continuavam a pôr os campos simples de uma cópia velha por cima. O rev da casa
(2026-10-22) continua: protege as escritas do worker umas das outras; a base
protege o que outra conta gravou antes de este cliente ler. Os registos
(contratos, movimentos) ainda gravam por cima e são o passo seguinte.

As tarefas eram a outra metade. Cada toque na janela gravava, e cada gravação
era um envio ao servidor: a adicionar tarefas uma a uma, o Martinho bateu no
limite de 60 envios em 15 minutos (worker/src/rotas/sync.js), e o que não
subiu ficou só no telemóvel. Havia duas saídas: juntar os envios em toda a app
(um a cada 20 segundos, sem mudar nada no ecrã), ou a janela das tarefas
passar a rascunho com um «Guardar». O Martinho escolheu o Guardar: quem
escreve quinze tarefas seguidas pensa nelas como uma lista, e grava-as de uma
vez. Por isso a regra «cada toque grava logo» saiu da janela das tarefas, e o
Cancelar dela pergunta antes de deitar fora, ao contrário do dos outros
formulários.

As fotos eram lentas a renomear e reordenar no telemóvel. Medido, a
miniatura de cada foto acabada de adicionar era o original da câmara até
recarregar (dez fotos, uns 480 MB de imagem para caixas de 64×52), o campo do
nome andava 27px debaixo do dedo aos 260ms, e o arrasto corria duas vezes por
movimento e saltava ao largar. Nenhuma destas coisas era a gravação: era o
trabalho de ecrã.

## 2026-10-25 · Os registos fundem como a casa

A casa partilhada passou a fundir de manhã; os contratos, as fichas e os
movimentos continuavam a gravar-se inteiros, e corriam o mesmo risco: um
aparelho com a cópia de antes (ou com uma versão nova que normaliza o
registo de outra maneira) apagava as tarefas, os documentos e as chaves que
outra conta tinha juntado a um contrato, e desfazia a nota que ela tinha
mudado num movimento. O Martinho disse «faz isso tudo».

Cada registo passou a ter a sua base, como a casa, e o servidor funde com o
mesmo código. A fusão aprendeu a tirar um campo que se removeu: um
movimento que deixa de ser prestação perde o juro e o capital, e sem isto
esses campos ficavam no servidor. As bases de todos os registos ficam em
memória, mas no aparelho só as dos que estão por enviar: as outras são o
próprio registo, e guardá-las todas era voltar a ter a base duas vezes no
localStorage, o que já tinha rebentado a quota (foi por isso que o retrato
passou a resumos). O custo: uma edição de um campo simples que nunca chegou
a tentar subir (a app morta à força no segundo a seguir) perde-se ao ler; o
que se adicionou a uma lista nunca. Os registos não têm revisão: a escrita
só pega se o registo ainda for o texto que se leu, e senão repete a fusão —
sem migração.

## 2026-10-25 · As miniaturas sobem com as fotos

Noutro telemóvel, as miniaturas obrigavam a descarregar as fotos originais: o thumbSrc só
tinha o original para as fazer. Medido no 8788: 5 fotos de 2000×1500 eram 6,9 MB a descer
para pintar cinco caixas de 64×52; agora são 53 KB. A lista de imóveis pinta as fotos de todos
os imóveis (lista-imoveis.js:propsDepois), por isso num aparelho novo era a conta inteira de
fotos a descer no primeiro ecrã. A miniatura ficou no R2 sem linha própria para não ser um
anexo em lado nenhum (teto, linkFiles, regras dos cargos, varredura) e sem migração.

Dois defeitos achados pelo caminho e corrigidos nos meus ficheiros:
- O `cleanFiles` do arranque deitava fora todos os `tn_` (só guardava os ids dos anexos): cada
  sessão refazia as miniaturas a partir dos originais (descodificar fotos de 12 MP de cada vez
  que a app abria).
- O upload de uma foto começa no takeFiles, sem casa; com a gravação do imóvel a chegar antes
  (o envio sai 1,2 s depois do Guardar), a foto ficava solta — só quem a carregou a via, o
  comproprietário recebia 404 — até o imóvel voltar a ser gravado. A prova apanhou-o em 4 e 5
  das 5 fotos. Agora o fim do upload prende-a (prenderAnexo/handlePrender). E o
  `subirPendentes` subia os primeiros vinte anexos da conta inteiros a cada envio aceite (dados
  móveis gastos sempre nos mesmos, e o vigésimo primeiro nunca revisto): agora só o que a
  sessão ainda não tratou.

## 2026-10-25 · Transferir a propriedade é um pedido que o outro aceita

O Martinho pediu para transferir a propriedade de uma ou várias casas a outra pessoa, e respondeu: em cada transferência escolhe se sai ou continua como comproprietário (e então as quotas vão no pedido); quem recebe tem de aceitar; só para quem já está ligado; os colaboradores do dono antigo saem dessa casa.

A transferência é um pedido e não uma ação: muda o dono, as quotas, quem tem
acesso e para onde contam os anexos de outra pessoa, e por isso precisa do
sim dela, e até lá não muda nada (o Martinho: «quem recebe tem de aceitar»).
O Aceitar vive na folha do «Ver», e não na linha do sino como o dos pedidos
de partilha, porque aceitar um imóvel é ficar responsável por ele — lê-se
antes. Só aparecem as ligações aceites porque o servidor só aceita essas (um
comproprietário só por um grupo não tem ligação). Cancelar não pergunta:
não destrói nada e pode-se pedir outra vez.

- O acesso de um comproprietário por ligação é uma partilha do criador
  nessa ligação (`shares.owner_id` = o criador, a outra ponta vê). Uma
  partilha numa ligação A–C não pode dizer «o B partilha com o C»: com o B
  como criador, o C só continua pela ligação B–C. Sem ela, o C perde o acesso
  e é avisado — deixar a partilha velha com `owner_id` = A dava ao A, que já
  não é o dono, uma partilha que o PUT das partilhas dele recusa com 403.
- Os grupos: num grupo partilhado cada membro só põe casas suas; uma casa de
  quem não é membro não fica lá.
- A decisão faz parte do lote do aceitar, e o trigger recusa uma linha já
  decidida: um cancelar que chegue entre a leitura e a escrita desfaz o
  aceitar dessa casa, e vice-versa.

## 2026-10-25 · As fotos a descer mostram que estão a chegar

O pedido do Martinho (2026-10-25): «Quando adiciono fotos, a outra pessoa vê que
há x fotos, mas não vê nenhuma até terminar de descarregar. Quero que haja um
feedback. Tipo um donut que roda ou assim.» As caixas vazias com o fundo --chip
pareciam fotos que não existiam; e no carrossel o toque numa foto não fazia nada
até a foto inteira descer.

## 2026-10-25 · Passar o controlo, não a propriedade

O Martinho corrigiu a transferência (2026-10-25): «A casa continua a ser de
todos, só o controlo na aplicação passa para outra pessoa». Por isso a ação
chama-se «Passar o controlo» e não «Transferir propriedade»: a propriedade
(as quotas) não muda, e o nome antigo dizia o contrário. Só se passa a um
comproprietário (é a correção dele), e com vários imóveis a quem o é de
todos — o servidor recusa os outros, e oferecê-los era levar a um erro. A
frase diz o que fica igual (a minha quota, as quotas, os grupos, os outros
comproprietários, o cargo dos colaboradores) porque é isso que a pessoa
precisa de ler para não ter medo de carregar no botão. Continua a ser um
pedido que o outro aceita (resposta dele: «quem recebe continua a ter de
aceitar»), porque quem recebe passa a responder pelas partilhas e pelos
colaboradores.

- O Martinho corrigiu a transferência de e71935f: só se passa a quem já é
  comproprietário, e só muda quem controla a casa na app; grupos, outros
  proprietários e quotas ficam. Os colaboradores do criador ficam com o mesmo
  cargo e passam a ser geridos pelo novo; quem recebe continua a aceitar.
- Mudar o `owner_id` das partilhas existentes para o novo criador partia o
  acesso: numa ligação A–C, uma partilha de B daria a casa às duas pontas
  (B não é nenhuma). Por isso as partilhas ficam com quem as deu, e só se
  mudam as que se podem mudar sem perder ninguém (a da ligação entre os dois,
  e as de terceiros também ligados a quem recebe).
- Mudar as partilhas de terceiros para as ligações de quem recebe, quando as
  há, é o que deixa o novo criador gerir com quem a casa está partilhada.
- O `added_by` passa ao novo criador mesmo que não seja membro do grupo:
  com o de quem pediu, o cliente dele (que só manda as casas dele no
  conjunto) tirava a casa do grupo ao regravar.

## 2026-10-26 · Passar o controlo pede a ligação a todos os comproprietários

Uma partilha pertence à ligação onde está. Quando a Alice passava o controlo de uma casa ao Bruno, o Carlos — comproprietário pela ligação Alice–Carlos, sem ligação ao Bruno — continuava a ver a casa por uma partilha que já não era de quem a geria: o Bruno não a podia gerir nem remover, a Alice também não, e se a Alice cortasse a ligação ao Carlos ele perdia a casa sem ninguém dar por isso, com a quota a ficar nas contas. Havia três saídas: pedir as ligações primeiro, criá-las sozinho ao aceitar (uma ligação que ninguém pediu), ou desligar a compropriedade das ligações (a mais limpa e a maior: muda a partilha em toda a app). O Martinho escolheu pedir as ligações primeiro: só se passa o controlo se todos os comproprietários que chegam por uma partilha estiverem ligados a quem recebe, e a folha diz quem falta antes de se enviar. Assim as partilhas mudam-se todas para as ligações de quem recebe, e ele gere-as como as outras.

## 2026-10-26 · Passar o controlo precisa do sim de todos os comproprietários

A casa é de todos: mudar quem a gere na app mexe com todos os que a têm (quem
lhes gere a partilha, os colaboradores). O Martinho quis que todos os
comproprietários aceitem, e não só quem recebe, e trocou a regra da ligação
pedida antes: aceitar liga a quem recebe quem lhe chegava por uma partilha
sem estar ligado, e a partilha dessa pessoa muda-se para essa ligação ao
passar. Uma recusa faz cair a casa (e avisa quem pediu e os outros); num lote
com várias casas, cada casa passa quando os DELA aceitarem. Os sins guardam-se
por cima do que se leu, como os das propostas de quotas, para dois
comproprietários a aceitar ao mesmo tempo não perderem um sim nem passarem a
casa duas vezes (a passagem continua presa à revisão da casa e ao trigger da
0021). Quem chega só por um grupo não ganha ligação: o grupo não muda ao
passar, e uma ligação que ninguém pediu só se cria onde é precisa para gerir
a partilha.

O Martinho (2026-10-26): «Melhor, quero que todos os comproprietarios
aceitem a transferência». Passar o controlo muda quem gere as partilhas, os
colaboradores e o apagar de uma casa que é de todos, por isso todos dizem
sim — e uma recusa faz cair o pedido nessa casa. A folha diz os nomes de
quem tem de aceitar porque é o que a pessoa precisa de saber antes de
enviar (quem vai receber o pedido no sino). A falta de ligações deixou de
travar o pedido (resposta dele: «Aceitar liga-os»): quem não está ligado a
quem recebe fica ligado ao aceitar; por isso a linha que o diz é
informativa, não um erro — não há nada a corrigir antes de enviar. O pedido
diz a quem vai («… a Bruno» / «… a ti») porque agora chega a quem não
recebe. Depois de aceitar o pedido sai dos pedidos por responder (já não
pede nada) e fica à espera dos outros, com quem falta, para quem aceitou
saber porque ainda não passou.

## 2026-10-27 · A app apresenta-se, e o ícone passa a cobalto
O pedido: «Quero que utilizadores novos tenham um onboarding simples»: uma
janela com um ✕ e um carrossel de imagens depois de criar a conta (os
parabéns, como se cria um imóvel, um inquilino e um contrato, o que são os
movimentos recorrentes e de onde vêm, o que são os modelos, e no fim o
primeiro imóvel com um botão para os Imóveis); «por cada menu que o
utilizador vê pela primeira vez, há um ecrã destes» (os separadores); e «o
icon da aplicação» ainda verde.

O Martinho decidiu: as imagens são maquetes da app em HTML com os tokens, e
não capturas (envelhecem a cada desenho e pesam na cache) nem ilustrações
abstratas (não mostram onde se toca); a primeira frase é «Parabéns, <nome>. A
partir de hoje, nenhuma renda te passa despercebida.», a da montra; os
separadores explicam-se a todas as contas, as antigas também, e as
boas-vindas são só das novas; quem chega por convite também as vê, com o fim
adaptado — e a quem só colabora o título é «Os imóveis já estão à tua
espera», sem «teus», porque não são dele; cada separador é um carrossel curto
que acaba no «Percebi»; fechar as boas-vindas conta a Visão geral e os
Imóveis como vistos, para não abrirem duas janelas seguidas; revê-se tudo pela
Ajuda; o ícone é o cobalto liso do --marca, com a casa de sempre; e as
novidades dizem como o ver no iPhone e no Android, que não o trocam sozinhos.

O que se decidiu a fazer: a janela é um openModal e o carrossel copia o gesto
das fotos (o padrão; o código das fotos está preso a elas). O «visto» vive nas
definições, num objeto {id: 1}, porque a fusão a três o junta chave a chave e
dois aparelhos não se esmagam; o sinal de conta nova nasce no aparelho, porque
chega antes do servidor, e só depois de o servidor responder passa para as
definições como «por ver» — escrito antes, num aparelho sem base, a fusão
desfazia-o. A janela só decide com o estado do servidor na mão (a regra «A app
não afirma nem decide antes de saber»). Quem chega por convite vê primeiro o
convite e a confirmação, e só depois as boas-vindas, já com o cargo. Fechar as
boas-vindas fora da Visão geral, ou as novidades, deixa a apresentação desse
ecrã para a chegada seguinte. As apresentações dos separadores são verdade para
o código de hoje e para a conta: os textos de criar mudam com o ecrã (no
computador não há barra de baixo), quem só vê não lê como se cria, um serviço
desligado leva as imagens dele, e a da Visão geral mostra a cara que a conta
tem — eram duas no pedido, são cinco no código (a jornada, o vazio sem imóveis,
o vazio com eles, os números, e quem só colabora sem finanças). Os números das
maquetes fecham entre si e saem das contas da app (a amortização, a taxa do
IRS de cada ano); na projeção, os contratos do exemplo contam-se renovados,
porque as datas de fim do exemplo são fixas e a imagem envelhecia a mostrar um
portefólio sem rendas. O percurso do CI fecha as boas-vindas pelo ✕, marca os
separadores como vistos e prova uma apresentação por ecrã.

O ícone: o degradê verde na diagonal da PWA (make-icons.js:corDoFundo) e o
verde liso do APK (o ic_launcher_background do
android/app/src/main/res/values/colors.xml) passam ao cobalto liso; a casa é a
mesma, píxel a píxel. As cores da janela do Android, que ainda eram as
esverdeadas da paleta antiga, passam ao --bg e ao --card. O drawable
ic_launcher_background.xml, um degradê verde que nenhum recurso citava, saiu:
os mipmaps citam a cor pelo nome, é por esse nome que o flavor dev a troca
pelo âmbar, e uma segunda cópia da cor era o que deixava a PWA e o APK com
verdes diferentes. O dev continua âmbar. O versionCode não sobe: o Android
instala por cima com o mesmo número, como quando o nome passou a Rendorium.

## 2026-10-28 · «Transferir o controlo», «Descarregar» e as frases sem género

O Martinho pediu (2026-10-28) que o botão de passar o controlo dissesse
«Transferir controlo». Ficou «Transferir o controlo», com o artigo, como as
outras ações da app, e o verbo mudou em todo o lado onde a app o diz: o ⋯ da
ficha, a barra da seleção, a folha, o sino, a ficha com o pedido pendente e as
novidades da v42 (ainda não publicadas). O porquê de 2026-10-25 continua: o
que se transfere é o controlo na app, não a propriedade, e por isso não é
«Transferir propriedade». As rotas, as tabelas e os nomes no código já eram
transfer/transferir e não mudaram.

Na janela de uma foto, o «Guardar» passou a «Descarregar»
(web/app/anexos.js:fotoDescarregar), também pedido dele: na app, «Guardar» é
gravar um formulário, e ali o botão leva a foto para o aparelho.

As frases que falavam com quem lê no masculino passaram a neutras, pela regra
de não presumir o género: «És colaborador de Rui…» → «Colaboras com Rui…»
(web/app/acessos.js:fraseColaborador, web/app/imovel.js:imvNotaDeColaborador),
«Agora és colaborador de…» → «Agora colaboras com…», «Deixas de ser
comproprietário de…» → «Sais da compropriedade de…», «És comproprietário
de…» → «Tens … em compropriedade», «Já não és comproprietário deste imóvel»
→ «Já não és parte da compropriedade deste imóvel», «Ainda não estás ligado
a ninguém» → «Ainda não tens ligações», e «Estou dispensado dos recibos…» →
«Tenho dispensa dos recibos…». Falar de terceiros («um comproprietário»)
fica como estava.

A taxa de uma hipoteca variável ou mista escrevia a soma crua
(«3,0999999999999996%»); agora arredonda às milésimas
(web/app/credito.js:taxa3), como a ficha da hipoteca já fazia. As datas dos
contratos das maquetes das apresentações contam-se a partir deste mês
(web/cloud/apresentacao.js:aprMes), para não ficarem no passado.

## 2026-10-28 · Os tickets de QA

O Martinho pediu um botão no dev para escrever tickets de QA no momento em que
vê o problema, e que o Claude os fosse buscar quando lhe pedisse para os
resolver. As escolhas dele: guardar na D1 do dev, numa tabela nova; o ticket
leva o texto, a gravidade, o contexto automático e uma captura de ecrã; todas
as contas do dev veem a lista inteira; um resolvido fica numa secção
«Resolvidos» e pode reabrir-se; a pílula com a pega, «QA» e o número de
abertos, com a etiqueta na primeira vez; ao largar, cola à borda mais perto e
lembra-se do sítio. Depois de ver a primeira versão: a pílula sobe acima das
janelas abertas, o ícone é um inseto, e os tickets sobrevivem à limpeza do dev
e à conta de quem os escreveu.

Uma tabela própria, e não a dos pedidos de ajuda: um ticket de QA é trabalho
de quem programa, escrito por quem testa; um pedido de ajuda é suporte, vai ao
Discord, manda email e aparece no back office. Misturá-los enchia a fila do
suporte de notas de teste.

As rotas dão 404 em produção antes de lerem o corpo: não dizem que a
funcionalidade existe e nada de um pedido de produção chega à base. Remover é
brando por 24 h para o Anular da app poder desfazer sem a app guardar o
ticket; a limpeza corre de passagem nas rotas e apaga primeiro a captura,
para nunca ficar um objeto órfão no R2. Reabrir guarda a resolução, para quem
pega outra vez no ticket ver o que já se tentou. O tipo da captura lê-se dos
bytes, e não só do Content-Type, porque a imagem é escrita por uma conta e
aberta por todas na mesma origem (worker/src/rotas/qa.js:tipoDaImagem).

O user_id não tem chave estrangeira para users. Com ela, o DELETE FROM users da
limpeza do dev falhava, ou os tickets tinham de sair primeiro, e o Martinho
quer que fiquem. A app mostra «Conta apagada» quando o autor já não existe ou
foi anonimizado (web/cloud/qa.js:qaAutor).

A pílula sobe acima das janelas para se poder reportar a janela que está
aberta, que é muitas vezes onde está o problema, e o contexto passa a trazer o
título dela. Enquanto uma janela do próprio QA está aberta, a pílula volta para
baixo, para não tapar o formulário (web/cloud/qa.js:qaMarcarJanela).

O Claude lê os tickets com um script direto na D1 e no R2 do dev, e não pelas
rotas: as rotas pedem a sessão de uma conta da app, e o Claude não tem conta
nem deve guardar um token. O script só escreve com resolver e reabrir; remover
é do Martinho, na app.

Depois, no mesmo dia, o Martinho pediu que o autor de um ticket escrito numa
conta de teste fosse a conta do Discord que criou a ligação do /test, e não a
conta de teste (que se chama sempre «Conta de teste» e que o /test limpar
apaga). O id do Discord já estava em users.test_owner; o nome não chegava ao
dev, por isso passou a viajar assinado na ligação (worker/src/teste.js:ligacaoTeste).
A assinatura só conta o nome quando ele vem, para as ligações emitidas por um
worker ainda sem esta versão (o bot de produção, até à promoção) continuarem a
valer; essas aparecem como «Discord <id>». O ticket copia o id e o nome ao
ser criado (worker/src/rotas/qa.js:discordDoAutor), para o autor sobreviver à
conta de teste.

A seguir, o Martinho quis ver o nome logo, e não «Discord <id>» até à
promoção. O dev já tem o token do bot, por isso o nome que falta pergunta-se
ao Discord (GET /users/{id}: o nome de exibição, ou o de utilizador) e
guarda-se por 30 dias na mesma chave do KV (worker/src/teste.js:nomeDoDevNoDiscord).
O nome da ligação continua a ganhar, porque escreve por cima e sem prazo. O
GET /api/qa põe o nome nos tickets que ficaram só com o id, até cinco devs
por pedido, para o scripts/qa.mjs, que lê a base, também o ver. Pediu também
os abertos agrupados por gravidade e, em cada grupo, por data, do mais recente
para o mais antigo. É assim na API, na app e no listar.

## 2026-10-28 · As sessões de teste no back office

O Martinho pediu para ver no back office quantas sessões de teste existem, quem
as tem, e poder revogá-las. Escolheu: uma linha por sessão aberta (cada browser
onde uma ligação do /test foi aberta), agrupadas por quem as pediu no Discord;
revogar com as duas saídas, terminar a sessão ou apagar a conta; as duas também
para todas as de uma pessoa e para todas; e na Operação, para o master e o
admin, que já a veem (o dev não vê a Operação).

As sessões vivem no KV sem índice por conta, e não se criou um: lê-se a lista
das chaves sess: e fica-se com as das contas de teste. No dev há poucas, e um
índice à parte ficava desencontrado do KV a cada saída ou expiração. Para não
ter de abrir cada valor, as sessões novas guardam a conta, a época, a hora e o
browser nos metadados da chave (worker/src/auth.js:createSession); as de antes
leem-se pelo valor, e a hora de abertura tira-se da validade.

Terminar as de uma pessoa ou todas sobe o sess_epoch, o que a suspensão já
fazia: mata as sessões todas de uma vez, incluindo as de antes dos metadados, e
deixa as contas e os dados para o próximo /test. Terminar uma sessão só apaga
essa chave e não pergunta, porque basta abrir outra ligação; o resto pergunta.
O token nunca chega ao back office: cada sessão vai com os primeiros 16
caracteres do sha-256 dele (worker/src/sessoes-teste.js:idDaSessao).

## 2026-10-28 · Quem fecha uma apresentação a meio é perguntado, uma vez

Um ticket de QA do Martinho (61dee982): fechar as apresentações no ✕ ou fora
da janela pode querer dizer que a pessoa não quer ver nenhuma, e a app seguia
a abrir uma por separador. Agora, quem fecha uma por um caminho de abandono
antes da última imagem ouve «Não queres ver as apresentações?»
(cloud/apresentacao.js:aprPerguntar). As decisões foram dele: só antes do fim
(quem chegou ao «Percebi» viu tudo, e não está a recusar nada), só uma vez por
conta (perguntar a cada separador seria a mesma insistência de que o ticket se
queixa), também nas boas-vindas, e sem interruptor novo para as religar, porque
a Ajuda já reabre cada uma. A terceira resposta, «Voltar à apresentação», é
para o ✕ tocado por engano: reabre na mesma imagem e não gasta a pergunta.

A origem do fecho já existia (componentes.js:closeModal, para o «Sair sem
guardar?») e só não chegava ao aoFechar; passa a chegar. A resposta vai na
mesma chave das vistas, db.settings.apresentacoes, como mais duas marcas
(perguntou e nenhuma), para viajar entre aparelhos e passar pela fusão a três
como as outras. «Continuar a mostrar» é o primário: é o caminho que não muda
nada do que a app faz.

## 2026-10-28 · Trinta sessões numa conta de teste

O Martinho via no back office perto de trinta sessões abertas numa só conta de
teste, sem saber de onde vinham. O KV do dev tinha 62 sessões das contas de
teste e de outras: 19 na A972W2R4, 18 na FJXT22R3, todas abertas entre 28/09 e
hoje. Cada entrada criava uma sessão nova de 30 dias e deixava a anterior viva:
a ligação do /test (mesmo a retomar a mesma conta), cada troca no seletor das
contas, cada conta extra e o apagar com passagem à seguinte. Os grupos de três
e quatro no mesmo minuto em duas contas (26/10, 07:55) são trocas seguidas no
seletor. As de antes de hoje não têm o browser nos metadados, por isso não se
sabe de que aparelhos foram.

A app guarda uma sessão só por browser, por isso a que a nova substitui já não
servia a ninguém: passa a terminar no servidor
(worker/src/teste.js:largarSessoesDoBrowser, com os tokens do Bearer e do cookie),
e as dos outros aparelhos ficam. Pelo caminho, as pré-visualizações de ligações
deixam de entrar (worker/src/teste.js:eRoboDeLigacoes): um robô que abrisse a ligação
criava uma sessão que nenhum browser guardava, e numa ligação de limpar apagava
as contas. As 62 que já existem não se tocam: terminam-se no back office ou
expiram. A lista passou a ter uma secção que abre e fecha por conta, dentro do
bloco de quem as pediu no Discord, escolha do Martinho.

## 2026-10-28 · A segunda ronda de tickets de QA: o ano inteiro, os donos no seletor, os grupos nos filtros

Nove tickets do Martinho, todos de hoje, com decisões dele onde mudavam o que
estava decidido.

O gráfico «Entradas e saídas» da Visão geral acabava no mês corrente de
propósito (o canvas, e uma linha a seguir por novembro ao nível de hoje lia-se
como valor registado). Ele quis o ano inteiro com o que os planeados preveem
(07d39786): os meses seguintes saem das ocorrências da Agenda
(calendario.js:calPlaneados), com o valor que a confirmação registaria, em
barras esbatidas com «previsto» na legenda e na leitura. O cashflow acumulado
e os quatro indicadores ficam sem previsões, porque são o que aconteceu. Sem o
Calendário ligado não há previsão: o idioma de guarda entre serviços é o
servicoLigado, e a função vive no Calendário.

O filtro global de proprietário saiu na v40 (13c9769), e ele pediu-o de volta,
mas só na Visão geral (a0faa42e): «Os meus» e cada proprietário com quem
partilha, no seletor do que está em foco, depois dos grupos. Um proprietário
em foco é um 'g:o:UID' (registos.js:pidDono), um grupo que não existe na
base: todo o código que pergunta «um imóvel ou vários?» já trata o prefixo
g:, e um prefixo novo obrigava a mexer no peso dos movimentos, nas contas
entre proprietários e no «Novo movimento». Só entram proprietários com algum
imóvel no âmbito, para nenhuma opção dar uma vista vazia.

O filtro «Imóvel» dos Contratos, dos Planeados e dos Créditos passou a ter os
grupos depois de uma linha, como os Movimentos (b8bf3127), só os grupos com
coisas nessa lista (componentes.js:imoveisEGruposOpts); apagar o grupo
escolhido volta a todos (definicoes.js:gruposApagarLocal).

O aviso «Todos aceitaram: … passou a gerir …» abria a ficha e ficava por ler
(f48a5371), porque a leitura era só a marca temporal do «Marcar tudo como
lido». Os avisos das casas passam a ler-se um a um ao toque
(notificacoes.js:notifLerAviso), num objeto {id: 1} nas definições pela mesma
razão das apresentações: a fusão a três junta-o chave a chave.

Os outros: na Ajuda, «Marcar todas como vistas» (f6e09ead) e rever uma até à
última imagem conta como vista (ea801987); o «Fora dos totais» ligado fica
vermelho (61234ca0); na pílula QA, as secções da lista dobram, com os
resolvidos recolhidos por omissão (a2787d04), e a pega vira-se para a borda
onde a pílula encostou, só ao largar (89811267).

## 2026-10-28 · Os tickets de QA com três estados: novos, em resolução, resolvidos

Um ticket de QA do Martinho (1ca648f5): quer ver, na app, que um ticket já está
a ser tratado. As escolhas dele: três estados, Novos, Em resolução e
Resolvidos; só quem resolve (o Claude, pelo scripts/qa.mjs comecar) passa um
ticket a em resolução, logo que pega nele, e a app só mostra; reabrir devolve
aos novos; o número da pílula conta os novos e os em resolução, tudo o que
ainda não está resolvido.

Na base o novo continua a chamar-se 'aberto' e o em resolução é
'em_resolucao': o status é texto sem CHECK, por isso não houve migração, e os
tickets que já existiam ficaram novos sem se lhes mexer. A rota não ganhou
nenhum caminho para marcar em resolução: seria um botão a mais na app para uma
coisa que é de quem programa. O comecar confere todos os ids antes de mexer em
algum, e recusa um resolvido (esse reabre-se primeiro), para nunca tirar um
ticket dos resolvidos sem se ver.

## 2026-10-28 · A pílula do QA no back office, com o qa.js da app

Um ticket de QA do Martinho (fb92f4ba): o back office do dev deve ter a mesma
pílula de QA, com as mesmas funções. Perguntado entre uma versão própria do
back office e reaproveitar o qa.js da app, escolheu reaproveitar.

O back office não carrega a app, de propósito (equipa-vista.js), e o guião
dele tem um esc e um ic globais com outras assinaturas que os da app. Por isso
o qa.js não entra solto ao lado do guião: o worker embrulha-o numa função com
uma camada que faz de app (worker/src/equipa-qa.js), e os nomes não se tocam.
O qa.js, o icones.js e o formato.js vão tal e qual, lidos dos assets a cada
pedido, para a pílula do back office nunca ficar para trás da da app; o CSS
do QA corta-se do estilos.css pelos marcadores do bloco, e o teste falha se
eles mudarem. As ações data-click não correm pelo eventos.js da app (que
carregaria mais app); a camada lê a mesma gramática curta e só chama a tabela
das funções do QA.

As rotas são as mesmas, por um caminho da equipa (/api/equipa/qa), porque a
sessão é outra (o cookie da equipa) e uma sessão de equipa não deve abrir a
API de quem usa a app. O autor é a pessoa da equipa pelo Discord, nos campos
que os tickets das contas de teste já tinham. Qualquer cargo vê a pílula: o
QA é de quem testa, e não depende do que o cargo vê no back office.


## 2026-10-28 · A hipoteca que começa no futuro

Um ticket de QA (234da7c3): uma hipoteca com início a 1 de janeiro de 2027
tinha o plano de pagamento a começar hoje. O planeado da prestação nascia
sempre no mês de hoje, e o plano parte da próxima por confirmar. A primeira
prestação passou a ser a do mês do início quando o início ainda não chegou, no
mesmo dia em que a app já contava as prestações em falta desde o início (a do
próprio dia do início, preso aos 28). Um planeado que já existia e fica antes
do início novo anda para lá; as hipotecas que já começaram não mudam.

## 2026-10-28 · O dev só abre pela ligação do /test

Um ticket de QA (23899645) pedia a pílula do QA também na entrada e no criar
conta. Sem sessão, o servidor não aceita tickets, e perguntado como devia
ser, o Martinho decidiu outra coisa: «O dev.rendorium.com deixe de ser
acessível diretamente sem ser com link do discord. [...] Assim sei que só
quem está identificado tem acesso.» Nas respostas seguintes: só as sessões
das contas de teste (as que o /test cria) passam, e uma conta normal do dev
também não; a ligação continua como era (10 minutos para ser aberta); o back
office fica com a entrada dele; e o erro é um 404 seco, sem dizer que é o
ambiente de testes. A pílula na entrada deixou de fazer sentido: no dev já
não há entrada.

A porta fecha-se com duas variáveis juntas, o ENV_NAME «dev» e a PORTA_DEV
«fechada», porque o percurso corre com outro ENV_NAME e cria contas pela
entrada, e os testes da identidade de dev montam o worker com o ENV_NAME
«dev» sem a porta. Para fechar também os ficheiros da app, todos passam pelo
worker no dev: custa uma invocação por ficheiro, que no plano gratuito soma
aos pedidos da produção, e por isso a conferência da sessão fica lembrada 30
segundos por isolado. O deploy do dev confirma-se pelo /versao.json, que
passa a porta, e pelo 404 da raiz: um 200 lá quer dizer porta aberta, e o
deploy falha. A APK de dev abre o dev sem sessão e passa a ver o 404.

## 2026-10-28 · A terceira ronda de tickets de QA

Quatro tickets do Martinho (28/10, num Samsung) e um relato no chat. O aviso
de um registo adicionado leva «Ver» (cda8e547): vai ao separador e abre a
ficha, só nos novos — quem editou já estava a ver o registo —, e só quando o
que está aberto são fichas, para não navegar por baixo de um formulário ou da
pergunta das prestações em falta. Os avisos dos novos passaram a dizer
«adicionado». No telemóvel o «N alterações por enviar» ficou só o ícone
(47da849d): cada gravação passa por ele e pelo «Guardado», e a faixa fazia o
cabeçalho saltar a cada gravação; afasta-se do contrato do redesign («uma
faixa quando há algo por enviar») por pedido do ticket. Os movimentos do
mesmo dia ordenam-se pela hora a que foram adicionados (15f6d530): o
movimento novo guarda quando nasceu, e os antigos ficam sem o campo em vez de
uma data inventada, que os reenviava todos ao servidor. E um toque durante o
arranque (o relato «LFK is not defined», ao abrir a gaveta antes de o
vistas.js carregar) deixou de correr a ação com meia app: engole-se, em vez
de se guardar para depois.

## 2026-10-28 · A APK de dev abre as ligações do /test

Com o dev fechado a quem não vem do /test, a APK de dev via só o 404: o
WebView dela nunca tinha a sessão. O Martinho pediu que ela abrisse as
ligações do /test. O intent-filter vive só no flavor dev, com o caminho exato
que a MainActivity aceita, e com autoVerify: sem a verificação, o Android 12+
abre a ligação no browser, onde a sessão fica, e não na app. A verificação
pede o /.well-known/assetlinks.json com a impressão do certificado da APK de
dev, e quem a tira é o deploy, do APK que acabou de compilar — é pública, não
precisa da chave nem de segredos, e assim muda sozinha se a chave de dev
mudar. Uma falha a tirá-la não trava a publicação da app web: avisa e segue.

## 2026-10-28 · Os pedidos das pessoas decidem-se antes, e a resposta é da equipa

O Martinho pediu uma skill que resolvesse os tickets de produção e do dev (os
pedidos da Ajuda e os erros apanhados) junto com os de QA. Com ela, quatro
regras dele. Um pedido de uma pessoa só se implementa depois de alguém da
equipa o aceitar no back office; primeiro pensou-se numa caixa de visto, e
ficaram dois botões, Aceitar e Recusar, porque recusar também é uma decisão e
tem de ficar escrita: pede uma justificação, que a pessoa recebe, e fecha o
pedido. Quem aceita pode aceitar com alterações, e são elas que se
implementam. Fica sempre quem decidiu e quando (a migração 0024). O Claude
nunca responde a uma pessoa: deixa a resposta proposta no pedido, e uma pessoa
da equipa lê-a e envia-a como está ou mudada; o email só sai nesse envio.
E um ticket só fecha quando a correção está publicada no ambiente dele: no
dev, com o CI verde; na produção, só depois do «promove», quando o commit já
está dentro da etiqueta publicado, que o deploy de produção só move depois de
a produção responder. Um erro fechado antes disso reabria-se sozinho na
ocorrência seguinte. Até ao «promove», os de produção ficam em resolução, com
uma nota interna e o commit. A ferramenta é o scripts/ticket.mjs, e a skill
ticket fica na pasta acima do repositório, ao lado da qa.

## 2026-10-29 · O rasto das pessoas, debaixo de um pseudónimo

O Martinho pediu para o back office ver, por pessoa real, o que ela faz na app
e na montra, com um id para a seguir mas sem o nome: nesta fase, para perceber
se as pessoas percebem a interface e os fluxos. Por isso guarda-se cada toque,
e não só os ecrãs — mas onde, nunca o quê. Ficou um pseudónimo aleatório por
pessoa, e só quem já vê as pessoas vai do pseudónimo à ficha. Os toques
sozinhos não dizem onde a interface confunde; os cinco sinais (em vão,
repetido, vai-e-volta, desistência, erro ao guardar) e o resumo por ecrã é que
o dizem.

O consentimento é um só, para a montra e para a app, porque é a mesma pessoa:
vive em cookies com o domínio raiz em produção, e fora dela só no host, para um
cookie de teste nunca chegar à produção. A pessoa pode mudar de ideias num
aparelho e noutro, por isso a escolha leva a hora e ganha a mais recente. Quem
recusa depois de aceitar não fica com nada guardado: apaga-se logo. Fechar a
pergunta da app sem escolher não é escolha, e ela volta passados 7 dias. Na
montra a faixa é HTML puro e vai no fluxo, a seguir ao hero: quem recusa não
recebe JavaScript nenhum, e a página continua a não tapar nada. O visitante da
montra liga-se à conta quando entra, para o rasto de antes da conta não se
perder; um computador partilhado não junta duas pessoas, os eventos ficam com
quem os fez.

Os eventos vivem 90 dias e saem com a conta; não vão para a cópia de
segurança, que se guarda muito mais tempo. Uma ligação guarda as chaves da
query mas não os valores, que podem ser um token. Quem vê ficou numa função
só, por emenda dele: o admin vê todas as pessoas, o suporte só quem lhe
escreveu um pedido (enquanto o pedido existir), e a auditoria da equipa
continua só do master. Mudar a Privacidade subiu a versão dos termos, e toda a
gente os volta a aceitar uma vez.

## 2026-10-29 · A quarta ronda de QA e o email dos planeados em atraso

Três tickets do Martinho, do telemóvel. A Ajuda no fundo da gaveta, tocada já
dentro das Definições, abria a página por baixo da gaveta aberta: o caminho
de lá só fechava a gaveta quando mudava de separador. Fecha-a sempre. O botão
de filtros da Visão geral sem movimentos acendia-se e não abria nada, porque
a vista vazia não desenha o seletor; um botão que se acende tem de abrir
alguma coisa, e o painel passou a dizer porque está vazio e a levar ao
primeiro movimento.

O terceiro pediu um email aos proprietários quando um movimento recorrente
fica em atraso. As decisões foram dele: um resumo por dia e só nos dias em que
há atrasos novos, para o email não virar ruído diário enquanto um atraso velho
continua por confirmar (os velhos vêm lembrados no mesmo email); os
proprietários e também os colaboradores que veem os contratos, mas cada um só
com o que o cargo lhe deixa ver na app, porque um email não pode mostrar um
valor que a app esconde; ligado por omissão, com a linha nas Definições e a
ligação no próprio email para desligar; e com o montante, porque é o que se
precisa para decidir sem abrir a app. Um atraso só conta como avisado quando
o Resend aceitou o email: sem chave ou com erro, tenta-se no dia seguinte. A
Privacidade passou a nomear estes avisos nas comunicações do serviço, dentro
da versão dos termos de 2026-10-29, que ainda não tinha chegado à produção:
ninguém aceita os termos duas vezes.

A primeira versão do passo corria no cron diário e perguntava os
participantes casa a casa. Passou nos testes e rebentou na prova no 8788, onde
a base isolada tem 1576 casas com planeados vencidos: cerca de 4700 consultas
numa invocação. Ficou no cron de hora a hora, a partir das 9h de Lisboa, com 9
consultas fixas mais uma por email e no máximo 20 emails por execução; o «um
por dia» guarda-se na mesma tabela. Cada execução lê a tabela dos registos
inteira (não há índice no kind): enquanto ela for pequena, as 15 execuções do
dia cabem no teto de linhas lidas; quando crescer, uma marca de «dia feito»
evita reler depois de não haver nada por enviar.

## 2026-10-29 · O «?» da Ajuda no lugar da nuvem

O Martinho quis a Ajuda num «?» e, vendo as opções, foi mais longe: a nuvem da
sincronização sai do cabeçalho e o «?» fica no lugar dela. Com ligação, o que
se escreve sobe em segundos, e o «Guardado», o «A ligar» e o «N por enviar»
eram ruído a passar no canto a cada gravação; o que importa dizer é quando
não se consegue guardar, e isso passou a ser uma faixa vermelha por cima do
ecrã, com as alterações que esperam, que não empurra nada (a de antes fazia
o cabeçalho crescer). Igual no telemóvel e no computador. A Ajuda tem uma
porta só, o «?»: saiu da gaveta e da barra lateral. E o «?» não aparece nas
Definições, em página nenhuma delas: é a porta dos separadores, e quem já
está nas Definições tem a Ajuda à mão. Brilha uma vez por aparelho, na
primeira abertura, quando o ecrã fica livre das boas-vindas e da apresentação
— não na primeira abertura da gaveta, como ele pensou primeiro, porque o «?»
deixou de estar dentro dela.

Nota do mesmo dia: o Martinho viu o «?» a levar à Ajuda e pediu outra coisa:
«Quero que o ? abra o tutorial da página, não que leve à ajuda nas
definições». O «?» abre agora a apresentação do separador onde se está, a
mesma que a Ajuda revê, sem mudar de ecrã; num separador sem apresentação
para esta conta não aparece. A Ajuda continua fora da gaveta, nas Definições
(«Ajuda e sugestões»).
