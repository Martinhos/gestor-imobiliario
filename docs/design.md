# Regras de design

Como a app se veste e como se comporta. Não é um manual de gosto: cada
regra aqui esteve primeiro no código, com a razão ao lado, e diz onde
está. Quando fizeres um ecrã novo, lê isto antes de inventar um botão.

As citações são ficheiro:símbolo, nunca ficheiro:linha, porque as linhas
apodrecem a cada commit: no JavaScript o nome da função ou da constante
(componentes.js:sel, auxiliares.js:PAL_LIGHT), em web/index.html o
seletor, o id ou a tag, sem espaços (index.html:.btn.primary,
index.html:#toast, index.html:<script src="app/prazos.js">). Um teste em
testes/docs.test.js confirma que cada citação aponta para código que
existe. anexos.js há em web/app e em web/cloud, por isso leva sempre o
caminho completo.

## Tokens: as cores e o papel de cada uma
Todas as cores vivem em variáveis: o claro no :root (index.html::root) e o
escuro no :root.dark (index.html::root.dark). Um hex fora daí só com um
comentário ao lado a dizer porquê. Claro → escuro, e o papel de cada uma:

--bg #f7f8fa → #12141b é o fundo da página. --card #fff → #1b1e28 é o
cartão. --field #fff → #20242f são os campos. --chip #f2f4f3 → #272b38 são
os selos cinzentos e o hover das opções dos menus. --tint #f6faf8 → #1f2330
é o hover dos cartões clicáveis e a barra do editor. --ink #17221d →
#eef0f6 é o texto. --muted #5a635e → #9aa3b8 é o texto secundário: rótulos,
hints, .small. --line #e7ebe8 → #2b3040 são os contornos; --line2 #cfd8d3 →
#3a4054 o contorno em hover.

--accent #244c3b → #5ee0a8 é a marca: o botão primário
(index.html:.btn.primary), o positivo (index.html:.pos), o ponto dos
filtros ativos (index.html:.filtbtn, o .dot), o risco à esquerda dos
cartões clicáveis (index.html:.card.tap, o ::before) e o item ativo da
barra de baixo (index.html:.tabbar, o a.on). --accent-ink #fff → #0b1410
é o texto sobre a marca. --accent-soft #dfece6 → #1c3a33 é o fundo dos
selos, dos avatares e dos ícones de secção (index.html:.badge,
index.html:.avatar, index.html:.fold-head, o .ic). --accent-press #1c3d2f
→ #7ceabb é o primário premido (index.html:.btn.primary, o :hover).

--danger #b94a48 → #ff8a80 é o negativo (index.html:.neg), o destrutivo
(index.html:.btn.danger; index.html:.menupop, o button.danger), o campo
com erro (index.html:.err) e o crachá dos pendentes (o .cnt em
index.html:nav, index.html:.tabbar e index.html:#hdrBell). --danger-soft
#f7e8e7 → #3a2326 é o fundo suave. --warn #9a6400 → #ffc35c é o aviso e o
pendente: index.html:.amber, o risco do index.html:.pend, o ponto dos
planeados no calendário (index.html:.pt.pla) e o crachá da gaveta quando
nada passou do prazo (navegacao.js:buildNav). --warn-soft #f6eeda →
#3a2f14 é o fundo.

--side #1a3a2c → #161a3a é a gaveta (index.html:aside), com --side-ink,
--side-muted, --side-hover e --side-on só para ela. --blur é o fundo
translúcido do cabeçalho e da barra de baixo (index.html:header.top,
index.html:.tabbar) — vidro com blur(12px) saturate(140%), a saturação
para as cores de baixo atravessarem vivas em vez de acinzentadas, e o
prefixo -webkit- porque o iOS antigo só lê esse. A risca de baixo do
cabeçalho nasce transparente e só se acende com a página rolada
(index.html:body.rolada, posta pelo mesmo ouvinte de scroll do toTop em
componentes.js): no topo não há conteúdo por baixo dela para separar.
--shadow (0 24px 60px
rgba(0,0,0,.28) → .6) é a sombra dos menus e das janelas. --track, --rail
264px, --rail-min 76px e os --inset-* da área segura fecham a lista.

As semânticas são três classes, .pos, .neg e .amber (index.html:.pos), e
valem em texto, KPIs e saldos. Os selos são .badge (marca), .badge.grey,
.badge.amber e .badge.red (index.html:.badge). No claro o texto dos dois
últimos desce para #7d5200 e #9c3a38: 11px pedem 4,5:1 de contraste e o
tom da marca ficava aquém (index.html:.badge.amber, com o comentário por
cima). É o exemplo de hex fora dos tokens com licença, porque tem a razão
escrita ao lado.

Os gráficos têm paleta própria: PAL_LIGHT e PAL_DARK
(auxiliares.js:PAL_LIGHT, auxiliares.js:PAL_DARK), trocadas dentro do
próprio array PAL pelo applyTheme (auxiliares.js:applyTheme), para quem
guardou referência ver as cores novas. Usa PAL[i], nunca o hex. A cor da
barra do sistema é #1a3a2c no claro e #161a3a no escuro
(index.html:#metaTheme, escrito no mesmo applyTheme).

## Tema escuro e a regra do color-scheme
O tema é 'light', 'dark' ou 'auto' (auxiliares.js:isDark) e aplica-se com
a classe .dark no <html> (auxiliares.js:applyTheme). Tudo o que depende do
tema segue os tokens; o código não pergunta o tema.

O meta color-scheme e a propriedade no :root dizem ambos «light dark»
(index.html:<meta name="color-scheme">, index.html::root). Declarar só
«light» faz o WebKit e o WebView do Android responder
prefers-color-scheme:light mesmo com o aparelho em escuro, e o automático
fica preso no claro. Só uma escolha explícita estreita o esquema
(auxiliares.js:applyTheme, a nota sobre o modo automático).

No claro escreve-se «only light», não «light»: é o opt-out do «tema escuro
para sites» do Chrome Android, que escurecia à força o modo claro (a nota
seguinte, no mesmo applyTheme).

A MediaQueryList do sistema cria-se uma vez e guarda-se
(auxiliares.js:mq). Registar o ouvinte numa criada de fresco deixa-a sem
referências, e há motores que a recolhem e param de avisar. O Safari só
ganhou addEventListener na versão 14, por isso fica o addListener de
recurso (a IIFE que fecha web/app/auxiliares.js, a seguir a
auxiliares.js:setTheme).

## Tipografia
system-ui, -apple-system, Segoe UI, Roboto; 15px de base
(index.html:body). A letra é a do sistema de quem lê — SF no iPhone e no
Mac, Segoe no Windows. A Inter saiu da frente da pilha: nunca foi
carregada como webfont, só aparecia a quem a tivesse instalada, e a letra
da plataforma já traz o desenho ótico e o espaçamento afinados por
tamanho. A landing fez a mesma mudança (worker/src/landing.js), porque
quem clica em «Abrir a app» não pode sentir que mudou de produto. Os
números alinham em tabular-nums nos valores, nas
tabelas e nas estatísticas (index.html:.value, a regra partilhada com
.table td e .stat b), para as colunas não dançarem.

A escala, toda em web/index.html: h1 19px com -.02em
(index.html:header.top); título da janela 17px (index.html:.sheet, o
.head h2); valor do KPI 22px, peso 750, -.025em, e rótulo do KPI 11.5px
em maiúsculas, .05em, 600 (index.html:.kpi, o .value e o .label);
index.html:.section-title 13px, 700, maiúsculas, .03em, muted;
index.html:.navh 10.5px, maiúsculas, .07em; index.html:.stat 13.5px;
index.html:.toast 13.5px, 550; campos e .selbtn 14px, 500
(index.html:input, index.html:.selbtn); index.html:label 12px, 600, muted;
index.html:.small e index.html:.hint 12px muted, o hint com line-height
1.55; index.html:.badge 11px, 700; index.html:.btn 550 e
index.html:.btn.sm 13px; index.html:.table 13px com cabeçalhos th 11px em
maiúsculas; barra de baixo 11px, 600 (index.html:.tabbar, o a).

Os pesos têm papel: 500 o que se escreve, 550 os botões, 600 os rótulos,
650 os subtítulos, 700 os títulos, 750 os valores. Maiúsculas só por CSS
(rótulos de KPI, section-title, cabeçalhos de tabela), nunca escritas no
texto.

## Espaçamento, raios e sombras
A página tem 18px em cima e 22px aos lados, com 1180px de largura máxima
(index.html:.wrap); no telemóvel 14 e 15 (a mesma .wrap dentro de
index.html:@media(max-width:900px)). O cartão tem 16px de padding
(index.html:.card).

Grelhas: index.html:.grid com gap 11 e colunas de 158px para os KPIs;
index.html:.cols com gap 14 e colunas de 290px para os cartões de gráfico;
index.html:.list com gap 11; index.html:.form com gap 13; index.html:.row
e index.html:.row3 com gap 11, que empilham abaixo de 520px, salvo o
intervalo De/Até, que se lê lado a lado porque empilhado parecia dois
filtros (index.html:.row.lado-a-lado). A index.html:.toolbar tem gap 10.
O index.html:.section-title leva 22px por cima e 10 por baixo. Um estado
vazio não se cola aos KPIs que o antecedem (index.html:.grid+.empty).

Os raios seguem a hierarquia da peça: 20px a janela (index.html:.sheet; 20
20 0 0 na folha de baixo, a mesma .sheet dentro de
index.html:@media(max-width:520px)), 18 o FAB (index.html:.fab), 16 o
cartão e o vazio (index.html:.card, index.html:.empty), 14 a secção, a
dobra e o addbox (index.html:.sect, index.html:.fold-head,
index.html:.addbox), 13 os menus e as opções .opt (index.html:.selpop,
index.html:.menupop, index.html:.opt), 12 o toast, a caixa das etiquetas
e as miniaturas (index.html:.toast, index.html:.tagbox,
index.html:.thumb), 11 os botões, os campos, os itens da gaveta e o avatar
(index.html:.btn, index.html:input, index.html:nav, index.html:.avatar),
10 os dias do calendário e a barra de baixo (index.html:.calday,
index.html:.tabbar), 9 o .btn.sm, as opções dos menus e o iconbtn
(index.html:.btn.sm, index.html:.selopt, index.html:.iconbtn), 999 as
pílulas: selos, etiquetas, crachás.

Só flutua o que sobe: --shadow nos menus e na janela (index.html:.selpop,
index.html:.menupop, index.html:.sheet); 0 8px 22px .28 no FAB
(index.html:.fab); 0 16px 38px .30 no painel de filtros
(index.html:.fpanel>.card); 0 6px 18px .22 no menu do FAB
(index.html:.fabmenu); a barra pegajosa deixa uma sombra só por baixo
(index.html:.toolbar.stick). Os cartões não têm sombra, têm contorno
(index.html:.card).

As camadas (z-index): 15 o menu de escolha (index.html:.selpop), 20 o
cabeçalho (index.html:header.top), 25 a barra pegajosa
(index.html:.toolbar.stick), 30 o menu de ações (index.html:.menupop), 40
a barra de baixo (index.html:.tabbar), 45 e 46 o painel de filtros
(index.html:.fpanel, index.html:.fwrap), 57 o «topo» (index.html:.totop),
58 o FAB (index.html:.fab), 59 o cartão dos primeiros passos
(cloud/guia.js:#cwGuia), 61 o véu da gaveta (index.html:.scrim), 62 a gaveta
(index.html:aside), 70 a janela (index.html:.modal), 71 o mesmo cartão dos
primeiros passos quando há uma janela aberta (cloud/guia.js:.sobre-janela),
90 o toast (index.html:.toast), 95 a dica dos gráficos (index.html:.tip).

A janela está acima da navegação de propósito, e é a partir dela que se
escolhe um número novo: o que tiver de aparecer por cima de uma janela aberta
fica acima de 70, e o resto abaixo. Esta lista é o sítio onde se vai buscar
esse número — quando ela mente, o erro sai daqui. Foi o que aconteceu ao
cartão dos primeiros passos: o 61 dele foi escolhido contra um 60 que já não
era verdade.

## Movimento
Três durações: --rapido .12s para o que responde ao dedo, --medio .2s para
o que aparece e desaparece, --lento .34s para o que atravessa distância —
a folha da janela (index.html:--rapido). Um tempo escrito à mão numa regra
nova é uma decisão que ninguém tomou.

E três curvas, sendo que a escolha entre as duas de entrada é pela
DISTÂNCIA percorrida, e não pelo gosto. A --curva é um estalido: medida no
browser, faz 83% do caminho em 30% do tempo. Num botão que encolhe 3% é
exatamente o que se quer — a reação tem de parecer imediata. Numa folha
que sobe o ecrã inteiro em 260ms, quer dizer 83% da altura nos primeiros
78ms: a janela teleporta-se e passa o resto do tempo a assentar os últimos
4%. Foi o que nos disseram a usar a app — «nem se percebe que deslizou» —
e foi também porque os gráficos «apareciam» em vez de se desenharem. A
--curva-entra faz 64% em 30% e é a de quem percorre caminho: a folha, a
gaveta, as barras a crescer, o conteúdo de uma dobra (index.html:--curva-entra).
A --curva-sai faz o inverso das duas e serve o que se fecha
(index.html:--curva-sai). Na dúvida: se o que se move percorre mais do que
uns poucos pixeis, é a --curva-entra.

A escolha entre transition e animation não é de gosto: é a arquitetura da
app. O render() troca o #view.innerHTML inteiro (vistas.js:render), o
openModal reconstrói a janela a cada escolha (componentes.js:openModal) e
o modalLayer nasce já com a classe .open (componentes.js:modalLayer) —
quase tudo o que muda de estado é um nó NOVO, e uma transition não tem
valor antigo de onde partir. Por isso as entradas escrevem-se em
@keyframes: a folha e o véu da janela (index.html:folhaEntra,
index.html:veuEntra), a folha que sobe abaixo dos 520px
(index.html:folhaSobe), os menus (index.html:popEntra), o «porquê» do KPI
(index.html:explEntra, e vistas.js:kpi, que o escreve solto dentro do
.expl), o conteúdo de uma dobra (index.html:foldEntra), os crachás de
contagem, que o buildNav e o buildTabbar recriam (index.html:selo;
navegacao.js:buildNav, navegacao.js:buildTabbar) e as barras e arcos dos
gráficos (index.html:gbar, index.html:ghbar, index.html:gdonut, postos
pelo graficos.js:cBars, graficos.js:cHBars e graficos.js:cDonut).

A transition fica para os poucos sítios onde a classe troca num nó vivo:
o dia escolhido do calendário (calendario.js:calSel troca o .on sem
redesenhar a grelha) e tudo o que reage ao dedo, que é reação e não
entrada.

E uma entrada precisa sempre de um portão, porque «nó novo» não quer
dizer «alguém pediu». O render corre a cada sincronização de fundo — de
três em três minutos, quando a app adota o estado do servidor
(cloud/nucleo.js:applyState) — e a cada gesto que só mexe num cartão.
Sem portão, os gráficos redesenhavam-se e os crachás saltavam sozinhos a
meio de uma leitura. São três portões, um por natureza de entrada:
os gráficos animam-se só quando foi uma navegação a pedir a pintura
(vistas.js:render põe a marca, navegacao.js:go e navegacao.js:goSet
ligam-na); o crachá pulsa só quando o número muda desde a última vez
(navegacao.js:cntNovo); a dobra entra só quando foi um toque a abri-la
(componentes.js:toggleFold). A folha da janela e os menus não precisam de
portão: só nascem quando alguém os abre.

O escalonamento das formas de um gráfico escreve-se em cada forma, onde
o índice se sabe (graficos.js:atrasoEntrada): em SVG as barras são irmãs
dos elementos do eixo, e um :nth-child conta-os a eles também. São seis
degraus de 30ms e depois pára — com mais, um gráfico de doze barras
demora mais a desenhar-se do que a ser lido.

Anima-se a entrada, não a saída — com uma exceção, e é a que se vê a
seguir. Fechar uma janela tira-lhe o nó (componentes.js:closeModal): animar
a saída obrigava a adiar essa remoção e a mexer na pilha de janelas, e a
app fecharia mais devagar do que a pessoa quer que feche.

A exceção é quando alguma coisa sai de UMA LISTA, e aí a saída é metade do
que se está a dizer. Confirmar um planeado fazia o cartão desaparecer e as
linhas de baixo aparecerem mais acima — não porque tenham subido, mas
porque são nós novos que nasceram noutro sítio. Nada se moveu, e por isso
nada se via mover. O vistas.js:render mede onde cada peça está antes de
repintar e, depois, desliza as que mudaram de lugar, faz entrar as que
chegaram e desvanecer as que saíram (continuidade.js:medirContinuidade e
continuidade.js:aplicarContinuidade) — o nó que saiu não é clonado, é o
próprio, que continua vivo depois de o documento o deitar fora.

É o render que o faz, e não cada sítio a pedir: quando isto estava ligado a
três chamadas escolhidas à mão, todas as outras listas — inquilinos,
movimentos, visitas — continuavam a trocar de golpe, e ninguém tinha por
onde dar por isso. Quem repinta não se pode ter de lembrar.

Uma chave, um dono. O data-lp é do TOQUE LONGO e o data-fk é da
continuidade; uma linha que quer os dois põe os dois. Aceitar o data-lp
aqui pareceu economia e não era: os blocos da visão geral têm-no para o
modo de edição, e passaram a deslizar sozinhos — 606px, medidos. Sem
chave, uma peça é só «mais uma».

Duas coisas que esta técnica não perdoa, e que custaram as duas um defeito
que só se viu a usar. A primeira: as posições contam-se a partir do
DOCUMENTO e não da janela (continuidade.js:ondeEsta). O
getBoundingClientRect conta a partir do canto do ecrã, e qualquer scroll
entre a medição e a aplicação vira um deslocamento que nunca aconteceu —
há um mesmo no meio, porque o navegacao.js:go faz scrollTo(0,0) depois do
render e antes da microtarefa. Medido: tocar no separador em que já se
está, com a página a 600, punha os blocos da visão geral a deslizar 606px
sem nada ter mudado.

A segunda: estar à vista decide o que vale a pena ANIMAR, nunca o que
EXISTE (continuidade.js:porPerto). Quando decidia as duas coisas, uma peça
fora da janela parecia ter chegado agora — entrava a desvanecer — ou ter
saído do ecrã, e ficava um fantasma fixo por cima do conteúdo. Existir é
uma pergunta ao documento.

Três limites que a regra tem de respeitar, e que são a razão de ela não ser
um simples embrulho: só dentro do MESMO ecrã, porque mudar de separador
troca tudo o que lá está e animar isso seria uma revoada; só o que está à
vista, com um ecrã de folga, porque animar quatrocentas linhas que ninguém
vê é trabalho para ninguém ver; e a aplicação fica para uma microtarefa,
porque o render é embrulhado quatro vezes pela camada da nuvem e são esses
embrulhos que acrescentam as caixas e os kebabs — medir antes deles seria
medir posições que ainda vão mudar.

Onde não há peças a acompanhar mas há uma direção — o mês seguinte do
calendário, entrar numa categoria do gráfico — usa-se o
continuidade.js:deslizarEntre, e o deslocamento é a largura INTEIRA, não uma
fração dela. A diferença não é de grau: um cartão que desvanece diz
«trocou», dois cartões a correrem juntos a largura toda dizem «andei para o
lado», que é o que um mês seguinte é. A meio caminho lê-se como um
estremeção — foi assim que ficou à primeira, e não passou no uso.

A largura inteira obriga a recortar, senão o que sai atravessa o resto da
página a caminho da margem: os dois correm dentro de uma caixa do tamanho
exato do sítio (continuidade.js:correrAFita). E não se vira a página para a mesma página: se o que entrou é igual
ao que saiu, houve uma repintura mas não houve troca, e uma fita a correr
para mostrar o mesmo lê-se como a app a fazer um gesto que ninguém pediu.
O que entra é um clone e o
verdadeiro fica no lugar, invisível, até a fita acabar — mexer na árvore
viva a meio de uma animação deixava-a a meio se chegasse uma repintura. E
tudo o que entra na caixa perde os ids: durante esses 340ms o nó antigo
ainda está no documento, e um getElementById que passasse por ali podia
apanhar o que já saiu (continuidade.js:semIds).

Estas animações são feitas pela API do JavaScript, e o
index.html:@media(prefers-reduced-motion:reduce) NÃO as apanha: cada uma
pergunta primeiro pelo continuidade.js:semMovimento. E nenhuma delas pode
ficar com a repintura — se não puder animar, chama e sai da frente
(testes/continuidade.test.js).

O que se toca afunda-se: sempre :active e nunca :hover, que no iOS fica
preso depois do toque, e num telemóvel é o único sinal que existe entre o
dedo e o resultado. E o premido tem cor PRÓPRIA — o index.html:--press,
mais fundo do que o --chip de passar por cima. Não é preciosismo: quando
as duas coincidiam, com rato o ponteiro ficava em cima depois do clique, o
:hover mantinha a cor, e o toque seguinte não mudava nada. A app parecia
deixar de responder à segunda vez. A régua é a superfície: scale(.97) nos botões, opções
e separadores, .98 no que é grande (index.html:.addbox, a dobra, a
legenda), .99 no cartão (index.html:.card.tap). Quem já usa o transform
para se colocar leva o scale a seguir ao que lá está, senão salta do
sítio (index.html:.totop:active). O fundo premido é o --chip, e só onde
há fundo neutro para escurecer: quem está ativo fica com o seu, o
primário escurece para --accent-press e a gaveta tem paleta própria
(index.html:.btn.primary:active).

O foco desenha-se com 2px de --accent e 2px de afastamento, em
:focus-visible e nunca :focus — quem chega de rato não pode ir deixando
anéis por onde passa. A lista de classes não chega: o tornarFocavel()
torna alcançável tudo o que tem onclick (vistas.js:tornarFocavel), e
medimos dezanove sítios sem anel só na visão geral — por isso há a rede
do index.html:[role="button"], que é o que ele escreve. Na gaveta o anel
vem da paleta dela e não do --accent: sobre o --side, o --accent dá
1.29:1 e o anel existia sem se ver (index.html:.railbtn:focus-visible).

Quem pediu menos movimento ao sistema não recebe nenhum: uma só regra
apaga animação e transição em tudo
(index.html:@media(prefers-reduced-motion:reduce)). É por isso que
nenhuma entrada pode ser a única coisa que torna um conteúdo visível — o
estado final tem de ser o que se vê sem animação nenhuma.

E os outros dois pedidos do sistema têm o seu recuo: quem pediu menos
transparência recebe o vidro sólido — o cabeçalho com o fundo da página,
a barra de baixo com o do cartão
(index.html:@media(prefers-reduced-transparency:reduce)) — e quem pediu
mais contraste recebe contornos mais fundos, só pelos tokens das linhas,
para tudo o que os cita mudar com eles
(index.html:@media(prefers-contrast:more)).

## Componentes da casa, e quando usar cada um
sel(id,value,options,onchange) (componentes.js:sel) é O menu de escolha.
Nunca um <select> nativo: destoava nos formulários e destoa no topo (o
banner de web/app/componentes.js; o seletor de contas de teste em
entrada.js:cwTrocaConta). O valor fica num input escondido que val(id) lê
(componentes.js:val); onchange é o NOME de uma função global. {div:true} é
uma linha separadora; os grupos vão no fim com gdiv e gOpts
(componentes.js:gdiv, componentes.js:gOpts). O menu vira-se para cima ou
encolhe para caber no primeiro antepassado que corta
(componentes.js:posicaoPop, componentes.js:ajustarPop). Nunca cresce até
ao espaço disponível: um menu de 16 categorias tomava 488px do ecrã (a
nota do posicaoPop).

menu(id,items) (componentes.js:menu) é o ⋯ das ações de um registo;
{danger:true} pinta a opção de vermelho. Nos cartões das listas o ⋮
(vistas.js:kebab) abre exatamente o mesmo menu que o toque longo (data-lp
e componentes.js:lpMenu): uma lista de ações por tipo de registo, não
duas. O que destrói (Apagar, Remover, Eliminar, Terminar) fica vermelho
também na folha do toque longo (componentes.js:lpShow). Todos os menus
fecham ao clique fora (componentes.js:closePops, chamada pelo ouvinte de
click do arranque, em web/app/arranque.js).

pode(pid,perm) antes de mostrar uma ação (acessos.js:pode). Num imóvel onde
o utilizador só colabora, o cargo diz o que se vê e o que se adiciona; o
servidor já despe os dados e recusa as escritas, mas um botão que leva a
uma recusa é um botão a mais. Por isso cada ação pergunta primeiro: o menu
do toque longo e do ⋮ filtra as opções (componentes.js:lpMenu), os FABs e
os seletores de imóvel dos formulários só listam onde se pode adicionar
(acessos.js:casasComo, acessos.js:propOptsPara; movimento.js:txBody), a
ficha do imóvel abre só de leitura sem «Editar a ficha»
(imovel.js:propView), uma ficha de inquilino idem
(pessoas.js:personView), e as contas entre proprietários são dos
proprietários (vistas.js:balancesCard, acessos.js:souDono). Editar e apagar
é só o que o próprio adicionou (acessos.js:podeEditar); quando a ação
chega mesmo a um guardar sem permissão, recusa-se com a frase de
acessos.js:motivoRecusa num toast, nunca com um selo vermelho mais tarde.
Sem sessão nada disto existe: tudo é «dono» (acessos.js:cargoDe).

openModal(title,body,foot,menuHtml) (componentes.js:openModal) abre uma
janela por cima do que houver; a anterior desce na pilha, escurecida e
inerte, e volta quando a de cima fecha (componentes.js:modalStack,
componentes.js:demote, componentes.js:promote). Quem chama define onSave
depois (componentes.js:onSave, a propriedade que aponta sempre para a
janela de cima); o rodapé por omissão é Cancelar + Guardar
(componentes.js:fillModal). setModal substitui o conteúdo sem empilhar
(componentes.js:setModal). Fechar por um caminho de abandono (véu, X,
Escape, voltar) com alterações por guardar pergunta «Sair sem guardar?»
(componentes.js:closeModal); Guardar e Cancelar fecham sem perguntar,
porque são decisões e não acidentes. Só conta como mexido o que vier de um
dedo ou de um teclado a sério (o isTrusted em componentes.js:openModal): a
renda sugerida não é trabalho de ninguém. A pergunta veste o tema da app,
nunca o confirm() do browser (a nota dentro do closeModal). Abaixo de
520px a janela é uma folha encostada em baixo (index.html:.sheet dentro
de index.html:@media(max-width:520px)).

confirmModal(title,text,cb) (componentes.js:confirmModal) é para quando
NÃO há como desfazer. O botão diz o verbo do título e veste-se de perigo
se o título começar por Apagar, Remover, Eliminar ou Terminar: um
«Confirmar» primário igual ao Guardar convidava ao reflexo. O texto diz o
que se perde (componentes.js:delFileConfirm: «desaparece já daqui e do
armazenamento. Não há como desfazer.»).

comDesfazer(msg,restaurar,aoExpirar) (componentes.js:comDesfazer) é para
quando o apagar é frequente e reversível: sai já do ecrã e dos cálculos, e
o toast traz «Anular» seis segundos. É a regra do delTx
(movimento.js:delTx): sem confirmação, com Anular, porque a pergunta
constante ensinava o dedo a confirmar sem ler. A confirmação trava o
engano de quem lê; o Anular salva o engano de quem confirmou por hábito.
aoExpirar liquida o que não volta (blobs) só quando a janela fecha sem
cliques. Silenciar um prazo usa o mesmo (prazos.js:pzSilencia).

toast(m,op) (auxiliares.js:toast) é para o que aconteceu: 2,8 segundos,
frase curta com ponto final. Tem role=status e aria-live
(index.html:#toast).

falhaCampo(id,msg) (componentes.js:falhaCampo) é para o que falta num
formulário: o toast diz, o campo aponta (index.html:.err), vai ao ecrã,
recebe o foco e larga o realce à primeira tecla. Não se mostra um toast
longe do campo.

pickModal(title,options,onPick,extra) (componentes.js:pickModal) é
escolher de uma lista de cartões, com ícone ou avatar; o rodapé é
«Voltar». promptModal(title,label,value,cb) (definicoes.js:promptModal) é
um campo só, com Enter a valer Guardar. Nunca o prompt() do browser.

fold(id,title,body,{open,icon,summary}) (componentes.js:fold) é a secção
que abre e fecha dentro dos formulários. open é só o estado inicial:
depois manda o foldState (componentes.js:foldState), que sobrevive aos
re-renders enquanto a janela estiver aberta. summary aparece no
cabeçalho, visível mesmo com a secção fechada (index.html:.fold-head, o
.fsum).

fab(actions) (vistas.js:fab) é o botão de criar: um por página, no canto
inferior direito; com várias ações sai o menu. O render acrescenta o
espaço no fundo (vistas.js:render, o .fabpad) e no telemóvel o botão sobe
acima da barra de baixo (index.html:.fab dentro de
index.html:@media(max-width:900px)). A visão geral também tem o seu (no
mesmo render): registar uma renda avulsa custava quatro toques de viagem.

kpi(label,value,cls,foot,why,evo) (vistas.js:kpi) é o cartão indicador:
rótulo em maiúsculas, valor grande, rodapé em muted. Com why ganha um «?»
no canto e abre a explicação ao toque (index.html:.kpi.why); com evo ganha
o ícone de tendência e abre a evolução mês a mês e ano a ano
(vistas.js:kpiModal). As explicações vivem em WHY (vistas.js:WHY): uma ou
duas frases, o que é e o que não é.

card(title,sub,body) (vistas.js:card) é o cartão genérico das vistas.
.card.tap é o clicável: risco de acento à esquerda e reação ao toque; o
informativo fica liso (index.html:.card.tap). .pend e .pend.late marcam à
esquerda em aviso e em perigo (index.html:.pend, index.html:.pend.late).

Os restantes: tagField para etiquetas removíveis
(componentes.js:tagField), fileBlock para anexos e fotos
(componentes.js:fileBlock), .addbox para «adicionar mais um»
(index.html:.addbox), .opt e .seg para escolhas visuais com ícone, como o
tipo de movimento (index.html:.opt, index.html:.seg), .empty para o
estado vazio (index.html:.empty), .tip para a dica dos gráficos
(index.html:.tip; graficos.js:chartTip).

## O motor das listas
A app pinta trocando o innerHTML: a vista é gerada em texto e o browser
volta a construir tudo. Medido com 500 movimentos, são 6 110 nós e ~48ms
por pintura, e a maior parte disso é o browser a ler HTML que descreve
linhas iguais às que já lá estavam. Escrever uma letra na pesquisa pagava
esse preço por tecla.

Os Movimentos são a primeira vista com motor próprio, e o motor entra ao
lado do antigo em vez de o substituir. A vista devolve a MOLDURA —
indicadores, saldos, dívidas, uns cem nós que não custam nada — e um
vistas.js:pintarListaTx enche a lista por chave: cada linha traz o id do
registo, guarda-se o HTML com que foi feita, e na pintura seguinte
compara-se texto com texto (lista.js:reconciliar). Igual, não se toca —
o nó fica com o scroll, o foco e as marcas de seleção que tinha.
Diferente, refaz-se só essa. A ordem acerta-se com insertBefore, que é
mover e não recriar.

Comparar o HTML e não os dados é de propósito. Uma linha não depende só do
movimento: depende do nome do imóvel, do contrato, de quem pagou, do modo
de seleção, do cargo de quem está a ver. Uma assinatura feita à mão sobre
os dados esquecer-se-ia de um desses e a linha ficava velha sem se saber
porquê. Gerar o texto é a parte barata — 3ms para as 500 linhas todas; o
que custa é o browser lê-lo.

O que muda tem de ficar FORA da assinatura de quem o contém. O saldo do
mês estava dentro do bloco do mês, e medimos o resultado: filtrar refazia
três meses inteiros e recriava as 63 linhas que sobravam, com zero nós
reaproveitados. O saldo passou a ser escrito depois de reconciliar
(vistas.js:txMesHtml deixa um span vazio).

E os caminhos que só mexem no que se vê deixaram de chamar o render:
escrever na pesquisa, mudar um filtro e trocar a ordenação passam pelo
vistas.js:refrescarMovimentos. Medido com 501 movimentos: uma tecla passou
de ~48ms e 6 110 nós refeitos para 4–12ms, com zero linhas recriadas e
zero movidas — só saem as que deixaram de servir.

Quem migrar a vista seguinte tem três coisas a respeitar: a chave é o id
do registo e vive num data-chave que o reconciliar escreve; quem refaz
linhas sem passar pelo render tem de repor o que vive no DOM (o
tornarFocavel e as marcas da seleção, CW.selPintar); e o caminho curto tem
de acertar o que está fora do #view — o botão dos filtros
(vistas.js:pintarBotaoFiltros).

## As famílias dos pontos de interação
A app tem 233 pontos em que alguém toca, escreve, arrasta ou chega pelo
teclado. Quase todos os defeitos de interface desta fase foram erros de
CATEGORIA — uma regra pensada para uma família aplicada a outra: o afundar
de um botão posto nas formas de um gráfico (as barras saltavam ao toque), a
chave do toque longo reaproveitada como chave de animação (a visão geral
deslizava 606px sozinha), a fita de virar a página posta num gráfico que só
devia redesenhar-se. Nenhum foi um erro de lógica.

São dois eixos, e só um se declara.

**O que o ponto toca** — declara-se num data-toca, porque não há como
adivinhá-lo de fora:

- nada — responde e acaba em si (uma dica, abrir uma dobra, copiar para a
  área de transferência). Repintar aqui É o erro: apaga o estado que se
  acabou de pôr.
- vista — muda o que se vê e não escreve nada (filtrar, pesquisar, ordenar,
  escolher o âmbito, redesenhar uma peça, virar a página). A posição de
  leitura e o foco do teclado têm de sobreviver.
- camada — abre uma janela por cima. O ecrã de baixo fica exatamente como
  estava; um render() aqui é um defeito.
- rascunho — muda o formulário em memória. Ritual obrigatório: colher antes
  de repintar, senão o que a pessoa escreveu desaparece.
- dados — escreve, na base ou no servidor. Recibo obrigatório, e a permissão
  reverificada no momento de gravar e não só no de abrir.
- modo — muda o significado de todos os outros pontos do ecrã (a seleção, a
  edição do painel). Precisa de saída garantida por todos os caminhos.
- ecra — leva a outro ecrã. É a única família a que a animação de chegada
  pertence.

**Como se alcança** — NÃO se declara: lê-se do DOM (testes/ui/invariantes.js).
Um button ou um a é nativo; um div com role=button é um alvo promovido pelo
vistas.js:tornarFocavel; o que está dentro de um svg é uma forma; o que só
existe por data-lp é um gesto. Um atributo a mais seria uma segunda verdade
a dessincronizar-se da primeira — foi exatamente isso que aconteceu quando o
data-lp passou a valer também como chave de animação.

Os contratos que se verificam no browser, a cada cena do percurso: uma forma
de gráfico nunca escreve nem navega (é a família do «reage com o desenho, não
com o afundar de um botão»); quem escreve tem de ter nome, porque um alvo mudo
que grava não tem como ser explicado a ninguém; e quem destrói declara-o, com
um data-risco, para o texto do aviso e a existência de Anular deixarem de ser
escolhas de hábito.

E a regra que sai de tudo isto, e que já foi aprendida duas vezes: uma
fábrica de botões não inventa a família — recebe-a de quem a chama. Era
assim que os pontos mais perigosos da app (apagar um imóvel, um contrato,
uma hipoteca) e todas as opções dos menus de escolha ficavam fora das
verificações. O mesmo botão, com o mesmo aspeto, ora filtra, ora mexe no
formulário, ora grava: só quem o cria sabe qual é.

A cobertura é medida e só pode subir: o percurso conta os pontos sem família
e falha se passarem do que estava. Uma taxonomia que só vive num documento
apodrece — e temos a prova, porque o data-lp ERA a categoria «linha com toque
longo», estava escrito, e foi reaproveitado na semana seguinte sem que nada
travasse.

## Padrões de página
O cabeçalho é o header.top (index.html:header.top): título e subtítulo
vêm de TABS (navegacao.js:TABS; vistas.js:render). O sino das
notificações só aparece na visão geral (notificacoes.js:notifSino).

Os filtros não ocupam a página: estão atrás do botão de funil do
cabeçalho (vistas.js:hdrFiltToggle, vistas.js:hdrFiltN; o render
pinta-o). O botão ganha um ponto quando há filtros ativos
(index.html:.filtbtn) e fica primário com o painel aberto. O painel
(index.html:.fwrap, index.html:.fpanel) é pegajoso e flutua por cima do
conteúdo sem o empurrar: preso ao topo, desaparecia ao primeiro scroll.

Os três painéis de filtro tinham três feitios; fica UM (a nota do
vistas.js:lfSel): mexes, a lista muda logo atrás; «Limpar» à esquerda,
«Fechar» primário à direita, em todo o lado. lfBar (vistas.js:lfBar)
monta-o: pesquisa no topo com o botão de limpar, seletores empilhados
(vistas.js:lfSel), ordenação (vistas.js:lfSort) e a linha «N resultados
com os filtros ativos» quando os há. lfHit (vistas.js:lfHit) faz a
pesquisa por palavras e frases entre aspas, sem ligar a acentos. anaPanel
(vistas.js:anaPanel) faz o mesmo para os ecrãs de análise. A pesquisa
espera 280 ms e devolve o foco com o cursor no fim (vistas.js:lfSearch,
vistas.js:onTxSearch).

Uma lista é um .list de .card.tap com data-lp: título, .small com o
essencial separado por «·», .chips com selos e o ⋮ à direita
(vistas.js:vProperties). As secções por imóvel usam o .section-title com
o total à direita (vistas.js:vContracts). Um ecrã de análise é KPIs em
.grid e cartões de gráfico em .cols (vistas.js:vDashboard;
avaliacao.js:portCard).

Todo o vazio convida: um <b> a dizer o que falta e uma frase a dizer o que
fazer (vistas.js:vDashboard, vistas.js:vProperties, vistas.js:vContracts,
vistas.js:vTenants, vistas.js:vOwners; planeados.js:vRecurring). Com
filtros ativos o vazio é «Nada neste filtro» com o botão «Limpar
filtros», que limpa seja o que for sem saber onde está
(vistas.js:limparFiltroAtual).

O que é longo abre fechado, e a escolha fica no aparelho: o cartão dos
movimentos por confirmar (planeados.js:pendingCard, planeados.js:pendShut;
a chave gi_pend_shut é planeados.js:PEND_LS) e o dos prazos
(prazos.js:pzShut, gi_pz_shut). A visão geral existe para se ver o
património de relance; quatro movimentos abertos ocupavam 600 dos 900px
antes de aparecer um único indicador. O cabeçalho diz o que é preciso
saber (quantos, quantos em atraso, quanto); a lista abre-se com um toque.
Guarda-se '0' explícito quando se abre, para distinguir «nunca mexeu» de
«quis aberto».

Quando a mudança é local, repinta-se só o cartão, não a vista:
vistas.js:donutDrill, planeados.js:pendToggle e o dia do calendário
(calendario.js:calSel troca a classe .on na grelha e repinta só o painel
de calendario.js:calDiaPanel). render() substitui o innerHTML de #view e
perde o estado do DOM (vistas.js:render; index.html:#view).

## Um gráfico lê-se com o dedo
Tocar numa barra cuspia um balão que aparecia DEBAIXO DO DEDO e ia-se
embora ao fim de 2,2 segundos. Três coisas mal, e todas se veem a usar: a
mão tapa o que se quer ler; o valor desaparece antes de se poder comparar
com o do lado; e ver outro mês obriga a outro toque, com o primeiro já
esquecido.

Agora o dedo percorre o gráfico, uma guia acompanha a coluna mais próxima e
os valores dessa coluna aparecem numa faixa FIXA no topo do próprio
gráfico — no sítio onde a mão não está, e sem sair enquanto o dedo não sair
(graficos.js:mostrarColuna). A faixa e a guia são sobrepostas: um gráfico
não pode mudar de altura só por alguém lhe tocar. E o gesto é horizontal
(index.html:.chartbox com touch-action), para o scroll vertical continuar a
funcionar por cima dele.

Os dados de que a leitura precisa vivem no próprio elemento
(graficos.js:dadosParaLer), e os ouvintes vivem no documento: os gráficos
nascem e morrem a cada repintura, e ouvintes pendurados neles morriam com
eles.

A guia usa as POSIÇÕES que cada gráfico já calculou, e não uma fórmula
(graficos.js:dadosParaLer). Chegou a guardar só os limites do desenho e a
calcular o resto como se fosse um gráfico de linhas — onde os pontos se
espalham de ponta a ponta. Num histograma as colunas ficam no meio de
faixas iguais, que é outra conta, e a guia aparecia ao lado da coluna.
Quem sabe onde pôs as colunas é quem as desenhou.

E o balão desapareceu de vez. No donut, a legenda ao lado já tem o rótulo,
o valor e a percentagem de cada fatia; nas barras horizontais, cada linha já
tem o nome e o número escritos por cima. O balão repetia o que já se lia e
cobrava caro: roubava o toque — no donut há uma ação a sério, entrar na
categoria — e, por ser um onclick, fazia de cada forma uma paragem do Tab
sem destino.

Foi o que fechou a dívida das «paragens do Tab»: as formas deixaram de ter
toque próprio e o gráfico ganhou uma descrição só
(graficos.js:descricaoDoGrafico), que era exatamente o que a dívida pedia.
Medido: de 37 formas alcançáveis pelo Tab para zero.

## Uma tabela só quando diz o que o gráfico não diz
A janela de um indicador (vistas.js:kpiModal) mostrava sempre a tabela do
ano a ano — e, na visão geral, essa tabela era o segundo gráfico escrito por
extenso: os mesmos anos, os mesmos valores, mais nada. Ler duas vezes a
mesma coisa não é ler melhor.

Fica quando há uma **segunda coluna**, que o gráfico não pode mostrar e que
quase sempre está noutra unidade: o Yield bruto traz a renda anual em euros,
o LTV e o Equity trazem a dívida, a avaliação traz o NOI. E fica quando não
há gráfico nenhum para repetir — com um ano só não se desenha uma linha, e
sem a tabela o bloco desaparecia (vistas.js:tabelaDoKpi).

Medido: na visão geral, quatro cartões e nenhum com segunda coluna — a
tabela sai dos quatro. Na Avaliação e nas Projeções, seis cartões trazem-na
e ficam com ela; cinco não, e perdem-na.

## Uma comparação diz de que números fala
Uma variação («▲ 18%») pendurada num número que não é da mesma natureza é
uma afirmação falsa, e das que ninguém deteta a olho. Aconteceu: a faixa dos
indicadores comparava anos por cima do Saldo dos Movimentos, que soma o
filtro inteiro — o cartão mostrava −17 000 € e a variação falava de
−3 400 €, o valor de 2026. Quem lê vê uma percentagem ao lado de um número
e assume que é dele.

Duas guardas, e são de naturezas diferentes de propósito. A faixa só NASCE
onde o valor é anual, e é quem cria os cartões que o declara
(vistas.js:vDashboard marca a série; vistas.js:kpi lê a marca) — na visão
geral o valor é o do ano, nos Movimentos é a soma do filtro. E, mesmo aí,
só FALA se o texto do cartão for exatamente igual ao do ano formatado pela
própria série (vistas.js:falaDoMesmo): a segunda guarda é a que se verifica
a si própria, e apanha o caso em que alguém mude um cartão sem se lembrar
da marca.

E diz o número de que fala. «face a 2025» nomeia o ano e não o termo de
comparação; «2025: 4 400 €» ao lado de 2 200 € dispensa a pergunta.

## Um número que chega a contar
Os valores dos indicadores contam até ao número, ao CHEGAR a um ecrã. É uma
escolha de gosto — mas há três coisas nela que não são de gosto.

Só a chegar, e nunca a cada repintura: o render corre também na
sincronização de fundo, e um número a contar de três em três minutos não é
vida, é ruído. É a mesma marca que os gráficos usam.

Não inventa o formato. O texto final é o que a app já formatou — com o
espaço a separar milhares, o sinal de menos próprio e o símbolo da moeda — e
a contagem lê a FORMA do original e troca só os dígitos
(vistas.js:comAFormaDe). No fim escreve de volta o texto original, tal e
qual: assim não há maneira de a animação deixar o número diferente do que
devia ser.

E nada salta: a largura fica presa no valor final antes de começar, porque
um número que ganha dígitos ganha largura e empurra o que está ao lado. Com
uma rede por tempo a devolvê-la, porque num separador escondido o
requestAnimationFrame não corre — e aí a contagem nem começa, o que é o lado
bom da falha: o texto de partida já é o final.

## O que a app diz sobre o que guardou
A app escreve no aparelho e sincroniza depois. Quem acaba de escrever alguma
coisa tem de poder saber se ela já subiu, e o silêncio não serve para isso:
o silêncio quer dizer «está tudo enviado» e quer dizer «ainda não tentei», e
são coisas diferentes.

O selo (cloud/entrada.js:setSyncBadge) tem três estados, e o que os separa é
quanto tempo ficam. «Guardado» é um recibo: aparece e sai ao fim de dois
segundos, porque um letreiro permanente deixa de se ler. «N alterações por
enviar» fica enquanto houver — é o estado que faltava, e o número é o das
operações que o próximo envio vai levar (cloud/nucleo.js:pushNow), não uma
estimativa. «Sem ligação» fica até haver.

E vive por baixo do cabeçalho, não em cima dele: estava no canto superior
direito, que é onde o sino mora, e ninguém tinha dado por isso porque nenhuma
cena do percurso o mostrava — só aparecia quando a ligação caía. Agora há uma
cena por estado e uma regra que guarda o sítio (testes/ui/invariantes.js).

## Uma porta, e nenhum beco
As opções de um registo — editar, duplicar, apagar, selecionar vários —
chegam por três caminhos no código: o kebab das listas
(vistas.js:kebab), o dos movimentos (cloud/selecao.js) e o menu de ações
(componentes.js:menu). Davam três desenhos: 44×44 com o nome «Opções» nos
movimentos, 36×40 **sem nome nenhum** nas listas de imóveis, inquilinos e
planeados, e 44×44 com o nome «Mais» nas visitas. O mais usado era o que
não tinha rótulo, e um leitor de ecrã anunciava «botão» e mais nada.

Passam a ser a mesma classe (index.html:.opcoes): o mesmo ícone, o mesmo
nome e uma caixa **dada**, 44×44, não calculada — com padding, o alvo
saía do tamanho do ícone mais a entrelinha do texto à volta, e dava 36×40
sem ninguém ter pedido nada disso. O percurso mede-o em cada cena: quem
chama lpMenu, menuOpen ou CW.txOpcoes tem de ser esta porta
(testes/ui/invariantes.js). Sem essa regra, a próxima lista nasce com o
quarto desenho e ninguém dá por ela até alguém tentar usar a app sem
saber que o toque longo existe.

O botão redondo do canto também ganhou nome (vistas.js:fab). Tinha
`title`, que o rato mostra e o teclado não, e quando havia várias ações
nem isso — o botão que abre o leque anunciava-se «botão».

Um ecrã que diz «não há nada» e não diz por onde se começa é um beco.
Onde há FAB, o FAB é o caminho; havia quatro sítios onde não havia
caminho nenhum: avaliação sem imóveis (avaliacao.js:vReports), contratos
sem imóveis e projeções sem contratos (vistas.js:vContracts,
vistas.js:vProjections) e hipotecas sem imóveis (creditos.js:vCredits) —
esta última com um botão que só dava um aviso a dizer que faltava um
imóvel, e um caminho que acaba num aviso não é um caminho. Todos ganham
o mesmo botão (vistas.js:saida), pelo molde que as visitas já usavam.

## Um aviso não tapa o que se pede para carregar
O toast mora a 22px do fundo, que é exatamente onde o rodapé de um modal
está: com um modal aberto, caía em cima de «Guardar» e «Cancelar». Sobe
a altura do rodapé que está aberto, medida e não adivinhada — há rodapés
de duas linhas (auxiliares.js:toast; index.html:.toast, o --acima).

E «Anular» deixou de ser um link. Estava sublinhado, com cor de link,
deitado sobre a barra escura do aviso — e é a única saída de uma ação que
já aconteceu. O que desfaz o que se acabou de fazer não pode parecer
texto: passa a botão, com fundo e caixa (index.html:.toast .toastbtn).

## Tocar num registo é lê-lo
Tocar num contrato abria um formulário com quarenta campos editáveis. Num
imóvel, vinte e um. Quem só queria saber quando acaba o contrato tinha de o
procurar dentro de um formulário, e o «Apagar contrato» estava encostado ao
título de uma janela que ninguém tinha pedido para abrir.

Havia uma ficha de leitura no código inteiro, e só a via quem **não podia**
editar (imovel.js:propView). Para todos os outros, a app não tinha modo de
leitura nenhum: o que existia era o formulário com os campos desativados um a
um — um formulário a fingir de ficha, que mostrava a alguém tudo o que não
pode fazer, cinzento, e chamava-lhe leitura.

Esse já não existe. Quem não pode alterar recebe a ficha, e a verificação
está **antes** de abrir a janela (contrato.js:ctModal, movimento.js:txModal,
pessoas.js:personModal, planeados.js:editRec): não se decora uma janela já
aberta, escolhe-se qual é a janela a abrir. E a ficha diz porquê com a frase
da permissão que falta (acessos.js:motivoRecusa), que é melhor do que o «só
de leitura» genérico que o formulário apagado dava.

Agora tocar lê, e editar é um passo deliberado: o botão do rodapé, que só
existe para quem pode (componentes.js:fichaRodape).

As peças são uma só, para não nascerem sete desenhos de ficha como tinham
nascido três desenhos de porta. O corpo escreve-se com componentes.js:ficha,
que recebe linhas e deita fora as que não têm valor — uma ficha mostra o que
se sabe, e um rótulo com um traço à frente é ruído a fingir que é informação.
As linhas são as mesmas `.stat` que a app já usa em toda a parte
(index.html:.stat).

O título e o corpo são **funções**, e não texto (componentes.js:abrirFicha).
O formulário abre-se por cima da ficha, e quem guarda por cima deixava-a a
dizer o que já não é verdade. Assim a ficha volta a ler a base sozinha
(componentes.js:refrescarFichas, chamada no fim de cada render — o sinal que
a app já dá quando alguma coisa mudou): ver, editar, e voltar ao que se
estava a ver, já mudado.

E uma janela ou se lê ou se edita, nunca as duas coisas: uma janela com
«Editar» no rodapé não pode ter campos (testes/ui/invariantes.js). Sem essa
regra, o caminho mais curto de acrescentar mais um campo à ficha é escrever
lá um input, e ao fim de uns meses está tudo como estava.

### A lista agrupada
Os contratos são a única lista agrupada — um título por imóvel, e os contratos
desse imóvel por baixo. Entrar no motor pediu quatro coisas, e são as quatro
que qualquer outra lista agrupada vai pedir:

1. **O grupo é UM elemento.** O `pecaDe` fica com o primeiro filho do html de
   cada item; dois irmãos — o título e a lista — perdiam o segundo em
   silêncio, e apareciam os títulos sem contratos nenhuns.
2. **Os grupos precisam de contentor próprio.** Eram filhos diretos do
   `#view`; reconciliar contra ele deitava fora o painel de filtros, a linha
   de resultados e o botão flutuante — o motor tira todo o filho sem chave.
   (Medido: o `#view` passou de 28 filhos diretos para 4.)
3. **O total do imóvel sai da assinatura** para um span preenchido depois
   (vistas.js:pintarRendasDosGrupos). Lá dentro, mudar uma renda refazia o
   grupo inteiro e com ele todos os cartões — o contrário do que o motor
   existe para fazer. É a mesma solução do saldo do mês nos movimentos.
4. **A assinatura de um grupo não pode ser o html dele**, porque esse html
   traz os filhos dentro: qualquer filtro reescrevia todos os grupos. O item
   passa a poder trazer uma `sig` própria (lista.js) — no grupo, o imóvel e o
   nome. O interior já se compara a si próprio; o exterior compara o que é
   dele.

E o ajudante pinta **de fora para dentro**: as listas registam-se de dentro
para fora, porque o html do interior tem de estar pronto antes de o exterior
o receber, e nessa ordem o contentor interior ainda não existe no DOM quando
lhe chega a vez.

Medido com 12 imóveis e 120 contratos, a filtrar: 70 mantidas, 62 removidas,
**0 criadas e 0 refeitas** — e 33,6 ms contra 59,8 ms do render.

Há seis fichas, uma por registo: o imóvel (imovel.js:propFicha), o contrato
(contrato.js:ctFicha), o movimento (movimento.js:txFicha), a pessoa
(pessoas.js:personFicha), a visita (visitas.js:visFicha), a hipoteca
(creditos.js:mortFicha) e o planeado com o seu modelo
(planeados.js:recFicha, planeados.js:tplFicha). Cada uma abre pela pergunta
que traz alguém lá: um contrato pergunta-se se ainda está em vigor e quando
acaba; um movimento, o que foi e quanto disto é meu; uma visita, quem vem e
quando; uma hipoteca, quanto falta e a que taxa.

O botão do rodapé é sempre «Editar» — menos em duas fichas, e as duas
dizem porquê. No planeado por confirmar é «Confirmar», porque é o que se
quer a seguir a ler; no modelo é «Usar modelo», que é a pergunta que traz
lá alguém.

E o TOQUE LONGO ficou só com o que se pode FAZER. Antes da ficha, o «Ver
movimento» do toque longo era a única maneira de ver um movimento sem o
editar — abria o formulário com os campos desligados. Agora tocar no cartão lê, e essa entrada
passou a ser um caminho a mais para o mesmo sítio. Quando não há nada a
fazer, o menu fica vazio, e é o menu vazio que faz aparecer o aviso «Só
podes ver este registo» (componentes.js:lpShow) — uma decisão que já lá
estava e que um «Ver» lá dentro tinha desfeito.

## Um contrato tem três estados
A app sabia dois — ativo e não ativo — e um contrato assinado que ainda não
começou caía no segundo. Bastava acrescentar o início ao `isActive` para as
contas ficarem certas, e isso teria feito a app **mentir por escrito**: o
cartão ganhava o selo «terminado» ao lado de «De 2028-01-01 a 2031-01-01», a
ficha dizia «Estado: Terminado» três linhas acima do campo «Início», a ficha
do inquilino arrumava-o em «Contratos anteriores» a dizer «terminou a
2031-01-01», e o menu deixava de oferecer «Terminar contrato» e passava a
oferecer «Reativar» — que apaga o `c.end`. Um clique destruía a data de fim,
e como o contrato continuava não-ativo, o menu voltava a oferecê-lo, para
sempre.

São três (auxiliares.js:ctEstado): **terminado**, **futuro**, **ativo**. E há
duas perguntas diferentes a fazer-lhes, que é o que estava a ser confundido:

- `isActive(c)` — **está em vigor hoje?** É a pergunta das contas: a renda
  deste mês, o imóvel arrendado, o yield, a avaliação.
- `ctVivo(c)` — **ainda não acabou?** É a pergunta do que há para **planear**
  e para **avisar**: a renda recorrente de um contrato que começa daqui a um
  ano tem de continuar marcada (planeados.js:syncContractRec), o prazo da
  oposição à renovação pode cair antes do início num contrato curto
  (prazos.js), o quarto já prometido continua prometido (contrato.js:ctBody),
  a caução recebe-se antes de começar (movimento.js:txBody), e uma projeção
  de dez anos não pode apagar à entrada o contrato que só começa no terceiro
  (vistas.js:projRows, avaliacao.js:evoRatio) — aí quem corta por datas é o
  `mesesEmVigor`, ano a ano.

E o terceiro estado **vê-se**, senão o contrato desaparece dos ecrãs onde a
pessoa o foi procurar: selo «por começar» na lista, «Por começar · a
2028-03-15» na ficha, um filtro próprio, «Vai morar em» na ficha do
inquilino, e a data de início ao lado da renda no cartão dele.

A renda planeada acompanha o início: mudá-lo para a frente leva-a com ele
(planeados.js:syncContractRec). Só para a frente — puxar a data de volta era
arriscar ressuscitar meses já confirmados, porque o `next` é o cursor do que
falta confirmar. O preço é corrigir um início de 2028 para 2025 deixar o
planeado em 2028, e ter de se acertar à mão.

## Segurar não é selecionar
A lista dos movimentos mexe-se por baixo do dedo: o toque longo entra em modo
de seleção, nasce uma barra acima de tudo e o título do mês cresce e cola-se
ao topo. O dedo, que não se mexeu, acaba sobre o cabeçalho do mês — e o
browser faz o que faz a um dedo parado sobre texto.

A regra casa pelo **comportamento**, não pelo elemento
(index.html:[role="button"]): o `tornarFocavel` carimba `role="button"` em
tudo o que tem onclick e não é controlo nativo, e repõe-no a cada repintura,
por isso apanha também o chrome que ainda não existe. O que se copia — o
IBAN, as notas, os valores das fichas — não tem onclick nenhum e continua
selecionável. É a mesma correção que o gráfico levou.

## A fita da barra de baixo
Mudar de separador trocava o conteúdo de golpe. Passa a virar como uma fita —
mas **só na barra de baixo**, e só quando o toque veio de lá
(navegacao.js:goBarra).

A barra tem quatro destinos e uma ordem à vista: ir dos Movimentos para os
Imóveis é andar um lugar para a direita, e a pessoa viu o lugar antes de lá
tocar. A gaveta são treze destinos agrupados por assunto — da «Visão geral»
para as «Definições» não há lado nenhum, e uma fita a correr ali inventava
uma vizinhança que não existe. Também não desliza para o separador onde já se
está: tocar no separador aceso é «leva-me ao topo», não uma travessia.

O lado é uma **variável**, e não um segundo argumento do `go`: dois dos
embrulhos da nuvem chamam-no com um argumento só, e um `go(id,lado)` chegava
cá sem o lado — o deslize nunca acontecia, sem erro nenhum, que é o pior
sítio onde isto podia falhar.

E não é o `deslizarEntre` que faz o trabalho (continuidade.js:deslizarPainel).
Aquele espera que a repintura deite fora o nó, e o painel não é deitado fora —
o render só lhe troca o `innerHTML`. E clona quem entra, que num painel de
quinhentas linhas é a árvore inteira que o motor com chave existe para não
pagar. Aqui quem sai são os nós **verdadeiros**, movidos para uma caixa fixa
recortada à faixa que se vê — um painel pode ter seis mil pixéis de altura e
vê-se um ecrã deles —, e quem entra é o próprio `#view`, sem clone.

O preço de não clonar é o `#view` correr em fluxo: o que lhe passa da margem
dava régua horizontal durante a viagem. Corta-se com `overflow-x:clip` no
pai, reposto no fim. Clip, e não hidden: o hidden fá-lo contentor de
rolamento e o cabeçalho pegajoso deixa de colar.

## A renda planeada e as rendas já lançadas
Uma recorrência é um **cursor**, e não um histórico: guarda uma data só, a
próxima ocorrência (planeados.js:syncContractRec). Quem guarda o que já
aconteceu são os **movimentos**, registos próprios em `db.transactions` —
confirmar faz duas coisas independentes: cria o movimento e empurra o cursor.

Daí a regra, e é uma só: **o cursor acompanha o contrato nos dois sentidos,
mas nunca passa por cima de um mês que já tem movimento deste contrato**
(planeados.js:cursorDaRenda). Adiar o início leva a renda planeada com ele;
corrigir um início de 2028 para 2025 traz o cursor de volta — mas ele pára no
primeiro mês por confirmar, e não em janeiro. É a mesma regra que faz o
confirmar não duplicar: o cursor nunca aterra num mês já lançado, e quando
lá chega por outro caminho (uma renda lançada à mão), salta e di-lo.

Chegou a empurrar só para a frente, com medo de ressuscitar confirmações. Era
um medo mal posto: uma confirmação não é um estado do planeado, é um
movimento com registo próprio — o cursor não lhe toca. O único mal era voltar
a pedir um mês já lançado, e é isso que a regra impede.

**O que é previsão acompanha o contrato; o que é facto fica onde está.** A
data de um movimento diz que o dinheiro entrou naquele dia, e mudá-la era
dizer que entrou noutro: mudava a receita do ano, a estimativa de IRS, o
cashflow e as contas entre proprietários, e deixava de bater com o extrato.
Por isso os movimentos não se movem com o contrato — a app **aponta**. Ao
guardar um contrato, os que caem fora das datas dele, de um lado e do outro,
são contados e mostram-se um a um, para se abrir cada um e decidir
(contrato.js:movimentosForaDoContrato, contrato.js:verMovimentosFora).

## As datas leem-se como se escrevem em Portugal
O ecrã dizia `2028-03-15`. Passa a dizer **15/03/2028** (auxiliares.js:dPT), e
os meses soltos dizem «ago 2026» (planeados.js:mesPt) — a mesma forma nas
listas e nas fichas, porque um formato longo lê-se bem numa ficha e mal numa
tabela, e dois formatos ao mesmo tempo eram pior do que um estrangeiro.

O ISO fica onde é **dado**, e nunca se lhe toca: na base, nos
`<input type="date">` (o HTML exige-o e o browser já o mostra na forma local),
nas comparações e ordenações (a comparação de texto só funciona em ISO), nas
chaves, no CSV e no que sai para o servidor. Há sítios onde a mesma variável
faz as duas coisas — o cabeçalho de mês dos movimentos é ao mesmo tempo o
texto que se lê e a **chave** da lista viva (vistas.js:txMesHtml), e o
intervalo do filtro é texto no resumo e `value=` nos campos — e aí muda-se só
o que se lê.

A pesquisa dos movimentos leva a data nas **duas** formas (vistas.js:txHay):
sem a que se lê, quem visse `15/03/2028` na linha e a escrevesse não
encontrava nada; sem a ISO, perdia-se quem escreve o ano primeiro.

E há uma regra do percurso que não deixa isto ficar a meio: **nenhum texto
visível pode ter uma data ISO** (testes/ui/invariantes.js). Sem ela, uma data
em ISO volta ao ecrã na próxima função que alguém escrever, e ninguém dá por
isso — um `2028-03-15` no meio de uma lista não parece um defeito, parece uma
data.

Uma coisa fica de fora, de propósito: o **PDF do contrato** tem regras
próprias e já escreve por extenso («5 de março de 2026»,
contrato-pdf.js:dataLonga).

A data que a conversão de uma visita escreve **dentro das notas** de um
inquilino (visitas.js:visConverte) também mudou, e essa é prosa **gravada**,
que sobe para o servidor. O que já está escrito nas fichas antigas fica como
estava; só o que se escreve de agora em diante leva a forma nova. É o preço
de escrever a data dentro de uma frase em vez de a guardar num campo.

## Um modal está acima de toda a navegação

Os modais apareciam **por trás do menu lateral**. Em ecrã largo, onde o menu é
permanente, o título ficava cortado e metade do conteúdo escondido.

A escada estava invertida: `.modal` em 60, o véu da gaveta (`.scrim`) em 61 e o
`aside` em 62. E como o véu do modal é `inset:0`, ele também ficava por baixo
do menu — que assim **não escurecia e continuava clicável**. Dava para navegar
para outro ecrã com um formulário aberto.

O modal sobe para 70. Um modal é um MODO: enquanto está aberto, o resto da app
está suspenso e tem de o parecer. Acima dele ficam só o aviso (90) e o balão
(95), que não escondem nada com que se possa interagir.

**Centrado no ecrã, e não na área que sobra do menu.** A alternativa foi
considerada e não vale: a largura do menu muda (`--rail` e `--rail-min`),
portanto um modal centrado no que sobra saltaria de sítio quando o menu
encolhesse; no telemóvel não há menu nenhum, o que daria duas regras onde basta
uma; e deixar a navegação à vista e por iluminar, ao lado de um modal aberto,
convida a cliques que ou não fazem nada ou levam a pessoa para fora do que
estava a fazer.

Era invisível no telemóvel, onde a gaveta está fora do ecrã — por isso durou.
Fica um teste sobre a escada inteira.

## O hambúrguer só existe onde há gaveta

A mesma família do modal, e encontrado pela mesma via: uma regra que faz duas
coisas e vaza para onde não devia.

O `.burger` é `display:none` por omissão e só aparece abaixo de 900px, que é
onde o `aside` deixa de ser uma coluna e passa a ser gaveta. Mas a regra do
**alvo de toque** — `@media(pointer:coarse)` — dava-lhe
`display:inline-flex` ao pôr-lhe os 44px mínimos. Ela existe para MEDIR, e
estava também a MOSTRAR.

Num telemóvel em «modo PC» isso encontra-se: o viewport é largo (sem gaveta) e
o ecrã é de dedo (botão à vista). Tocar nele chamava o `openDrawer`, que punha
`body.open` — que acima de 900px não mexe em nada, porque o
`body.open aside{transform:none}` só existe dentro da media query estreita — e
chamava o `lockPage`, que **trancava o scroll**. Um botão que não fazia nada e
deixava a página presa.

A regra do toque passa a só medir; quem mostra o botão, e o centra, é a largura.
E o `openDrawer` ganha uma rede: pergunta ao próprio `aside` se ele está
`fixed`, e sai antes do `lockPage` se não estiver. Pergunta-se ao elemento e não
à largura para não haver dois sítios a saber onde é o corte.

Medido: a 1100px, forçar o `openDrawer` não põe `body.open` nem tranca nada; a
375px o botão aparece, a gaveta abre encostada à esquerda, tranca ao abrir e
destranca ao fechar.

## Um carregamento não pode misturar versões

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

### E a mesma consequência apanhou o dev — só produção guarda

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

### «Quem manda na altura de trocar é a app» — só que a app não tinha como

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

### E a cache guardava coisas que não são a app

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

### A cura não pode curar offline

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

### Publicar sem subir a versão é publicar para meio de um carregamento

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

### E o ecrã que tranca a app não trancava nada

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

## Ver a montra antes de a publicar

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

## Não há planos

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

## A fita arranca do sítio

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

## A caixa de quem sai é a mesma caixa

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

## O que aparece tarde, e o que não devia aparecer já
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
(auxiliares.js:sabemosOEstado). O aviso do arranque, além de esperar, só conta
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
localStorage muito antes de a nuvem a ler (auxiliares.js:haSessao). A chave
passou a viver em dados.js, com o resto do armazenamento, e o cloud/nucleo.js
usa a mesma — duas verdades sobre onde está a sessão seria pior do que o
problema.

Pelo caminho, mais dois do mesmo: o crachá dos «Planeados» no menu e na barra
de baixo contava a mesma lista velha (navegacao.js:buildNav), e o tecto de seis
segundos estava armado dentro do `startSync`, que só corre depois de o
`GET /api/me` responder — com esse pedido pendurado, o tecto nunca chegava a
existir. Passa a armar-se onde a sessão se lê, que é onde se sabe que há por
que esperar.

## «Não tens nada» e «ainda não sabemos» são coisas diferentes

A base local vive numa chave só — `gi_v13` (dados.js) —, e não uma por conta.
Terminar sessão não a limpa, e por isso o `finishLogin` tem de a apagar quando
quem entra é outra pessoa (entrada.js): a alternativa era mostrar os imóveis de
um a outro. Está certo.

O que estava errado era o que vinha a seguir. A app pintava essa base vazia e
afirmava **«Ainda não há nada registado»** a quem tem doze imóveis, com um
botão de **«Carregar exemplo»** ao lado — e o `seed()` não acrescenta:
substitui a base inteira e acaba em `save()`, que a nuvem embrulha para agendar
um envio (anexos.js). A frase era falsa e o botão era uma armadilha.

E não é «uma vez por aparelho», como cheguei a dizer: é em **todos os logins**
de quem partilha o aparelho com outra conta, mais a navegação privada, o
armazenamento limpo pelo browser, a app reinstalada, e todos os arranques num
aparelho onde o armazenamento está cheio ou vedado.

Nove ecrãs afirmavam o vazio: a visão geral, os imóveis, os contratos, os
inquilinos, os proprietários, os movimentos, as visitas, os créditos e a
avaliação. Passam todos pelo `esperaDoServidor()` (auxiliares.js), que só fala
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

## E o que a app FAZ antes de saber

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

## Os dados de exemplo, só onde fazem sentido

Em produção não se carregam dados de exemplo: quem chega à app a sério deve
encontrá-la vazia e ser levado pelos primeiros passos. O ambiente vem do
servidor (`/api/auth/config` devolve `env.ENV_NAME` ou `'producao'`), e até a
resposta chegar vale `'producao'` — o lado seguro.

O que mudou foi **onde** se decide. O botão chegou a ser apagado do DOM depois
de cada `render`, e isso tinha um furo: a pesquisa das listas repinta pela via
parcial (vistas.js:refrescarListasVivas), que não passa pelo `render`, e por lá
o botão voltava — bastava escrever uma letra na pesquisa dos imóveis. Agora
pergunta-se **antes de escrever** (auxiliares.js:podeExemplo). Perguntar antes
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
o cartão cresce com ele (index.html:.kserie). A altura continua **dada**, e
não a do conteúdo: a caixa nasce vazia e é enchida depois, e sem uma altura
fixa tudo o que está por baixo saltava quando a variação aparecesse.

Medido depois, em 375px: a caixa com 38px, a silhueta e a percentagem em cima,
o ano e o valor em baixo, nada cortado. E em cinco separadores, entre os 30ms
e os 1230ms depois de pintar, mais nada muda — o único movimento tardio que
resta é a contagem dos números, que é deliberada.

## Navegação
Treze separadores em TABS (navegacao.js:TABS), cada um com ícone, rótulo e
subtítulo. A gaveta agrupa-os em quatro (navegacao.js:NAV_GROUPS):
Património, Pessoas, Finanças e Aplicação; o título do grupo é o .navh
(index.html:.navh). No computador a gaveta é um rail fixo que pode
colapsar para só ícones (index.html:body.rail); abaixo de 900px vira gaveta
com véu (index.html:aside e index.html:.scrim dentro de
index.html:@media(max-width:900px)) e o foco entra nela ao abrir
(navegacao.js:openDrawer).

A barra de baixo tem quatro destinos, a um toque: visão geral («Geral»),
movimentos, imóveis e calendário (navegacao.js:TABBAR,
navegacao.js:buildTabbar). A auditoria mediu: com tudo atrás da gaveta,
qualquer mudança de ecrã custava dois toques. O calendário tomou o lugar
dos planeados, mostra-os dia a dia e leva o crachá dos pendentes. A barra
só existe abaixo de 900px e esconde-se com a gaveta aberta
(index.html:.tabbar dentro de index.html:@media(max-width:900px)); o traço
do ativo da gaveta não se aplica nela (index.html:.tabbar, o a.on::before).

Recarregar devolve-te ao sítio onde estavas: o separador e a subpágina das
Definições ficam em localStorage (gi_page: web/cloud/anexos.js:LS_PAGE,
web/cloud/anexos.js:restorePage). Entrar e sair levam sempre à visão geral
(entrada.js:finishLogin; ajuda.js:logout). Mudar de separador faz scroll
ao topo (navegacao.js:go). O «voltar» do sistema fecha primeiro o que
estiver aberto (menu, gaveta, janela) e numa subpágina das Definições sobe
a Definições (componentes.js:pushHist e o ouvinte de popstate logo a
seguir). O item ativo leva aria-current (navegacao.js:buildNav,
navegacao.js:buildTabbar); o burger leva aria-expanded
(navegacao.js:openDrawer, navegacao.js:closeDrawer).

## Escrita
Português de Portugal, e trata-se por tu: «Tens alterações por guardar»
(componentes.js:closeModal), «Começa por adicionar um imóvel»
(vistas.js:vDashboard), «Dá um nome ao imóvel» (imovel.js:propModal),
«tenta daqui a pouco» (entrada.js:esqueci).

Frases curtas, com ponto final nos toasts: «Movimento apagado.»
(movimento.js:delTx), «Anulado.» (componentes.js:comDesfazer).

Rótulos em sentence case: «Visão geral» (navegacao.js:TABS), «Adicionar
imóvel» (vistas.js:vDashboard), «Registar pagamentos»
(vistas.js:settleModal), «Pagar todas as dívidas»
(vistas.js:balancesCard). As maiúsculas de secção vêm do CSS, não do
texto.

Sem emojis na interface. Os ícones são traço em SVG, ic(nome,tamanho)
(auxiliares.js:ic): stroke 1.7, currentColor, 20px por omissão. Um ícone
novo entra no mapa do ic(), não como carácter.

O hint explica o porquê, não repete o rótulo: «Confirmar regista o
movimento e agenda o seguinte. Silenciar deixa-o à espera, sem avisos.»
(planeados.js:pendingCard); «Entram aqui mas não na Avaliação — não estão
atribuídas a nenhum imóvel. É por isto que os totais divergem.»
(vistas.js:orphanCard); os WHY dos KPIs (vistas.js:WHY).

A mensagem de erro diz o que fazer: «Indica a renda mensal.» e «O fim do
contrato é antes do início — verifica as datas.» (contrato.js:ctSaver),
«Escreve uma descrição.» (movimento.js:txModal).

O botão diz o verbo: «Apagar», «Terminar», «Registar pagamentos»; o rodapé
neutro é Cancelar e Guardar, Fechar ou Voltar (componentes.js:fillModal,
componentes.js:pickModal; vistas.js:kpiModal).

A primeira letra põe-se à mão: toLocaleDateString('pt-PT') devolve
«setembro de 2026» e text-transform:capitalize dava «Setembro De 2026»
(calendario.js:vCalendar, calendario.js:calDiaPanel).

Separadores: «·» entre pedaços de uma linha (vistas.js:vProperties,
vistas.js:vTransactions), «—» para o vazio (auxiliares.js:pct;
componentes.js:sel) e dentro das frases, «−» tipográfico nos negativos
(auxiliares.js:money).

Os comentários do código seguem o mesmo tom: em português, contam a razão
e o que custou («medido: 70% de um dropdown fora de vista»,
componentes.js:ajustarPop), e cada função leva Recebe e Devolve, senão o
gerador de documentação rebenta (scripts/gerar-docs.js, o gate «sem guia
de interface»). Cada módulo abre com um banner /* ===== NOME ===== */ e um
parágrafo do que é (web/app/prazos.js; web/app/calendario.js).

## Números e datas
Dinheiro passa por money (auxiliares.js:money): milhares com espaço fino
(U+202F), vírgula decimal, espaço fino antes do €, sinal de menos
tipográfico. euro arredonda ao euro inteiro; euro2 mostra sempre duas
casas (auxiliares.js:euro, auxiliares.js:euro2); euroS mostra os cêntimos
só quando existem, porque uma renda de 512,74 € aparecia «513 €» num
cartão e «512,74 €» ao lado (auxiliares.js:euroS).

pct(v,d) dá «25,3%» e «—» quando não é número (auxiliares.js:pct); dec
troca o ponto pela vírgula (auxiliares.js:dec). O que se escreve à mão
lê-se com num (auxiliares.js:num), que decide se a vírgula é decimal e
devolve 0, nunca NaN, para as somas não se estragarem. IBAN, NIF, CC e
telefone têm os seus formatadores (auxiliares.js:fmtIBAN,
auxiliares.js:fmtNIF, auxiliares.js:fmtCC, auxiliares.js:fmtPhone).
Ordenar texto é localeCompare com 'pt' (vistas.js:lfSort).

As datas guardam-se e comparam-se como texto AAAA-MM-DD
(auxiliares.js:today; auxiliares.js:isActive; vistas.js:txMatch). Uma data
local nunca passa pelo toISOString: converte para UTC e, no horário de
verão, meia-noite local vira o dia anterior; um prazo legal deslocado um
dia é um prazo errado (prazos.js:pzIso, prazos.js:pzAddDias; o today() de
auxiliares.js é local pela mesma razão, com teste em
testes/metricas.test.js). Somar meses prende o dia ao último do mês quando
ele não existe (planeados.js:nextDate). O dia de cobrança das prestações
automáticas das hipotecas fica limitado a 28, para cair em todos os meses
(planeados.js:syncLoanRec). Os meses abreviam-se em minúsculas
(auxiliares.js:MES); o nome longo vem do toLocaleDateString('pt-PT') com a
primeira letra posta à mão.

## Toque e acessibilidade
Em ecrã de dedo, nada abaixo do mínimo de toque, e só aí: no rato os
tamanhos compactos continuam certos (index.html:@media(pointer:coarse)).
44px os botões, os itens da gaveta e os cabeçalhos das dobras; 40 o
.btn.sm. O toque longo abre as opções do cartão aos 480 ms, com vibração,
e engole o clique que vem a seguir (componentes.js:_lpT e os ouvintes de
pointer que o usam).

Cartões e afins são divs com onclick: tornarFocavel dá-lhes tabindex e
role=button depois de cada render e de cada janela
(vistas.js:tornarFocavel; componentes.js:fillModal), e Enter ou Espaço
ativam-nos (o ouvinte de keydown do arranque, em web/app/arranque.js).
Escape fecha a janela de cima (outro ouvinte de keydown, no mesmo
arranque); o Tab fica dentro dela (o terceiro); a janela de baixo fica
inert e aria-hidden (componentes.js:demote); ao fechar, o foco volta ao
gatilho (componentes.js:closeModal). A janela tem role=dialog e aria-modal
(componentes.js:modalLayer). Todo o botão só de ícone leva aria-label
(componentes.js:menu, componentes.js:tagField, componentes.js:fileBlock,
componentes.js:modalLayer; index.html:.burger, index.html:#toTop). O toast
tem role=status e aria-live=polite (index.html:#toast).

O foco desenha-se: outline em --accent-soft com o contorno em --accent
(index.html:input:focus). O campo com erro aponta para si próprio
(index.html:.err) em vez de só um toast longe dele.

-webkit-text-size-adjust:100% no body (index.html:body) para o iOS não
inflar o texto em landscape; tap-highlight transparente
(index.html:-webkit-tap-highlight-color); user-select:none nos controlos e
nos cartões com toque longo (index.html:[data-lp] e a regra a seguir).
Quem pediu menos movimento ao sistema recebe menos movimento
(index.html:@media(prefers-reduced-motion:reduce)).

Alturas em unidades de ecrã escrevem-se em vh e logo a seguir em dvh
(index.html:.modal, index.html:.sheet; testes/estilos.test.js): com as
barras do browser à mostra, vh é maior do que o que se vê e o topo da
folha saía por cima. A área segura entra por --inset-* (index.html::root,
index.html:.brand, index.html:header.top, index.html:.wrap,
index.html:.fab, index.html:.tabbar; auxiliares.js:fitInsets). Os corpos
que rolam levam overscroll-behavior:contain (index.html:.fpanel>.card;
index.html:.sheet, o .body) e a página tranca por baixo de uma janela ou
da gaveta, repondo a posição ao destrancar (vistas.js:lockPage).

## O que não se faz
Não se dá a uma forma de gráfico o estado premido de um botão. O
tornarFocavel marca-as com role=button para o teclado lá chegar, mas num
SVG um transform não é uma reação — é o desenho a mudar de sítio, e a
origem não é o centro da forma (index.html:svg [role="button"]:active).

Não se decora uma vista pegando no HTML que ela acabou de gerar, metendo-o
num nó avulso e mexendo-lhe: pede-se um ponto de extensão à vista, e ela
chama-o enquanto se escreve (vistas.js:txLinhaExtra e vistas.js:txMesExtra
são os primeiros; quem os substitui é cloud/selecao.js). Medido com 500
movimentos, o ida-e-volta custava 36 dos 40 ms de cada pintura dos
Movimentos — e, pior do que o tempo: enquanto for assim, nenhuma repintura
parcial é segura, porque uma linha repintada sozinha nasce sem as
decorações e ninguém dá por isso.

Não se escreve uma duração ou uma curva à mão: cita-se o token
(index.html:--medio, index.html:--curva).

Não se pinta o premido com a cor do :hover: com rato, o ponteiro fica em
cima depois do clique e o toque seguinte deixa de mudar coisa nenhuma
(index.html:--press; testes/estilos.test.js varre a folha à procura de
pares iguais).

Não se anima a altura de uma dobra: foi tentado com grid-template-rows
0fr→1fr e a dobra ficou presa aberta (index.html:.fold.entra.open>.fold-body,
a nota por cima).

Não se põe uma animação de entrada sem um portão que diga que alguém a
pediu. Um nó novo não é um gesto: a sincronização de fundo recria tudo de
três em três minutos (vistas.js:render e a marca .entra;
navegacao.js:cntNovo; componentes.js:toggleFold).

Não se escalona com :nth-child o que tem irmãos que não são da série (as
barras de um SVG têm o eixo pela frente: graficos.js:atrasoEntrada).

Não se usa <select>, confirm(), alert() nem prompt() do browser: destoam e
não vestem o tema (o banner de web/app/componentes.js;
componentes.js:closeModal).

Não se passa uma data local pelo toISOString (prazos.js:pzIso).

Não se escreve uma altura em vh sem o par em dvh (index.html:.sheet;
testes/estilos.test.js).

Não se declara color-scheme só «light» (index.html:<meta name="color-scheme">).

Não se escreve um hex fora do :root e da PAL sem um comentário a dizer
porquê (index.html:.badge.amber é o exemplo com licença).

Não se pergunta «tens a certeza?» ao que é frequente e reversível: dá-se
Anular (movimento.js:delTx). E não se apaga sem rede o que não volta
(componentes.js:delFileConfirm).

Não se põe um «Confirmar» primário igual ao Guardar num botão que destrói
(componentes.js:confirmModal).

Não se pergunta «sair sem guardar?» por causa de valores que a app
preencheu sozinha (componentes.js:openModal, o isTrusted), nem a Guardar
e Cancelar (componentes.js:closeModal).

Não se deixa um menu crescer até ao espaço disponível
(componentes.js:posicaoPop) nem ficar cortado pelo corpo da janela
(componentes.js:ajustarPop).

Não se usa text-transform:capitalize em datas (calendario.js:vCalendar).

Não há painel de filtros com rascunho e botão «Aplicar» (vistas.js:lfSel).

Não se abre por omissão uma lista longa na visão geral
(planeados.js:pendShut).

Não se mete uma caixa contenteditable dentro de um <label>
(auxiliares.js:richEditor, a nota por cima), nem se regista um ouvinte
numa MediaQueryList criada de fresco (auxiliares.js:mq).

Não se sobrepõe em linha o aspeto de uma classe semântica: faz-se uma
classe nova (o .section-title com text-transform:none em
vistas.js:vContracts é o exemplo a corrigir).

Não se desenham ícones como caracteres de texto (✕, ✓) nem se colam
emojis: entra-se no ic() (auxiliares.js:ic).

Não se escreve uma função sem comentário com Recebe e Devolve: o gerador
de docs rebenta (scripts/gerar-docs.js).

Não se mostra uma ação que o cargo não permite: pergunta-se pode() antes
(acessos.js:pode; componentes.js:lpMenu), e um colaborador nunca entra em
ownerIds, quotas ou contas entre proprietários (acessos.js:souDono).

## As ferramentas, e o que ficou de fora

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

## Dívidas de design conhecidas
O que já está fora destas regras, por ordem de gravidade. Não está
corrigido: cada uma tem o sítio, para quem lhe pegar.

Média. Há três sítios onde a camada da nuvem ainda mexe no HTML da app por
expressão regular ou por procura de texto: o bloco dos planeados no cartão
por confirmar (cloud/painel.js), a secção dos proprietários na ficha de um
imóvel (cloud/utilizadores.js) e a linha das novidades nas definições
(cloud/novidades.js). Cada um deles depende da forma exata do HTML gerado —
uma aspa trocada, um atributo por outra ordem, e a funcionalidade
desaparece sem erro nenhum. O caminho é o mesmo que os Movimentos já
seguiram: um ponto de extensão pedido à vista, em vez de cirurgia por cima
dela.

Média. O tornarFocavel (vistas.js:tornarFocavel) dá tabindex e role=button
a tudo o que tem onclick, e cada barra e cada arco tem um (é por lá que a
dica abre ao toque: graficos.js:hit). Resultado: cada forma de cada
gráfico é uma paragem do Tab anunciada como botão — medido na visão
geral, catorze das trinta e nove, e num gráfico de um ano inteiro são as
barras todas. Não levam a lado nenhum: o que a dica mostra já está escrito
na legenda ao lado, e o <title> dentro da forma já o diz a um leitor de
ecrã. Quem lhe pegar deve deixar as formas fora da ordem de tabulação (o
tornarFocavel a saltar o que está dentro de um <svg>; o toque e o rato
continuam a abrir a dica) e dar ao gráfico uma descrição só.

Média. addDays (planeados.js:addDays) constrói a data em hora local e
devolve-a com toISOString: meia-noite local no verão vira o dia anterior,
e a janela next..until ao avançar um planeado (planeados.js:recAdvance) e
o lembrete «Em atraso» do Android (dados.js:scheduleReminders) recuam um
dia. pzAddDias
(prazos.js:pzAddDias) e o today() (auxiliares.js:today) já fazem o mesmo
bem.

Média. As cores «Despesas» e «Prestações» dos gráficos estão escritas à mão
('#c56b68' e '#d6a34a', que são PAL_LIGHT[3] e PAL_LIGHT[2]) em vez de
PAL[3] e PAL[2]: vistas.js:vDashboard (as duas), vistas.js:vProjections
(o amarelo, duas vezes), avaliacao.js:portCard (as duas),
avaliacao.js:repCard (as duas, e o amarelo outra vez na dívida) e
movimento.js:amortModal (o amarelo, duas vezes) — onze ocorrências, três
do vermelho e oito do amarelo. No tema escuro a «Receita» sai a
PAL_DARK[0] e as «Despesas» ficam num vermelho pensado para fundo branco;
mudar a PAL nunca altera estes gráficos.

Média. CW.esqueci (entrada.js:esqueci) usa o prompt() nativo do browser
para pedir o email, contra a regra do promptModal
(definicoes.js:promptModal). É o único prompt, confirm ou alert nativo em
web/. No WebView do Android pode devolver null sem aparecer, e a ação
morre em silêncio.

Baixa. No tema escuro, .pos, .neg e .amber, os valores dos KPIs e o
nav a.on recebem hex literais (as regras index.html::root.dark logo a
seguir ao bloco das variáveis) iguais a --accent, --danger e --warn desse
:root.dark. A regra de base (index.html:.pos) já segue o token; se alguém
mudar --accent no escuro, estes ficam para trás.

Baixa. Três desenhos para «contador pendente»: nav a .cnt, .tabbar a .cnt
e #hdrBell .cnt (index.html:nav, index.html:.tabbar, index.html:#hdrBell),
os dois últimos com corpos quase idênticos (só muda o lado) escritos duas
vezes.

Baixa. Ícones como caracteres de texto: '✕' nos botões de limpar a
pesquisa (vistas.js:txFilterBody, vistas.js:lfBar) e '✓ ' em
contrato.js:ctBody, entrada.js:showAuth e ajuda.js:passwordModal, quando a
casa desenha tudo com ic('x') e ic('check'). O X da janela
(componentes.js:modalLayer), o burger e o «topo» (index.html:.burger,
index.html:#toTop) trazem SVG escrito à mão em vez de ic().

Baixa. Emojis na interface: um hint com 👍 em partilha.js:vSettings e o
tubo de ensaio no seletor de contas de teste (entrada.js:cwTrocaConta, só
em dev).

Baixa. O cabeçalho de cada imóvel em Contratos e o de cada mês em
Movimentos usam .section-title com text-transform:none em linha
(vistas.js:vContracts, vistas.js:vTransactions): uma classe semântica com
dois aspetos. Merece uma classe própria em web/index.html.

Baixa. Os botões de apagar do fileBlock fixam min-width e min-height de
40px em linha (componentes.js:fileBlock), repetindo em todos os ecrãs o
que index.html:@media(pointer:coarse) já dá só no toque.

Baixa. O dia de pagamento dos contratos aceita 1 a 31
(contrato.js:collectCt; planeados.js:syncContractRec) enquanto as
prestações automáticas das hipotecas ficam em 28
(planeados.js:syncLoanRec). Não é bug, porque o nextDate prende ao último
dia do mês, mas são duas regras para o mesmo conceito e nenhum hint diz
que o dia «flutua» (contrato.js:ctBody, os campos «Renda entre o dia» e «e
o dia»).
