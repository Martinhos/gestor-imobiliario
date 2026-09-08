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
translúcido do cabeçalho (index.html:header.top). --shadow (0 24px 60px
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
Inter, system-ui, -apple-system, Segoe UI, Roboto; 15px de base
(index.html:body). Os números alinham em tabular-nums nos valores, nas
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
58 o FAB (index.html:.fab), 60 a janela (index.html:.modal), 61 o véu
(index.html:.scrim), 62 a gaveta (index.html:aside), 90 o toast
(index.html:.toast), 95 a dica dos gráficos (index.html:.tip).

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

A chave não é inventada: as linhas de lista já trazem data-lp, que é por
onde o toque longo as encontra e já é o id do registo (onde não houver,
vale um data-fk). Sem chave, uma peça é só «mais uma».

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
exato do sítio (continuidade.js:correrAFita). O que entra é um clone e o
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
(componentes.js:modalSoLeitura), e as contas entre proprietários são dos
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
