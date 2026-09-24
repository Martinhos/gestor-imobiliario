# Regras de design

Como a app se veste e como se comporta. Não é um manual de gosto: cada
regra aqui esteve primeiro no código, com a razão ao lado, e diz onde
está. Quando fizeres um ecrã novo, lê isto antes de inventar um botão.

Aqui ficam as regras vivas, escritas no presente. A história delas — os
post-mortems, as medições, as decisões de produto e as correções de
correções — vive no diário, por data (docs/decisoes.md). Quando uma regra
muda, muda aqui, e o que custou a mudá-la vai para o diário com a data; uma
dívida que fecha sai da lista no mesmo commit.

As citações são ficheiro:símbolo, nunca ficheiro:linha, porque as linhas
apodrecem a cada commit: no JavaScript o nome da função ou da constante
(componentes.js:sel, tema.js:PAL_LIGHT); no CSS da app, que vive em
web/estilos.css, o seletor, a variável, a animação ou a @media, sem espaços
(estilos.css:.btn.primary, estilos.css:--rapido); em web/index.html o id ou a
tag (index.html:#toast, index.html:<script src="app/prazos.js">). Um teste em
testes/docs.test.js confirma que cada citação aponta para código que
existe, aqui, no diário e nas armadilhas. anexos.js há em web/app e em
web/cloud, por isso leva sempre o caminho completo; o código do worker cita-se
com o caminho inteiro (worker/src/lib/servicos.js:SERVICOS).

Índice:

- Tokens: as cores e o papel de cada uma
- Tema escuro e a regra do color-scheme
- Tipografia
- Espaçamento, raios e sombras
- Movimento
- Componentes da casa, e quando usar cada um
- O motor das listas
- As famílias dos pontos de interação
- Padrões de página
- Um gráfico lê-se com o dedo
- Uma tabela só quando diz o que o gráfico não diz
- Uma comparação diz de que números fala
- Um número que chega a contar
- O que a app diz sobre o que guardou
- Uma porta, e nenhum beco
- Um aviso não tapa o que se pede para carregar
- Tocar num registo é lê-lo
- Um contrato tem três estados
- A Declaração resume, não declara
- Segurar não é selecionar
- A fita da barra de baixo
- A renda planeada e as rendas já lançadas
- As datas leem-se como se escrevem em Portugal
- Um modal está acima de toda a navegação
- O hambúrguer só existe onde há gaveta
- O service worker e a versão
- A app não afirma nem decide antes de saber
- A sincronização: o que é daqui e o que é do servidor
- O capital em dívida deriva-se
- Navegação
- A app em serviços
- A CSP sem «unsafe-inline»
- Os eventos declaram-se, e uma ação é uma gramática
- Os estilos vivem na folha, e nunca no HTML
- Escrita
- Números e datas
- Toque e acessibilidade
- O que não se faz
- Dívidas de design conhecidas

## Tokens: as cores e o papel de cada uma
Todas as cores vivem em variáveis: o claro no :root (estilos.css::root) e o
escuro no :root.dark (estilos.css::root.dark). Um hex fora daí só com um
comentário ao lado a dizer porquê. Claro → escuro, e o papel de cada uma:

--bg #f7f8fa → #12141b é o fundo da página. --card #fff → #1b1e28 é o
cartão. --field #fff → #20242f são os campos. --chip #f2f4f3 → #272b38 são
os selos cinzentos e o hover das opções dos menus. --tint #f6faf8 → #1f2330
é o hover dos cartões clicáveis e a barra do editor. --ink #17221d →
#eef0f6 é o texto. --muted #5a635e → #9aa3b8 é o texto secundário: rótulos,
hints, .small. --line #e7ebe8 → #2b3040 são os contornos; --line2 #cfd8d3 →
#3a4054 o contorno em hover.

--accent #244c3b → #5ee0a8 é a marca: o botão primário
(estilos.css:.btn.primary), o positivo (estilos.css:.pos), o ponto dos
filtros ativos (estilos.css:.filtbtn, o .dot), o risco à esquerda dos
cartões clicáveis (estilos.css:.card.tap, o ::before) e o item ativo da
barra de baixo (estilos.css:.tabbar, o a.on). --accent-ink #fff → #0b1410
é o texto sobre a marca. --accent-soft #dfece6 → #1c3a33 é o fundo dos
selos, dos avatares e dos ícones de secção (estilos.css:.badge,
estilos.css:.avatar, estilos.css:.fold-head, o .ic). --accent-press #1c3d2f
→ #7ceabb é o primário premido (estilos.css:.btn.primary, o :hover).

--danger #b94a48 → #ff8a80 é o negativo (estilos.css:.neg), o destrutivo
(estilos.css:.btn.danger; estilos.css:.menupop, o button.danger), o campo
com erro (estilos.css:.err) e o crachá dos pendentes (o .cnt em
estilos.css:nav, estilos.css:.tabbar e estilos.css:#hdrBell). --danger-soft
#f7e8e7 → #3a2326 é o fundo suave. --warn #9a6400 → #ffc35c é o aviso e o
pendente: estilos.css:.amber, o risco do estilos.css:.pend, o ponto dos
planeados no calendário (estilos.css:.pt.pla) e o crachá da gaveta quando
nada passou do prazo (navegacao.js:buildNav). --warn-soft #f6eeda →
#3a2f14 é o fundo.

--side #1a3a2c → #161a3a é a gaveta (estilos.css:aside), com --side-ink,
--side-muted, --side-hover e --side-on só para ela. --blur é o fundo
translúcido do cabeçalho e da barra de baixo (estilos.css:header.top,
estilos.css:.tabbar) — vidro com blur(12px) saturate(140%), a saturação
para as cores de baixo atravessarem vivas em vez de acinzentadas, e o
prefixo -webkit- porque o iOS antigo só lê esse. A risca de baixo do
cabeçalho nasce transparente e só se acende com a página rolada
(estilos.css:body.rolada, posta pelo mesmo ouvinte de scroll do toTop em
componentes.js): no topo não há conteúdo por baixo dela para separar.
--shadow (0 24px 60px
rgba(0,0,0,.28) → .6) é a sombra dos menus e das janelas. --track, --rail
264px, --rail-min 76px e os --inset-* da área segura fecham a lista.

As semânticas são três classes, .pos, .neg e .amber (estilos.css:.pos), e
valem em texto, KPIs e saldos. Os selos são .badge (marca), .badge.grey,
.badge.amber e .badge.red (estilos.css:.badge). No claro o texto dos dois
últimos desce para #7d5200 e #9c3a38: 11px pedem 4,5:1 de contraste e o
tom da marca ficava aquém (estilos.css:.badge.amber, com o comentário por
cima). É o exemplo de hex fora dos tokens com licença, porque tem a razão
escrita ao lado.

Os gráficos têm paleta própria: PAL_LIGHT e PAL_DARK
(tema.js:PAL_LIGHT, tema.js:PAL_DARK), trocadas dentro do
próprio array PAL pelo applyTheme (tema.js:applyTheme), para quem
guardou referência ver as cores novas. Usa PAL[i], nunca o hex. A cor da
barra do sistema é #1a3a2c no claro e #161a3a no escuro
(index.html:#metaTheme, escrito no mesmo applyTheme).

## Tema escuro e a regra do color-scheme
O tema é 'light', 'dark' ou 'auto' (tema.js:isDark) e aplica-se com
a classe .dark no <html> (tema.js:applyTheme). Tudo o que depende do
tema segue os tokens; o código não pergunta o tema.

O meta color-scheme e a propriedade no :root dizem ambos «light dark»
(index.html:<meta name="color-scheme">, estilos.css::root). Declarar só
«light» faz o WebKit e o WebView do Android responder
prefers-color-scheme:light mesmo com o aparelho em escuro, e o automático
fica preso no claro. Só uma escolha explícita estreita o esquema
(tema.js:applyTheme, a nota sobre o modo automático).

No claro escreve-se «only light», não «light»: é o opt-out do «tema escuro
para sites» do Chrome Android, que escurecia à força o modo claro (a nota
seguinte, no mesmo applyTheme).

A MediaQueryList do sistema cria-se uma vez e guarda-se
(tema.js:mq). Registar o ouvinte numa criada de fresco deixa-a sem
referências, e há motores que a recolhem e param de avisar. O Safari só
ganhou addEventListener na versão 14, por isso fica o addListener de
recurso (a IIFE que fecha web/app/tema.js, a seguir a
tema.js:setTheme).

## Tipografia
system-ui, -apple-system, Segoe UI, Roboto; 15px de base
(estilos.css:body). A letra é a do sistema de quem lê — SF no iPhone e no
Mac, Segoe no Windows. A Inter saiu da frente da pilha: nunca foi
carregada como webfont, só aparecia a quem a tivesse instalada, e a letra
da plataforma já traz o desenho ótico e o espaçamento afinados por
tamanho. A landing fez a mesma mudança (worker/src/landing.js), porque
quem clica em «Abrir a app» não pode sentir que mudou de produto. Os
números alinham em tabular-nums nos valores, nas
tabelas e nas estatísticas (estilos.css:.value, a regra partilhada com
.table td e .stat b), para as colunas não dançarem.

A escala, toda em web/estilos.css: h1 19px com -.02em
(estilos.css:header.top); título da janela 17px (estilos.css:.sheet, o
.head h2); valor do KPI 22px, peso 750, -.025em, e rótulo do KPI 11.5px
em maiúsculas, .05em, 600 (estilos.css:.kpi, o .value e o .label);
estilos.css:.section-title 13px, 700, maiúsculas, .03em, muted;
estilos.css:.navh 10.5px, maiúsculas, .07em; estilos.css:.stat 13.5px;
estilos.css:.toast 13.5px, 550; campos e .selbtn 14px, 500
(estilos.css:input, estilos.css:.selbtn); estilos.css:label 12px, 600, muted;
estilos.css:.small e estilos.css:.hint 12px muted, o hint com line-height
1.55; estilos.css:.badge 11px, 700; estilos.css:.btn 550 e
estilos.css:.btn.sm 13px; estilos.css:.table 13px com cabeçalhos th 11px em
maiúsculas; barra de baixo 11px, 600 (estilos.css:.tabbar, o a).

Os pesos têm papel: 500 o que se escreve, 550 os botões, 600 os rótulos,
650 os subtítulos, 700 os títulos, 750 os valores. Maiúsculas só por CSS
(rótulos de KPI, section-title, cabeçalhos de tabela), nunca escritas no
texto.

## Espaçamento, raios e sombras
A página tem 18px em cima e 22px aos lados, com 1180px de largura máxima
(estilos.css:.wrap); no telemóvel 14 e 15 (a mesma .wrap dentro de
estilos.css:@media(max-width:900px)). O cartão tem 16px de padding
(estilos.css:.card).

Grelhas: estilos.css:.grid com gap 11 e colunas de 158px para os KPIs;
estilos.css:.cols com gap 14 e colunas de 290px para os cartões de gráfico;
estilos.css:.list com gap 11; estilos.css:.form com gap 13; estilos.css:.row
e estilos.css:.row3 com gap 11, que empilham abaixo de 520px, salvo o
intervalo De/Até, que se lê lado a lado porque empilhado parecia dois
filtros (estilos.css:.row.lado-a-lado). A estilos.css:.toolbar tem gap 10.
O estilos.css:.section-title leva 22px por cima e 10 por baixo. Um estado
vazio não se cola aos KPIs que o antecedem (estilos.css:.grid+.empty).

Os raios seguem a hierarquia da peça: 20px a janela (estilos.css:.sheet; 20
20 0 0 na folha de baixo, a mesma .sheet dentro de
estilos.css:@media(max-width:520px)), 18 o FAB (estilos.css:.fab), 16 o
cartão e o vazio (estilos.css:.card, estilos.css:.empty), 14 a secção, a
dobra e o addbox (estilos.css:.sect, estilos.css:.fold-head,
estilos.css:.addbox), 13 os menus e as opções .opt (estilos.css:.selpop,
estilos.css:.menupop, estilos.css:.opt), 12 o toast, a caixa das etiquetas
e as miniaturas (estilos.css:.toast, estilos.css:.tagbox,
estilos.css:.thumb), 11 os botões, os campos, os itens da gaveta e o avatar
(estilos.css:.btn, estilos.css:input, estilos.css:nav, estilos.css:.avatar),
10 os dias do calendário e a barra de baixo (estilos.css:.calday,
estilos.css:.tabbar), 9 o .btn.sm, as opções dos menus e o iconbtn
(estilos.css:.btn.sm, estilos.css:.selopt, estilos.css:.iconbtn), 999 as
pílulas: selos, etiquetas, crachás.

Só flutua o que sobe: --shadow nos menus e na janela (estilos.css:.selpop,
estilos.css:.menupop, estilos.css:.sheet); 0 8px 22px .28 no FAB
(estilos.css:.fab); 0 16px 38px .30 no painel de filtros
(estilos.css:.fpanel>.card); 0 6px 18px .22 no menu do FAB
(estilos.css:.fabmenu); a barra pegajosa deixa uma sombra só por baixo
(estilos.css:.toolbar.stick). Os cartões não têm sombra, têm contorno
(estilos.css:.card).

As camadas (z-index): 15 o menu de escolha (estilos.css:.selpop), 20 o
cabeçalho (estilos.css:header.top), 25 a barra pegajosa
(estilos.css:.toolbar.stick), 30 o menu de ações (estilos.css:.menupop), 40
a barra de baixo (estilos.css:.tabbar), 45 e 46 o painel de filtros
(estilos.css:.fpanel, estilos.css:.fwrap), 57 o «topo» (estilos.css:.totop),
58 o FAB (estilos.css:.fab), 59 o cartão dos primeiros passos
(cloud/guia.js:#cwGuia), 61 o véu da gaveta (estilos.css:.scrim), 62 a gaveta
(estilos.css:aside), 70 a janela (estilos.css:.modal), 71 o mesmo cartão dos
primeiros passos quando há uma janela aberta (cloud/guia.js:.sobre-janela),
90 o toast (estilos.css:.toast), 95 a dica dos gráficos (estilos.css:.tip).

A janela está acima da navegação de propósito, e é a partir dela que se
escolhe um número novo: o que tiver de aparecer por cima de uma janela aberta
fica acima de 70, e o resto abaixo. Esta lista é o sítio onde se vai buscar
esse número — quando ela mente, o erro sai daqui. Foi o que aconteceu ao
cartão dos primeiros passos: o 61 dele foi escolhido contra um 60 que já não
era verdade.

## Movimento
Três durações: --rapido .12s para o que responde ao dedo, --medio .2s para
o que aparece e desaparece, --lento .34s para o que atravessa distância —
a folha da janela (estilos.css:--rapido). Um tempo escrito à mão numa regra
nova é uma decisão que ninguém tomou.

E quatro curvas, sendo que a escolha entre as duas de entrada é pela
DISTÂNCIA percorrida, e não pelo gosto. A --curva é um estalido: medida no
browser, faz 83% do caminho em 30% do tempo. Num botão que encolhe 3% é
exatamente o que se quer — a reação tem de parecer imediata. Numa folha
que sobe o ecrã inteiro em 260ms, quer dizer 83% da altura nos primeiros
78ms: a janela teleporta-se e passa o resto do tempo a assentar os últimos
4%. Foi o que nos disseram a usar a app — «nem se percebe que deslizou» —
e foi também porque os gráficos «apareciam» em vez de se desenharem. A
--curva-entra faz 64% em 30% e é a de quem percorre caminho: a folha, a
gaveta, as barras a crescer, o conteúdo de uma dobra (estilos.css:--curva-entra).
A --curva-sai faz o inverso das duas e serve o que se fecha
(estilos.css:--curva-sai). Na dúvida: se o que se move percorre mais do que
uns poucos pixeis, é a --curva-entra.

A quarta, a --curva-fita (estilos.css:--curva-fita), é das duas fitas — a dos
separadores e a das listas —, em que o que sai e o que entra viajam
agarrados: parte do sítio, ganha velocidade e chega devagar. A --curva-entra
arranca à velocidade máxima, e numa fita que estava parada isso lê-se como um
empurrão. É uma curva só para os dois painéis, de propósito: com curvas
diferentes abria-se uma fenda entre eles a meio do caminho.

A escolha entre transition e animation não é de gosto: é a arquitetura da
app. O render() troca o #view.innerHTML inteiro (vistas.js:render), o
openModal reconstrói a janela a cada escolha (componentes.js:openModal) e
o modalLayer nasce já com a classe .open (componentes.js:modalLayer) —
quase tudo o que muda de estado é um nó NOVO, e uma transition não tem
valor antigo de onde partir. Por isso as entradas escrevem-se em
@keyframes: a folha e o véu da janela (estilos.css:folhaEntra,
estilos.css:veuEntra), a folha que sobe abaixo dos 520px
(estilos.css:folhaSobe), os menus (estilos.css:popEntra), o «porquê» do KPI
(estilos.css:explEntra, e vistas.js:kpi, que o escreve solto dentro do
.expl), o conteúdo de uma dobra (estilos.css:foldEntra), os crachás de
contagem, que o buildNav e o buildTabbar recriam (estilos.css:selo;
navegacao.js:buildNav, navegacao.js:buildTabbar) e as barras e arcos dos
gráficos (estilos.css:gbar, estilos.css:ghbar, estilos.css:gdonut, postos
pelo graficos.js:cBars, graficos.js:cHBars e graficos.js:cDonut).

A transition fica para os poucos sítios onde a classe troca num nó vivo:
o dia escolhido do calendário (calendario.js:calSel troca o .on sem
redesenhar a grelha) e tudo o que reage ao dedo, que é reação e não
entrada.

E uma entrada precisa sempre de um portão, porque «nó novo» não quer
dizer «alguém pediu». O render corre sempre que a app adota um estado novo
do servidor — a leitura de fundo é de três em três minutos, e repinta quando
alguma coisa mudou (cloud/nucleo.js:applyState) — e a cada gesto que só
mexe num cartão. Sem portão, os gráficos redesenhavam-se e os crachás
saltavam sozinhos a meio de uma leitura. São três portões, um por natureza de entrada:
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
aqui pareceu economia e não era: os blocos da visão geral tinham-no então,
para o modo de edição, e passaram a deslizar sozinhos — 606px, medidos. Sem
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
estilos.css:@media(prefers-reduced-motion:reduce) NÃO as apanha: cada uma
pergunta primeiro pelo continuidade.js:semMovimento. E nenhuma delas pode
ficar com a repintura — se não puder animar, chama e sai da frente
(testes/continuidade.test.js).

O que se toca afunda-se: sempre :active e nunca :hover, que no iOS fica
preso depois do toque, e num telemóvel é o único sinal que existe entre o
dedo e o resultado. E o premido tem cor PRÓPRIA — o estilos.css:--press,
mais fundo do que o --chip de passar por cima. Não é preciosismo: quando
as duas coincidiam, com rato o ponteiro ficava em cima depois do clique, o
:hover mantinha a cor, e o toque seguinte não mudava nada. A app parecia
deixar de responder à segunda vez. A régua é a superfície: scale(.97) nos botões, opções
e separadores, .98 no que é grande (estilos.css:.addbox, a dobra, a
legenda), .99 no cartão (estilos.css:.card.tap). Quem já usa o transform
para se colocar leva o scale a seguir ao que lá está, senão salta do
sítio (estilos.css:.totop:active). O fundo premido é o --chip, e só onde
há fundo neutro para escurecer: quem está ativo fica com o seu, o
primário escurece para --accent-press e a gaveta tem paleta própria
(estilos.css:.btn.primary:active).

O foco desenha-se com 2px de --accent e 2px de afastamento, em
:focus-visible e nunca :focus — quem chega de rato não pode ir deixando
anéis por onde passa. A lista de classes não chega: o tornarFocavel()
torna alcançável tudo o que tem uma ação declarada (vistas.js:tornarFocavel), e
medimos dezanove sítios sem anel só na visão geral — por isso há a rede
do estilos.css:[role="button"], que é o que ele escreve. Na gaveta o anel
vem da paleta dela e não do --accent: sobre o --side, o --accent dá
1.29:1 e o anel existia sem se ver (estilos.css:.railbtn:focus-visible).

Quem pediu menos movimento ao sistema não recebe nenhum: uma só regra
apaga animação e transição em tudo
(estilos.css:@media(prefers-reduced-motion:reduce)). É por isso que
nenhuma entrada pode ser a única coisa que torna um conteúdo visível — o
estado final tem de ser o que se vê sem animação nenhuma.

E os outros dois pedidos do sistema têm o seu recuo: quem pediu menos
transparência recebe o vidro sólido — o cabeçalho com o fundo da página,
a barra de baixo com o do cartão
(estilos.css:@media(prefers-reduced-transparency:reduce)) — e quem pediu
mais contraste recebe contornos mais fundos, só pelos tokens das linhas,
para tudo o que os cita mudar com eles
(estilos.css:@media(prefers-contrast:more)).

## Componentes da casa, e quando usar cada um
sel(id,value,options,onchange) (componentes.js:sel) é O menu de escolha.
Nunca um <select> nativo: destoava nos formulários e destoa no topo (o
banner de web/app/componentes.js; o seletor de contas de teste em
entrada.js:cwTrocaConta). O valor fica num input escondido que val(id) lê
(componentes.js:val); onchange é o NOME de uma função da app, ou a própria
função (o nome resolve-se pelo eventos.js:funcaoDaApp, que nunca chega a uma
nativa). {div:true} é
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
520px a janela é uma folha encostada em baixo (estilos.css:.sheet dentro
de estilos.css:@media(max-width:520px)).

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

toast(m,op) (componentes.js:toast) é para o que aconteceu: 2,8 segundos,
frase curta com ponto final. Tem role=status e aria-live
(index.html:#toast).

falhaCampo(id,msg) (componentes.js:falhaCampo) é para o que falta num
formulário: o toast diz, o campo aponta (estilos.css:.err), vai ao ecrã,
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
cabeçalho, visível mesmo com a secção fechada (estilos.css:.fold-head, o
.fsum). É HTML: um texto que venha de quem usa — um NIF, uma categoria, a
taxa de um crédito — entra por esc(), como em todo o lado.

fab(actions) (vistas.js:fab) é o botão de criar: um por página, no canto
inferior direito; com várias ações sai o menu. O render acrescenta o
espaço no fundo (vistas.js:render, o .fabpad) e no telemóvel o botão sobe
acima da barra de baixo (estilos.css:.fab dentro de
estilos.css:@media(max-width:900px)). A visão geral também tem o seu (no
mesmo render): registar uma renda avulsa custava quatro toques de viagem.

kpi(label,value,cls,foot,why,evo) (vistas.js:kpi) é o cartão indicador:
rótulo em maiúsculas, valor grande, rodapé em muted. Com why ganha um «?»
no canto e abre a explicação ao toque (estilos.css:.kpi.why); com evo ganha
o ícone de tendência e abre a evolução mês a mês e ano a ano
(vistas.js:kpiModal). As explicações vivem em WHY (vistas.js:WHY): uma ou
duas frases, o que é e o que não é.

card(title,sub,body) (vistas.js:card) é o cartão genérico das vistas.
.card.tap é o clicável: risco de acento à esquerda e reação ao toque; o
informativo fica liso (estilos.css:.card.tap). .pend e .pend.late marcam à
esquerda em aviso e em perigo (estilos.css:.pend, estilos.css:.pend.late).

Os restantes: tagField para etiquetas removíveis
(componentes.js:tagField), fileBlock para anexos e fotos
(componentes.js:fileBlock), .addbox para «adicionar mais um»
(estilos.css:.addbox), .opt e .seg para escolhas visuais com ícone, como o
tipo de movimento (estilos.css:.opt, estilos.css:.seg), .empty para o
estado vazio (estilos.css:.empty), .tip para a dica dos gráficos
(estilos.css:.tip; graficos.js:chartTip).

## O motor das listas
A app pinta trocando o innerHTML: a vista é gerada em texto e o browser
volta a construir tudo. Medido com 500 movimentos, são 6 110 nós e ~48ms
por pintura, e a maior parte disso é o browser a ler HTML que descreve
linhas iguais às que já lá estavam. Escrever uma letra na pesquisa pagava
esse preço por tecla.

Os Movimentos são a primeira vista com motor próprio, e o motor entra ao
lado do antigo em vez de o substituir. A vista devolve a MOLDURA —
indicadores, saldos, dívidas, uns cem nós que não custam nada — e um
lista-movimentos.js:pintarListaTx enche a lista por chave: cada linha traz o id do
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
(lista-movimentos.js:txMesHtml deixa um span vazio).

E os caminhos que só mexem no que se vê deixaram de chamar o render:
escrever na pesquisa, mudar um filtro e trocar a ordenação passam pelo
lista-movimentos.js:refrescarMovimentos. Medido com 501 movimentos: uma tecla passou
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
O cabeçalho é o header.top (estilos.css:header.top): título e subtítulo
vêm de TABS (navegacao.js:TABS; vistas.js:render). O sino das
notificações só aparece na visão geral (notificacoes.js:notifSino).

Os filtros não ocupam a página: estão atrás do botão de funil do
cabeçalho (vistas.js:hdrFiltToggle, vistas.js:hdrFiltN; o render
pinta-o). O botão ganha um ponto quando há filtros ativos
(estilos.css:.filtbtn) e fica primário com o painel aberto. O painel
(estilos.css:.fwrap, estilos.css:.fpanel) é pegajoso e flutua por cima do
conteúdo sem o empurrar: preso ao topo, desaparecia ao primeiro scroll.

Os três painéis de filtro tinham três feitios; fica UM (a nota do
vistas.js:lfSel): mexes, a lista muda logo atrás; «Limpar» à esquerda,
«Fechar» primário à direita, em todo o lado. lfBar (vistas.js:lfBar)
monta-o: pesquisa no topo com o botão de limpar, seletores empilhados
(vistas.js:lfSel), ordenação (vistas.js:lfSort) e a linha «N resultados
com os filtros ativos» quando os há. lfHit (vistas.js:lfHit) faz a
pesquisa por palavras e frases entre aspas, sem ligar a acentos. anaPanel
(vistas.js:anaPanel) faz o mesmo para os ecrãs de análise, e o de sempre —
o seletor de dono e o que cada ecrã acrescenta — é o
vistas.js:anaPanelPadrao. A pesquisa
espera 280 ms e devolve o foco com o cursor no fim (vistas.js:lfSearch,
lista-movimentos.js:onTxSearch).

Uma lista é um .list de .card.tap com data-lp: título, .small com o
essencial separado por «·», .chips com selos e o ⋮ à direita
(lista-imoveis.js:vProperties). As secções por imóvel usam o .section-title com
o total à direita (lista-contratos.js:vContracts). Um ecrã de análise é KPIs em
.grid e cartões de gráfico em .cols (painel-geral.js:vDashboard;
avaliacao.js:portCard).

Todo o vazio convida: um <b> a dizer o que falta e uma frase a dizer o que
fazer (painel-geral.js:vDashboard, lista-imoveis.js:vProperties, lista-contratos.js:vContracts,
lista-pessoas.js:vTenants, lista-pessoas.js:vOwners; planeados.js:vRecurring). Com
filtros ativos o vazio é «Nada neste filtro» com o botão «Limpar
filtros», que limpa seja o que for sem saber onde está — um vazio só,
escrito num sítio (vistas.js:vazioFiltro, vistas.js:limparFiltroAtual).

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
painel-geral.js:donutDrill, planeados.js:pendToggle e o dia do calendário
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
(estilos.css:.chartbox com touch-action), para o scroll vertical continuar a
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
categoria — e, por ser um ponto de toque, fazia de cada forma uma paragem do Tab
sem destino.

Por isso as formas não têm toque próprio, e o gráfico tem uma descrição só
(graficos.js:descricaoDoGrafico). Toque só no que leva a algum lado: as
fatias do donut e os itens da legenda com onPick, que entram na categoria
(graficos.js:cDonut, graficos.js:legend). A história — 37 formas alcançáveis
pelo Tab, e zero depois — está no diário, a 2026-09-08.

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
(painel-geral.js:vDashboard marca a série; vistas.js:kpi lê a marca) — na visão
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
estimativa. «Sem ligação» é só isso — sem rede, ou sem resposta a tempo — e
fica até haver. Uma recusa do servidor (um 429, um 5xx) não é falta de rede:
fica «N alterações por enviar», e a frase do servidor diz-se num toast
(cloud/nucleo.js:avisoDoServidor).

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

Passam a ser a mesma classe (estilos.css:.opcoes): o mesmo ícone, o mesmo
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
sem imóveis e projeções sem contratos (lista-contratos.js:vContracts,
projecoes.js:vProjections) e hipotecas sem imóveis (creditos.js:vCredits) —
esta última com um botão que só dava um aviso a dizer que faltava um
imóvel, e um caminho que acaba num aviso não é um caminho. Todos ganham
o mesmo botão (vistas.js:saida), pelo molde que as visitas já usavam.

## Um aviso não tapa o que se pede para carregar
O toast mora a 22px do fundo, que é exatamente onde o rodapé de um modal
está: com um modal aberto, caía em cima de «Guardar» e «Cancelar». Sobe
a altura do rodapé que está aberto, medida e não adivinhada — há rodapés
de duas linhas (componentes.js:toast; estilos.css:.toast, o --acima).

E «Anular» deixou de ser um link. Estava sublinhado, com cor de link,
deitado sobre a barra escura do aviso — e é a única saída de uma ação que
já aconteceu. O que desfaz o que se acabou de fazer não pode parecer
texto: passa a botão, com fundo e caixa (estilos.css:.toast .toastbtn).

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
pessoas.js:personModal, planeados.js:editRec, visitas.js:visitModal): não se decora uma janela já
aberta, escolhe-se qual é a janela a abrir. E a ficha diz porquê com a frase
da permissão que falta (acessos.js:motivoRecusa), que é melhor do que o «só
de leitura» genérico que o formulário apagado dava.

Agora tocar lê, e editar é um passo deliberado: o botão do rodapé, que só
existe para quem pode (componentes.js:fichaRodape).

As entradas laterais também leem. O painel do dia do calendário abre a ficha
da visita (calendario.js:calDiaPanel, visitas.js:visView), e cada prazo abre
a ficha do registo de que fala — o contrato, o movimento, a pessoa, o imóvel,
a hipoteca (prazos.js:prazosDe). Um formulário aberto a partir de um aviso era
um beco para quem só pode ler.

As peças são uma só, para não nascerem sete desenhos de ficha como tinham
nascido três desenhos de porta. O corpo escreve-se com componentes.js:ficha,
que recebe linhas e deita fora as que não têm valor — uma ficha mostra o que
se sabe, e um rótulo com um traço à frente é ruído a fingir que é informação.
As linhas são as mesmas `.stat` que a app já usa em toda a parte
(estilos.css:.stat).

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
   (lista-contratos.js:pintarRendasDosGrupos). Lá dentro, mudar uma renda refazia o
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

São três (registos.js:ctEstado): **terminado**, **futuro**, **ativo**. E há
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
  (projecoes.js:projRows, avaliacao.js:evoRatio) — aí quem corta por datas é o
  `mesesEmVigor`, ano a ano.

E o terceiro estado **vê-se**, senão o contrato desaparece dos ecrãs onde a
pessoa o foi procurar: selo «por começar» na lista, «Por começar · a
2028-03-15» na ficha, um filtro próprio, «Vai morar em» na ficha do
inquilino, e a data de início ao lado da renda no cartão dele.

A renda planeada acompanha o início nos dois sentidos, sem nunca voltar a
pedir um mês que já tem renda (planeados.js:syncContractRec): a regra está
em «A renda planeada e as rendas já lançadas».

## A Declaração resume, não declara
À pergunta «este contrato foi comunicado à AT?» há três respostas, não duas:
por indicar, declarado, não declarado (dados.js:normFisco, o `estado`). A
terceira é uma escolha de quem assina, e a ficha apresenta-a como as outras
duas — sem selo vermelho, sem aviso, sem «devias» (contrato.js:ctBody). Um
selo ali não mudava a escolha de ninguém; só afastava quem a fez. O que a
escolha muda é o que a app faz com o contrato: um não declarado sai do
resumo do Anexo F e fica listado à parte, com as suas rendas e em linguagem
neutra, «fora da declaração» (fisco.js:resumoFiscal, a lista `fora`), e não
gera nenhum prazo da AT — nem Modelo 2, nem recibos, nem 15 de fevereiro
(prazos.js:prazosDe). Lembrar a alguém um prazo que decidiu não cumprir não
é ajudar: é insistir.

A página Declaração mostra as linhas do quadro 4.1 com o que a app sabe e aponta
o que falta — o código da freguesia, o número do contrato na AT, o NIF de um
inquilino — em vez de deixar a célula em branco ou, pior, de a preencher
(fisco.js:vFisco). Nunca se inventa um código nem um número: o que não está
nos dados não está na página. E o que é conta da app vem dito como tal: os
gastos de um imóvel com vários contratos repartem-se pelas linhas na
proporção das rendas de cada uma, e a página chama-lhe estimativa, porque é
uma. Quem declara é a pessoa, no Portal das Finanças; a app poupa-lhe a soma
e a procura, não a assinatura.

A coluna onde um gasto cai sai de uma regra que se vê e se muda: o mapa
categoria → coluna vive nas definições, por categoria ou por «categoria /
subcategoria», e repõe-se num toque (definicoes.js:vIrsMapa). A escolha
feita no próprio movimento manda sobre a regra, a subcategoria manda sobre a
categoria, e o que não tem regra cai em «outros gastos» com a origem à vista
(irs.js:irsColunaDe) — para o resumo poder dizer «isto foi por
omissão» em vez de o esconder num total.

As obras feitas nos 24 meses antes de um contrato, com a casa vazia, entram
na linha dele no primeiro ano em que ele tem rendas, e só nesse
(fisco.js:resumoFiscal): o ano do início pode não ter renda nenhuma, e a obra
não pode ficar em ano nenhum nem em dois.

O contrato em PDF segue a mesma regra de não inventar. Uma frase sem o dado de
que precisa sai, em vez de sair com um espaço em branco ou um valor por
omissão — sem dia de pagamento não há a frase do dia, sem rendas antecipadas
não há a cláusula delas —, e sem início, fim, senhorio ou morada o PDF não se
gera: diz o que falta (contrato-pdf.js:generateContractPdf).

## Segurar não é selecionar
A lista dos movimentos mexe-se por baixo do dedo: o toque longo entra em modo
de seleção, nasce uma barra acima de tudo e o título do mês cresce e cola-se
ao topo. O dedo, que não se mexeu, acaba sobre o cabeçalho do mês — e o
browser faz o que faz a um dedo parado sobre texto.

A regra casa pelo **comportamento**, não pelo elemento
(estilos.css:[role="button"]): o `tornarFocavel` carimba `role="button"` em
tudo o que tem uma ação declarada e não é controlo nativo, e repõe-no a cada
repintura,
por isso apanha também o chrome que ainda não existe. O que se copia — o
IBAN, as notas, os valores das fichas — não tem ação nenhuma e continua
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

E a caixa para onde os filhos do `#view` vão durante a viagem leva as classes
do próprio `#view`, menos a `.entra` (continuidade.js:deslizarPainel): sem o
`.wrap`, o conteúdo esticava de encosto a encosto e a fita dava um salto antes
de deslizar.

## A renda planeada e as rendas já lançadas
Uma recorrência é um **cursor**, e não um histórico: guarda uma data só, a
próxima ocorrência (planeados.js:syncContractRec). Quem guarda o que já
aconteceu são os **movimentos**, registos próprios em `db.transactions` —
confirmar faz duas coisas independentes: cria o movimento e empurra o cursor.

Daí a regra, e é uma só: **o cursor acompanha o contrato nos dois sentidos,
mas nunca passa por cima de um mês que já tem renda deste contrato**
(planeados.js:cursorDaRenda, planeados.js:rendaJaLancada). Adiar o início leva a renda planeada com ele;
corrigir um início de 2028 para 2025 traz o cursor de volta — mas ele pára no
primeiro mês por confirmar, e não em janeiro. É a mesma regra que faz o
confirmar não duplicar: o cursor nunca aterra num mês já lançado, e quando
lá chega por outro caminho (uma renda lançada à mão), salta e di-lo.

Renda é o que é renda (irs.js:ehRenda): a caução e os empréstimos são passivo
e não contam. E conta pelo mês a que respeita, não pelo dia em que entrou
(planeados.js:mesDaRenda) — a renda de setembro paga a 3 de outubro é de
setembro. Contar qualquer movimento do contrato fazia a caução do primeiro dia
passar pela renda do primeiro mês, e o mês saltava sem ninguém o confirmar.

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
O ecrã dizia `2028-03-15`. Passa a dizer **15/03/2028** (formato.js:dPT), e
os meses soltos dizem «ago 2026» (lista-movimentos.js:mesPt) — a mesma forma nas
listas e nas fichas, porque um formato longo lê-se bem numa ficha e mal numa
tabela, e dois formatos ao mesmo tempo eram pior do que um estrangeiro.

O ISO fica onde é **dado**, e nunca se lhe toca: na base, nos
`<input type="date">` (o HTML exige-o e o browser já o mostra na forma local),
nas comparações e ordenações (a comparação de texto só funciona em ISO), nas
chaves, no CSV e no que sai para o servidor. Há sítios onde a mesma variável
faz as duas coisas — o cabeçalho de mês dos movimentos é ao mesmo tempo o
texto que se lê e a **chave** da lista viva (lista-movimentos.js:txMesHtml), e o
intervalo do filtro é texto no resumo e `value=` nos campos — e aí muda-se só
o que se lê.

A pesquisa dos movimentos leva a data nas **duas** formas (lista-movimentos.js:txHay):
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

## O service worker e a versão
A app abre offline porque o service worker guarda a casca — os ficheiros da
app e mais nada — numa cache com o nome da versão (sw.js:CACHE; a versão é a
primeira entrada de web/avisos.js). Cinco regras seguram isso, e cada uma
custou uma avaria em produção (a história está no diário, de 2026-09-09 a
2026-09-12):

- Um carregamento serve-se todo da mesma cache, e ela enche-se de uma vez, no
  install, e só se estiver vazia (sw.js:encherSeVazia): uma cache com
  conteúdo e este nome é a de quem está a servir, e encher por cima dela é
  trocar os ficheiros a meio de um carregamento. O install não leva .catch():
  chegar a «em espera» é a prova de que a versão nova está inteira em disco.
- O worker novo espera. Só assume com um pedido da app, {tipo:'assumir'}, que
  ela manda depois de ter decidido recarregar (novidades.js:trocarDeWorker) —
  nunca um skipWaiting a meio de um carregamento, porque os endereços dos
  ficheiros não levam a versão. Fora de produção não guarda nada e assume logo
  (sw.js:GUARDA, sw.js:SEM_CACHE); a lista diz quem NÃO é produção, porque os
  endereços de produção são os de hoje e os de ontem.
- Só se serve e só se guarda o que está na SHELL (sw.js:SHELL): uma lista de
  permissão, e não de exclusões — o Cache API não lê Cache-Control, e o
  /equipa, com a sessão da equipa lá dentro, chegou a ir para o disco. Só
  status 200, e só da mesma origem.
- Uma navegação guarda-se e serve-se pela chave «/», seja qual for o endereço
  com que se chegou (as ligações por email levam ?entrar=, ?convite=…). Nunca
  o /index.html nem outro caminho que os assets redirecionem: a resposta
  guardada vem marcada como redirecionada e o browser recusa-a numa
  navegação. Uma resposta assim, se já estiver numa cache, refaz-se sem a
  marca antes de ser servida (sw.js:inteira).
- Publicar sem subir a versão não sai: o CI compara os ficheiros que a cache
  guarda com os da publicação anterior, e recusa se mudaram sem versão nova
  (chegada.js:decidir, chegada.js:ficheirosGuardados).

A rede de segurança do arranque (em linha no index.html, antes de todos os
<script>) apaga as caches e recarrega quando um ficheiro não carrega — mas
nunca sem rede (o navigator.onLine === false é o único valor de confiança),
no máximo uma vez em cada dez minutos, e levando antes o erro que a fez
disparar (index.html:levarAntesDeRecarregar). O ecrã que tranca uma versão
velha demais fica acima do de entrada e tranca também as escritas
(novidades.js:gateAtualizar, e o CW.trancado que a api() respeita): velha
demais para se usar é velha demais para escrever.

## A app não afirma nem decide antes de saber
Entre abrir a app e o primeiro estado do servidor chegar há uma janela — um
instante com rede, seis segundos no pior caso. Nessa janela o que está no
aparelho pode estar velho, ser de outra conta, ou nem existir (navegação
privada, armazenamento limpo, um aparelho novo). Duas regras, que são o molde
de tudo o que aparece antes de o servidor falar (a história no diário,
2026-09-09):

A app não AFIRMA o que depende do servidor antes de saber. O sino, o cartão
dos movimentos por confirmar, os prazos, o crachá dos planeados e o aviso do
arranque perguntam primeiro a espera.js:sabemosOEstado; um vazio pergunta à
espera.js:esperaDoServidor, que só fala quando não se sabe mesmo nada —
sessão à espera do primeiro estado e base vazia — e diz «ainda não sabemos»
em vez de «não tens nada». A pergunta é «há sessão?» (espera.js:haSessao),
que se sabe do aparelho sem depender da ordem de carregamento, e não «a nuvem
já carregou?». A espera acaba em três alturas (nucleo.js:fimDaEspera): o
servidor falou, o pedido falhou, ou passaram seis segundos. E o que não
carregou diz que não carregou, e não que está vazio: os pedidos de ajuda que
falham a chegar dizem «Não deu para carregar os teus pedidos — tenta de
novo.», com o botão para tentar (ajuda.js).

A app não DECIDE a partir do que não sabe. O que o arranque deriva — as
rendas e as prestações planeadas, que também apagam recorrências órfãs —
espera pelo mesmo guarda (arranque.js:derivarDoArranque); o push não apaga
por diferença antes do primeiro estado (nucleo.js:pushNow); e a arrumação dos
anexos órfãos deita fora só o blob daqui, e espera por saber
(web/app/anexos.js:cleanFiles). Sem rede a app escreve na mesma — é offline
que mais se precisa de escrever, e o navigator.onLine mente num portal
cativo: o estado em que ela não decide não é «sem rede», é «antes de saber».

Os dados de exemplo não se carregam em produção, e isso pergunta-se antes de
escrever o botão (espera.js:podeExemplo), e não depois, a apagá-lo do DOM.

## A sincronização: o que é daqui e o que é do servidor
A app escreve no aparelho e sincroniza depois: cada gravação agenda um envio
das diferenças para o retrato do que o servidor já tem (nucleo.js:pushNow), e
de três em três minutos lê o estado (nucleo.js:pullNow). O retrato guarda um
resumo de cada entidade, e não o JSON dela (nucleo.js:resumoDeTexto): com o
JSON, o retrato chegava a passar de um terço da base.

Ler o estado é uma fusão a três, com o retrato como base
(nucleo.js:applyState). O que aqui está igual ao retrato passa a ser o que o
servidor tem, incluindo desaparecer; o que é novo, foi editado ou foi apagado
aqui fica por cima (nucleo.js:pendentesLocais, nucleo.js:reporPendentes), e o
push seguinte envia-o. As marcas (os campos com _), os donos e as quotas são
sempre do servidor (nucleo.js:fundidoComServidor). Duas exceções: uma base de
outra conta cede ao servidor inteira, e sem retrato os dados locais só sobem
se o servidor estiver vazio. Trocar o db pelo do servidor, como se fazia,
perdia o que se escreveu offline e o que um 429 recusou.

O que o cliente não sabe ler não se apaga: um kind de uma versão mais nova,
ou um registo que não normaliza, fica congelado e relata-se
(nucleo.js:relatarIlegivel). Só é obsoleto o que o cliente reconhece e
decidiu deixar de exportar — os kinds retirados (nucleo.js:KINDS_RETIRADOS) e
a chave antiga de uma entidade que passou a viver noutra. E uma entidade vive
numa chave só: a ficha de um inquilino de um imóvel sobe como registo do
imóvel, e não também como registo do utilizador (nucleo.js:exportEntities).

Nada mudou, nada se refaz. O estado leva um selo (ETag), e a leitura manda o
último que aplicou (nucleo.js:pedirEstado): com um 304, ou com a resposta
igual à última, não se refaz a base nem se repinta. A primeira leitura da
página nunca é condicional. E a leitura de fundo não repinta com uma janela
aberta nem com alguém a escrever num campo (nucleo.js:aEscreverNumCampo).

Cada pedido tem tecto (nucleo.js:TEMPO_API): largar um pedido pendurado é o
que deixa o envio seguinte sair. E uma resposta do servidor não é falta de
rede: com 429 ou 5xx o selo fica em «N por enviar» e a frase dele diz-se num
toast (nucleo.js:avisoDoServidor); «Sem ligação» é só sem rede, ou sem
resposta a tempo.

A sessão vive no cookie HttpOnly que o servidor põe; o aparelho guarda quem
entrou, não o token (o token só vem no corpo fora de produção e a pedido, para
os testes: worker/src/auth.js:tokenNoCorpo). Uma sessão antiga, guardada com
token, passa para o cookie no arranque (nucleo.js:largarTokenAntigo). Sair é
um ritual só (nucleo.js:encerrarSessao): num simples sair a base e o retrato
ficam, apagar a conta leva-os. E um 401 de uma palavra-passe errada não põe
ninguém fora (nucleo.js:sessaoCaiu).

## O capital em dívida deriva-se
Uma hipoteca guarda o capital em dívida da DATA DE INÍCIO — é o campo
«Capital em dívida» do formulário — e o de hoje não se guarda à mão: é esse
capital menos a soma do capital dos pagamentos ligados a ela
(credito.js:saldoEmDivida, credito.js:capitalAbatido). Abatia-se e repunha-se
por aritmética em cada sítio que mexia num pagamento, e duas escritas
cruzadas — um aparelho regista a prestação, outro grava por cima a casa que
tinha aberta — deixavam o capital errado sem nada com que o refazer. O
outstanding que fica gravado é uma cache, acertada depois de carregar, de
repor uma cópia e de ler o estado (credito.js:acertarCreditos,
dados.js:normalizarBase); uma hipoteca antiga sem o capital do início tira-o
do outstanding mais os pagamentos (credito.js:capitalDoInicio), o que não
muda nada do que se via.

As decisões de fundo são do Martinho, e não se desfazem: o «Prazo» é o total;
as prestações em falta desde o início abatem o capital; o prazo restante conta
só com as prestações registadas; e recuar o início é um engano na data. A fase
da taxa fixa tem um relógio só, o das prestações registadas
(credito.js:fimDaFaseFixa): o aviso do prazo e a simulação da ficha dizem o
mesmo dia.

## Navegação
Quinze separadores em TABS (navegacao.js:TABS), cada um com ícone, rótulo e
subtítulo — e cada um menos as Definições é um serviço (ver «A app em
serviços»). A gaveta agrupa-os em quatro (navegacao.js:NAV_GROUPS):
Património, Pessoas, Finanças e Aplicação; o título do grupo é o .navh
(estilos.css:.navh). No computador a gaveta é um rail fixo que pode
colapsar para só ícones (estilos.css:body.rail); abaixo de 900px vira gaveta
com véu (estilos.css:aside e estilos.css:.scrim dentro de
estilos.css:@media(max-width:900px)) e o foco entra nela ao abrir
(navegacao.js:openDrawer).

A barra de baixo tem quatro destinos, a um toque: visão geral («Geral»),
movimentos, imóveis e calendário (navegacao.js:TABBAR,
navegacao.js:buildTabbar). A auditoria mediu: com tudo atrás da gaveta,
qualquer mudança de ecrã custava dois toques. O calendário tomou o lugar
dos planeados, mostra-os dia a dia e leva o crachá dos pendentes. A barra
só existe abaixo de 900px e esconde-se com a gaveta aberta
(estilos.css:.tabbar dentro de estilos.css:@media(max-width:900px)); o traço
do ativo da gaveta não se aplica nela (estilos.css:.tabbar, o a.on::before).

Recarregar devolve-te ao sítio onde estavas: o separador e a subpágina das
Definições ficam em localStorage (gi_page: web/cloud/nucleo.js:LS_PAGE,
web/cloud/nucleo.js:restorePage). Entrar e sair levam sempre à visão geral
(entrada.js:finishLogin; partilha.js:logout). Mudar de separador faz scroll
ao topo (navegacao.js:go). O «voltar» do sistema fecha primeiro o que
estiver aberto (menu, gaveta, janela) e numa subpágina das Definições sobe
a Definições (componentes.js:pushHist e o ouvinte de popstate logo a
seguir). O item ativo leva aria-current (navegacao.js:buildNav,
navegacao.js:buildTabbar); o burger leva aria-expanded
(navegacao.js:openDrawer, navegacao.js:closeDrawer).

## A app em serviços
Cada separador da barra lateral é um serviço com manifesto próprio, e as
Definições são a base. O catálogo vive em servicos.js:SERVICOS — por
serviço, o id (o do separador), o nome, os ficheiros que o compõem, os
kinds de registo que possui, o que requer (sem Imóveis não há Contratos) e
o que usa quando está ligado. O espelho no servidor é
worker/src/lib/servicos.js:SERVICOS, e um teste compara os dois
(testes/servicos.test.js).

A base nunca nomeia um serviço: despacha pelo registo. Ao carregar, cada
serviço diz o que tem (servicos.js:registarServico) — a vista do separador,
o que pinta depois do render (a lista dos movimentos, as rendas dos grupos,
as miniaturas), o crachá do menu, o handler do toque longo do seu prefixo e
as opções que acrescenta ao menu de outro (lpExtras: «Novo contrato» no
menu de um imóvel vem dos Contratos), e a análise (quantos filtros próprios
estão ativos, e como se limpam). O render pede a vista ao registo
(vistas.js:render, servicos.js:vistaDoSeparador), a gaveta esconde os
separadores desligados (navegacao.js:buildNav,
acessos.js:separadoresEscondidos), o toque longo entrega o data-lp ao
serviço dono (componentes.js:lpMenu, servicos.js:lpDe). O registo guarda
NOMES de funções e resolve-os na hora: a camada da nuvem embrulha vDashboard,
vTransactions e lpMenu por reatribuição, e um registo por referência prendia
a versão de antes.

Ligado ou desligado é por utilizador, e decide-o o suporte no back office
(worker/src/equipa-api.js:rotasEquipaApi, a ficha do utilizador): o servidor guarda os
desligados (user_services, migração 0015; ausência = ligado), devolve-os em
GET /api/state, não manda os registos dos kinds desligados e recusa escritas
neles com 403 e a frase «O serviço X está desligado nesta conta.» — a mesma
que o cliente mostra (servicos.js:hintServicoDesligado). Desligar um serviço
desliga os que o requerem (servicos.js:fechoDesligados), sempre, dos dois
lados. No cliente a lista fica no aparelho (gi_servicos_off), para o
arranque a saber antes de o servidor responder; o separador some, go recusa
com um toast (navegacao.js:go), um endereço guardado não se restaura
(web/cloud/nucleo.js:restorePage), e chegar a um separador desligado por um
atalho antigo pinta um ecrã que diz o nome e quem liga, sem juízo
(servicos.js:servicoDesligadoHtml). Quem não tem conta tem tudo ligado
(servicos.js:servicoLigado).

O interruptor, no back office, é o cartão «Serviços» na ficha de um
utilizador, em Pessoas, para quem fala com as pessoas (o suporte e o master).
Por baixo estão duas rotas (worker/src/equipa-api.js:servicosDaConta monta a
resposta): GET /api/equipa/pessoas/:id/servicos devolve {servicos: [{id,
nome, ligado, requer}]}, um por serviço do catálogo e pela ordem dele; PUT
/api/equipa/pessoas/:id/servicos/:servico com {ligado: true} ou {ligado:
false} grava e devolve a mesma lista. Desligar desliga também os que dependem
desse (Imóveis leva Contratos, Visitas, Colaboradores e Créditos); ligar exige
os requeridos ligados — senão 400, com a frase que diz o que ligar primeiro —
e os dependentes ligam-se um a um. Uma conta que não existe dá 404, um serviço
fora do catálogo 400, um papel que não vê pessoas 403. Cada mudança fica no
rasto (conta.servico.ligar ou conta.servico.desligar, com o feito ou o falhou
a seguir), e nada se apaga: ao ligar outra vez, volta tudo.

Há uma janela entre o suporte desligar um serviço e o estado seguinte
chegar à app (até três minutos, mais se houver uma janela aberta): o que se
escrever nesse serviço nessa janela — ou offline, antes — chega ao servidor
e volta com 403 e o id do serviço (rotas/sync.js). O cliente não insiste nem
finge falta de rede: o registo sai da base local, o serviço fica desligado
já no aparelho, e diz-se a razão certa
(web/cloud/nucleo.js:recusaPorServico — o 403 de serviço é outro caminho que
não o das permissões num imóvel de colaboração); de uma remoção recusada
diz-se que não foi apagada, e o registo volta com o estado em que o serviço
religar. As chaves de um serviço
desligado ficam congeladas (web/cloud/nucleo.js:chaveCongelada): nem sobem
nem se apagam por diferença — o estado do servidor manda, e traz tudo de
volta ao religar. Pela mesma razão, o que deriva registos de outros
(planeados.js:syncAllContractRecs, planeados.js:syncAllLoanRecs,
web/app/anexos.js:cleanFiles) não corre com o serviço de origem desligado: um
planeado de renda sem o contrato à vista não é um órfão.

Todo o código continua a ser carregado pelo index.html, ligado ou não: a
SHELL offline é uma só, e a nuvem precisa das funções no carregamento para
as embrulhar — um <script> condicional partia isso e o offline. O
interruptor é o registo, não o carregamento. É por isso que um serviço tem
de ser autónomo de duas maneiras: carrega e rende só com a base e com o que
requer (o arnês prova-o: testes/arnes.js:carregarServico carrega só isso, e
cada folha tem o seu teste servico-*.test.js), e não rebenta quando outro
está desligado — as chamadas cruzadas passam por servicos.js:servicoLigado
(esconder o botão) ou servicos.js:chamarServico (o toast). Um verificador
lê os ficheiros de cada serviço e aponta as chamadas a outro serviço sem
guarda (.unlazy/servicos/verificar.mjs, a bandeira --servico).

A base distingue um separador desligado de um que não carregou: um nome do
registo que não resolve — um ficheiro que falhou, uma const que não ficou em
window — pinta «não carregou», com o Recarregar, e relata-se uma vez
(servicos.js:vistaNaoCarregouHtml); «desligado» é só o que o suporte
desligou. E um ecrã que depende de um serviço desligado di-lo com a mesma
frase em todo o lado (servicos.js:fraseServicoDesligado).

O que um serviço oferece vive nos ficheiros dele, mesmo quando outro o
mostra: a Amortização é dos Créditos (creditos.js:amortModal) e abre-se sem
os Movimentos — só pagar uma prestação os pede —, e o modelo e o escritor do
PDF do contrato são dos Contratos (contrato-pdf.js:generateContractPdf). A
base diz-se pelo nome, e não «o que sobra» dos serviços: os prazos, o sino, a
importação do Splitwise e as contas das hipotecas são da base por decisão
(testes/arnes.js:BASE, e o grupo «a base» de sw.js:APP).

A pasta web/cloud/ é a segunda camada, e não só a nuvem: o que junta os
ficheiros dela é a ordem — carregam depois do arranque, precisam do CW que o
nucleo.js cria e embrulham a base e os serviços por reatribuição
(index.html:<script src="cloud/nucleo.js">, e a nota por cima). Uns falam com
o servidor (nucleo, anexos, utilizadores, partilha, colaboradores, ajuda,
entrada, novidades); o painel, os filtros, a seleção e o guia estão lá pela
ordem de carregamento.

## A CSP sem «unsafe-inline»
A política da app não deixa correr nada que esteja escrito dentro do HTML.
Vive em dois sítios que dizem o mesmo: a constante CSP do
worker/src/index.js, que o harden() põe na raiz — é a que manda na app —, e o
web/_headers, que veste os ficheiros estáticos. As páginas que o worker
escreve (a landing, os documentos legais, os docs, o back office, a entrada de
teste) vão com a worker/src/lib/http.js:CSP_ESTRITA, a mesma sem os três
hashes — os dois da app e o da folha do Google, que nenhuma delas precisa —, e
o harden() só deixa uma rota APERTAR a política, com valores exatos.

Há um terceiro hash, no `style-src`, que não é nosso: é o da folha que o botão
de entrada com Google injeta na página. Sem ele o browser recusa-a e o botão
passa de 72px para 357px de altura — medido. Um hash não abre a porta a mais
nada, ao contrário de um `'unsafe-inline'`, mas é de um terceiro: quando o
Google mudar a biblioteca, o hash caduca e o botão volta a crescer. Os dois
atributos de estilo que a mesma biblioteca escreve continuam recusados — um
hash não cobre um atributo sem `'unsafe-hashes'`, que abriria a porta a todos —
e medimos que não mudam nada do que se vê.

Os dois únicos scripts em linha são os do web/index.html — a armadilha de
erros e a cura do arranque —, que têm de correr antes de qualquer ficheiro.
Entram por `sha256` do texto exato entre as etiquetas
(worker/src/index.js:HASHES_EM_LINHA), calculado com fins de linha LF, que é
como o ficheiro chega a produção. Mexer num deles obriga a refazer os dois
hashes, nos dois sítios.

O que isso proíbe, e não é negociável, porque o browser não dá erro nenhum
quando recusa — a app fica muda ou despida e o servidor não sabe de nada:

- nenhum `on…=` no HTML: os eventos vão nos cinco atributos declarados;
- nenhum `style=`, e nenhum `setAttribute('style', …)`;
- nenhum bloco de estilos escrito no HTML, e nenhuma folha criada por
  JavaScript e pendurada na cabeça: as regras vivem no web/estilos.css;
- nenhum `new Function` nem `eval` — a política também não tem
  `'unsafe-eval'`.

O que continua a poder fazer-se é o CSSOM: `el.style.x = …` e
`el.style.cssText`, que a política não olha. O testes/csp.test.js varre o web/
e as páginas do worker à procura do que ela recusaria, e confere que as duas
políticas são iguais e que os hashes batem com o ficheiro.

## Os eventos declaram-se, e uma ação é uma gramática
Cinco atributos, um por evento em uso: `data-click`, `data-change`,
`data-input`, `data-keydown` e `data-pointerdown`. O valor é uma **ação** — na
maior parte dos casos o mesmo texto que estava no `on…=`. Quem os liga é o
web/app/eventos.js, com um ouvinte de captura no `window` por tipo de evento:
quando um evento passa, cada elemento do caminho que tenha o atributo ganha aí
o seu ouvinte. A ligação é preguiçosa de propósito — assim a ordem da
propagação fica a de um `on…=` (primeiro o alvo, depois os antepassados), um
`event.stopPropagation()` numa ação trava os de cima, e um `el.click()` logo a
seguir a um `innerHTML` funciona. O atributo lê-se quando o evento chega:
mudá-lo muda a ação, tirá-lo desliga-a.

Uma ação é uma gramática pequena (eventos.js:analisarAcao), e só ela: chamadas,
`.` para ler uma propriedade, `&&`, `||`, `!`, o `-` unário, textos, números,
`true`, `false`, `null`, `undefined`. Ficam de fora atribuições, `if`,
comparações, aritmética, funções e setas, template strings, `new` e índices
`[…]`. O que precisa disso passa a ser uma função com nome no mesmo ficheiro, e
a ação chama-a — é o que são o calendario.js:calMarcarVisita, o
contrato.js:ctRegistarRenda, o creditos.js:pagarCreditoDaHipoteca, o
painel-geral.js:dashVerSemImovel e o notificacoes.js:notifPedidoAceitar.

Os nomes fecham-se no arranque: uma ação só chama o que a app declara no topo
(`function`, `var` ou `window.x` de topo), e um nome que apareça no `window`
depois disso — o que um script de fora pendura lá — é recusado. Os `let` e
`const` de topo não estão no `window`: uma ação que precise deles chama uma
função. Em `this` e `event` só se leem `value`, `checked`, `files`, `key`,
`dataset`, `id`, `name`, `selectedIndex` e `type`, e uma função nativa só se
chama se estiver numa lista curta. Todo o valor que circula passa pelo
eventos.js:acaoValor: o `window`, o `document`, uma função nativa ou um nó do
DOM que não seja o `this` nunca circulam — **uma função da app que uma ação
chame não pode devolver um nó do DOM**, senão a ação rebenta depois de ela
correr.

Quem despacha por NOME — o `onchange` de um sel() (componentes.js:selPick), o
apagar de um anexo (componentes.js:delFileConfirm), a chamada a um serviço
(servicos.js:chamarServico) — resolve-o sempre pelo eventos.js:funcaoDaApp, o
único sítio da app onde se lê `window[nome]` com um nome vindo de fora. Ele
nunca devolve uma nativa, um nome do browser, um nome de um script de fora nem
um que tenha aparecido depois do arranque. E nenhuma função de topo carrega
código a partir de um argumento: uma que crie um `script src` vive dentro de
quem a usa, com o URL fixo.

Duas diferenças para um `on…=`, e não se pode criar nenhuma: no MESMO elemento,
um `addEventListener` que a app ponha antes do primeiro evento corre ANTES da
ação (com o `on…=` corria depois); e um elemento fora do documento não recebe o
clique que o código lhe dá, porque o evento não chega ao `window`.

O escape continua a ser a primeira defesa: um valor entre plicas numa ação vai
por formato.js:jsq, e por formato.js:jsqBruto quando a ação é escrita com
`setAttribute` em vez de ir dentro de HTML. E as funções que recebem HTML —
que uma ação alcança — tiram-lhe o `iframe`, o `meta`, o `base`, o `object` e o
`embed` num sítio só (componentes.js:semEtiquetasQueCorrem).

## Os estilos vivem na folha, e nunca no HTML
O CSS da app é o web/estilos.css, carregado pelo index.html. Um aspeto que
antes ia num `style=` escreve-se de uma de três maneiras.

**Uma classe utilitária**, quando é uma declaração só: `u-<abreviatura>-<valor>`
(estilos.css:.u-d-block). O seletor leva o id do `<html>` duas vezes
(index.html:#raiz), o que lhe dá a especificidade (2,1,0) e faz com que ganhe a
qualquer regra da folha — que é o lugar que o `style=` ocupava. Ganham-lhe, como
lhe ganhavam a ele, o `!important` e o que o JavaScript escreve no `el.style`.

**Uma classe do módulo**, quando as declarações se sobrepõem (`margin` com
`margin-top`, `border` com `border-color`) ou só fazem sentido juntas: leva o
prefixo do ficheiro e o mesmo seletor, e vive na secção do módulo, por cima dos
utilitários.

**Um atributo calculado**, quando o valor vem dos dados: `data-largura`,
`data-fundo` e `data-atraso`, que o web/app/estilos-calculados.js valida e
aplica no `el.style` antes de o ecrã pintar (graficos.js:cHBars é o caso de
uso). É CSSOM, que a política deixa passar, e é a única forma de um número ou
de uma cor vindos dos dados chegarem ao estilo. Dentro de um SVG usam-se
atributos de apresentação.

A armadilha: **um `el.style.x = ''` apaga um estilo em linha, mas não apaga uma
classe**. Uma propriedade que o JavaScript escreva e reponha não pode vir de um
utilitário — ou o par passa todo a `classList`, ou o estado inicial passa a uma
regra que o `el.style` continue a vencer, como o `:empty` dos dois botões do
cabeçalho (estilos.css:#hdrBell).

## Escrita
Português de Portugal, e trata-se por tu: «Tens alterações por guardar»
(componentes.js:closeModal), «Começa por adicionar um imóvel»
(painel-geral.js:vDashboard), «Dá um nome ao imóvel» (imovel.js:propModal),
«tenta daqui a pouco» (entrada.js:esqueci).

Frases curtas, com ponto final nos toasts: «Movimento apagado.»
(movimento.js:delTx), «Anulado.» (componentes.js:comDesfazer).

Rótulos em sentence case: «Visão geral» (navegacao.js:TABS), «Adicionar
imóvel» (painel-geral.js:vDashboard), «Registar pagamentos»
(vistas.js:settleModal), «Pagar todas as dívidas»
(vistas.js:balancesCard). As maiúsculas de secção vêm do CSS, não do
texto.

Sem emojis na interface. Os ícones são traço em SVG, ic(nome,tamanho)
(icones.js:ic): stroke 1.7, currentColor, 20px por omissão. Um ícone
novo entra no mapa do ic(), não como carácter.

O hint explica o porquê, não repete o rótulo: «Confirmar regista o
movimento e agenda o seguinte. Silenciar deixa-o à espera, sem avisos.»
(planeados.js:pendingCard); «Entram aqui mas não na Avaliação — não estão
atribuídas a nenhum imóvel. É por isto que os totais divergem.»
(painel-geral.js:orphanCard); os WHY dos KPIs (vistas.js:WHY).

A mensagem de erro diz o que fazer: «Indica a renda mensal.» e «O fim do
contrato é antes do início — verifica as datas.» (contrato.js:ctSaver),
«Escreve uma descrição.» (movimento.js:txModal).

O botão diz o verbo: «Apagar», «Terminar», «Registar pagamentos»; o rodapé
neutro é Cancelar e Guardar, Fechar ou Voltar (componentes.js:fillModal,
componentes.js:pickModal; vistas.js:kpiModal).

A primeira letra põe-se à mão: toLocaleDateString('pt-PT') devolve
«setembro de 2026» e text-transform:capitalize dava «Setembro De 2026»
(calendario.js:vCalendar, calendario.js:calDiaPanel).

Separadores: «·» entre pedaços de uma linha (lista-imoveis.js:vProperties,
lista-movimentos.js:vTransactions), «—» para o vazio (formato.js:pct;
componentes.js:sel) e dentro das frases, «−» tipográfico nos negativos
(formato.js:money).

Os nomes do código seguem a mesma língua. Nomes novos — funções,
constantes, variáveis de topo, ficheiros — são em português, e os antigos
mudam quando se lhes toca: quem mexe numa função com nome inglês e tem à vista
todos os que a chamam dá-lhe o nome português no mesmo commit; quem só passa
por ela deixa-a. Metade da app nasceu em inglês (vDashboard, txModal,
syncContractRec, ctRecOf) e a outra metade em português (rendaJaLancada,
cursorDaRenda, sabemosOEstado), e procurar «a função que confirma um
planeado» não pode obrigar a saber em que ano ela foi escrita. Dois nomes
para o mesmo gesto é o pior dos casos: o navegacao.js:closeFilterPanels fazia
à mão o que o vistas.js:fecharFiltros faz, e agora chama-o.

Não se renomeia de passagem o que está preso fora do ficheiro: as chaves dos
dados, que vivem no aparelho, nas cópias e no servidor (db.transactions,
db.settings, os kinds dos registos); os nomes que o registo dos serviços
resolve por texto (servicos.js:SERVICOS e o que cada serviço regista em
servicos.js:registarServico); os que a camada da nuvem embrulha por
reatribuição (render, save, go, vDashboard, vTransactions, lpMenu, selOpen); e
os que vão escritos em texto numa ação declarada. Esses mudam-se de uma vez, em todos
os sítios, com o teste que resolve os nomes do registo
(testes/correcao-base.test.js) a confirmar.

E uma função com vários argumentos opcionais recebe um objeto: o formulário
do movimento abre-se com txModal({kind, propId, ctId, preset, modo, …})
(movimento.js:txModal); a única forma curta é o id sozinho, e uma chamada por
posições lança um erro com a regra — seis posições com um argumento morto no
meio abriam o formulário errado em silêncio.

Os comentários do código seguem o mesmo tom: em português, contam a razão
e o que custou («medido: 70% de um dropdown fora de vista»,
componentes.js:ajustarPop), e cada função leva Recebe e Devolve, senão o
gerador de documentação rebenta (scripts/gerar-docs.js, o gate «sem guia
de interface»). Cada módulo abre com um banner /* ===== NOME ===== */ e um
parágrafo do que é (web/app/prazos.js; web/app/calendario.js).

## Números e datas
Dinheiro passa por money (formato.js:money): milhares com espaço fino
(U+202F), vírgula decimal, espaço fino antes do €, sinal de menos
tipográfico. euro arredonda ao euro inteiro; euro2 mostra sempre duas
casas (formato.js:euro, formato.js:euro2); euroS mostra os cêntimos
só quando existem, porque uma renda de 512,74 € aparecia «513 €» num
cartão e «512,74 €» ao lado (formato.js:euroS).

pct(v,d) dá «25,3%» e «—» quando não é número (formato.js:pct); dec
troca o ponto pela vírgula (formato.js:dec). O que se escreve à mão
lê-se com num (formato.js:num), que decide se a vírgula é decimal e
devolve 0, nunca NaN, para as somas não se estragarem. IBAN, NIF, CC e
telefone têm os seus formatadores (formato.js:fmtIBAN,
formato.js:fmtNIF, formato.js:fmtCC, formato.js:fmtPhone).
Ordenar texto é localeCompare com 'pt' (vistas.js:lfSort).

As datas guardam-se e comparam-se como texto AAAA-MM-DD
(formato.js:today; registos.js:isActive; lista-movimentos.js:txMatch). Uma data
local nunca passa pelo toISOString: converte para UTC e, no horário de
verão, meia-noite local vira o dia anterior; um prazo legal deslocado um
dia é um prazo errado (prazos.js:pzIso, prazos.js:pzAddDias; o today() de
formato.js é local pela mesma razão, com teste em
testes/metricas.test.js). Somar meses prende o dia ao último do mês quando
ele não existe (planeados.js:nextDate). O dia de cobrança das prestações
automáticas das hipotecas fica limitado a 28, para cair em todos os meses
(planeados.js:syncLoanRec). Os meses abreviam-se em minúsculas
(formato.js:MES); o nome longo vem do toLocaleDateString('pt-PT') com a
primeira letra posta à mão.

Um CSV sai com a marca de ordem de bytes à frente, para o Excel em Windows ler
os acentos (copias.js:download), e uma célula de texto que comece por =, +,
-, @, uma tabulação ou um retorno leva uma plica à frente, para não ser lida
como fórmula (copias.js:celulaCsv); os números vão tal e qual.

## Toque e acessibilidade
Em ecrã de dedo, nada abaixo do mínimo de toque, e só aí: no rato os
tamanhos compactos continuam certos (estilos.css:@media(pointer:coarse)).
44px os botões, os itens da gaveta e os cabeçalhos das dobras; 40 o
.btn.sm. O toque longo abre as opções do cartão aos 480 ms, com vibração,
e engole o clique que vem a seguir (componentes.js:_lpT e os ouvintes de
pointer que o usam).

Cartões e afins são divs com data-click: tornarFocavel dá-lhes tabindex e
role=button depois de cada render e de cada janela
(vistas.js:tornarFocavel; componentes.js:fillModal), e Enter ou Espaço
ativam-nos (o ouvinte de keydown do arranque, em web/app/arranque.js).
Escape fecha a janela de cima (outro ouvinte de keydown, no mesmo
arranque); o Tab fica dentro dela (o terceiro); a janela de baixo fica
inert e aria-hidden (componentes.js:demote); ao fechar, o foco volta ao
gatilho (componentes.js:closeModal). A janela tem role=dialog e aria-modal
(componentes.js:modalLayer). Todo o botão só de ícone leva aria-label
(componentes.js:menu, componentes.js:tagField, componentes.js:fileBlock,
componentes.js:modalLayer; estilos.css:.burger, index.html:#toTop). O toast
tem role=status e aria-live=polite (index.html:#toast).

O sel() é um listbox: o botão leva aria-haspopup, aria-expanded e
aria-controls, a lista role=listbox, as opções role=option e aria-selected; as
setas, o Home e o End andam pelas opções, e o Escape com a lista aberta fecha
só a lista e devolve o foco ao botão (componentes.js:selTecla). O percurso
mede os alvos num ecrã de toque (testes/ui/invariantes.js, a regra 4): o que
fica abaixo de 40px conta-se por tipo, e o teto só desce.

O foco desenha-se: outline em --accent-soft com o contorno em --accent
(estilos.css:input:focus). O campo com erro aponta para si próprio
(estilos.css:.err) em vez de só um toast longe dele.

-webkit-text-size-adjust:100% no body (estilos.css:body) para o iOS não
inflar o texto em landscape; tap-highlight transparente
(estilos.css:-webkit-tap-highlight-color); user-select:none nos controlos e
nos cartões com toque longo (estilos.css:[data-lp] e a regra a seguir).
Quem pediu menos movimento ao sistema recebe menos movimento
(estilos.css:@media(prefers-reduced-motion:reduce)).

Alturas em unidades de ecrã escrevem-se em vh e logo a seguir em dvh
(estilos.css:.modal, estilos.css:.sheet; testes/estilos.test.js): com as
barras do browser à mostra, vh é maior do que o que se vê e o topo da
folha saía por cima. A área segura entra por --inset-* (estilos.css::root,
estilos.css:.brand, estilos.css:header.top, estilos.css:.wrap,
estilos.css:.fab, estilos.css:.tabbar; tema.js:fitInsets). Os corpos
que rolam levam overscroll-behavior:contain (estilos.css:.fpanel>.card;
estilos.css:.sheet, o .body) e a página tranca por baixo de uma janela ou
da gaveta, repondo a posição ao destrancar (vistas.js:lockPage).

## O que não se faz
Não se dá a uma forma de gráfico o estado premido de um botão. O
tornarFocavel marca-as com role=button para o teclado lá chegar, mas num
SVG um transform não é uma reação — é o desenho a mudar de sítio, e a
origem não é o centro da forma (estilos.css:svg [role="button"]:active).

Não se decora uma vista pegando no HTML que ela acabou de gerar, metendo-o
num nó avulso e mexendo-lhe: pede-se um ponto de extensão à vista, e ela
chama-o enquanto se escreve (lista-movimentos.js:txLinhaExtra e lista-movimentos.js:txMesExtra
são os primeiros; quem os substitui é cloud/selecao.js). Medido com 500
movimentos, o ida-e-volta custava 36 dos 40 ms de cada pintura dos
Movimentos — e, pior do que o tempo: enquanto for assim, nenhuma repintura
parcial é segura, porque uma linha repintada sozinha nasce sem as
decorações e ninguém dá por isso.

Não se escreve uma duração ou uma curva à mão: cita-se o token
(estilos.css:--medio, estilos.css:--curva).

Não se pinta o premido com a cor do :hover: com rato, o ponteiro fica em
cima depois do clique e o toque seguinte deixa de mudar coisa nenhuma
(estilos.css:--press; testes/estilos.test.js varre a folha à procura de
pares iguais).

Não se anima a altura de uma dobra: foi tentado com grid-template-rows
0fr→1fr e a dobra ficou presa aberta (estilos.css:.fold.entra.open>.fold-body,
a nota por cima).

Não se põe uma animação de entrada sem um portão que diga que alguém a
pediu. Um nó novo não é um gesto: a leitura de fundo recria tudo cada vez
que o servidor traz alguma coisa nova (vistas.js:render e a marca .entra;
navegacao.js:cntNovo; componentes.js:toggleFold).

Não se escalona com :nth-child o que tem irmãos que não são da série (as
barras de um SVG têm o eixo pela frente: graficos.js:atrasoEntrada).

Não se usa <select>, confirm(), alert() nem prompt() do browser: destoam e
não vestem o tema (o banner de web/app/componentes.js;
componentes.js:closeModal).

Não se passa uma data local pelo toISOString (prazos.js:pzIso).

Não se escreve uma altura em vh sem o par em dvh (estilos.css:.sheet;
testes/estilos.test.js).

Não se declara color-scheme só «light» (index.html:<meta name="color-scheme">).

Não se escreve um hex fora do :root e da PAL sem um comentário a dizer
porquê (estilos.css:.badge.amber é o exemplo com licença).

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

Não se regista um ouvinte numa MediaQueryList criada de fresco (tema.js:mq).

Não se sobrepõe o aspeto de uma classe semântica com utilitários avulsos: faz-se uma
classe nova (o .section-title com text-transform:none em
lista-contratos.js:vContracts é o exemplo a corrigir).

Não se desenham ícones como caracteres de texto (✕, ✓) nem se colam
emojis: entra-se no ic() (icones.js:ic).

Não se escreve uma função sem comentário com Recebe e Devolve: o gerador
de docs rebenta (scripts/gerar-docs.js).

Não se mostra uma ação que o cargo não permite: pergunta-se pode() antes
(acessos.js:pode; componentes.js:lpMenu), e um colaborador nunca entra em
ownerIds, quotas ou contas entre proprietários (acessos.js:souDono).

Não se escreve um on…= nem um style= no HTML, não se cria uma folha por
JavaScript e não se chama setAttribute('style'): a política não os aplica e não
dá erro nenhum — fica um botão que não responde ou um ecrã despido, e o
servidor não sabe de nada. Os eventos vão nos cinco atributos declarados
(web/app/eventos.js) e os estilos na folha (web/estilos.css); o
testes/csp.test.js varre a app à procura deles.

Não se usa new Function nem eval: a CSP não tem 'unsafe-eval' (worker/src/index.js:CSP,
a que o worker põe na app, igual à do web/_headers),
e o que se constrói assim não corre — a folha do toque longo de uma visita
não abria. Uma ação que tem de ir como texto e como função escreve-se das
duas maneiras, lado a lado (visitas.js:visOpcoes). O mesmo vale de fora para
dentro: um predicado passado em TEXTO ao Playwright — um page.evaluate('…'),
um waitForFunction('…') — é avaliado com eval dentro da página e é recusado na
mesma, ora no arranque ora a meio. As cenas e as esperas do percurso passam
funções (testes/ui/percorrer.js).

Não se põe um valor entre plicas numa ação da app sem jsq (formato.js:jsq):
no data-click="…" e nos quatro irmãos que o eventos.js lê, que levam o mesmo
texto. Quando a ação se escreve com setAttribute, e não dentro de HTML, o
escape é o jsqBruto (formato.js:jsqBruto), sem o esc(): o browser não desfaz
entidades ao ler um atributo posto assim, e um id com & chegava partido à
função. Nem um id, que os de
uma cópia colada ou do registo de outra pessoa vêm de fora; e um id que chega
de fora passa pela forma dos do servidor antes de entrar na base
(dados.js:idSeguro). As páginas do worker não têm ações destas: vivem debaixo
da CSP_ESTRITA, sem ação nenhuma, e o back office passa os valores em
data-arg, pelo esc() (a armadilha do guião do /equipa).

Não se cola texto de quem usa em HTML sem esc(), nem no summary de uma dobra,
que também é HTML (componentes.js:fold).

Não se cria um object URL sem quem o revogue: a descarga revoga a anterior
(web/app/anexos.js:descarregarBlob), a imagem aberta revoga o dela ao fechar,
e as miniaturas têm teto (web/app/anexos.js:guardarMiniatura).

## Dívidas de design conhecidas
O que já está fora destas regras, por ordem de gravidade. Não está
corrigido: cada uma tem o sítio, para quem lhe pegar. Uma dívida que fecha
sai daqui no mesmo commit, e vai para o diário com a data.

Média. Há dois sítios onde a camada da nuvem ainda mexe no HTML da app por
expressão regular ou por procura de texto: o bloco dos planeados no cartão
por confirmar (cloud/painel.js) e a secção dos proprietários na ficha de um
imóvel (cloud/utilizadores.js). A linha das novidades nas definições já não:
a raiz das Definições é uma só, declarada como dados, e a nuvem acrescenta
as linhas dela (definicoes.js:linhaDefinicoes). Cada um deles depende da forma exata do HTML gerado —
uma aspa trocada, um atributo por outra ordem, e a funcionalidade
desaparece sem erro nenhum. O caminho é o mesmo que os Movimentos já
seguiram: um ponto de extensão pedido à vista, em vez de cirurgia por cima
dela.

Média. As cores «Despesas» e «Prestações» dos gráficos estão escritas à mão
('#c56b68' e '#d6a34a', que são PAL_LIGHT[3] e PAL_LIGHT[2]) em vez de
PAL[3] e PAL[2]: painel-geral.js:vDashboard (as duas), projecoes.js:vProjections
(o amarelo, duas vezes), avaliacao.js:portCard (as duas),
avaliacao.js:repCard (as duas, e o amarelo outra vez na dívida) e
creditos.js:amortModal (o amarelo, duas vezes) — onze ocorrências, três
do vermelho e oito do amarelo. No tema escuro a «Receita» sai a
PAL_DARK[0] e as «Despesas» ficam num vermelho pensado para fundo branco;
mudar a PAL nunca altera estes gráficos.

Média. CW.esqueci (entrada.js:esqueci) usa o prompt() nativo do browser
para pedir o email, contra a regra do promptModal
(definicoes.js:promptModal). É o único prompt, confirm ou alert nativo em
web/. No WebView do Android pode devolver null sem aparecer, e a ação
morre em silêncio.

Baixa. O tornarFocavel (vistas.js:tornarFocavel) dá tabindex e role=button a
tudo o que tem uma ação declarada, e nos gráficos isso ainda apanha as fatias do donut
com onPick (graficos.js:cDonut): cada fatia é uma forma de SVG anunciada como
botão, e a mesma categoria é outra paragem do Tab logo a seguir, no item da
legenda (graficos.js:legend), que faz o mesmo. As barras, as linhas e as
barras horizontais já não têm toque próprio (o diário, 2026-09-08). Quem lhe pegar
deixa a fatia fora da ordem de tabulação — o tornarFocavel a saltar o que está
dentro de um <svg>; o dedo e o rato continuam a entrar na categoria por ela —
e fica a legenda como a porta do teclado.

Baixa. No tema escuro, .pos, .neg e .amber, os valores dos KPIs e o
nav a.on recebem hex literais (as regras estilos.css::root.dark logo a
seguir ao bloco das variáveis) iguais a --accent, --danger e --warn desse
:root.dark. A regra de base (estilos.css:.pos) já segue o token; se alguém
mudar --accent no escuro, estes ficam para trás.

Baixa. Três desenhos para «contador pendente»: nav a .cnt, .tabbar a .cnt
e #hdrBell .cnt (estilos.css:nav, estilos.css:.tabbar, estilos.css:#hdrBell),
os dois últimos com corpos quase idênticos (só muda o lado) escritos duas
vezes.

Baixa. Ícones como caracteres de texto: '✕' nos botões de limpar a
pesquisa (lista-movimentos.js:txFilterBody, vistas.js:lfBar) e '✓ ' em
contrato.js:ctBody, entrada.js:showAuth e partilha.js:passwordModal, quando a
casa desenha tudo com ic('x') e ic('check'). O X da janela
(componentes.js:modalLayer), o burger e o «topo» (estilos.css:.burger,
index.html:#toTop) trazem SVG escrito à mão em vez de ic().

Baixa. Emojis na interface: um hint com 👍 em partilha.js:cartaoDaAppNoTelemovel e o
tubo de ensaio no seletor de contas de teste (entrada.js:cwTrocaConta, só
em dev).

Baixa. O cabeçalho de cada imóvel em Contratos e o de cada mês em
Movimentos usam .section-title com um utilitário de text-transform por cima
(lista-contratos.js:vContracts, lista-movimentos.js:vTransactions): uma classe semântica com
dois aspetos. Merece uma classe própria em web/estilos.css.

Baixa. Os botões de apagar do fileBlock fixam min-width e min-height de
40px por utilitários (componentes.js:fileBlock), repetindo em todos os ecrãs o
que estilos.css:@media(pointer:coarse) já dá só no toque.

Baixa. O dia de pagamento dos contratos aceita 1 a 31
(contrato.js:collectCt; planeados.js:syncContractRec) enquanto as
prestações automáticas das hipotecas ficam em 28
(planeados.js:syncLoanRec). Não é bug, porque o nextDate prende ao último
dia do mês, mas são duas regras para o mesmo conceito e nenhum hint diz
que o dia «flutua» (contrato.js:ctBody, os campos «Renda entre o dia» e «e
o dia»).
