# Regras de design

Como a app se veste e como se comporta. Não é um manual de gosto: cada
regra aqui esteve primeiro no código, com a razão ao lado, e diz onde
está. Quando fizeres um ecrã novo, lê isto antes de inventar um botão.

## Tokens: as cores e o papel de cada uma
Todas as cores vivem em variáveis: o claro no :root (web/index.html:73-82)
e o escuro no :root.dark (web/index.html:86-91). Um hex fora daí só com um
comentário ao lado a dizer porquê. Claro → escuro, e o papel de cada uma:

--bg #f7f8fa → #12141b é o fundo da página. --card #fff → #1b1e28 é o
cartão. --field #fff → #20242f são os campos. --chip #f2f4f3 → #272b38 são
os selos cinzentos e o hover das opções dos menus. --tint #f6faf8 → #1f2330
é o hover dos cartões clicáveis e a barra do editor. --ink #17221d →
#eef0f6 é o texto. --muted #5a635e → #9aa3b8 é o texto secundário: rótulos,
hints, .small. --line #e7ebe8 → #2b3040 são os contornos; --line2 #cfd8d3 →
#3a4054 o contorno em hover.

--accent #244c3b → #5ee0a8 é a marca: o botão primário (.btn.primary,
web/index.html:185), o positivo (.pos, 180), o ponto dos filtros ativos
(405), o risco à esquerda dos cartões clicáveis (156) e o item ativo da
barra de baixo (314). --accent-ink #fff → #0b1410 é o texto sobre a marca.
--accent-soft #dfece6 → #1c3a33 é o fundo dos selos, dos avatares e dos
ícones de secção (191, 238, 271). --accent-press #1c3d2f → #7ceabb é o
primário premido (186).

--danger #b94a48 → #ff8a80 é o negativo (.neg), o destrutivo (.btn.danger,
189; .menupop button.danger, 398), o campo com erro (.err, 302) e o crachá
dos pendentes (264, 319-320). --danger-soft #f7e8e7 → #3a2326 é o fundo
suave. --warn #9a6400 → #ffc35c é o aviso e o pendente: .amber, o risco do
.pend (279), o ponto dos planeados no calendário (215) e o crachá da gaveta
quando nada passou do prazo (web/app/navegacao.js:35). --warn-soft #f6eeda
→ #3a2f14 é o fundo.

--side #1a3a2c → #161a3a é a gaveta, com --side-ink, --side-muted,
--side-hover e --side-on só para ela. --blur é o fundo translúcido do
cabeçalho (131). --shadow (0 24px 60px rgba(0,0,0,.28) → .6) é a sombra dos
menus e das janelas. --track, --rail 264px, --rail-min 76px e os --inset-*
da área segura fecham a lista.

As semânticas são três classes, .pos, .neg e .amber (web/index.html:180), e
valem em texto, KPIs e saldos. Os selos são .badge (marca), .badge.grey,
.badge.amber e .badge.red (191-198). No claro o texto dos dois últimos
desce para #7d5200 e #9c3a38: 11px pedem 4,5:1 de contraste e o tom da
marca ficava aquém (193-196). É o exemplo de hex fora dos tokens com
licença, porque tem a razão escrita ao lado.

Os gráficos têm paleta própria: PAL_LIGHT e PAL_DARK
(web/app/auxiliares.js:662-663), trocadas dentro do próprio array PAL pelo
applyTheme (auxiliares.js:766), para quem guardou referência ver as cores
novas. Usa PAL[i], nunca o hex. A cor da barra do sistema é #1a3a2c no
claro e #161a3a no escuro (auxiliares.js:767).

## Tema escuro e a regra do color-scheme
O tema é 'light', 'dark' ou 'auto' (web/app/auxiliares.js:isDark, 757) e
aplica-se com a classe .dark no <html> (applyTheme, 765). Tudo o que
depende do tema segue os tokens; o código não pergunta o tema.

O meta color-scheme e a propriedade no :root dizem ambos «light dark»
(web/index.html:6-11, 69-72). Declarar só «light» faz o WebKit e o WebView
do Android responder prefers-color-scheme:light mesmo com o aparelho em
escuro, e o automático fica preso no claro. Só uma escolha explícita
estreita o esquema (auxiliares.js:768-774).

No claro escreve-se «only light», não «light»: é o opt-out do «tema escuro
para sites» do Chrome Android, que escurecia à força o modo claro
(auxiliares.js:775-779).

A MediaQueryList do sistema cria-se uma vez e guarda-se (auxiliares.js:mq,
743-754). Registar o ouvinte numa criada de fresco deixa-a sem referências,
e há motores que a recolhem e param de avisar. O Safari só ganhou
addEventListener na versão 14, por isso fica o addListener de recurso
(785-790).

## Tipografia
Inter, system-ui, -apple-system, Segoe UI, Roboto; 15px de base
(web/index.html:104). Os números alinham em tabular-nums nos valores, nas
tabelas e nas estatísticas (106), para as colunas não dançarem.

A escala, toda em web/index.html: h1 19px com -.02em (134); título da
janela 17px (477); valor do KPI 22px, peso 750, -.025em (166); rótulo do
KPI 11.5px em maiúsculas, .05em, 600 (165); .section-title 13px, 700,
maiúsculas, .03em, muted (181); .navh 10.5px, maiúsculas, .07em (263);
.stat 13.5px (236); toast 13.5px, 550 (490); campos e selbtn 14px, 500
(348-349); label 12px, 600, muted (346); .small e .hint 12px muted, o hint
com line-height 1.55 (200, 228); .badge 11px, 700 (191); .btn 550 (183) e
.btn.sm 13px (188); tabela 13px com cabeçalhos 11px em maiúsculas
(222-224); barra de baixo 11px, 600 (313).

Os pesos têm papel: 500 o que se escreve, 550 os botões, 600 os rótulos,
650 os subtítulos, 700 os títulos, 750 os valores. Maiúsculas só por CSS
(rótulos de KPI, section-title, cabeçalhos de tabela), nunca escritas no
texto.

## Espaçamento, raios e sombras
A página tem 18px em cima e 22px aos lados, com 1180px de largura máxima
(web/index.html:138); no telemóvel 14 e 15 (147). O cartão tem 16px de
padding (152).

Grelhas: .grid com gap 11 e colunas de 158px para os KPIs (163); .cols com
gap 14 e colunas de 290px para os cartões de gráfico (164); .list com gap
11 (190); .form com gap 13 (338); .row e .row3 com gap 11, que empilham
abaixo de 520px (339-341), salvo o intervalo De/Até, que se lê lado a lado
porque empilhado parecia dois filtros (342-343). A .toolbar tem gap 10
(182). O .section-title leva 22px por cima e 10 por baixo (181). Um estado
vazio não se cola aos KPIs que o antecedem (344-345).

Os raios seguem a hierarquia da peça: 20px a janela (475; 20 20 0 0 na
folha de baixo, 489), 18 o FAB (406), 16 o cartão e o vazio (152, 201), 14
a secção, a dobra e o addbox (448, 269, 441), 13 os menus e as opções .opt
(380, 393, 453), 12 o toast, a caixa das etiquetas e as miniaturas (490,
432, 241), 11 os botões, os campos, os itens da gaveta e o avatar (183,
348, 117, 238), 10 os dias do calendário e a barra de baixo (206, 313), 9 o
.btn.sm, as opções dos menus e o iconbtn (188, 383, 482), 999 as pílulas:
selos, etiquetas, crachás.

Só flutua o que sobe: --shadow nos menus e na janela (380, 393, 475); 0 8px
22px .28 no FAB (408); 0 16px 38px .30 no painel de filtros (420); 0 6px
18px .22 no menu do FAB (412); a barra pegajosa deixa uma sombra só por
baixo (401). Os cartões não têm sombra, têm contorno (152).

As camadas (z-index): 15 o menu de escolha (379), 20 o cabeçalho (131), 25
a barra pegajosa (401), 30 o menu de ações (392), 40 a barra de baixo
(310), 45 e 46 o painel de filtros (417-418), 57 o «topo» (422), 58 o FAB
(406), 60 a janela (470), 61 o véu (129), 62 a gaveta (109), 90 o toast
(490), 95 a dica dos gráficos (177).

## Componentes da casa, e quando usar cada um
sel(id,value,options,onchange) (web/app/componentes.js:14-24) é O menu de
escolha. Nunca um <select> nativo: destoava nos formulários e destoa no
topo (componentes.js:2; web/cloud/entrada.js:232-233). O valor fica num
input escondido que val(id) lê; onchange é o NOME de uma função global.
{div:true} é uma linha separadora; os grupos vão no fim com gdiv e gOpts
(26-27). O menu vira-se para cima ou encolhe para caber no primeiro
antepassado que corta (posicaoPop, 53-67; ajustarPop, 84-102). Nunca
cresce até ao espaço disponível: um menu de 16 categorias tomava 488px do
ecrã (42-44).

menu(id,items) (componentes.js:133-137) é o ⋯ das ações de um registo;
{danger:true} pinta a opção de vermelho. Nos cartões das listas o ⋮
(kebab, web/app/vistas.js:200) abre exatamente o mesmo menu que o toque
longo (data-lp e lpMenu, componentes.js:524-596): uma lista de ações por
tipo de registo, não duas. O que destrói (Apagar, Remover, Eliminar,
Terminar) fica vermelho também na folha do toque longo (551-553). Todos os
menus fecham ao clique fora (closePops, 32-35; web/app/arranque.js:82).

openModal(title,body,foot,menuHtml) (componentes.js:378-394) abre uma
janela por cima do que houver; a anterior desce na pilha, escurecida e
inerte, e volta quando a de cima fecha (281-331). Quem chama define onSave
depois (293-295); o rodapé por omissão é Cancelar + Guardar (343). setModal
substitui o conteúdo sem empilhar (405-411). Fechar por um caminho de
abandono (véu, X, Escape, voltar) com alterações por guardar pergunta
«Sair sem guardar?» (412-439); Guardar e Cancelar fecham sem perguntar,
porque são decisões e não acidentes. Só conta como mexido o que vier de um
dedo ou de um teclado a sério (isTrusted, 386-391): a renda sugerida não é
trabalho de ninguém. A pergunta veste o tema da app, nunca o confirm() do
browser (431-433). Abaixo de 520px a janela é uma folha encostada em baixo
(web/index.html:489).

confirmModal(title,text,cb) (componentes.js:457-469) é para quando NÃO há
como desfazer. O botão diz o verbo do título e veste-se de perigo se o
título começar por Apagar, Remover, Eliminar ou Terminar: um «Confirmar»
primário igual ao Guardar convidava ao reflexo. O texto diz o que se perde
(delFileConfirm, 209-220: «desaparece já daqui e do armazenamento. Não há
como desfazer.»).

comDesfazer(msg,restaurar,aoExpirar) (componentes.js:470-492) é para
quando o apagar é frequente e reversível: sai já do ecrã e dos cálculos, e
o toast traz «Anular» seis segundos. É a regra do delTx
(web/app/movimento.js:593-610): sem confirmação, com Anular, porque a
pergunta constante ensinava o dedo a confirmar sem ler. A confirmação
trava o engano de quem lê; o Anular salva o engano de quem confirmou por
hábito. aoExpirar liquida o que não volta (blobs) só quando a janela fecha
sem cliques. Silenciar um prazo usa o mesmo (web/app/prazos.js:pzSilencia,
147-155).

toast(m,op) (web/app/auxiliares.js:584-589) é para o que aconteceu: 2,8
segundos, frase curta com ponto final. Tem role=status e aria-live
(web/index.html:517).

falhaCampo(id,msg) (componentes.js:494-505) é para o que falta num
formulário: o toast diz, o campo aponta (.err, web/index.html:301-302), vai
ao ecrã, recebe o foco e larga o realce à primeira tecla. Não se mostra um
toast longe do campo.

pickModal(title,options,onPick,extra) (componentes.js:506-522) é escolher
de uma lista de cartões, com ícone ou avatar; o rodapé é «Voltar».
promptModal(title,label,value,cb) (web/app/definicoes.js:240-251) é um
campo só, com Enter a valer Guardar. Nunca o prompt() do browser.

fold(id,title,body,{open,icon,summary}) (componentes.js:158-177) é a
secção que abre e fecha dentro dos formulários. open é só o estado
inicial: depois manda o foldState, que sobrevive aos re-renders enquanto a
janela estiver aberta. summary aparece no cabeçalho, visível mesmo com a
secção fechada (web/index.html:267-278).

fab(actions) (web/app/vistas.js:879-883) é o botão de criar: um por
página, no canto inferior direito; com várias ações sai o menu. O render
acrescenta o espaço no fundo (vistas.js:79) e no telemóvel o botão sobe
acima da barra de baixo (web/index.html:323-330). A visão geral também tem
o seu (vistas.js:81-88): registar uma renda avulsa custava quatro toques
de viagem.

kpi(label,value,cls,foot,why,evo) (vistas.js:98-106) é o cartão indicador:
rótulo em maiúsculas, valor grande, rodapé em muted. Com why ganha um «?»
no canto e abre a explicação ao toque (web/index.html:168-173); com evo
ganha o ícone de tendência e abre a evolução mês a mês e ano a ano
(kpiModal, vistas.js:112-126). As explicações vivem em WHY
(vistas.js:176-193): uma ou duas frases, o que é e o que não é.

card(title,sub,body) (vistas.js:197) é o cartão genérico das vistas.
.card.tap é o clicável: risco de acento à esquerda e reação ao toque; o
informativo fica liso (web/index.html:154-159). .pend e .pend.late marcam
à esquerda em aviso e em perigo (279-280).

Os restantes: tagField para etiquetas removíveis (componentes.js:146-157),
fileBlock para anexos e fotos (178-208), .addbox para «adicionar mais um»
(web/index.html:440-447), .opt e .seg para escolhas visuais com ícone, como
o tipo de movimento (451-459), .empty para o estado vazio (201, 217), .tip
para a dica dos gráficos (176-179; web/app/graficos.js:chartTip, 7-20).

## Padrões de página
O cabeçalho é o header.top (web/index.html:506-511): título e subtítulo
vêm de TABS (web/app/navegacao.js:2-16; web/app/vistas.js:67-70). O sino
das notificações só aparece na visão geral (web/app/notificacoes.js:
notifSino, 63-69).

Os filtros não ocupam a página: estão atrás do botão de funil do
cabeçalho (hdrFiltToggle e hdrFiltN, vistas.js:9-20; render, 71-76). O
botão ganha um ponto quando há filtros ativos (web/index.html:404-405) e
fica primário com o painel aberto. O painel (fwrap e fpanel,
web/index.html:413-420) é pegajoso e flutua por cima do conteúdo sem o
empurrar: preso ao topo, desaparecia ao primeiro scroll.

Os três painéis de filtro tinham três feitios; fica UM (vistas.js:817-821):
mexes, a lista muda logo atrás; «Limpar» à esquerda, «Fechar» primário à
direita, em todo o lado. lfBar (vistas.js:846-864) monta-o: pesquisa no
topo com o botão de limpar, seletores empilhados (lfSel, 825-829),
ordenação (lfSort, 868-874) e a linha «N resultados com os filtros ativos»
quando os há. lfHit (813-816) faz a pesquisa por palavras e frases entre
aspas, sem ligar a acentos. anaPanel (vistas.js:43-48) faz o mesmo para os
ecrãs de análise. A pesquisa espera 280 ms e devolve o foco com o cursor
no fim (lfSearch, 782-787; onTxSearch, 608-613).

Uma lista é um .list de .card.tap com data-lp: título, .small com o
essencial separado por «·», .chips com selos e o ⋮ à direita
(vistas.js:422-445). As secções por imóvel usam o .section-title com o
total à direita (472). Um ecrã de análise é KPIs em .grid, um
.section-title, cartões de gráfico em .cols (258-275).

Todo o vazio convida: um <b> a dizer o que falta e uma frase a dizer o que
fazer (vistas.js:245-249, 421, 465-466, 544, 565; web/app/planeados.js:310,
317). Com filtros ativos o vazio é «Nada neste filtro» com o botão «Limpar
filtros», que limpa seja o que for sem saber onde está
(limparFiltroAtual, vistas.js:791-795).

O que é longo abre fechado, e a escolha fica no aparelho: o cartão dos
movimentos por confirmar (planeados.js:256-278, chave gi_pend_shut) e o
dos prazos (web/app/prazos.js:157-163, gi_pz_shut). A visão geral existe
para se ver o património de relance; quatro movimentos abertos ocupavam
600 dos 900px antes de aparecer um único indicador. O cabeçalho diz o que
é preciso saber (quantos, quantos em atraso, quanto); a lista abre-se com
um toque. Guarda-se '0' explícito quando se abre, para distinguir «nunca
mexeu» de «quis aberto».

Quando a mudança é local, repinta-se só o cartão, não a vista: donutDrill
(vistas.js:311-315), pendToggle (planeados.js:273-278). render()
substitui o innerHTML de #view e perde o estado do DOM (vistas.js:62-66,
80).

## Navegação
Treze separadores em TABS (web/app/navegacao.js:2-16), cada um com ícone,
rótulo e subtítulo. A gaveta agrupa-os em quatro (NAV_GROUPS, 26-27):
Património, Pessoas, Finanças e Aplicação; o título do grupo é o .navh
(web/index.html:263). No computador a gaveta é um rail fixo que pode
colapsar para só ícones (body.rail, 110-128); abaixo de 900px vira gaveta
com véu (139-149) e o foco entra nela ao abrir (navegacao.js:65-68).

A barra de baixo tem quatro destinos, a um toque: visão geral («Geral»),
movimentos, imóveis e calendário (TABBAR, navegacao.js:38-51). A auditoria
mediu: com tudo atrás da gaveta, qualquer mudança de ecrã custava dois
toques. O calendário tomou o lugar dos planeados, mostra-os dia a dia e
leva o crachá dos pendentes. A barra só existe abaixo de 900px e
esconde-se com a gaveta aberta (web/index.html:323-330); o traço do ativo
da gaveta não se aplica nela (315-317).

Recarregar devolve-te ao sítio onde estavas: o separador e a subpágina das
Definições ficam em localStorage (gi_page, web/cloud/anexos.js:198-219).
Entrar e sair levam sempre à visão geral (web/cloud/entrada.js:159;
web/cloud/ajuda.js:725-727). Mudar de separador faz scroll ao topo (go,
navegacao.js:56). O «voltar» do sistema fecha primeiro o que estiver
aberto (menu, gaveta, janela) e numa subpágina das Definições sobe a
Definições (componentes.js:345-367). O item ativo leva aria-current
(navegacao.js:35, 50); o burger leva aria-expanded (66, 83).

## Escrita
Português de Portugal, e trata-se por tu: «Tens alterações por guardar»
(web/app/componentes.js:435), «Começa por adicionar um imóvel»
(web/app/vistas.js:246), «Dá um nome ao imóvel» (web/app/imovel.js:16),
«tenta daqui a pouco» (web/cloud/entrada.js:215).

Frases curtas, com ponto final nos toasts: «Movimento apagado.»
(web/app/movimento.js:603), «Anulado.» (componentes.js:489).

Rótulos em sentence case: «Visão geral», «Adicionar imóvel», «Registar
pagamentos», «Pagar todas as dívidas» (vistas.js:248, 356, 381). As
maiúsculas de secção vêm do CSS, não do texto.

Sem emojis na interface. Os ícones são traço em SVG, ic(nome,tamanho)
(web/app/auxiliares.js:666-709): stroke 1.7, currentColor, 20px por
omissão. Um ícone novo entra no mapa do ic(), não como carácter.

O hint explica o porquê, não repete o rótulo: «Confirmar regista o
movimento e agenda o seguinte. Silenciar deixa-o à espera, sem avisos.»
(web/app/planeados.js:254); «Entram aqui mas não na Avaliação — não estão
atribuídas a nenhum imóvel. É por isto que os totais divergem.»
(vistas.js:332); os WHY dos KPIs (vistas.js:176-193).

A mensagem de erro diz o que fazer: «Indica a renda mensal.» e «O fim do
contrato é antes do início — verifica as datas.» (web/app/contrato.js:33,
37), «Escreve uma descrição.» (movimento.js:23).

O botão diz o verbo: «Apagar», «Terminar», «Registar pagamentos»; o rodapé
neutro é Cancelar e Guardar, Fechar ou Voltar (componentes.js:343, 520;
vistas.js:125).

A primeira letra põe-se à mão: toLocaleDateString('pt-PT') devolve
«setembro de 2026» e text-transform:capitalize dava «Setembro De 2026»
(web/app/calendario.js:53-54, 110-117).

Separadores: «·» entre pedaços de uma linha (vistas.js:428, 953), «—» para
o vazio (auxiliares.js:184; componentes.js:16) e dentro das frases, «−»
tipográfico nos negativos (auxiliares.js:18).

Os comentários do código seguem o mesmo tom: em português, contam a razão
e o que custou («medido: 70% de um dropdown fora de vista»,
componentes.js:71-73), e cada função leva Recebe e Devolve, senão o
gerador de documentação rebenta (scripts/gerar-docs.js, o gate «sem guia
de interface»). Cada módulo abre com um banner /* ===== NOME ===== */ e um
parágrafo do que é (web/app/prazos.js:1-14; web/app/calendario.js:1-9).

## Números e datas
Dinheiro passa por money (web/app/auxiliares.js:8-19): milhares com espaço
fino (U+202F), vírgula decimal, espaço fino antes do €, sinal de menos
tipográfico. euro arredonda ao euro inteiro; euro2 mostra sempre duas
casas (20-21); euroS mostra os cêntimos só quando existem, porque uma
renda de 512,74 € aparecia «513 €» num cartão e «512,74 €» ao lado
(576-578).

pct(v,d) dá «25,3%» e «—» quando não é número (auxiliares.js:184); dec
troca o ponto pela vírgula (185). O que se escreve à mão lê-se com num
(565-575), que decide se a vírgula é decimal e devolve 0, nunca NaN, para
as somas não se estragarem. IBAN, NIF, CC e telefone têm os seus
formatadores (22-38). Ordenar texto é localeCompare com 'pt'
(web/app/vistas.js:872).

As datas guardam-se e comparam-se como texto AAAA-MM-DD
(auxiliares.js:190-192; isActive, 203; vistas.js:637-639). Uma data local
nunca passa pelo toISOString: converte para UTC e, no horário de verão,
meia-noite local vira o dia anterior; um prazo legal deslocado um dia é um
prazo errado (pzIso, web/app/prazos.js:19-24; pzAddDias, 30-33). Somar
meses prende o dia ao último do mês quando ele não existe (nextDate,
web/app/planeados.js:3-16). O dia de cobrança das prestações automáticas
das hipotecas fica limitado a 28, para cair em todos os meses
(planeados.js:73-74, 84). Os meses abreviam-se em minúsculas (MES,
auxiliares.js:194); o nome longo vem do toLocaleDateString('pt-PT') com a
primeira letra posta à mão.

## Toque e acessibilidade
Em ecrã de dedo, nada abaixo do mínimo de toque, e só aí: no rato os
tamanhos compactos continuam certos (@media(pointer:coarse),
web/index.html:288-300). 44px os botões, os itens da gaveta e os
cabeçalhos das dobras; 40 o .btn.sm. O toque longo abre as opções do
cartão aos 480 ms, com vibração, e engole o clique que vem a seguir
(web/app/componentes.js:524-537).

Cartões e afins são divs com onclick: tornarFocavel dá-lhes tabindex e
role=button depois de cada render e de cada janela
(web/app/vistas.js:49-61; componentes.js:341), e Enter ou Espaço
ativam-nos (web/app/arranque.js:83-92). Escape fecha a janela de cima
(arranque.js:81); o Tab fica dentro dela (93-105); a janela de baixo fica
inert e aria-hidden (componentes.js:321-324); ao fechar, o foco volta ao
gatilho (444). A janela tem role=dialog e aria-modal (301). Todo o botão
só de ícone leva aria-label (componentes.js:134, 155, 196-197, 203, 303;
web/index.html:507, 516). O toast tem role=status e aria-live=polite (517).

O foco desenha-se: outline em --accent-soft com o contorno em --accent
(web/index.html:353). O campo com erro aponta para si próprio (.err,
301-302) em vez de só um toast longe dele.

-webkit-text-size-adjust:100% no body (104) para o iOS não inflar o texto
em landscape; tap-highlight transparente (161); user-select:none nos
controlos e nos cartões com toque longo (160-162). Quem pediu menos
movimento ao sistema recebe menos movimento (304-305).

Alturas em unidades de ecrã escrevem-se em vh e logo a seguir em dvh
(467-475, 484-489; testes/estilos.test.js): com as barras do browser à
mostra, vh é maior do que o que se vê e o topo da folha saía por cima. A
área segura entra por --inset-* (80-82, 111, 132, 138, 307, 311;
web/app/auxiliares.js:fitInsets, 711-740). Os corpos que rolam levam
overscroll-behavior:contain (420, 478) e a página tranca por baixo de uma
janela ou da gaveta, repondo a posição ao destrancar (lockPage,
vistas.js:206-210).

## O que não se faz
Não se usa <select>, confirm(), alert() nem prompt() do browser: destoam e
não vestem o tema (web/app/componentes.js:2, 431-433).

Não se passa uma data local pelo toISOString (web/app/prazos.js:19-21).

Não se escreve uma altura em vh sem o par em dvh (web/index.html:484-489;
testes/estilos.test.js).

Não se declara color-scheme só «light» (web/index.html:6-10).

Não se escreve um hex fora do :root e da PAL sem um comentário a dizer
porquê (web/index.html:193-196 é o exemplo com licença).

Não se pergunta «tens a certeza?» ao que é frequente e reversível: dá-se
Anular (web/app/movimento.js:594-595). E não se apaga sem rede o que não
volta (componentes.js:209-211).

Não se põe um «Confirmar» primário igual ao Guardar num botão que destrói
(componentes.js:457-459).

Não se pergunta «sair sem guardar?» por causa de valores que a app
preencheu sozinha (componentes.js:386-391), nem a Guardar e Cancelar
(420-423).

Não se deixa um menu crescer até ao espaço disponível (componentes.js:42-44)
nem ficar cortado pelo corpo da janela (69-73).

Não se usa text-transform:capitalize em datas (web/app/calendario.js:54).

Não há painel de filtros com rascunho e botão «Aplicar»
(web/app/vistas.js:817-821).

Não se abre por omissão uma lista longa na visão geral
(web/app/planeados.js:256-262).

Não se mete uma caixa contenteditable dentro de um <label>
(web/app/auxiliares.js:71-72), nem se regista um ouvinte numa
MediaQueryList criada de fresco (743-744).

Não se sobrepõe em linha o aspeto de uma classe semântica: faz-se uma
classe nova (o .section-title com text-transform:none em
web/app/vistas.js:472 é o exemplo a corrigir).

Não se desenham ícones como caracteres de texto (✕, ✓) nem se colam
emojis: entra-se no ic() (web/app/auxiliares.js:666-709).

Não se escreve uma função sem comentário com Recebe e Devolve: o gerador
de docs rebenta (scripts/gerar-docs.js).

## Dívidas de design conhecidas
O que já está fora destas regras, por ordem de gravidade. Não está
corrigido: cada uma tem o sítio, para quem lhe pegar.

Média. today() em web/app/auxiliares.js:192 calcula a data de hoje com
toISOString().slice(0,10), o padrão que prazos.js:19-21 proíbe. É a data
por omissão de cada movimento novo (web/app/movimento.js:14), do isActive
(auxiliares.js:203) e do nextDate (web/app/planeados.js:11). Em julho, às
00:30 locais, dá o dia anterior. O arranjo é pzIso(new Date()), ou a
mesma fórmula local, porque auxiliares.js carrega antes de prazos.js
(web/index.html:521, 532).

Média. addDays em web/app/planeados.js:20 constrói a data em hora local e
devolve-a com toISOString: meia-noite local no verão vira o dia anterior,
e a janela payDay..payDayTo e as ocorrências dos planeados recuam um dia.
pzAddDias (web/app/prazos.js:33) já faz o mesmo bem.

Média. As cores «Despesas» e «Prestações» dos gráficos estão escritas à mão
('#c56b68' e '#d6a34a', que são PAL_LIGHT[3] e PAL_LIGHT[2]) em vez de
PAL[3] e PAL[2]: web/app/vistas.js:252, 1010, 1012;
web/app/avaliacao.js:42, 89, 119; web/app/movimento.js:634, 643. No tema
escuro a «Receita» sai a PAL_DARK[0] e as «Despesas» ficam num vermelho
pensado para fundo branco; mudar a PAL nunca altera estes gráficos.

Média. CW.esqueci (web/cloud/entrada.js:210) usa o prompt() nativo do
browser para pedir o email, contra a regra do promptModal
(web/app/definicoes.js:240-251). É o único prompt, confirm ou alert nativo
em web/. No WebView do Android pode devolver null sem aparecer, e a ação
morre em silêncio.

Baixa. No tema escuro, .pos, .neg e .amber, os valores dos KPIs e o
nav a.on recebem hex literais (web/index.html:93-95) iguais a --accent,
--danger e --warn do :root.dark (88-89). A regra de base (180) já segue o
token; se alguém mudar --accent no escuro, estes ficam para trás.

Baixa. Três desenhos para «contador pendente»: nav a .cnt
(web/index.html:264), .tabbar a .cnt (319) e #hdrBell .cnt (320), os dois
últimos com corpos idênticos escritos duas vezes.

Baixa. Ícones como caracteres de texto: '✕' nos botões de limpar a
pesquisa (web/app/vistas.js:719, 855) e '✓ ' em web/app/contrato.js:99,
web/cloud/entrada.js:122 e web/cloud/ajuda.js:610, quando a casa desenha
tudo com ic('x') e ic('check'). O X da janela (componentes.js:303), o
burger e o «topo» (web/index.html:507, 516) trazem SVG escrito à mão em
vez de ic().

Baixa. Emojis na interface: um hint com 👍 em web/cloud/partilha.js:83 e o
tubo de ensaio no seletor de contas de teste (web/cloud/entrada.js:236, só
em dev).

Baixa. O cabeçalho de cada imóvel em Contratos e o de cada mês em
Movimentos usam .section-title com text-transform:none em linha
(web/app/vistas.js:472, 948): uma classe semântica com dois aspetos. Merece
uma classe própria em web/index.html.

Baixa. Os botões de apagar do fileBlock fixam min-width e min-height de
40px em linha (web/app/componentes.js:197, 203), repetindo em todos os
ecrãs o que @media(pointer:coarse) já dá só no toque (web/index.html:292).

Baixa. O dia de pagamento dos contratos aceita 1 a 31
(web/app/contrato.js:158-159; web/app/planeados.js:38) enquanto as
prestações automáticas das hipotecas ficam em 28 (planeados.js:84). Não é
bug, porque o nextDate prende ao último dia do mês, mas são duas regras
para o mesmo conceito e nenhum hint diz que o dia «flutua».
