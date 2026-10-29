/* A página de entrada do rendorium.com.
   -------------------------------------
   Servida pelo worker quando o pedido chega pelo domínio raiz (ou www) — a app
   vive em app.rendorium.com e não se mistura. Escrita à mão, sem dependências,
   na mesma linguagem da app — o cobalto, o azul-noite, a Geist no corpo e a
   Bricolage Grotesque nos títulos —: quem clica em «Abrir a app» não pode
   sentir que mudou de produto.

   O hero diz o valor antes de tudo (nenhuma renda passa despercebida), e a
   seguir cada ecrã que o entrega tem a sua secção: Imóveis, Contratos,
   Planeados. A página MOSTRA o produto, e já não com capturas: os telemóveis e
   o computador são maquetes desenhadas em HTML e CSS, com o mosaico da marca
   por trás. Uma captura envelhecia a cada mudança da app, pesava o dobro por
   vir nos dois temas e era a única coisa que a página descarregava além do
   texto; a maquete segue os tokens, muda de tema com quem lê e não pesa
   nada. Os números da maquete são de um portefólio inventado (RECEITA_MES,
   DESPESA_MES, PRESTACAO_MES) e fecham entre si: a receita e as despesas são
   a soma das barras, e o cashflow é o que sobra delas e das prestações. Cada
   maquete é um role="img" com a descrição do que mostra.

   As letras são as da app, auto-alojadas em web/fonts/ e servidas em /fonts/
   em qualquer domínio (a CSP só deixa font-src 'self'): nada do Google
   Fonts. A imagem de partilha (og:image) continua a ser um ficheiro, porque
   quem a mostra é a rede social, não esta página.

   Não tem JavaScript para se mostrar. As animações — a entrada do hero, as
   revelações ao scroll, a risca do cabeçalho — são CSS puro: as guiadas pelo
   scroll vivem atrás de @supports (animation-timeline), e um motor que não as
   saiba correr mostra a página feita, sem esconder nada. Com os recuos de
   menos movimento, menos transparência e mais contraste.

   O único script é o do rasto (GUIAO_RASTO_MONTRA, em /paginas/rasto-montra.js),
   e só vai na página de quem aceitou. A pergunta é uma faixa em HTML puro, um
   formulário para o /consentimento com «Recusar» e «Aceitar» do mesmo peso,
   que só aparece a quem ainda não respondeu; depois da resposta, o rodapé
   deixa mudá-la. O cookie da resposta é do servidor (index.js), que diz aqui
   qual é: a página varia com ele, e por isso não fica em cache partilhada.

   O Rendorium é um projeto pessoal, sem planos nem pagamentos, e a página
   di-lo por palavras — é a pergunta que qualquer pessoa faz a seguir a «o que
   é isto?». */

import { CSP_ESTRITA } from './lib/http.js';

const APP = 'https://app.rendorium.com';
const IMG = '/img/landing';

/* O portefólio inventado das maquetes: dez meses de rendas e de despesas, e
   uma prestação fixa. Os indicadores saem daqui por soma, e as barras também
   (alturasDasBarras), para o número e o desenho nunca se contradizerem. */
const RECEITA_MES = [3115, 3115, 3255, 3115, 3115, 3115, 3115, 3115, 2425, 2425];
const DESPESA_MES = [420, 380, 610, 350, 1180, 410, 395, 870, 1012, 685];
const PRESTACAO_MES = 1106.4;
const RECEITA = RECEITA_MES.reduce((a, b) => a + b, 0);
const DESPESAS = DESPESA_MES.reduce((a, b) => a + b, 0);
const PRESTACOES = Math.round(PRESTACAO_MES * RECEITA_MES.length);
const CASHFLOW = RECEITA - DESPESAS - PRESTACOES;
// a escala das barras: um mês com esta receita encheria os 90 px
const TECTO = 3300;

/* Um valor em euros como a app o escreve (web/app/formato.js:money): os
   milhares com espaço fino, a vírgula decimal, o € no fim e o sinal de menos
   tipográfico. Fica repetido e não importado porque o formato.js é um script
   do browser, não um módulo do worker.
   Recebe: v — o valor em euros (número); dec2 — verdadeiro para mostrar duas
   casas decimais, falso para arredondar ao euro inteiro.
   Devolve: o texto, ex.: «29 910 €» ou «−412,30 €». */
function eurosDaMontra(v, dec2) {
  const a = Math.abs(v);
  const [inteiro, decimal] = (dec2 ? a.toFixed(2) : String(Math.round(a))).split('.');
  return (v < 0 ? '−' : '') + inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') +
    (decimal ? ',' + decimal : '') + ' €';
}

/* As alturas das barras das duas maquetes, em regras de CSS: a página vai com
   a CSP_ESTRITA, que não aplica um atributo de estilo, e por isso cada barra
   recebe a sua altura por :nth-child. A escala é a mesma nas duas (90 px
   para o TECTO).
   Devolve: o texto das regras, uma por barra. */
function alturasDasBarras() {
  const px = (v) => Math.round((v / TECTO) * 90);
  return RECEITA_MES.map((v, i) => `.barras-tel span:nth-child(${i + 1}){height:${px(v)}px}
.barras-pc .mes:nth-child(${i + 1}) .r{height:${px(v)}px}
.barras-pc .mes:nth-child(${i + 1}) .d{height:${px(DESPESA_MES[i])}px}`).join('\n');
}

/* Um ícone de traço da casa (o desenho de icones.js:ic: grelha de 24, traço
   1.8, pontas redondas, a cor do texto), decorativo.
   Recebe: d — o caminho SVG; classe (opcional) — classes a somar à .i.
   Devolve: o HTML do <svg>, escondido dos leitores de ecrã. */
function icone(d, classe) {
  return `<svg class="i${classe ? ' ' + classe : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`;
}

/* Os quatro indicadores do ano das maquetes, com os números do portefólio
   inventado; o cashflow vai no cartão azul-noite, como na Visão geral.
   Devolve: o HTML dos quatro cartões. */
function indicadores() {
  return [['Receita', RECEITA], ['Despesas', DESPESAS], ['Prestações', PRESTACOES]]
    .map(([rotulo, v]) => `<div class="m-kpi"><p class="m-sub">${rotulo}</p><p class="tit">${eurosDaMontra(v)}</p></div>`)
    .join('') +
    `<div class="m-kpi noite"><p>Cashflow</p><p class="tit">${eurosDaMontra(CASHFLOW)}</p></div>`;
}

/* Os imóveis do mesmo portefólio inventado, para as maquetes dos três ecrãs
   (Imóveis, Contratos, Planeados) contarem a mesma história do hero. As
   rendas em vigor somam o último mês de RECEITA_MES (2 425 €), e a casa vaga
   é o que falta para os 3 115 € dos meses de antes. Cada quarto e cada
   contrato tem a sua renda; a prestação do T3 é a PRESTACAO_MES. */
const CASAS = [
  { nome: 'T3 Bonfim', morada: 'Rua do Bonfim, Porto', tom: 't0', valor: 310000, divida: 231800, quartos: 4,
    contratos: [{ quem: 'Ana Ribeiro', parte: 'Quarto 1', renda: 350, fim: 'ano' },
      { quem: 'João Matos', parte: 'Quarto 2', renda: 350, fim: 'ano', atraso: true },
      { quem: 'Inês Costa', parte: 'Quarto 3', renda: 350, fim: 25 }] },
  { nome: 'T2 Paranhos', morada: 'Rua de Costa Cabral, Porto', tom: 't2', valor: 235000, divida: 0,
    contratos: [{ quem: 'Rui e Marta Sousa', parte: 'Imóvel inteiro', renda: 950, fim: 'ano2', hoje: true }] },
  { nome: 'T0 Campanhã', morada: 'Rua do Heroísmo, Porto', tom: 't1', valor: 98000, divida: 0,
    contratos: [{ quem: 'Tiago Lopes', parte: 'Imóvel inteiro', renda: 425, fim: 'ano', hoje: true }] },
  { nome: 'T1 Cedofeita', morada: 'Rua de Cedofeita, Porto', tom: 't3', valor: 165000, divida: 0, contratos: [] },
];
/* A renda do mês de uma casa: a soma das rendas dos contratos dela.
   Recebe: c — uma casa de CASAS.
   Devolve: o valor em euros (0 numa casa vaga). */
function rendaDaCasa(c) {
  return c.contratos.reduce((a, k) => a + k.renda, 0);
}
// as rendas que estão à espera de confirmação: as em atraso e as de hoje
const PENDENTES = CASAS.flatMap((c) => c.contratos.filter((k) => k.atraso || k.hoje)
  .map((k) => ({ casa: c.nome, parte: k.parte, renda: k.renda, atraso: !!k.atraso })));

/* Uma data da maquete, contada a partir do dia do pedido: as datas não
   envelhecem com a página. Em UTC, porque o worker corre em UTC e só o dia
   interessa.
   Recebe: hoje — a Date do pedido; dias — quantos dias somar (negativo para trás).
   Devolve: a Date desse dia, à meia-noite UTC. */
function diaDaMontra(hoje, dias) {
  return new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() + dias));
}

/* Uma data como a app a escreve nas listas.
   Recebe: d — a Date; comAno — verdadeiro para dd/mm/aaaa, falso para dd/mm.
   Devolve: o texto, ex.: «05/11» ou «31/08/2027». */
function dataDaMontra(d, comAno) {
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return dd + '/' + mm + (comAno ? '/' + d.getUTCFullYear() : '');
}

/* A próxima vez que um dia do mês chega, a partir de amanhã.
   Recebe: hoje — a Date do pedido; dia — o dia do mês (1 a 28).
   Devolve: a Date dessa próxima vez. */
function proximoDia(hoje, dia) {
  const d = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), dia));
  return d > hoje ? d : new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() + 1, dia));
}

/* Um selo da maquete (o .badge da app em ponto pequeno).
   Recebe: texto — o que diz; tom (opcional) — in, amber, red, grey ou loan;
   sem tom é o cobalto.
   Devolve: o HTML do selo. */
function selo(texto, tom) {
  return `<span class="m-selo${tom ? ' ' + tom : ''}">${texto}</span>`;
}

/* As abas da área no topo do ecrã do telemóvel, com a que está aberta.
   Recebe: abas — os nomes; aberta — o nome da que está aberta.
   Devolve: o HTML da fila de abas. */
function abasDaMaquete(abas, aberta) {
  return `<div class="m-abas">${abas.map((a) => `<span${a === aberta ? ' class="on"' : ''}>${a}</span>`).join('')}</div>`;
}

/* O ecrã dos Imóveis (web/app/lista-imoveis.js:imvCartao): um cartão por
   casa, com a capa em mosaico, o estado, a renda, a yield e a dívida, e os
   selos do que pede atenção.
   Devolve: o HTML do interior do ecrã. */
function ecraImoveis() {
  const cartao = (c) => {
    const renda = rendaDaCasa(c);
    const atrasos = PENDENTES.filter((p) => p.casa === c.nome && p.atraso).length;
    const espera = PENDENTES.filter((p) => p.casa === c.nome && !p.atraso).length;
    const estado = !renda ? selo('Vago', 'amber')
      : c.quartos ? selo(c.contratos.length + '/' + c.quartos + ' quartos') : selo('Arrendado', 'in');
    const nums = renda
      ? [['Renda', eurosDaMontra(renda)], ['Yield', ((renda * 12) / c.valor * 100).toFixed(1).replace('.', ',') + '%'],
        ['Dívida', c.divida ? eurosDaMontra(c.divida) : '—']]
      : [['Renda', '—'], ['Valor', eurosDaMontra(c.valor)], ['Dívida', c.divida ? eurosDaMontra(c.divida) : '—']];
    const selos = (atrasos ? selo(atrasos === 1 ? '1 renda em atraso' : atrasos + ' rendas em atraso', 'red')
      : espera ? selo(espera + ' por confirmar') : '') + (c.quartos ? selo('Por quartos', 'grey') : '');
    return `<div class="m-imv"><span class="tile m-imv-capa ${c.tom}"></span><div class="m-imv-corpo">
<div class="m-entre"><span><span class="tit m-nome">${c.nome}</span><span class="m-sub m-linha-unica">${c.morada}</span></span>${estado}</div>
<div class="m-nums n">${nums.map(([r, v]) => `<span><span class="m-sub">${r}</span>${v}</span>`).join('')}</div>
${selos ? `<div class="m-selos">${selos}</div>` : ''}</div></div>`;
  };
  return `<p class="tit ecra-titulo">Casas</p>${abasDaMaquete(['Imóveis', 'Grupos', 'Contratos', 'Pessoas'], 'Imóveis')}
${CASAS.map(cartao).join('\n')}`;
}

/* O ecrã dos Contratos (web/app/lista-contratos.js:ctLinha): os contratos em
   grupos por imóvel, com a renda do mês; a renda em atraso fica pendurada no
   contrato dela, com o «Confirmar», como na app.
   Recebe: hoje — a Date do pedido, para os prazos.
   Devolve: o HTML do interior do ecrã. */
function ecraContratos(hoje) {
  const ano = hoje.getUTCFullYear();
  const fim = (f) => (f === 'ano' ? '31/08/' + (ano + 1) : f === 'ano2' ? '28/02/' + (ano + 2) : dataDaMontra(diaDaMontra(hoje, f), true));
  const linha = (k) => `<div class="m-ct"><div class="m-entre"><span><b>${k.quem}</b><span class="m-sub">${k.parte} · até ${fim(k.fim)}</span>
${typeof k.fim === 'number' ? `<span class="m-selos">${selo('Termina a ' + dataDaMontra(diaDaMontra(hoje, k.fim)), 'amber')}</span>` : ''}</span><b class="n">${eurosDaMontra(k.renda, true)}</b></div>
${k.atraso ? `<div class="m-pend"><p>1 movimento por confirmar</p><div class="m-entre"><span class="m-sub">Renda — ${k.parte} · ${dataDaMontra(diaDaMontra(hoje, -9))}</span>${selo('Em atraso', 'red')}</div><span class="botao-maquete pequeno">Confirmar</span></div>` : ''}</div>`;
  const grupo = (c) => `<div class="m-ct-grupo"><div class="m-entre"><span><span class="tit m-nome">${c.nome}</span><span class="m-sub">${c.quartos ? 'por quartos · ' + c.contratos.length + '/' + c.quartos : 'imóvel inteiro'}</span></span><b class="n">${eurosDaMontra(rendaDaCasa(c), true)}/mês</b></div>
<div class="m-cartao m-ct-linhas">${c.contratos.map(linha).join('')}</div></div>`;
  return `<p class="tit ecra-titulo">Casas</p>${abasDaMaquete(['Imóveis', 'Grupos', 'Contratos', 'Pessoas'], 'Contratos')}
${CASAS.slice(0, 2).map(grupo).join('\n')}`;
}

/* O ecrã dos Planeados (web/app/planeados.js:pendingCard e recLinha): o
   cartão «Por confirmar», com a renda em atraso primeiro, e a seguir o que
   vem — a prestação, o condomínio e o IMI que o imóvel e o crédito criaram.
   Recebe: hoje — a Date do pedido, para as datas.
   Devolve: o HTML do interior do ecrã. */
function ecraPlaneados(hoje) {
  const total = PENDENTES.reduce((a, p) => a + p.renda, 0);
  const atrasos = PENDENTES.filter((p) => p.atraso).length;
  const pend = PENDENTES.map((p) => `<div class="m-plan"><div class="m-entre"><span><b>Renda — ${p.parte === 'Imóvel inteiro' ? p.casa : p.parte}</b><span class="m-sub">${p.casa} · ${dataDaMontra(diaDaMontra(hoje, p.atraso ? -9 : 0))}</span></span>
<span class="m-valor"><b class="n pos">${eurosDaMontra(p.renda, true)}</b>${p.atraso ? selo('Em atraso', 'red') : selo('Por confirmar')}</span></div><span class="botao-maquete pequeno">Confirmar</span></div>`).join('');
  // o IMI de 284 € paga-se em duas prestações: no fim de maio e no fim de novembro
  const ano = hoje.getUTCFullYear();
  const imi = [new Date(Date.UTC(ano, 4, 31)), new Date(Date.UTC(ano, 10, 30)), new Date(Date.UTC(ano + 1, 4, 31))].find((d) => d > hoje);
  const prestacao = proximoDia(hoje, 15);
  const condominio = proximoDia(hoje, 1);
  const seguintes = [
    ['Prestação — T3 Bonfim', 'mensal, dia 15 · próxima ' + dataDaMontra(prestacao), selo('da hipoteca', 'loan'), 'prest', -PRESTACAO_MES, prestacao],
    ['Condomínio — T3 Bonfim', 'mensal, dia 1 · próxima ' + dataDaMontra(condominio), selo('do imóvel', 'grey'), 'neg', -45, condominio],
    ['IMI — T2 Paranhos', 'em maio e novembro · próxima ' + dataDaMontra(imi), selo('do imóvel', 'grey'), 'neg', -142, imi],
  ].sort((a, b) => a[5] - b[5]);
  return `<p class="tit ecra-titulo">Dinheiro</p>${abasDaMaquete(['Movimentos', 'Planeados', 'Créditos'], 'Planeados')}
<div class="m-cartao m-pend-cartao"><div class="m-entre"><span class="m-cab"><span class="tit">Por confirmar</span>${atrasos ? selo(atrasos + ' em atraso', 'red') : ''}</span><b class="n pos">${eurosDaMontra(total, true)}</b></div>
<span class="m-sub">${PENDENTES.length} à espera</span>${pend}</div>
<div class="m-cartao m-plan-lista">${seguintes.map(([nome, quando, origem, cor, v]) => `<div class="m-plan"><div class="m-entre"><span><b>${nome}</b><span class="m-sub">${quando}</span></span><b class="n ${cor}">${eurosDaMontra(v, true)}</b></div><div class="m-selos">${origem}</div></div>`).join('')}</div>`;
}

// o resto do que a app faz, com o tom do quadrado do ícone (as cores suaves do contrato)
const CAPACIDADES = [
  { titulo: 'Créditos à habitação', tom: 'loan', d: 'M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18M12 3l9 5H3z',
    texto: 'Capital, juros e imposto do selo separados em cada prestação, as amortizações e o plano até ao fim.' },
  { titulo: 'Contas entre proprietários', tom: 'out', d: 'M16 3l4 4-4 4M20 7H8M8 21l-4-4 4-4M4 17h12',
    texto: 'Quotas por imóvel, quem pagou o quê e quanto falta acertar entre comproprietários.' },
  { titulo: 'Visitas e prazos', tom: 'ac', d: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
    texto: 'Quem vem ver que imóvel e quando, e um aviso antes de um contrato acabar.' },
];

/* Os três ecrãs, cada um na sua secção: o que mostra, porque importa, e o
   telemóvel com a maquete. O tom é o do mosaico por trás do telemóvel. */
const ECRAS = [
  { id: 'imoveis', chapeu: 'Imóveis', tom: 't0', titulo: 'Todos os imóveis num relance',
    texto: 'Arrendado, por quartos ou vago: a renda, a yield e a dívida de cada imóvel, e quais têm rendas em atraso. A gestão de imóveis arrendados sem folhas de Excel.',
    pontos: ['Arrendamento do imóvel inteiro ou por quartos.', 'O IMI, o condomínio e o seguro da ficha tornam-se despesas planeadas.', 'O crédito à habitação ligado ao imóvel que o paga.'],
    rotulo: 'O ecrã dos Imóveis num telemóvel: quatro imóveis no Porto, com o estado, a renda, a yield e a dívida de cada um; o T3 Bonfim tem uma renda em atraso e o T1 Cedofeita está vago.',
    ecra: ecraImoveis },
  { id: 'contratos', chapeu: 'Contratos', tom: 't2', titulo: 'Contratos de arrendamento que trabalham por ti',
    texto: 'Inquilinos, quartos, prazos e quanto falta para cada contrato acabar. Ao criares o contrato, a renda de todos os meses fica planeada, e acompanha as renovações.',
    pontos: ['Um contrato por quarto, ou um para o imóvel inteiro.', 'Um aviso antes de o contrato acabar.', 'A caução, os inquilinos e o contrato em PDF já preenchido.'],
    rotulo: 'O ecrã dos Contratos num telemóvel: os contratos agrupados por imóvel com a renda do mês, um contrato que termina daqui a poucas semanas e uma renda em atraso pronta a confirmar.',
    ecra: ecraContratos },
  { id: 'planeados', chapeu: 'Planeados', tom: 't1', titulo: 'Nenhum pagamento passa despercebido',
    texto: 'Cada renda, prestação, IMI, condomínio e seguro chega na data e fica por confirmar. Se um pagamento não chega, passa a em atraso e aparece primeiro: o controlo de rendas faz-se sozinho.',
    pontos: ['Confirmas num toque, e o seguinte fica agendado.', 'As rendas em atraso à vista, a vermelho, até as resolveres.', 'O sino junta tudo o que pede a tua atenção.'],
    rotulo: 'O ecrã dos Planeados num telemóvel: três rendas por confirmar, uma delas em atraso, cada uma com o botão Confirmar, e a seguir a prestação do crédito, o condomínio e o IMI que vêm aí.',
    ecra: ecraPlaneados },
];

// o que fica do lado de quem usa a app
const DADOS = [
  'Cópia de segurança num toque e exportação em CSV.',
  'A conta apaga-se dentro da app, sem pedir a ninguém.',
  'Funciona sem rede e sincroniza quando ela voltar, em vários aparelhos.',
  'Partilhas o que quiseres: um comproprietário vê as contas do imóvel; um contabilista vê os movimentos e mais nada.',
];

/* O que os motores de busca e as redes mostram. Com os termos que um senhorio
   procura (gestão de arrendamento, controlo de rendas, rendas em atraso), e
   sem o IRS: a Declaração ainda só existe em dev. O título fica nos 60
   caracteres e a descrição nos 160, o que o Google mostra sem cortar. */
const TITULO = 'Rendorium — gestão de arrendamento para senhorios';
const DESCRICAO = 'App grátis para senhorios: imóveis, contratos e rendas num só sítio. ' +
  'Controlo de rendas com avisos de rendas em atraso, IMI, condomínio e crédito.';

// os traços dos dois ícones que não são de capacidade: o aviso e o visto
const AVISO = 'M12 8v5M12 16.5v.5M10.3 3.8L2.6 17.5A2 2 0 0 0 4.3 20.5h15.4a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0z';
const VISTO = 'M5 12.5l4.5 4.5L19 7';

/* A faixa da pergunta do rasto, para quem ainda não respondeu: um formulário
   sem JavaScript para o /consentimento, com «Recusar» e «Aceitar» iguais (a
   mesma classe, o mesmo tamanho: recusar tão fácil como aceitar) e a ligação
   à secção da Privacidade que o explica. Vai no fluxo da página, a seguir ao
   hero, e não por cima dele: nada fixo tapa a ação principal nem o conteúdo.
   Recebe: volta — o caminho para onde o /consentimento devolve a pessoa.
   Devolve: o HTML da faixa. */
function faixaDaEscolha(volta) {
  return `<aside class="wrap escolha" aria-label="O rasto de utilização">
    <form class="escolha-caixa" method="post" action="/consentimento">
      <input type="hidden" name="volta" value="${volta}">
      <div class="escolha-texto">
        <p>Usamos um identificador neste aparelho para ver onde tocas e o que abres, e assim melhorar a
        página e a app. Nunca o que escreves. O que fica registado apaga-se ao fim de 90 dias.</p>
        <a href="/privacidade#rasto-de-utilizacao">Política de Privacidade</a>
      </div>
      <div class="escolha-botoes">
        <button class="escolha-botao" type="submit" name="escolha" value="nao">Recusar</button>
        <button class="escolha-botao" type="submit" name="escolha" value="sim">Aceitar</button>
      </div>
    </form>
  </aside>`;
}

/* A linha do rodapé de quem já respondeu: diz o que está em vigor neste
   aparelho e deixa mudar com um botão só, pelo mesmo /consentimento. Sem ela,
   quem aceitou na montra e não tem conta não tinha onde retirar o sim.
   Recebe: escolha — 'sim' ou 'nao'; volta — o caminho de regresso.
   Devolve: o HTML do formulário do rodapé. */
function rodapeDaEscolha(escolha, volta) {
  const sim = escolha === 'sim';
  return `<form class="rodape-escolha" method="post" action="/consentimento">
    <input type="hidden" name="volta" value="${volta}">
    <span>${sim ? 'O rasto de utilização está ligado neste aparelho.' : 'O rasto de utilização está desligado neste aparelho.'}</span>
    <button class="escolha-botao" type="submit" name="escolha" value="${sim ? 'nao' : 'sim'}">${sim ? 'Recusar' : 'Aceitar'}</button>
  </form>`;
}

/* Constrói a página inteira e devolve-a como Response. Os estilos não vão
   dentro dela: estão no CSS_LANDING, servido em /paginas/landing.css, e a
   página vai com a CSP_ESTRITA.

   A página varia com a resposta ao rasto (a faixa, o script, a linha do
   rodapé), que vem num cookie: por isso nunca vai para uma cache partilhada
   (private) e o browser pergunta sempre antes de reusar a sua (no-cache, e o
   Vary: Cookie) — senão o 303 do /consentimento devolvia a página de antes,
   com a faixa ainda lá, e uma cópia guardada podia levar o script a quem
   recusou.

   Fora do domínio raiz isto é uma pré-visualização (dev.rendorium.com/montra,
   ou o servidor local): leva `noindex`, não declara canonical nem og e não
   fica em cache nenhuma. Duas cópias da mesma página indexadas são uma a
   competir com a outra, e um og que aponta para produção a partir de um sítio
   que não é produção mente a quem partilhar a ligação.
   Recebe: op — { raiz, escolha }: raiz verdadeiro quando isto está mesmo a
   ser servido em rendorium.com (qualquer outra coisa vale pré-visualização);
   escolha — 'sim', 'nao' ou null, a resposta ao rasto lida do cookie
   rd_escolha (outro valor vale null).
   Devolve: uma Response HTML com a página completa: a faixa da pergunta com
   escolha null, o script do rasto só com 'sim'. */
export function paginaLanding(op) {
  const raiz = !!(op && op.raiz);
  const escolha = op && (op.escolha === 'sim' || op.escolha === 'nao') ? op.escolha : null;
  // o /montra é o caminho da pré-visualização; em produção a montra é a raiz
  const volta = raiz ? '/' : '/montra';
  const hoje = new Date();
  const cabecaRaiz = raiz ? `<meta property="og:type" content="website">
<meta property="og:title" content="Rendorium — nenhuma renda te passa despercebida">
<meta property="og:description" content="${DESCRICAO}">
<meta property="og:url" content="https://rendorium.com">
<meta property="og:image" content="https://rendorium.com${IMG}/partilha.webp">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="pt_PT">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="https://rendorium.com">`
    : '<meta name="robots" content="noindex,nofollow">';
  const html = `<!doctype html>
<html lang="pt-PT"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#F2F3F6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0B111E" media="(prefers-color-scheme: dark)">
<title>${TITULO}</title>
<meta name="description" content="${DESCRICAO}">
${cabecaRaiz}
<link rel="icon" href="/icon-192.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/fonts/bricolage-grotesque.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/geist.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/paginas/landing.css">
${escolha === 'sim' ? '<script src="/paginas/rasto-montra.js" defer></script>\n' : ''}</head><body>
<div class="faixa-topo">
  <header>
    <span class="marca"><span class="mark" aria-hidden="true"></span><span class="tit">Rendorium</span></span>
    <a class="btn fantasma pequeno entrar" href="${APP}">Entrar</a>
    <a class="btn primary pequeno" href="${APP}/?criar=1">Criar conta</a>
  </header>
</div>
<main>

  <section class="wrap hero" id="inicio">
    <div class="hero-texto">
      <p class="chapeu">Gestão de arrendamento para senhorios</p>
      <h1>Nenhuma renda te passa despercebida.</h1>
      <p class="sub">Imóveis, contratos e rendas num só sítio. A Rendorium lembra-te cada
      pagamento e avisa-te quando falta um.</p>
      <div class="cta">
        <a class="btn primary" href="${APP}/?criar=1">Criar conta grátis</a>
        <a class="btn" href="${APP}">Já tenho conta</a>
      </div>
      <p class="gratis">Grátis, sem planos e sem meio de pagamento. No browser, no telemóvel
      ou instalada como app.</p>
    </div>
    <div class="hero-visual">
      <div class="tile" aria-hidden="true"></div>
      <div class="telemovel" role="img" aria-label="A Visão geral da Rendorium num telemóvel: receita, despesas, prestações e cashflow do ano, e o que pede atenção.">
        <div class="ecra">
          <p class="tit ecra-titulo">Visão geral</p>
          <div class="m-cartao m-atencao"><span class="m-icone">${icone(AVISO)}</span><span><strong>${PENDENTES.length} por confirmar</strong><br><span class="m-sub">${PENDENTES.filter((p) => p.atraso).length} em atraso</span></span></div>
          <div class="m-kpis n">${indicadores()}</div>
          <div class="m-cartao barras-tel">${RECEITA_MES.map(() => '<span></span>').join('')}</div>
          <div class="tile m-capa"></div>
          <p class="m-imovel">T3 Bonfim <span class="m-sub">· 3/4 quartos</span></p>
        </div>
      </div>
    </div>
  </section>
${escolha === null ? '\n  ' + faixaDaEscolha(volta) + '\n' : ''}
  <section class="ligado" id="ligado">
    <div class="wrap ligado-cab">
      <h2>Do imóvel à renda, tudo ligado</h2>
      <p class="sub">O contrato cria a renda planeada, o imóvel cria o IMI e o condomínio, e cada
      pagamento fica à tua espera para confirmar.</p>
    </div>
  </section>

  ${ECRAS.map((e, i) => `<section class="wrap ecra-seccao${i % 2 ? ' inverso' : ''}" id="${e.id}" aria-labelledby="t-${e.id}">
    <div class="ecra-texto">
      <p class="chapeu">${e.chapeu}</p>
      <h3 id="t-${e.id}">${e.titulo}</h3>
      <p class="sub">${e.texto}</p>
      <ul class="lista">
        ${e.pontos.map((t) => `<li>${icone(VISTO, 'ok')}<span>${t}</span></li>`).join('\n        ')}
      </ul>
    </div>
    <div class="ecra-visual">
      <div class="tile ${e.tom}" aria-hidden="true"></div>
      <div class="telemovel ${e.id}" role="img" aria-label="${e.rotulo}">
        <div class="ecra">
${e.ecra(hoje)}
        </div>
      </div>
    </div>
  </section>`).join('\n\n  ')}

  <section class="faz" id="resto">
    <div class="wrap">
      <h2>O resto da gestão, também aqui</h2>
      <div class="grelha">
        ${CAPACIDADES.map((c) => `<div class="cartao"><span class="ic ${c.tom}">${icone(c.d)}</span><h3>${c.titulo}</h3><p>${c.texto}</p></div>`).join('\n        ')}
      </div>
    </div>
  </section>

  <section class="wrap par-pc" id="computador">
    <div class="pc-texto">
      <h2>No computador, a mesma app — sem instalar nada.</h2>
      <p class="sub">Receita, despesas, prestações e cashflow do ano, por mês e por imóvel.</p>
    </div>
    <div class="computador" role="img" aria-label="A Rendorium no computador: a barra lateral azul-noite e a Visão geral, com os quatro indicadores do ano e as receitas e despesas mês a mês.">
      <div class="pc-barra">
        <div class="pc-marca"><span class="mark"></span><span>Rendorium</span></div>
        <span class="pc-item"></span><span class="pc-traco"></span><span class="pc-traco"></span><span class="pc-traco"></span><span class="pc-traco"></span>
      </div>
      <div class="pc-corpo">
        <p class="tit pc-titulo">Visão geral</p>
        <div class="m-kpis quatro n">${indicadores()}</div>
        <div class="m-cartao barras-pc">${RECEITA_MES.map(() => '<span class="mes"><span class="r"></span><span class="d"></span></span>').join('')}</div>
      </div>
    </div>
  </section>

  <section class="banda-noite" id="contas">
    <div class="wrap par">
      <div class="par-texto">
        <h2>Contas entre donos, sem folhas de cálculo.</h2>
        <p>Cada movimento sabe quem pagou e por quem se divide. A app diz quem paga a quem e
        liquida tudo de uma vez. Despesas divididas por valor ou em partes iguais; dívidas a
        terceiros à parte.</p>
      </div>
      <div class="acerto n" role="img" aria-label="Um exemplo das contas entre dois donos: a Maria tem ${eurosDaMontra(412.3, true)} a receber e o Pedro ${eurosDaMontra(412.3, true)} a pagar, e a app propõe que o Pedro pague à Maria.">
        <div class="saldos">
          <div class="saldo mais"><p>Maria</p><p class="valor">+${eurosDaMontra(412.3, true)}</p></div>
          <div class="saldo menos"><p>Pedro</p><p class="valor">${eurosDaMontra(-412.3, true)}</p></div>
        </div>
        <div class="proposta"><p>Pedro paga ${eurosDaMontra(412.3, true)} a Maria</p><span class="botao-maquete">Acertar contas</span></div>
      </div>
    </div>
  </section>

  <section class="wrap dados" id="dados">
    <div class="dados-lista">
      <h2>Os dados são teus</h2>
      <ul class="lista">
        ${DADOS.map((t) => `<li>${icone(VISTO, 'ok')}<span>${t}</span></li>`).join('\n        ')}
      </ul>
    </div>
    <div class="projeto">
      <h2>Um projeto pessoal</h2>
      <p class="sub">Nasceu para gerir o portefólio do autor. É grátis, sem planos e sem limite de
      imóveis. As mudanças ficam registadas na app, em Novidades; as importantes são avisadas
      com antecedência, sem perda de dados.</p>
    </div>
  </section>

  <section class="wrap fecho-seccao" id="comecar">
    <div class="fecho">
      <div class="tile fecho-mosaico" aria-hidden="true"></div>
      <div class="fecho-texto">
        <h2>Começa pelo primeiro imóvel</h2>
        <p>Leva dois minutos, e a partir daí é só confirmar as rendas.</p>
      </div>
      <a class="btn" href="${APP}/?criar=1">Criar conta grátis</a>
    </div>
  </section>

</main>
<footer class="wrap rodape">
  <span class="rodape-marca"><span class="mark" aria-hidden="true"></span><span>© ${new Date().getFullYear()} Rendorium</span></span>
  <a href="/termos">Termos e Condições</a>
  <a href="/privacidade">Política de Privacidade</a>
  <a href="${APP}">Abrir a app</a>
  ${escolha ? rodapeDaEscolha(escolha, volta) : ''}
</footer>
</body></html>`;
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      /* a página varia com o cookie da resposta ao rasto: nunca numa cache
         partilhada, e o browser pergunta sempre antes de reusar a dele. A
         pré-visualização nem isso: existe para ver alterações. */
      'Cache-Control': raiz ? 'private, no-cache' : 'no-store',
      Vary: 'Cookie',
      'Content-Security-Policy': CSP_ESTRITA,
    },
  });
}

/* Os estilos da página, servidos à parte em /paginas/landing.css
   (paginas-recursos.js): a página vai com a CSP_ESTRITA, que não aplica uma
   folha escrita dentro do próprio HTML (a etiqueta de estilo em linha). */
export const CSS_LANDING = `/* As letras da app, auto-alojadas (a CSP só deixa font-src 'self'). As
   mesmas declarações vivem no CSS_LEGAL (legal-vista.js) e no CSS_TESTE
   (teste.js), e um teste confere que as três não divergem. Variáveis: a Geist
   de 100 a 900, a Bricolage Grotesque de 200 a 800, com o eixo ótico, que o
   browser acerta sozinho pelo tamanho. O unicode-range é o latino: o que
   cair fora dele vem da letra seguinte da pilha, sem descarregar nada. */
@font-face{font-family:'Geist';src:url(/fonts/geist.woff2) format('woff2');font-weight:100 900;font-style:normal;font-display:swap;
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}
@font-face{font-family:'Bricolage Grotesque';src:url(/fonts/bricolage-grotesque.woff2) format('woff2');font-weight:200 800;font-style:normal;font-display:swap;
  unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}

/* os tokens da app (o contrato do redesign), com os mesmos nomes: quem
   clica em «Abrir a app» não pode sentir que mudou de produto */
:root{color-scheme:light dark;
  --bg:#F2F3F6;--card:#FFFFFF;--tint:#F6F7F9;--press:#E9ECF2;
  --ink:#121826;--muted:#4F586B;--line:#E2E5EB;--line2:#CDD2DB;
  --accent:#2952D9;--accent-ink:#FFFFFF;--accent-soft:#E9EEFC;--accent-text:#1D3FB0;--accent-press:#1D3FB0;
  --in:#16775A;--in-soft:#E2F3EB;--out:#BD420C;--out-soft:#FCEADF;--loan:#6845C2;--loan-soft:#EFEAFB;
  --warn:#8F5600;--warn-soft:#FFF1D1;--danger:#B42318;--danger-soft:#FDE8E6;
  --side:#0E1830;--side-ink:#FFFFFF;--side-text:#C2CBE0;--side-on:rgba(255,255,255,.12);--side-line:#22305A;
  --blur:rgba(242,243,246,.94);
  /* só da montra. A marca é cobalto nos dois temas (é a marca, não um
     estado); a moldura do telemóvel é quase preta nos dois; os traços da
     barra lateral da maquete, o tracejado e os saldos do bloco azul-noite e
     o bloco final são os valores da prancheta Landing. */
  --marca:#2952D9;--marca-arco:#FFFFFF;
  --moldura:#0B0F1A;--moldura-anel:transparent;
  --sombra-maquete:0 30px 60px rgba(14,24,48,.28);--sombra-janela:0 24px 48px rgba(14,24,48,.14);
  --mosaico-fundo:#DCE4FB;--mosaico-traco:#3A5FD6;
  --side-traco:#2A3A63;--side-tracejado:#2C3A5E;
  --saldo-mais:#8FE3C0;--saldo-mais-fundo:rgba(76,199,154,.14);
  --saldo-menos:#FFB27A;--saldo-menos-fundo:rgba(255,154,98,.14);
  --fecho-fundo:#2952D9;--fecho-tinta:#FFFFFF;--fecho-sub:#DCE4FB;
  --fecho-botao:#FFFFFF;--fecho-botao-tinta:#1D3FB0;--fecho-botao-hover:#E9EEFC;--fecho-mosaico:rgba(255,255,255,.35);
  /* movimento: os tokens da app (--rapido, --curva, --curva-entra), para
     quem clica em «Abrir a app» não sentir que mudou de produto também no
     tempo. O --entrada é só daqui: uma montra pode demorar mais do que uma
     app a responder, e .65s é o degrau de quem chega pela primeira vez. */
  --rapido:.12s;--entrada:.65s;
  --curva:cubic-bezier(.22,1,.36,1);--curva-entra:cubic-bezier(0,0,.2,1)}
/* o tema escuro de quem lê, com os tokens escuros do contrato. No escuro o
   bloco final passa a cobalto suave (um bloco #7C9BFF daquele tamanho
   encandeava) e a moldura do telemóvel ganha um anel, senão sumia no fundo. */
@media(prefers-color-scheme:dark){:root{
  --bg:#0B111E;--card:#141C2C;--tint:#1A2335;--press:#253049;
  --ink:#E9EDF5;--muted:#AEB7C9;--line:#253049;--line2:#33405C;
  --accent:#7C9BFF;--accent-ink:#0B111E;--accent-soft:#1E2A4D;--accent-text:#B5C6FF;--accent-press:#9DB3FF;
  --in:#4CC79A;--in-soft:#123327;--out:#FF9A62;--out-soft:#3A2216;--loan:#B49BFF;--loan-soft:#2A2247;
  --warn:#F2C25A;--warn-soft:#352A12;--danger:#FF8A80;--danger-soft:#3D1A1A;
  --side:#070C17;--side-text:#9AA6C0;--side-line:#1A2440;
  --blur:rgba(11,17,30,.92);
  --moldura-anel:#33405C;
  --sombra-maquete:0 30px 60px rgba(0,0,0,.55);--sombra-janela:0 24px 60px rgba(0,0,0,.6);
  --mosaico-fundo:#1E2A4D;--mosaico-traco:#3A5FD6;
  --fecho-fundo:#1E2A4D;--fecho-tinta:#E9EDF5;--fecho-sub:#AEB7C9;
  --fecho-botao:#7C9BFF;--fecho-botao-tinta:#0B111E;--fecho-botao-hover:#9DB3FF;--fecho-mosaico:rgba(124,155,255,.28)}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:'Geist',system-ui,-apple-system,'Segoe UI',sans-serif;
  font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;
  padding:0 env(safe-area-inset-right) 0 env(safe-area-inset-left)}
/* os títulos e os valores grandes na Bricolage, como na app */
h1,h2,h3,.tit{font-family:'Bricolage Grotesque','Geist',system-ui,sans-serif;font-weight:650;
  letter-spacing:-.02em;margin:0}
h1,h2{text-wrap:balance}
p{margin:0;text-wrap:pretty}
a{color:var(--accent)}
a:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:4px}
.n{font-variant-numeric:tabular-nums}
.wrap{max-width:1160px;margin:0 auto;padding-left:clamp(16px,4vw,40px);padding-right:clamp(16px,4vw,40px)}
.i{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}

/* a marca: o quadrado cobalto com dois arcos brancos em cantos opostos, em
   CSS e não em imagem. Os arcos vão em percentagem do raio do gradiente, para
   o mesmo desenho servir aos 34, 24 e 22 px. */
.mark{display:block;flex:none;width:34px;height:34px;border-radius:9px;
  background:radial-gradient(circle at 0 0,transparent 23%,var(--marca-arco) 24%,var(--marca-arco) 30.2%,transparent 31.2%),
    radial-gradient(circle at 100% 100%,transparent 23%,var(--marca-arco) 24%,var(--marca-arco) 30.2%,transparent 31.2%),var(--marca)}
/* o mosaico das capas sem fotografia: arcos e pontos, pintados pelos dois
   tokens, que cada uso pode trocar no próprio elemento */
.tile{background-color:var(--mosaico-fundo);
  background-image:radial-gradient(circle at 0 0,transparent 12px,var(--mosaico-traco) 12.5px,var(--mosaico-traco) 15px,transparent 15.5px),
    radial-gradient(circle at 100% 100%,transparent 12px,var(--mosaico-traco) 12.5px,var(--mosaico-traco) 15px,transparent 15.5px),
    radial-gradient(circle at 50% 50%,var(--mosaico-traco) 2.5px,transparent 3px);
  background-size:28px 28px}

/* acompanha o scroll, como o cabeçalho da app: a página é comprida, e a
   marca e a porta de entrada não podem ficar lá em cima. O vidro é o --blur,
   saturado para as cores de baixo atravessarem vivas; a risca só aparece
   quando há conteúdo por baixo dela para separar — é o scroll que a acende,
   mais abaixo, onde o motor souber animar pelo scroll. */
.faixa-topo{position:sticky;top:0;z-index:20;background:var(--blur);
  -webkit-backdrop-filter:blur(12px) saturate(140%);
  backdrop-filter:blur(12px) saturate(140%);border-bottom:1px solid var(--line)}
/* as mesmas medidas do .wrap, para a marca ficar na prumada do texto */
header{display:flex;align-items:center;gap:8px;max-width:1160px;margin:0 auto;min-height:72px;
  padding:0 clamp(16px,4vw,40px)}
.marca{display:flex;align-items:center;gap:10px;margin-right:auto;color:var(--ink)}
.marca .tit{font-size:22px}

/* os botões da montra são os da app em ponto grande (50 px, raio 14), como
   na prancheta; os do cabeçalho ficam nos 44 da app */
a.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:8px;
  min-height:50px;padding:0 22px;border-radius:14px;border:1px solid var(--line2);
  background:var(--card);color:var(--ink);text-decoration:none;font-weight:600;font-size:16px;white-space:nowrap;
  transition:transform var(--rapido) var(--curva),background-color var(--rapido) var(--curva),
    border-color var(--rapido) var(--curva),color var(--rapido) var(--curva)}
a.btn.primary{background:var(--accent);color:var(--accent-ink);border-color:var(--accent)}
a.btn.fantasma{background:transparent;border-color:transparent}
a.btn.pequeno{min-height:44px;padding:0 16px;font-size:15px;border-radius:12px}
/* a régua da app: .97 nos botões, e a reação vive no premido, não no largar */
a.btn:active{transform:scale(.97)}
a.btn:focus-visible{outline:2px solid var(--accent);outline-offset:3px;border-radius:14px}

/* ---------------------------------------------------------------- hero */
.hero{display:flex;flex-wrap:wrap;align-items:center;gap:48px;padding-top:48px;padding-bottom:72px}
.hero-texto{flex:1 1 440px;min-width:0;display:flex;flex-direction:column;gap:22px}
/* quanto maior a letra, mais apertado o leading: um título de 68px com o
   espaçamento do corpo lê-se desconjuntado */
.hero h1{font-size:clamp(40px,6vw,68px);line-height:1.02}
.hero .sub{font-size:20px;line-height:1.45;max-width:560px;color:var(--muted)}
.cta{display:flex;flex-wrap:wrap;gap:12px}
.gratis{font-size:15px;color:var(--muted)}
.hero-visual{flex:1 1 380px;min-width:0;display:flex;justify-content:center;position:relative;min-height:520px}
/* o mosaico fica preso ao telemóvel como na prancheta (49 px à esquerda dele,
   89 à direita): quando o hero passa a uma coluna, numa largura de tablet,
   não se estica numa faixa de lado a lado */
.hero-visual > .tile{position:absolute;border-radius:32px;
  inset:40px max(0px,calc(50% - 240px)) 40px max(40px,calc(50% - 200px))}

/* -------------------------------------------- as maquetes (role="img") */
.telemovel{position:relative;width:300px;max-width:100%;border-radius:40px;background:var(--moldura);padding:12px;
  box-shadow:0 0 0 1px var(--moldura-anel),var(--sombra-maquete)}
.ecra{border-radius:30px;background:var(--bg);padding:18px 14px;display:flex;flex-direction:column;gap:10px;min-height:560px}
.ecra-titulo{font-size:18px}
.m-cartao{background:var(--card);border:1px solid var(--line);border-radius:14px}
.m-atencao{display:flex;align-items:center;gap:10px;padding:10px 12px;font-size:12.5px;line-height:1.35}
.m-icone{width:28px;height:28px;border-radius:8px;background:var(--danger-soft);color:var(--danger);
  display:flex;align-items:center;justify-content:center;flex:none}
.m-icone .i{width:16px;height:16px}
.m-sub{color:var(--muted)}
.m-kpis{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.m-kpis.quatro{grid-template-columns:repeat(4,minmax(0,1fr))}
.m-kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px;min-width:0}
.m-kpi p:first-child{font-size:11px}
.m-kpi .tit{font-size:15px;white-space:nowrap}
/* o contorno da divisória da barra: no escuro o azul-noite quase se
   confundia com o fundo do ecrã */
.m-kpi.noite{background:var(--side);border-color:var(--side-line)}
.m-kpi.noite p:first-child{color:var(--side-text)}
.m-kpi.noite .tit{color:var(--side-ink)}
.barras-tel{display:flex;align-items:flex-end;gap:4px;height:120px;padding:12px}
.barras-tel span{flex:1;border-radius:3px 3px 0 0;background:var(--in)}
.m-capa{height:90px;border-radius:14px}
.m-imovel{font-size:12.5px;font-weight:600}
.m-imovel .m-sub{font-weight:400}

.computador{flex:1.4 1 520px;min-width:0;display:flex;min-height:340px;border-radius:20px;overflow:hidden;
  border:1px solid var(--line);background:var(--bg);box-shadow:var(--sombra-janela)}
.pc-barra{width:150px;flex:none;background:var(--side);padding:16px 12px;display:flex;flex-direction:column;gap:8px}
.pc-marca{display:flex;align-items:center;gap:8px;color:var(--side-ink);font-size:13px;font-weight:600;margin-bottom:4px}
.pc-marca .mark{width:22px;height:22px;border-radius:6px}
.pc-item{height:26px;border-radius:7px;background:var(--side-on)}
.pc-traco{height:10px;border-radius:4px;background:var(--side-traco)}
.pc-traco:nth-child(3){width:70%}
.pc-traco:nth-child(4){width:60%}
.pc-traco:nth-child(5){width:75%}
.pc-traco:nth-child(6){width:55%}
.pc-corpo{flex:1;min-width:0;padding:18px;display:flex;flex-direction:column;gap:12px}
.pc-titulo{font-size:18px}
.computador .m-kpi{border-radius:10px}
.computador .m-kpi .tit{font-size:14px}
.barras-pc{flex:1;display:flex;align-items:flex-end;gap:6px;min-height:150px;padding:12px;border-radius:12px}
.barras-pc .mes{flex:1;display:flex;flex-direction:column;gap:2px}
.barras-pc .r{border-radius:3px;background:var(--in)}
.barras-pc .d{border-radius:3px;background:var(--out)}
${alturasDasBarras()}

/* os três ecrãs (Imóveis, Contratos, Planeados): as peças da app em ponto
   pequeno — o .badge, as abas da área, o cartão do imóvel, a linha do
   contrato e a do planeado —, com as mesmas cores por token */
.m-sub{font-size:10.5px;line-height:1.35}
.m-abas{display:flex;gap:2px;padding:3px;border-radius:10px;background:var(--tint);border:1px solid var(--line);overflow:hidden}
.m-abas span{flex:none;padding:5px 8px;border-radius:7px;border:1.5px solid transparent;font-size:11px;font-weight:600;color:var(--muted);white-space:nowrap}
.m-abas .on{border-color:var(--accent);background:var(--accent-soft);color:var(--accent-text)}
.m-selo{display:inline-flex;align-items:center;min-height:18px;padding:1px 6px;border-radius:5px;font-size:10px;font-weight:600;
  line-height:1.2;white-space:nowrap;background:var(--accent-soft);color:var(--accent-text)}
.m-selo.in{background:var(--in-soft);color:var(--in)}
.m-selo.amber{background:var(--warn-soft);color:var(--warn)}
.m-selo.red{background:var(--danger-soft);color:var(--danger)}
.m-selo.grey{background:var(--tint);color:var(--muted)}
.m-selo.loan{background:var(--loan-soft);color:var(--loan)}
.m-selos{display:flex;flex-wrap:wrap;gap:4px}
.m-entre{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}
.m-entre > span:first-child{min-width:0;display:flex;flex-direction:column;gap:1px}
.m-entre b{font-size:12px;font-weight:600;white-space:nowrap}
.m-entre > span:first-child b{white-space:normal}
.m-nome{font-size:13.5px}
.m-linha-unica{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pos{color:var(--in)}.neg{color:var(--out)}.prest{color:var(--loan)}
.botao-maquete.pequeno{min-height:26px;padding:0 10px;border-radius:8px;font-size:11px;align-self:flex-start;
  background:var(--accent);color:var(--accent-ink)}

/* as capas sem fotografia, nos quatro tons do mosaico da app (.imv-t0…t3) */
.tile.t1{--mosaico-fundo:#FAE6D2;--mosaico-traco:#B65A16}
.tile.t2{--mosaico-fundo:#D9EFE5;--mosaico-traco:#1E7A5B}
.tile.t3{--mosaico-fundo:#E3E6EC;--mosaico-traco:#5B6478}
/* no escuro, o fundo suave do contrato com o traço do tom claro: o traço
   escuro do contrato (o --in, o --warn) num mosaico daquele tamanho
   encandeava, como o cobalto do hero encandearia */
@media(prefers-color-scheme:dark){
  .tile.t1{--mosaico-fundo:var(--warn-soft);--mosaico-traco:#B65A16}
  .tile.t2{--mosaico-fundo:var(--in-soft);--mosaico-traco:#1E7A5B}
  .tile.t3{--mosaico-fundo:var(--tint);--mosaico-traco:#5B6478}
}
.m-imv{display:grid;grid-template-columns:58px 1fr;gap:10px;padding:9px;border-radius:14px;background:var(--card);border:1px solid var(--line)}
.m-imv-capa{display:block;min-height:76px;border-radius:10px;background-size:20px 20px}
.m-imv-corpo{min-width:0;display:flex;flex-direction:column;gap:5px}
.m-nums{display:grid;grid-template-columns:repeat(3,auto);justify-content:space-between;gap:6px;font-size:11px;font-weight:600;white-space:nowrap}
.m-nums > span{display:flex;flex-direction:column;min-width:0;overflow:hidden;text-overflow:ellipsis}
.m-nums .m-sub{font-size:9.5px;font-weight:400}

.m-ct-grupo{display:flex;flex-direction:column;gap:6px;margin-top:4px}
.m-ct-linhas{overflow:hidden}
.m-ct{display:flex;flex-direction:column;gap:6px;padding:9px 10px}
.m-ct + .m-ct{border-top:1px solid var(--line)}
.m-ct .m-selos{margin-top:3px}
.m-pend,.m-plan{display:flex;flex-direction:column;gap:6px}
.m-pend{padding:8px;border-radius:10px;background:var(--tint)}
.m-pend > p{font-size:10.5px;font-weight:600}

.m-pend-cartao,.m-plan-lista{padding:10px;display:flex;flex-direction:column;gap:2px}
.m-entre > span.m-cab:first-child{flex-direction:row;flex-wrap:wrap;align-items:center;gap:4px 6px}
.m-cab .tit{font-size:14px;white-space:nowrap}
.m-plan{padding:8px 0}
.m-plan + .m-plan,.m-pend-cartao > .m-plan{border-top:1px solid var(--line)}
.m-plan-lista .m-plan:first-child{padding-top:0}
.m-plan-lista .m-plan:last-child{padding-bottom:0}
.m-valor{display:flex;flex-direction:column;align-items:flex-end;gap:3px}

/* ------------------------------------------------------------- secções
   o chapéu: a palavra que diz de que se fala, por cima do título */
.chapeu{font-size:14px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--accent-text)}

/* «Do imóvel à renda, tudo ligado»: a cabeça, e um ecrã por secção, o
   texto de um lado e o telemóvel do outro, a alternar; numa coluna, o
   texto vem sempre antes do telemóvel */
.ligado{padding-top:clamp(24px,4vw,40px)}
.ligado-cab{display:flex;flex-direction:column;gap:14px}
.ligado-cab h2{font-size:clamp(30px,4vw,44px);line-height:1.08}
.ligado-cab .sub{font-size:19px;color:var(--muted);max-width:680px}
.ecra-seccao{display:flex;flex-wrap:wrap;align-items:center;gap:40px 64px;
  padding-top:clamp(48px,7vw,80px);padding-bottom:clamp(48px,7vw,80px)}
.ecra-seccao + .ecra-seccao{border-top:1px solid var(--line)}
.ecra-texto{flex:1 1 380px;min-width:0;display:flex;flex-direction:column;gap:16px}
.ecra-texto h3{font-size:clamp(28px,3.6vw,40px);line-height:1.1}
.ecra-texto .sub{font-size:18px;color:var(--muted)}
.ecra-texto .lista{gap:12px}
.ecra-visual{flex:1 1 380px;min-width:0;display:flex;justify-content:center;position:relative;padding:32px 0}
.ecra-visual > .tile{position:absolute;border-radius:32px;inset:72px max(0px,calc(50% - 230px)) 72px max(0px,calc(50% - 230px))}
.ecra-visual .ecra{min-height:0}
@media(min-width:900px){.ecra-seccao.inverso .ecra-texto{order:2}}

.faz{background:var(--card);border-top:1px solid var(--line);border-bottom:1px solid var(--line);
  padding:clamp(56px,8vw,80px) 0}
.faz .wrap{display:flex;flex-direction:column;gap:36px}
.faz h2{font-size:clamp(30px,4vw,44px)}
.grelha{display:grid;gap:16px;grid-template-columns:1fr}
@media(min-width:620px){.grelha{grid-template-columns:1fr 1fr}}
@media(min-width:940px){.grelha{grid-template-columns:1fr 1fr 1fr}}
.cartao{display:flex;flex-direction:column;gap:10px;padding:24px;border-radius:20px;
  background:var(--card);border:1px solid var(--line)}
.cartao h3{font-size:21px;line-height:1.2}
.cartao p{color:var(--muted)}
.ic{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center}
.ic.in{background:var(--in-soft);color:var(--in)}
.ic.ac{background:var(--accent-soft);color:var(--accent-text)}
.ic.out{background:var(--out-soft);color:var(--out)}
.ic.loan{background:var(--loan-soft);color:var(--loan)}
.ic.warn{background:var(--warn-soft);color:var(--warn)}

.par-pc{display:flex;flex-wrap:wrap;align-items:center;gap:48px;
  padding-top:clamp(56px,8vw,88px);padding-bottom:clamp(56px,8vw,88px)}
.pc-texto{flex:1 1 360px;min-width:0;display:flex;flex-direction:column;gap:16px}
.pc-texto h2,.par-texto h2{font-size:clamp(28px,3.6vw,40px);line-height:1.1}
.pc-texto .sub{font-size:18px;color:var(--muted)}

/* o bloco azul-noite das contas entre donos: a cor da barra lateral da app */
.banda-noite{background:var(--side);color:var(--side-ink);border-top:1px solid var(--side-line);
  border-bottom:1px solid var(--side-line);padding:clamp(56px,8vw,88px) 0}
.par{display:flex;flex-wrap:wrap;gap:48px;align-items:center}
.par-texto{flex:1 1 420px;min-width:0;display:flex;flex-direction:column;gap:16px}
.par-texto p{font-size:18px;color:var(--side-text)}
.acerto{flex:1 1 340px;min-width:0;display:flex;flex-direction:column;gap:10px}
.saldos{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.saldo{padding:16px;border-radius:14px}
.saldo p:first-child{font-weight:600}
.saldo .valor{font-weight:700;font-size:20px;white-space:nowrap}
.saldo.mais{background:var(--saldo-mais-fundo)}
.saldo.mais .valor{color:var(--saldo-mais)}
.saldo.menos{background:var(--saldo-menos-fundo)}
.saldo.menos .valor{color:var(--saldo-menos)}
.proposta{padding:16px;border-radius:14px;border:1px dashed var(--side-tracejado);
  display:flex;flex-wrap:wrap;align-items:center;gap:12px}
.proposta p{flex:1 1 160px}
/* desenho de um botão dentro da maquete: não é tocável, por isso não é um
   <button> nem tem cursor de mão */
.botao-maquete{display:inline-flex;align-items:center;min-height:40px;padding:0 18px;border-radius:12px;
  background:var(--side-ink);color:var(--side);font-weight:600;white-space:nowrap}

.dados{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr));gap:48px;
  padding-top:clamp(56px,8vw,88px);padding-bottom:clamp(56px,8vw,88px)}
.dados h2{font-size:clamp(26px,3.2vw,34px)}
.dados-lista{display:flex;flex-direction:column;gap:18px}
.lista{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:18px}
.lista li{display:flex;gap:12px;align-items:flex-start}
.lista .i{margin-top:1px}
.i.ok{color:var(--in)}
.projeto{align-self:start;display:flex;flex-direction:column;gap:18px;padding:28px;border-radius:24px;
  background:var(--card);border:1px solid var(--line)}
.projeto .sub{font-size:17px;color:var(--muted)}

.fecho-seccao{padding-bottom:clamp(56px,8vw,88px)}
.fecho{position:relative;overflow:hidden;border-radius:28px;background:var(--fecho-fundo);color:var(--fecho-tinta);
  padding:clamp(32px,6vw,64px);display:flex;flex-wrap:wrap;align-items:center;gap:24px}
.fecho-mosaico{position:absolute;right:-40px;top:-40px;width:320px;height:320px;border-radius:40px;
  --mosaico-fundo:transparent;--mosaico-traco:var(--fecho-mosaico)}
.fecho-texto{flex:1 1 420px;min-width:0;position:relative;display:flex;flex-direction:column;gap:10px}
.fecho h2{font-size:clamp(30px,4vw,46px);line-height:1.08}
.fecho p{font-size:18px;color:var(--fecho-sub)}
.fecho a.btn{background:var(--fecho-botao);border-color:var(--fecho-botao);color:var(--fecho-botao-tinta)}
.fecho a.btn:focus-visible{outline-color:var(--fecho-tinta)}

.rodape{display:flex;flex-wrap:wrap;align-items:center;gap:4px 20px;padding-top:20px;padding-bottom:40px;
  border-top:1px solid var(--line);font-size:15px}
.rodape-marca{display:flex;align-items:center;gap:8px;margin-right:auto;color:var(--muted)}
.rodape .mark{width:24px;height:24px;border-radius:6px}
.rodape a{display:inline-flex;align-items:center;min-height:44px;text-decoration:none}
/* quem já respondeu ao rasto muda a resposta aqui, numa linha discreta */
.rodape-escolha{flex-basis:100%;display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;
  font-size:14px;color:var(--muted)}

/* a faixa da pergunta do rasto, para quem ainda não respondeu: no fluxo da
   página, a seguir ao hero, e não fixa por cima de nada. Um cartão calmo, com
   os dois botões iguais — nenhum é o primário, recusar pesa o mesmo que
   aceitar. */
.escolha{padding-bottom:24px}
.escolha-caixa{display:flex;flex-wrap:wrap;align-items:center;gap:12px 24px;padding:16px 24px;
  border-radius:16px;background:var(--card);border:1px solid var(--line)}
.escolha-texto{flex:1 1 420px;min-width:0;font-size:14px;color:var(--muted)}
.escolha-texto a{display:inline-flex;align-items:center;min-height:44px;font-weight:600;color:var(--accent-text)}
.escolha-botoes{flex:1 1 auto;display:flex;justify-content:flex-end;gap:12px}
/* o botão secundário da app (44 px, raio 12), para os dois */
.escolha-botao{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:120px;
  padding:0 16px;border-radius:12px;border:1px solid var(--line2);background:var(--card);color:var(--ink);
  font:inherit;font-size:15px;font-weight:600;cursor:pointer;
  transition:transform var(--rapido) var(--curva),background-color var(--rapido) var(--curva),
    border-color var(--rapido) var(--curva)}
.escolha-botao:active{transform:scale(.97)}
.escolha-botao:focus-visible{outline:2px solid var(--accent);outline-offset:3px}
@media(max-width:480px){
  .escolha-caixa{padding:16px}
  .escolha-botao{flex:1 1 0}
}

/* o hover só existe onde há rato: num ecrã de dedo, o toque deixava o botão
   aceso até alguém tocar noutro sítio. Só cor — nada levanta nem sombreia. */
@media(hover:hover) and (pointer:fine){
  a.btn:hover{background:var(--tint)}
  a.btn.primary:hover{background:var(--accent-press);border-color:var(--accent-press)}
  a.btn.fantasma:hover{background:var(--press);border-color:var(--press)}
  .fecho a.btn:hover{background:var(--fecho-botao-hover);border-color:var(--fecho-botao-hover)}
  .rodape a:hover{color:var(--accent-text);text-decoration:underline}
  .escolha-botao:hover{background:var(--tint)}
}

/* ----------------------------------------------------------- telemóvel */
@media(max-width:619px){
  .pc-barra{width:52px;padding:14px 10px}
  .pc-marca span:last-child{display:none}
  .computador .m-kpis.quatro{grid-template-columns:1fr 1fr}
  /* no telemóvel o título ocupa a largura toda e o mosaico passava-lhe por
     baixo das letras: desce para o canto vazio ao lado do botão */
  .fecho-mosaico{width:160px;height:160px;top:auto;right:-56px;bottom:-56px}
  .rodape-marca{flex-basis:100%}
}
@media(max-width:480px){
  header{min-height:64px;gap:6px}
  .marca{gap:8px}
  .marca .mark{width:30px;height:30px;border-radius:8px}
  .marca .tit{font-size:19px}
  a.btn.pequeno{padding:0 14px}
  .hero{padding-top:32px;padding-bottom:56px}
  .hero .sub{font-size:18px}
}
/* num ecrã muito estreito não cabem dois botões ao lado da marca: o
   «Já tenho conta» do hero faz as vezes do «Entrar» */
@media(max-width:359px){a.btn.entrar{display:none}}

/* ======================= MOVIMENTO =======================
   Uma entrada só, para a página inteira: subir e desvanecer. É transform e
   opacity de ponta a ponta — nada aqui pede layout — e o estado BASE é
   sempre o visível: quem não corre animações (motor antigo, impressão)
   vê a página feita. */
@keyframes sobe{from{opacity:0;transform:translateY(16px)}}

/* A entrada do hero, ao chegar: escalonada a 70ms, como a Apple escalona o
   que chega junto — tudo ao mesmo tempo é um bloco, um a um é uma chegada.
   O backwards é o que segura os atrasados invisíveis até à vez deles. */
.hero .chapeu{animation:sobe var(--entrada) var(--curva-entra) backwards}
.hero h1{animation:sobe var(--entrada) var(--curva-entra) backwards}
.hero .sub{animation:sobe var(--entrada) var(--curva-entra) .07s backwards}
.hero .cta{animation:sobe var(--entrada) var(--curva-entra) .14s backwards}
.hero .gratis{animation:sobe var(--entrada) var(--curva-entra) .21s backwards}
.hero .telemovel{animation:sobe var(--entrada) var(--curva-entra) .1s backwards}
.hero-visual > .tile{animation:sobe var(--entrada) var(--curva-entra) .04s backwards}

/* O resto da página revela-se ao scroll, SEM JavaScript: a linha do tempo é
   o próprio scroll (animation-timeline), o dedo é quem conduz — dá para
   parar, voltar atrás e retomar, que é a interrupção de graça. Atrás de
   @supports de propósito: fora dele o estado base fica como sempre esteve,
   visível, e um motor sem view() não esconde conteúdo a ninguém. */
@supports (animation-timeline: view()){
  .ligado-cab,.ecra-texto,.ecra-visual,
  .grelha .cartao,.pc-texto,.computador,.par-texto,.acerto,.dados-lista .lista li,.projeto,.fecho{
    animation:sobe linear both;animation-timeline:view();
    animation-range:entry 8% entry 42%}
  /* as colunas da grelha entram por degraus, senão a fila chega em bloco —
     e os degraus seguem as colunas que existem (.grelha, acima): o padrão
     de três aplicado a duas punha o cartão da direita a entrar antes do da
     esquerda, e numa coluna só atrasava o 3.º e o 6.º sem razão nenhuma */
  @media(min-width:620px) and (max-width:939px){
    .grelha .cartao:nth-child(2n){animation-range:entry 14% entry 48%}
  }
  @media(min-width:940px){
    .grelha .cartao:nth-child(3n+2){animation-range:entry 14% entry 48%}
    .grelha .cartao:nth-child(3n){animation-range:entry 20% entry 54%}
  }
}
/* a risca do cabeçalho acende-se nos primeiros 24px de scroll: no topo não
   há nada por baixo dela para separar */
@supports (animation-timeline: scroll()){
  .faixa-topo{border-bottom-color:transparent;
    animation:risca linear both;animation-timeline:scroll();animation-range:0 24px}
  @keyframes risca{to{border-bottom-color:var(--line)}}
}

/* quem pediu menos movimento recebe menos, não zero: as entradas e as
   revelações ficam, mas em opacidade pura — o @keyframes redefinido aqui
   dentro tira o translateY a todas de uma vez — e nada se desloca nem muda
   de tamanho: o encolher do premido sai (e qualquer transform num hover que
   venha a existir), as cores ficam. A risca do cabeçalho é cor guiada pelo
   scroll, não movimento, e continua a acender-se. */
@media(prefers-reduced-motion:reduce){
  @keyframes sobe{from{opacity:0}}
  a.btn:hover,a.btn:active{transform:none}
  .escolha-botao:active{transform:none}
}
/* quem pediu menos transparência recebe o cabeçalho sólido */
@media(prefers-reduced-transparency:reduce){
  .faixa-topo{background:var(--bg);-webkit-backdrop-filter:none;backdrop-filter:none}}
/* e quem pediu mais contraste recebe contornos e texto secundário que se veem */
@media(prefers-contrast:more){:root{--line:#8A93A5;--line2:#6B7385;--muted:#384152}}
@media(prefers-contrast:more) and (prefers-color-scheme:dark){:root{--line:#56627D;--line2:#6E7A96;--muted:#C9D0DD}}
`;

/* O JavaScript do rasto na montra, servido em /paginas/rasto-montra.js
   (paginas-recursos.js) e só pedido pela página de quem aceitou. Manda os
   eventos do contrato do rasto para o POST /rasto, em lotes de até 50, por
   sendBeacon a cada 15 s, ao esconder a página e no pagehide:
   - «pagina» ao carregar (e ao voltar da cache de avanço e recuo);
   - «secao» quando cada secção com id entra à vista, uma vez por secção
     (IntersectionObserver: nada de ouvir o scroll);
   - «toque» em cada clique, com o DESCRITOR do alvo (click:<ação>,
     a:<host de fora><caminho>?<chaves sem valores>, <tag>#<id>,
     <tag>.<classe> ou <tag>) e a posição em permilagem da
     janela, e os sinais «em-vao» (nada interativo debaixo do dedo) e
     «repetido» (o 3.º toque e os seguintes a 24 px ou menos do anterior, em
     1 s ou menos). Nunca o texto da página nem o que se escreve.
   ES5, num IIFE, sem nomes globais; o servidor responde 204 sempre e o
   cliente nunca reage. */
export const GUIAO_RASTO_MONTRA = String.raw`(function () {
  'use strict';
  var nav = window.navigator;
  if (!nav || !document.addEventListener) return;

  var LOTE = 50;
  var CADA = 15000;
  var MAX_FILA = 1000;
  // o que conta como interativo (o contrato do rasto): fora disto, um toque é em vão
  var INTERATIVO = 'button,a[href],input,select,textarea,label,summary,[data-click],' +
    '[role=button],[role=tab],[role=link],[role=menuitem],[role=switch],[tabindex]';
  var fila = [];
  var sessao = 's-' + aleatorio(10);
  var anterior = null;
  var vistas = {};
  var vigia = null;

  /* Um texto aleatório para a sessão, do crypto quando há.
     Recebe: n — quantos caracteres.
     Devolve: o texto, com n caracteres de [a-z0-9]. */
  function aleatorio(n) {
    var abc = 'abcdefghijklmnopqrstuvwxyz0123456789';
    var c = window.crypto || window.msCrypto;
    var v = null;
    var s = '';
    var i;
    if (c && c.getRandomValues) { v = new Uint8Array(n); c.getRandomValues(v); }
    for (i = 0; i < n; i++) s += abc.charAt((v ? v[i] : Math.floor(Math.random() * 256)) % abc.length);
    return s;
  }

  /* Um texto cortado ao tamanho que o servidor guarda.
     Recebe: t — o texto (ou null); n — o tamanho máximo.
     Devolve: o texto cortado, ou null. */
  function corta(t, n) {
    return t == null ? null : String(t).slice(0, n);
  }

  /* A largura da janela, em px.
     Devolve: o número (0 quando não se sabe). */
  function largura() {
    return window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 0;
  }

  /* A altura da janela, em px.
     Devolve: o número (0 quando não se sabe). */
  function altura() {
    return window.innerHeight || (document.documentElement && document.documentElement.clientHeight) || 0;
  }

  /* O caminho da página, que é o ecrã da montra.
     Devolve: o caminho, até 40 caracteres. */
  function caminho() {
    return corta((window.location && window.location.pathname) || '/', 40);
  }

  /* Junta um evento à fila, com o tamanho da janela de agora.
     Recebe: tipo; ecra; alvo; x, y — a posição em permilagem (ou null);
     sinal — o sinal (ou null).
     Devolve: nada. */
  function poe(tipo, ecra, alvo, x, y, sinal) {
    if (fila.length >= MAX_FILA) return;
    fila.push({ t: Date.now(), tipo: tipo, ecra: ecra, janela: null, alvo: alvo,
      x: x, y: y, vw: largura(), vh: altura(), sinal: sinal });
  }

  /* Se um elemento casa com um seletor, também nos motores antigos.
     Recebe: el — o elemento; sel — o seletor.
     Devolve: verdadeiro ou falso. */
  function casa(el, sel) {
    var m = el.matches || el.msMatchesSelector || el.webkitMatchesSelector;
    return !!m && m.call(el, sel);
  }

  /* O elemento interativo debaixo do toque: o próprio ou um antepassado.
     Recebe: el — o elemento tocado.
     Devolve: o elemento interativo, ou null quando o toque foi em vão. */
  function interativo(el) {
    while (el && el.nodeType === 1) {
      if (casa(el, INTERATIVO)) return el;
      el = el.parentNode;
    }
    return null;
  }

  /* O destino de uma ligação, sem nenhum valor: o host só quando não é o da
     página, o caminho, e as CHAVES da pesquisa sem os valores
     (a:app.rendorium.com/?criar, a:/privacidade). Uma ligação sem endereço
     web (mailto:, tel:) fica só com o esquema, que o resto é um contacto.
     Recebe: href — o atributo href, como está escrito.
     Devolve: o descritor «a:…». */
  function ligacao(href) {
    var h = String(href);
    var host = '';
    var resto = h;
    var m = /^(?:[a-z][a-z0-9+.-]*:)?\/\/([^\/?#]*)(.*)$/i.exec(h);
    var aqui = String((window.location && window.location.hostname) || '').toLowerCase();
    var caminhoDela, pesquisa, chaves, partes, i, k;
    if (m) {
      host = m[1].replace(/^[^@]*@/, '').replace(/:[0-9]*$/, '').toLowerCase();
      resto = m[2];
      if (host === aqui) host = '';
    } else if (/^[a-z][a-z0-9+.-]*:/i.test(h)) {
      return 'a:' + h.split(':')[0].toLowerCase() + ':';
    }
    caminhoDela = resto.split(/[?#]/)[0];
    if (!caminhoDela) caminhoDela = host ? '/' : caminho();
    pesquisa = resto.indexOf('?') > -1 && (resto.indexOf('#') < 0 || resto.indexOf('?') < resto.indexOf('#'))
      ? resto.split('#')[0].slice(resto.indexOf('?') + 1) : '';
    chaves = [];
    partes = pesquisa ? pesquisa.split('&') : [];
    for (i = 0; i < partes.length; i++) {
      k = partes[i].split('=')[0];
      if (k && chaves.indexOf(k) < 0) chaves.push(k);
    }
    return 'a:' + host + caminhoDela + (chaves.length ? '?' + chaves.join('&') : '');
  }

  /* O descritor de um elemento: o que ele é, nunca o que diz. Uma ligação
     pelo destino sem valores (ligacao); um id com dígitos corta-se ao
     prefixo, que um id de registo não sai daqui.
     Recebe: el — o elemento.
     Devolve: o descritor, até 80 caracteres. */
  function descritor(el) {
    var tag = String(el.tagName || '').toLowerCase();
    var acao = el.getAttribute ? el.getAttribute('data-click') : null;
    var href = el.getAttribute ? el.getAttribute('href') : null;
    var id = el.id ? String(el.id).replace(/[-_]?[0-9].*$/, '') : '';
    var cls = String((el.getAttribute && el.getAttribute('class')) || '').replace(/^\s+/, '').split(/\s+/)[0];
    if (acao) return corta('click:' + acao, 80);
    if (tag === 'a' && href != null) return corta(ligacao(href), 80);
    if (id) return corta(tag + '#' + id, 80);
    if (cls) return corta(tag + '.' + cls, 80);
    return corta(tag, 80);
  }

  /* Uma posição em permilagem da janela.
     Recebe: v — a coordenada em px; total — a medida da janela em px.
     Devolve: o inteiro de 0 a 1000. */
  function permil(v, total) {
    return Math.max(0, Math.min(1000, Math.round((v / total) * 1000)));
  }

  /* Um clique em qualquer sítio: o toque, com o descritor e os sinais. Um
     clique de teclado (detail 0) não tem posição, e não conta para o repetido.
     Recebe: ev — o evento de clique.
     Devolve: nada. */
  function aoTocar(ev) {
    var el = ev.target;
    var util, w, h, comPosicao, agora, serie;
    if (el && el.nodeType !== 1) el = el.parentNode;
    if (!el || el.nodeType !== 1) return;
    util = interativo(el);
    w = largura();
    h = altura();
    comPosicao = ev.detail !== 0 && typeof ev.clientX === 'number' && w > 0 && h > 0;
    agora = Date.now();
    serie = 1;
    if (comPosicao && anterior && agora - anterior.t <= 1000 &&
        Math.sqrt(Math.pow(ev.clientX - anterior.x, 2) + Math.pow(ev.clientY - anterior.y, 2)) <= 24) {
      serie = anterior.serie + 1;
    }
    anterior = comPosicao ? { x: ev.clientX, y: ev.clientY, t: agora, serie: serie } : null;
    poe('toque', caminho(), descritor(util || el),
      comPosicao ? permil(ev.clientX, w) : null, comPosicao ? permil(ev.clientY, h) : null,
      serie >= 3 ? 'repetido' : (util ? null : 'em-vao'));
  }

  /* Despeja a fila no POST /rasto, em lotes de até 50. Um envio recusado
     perde-se: o rasto nunca insiste nem avisa.
     Devolve: nada. */
  function envia() {
    var corpo;
    while (fila.length) {
      corpo = JSON.stringify({ sessao: sessao, eventos: fila.splice(0, LOTE) });
      try {
        if (nav.sendBeacon) nav.sendBeacon('/rasto', corpo);
        else if (window.fetch) window.fetch('/rasto', { method: 'POST', body: corpo, keepalive: true, credentials: 'same-origin' });
      } catch (e) { /* o cliente nunca reage */ }
    }
  }

  /* A página escondeu-se (outro separador, o ecrã apagado): é muitas vezes a
     última ocasião de enviar num telemóvel, onde o pagehide pode não chegar.
     Devolve: nada. */
  function aoEsconder() {
    if (document.visibilityState === 'hidden') envia();
  }

  /* A página voltou da cache de avanço e recuo: conta como uma página aberta.
     Recebe: ev — o evento pageshow.
     Devolve: nada. */
  function aoVoltar(ev) {
    if (ev && ev.persisted) poe('pagina', caminho(), null, null, null, null);
  }

  /* As secções que entraram à vista: cada uma conta uma vez, e deixa de ser
     vigiada.
     Recebe: entradas — as IntersectionObserverEntry do observador.
     Devolve: nada. */
  function aoVer(entradas) {
    var i, alvo;
    for (i = 0; i < entradas.length; i++) {
      if (!entradas[i].isIntersecting) continue;
      alvo = entradas[i].target;
      if (vigia) vigia.unobserve(alvo);
      if (!alvo.id || vistas[alvo.id]) continue;
      vistas[alvo.id] = true;
      poe('secao', corta('#' + alvo.id, 40), null, null, null, null);
    }
  }

  /* Vigia as secções com id da página, para cada uma contar ao entrar à vista.
     Devolve: nada. */
  function vigiaSecoes() {
    var secoes, i;
    if (!window.IntersectionObserver || !document.querySelectorAll) return;
    vigia = new window.IntersectionObserver(aoVer, { rootMargin: '0px 0px -25% 0px' });
    secoes = document.querySelectorAll('main section[id]');
    for (i = 0; i < secoes.length; i++) vigia.observe(secoes[i]);
  }

  poe('pagina', caminho(), null, null, null, null);
  vigiaSecoes();
  document.addEventListener('click', aoTocar, true);
  document.addEventListener('visibilitychange', aoEsconder);
  window.addEventListener('pagehide', envia);
  window.addEventListener('pageshow', aoVoltar);
  window.setInterval(envia, CADA);
})();
`;
