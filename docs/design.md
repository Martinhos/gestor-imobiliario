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
- A Visão geral
- A jornada da vista geral
- Um gráfico lê-se com o dedo
- Uma tabela só quando diz o que o gráfico não diz
- Uma comparação diz de que números fala
- Um número que chega a contar
- O que a app diz sobre o que guardou
- Uma porta, e nenhum beco
- Um aviso não tapa o que se pede para carregar
- Tocar num registo é lê-lo
- As tarefas de um imóvel ou de um contrato
- Um contrato tem três estados
- A Avaliação e as Projeções
- A Declaração resume, não declara
- As regras do IRS têm uma versão por ano
- O que o contrato diz ao IRS para lá das datas
- A Declaração sabe a tua situação
- Segurar não é selecionar
- Entrar na seleção é como nas Casas
- A fita da barra de baixo
- A renda planeada e as rendas já lançadas
- Os Contratos
- As Pessoas e as Visitas
- Os Movimentos
- Os Planeados, os Créditos e a Agenda
- As datas leem-se como se escrevem em Portugal
- Um modal está acima de toda a navegação
- O hambúrguer só existe onde há gaveta
- Um portão por cima de tudo não mostra avisos
- O service worker e a versão
- A app não afirma nem decide antes de saber
- A sincronização: o que é daqui e o que é do servidor
- As Definições
- Grupos partilhados
- Os colaboradores
- Os formulários dizem o que é obrigatório, o que é opcional e dão exemplos
- Um movimento de vários imóveis parte-se por imóvel
- O capital em dívida deriva-se
- Navegação
- Fora da app: a montra, os emails e o back office
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
comentário ao lado a dizer porquê. A paleta é a do canvas de 2026-10 (o
Claude Design «Rendorium — app»): fundo frio, cartões brancos com contorno,
cobalto para a ação, azul-noite na barra lateral. Claro → escuro, e o papel
de cada uma:

--bg #f2f3f6 → #0b111e é o fundo da página. --card #ffffff → #141c2c é o
cartão, a janela e a barra de baixo; --field, igual, os campos. --chip
#f6f7f9 → #1a2335 é a superfície 2: os selos cinzentos, o hover das opções
dos menus e o trilho do segmentado; --tint, igual, o hover dos cartões
tocáveis. --press #e9ecf2 → #253049 é o premido (nunca igual ao hover).
--ink #121826 → #e9edf5 é o texto; --muted #4f586b → #aeb7c9 o secundário
(rótulos, hints, .small); --faint #687083 → #8c96ab (estilos.css:--faint) o
terciário: os placeholders, as setas que dizem «abre», os rótulos inativos
da barra de baixo. --line #e2e5eb → #253049 são os contornos e --line2
#cdd2db → #33405c o contorno dos controlos (botões, campos, chips).

--accent #2952d9 → #7c9bff é o cobalto da AÇÃO: o botão primário
(estilos.css:.btn.primary), o ativo da barra de baixo, o chip ligado, o
foco, as ligações. Já não é o positivo: o dinheiro tem as suas cores.
--accent-ink #ffffff → #0b111e é o texto sobre ele; --accent-soft #e9eefc
→ #1e2a4d o fundo suave (o chip ligado, o selo «por
confirmar», os ícones das dobras); --accent-text #1d3fb0 → #b5c6ff
(estilos.css:--accent-text) o cobalto de texto sobre o suave;
--accent-press e --accent-fundo o premido e o carregado do primário.

O dinheiro tem três cores, que diferem também em luminosidade e não só em
tom (quem não distingue o verde do laranja distingue o claro do escuro):
--in #16775a → #4cc79a é o que entra — a receita, o positivo, o «em
vigor», o «em dia» (estilos.css:--in); --out #bd420c → #ff9a62 é o que sai
— a despesa e todo o dinheiro negativo (estilos.css:--out); --loan #6845c2
→ #b49bff é a prestação, o crédito e o automático (estilos.css:--loan); cada
uma com o seu -soft para os fundos. --warn #8f5600 → #f2c25a é o aviso (o
prazo breve, o vago) e --danger #b42318 → #ff8a80 o PERIGO — o atraso, o
erro, o que destrói —, com --danger-ink e --danger-press para o botão
vermelho cheio. O vermelho deixou de ser o negativo: uma despesa a vermelho
lia-se como um erro.

--side #0e1830 → #070c17 é a barra lateral azul-noite (estilos.css:aside),
com --side-ink (o ativo, branco), --side-text (os itens), --side-muted (os
títulos dos grupos), --side-hover, --side-on e --side-line só para ela;
--cnt e --cnt-ink são o crachá quente da barra. --marca (estilos.css:--marca)
é o cobalto da marca, igual nos dois temas. --toast, --toast-ink e
--toast-btn são o aviso de baixo (estilos.css:--toast), escuro no claro e
claro no escuro, para se destacar do fundo nos dois. --veu (estilos.css:--veu)
é o véu da gaveta e das janelas. --blur é o fundo translúcido do cabeçalho e
da barra de baixo (estilos.css:header.top, estilos.css:.tabbar) — vidro com
blur(12px) saturate(140%), a saturação para as cores de baixo atravessarem
vivas, e o prefixo -webkit- porque o iOS antigo só lê esse. A risca de baixo
do cabeçalho nasce transparente e só se acende com a página rolada
(estilos.css:body.rolada, posta pelo ouvinte de scroll do toTop em
componentes.js). --shadow (0 16px 40px rgba(16,24,40,.16) → 0 24px 60px
rgba(0,0,0,.6)) é a sombra dos menus e das janelas. --track, --rail 264px e
os --inset-* da área segura fecham a lista.

As semânticas são classes: .pos (verde), .neg (laranja, o dinheiro que sai),
.amber (aviso), .perigo (vermelho: «em atraso», «faltam N €») e .prest
(roxo) (estilos.css:.pos, estilos.css:.perigo). Os selos são .badge e as
variantes .grey, .amber, .red, .in, .out e .loan (estilos.css:.badge): os
pares passam 4,5:1 a 12px nos dois temas (medido na prova da fundação), e
os hex com licença que o .badge.amber e o .badge.red tinham saíram. Os
exemplos de hex fora dos tokens com licença são hoje a marca (o branco da
casa, estilos.css:.marca), o véu da janela de baixo
(estilos.css:.modal.under), o verde e o laranja do escuro nas setas do
Cashflow da Visão geral, que é azul-noite nos dois temas
(estilos.css:.vg-kpi.cf), e as cores do mosaico das capas no claro.

Uma capa sem fotografia leva o mosaico do canvas — arcos em cantos opostos e
um ponto, num quadrado de 28px — numa de quatro cores, cobalto, âmbar, verde
e ardósia, escolhida pelo imóvel de forma estável: um FNV-1a do id, pelos
bits de cima (lista-imoveis.js:imvMosaico; estilos.css:.imv-mosaico e as
variantes estilos.css:.imv-t1 a .imv-t3). Os hex do claro são os do canvas e
vivem só aí, com comentário; no escuro saem dos tokens suaves e de cor. A
etiqueta por cima de uma fotografia («3 fotos», «capa») é escura nos dois
temas, porque assenta numa imagem e não no fundo do tema
(estilos.css:.imv-nfotos).

Os gráficos têm paleta própria. PAL_LIGHT e PAL_DARK (tema.js:PAL_LIGHT,
tema.js:PAL_DARK) são a paleta CATEGÓRICA — as sete cores do canvas
(cobalto, laranja, verde, roxo, mostarda, petróleo, ardósia) e mais cinco
com a mesma luminosidade —, trocadas dentro do próprio array PAL pelo
applyTheme (tema.js:applyTheme), para quem guardou referência ver as cores
novas. As séries com PAPEL vêm de tema.js:COR_SERIE (receita, despesa,
prestacao, divida, cashflow), trocado da mesma maneira: um gráfico nunca
escreve a cor de uma série à mão. A cor da barra do sistema é #0e1830 no
claro e #0b111e no escuro (index.html:#metaTheme, escrito no mesmo
applyTheme), e o manifesto diz o mesmo.

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

O Samsung Internet, com o telemóvel em escuro, responde
prefers-color-scheme:light e escurece a página à força (o «modo escuro»
dele), sem olhar ao color-scheme — nem ao «only light». Com o tema em
Automático a app pinta o claro e o browser inverte-lhe a luz: os fundos
claros passam a escuros, e duas superfícies que só diferem na luz (um realce
branco sobre uma pista quase branca) caem em dois pretos iguais. O que
sobrevive a esse filtro é a cor da frente: o texto e as bordas mudam de luz
mas ficam do lado contrário ao fundo. Por isso um estado (a escolha acesa)
diz-se com uma borda ou um contorno no --accent, e não só com um fundo de
outra luz; e uma sombra por dentro (inset) não serve, porque o filtro não
lhe toca (estilos.css, a secção ajustes-v40d 1.1). A app não sabe se o
browser a está a escurecer — o getComputedStyle continua a dizer as cores
claras, porque o filtro é da pintura.

Na linha do Tema das Definições, só no Samsung Internet (o UA tem
«SamsungBrowser») e só com o tema em Automático, uma nota diz onde se muda:
Samsung Internet → Definições → Labs → Usar o tema escuro do site, e aí o
Automático passa a seguir o telemóvel; ou o Escuro da app
(definicoes.js:linhaDoTema, definicoes.js:notaDoSamsung,
definicoes.js:eSamsungInternet). A nota liga-se ao segmentado por
aria-describedby.

A prova do escurecimento forçado corre no Chromium com
`--blink-settings=forceDarkModeEnabled=true` (o
`--enable-features=WebContentsForceDark` sozinho não faz nada no headless
shell, que não tem a camada do Chrome que o passa ao Blink), e o contraste
mede-se nos pixeis da captura (.unlazy/ajustes-v40d/prova-contraste.mjs).

## Tipografia
Duas letras, auto-alojadas em web/fonts/ (a CSP só deixa font-src 'self'): a
Geist no texto e a Bricolage Grotesque nos títulos e nos valores grandes,
variáveis (um ficheiro dá todos os pesos; a Bricolage traz também o eixo
ótico, que a abre nos tamanhos grandes), só com o latino — o português cabe
todo nele, com o espaço fino U+202F do dinheiro e o − tipográfico; o resto
cai na letra do sistema pelo unicode-range. As licenças (OFL) vivem ao lado.
Declaram-se com @font-face e font-display:swap (o texto aparece logo na
letra do sistema e troca quando a nossa chega: nunca há texto invisível),
pedem-se já no index.html (index.html:<link rel="preload">) e guardam-se na
concha do service worker (sw.js:SHELL), para a app abrir offline com a sua
cara. As pilhas são tokens: --letra e --letra-titulo (estilos.css:--letra,
estilos.css:--letra-titulo), com o sistema a seguir à nossa. As páginas que o
worker escreve declaram as mesmas duas (ver «Fora da app»).

O corpo é Geist a 15px com entrelinha de 1.45 e antialiasing em tons de
cinzento (estilos.css:body). h1, h2, h3 e a classe .disp são Bricolage a 650
e −0.015em (estilos.css:.disp): o título da página tem 32px no computador e
22 no telemóvel (estilos.css:header.top), o título da janela 20
(estilos.css:.sheet, o .head h2), o valor do KPI 28 e 21 no telemóvel
(estilos.css:.kpi, o .value). Os números alinham em tabular-nums nos
valores, nas tabelas e nas estatísticas (estilos.css:.value, a regra
partilhada com .table td, .stat b e .num), para as colunas não dançarem.

O resto da escala: o rótulo do campo é tinta a 14px e 600, por cima do
campo (estilos.css:label); o campo 15 (estilos.css:input); .small e .hint 13
em muted (estilos.css:.small, estilos.css:.hint); o .section-title e o .lbl
12px a 600, maiúsculas por CSS e .06em (estilos.css:.section-title); o
rótulo do KPI 13.5 a 600, sem maiúsculas, com a bolinha da cor ao lado; o
cabeçalho da tabela 12 a 600, sem maiúsculas (estilos.css:.table); o selo
12 a 600 (estilos.css:.badge); o botão 15 a 600 e o .btn.sm 14
(estilos.css:.btn, estilos.css:.btn.sm); o toast 14.5 (estilos.css:.toast);
a barra de baixo 11.5 a 600 (estilos.css:.tabbar, o a); os títulos dos grupos
da barra lateral 11.5 em maiúsculas (estilos.css:.navsec-tit).

Os pesos têm papel: 400 o que se escreve, 500 os itens, 600 os botões, os
rótulos e os títulos de lista, 650 os títulos e os valores na Bricolage, 700
o que tem de saltar (crachás, iniciais). Maiúsculas só por CSS (rótulos de
secção, títulos dos grupos), nunca escritas no texto.

## Espaçamento, raios e sombras
A página tem 24px em cima e clamp(16px,3vw,36px) aos lados, com 1240px de
largura máxima (estilos.css:.wrap), e o cabeçalho tem os mesmos lados; no
telemóvel 4 e 16 (a mesma .wrap dentro de estilos.css:@media(max-width:900px)),
porque o cabeçalho já dá o ar de cima.
O cartão tem 18px de enchimento, e 14 abaixo de 520px (estilos.css:.card).

Grelhas: estilos.css:.grid com gap 14 (10 no telemóvel) e colunas de 158px
para os KPIs; estilos.css:.cols com gap 14 e colunas de 290px para os
cartões de gráfico; estilos.css:.list com gap 11; estilos.css:.form com gap
13; estilos.css:.row e estilos.css:.row3 com gap 11, que empilham abaixo de
520px, salvo o intervalo De/Até, que se lê lado a lado
(estilos.css:.row.lado-a-lado), e o Início e o Fim da visita, em duas
colunas iguais que enchem a linha (estilos.css:.vis-par). A
estilos.css:.toolbar tem gap 10. O
estilos.css:.section-title leva 24px por cima e 10 por baixo. Um estado vazio
não se cola aos KPIs que o antecedem (estilos.css:.grid+.empty).

Os raios seguem a hierarquia da peça: 20px a janela (estilos.css:.sheet; 20
20 0 0 na folha de baixo, com a pega de 36×4 ao cimo — a mesma .sheet dentro
de estilos.css:@media(max-width:520px)), 16 o cartão, a secção de um
formulário (estilos.css:.sect) e o + da barra de baixo (estilos.css:.tabmais),
14 o vazio, a dobra, o addbox, os menus e o toast (estilos.css:.empty,
estilos.css:.fold-head, estilos.css:.addbox, estilos.css:.selpop,
estilos.css:.menupop, estilos.css:.toast), 12 os botões, os campos e as
opções .opt (estilos.css:.btn, estilos.css:input, estilos.css:.opt), o trilho
do segmentado (estilos.css:.segm) e os dias do calendário, sem contorno
(estilos.css:.calday), 10 o .btn.sm, as opções dos menus e os itens da barra
lateral (estilos.css:.btn.sm, estilos.css:.selopt, estilos.css:nav), 9 a
opção do segmentado, 6 o selo — retangular, deixou de ser pílula
(estilos.css:.badge) —, 999 os chips, as etiquetas e os crachás, e redondo o
avatar (estilos.css:.avatar).

Só flutua o que sobe: --shadow nos menus e na janela (estilos.css:.selpop,
estilos.css:.menupop, estilos.css:.sheet); 0 10px 30px no toast; 0 4px 12px
no + da barra de baixo, na cor de destaque do tema translúcida (um color-mix
com o --accent, e não o cobalto do claro escrito à mão), que encolhe ao
carregar (estilos.css:.tabmais); 8px 0 32px na gaveta aberta do telemóvel
(estilos.css:aside); 0 16px 38px .30 no painel de filtros
(estilos.css:.fpanel>.card); a barra pegajosa deixa uma sombra só por baixo
(estilos.css:.toolbar.stick). Os cartões não têm sombra, têm contorno
(estilos.css:.card), e o que se toca não se marca com uma borda colorida à
esquerda: o risco do .card.tap saiu com a linguagem de 2026-10.

As camadas (z-index): 15 o menu de escolha (estilos.css:.selpop), 20 o
cabeçalho (estilos.css:header.top), 25 a barra pegajosa
(estilos.css:.toolbar.stick), 30 o menu de ações (estilos.css:.menupop), 40
a barra de baixo (estilos.css:.tabbar), 45 e 46 o painel de filtros
(estilos.css:.fpanel, estilos.css:.fwrap), 57 o «topo» (estilos.css:.totop),
58 o FAB, que já não se vê (estilos.css:.fab), 59 o cartão do tutorial
(cloud/guia.js:#cwGuia), 61 o véu da gaveta (estilos.css:.scrim), 62
a gaveta (estilos.css:aside), 70 a janela (estilos.css:.modal), 71 o mesmo
cartão do tutorial quando há uma janela aberta
(cloud/guia.js:.sobre-janela), 90 o toast (estilos.css:.toast), 95 a dica dos
gráficos (estilos.css:.tip). Acima de tudo vivem os portões de ecrã inteiro
(ver «Um portão por cima de tudo não mostra avisos»): 195 o aviso prático
(cloud/ajuda.js:#cwLegal), 196 os termos novos (cloud/ajuda.js:#cwTerms), 197
a janela que se abre por cima deles (estilos.css:.modal.sobre-portao), 200 a
entrada (cloud/entrada.js:#cwAuth), 210 um documento legal aberto
(cloud/ajuda.js:#cwDoc), 230 a reposição da palavra-passe
(cloud/entrada.js:#cwRepor), 235 a versão velha demais
(novidades.js:gateAtualizar) e 240 o progresso da atualização
(cloud/novidades.js:#cwUpd2).

A janela está acima da navegação de propósito, e é a partir dela que se
escolhe um número novo: o que tiver de aparecer por cima de uma janela aberta
fica acima de 70, e o resto abaixo. Esta lista é o sítio onde se vai buscar
esse número — quando ela mente, o erro sai daqui. Foi o que aconteceu ao
cartão do tutorial: o 61 dele foi escolhido contra um 60 que já não era
verdade.

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
redesenhar a grelha), as secções da gaveta e o cartão «Por confirmar» da
Agenda, que dobram num nó vivo, e tudo o que reage ao dedo, que é reação e
não entrada.

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

Fechar uma janela troca-lhe o .open pelo .sai e tira o nó no fim da saída
(componentes.js:fecharComSaida); largada por um arrasto, a saída parte de
onde o dedo a deixou (componentes.js:folhaFecha).

Quando alguma coisa sai de UMA LISTA, a saída é metade do
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
embrulhos que acrescentam as caixas da seleção — medir antes deles seria
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

O realce de passar por cima só existe com rato: todo o :hover vive num
estilos.css:@media(hover:hover) and (pointer:fine) — os botões, os cartões
tocáveis, as opções dos menus e dos seletores, os chips, as etiquetas, os
itens da barra lateral e da barra de baixo, os dias do calendário
(estilos.css:.calday), a barra azul-noite da seleção. Fora dele, no dedo, o
:hover fica preso depois do toque e o botão fica mais claro até se tocar
noutro sítio; e o (pointer:fine) é preciso porque há Galaxy com caneta que
respondem (hover:hover) num ecrã de dedo (testes/estilos.test.js chumba um
:hover fora desse portão, e um @media(hover:hover) sem o (pointer:fine)).

O toque não deixa foco. Um click do dedo ou da caneta num elemento com
data-click (eventos.js:clickDoToque — o pointerType do click, ou o do último
pointerdown quando o click não o traz e tem detail > 0) larga o foco que
ficou nesse elemento ou dentro dele (eventos.js:largarFocoDoToque): antes de
a ação correr, e outra vez depois se a ação lho devolveu. Antes, para o
openModal não guardar o elemento tocado como gatilho (o closeModal devolvia-
-lhe o foco) e para quem repinta e devolve o foco ao nó novo
(vistas.js:lfFocarFunil, vistas.js:lfClear) já não o encontrar no dedo.
Dentro de uma janela o foco largado vai para o .sheet dela (como o
componentes.js:focarModal), sem rolar; fora, sai. Ficam como estavam o
teclado (Enter e Espaço dão um click sem ponteiro e com detail 0), o rato, o
anel :focus-visible, os campos (input, textarea, select, contenteditable) e
o foco que a ação mandou para outro sítio.

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


Um segmentado do formulário que muda o que o formulário mostra — o destino do
imóvel e o tipo de arrendamento — desliza o realce de uma escolha para a
outra, e o grupo onde os campos aparecem e somem cresce ou encolhe até à
altura nova (imovel.js:imvSegmentado, imovel.js:imvSegDeslizar,
imovel.js:repaintPropCrescendo). O realce é uma peça à parte, por baixo dos
botões (estilos.css:.segm-polegar), posta na escolha por classe; a repintura
troca o segmentado por um novo, e a peça parte do sítio velho por transform,
no --medio e na --curva-fita, porque atravessa em bloco. A altura é a do
continuidade.js:crescerEmAltura, no mesmo --medio, para o realce e o grupo
assentarem juntos. O fundo trocado de um botão para o outro e o formulário a
saltar de tamanho eram dois saltos no mesmo toque. Sem movimento, as duas
coisas mudam logo.

A caixa que cresce não mexe o que fica. Durante a viagem leva a classe
estilos.css:.a-crescer, que encosta as linhas ao topo: a encolher, a caixa é
maior do que o que já leva dentro, e numa grelha (o .sect) a altura a mais
repartia-se pelas linhas — o nome, a morada e o segmentado afastavam-se até
280px e voltavam. O scroll de quem rola (continuidade.js:quemRola)
guarda-se antes de pintar e repõe-se depois de a animação começar: pintar
com o conteúdo já curto prende o scroll ao fundo novo, e o conteúdo saltava;
daí em diante encolhe com a caixa. As peças com chave (data-parte;
continuidade.js:partesDe) acompanham a caixa no mesmo tempo e na mesma curva
(continuidade.js:acompanharPartes): a que ficou e mudou de sítio dentro da
peça que a contém parte do sítio velho por transform; a que chegou desvanece
a entrar (só a de fora); a que saiu é o próprio nó antigo, sem ids, inerte e
surdo ao toque, posto de volta DENTRO da caixa (estilos.css:.tem-saidas) a
desvanecer no --rapido e na --curva-sai — a caixa recorta-o enquanto
encolhe, e some antes de as de baixo lhe chegarem. Não vai para a camada de
saída das listas (continuidade.js:camadaDeSaida), que está por baixo das
janelas.

Uma chave, um dono, também aqui: o data-fk é da continuidade das listas, o
data-lp do toque longo, e o data-parte só da caixa que cresce. No formulário
do imóvel têm chave o nome, a morada, cada segmentado, os quartos, cada
quarto e o «Adicionar quarto» (imovel.js:propBody, imovel.js:imvSegmentado).
Tocar outra vez a meio da viagem continua de onde ia: as alturas e as
posições medem-se como estão renderizadas. O foco não se perde na
repintura: se estava no segmentado (o Enter de quem anda de Tab, ou o toque
que deu o foco ao botão), volta à escolha nova, sem rolar o corpo
(imovel.js:imvSegTemFoco, imovel.js:imvSegFocar). No computador a janela do
formulário do imóvel fica na altura máxima e só o corpo muda: centrada, uma
janela que mudasse de altura mexeria as duas bordas.

O cartão «Por confirmar» da Agenda dobra como as secções da gaveta: o corpo
está sempre no HTML, e abrir e fechar é trocar a classe .fechado num nó vivo
(calendario.js:calPendAlternar). A altura anda por uma transição de
grid-template-rows de 1fr a 0fr com os dois valores escritos
(estilos.css:.cal-pend-corpo), o conteúdo desvanece com ela, e um segundo
toque a meio retoma do sítio onde ia, porque é uma transição e não
keyframes. O visibility tira as linhas do Tab e do leitor de ecrã no FIM do
fecho e põe-nas logo no início da abertura. O corte (overflow:hidden) só
existe fechado e durante a viagem (.viagem, que sai no transitionend do
grid-template-rows, com a rede de um setTimeout): aberto e parado, os menus
⋯ das linhas abrem para fora do cartão. No FIM da abertura, se o cartão
ficou abaixo da barra de baixo, a página rola o que falta
(calendario.js:calPendMostrar), sem nunca levar o cartão para cima de 12px
por baixo do cabeçalho pegajoso; no princípio não pode, porque a página
ainda não tem a altura nova e o scroll parava no fundo de antes. As duas
direções vão na --curva-entra e no --medio — também a que fecha, ao
contrário da regra da --curva-sai acima; a questão está em aberto no
docs/decisoes.md (2026-10-20). Sem movimento, a regra geral desliga a
transição e o scroll é de uma vez.

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
{danger:true} pinta a opção de vermelho, e só o que destrói a leva. O que
não destrói não leva vermelho — nem um .btn.danger nem uma opção danger no
⋯: «Recusar desta vez» um planeado não apaga nada, e vive no ⋯ das linhas
dos por confirmar, como as outras (planeados.js:pendMenuItens); e «Recusar»
um pedido — de partilha, para entrar num grupo, um convite de ligação — é o
botão secundário ao lado do Aceitar primário, porque quem pediu pode voltar
a pedir (partilha.js:linhasDosPedidos). As linhas das listas não têm ⋮:
tocar abre a ficha, onde as opções vivem no ⋯ da janela e no «Editar» do
rodapé, e o toque longo (data-lp) entra na seleção de vários — também nos
inquilinos e nas visitas; nos proprietários não faz nada (ver «Padrões de
página»). A lista de ações do tipo de registo, que é uma só, é a folha que o
componentes.js:lpMenu abre (o kebab, e o toque longo onde a nuvem não corre).
O que destrói (Apagar, Remover, Eliminar, Terminar) fica vermelho também nela
(componentes.js:lpShow). Todos os menus fecham ao clique fora
(componentes.js:closePops, chamada pelo ouvinte de click do arranque, em
web/app/arranque.js). Um ⋯ aberto (estilos.css:.menupop) fecha também
quando a página, ou a caixa onde ele está, rola: ficava pendurado onde o
botão estava, com o botão já noutro sítio. É o ouvinte de scroll do
arranque, na captura, porque o scroll de uma caixa (o corpo de uma janela, o
painel dos filtros) não sobe; ignora o scroll de dentro do próprio menu, que
um menu encolhido pelo ajustarPop pode ter. As listas dos seletores que
flutuam nos filtros não fecham: acompanham o scroll (cloud/filtros.js).

O botão que abre um ⋯ diz `aria-expanded`: false no HTML do
componentes.js:menu, true ao abrir (componentes.js:menuOpen) e false ao
fechar, seja pelo clique fora (componentes.js:closePops), seja pelo scroll
do arranque — os dois pelo componentes.js:menuExpandido. O Escape com um ⋯
aberto fecha o menu e devolve o foco ao botão que o abriu; a janela por
baixo fica (componentes.js:menuEscape, chamado pelo componentes.js:selTecla
quando a tecla não é de uma lista de um sel() aberta — a lista de dentro
fecha primeiro). Vale para os botões feitos à mão que chamam o menuOpen no
mesmo .menuwrap (o botão de partilha da Avaliação): o botão encontra-se pelo
`data-click^="menuOpen("` (componentes.js:menuBotao), e nasce com
aria-expanded="false" como o do menu.

pode(pid,perm) antes de mostrar uma ação (acessos.js:pode). Num imóvel onde
o utilizador só colabora, o cargo diz o que se vê e o que se adiciona; o
servidor já despe os dados e recusa as escritas, mas um botão que leva a
uma recusa é um botão a mais. Por isso cada ação pergunta primeiro: a folha
das opções filtra-as (componentes.js:lpMenu), os FABs, a
folha do + da barra de baixo e os seletores de imóvel dos formulários só
listam onde se pode adicionar (acessos.js:casasComo,
acessos.js:acoesDeAdicionar, acessos.js:propOptsPara; movimento.js:txBody), a
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
Escape, voltar, arrastar a folha para baixo) com alterações por guardar pergunta «Sair sem guardar?»
(componentes.js:closeModal); Guardar e Cancelar fecham sem perguntar,
porque são decisões e não acidentes. A exceção é a janela das tarefas, onde o
Cancelar encosta ao Guardar e deitava fora uma tarde de tarefas: com
alterações, pergunta (tarefas.js:tfFechar). Só conta como mexido o que vier de um
dedo ou de um teclado a sério (o isTrusted em componentes.js:openModal): a
renda sugerida não é trabalho de ninguém. A pergunta veste o tema da app,
nunca o confirm() do browser (a nota dentro do closeModal). Sair de um
formulário para outro ecrã por uma ligação dentro dele também é abandono, e
passa pela mesma pergunta quando há alterações: o componentes.js:closeAllModals
fecha tudo sem perguntar, e por isso não é o caminho dessas ligações — o
«Gerir» dos colaboradores no formulário do imóvel conta o «mexido» como o
closeModal e só depois sai (cloud/utilizadores.js:cwGerirColaboradores,
cloud/utilizadores.js:cwSairParaColaboradores). Abaixo de
520px a janela é uma folha encostada em baixo (estilos.css:.sheet dentro
de estilos.css:@media(max-width:520px)), que se arrasta para baixo para
fechar.

A barra por cima do cabeçalho (estilos.css:.sheet::before) promete o gesto
que o sistema ensina: puxar para baixo fecha. A janela de cima da pilha
arrasta-se com o dedo ou a caneta (componentes.js:folhaPousar,
componentes.js:folhaArrastoMove, componentes.js:folhaArrastoFim); o rato não
arrasta (componentes.js:AVISO_PONTEIROS, os mesmos do aviso), e acima dos
520px nada muda — a condição é a do CSS, lida pelo matchMedia
(componentes.js:folhaComBarra). Agarra-se pelo cabeçalho (o .head e a
barra) sempre; pelo corpo só com ele no topo do scroll e o gesto a começar
para baixo — a subir, ou com o corpo (ou uma caixa dentro dele) já rolado, é
o scroll de sempre (componentes.js:folhaZona). O rodapé não agarra: é onde
estão Guardar e Cancelar. Nunca arranca de um campo, de um cartão com toque
longo, de quem tem o seu próprio gesto (o data-pointerdown das fotos, do
calendário e do puxador; a leitura dos gráficos; o .pago-por; um slider; as
listas abertas do sel() e do ⋯) nem do que rola de lado
(componentes.js:FOLHA_NAO_ARRANCA, navegacao.js:sepRolaDeLado). O eixo
decide-se aos 10px, como no aviso e nos separadores. A .modal só ouve o
touchmove com passive:false quando o corpo pode agarrar a folha — com a barra
e o corpo no topo do scroll (componentes.js:folhaOuvirToque, reavaliado a cada
scroll do corpo) — e trava-o enquanto o gesto é dela, senão o browser tomava o
gesto e mandava um pointercancel a meio (componentes.js:folhaToqueMove). No
resto do tempo os toques na janela não esperam pela thread principal. O
cabeçalho tem touch-action:none, e a folha touch-action:pinch-zoom: a barra, o
espaço à volta dela e o rodapé não rolam; o corpo rola como sempre, porque o
touch-action recomeça em cada caixa que rola.

O teclado do telemóvel: um campo só se mexe quando o teclado (ou a borda do
corpo da janela) o tapa, medido pela janela visível
(componentes.js:kbAreaVisivel, visualViewport), e de uma vez, sem scroll suave
por baixo do dedo (componentes.js:campoAVista) — um campo à vista fica onde
está, e o toque longo para selecionar texto não o vê fugir. Espera-se o
teclado assentar: o último resize da janela visível, ou 300ms sem resize
(componentes.js:campoAVistaQuandoAssentar, chamado pelo focusin do
arranque.js). A folga do teclado (.sheet.kb, 300px no fundo do corpo) só entra
quando o corpo não tem para onde rolar sem ela, e sai no focusout.

A folha segue o dedo e o véu aclara à proporção (componentes.js:folhaVeu);
para cima resiste (componentes.js:folhaElastico, nunca mais de 24px, com uma
sombra da cor do cartão para o fundo não descolar do ecrã). Largar passada
metade da altura, ou com um sacudir para baixo, fecha — a regra do aviso
(componentes.js:avisoFechaAoLargar). Fecha pelo closeModal('arrasto')
(componentes.js:folhaFecha): num formulário mexido pergunta «Sair sem
guardar?», e quem fica tem a folha de volta ao sítio. A saída é a de sempre
(estilos.css:folhaDesce), a partir do transform que o dedo deixou, com a
--curva (a .arrastada). Largar antes volta ao sítio
(componentes.js:folhaVoltaAoSitio: --medio, --curva-entra); um dedo que pega
na folha a meio do regresso apanha-a onde ela está, e uma janela nova por
cima a meio do gesto acaba-o. Sem movimento (continuidade.js:semMovimento)
não segue o dedo: desvanece (.sheet.pronto) quando largar já fecha, e fecha
sem animar.

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

O aviso com botão afasta-se com o dedo (componentes.js:avisoPousar,
componentes.js:avisoArrastoMove, componentes.js:avisoArrastoFim). O cartão do
«Anular» tapa o fundo do ecrã seis segundos, e às vezes é o que está por trás
dele que se quer ver. Puxa-se para baixo: só o eixo vertical, a decidir aos
10px e sem salto (a folga não conta); para cima resiste
(componentes.js:avisoElastico, a curva do sepElastico, nunca mais de metade
da altura). Largar passada metade da altura dele, ou com um sacudir para
baixo (componentes.js:AVISO_SACODIR, 0,4px/ms, a velocidade dos últimos
instantes pelo e.timeStamp — componentes.js:avisoHora; parado mais de 100ms
antes de largar já não é sacudir), fecha-o a sair pelo fundo a partir de
onde o dedo o deixou (componentes.js:avisoSaiPorBaixo: --medio, --curva — o
largar continua a velocidade do dedo, por isso não é a --curva-sai). Largar
antes volta ao sítio (componentes.js:avisoVoltaAoSitio: --medio,
--curva-entra). Fechar o cartão não desfaz nem antecipa nada: o apagado
continua apagado e o aoExpirar corre aos 6400ms de sempre.

O prazo espera pelo dedo. Com o dedo pousado no aviso, o temporizador dele
para e o do comDesfazer também (o op.segura do toast): o «Anular» nunca fica
à vista depois de o que não volta ter sido liquidado. Devolvido ao sítio, o
aviso retoma o que faltava, com um mínimo de 1,5s para se ler
(componentes.js:AVISO_RETOMA_MS), e o prazo do desfazer anda o mesmo tanto
(continua a 400ms do fim do aviso). Afastado, o prazo é o de sempre; se o
dedo o segurou para lá dele, liquida ao largar.

O clique que o browser dispara a seguir a um arrasto não carrega no «Anular»
(componentes.js:toast, o _avisoEngole, 350ms como o sepEngolirToque). Só o
dedo e a caneta arrastam (componentes.js:AVISO_PONTEIROS): com o rato,
arrastar é selecionar texto, e no computador o aviso não tapa o que tapa num
telemóvel. Um aviso novo a meio de um arrasto ganha
(componentes.js:avisoInterromper): o arrasto acaba ali, o anterior deixa de
esperar pelo dedo, e o novo volta ao sítio pela transição do .on. Apanhado a
meio do regresso, o aviso segue o dedo a partir de onde a animação o tinha.
Sem movimento (prefers-reduced-motion, continuidade.js:semMovimento) não
segue o dedo: desvanece (estilos.css:.toast.arrastar.pronto) quando largar
já fecha, e fecha sem animar. O CSS: estilos.css:.toast.arrasta
(touch-action:none, sem seleção de texto) e estilos.css:.toast.arrastar (o
transform sem transição durante o arrasto).

toast(m,op) (componentes.js:toast) é para o que aconteceu: 2,8 segundos,
frase curta com ponto final. Tem role=status e aria-live
(index.html:#toast).

falhaCampo(id,msg) (componentes.js:falhaCampo) é para o que falta num
formulário: o campo aponta (estilos.css:.err) e diz o que fazer numa frase
por baixo dele (estilos.css:.erro-campo, com aria-describedby), vai ao ecrã,
recebe o foco e larga o realce à primeira tecla; o toast repete-o para o
leitor de ecrã. Não se mostra só um toast longe do campo — e num portão,
que está por cima do toast, é a frase junto do campo que se vê (ver «Um
portão por cima de tudo não mostra avisos»). Num menu da casa
(componentes.js:sel) o campo do erro é o botão (`selb_<id>`), e não o input
escondido, que não se vê nem toma o foco; escolher uma opção larga o erro.
Numa caixa de etiquetas o contorno vai na caixa (o #g_membros dos grupos, o
#c_tenants dos contratos). O erro de vários campos ao mesmo tempo — as quotas
que não somam 100 — continua num aviso, que se vê por cima da janela.

pickModal(title,options,onPick,extra) (componentes.js:pickModal) é
escolher de uma lista de cartões, com ícone ou avatar; o rodapé é
«Voltar». promptModal(title,label,value,cb) (definicoes.js:promptModal) é
um campo só, com Enter a valer Guardar; sem texto não fecha calada: fica
aberta e diz «Escreve um nome.» no campo (componentes.js:falhaCampo), em
todas as janelas que a usam — categorias, subcategorias, etiquetas, grupos
partilhados, e as do movimento.js e do tarefas.js. Nunca o prompt() do
browser.

fold(id,title,body,{open,icon,summary}) (componentes.js:fold) é a secção
que abre e fecha dentro dos formulários. open é só o estado inicial:
depois manda o foldState (componentes.js:foldState), que sobrevive aos
re-renders enquanto a janela estiver aberta. summary aparece no
cabeçalho, visível mesmo com a secção fechada (estilos.css:.fold-head, o
.fsum). É HTML: um texto que venha de quem usa — um NIF, uma categoria, a
taxa de um crédito — entra por esc(), como em todo o lado.

fab(actions) (vistas.js:fab) escreve o botão de criar de uma lista, que
desde 2026-10 não se vê em ecrã nenhum: o CSS da casca esconde o FAB, o
leque e o espaço do fundo (estilos.css:.fab, vistas.js:render e o .fabpad).
Quem cria é o + a meio da barra de baixo no telemóvel e, no computador, o
«Criar» da barra lateral e a ação principal no cabeçalho
(estilos.css:.tabmais, navegacao.js:abrirAdicionar,
navegacao.js:pintarAcaoDoCabecalho — ver «A fita da barra de baixo»), com
a mesma condição (acessos.js:acoesDeAdicionar). Só os Movimentos e a Visão
geral ainda o escrevem; as outras listas já não, e quem cria no vazio delas
é o botão da ação, dentro da caixa (vistas.js:saida).

kpi(label,value,cls,foot,why,evo,acao,o) (vistas.js:kpi) é o cartão
indicador: rótulo, valor grande, rodapé em muted. Com why ganha um «?» no
canto e abre a explicação ao toque (estilos.css:.kpi.why); com evo ganha o
ícone de tendência e abre a evolução mês a mês e ano a ano
(vistas.js:kpiModal), com o botão de acao no rodapé dessa janela. A
janela pinta as duas linhas na cor da série do cartão (a cor que o kpi
guarda no KPI_REG, de o.serie ou o.cor) — a Receita --in, as Despesas
--out, as Prestações --loan, o Cashflow --accent — e, sem ela, no cobalto
(tema.js:COR_SERIE). O «Mês a mês» acaba no mês corrente
(vistas.js:mesesAMostrar), e o «Ano a ano» (vistas.js:evoMoney) começa no
primeiro ano em que o campo tem valor — o corrente fica sempre, e o anterior
quando tem movimentos, que é com ele que a faixa compara — sem saltar anos:
os que faltam entram com o seu valor. As
explicações vivem em WHY (vistas.js:WHY): uma ou duas frases, o que é e o
que não é. O oitavo argumento, {cls, cor, extra}, é o que a Visão geral
acrescenta sem mudar os outros ecrãs: a bolinha da cor da série no rótulo
(.kdot, a cor de tema.js:COR_SERIE pelo data-fundo, nunca um hex à mão), uma
linha a mais e as classes do cartão. Um número que não é um cartão de KPI e
tem evolução regista-se no KPI_REG e abre pela mesma janela, em vez de nascer
uma segunda janela de evolução (o herói da Avaliação, ver «A Avaliação e as
Projeções»).

card(title,sub,body) (vistas.js:card) é o cartão genérico das vistas.
.card.tap é o clicável: hover, premido e a seta, sem risco à esquerda; o
informativo fica liso (estilos.css:.card.tap). O estado de uma linha diz-se
no selo dela, e não numa borda: nos por confirmar, «Em atraso» vermelho,
«Por confirmar» cobalto e «Silenciado» cinzento (planeados.js:recSelo). As
mesmas linhas (planeados.js:pendLinha) vão nas linhas dos contratos, num
bloco que a nuvem lhes pendura depois do render (cloud/painel.js:pendBlock,
estilos.css:.cw-pend; ver «Os Contratos»).

Os restantes: tagField para etiquetas removíveis
(componentes.js:tagField), fileBlock para anexos e fotos
(componentes.js:fileBlock), .addbox para «adicionar mais um»
(estilos.css:.addbox), .opt e .seg para escolhas visuais com ícone, como o
tipo de movimento (estilos.css:.opt, estilos.css:.seg), .empty para o
estado vazio (estilos.css:.empty), .tip para a dica dos gráficos
(estilos.css:.tip; graficos.js:chartTip).

O segmentado (estilos.css:.segm) é um trilho --chip com a escolha acesa por
cima, no desenho do .chip.on e do .opt.on: o fundo --accent-soft, o texto
--accent-text e um contorno de 2px no --accent — um ::after colado às bordas
do botão, que não come largura ao texto (estilos.css, a secção ajustes-v40d
1.1). Vale em todos os segmentados — o tipo do movimento, o tema, o «pago
por», as abas da área, a entrada, as categorias, o titular A/B —, nos dois
temas, menos nas abas sublinhadas das Pessoas (.abas-pessoas), que já são um
traço. O contorno contra a pista tem 5.9:1 no claro, 6:1 no escuro e 3.3:1
sob o escurecimento forçado do Samsung Internet (medido nos pixeis): um
realce que fosse só luz (um branco com sombra no claro, o --line2 no escuro)
desaparece quando o browser escurece a página (ver «Tema escuro e a regra do
color-scheme»).

No segmentado que desliza (imovel.js:imvSegmentado) o contorno e o fundo vão
na peça que corre (estilos.css:.segm-polegar), e o botão aceso fica só com o
texto. O tipo do movimento acende o contorno no cobalto como os outros, e só
o texto na cor do dinheiro (--segm-texto: a receita --in, a despesa --out, a
prestação --loan; movimento.js:txTipoSegm): o verde e o laranja, sob o
escurecimento forçado, ficam escuros contra a pista (2.1:1 e 2.7:1).

Os dois segmentados mais apertados — os cinco tipos do movimento
(estilos.css:.mov-tipo-segm) e o Por indicar, Declarado, Não declarado do
contrato (estilos.css:.ct-at-segm) — têm colunas iguais, a letra a 13px e
menos enchimento (3px e 1px de cada lado); as abas da área ficam com 6px
(estilos.css:.abas-area), mas não são flex:1 1 0: cada uma tem a largura do
seu texto, e não perdem o fim — apertam-se e, no limite, rolam (ver «As abas
da área, fora do #view», em «A fita da barra de baixo»). A 14px, «Despesa» a 600 não cabe num quinto da
linha a 375px e fica «Despes…». Com flex:1 1 0 cada botão recebe a mesma
largura de texto mais o seu enchimento, por isso o enchimento baixa em todos
os do grupo. A 375px sobram cerca de 3px a «Despesa» e 4px a «Não
declarado».

Os ícones vivem no icones.js:ic, e dois dizem uma ação de cabeçalho: a
caixa com o visto (icones.js:caixaVisto, o ☑) é o «Selecionar vários» em
todas as listas com seleção — o visto sozinho lia-se como «concluir» —, e a
roda dentada (icones.js:roda) abre as opções de uma análise (as Projeções e
a Avaliação), que não é a engrenagem das Definições.

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

As outras listas com chave (vistas.js:listaViva) têm uma via parcial comum,
a da pesquisa (vistas.js:refrescarListasVivas, chamada pelo
vistas.js:lfSearch): refaz a moldura e reconcilia cada lista pela chave; se
uma lista tem de fazer nascer um cartão, ou as duas árvores não batem certo,
desiste, e o render faz o resto.

Uma via parcial refaz a vista a partir de um molde, e o molde tem de ser o
que o render poria — com a casca que ele põe à frente de cada vista: os
separadores da área (navegacao.js:abasDaArea) — e é dali que o
navegacao.js:abasAssentar os leva para a casa deles, por cima do #view. Sem
ela, a primeira tecla da pesquisa levava os separadores do telemóvel. Nos Movimentos o caminho curto guarda ainda dois
nós da moldura de uma pintura para a seguinte
(lista-movimentos.js:txGuardarNo): o campo da pesquisa, que não perde o foco
nem o que o teclado estava a compor, e o painel dos filtros, que não volta
ao topo a cada escolha e se repinta por dentro.

Quem migrar a vista seguinte tem três coisas a respeitar: a chave é o id
do registo e vive num data-chave que o reconciliar escreve; quem refaz
linhas sem passar pelo render tem de repor o que vive no DOM (o
tornarFocavel e as marcas da seleção, CW.selPintar); e o caminho curto tem
de refazer a casca dentro do #view e acertar o que está fora dele — o botão
dos filtros (vistas.js:pintarBotaoFiltros) e, nos Movimentos, o da seleção,
que o pintarBotaoFiltros devolve ao funil (cloud/selecao.js:CW.selCabecalho).

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
vêm de TABS (navegacao.js:TABS; vistas.js:render), escritos pelo
navegacao.js:tituloDoEcraHtml e pelo navegacao.js:subtituloDoEcra (ver
«Navegação»). O sino das
notificações só aparece na visão geral (notificacoes.js:notifSino).

Os filtros não ocupam a página. Nas análises estão atrás do botão de funil
do cabeçalho (vistas.js:hdrFiltToggle, vistas.js:hdrFiltN; o render
pinta-o). O botão ganha um ponto quando há filtros ativos
(estilos.css:.filtbtn) e acende com o painel aberto: primário no
computador; no telemóvel, onde o cabeçalho tira o fundo aos botões, o par
suave da escolha feita, --accent-soft com --accent-text
(estilos.css:#hdrFilt.primary, no header.top do telemóvel) — com o primário
só, o ícone ficaria na --accent-ink, da cor do cabeçalho, e o botão sumia
justamente quando é a maneira de fechar o painel. Diz o mesmo ao leitor de
ecrã pelo aria-expanded (vistas.js:pintarBotaoFiltros); nos Movimentos,
onde o botão do cabeçalho é o «Selecionar vários», não o leva. O painel
(estilos.css:.fwrap, estilos.css:.fpanel) é pegajoso e flutua por cima do
conteúdo sem o empurrar: preso ao topo, desaparecia ao primeiro scroll. Nas
listas e nos Movimentos o funil fica ao lado da pesquisa, que está sempre à
vista, e o botão do cabeçalho só existe onde há seleção de vários — os
Movimentos, os Imóveis, os Contratos, os Inquilinos, as Visitas e os
Planeados —, onde é o «Selecionar vários», a caixa com o visto
(vistas.js:LF_COM_CABECALHO, vistas.js:pintarBotaoFiltros; ver «Os
Movimentos»). Nos Inquilinos, nas Visitas e nos Planeados a base não o pinta,
e quem o mostra é a camada da seleção, que corre depois
(cloud/selecao-listas.js:selLCabecalho). Nos Proprietários e nos Créditos não
há botão no cabeçalho: dois botões para o mesmo painel eram ruído. Nas
Projeções e na Avaliação o botão é a roda dentada das opções (ver abaixo).

Os painéis de filtro têm um modelo só (a nota do vistas.js:lfSel): mexes, a
lista muda logo atrás, sem «Aplicar»; «Limpar» à esquerda, «Fechar» à
direita. Nas análises, o «Limpar» e o «Fechar» vivem num pé preso ao fundo
da caixa (vistas.js:fpanelPe, estilos.css:.fp-pe; vistas.js:anaPanel), na
forma do rodapé das janelas: o resto rola por trás,
o pé fica, com a divisória e o fundo do cartão; no telemóvel vão a meias,
com 48px. A caixa continua a ser quem rola (o cloud/filtros.js segue as
listas abertas pelo scroll dela) e o pé é o último filho, pegajoso em
baixo: num painel curto fica logo a seguir aos filtros, sem esticar a
caixa, e o scroll-padding da caixa é a altura dele, para o Tab não deixar um
campo escondido por trás. Mexer num filtro repinta o ecrã, e a caixa volta
à rolagem em que estava (vistas.js:rolagemDoPainel,
vistas.js:reporRolagemDoPainel): escolher a ordenação, no fundo de um
painel comprido, não atira a caixa para o topo. O anaPanel monta-o
(vistas.js:anaPanel; o seletor dos filtros comuns só onde o ecrã o pede), e
o da Visão geral — o imóvel em foco — é o vistas.js:anaPanelPadrao. Nas
listas e nos Movimentos o «Limpar» e o «Fechar» estão no topo, ao lado do
título (ver abaixo e «Os Movimentos»).

Todas as listas filtram como os Movimentos (vistas.js:lfCabeca), e é um
componente só, que veste as classes deles, em vez de uma cópia por lista. A
lista declara o que tem — o nome no singular e no plural, quantos passam, os
campos e a ordenação — e recebe a barra (vistas.js:lfBarraHtml), o painel
(vistas.js:lfPainelHtml, vistas.js:lfPainelCorpo) e os chips
(vistas.js:lfChipsHtml), por esta ordem; a interface está no comentário por
cima do lfCabeca. A barra é a pesquisa sempre à vista, com o funil ao lado,
que diz quantos filtros estão ligados sem contar a pesquisa
(vistas.js:lfNFiltros) e abre o painel completo. A pesquisa vai por palavras
e frases entre aspas, sem ligar a acentos (vistas.js:lfHit), espera 280 ms e
devolve o foco com o cursor no fim quando o campo foi recriado
(vistas.js:lfSearch, como o lista-movimentos.js:onTxSearch); o limpar dela é
o ic('x') com o nome «Limpar a pesquisa». A barra fica por cima do que
filtra: no topo nos Imóveis, nos Contratos, nas Pessoas e nas Visitas; nos
Planeados depois da faixa de quem vem de trás e do cartão «Por confirmar»,
que não filtra; nos Créditos depois do resumo e do aviso dos pagamentos sem
hipoteca. Sem registos nenhuns não há barra: fica o vazio com o seu botão.

Os filtros mais usados estão à vista, em chips por baixo da pesquisa, e são
os mesmos do painel — mexer num muda o outro. Cada chip é o menu da casa
vestido de chip (vistas.js:lfChip, lista-movimentos.js:txChipSel):
desligado diz o nome do filtro; ligado diz o valor, com o fundo cobalto e um
× que limpa só esse (vistas.js:lfLimparCampo); as escolhas levam quantos lhe
cabem pelos olhos dos outros filtros («Em vigor · 3»). Um chip `'largo'` só
aparece a partir de 901px, ou ligado (o «Pago por» dos Movimentos). Um chip
que não é um seletor leva ao painel com o foco no campo dele
(vistas.js:lfAbrirEm; estilos.css:.lfm-chip-abre) — o «Dias e horas» das
Visitas, como o «Escolher datas…» dos Movimentos. Depois dos chips, o
«Limpar» (vistas.js:lfChipsHtml), que no telemóvel só se mostra quando a
única coisa ligada não tem o seu × à vista. A fila parte em linhas e não
rola de lado. O chip diz o nome ao leitor de ecrã uma vez: quando o rótulo
já começa por ele («Ordenar: renda»), só o rótulo.

O painel é o dos Movimentos (vistas.js:lfPainelCorpo, as classes
estilos.css:.mov-fwrap, estilos.css:.mov-filtros-card,
estilos.css:.mov-grelha): o título com o «Limpar» (só com filtros ligados) e
o «Fechar» NO TOPO, «Aplicam-se ao mexer · N imóveis» e a grelha de duas
colunas, com a
ordenação no fim (vistas.js:lfCampos: «Ordenar por» e, escolhida, «Ordem»).
Na grelha, a opção vazia diz o curto («Todos»), e o campo ligado veste o
cobalto (estilos.css:.mov-ligado). Além dos seletores (vistas.js:lfSel, que
aplica pelo vistas.js:lfMudar e respeita o `aplicar` do campo), a grelha
tem campos de data e de hora (vistas.js:lfCampoNaGrelha), lado a lado como o
«De» e o «Até» dos Movimentos; um intervalo conta como um filtro no funil (o
`junto`, vistas.js:lfCount).

O estado é o lf(k) da lista, e nada mais. O «Limpar» (vistas.js:lfClear)
tira os filtros e a pesquisa e deixa a ordenação, que não é um filtro, como
o clearTxFilters dos Movimentos. Na via parcial (vistas.js:refrescarListasVivas)
a barra fica no documento (vistas.js:lfBarraViva) — o resto troca-se à volta
dela e só o funil se refaz, se mudou —, e quem escreve não perde o foco, o
cursor nem o que o teclado compunha: um nó que sai do documento perde o
foco, e o teclado do telemóvel fechava-se a meio de uma palavra. Quando a
via parcial desiste (nasce um cartão), o render recria o campo e o lfSearch
devolve-lhe o foco. Ao teclado, o funil abre e fecha o painel com o foco a
ficar nele, e o «Fechar» devolve-o ao funil (vistas.js:lfFocarFunil);
escolher num seletor deixa o foco no seletor refeito (vistas.js:lfReporFoco);
o «Limpar» do painel, que some, passa o foco ao «Fechar».

Nos Imóveis, nos Contratos, nos Inquilinos, nas Visitas e nos Planeados o
botão do cabeçalho é o «Selecionar vários», a caixa com o visto
(icones.js:caixaVisto; cloud/selecao-listas.js:selLCabecalho, a seguir ao
cloud/selecao.js:patchHdrSel, que embrulha): é da camada da seleção e não
da base, que não conhece a nuvem; corre depois da base
(vistas.js:pintarBotaoFiltros) e da camada do painel (cloud/painel.js:patchHdr,
que só despe o «Concluir» que vestiu — cloud/painel.js:HDR_CONCLUIR).
Sem a camada, o hdrFiltToggle continua a abrir o mesmo painel. O caminho
curto repõe-no (CW.selCabecalho, chamado pelo vistas.js:refrescarListasVivas
depois do pintarBotaoFiltros).

As contagens de uma lista contam o que a lista pode mostrar: as escolhas dos
chips com quantos há e o «Aplicam-se ao mexer · N» contam só os registos que
passam pelo âmbito, como as linhas (ambito.js:visiveis) — nos Contratos, um contrato de um imóvel
fora do âmbito, ou sem imóvel, não entra na conta
(lista-contratos.js:vContracts).

As listas dos Imóveis, dos Inquilinos, das Visitas e dos Contratos dividem-se
pela origem de cada registo (vistas.js:listaPorOrigem): os meus, os
partilhados comigo e aqueles em que colaboro, por esta ordem. A origem é a do
imóvel (acessos.js:origemDaCasa): sem dono de fora é meu — mesmo que eu o
partilhe —; com cargo é um imóvel em que colaboro; com dono de fora e sem
cargo é partilhado comigo (a ligação ou o grupo). Sem imóvel, ou com um que
já não está na base, é meu. O inquilino segue a casa dele
(acessos.js:origemDoInquilino); a visita e o contrato seguem o imóvel. Cada
secção com registos é uma secção com um h2 e quantos registos tem
(estilos.css:.org-cab), sempre — mesmo sendo a única: quem só tem casas suas
lê «Os meus imóveis» por cima da lista (vistas.js:listaPorOrigem). Uma secção
vazia não aparece; sem registos nenhuns não há secção nem título, e fica o
vazio de sempre (o vazioFiltro, ou o vazio da lista com o seu botão — quem
chama já o pôs antes). A secção única guarda os ids de sempre das listas
vivas («imoveis», «inquilinos», «visitas:Próximas», «contratos»), para o
vistas.js:refrescarListasVivas os achar no ecrã a cada tecla da pesquisa; com
duas ou três, cada uma tem a sua lista viva com sufixo (`imoveis:meu`). O
título distingue-se dos grupos de dentro pela cor da
frente — o texto a --accent-text, com um traço por baixo — e pelo tamanho
(estilos.css:.org-tit), o que sobrevive ao escurecimento forçado do Samsung.
Os títulos: «Os meus imóveis», «Os meus inquilinos», «As minhas visitas», «Os
meus contratos»; «Partilhados comigo» («Partilhadas comigo» nas visitas); «Em
que colaboro» (lista-imoveis.js:ORIGEM_IMOVEIS,
lista-pessoas.js:ORIGEM_INQUILINOS, visitas.js:ORIGEM_VISITAS,
lista-contratos.js:ORIGEM_CONTRATOS). O agrupamento de sempre fica dentro de
cada secção, um nível abaixo: as Próximas e as Passadas das visitas (h3,
debaixo do h2 da secção), e os grupos por imóvel dos contratos
(lista-contratos.js:ctGruposDaLista), cada secção com a sua tabela no
computador.

O filtro «Origem» é um campo do lfCabeca com a chave or, chip rápido: Todos /
Os meus / Partilhados comigo / Em que colaboro (nas visitas, Todas / As
minhas / Partilhadas comigo / Em que colaboro), cada escolha com quantos lhe
cabem entre os que passam os outros filtros, e o «Todos» sem número
(vistas.js:lfOrigem). Só existe quando a lista inteira, antes de qualquer
filtro, tem registos de pelo menos duas origens — o chip não aparece e some a
cada tecla da pesquisa —, e só oferece as origens que há; um valor guardado
que deixou de servir sai do estado, para não cortar nem contar no funil um
filtro que não se vê. Ligado, fica só a secção dessa origem, com o título
dela. O estado dos
imóveis e dos contratos conta com a origem, e a origem com o estado.

Uma lista é um cartão com uma linha por registo, separadas por um traço — os
imóveis, que têm capa, vão em cartões soltos. Cada linha tem data-lp: o
título, o essencial numa linha curta separada por «·», os selos e, à
direita, o valor. Os contratos agrupam-se por imóvel, cada grupo com um
cabeçalho de classe própria e a renda do mês à direita
(estilos.css:.ct-grupo-cab; ver «Os Contratos»). Não há ⋮: tocar na linha
abre a ficha, onde estão as ações (o ⋯ da ficha), e o toque longo continua —
nos movimentos, nos imóveis, nos contratos, nos inquilinos, nas visitas, nos
planeados e nos modelos entra na seleção de vários com o tocado já marcado
(cloud/selecao-listas.js:lpLongo → cloud/selecao-listas.js:CW.selLEntrar), o
mesmo gesto em toda a app; nos proprietários não faz nada; sem conta, onde a
nuvem não corre, abre as opções. As opções de um planeado
vivem no ⋯ da ficha (planeados.js:recView: Confirmar sem rever, Silenciar ou
Reativar avisos, Editar, Apagar) e as de um modelo também
(planeados.js:tplView: Editar e Apagar, com o «Usar modelo» no rodapé); o
«Recusar desta vez» e o «Preencher N em falta» de um por confirmar vivem no
⋯ da linha do cartão «Por confirmar» (planeados.js:pendMenuItens). A folha
das opções (planeados.js:lpPlaneado, planeados.js:lpModelo) continua a
existir para quem a chama, com «Selecionar vários» no fim
(planeados.js:lpPortaSelecao, cloud/selecao-listas.js:selLPortaNoFim) — como
a dos imóveis e dos contratos —, mas o toque longo já não a abre. Em
seleção, o toque longo marca e desmarca como o toque nos Imóveis, nos
Contratos, nos Inquilinos, nas Visitas e nos Planeados
(cloud/selecao-listas.js:CW.selLTocar). A
porta visível do toque longo é a própria linha, que o tornarFocavel torna
alcançável pelo teclado (Enter abre a ficha): o percurso aceita como caminho
visível a linha focável que abre a ficha (testes/ui/invariantes.js); a porta
da seleção pelo teclado é o ☑ do cabeçalho. Em seleção, a porta visível é a
barra do fundo.

A lista dos imóveis é a exceção com capa, a prancheta M-Casas
(lista-imoveis.js:vProperties): cada cartão leva a capa à esquerda, da altura
do cartão — a primeira foto, pintada depois do render
(lista-imoveis.js:propsDepois), ou o mosaico do imóvel (ver «Tokens») —, e à
direita o nome, a morada, o selo do estado, três números e os
selos do que pede atenção (lista-imoveis.js:imvCartao,
lista-imoveis.js:imvNumeros, estilos.css:.imv-card). Os rótulos dos números
são o span filho direto (estilos.css:.imv-kv>span), para não vestirem o
valor; nas colunas estreitas do cartão, um valor de um milhão ou mais vai em
milhões («1,25 M€»), com o valor
inteiro no title e num .imv-so-leitor (lista-imoveis.js:imvEuroCurto),
porque a reticência num número de dinheiro escondia o próprio valor. Os três
números dependem do imóvel: com renda, Renda, Yield e Dívida; de arrendamento sem
renda, Renda vazia, Valor e Dívida; de uso próprio, Valor, Aquisição e
Dívida — cada um só com o cargo e o serviço que o deixam ver (contract.view
e os Contratos, report.view, loan.view e os Créditos). O selo do estado tem
as cores da linguagem:
arrendado verde, parcial («3/4 quartos») cobalto, vago âmbar, uso próprio
cinzento (lista-imoveis.js:imvCorDoEstado; a chave e o texto continuam no
registos.js:propStatus). Os selos do que pede atenção vão por esta ordem: os
por confirmar («1 renda em atraso» a vermelho, «2 por confirmar» a cobalto,
contados numa passagem só pelos planeados,
lista-imoveis.js:imvPendentesPorImovel), os contratos por começar, o que está
por acertar entre proprietários (cinzento: é uma conta, não um perigo), «Por
quartos» e os colaboradores.

Por cima da lista, a pesquisa à vista com o funil (vistas.js:lfCabeca), que
encontra também quem mora no imóvel — os inquilinos dos contratos vivos —,
para quem pode ver os contratos. Os chips rápidos são o estado — cada um
com quantos imóveis há nele entre os que passam os outros filtros,
«Arrendados · 2» (lista-imoveis.js:imvCampoEstado, aplicado pelo
lista-imoveis.js:imvFiltroRapido; ligado diz o rótulo curto do
lista-imoveis.js:ESTADOS_RAPIDOS) —; o do arrendamento só no ecrã largo,
para a fila caber numa linha aos 390px. No painel, mais a ordenação: nome e
valor sempre, a renda e a yield com os Contratos, a dívida com os Créditos
(sem eles não ordenavam nada). Não há filtro de proprietário nem o seletor
dos filtros comuns, que ali não tinham o que aplicar: a pesquisa encontra os
imóveis pelo nome dos donos. Sem os Contratos não
há chip do estado. No computador os cartões vão numa grelha de colunas de
400px no mínimo (estilos.css:.imv-lista).

Um ecrã de análise é uma coluna de blocos, cada fila um .cols: a Visão geral
pela ordem do canvas (painel-geral.js:vDashboard; ver «A Visão geral»), a
Avaliação do herói aos gráficos (avaliacao.js:portCard; ver «A Avaliação e
as Projeções»).

As Projeções e a Avaliação filtram como as listas, mas só com a fila de
chips: no sítio da barra das listas (vistas.js:lfCabeca) está o chip
«Imóvel» — um imóvel ou um grupo, o foco da análise — e mais nada: sem
pesquisa, que numa análise não há o que procurar, sem funil e sem painel
(vistas.js:anaChips, projecoes.js:prjChips, avaliacao.js:avaChips). O chip é
o seletor da casa vestido de chip, com as classes dos das listas
(estilos.css:.mov-chip): desligado diz «Imóvel» e leva a seta; ligado diz o
nome, no cobalto, com o × que volta a todos os imóveis e deixa o foco no
chip (vistas.js:anaChipFocar). Escolher pelo teclado devolve o foco ao chip
refeito (projecoes.js:onProjProp, avaliacao.js:onRepSel, pelo
vistas.js:lfReporFoco). Não há chip de proprietário. Na Avaliação, as ações
da página são um botão só, na mesma linha do chip, à direita — também no
telemóvel (estilos.css:.ana-topo): o botão de partilha
(avaliacao.js:avaPartilha), de ícone (ic('partilhar'), os três pontos
ligados), .btn.so-icone de 44×44, com o nome «Partilhar» (aria-label e
title). Abre o menu de ações da casa (.menuwrap/.menupop, pelo
componentes.js:menuOpen) com «Partilhar avaliação» (copias.js:shareReport) e
«Exportar movimentos (CSV)» (copias.js:downloadCsv); cada opção fecha o menu
antes de correr, e o menu fecha também ao tocar fora, ao rolar e com o
Escape. O componentes.js:menu leva sempre o ⋯ e o nome «Opções», por isso o
menu escreve-se à mão, com a mesma .menuwrap/.menupop, para fechar e se
posicionar como todos os outros. Tem a largura das opções, sem as partir, e
não passa da largura do ecrã (estilos.css:.ava-partilha). Um nome comprido leva
reticências no chip, que nunca passa da largura (estilos.css:.ana-chips).
Sem imóveis no âmbito e sem foco, o chip não se escreve.

Nestas duas, o botão do cabeçalho é a roda dentada (icones.js:roda), e não
o funil: abre a janela das opções (vistas.js:ANA_RODA, vistas.js:registarRoda,
vistas.js:pintarRoda; o «alternar» do registo da análise —
projecoes.js:prjOpcoes, avaliacao.js:avaOpcoes). O nome é «Opções da
projeção» / «Opções da avaliação» (aria-label e title); diz que abre um
diálogo (aria-haspopup="dialog"), não diz aberto nem fechado, nunca acende e
não leva o ponto dos filtros — o chip já está à vista. A Visão geral e o IRS
· Anexo F continuam com o funil e o painel (vistas.js:anaPanelPadrao,
fisco.js:fisBarra). O da Visão geral tem o imóvel e, quando os há, os
filtros comuns; o do IRS tem o titular (vistas.js:anaSelDono), sem filtros
comuns, que não guardam titular. O IRS abre com a sua barra
(estilos.css:.ana-barra): os anos e o titular em chips e as ações da página
à direita; o chip do titular com ▾ abre o painel (vistas.js:hdrFiltToggle) e
com × larga-o (navegacao.js:limparAmbito). Um chip com nome tem o texto num
<span>, que leva as reticências, e nunca passa da largura da barra
(estilos.css:.ana-ambito, o .chip>span): com um nome comprido, a página
rolava de lado no telemóvel.

A janela das opções (vistas.js:anaOpcoes) tem as linhas das Definições ›
Valores por omissão (estilos.css:.def-vr; vistas.js:anaLinhaOpcao) — são os
mesmos números de db.settings —, a nota do que vale em branco, e só o
«Fechar». Projeções: o horizonte (anos), o aumento das rendas (%) e a
inflação das despesas (%); Avaliação: o yield exigido (%). Cada campo grava
ao escrever, e a página por trás acompanha (projecoes.js:prjOpcao →
prjDefinir; avaliacao.js:avaOpcaoYield → capTargetSet), com as regras de
definicoes.js:NORMA_DOS_VALORES; um valor igual ao gravado não redesenha, e
nenhum chama o vistas.js:setSet direto. Ao sair do campo, o campo passa a
dizer o que ficou gravado (o horizonte em branco é 1). Depois de cada
gravação o retrato da janela é o de agora (vistas.js:anaOpcaoGravada): o X,
o Escape e o fundo fecham sem «Sair sem guardar?». O placeholder é
«Opcional». Os ids ficam (#prjHorizonte, #prjAumento, #prjInflacao,
#avaYield), e o redesenho continua pelo prjRepintar/avaRepintar, que não
tiram o foco ao campo. A janela entra e sai pela folha da casa
(componentes.js:openModal), sem movimento próprio.

Gravar um campo ou um interruptor da Análise não tira o foco a quem usa o
teclado. O render troca a vista inteira, e quem tinha o foco desaparecia: o
foco caía no <body> e o Tab seguinte voltava ao topo. A escrita é logo, e o
redesenho devolve o foco a quem o tinha — pelo id, ou, nos botões sem id (o
A/B do titular), pelo data-click, que não muda ao redesenhar. No change de
um campo o foco ainda vai a caminho do seguinte, por isso o redesenho espera
que ele assente (um setTimeout); num clique é logo (avaliacao.js:avaRepintar,
projecoes.js:prjRepintar, fisco.js:fisRepintar; o fisco.js:fiscoGravarIrs
recebe o adiar, que o fisco.js:fiscoSetOutros passa). Por isso cada campo
que grava ao sair tem id (#avaYield, #prjHorizonte, #prjAumento e
#prjInflacao, na janela das opções, vistas.js:anaOpcoes; #fiscoOutros, na
página). São três cópias, como os cartões: cada serviço
carrega sozinho.

Um cartão da Análise tem o título na letra dos títulos, a 18px (16 no
telemóvel), com o subtítulo ao lado (estilos.css:.ana-cartao;
avaliacao.js:avaCartao, projecoes.js:prjCartao, fisco.js:fisCartao — três
cópias, porque cada serviço carrega sozinho). As tabelas da Análise têm o
cabeçalho em maiúsculas pequenas, rolam dentro da caixa e, as que começam
pelo nome, prendem a primeira coluna ao rolar (estilos.css:.ana-fixa); a
linha dos totais é cinzenta (estilos.css:.ana-total), e uma linha que abre
uma ficha tem hover e premido diferentes. Numa tabela com a primeira coluna
presa, a linha dos totais escreve o «Total» só na primeira célula, sem
colspan — a célula presa com várias colunas passava por cima dos valores ao
rolar —, e essa célula é cinzenta como o resto da linha
(estilos.css:.ana-fixa-1, o tr.ana-total td; fisco.js:fiscoQuadroCard,
avaliacao.js:repCard). No
telemóvel, o botão do canto do cabeçalho de um cartão fica à direita do
título e do subtítulo, numa grelha, em vez de cair numa fila só dele
(estilos.css:.ana-cab:has(>.ana-extra)).

Todo o vazio convida: um <b> a dizer o que falta e uma frase a dizer o que
fazer (painel-geral.js:vDashboard, lista-imoveis.js:vProperties, lista-contratos.js:vContracts,
lista-pessoas.js:vTenants, lista-pessoas.js:vOwners; planeados.js:vRecurring). Com
filtros ativos o vazio é «Nada neste filtro» com o botão «Limpar
filtros», que limpa seja o que for sem saber onde está — um vazio só,
escrito num sítio (vistas.js:vazioFiltro, vistas.js:limparFiltroAtual).

O que é longo abre fechado, e a escolha fica no aparelho: o cartão «Por
confirmar» (planeados.js:pendingCard, planeados.js:pendShut; a chave
gi_pend_shut é planeados.js:PEND_LS). A visão geral existe para se ver o
património de relance; quatro movimentos abertos ocupavam 600 dos 900px
antes de aparecer um único indicador. O cabeçalho diz o que é preciso
saber (quantos em atraso, o total, quantos esperam); a lista abre-se com um
toque. Guarda-se '0' explícito quando se abre, para distinguir «nunca
mexeu» de «quis aberto». O dos prazos não precisa: são quatro linhas curtas,
e o resto está a um toque, no sino filtrado (prazos.js:prazosCard). O
cartão «Por confirmar» da Agenda também abre fechado
(calendario.js:calPendCard, calendario.js:calPendShut; a chave
gi_agenda_pend_shut é calendario.js:CAL_PEND_LS), com outra chave de
propósito: nos Planeados a lista é a razão de lá se ir, na Agenda é um
aparte do mês, e abrir um não abre o outro.

Quando a mudança é local, repinta-se só o cartão, não a vista:
painel-geral.js:donutDrill, planeados.js:pendToggle e o dia do calendário
(calendario.js:calSel troca a classe .on na grelha e repinta só o painel
de calendario.js:calDiaPanel). O calendario.js:calPendAlternar nem repinta
o cartão: troca a classe num nó vivo. render() substitui o innerHTML de #view e
perde o estado do DOM (vistas.js:render; index.html:#view).

## A Visão geral
A Visão geral segue a ordem do canvas (painel-geral.js:vDashboard): o «Pede
atenção», os quatro indicadores do ano, a faixa âmbar das despesas sem
imóvel, as entradas e saídas mês a mês ao lado do cashflow acumulado, as
despesas por categoria, o cashflow por imóvel e a renda por contrato lado a
lado, e o Portefólio ao lado das contas entre proprietários. Cada fila é um
.cols, e a nuvem parte-as em blocos arrumáveis e dá a cada cartão a largura
da fila (cloud/painel.js): dois numa fila são metades (.cw-wide), três são
terços (.cw-terco), um sozinho atravessa (.cw-full), e a faixa âmbar
atravessa sempre (.vg-cheia). A grelha tem doze colunas
(estilos.css:.cw-dash) e responde à largura da vista, não à do ecrã: abaixo
de 560px tudo atravessa, e os terços só começam nos 900px. Os valores são
por inteiro: não há filtro de proprietário (ver «Navegação»). O painel dos
filtros tem o imóvel (ou grupo) em foco e, quando os há, o seletor dos
filtros comuns, que aqui aplicam o imóvel (vistas.js:anaPanelPadrao).

O «Pede atenção» (painel-geral.js:pedeAtencao) é só o que muda decisões. No
computador são cartões lado a lado (estilos.css:.vg-atencao-grade): os por
confirmar (planeados.js:pendingCard, dos Planeados), os prazos legais e
fiscais (prazos.js:prazosCard) e, na terceira coluna, um cartão só,
«Pedidos e atividade»: os pedidos por responder no cimo e, por baixo, a
atividade dos outros nas casas partilhadas (painel-geral.js:atividadeCard).
No telemóvel é um cartão com uma linha por assunto
(painel-geral.js:atencaoLinha, o componente .linha), com a divisória entre as
linhas e não por baixo do título (estilos.css:.vg-atencao-linhas, o
.linha+.linha), que abre o sino só com
esse assunto: notifModal('confirmar'), notifModal('prazos'),
notifModal('pedidos'), e notifModal('') para a atividade. Qual se vê decide
o CSS, ao corte da casca (900px). Nada antes de saber o estado
(espera.js:sabemosOEstado), e a atividade só depois de o sino ter marcado a
primeira leitura — é ele que a marca e a grava (notificacoes.js:notifMarca).

Na mesma atividade vai quem saiu de uma casa que fica comigo
(notificacoes.js:notifSaidas, de CW.state.departures): «Rui deixou de
colaborar em T2 Benfica.» (só ao dono) e «Rui deixou de ser comproprietário
de T2 Benfica.» (a todos os que ficam), com a data e a hora por baixo e as
iniciais de quem saiu (notificacoes.js:notifQuem). A atividade e as saídas
juntam-se pela hora (notificacoes.js:notifAtividade) — é o que o crachá conta
(notificacoes.js:notifConta), a secção «Atividade nas casas partilhadas» do
sino e o cartão do painel —, com a mesma marca de leitura: o «Marcar tudo
como lido» cala-as também. Tocar numa saída abre a ficha do imóvel quando ele
ainda está na base e os Imóveis estão ligados; sem isso a linha não é um
botão. Com os Colaboradores desligados, as saídas de colaboradores não
entram. Na linha do telemóvel, uma saída vai sozinha, sem o «Nome · » à
frente, porque já começa por quem saiu.

Os pedidos são da nuvem: a vista deixa o lugar `<!--vg-pedidos-->` na
terceira coluna, por cima da atividade, e a nuvem enche-o
(cloud/painel.js:pedidosNaPilha). Com atividade, as linhas dos pedidos
(partilha.js:linhasDosPedidos) entram no cimo do cartão dela, que passa a
chamar-se «Pedidos e atividade» — um cartão, como o canvas (Main), e não
dois empilhados. Sem atividade vai o cartão dos pedidos
(partilha.js:pedidosDashCard), sem o espaço nem a marca de quando vive à
cabeça (cloud/painel.js:pedidosNoAtencao). Com convites de ligação vai
também o cartão dos pedidos: o sino não os mostra, e por isso não têm linha
no telemóvel, onde esse cartão fica à vista (.com-convites) — e o da
atividade não. Sem o «Pede atenção», os pedidos vão à cabeça da vista. A
marca do fim dos pedidos (`<!--fim-pedidos-->`, onde o guia pendura os
primeiros passos) fica no fim do bloco, para os passos entrarem depois do que
é urgente; a nuvem escreve-a ao recompor a vista, porque os filhos de um
elemento não trazem os comentários.

Os indicadores da Visão geral (.vg-kpi) usam o oitavo argumento do kpi (ver
«Componentes da casa»): a bolinha da cor da série no rótulo, o valor a tinta
na Bricolage, que encolhe com o próprio cartão — com os cêntimos tem 11 ou 12
letras — (estilos.css:.vg-kpi, container-type e 15cqi: de 16 a 30px no
computador, até 21 no telemóvel), a variação face ao ano
anterior numa linha («▲ 21% · 2025: 9 000 €»), a silhueta dos doze meses no
canto de cima, no lugar do ícone da evolução, e uma frase curta, só no
computador; a Prestações traz numa linha a mais o que se amortizou. O
Cashflow é o cartão azul-noite (estilos.css:.vg-kpi.cf: --side no claro,
--accent-soft no escuro), e por ser escuro nos dois temas a bolinha e as
setas dele levam as cores do tema escuro (tema.js:COR_SERIE_ESCURO). Nos
custos — as Despesas e as Prestações (.vg-kpi.custo) — a variação é neutra:
um «▲» verde por cima de despesas que subiram dizia o contrário. O Cashflow
passa serie:COR_SERIE.cashflow, porque a bolinha dele é a do tema escuro e a
janela da evolução precisa da cor do tema.

Os números da Visão geral são de duas naturezas, e cada uma tem a sua
escrita. Os fluxos levam sempre os cêntimos (formato.js:euro2), como o
canvas: os quatro indicadores, as amortizações da Prestações («+5 000,00 €
amortizados»), a renda contratada e a líquida do Portefólio, o cashflow por
imóvel e a leitura das entradas e saídas e do acumulado. Os stocks — o valor
de mercado e o de aquisição, a dívida, o património, as mais-valias —, o
centro do donut, a faixa «2025: …» e os eixos ficam ao euro. Os indicadores
passam o formatador à faixa (o fmtValor da série, painel-geral.js:vDashboard),
para ela poder conferir o texto (ver «Uma comparação diz de que números
fala»).

Os gráficos mensais do ano acabam no mês corrente, ou no último com algum
valor quando há movimentos de data futura (vistas.js:mesesAMostrar): a app
aceita-os, e o fim da linha do acumulado tem de bater com o Cashflow. Uma
linha a seguir por novembro e dezembro ao nível de hoje lia «dez −6 358 €».
Nas entradas e saídas as prestações, que são constantes, descem junto ao
eixo, e as despesas, que variam, no fundo, como o canvas (o desceAoContrario
do graficos.js:cBars, que só inverte a pilha dos negativos, sem mexer na
legenda nem na leitura). No telemóvel os rótulos dos gráficos mensais ficam
a ~10,5px (estilos.css:.vg-cartao, o .chartbox:not(.pie) svg text, que ganha
ao atributo do SVG); o donut fica de fora.

Uma ligação no canto de um cartão («Avaliação», «Ver todos») lê-se na linha
do título: na grelha do telemóvel, sem nota, fica na linha 1 e acaba o texto
na margem do conteúdo; no computador, na linha de base, com margem negativa
para o alvo de 44px do dedo não engrossar a cabeça. No fim da página, o
«Personalizar painel» sobe 64px (estilos.css:#dashPersonalizar, com padding,
porque as utilidades do botão ganham à margem): o «Topo» flutuante
(index.html:#toTop) ficava-lhe por cima.

O cartão dos prazos, «Prazos legais e fiscais» (prazos.js:prazosCard), mostra
os quatro mais urgentes em linhas curtas: o que há a fazer e de quem, com a
data (prazos.js:pzPartes), e o selo do que falta, por extenso
(prazos.js:pzQuando), na cor da linguagem (prazos.js:pzSelo). Cada linha é um
botão que abre o sítio certo, com o X ao lado, que silencia esta ocorrência
com «Anular» (prazos.js:pzSilencia). A frase longa — o porquê e o como —
fica no sino, e «Ver todos» abre-o só com os prazos
(notificacoes.js:notifModal).

As contas entre proprietários (vistas.js:contasCard) são um mosaico por dono
— «A receber» em verde suave, «A pagar» em laranja suave, «Em dia» em
cinzento, com «(eu)» na pessoa com sessão —, o plano de acerto num quadro
tracejado com o botão primário «Acertar contas», e os últimos quatro
acertos. Nas frases vai o primeiro nome, a menos que dois donos o partilhem
(vistas.js:nomeCurto). Fora da Visão geral, o mesmo cartão vai solto, na sua
fila (vistas.js:balancesCard).

O Portefólio (painel-geral.js:portefolioHtml) é uma grelha de números no
computador — o rótulo pequeno e o valor na Bricolage a 22px — e linhas no
telemóvel, cada número num .stat, que é por onde o painel arrumável o
reconhece. O telemóvel mostra o que o canvas M-Inicio mostra (imóveis ·
contratos ativos, renda contratada, valor de mercado, em dívida e património
líquido); o resto leva .vg-so-largo, e a porta «Avaliação», no canto, leva a
ele. No computador os valores de cada fila ficam na mesma linha mesmo com um
rótulo partido em duas («Renda líquida de impostos (estim.)») ou com a nota
das mais-valias: cada .stat ocupa três linhas da grelha — o rótulo, o valor,
a nota — partilhadas com os vizinhos (grid-template-rows:subgrid), e o
espaço entre filas é o padding de baixo.

Um bloco pode dizer a sua chave (o data-bloco, que o cloud/painel.js:dashKey
lê primeiro): a faixa das despesas sem imóvel guardou a do cartão de antes
(«card:Despesas sem imóvel»), e uma ordem guardada não a perde.


Os pedidos para passar o controlo que me fizeram
(CW.state.transfers.incoming, notificacoes.js:notifTransfRecebidas) são
pedidos por responder: contam no crachá, têm linha no telemóvel e entram no
cartão dos pedidos (cloud/partilha.js:pedidoDeTransferenciaHtml) com «Ver» e
«Recusar» — o Aceitar não está na linha: passar a gerir um imóvel lê-se
antes. O «Ver» (notificacoes.js:notifTransfVer) abre «Pedido de Alice»: as
casas; que só muda quem as controla na app (passo a gerir as partilhas, os
colaboradores e o apagar); que quem pede fica com a quota que tem, eu com a
minha, e que nada muda nas quotas, nos grupos nem nos outros
comproprietários; os colaboradores dele nesses imóveis pelo nome, que
continuam com o mesmo cargo e passam a ser geridos por mim; e que nada muda
até aceitar; o rodapé é Recusar e Aceitar. Aceitar e recusar fecham a folha
e o sino (notificacoes.js:notifTransfFechar, a regra do notifPedidoAceitar),
e o aviso de aceitar diz o que passei a gerir e o que ficou de fora e
porquê (notificacoes.js:notifTransfAvisoAceite). Os que fiz esperam no sino,
em «À espera de resposta» (filtros Tudo e Pedidos, sem contar no crachá),
com o Cancelar. Sem o campo no estado (um servidor de antes), não há
nenhum.

Pelo mesmo caminho chegam os avisos dos pedidos para passar o controlo,
cada um com a sua frase (notificacoes.js:notifFraseDoAviso): «Bruno aceitou
o controlo de T2 Benfica.» e «… recusou …» (a quem pediu), «Alice cancelou o
pedido para te passar o controlo de …» (a quem ia receber), «Bruno passou a
gerir … na app.» (aos outros comproprietários, 'casa.novo_dono') e «Bruno
passou a gerir …: continuas com o mesmo cargo.» (aos colaboradores de quem o
geria, 'colab.novo_dono'); nos dois últimos o nome é o do aviso (quem
recebeu o controlo). O pedido ('transf.pedido') não é linha da atividade:
enquanto está pendente já é um pedido por responder, e contava duas vezes.

## A jornada da vista geral
A vista geral existe para se ver o património de relance, e enquanto não há
movimentos não há nada para ver: quatro indicadores a 0 € e dois gráficos
vazios diziam «não tens nada» com o ar de um relatório, logo a seguir a um
vazio que só pedia um imóvel. Enquanto não há movimentos — e não se é só
colaborador, e o cartão não foi dispensado — a vista geral É a jornada
(painel-geral.js:vDashboard, guia.js:jornadaInicial), a prancheta
M-PrimeirosPassos. Abre com as boas-vindas (guia.js:boasVindas): o olá pelo
primeiro nome da conta, de onde saem os números e por onde se começa — ou se
continua, quando já há passos feitos —; no computador ficam ao lado do
cartão. O cartão dos passos (guia.js:cartaoPassos) diz quantos estão feitos,
também numa barra, e é uma lista, um passo por linha (estilos.css:.jornada,
estilos.css:.jornada-passo, guia.js:linhaDoPasso): o feito riscado, com o
que já se fez; o atual com a faixa cobalto, o círculo cheio, o porquê, o
botão da ação — que diz o quê, «Adicionar imóvel», «Preencher o perfil», e
não um «Fazer agora» (guia.js:passos) — e o do tutorial dele; os que faltam
com o porquê. Só o atual tem botões: decide-se uma coisa de cada vez. Por
baixo do cartão, «Dispensar os primeiros passos» é um botão fantasma. Quando
já há imóveis, vem ainda o cartão do portefólio com o que já tem números
(painel-geral.js:portefolioInicial: o cartão genérico, vistas.js:card, com a
grelha do Portefólio) — sem o «Personalizar painel», que não teria nada
para arrumar (painel-geral.js:dashDepois). O primeiro movimento traz os
indicadores; o cartão dos passos fica no topo até estar tudo feito, ou até
ser dispensado (guia.js:passosDispensados). Os pedidos por responder
continuam por cima de tudo (partilha.js:pedidosDashCard).

Com o cartão dispensado (ou sem passos por fazer) e ainda sem movimentos, os
indicadores a 0 € também não voltam: a vista é um vazio, «Ainda não há dados
para mostrar», com o botão «Ir para os movimentos», mais o mesmo portefólio
(painel-geral.js:vDashboard, marca `<!--sem-movimentos-->`, também sem o
«Personalizar painel»). O «Pede atenção» fica por cima: os por confirmar e os
prazos são o caminho mais curto para o primeiro movimento.

A jornada não exige sessão: sem ela, o passo do perfil não se propõe, e o
resto fica igual. E a marca que a vista deixa no HTML (`<!--jornada-->`) é o
que impede o guia de a inserir segunda vez.

O tutorial de um passo — e os de «Como se faz», na Ajuda — é o cartão
azul-noite da prancheta M-Tutorial (guia.js:guiaPintar,
estilos.css:.guia-cartao): uma região com nome (o leitor de ecrã diz
«Tutorial:» e o nome), o nome com «passo N de M», o título e o texto do
passo, uma fita com um traço por passo — só desenho, que o número já está
escrito — e «Anterior» e «Seguinte» lado a lado; no último, «Terminar». Um
passo leva ao ecrã de que fala, e não abre janelas sozinho. O ✕ tem 44px no
dedo. As camadas são as de sempre: cloud/guia.js:#cwGuia, e o .sobre-janela
quando há uma janela aberta (ver «Espaçamento, raios e sombras»).

O tutorial guarda o seu espaço. O guia.js:guiaAjustar — chamado ao desenhar
o cartão e depois de cada openModal, closeModal e closeAllModals — dá ao body
a classe com-guia (com o cartão aberto) e guia-sobre (com uma janela aberta),
e a altura medida do cartão em --guia-alto; o guia.js:CW.guiaFechar tira
tudo. No telemóvel e no tablet a página ganha espaço em baixo, para o último
registo sair de trás do cartão, e a janela aberta começa abaixo dele: a
folha de baixo encolhe e, no tablet, a janela centra-se no que sobra, com o
par vh e dvh (estilos.css:body.com-guia, estilos.css:body.guia-sobre). O
texto do passo não se esconde: é quando ele faz falta.

## Um gráfico lê-se com o dedo
Tocar numa barra cuspia um balão que aparecia DEBAIXO DO DEDO e ia-se
embora ao fim de 2,2 segundos. Três coisas mal, e todas se veem a usar: a
mão tapa o que se quer ler; o valor desaparece antes de se poder comparar
com o do lado; e ver outro mês obriga a outro toque, com o primeiro já
esquecido.

Agora o dedo percorre o gráfico, uma guia acompanha a coluna mais próxima e
os valores dessa coluna aparecem num cartão FIXO no canto superior direito,
POR CIMA do desenho — no sítio onde a mão não está, e sem sair enquanto o
dedo não sair (graficos.js:mostrarColuna). O gráfico é uma cabeça em grelha —
a legenda à esquerda e o lugar da leitura à direita — e, por baixo dela, a
caixa do desenho, as duas num contentor por onde a leitura se encontra
(graficos.js:cabecaDaLeitura, graficos.js:lugarDaLeitura). Chegou a ser uma
faixa sobreposta ao topo do desenho, a toda a largura: não mexia na altura,
mas tapava as barras mais altas e os valores do eixo. Depois foi um pé
debaixo do eixo, ao lado da legenda: já não tapava o desenho, mas no
telemóvel a mão vem de baixo, e o dedo que percorre o gráfico tapava a
leitura — o Martinho apontou as duas. Por cima, com lugar próprio, nem uma
coisa nem outra. Só a guia é sobreposta. E o gesto é horizontal
(estilos.css:.chartbox com touch-action), para o scroll vertical continuar a
funcionar por cima dele.

O lugar EXISTE SEMPRE, invisível sem leitura: um gráfico não pode mudar de
altura só por alguém lhe tocar. Quem lhe dá o tamanho é um molde escondido
(estilos.css:.chartmolde) com as mesmas linhas que a leitura vai ter — com
TODOS os rótulos e, por série, TODOS os valores escritos, empilhados na
mesma célula (graficos.js:linhasDaLeitura, graficos.js:pilha); a leitura que
se vê fica por cima dele, em absoluto, e não conta para a largura. Por isso
a largura é fixa enquanto se lê — não «dança» de mês para mês com o texto —
e os números vão em tabular-nums. O molde chegou a levar só o texto com mais
letras, e as letras não têm a mesma largura: «jan» e «mai» têm três, o lugar
era o do «jan», e o «mai» saía «m..» no gráfico de linhas. A coluna da
leitura nunca passa de 58% da cabeça (estilos.css:.chartcab), para a legenda
ter o resto. O valor nunca se corta; o nome de uma série, sim, com
reticências — o nome inteiro está na legenda, ao lado. Com uma série só não
há legenda nem nome: a leitura é uma linha (rótulo, bolinha, valor), sozinha
no canto por cima do desenho.

Um título de cartão comprido não colide com nada: está noutra linha, lá em
cima. O que colide são os NOMES DAS SÉRIES — os créditos levam o nome que o
senhorio lhes deu. Com um nome de mais de 16 letras, ou mais de quatro
séries, a cabeça empilha (graficos.js:cabecaEmpilha): a legenda toma a
largura toda e parte os nomes em linhas, e a leitura fica por baixo dela, no
mesmo canto, logo acima do desenho.
Com muitas séries a leitura mostra-as TODAS, uma por linha: mostrar quatro e
«+N» escondia o que o gráfico existe para mostrar (a dívida de cada crédito,
e o Total, que é o último); duas colunas partiam ao meio a largura de nomes
que já são o problema; e rolar não dá, o dedo está ocupado a percorrer o
gráfico. O preço é altura, e essa é constante.

Um gráfico pode nascer com a leitura acesa. O cabecaDaLeitura aceita ler, o
índice de uma coluna: a leitura nasce escrita nessa coluna e fica acesa
(.chartler.fixa, data-ler); o dedo troca-a enquanto percorre e, ao largar,
ela volta à coluna fixa (graficos.js:lerColuna, graficos.js:largarLeitura).
O cBars aceita também destaque, a faixa suave do cobalto por trás de uma
coluna (a .gdestaque, a primeira forma do desenho). A Visão geral usa os dois
no mês corrente — ou no último antes dele com movimento, que no dia 1 o mês
ainda está vazio —, como o canvas («out 2026 · Receita …»), e o cashflow
acumulado acende o mês corrente. O cBars aceita ainda desceAoContrario: os
segmentos negativos empilham pela ordem inversa, e a legenda e a leitura
ficam como estavam. Os dois gráficos mensais têm 150 de altura
no desenho (painel-geral.js:GRAF_ALTURA): ~150px no telemóvel, ~235px em
meio ecrã de computador.

No donut, o centro diz o total e o ano; a legenda da Visão geral diz o nome
e a parte, sem o valor de cada fatia, que espremia os nomes num terço de
ecrã. O cHBars aceita sub, a segunda parte do nome, mais apagada («Ana · T2
Lisboa»), e pinta o negativo a laranja (var(--out)), nunca a vermelho
(graficos.js:cHBars).

O eixo dos valores tem marcas redondas (graficos.js:axisY,
graficos.js:marcasDoEixo): múltiplos de 1, 2 ou 5 vezes uma potência de dez,
e 2,5 a partir dos milhares; cinco no máximo; sempre com o zero, que é onde
está a linha mais forte. Cada marca fica à sua altura pela mesma conta do Y()
de quem chama, e o intervalo dos dados não se alarga. Sem fmt, o
graficos.js:kfmt escreve o eixo inteiro na mesma unidade — em milhares quando
a maior marca chega aos mil —, com as casas do passo e o menos tipográfico.
Partido em quartos exatos, o eixo dizia «1,7k · 575 · -529 · -1,6k», com o
hífen e o zero sem rótulo.

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

E o balão desapareceu de vez. No donut, a legenda ao lado já tem o rótulo e
a percentagem de cada fatia (e o valor, fora da Visão geral); nas barras
horizontais, cada linha já
tem o nome e o número escritos por cima. O balão repetia o que já se lia e
cobrava caro: roubava o toque — no donut há uma ação a sério, entrar na
categoria — e, por ser um ponto de toque, fazia de cada forma uma paragem do Tab
sem destino.

Por isso as formas não têm toque próprio, e o gráfico tem uma descrição só
(graficos.js:descricaoDoGrafico). Toque só no que leva a algum lado: as
fatias do donut e os itens da legenda com onPick, que entram na categoria
(graficos.js:cDonut, graficos.js:legend). A história — 37 formas alcançáveis
pelo Tab, e zero depois — está no diário, a 2026-09-08.

As barras da dívida dos Créditos usam a mesma cabeça e o mesmo gesto, sem
legenda (uma série sem nome: a leitura de uma linha) e com a leitura acesa
no ano corrente (creditos.js:credBarrasLer; ver «Os Planeados, os Créditos e
a Agenda»).

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
só FALA se o texto do cartão for exatamente igual ao do ano escrito com o
formatador do próprio cartão — o fmtValor da série quando o há, senão o fmt
dela (vistas.js:falaDoMesmo). A Visão geral escreve o valor com os cêntimos
e a faixa ao euro («29 910,00 €» e «2025: 27 690 €», como o canvas), e por
isso passa o fmtValor. A segunda guarda é a que se verifica
a si própria, e apanha o caso em que alguém mude um cartão sem se lembrar
da marca.

E diz o número de que fala. «face a 2025» nomeia o ano e não o termo de
comparação; «2025: 4 400 €» ao lado de 2 200 € dispensa a pergunta. A cor
da seta diz se é bom, e por isso nos custos fica neutra (ver «A Visão
geral»).

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

O selo (cloud/entrada.js:setSyncBadge) tem quatro estados, e o que os separa
é quanto tempo ficam. «A ligar ao servidor…» é laranja, com um relógio na
base da nuvem: aparece desde a abertura com sessão, antes do primeiro
/api/state, e outra vez em cada nova tentativa depois de uma falha, e fica o
que a tentativa durar — no máximo o tempo-limite do pedido
(cloud/nucleo.js:TEMPO_API). «Guardado» é verde e é um recibo: aparece e sai
ao fim de dois segundos, porque um letreiro permanente deixa de se ler. «N
alterações por enviar» é cobalto e fica enquanto houver — é o estado que
faltava, e o número é o das operações que o próximo envio vai levar
(cloud/nucleo.js:pushNow), não uma estimativa. «Sem ligação ao servidor» é
vermelho, com uma cruz dentro da nuvem — sem rede, ou sem resposta a tempo —
e fica até à tentativa seguinte. Uma recusa do servidor (um 429, um 5xx) não
é falta de ligação: o servidor respondeu, fica «N alterações por enviar», e a
frase do servidor diz-se num toast (cloud/nucleo.js:avisoDoServidor). Sem
sessão o selo não existe: sair esvazia-o (cloud/nucleo.js:encerrarSessao).
O laranja é o --out, e não o --warn, que é âmbar acastanhado e se
confundia com o vermelho ao lado; os pares (--out sobre --out-soft,
--danger sobre --danger-soft) dão 4,5:1 ou mais nos dois temas. O relógio
não roda: o estado diz-se pela cor e pelo desenho.

Quem decide é o núcleo, em três sítios: cloud/nucleo.js:tentarLigar antes de
cada conversa (só põe o «A ligar» se a última falhou, ou se ainda nenhuma
acabou nesta sessão — com a ligação de pé, a leitura de três em três minutos
não pisca nada), cloud/nucleo.js:ligou quando o servidor responde (com dados,
com um 304 ou com uma recusa) e cloud/nucleo.js:caiuALigacao quando não
responde. Sem ligação, o ciclo de 30 segundos tenta outra vez a cada volta,
sem esperar pelo intervalo de leitura (cloud/nucleo.js:syncCycle) — que
depois de uma hora parada é de meia hora, e o selo ficava vermelho esse tempo
todo com a rede já de volta —, e uma tentativa por ciclo: se o envio já
tentou, a leitura não vai atrás dele. O voltar online e o voltar à frente
também são tentativas. No arranque o selo nasce «A ligar» e quem o tira é a
leitura do estado; o /api/me a falhar não o põe em «Sem ligação», porque
isso o fazia piscar, e mentia se só o /api/me tivesse falhado.

O leitor de ecrã ouve as mudanças (o #hdrSync é um role=status), mas não a
roda das tentativas: sem rede, de 30 em 30 segundos, o selo passa a «A ligar»
e volta a «Sem ligação», e a tentativa e a falha repetida mudam-no com o
aria-live desligado. O mesmo selo duas vezes seguidas não se refaz nem se
anuncia. À vista diz «Sem ligação ao servidor»; o «— sincroniza mais tarde»
fica no aria-label e no title, porque com ele a frase comia o título do ecrã
no computador estreito.

E vive no cabeçalho ao lado do título, nunca em cima de outra peça dele:
esteve no canto superior direito, que é onde o sino mora, e ninguém tinha
dado por isso porque nenhuma cena do percurso o mostrava — só aparecia
quando a ligação caía. Há uma cena por estado e uma regra que guarda o sítio
(testes/ui/invariantes.js). No telemóvel o selo é o ícone, e as frases que
ficam — «por enviar» e «sem ligação» — descem para uma faixa fina por baixo
do cabeçalho, a toda a largura, e o cabeçalho cresce o que ela ocupa (ver
«Navegação»). O «A ligar» da abertura é só o ícone: a faixa a entrar e a
sair em cada abertura fazia o cabeçalho saltar duas vezes por nada. Mas uma
nova tentativa depois de uma falha herda a faixa que lá está, agora laranja
(a classe .tenta, estilos.css:header.top) — sem isso o cabeçalho encolhia e
crescia de 30 em 30 segundos enquanto a rede não voltasse.

## Uma porta, e nenhum beco
As opções de um registo — editar, duplicar, apagar, selecionar vários —
têm uma porta visível, o ⋯ (componentes.js:menu): o da janela de cada
ficha e de cada formulário, e o das poucas linhas que agem sem abrir nada
(as por confirmar, as categorias, as tarefas). As linhas das listas não
têm porta própria: tocar abre a ficha, e a linha, focável, é o caminho
visível do toque longo (ver «Padrões de página»); em seleção, é a barra do
fundo.

A porta é uma classe só (estilos.css:.opcoes): o mesmo ícone, o nome
«Opções» — sem nome, um leitor de ecrã anuncia «botão» e mais nada — e uma
caixa **dada**, 44×44, não calculada: com padding, o alvo saía do tamanho
do ícone mais a entrelinha do texto à volta, e dava 36×40 sem ninguém ter
pedido nada disso. O percurso mede-o em cada cena: quem chama lpMenu ou
menuOpen tem de ser esta porta (testes/ui/invariantes.js). Sem essa regra,
o próximo botão de opções nasce com outro desenho e ninguém dá por ele até
alguém tentar usar a app sem saber que o toque longo existe.

O botão redondo do canto também ganhou nome (vistas.js:fab). Tinha
`title`, que o rato mostra e o teclado não, e quando havia várias ações
nem isso — o botão que abre o leque anunciava-se «botão».

Um ecrã que diz «não há nada» e não diz por onde se começa é um beco.
Cada vazio tem o botão da sua ação, à vista, dentro da própria caixa
(vistas.js:saida) — o molde que as visitas já usavam. Primeiro foram os
quatro sítios onde não havia caminho nenhum: avaliação sem imóveis
(avaliacao.js:vReports), contratos sem imóveis e projeções sem contratos
(lista-contratos.js:vContracts, projecoes.js:vProjections) e hipotecas sem
imóveis (creditos.js:vCredits) — esta última com um botão que só dava um
aviso a dizer que faltava um imóvel, e um caminho que acaba num aviso não
é um caminho. Depois todas as listas, mesmo as que tinham FAB: o botão do
canto — e, no telemóvel, o + da barra de baixo (navegacao.js:abrirAdicionar)
— é um caminho que quem chega de novo não associa ao ecrã vazio, e a vista
geral já mostrava que um botão verde no meio do vazio é o que se toca. A
condição é a do FAB dessa lista (acessos.js:casasComo): sem poder adicionar
não há botão, e «Nada neste filtro» nunca o tem.

## Um aviso não tapa o que se pede para carregar
O toast mora a 22px do fundo, que é exatamente onde o rodapé de um modal
está: com um modal aberto, caía em cima de «Guardar» e «Cancelar». Sobe
a altura do rodapé que está aberto, medida e não adivinhada — há rodapés
de duas linhas (componentes.js:toast; estilos.css:.toast, o --acima). A
barra de baixo é o mesmo caso: sem rodapé de janela, o aviso sobe para cima
dela quando está à vista (componentes.js:avisoAcimaDoRodape mede o #tabbar),
e em seleção sobe acima da barra das ações (estilos.css:.sel-fundo), que lá
está no lugar dela. E o que fica por baixo do aviso vê-se puxando-o para
baixo (ver o comDesfazer, em «Componentes da casa»).

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

Uma ficha mostra o que se sabe: uma linha sem valor não aparece, porque um
rótulo com um traço à frente é ruído a fingir que é informação. As fichas do
movimento, da hipoteca, do planeado e do modelo escrevem o corpo com
componentes.js:ficha, que recebe linhas e deita fora as vazias, nas mesmas
`.stat` que a app já usa em toda a parte (estilos.css:.stat). As que o canvas
de 2026-10 redesenhou — o imóvel (imovel.js:propFicha), o contrato
(contrato.js:ctFicha), a pessoa (pessoas.js:personFicha) e a visita
(visitas.js:visFicha) — já não passam por ele e têm as peças do canvas:
cartões com um título e linhas rótulo/valor, em que uma linha com uma
ligação toca toda (contrato.js:ctSecao, contrato.js:ctKv, pessoas.js:pesCartao,
pessoas.js:pesKv, visitas.js:visKv).
A regra é a mesma: sem valor não há linha, e sem linhas não há cartão.

O título e o corpo são **funções**, e não texto (componentes.js:abrirFicha).
O formulário abre-se por cima da ficha, e quem guarda por cima deixava-a a
dizer o que já não é verdade. Assim a ficha volta a ler a base sozinha
(componentes.js:refrescarFichas, chamada no fim de cada render — o sinal que
a app já dá quando alguma coisa mudou): ver, editar, e voltar ao que se
estava a ver, já mudado. O «depois» de uma ficha que pinta alguma coisa pelo
id — as miniaturas, a capa — recebe a raiz da própria camada, que o
abrirFicha devolve: o refrescarFichas repinta as fichas também com outra
janela por cima, e o componentes.js:paintThumbs sem raiz procura na janela
de cima (imovel.js:propView guarda a camada e passa-a).

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
   passa a poder trazer uma `sig` própria (lista.js) — no grupo, o imóvel, o
   nome e o que o imóvel é (vago, por quartos e quantos estão arrendados). O
   interior já se compara a si próprio; o exterior compara o que é dele.

E o ajudante pinta **de fora para dentro**: as listas registam-se de dentro
para fora, porque o html do interior tem de estar pronto antes de o exterior
o receber, e nessa ordem o contentor interior ainda não existe no DOM quando
lhe chega a vez.

Medido com 12 imóveis e 120 contratos, a filtrar: 70 mantidas, 62 removidas,
**0 criadas e 0 refeitas** — e 33,6 ms contra 59,8 ms do render.

Há uma ficha por registo: o imóvel (imovel.js:propFicha), o contrato
(contrato.js:ctFicha), o movimento (movimento.js:txFicha), a pessoa
(pessoas.js:personFicha), a visita (visitas.js:visFicha), a hipoteca
(creditos.js:mortFicha) e o planeado com o seu modelo
(planeados.js:recFicha, planeados.js:tplFicha). Cada uma abre pela pergunta
que traz alguém lá: um contrato pergunta-se se ainda está em vigor e quando
acaba; um movimento, o que foi e quanto disto é meu; um inquilino, onde mora
e se a renda está em dia; uma visita, quem vem e quando; uma hipoteca,
quanto falta e a que taxa.

A ficha do imóvel é a prancheta M-Imovel (imovel.js:propFicha), por esta
ordem: a capa a toda a largura, com o «N fotos», que abre a galeria
(imovel.js:imvCapaDaFicha, imovel.js:imvGaleria); a morada, os selos e a
linha dos donos com as quotas e quem deve a quem (imovel.js:imvTopoDaFicha,
saldos.js:settlePlan); a nota de quem colabora
(imovel.js:imvNotaDeColaborador); as ações rápidas
(imovel.js:imvAcoesRapidas); o cartão dos números
(imovel.js:imvNumerosDaFicha); e os cartões — os por confirmar, os quartos ou
o contrato, as hipotecas, as despesas fixas, as tarefas, os dados registais e
fiscais e o anúncio. O registo diz «descrição predial n.º …», e não «n.º …»
sozinho, na ficha e no resumo da dobra do formulário (imovel.js:imvRegistais).
O título é o da janela e o «Editar» o do rodapé, só para quem pode
(imovel.js:propView, componentes.js:fichaRodape), como nas outras fichas; o
Apagar está no ⋯ da janela. No computador a janela alarga até 940px e os cartões vão em duas colunas (estilos.css:.imv-ficha, e a regra
.sheet:has(.imv-ficha)).

O «Apagar imóvel» está no ⋯ de toda a ficha, também na de um imóvel que não
criei (imovel.js:imvPossoApagar), e no ⋯ do formulário e no toque longo.
Quem o criou apaga-o (imovel.js:delProp, com o Anular). Quem não o criou —
colaborador, ou comproprietário por uma ligação ou por um grupo — sai dele
(imovel.js:imvSair; o delProp encaminha para lá): apagar da minha lista um
imóvel de outra pessoa é dizer que não quero continuar nele. A confirmação
chama-se «Apagar «Nome»», com o botão vermelho de sempre, e diz o que se
perde e como se volta (imovel.js:imvFraseSaida). Ao colaborador: as
permissões neste imóvel são retiradas, o que registou fica com o dono, não se
desfaz, e para voltar pede ao dono um convite novo. Ao comproprietário: as
permissões são retiradas, a quota vai para os que ficam na proporção das
deles (imovel.js:imvFraseDaQuota), os saldos e o IRS passam a contar com as
quotas novas também nos movimentos já registados, e para voltar quem o criou
tem de o partilhar outra vez. Não há Anular: a saída é no servidor
(cloud/partilha.js:CW.sairDaCasa). Só depois da resposta aparece o aviso
«Saíste de Nome.», as janelas fecham, os filtros que apontavam para o imóvel
limpam-se e o estado relê-se; o imóvel nunca sai da base à mão. Um erro diz a
frase do servidor e não muda nada.

Com fotos, a capa toda da ficha abre a galeria (imovel.js:imvCapaDaFicha,
estilos.css:.imv-capa-abre): quem vê uma fotografia toca nela. É um botão
irmão do «N fotos», por baixo dele e por cima da fotografia — nunca um botão
dentro de outro. Para o teclado e o leitor de ecrã a porta continua a ser o
«N fotos», que diz quantas há: o da capa fica fora do Tab (tabindex -1), com
nome («Ver as fotos»), para não haver duas paragens seguidas que fazem o
mesmo. O premido escurece a capa com o --veu; o passar por cima só com rato.

As fotos de um imóvel andam em carrossel. Na janela de uma foto, arrastar de
lado passa à seguinte ou à anterior das fotos desse imóvel, com volta:
depois da última vem a primeira, e antes da primeira a última
(web/app/anexos.js:fotoCarrossel, web/app/anexos.js:fotoVolta). O «3 de 8»
fica por baixo da foto, antes do tamanho e da data, e o título da janela é o
nome da foto de agora («Foto 3» sem nome); o «Guardar» guarda a que está à
vista (web/app/anexos.js:fotoGuardar). Entram as fotos do imóvel a que a foto
pertence, só as imagens, pela ordem dele — a primeira é a capa
(web/app/anexos.js:fotosDoImovel); vinda do formulário do imóvel (as
miniaturas do componentes.js:fileBlock, que chamam `openMeta(id,true)`), a
fila é a do formulário, com as fotos ainda por gravar e a ordem que lá
estiver. Um imóvel com uma foto só, e os anexos de imagem que não são fotos
de imóvel (contratos, pessoas, hipotecas), abrem sem carrossel: setas e «1
de 1» sem para onde ir eram ruído.

As miniaturas em memória são sempre as de 220px (componentes.js:makeThumb),
nunca o original: uma foto de câmara de 12 MP descodificada são uns 48 MB, e
dez numa caixa de 64×52 punham o telemóvel a arrastar-se a cada repinte. Ao
escolher fotos, a miniatura começa logo a partir do ficheiro na mão
(web/app/anexos.js:takeFiles, componentes.js:fazerMiniatura); até ela chegar, a caixa
mostra o marcador de sempre (o fundo --chip da .pth). Fazem-se duas de cada
vez (componentes.js:naFilaDasMiniaturas), e um pedido a caminho serve quem
pedir a mesma foto (componentes.js:pedirMiniatura). Uma imagem que o browser
não encolhe só vai inteira para a caixa se for leve, até 1 MB
(componentes.js:miniaturaDoBlob); senão fica o marcador. O carrossel continua
a mostrar a foto inteira.

As miniaturas também vivem na nuvem. A de 220px que um aparelho faz (guardada como
tn_<id>) sobe para /api/files/<id>/miniatura depois do original (cloud/anexos.js:
subirMiniatura), e noutro aparelho o thumbSrc pede-a ao servidor antes de pensar no original
(cloud/anexos.js:baixarMiniatura, pelo idbGet embrulhado): pintar dez caixas são dez
pedidos de ~10 KB, não dez fotos de câmara. Sem ela no servidor — uma foto de antes, ou de
quem não a pôde subir —, cai no original como antes, faz a miniatura e sobe-a, uma vez: o
aparelho seguinte já não descarrega o original. O carrossel continua a abrir a foto
inteira. A arrumação do arranque guarda o tn_ de cada anexo que fica
(web/app/anexos.js:cleanFiles).

Uma foto que demora a chegar diz que está a chegar. Enquanto a miniatura de uma
caixa não chega (as caixas th_<id>: a .pth do formulário, as capas da lista e da
ficha, a galeria, o registo fotográfico do contrato), a caixa mostra um anel que
roda, centrado (componentes.js:paintThumbs, componentes.js:anelEnquanto). Só
aparece se a espera passar de 150 ms (componentes.js:ANEL_ESPERA_MS): o que já
está no aparelho — o thumbCache, o tn_ do IndexedDB — chega antes disso e não
pisca; uma que está em memória nem arma o temporizador. O anel vive exatamente o
que a promessa viver: sai quando a miniatura chega e quando falha (fica o fundo
de sempre). Enquanto roda, a caixa diz aria-busy="true". Cada caixa ouve só a
espera mais recente (um lugar do carrossel que passou a outra foto não perde o
anel quando a de antes chega).

O carrossel abre no toque, sem esperar pela foto inteira
(web/app/anexos.js:openFileMeta): noutro aparelho ela desce do servidor
(cloud/anexos.js:baixarAnexo), e esperar antes de abrir era um toque sem
resposta durante segundos. Cada lugar da fita cuja foto inteira ainda não está
na janela mostra a miniatura por baixo, esticada (web/app/anexos.js:
fotoMiniaturaPorBaixo — a do thumbCache, ou a que o thumbSrc já tem a caminho;
o URL é do thumbCache, não entra no c.urls da janela) e o anel por cima, com o
mesmo limiar (web/app/anexos.js:fotoPintar). Quando a inteira chega, troca-se o
src (o browser só larga a miniatura quando a inteira está pronta); se não
existir, o palco diz «Esta foto não está neste aparelho.», como antes. Um imóvel
com uma foto só e os anexos de imagem que não são fotos de imóvel continuam a
abrir depois do blob (ver «Dúvidas»).

O anel é CSS (estilos.css:.a-carregar::after, no bloco «fotos a carregar»): é a
roda da espera da casa (estilos.css:.roda — o @keyframes roda, a --volta,
linear), com 22px, o traço no --line2 e o arco no --accent — o estado vê-se pela
cor da frente (o contorno), que o escuro forçado do Samsung não apaga —, num
disco do --card com uma auréola de 2px, para se ler em cima do mosaico e de uma
fotografia. Tamanho fixo, absolute e pointer-events:none: não empurra nada nem
apanha toques. Entra a desvanecer (veuEntra, --rapido, --curva) e sai de uma
vez, quando a imagem o tapa. Na .pth de 64×52 do formulário sobe para 6px do
topo, para não ficar por baixo da etiqueta «capa». Sem movimento
(prefers-reduced-motion) fica parado.

Reordenar as fotos no formulário: a linha agarrada segue o dedo e as outras
abrem o lugar (imovel.js:photoDragMove, ouvido só no documento — uma vez por
movimento). Ao largar, a linha troca de lugar no DOM e os transforms limpam-se
com a transição desligada (estilos.css:.pousar), por isso as vizinhas não se
mexem; a largada parte de onde o dedo a deixou e assenta no lugar novo no
--rapido e na --curva-entra (imovel.js:photoAssenta). Um dedo que pega numa
linha a meio do assentar apanha-a já no sítio (imovel.js:photoAssentaPara).
Sem movimento, pousa logo. Largar só lê os nomes das fotos
(imovel.js:photoLerNomes): nada mais mudou no formulário. Perto do topo ou
do fundo da área que rola (56px), ela rola sozinha, mais depressa quanto mais
perto da borda e no máximo 18px por quadro, como no arrasto das tarefas
(imovel.js:photoDragRolagem, imovel.js:photoDragPasso): a foto fica debaixo do
dedo e o lugar onde cai conta com o que rolou (imovel.js:photoDragPintar), e a
rolagem pára fora da zona, no fim do que há para rolar e ao largar. É o dedo
que a manda, e por isso vale também com o movimento reduzido.

O nome de cada foto é uma caixa de texto de uma linha que quebra a linha: um
nome comprido vê-se inteiro, até três linhas, e depois rola dentro dela
(estilos.css:.pnm). Continua a ser um nome de uma linha: o Enter acaba a
escrita em vez de abrir uma linha nova (componentes.js:fotoNomeTecla), e o que
se cola com quebras fica com espaços (componentes.js:fotoNomeEscrito). A
miniatura e os botões ficam no topo da linha.

O palco tem tamanho fixo — quadrado, até 60% da altura do ecrã — e cada foto
cabe lá inteira (object-fit:contain), sobre o --tint (estilos.css:.fc-palco):
com fotos ao alto e ao comprido no mesmo imóvel, uma janela à altura de cada
foto saltava a cada passagem, e a fita não corre numa caixa que muda de
tamanho a meio. A fita tem três lugares (a anterior, a de agora e a
seguinte), separados pela --fc-folga; no fim de cada viagem os lugares rodam
(web/app/anexos.js:fotoRodar), e quem já lá estava não volta a carregar. Só
ficam presos os object URLs das três fotos da fita, e todos se soltam quando
a janela fecha.

O gesto segue as regras do calendário e dos separadores
(calendario.js:calArrastar, navegacao.js:sepArrastoMove): o eixo decide-se aos
10px e a folga de decidir não conta (web/app/anexos.js:fotoEixo); um gesto que
começa na vertical é do corpo da janela, que rola (touch-action:pan-y no
palco); largar depois de um quarto da largura, ou com um sacudir para o
mesmo lado, passa (web/app/anexos.js:fotoDecide); antes disso a foto volta ao
sítio no --medio e na --curva-entra. O clique que vem a seguir a um arrasto
engole-se (navegacao.js:sepEngolirToque). O rato também arrasta. Um dedo que
pousa numa foto a meio da viagem apanha-a onde ela está, e uma seta tocada a
meio de outra continua dali (web/app/anexos.js:fotoParar) — sem salto. O
deslizar entre separadores não rouba o gesto: com uma janela aberta, o
navegacao.js:sepEstadoLivre já diz que não.

A viagem pelas setas parte parada, na --curva-fita e no --lento (como a fita
das listas); largada por um dedo já vem a andar, e acaba na --curva-entra e
no --medio, que arranca no máximo — com a --curva-fita havia um travão no
instante em que o dedo saía (web/app/anexos.js:fotoCorrer). As setas ‹ ›
(44px, «Foto anterior» e «Foto seguinte») veem-se só no computador, com rato;
no dedo ficam só para o leitor de ecrã, e aparecem quando o Tab lá chega. As
teclas ← e → passam sem fita — um atalho de teclado não anima
(web/app/anexos.js:fotoTecla) — e não mexem num campo de texto. As vizinhas
são aria-hidden; o «3 de 8» é aria-live polite; o palco é um grupo com
aria-roledescription «carrossel». Sem movimento (prefers-reduced-motion) a
foto não segue o dedo e a troca é de uma vez, como nos separadores.

As ações rápidas são chips, só os que o cargo e os serviços ligados deixam.
O primeiro é «Movimentos · N»
(tx.view, os Movimentos filtrados pelo imóvel, com quantos tem), aceso a
cobalto (estilos.css:.imv-acoes .chip.destaque): é o que mais se procura na
ficha, e no fim da fila, que rola de lado, ficava fora de vista. Depois, ao
dono: «Novo contrato» (num imóvel de arrendamento, contract.add), «Registar
despesa» (tx.add) e «Pagamento de crédito» (com uma hipoteca viva e o
acessos.js:motivoCredito vazio; com uma só, já vem escolhida). A quem
colabora, as do cargo (acessos.js:acoesNoImovel). Um chip que muda
de ecrã fecha antes a ficha (imovel.js:despesaNoImovel,
imovel.js:pagamentoNoImovel, imovel.js:verMovimentosDoImovel).

Os por confirmar do imóvel (imovel.js:imvPorConfirmar) usam as perguntas
públicas dos Planeados (recActive, recIsLate, recusaConfirmar, recSemCredito,
recCreditoPago): tocar no bloco do texto revê (confirmRec;
estilos.css:.imv-pend>.imv-linha-txt.tap), o «Confirmar», irmão dele e não
filho, confirma de um toque (quickConfirmRec), e nada aparece antes do servidor
(espera.js:sabemosOEstado). O planeados.js:pendingCard não filtra por imóvel;
se um dia filtrar, a ficha pode passar a usá-lo. Os quartos
(imovel.js:imvQuartos) dizem «N de M arrendados» e, quarto a quarto, o
contrato — quem lá mora, até quando ou desde quando, a renda —, e tocar
abre-o; um quarto livre diz «Livre», com «Marcar visita» e «Novo contrato»
para quem pode, e o «Novo contrato» abre o formulário já nesse quarto
(imovel.js:contratoNoQuarto: acende o chip pelo contrato.js:ctEscolheQuarto,
só se o formulário abriu mesmo, e volta a fotografar a janela, para ela não
contar como mexida). O «Marcar visita» abre a visita com esse quarto
(acessos.js:marcarVisitaNoImovel recebe o quarto e passa-o ao
visitas.js:visitModal com o imóvel): foi aí que se tocou, e com a casa
inteira por omissão, num imóvel com dois quartos livres, era preciso
escolher de novo. Os outros chamadores, sem quarto, abrem só com o imóvel. Num imóvel inteiro o cartão é o do contrato
(imovel.js:imvContratos). Cada hipoteca tem o seu cartão, com o tipo de taxa
num selo roxo, a taxa, as prestações por pagar, a prestação, o que está em
dívida hoje, o plano de amortização e a ficha da hipoteca com os documentos
(imovel.js:imvHipotecas). As despesas fixas são linhas com quando se pagam —
as prestações do IMI pela lei (planeados.js:imiPrestacoes) — e quanto
(imovel.js:imvFixas).

A ficha do contrato é a prancheta M-Contrato (contrato.js:ctFicha), pela
ordem das perguntas que trazem alguém lá. O topo (contrato.js:ctTopoDaFicha):
o selo do estado, o imóvel com a parte, e o período com a barra do tempo
decorrido (a largura pelo data-largura, estilos-calculados.js). Cada coisa
diz-se uma vez: com a barra, o selo diz só «Em vigor» e os dias que faltam
ficam por cima dela — a tabela da lista continua a juntá-los ao selo
(lista-contratos.js:ctSeloDoEstado). Um contrato por começar diz «Começa a
…», nunca «Desde …» com uma data futura (contrato.js:ctTopoDaFicha,
lista-contratos.js:ctPeriodo; ver «Um contrato tem três estados»). Os cartões
dos prazos que já avisam — os mesmos do sino —, cada um com o título e a
data, o selo do que falta, a frase do sino, Renovar e Terminar na oposição e
no fim, e o ✕ que silencia (contrato.js:ctPrazosDoContrato,
contrato.js:ctPrazoDaFicha, prazos.js:pzSilencia). Os valores
(contrato.js:ctValoresDaFicha): a renda, o imposto e a líquida em três
números, o pagamento, a próxima renda, as rendas registadas e o aumento, com
«Registar renda» e «Ver movimentos» (contrato.js:ctVerMovimentos) — todos
com cêntimos (formato.js:euro2), a caução incluída, como na folha do PDF. A
renda planeada tem os três estados dos Planeados
(contrato.js:ctRendaPlaneada): «Próxima renda … · planeada» antes do dia,
«· por confirmar» com a janela do pagamento aberta e, com ela fechada
(planeados.js:recIsLate), «Renda em atraso · desde …» a vermelho (.perigo),
com «· silenciada» quando o está. Nunca se chama «próxima» a uma renda em
atraso. «Perante
a AT» (contrato.js:ctAtDaFicha): o selo do estado, o número, a finalidade, a
celebração, as renovações, os recibos eletrónicos das rendas do ano, o
quadro do Anexo F e as notas do IRS. Os inquilinos
(contrato.js:ctInquilinosDaFicha): as iniciais, o telefone e o email como
ligações, cada uma na sua linha e com 44px de altura no dedo
(estilos.css:.ct-pessoa-txt, o a) — só a quem pode ver inquilinos —, o
selo do cartão de cidadão (contrato.js:ctSeloDoCc) e a porta para a ficha
da pessoa. A caução e o que ficou combinado (contrato.js:ctCaucaoDaFicha);
as tarefas (tarefas.js:tfLinhaDaFicha); as notas; os mosaicos do inventário, das
chaves, das fotos e dos anexos, que abrem a lista
(contrato.js:ctAnexosDaFicha, contrato.js:ctVerAnexos); e «Gerar contrato em
PDF», que abre a folha dele (ver «Os Contratos»). O «Editar» é o do rodapé,
só para quem pode (componentes.js:fichaRodape), e quem não pode lê porquê
logo à cabeça. No computador a janela alarga até 900px e os cartões vão em
duas colunas (estilos.css:.ct-ficha, estilos.css:.ct-grelha, e a regra
.sheet:has(.ct-ficha)).

A ficha da pessoa (pessoas.js:personFicha) é a do inquilino ou a do
proprietário (pessoas.js:pesFichaInquilino, pessoas.js:pesFichaDono; os
canvas M-Inquilino e M-Proprietario). O título é o da janela e o «Editar» o
do rodapé, só para quem pode (pessoas.js:personEditavel,
componentes.js:fichaRodape); o ⋯ fica só com o Apagar. O perfil de outro
proprietário com conta só o edita quem tem a conta — o db.owners refaz-se dos
perfis do servidor a cada leitura (cloud/nucleo.js) —, e nenhuma porta de
lado abre o formulário que se perdia na leitura seguinte: o
pessoas.js:personModal com o id dele abre a ficha (pessoas.js:personView),
como já fazia com um inquilino que não se pode alterar, e a folha das opções
(lista-pessoas.js:lpPessoa, que o lpMenu abre) segue a mesma regra, sem
«Editar ficha» nem «Apagar»; sem opções nenhumas, o aviso diz de quem é o
perfil, e não que é o cargo que não deixa (componentes.js:lpShow). No meu
perfil, o «Editar» e o «Editar ficha» abrem o «O meu perfil» da nuvem, com
o indicativo (cloud/utilizadores.js:CW.editProfile); sem a nuvem, a ficha
local.

A do inquilino, por esta ordem: o avatar com «Inquilino» e os selos — o do
contrato («Com contrato em vigor» verde, «Contrato por começar» cobalto,
«Contrato terminado» ou «Sem contrato» cinzento), «Renda em atraso» e o
cartão de cidadão a caducar —; as ações rápidas em chips
(estilos.css:.pes-acoes), «Ver contrato» (o em vigor, ou o que vai começar)
e «Novo contrato» já com a pessoa, pelo mesmo critério da folha das opções;
«Mora em», com uma linha por contrato em vigor — onde, desde e até quando,
a renda e o estado dela (em dia verde, por confirmar cobalto, em atraso
vermelho) —, que toca para o contrato (pessoas.js:pesLinhaContrato); «Vai
morar em»; os «Contactos», que
ligam e escrevem (pessoas.js:pesLinhasDaPessoa); a «Identificação» — o NIF,
com o aviso por baixo quando não bate certo, o cartão de cidadão com a
validade — que se lê mesmo sem o número, porque no formulário são campos à
parte —, a data de nascimento, o estado civil no género da ficha
(pessoas.js:pesEstadoCivil), a nacionalidade estrangeira, o país, a
retenção na fonte e a morada fiscal —; os «Documentos», que abrem, com o
tamanho, e «Adicionar documentos» a quem pode alterar a ficha e juntar
anexos (pessoas.js:pesEscolherDocs, pessoas.js:pesJuntarDocs: o campo dos
ficheiros nasce fora da janela, porque uma ficha não tem campos); as
«Notas»; e os «Contratos anteriores».

A do proprietário: o avatar com «Proprietário» e o selo da conta («O teu
perfil», ou «Tem conta Rendorium» noutro com conta); no perfil de outro com
conta, que só ele edita, o botão do rodapé é «Editar casas partilhadas»
(pessoas.js:casasPartilhadasDaFicha): com uma ligação ativa abre as «Casas
partilhadas» dela, sem ligação os meus imóveis do grupo partilhado em comum
(cloud/grupos.js:CW.casasDoGrupoCom, com a escolha do grupo quando há mais de
um), e sem partilha nenhuma não há botão. Com uma ligação ativa, o ⋯ do
cabeçalho, ao lado do X, tem «Remover ligação» (pessoas.js:removerLigacaoDaFicha,
pelo gancho pessoas.js:partilhaComDono, que a nuvem preenche com o id da
ligação), com a confirmação de sempre (partilha.js:CW.delConn); só por grupo,
num convite por aceitar ou no meu perfil, não há. Removida, a ficha fecha se
ele saiu da lista (partilha.js:fecharFichaDeQuemSaiu); se fica por um grupo,
repinta-se sem a opção e o rodapé passa ao do grupo. As contas entre proprietários, laranja suave a
pagar e verde suave a receber, com o plano de acerto em que ele entra e
«Acertar contas» (vistas.js:settleModal), com os Movimentos ligados;
«Imóveis e quota-parte», cada imóvel a abrir a sua ficha, com a renda que
lhe cabe por baixo; e «Contactos e identificação».

A ficha da visita (visitas.js:visFicha, o canvas M-VisitaFicha) diz quando,
por extenso, com o dia da semana e o «há 2 dias» (visitas.js:visQuando), e
os selos; numa realizada com interesse, o convite a converter em inquilino,
com o botão, só com os Inquilinos ligados e a permissão (o critério do
visitas.js:visOpcoes); o imóvel, o quarto, o contacto, que liga ou escreve
(visitas.js:visLigacao), e quem a marcou; os comentários; e até quatro das
outras visitas que vêm ao mesmo imóvel. O «Converter em inquilino» continua
também no ⋯.

O botão do rodapé é sempre «Editar» — menos em três fichas, e as três
dizem porquê. No planeado por confirmar é «Confirmar», porque é o que se
quer a seguir a ler; no modelo é «Usar modelo», que é a pergunta que traz
lá alguém; e na folha «Contrato em PDF» é «Descarregar PDF», que é o que se
lá vai fazer (contrato-pdf.js:ctPdfJanela).

E o TOQUE LONGO ficou só com o que se pode FAZER. Antes da ficha, o «Ver
movimento» do toque longo era a única maneira de ver um movimento sem o
editar — abria o formulário com os campos desligados. Agora tocar no cartão lê, e essa entrada
passou a ser um caminho a mais para o mesmo sítio. Quando não há nada a
fazer, o menu fica vazio, e é o menu vazio que faz aparecer o aviso «Só
podes ver este registo» (componentes.js:lpShow) — uma decisão que já lá
estava e que um «Ver» lá dentro tinha desfeito.

## As tarefas de um imóvel ou de um contrato
Um imóvel e um contrato têm uma lista de tarefas, organizada em secções,
onde se pesquisa pelo nome da tarefa, pela secção e pelas cumpridas ou por
cumprir.

A lista vive dentro do registo (`tarefas: {seccoes, itens}`,
dados.js:normTarefas), e não num kind próprio: sobe e desce com o imóvel ou o
contrato, com as permissões dele. Num contrato altera-a quem pode alterar o
contrato (acessos.js:podeEditar); num imóvel, quem pode editar a ficha — e
quem colabora sem essa permissão nem a recebe nem a escreve, como as notas
(worker/src/lib/permissoes.js:projetarCasa, worker/src/lib/permissoes.js:fundirCasa).

Uma ficha lê-se e não tem campos. A do contrato mostra o resumo e a porta
(tarefas.js:tfLinhaDaFicha); a do imóvel tem um cartão
(tarefas.js:tfCartaoDaFicha), com o resumo no cabeçalho, as primeiras quatro
por cumprir e, se couberem, as cumpridas mais recentes, riscadas, e o
«Adicionar tarefa» e o «Ver tarefas» (ou «Ver todas»). A caixa de cada
tarefa é desenhada, e não um campo: marcar é na lista, a um toque. A lista
abre-se numa janela própria
(tarefas.js:tfAbrir), que trabalha sobre um rascunho: uma cópia das tarefas
do registo tirada ao abrir (tarefas.js:tfRascunho). Marcar, adicionar, mudar,
remover, mover, as secções e o arrasto mudam só o rascunho e repintam a lista
(tarefas.js:tfMudar, que reverifica a permissão a cada mudança). Nada chama o
save() até ao «Guardar» da janela (tarefas.js:tfGuardar), que grava tudo de
uma vez — um save(), um render(), um envio ao servidor — pela única escrita
das tarefas (tarefas.js:tfGravar, que reverifica a permissão no momento de
gravar), fecha a janela e diz «Tarefas guardadas.»; sem nada mudado só fecha.
Com a permissão perdida a meio, o Guardar recusa com a frase e a janela fica;
com o registo apagado, avisa e fecha.

O rodapé é o dos formulários: «Fechar» e «Guardar» (tarefas.js:tfRodape). Com
o rascunho diferente do que se abriu, o botão da esquerda diz «Cancelar» e o
resumo da lista acaba em «Alterações por guardar», na cor da frente do
--accent-text (tarefas.js:tfPorGuardarHtml, estilos.css:.tf-por-guardar). Quem
só lê vê só «Fechar». O «Adicionar tarefa» vive no topo do corpo, preso
enquanto a lista rola (tarefas.js:tfCorpo, estilos.css:.tf-barra): três
botões não cabem num rodapé de telemóvel, e quem adiciona quinze tarefas
seguidas não sobe a lista quinze vezes. A linha adicionada ou mudada vem à
vista sem animar (tarefas.js:tfMostrar), e por isso não há aviso a cada uma.

Fechar com alterações pergunta «Sair sem guardar?» pelo mecanismo de todos os
modais (tarefas.js:tfMarcarEstado): com o rascunho diferente, a camada fica
com um retrato que nenhum campo dá (tarefas.js:TF_POR_GUARDAR) e o «mexido»
ligado; sem diferenças, o retrato é o de agora — pesquisar, filtrar, ou marcar
e desmarcar a mesma tarefa não pergunta nada (voltar a marcar uma que já
estava cumprida devolve-lhe o dia de então). O Cancelar com alterações também
pergunta (tarefas.js:tfFechar). Fechada a janela por qualquer caminho, o
rascunho vai-se (tarefas.js:tfEsquecer). A leitura de fundo não corre com uma
janela aberta (cloud/nucleo.js:pullNow), por isso o rascunho não é pisado.

A pesquisa repinta só a lista, e o campo não perde o foco; o limpar dela é o
ic('x',14). Uma tarefa cumprida fica riscada no mesmo sítio, sem saltar para
o fim: saltar tirava a linha de debaixo do dedo. Remover uma tarefa ou uma
secção (que leva as tarefas dela) muda o rascunho, com um «Anular» de seis
segundos que devolve só o que se removeu, no lugar onde estava, e só na
janela onde se removeu (tarefas.js:tfAvisoRemocao) — não é o
componentes.js:comDesfazer, que grava ao anular; fechada a janela, o aviso
sai do ecrã.

O formulário de uma tarefa tem sempre o seletor da secção, mesmo sem
secções: «Sem secção», as secções pela ordem, e no fim «+ Criar secção…»
(tarefas.js:tfOpcoesDoFormulario), como a categoria de um movimento
(movimento.js:onCatChange). Escolher a última pede o nome
(tarefas.js:tfSecMudou) e deixa a secção nova escolhida, sem tocar no nome
que já se escreveu; um nome que já existe — sem olhar a acentos nem a
maiúsculas — escolhe essa secção, com um aviso. A secção nova fica no
formulário (tarefas.js:tfSecNovas) e entra no rascunho com a tarefa
(tarefas.js:tfGuardarTarefa): cancelar a tarefa não deixa uma secção vazia
para trás. O botão do formulário diz o que faz — «Adicionar» numa tarefa
nova, «Aplicar» numa que existe (tarefas.js:TF_BOTAO_NOVA,
tarefas.js:TF_BOTAO_EDITAR) — e não «Guardar», porque ainda não grava nada.
Cancelar o nome devolve o seletor à escolha de antes. Uma tarefa
nova fica no fim da secção; editar e mudar de secção leva-a para o fim da
nova. O «Adicionar secção» do ⋯ da janela continua lá.

As secções recolhem-se. O cabeçalho de cada uma é um botão da largura toda
(tarefas.js:tfSeccaoHtml) — a seta, o nome e «x de n» cumpridas —, com
aria-expanded e aria-controls, e o ⋯ ao lado; a seta roda para o lado
quando está recolhida. O grupo das tarefas sem secção, que vem primeiro,
também se recolhe quando há secções. O que fica recolhido é do aparelho e
não da conta, como a gaveta: `gi_tf_recolhidas`, por registo e por secção
(tarefas.js:LS_TF_RECOLHIDAS, tarefas.js:tfDobrar), só com os ids que ainda
existem; sem nada guardado — ou com o armazenamento fechado — está tudo
aberto, e o toque vale em memória até recarregar. Recolhida, as tarefas
continuam no HTML e é a folha que as esconde (estilos.css:.tf-recolhida): a
pesquisa e o arrasto contam com elas.

As tarefas arrastam-se pela pega, à esquerda da caixa (tarefas.js:tfItemHtml,
tarefas.js:tfArrastar), que só existe para quem pode alterar a lista
(tarefas.js:tfPodeAlterar). É a única coisa da linha com touch-action:none:
arrastar no nome continua a rolar a lista. A partir de 5px na vertical a
tarefa levanta-se e flutua logo ACIMA do dedo (tarefas.js:tfArrastoPintar):
o dedo aponta o sítio, e o que lá está fica à vista — debaixo do dedo, a
tarefa tapava a linha e o nome da secção acesa. O sítio é o da altura do
dedo (tarefas.js:tfArrastoAlvo):

- por cima do nome de uma secção — ou de uma secção recolhida, ou sem outras
  tarefas — a secção inteira acende (estilos.css:.tf-alvo, com o
  --accent-soft e um anel do --accent) e largar põe a tarefa em 1.º lugar
  dela;
- entre duas tarefas, da mesma secção ou de outra, aparece uma linha entre
  elas (estilos.css:.tf-linha, do --accent) e largar põe-na aí, mudando de
  secção se for preciso.

Enquanto se arrasta, aparece no topo o lugar das tarefas sem secção quando
nenhuma está à vista (tarefas.js:tfSoltasAlvoHtml), e a lista rola o que ele
empurrou para nada saltar debaixo do dedo. Perto das bordas, a lista rola
sozinha (tarefas.js:tfArrastoRolagem). O Esc desfaz sem fechar a janela, e o
pointercancel também. Largada numa secção recolhida, onde não se vê, um
aviso diz para onde foi.

A ordem é a do array `itens`, e mais nada: não há campo novo
(tarefas.js:tfMoverEm, uma função pura — a tarefa sai de onde está e entra a
seguir à tarefa `depois` da secção de destino, ou em 1.º lugar com `depois`
vazio; um `depois` que já não está lá põe-na no fim). Muda o rascunho pelo
tarefas.js:tfMudar, como todas as mudanças; só o Guardar grava.

Ao teclado, e para quem não arrasta, a pega é um botão («Mover: <nome>»): o
Enter — ou um toque sem arrastar — abre o «Mover tarefa»
(tarefas.js:tfMoverTarefa), com a secção e a posição («Em primeiro lugar»,
«Depois de «…»») de agora; mudar a secção traz as posições dela, com o fim
escolhido. O botão diz «Mover» e volta à lista com o foco na pega da tarefa
movida. O
clique que o browser dispara logo a seguir a um arrasto engole-se
(tarefas.js:tfPegaClique).

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
  (prazos.js), o quarto já prometido continua prometido, e não se escolhe
  para outro contrato (contrato.js:ctQuartosEstado),
  a caução recebe-se antes de começar (movimento.js:txBody), e uma projeção
  de dez anos não pode apagar à entrada o contrato que só começa no terceiro
  (projecoes.js:projRows, avaliacao.js:evoRatio) — aí quem corta por datas é o
  `mesesEmVigor`, ano a ano.

E o terceiro estado **vê-se**, senão o contrato desaparece dos ecrãs onde a
pessoa o foi procurar: na lista, o selo «Por começar» a cobalto e «começa a
15/03/2028» (lista-contratos.js:ctSeloDoEstado,
lista-contratos.js:ctPeriodoCurto); na ficha, o mesmo selo e «começa daqui a
N dias» sobre a barra do prazo e, sem barra, «Começa a 15/03/2028», nunca
«Desde» uma data futura (contrato.js:ctTopoDaFicha); um chip e um filtro
próprios, com quantos há (lista-contratos.js:ctFiltroRapido); «Vai morar
em» na ficha do inquilino e, na lista dos inquilinos, a linha «Vai morar em X a partir de
dd/mm/aaaa» com o selo «Por começar» — a renda da linha é só a dos contratos
em vigor.

A renda planeada acompanha o início nos dois sentidos, sem nunca voltar a
pedir um mês que já tem renda (planeados.js:syncContractRec): a regra está
em «A renda planeada e as rendas já lançadas».

## A Avaliação e as Projeções
A Avaliação lê-se do portefólio para o imóvel. O portefólio
(avaliacao.js:portCard, a prancheta D-Avaliacao) é, por esta ordem: o herói
— o valor de mercado contra o valor por rendimento, em duas barras à mesma
escala, com a diferença em grande, a frase que a lê e a conta que a dá
(avaliacao.js:avaHeroi); os cinco rácios, o Equity e os quatro de sempre
(avaliacao.js:rentGrid); a conta de exploração com o NOI numa faixa
(avaliacao.js:contaCard), ao lado das contas entre proprietários
(avaliacao.js:avaContasCard); a tabela «Por imóvel» (avaliacao.js:avaTabela);
e os gráficos do ano (avaliacao.js:avaGraficos).

Tocar numa linha da tabela põe o imóvel em foco, e a página passa a ser a
avaliação dele (avaliacao.js:repFoco, avaliacao.js:repCard); o × do chip
«Imóvel» volta ao portefólio. Com um imóvel só no âmbito, a página é logo a
dele (avaliacao.js:vReports): uma tabela de uma linha e um portefólio igual
ao imóvel eram a mesma coisa duas vezes. O herói de um imóvel abre a evolução
do valor por rendimento e da diferença pela janela dos indicadores
(vistas.js:kpiModal, pelo KPI_REG).

As contas entre proprietários da Avaliação são quadrados por pessoa — verde
quem recebe, laranja quem paga — com o plano, o «Acertar contas»
(vistas.js:settleModal) e o «como se chega aos saldos»
(saldos.js:balancesDetail), e por baixo as rendas anuais e o NOI anualizado;
sem saldos, ou num imóvel onde só colaboro, o cartão fica só com esses
números e chama-se «Indicadores». A ocupação na tabela leva as cores da
linguagem — arrendado verde, por quartos cobalto, vago âmbar, uso próprio
cinzento (avaliacao.js:avaSelo; o «N/M quartos» é o .badge sem modificador,
que é o cobalto) — e as prestações na conta de exploração são roxas
(.prest). Na conta, o «−» e a cor do que sai só aparecem quando há valor, ao
euro: sem hipotecas, um «−0 €» a roxo era ruído (avaliacao.js:contaCard). As
hipotecas da avaliação de um imóvel têm os números e o gráfico da dívida lado
a lado, um por baixo do outro no telemóvel, para o gráfico ficar à escala
dos outros (estilos.css:.ava-hip, avaliacao.js:repCard).

As Projeções (projecoes.js:vProjections) desenham as entradas e saídas de
cada ano em barras (projecoes.js:prjFluxos, com o graficos.js:cBars): as
rendas para cima; o IRS (a PAL[4] da categórica), as despesas e as
prestações para baixo. Até seis anos, o cashflow de cada ano vai por baixo
da sua coluna, numa grelha que começa e acaba nas mesmas frações do desenho
(estilos.css:.prj-cfs). «A projeção não inventa renovações»: os contratos que
acabam dentro do horizonte, agrupados pelo ano em que acabam, com a porta
para os Contratos (projecoes.js:prjRenovacoes) — a projeção corta no fim de
cada contrato (projecoes.js:mesesEmVigor), e di-lo. Com créditos em uso, a
dívida no fim do horizonte é um indicador e uma coluna da tabela; sem eles,
fica a boa notícia (projecoes.js:livreDeDividas). A tabela chama-se «Ano a
ano», e um contrato sem renda num ano escreve «—».

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

A página Declaração mostra as linhas dos quadros 4.1 e 4.2 com o que a app
sabe e aponta o que falta — o código da freguesia, o número do contrato na
AT, o NIF de um inquilino — em vez de deixar a célula em branco ou, pior, de
a preencher (fisco.js:vFisco). Nunca se inventa um código nem um número: o
que não está nos dados não está na página. E o que é conta da app vem dito
como tal: os gastos de um imóvel com vários contratos repartem-se pelas
linhas na proporção das rendas de cada uma — contando também as rendas que
ficam fora do quadro, cuja parte não entra (fisco.js:fiscoReparte) —, e o
imposto à cabeça é a estimativa sem englobamento; a página chama a cada uma
estimativa, porque é. Quem declara é a pessoa, no Portal das Finanças; a app
poupa-lhe a soma e a procura, não a assinatura.

A página é a prancheta D-Declaracao: o ano dos rendimentos em chips
(fisco.js:fiscoEscolherAno); a faixa das regras do ano, com o selo do modelo
e a porta «Guia de preenchimento», que abre a dobra do guia e lhe põe o foco
(fisco.js:fiscoAnoCard, fisco.js:fiscoVerGuia); os cinco números do ano, com
as retenções na fonte à cabeça e o imposto estimado no cartão azul-noite
(fisco.js:fiscoKpis); a grelha «A tratar antes de entregar», «Englobar ou
não?», «A tua situação fiscal» e «Prazos da AT»; o resumo dos quadros 4.1 e
4.2 numa tabela só (fisco.js:fisResumoQuadros); e os campos de cada quadro,
linha a linha (fisco.js:fiscoQuadroCard). «Fora da declaração» diz-se também
quando não há nada fora (fisco.js:fisNadaForaCard). Na barra, o rótulo
«Titular» e o chip dele vivem numa caixa só e quebram de linha juntos
(estilos.css:.fis-titular, fisco.js:fisBarra). O NIF formatado nunca parte
entre linhas (fisco.js:fiscoLinhaHtml, com o .u-ws-nowrap; o fmtNIF continua
com espaços normais). «Partilhar resumo» diz num aviso a cópia que o browser
recusa («Não foi possível copiar o resumo.», fisco.js:fiscoPartilhar), em
vez de ficar um erro por apanhar. No telemóvel, a dobra do guia esconde a
contagem dos passos, porque o título inteiro vale mais
(estilos.css:#fold_fiscoGuia, o .fsum).

«A tratar antes de entregar» (fisco.js:fiscoObrigacoesCard) é numerado, e
cada aviso leva o selo do seu nível — vermelho o que falta à AT, âmbar o que
convém tratar, cinzento o que só se diz — e um botão que diz o sítio que
abre (fisco.js:fiscoRotuloDoAviso). O nível vem do resumo
(fisco.js:fiscoAvisos, o campo `nivel`), e os números do resumo não mudam
com ele. Os prazos da AT
estão na própria página (fisco.js:fisPrazosCard): os de prazos.js:prazosAtivos
do Modelo 2, da cessação, dos recibos, da entrega, de fevereiro, do IHRU e do
Modelo 44, os cinco primeiros, com o selo da urgência da linguagem («Passou
há N dias» e «Faltam N dias» até sete a vermelho, até trinta a âmbar, o resto
cinzento), e nada antes de o estado chegar (espera.js:sabemosOEstado).

Os números seguem a regra de caixa da lei. Uma renda conta no ano em que se
recebe, mesmo que respeite a outro, e a parte de anos anteriores fica
apontada para o quadro 8 (fisco.js:fiscoAnosAnterioresCard). Um gasto conta
no ano em que se pagou, e só se o imóvel tinha um contrato em vigor nesse
dia — o condomínio de um mês com a casa vazia não é gasto de arrendamento;
o IMI e o selo contam no ano em que o imóvel deu rendas
(fisco.js:FISCO_SEM_PERIODO). A coluna escolhida à mão na despesa passa por
cima disto: a pessoa decidiu, e a página diz quantos gastos ficaram de fora
para ela poder decidir.

A coluna onde um gasto cai sai de uma regra que se vê e se muda: o mapa
categoria → coluna vive nas Definições, na coluna do Anexo F da tabela das
categorias, por categoria ou por «categoria / subcategoria», e repõe-se num
toque (definicoes.js:vCats, definicoes.js:tabelaDeCategorias). A escolha
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
gera: diz o que falta (contrato-pdf.js:generateContractPdf). A folha que o
antecede diz o mesmo antes de se descarregar: as mesmas recusas, e o que o
modelo deixa de fora por falta de dados (contrato-pdf.js:ctPdfVerificar; ver
«Os Contratos»).

## As regras do IRS têm uma versão por ano
O que muda de ano para ano na lei e no impresso não se escreve no código que
o lê. Cada ano dos rendimentos tem o seu ficheiro, com o nome do ano —
irs-2025.js, irs-2026.js —, que chama irs.js:registarAnoIrs com tudo o que
vale para esses rendimentos: o prazo da entrega, se o Anexo F desse ano já
foi aprovado (irs-2026.js:modelo), as taxas — a da habitação, a do não
habitacional, os regimes da redução pela duração com as datas em que valem e
a das rendas moderadas (irs-2026.js:rendaModerada) —, as colunas de gastos,
os códigos da natureza, os quadros, a data da comunicação de fevereiro, o que
mudou nesse ano e o guia de preenchimento. Uma versão é dados, nunca código,
e cada dado tem a fonte no cabeçalho do ficheiro.

O nome é o ano dos RENDIMENTOS, não o da entrega: o irs-2026.js é a
declaração que se entrega em 2027. É assim que o Modelo 3 identifica a
declaração, é o ano que a página escolhe e é o ano a que a lei do Orçamento
se aplica; a página diz sempre os dois (fisco.js:fiscoAnoCard).

Quem lê é o motor (irs.js:irsAno, irs.js:irsTaxa, irs.js:irsReducao). A taxa
de um contrato num ano sai da versão desse ano, e fica a mais baixa entre a
base, a redução pela duração e a das rendas moderadas; a escrita no contrato
manda sobre todas (irs.js:taxRateOf). A redução pela duração é o que manda um
contrato para o quadro 4.2 e o que pede a comunicação de fevereiro
(prazos.js:prazosDe); a taxa das rendas moderadas não pede nenhuma das duas.
Por isso nenhum código pergunta se a taxa é menor do que 25 — com os 10 % de
2026 essa pergunta acendia o aviso de fevereiro em quase todos os contratos.

Um ano sem versão usa a mais recente antes dele, com as datas da AT passadas
para o ano certo, e a página di-lo em vez de fingir (o `exato` do
irs.js:irsAno). O ano novo funciona no dia 1 de janeiro, e a versão dele chega
quando as regras forem conhecidas: o scripts/nova-versao-irs.js copia a
última, passa as datas, marca o modelo como provisório, troca as novidades
por uma frase verdadeira e regista o ficheiro no index.html, no sw.js, no
arnês e no MAPA; depois alguém confirma com o Orçamento, a portaria do Modelo
3 e o ofício-circulado da AT, e muda o que mudou. Os passos do guia não
escrevem anos — dizem {ano} e {ate}, que o fisco.js:fiscoGuiaCard troca —
para a cópia não arrastar anos velhos. O testes/irs-anos.test.js confere cada
versão, o registo dela e o próprio guião, numa cópia da árvore.

## O que o contrato diz ao IRS para lá das datas
A taxa de um contrato não sai só das datas e da renda: sai também de quatro
respostas que a pessoa dá no bloco fiscal (dados.js:normFisco). A isenção
(`isencao`: PAA, RSAA, programa municipal ou de alojamento estudantil) vem
antes de tudo — 0 % (irs.js:irsTaxa, irs.js:irsIsencao), na linha do 4.1 e
com o quadro 6D a apontar para ela; a lista das isenções, com o código e a
explicação, é da versão do ano (`isencoes` no irs-2026.js), e o RSAA não
existe antes de 2026. Num contrato celebrado desde 2024, a renda acima de
150 % do limite do concelho faz perder a redução pela duração (CIRS art. 72.º
n.º 23) e a renda pelo menos 5 % abaixo da do contrato anterior dá mais 5
pontos no período inicial (n.º 24); os números vivem na versão
(`taxas.limiteRendaAlta` e `taxas.bonusRendaMenor`), o motor só os lê
(irs.js:irsReducao), e o formulário só pergunta quando a resposta conta
(contrato.js:ctN23Visivel). A app não tem as tabelas dos limites por
concelho: pergunta, e por indicar conta-se a redução.

Uma renovação regista-se, não se escreve por cima: o «Renovar…» da ficha
(contrato.js:ctRenovar) e a pergunta do formulário quando o fim anda para a
frente (contrato.js:ctFimPergunta) juntam a renovação ao histórico e levam o
fim do contrato com ela; o período inicial acaba na véspera da primeira
renovação (irs.js:irsPeriodos), para o escalão de cada período ser o dele.

Os avisos da AT calam-se quando a coisa está feita, e não só silenciados: a
comunicação de fevereiro de cada ano marca-se na ficha
(contrato.js:ctMarcarComunicada, irs.js:irsComunicado) e o prazo desse ano
desaparece. A dispensa do recibo eletrónico troca os avisos de recibos pelo
Modelo 44 (prazos.js:prazosDe), e o RSAA traz o envio ao IHRU até 15 de
janeiro do ano seguinte à celebração.

## A Declaração sabe a tua situação
O que só o senhorio sabe vive nas definições, em `db.settings.irs`, e muda-se
em «A tua situação fiscal» (fisco.js:fiscoSituacaoCard, a prancheta
M-SituacaoFiscal), na grelha da página, ao lado dos prazos da AT: um cartão
de linhas que gravam ao mexer — a tributação conjunta e a dispensa dos
recibos eletrónicos em interruptores (role=switch), e a letra de cada
proprietário num segmentado A/B (fisco.js:fiscoSetTitular, só de um
proprietário que existe). A linha de um interruptor é o <label> dele, e
toca-se inteira (60px), e não só no botão de 28px: <label class="fis-linha
fis-linha-toque">, com hover e premido próprios e o peso normal, que o label
da casa é a 600 (estilos.css:.fis-linha-toque). Dentro do <label> o texto vai
em <span>, nunca em <p>. Gravar não tira o foco (ver «Padrões de página»).
Os outros rendimentos coletáveis do agregado, por ano, vivem no cartão do
englobamento, e as Definições têm uma linha que leva à página (ver «As Definições»). Vai com as definições para o
servidor, e uma base antiga ganha-o completo (dados.js:normIrsDefs) — sempre
um objeto novo, nunca o do blank, que a nuvem copia por referência.

- Titular. Sem conjunta é sempre A (cada um entrega o seu Anexo F). Em
  conjunta, cada linha leva a letra do titular escolhido no painel; sem
  titular, as letras dos donos do imóvel («A/B» num imóvel dos dois, que no
  Portal vai em duas linhas) (fisco.js:fiscoTitularDe).
- Isentos (6D). Um contrato isento fica na linha do 4.1, porque as
  instruções do 6D pedem o campo do 4.1 onde o imóvel foi identificado, com
  imposto zero; as rendas contam nas rendas e nos gastos do quadro, mas não no
  líquido nem no imposto — vão a `totais.isentos`, que o englobamento usa só
  para a taxa (fisco.js:fiscoIsentosCard).
- AIMI (9). Nunca é gasto. A página soma o AIMI pago no ano e estima a parte
  que abate ao imposto: a do VPT dos prédios com rendas sobre o VPT de todos
  os urbanos, até ao imposto das rendas (fisco.js:fiscoAimi). Sem o VPT de um
  prédio, não estima — diz qual falta.
- 4.2A, 4.2B e 4.2C. Contrato a contrato, a comunicação de fevereiro
  (comunicada a dd/mm/aaaa, ou por comunicar); os contratos com a descida do
  n.º 24, com as duas rendas; e a resposta do 4.2C só quando todos os
  contratos celebrados desde 2024 estão confirmados dentro do limite
  (fisco.js:fiscoReducoesHtml).
- Englobamento (6G). Os escalões de cada ano vivem na versão
  (`englobamento`, com a fonte ao lado). A simulação compara o imposto à taxa
  especial com o que as rendas acrescentam aos outros rendimentos pelos
  escalões, com o quociente conjugal em conjunta (fisco.js:fiscoColeta,
  fisco.js:fiscoEnglobamento). É uma estimativa e di-lo: sem deduções à
  coleta, sem mínimo de existência.
- Modelo 44. Com a dispensa dos recibos ligada, as rendas sem recibo deixam
  de ser falta e «A tratar antes de entregar» ganha a linha do Modelo 44,
  com o prazo (fim de fevereiro desde as rendas de 2025;
  fisco.js:fiscoPrazoModelo44).

## Segurar não é selecionar
Um toque longo é um dedo parado sobre texto, e é isso que o browser espera
para o começar a selecionar. Nos movimentos o toque longo entra em modo de
seleção, e o dedo, que não se mexeu, fica sobre a linha — e o browser faz o
que faz a um dedo parado sobre texto.

A regra casa pelo **comportamento**, não pelo elemento
(estilos.css:[role="button"]): o `tornarFocavel` carimba `role="button"` em
tudo o que tem uma ação declarada e não é controlo nativo, e repõe-no a cada
repintura,
por isso apanha também o chrome que ainda não existe. O que se copia — o
IBAN, as notas, os valores das fichas — não tem ação nenhuma e continua
selecionável. É a mesma correção que o gráfico levou.

## Entrar na seleção é como nas Casas
O toque longo num movimento (ou o «Selecionar vários» do cabeçalho) entra na
seleção como nos Imóveis, nos Contratos e nos Planeados
(cloud/selecao-listas.js:selLDecorar): as caixas das linhas aparecem a
desvanecer, no --medio e com a --curva-entra (estilos.css:.sel-entra para as
das Casas, a mesma animação em `#view .mov-linha>.selbox.sel-entra` para as
dos Movimentos), e a caixa de tudo e a contagem entram no cabeçalho, no lugar
do título, da mesma maneira (cloud/selecao.js:patchHdrSel,
estilos.css:.sel-cab). A barra do fundo chega de uma vez, como a delas. Sair
também é o das Casas: o render seguinte já não tem caixas, e elas vão-se sem
animar, sem fantasmas nem nada no style de ninguém.

Só ao ENTRAR (cloud/selecao.js:selEntrou, gasto pelo
cloud/selecao.js:selCaixasEntram no fim do render): marcar uma linha
(cloud/selecao.js:selPintar), a caixa de tudo, a lista viva
(lista-movimentos.js:pintarListaTx) e a sincronização de fundo, que é um
render sem mudar de modo, não voltam a animar. A classe sai quando a animação
acaba (animationend): uma linha que a lista viva muda de sítio é reinserida, e
uma animação de CSS recomeça num nó reinserido. Na tabela do ecrã largo as
caixas já se viam antes de entrar (cloud/selecao.js:selNaTabela): só mudam de
marca, e não desvanecem. Com menos movimento pedido, a regra do
prefers-reduced-motion da folha desliga a animação — é CSS, e não a API de
animações, por isso não precisa do continuidade.js:semMovimento.

Já em seleção, o toque longo marca e desmarca, como o toque — o das Casas
(cloud/selecao-listas.js:CW.selLTocar). O cloud/selecao.js:CW.selEntrar com
um id, já em seleção, vai ao CW.selToggle: não volta a entrar nem deita fora
o que estava marcado.

O título de cada mês é o mesmo dentro e fora da seleção
(lista-movimentos.js:txMesHtml): não tem caixa, não se cola ao topo e não muda
de altura — marca-se linha a linha ou tudo, como nas Casas. Nada por cima da
lista a empurra: a caixa de tudo vive no cabeçalho e a barra das ações flutua
no fundo.

## A fita da barra de baixo
Mudar de separador trocava o conteúdo de golpe. Passa a virar como uma fita —
mas **só na barra de baixo**, e só quando o toque veio de lá
(navegacao.js:goBarra), ou quando o dedo desliza de lado entre os
separadores de uma área (ver «Deslizar entre os separadores de uma área» e
«As abas da área, fora do #view», no fim desta secção).

A barra tem quatro destinos e uma ordem à vista: ir das Casas para o
Dinheiro é andar um lugar para a direita, e a pessoa viu o lugar antes de lá
tocar; o lado conta-se pela área onde se está. A gaveta são quinze destinos agrupados por assunto — da «Visão geral»
para as «Definições» não há lado nenhum, e uma fita a correr ali inventava
uma vizinhança que não existe. Também não desliza para o separador onde já se
está: tocar no separador aceso é «leva-me ao topo», não uma travessia.

A meio da barra vai o + (estilos.css:.tabmais; navegacao.js:buildTabbar):
um botão, e não um quinto destino — o quadrado cobalto de 52px com raio 16
do canvas, liso, que encolhe ao carregar. Fica **inteiro dentro da barra**:
a primeira versão era um círculo a subir 12px acima da borda e no telemóvel
saía cortado — o que ultrapassa a barra fica à mercê de quem recorta —, e a
segunda uma tecla em relevo de 64×50, que o canvas de 2026-10 trocou. O FAB
saiu de todos os ecrãs (estilos.css:.fab, escondido): no telemóvel cria-se
no +, no computador no «Criar» da barra lateral e na ação do cabeçalho. O + e
o «Criar» abrem a mesma folha (navegacao.js:abrirAdicionar), que fecha
primeiro a gaveta do telemóvel (navegacao.js:closeDrawer): «Novo movimento»
pelos cinco tipos, em três colunas (tipos.js:TX_TYPES,
estilos.css:.criar-tipos; cada um na cor do seu dinheiro, a dívida âmbar, estilos.css:.ic.amber), «A
partir de um modelo» em chips (os modelos dos Planeados, só com o serviço
ligado), e «Outros registos» com tudo o que a pessoa pode adicionar
(acessos.js:acoesDeAdicionar — e só com o serviço ligado; o «Grupo», da
base, está sempre). O «Grupo» abre a escolha do tipo, «Novo grupo»
(acessos.js:novoGrupoEscolher): Imóveis, Proprietários e Contratos, com os
ícones do separador (definicoes.js:GKIND), e «Partilhado» quando posso
partilhar grupos (definicoes.js:podePartilharGrupos); escolher abre a janela
do grupo novo (definicoes.js:groupModal) ou o nome do partilhado. A escolha
substitui a folha, como a da hipoteca, para a folha não crescer. A ação do
contexto vem primeiro (acessos.js:acaoDoSeparador): na Visão geral e nos
Movimentos são os tipos; nos outros ecrãs, a linha da ação do ecrã sai do
resto e sobe para o topo da folha, por cima dos tipos, marcada «neste ecrã».
Nos Grupos é «Novo grupo de <tipo à vista>», direto, sem a escolha
(acessos.js:acaoNaturalDoEcra), e o «Grupo» fica em baixo para os outros
tipos. Com uma só ação corre-a logo (um cargo que só vê só tem o «Grupo»,
e o + abre-lhe a escolha do tipo); sem nenhuma não há botão. Cada opção corre pela gramática das ações (navegacao.js:criarEscolha,
eventos.js:correrAcao), como as do menu ⋯ dos imóveis; a folha não tem
rodapé e fecha-se no X (componentes.js:SEM_RODAPE).

Os tipos correm o navegacao.js:criarMovimento, pela guarda dos serviços
(servicos.js:chamarServico). Nos Movimentos o formulário nasce com os filtros
da lista (lista-movimentos.js:newTxFromFilters); fora deles abre limpo, só
com o imóvel em foco da Visão geral (o dashProp, nunca um grupo), e o
crédito pergunta antes se o imóvel o deixa (acessos.js:motivoCredito). Os
filtros da lista dos Movimentos não se veem nos outros ecrãs, e por isso não
podem decidir o imóvel de um registo novo.

O + não conta para a fita: o goBarra calcula o
lado só pelos destinos, e a grelha recebe quantos são (as classes d0 a d3 em
estilos.css:.tabbar.mais) para o manter a meio quando quem colabora tem
menos de quatro.

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

As abas da área não viajam com o painel: vivem fora do `#view`, na casa
delas (index.html:#abasArea), e quando a área é a mesma ficam no mesmo
píxel. De área para área (a barra de baixo: das Casas para o Dinheiro, da
Agenda para as Casas) a fila é outra e entra com o conteúdo, do mesmo lado,
com a mesma duração e a mesma curva; a fila velha sai numa caixa fixa no
sítio onde estava, com o espaçamento da casa (continuidade.js:abasNaFita,
estilos.css:.abas-saida). As abas de uma área são a cabeça dessa página, e
mudar de área é mudar de página.

### Deslizar entre os separadores de uma área
No telemóvel (até 900px), os separadores de uma área são um carrossel:
Imóveis, Grupos, Contratos, Pessoas, Visitas nas Casas; Movimentos, Planeados,
Créditos no Dinheiro. Arrastar de lado na vista leva a página com o dedo, e
largar depois de um quarto da largura, ou com um sacudir, acaba a viagem até
ao separador vizinho (navegacao.js:sepArrastar, navegacao.js:sepArrastoFim).
Largar antes disso devolve a página ao sítio, no --medio e na --curva-entra.
O vizinho é o da ordem das abas do topo, com os separadores escondidos (um
cargo, um serviço desligado) fora da fila (navegacao.js:portaVizinha,
navegacao.js:vizinhoNaArea); as Pessoas são uma porta só e abrem onde a aba
abre (navegacao.js:destinoDe). Nas pontas não há vizinho: a página resiste —
anda cada vez menos, nunca mais de meia largura (navegacao.js:sepElastico) —
e não dá a volta. Os Inquilinos, os Proprietários e os Colaboradores dentro
das Pessoas não entram no carrossel, e no computador não há gesto nenhum.

A viagem é esta fita (continuidade.js:deslizarPainel), que aceita o `desde`,
como o deslizarEntre e o correrAFita: quem sai parte de onde o dedo deixou a
página e quem entra vem colado a ele, sem salto no fotograma em que o dedo
sai. O lado e o desde chegam ao go por variáveis (navegacao.js:_ladoSep,
navegacao.js:_desdeSep), pelo navegacao.js:sepIrPara, pela mesma razão do
goBarra: os embrulhos da nuvem chamam o go com um argumento só. O #view sai
do arrasto antes de a fita o medir.

Enquanto o dedo leva a página, o separador vizinho entra colado a ela,
pintado de verdade: o render de sempre, com os embrulhos da nuvem (os
pendentes por confirmar, o selo de partilhado), num contentor à parte e sem
mudar de separador (vistas.js:pintarVistaAParte — o id do `#view` passa ao
contentor durante a pintura, para o «depois» de cada serviço e as
decorações o encontrarem pelos sítios de sempre, e volta no fim, com o
separador, o ecrã pintado e o cabeçalho de onde se está). Pinta-se uma vez
por lado e por gesto, quando o dedo vai para esse lado
(navegacao.js:sepVizinho), e nunca a cada pointermove; vive num palco fixo
na camada de saída, recortado à faixa do `#view` que se vê e nunca por cima
das abas (navegacao.js:sepPalco, navegacao.js:sepPalcoAlto), no sítio onde
vai ficar (a viagem acaba com a página no topo). Não se toca nem se lê
(inert, aria-hidden). Largar e virar tira o vizinho pintado no mesmo
instante em que a fita põe o verdadeiro no lugar dele; largar e voltar
leva-o para fora com a página, no mesmo --medio e na mesma --curva-entra.
Quem chega pelo dedo já esteve à vista: não volta a entrar em cena — os
gráficos não se desenham de novo e os números não contam de zero
(navegacao.js:go, o _entrar só se liga sem desde).

As abas da área ficam paradas por cima (ver «As abas da área, fora do
#view», abaixo) e o realce corre entre a aba de onde se sai e a vizinha, à
proporção do arrasto (navegacao.js:abasPolegarEm), sem transição enquanto o
dedo o leva; na ponta fica onde está. Ao largar assenta na aba onde se fica:
com a duração da fita quando vira (chega com o painel), com a curva do
regresso quando volta (estilos.css:.abas-area.viaja, e as classes .volta e
.arrasta do .abas-area). O pai do `#view` corta o que lhe passa da margem
durante o arrasto (estilos.css:main.sep-arrasto, clip e não hidden, para o
cabeçalho pegajoso colar).

Sem movimento (prefers-reduced-motion) nada segue o dedo — nem a página, nem
o vizinho, nem o realce —, e não se pinta vizinho nenhum: o nome do vizinho
aparece à beira do ecrã (navegacao.js:sepEspreita, estilos.css:.sep-espreita),
acende-se no cobalto suave quando largar já vira, e largar troca de
separador sem deslize, com o realce já na aba nova.

As regras do gesto são as do calendário (calendario.js:calArrastar): o eixo
decide-se aos 10px, e a folga de decidir não conta (a página arranca colada
ao dedo); um gesto que começa na vertical é da página, que rola como sempre —
o `touch-action:pan-y pinch-zoom` do #view por baixo de uma casa das abas
cheia (estilos.css:#abasArea:not(:empty)~#view; a nota «deslizar entre
separadores» do estilos.css) deixa ao browser o vertical e o zoom, e se ele ficar com o gesto chega o pointercancel, que nunca vira. O
clique que vem a seguir a um arrasto engole-se (navegacao.js:sepEngolirToque).
Só o dedo e a caneta: o rato num ecrã estreito seleciona texto.

O gesto começa em qualquer ponto da página, e não só onde há conteúdo: o
sepGestoLivre só aceita o que está dentro do #view, e uma lista curta ou
vazia acabava a meio do ecrã — o vazio por baixo era do main, e deslizar ali
não fazia nada. Numa área com abas o #view cresce até ao fundo do main, que
é flex em coluna (estilos.css:main), e o vazio passa a ser dele.

Nunca rouba um gesto que já tem dono (navegacao.js:SEP_NAO_ROUBA,
navegacao.js:sepGestoLivre, navegacao.js:sepEstadoLivre): a grelha do
calendário (#calDias); a leitura dos gráficos e das barras da dívida dos
Créditos (.chartbox[data-lido]); o puxador das fotos (.pgrab); um bloco do
painel em edição; os campos de texto; tudo o que rola de lado — visto pela
medida (navegacao.js:sepRolaDeLado: mais largo do que mostra e com overflow-x
auto ou scroll), e não pelo nome, para apanhar as filas de chips, as tabelas,
os totais dos Movimentos, os tutoriais da Ajuda e o plano dos Créditos sem
uma lista a envelhecer; um overflow:auto que cabe inteiro é da página. As
abas da área estão fora do #view (index.html:#abasArea): um arrasto que
comece nelas nunca vira o separador — rola-as, quando não cabem. Nem com uma janela ou a gaveta abertas, em seleção (dos Movimentos
ou de uma lista, body.sel-on), com o painel em edição, ou a meio de uma
fita. As bordas do ecrã (20px) são do voltar do sistema. Se um toque longo
abrir uma janela ou uma seleção a meio do arrasto, a página volta ao sítio e
o gesto acaba (navegacao.js:sepArrastoMove).

### As abas da área, fora do #view
As abas da área (Imóveis, Grupos, Contratos, Pessoas, Visitas; Movimentos,
Planeados, Créditos) vivem na casa delas, por cima do `#view` e fora dele
(index.html:#abasArea), para ficarem paradas enquanto o painel desliza. Quem
pinta continua a escrevê-las à cabeça da vista, como sempre
(vistas.js:render, vistas.js:refrescarListasVivas e
lista-movimentos.js:refrescarMovimentos fazem `abasDaArea()+…`), e o
navegacao.js:abasAssentar tira-as de lá e acerta a casa: a mesma fila (a
mesma área, o mesmo número de abas) fica o MESMO nó, e só se copiam as
diferenças — o aceso, o aria-current, o destino das Pessoas e o número
(navegacao.js:abasCopiar). Por isso o foco do teclado fica na aba onde se
carregou Enter, e o realce desliza para a aba nova em vez de nascer já lá.
Outra área, ou outras abas à vista, troca a fila inteira. Fora de uma área
com separadores a casa esvazia-se e o :empty esconde-a; no computador
esconde-se sempre. O render e a via parcial das listas chamam o abasAssentar
logo a seguir a escrever; quem repinta por outra via (a pesquisa dos
Movimentos) é apanhado por um MutationObserver nos filhos do `#view`
(navegacao.js:abasVigiar), que corre antes de o browser pintar. A moldura
`.abas` fica no `#view`, vazia: no computador continua a dar os 14px de
sempre, e no telemóvel esconde-se (estilos.css:.abas:empty). As Pessoas
(Inquilinos, Proprietários, Colaboradores, .abas-pessoas) são do conteúdo
das Pessoas e ficam no `#view`, a correr com ele.

O realce da aba acesa é uma peça à parte, como no segmentado que desliza
(imovel.js:imvSegmentado): a fila ganha .desliza e um .segm-polegar, que
desliza no --medio e na --curva-fita num toque numa aba. O contorno cobalto
e o fundo suave vão no realce; a aba acesa fica com o texto no
--accent-text, que é cor da frente — o escurecimento forçado do Samsung
Internet distingue-a. As abas têm larguras diferentes, por isso o realce
mede a aba acesa (navegacao.js:abasMedida): a esquerda e a largura dela vão
para o --pol-x e o --pol-w do próprio realce (navegacao.js:abasPolegarEm,
estilos.css:.abas-area>.segm-polegar), que anima o transform e a largura —
um elemento absoluto, que só se recalcula a si; o clip-path cortava-lhe o
contorno. A meio de um arrasto o dedo interpola as duas entre a aba de
partida e a vizinha. Assente, a classe .i0 a .i4 diz em que aba está. Um
ResizeObserver volta a medir quando a fila muda de tamanho sem uma pintura
nova — a fonte que chega, o ecrã que roda, um número que aparece
(navegacao.js:abasVigiarMedidas).

Cada aba tem a largura do seu texto e a fila enche a linha, com a sobra
repartida por igual (flex:1 0 auto); colunas iguais tinham todas a largura
de «Contratos», e as cinco das Casas não cabiam aos 390px. Quando não cabem
com a letra de sempre — um número numa aba, ou um ecrã mais estreito do que
375px —, a fila aperta-se: a letra a 13px e 4px de enchimento
(navegacao.js:abasApertar, estilos.css:.abas-area.aperta), só nesse caso.
Se nem assim couber (aos 360px com um número), a casa rola de lado, sem
barra, e o fim da rolagem não puxa o voltar do sistema
(overscroll-behavior-x:contain); nunca reticências. O realce rola com elas,
porque vive dentro da fila; a aba acesa, e no arrasto a de destino, entram à
vista (navegacao.js:abasAVista).

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

## Os Contratos
A lista tem dois desenhos e um HTML só, como a dos Movimentos
(lista-contratos.js:ctLinha). No telemóvel (o canvas M-Contratos) cada
contrato é uma linha dentro do cartão do imóvel: quem — o nome do contrato,
ou os inquilinos —, a parte e até quando, os selos e a renda com a líquida.
A partir de 1100px (D-Contratos) a mesma linha é uma fila de tabela:
Inquilinos · parte, Período (com o selo do estado), Renda, Imposto (com o
porquê da taxa), Líquida e Perante a AT · avisos. A folha mostra as peças de
um e esconde as do outro (estilos.css:.ct-so-estreito, estilos.css:.ct-cab);
o cabeçalho das colunas vive na moldura, antes da lista viva
(lista-contratos.js:ctCabecalhoDaTabela), pela mesma razão do dos
Movimentos. As colunas são áreas com nome, e em seleção entra à cabeça a da
caixa (estilos.css:.ct-cols).

Cada imóvel é um grupo, com um cabeçalho de classe própria
(estilos.css:.ct-grupo-cab): o nome na letra dos títulos, o que o imóvel é
(lista-contratos.js:ctDescDoImovel — imóvel inteiro, por quartos com
quantos estão arrendados, vago, uso próprio) e, à direita, a renda do mês,
escrita depois de reconciliar (lista-contratos.js:pintarRendasDosGrupos;
«—» sem contrato em vigor). O que o imóvel é entra na assinatura do grupo, e
a renda não (ver «A lista agrupada», em «Tocar num registo é lê-lo»).

A linha tem dois andares. O de fora (estilos.css:.ct-linha) leva o data-lp —
o toque longo e a seleção da nuvem — e é nele que a nuvem pendura, no fim, o
bloco dos por confirmar desse contrato (cloud/painel.js:pendBlock), com as
linhas do cartão dos Planeados (planeados.js:pendLinha): depois de cada
render, só nos Contratos e só depois de se saber o estado do servidor
(cloud/painel.js:decoratePending). O de dentro, onde a seleção põe a caixa,
é o que se toca para abrir a ficha (lista-contratos.js:ctAbrirDaLista), e em
seleção fica quieto. Por isso tocar no Confirmar de um por confirmar não
abre também o contrato: o bloco é irmão do toque que abre, e não filho dele.

Os selos vão do mais grave para o menos (lista-contratos.js:ctAvisos): os
prazos que já avisam — os mesmos do sino, numa passagem só por pintura
(prazos.js:prazosAtivos, lista-contratos.js:ctContextoDaLista) —, nas cores
de prazos.js:pzSelo e com o texto curto da lista («Oposição até 31/10»,
«Cessação por comunicar», «Modelo 2 em atraso»,
lista-contratos.js:ctTextoDoPrazo), e «Falta o n.º na AT» num declarado sem
número. A renda em atraso não se repete na linha: o bloco dos por confirmar
já a diz, com o Confirmar. O estado (lista-contratos.js:ctSeloDoEstado): em
vigor verde, com os dias que faltam a menos de meio ano do fim; por começar
cobalto; terminado cinzento. A AT (lista-contratos.js:ctSeloDaAt):
declarado verde, com o número; por indicar cobalto; não declarado cinzento,
sem cor de aviso (ver «A Declaração resume, não declara»). No telemóvel vão
o estado, quando não está em vigor, e os dois avisos mais graves; no
computador, o estado na coluna do período e os avisos todos na da AT.

Por cima da lista, a pesquisa à vista com o funil e os chips
(lista-contratos.js:ctChipsHtml, que monta o vistas.js:lfCabeca): o estado —
Em vigor, Por começar, Terminados, cada um com quantos há nos imóveis do
âmbito (ver «Padrões de página»; lista-contratos.js:ctCampoEstado, aplicado
pelo lista-contratos.js:ctFiltroRapido) —, o imóvel quando há mais de um com
contratos, e a ordenação só no ecrã largo. O grupo está no painel. A porta
da seleção de vários é o «Selecionar vários» do cabeçalho, e a dica do
computador diz-o. Sem imóveis ou sem contratos não há barra. Por baixo
(lista-contratos.js:ctRodapeDaLista): com
«Em vigor», os imóveis de arrendamento sem contrato em vigor e, havendo
terminados, «ver terminados»; no computador, com a seleção, como se apagam
vários. Não há FAB nem ⋮: o «Novo contrato» está no cabeçalho e no +, e o
vazio sem contratos tem o seu botão. A ficha está em «Tocar num registo é
lê-lo», e o formulário em «Os formulários dizem o que é obrigatório…».

Gerar o PDF passa por uma folha, «Contrato em PDF»
(contrato-pdf.js:ctPdfJanela, contrato-pdf.js:ctPdfFicha — a prancheta
M-ContratoPDF), que abre do botão da ficha, do ⋯ da ficha e do formulário
(o toque longo num contrato entra na seleção): a miniatura do documento com o nome do ficheiro
(contrato-pdf.js:ctPdfNome); o que falta para se poder gerar, a vermelho; o
que vai e o que fica de fora (contrato-pdf.js:ctPdfVerificar — a licença, o
registo, o certificado energético, a frase do pagamento, os dados de cada
pessoa, o inventário, as chaves), cada um com «Completar» a quem o pode
fazer; e o total a entregar na assinatura, com as rendas antecipadas e a
caução. A data que falta diz-se pelo nome — «Falta a data de fim do
contrato», «Falta a data de início do contrato», e «Faltam as datas…» só com
as duas em falta. O «Completar» de uma pessoa abre o formulário dela
(pessoas.js:personModal), e só a quem a pode alterar
(pessoas.js:personEditavel); o meu próprio perfil abre a edição da conta
(CW.editProfile). As maiúsculas da miniatura são da folha: o HTML diz
«Contrato de arrendamento urbano para habitação com prazo certo» e o
estilos.css:.ct-pdf-mini>p põe-lhe o text-transform; o título do ficheiro
gerado (contrato-pdf.js:CONTRACT_XML) fica como está, porque é o texto do
documento. É uma ficha (componentes.js:abrirFicha): completar por cima e voltar
deixa-a com o que mudou. O «Descarregar PDF» do rodapé fecha-a e gera
(contrato-pdf.js:ctPdfDescarregar), ou, enquanto falta alguma coisa, diz a
primeira e fica.

O ficheiro veste as cores do tema claro, seja qual for o da app
(contrato-pdf.js:PDF_COR, contrato-pdf.js:pdfCor): os títulos das cláusulas
e das secções a cobalto, o total numa caixa cobalto suave, os traços na cor
do contorno e as notas a cinzento. A letra é a Helvetica, uma das catorze
que todo o leitor de PDF tem: a Geist e a Bricolage só entravam embutidas
(o porquê está no diário, a 2026-10-17).

## As Pessoas e as Visitas
«Pessoas» é a porta da casca para os Inquilinos, os Proprietários e os
Colaboradores (navegacao.js:PESSOAS): o segmentado dos três, com quantos há
de cada, é da casca (navegacao.js:abasDaArea), e a vista de cada separador é
só a sua lista, o canvas M-Pessoas (os Colaboradores estão em «Os
colaboradores»).

Por cima, a pesquisa à vista com o funil e os chips (vistas.js:lfCabeca).
Nos inquilinos, o chip do contrato (lista-pessoas.js:pesChips monta o campo;
aplica pelo lista-pessoas.js:pesFiltroRapido): Com contrato ativo, Com
contrato por começar, Sem contrato, cada escolha com quantos lhe cabem («Com
contrato ativo · 2»), e ligado o rótulo curto («Por começar»); nos
proprietários o dos imóveis (Com imóveis, Sem imóveis) e, no ecrã largo ou
ligado, o «Dono de» (o imóvel; ligado, «Dono de T2 Lisboa»). A ordenação
(nome, nº de contratos e renda; nome e nº de imóveis) está no painel e, no
ecrã largo, no chip «Ordenar». Sem os Contratos (ou os Imóveis) ligados não
há os chips deles. O «Todos» não leva número: o segmentado da casca já o
diz.

Por baixo, um cartão com uma linha por pessoa (lista-pessoas.js:personCard,
o .linha da casa com o avatar no lugar do ícone; estilos.css:.pes-lista,
estilos.css:.pes-linha): o avatar com as iniciais (pessoas.js:pesAvatar —
cinzento num inquilino sem contrato que conte), o nome, o que diz dela e, à
direita, a renda. Num inquilino, onde mora: «Mora em X» (ou «X · Quarto
2»), «Vai morar em X a partir de dd/mm/aaaa» com o selo «Por começar» a
cobalto, «Morou em X até dd/mm/aaaa», ou «Sem contrato»; a renda é a dos
contratos em vigor (pessoas.js:pesContratos). Num proprietário, os imóveis
de que é dono e a renda que lhe cabe — só nos imóveis meus, na quota dele
(pessoas.js:pesRendaDoDono). A lista é a das outras contas Rendorium com
quem partilho (pessoas.js:donosComPartilha): uma casa em comum, uma ligação
ativa — mesmo sem casas — ou um grupo partilhado. Não estou eu, nem quem só
é referido nos movimentos (contas apagadas, ex-comproprietários), e não há
fichas de proprietário feitas à mão: o vazio diz que a lista se enche ao
ligar-se a outra conta, por baixo, sem botão de criar. Sem o serviço que alimenta a linha, ela diz o
contacto. No computador a linha é uma grelha com mais uma coluna, o
contacto (estilos.css:.pes-contacto).

Onde se escolhe entre proprietários, o meu nome leva « (eu)» no fim
(acessos.js:rotuloDoDono): no formulário do movimento e nos grupos de
proprietários — no seletor de adicionar, nos chips dos membros e no resumo
do cartão (definicoes.js:gMemberName). Com um só proprietário, ou sem
sessão, não há que distinguir. O avatar continua com as iniciais do nome.

Os selos dizem o que pede atenção, e só o que a app sabe: «Renda em atraso»
a vermelho, pelo planeado da renda (pessoas.js:pesRenda — com os Planeados
ligados e o estado do servidor já chegado), e o cartão de cidadão a caducar
(pessoas.js:pesSeloCC), com a janela e as cores dos prazos
(prazos.js:PZ_ANTECEDENCIA, prazos.js:pzUrg, prazos.js:pzSelo) e o critério
do «Pede atenção»: um inquilino com contrato que ainda não acabou, ou um
proprietário.

Não há FAB nem ⋮: o «Novo inquilino» está no cabeçalho e no +
(navegacao.js:pintarAcaoDoCabecalho); os Proprietários não têm ação de criar, e as opções de uma
pessoa estão no ⋯ da ficha (pessoas.js:personView). O vazio tem o seu botão
(vistas.js:saida). A ficha está em «Tocar num registo é lê-lo»; o «Acertar
contas» das contas entre proprietários tem 44px no dedo
(estilos.css:.pes-contas), como os .btn.sm das fichas do imóvel e do
contrato.

Os formulários da pessoa (Novo e Editar inquilino, O meu perfil) e da visita (Marcar e Editar visita) dizem o erro no campo
(componentes.js:falhaCampo): o nome; quem vem, o imóvel, a data, e o fim
antes do início. Escolher o imóvel da visita repinta o corpo e larga o erro
(visitas.js:visPropMudou). O Início e o Fim da visita vão lado a lado também
no telemóvel, em duas colunas iguais que enchem a linha por igual
(visitas.js:visBody, estilos.css:.vis-par —
repeat(2,minmax(0,1fr)), 46px de altura): numa .row empilhavam-se abaixo dos
520px, dois campos a toda a largura para «14:30»; encostados à esquerda na
largura da hora, ficavam descentrados e com um vazio à direita.

As Visitas (visitas.js:vVisits, o canvas M-Visitas) abrem com a pesquisa à
vista, o funil e os chips Imóvel, Estado e Desfecho (visitas.js:visChipSel
monta cada campo, com as escolhas do visitas.js:visOpcoesDoFiltro), e o
«Dias e horas» (visitas.js:visChips), que leva ao painel com o foco no
primeiro dia (vistas.js:lfAbrirEm) e, ligado, diz o intervalo com o × que
limpa os quatro limites (visitas.js:visLimparChip); desligado, só no ecrã
largo. No painel, a grelha tem o imóvel e o estado, os dias («Dia — de»,
«Dia — até»), as horas de início e o desfecho (visitas.js:visIntervalo dá
os dois campos de cada intervalo, que contam como um). O rótulo de cada
campo é o nome inteiro, à vista e para o leitor de ecrã. Por baixo,
«Próximas» e «Passadas», cada uma com quantas são e as linhas num cartão
(estilos.css:.vis-lista); no computador, lado a lado (estilos.css:.vis-grupos).
Com visitas de mais de uma origem, as Próximas e as Passadas vivem dentro de
cada secção da origem (ver as listas por origem, em «Padrões de página»). Um filtro sem resultados usa o vazio de sempre
(vistas.js:vazioFiltro).

A linha de uma visita (visitas.js:visCard) começa pelo bloco da data
(visitas.js:visBlocoData): o dia em grande e, por baixo, «hoje», «amanhã»,
«ontem» ou o mês — hoje a cheio em cobalto. Segue-se quem vem, a hora e o
imóvel, com «daqui a N dias» ou «há N dias» quando é dentro da semana, quem
a marcou quando não fui eu, e os selos (visitas.js:visSelos) — à direita nas
que vêm, por baixo nas passadas. As cores do estado são as da Agenda
(visitas.js:VIS_COR, as do calendario.js:calDiaPanel): agendada cobalto,
realizada verde, faltou âmbar, cancelada cinzenta; as do desfecho
(visitas.js:VIS_COR_DESF): interessado verde, a pensar cobalto, sem
interesse cinzento. A mesma linha serve as próximas visitas na Visão geral
de quem colabora (painel-geral.js:proximasVisitasColab), sem o cartão à
volta. Também aqui não há FAB nem ⋮: o «Marcar visita» está no cabeçalho, no
+ e no vazio, e as opções de uma visita no ⋯ da ficha (visitas.js:visView).
As folhas das opções de uma pessoa e de uma visita (lista-pessoas.js:lpPessoa,
visitas.js:lpVisita) continuam registadas como o handler do prefixo, e o
componentes.js:lpMenu continua a abri-las — é por elas que os outros serviços
juntam opções (lpExtras) —, mas o toque longo na lista já não as abre.

Os Inquilinos e as Visitas selecionam-se como as Casas: o toque longo entra
na seleção de vários com o tocado já marcado (cloud/selecao-listas.js:lpLongo
→ cloud/selecao-listas.js:CW.selLEntrar); já em seleção, marca e desmarca
como o toque (cloud/selecao-listas.js:CW.selLTocar). Os Proprietários e os
Colaboradores não têm seleção, e as visitas da Visão geral também não
(painel-geral.js:proximasVisitasColab usa a mesma linha, mas a seleção só
existe no separador das Visitas). O «Selecionar vários» do cabeçalho é o das
Casas (cloud/selecao-listas.js:selLCabecalho): a base não pinta lá o funil
(vistas.js:LF_COM_CABECALHO), e quem o mostra é a camada da seleção, como nos
Planeados.

Os tipos da seleção das listas são 'prop', 'ct', 'ten' (inquilinos), 'vis'
(visitas), 'rec', 'tpl' e 'grp' (os grupos, no separador Grupos)
(cloud/selecao-listas.js:TABS_SEL). O id de cada
cartão lê-se pelo começo do data-lp do tipo
(cloud/selecao-listas.js:selLPrefixo, cloud/selecao-listas.js:selLIdDe,
cloud/selecao-listas.js:selLDoLp): os inquilinos usam o data-lp das pessoas,
«per:tenant:<id>», e um «per:owner:<id>» não é de nenhum tipo. As contagens
dizem o plural e o género certos (cloud/selecao-listas.js:selLPalavras):
«1 inquilino», «nenhum inquilino», «2 visitas», «nenhuma visita»; na barra,
«2 selecionadas» nas visitas, e sem nada marcado «toca nos inquilinos» ou
«toca nas visitas»; a caixa de tudo diz «Marcar todas as visitas à vista».

A caixa entra à cabeça da linha: na do inquilino antes do avatar, na da
visita antes do bloco da data, à altura dele
(cloud/selecao-listas.js:selLDecorar; no estilos.css, a secção
«ajustes-v40-5: 1.3»). No computador a grelha da linha do inquilino ganha à
cabeça a coluna da caixa (estilos.css:body.lst-sel, a regra da
.linha.pes-linha). A linha
marcada leva o fundo cobalto suave dos Contratos e um filete cobalto à
esquerda, que o escurecimento forçado do Samsung Internet não come
(estilos.css:.pes-lista>.pes-linha.sel-on-card); o avatar e o selo cobalto
ficam no fundo do cartão, para não sumirem nela.

Quem não se pode levar não se marca: um inquilino que não posso apagar (as
regras do pessoas.js:delPerson — motivoRecusa com a casa do inquilino e
'tenant.add', pessoas.js:personApagavel; nunca o meu perfil), uma visita que
não posso alterar nem apagar (cloud/selecao-listas.js:selLRecusa). A linha
fica atenuada, sem caixa, com aria-disabled; tocá-la (ou o toque longo nela)
diz porquê, e a caixa de tudo deixa-a de fora
(cloud/selecao-listas.js:selLMarcaveis). Marcar e só ouvir a recusa no fim
era um botão que serve para ouvir «não podes».

Apagar vários inquilinos (cloud/selecao-listas.js:selLApagarInquilinos):
confirmação com quantos e os contratos de que saem («Saem de 2 contratos,
que se mantêm.»; com um só, o nome; só com os Contratos ligados se fala
deles); a ficha sai da lista e o id sai dos contratos. O Anular repõe as
fichas, e cada uma no seu lugar nos contratos, sem tirar quem lá tenha
entrado entretanto; os documentos só saem do IndexedDB quando o Anular
expira.

Nas visitas a barra tem Realizada, Falta e Apagar. Realizada e Falta só
estão ligadas com todas as marcadas agendadas e que posso alterar
(cloud/selecao-listas.js:selLVisPode,
cloud/selecao-listas.js:selLPintarVisitas), com a razão dita («Só as
agendadas se marcam como realizadas ou falta.»); mudam todas de uma vez, e o
Anular devolve a cada uma o estado que tinha
(cloud/selecao-listas.js:CW.selLVisEstado). Apagar várias pergunta antes e
tem o Anular (cloud/selecao-listas.js:selLApagarVisitas). A barra é a das
Casas, com as ações numa segunda linha no telemóvel (ver a seleção dos
Planeados, em «Os Movimentos»).

## Os Movimentos
A lista tem dois desenhos e um HTML só, porque a assinatura da linha viva é
uma (lista-movimentos.js:txLinhaHtml; ver «O motor das listas»). No
telemóvel (o canvas M-Movimentos), o quadrado do ícone na cor do tipo
(lista-movimentos.js:txTomDoTipo — receita verde, despesa laranja, prestação
roxa, dívida e acerto em cobalto), o título, a linha curta «dd/mm · imóvel ·
quem» e o valor com o sinal e a cor. A partir de 1100px (D-Movimentos) a
mesma linha é uma fila de tabela: Data, Descrição (com o tipo e o que mais
diz por baixo), Imóvel, Categoria, Pago · recebido e Valor. A folha mostra
as peças de um e esconde as do outro (estilos.css:.mov-linha,
estilos.css:.mov-cab). O cabeçalho das colunas vive na moldura, logo antes
do #txLista (lista-movimentos.js:txCabTabela): dentro dele, o reconciliar
tirava-o, por não ter chave. A coluna de um serviço desligado sai, na linha
e no cabeçalho.

A ficha pinta o montante com a mesma cor da linha (movimento.js:txFicha usa
o txTomDoTipo): o âmbar é só para aviso, e não para uma prestação ou uma
dívida. A frase da parte na linha da lista (estilos.css:.mov-parte, a 13px
como a linha curta, com reticências) e a fila de cada dono na divisão do
formulário (estilos.css:.mov-pfila, movimento.js:partesDaDivisaoHtml) têm
classes suas.

Os meses: o título na letra dos títulos, com «saldo +306,20 €» à direita,
escrito depois de reconciliar (lista-movimentos.js:pintarListaTx); as linhas
de cada mês num cartão só, separadas por um traço (estilos.css:.mov-lista).
O título do mês é o mesmo dentro e fora da seleção, sem caixa (ver «Entrar na
seleção é como nas Casas»).

Por cima da lista, os totais são o kpi da casa, compacto
(estilos.css:.mov-tot): Receitas, Despesas, Prestações (roxo, a classe
.prest), as dívidas a terceiros em cobalto (estilos.css:.mov-div) e o Saldo
a tinta, com «· N movimentos». No telemóvel correm numa fila que se arrasta
de lado.

A pesquisa está sempre à vista, com o botão dos filtros ao lado e quantos
estão ligados (lista-movimentos.js:txBarraHtml); a lupa é uma máscara na
folha (estilos.css:.mov-lupa). Por baixo, os filtros em chips
(lista-movimentos.js:txChipsHtml): o período, o tipo, o imóvel, a categoria
e quem pagou ou recebeu, cada um o menu da casa vestido de chip
(lista-movimentos.js:txChipSel), com o × que limpa só esse
(lista-movimentos.js:txLimparFiltro). O período escolhe um ano inteiro, ou
abre o painel para as datas (lista-movimentos.js:txChipPeriodo). Os filtros
comuns são um chip no ecrã largo e chips no painel. No telemóvel o «Limpar»
só aparece com dois filtros ou mais: com um, o × chega, e a fila não parte.
As listas dos chips flutuam presas ao ecrã, com largura para se lerem e sem
sair dele pelo lado (cloud/filtros.js:popAnchor).

O painel dos filtros tem o desenho do M-Filtros e continua a ser o painel
ancorado, que não tapa a lista: o título com o Limpar e o Fechar,
«Aplicam-se ao mexer · N movimentos», os filtros comuns em chips, o tipo em
chips (role radio), uma grelha de duas colunas — o imóvel, a categoria, a
subcategoria, quem pagou, o proprietário, as datas e a ordenação — e o
interruptor dos movimentos sem pessoa (lista-movimentos.js:txFilterBody,
lista-movimentos.js:txPorTipo). Na grelha a opção vazia diz só «Todos»,
«Todas» ou «Qualquer um»; os chips continuam com as listas inteiras
(lista-movimentos.js:txOpcoesImovel, lista-movimentos.js:txOpcoesCategoria).
O interruptor vai num <label> com o texto, de 44px (estilos.css:.mov-interr):
o toque no texto chega ao botão. No ecrã largo o painel cresce até 16px do
fundo do ecrã; quando rola por dentro — no telemóvel não cabe por baixo da
pesquisa —, uma sombra na borda diz que há mais (estilos.css:.mov-filtros-card:
duas tampas em background-attachment:local sobre duas sombras em scroll).

A seguir ao tipo, o painel tem a linha «Etiquetas»
(lista-movimentos.js:txEtiquetasHtml): um chip por etiqueta, de escolha
múltipla (aria-pressed, o visto só no ligado), num role="group" com rótulo e
a nota «Basta uma das escolhidas.». Oferecem-se as etiquetas da lista mestra
(db.settings.tags, pela ordem de lá), as que os movimentos usam fora dela
(por ordem alfabética) e as escolhidas que já não existem, para se poderem
desligar (lista-movimentos.js:txEtiquetasDisponiveis). Sem etiquetas na
conta, a linha não aparece. Um movimento passa se tiver PELO MENOS UMA das
escolhidas (lista-movimentos.js:txTemEtiqueta, chamada no txMatch); o estado
é o global txEtiq (um array de nomes, trocado sempre por um novo), que só os
Movimentos leem. As etiquetas contam como UM filtro no funil, sejam uma ou
várias, como as datas (lista-movimentos.js:txFilterCountSem); o resumo diz
«etiqueta X» ou «etiquetas X ou Y». Com etiquetas escolhidas, a fila dos
chips ganha um chip ligado, «Urgente +2» (a primeira e quantas mais,
lista-movimentos.js:txRotuloEtiquetas), cortado com reticências a 200px: o
texto abre o painel com o foco na primeira escolhida
(lista-movimentos.js:txEtiqAbrir), o × limpa-as, e o nome inteiro está no
aria-label; desligado não há chip, porque o menu da casa é de escolha única.
Saem com o «Limpar», com o limpar dos estados vazios e com o × do chip.
Tocar num chip da linha (lista-movimentos.js:txPorEtiqueta) repinta o painel
por dentro e devolve o foco ao chip novo da mesma etiqueta. Um filtro comum
não guarda etiquetas: aplicá-lo limpa as escolhidas
(definicoes.js:aplicarFiltroComum), e com etiquetas escolhidas nenhum filtro
comum aparece ligado (lista-movimentos.js:txComumLigado). Apagar uma
etiqueta nas Definições tira-a também do filtro (definicoes.js:delTag). Um
movimento novo (newTxFromFilters) não herda as etiquetas do filtro: com
várias escolhidas não se sabe quais pôr. No dedo, os chips da linha e o chip
rápido têm 44px (estilos.css:.mov-etiq, estilos.css:.mov-chip-etiq).

Para selecionar vários, o botão do cabeçalho é o «Selecionar vários», a
caixa com o visto (icones.js:caixaVisto; cloud/selecao.js:patchHdrSel, e o
embrulho do hdrFiltToggle). Fora da seleção entra; em seleção sai, como o das
Casas, mas a folha esconde-o (estilos.css:body.sel-on, a regra
#hdrFilt.mov-hdr-sel): a barra do fundo tem o Cancelar e as ações. Em
seleção o título dá lugar à caixa de tudo e à contagem (#selCab: «2
movimentos», «nenhum movimento», «toca para marcar tudo»), como o #selLCab
das Casas, e a caixa de tudo é focável (tabindex) — Enter e Espaço marcam
tudo. Na tabela do ecrã largo as caixas estão sempre à vista: fora da seleção
existem com a classe .fora, que a folha só mostra a partir de 1100px — a
mesma largura que o cloud/selecao.js:selNaTabela lê —, e marcar uma entra na
seleção com essa linha, ou com tudo pela caixa do cabeçalho da tabela
(cloud/selecao.js:CW.selEntrar, cloud/selecao.js:CW.selEntrarTodos);
desmarcar a última termina-a (cloud/selecao.js:selSairSeVazio). O título do
mês da tabela não tem caixa: o nome fica na coluna da Data
(estilos.css:.mov-tabela). Aí o «Selecionar vários» do cabeçalho sai, porque
as caixas já são a porta. O Editar e o Apagar de um movimento sozinho estão
na ficha, que é o que tocar na linha abre.

A linha marcada tem o realce dos cartões das Casas (estilos.css:.sel-on-card,
cloud/selecao.js:selPintar): o fundo das linhas dos Contratos (--accent-soft)
e o contorno no --accent — o traço de cima é o do .sel-on-card e os outros
três lados uma sombra por dentro, para duas linhas marcadas seguidas não
ficarem com um traço triplo entre elas; a primeira linha do mês leva o anel
inteiro, e no telemóvel as pontas da primeira e da última acompanham a curva
do cartão. Com o escurecimento forçado do Samsung Internet a marca lê-se pela
cor da frente: o contorno e a caixa cheia com o visto (medido: contraste 2,95
entre a caixa marcada e a vazia).

Os Imóveis, os Contratos, os Inquilinos, as Visitas e os Planeados têm o
mesmo cabeçalho de seleção: fora dela, o «Selecionar vários» (a caixa com o
visto e o nome do dos Movimentos, também no «Selecionar vários» do kebab),
que entra sem nada marcado (cloud/selecao-listas.js:CW.selLEntrar) e some sem
cartões à vista; em seleção, o título dá lugar à caixa de tudo e à contagem
(«nenhum imóvel», «2 contratos», «nenhum inquilino», «2 visitas»;
cloud/selecao-listas.js:selLCabNovo,
cloud/selecao-listas.js:CW.selLTodos — a .sel-cab dos Movimentos), e o botão
esconde-se (estilos.css:body.sel-on #hdrFilt.lst-hdr-sel). O toque longo
entra no mesmo cabeçalho; antes deixava-o vazio, só com o hambúrguer e a
nuvem. Ao contrário dos Movimentos, a caixa de tudo e o «Selecionar vários»
ficam no ecrã largo (estilos.css:.lst-sel-cab, com a classe body.lst-sel),
porque estas listas não têm caixas na tabela.

A barra das ações dos Movimentos (cloud/selecao.js:selBarraHtml) é a das
Casas: × Cancelar, a contagem ao meio — «2 selecionados», e sem nada marcado
«toca nos movimentos», como o «toca nos cartões» delas — e as ações, que
aqui são as dos Movimentos: Mudar categoria, Adicionar etiquetas (com
etiquetas definidas), Editar e Apagar N, paradas sem nada marcado
(data-precisa). É um nó do body, posto como o das Casas
(cloud/selecao.js:selBarraPor): fica de render para render, a selCabPintar
só lhe acerta os números, e só se refaz quando as etiquetas aparecem ou
somem. Não é da vista: não anda com o #view.

No telemóvel tem duas linhas, como na prévia que o Martinho escolheu: em
cima o Cancelar e a contagem, com o quanto somam por baixo
(«somam −223,61 €», cloud/selecao.js:selSomaTexto); em baixo os botões lado
a lado, em partes iguais, cada um com o ícone por cima de um rótulo curto —
«Categoria», «Etiquetas», «Editar», «Apagar 2» (cloud/selecao.js:selBotaoHtml,
estilos.css:.sel-rot-curto). A 375px cabem os quatro sem régua, com 54px de
alto. A contagem fica ao meio da barra: as duas colunas de lado repartem o
resto, e a do Cancelar só cresce o que ele precisar. Com 120px, a barra abre
espaço por baixo da lista e sobe o «Topo» flutuante (estilos.css:body.sel-mov,
a classe que o render da seleção põe).

A partir de 901px é a barra azul-noite das Casas e do canvas, numa linha:
× Cancelar, «N selecionados · somam X» ao meio, e «Mudar categoria»,
«Adicionar etiquetas» e «Apagar N» por extenso (estilos.css:.sel-rot-longo);
o Editar sai, porque os outros dois o repartem. Os botões têm os fundos dos
véus da barra lateral — --side-hover em repouso, --side-on por baixo do
rato, este só em @media(min-width:901px) and (hover:hover) and
(pointer:fine). A soma não se corta
(estilos.css:.sel-fundo, o .sel-info com flex:1 0 auto): sem lugar, os
botões descem. A edição em massa abre só a parte que o botão pede
(CW.selEditar('cat'), CW.selEditar('tags'); o Editar abre as duas), e as
etiquetas são chips com aria-pressed.

A seleção diz um número e um verbo. A confirmação de apagar soma com o sinal
do dinheiro, como a barra (cloud/selecao.js:CW.selApagar usa o selSomaTexto):
somar os valores sem sinal dava «+1 195,00 €» na barra e «1 305,00 €» na
janela. E o verbo é «Apagar» em tudo — no botão da barra, no título da
confirmação («Apagar N movimentos») e no aviso («N movimentos apagados.»).
Na seleção dos imóveis e dos contratos é o mesmo, e o que vai junto diz-se
com o plural certo (cloud/selecao-listas.js:selLVaoJunto: «Vão junto 2
contratos e 5 movimentos.», «Vai junto 1 contrato.», «Sem contratos nem
movimentos ligados.»). O «Selecionar vários» que entra no menu de um imóvel ou de um
contrato veste uma classe (estilos.css:.card.sel-varios), e não um cssText.

Na seleção dos imóveis marcam-se também os que não criei, e o Apagar tem UMA
confirmação, como a dos grupos (cloud/selecao-listas.js:selLApagarImoveis, a
frase em cloud/selecao-listas.js:selLImoveisFrase). O título começa sempre
por «Apagar», para o botão ser vermelho: «Apagar 2 imóveis» só com os meus ou
só com os de outros, e «Apagar 1 imóvel e sair de 2» com os dois. De um só
imóvel de outra pessoa, a frase é a da ficha; de vários, a de
cloud/selecao-listas.js:selLSaidaFrase; com os dois, acaba em «O Anular só
repõe os teus.». Os meus apagam-se na base, com o Anular
(cloud/selecao-listas.js:selLApagarImoveisLocal); dos outros saio no
servidor. Os pedidos vão todos, um que falhe não trava os outros, e o aviso,
um só, espera pelas respostas e diz o que ficou como estava
(cloud/selecao-listas.js:selLImoveisAviso).

Nos Planeados seleciona-se vários de um de dois tipos: os planeados ('rec')
ou os modelos ('tpl'), nunca os dois (cloud/selecao-listas.js:TABS_SEL, os
dois no separador 'recurring'). O ☑ do cabeçalho entra com os planeados — ou
com os modelos, sem planeados à vista (cloud/selecao-listas.js:selLTipoDe)
— e some sem nenhum dos dois (cloud/selecao-listas.js:selLHaCartoes).
Entrar com um tipo esquece o outro (cloud/selecao-listas.js:CW.selLEntrar);
em seleção, os cartões do outro tipo ficam atenuados (estilos.css:.sel-fora)
e tocá-los vai ao cloud/selecao-listas.js:CW.selLOutro — sem nada marcado a
seleção passa a esse tipo com ele marcado; com marcas, um aviso diz
«Seleciona planeados ou modelos, não os dois» e as marcas ficam. O toque
longo num planeado ou num modelo entra na seleção desse tipo com ele marcado
(cloud/selecao-listas.js:lpLongo), mesmo num que não posso silenciar nem
apagar, como nos imóveis: as ações da barra recusam com a razão e contam os
que ficam de fora.

A barra de baixo é a das Casas em todos os tipos
(cloud/selecao-listas.js:selLBarraHtml): × Cancelar com o nome à vista, a
contagem ao meio e as ações. Imóveis, contratos, inquilinos e modelos: só o
Apagar, numa linha. Planeados e visitas (cloud/selecao-listas.js:SEL_ACOES):
a contagem com a razão de uma ação estar fora por baixo (#selLPorque,
aria-live), e as ações numa segunda linha no telemóvel — a .sel-l-quebra
ocupa a largura toda (estilos.css:.sel-l-duas); no ecrã largo, uma linha só.
As ações com data-sel-l-precisa desligam-se sem nada marcado
(cloud/selecao-listas.js:selLPintar).

Nos planeados as ações são o Silenciar ou o Reativar (#selLMudo) e o Apagar.
O silêncio segue os marcados (planeados.js:recMudoDaSelecao): todos ativos,
Silenciar; todos silenciados, Reativar; misturados, nenhum dos dois, e a
razão dita por baixo da contagem (#selLPorque) — um botão só não diria o que
faria a cada um. A barra mostra a contagem também no telemóvel, como as
outras, e o Cancelar não encolhe para só o ×: com as ações na segunda linha,
a contagem, o nome do Cancelar e as ações cabem nos 375px.

As regras de cada planeado são as de um só, e vivem uma vez em
planeados.js: silenciar e reativar pedem o que o skipRec pede
(planeados.js:recMudarVarios, motivoRecusa com 'confirmar'); apagar segue o
delRec (planeados.js:recApagarVarios → recTirar): a renda automática
desliga o autoRec do contrato, a prestação o da hipoteca, e um da ficha do
imóvel (IMI, condomínio, seguro) põe o valor a zero e leva as prestações
irmãs. Os que não posso ficam de fora e o aviso conta-os. A confirmação de
apagar vários diz o que os automáticos arrastam e quantos ficam de fora
(planeados.js:recApagarFrase); o Anular repõe os planeados, os autoRec e os
valores da ficha (planeados.js:recRepor). Os modelos apagam-se como pelo
delTpl, com o Anular (planeados.js:tplApagarVarios).

Ao entrar na seleção as caixas desvanecem
(cloud/selecao-listas.js:selLEntrou, estilos.css:[data-selbox].sel-entra, o
veuEntra no --medio com a --curva-entra); marcar e as repinturas de fundo
não as voltam a animar. Cada cartão diz se está marcado ao leitor de ecrã
(aria-pressed, cloud/selecao-listas.js:selLPintar), e a caixa desenhada fica
escondida dele.

## Os Planeados, os Créditos e a Agenda
Os Planeados (planeados.js:vRecurring, o canvas M-Planeados) são, por esta
ordem: a faixa de quem vem de trás, o cartão «Por confirmar», a pesquisa à
vista com o funil e os chips (vistas.js:lfCabeca), a lista num cartão e os
Modelos em chips, com o valor quando o têm. Os chips são o estado, o tipo e,
no ecrã largo, o imóvel. O estado (planeados.js:REC_ESTADOS, aplicado pelo
planeados.js:recChip — o mesmo lf('lrec').st do seletor do painel) tem
Automáticos, Criados à mão, Silenciados, Por confirmar e Em dia, cada um com
quantos há pelos olhos dos outros filtros; ligado diz o rótulo curto. A
ordenação diz a de sempre, a «Próxima data». Cada linha da lista (planeados.js:recLinha) diz
a periodicidade com o dia («mensal, dia 5», planeados.js:recRepete) e a
próxima data; o tipo, o imóvel e a categoria; o selo da origem e o do
estado; e o valor. O selo da origem (planeados.js:recOrigem) é roxo «da
hipoteca», cobalto «do contrato», e cinzento «do imóvel» e «à mão». Não há
FAB nem ⋮: o «Novo recorrente» está no cabeçalho e no +, as opções no ⋯ da
ficha, e o toque longo seleciona vários (ver a seleção dos Planeados, em
«Os Movimentos»).

No dedo, os chips dos Modelos têm 44px (estilos.css:.plan-modelo), sem o
::after das irmãs: a fila rola de lado e cortava-o. Com filtros, os vazios
são o vazio dos filtros, com «Limpar filtros» (vistas.js:vazioFiltro), na
lista e nos Modelos; e com um estado que não o «Criados à mão» —
Automáticos, Silenciados, Por confirmar ou Em dia — a secção dos Modelos
sai, porque um modelo não tem estado.

O cartão «Por confirmar» (planeados.js:pendingCard) diz o estado no selo de
cada linha (planeados.js:recSelo), sem borda colorida. O cabeçalho diz
quantas estão em atraso (num selo vermelho), o total e quantas esperam. O
total soma com o sinal das linhas (planeados.js:pendTotal): o que entra
soma, o que sai (a prestação incluída) subtrai, uma transferência conta
zero; verde (.pos) quando dá zero ou mais, laranja (.neg) com o − quando dá
menos — somar todos os montantes como positivos contradizia as linhas por
baixo. O cabeçalho abre e fecha a lista, fechada por omissão
(planeados.js:pendToggle; ver «O que é longo abre fechado»); as em atraso
vêm primeiro. Cada linha (planeados.js:pendLinha) tem o nome, de onde é e quando («entre 01/10 e
08/10», planeados.js:recQuando), o valor com a cor do dinheiro — verde o que
entra, roxo a prestação, laranja com o − o resto do que sai
(planeados.js:recValor) — e o selo; tocar no texto abre a ficha
(planeados.js:recView). O texto e o valor andam juntos
(estilos.css:.plan-pend-topo): quando a linha não chega, só as ações descem
— também nos cartões dos contratos, que usam o pendLinha. As ações são
Confirmar (primário, quickConfirmRec), Rever (o formulário, confirmRec) e o
⋯ com o resto (planeados.js:pendMenuItens): «Silenciar avisos» ou «Reativar avisos»,
«Recusar desta vez» (cloud/painel.js:CW.rejectRec) e «Preencher N em falta»
(cloud/painel.js:CW.fillMissed), estas duas só quando a nuvem as tem. As
mesmas linhas vão nas linhas dos contratos (cloud/painel.js:pendBlock; ver
«Os Contratos»).

A faixa de quem vem de trás (planeados.js:recRetroFaixa) mostra um planeado
de cada vez com dois ou mais períodos passados sem movimento
(planeados.js:recRetroCandidatos — nunca as prestações, que se perguntam ao
gravar a hipoteca): desde quando, o que falta (planeados.js:recRetroMeses),
quanto e com que etiqueta. «Registar os N» abre a janela do preenchimento
(cloud/painel.js:CW.fillMissed), com as datas, o total e o aviso de que é uma
estimativa; «Agora não» guarda no aparelho quantos faltavam
(planeados.js:recRetroAgoraNao; a chave gi_retro_agora_nao é
planeados.js:RETRO_LS), e a faixa só volta a esse planeado se passarem a
faltar mais.

Os Créditos (creditos.js:vCredits, os canvas M-Creditos e D-Creditos) abrem
com o resumo (creditos.js:credResumo): no telemóvel o cartão azul-noite
(--side), com a dívida no fim de cada ano em barras; no computador, três
cartões. Segue-se o aviso dos pagamentos sem hipoteca, com «Associar»; a
pesquisa à vista com o funil e os chips (vistas.js:lfCabeca) — o estado,
Ativas · N e Liquidadas · N (aplicado pelo creditos.js:credVerPagas, que
larga a hipoteca escolhida), o imóvel quando há mais de um com hipotecas, e
a ordenação no ecrã largo —; e os cartões das hipotecas
(creditos.js:credCartao): o selo do tipo de taxa, a
taxa por extenso, o fim da taxa fixa quando cai dentro da janela dos prazos
(creditos.js:credSeloFixa, creditos.js:credFimFixa), a prestação e a de
depois da fase fixa (creditos.js:credDepois), o capital em dívida com as
prestações por pagar, a barra do capital do início já pago e, no telemóvel,
Pagamento e Plano. A coluna é a mesma em todos os ecrãs: o título
«Ativas» (no computador sem o «Nova hipoteca», que está no cabeçalho), as
ativas e o botão «Liquidadas · N», que as abre por baixo
(creditos.js:credPagasAlternar; estilos.css:.cred-corpo.abertas). Com o
estado «Liquidadas», só as pagas, abertas, com o título «Liquidadas». No
computador a lista fica à esquerda, e a hipoteca escolhida — entre as que se
veem — aberta à direita, com o plano (creditos.js:credDetalhe): tocar
numa hipoteca escolhe-a no painel em vez de abrir uma janela por cima
(creditos.js:mortView chama o creditos.js:credEscolher quando o painel está
à vista). Como a ficha, com o ⋯ → Amortização, não abre dali, o painel tem
«Plano» — o plano inteiro e o gráfico (creditos.js:amortModal) — entre
Pagamento e Editar.

As barras da dívida do resumo (só no telemóvel) leem-se com o dedo como os
gráficos da Visão geral, pela mesma maquinaria (creditos.js:credBarrasLer,
com graficos.js:dadosParaLer e graficos.js:cabecaDaLeitura; o gesto é dos
ouvintes do documento, graficos.js:mostrarColuna): uma guia acompanha o ano
mais próximo, e a leitura («2036 · 142 440 €») fica no lugar reservado por
cima das barras, acesa no ano corrente e de volta a ele ao largar; o cartão
não muda de altura ao tocar. A leitura não mexe no desenho das barras, do
eixo e do cartão azul-noite: as colunas do leitor ficam no meio de cada
barra, passadas às unidades do leitor (graficos.js:W), e as barras guardam
os 56px (estilos.css:.cred-r-caixa — o `.chartbox svg` dá-lhes height:auto,
e cresceriam com a largura). A leitura e a guia levam as cores da barra
lateral (--side-on, --side-ink, e a bolinha --side-text, a cor das barras),
legíveis no azul-noite nos dois temas.

O plano de amortização é uma tabela só (creditos.js:credTabela), que rola
dentro da sua caixa com o cabeçalho preso (estilos.css:.cred-plano). As
linhas vêm do creditos.js:planoLinhas: as doze primeiras prestações uma por
linha, com o mês e o ano («out 2026»), e depois, a seguir a uma linha de
grupo «Anos seguintes» (um `<th scope="rowgroup">` noutro `<tbody>`, que não
fica preso em cima nem à direita, estilos.css:.cred-tab-grupo), um ano civil
por linha com a soma desse ano. O primeiro ano é o resto do ano em que
acabam as doze — parcial —, e o último o do fim; um ano com menos de doze
prestações diz quantas («3 prestações»). As colunas são o Período, a
Prestação (o que se paga: capital + juros + selo), o Capital, os Juros, o
Selo e a Dívida no fim. A taxa não tem coluna: vai por baixo do período na
primeira linha e onde muda (a passagem de uma mista à variável). Os meses
levam os cêntimos, os anos o euro inteiro. As somas batem: a soma de todas
as linhas é a da amortização (credito.js:amort), e a dívida da última é
zero. No painel do computador (creditos.js:credDetalhe) vão os doze meses,
os dez primeiros anos e uma última linha com o ano em que acaba; na janela
da amortização (creditos.js:amortModal, o «Plano»), inteira. Os juros e o
selo não levam cor na tabela. A «Dívida no fim» fica presa à direita da
caixa (estilos.css:.cred-tab-plano, position:sticky), com um traço à
esquerda no telemóvel e no tablet a dizer que a tabela rola.

O gráfico ano a ano e as barras contam por ano civil (creditos.js:yearRows):
a primeira linha leva as prestações do mês da primeira até dezembro — a
primeira é a próxima por
confirmar com os Planeados ligados, senão hoje (creditos.js:credPrimeiraData,
que é também o «Prestação de …» do painel) —, as seguintes doze cada, e cada
linha tem o seu ano. As barras do resumo e o gráfico de «Todas as hipotecas»
somam pelo ano de cada linha (creditos.js:credDividaPorAno): antes do
primeiro ano do seu plano uma hipoteca ainda deve o capital de agora, depois
do último já não deve nada; a barra acesa é a do ano corrente. A ficha da
hipoteca (creditos.js:mortFicha) chama ao custo até ao fim «Juros e selo até
ao fim», como o resumo e o painel, e «Juros até ao fim» só numa hipoteca sem
selo.

A Agenda (calendario.js:vCalendar, o canvas M-Agenda) é o cartão do mês — as
setas de 44×44, o nome do mês e quantas visitas e quantos planeados tem, os
dias da semana abreviados, a grelha e a legenda — e o painel do dia. Na
grelha (calendario.js:calCelulas) cada dia é um botão com o nome lido em voz
alta; os dias dos meses vizinhos ficam esbatidos e sem toque (.fora antes do
dia 1, .seguinte.fora depois). Hoje vai a cheio em cobalto, o dia escolhido
com um anel (estilos.css:.calday.on), e o realce de passar por cima só
existe com rato; um ponto cobalto marca os dias com
visitas, um laranja os dias com planeados (estilos.css:.pt.pla). O painel do
dia (calendario.js:calDiaPanel) tem o título por extenso
(calendario.js:calTituloDia: «Hoje, sábado 17/10», «Amanhã, …»,
«Segunda-feira, 19/10»), as visitas — a hora, quem e onde, o estado — e os
planeados — o sentido do dinheiro, o nome, de onde é e a periodicidade, o
valor (calendario.js:calValor) — num cartão; de onde é diz-se como nos
Planeados (planeados.js:imovelDoMolde: o imóvel, o grupo, «Todos os
imóveis» ou «Sem imóvel»), e não só o imóvel. E o painel tem «Marcar visita» e
«Recorrente». No computador o mês e o dia ficam lado a lado
(estilos.css:.cal-pag).

Por baixo do painel do dia, na mesma coluna (estilos.css:.cal-coluna — no
computador, a segunda coluna da .cal-pag), vive o cartão «Por confirmar»
(calendario.js:calPendCard): os planeados vencidos que ainda avisam, a mesma
lista que o crachá da Agenda conta na barra de baixo
(calendario.js:calPendentes, que o calendario.js:calCracha também usa — o
número no ícone e o do cartão não podem discordar). Sem nada por confirmar,
ou com os Planeados desligados, não há cartão. O cabeçalho é um botão dentro
de um título (o acordeão: o leitor de ecrã diz «recolhido» ou «expandido»,
aria-controls para o corpo) com «Por confirmar», quantos em atraso num selo
vermelho, o número num selo com a cor do crachá da barra de baixo
(estilos.css:.cal-pend-n, o --out do .tabbar a .cnt) e «N planeado(s) à
espera · toca para ver». O corpo leva as linhas do cartão dos Planeados
(planeados.js:pendLinha — Confirmar, Rever, a ficha e o ⋯) numa lista viva,
os em atraso primeiro, e a dica que diz de onde vem o crachá. Fica fora do
#calDiaPanel: o calendario.js:calSel repinta o painel a cada dia escolhido,
e o cartão não muda com o dia. Confirmar ou silenciar repinta a vista e a
barra (quickConfirmRec e skipRec chamam o buildNav e o render), e o cartão e
o crachá descem juntos. Abre fechado (ver «O que é longo abre fechado») e
dobra como as secções da gaveta (ver «Movimento»). O arrasto da grelha é o de sempre
(calendario.js:calArrastar), com a altura do mês de agora: durante o
arrasto a grelha corta em altura o que lhe passa (estilos.css:#calDias.arrasta,
overflow-y:clip, que deixa os lados à vista), porque um vizinho de seis
semanas tem mais uma fila do que um mês de cinco, e ela ficaria por cima da
legenda. A fila a mais só aparece depois de largar, quando a fita abre o
espaço (continuidade.js:aFitaAbreEspaco).

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
(95), que não escondem nada com que se possa interagir — e os portões de
ecrã inteiro, que tapam a app toda de propósito (ver «Um portão por cima de
tudo não mostra avisos»).

**Centrado no ecrã, e não na área que sobra do menu.** A alternativa foi
considerada e não vale: a largura do menu muda (`--rail`),
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

## Um portão por cima de tudo não mostra avisos
Há ecrãs que tapam a app inteira de propósito, e só se sai deles pela porta
que dão: a entrada (cloud/entrada.js:#cwAuth), os termos novos
(cloud/ajuda.js:#cwTerms) e a versão velha demais
(novidades.js:gateAtualizar). Estão acima do aviso (estilos.css:.toast, 90)
e de uma janela normal (estilos.css:.modal, 70) — os números estão em
«Espaçamento, raios e sombras» —, e por isso o que um portão tem para dizer
diz-se nele. No ecrã de entrada, o que o servidor responde escreve-se no
próprio ecrã, os erros num sítio e o resto noutro (entrada.js:#cwa_err,
entrada.js:#cwa_info; entrada.js:esqueci), e o que falta num campo diz-se
junto dele (componentes.js:falhaCampo): um toast fica por trás. E uma
janela que um portão abre leva a classe que a põe por cima dele
(estilos.css:.modal.sobre-portao; ajuda.js:CW.refuseTerms): aberta por
baixo, é um toque que não faz nada que se veja.

A regra vale também para o ecrã trancado da atualização (#cwUpd, z 235) e
para a palavra-passe nova. Sem servidor, o novidades.js:CW.atualizarAgora
escreve a frase no próprio ecrã trancado, na caixa novidades.js:#cwUpdErro
(role=alert, por cima do botão; estilos.css:.upd-erro, âmbar --warn-soft e
--warn, escondida quando vazia), e esvazia-a a cada tentativa; só da faixa
discreta, sem o #cwUpd, é que a frase vai no aviso. O
novidades.js:gateAtualizar traz a caixa vazia. E a palavra-passe nova
confirma-se no #cwa_info do ecrã de entrada («Palavra-passe mudada. Entra
com a nova.», entrada.js:CW.reporConfirmar), e não num aviso.

A entrada (entrada.js:showAuth, as pranchetas M-Entrar e M-CriarConta): a
marca, numa faixa do mosaico quando se chega por uma ligação; quem convida,
com o avatar e os nomes a negro (entrada.js:fraseDaChegadaHtml,
entrada.js:pintarNotaDaChegada); o segmentado «Entrar / Criar conta», que é
um tablist com as setas e não apaga o email escrito ao trocar
(entrada.js:CW.modoDaEntrada, entrada.js:CW.teclaDaEntrada); os campos de
ecrã inteiro, de 48px, com os rótulos à vista (entrada.js:camposDaEntrada) e
o «Mostrar» da palavra-passe (entrada.js:CW.verPalavraPasse); e, no registo,
os requisitos da palavra-passe, que se acendem enquanto se escreve — o visto
e o círculo vazio desenhados, e o estado escrito para o leitor de ecrã
(entrada.js:pintarRequisitos, a mesma caixa da mudança de palavra-passe,
partilha.js:passwordModal). Um email mal escrito marca-se ao sair do campo,
sem lhe levar o foco (entrada.js:marcarCampo); ao enviar, é o falhaCampo.
«Esqueci-me da palavra-passe» sem email escrito aponta para o campo do
email, que é para onde vai a ligação.

A faixa de quem chega por um convite tem o mosaico azul-noite
(estilos.css:.imv-mosaico.imv-noite: #16244A com arcos #9FB4FF, iguais nos
dois temas, o .tile das pranchetas M-Entrar e M-Atualizar). Os imóveis do
convite são cartões — contorno, raio 14, o mosaico de 64px e o nome dentro
(entrada.js:casasDaChegada, também no entrada.js:modalLigar e no
entrada.js:modalGrupo) —, e «O que vais poder fazer» é uma secção em cartão,
de raio 16 e padding 16 (estilos.css:.cv-pode). Uma ligação de convite que já
não serve esquece-se, e a frase fica em CW._chegadaErro: o showAuth mostra-a
como erro no topo, sem a faixa, a nota e o «e ver o convite» (o convite já
não existe), e continua a mostrá-la ao trocar de separador, até se entrar
(entrada.js:finishLogin limpa-a). Com o ecrã de entrada já aberto,
redesenha-se; ainda fechado, mostra-a quando abrir — chamar o showAuth
daí abria a entrada antes de o arranque a decidir. No dedo, o segmentado
«Entrar / Criar conta» tem 44px (estilos.css:.ent-segm, e o par
@media(pointer:coarse) a seguir). As ligações dos Termos dentro da caixa de
aceitar ficam como texto corrido: uma área maior roubava os toques que
marcam a caixa.

Os termos novos (ajuda.js:showTermsGate, M-Termos): o ícone, o título, que
recebe o foco, a data da versão nova, os dois documentos como linhas que
abrem por cima, o essencial do aviso, «Aceitar e continuar» primário e
«Recusar e apagar a conta» fantasma, com o texto a vermelho: quem destrói é
a confirmação que ele abre, e essa leva o botão vermelho cheio e a palavra a
escrever.

A versão velha demais (novidades.js:gateAtualizar, M-Atualizar) é azul-noite
de ponta a ponta, com o mosaico azul-noite da entrada (o .upd-mosaico guarda
a opacidade .55 do canvas), a frase da versão
(novidades.js:ecraDaVersao) e a caixa dos passos — procurar, descarregar (ou
limpar a versão antiga), reiniciar — num role=status
(novidades.js:caixaDosPassos): por fazer no ecrã trancado, a correr no ecrã
de progresso (novidades.js:ecraAtualizar, que recebe a chave do passo e não
a frase). Tranca também as escritas (ver «O service worker e a versão»).

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
de três em três minutos lê o estado (nucleo.js:pullNow). Só com o separador à
vista, e cada vez menos quando ninguém mexe na app — de dez em dez minutos
depois de dez parada, de meia em meia hora depois de uma hora
(nucleo.js:intervaloDeLeitura) —, porque cada leitura lê na D1 as linhas
todas da conta, mesmo quando acaba num 304; o primeiro toque volta ao ritmo
normal (nucleo.js:marcarAtividade). O retrato guarda um
resumo de cada entidade, e não o JSON dela (nucleo.js:resumoDeTexto): com o
JSON, o retrato chegava a passar de um terço da base.

Ler o estado é uma fusão a três, com o retrato como base
(nucleo.js:applyState). O que aqui está igual ao retrato passa a ser o que o
servidor tem, incluindo desaparecer; o que é novo, foi editado ou foi apagado
aqui fica por cima (nucleo.js:pendentesLocais, nucleo.js:reporPendentes), e o
push seguinte envia-o. Uma casa ou um registo que o servidor também tem não
vai inteiro por cima: funde-se com o do servidor e com a base deste aparelho
(nucleo.js:fundirCasaLocal, nucleo.js:fundirRegistoLocal; ver o parágrafo a
seguir). As marcas (os campos com _), os donos e as quotas são sempre do
servidor (nucleo.js:fundidoComServidor). Duas exceções: uma base de outra
conta cede ao servidor inteira, e sem retrato os dados locais só sobem se o
servidor estiver vazio. Trocar o db pelo do servidor, como se fazia, perdia o
que se escreveu offline e o que um 429 recusou.

A casa e os registos fundem-se, não se gravam por cima. A casa, um
contrato, um movimento, uma ficha são JSON que duas contas (e cada aparelho)
gravam inteiros. Cada envio diz que versão do servidor leu: o aparelho tem,
por conta, a base de cada casa e de cada registo — a versão do servidor na
forma local, refeita a cada estado aplicado e trocada pelo que subiu em cada
envio aceite (nucleo.js:bases) —, e o put leva só os campos que mudaram
desde ela, com o valor que ela lhes dava, e os que saíram
(nucleo.js:baseParcial). O que é igual à base não sobe. O servidor funde o
que chega com o que tem (worker/src/lib/escritas.js:escreverCasa,
worker/src/lib/escritas.js:gravarRegisto,
worker/src/lib/permissoes.js:fundirCasaComBase): o que não mudou desde a base
fica como está; o que mudou ganha; um campo que saiu aqui sai; as listas com
id (as tarefas e as secções, as fotos, os quartos, as hipotecas e os
documentos delas; num contrato os documentos, o inventário, as chaves e as
renovações; numa ficha os documentos) juntam-se item a item — o que se
adicionou de cada lado entra, só sai o que se removeu do lado que envia, e o
mesmo campo mudado dos dois lados fica com o último. A ordem é a de quem a
mudou; o que só um lado tem entra antes do que se lhe seguia, ou no fim
(worker/src/lib/permissoes.js:fusaoOrdem). As regras de sempre vêm por cima
do fundido: na casa, o colaborador passa pelo fundirCasa (o que o cargo não
vê nem entra nem sai); no planeado de outrem que um colaborador confirma, só
next, until e muted entram (worker/src/lib/acesso.js:planeadoAGravar); os
anexos que a escrita junta têm a regra deles
(worker/src/files.js:regraDosAnexos). Uma fusão que deixa o JSON como estava
não grava (nem muda o autor). A casa grava por cima da revisão que leu; um
registo, por cima do texto que leu — outra escrita a meio faz repetir a
fusão, e à terceira é um 409 que não mexeu em nada. O cliente funde da mesma
maneira ao ler, com o mesmo código: o bloco da fusão vive igual, letra a
letra, em worker/src/lib/permissoes.js e em web/cloud/nucleo.js, e o
testes/fusao-da-casa.test.js compara-os.

No aparelho guardam-se as bases das casas e as dos registos por enviar
(nucleo.js:saveBases, nucleo.js:basesPorEnviar — gravadas no começo de cada
envio, antes do pedido); a de um registo que o retrato diz igual ao do
servidor é, no arranque, o próprio registo (nucleo.js:loadBases). Guardar
todas levava outra vez a base duas vezes para o localStorage. Cada base
guardada passa pela normalização desta versão ao carregar
(nucleo.js:normalizarDaChave): o objeto local também passou, e uma versão
nova que acrescenta um campo não faz o objeto parecer mexido. Era isso que
apagava: uma cópia velha que diferia do retrato só porque a versão nova a
normalizava de outra maneira subia inteira. Um envio sem base — uma versão de
antes, um PUT REST sem `base` — não remove nada: só junta e muda. Sem base no
aparelho (a primeira sessão com bases, uma cópia que esta versão normaliza de
outra maneira), o que o servidor já tem não sobe antes do primeiro estado
(nucleo.js:pushNow), e ao ler os campos simples são os do servidor e as
listas com ids juntam-se (nucleo.js:baseSemListas).

Os anexos sobem à parte dos registos. Guardar um anexo no aparelho é também subi-lo
(cloud/anexos.js: o idbPut embrulhado → subirAnexo), com a casa a que pertence quando já se
sabe (cloud/anexos.js:casaDoAnexo); uma foto começa a subir mal é escolhida, ainda sem casa,
com o nome do ficheiro. Se a gravação do registo chegar ao servidor antes de o upload acabar
— acontece com quatro em cinco fotos —, o linkFiles dela não encontrou o anexo; quando o
upload acaba, o cliente pede ao servidor para o prender ao registo da casa que já o refere
(cloud/anexos.js:prenderAnexo, worker/src/files.js:handlePrender), sem voltar a mandar o
conteúdo, e o PUT com ?casa= faz o mesmo (worker/src/files.js:prenderAoQueORefere). Depois
de cada envio aceite sobem os anexos que esta sessão ainda não tratou, vinte de cada vez
(cloud/anexos.js:subirPendentes) — nunca os mesmos outra vez.

A miniatura de uma foto mora no R2 na chave tn/<id> (worker/src/files.js:chaveDaMiniatura),
sem linha em files: decide-se tudo pela linha do original (worker/src/files.js:
handleMiniatura). Vê-a quem vê a foto; escreve-a quem pode apagar a foto (um colaborador só
nas que ele carregou); não conta para o teto da conta nem para o travão dos uploads (tem o
seu, tn:); sai com a foto — o DELETE, a varredura e o apagar da conta levam as duas chaves
(worker/src/files.js:chavesNoR2).

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
toast (nucleo.js:avisoDoServidor); «Sem ligação ao servidor» é só sem rede,
ou sem resposta a tempo.

A sessão vive no cookie HttpOnly que o servidor põe; o aparelho guarda quem
entrou, não o token (o token só vem no corpo fora de produção e a pedido, para
os testes: worker/src/auth.js:tokenNoCorpo). Uma sessão antiga, guardada com
token, passa para o cookie no arranque (nucleo.js:largarTokenAntigo). Sair é
um ritual só (nucleo.js:encerrarSessao): num simples sair a base e o retrato
ficam, apagar a conta leva-os. E um 401 de uma palavra-passe errada não põe
ninguém fora (nucleo.js:sessaoCaiu).

## As Definições
A raiz é a do canvas de 2026-10 (M-Definicoes): três secções — Conta,
Dinheiro e IRS, App —, cada uma com o rótulo e as linhas numa lista com
divisórias (estilos.css:.def-lista). Cada linha é um botão com o ícone num
quadrado de 36, o título, o resumo e a seta (definicoes.js:linhaDaRaiz); no
computador as secções correm em duas colunas (estilos.css:.def-raiz). No
fim, com sessão, «Terminar sessão». A raiz é uma só, declarada como dados: a
base declara as secções (definicoes.js:DEF_SECCOES) e as linhas
(definicoes.js:DEF_LINHAS), e a nuvem acrescenta as dela sem reescrever a
página de ninguém (definicoes.js:linhaDefinicoes). Secções seguidas com o
mesmo título juntam-se numa lista só (definicoes.js:seccoesVisiveis): a «App»
é a 'aplicacao', a 'ajuda' e o 'sobre', e os ids 'conta', 'ajuda' e 'sobre'
ficam, porque a nuvem pendura lá as linhas dela (cloud/partilha.js,
cloud/novidades.js). A secção Conta é toda da nuvem — o cartão do perfil e a
Segurança (partilha.js:cartaoDoPerfil, partilha.js:vCloud) —, e sem a nuvem
fica vazia e some.

Uma linha diz a secção, a ordem, o rótulo, o ícone e o resumo (que pode ser
uma função, lida a cada pintura), e mais: page, a subpágina que abre, ou ir,
o separador onde a coisa vive (go), que nenhuma das de hoje usa: uma linha
das Definições não leva para fora delas — a situação fiscal vive só na página
do IRS · Anexo F, os Colaboradores nas Pessoas e os Grupos nas Casas; cracha,
uma função que devolve o número do crachá, que a navegação lateral mostra
(nenhuma das de hoje o usa: o crachá dos pedidos dos Grupos vive na aba
deles e na linha da gaveta, servicos.js:crachaDe); se, uma função que diz
se a linha aparece agora (nenhuma das de hoje o usa); e linha, uma linha desenhada à
parte, dentro da lista — o Tema. Um html continua a ser um cartão inteiro, à
parte da lista. O Tema está na própria raiz, num segmentado Automático, Claro
e Escuro que grava ao tocar e devolve o foco ao botão escolhido
(definicoes.js:linhaDoTema, definicoes.js:temaEscolher; as opções têm o id
defTema_<tema>), como os segmentados das categorias e dos grupos; por baixo,
só no Samsung Internet e com o Automático, a nota que diz onde se desliga o
escurecimento forçado (definicoes.js:notaDoSamsung; ver «Tema escuro e a
regra do color-scheme»). O toque no
título leva à página do Tema (definicoes.js:vTema), que explica o que fazer
quando o browser não passa a preferência do sistema e continua a gravar pelo
tema.js:setTheme.

A cabeça das subpáginas é o backRow, e não é um texto fixo: é um getter do
window (definicoes.js:cabecaDaSubpagina), lido na hora por todas as
subpáginas — as da base e as da nuvem, que continuam a escrever
backRow+vCloud() sem mudar. É só das Definições: os Grupos e os Colaboradores,
que são separadores das Casas, não a têm. No telemóvel é o Voltar, colado ao
topo, que sobe sempre à raiz (goSet('')). No computador o Voltar some e fica a navegação lateral das
Definições (definicoes.js:navDasDefinicoes, o canvas D-DefCategorias): as
mesmas secções e linhas da raiz, com a página aberta acesa — o IRS e as
etiquetas acendem as categorias, os termos e a política o aviso legal
(definicoes.js:paginaDasDefinicoes) —, posta ao lado do conteúdo pela folha
(estilos.css:.wrap:has(>.def-nav)). A Ajuda tem porta própria na barra
lateral e fica sem ela. O navRow (definicoes.js:navRow) é uma função, com o
desenho das linhas da raiz num cartão só dela (o aviso legal usa-a), e os
títulos das subpáginas da base são os do canvas.

As páginas:

- «Categorias, etiquetas e IRS» é uma página só (definicoes.js:vCats, o
  canvas D-DefCategorias): Pagamentos e Receitas num segmentado
  (definicoes.js:defArvoreEscolher), «Repor as de origem» e «Nova
  categoria»; a tabela (definicoes.js:tabelaDeCategorias), com a seta das
  subcategorias, que abrem no sítio (definicoes.js:defCatAbrir), quantos
  movimentos, a coluna do Anexo F (só nos pagamentos;
  definicoes.js:colunaDoAnexo, que o setIrsMapa lê pela posição), o
  interruptor «Fora dos totais» e o ⋯ (mudar o nome,
  definicoes.js:mudarNomeCategoria; nova subcategoria; apagar); por baixo, as
  etiquetas em chips que se removem (definicoes.js:cartaoDasEtiquetas) e o
  que o art. 41.º deixa deduzir (definicoes.js:cartaoDoArt41). A tabela
  mede-se a si própria, e não o ecrã: cada linha parte-se em duas
  (estilos.css:.def-cat) quando o cartão tem 640px ou menos
  (estilos.css:.card.def-tabela, o @container defcat), e um browser sem
  container queries fica com a regra do ecrã (o @supports not). Dos 901px
  para cima a navegação lateral das Definições come 274px, e uma regra pelo
  ecrã deixava cinco colunas em 341 a 540px, com os nomes a 0px. Uma grelha
  que vive ao lado da navegação lateral parte-se por container query, nunca
  por media query. A lista da coluna do Anexo F parte as opções em linhas em
  vez de as cortar (estilos.css:.def-cat-col, o .selopt span): estreita, vai
  até à borda do cartão (100cqi), larga, até 340px. O «Fora dos totais» de
  cada linha é um <label> com o interruptor (definicoes.js:tabelaDeCategorias,
  estilos.css:.def-cat-fora): o toque no rótulo liga, e a área chega aos
  44px. «Repor as colunas do Anexo F» vive numa linha só dela, por baixo da
  nota (estilos.css:.def-repor). As confirmações de apagar uma categoria, uma
  subcategoria ou uma etiqueta dizem quantos movimentos no singular ou no
  plural (definicoes.js:delCat, definicoes.js:delSub, definicoes.js:delTag).
  No dedo, os segmentados (estilos.css:.def-abas>button), a coluna do Anexo F
  e o × das etiquetas têm 44px, e a seta das subcategorias fica com 40px de
  largura e uma área que cresce com um ::before
  (estilos.css:button.def-cat-abre::before). As subpáginas
  'irs' e 'tags' continuam a abrir e dão a mesma página (o fisco.js manda
  para goSet('irs')), e os textos que ensinam o caminho para as etiquetas e
  para a coluna do Anexo F de uma categoria dizem «Definições → Categorias,
  etiquetas e IRS» (movimento.js:addTxTag, cloud/selecao.js:CW.selEditar,
  fisco.js:fiscoAvisos, fisco.js:fiscoKpis).
- «Importar e cópias» (definicoes.js:vImport, D-DefDados): a cópia de
  segurança e a exportação lado a lado — os Movimentos e, com a Declaração
  ligada, o Anexo F do ano (fisco.js:fiscoCsv), os dois só com o que é meu —;
  o Splitwise, com o ficheiro escolhido ou colado (o imóvel, a quota-parte e
  a pré-visualização ficam na janela seguinte, splitwise.js:swMapModal) e
  «Anular a última importação (N movimentos, dd/mm/aaaa)»
  (definicoes.js:ultimaImportacao); e «Apagar todos os dados» — com sessão, o
  cartão diz porque não se apaga aqui e dá «Terminar sessão» e «Apagar a
  conta» em vez do botão.
- «Valores por omissão» (definicoes.js:vDefaults, M-ValoresOmissao): duas
  listas de linhas, o que é à esquerda e o campo com a unidade à direita
  (definicoes.js:linhaDeValor — o rótulo é a linha inteira); a nota do fim
  diz o que vale cada campo em branco. Cada campo grava sem repintar
  (definicoes.js:gravarValorPorOmissao, com as regras em
  definicoes.js:NORMA_DOS_VALORES): o setSet repintava a página e destruía o
  campo para onde se ia — o foco caía no body e, no telemóvel, o teclado
  fechava. O campo passa a mostrar o valor gravado (o horizonte em branco é
  1, o yield em branco volta a 5); o yield usa a regra do
  avaliacao.js:capTargetSet, sem o chamar, porque ele repinta. A unidade tem
  a mesma largura em todas as linhas, também a 520px ou menos, e os campos
  ficam numa coluna (estilos.css:.def-unidade).
- Os «Filtros comuns» são uma lista de linhas, com o apagar à direita
  (definicoes.js:vFiltrosComuns).

As páginas que a nuvem pendura na raiz vestem o mesmo:

- «Segurança» (partilha.js:vCloud; o nome e o subtítulo — «Palavra-passe,
  sessões e apagar a conta» — vêm de SUBPAGE.cloud) é só a segurança: a frase
  da sessão de 30 dias e um cartão com quatro linhas — «Mudar a
  palavra-passe», «Terminar sessão nos outros aparelhos», «Terminar sessão»
  (com «Entraste como <email>», para se saber de que conta se sai) e «Apagar
  a conta», a linha vermelha com data-risco="destroi" que abre a
  confirmação. Não tem título por dentro (o da página já o diz); a secção tem
  aria-label="Segurança". A linha da raiz das Definições diz «Segurança», com
  o cadeado ('lock') e o sub «Palavra-passe, sessões e apagar a conta» (sem
  sessão, «Inicia sessão»), e não mostra o id. Sem sessão, a página é o
  cartão «Segurança · Sem sessão iniciada» com «Iniciar sessão». O perfil
  está no cartão do topo das Definições (partilha.js:cartaoDoPerfil); o id e
  a partilha entre contas nas Pessoas › Proprietários; os grupos partilhados
  no separador Grupos. Sem o separador dos Proprietários nesta conta
  (servicoLigado('owners') falso), a partilha entre contas fica na Segurança,
  numa secção à parte por baixo («Partilhar com outras contas», o h2
  #ptPartilhaConta), com o id, as ligações todas, o campo, os pedidos e a
  ligação de partilha (partilha.js:comproprietariosCorpo, com as ativas) — é
  o único sítio onde se chega a ela; com o serviço Colaboradores também
  desligado, fica lá a frase de quem o liga.
- A partilha entre contas vive por baixo da lista dos Proprietários
  (partilha.js:comproprietariosHtml, a secção «Partilhar com outras
  contas»): os convites por responder nos dois sentidos, como linhas com o
  avatar e as ações certas (partilha.js:connCard); a linha «O teu id» com o
  código de 8 caracteres e «Copiar» (aria-label «Copiar o teu id»,
  partilha.js:CW.copyId) logo acima do campo «O id do outro utilizador» —
  dar o meu e escrever o do outro no mesmo cartão
  (partilha.js:comproprietariosCorpo); os pedidos e a ligação de partilha. As
  ligações ativas não se repetem lá, que já estão na lista de cima
  (pessoas.js:donosComPartilha), e o vazio só diz «Ainda não estás ligado a
  ninguém.» quando não há ligação nenhuma. Com o serviço Colaboradores
  desligado nesta conta, no lugar da secção fica a frase «O serviço
  Colaboradores está desligado nesta conta. A partilha entre contas fica
  disponível quando o suporte o ligar.» O «Copiar» diz «Id copiado. Dá-o ao
  outro utilizador para ele te ligar.»; sem clipboard, ou com a cópia
  recusada, diz «Não deu para copiar. O teu id é <id>: dá-o ao outro
  utilizador.» — nunca «copiado» sem ter copiado. Um toque longo no código
  apanha-o inteiro (estilos.css:.pt-meuid, user-select:all). Um convite de ligação
  recebido tem o fundo --accent-soft, o título e a frase em --accent-text e
  o avatar em --card (estilos.css:.pt-linha.pt-convite). Os erros dizem-se
  junto do campo: o «Ligar» vazio e o que o servidor recusa (o próprio id) no
  #cw_peer (partilha.js:CW.addConn); a palavra-passe fraca na nova, que
  mantém a caixa dos requisitos no aria-describedby
  (partilha.js:falhaPalavraNova), e o desencontro na confirmação
  (partilha.js:CW.savePassword); o #cw_pw_err fica para o que o servidor
  responde. O nome é «ligação» em tudo («Ligação aceite.», «Ligação
  removida.»), nunca «conexão». Remover uma abre «Remover a ligação a
  <nome>» (partilha.js:CW.delConn), com a frase de
  partilha.js:fraseRemoverLigacao — quantas casas deixo de partilhar e
  quantas das que recebo deixam de aparecer, sem «casa(s)» e sem género —, e
  o botão «Remover» vermelho, que o confirmModal tira da primeira palavra do
  título. No dedo, os .btn.sm desta página e dos pedidos têm 44px.
  «Editar casas partilhadas», na ficha do outro (ou «Casas partilhadas» em
  cada ligação, na Segurança sem os Proprietários), abre «Partilha com <nome>»
  (partilha.js:CW.sharesModal): as minhas casas com a caixa que as adiciona
  ou remove (a nova traz as quotas ao marcá-la; a que sai diz que o outro
  deixa de a ver), e por baixo as que o outro partilha comigo; cada casa
  partilhada mostra a divisão em vigor, a proposta por responder (confirmar,
  rejeitar ou cancelar ali mesmo) e «Propor nova divisão», que abre os
  campos com a divisão atual (partilha.js:quotasDaCasaHtml).
- «Ajuda e sugestões» (ajuda.js:vAjuda, M-Ajuda): «Como se faz», os
  tutoriais num carrossel (ajuda.js:tutoriaisNaAjuda); as perguntas de
  destaque, com a porta para as outras; «Os teus pedidos» com «Novo
  pedido», cada um com o selo do estado — Recebido cobalto, Em resolução
  âmbar, Concluído verde — e a resposta da equipa numa caixa --accent-soft
  com o texto --accent-text e raio 12 (ajuda.js:linhaDoPedidoAjuda,
  estilos.css:.aj-resposta; a data encosta à direita do selo), e a espera da
  casa enquanto não chegam; e o rodapé com a versão. O «Novo pedido» tem
  44px no dedo. As perguntas frequentes são uma lista só
  (partilha.js:PERGUNTAS_FREQUENTES), as de destaque na Ajuda e todas na
  página delas (partilha.js:vFaq), cada uma a abrir no sítio, com
  aria-expanded (partilha.js:perguntaHtml, partilha.js:CW.perguntaAbrir).
- O pedido ao suporte (ajuda.js:CW.newTicket, M-NovoPedido) é uma janela com
  o tipo num segmentado, que troca os textos sem apagar o que se escreveu
  (ajuda.js:CW.ticketTipo), os contadores de caracteres fora do rótulo, e os
  campos vazios ditos junto deles (ajuda.js:CW.sendTicket). Leva a versão da
  app (o VERSAO de web/avisos.js), e não a dos termos.
- «Novidades» (novidades.js:novHtml): por versão, «Versão N» e a data, e as
  secções que abrem e fecham (aria-expanded) — a primeira aberta
  (novidades.js:novPrimeira), as outras com quantas novidades têm. Abrir uma
  secção troca só a lista (novidades.js:#novLista) e devolve o foco ao
  botão. Na janela vai sem cartão, na página das Definições num cartão, e a
  linha da raiz tem o crachá do «N por ler». A página tem o seu cabeçalho,
  «Novidades» e «O que mudou em cada versão» (novidades.js:SUBPAGE.novidades,
  que o render lê): sem ele, caía no do separador, «Definições» com o
  subtítulo do Tema.

Um instante escreve-se «dd/mm/aaaa» (definicoes.js:dataDoInstante): os
convites, a última importação.

## Grupos partilhados
Um grupo de imóveis partilha-se como grupo, e não casa a casa: quem está no
grupo é comproprietário de todas as casas dele (menos as de que saiu — ver
«Sair de um imóvel» abaixo), com o que isso já significa
numa casa partilhada por ligação — vê e edita contratos, movimentos e
pessoas, entra nas quotas e nas propostas (worker/src/lib/acesso.js:participantsOf,
worker/src/lib/acesso.js:canAccessHouse, worker/src/lib/acesso.js:acessoACasa). A
regra vive no mesmo sítio que já decidia as partilhas por ligação; o estado
traz as casas dos grupos com os membros em participants
(worker/src/rotas/estado.js:rotasEstado), e o cliente não distingue uma casa
de grupo de uma casa partilhada por ligação.

Um grupo tem um dono, membros e casas (a migração 0017). Cada membro põe no
grupo casas SUAS — as que criou — e remove-as; o dono remove qualquer casa e
remove membros; sair leva as casas que se pôs; o dono não sai, apaga
(worker/src/rotas/grupos.js:rotasGrupos). Entra-se por uma ligação do dono,
multi-uso e com prazo de sete dias, mas ninguém entra sem o dono aceitar:
quem a abre fica com um pedido pendente (a migração 0018), e só passa a
membro quando o dono o aceitar nos pedidos por responder da Visão geral, no
sino, no cartão do grupo ou na janela dele
(web/cloud/grupos.js:CW.grupoAceitarPedido, partilha.js:linhasDosPedidos,
notificacoes.js:notifPedidos). Uma ligação
enviada à pessoa errada não dá acesso a nada, e enquanto espera, quem pediu
não vê nem os ids das casas (worker/src/rotas/grupos.js:pedidosDeGrupo). Só o
SHA-256 do token fica na base, e o 404 da ligação não distingue inválida de
expirada, revogada ou de grupo apagado
(worker/src/rotas/grupos.js:rotasPreVisualizacaoGrupo).

No cliente, um grupo partilhado é um grupo de imóveis como os outros — serve
de filtro, e um movimento atribuído a ele divide-se pelas casas — marcado
_partilhado, e nunca sobe como registo do utilizador
(web/cloud/nucleo.js:gruposPartilhadosEm, web/cloud/nucleo.js:exportEntities);
um grupo partilhado conta como vivo na fusão do estado, para o registo
antigo ficar obsoleto e sair
(web/cloud/nucleo.js:entidadesDosGruposPartilhados). Partilhar
um grupo privado mantém-lhe o id, para os planeados e os modelos que o apontam
continuarem a apontar (web/cloud/grupos.js:CW.grupoPartilhar). A janela do grupo
(web/cloud/grupos.js:CW.grupoModal) mostra a cada um só o que o servidor lhe
deixaria fazer; a aterragem de ?grupo= segue o molde das outras duas ligações
(acessos.js:parseConvite, entrada.js:modalGrupo,
web/cloud/grupos.js:CW.entrarNoGrupo); os partilhados vivem no separador
Grupos ao lado dos privados, cada um no seu cartão
(web/cloud/grupos.js:cartaoDoGrupoPartilhado).

**Onde vivem os grupos.** Os grupos são um separador da base, «Grupos»
(navegacao.js:TABS; servicos.js:vistaDoSeparador despacha para
definicoes.js:vGrupos), uma aba das Casas, logo a seguir aos Imóveis:
AREAS.casas.ids e o grupo «Casas» do NAV_GROUPS são
`['properties','groups','contracts','pessoas','visits']` (navegacao.js:AREAS,
navegacao.js:NAV_GROUPS). Valem para as abas da área
(navegacao.js:abasDaArea), a gaveta (navegacao.js:gavetaHtml), a barra de
baixo (a porta Casas acende nos Grupos e o _ultimoNaArea lembra-os —
navegacao.js:areaDe, navegacao.js:destinoDe) e o carrossel
(navegacao.js:vizinhoNaArea percorre os cinco). O cabeçalho diz «Casas» no
telemóvel e «Grupos» no computador (navegacao.js:tituloDoEcraHtml), como os
outros separadores de área. São filtros de toda a app, por isso não são um
serviço: nenhum serviço desligado os esconde, e com todos os serviços
desligados a gaveta fica com «Casas» só com os Grupos (e as Definições); só a
parte partilhada é do serviço Colaboradores. Não estão nas Definições
(definicoes.js:DEF_LINHAS não tem a linha, e a porta das Definições não acende
neles, navegacao.js:portaAtiva), mas os caminhos velhos continuam a levar ao
separador: goSet('groups') na base (navegacao.js:goSet) e na nuvem
(cloud/nucleo.js:goSet), e a página guardada {tab:'settings', set:'groups'}
(cloud/nucleo.js:restorePage); um setPage='groups' posto à mão mostra os
grupos com o Voltar das subpáginas (definicoes.js:vSettings).

O separador é o canvas M-Grupos (definicoes.js:vGrupos): sem a cabeça das
subpáginas — começa no «Servem de filtro em toda a app», com as abas das
Casas por cima, que o render põe (vistas.js:render) —, o que os grupos são, os tipos num
segmentado com quantos há de cada (definicoes.js:grupoTipoEscolher). O
cabeçalho é só o segmentado: criar um grupo é no + («Grupo», com a escolha
do tipo — acessos.js:novoGrupoEscolher). Cada grupo é um cartão
(definicoes.js:vGroups, que recebe o tipo; sem ele, os de imóveis). O
privado tem o nome, «Privado», os membros e, nos de imóveis, «Partilhar»
(definicoes.js:cartaoDoGrupo). O partilhado tem o selo
«Partilhado · teu» ou «de <dono>», os imóveis e as pessoas; só ao dono, os
pedidos para entrar, com Aceitar e Recusar, e a ligação de convite, com
Copiar, Rodar e Desativar; e os membros
(web/cloud/grupos.js:cartaoDoGrupoPartilhado).

O cartão inteiro é um botão: um toque abre o grupo (o privado na edição,
definicoes.js:groupModal; o partilhado na janela da nuvem,
cloud/grupos.js:CW.grupoModal), e segurar entra na seleção de vários pelo
data-lp «grp:<id>», como nas outras listas das Casas, com a caixa no canto
de cima, antes do nome (cloud/selecao-listas.js:selLDecorar). Os botões de
dentro param o toque (event.stopPropagation) para não abrirem o grupo, e o
contentor deles leva data-sel-inerte: em seleção fica inert e apagado, e o
toque cai no cartão e marca-o — escondê-los encolhia os cartões e o cartão
fugia de debaixo do dedo. Marcam-se só os do tipo à vista
(cloud/selecao-listas.js:selLRecusa), privados e partilhados juntos, e trocar
o tipo sai da seleção (definicoes.js:grupoTipoEscolher). O marcado
distingue-se pela frente: contorno de 2px e o nome a --accent-text. Os
pedidos que fiz para entrar não são grupos e não se marcam.

A barra dos grupos tem só o Apagar, com UMA confirmação
(cloud/selecao-listas.js:selLApagarGrupos, a frase em
cloud/selecao-listas.js:selLGruposFrase): o título diz o que vai acontecer
(«Apagar 2 grupos», «Sair de 1 grupo», «Apagar 1 grupo e sair de 1») e a
frase o que acontece aos movimentos (definicoes.js:gruposMovimentosFrase),
que os partilhados meus desaparecem para todos, que dos dos outros saio e que
o Anular só repõe os privados. Os privados apagam-se na hora
(definicoes.js:gruposApagarLocal, que limpa os filtros que os tinham) com o
Anular (definicoes.js:gruposReporLocal); os partilhados meus apagam-se no
servidor (cloud/grupos.js:grupoApagarNoServidor) e dos dos outros saio
(cloud/grupos.js:grupoSairNoServidor), sem a confirmação de cada um; um que
falhe não trava os outros, e o aviso, um só, espera pelas respostas
(cloud/selecao-listas.js:selLGruposAviso). Com um pedido por responder,
o cartão leva o contorno cobalto
(estilos.css:.grp-partilhado:has(.grp-pedido)), e o «Desativar» da ligação tem o texto vermelho (estilos.css:.btn.grp-perigo).
A janela do grupo privado diz o erro no campo, sempre com o toast: o nome no
#g_name, os membros na caixa deles, o #g_membros, com o contorno de 2px
(definicoes.js:groupBody; estilos.css:#g_membros.err>.tagbox). Os pedidos que
fiz para entrar no grupo de outra pessoa são um cartão cada, com «Cancelar
pedido» (web/cloud/grupos.js:pedidosQueFizHtml). Sem grupos de um tipo fica o vazio
com o botão de criar o primeiro. Sem poder partilhar (sem sessão ou com o serviço desligado) não há o
que listar do servidor, mas cada grupo de imóveis privado continua com o
«Partilhar», e o toque diz o que falta. A página guardada antiga leva ao
separador (web/cloud/nucleo.js:restorePage).

Os textos que ensinam o caminho dizem «Casas → Grupos», pelo grupo da gaveta
(web/cloud/grupos.js:desfechoDoGrupo, entrada.js:modalGrupo), e não «em
Grupos» sozinho. O crachá da aba Grupos e da linha da gaveta conta os pedidos
para entrar nos meus grupos partilhados (web/cloud/grupos.js:crachaDosGrupos),
registado pelo serviço Colaboradores (lista-colaboradores.js:vColabTab, no
mesmo registarServico): aparece no `<span class="n">` da aba
(navegacao.js:abasDaArea) e na linha da gaveta (navegacao.js:crachaHtml),
pelo caminho que a casca já tinha para os crachás por separador; com o serviço
desligado, não há crachá.

**Partilhar um grupo que já existe.** Um grupo de imóveis privado partilha-se
sem ser recriado, por duas portas à vista: «Partilhar» no cartão de cada
grupo (definicoes.js:cartaoDoGrupo) e «Partilhar este grupo» no corpo e no ⋯
da janela de edição (definicoes.js:groupBody). As duas estão SEMPRE em cada
grupo de imóveis privado, desde que a nuvem dos grupos esteja carregada —
com sessão ou sem ela, com imóveis meus ou sem eles: as casas que outra conta
me partilhou não são «minhas» para a app, e esconder o botão num grupo só
delas deixava quem o tinha sem saber porquê. Um botão que explica é melhor do
que um que desaparece sem razão à vista. As duas vão dar a
web/cloud/grupos.js:CW.grupoPartilhar, que explica em vez de falhar: sem
sessão, o ecrã de entrada com o porquê; com o serviço desligado, a frase do
serviço; um grupo vazio, ou só com imóveis de outras pessoas, uma janela que
diz de quem é cada um e porque não entra (num grupo partilhado cada pessoa só
põe imóveis seus — o servidor recusa os outros com 403), com «Editar o grupo».
Com imóveis meus, confirma e partilha-o de uma vez
(web/cloud/grupos.js:partilharGrupoDeUmaVez): um só pedido, POST
…/partilhar, em que o servidor cria o grupo com o MESMO id, o dono como
membro, as casas minhas e a ligação num lote — tudo ou nada. Eram três
pedidos em fila (criar, casas, ligação), e na Cloudflare cada um é uma ida à
base: o Martinho via a janela da ligação chegar segundos depois, sem nada no
ecrã entretanto, e tocava outra vez; e uma falha no segundo deixava um grupo
partilhado vazio que o cliente tinha de apagar. Agora a janela da ligação
abre no instante da confirmação, a dizer que está a criar a ligação, e
preenche-se no sítio quando a resposta chega; um segundo toque enquanto isso
não começa outra partilha, e um 409 (outro toque ou outro aparelho chegou
primeiro) abre a janela do grupo já partilhado. Fechar a janela de espera não
cancela: a ligação fica guardada no aparelho e o «Copiar ligação» está na
janela do grupo.

Um movimento atribuído a um grupo partilhado chega a todos os membros porque
se parte por imóvel ao guardar (ver «Um movimento de vários imóveis parte-se
por imóvel»).

**Sair de um imóvel.** Quem não criou uma casa sai dela com
`DELETE /api/houses/:id/participacao` (worker/src/rotas/casas.js:rotasCasas).
O criador leva 400 («Criaste este imóvel: para o tirar da tua lista,
apaga-o.»); quem não tem acesso leva 404. É o grau que decide o caminho:

- O colaborador perde o cargo NESSA casa, e só nela; a linha de colaborador
  que fique sem casas sai (worker/src/rotas/casas.js:sairComoColaborador).
- O comproprietário sai por todos os caminhos num só lote
  (worker/src/rotas/casas.js:sairComoComproprietario): as partilhas que lhe
  dão a casa nas ligações dele (as que ele dá a outros, herdadas de quando a
  controlava, ficam), um pedido pendente para ele passar a controlá-la cai,
  uma linha em `house_exits` se a casa lhe chega por um
  grupo (fica no grupo e com as outras casas dele), e um cargo que tivesse
  por baixo — sem isso, a precedência devolvia-lha como colaborador. A quota
  dele vai para os que ficam, na proporção das deles
  (worker/src/lib/acesso.js:redistribuirQuotas: 2 casas decimais a somar
  exatamente 100, o resto do arredondamento para a maior; sem quotas
  guardadas, `ownerShares` sai e fica em partes iguais). `ownerIds` fica com
  os que ficam, e a proposta pendente da casa apaga-se. É a única escrita das
  quotas que não passa por uma proposta aceite.

Duas escritas na mesma casa não se esmagam. Toda a escrita da app em
`houses` passa por worker/src/lib/acesso.js:gravarCasa, que grava com uma
revisão nova (`rev`) por cima da revisão que leu (`rev_base`). Se outra
escrita mudou a casa entretanto, o trigger `houses_revisao` (migração 0020)
recusa a gravação e desfaz o lote inteiro em que ela ia; quem escreve relê a
casa, refaz as contas e tenta outra vez
(worker/src/lib/acesso.js:comCasaFresca). À terceira recusa seguida, o
pedido responde 409 com worker/src/lib/acesso.js:FRASE_CASA_MUDOU, sem ter
mudado nada. Assim, dois comproprietários a sair ao mesmo tempo dão as quotas
certas, e a ficha gravada a meio de uma saída não repõe a quota de quem saiu.
A aprovação de uma proposta também só se grava se a proposta ainda estiver
como se leu (worker/src/rotas/casas.js:aceitarPropostaUmaVez), e por isso
duas aprovações ao mesmo tempo não se perdem. Aceitar o mesmo convite duas
vezes já era seguro, porque o convite se gasta numa só instrução. Uma
correção à mão na consola, que não mexa em `rev`, passa sem verificação; o
testes/revisao-da-casa.test.js confere que nenhuma escrita do worker foge ao
gravarCasa. A gravação da ficha pelo cliente funde, dentro da mesma
repetição, com a casa fresca e com a base que o cliente leu (ver «A casa e os
registos fundem-se, não se gravam por cima», na sincronização): a revisão protege as
escritas do worker umas das outras, a base protege o que outra conta escreveu
antes de este cliente ler.

A saída por grupo (worker/src/lib/acesso.js:SAIU_DA_CASA) entra em todas as
consultas que dão casas por grupo: a compropriedade e os membros da casa, as
casas do /api/state e as de cada grupo
(worker/src/rotas/grupos.js:listarGrupos). Aos outros membros, a casa
continua a aparecer. A saída desfaz-se quando o criador volta a partilhar a
casa com essa pessoa: pela ligação, por um pedido de partilha aceite, ou com
uma casa que ENTRA num grupo (worker/src/lib/acesso.js:limparSaida).
Regravar o mesmo conjunto de casas do grupo não a desfaz.

Quem fica recebe um aviso: uma linha de `house_events` por destinatário, com
o nome da casa e o de quem saiu lidos antes de qualquer escrita
(worker/src/lib/acesso.js:avisoDeSaida). O `colab.sair` vai ao dono, e o
`casa.sair` a cada um que fica. O /api/state manda-os em `departures`: os
meus dos últimos 90 dias, os mais recentes primeiro, até 50; sem os
Colaboradores ligados, os `colab.sair` não vêm. O «Deixar de colaborar» do
próprio também avisa o dono, um aviso por casa. O dono a remover um
colaborador não avisa ninguém.

**Passar o controlo de um imóvel.** A casa é de todos os comproprietários; o
criador (`houses.owner_id`) é só quem a controla na app — apaga-a, partilha-a
nas ligações dele, põe-na nos grupos, gere os colaboradores dela. O criador
de uma ou várias casas pede para passar esse controlo a quem já é
comproprietário delas (worker/src/rotas/casas.js:rotasTransferencias,
migração 0021, `house_transfers`: uma linha por casa, o `lote` junta as do
mesmo pedido). Nada muda antes de quem recebe aceitar; até lá, quem pediu
cancela e quem recebe recusa. Uma casa só tem um pedido pendente de cada vez
(o índice único parcial `idx_house_transfers_pendente`), e uma decisão não
volta atrás (o trigger `house_transfers_decidida` recusa mudar o estado de uma
linha que já não está pendente — é assim que um aceitar e um cancelar ao
mesmo tempo não ganham os dois). As colunas `ficar` e `shares` da 0021 ficam
sem uso: grava-se `ficar = 0` e `shares = NULL`.

- `POST /api/transfers` (casas.js:pedirTransferencia): `{ houseIds, toUserId }`
  (`ficar` e `shares`, se vierem, ignoram-se). As casas têm de existir e ser
  minhas (403 «Só quem criou o imóvel o pode transferir.» a um
  comproprietário; 404 «Casa não encontrada.» a quem não a vê), quem recebe
  tem de ser comproprietário de todas — está em acesso.js:participantsOf de
  cada uma, pela ligação ou por um grupo, e não sou eu (400 «Só podes passar
  o imóvel a um comproprietário dele.»; um colaborador ou um ligado sem a
  casa também é 400) —, e nenhuma das casas pode ter já um pedido pendente
  (409 «Este imóvel já tem uma transferência pendente.» — o lote inteiro não
  entra). Os comproprietários que chegam a uma das casas por uma partilha
  numa ligação têm de estar ligados a quem recebe
  (casas.js:semLigacaoAQuemRecebe): uma partilha pertence à ligação onde
  está, e sem a ligação de quem recebe a cada um ele não a podia gerir nem
  remover — e quem pediu, ao cortar a ligação, tirava a casa à pessoa sem
  ninguém dar por isso. Sem elas, 400 com a frase de quem falta
  (casas.js:fraseSemLigacao: «Para passares o controlo a Bruno, falta a
  ligação de Bruno a Carlos. Têm de se ligar primeiro, em Pessoas ›
  Proprietários.») e a lista em `semLigacao`; quem chega só por um grupo
  não conta. `POST /api/transfers/check`, com o mesmo corpo, faz as mesmas
  verificações sem pedir nada e devolve `{ ok, semLigacao }`. Ao aceitar,
  verifica-se outra vez: uma ligação cortada entretanto falha essa casa.
  Quem recebe leva um aviso `transf.pedido` por casa. Sem Imóveis nesta
  conta, 403 do serviço.
- `DELETE /api/transfers/:lote` (quem pediu) e `POST …/:lote/reject` (quem
  recebe) fecham as casas ainda pendentes do lote (casas.js:fecharLote):
  `cancelled`/`rejected`, e um aviso `transf.cancelada` (a quem recebia) /
  `transf.recusada` (a quem pediu) por casa. Sem nada pendente para mim nesse
  lote, 404 «Esta transferência já não está pendente.». Passam sempre, mesmo
  sem Imóveis.
- `POST …/:lote/accept` (quem recebe; sem Imóveis, 403): casa a casa, cada
  uma no seu lote e na sua repetição (casas.js:aceitarCasa →
  acesso.js:comCasaFresca). Uma casa que já não vale — apagada, com outro
  criador, ou quem recebe já não é comproprietário dela («Já não és
  comproprietário deste imóvel.») — fica `cancelled` e vai em `falhadas` com
  a frase; uma que outra escrita mudou três vezes seguidas fica pendente e
  vai em `falhadas` com acesso.js:FRASE_CASA_MUDOU. As outras aceitam-se na
  mesma: `{ ok, aceites: [houseId], falhadas: [{ houseId, error }] }`.

**O que aceitar uma casa faz** (casas.js:aceitarCasaUmaVez), num só lote,
com a casa à frente (acesso.js:gravarCasa só com o `ownerId`) e a decisão
logo a seguir. Muda só quem controla: o conjunto de participantes, as quotas
e o acesso de cada um ficam iguais — quem pediu passa a comproprietário, quem
recebe a criador.

- `houses.owner_id` passa a ser quem recebe. O JSON da casa não se toca:
  `ownerShares` e `ownerIds` ficam como estavam.
- As partilhas (casas.js:partilhasDoNovoCriador). Uma partilha numa ligação
  dá a casa à ponta que não é o `owner_id` DELA, seja quem for o criador
  (acesso.js:COMPROPRIETARIO_SQL e participantsOf não olham para o criador
  nas partilhas); por isso só três coisas mudam:
  - a partilha que dava a casa a quem recebe, na ligação entre os dois, passa
    a ser dele — agora dá-a a quem pediu, e quem recebe pode deixar de a
    partilhar com ele nas partilhas dessa ligação;
  - a partilha que dava a casa a um terceiro numa ligação a quem pediu
    muda-se para a ligação entre quem recebe e esse terceiro, se a houver, já
    de quem recebe: o terceiro chega pelo mesmo grau e quem recebe passa a
    geri-la. Sem essa ligação, fica onde está, de quem a deu (uma partilha
    herdada: continua a dar a casa ao terceiro);
  - se quem pediu não chegar à casa por caminho nenhum (nem por um grupo,
    nem por uma partilha que lha dê — acontece depois de passar duas vezes),
    ganha uma: na ligação a quem recebe, dele; sem ela, numa ligação sua a
    outro participante que ainda não tenha esta casa. Sem nenhuma, a casa
    falha com «Não foi possível manter quem pediu como comproprietário deste
    imóvel.».
- Os grupos partilhados ficam com a casa e com os mesmos membros a vê-la; o
  `added_by` das linhas da casa passa a ser quem recebe (é o dono da casa):
  quem pediu, ao regravar o conjunto dele num grupo ou ao sair dele, já não a
  leva. Num grupo de que quem recebe é membro, a casa entra no conjunto dele;
  num de que não é, fica lá e quem a tira é o dono do grupo (as rotas do
  grupo são dos membros).
- Os colaboradores de quem pediu nessa casa passam para a equipa de quem
  recebe com o mesmo cargo (casas.js:colaboradoresDoNovoCriador): o cargo
  reutiliza-se se quem recebe já tem um com o mesmo nome e as mesmas
  permissões (na forma canónica, permissoes.js:normalizarPerms), senão
  copia-se para os cargos dele com o mesmo nome; cada colaborador fica com uma
  linha de colaborador de quem recebe com esse cargo (a que já tivesse, ou
  nova) e essa casa nela. As linhas de quem pediu deixam de ter esta casa, e
  as que fiquem sem casas saem; nas outras casas de quem pediu, nada muda.
  Quem recebe, se era colaborador de quem pediu nessa casa, deixa de o ser lá.
  Um cargo de quem recebe que já estivesse nessa casa (de quando a controlou
  antes) sai: o acesso fica o de agora.
- Os convites por usar de quem pediu deixam de incluir a casa
  (acesso.js:convitesSemCasa), e os pedidos de partilha pendentes dele com ela
  caem.
- Ficam como estão: a proposta de quotas pendente (é de todos, e os
  participantes não mudam), os anexos (`files.owner_id` é de quem carregou),
  os registos, as saídas (`house_exits`).
- Avisos: `transf.aceite` a quem pediu; `casa.novo_dono` a cada participante
  menos os dois; `colab.novo_dono` («<casa> passou a ser gerida por <nome>»)
  a cada colaborador movido que não seja participante (um participante com
  cargo leva só o `casa.novo_dono`).

O ator de cada aviso: quem pede em `transf.pedido` e `transf.cancelada`;
quem recebe em `transf.aceite`, `transf.recusada`, `casa.novo_dono` e
`colab.novo_dono`.

**O que cada um gere a seguir.** Quem recebe é o criador: apaga a casa,
partilha-a nas ligações dele (a partilha com quem pediu é dele e as que se
mudaram para as ligações dele também), gere os colaboradores e os cargos
dela, põe-na e tira-a dos grupos de que é membro, e pode passá-la de novo.
Quem pediu fica comproprietário: edita a casa e os registos, propõe quotas,
sai dela; já não a apaga (apagar é sair), não a partilha em ligações novas
(403 no PUT das partilhas), não a põe em grupos, não gere os colaboradores
dela nem a passa. As partilhas herdadas dele continuam a dar a casa a quem
davam: o PUT das partilhas de uma ligação (worker/src/rotas/conexoes.js)
regrava só as partilhas das casas que são minhas e devolve as herdadas no
mesmo lote; o `myShares` do /api/state só traz casas minhas (rotas/estado.js),
e a outra ponta vê a herdada em `peerShares`; sair da casa
(casas.js:sairDaCasaUmaVez) apaga só as partilhas que ME dão a casa
(`owner_id <> eu`). Cortar a ligação ou apagar a conta de quem deu uma
partilha herdada leva-a, como qualquer partilha.

**O estado.** O `GET /api/state` traz `transfers: { incoming, outgoing }`
(casas.js:listarTransferencias): os pendentes, um por lote, `{ lote, from |
to: { id, name }, houses: [{ id, name }], ficar: false, shares: null, at }`.
Os avisos vêm em `departures` com os mesmos campos dos de sair-do-imovel.

**As limpezas.** Um pedido só cai sozinho quando deixa de poder valer:
apagar a casa cancela o pedido dela (acesso.js:apagarCasa); cortar uma
ligação cancela os pedidos das casas que tinham partilha nela cujo
destinatário deixou de ser comproprietário — quem ainda chega por outra
ligação ou por um grupo fica com o pedido
(worker/src/rotas/conexoes.js:pedidosSemComproprietario); quem recebe sair
da casa cancela o pedido dela (casas.js:sairDaCasaUmaVez); apagar a conta
leva os pedidos que fez e os que lhe fizeram (acesso.js:purgeAccount). Sem
avisos nestes quatro. Sair de um grupo, ser removido dele ou a casa sair
dele não cancela: o aceitar cancela essa casa com «Já não és comproprietário
deste imóvel.».

Quem criou um imóvel em compropriedade pode passar o controlo dele na app a
um dos comproprietários; só isso muda (a casa continua a ser de todos). O ⋯
da ficha tem «Passar o controlo» antes do «Apagar imóvel»
(imovel.js:imvMenuDaFicha), só a quem o criou, com sessão, com um servidor
que já sabe destes pedidos (o estado traz `transfers`:
notificacoes.js:notifTransfSabe — num de antes a ação não aparece, levava a
um 404), sem um pedido pendente dessa casa e com pelo menos um
comproprietário a quem o passar (imovel.js:imvPossoTransferir). Na seleção
das Casas, com a ação disponível, a barra ganha o «Passar o controlo» ao
lado do Apagar, na barra de duas linhas (cloud/selecao-listas.js:selLComAcoes,
CW.selLTransferir); a razão ao lado da contagem diz quantos ficam de fora
(selLPintarTransferir), e a folha diz quais e porquê.

A folha (imovel.js:imvTransferir) chama-se «Passar o controlo» com um
imóvel e «Passar o controlo de N imóveis» com vários. Vão só os que criei,
sem pedido pendente e com comproprietários; os outros dizem-se no cimo, uma
frase por razão (imovel.js:imvTrfFora), e sem nenhum que vá é um aviso, sem
folha. «Para quem» é obrigatório, com os comproprietários do imóvel — os
participantes que o servidor manda (p.ownerIds, por uma partilha ou por um
grupo) menos eu —, e com vários imóveis só os que são comproprietários de
todos (imovel.js:imvTrfDestinos); com um só, vem escolhido. Com vários
imóveis e ninguém comproprietário de todos, a folha diz que só se passa a
um comproprietário e leva às Pessoas › Proprietários, onde se partilham as
casas (imovel.js:imvTrfLigar). Não há quotas nem interruptor. Por baixo, a
frase do que acontece (imovel.js:imvTrfFrase, aria-live), escrita de novo
quando muda quem recebe: que só muda quem controla o imóvel na app (quem
recebe passa a gerir as partilhas, os colaboradores e o apagar); que
continuo comproprietário com a minha quota (dita, com um imóvel só) e que
nada muda nas quotas, nos grupos nem nos outros comproprietários; os meus
colaboradores nesses imóveis pelo nome
(notificacoes.js:notifTransfColaboradores), que continuam com o mesmo cargo,
passam a ser geridos por quem recebe e são avisados; e que o outro tem de
aceitar, que até lá nada muda e que se cancela na ficha. O rodapé é
Cancelar e «Enviar pedido» (imovel.js:imvTrfPedir), que manda só as casas e
quem recebe (cloud/partilha.js:CW.pedirTransferencia); um segundo toque com
o pedido a meio não repete. Com a resposta a folha fecha, o aviso diz a
quem foi, e o estado relê-se. Um erro do servidor sobre quem recebe (já não
é comproprietário, ou falta uma ligação) vai para o «Para quem»; os outros,
num aviso, com a folha aberta. Ao escolher quem recebe (e logo ao abrir,
quando vem escolhido), a folha pergunta ao servidor quem falta ligar
(imovel.js:imvTrfVerificar, cloud/partilha.js:CW.verificarTransferencia) e
di-lo por baixo do «Para quem», na cor dos erros (estilos.css:.trf-falta);
enquanto faltar alguém, «Enviar pedido» diz o mesmo junto do campo e não
manda nada. Daqui não se pode ligar duas outras pessoas: são elas que se
ligam.

A ficha mostra o pedido pendente por baixo dos donos
(imovel.js:imvTrfNaFicha): «Pediste para passar o controlo a Bruno», que
até ele aceitar nada muda, as outras casas do mesmo pedido (cancelar
cancela o pedido todo) e o Cancelar (notificacoes.js:notifTransfCancelar,
sem perguntar: não muda nada e pode-se voltar a pedir). Num imóvel cujo
controlo me querem passar (que já vejo: sou comproprietário), o mesmo
cartão diz quem e tem o «Ver».

## Os colaboradores
O separador dos Colaboradores é o terceiro das Pessoas, na área Casas
(navegacao.js:PESSOAS): um ecrã de área como os Inquilinos e os
Proprietários, com os separadores da área e o segmentado das Pessoas por
cima, que o render põe (navegacao.js:abasDaArea), e a deslizar de lado vai
aos Contratos e às Visitas como as outras Pessoas
(navegacao.js:vizinhoNaArea). A página é da nuvem
(cloud/colaboradores.js:paginaDosColaboradores, o canvas D-Colaboradores), e
o separador não lhe põe cabeça nenhuma (lista-colaboradores.js:vColabTab):
nem o Voltar nem a navegação lateral das Definições. Por esta ordem: o que é um colaborador e «Convidar colaborador»; «Quem
colabora» — as iniciais, os imóveis, o cargo num selo, Mudar e Remover
(cloud/colaboradores.js:quemColaboraCard); «Convites por usar», com o selo
dos dias que faltam (cloud/colaboradores.js:convitesCard,
cloud/colaboradores.js:seloDoConvite); «Cargos», com a tabela das permissões
Ver e Adicionar, que abre e fecha no sítio
(cloud/colaboradores.js:cargosTabelaCard,
cloud/colaboradores.js:tabelaDePermissoes,
cloud/colaboradores.js:CW.cargoPermissoes) — com dois cargos ou mais e o
cartão com 700px ou mais, o primeiro à esquerda e os outros à direita, com a
divisória ao meio (estilos.css:.colab-cargos-dois,
estilos.css:.colab-cargos-resto, o @container colabcargos); e «Onde colaboras»
(cloud/colaboradores.js:colaboroCartao). O «Deixar de colaborar» de lá sai de
todos os imóveis desse dono de uma vez, e a confirmação diz o mesmo que o
«Apagar imóvel» de quem colabora (cloud/colaboradores.js:CW.sairDeImovel):
as permissões são retiradas, não se desfaz, e para voltar é preciso pedir ao
dono um convite novo. Para sair de um só, apaga-se o imóvel. Nas Definições não há linha dos
Colaboradores. O resumo — quantas pessoas e quantos convites — é o
subtítulo do ecrã no computador
(cloud/colaboradores.js:resumoDosColaboradores), e a contagem do segmento
conta só as pessoas (cloud/colaboradores.js:contarColaboradores, só com o
separador à vista: cloud/colaboradores.js:haColaboradores). Os textos que
ensinam o caminho dizem «Pessoas → Colaboradores» (entrada.js:modalConvite,
cloud/colaboradores.js:CW.aceitarConvite e as perguntas frequentes,
partilha.js:PERGUNTAS_FREQUENTES).

O selo de um convite conta dias de calendário
(cloud/colaboradores.js:seloDoConvite): «Expira hoje» no dia em que acaba e «Expira amanhã» na véspera, os dois a
vermelho, «N dias» a âmbar e «Expirou» se já passou. Contar fatias de 24
horas a partir de agora fazia um convite que acabava hoje às 23:59 dizer
«Expira amanhã». Recebe um agora opcional, para os testes.

Convidar é uma janela (cloud/colaboradores.js:CW.conviteModal, M-Convidar):
o cargo em opções, com o resumo do que abre
(cloud/colaboradores.js:CW.conviteCargo), e «Criar outro cargo» — gravado o
cargo, a janela repinta-se com ele escolhido
(cloud/colaboradores.js:repintarConvite) —; os meus imóveis, com os grupos
em chips (cloud/colaboradores.js:CW.conviteGrupo); e a nota
opcional. Sem cargos ou sem imóveis, a janela diz o primeiro passo. Criado o
convite, a janela fecha e abre «Convite pronto»
(cloud/colaboradores.js:corpoDoConvitePronto, M-ConviteCriado): o cargo e os
imóveis, a ligação, Copiar e Partilhar, quando expira, e o aviso de que a
ligação só se vê agora. Os imóveis desta janela e da «Mudar cargo ou
imóveis» são uma lista num cartão, como a prancheta: linhas de 52px com
divisórias e a caixa de 22px (cloud/colaboradores.js:caixaDeCasa,
estilos.css:.colab-casas). As caixas Ver, Adicionar e Editar da janela do
cargo têm o rótulo como área de toque, de 44px no dedo
(cloud/colaboradores.js:caixaPerm, estilos.css:.colab-perm-caixa).

Quem colabora vê nos Colaboradores «Colaboras com <dono>», o cargo, o que o
cargo deixa fazer e em que imóveis, e — quando o cargo não vê os movimentos
— que as finanças ficam com o dono (cloud/colaboradores.js:colaboroCartao,
M-Colaborador). Para quem só colabora, estes cartões vêm primeiro.

## Os formulários dizem o que é obrigatório, o que é opcional e dão exemplos
Pedido do Martinho (2026-10-01): «Como o nome do grupo é obrigatório, deve ter
o * vermelho. Faz isso para todos os forms. Os placeholders devem ter "Ex: ".
Se for opcional, deve dizer opcional como nos imóveis.» A regra, a mesma em
todos os formulários:

- **Obrigatório** é o que o guardar recusa vazio, e leva o asterisco vermelho
  no rótulo (estilos.css:.req), na mesma linha do texto: o `<label>` é uma
  grelha, e com o asterisco a primeira linha tem duas colunas
  (estilos.css:label:has(>.req)); um rótulo com marcas lá dentro leva o texto
  num estilos.css:.rotulo-txt. Vale para datas, números e escolhas (no
  `.flabel`). Um campo obrigatório sem rótulo (o nome de uma categoria escrito
  no próprio cartão) leva um aria-label. A janela de um só campo
  (definicoes.js:promptModal) só guarda com texto, leva sempre o asterisco
  e, sem texto, diz o erro no campo («Escreve um nome.»).
- **Placeholder** é sempre «Opcional» ou «Ex: » seguido de um exemplo
  concreto e fictício — nunca uma instrução («Telemóvel ou email», «Só se não
  tem NIF português»): a instrução vai para o rótulo ou para um `.hint` por
  baixo. Datas e palavras-passe não levam exemplo. As únicas exceções são a
  pesquisa e a palavra a escrever para confirmar (testes/placeholders.test.js
  varre web/ inteiro).
- **Opcional** diz «Opcional» no placeholder; quando o exemplo vale a pena,
  o placeholder é o exemplo e o rótulo diz «(opcional)».
- **Um valor por omissão** (o imposto e o aumento do contrato, o prazo da
  hipoteca, os parâmetros das projeções) diz-se num `.hint` «Em branco: …»,
  nunca escondido no placeholder.
- **Um valor que o formulário já traz** escreve-se como a app o escreve, e
  nunca com o número cru do JavaScript num value=: os campos de euros abrem
  com a vírgula da app e ao cêntimo — os do imóvel «154277,2», com os
  inteiros iguais (imovel.js:imvEurosNoCampo); o montante de um movimento
  com dois decimais, «223,61» e «320,00», ao editar como no «Repor»
  (movimento.js:txMontanteNoCampo).

O ecrã de entrar e criar conta tem rótulos à vista, e não placeholders a
fazer de rótulo, que desaparecem ao escrever
(web/cloud/entrada.js:camposDaEntrada), com os ids, os tipos e o
autocomplete que o gestor de palavras-passe conhece. O «Mostrar» da
palavra-passe fica fora do rótulo — um rótulo com dois controlos não é
rótulo de nenhum —, e no registo a palavra-passe aponta para os requisitos
(aria-describedby). Pela mesma razão, os contadores de caracteres do pedido
ao suporte vivem fora do rótulo (ajuda.js:CW.newTicket). O capital de uma
hipoteca levou o
asterisco e passou a ser recusado em branco também ao editar e na ficha do
imóvel (creditos.js:mortOpen, imovel.js:propModal) — o campo dizia
«obrigatório» e gravava-se vazio. A regra vive num oráculo partilhado pelos
testes de cada formulário (testes/lib/formularios.js:conferir).

O formulário do imóvel vai em grupos .sect, como a prancheta M-NovoImovel
(imovel.js:propBody): o nome, a morada, o destino e o tipo de arrendamento —
dois segmentados, com a frase da escolha por baixo (imovel.js:imvSegmentado)
— e os quartos; os proprietários e as quotas-partes (imovel.js:donosSect); os
valores; as hipotecas, sempre abertas, para o capital, que é obrigatório,
não ficar atrás de uma dobra; e as despesas fixas, com a frase das
prestações do IMI escrita enquanto se escreve (imovel.js:imvFraseImi,
imovel.js:imvImiMudou). Recolhidos ficam as fotos, os dados registais e
fiscais e o anúncio com os comentários. Remover uma linha (um proprietário,
um quarto) é um botão fantasma de 44px com o X e o nome no aria-label;
apagar uma hipoteca continua vermelho cheio, com aria-label. No dedo, os
botões só de ícone das fichas e deste formulário medem 44×44
(estilos.css:.imv-form, o .btn.sm.so-icone dentro do @media(pointer:coarse)).
O seguro e o mês dele vão numa fila que no telemóvel passa a uma coluna
(estilos.css:.imv-2col-largo), e as dobras têm o título numa linha e o
resumo por baixo (estilos.css:.imv-form, o .fold-head) — só neste
formulário; as dobras dos outros ficam lado a lado. Não há «criar» um
proprietário: um proprietário é uma conta Rendorium e chega pela partilha
(imovel.js:addPropOwner só escolhe entre os que já existem). A secção dos proprietários pede-se a um ponto
de extensão (imovel.js:seccaoDosDonos, imovel.js:donosDoFormulario), que a
nuvem preenche com as quotas por proposta quando há sessão
(cloud/utilizadores.js:cwOwnersBlock); sem ela fica a daqui, com as quotas
escritas à mão.

O formulário do contrato vai em grupos .sect, como a prancheta
M-NovoContrato (contrato.js:ctBody): o que se arrenda — o imóvel, o quarto
em chips com role radio (contrato.js:ctQuartosHtml,
contrato.js:ctEscolheQuarto), os inquilinos e o nome —; a renda — o imposto com a
caixa da líquida, o dia do pagamento em dois campos lado a lado, com a
frase de que num mês sem esse dia conta o último, e o aumento —; o prazo —
as datas, com a frase da duração e da oposição, que se reescreve enquanto se
escreve (contrato.js:ctFraseDoPrazo), a caução, as rendas antecipadas e o
IBAN —; a renda recorrente e o contrato em vigor em interruptores
(contrato.js:ctInterruptor: uma caixa de marcar com role switch e o aspeto
do .interruptor, que o contrato.js:collectCt lê como sempre); a situação
perante a AT num segmentado, que por indicar diz o prazo do Modelo 2
(contrato.js:fiscoSect); e os contactos. Recolhidos ficam o inventário, as
fotos, as chaves e os anexos; as notas vão no fim. O erro diz-se junto do
campo (contrato.js:ctSaver, pelo componentes.js:falhaCampo): o imóvel, a
renda, os inquilinos — o contorno vermelho vai na caixa das etiquetas — e as
datas trocadas. No dedo chegam aos 44px os .btn.sm (os de ícone também de
largura), os chips do quarto, o «+ Adicionar» dos inquilinos e uma área de
8px à volta do × de cada inquilino — pelos seletores da secção da folha
(estilos.css:.ct-form, estilos.css:.ct-quartos, estilos.css:#c_tenants), sem
mexer nas regras base do .tag e do .tagadd.

Num imóvel por quartos com quartos arrendados — um contrato que ainda não
acabou, ctVivo (contrato.js:ctQuartosEstado) — as escolhas dependem da data
de início do contrato novo (contrato.js:ctQuartosMiolo):

- **O imóvel inteiro** escolhe-se se o início for no dia do último fim dos
  contratos dos quartos, ou depois — o fim mais tarde, contando as
  renovações escritas à mão (contrato.js:ctInteiroPossivel, o ultimoFim do
  contrato.js:ctQuartosEstado, contrato.js:ctFimEfetivo). Um contrato de
  quarto sem data de fim bloqueia-o: nenhuma data o deixa escolher, e o chip
  nem aparece. Antes do último fim, o chip fica à vista, à espera.
- **Um quarto arrendado** escolhe-se se o início for no dia do fim do
  contrato desse quarto, ou depois (contrato.js:ctQuartoPossivel); com dois
  contratos vivos no mesmo quarto, conta o que acaba mais tarde; sem data de
  fim, nunca.
- **Um quarto livre**, sempre.

Cada chip à espera de uma data diz-la ao lado, em dd/mm/aaaa («Quarto 1 ·
livre a 31/03/2027», «Imóvel inteiro · livre a 31/08/2027»), e toca-se:
escolhe-o e põe o início do contrato nesse dia — o fim do contrato desse
quarto, ou o último fim para a casa inteira (contrato.js:ctComecaNoFim) —,
pelo mesmo caminho de quem muda a data (contrato.js:ctInicioMudou: o liveNet
e os chips refazem-se); o aviso diz «O início do contrato passou para
dd/mm/aaaa.» e o foco volta ao chip. Por isso não é disabled: é um botão com
aria-disabled, o .ct-espera (tracejado e tinta esbatida, com a data na cor
do realce — estilos.css, secção ajustes-v40d 1.3), e o rótulo «Quarto 1,
livre a 31/03/2027, toca para começar nessa data» para o leitor de ecrã. Um
quarto arrendado sem fim diz «· já arrendado» e fica disabled, sem toque
(estilos.css:.ct-quartos). A frase por baixo (#c_roomFrase,
contrato.js:ctQuartosFrase, apontada pelo grupo com aria-describedby) diz a
partir de quando a casa inteira fica livre («A casa inteira só a partir de
31/08/2027, o fim do contrato mais longo»), ou que não se escolhe enquanto
houver um quarto sem fim, e a regra dos quartos arrendados; sem nenhuma
escolha possível, diz porquê. A data de cada quarto lê-se onde ele está; a
frase fica para a casa inteira e para a regra.

Mudar o início reavalia (o change do #c_start chama o
contrato.js:ctInicioMudou, que corre o liveNet e reescreve o miolo do
campo): a escolha feita nunca se perde nem se desliga — trocá-la sozinha
esconderia a mudança. Se deixar de valer, fica escolhida e o erro aparece
por baixo dos chips, como o do guardar (#c_roomEsc-erro, o grupo com
aria-invalid), e diz-se no aviso uma vez, quando aparece ou muda; tocar num
chip válido larga-o. O guardar recusa uma escolha que não vale para o início
(contrato.js:ctSaver → contrato.js:ctEscolhaInvalida →
falhaCampo('c_roomEsc'), com o foco no primeiro chip que se pode escolher).
Um início vazio conta como hoje (contrato.js:ctInicioDe).

O contrato novo abre (contrato.js:ctEscolhaPorOmissao, no ctModal e no
onCtProp — o «Novo contrato» da ficha, da lista dos Contratos e das ações de
quem colabora): sem quartos arrendados, no imóvel inteiro, à cabeça; senão no
primeiro quarto livre, pela ordem da ficha (contrato.js:ctQuartoPorOmissao);
sem quartos livres, no primeiro quarto da lista que tenha fim, com o início
no dia em que o contrato dele acaba (contrato.js:ctOmissaoSemLivres) — a
ordem da ficha é a que a pessoa conhece, e «o que vaga primeiro» mudava de
quarto conforme as datas; se nenhum tiver fim, em nada, e a frase diz que
não há contrato novo possível ali. O «Novo contrato» de um quarto livre
escolhe esse quarto (imovel.js:contratoNoQuarto). O início de um contrato já
gravado nunca se mexe ao trocar de imóvel. Um contrato que já estava gravado
como do imóvel inteiro continua a abrir e a gravar como estava
(contrato.js:ctInteiroGravado), e o quarto que o próprio contrato já tinha
escolhe-se sempre.

«Usar o contacto de» diz a verdade (contrato.js:contactSect,
contrato.js:fillOwnerContact, contrato.js:fillTenantContact). O contacto
copiado de uma pessoa para campos vazios fica com ela escolhida; ao abrir um
contrato gravado, um contacto escrito igual ao de um proprietário do imóvel,
ou ao de um inquilino, escolhe essa pessoa (contrato.js:ctReconheceContactos,
contrato.js:ctMesmoContacto) — o email sem olhar a maiúsculas, o telefone só
pelos algarismos, e vazio nunca casa com vazio; trocar de imóvel larga uma
escolha que não é proprietária do imóvel novo, com o contacto que veio dela;
e uma escolha que já não está na lista não se mostra.

O contacto escolhido (contrato.js:contactSect) mostra o nome e, ao lado ou
por baixo, o telefone e o email em bocados (contrato.js:ctMeiosDeContacto):
o telefone não parte a meio (.ct-contacto-tel), o nome e o email partem onde
for preciso. A linha embrulha (estilos.css:.ct-contacto-escolhido) em vez
de herdar o valor sem quebra da linha da líquida (.ct-net-linha>b): um nome
ou um email de 60 caracteres desce de linha e não sai da caixa a 375px.

O formulário do movimento é a prancheta M-Novo movimento
(movimento.js:txBody): o tipo num segmentado de cinco
(movimento.js:txTipoSegm, movimento.js:txMudaTipo), o montante grande, na
Bricolage, com o € dentro do campo, e os campos em grupos .sect — o que foi
(o montante, a descrição, a data ao lado do imóvel, o resto do tipo e quem
pagou), a classificação (a
categoria, a coluna do Anexo F, as etiquetas em chips) e as divisões. O que
se grava é o de sempre: os mesmos ids, lidos pelo movimento.js:collectTx.
Trocar de tipo no segmentado tira do formulário o que só o tipo antigo
tinha, para nada se gravar escondido (movimento.js:limparDoTipo): a
hipoteca e a distribuição, o contrato e o que o IRS pergunta a uma renda, a
coluna do Anexo F, a pessoa de uma dívida, a divisão num acerto, e um grupo
ou «Todos os imóveis» fora de uma receita ou despesa. Gravar vazio marca
primeiro o montante, que é o primeiro campo: a validação segue a ordem do
formulário (movimento.js:txGuardar).

«Pago por» são chips — «Todos» e um por dono, com o nome inteiro e o «(eu)»
— numa fila que parte para a linha seguinte quando não cabe
(movimento.js:txPagoPorHtml, movimento.js:txPagoPor, estilos.css:.pago-por),
de um a quantos donos houver; o valor continua no #t_paid. Nada se corta: o
segmentado de botões iguais que lá esteve cortava os nomes («Martinho
(e…»). As divisões entre proprietários e
entre imóveis são grupos com o título e quantos são, as partes com a
percentagem e o valor, a barra das proporções e «Soma X — bate certo», ou o
aviso a vermelho, que é um erro (movimento.js:partesDaDivisaoHtml,
movimento.js:splitHint, movimento.js:psplitHint). A dica das divisões abre
com o modo numa frase sua, com maiúscula (movimento.js:txFraseDoModo), e a
condição de quem pagou vem a seguir.

Num modelo que se guarda sozinho (o modo tpl sem alsoTx: Planeados →
Modelos, «Novo modelo» e «Editar modelo») o montante é opcional
(movimento.js:txMontanteOpcional): o rótulo «Montante (€)» vem sem
asterisco, o placeholder diz «Opcional» e por baixo há a dica «Em branco,
escreves o montante quando usares o modelo.» (movimento.js:txBody). Guardar
sem montante grava o modelo com amount 0 (movimento.js:txGuardar), e o que
depende do total espera pelo montante que se escrever ao usar o modelo: a
distribuição da prestação (juros, selo, capital, comissão) não se calcula
nem se grava — um modelo que já a tinha perde-a ao ficar sem montante —, e
a divisão por valores ou por ajustes, entre donos ou entre imóveis
(movimento.js:splitError, movimento.js:psplitError), não se compara com o
total. Os ajustes negativos, as percentagens que não somam 100 e as quotas
vazias continuam a falhar logo. Guardar o modelo e registar o movimento (o
«Criar modelo novo» de «Usar modelo»), registar ou confirmar um movimento e
criar ou alterar um planeado pedem sempre o montante («Indica um
montante.»). Alterar um modelo sem montante abre o campo vazio, sem sugerir
a renda do contrato nem a prestação da hipoteca (movimento.js:prefill); um
modelo novo sugere-as. Usar um modelo sem montante
(planeados.js:newFromTemplate, planeados.js:applyTemplate) abre o movimento
com o campo vazio (movimento.js:txMontanteNoCampo mostra o 0 como vazio) e
a validação de sempre; num modelo de renda com contrato, ou de prestação
com hipoteca, o formulário sugere o valor do contrato ou da prestação, como
num movimento novo. As vistas escondem o montante que falta (os chips dos
Modelos, lista-movimentos.js:useTemplateNew).

«O meu perfil» pede o telemóvel com o indicativo do país no menu da casa
(componentes.js:sel, no campo escondido cw_cc), numa linha própria
(estilos.css:.cw-tel), sem estilos escritos pelo JavaScript: o rótulo
«Telemóvel» é do campo do número (for="pe_phone"), e o menu diz «Indicativo
do país» no aria-label (cloud/utilizadores.js:injectPhoneCountry).

## Um movimento de vários imóveis parte-se por imóvel
Um movimento de vários imóveis — de um grupo, ou de «Todos os imóveis» — não
se guarda num registo só: parte-se por imóvel ao guardar, e cada parte vive
no seu imóvel (movimento.js:txGuardarMovimento, movimento.js:parteId). É o
que o faz chegar a quem partilha esse imóvel comigo, nos movimentos, nos
totais e nas contas entre proprietários: guardado inteiro, sem imóvel, ficava
nos meus registos, e num grupo partilhado os saldos de cada um discordavam.
As partes levam o lote (o id, quantas são, o total, o alvo e a divisão), e o
id de cada uma sai do lote e do imóvel, igual em qualquer aparelho.

Na lista, as partes de um lote que passam no filtro voltam a ser uma linha
(lista-movimentos.js:linhasDaLista): sem filtro, o total e «dividido por N
imóveis»; com o filtro num imóvel, a parte dele e o total. Editar abre o lote
inteiro, e apagar leva as partes todas (movimento.js:partesDoLote); um lote
de que não vejo todas as partes (um imóvel que não partilho) não se edita
daqui (movimento.js:loteCompleto). A seleção marca o lote, e a edição em
massa e o apagar apanham-lhe as partes (web/cloud/selecao.js).

As contas de um lote ficam como foram gravadas: um grupo que ganha ou perde
um imóvel depois já não muda o que se dividiu. Os modelos e os planeados
guardam o molde (o grupo, ou «Todos», e o modo de dividir) e partem-se ao
registar. Os movimentos de grupo do formato antigo partem-se no arranque,
com os mesmos valores e o id antigo como id do lote
(movimento.js:migrarMovimentosDeGrupo).

«Todos os imóveis» e «Sem imóvel» são duas coisas. «Todos» divide pelos
imóveis que eu tinha na data do movimento — os meus e os que partilho, pela
data de compra quando a ficha a tem (saldos.js:imoveisDeTodos) — e conta na
avaliação de cada um. «Sem imóvel» não é de imóvel nenhum: conta nos totais
da vista geral, não passa no filtro por um imóvel e divide-se, nas contas
entre proprietários, por todos (metricas.js:txWeight,
lista-movimentos.js:txMatch). Num acerto, a opção vazia continua a ser
«Todos os imóveis», porque um acerto sem imóvel é mesmo de todas as contas.

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
Dezasseis separadores em TABS (navegacao.js:TABS), cada um com ícone, rótulo
e subtítulo — e cada um menos as Definições e os Grupos é um serviço (ver «A
app em serviços»). A barra lateral arruma-os nos cinco grupos do canvas de
2026-10 (navegacao.js:NAV_GROUPS), iguais no menu do telemóvel: ao cimo, sem
título, a Visão geral; Casas (Imóveis, Grupos, Contratos, Pessoas, Visitas); Dinheiro
(Movimentos, Planeados, Créditos); Análise (Avaliação, Projeções, IRS · Anexo
F); Agenda (o Calendário); e ao fundo, sem título, as Definições, a Ajuda e o
cartão da conta (navegacao.js:gavetaFundo — a Ajuda e a conta só com
sessão). A Ajuda leva à página dela nas Definições
(navegacao.js:abrirDefinicoes); o cartão da conta, com o avatar, o nome e «O
meu perfil», abre a janela do perfil (navegacao.js:abrirOMeuPerfil →
cloud/utilizadores.js:CW.editProfile, data-toca="camada"), a mesma do cartão
do perfil das Definições: fecha primeiro a gaveta (como o «Criar»), e sem a
janela da nuvem carregada leva à raiz das Definições, onde está o cartão do
perfil.
Ao cimo de tudo, o «Criar» a toda a largura (estilos.css:.nav-criar; ver «A
fita da barra de baixo»), que o menu do telemóvel não tem — escondido abaixo
de 900px, porque o + está na barra. Nenhum separador repete o ícone de outro
(icones.js:ic), e nenhum se parece com o do vizinho: o Início (a Visão geral)
são os quatro mosaicos do `painel`, e não uma casa — com a casa das Casas ao
lado, na barra de baixo, os dois liam-se como o mesmo destino.

A marca, no topo da gaveta e da barra lateral (index.html, a .brand) e no
ecrã de entrada (cloud/entrada.js), é a casa do ícone da app — o telhado com
beirais, as paredes e a porta pequena, o `home` do icones.js:ic — em branco
num quadrado cobalto de 30px com raio 8 (estilos.css:.marca). É a mesma forma
dos ícones da PWA e do Android, que nunca a deixaram.

A barra lateral é uma coluna (estilos.css:#nav, em flex), e o fundo — as
Definições, a Ajuda e a conta — vive numa caixa própria pegada ao fundo, com
a divisória por cima (navegacao.js:gavetaHtml, estilos.css:.nav-fundo): os
grupos rolam por cima dela e a conta está sempre à vista. O fundo vai rente
ao fundo e de lado a lado: o #nav tem padding-bottom:0, e é o fundo que leva
o espaço de baixo e a área segura, com margens de -14px para cobrir as
laterais. Com o espaço no #nav, o sticky pararia acima dele, e os grupos
ver-se-iam a passar por baixo e pelos lados do fundo. Os títulos vazios
das secções sem nome ficam no HTML, porque são a fronteira das secções, mas
não ocupam lugar (a regra .navh:empty do #nav).

«Pessoas» é uma porta e não um separador: abre os Inquilinos, ou o
separador das Pessoas onde já se está, ou o primeiro que se vê quando os
Inquilinos estão escondidos (navegacao.js:PESSOAS, navegacao.js:destinoDe),
e acende com os três (navegacao.js:portaAtiva). São três serviços e três
ecrãs à parte — Inquilinos, Proprietários e Colaboradores —; lá dentro, um
segmentado sublinhado troca-os, com quantos há de cada
(navegacao.js:abasDaArea, navegacao.js:contagemDePessoas,
estilos.css:.abas-pessoas). Os Colaboradores só existem com sessão na nuvem
e com o serviço ligado (acessos.js:separadoresEscondidos): sem eles o
segmentado fica com os dois de sempre. A contagem deles é de pessoas, e não
de linhas do servidor (uma por cargo), e só aparece depois de o servidor
responder — antes disso o segmento diz só o nome
(cloud/colaboradores.js:contarColaboradores). Abaixo dos 420px o segmentado
encolhe o intervalo e a letra para os três caberem aos 375px, e cada um pode
encolher em vez de rolar de lado. Os Grupos são uma porta das Casas, a
seguir aos Imóveis, e acendem a deles (ver «Grupos partilhados»). Um
goSet('groups') ou um goSet('colaboradores') que sobre — um atalho antigo —
leva ao separador (navegacao.js:goSet). Uma página das
Definições com porta própria acende a sua, e não a das Definições — a Ajuda
—, porque o navegacao.js:goSet refaz a barra (navegacao.js:buildNav) antes
de pintar. O separador fisco
chama-se «IRS · Anexo F» (o serviço continua «Declaração» no catálogo e no
back office), e só existe fora de produção (ver «A app em serviços»).

As secções com título recolhem-se (navegacao.js:gavetaHtml,
navegacao.js:gavetaAlternar) — pedido do Martinho quando o menu passou a
ter opções a mais. O título é um botão com classe própria
(estilos.css:.navsec-tit) — aria-expanded e aria-controls para o contentor
dos itens, seta que roda, alvo de toque de 44px no dedo —, e não o .navh
(estilos.css:.navh), que continua a ser o título pequeno de listas fora da
gaveta. Recolher muda a classe da secção e o aria-expanded do botão no nó
vivo: não repinta, não navega e não fecha a gaveta. A altura anima por
grid-template-rows de 1fr a 0fr com os dois valores escritos
(estilos.css:.navsec-corpo); o overflow:hidden que isso pede vive no
estilos.css:.navsec-itens. Recolhida, o visibility tira os itens do Tab e
do leitor de ecrã, só no fim da transição; sem movimento a regra geral
desliga tudo. O estado é do aparelho (gi_nav_fechadas; sem nada guardado
está tudo aberto). Chegar a um separador abre a secção dele, por qualquer
caminho (navegacao.js:gavetaAbrirDoAtual); recolher à mão a secção onde se
está vale até se sair dela. Uma secção recolhida mostra no título a soma dos
crachás dos seus itens (navegacao.js:gavetaCracha). O crachá da barra
lateral é quente (--cnt) e o de aviso, quando nada passou ainda do prazo, o
azul informativo (estilos.css:nav, o .cnt). Os do sino e da barra de baixo
são --out com a tinta --accent-ink, branca no claro e escura no escuro, e o
de aviso, de fundo --warn, leva a mesma tinta (estilos.css:#hdrBell,
estilos.css:.tabbar, o .cnt). O buildNav só reescreve o #nav
quando o HTML mudou (navegacao.js:buildNav); o gavetaAlternar acerta a mesma
secção no HTML guardado (navegacao.js:gavetaCabeca), para a pintura seguinte
não ver diferença.

Abaixo de 900px a barra vira gaveta de 328px com véu (estilos.css:aside e
estilos.css:.scrim dentro de estilos.css:@media(max-width:900px)), com o
fecho no cimo (index.html:.fecha-gaveta); o foco entra nela ao abrir, no
primeiro sítio alcançável (navegacao.js:openDrawer).

Não há filtro global de proprietário: nem na gaveta, nem numa faixa por
cima da vista, nem nos filtros das listas, das análises ou dos filtros
comuns. Os valores são por inteiro, e quem procura um proprietário
encontra-o pela pesquisa (a dos Imóveis procura os donos) ou escolhe o
imóvel. O ownerFilter só vive no IRS · Anexo F, onde é o titular da
declaração (vistas.js:anaSelDono, sem grupos; o × do chip dele é o
navegacao.js:limparAmbito); o render e a mudança de separador largam-no
fora dali (ambito.js:ambitoSemDono), e um valor de antes não filtra nada.
Um filtro comum guardado com proprietário aplica o resto e ignora essa
parte, e editá-lo tira-a (definicoes.js:fcGuardar). A canalização
(ambito.js:visiveis, ambito.js:scope, ambito.js:inScope, a quota do
saldos.js:sh) ficou: com o ownerFilter vazio dá o mesmo que não a ter.

O cabeçalho (index.html:<header class="top">) tem, por esta ordem, o título
e o subtítulo, o estado da sincronização, o sino, os filtros, a ação
secundária e, na ponta direita, a principal. O título de um ecrã de uma área
leva os dois nomes (navegacao.js:tituloDoEcraHtml) e a folha escolhe — o do
separador no computador, o da área no telemóvel (estilos.css:#pageTitle, o
.tit-area). O subtítulo, só no computador, diz o estado do ecrã onde há um
(navegacao.js:subtituloDoEcra: na Visão geral, o período dos indicadores,
«Ano de 2026 · até hoje, 17/10/2026»; nos Colaboradores, quantas pessoas
colaboram e quantos convites esperam,
cloud/colaboradores.js:resumoDosColaboradores). A sincronização
(index.html:#hdrSync, cloud/entrada.js:setSyncBadge) é laranja «A ligar ao
servidor…», com um relógio, enquanto tenta ligar; verde «Guardado», que
recolhe ao ícone ao fim de dois segundos — um recibo, não um letreiro —;
cobalto «N alterações por enviar»; e vermelho «Sem ligação ao servidor», com
uma cruz; no telemóvel o «Guardado» e o «A ligar» da abertura são só o
ícone, e «por enviar», «sem ligação» e a nova tentativa depois de uma falha
descem para uma faixa fina por baixo do cabeçalho, a toda a largura, com o
ícone a ficar e o cabeçalho a crescer o
que ela ocupa (estilos.css:header.top, o .sync dentro de
estilos.css:@media(max-width:900px)). A ação secundária é a de um ecrã que a
tem — o «Exportar CSV» dos Movimentos (index.html:#hdrSec,
navegacao.js:ACAO_SECUNDARIA) —, e a principal, só no computador
(index.html:#hdrAcao, navegacao.js:pintarAcaoDoCabecalho), é «Novo
movimento», «Novo contrato»… (nos Grupos, «Novo grupo de <tipo à vista>»,
acessos.js:acaoNaturalDoEcra) — a mesma que a folha «Criar» marca «neste
ecrã»; no telemóvel o + faz as vezes dela. Vazias, escondem-se pelo :empty.
Nos ecrãs de uma área, por cima da vista e só no
telemóvel, vão os separadores da área num segmentado
(navegacao.js:abasDaArea, estilos.css:.abas-area; o render escreve-os e o
navegacao.js:abasAssentar leva-os para a casa deles, index.html:#abasArea,
por cima do #view), e passa-se de um ao vizinho também a deslizar de lado
(ver «A fita da barra de baixo»). As vias parciais das listas põem-nos
como o render (ver «O motor das listas»).

O sino abre o «Pede atenção» (notificacoes.js:notifModal,
notificacoes.js:atencaoCorpo): chips Tudo, Por confirmar, Prazos e Pedidos,
numa fila só que rola de lado (estilos.css:.chips-fila.atencao-chips), que
refazem a mesma janela; os pedidos respondem-se ali; os por confirmar
confirmam-se ali (ou abrem para rever, ou silenciam-se), só no que o cargo
deixa, e Confirmar e Silenciar refazem a janela com o mesmo filtro; o valor
de cada um tem as cores dos Planeados (planeados.js:recValor: a prestação
roxa); os prazos dizem o que falta (prazos.js:pzQuando), com a cor no selo
(prazos.js:pzSelo), e levam ao sítio deles — um prazo sem destino é uma
linha, não um botão; e a atividade nas casas partilhadas, com quem saiu delas
(notificacoes.js:notifSaidas). «Marcar tudo como
lido» só aparece com atividade por ler. O sino diz ao leitor de ecrã quantos
há: «Pede atenção: N por ver» (notificacoes.js:notifSino).

A barra de baixo tem quatro destinos, a um toque (navegacao.js:TABBAR,
navegacao.js:buildTabbar): Início, Casas, Dinheiro e Agenda — duas portas e
duas áreas (navegacao.js:AREAS). Uma área acende com qualquer dos seus
separadores e lembra-se do último onde se esteve (navegacao.js:goBarra);
some da barra só quando todas as portas dela estão escondidas
(acessos.js:barraDeBaixo). A meio vai o + (ver «A fita da barra de baixo»). A
barra tem 76px, que é o contrato: 9 em cima, os 52 dos destinos, 14 em baixo
e o contorno (estilos.css:.tabbar), mais a área segura. Só existe abaixo de
900px e esconde-se com a gaveta aberta (estilos.css:.tabbar dentro de
estilos.css:@media(max-width:900px)); o destino aceso só muda de cor.

Recarregar devolve-te ao sítio onde estavas: o separador e a subpágina das
Definições ficam em localStorage (gi_page: web/cloud/nucleo.js:LS_PAGE,
web/cloud/nucleo.js:restorePage). Entrar e sair levam sempre à visão geral
(entrada.js:finishLogin; partilha.js:logout). Mudar de separador faz scroll
ao topo (navegacao.js:go). O «voltar» do sistema fecha primeiro o que
estiver aberto (menu, gaveta, janela) e numa subpágina das Definições sobe
a Definições (componentes.js:pushHist e o ouvinte de popstate logo a
seguir). Os destinos da barra lateral, do menu, da barra de baixo e dos
separadores das áreas são <a> sem href com role="link": o leitor de ecrã
anuncia-os como ligações. O item ativo leva aria-current
(navegacao.js:buildNav, navegacao.js:buildTabbar); o burger leva aria-expanded
(navegacao.js:openDrawer, navegacao.js:closeDrawer).

## Fora da app: a montra, os emails e o back office
As páginas que o worker escreve vestem a mesma linguagem, cada uma com o seu
CSS servido à parte (worker/src/paginas-recursos.js) e debaixo da
CSP_ESTRITA. Os tokens têm os mesmos nomes da app, escritos por extenso no
:root de cada folha, com o escuro em prefers-color-scheme (estas páginas não
têm a classe .dark: seguem o sistema de quem lê); as duas letras declaram-se
com as mesmas @font-face, de /fonts/, com swap e o unicode-range latino, e a
montra e os documentos pré-carregam-nas. Nada do Google Fonts.

A montra (worker/src/landing.js:paginaLanding) diz o valor antes de tudo: o
chapéu diz o que é («Gestão de arrendamento para senhorios»), o título diz a
vantagem («Nenhuma renda te passa despercebida.»), e logo abaixo de «Do imóvel
à renda, tudo ligado» cada ecrã que a entrega tem a sua secção — Imóveis,
Contratos, Planeados (landing.js:ECRAS) —, o texto de um lado e o telemóvel
do outro, a alternar. Mostra o produto em maquetes de HTML e CSS — o
telemóvel do hero, os três ecrãs, o computador, as contas entre donos —,
cada uma um role="img" com a descrição do que mostra, e não em capturas:
seguem os tokens e o tema de quem lê e não envelhecem a cada mudança da app.
As maquetes dos ecrãs imitam as peças da app em ponto pequeno, com os mesmos
rótulos e as mesmas cores (o selo, o cartão do imóvel, a linha do contrato, o
«Por confirmar»), e as datas contam-se a partir do dia do pedido
(landing.js:diaDaMontra). Os números das maquetes fecham e contam uma só
história (landing.js:RECEITA_MES, landing.js:DESPESA_MES,
landing.js:PRESTACAO_MES, landing.js:CASAS): as rendas dos Imóveis somam o
último mês do gráfico, e o que o hero diz estar por confirmar é o que os
Planeados mostram. As alturas das barras são regras :nth-child geradas dos
dados (landing.js:alturasDasBarras), porque a página não tem JavaScript nem
atributos de estilo. A montra só promete o que a produção tem: nada do IRS
enquanto a Declaração só existir em dev. O título e a descrição
(landing.js:TITULO, landing.js:DESCRICAO) ficam nos 60 e nos 160 caracteres,
com os termos que um senhorio procura. Das capturas antigas fica só a imagem de
partilha (og:image), que as redes mostram sem correr CSS, e que o
scripts/capturas.js tira. Os documentos legais e a entrada de teste
(worker/src/legal-vista.js, worker/src/teste.js) são da mesma família.

Os emails (worker/src/lib/correio.js:molde) não são páginas: não há CSP, mas
há o Gmail e o Outlook. Estilos em linha, tabelas com o cartão a 560px (uma
tabela condicional para o Outlook do Windows), dois <style> só a
acrescentar o telemóvel e o escuro, nada de fora (nem imagens, nem letras),
as cores do contrato escritas por extenso (correio.js:COR,
correio.js:COR_ESCURO) — quem muda um token da app que o email usa muda-o lá
também —, a marca como tabela (correio.js:marca), um botão cobalto de 48px
(correio.js:botao), e cada email uma carta pura com a versão em texto das
mesmas partes (correio.js:cartaPedidoRecebido, correio.js:cartaReporPassword,
correio.js:cartaRespostaPedido).

O back office (worker/src/equipa-vista.js, worker/src/equipa-guiao.js) tem a
barra lateral GRAFITE e a marca em ardósia, de propósito diferente do
azul-noite da app, para nunca se confundir uma com a outra; o resto é a
linguagem da app (cobalto, cartões, selos, chips, interruptores). Nada de
alert(), prompt(), confirm() nem <select>: o que pede valores ou um motivo
abre a janela de confirmação, o resultado diz-se no aviso de baixo, e
desligar um serviço pergunta numa faixa âmbar do próprio cartão, com os
dependentes que caem junto (equipa-guiao.js:mostrarAvisoDesligar).

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
(servicos.js:servicoDesligadoHtml). Quem não tem conta tem ligado tudo o
que o ambiente tem (servicos.js:servicoLigado).

Um serviço pode ainda não ter chegado a produção: com soDev no catálogo
(servicos.js:SERVICOS; hoje só a Declaração, o fisco) está desligado para
toda a gente em produção, e existe em dev (servicos.js:servicoForaDoAmbiente).
O servicos.js:servicoLigado pergunta-o além da lista dos desligados, e a
barra esconde-o pelo acessos.js:separadoresEscondidos; ligá-lo no back
office não o traz. Produção é CW.ambiente==='producao'
(cloud/guia.js:CW.ambiente), que é o valor até o servidor responder — o lado
seguro. Quando a resposta muda o ambiente, o cloud/guia.js refaz a barra e
repinta (sai do separador se ele ficou de fora), e quem recarregou numa
página que só existe em dev volta a ela (web/cloud/nucleo.js:restorePage),
que o arranque não repôs por ainda não a saber ligada. Sem a camada da
nuvem (os testes da base) não há ambiente a dizer, e nada fica de fora.

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

Na interface adiciona-se e remove-se, e nunca se «põe» nem se «tira»:
«Vamos adicionar as tuas casas à app» (guia.js:boasVindas), «os que os
membros adicionarem» (entrada.js:modalGrupo, web/cloud/grupos.js:corpoDoGrupo,
web/cloud/grupos.js:desfechoDoGrupo), «Reativar o contrato de X?»
(contrato.js:reactivateContract). O testes/grupos-linguagem.test.js apanha
também o futuro do conjuntivo (puserem, puserdes, pusermos). E não se
presume o género de quem lê: «convida-te para ajudar a gerir 2 imóveis»
(entrada.js:modalConvite).

Uma contagem diz-se no singular ou no plural, nunca com «(s)»: «Vai junto 1
contrato.», «Vão junto 2 contratos e 5 movimentos.»
(cloud/selecao-listas.js:selLVaoJunto), as confirmações de apagar uma
categoria (definicoes.js:delCat) e a de remover uma ligação, que também não
presume género (partilha.js:fraseRemoverLigacao).

Os textos que ensinam um caminho dizem-no com os nomes da navegação:
«Dinheiro → Créditos», «Dinheiro → Planeados» e «Casas → Grupos», pelo grupo
da barra lateral, «Definições → Categorias, etiquetas e IRS» e «Definições →
Segurança».

Frases curtas, com ponto final nos toasts: «Movimento apagado.»
(movimento.js:delTx), «Anulado.» (componentes.js:comDesfazer).

Rótulos em sentence case: «Visão geral» (navegacao.js:TABS), «Adicionar
imóvel» (painel-geral.js:vDashboard), «Registar pagamentos»
(vistas.js:settleModal), «Acertar contas» (vistas.js:contasCard). As
maiúsculas de secção vêm do CSS, não do texto.

Sem emojis na interface. Os ícones são traço em SVG, ic(nome,tamanho)
(icones.js:ic): stroke 1.8, currentColor, 20px por omissão. Um ícone
novo entra no mapa do ic(), não como carácter. A partilha é o `partilhar`
(icones.js:partilhar): os três pontos ligados, o sinal de partilha do
Android, e não a seta a sair da caixa, que ao lado do «down» das descargas
se lia como «carregar». A casa é uma só, a da marca (`home`); o Início é o
`painel` e as Casas o `building`.

O hint explica o porquê, não repete o rótulo: «Confirmar regista o
movimento e agenda o seguinte. Silenciar deixa-o à espera, sem avisos.»
(planeados.js:pendingCard); «Contam aqui, mas não na Avaliação: não estão
atribuídas a nenhum imóvel, e é por isso que os totais divergem.»
(painel-geral.js:orphanCard, a faixa âmbar das despesas sem imóvel, com o
atalho «Ver movimentos sem imóvel»); os WHY dos KPIs (vistas.js:WHY).

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
cartão e «512,74 €» ao lado (formato.js:euroS). No mesmo ecrã, um número
escreve-se sempre da mesma maneira: na Visão geral os fluxos (o que entra e
sai num período) vão com os cêntimos e os stocks (o que se tem ou se deve)
ao euro — «2 380 €/mês» no Portefólio ao lado de «2 380,00 €/mês» no
«Total contratado» é o que isto evita (ver «A Visão geral»). A ficha do
contrato vai toda com cêntimos, como a folha do PDF.

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
.btn.sm. O toque longo dispara aos 480 ms — entra na seleção onde a há, e
sem a nuvem abre as opções do cartão —, com vibração,
e engole o clique que vem a seguir (componentes.js:_lpT e os ouvintes de
pointer que o usam).

Onde uma folha precisa de mais do que a regra geral dá, sobe-o pelos
seletores da sua secção, e não mexendo nas regras base (o .tag, o .tagadd).
Um botão só de ícone pequeno chega a 44×44 com o .btn.sm.so-icone inteiro no
seletor (estilos.css:.btn.sm.so-icone.vg-silenciar, e o mesmo nas fichas e no
formulário do imóvel e na Análise): só com a classe da folha, perdia para a
largura de 36 do .btn.sm.so-icone e para a altura de 40 do .btn.sm no dedo.
O × de um chip ligado ganha a área com um ::after invisível — nas listas é
o dos Movimentos (estilos.css:.mov-chip-x), e o chip que leva ao painel
(estilos.css:.lfm-chip-abre) ganha os 44px pelo mesmo ::after; as filas dos
chips partem em linhas e não rolam de lado. Numa fila que rola de lado, que
cortava o ::after, é o próprio chip que cresce (estilos.css:.plan-modelo).

Cartões e afins são divs com data-click: tornarFocavel dá-lhes tabindex e
role=button depois de cada render e de cada janela
(vistas.js:tornarFocavel; componentes.js:fillModal), e Enter ou Espaço
ativam-nos (o ouvinte de keydown do arranque, em web/app/arranque.js). Por
isso nunca vai um botão dentro de um elemento com data-click: os filhos de
um botão não se anunciam. O alvo do toque e o botão são irmãos — o bloco do
texto que revê e o «Confirmar» ao lado (imovel.js:imvPorConfirmar), como as
linhas dos contratos com os por confirmar (ver «Os Contratos»). Uma linha
com um interruptor é o <label> dele, e o toque no texto chega ao botão
(estilos.css:.fis-linha-toque, estilos.css:.def-cat-fora,
estilos.css:.mov-interr).
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
chama-o enquanto se escreve (lista-movimentos.js:txLinhaExtra é o primeiro;
quem o substitui é cloud/selecao.js). Medido com 500
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

Não se anima a altura de uma dobra a partir de uma linha medida pelo
conteúdo: foi tentado com grid-template-rows 0fr→1fr na dobra dos
formulários, que nasce de um display:none, e ficou presa aberta
(estilos.css:.fold.entra.open>.fold-body, a nota por cima). Num nó vivo, com
1fr e 0fr escritos e a classe trocada, interpola: as secções da gaveta e o
cartão «Por confirmar» da Agenda (estilos.css:.navsec-corpo,
estilos.css:.cal-pend-corpo).

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
porquê (as cores do mosaico das capas, estilos.css:.imv-t1, são o exemplo
com licença).

Não se pinta de vermelho o que não destrói: recusar um planeado desta vez
vai no ⋯, sem opção danger (planeados.js:pendMenuItens), e o «Recusar» de um
pedido de partilha, de um pedido para entrar num grupo ou de um convite de
ligação é o botão secundário (partilha.js:linhasDosPedidos).

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

Não se sobrepõe o aspeto de uma classe semântica com utilitários avulsos:
faz-se uma classe nova, como o cabeçalho de cada imóvel nos Contratos
(estilos.css:.ct-grupo-cab) e o título do mês nos Movimentos
(estilos.css:.mov-mes), em vez do .section-title com um utilitário por
cima.

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
e o que se constrói assim não corre — a folha das opções de uma visita (a do
lpMenu) não abria. Uma ação que tem de ir como texto e como função escreve-se das
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

Não se pinta dinheiro negativo de vermelho nem um atraso de laranja: .neg é o
que sai, .perigo é o perigo (estilos.css:.pos).

Não se marca um cartão tocável com uma borda colorida à esquerda: o que se
toca diz-se pelo hover, pelo premido e pela seta (estilos.css:.card.tap).

Não se põe um botão dentro de um elemento com data-click: o tornarFocavel
dá-lhe role="button", e os filhos de um botão não se anunciam
(vistas.js:tornarFocavel).

Não se parte por media query uma grelha que vive ao lado da navegação
lateral: parte-se pela largura do cartão, com uma container query
(estilos.css:.card.def-tabela).

Não se escreve o número cru do JavaScript num value=
(imovel.js:imvEurosNoCampo).

## Dívidas de design conhecidas
O que já está fora destas regras, por ordem de gravidade. Não está
corrigido: cada uma tem o sítio, para quem lhe pegar. Uma dívida que fecha
sai daqui no mesmo commit, e vai para o diário com a data.

Baixa. O tornarFocavel (vistas.js:tornarFocavel) dá tabindex e role=button a
tudo o que tem uma ação declarada, e nos gráficos isso ainda apanha as fatias do donut
com onPick (graficos.js:cDonut): cada fatia é uma forma de SVG anunciada como
botão, e a mesma categoria é outra paragem do Tab logo a seguir, no item da
legenda (graficos.js:legend), que faz o mesmo. As barras, as linhas e as
barras horizontais já não têm toque próprio (o diário, 2026-09-08). Quem lhe pegar
deixa a fatia fora da ordem de tabulação — o tornarFocavel a saltar o que está
dentro de um <svg>; o dedo e o rato continuam a entrar na categoria por ela —
e fica a legenda como a porta do teclado.

Baixa. Três desenhos para «contador pendente»: nav a .cnt, .tabbar a .cnt
e #hdrBell .cnt (estilos.css:nav, estilos.css:.tabbar, estilos.css:#hdrBell),
os dois últimos com corpos quase idênticos (só muda o lado) escritos duas
vezes.

Baixa. Ícones fora do ic(): o burger, o fecho do menu e o «topo»
(estilos.css:.burger, index.html:.fecha-gaveta, index.html:#toTop) trazem
SVG escrito à mão em vez de ic(), porque vivem no HTML estático, antes de o
ic() existir; o X da janela e o limpar da pesquisa das listas já são o
ic('x') (componentes.js:modalLayer, vistas.js:lfBarraHtml).

Baixa. Os botões de apagar do fileBlock fixam min-width e min-height de
40px por utilitários (componentes.js:fileBlock), repetindo em todos os ecrãs o
que estilos.css:@media(pointer:coarse) já dá só no toque.

Baixa. O dia de pagamento dos contratos aceita 1 a 31
(contrato.js:collectCt; planeados.js:syncContractRec) enquanto as
prestações automáticas das hipotecas ficam em 28
(planeados.js:syncLoanRec). Não é bug, porque o nextDate prende ao último
dia do mês, e o formulário do contrato di-lo («Num mês que não tenha esse
dia (o 31 em abril), conta o último dia do mês.», contrato.js:ctBody); mas
são duas regras para o mesmo conceito, e nada diz porque as prestações
ficam em 28.
