/* ===== APRESENTAÇÃO DO DINHEIRO E DA AGENDA ===== */
/* As apresentações dos separadores do Dinheiro (Movimentos, Planeados,
   Créditos) e da Agenda (o Calendário). Cada uma regista-se em
   cloud/apresentacao.js:registarApresentacao ao carregar.

   Cada apresentação diz o que o separador é, como está arrumado — o que se
   vê, o que abre um toque, os três pontos, o segurar, o + e os filtros — e
   deixa uma dica. As imagens são a app em miniatura, feitas com o kit da
   apresentacao.js (aprCena, aprTela, aprLinha…) e com as peças próprias
   daqui (aprD…, a secção «apresentação: o Dinheiro e a Agenda (folha 1.4)»
   do estilos.css, classes .apr-d-). Os números são os do portefólio
   inventado (apresentacao.js:APR_EXEMPLO) e o que lhe falta para o
   dinheiro — a hipoteca por dentro, o movimento de todos os imóveis, as
   visitas — está no aprDExemplo. As datas contam-se a partir de hoje, para
   não envelhecerem, e só aparece num mês o que a app lá mostraria: um
   planeado já confirmado sai do dia dele e passa para o mês seguinte.

   O que só faz sentido a algumas contas leva o quando (o cargo, um serviço
   desligado), e os textos que mudam com isso são funções: quem só vê não
   lê como se cria, e um serviço desligado não aparece nos textos. */

'use strict';

/* ------------------------------------------------------------ o exemplo */

/* O que as maquetes do Dinheiro e da Agenda precisam além do portefólio da
   1.2 (APR_EXEMPLO), com os mesmos imóveis, contratos e rendas:
     hipoteca — a do T3 Bonfim (APR_EXEMPLO.creditos[0]) por dentro: o
       índice, a Euribor e o spread, e quantas prestações faltam; os juros
       até ao fim e a dívida de cada ano saem da conta da própria app
       (credito.js:amort), e a prestação é a do exemplo, 1 106,40 €;
     lote — uma despesa de todos os imóveis, partida pelos quatro ao guardar
       (movimento.js:partirMovimento), no dia 5 do mês;
     visitas — as três do T1 Cedofeita, que está vago: uma marcada no
       próximo dia com planeados, outra treze dias depois, e uma feita há
       seis dias;
     categorias — a categoria de cada planeado na lista, a da árvore de
       fábrica. */
var aprDExemplo = {
  hipoteca: { indice: '12m', euribor: 2.25, spread: 0.85, meses: 312, capitalInicio: 248000 },
  lote: { nome: 'Avença do contabilista', valor: -123, dia: 5 },
  visitas: [
    { nome: 'Rui Fonseca', imovel: 'cedofeita', inicio: '18:30', fim: '19:00' },
    { nome: 'Sofia Almeida', imovel: 'cedofeita', inicio: '10:00', fim: '10:30', diasAtras: 6 },
    { nome: 'Paulo Ventura', imovel: 'cedofeita', inicio: '17:00', fim: '17:30', depoisDoPainel: 13 },
  ],
  categorias: { contrato: 'Rendas', hipoteca: 'Crédito à habitação', condominio: 'Condomínio', imi: 'Impostos', mao: 'Limpeza e jardim' },
};
// o imposto do selo sobre os juros de uma prestação (a regra de fábrica, dados.js:STAMP)
var aprDSelo = 0.04;
// os meses por extenso e os dias da semana, como o Calendário os escreve (calendario.js:vCalendar, calendario.js:calTituloDia)
var aprDMesesLongos = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
var aprDSemana = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

/* --------------------------------------------------------------- as datas */

/* Um mês contado a partir do de hoje.
   Recebe: k — quantos meses andar (negativo para trás; 0 é o de hoje).
   Devolve: {y, m} — o ano e o mês (0 a 11). */
function aprDMes(k) {
  var h = today(), y = Number(h.slice(0, 4)), m = Number(h.slice(5, 7)) - 1 + (Number(k) || 0);
  y += Math.floor(m / 12);
  m = ((m % 12) + 12) % 12;
  return { y: y, m: m };
}

/* Um dia de um mês contado a partir do de hoje, preso ao último dia do mês
   (formato.js:dayInMonth: o dia 31 de novembro é o 30).
   Recebe: k — o mês (como no aprDMes); dia — o dia do mês.
   Devolve: a data em AAAA-MM-DD. */
function aprDNoMes(k, dia) {
  var x = aprDMes(k);
  return dayInMonth(x.y, x.m, dia);
}

/* O nome curto de um mês, como os títulos dos meses dos Movimentos
   (lista-movimentos.js:mesPt): «out 2026».
   Recebe: k — o mês (como no aprDMes).
   Devolve: o texto. */
function aprDMesCurto(k) {
  var x = aprDMes(k);
  return MES[x.m] + ' ' + x.y;
}

/* O mês por extenso, com a primeira letra grande, como o cartão do
   Calendário: «Novembro 2026».
   Recebe: k — o mês (como no aprDMes).
   Devolve: o texto. */
function aprDMesLongo(k) {
  var x = aprDMes(k), n = aprDMesesLongos[x.m];
  return n.charAt(0).toUpperCase() + n.slice(1) + ' ' + x.y;
}

/* O título do painel de um dia, como o calendario.js:calTituloDia o
   escreve: «Hoje, terça-feira 27/10», «Amanhã, …» ou «Domingo, 08/11» (com
   o ano só quando não é o de hoje).
   Recebe: iso — o dia, em AAAA-MM-DD.
   Devolve: o texto. */
function aprDTituloDia(iso) {
  var hoje = today(), dia = aprDSemana[new Date(iso + 'T00:00:00').getDay()];
  var curta = iso.slice(8, 10) + '/' + iso.slice(5, 7) + (iso.slice(0, 4) !== hoje.slice(0, 4) ? '/' + iso.slice(0, 4) : '');
  if (iso === hoje) return 'Hoje, ' + dia + ' ' + curta;
  if (iso === addDays(hoje, 1)) return 'Amanhã, ' + dia + ' ' + curta;
  return dia.charAt(0).toUpperCase() + dia.slice(1) + ', ' + curta;
}

/* ------------------------------------------------------ o dinheiro do exemplo */

/* O nome de um contrato do exemplo como a renda dele se chama («Renda Ana
   Ribeiro · Quarto 1», e só o nome num imóvel inteiro).
   Recebe: c — um contrato do APR_EXEMPLO.
   Devolve: o texto. */
function aprDRenda(c) {
  return 'Renda ' + c.inquilino + (c.parte && c.parte !== 'Imóvel inteiro' ? ' · ' + c.parte : '');
}

/* O ícone, o tom do quadrado e a cor do valor de um tipo de movimento, como
   na lista dos Movimentos (lista-movimentos.js:txTomDoTipo): a receita a
   verde, a despesa a laranja, a prestação a roxo.
   Recebe: tipo — 'income', 'expense' ou 'loan'.
   Devolve: {icone, tomIcone, tom}. */
function aprDTomDo(tipo) {
  if (tipo === 'income') return { icone: 'up', tomIcone: 'in', tom: 'pos' };
  if (tipo === 'loan') return { icone: 'bank', tomIcone: 'loan', tom: 'prest' };
  return { icone: 'dn', tomIcone: 'out', tom: 'neg' };
}

/* Um valor de movimento com o sinal à frente, como a linha da lista: o +
   no que entra, o − (formato.js:money) no que sai.
   Recebe: v — euros, com sinal.
   Devolve: o texto. */
function aprDSinal(v) {
  return (Number(v) > 0 ? '+' : '') + aprDinheiro(v);
}

/* Os movimentos registados num mês do exemplo, do dia mais recente para o
   mais antigo (a ordem da lista): as cinco rendas (2 425 €), a prestação da
   hipoteca, a avença de todos os imóveis e os condomínios do dia 1.
   Recebe: k — o mês (como no aprDMes; os Movimentos mostram o último fechado, -1).
   Devolve: [{data, titulo, onde, valor, tipo, lote}] — lote, nos de todos os imóveis, é por quantos se partiu. */
function aprDMovimentosDoMes(k) {
  var ex = APR_EXEMPLO, h = ex.creditos[0], L = aprDExemplo.lote, out = [];
  out.push({ dia: h.dia, titulo: 'Prestação ' + h.nome + ' · ' + ex.imovel(h.imovel).nome, onde: ex.imovel(h.imovel).nome, valor: -h.prestacao, tipo: 'loan' });
  ex.contratos.forEach(function (c) { out.push({ dia: c.dia, titulo: aprDRenda(c), onde: ex.imovel(c.imovel).nome, valor: c.renda, tipo: 'income' }); });
  out.push({ dia: L.dia, titulo: L.nome, onde: 'Todos os imóveis · ' + ex.imoveis.length + ' imóveis', valor: L.valor, tipo: 'expense', lote: ex.imoveis.length });
  ex.imoveis.forEach(function (p) { if (p.condominio) out.push({ dia: 1, titulo: 'Condomínio · ' + p.nome, onde: p.nome, valor: -p.condominio, tipo: 'expense' }); });
  return out.map(function (x, i) { return Object.assign(x, { data: aprDNoMes(k, x.dia), ordem: i }); })
    .sort(function (a, b) { return b.dia - a.dia || a.ordem - b.ordem; });
}

/* A linha de um movimento na lista: o quadrado do ícone na cor do tipo, o
   título, a linha curta «dd/mm · onde», a frase de um movimento partido
   («dividido por 4 imóveis», lista-movimentos.js:fraseDoLoteNaLista) e o
   valor com o sinal.
   Recebe: m — um movimento do aprDMovimentosDoMes; o (opcional) — {alvo}.
   Devolve: o HTML. */
function aprDLinhaMov(m, o) {
  var t = aprDTomDo(m.tipo);
  return aprLinha({ icone: t.icone, tomIcone: t.tomIcone, titulo: m.titulo, sub: aprData(m.data) + ' · ' + m.onde,
    sub2: m.lote ? 'dividido por ' + m.lote + ' imóveis' : '', valor: aprDSinal(m.valor), tom: t.tom, alvo: o && o.alvo });
}

/* Os planeados do exemplo, um por molde, como os Planeados os têm: a renda
   de cada contrato, a prestação da hipoteca, o condomínio de cada imóvel e
   o IMI nas prestações da lei (planeados.js:imiPrestacoes, com os
   Planeados ligados), e a limpeza criada à mão. A renda do Tomás Matos e a
   limpeza deste mês ficaram por confirmar; o resto do que já passou está
   confirmado, e o planeado passou para a vez seguinte.
   Devolve: [{nome, imovel, dia, anual, mes, valor, tipo, origem, categoria, pendente}] —
   anual com o mês (0 a 11) do IMI; origem 'contrato', 'hipoteca', 'imovel' ou 'mao'. */
function aprDPlaneados() {
  var ex = APR_EXEMPLO, cat = aprDExemplo.categorias, out = [];
  ex.contratos.forEach(function (c) {
    out.push({ nome: aprDRenda(c), imovel: c.imovel, dia: c.dia, valor: c.renda, tipo: 'income', origem: 'contrato', categoria: cat.contrato, pendente: !!c.atraso });
  });
  ex.creditos.forEach(function (h) {
    out.push({ nome: 'Prestação ' + h.nome + ' · ' + ex.imovel(h.imovel).nome, imovel: h.imovel, dia: h.dia, valor: -h.prestacao, tipo: 'loan', origem: 'hipoteca', categoria: cat.hipoteca });
  });
  ex.imoveis.forEach(function (p) {
    if (p.condominio) out.push({ nome: 'Condomínio · ' + p.nome, imovel: p.id, dia: 1, valor: -p.condominio, tipo: 'expense', origem: 'imovel', categoria: cat.condominio });
    var imi = typeof imiPrestacoes === 'function' ? imiPrestacoes(p.imi) : [];
    imi.forEach(function (x) {
      out.push({ nome: 'IMI · ' + p.nome + (imi.length > 1 ? ' (' + x.n + '.ª de ' + imi.length + ')' : ''), imovel: p.id, dia: 31, anual: true, mes: x.mes - 1,
        valor: -x.amount, tipo: 'expense', origem: 'imovel', categoria: cat.imi });
    });
  });
  ex.aMao.forEach(function (m) {
    out.push({ nome: m.nome, imovel: m.imovel, dia: m.dia, valor: m.valor, tipo: 'expense', origem: 'mao', categoria: cat.mao, pendente: true });
  });
  return out;
}

/* A próxima data de um planeado do exemplo: a deste mês, se está por
   confirmar; senão a próxima vez que o dia chega (apresentacao.js:aprProximoDia),
   e no IMI o fim do mês da prestação dele, este ano ou no próximo.
   Recebe: r — um planeado do aprDPlaneados.
   Devolve: a data em AAAA-MM-DD. */
function aprDProxima(r) {
  if (r.pendente) return aprDNoMes(0, r.dia);
  if (!r.anual) return aprProximoDia(r.dia);
  var y = Number(today().slice(0, 4)), d = dayInMonth(y, r.mes, 31);
  return d > today() ? d : dayInMonth(y + 1, r.mes, 31);
}

/* Um planeado do exemplo já passou do dia sem confirmação (em atraso): a
   data dele é anterior a hoje (planeados.js:recIsLate, sem janela).
   Recebe: r — um planeado do aprDPlaneados.
   Devolve: true/false. */
function aprDEmAtraso(r) { return !!r.pendente && aprDProxima(r) < today(); }

/* O que está por confirmar no exemplo, os em atraso primeiro.
   Devolve: os planeados (array), pela ordem do cartão «Por confirmar». */
function aprDPendentes() {
  return aprDPlaneados().filter(function (r) { return r.pendente; })
    .sort(function (a, b) { return (aprDEmAtraso(b) ? 1 : 0) - (aprDEmAtraso(a) ? 1 : 0); });
}

/* As ocorrências dos planeados num mês, como o Calendário as expande a
   partir da próxima data de cada um, com o passo dele
   (calendario.js:calPlaneados): as que estão por confirmar ficam no dia
   delas, e as que vêm a caminho também; uma já confirmada passou para a vez
   seguinte, e o dia dela deste mês fica sem ponto.
   Recebe: k (opcional) — o mês (como no aprDMes; 0, o de hoje, por omissão).
   Devolve: [{data, r}] — r o planeado do aprDPlaneados. */
function aprDPlaneadosDoMes(k) {
  var mes = aprDNoMes(k || 0, 1).slice(0, 7), out = [];
  aprDPlaneados().forEach(function (r) {
    var prox = aprDProxima(r), d = r.anual ? prox : aprDNoMes(k || 0, r.dia);
    if (d.slice(0, 7) === mes && d >= prox) out.push({ data: d, r: r });
  });
  return out;
}

/* O mês que o cartão do Calendário mostra na primeira imagem: o de hoje,
   enquanto há mais mês do que o que já passou; da segunda quinzena em
   diante o seguinte — o de hoje já tem quase tudo confirmado e ficava
   quase sem pontos —, como quem já deslizou o mês, com o «Hoje» à vista.
   Devolve: o mês (como no aprDMes): 0 ou 1. */
function aprDMesDoCalendario() {
  return Number(today().slice(8, 10)) <= 15 ? 0 : 1;
}

/* O dia que o painel do Calendário mostra na segunda imagem: o próximo em
   que chega um planeado do exemplo (a renda do Tiago Lopes a 5, a da Marta
   Sousa a 8 ou a prestação a 15), e é nesse dia que a visita está marcada.
   Devolve: a data em AAAA-MM-DD (depois de hoje). */
function aprDDiaDoPainel() {
  return [5, 8, 15].map(aprProximoDia).sort()[0];
}

/* As visitas do exemplo, com a data e o estado: a do Rui Fonseca no dia do
   painel e a do Paulo Ventura treze dias depois (marcadas), a da Sofia
   Almeida há seis dias (feita).
   Devolve: [{nome, imovel, data, inicio, fim, estado}] — estado o rótulo de visitas.js:VESTADO. */
function aprDVisitas() {
  return aprDExemplo.visitas.map(function (v) {
    var data = v.diasAtras ? aprDia(-v.diasAtras) : addDays(aprDDiaDoPainel(), v.depoisDoPainel || 0);
    return { nome: v.nome, imovel: v.imovel, data: data, inicio: v.inicio, fim: v.fim, estado: data < today() ? 'Realizada' : 'Agendada' };
  });
}

/* A hipoteca do exemplo como a app a guarda (dados.js:normLoan), para as
   contas da própria app: o plano, os juros e o selo até ao fim e a dívida
   de cada ano (credito.js:amort), e a taxa por extenso (credito.js:rateLabel).
   Devolve: a hipoteca. */
function aprDHipoteca() {
  var h = APR_EXEMPLO.creditos[0], d = aprDExemplo.hipoteca;
  return normLoan({ id: 'aprDh1', name: h.nome, type: 'variavel', index: d.indice, euribor: d.euribor, spread: d.spread,
    outstanding: h.divida, years: d.meses / 12, stampTax: true });
}

/* A prestação do exemplo por dentro: os juros do mês sobre o que se deve,
   o selo sobre os juros, e o resto é capital — o que o pagamento abate.
   Devolve: {juros, selo, capital, depois} — euros; depois é o capital em dívida a seguir. */
function aprDPrestacao() {
  var h = APR_EXEMPLO.creditos[0], d = aprDExemplo.hipoteca;
  var juros = r2(h.divida * (d.euribor + d.spread) / 100 / 12), selo = r2(juros * aprDSelo), capital = r2(h.prestacao - juros - selo);
  return { juros: juros, selo: selo, capital: capital, depois: r2(h.divida - capital) };
}

/* A dívida da hipoteca do exemplo no fim de cada ano, do de hoje até ao
   último (como creditos.js:credDividaPorAno), e os juros e o selo até ao
   fim — a conta da app (credito.js:amort), com a primeira prestação no
   próximo dia 15.
   Devolve: {anos, somas, juros} — os anos (números), a dívida no fim de cada um e os juros e o selo até ao fim. */
function aprDPlano() {
  var a = amort(aprDHipoteca()), d0 = aprProximoDia(APR_EXEMPLO.creditos[0].dia);
  var y = Number(d0.slice(0, 4)), m = Number(d0.slice(5, 7)) - 1, fim = {};
  a.rows.forEach(function (r) { fim[y] = r.bal; m++; if (m > 11) { m = 0; y++; } });
  var ano = Number(today().slice(0, 4)), ultimo = Math.max.apply(null, Object.keys(fim).map(Number)), anos = [], somas = [];
  for (var x = ano; x <= ultimo; x++) { anos.push(x); somas.push(fim[x] != null ? fim[x] : APR_EXEMPLO.creditos[0].divida); }
  return { anos: anos, somas: somas, juros: a.totInt + a.totStamp };
}

/* --------------------------------------------------------- as peças próprias */

/* Os totais dos Movimentos em miniatura (o kpi compacto da lista,
   estilos.css:.mov-tot): os cartões lado a lado, a cortar no fim, como no
   telemóvel, onde a fila corre de lado.
   Recebe: itens — [[rótulo, valor já escrito, tom ('pos', 'neg', 'prest' ou '')]].
   Devolve: o HTML. */
function aprDTotais(itens) {
  return '<div class="apr-d-kpis">' + (itens || []).map(function (x) {
    return '<span class="apr-d-kpi"><span>' + esc(x[0]) + '</span><b' + (x[2] ? ' class="' + esc(x[2]) + '"' : '') + '>' + esc(x[1]) + '</b></span>';
  }).join('') + '</div>';
}

/* O título de um mês da lista dos Movimentos: o mês à esquerda e o saldo à
   direita, com o número na cor do dinheiro (lista-movimentos.js:txMesHtml).
   Recebe: k — o mês (como no aprDMes); saldo — euros, com sinal.
   Devolve: o HTML. */
function aprDMesTitulo(k, saldo) {
  var tom = saldo > 0 ? 'pos' : saldo < 0 ? 'neg' : '';
  return '<div class="apr-d-mes"><b>' + esc(aprDMesCurto(k)) + '</b><span>saldo <b class="apr-m-valor' + (tom ? ' ' + tom : '') + '">' +
    esc(aprDSinal(saldo)) + '</b></span></div>';
}

/* A pesquisa com texto escrito e o funil com quantos filtros estão ligados
   (lista-movimentos.js:txBarraHtml) — o aprPesquisa do kit com o número.
   Recebe: texto — o que está escrito; n — os filtros ligados (0: sem número); alvo — o funil em destaque.
   Devolve: o HTML. */
function aprDPesquisa(texto, n, alvo) {
  return '<div class="apr-m-pesq"><span class="apr-m-pesq-campo">' + esc(texto) + '</span>' +
    '<span class="apr-m-funil apr-d-funil' + (alvo ? ' apr-alvo' : '') + '">' + ic('filter', 13) + (n ? '<b class="apr-d-funil-n">' + esc(n) + '</b>' : '') + '</span></div>';
}

/* Uma fila de chips de filtro, como a dos Movimentos (lista-movimentos.js:txChipsHtml):
   desligado diz o nome do filtro; ligado diz o valor, com o contorno e o
   texto no --accent e o × que o limpa. Numa linha só, que corta no fim: no
   telemóvel a fila corre de lado.
   Recebe: itens — [[texto, ligado]].
   Devolve: o HTML. */
function aprDChips(itens) {
  return '<div class="apr-m-chips apr-d-fila">' + (itens || []).map(function (x) {
    return '<span class="apr-m-chip' + (x[1] ? ' on' : '') + '">' + esc(x[0]) + (x[1] ? '<i class="apr-d-chip-x">' + ic('x', 9) + '</i>' : '') + '</span>';
  }).join('') + '</div>';
}

/* Uma ficha em miniatura: a janela de um registo, com os três pontos das
   opções e o ✕ na cabeça e, se vier, o rodapé com os botões (o Fechar e o
   primário da ficha: componentes.js:abrirFicha).
   Recebe: titulo — o texto; html — o corpo; o (opcional) — {pontos: verdade para os três pontos,
   pe: o HTML dos botões do rodapé, flutua, alvo}.
   Devolve: o HTML. */
function aprDFicha(titulo, html, o) {
  o = o || {};
  return '<div class="apr-m-folha' + (o.flutua ? ' apr-flutua' : '') + (o.alvo ? ' apr-alvo' : '') + '">' +
    '<div class="apr-m-folha-cab"><b>' + esc(titulo) + '</b><span class="apr-d-folha-ic">' + (o.pontos ? ic('dots', 12) : '') + ic('x', 12) + '</span></div>' +
    '<div class="apr-m-folha-corpo">' + (html || '') + '</div>' +
    (o.pe ? '<div class="apr-d-folha-pe">' + o.pe + '</div>' : '') + '</div>';
}

/* Uma linha de uma lista em seleção: a caixa marcada (cheia, com o visto) e
   o realce da linha marcada — o fundo suave e o contorno no --accent, que é
   da frente e o escurecimento forçado do Samsung não apaga
   (cloud/selecao.js:selPintar).
   Recebe: linha — o HTML da linha (um aprLinha).
   Devolve: o HTML. */
function aprDMarcada(linha) {
  return '<div class="apr-d-marcada"><span class="apr-d-caixa">' + ic('check', 10) + '</span>' + linha + '</div>';
}

/* A barra das ações da seleção dos Movimentos no telemóvel
   (cloud/selecao.js:selBarraHtml): em cima o Cancelar, quantos estão
   marcados e quanto somam; em baixo os botões, cada um com o ícone por
   cima do rótulo curto, e o Apagar a vermelho.
   Recebe: n — quantos estão marcados; soma — euros, com sinal; botoes — [[ícone, rótulo, perigo]].
   Devolve: o HTML. */
function aprDBarraSelecao(n, soma, botoes) {
  return '<div class="apr-d-sel apr-flutua"><div class="apr-d-sel-topo"><span class="apr-m-botao pequeno">' + ic('x', 11) + 'Cancelar</span>' +
      '<span class="apr-d-sel-n"><b>' + esc(n + (n === 1 ? ' selecionado' : ' selecionados')) + '</b><span class="apr-m-sub">somam ' + esc(aprDinheiro(soma)) + '</span></span></div>' +
    '<div class="apr-d-sel-acoes">' + (botoes || []).map(function (b) {
      return '<span class="apr-d-sel-b' + (b[2] ? ' perigo' : '') + '">' + ic(b[0], 12) + '<span>' + esc(b[1]) + '</span></span>';
    }).join('') + '</div></div>';
}

/* Os três pontos das opções, desenhados (componentes.js:menu).
   Devolve: o HTML. */
function aprDPontos() { return '<span class="apr-d-pontos">' + ic('dots', 13) + '</span>'; }

/* Uma linha do cartão «Por confirmar» (planeados.js:pendLinha): o nome, de
   onde é e quando, o valor com o selo do estado e, por baixo, Confirmar,
   Rever e os três pontos.
   Recebe: r — um planeado do aprDPlaneados; alvo — o Confirmar em destaque.
   Devolve: o HTML. */
function aprDPendLinha(r, alvo) {
  var ex = APR_EXEMPLO, t = aprDTomDo(r.tipo), atraso = aprDEmAtraso(r);
  return '<div class="apr-d-pend">' +
    aprLinha({ titulo: r.nome, sub: ex.imovel(r.imovel).nome + ' · ' + aprData(aprDProxima(r)), valor: aprDinheiro(r.valor), tom: t.tom,
      botao: atraso ? aprSelo('Em atraso', 'red') : aprSelo('Por confirmar') }) +
    '<span class="apr-d-acoes">' + aprBotao('Confirmar', { primario: true, pequeno: true, icone: 'check', alvo: alvo }) + aprBotao('Rever', { pequeno: true }) + aprDPontos() + '</span></div>';
}

/* O cartão «Por confirmar» (planeados.js:pendingCard; o da Agenda,
   calendario.js:calPendCard, é o mesmo): a cabeça com quantos estão em
   atraso, o total com o sinal das linhas e quantos esperam; aberto, as
   linhas por baixo.
   Recebe: o — {aberto: verdade para as linhas, alvo: o Confirmar da primeira em destaque,
   agenda: verdade para a cabeça da Agenda — o número na cor do crachá, sem o total —,
   alvoCartao: o cartão inteiro em destaque}.
   Devolve: o HTML. */
function aprDCartaoPend(o) {
  o = o || {};
  var pend = aprDPendentes(), n = pend.length, nl = pend.filter(aprDEmAtraso).length;
  var total = r2(pend.reduce(function (s, r) { return s + r.valor; }, 0));
  var cab = '<span class="apr-d-pend-cab' + (o.aberto ? ' aberto' : '') + '"><b>Por confirmar</b>' + (nl ? aprSelo(nl + ' em atraso', 'red') : '') +
    (o.agenda ? '<b class="apr-d-pend-n">' + n + '</b>' : '<b class="apr-m-valor ' + (total < 0 ? 'neg' : 'pos') + '">' + esc(aprDinheiro(total)) + '</b>') +
    ic('chevD', 12) + '</span>' +
    '<span class="apr-m-sub apr-d-pend-sub">' + esc(o.agenda ? n + (n === 1 ? ' planeado à espera' : ' planeados à espera') : n + ' à espera') + (o.aberto ? '' : ' · toca para ver') + '</span>';
  return aprCartao(cab + (o.aberto ? pend.map(function (r, k) { return aprDPendLinha(r, !!o.alvo && k === 0); }).join('') : ''),
    { flutua: true, alvo: !!o.alvoCartao });
}

/* A faixa de quem vem de trás (planeados.js:recRetroFaixa), com a limpeza
   das escadas do exemplo, criada à mão a contar de três meses atrás: o que
   falta (planeados.js:recRetroMeses, com os Planeados ligados), quanto se
   regista e com que etiqueta, «Registar os 3» e «Agora não».
   Recebe: alvo — o «Registar os 3» em destaque.
   Devolve: o HTML. */
function aprDRetro(alvo) {
  var m = APR_EXEMPLO.aMao[0], v = Math.abs(m.valor), datas = [-3, -2, -1].map(function (k) { return aprDNoMes(k, m.dia); });
  var falta = typeof recRetroMeses === 'function' ? recRetroMeses(datas, 'month') : 'faltam ' + datas.length + ' meses';
  return '<div class="apr-d-retro"><b>«' + esc(m.nome) + '» vem de trás</b>' +
    '<span>Começa a ' + esc(dPT(datas[0])) + ': ' + esc(falta) + '. Registamos ' + datas.length + ' movimentos de ' + esc(aprDinheiro(v)) +
      ' (' + esc(aprDinheiro(v * datas.length)) + '), com a etiqueta «Estimativa»?</span>' +
    '<span class="apr-d-retro-acoes">' + aprBotao('Registar os ' + datas.length, { primario: true, pequeno: true, alvo: alvo }) + aprBotao('Agora não', { pequeno: true }) + '</span></div>';
}

/* O cabeçalho de uma secção com um botão de texto à direita (o «Modelos»
   com o «Novo modelo», o «Ativas» com o «Nova hipoteca»: os .plan-cab).
   Recebe: titulo — o texto; botao — o rótulo do botão ('' sem botão); alvo — o botão em destaque.
   Devolve: o HTML. */
function aprDCabecaSecao(titulo, botao, alvo) {
  return '<div class="apr-d-cab"><b>' + esc(titulo) + '</b>' + (botao ? '<span class="apr-m-botao pequeno apr-d-fantasma' + (alvo ? ' apr-alvo' : '') + '">' + esc(botao) + '</span>' : '') + '</div>';
}

/* O resumo dos Créditos no telemóvel (creditos.js:credResumo): o cartão
   azul-noite com o que se deve, as prestações do mês, os juros e o selo
   até ao fim e as barras da dívida no fim de cada ano, a deste ano acesa e
   lida por cima.
   Devolve: o HTML. */
function aprDResumoCredito() {
  var h = APR_EXEMPLO.creditos[0], p = aprDPlano(), n = p.anos.length;
  return '<div class="apr-d-cred">' +
    '<span class="apr-d-cred-rot">Em dívida · 1 hipoteca ativa</span><b class="apr-d-cred-v">' + esc(money(h.divida)) + '</b>' +
    '<span class="apr-d-cred-par"><span><span class="apr-d-cred-rot">Prestações</span><b>' + esc(aprDinheiro(h.prestacao)) + '<small>/mês</small></b></span>' +
      '<span><span class="apr-d-cred-rot">Juros e selo até ao fim</span><b>' + esc(money(p.juros)) + '</b></span></span>' +
    '<span class="apr-d-cred-leitura"><b>' + p.anos[0] + '</b>' + esc(money(p.somas[0])) + '</span>' +
    aprBarras(p.somas, { aceso: 0 }) +
    '<span class="apr-d-cred-eixo"><span>' + p.anos[0] + '</span><span>Dívida no fim de cada ano</span><span>' + p.anos[n - 1] + '</span></span></div>';
}

/* O cartão da hipoteca do exemplo (creditos.js:credCartao): o nome e o
   imóvel, o selo do tipo de taxa, a taxa por extenso, a prestação, o
   capital em dívida com as prestações por pagar, a barra do capital do
   início já pago e, no telemóvel, Pagamento e Plano.
   Recebe: o (opcional) — {pagar: verdade para o botão Pagamento, alvo: o Plano em destaque, flutua}.
   Devolve: o HTML. */
function aprDCartaoHipoteca(o) {
  o = o || {};
  var ex = APR_EXEMPLO, h = ex.creditos[0], l = aprDHipoteca(), ja = (aprDExemplo.hipoteca.capitalInicio - h.divida) / aprDExemplo.hipoteca.capitalInicio * 100;
  return aprCartao('<span class="apr-d-hp-cab"><span><b>' + esc(h.nome) + '</b><span class="apr-m-sub">' + esc(ex.imovel(h.imovel).nome) + '</span></span>' + aprSelo(h.taxa, 'loan') + '</span>' +
    '<span class="apr-m-sub">' + esc(rateLabel(l)) + '</span>' +
    '<span class="apr-d-hp-nums"><span><span class="apr-m-sub">Prestação</span><b>' + esc(aprDinheiro(h.prestacao)) + '<small>/mês</small></b></span>' +
      '<span><span class="apr-m-sub">Em dívida</span><b>' + esc(money(h.divida)) + '</b><span class="apr-m-sub">' + aprDExemplo.hipoteca.meses + ' prestações por pagar</span></span></span>' +
    aprProgresso(ja, { tom: 'loan' }) +
    '<span class="apr-d-hp-acoes">' + (o.pagar ? aprBotao('Pagamento') : '') + aprBotao('Plano', { alvo: o.alvo }) + '</span>', { flutua: o.flutua, classe: 'apr-d-hp' });
}

/* O cartão do mês do Calendário (calendario.js:vCalendar): as setas, o nome
   do mês com quantas visitas e quantos planeados tem, os dias da semana e a
   grelha de segunda a domingo — os dos meses vizinhos esbatidos, hoje a
   cheio, um ponto azul nos dias com visitas e um laranja nos dias com
   planeados — e a legenda; num mês que não é o de hoje, o «Hoje» ao lado
   da seta, para voltar. Cada serviço desligado leva os seus pontos.
   Recebe: k — o mês (como no aprDMes).
   Devolve: o HTML. */
function aprDCalendarioMes(k) {
  var comV = servicoLigado('visits'), comP = servicoLigado('recurring'), hoje = today(), x = aprDMes(k), mes = aprDNoMes(k, 1).slice(0, 7);
  var vis = comV ? aprDVisitas().filter(function (v) { return v.data.slice(0, 7) === mes; }) : [];
  var pla = comP ? aprDPlaneadosDoMes(k) : [];
  var tem = function (lista, iso) { return lista.some(function (e) { return e.data === iso; }); };
  var dias = new Date(x.y, x.m + 1, 0).getDate(), antes = (new Date(x.y, x.m, 1).getDay() + 6) % 7, ultimoAntes = new Date(x.y, x.m, 0).getDate();
  var cel = '';
  for (var i = antes; i > 0; i--) cel += '<span class="apr-d-dia fora"><b>' + (ultimoAntes - i + 1) + '</b><span class="apr-d-pts"></span></span>';
  for (var d = 1; d <= dias; d++) {
    var iso = dayInMonth(x.y, x.m, d);
    cel += '<span class="apr-d-dia' + (iso === hoje ? ' hoje' : '') + '"><b>' + d + '</b><span class="apr-d-pts">' +
      (tem(vis, iso) ? '<i class="apr-d-pt vis"></i>' : '') + (tem(pla, iso) ? '<i class="apr-d-pt pla"></i>' : '') + '</span></span>';
  }
  for (var j = 1; j <= (7 - (antes + dias) % 7) % 7; j++) cel += '<span class="apr-d-dia fora"><b>' + j + '</b><span class="apr-d-pts"></span></span>';
  var contas = [comV ? vis.length + (vis.length === 1 ? ' visita' : ' visitas') : '', comP ? pla.length + (pla.length === 1 ? ' planeado' : ' planeados') : ''].filter(Boolean).join(' · ');
  return aprCartao('<span class="apr-d-cal-nav">' + ic('chev', 12) + '<span><b>' + esc(aprDMesLongo(k)) + '</b>' + (contas ? '<span class="apr-m-sub">' + esc(contas) + '</span>' : '') + '</span>' +
      (k ? aprBotao('Hoje', { pequeno: true }) : '') + ic('chevR', 12) + '</span>' +
    '<span class="apr-d-cal-sem">' + ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'].map(function (s) { return '<span>' + s + '</span>'; }).join('') + '</span>' +
    '<span class="apr-d-cal-dias">' + cel + '</span>' +
    '<span class="apr-d-cal-leg">' + (comV ? '<span><i class="apr-d-pt vis"></i>Visitas</span>' : '') + (comP ? '<span><i class="apr-d-pt pla"></i>Planeados</span>' : '') + '</span>',
    { flutua: true, classe: 'apr-d-cal' });
}

/* O painel de um dia do Calendário (calendario.js:calDiaPanel): o título,
   num cartão as visitas (a hora, quem, onde, o estado) e os planeados (o
   sentido do dinheiro, o nome, de onde é e o passo, o valor) — ou «Nada
   marcado para este dia.» —, e os botões Marcar visita e Recorrente. Cada
   serviço desligado leva o que é dele.
   Recebe: iso — o dia; o (opcional) — {alvo: o Marcar visita em destaque, plano: verdade para o cartão sem sombra}.
   Devolve: o HTML (o título, o cartão e os botões, um a seguir ao outro). */
function aprDPainelDia(iso, o) {
  o = o || {};
  var ex = APR_EXEMPLO, comV = servicoLigado('visits'), comP = servicoLigado('recurring'), planear = aprPodeCriar('recurring', 'rec.add');
  var vs = comV ? aprDVisitas().filter(function (v) { return v.data === iso; }) : [];
  var ps = comP ? aprDPlaneados().map(function (r) { return { data: aprDProxima(r), r: r }; }).filter(function (e) { return e.data === iso; }) : [];
  var corpo = (vs.length ? '<span class="apr-m-rot apr-m-maiusc">Visitas</span>' + vs.map(function (v) {
      return '<div class="apr-m-linha com-lado"><span class="apr-d-hora"><b>' + esc(v.inicio) + '</b><span class="apr-m-sub">' + esc(v.fim) + '</span></span>' +
        '<span class="apr-m-linha-txt"><b>' + esc(v.nome) + '</b><span class="apr-m-sub">' + esc(ex.imovel(v.imovel).nome) + '</span></span>' +
        aprSelo(v.estado, v.estado === 'Realizada' ? 'in' : '') + '</div>';
    }).join('') : '') +
    (ps.length ? '<span class="apr-m-rot apr-m-maiusc">Planeados</span>' + ps.map(function (e) {
      var t = aprDTomDo(e.r.tipo);
      return aprLinha({ icone: t.icone, tomIcone: t.tomIcone, titulo: e.r.nome, sub: ex.imovel(e.r.imovel).nome + ' · ' + (e.r.anual ? 'anual' : 'mensal'),
        valor: aprDinheiro(e.r.valor), tom: t.tom });
    }).join('') : '') +
    (!vs.length && !ps.length ? '<span class="apr-m-sub apr-d-nada">Nada marcado para este dia.</span>' : '');
  var botoes = (comV ? aprBotao('Marcar visita', { icone: 'door', alvo: o.alvo }) : '') + (planear ? aprBotao('Recorrente', { icone: 'repetir' }) : '');
  return '<b class="apr-d-dia-tit">' + esc(aprDTituloDia(iso)) + '</b>' + aprCartao(corpo, { flutua: !o.plano, classe: 'apr-d-dia-cartao' }) +
    (botoes ? '<span class="apr-d-dia-acoes' + (comV && planear ? '' : ' um') + '">' + botoes + '</span>' : '');
}

/* A barra de baixo com o crachá de um destino (o número na cor do
   navegacao.js:buildTabbar, estilos.css:.tabbar a .cnt): a do kit
   (apresentacao.js:aprBarra), com o número pendurado no ícone do destino
   aceso. Pode subir ao kit.
   Recebe: ativo — o destino aceso ('agenda'…); n — o número.
   Devolve: o HTML. */
function aprDBarraComCracha(ativo, n) {
  return aprBarra(ativo).replace('<div class="apr-m-barra">', '<div class="apr-m-barra apr-d-barra">')
    .replace('<span class="apr-m-barra-i on">', '<span class="apr-m-barra-i on"><b class="apr-d-cracha">' + esc(n) + '</b>');
}

/* O ecrã do telemóvel (apresentacao.js:aprTela) com o cabeçalho de cada
   separador: o kit desenha o sino e o «Selecionar vários» à direita, e nos
   Movimentos e nos Planeados está só o «Selecionar vários»; nos Créditos e
   no Calendário, nada (não há o que selecionar). Pode subir ao kit, como um
   campo do aprTela.
   Recebe: o — o do aprTela; direita — o HTML à direita do título ('' sem nada).
   Devolve: o HTML. */
function aprDTela(o, direita) {
  return aprTela(o).replace(aprCabeca(o.titulo), aprCabeca(o.titulo, { direita: direita }));
}

// o «Selecionar vários» do cabeçalho dos Movimentos e dos Planeados (icones.js:caixaVisto)
var aprDSelecionar = ic('caixaVisto', 14);

/* ----------------------------------------------------------- os Movimentos */

/* Quantos meses do ano do exemplo já fecharam: os de janeiro até ao mês
   passado, nos meses da montra (APR_EXEMPLO.receitaMes); em janeiro, ou num
   ano para lá deles, todos os que lá estão.
   Devolve: o número (1 ou mais). */
function aprDMesesFechados() {
  var x = aprDMes(-1), max = APR_EXEMPLO.receitaMes.length;
  return x.y === Number(today().slice(0, 4)) ? Math.max(1, Math.min(max, x.m + 1)) : max;
}

/* Os Movimentos: os totais do ano até ao mês passado (Receitas, Despesas,
   Prestações e o Saldo, que a fila corta), e o último mês fechado — o
   título com o saldo (o dos meses da montra) e as linhas, da mais recente
   para a mais antiga.
   Devolve: o HTML da imagem. */
function aprDMovimentosLista() {
  var ex = APR_EXEMPLO, n = aprDMesesFechados(), soma = function (a) { return a.slice(0, n).reduce(function (s, v) { return s + v; }, 0); };
  var rec = soma(ex.receitaMes), desp = soma(ex.despesaMes), prest = r2(ex.prestacaoMes * n);
  var saldoMes = r2(ex.receitaMes[n - 1] - ex.despesaMes[n - 1] - ex.prestacaoMes);
  var linhas = aprDMovimentosDoMes(-1).slice(0, 5).map(function (m) { return aprDLinhaMov(m); }).join('');
  return aprCena(aprDTela({ titulo: 'Dinheiro', abas: APR_ABAS_DINHEIRO, aba: 'Movimentos', barra: 'dinheiro',
    corpo: aprSurge(aprDTotais([['Receitas', money(rec), 'pos'], ['Despesas', money(desp), 'neg'], ['Prestações', money(prest), 'prest'],
        ['Saldo · ' + aprDMovimentosDoMes(-1).length * n + ' movimentos', money(rec - desp - prest), '']]), 0) +
      aprSurge(aprDMesTitulo(-1, saldoMes) + aprCartao(linhas), 1) }, aprDSelecionar), { tom: 't0', arranjo: 'tela' });
}

/* Os filtros dos Movimentos: «condomínio» escrito na pesquisa, o funil com
   os dois filtros ligados, os chips do período (o ano) e do tipo
   (Despesas) ligados, com o ×, os do imóvel e da categoria por ligar e o
   «Limpar»; por baixo, só os condomínios do último mês fechado.
   Devolve: o HTML da imagem. */
function aprDMovimentosFiltros() {
  var ms = aprDMovimentosDoMes(-1).filter(function (m) { return /^Condomínio/.test(m.titulo); });
  var saldo = r2(ms.reduce(function (a, m) { return a + m.valor; }, 0));
  return aprCena(aprDTela({ titulo: 'Dinheiro', abas: APR_ABAS_DINHEIRO, aba: 'Movimentos', barra: 'dinheiro',
    corpo: aprDPesquisa('condomínio', 2, true) + aprDChips([[String(aprDMes(-1).y), true], ['Despesas', true], ['Imóvel'], ['Categoria'], ['Limpar']]) +
      aprDMesTitulo(-1, saldo) + aprCartao(ms.map(function (m) { return aprDLinhaMov(m); }).join('')) }, aprDSelecionar), { tom: 't2', arranjo: 'tela' });
}

/* Tocar e segurar: em cima, a ficha de uma prestação (o montante, com os
   três pontos e o Editar); por baixo, encostada à direita e a tocar-lhe só
   na ponta (aprDDuo), a seleção de dois movimentos com a barra das ações —
   só para quem pode registar movimentos; os outros veem só a ficha, com a
   data, o imóvel e como se repartiu a prestação.
   Devolve: o HTML da imagem. */
function aprDMovimentosFicha() {
  var ex = APR_EXEMPLO, h = ex.creditos[0], p = aprDPrestacao(), ms = aprDMovimentosDoMes(-1), pode = aprPodeCriar('transactions', 'tx.add');
  var prest = ms.filter(function (m) { return m.tipo === 'loan'; })[0], cond = ms.filter(function (m) { return /^Condomínio · T2/.test(m.titulo); })[0];
  var ficha = aprDFicha(prest.titulo,
    aprLinha({ titulo: 'Montante', valor: aprDinheiro(-h.prestacao), tom: 'prest' }) +
    (pode ? '' : aprLinha({ titulo: 'Data', valor: dPT(prest.data) }) + aprLinha({ titulo: 'Imóvel', valor: prest.onde })) +
    (pode ? '' : aprLinha({ titulo: 'Distribuição do pagamento', sub: 'Juros ' + aprDinheiro(p.juros) + ' · capital ' + aprDinheiro(p.capital), sub2: 'imposto do selo ' + aprDinheiro(p.selo) })),
    { pontos: true, pe: aprBotao('Fechar', { pequeno: true }) + (pode ? aprBotao('Editar', { primario: true, pequeno: true }) : ''), flutua: !pode });
  if (!pode) return aprCena(aprColuna([ficha]), { tom: 't1', arranjo: 'coluna' });
  // as linhas marcadas só com o título e o valor: mais baixas, cabem com a ficha à vista até ao Editar
  var curta = function (m) { var t = aprDTomDo(m.tipo); return aprLinha({ icone: t.icone, tomIcone: t.tomIcone, titulo: m.titulo, valor: aprDSinal(m.valor), tom: t.tom }); };
  var frente = '<div class="apr-d-sel-lista">' + aprDMarcada(curta(prest)) + aprDMarcada(curta(cond)) + '</div>' +
    aprDBarraSelecao(2, prest.valor + cond.valor, [['layers', 'Categoria'], ['pen', 'Editar'], ['trash', 'Apagar 2', true]]);
  return aprCena(aprDDuo(ficha, frente), { tom: 't1', arranjo: 'centro' });
}

/* Duas peças uma por cima da outra, a de baixo encostada à direita e a
   tocar na de cima só na ponta: como o aprPar do kit, mas sem tapar o fundo
   da de cima (o rodapé de uma ficha). Pode subir ao kit.
   Recebe: cima, baixo — o HTML de cada uma.
   Devolve: o HTML. */
function aprDDuo(cima, baixo) {
  return '<div class="apr-d-duo"><div>' + (cima || '') + '</div><div>' + (baixo || '') + '</div></div>';
}

/* O Criar: em cima, a folha do + com os cinco tipos de movimento e os
   modelos numa fila de chips (estes só com os Planeados ligados); por
   baixo, a linha de uma despesa de todos os imóveis, que se partiu pelos
   quatro e na lista é uma só.
   Devolve: o HTML da imagem. */
function aprDMovimentosCriar() {
  var ex = APR_EXEMPLO, lote = aprDMovimentosDoMes(-1).filter(function (m) { return m.lote; })[0];
  var tipos = [['up', 'in', 'Receita'], ['dn', 'out', 'Despesa'], ['bank', 'loan', 'Pagamento de crédito'], ['users', 'amber', 'Dívida'], ['swap', '', 'Transferência entre proprietários']];
  var modelos = servicoLigado('recurring') ? '<span class="apr-m-rot apr-m-maiusc">A partir de um modelo</span><div class="apr-m-chips apr-d-fila">' + ex.modelos.map(function (m) {
    return '<span class="apr-m-chip">' + esc(m.nome) + (m.imovel ? '<span class="apr-d-n2">· ' + esc(ex.imovel(m.imovel).nome) + '</span>' : '') + '</span>';
  }).join('') + '</div>' : '';
  var folha = aprFolha('Criar', '<span class="apr-m-rot apr-m-maiusc">Novo movimento</span><span class="apr-d-tipos">' + tipos.map(function (t) {
    return '<span class="apr-d-tipo">' + aprIcone(t[0], { tom: t[1] }) + '<b>' + esc(t[2]) + '</b></span>';
  }).join('') + '</span>' + modelos);
  return aprCena(aprColuna([folha, aprCartao(aprDLinhaMov(lote), { flutua: true, alvo: true })]), { tom: 't3', arranjo: 'coluna' });
}

/* O texto da ficha e da seleção: quem regista movimentos lê o Editar e o
   segurar; quem só os vê, o que a ficha diz.
   Devolve: o HTML (de confiança). */
function aprDMovimentosFichaTexto() {
  if (aprPodeCriar('transactions', 'tx.add')) {
    return 'Tocar num movimento abre a ficha, com o <b>Editar</b>; nos três pontos, os atalhos para o imóvel, o contrato ou a hipoteca. Segura um para selecionar vários e mudar a categoria ou apagar de uma vez.';
  }
  return 'Tocar num movimento abre a ficha: o montante, a data, o imóvel e, numa prestação, quanto foi capital e quanto foi juros. Nos três pontos, os atalhos para o imóvel, o contrato ou a hipoteca.';
}

/* O texto do Criar: os modelos só com os Planeados ligados.
   Devolve: o HTML (de confiança). */
function aprDMovimentosCriarTexto() {
  return 'O <b>+</b> abre o <b>Criar</b>, com os cinco tipos' + (servicoLigado('recurring') ? ' e os teus modelos' : ' de movimento') +
    '. Uma despesa de <b>Todos os imóveis</b> ou de um grupo divide-se por eles ao guardar, e na lista fica numa linha só.';
}

registarApresentacao('transactions', {
  nome: 'Movimentos',
  resumo: 'A lista por mês, os filtros e o Criar',
  imagens: [
    { titulo: 'Cada euro no mês dele',
      texto: 'Em <b>Dinheiro → Movimentos</b> ficam as rendas, as despesas e as prestações, por mês e com o saldo de cada um. Os totais de cima somam o que a lista mostra: toca num para o veres mês a mês.',
      maquete: aprDMovimentosLista },
    { titulo: 'A pesquisa e os filtros',
      texto: 'Escreve na pesquisa ou usa os chips do período, do tipo, do imóvel e da categoria; o × de um chip ligado limpa só esse. O funil abre o resto, e no computador o <b>Exportar CSV</b> leva os teus movimentos para o Excel.',
      maquete: aprDMovimentosFiltros },
    { titulo: 'Tocar abre, segurar seleciona', texto: aprDMovimentosFichaTexto, maquete: aprDMovimentosFicha },
    { titulo: 'Registar um movimento', texto: aprDMovimentosCriarTexto, maquete: aprDMovimentosCriar,
      quando: function () { return aprPodeCriar('transactions', 'tx.add'); } },
  ],
});

/* ------------------------------------------------------------ os Planeados */

/* O que já chegou à data: as abas do Dinheiro e o cartão «Por confirmar»
   aberto, com a renda em atraso e a limpeza do mês, e o Confirmar da
   primeira em destaque.
   Devolve: o HTML da imagem. */
function aprDPlaneadosConfirmar() {
  return aprCena(aprColuna([aprAbas(APR_ABAS_DINHEIRO, 'Planeados'), aprSurge(aprDCartaoPend({ aberto: true, alvo: true }), 0)]), { tom: 't0', arranjo: 'coluna' });
}

/* Os meses que ficaram para trás: a faixa da limpeza das escadas, que
   começou três meses antes de ser registada, e por baixo o «Por
   confirmar» fechado, como fica na página.
   Devolve: o HTML da imagem. */
function aprDPlaneadosRetro() {
  return aprCena(aprColuna([aprDRetro(true), aprDCartaoPend({ aberto: false })]), { tom: 't1', arranjo: 'coluna' });
}

/* A lista dos planeados: as abas do Dinheiro e quatro linhas com as quatro
   origens — o selo de onde vem (do contrato, da hipoteca, do imóvel, à
   mão) e o do estado —, pela próxima data. Sem o ecrã à volta, sem os
   chips e sem a linha do tipo e da categoria: as quatro têm de caber à vista.
   Devolve: o HTML da imagem. */
function aprDPlaneadosLista() {
  var ps = aprDPlaneados(), r = function (re) { return ps.filter(function (x) { return re.test(x.nome); })[0]; };
  var imi = ps.filter(function (x) { return /^IMI · T2 Paranhos/.test(x.nome); }).sort(function (a, b) { return aprDProxima(a) < aprDProxima(b) ? -1 : 1; })[0];
  var linhas = [r(/^Renda Tomás/), r(/^Limpeza/), r(/^Prestação/), imi].filter(Boolean)
    .sort(function (a, b) { return aprDProxima(a) < aprDProxima(b) ? -1 : aprDProxima(a) > aprDProxima(b) ? 1 : 0; });
  var origem = { contrato: ['do contrato', ''], hipoteca: ['da hipoteca', 'loan'], imovel: ['do imóvel', 'grey'], mao: ['à mão', 'grey'] };
  return aprCena(aprColuna([aprAbas(APR_ABAS_DINHEIRO, 'Planeados'),
    aprCartao(linhas.map(function (x) {
      var prox = aprDProxima(x), passo = x.anual ? 'anual' : 'mensal, dia ' + x.dia;
      var selos = [origem[x.origem]].concat(x.pendente ? [aprDEmAtraso(x) ? ['Em atraso', 'red'] : ['Por confirmar']] : []);
      return aprLinha({ titulo: x.nome, sub: passo + ' · ' + (x.pendente ? aprData(prox) : 'próxima ' + aprData(prox)),
        selos: selos, valor: aprDinheiro(x.valor), tom: aprDTomDo(x.tipo).tom });
    }).join(''))]), { tom: 't2', arranjo: 'coluna' });
}

/* Os modelos: em cima, a secção do fim da página, com o «Novo modelo» (a
   quem pode criar) e os modelos numa fila de chips com o valor; por baixo,
   a ficha do primeiro, com o «Usar modelo».
   Devolve: o HTML da imagem. */
function aprDPlaneadosModelos() {
  var ex = APR_EXEMPLO, md = ex.modelos[0], pode = aprPodeCriar('recurring', 'rec.add');
  var secao = aprCartao(aprDCabecaSecao('Modelos', pode ? 'Novo modelo' : '') + '<div class="apr-m-chips apr-d-fila">' + ex.modelos.map(function (m, k) {
    return '<span class="apr-m-chip' + (k === 0 ? ' apr-alvo' : '') + '">' + esc(m.nome) + (m.valor ? '<span class="apr-d-n2">' + esc(aprDinheiro(m.valor)) + '</span>' : '') + '</span>';
  }).join('') + '</div>');
  var ficha = aprDFicha(md.nome, aprLinha({ titulo: 'Montante', valor: aprDinheiro(md.valor) }) +
    aprLinha({ titulo: 'Imóvel', valor: ex.imovel(md.imovel).nome }) + aprLinha({ titulo: 'Categoria', valor: md.categoria }),
    { pontos: true, flutua: true, pe: aprBotao('Fechar', { pequeno: true }) + aprBotao('Usar modelo', { primario: true, pequeno: true, alvo: true }) });
  return aprCena(aprColuna([secao, ficha]), { tom: 't3', arranjo: 'coluna' });
}

/* O texto da lista: o segurar só a quem pode silenciar e apagar.
   Devolve: o HTML (de confiança). */
function aprDPlaneadosListaTexto() {
  return 'Cada planeado diz quando se repete, a próxima data e de onde vem; o valor de um automático segue o contrato, a hipoteca ou a ficha do imóvel. ' +
    (aprPodeCriar('recurring', 'rec.add') ? 'Toca num para a ficha, ou segura para silenciar ou apagar vários.' : 'Toca num para veres a ficha.');
}

/* O texto dos modelos: como nasce um planeado novo, só a quem o pode criar.
   Devolve: o HTML (de confiança). */
function aprDPlaneadosModelosTexto() {
  return 'No fim da página estão os <b>Modelos</b>, em chips com o valor; tocar num abre a ficha, com <b>Usar modelo</b>.' +
    (aprPodeCriar('recurring', 'rec.add') ? ' Um planeado novo nasce em <b>Criar → Movimento recorrente</b>.' : '');
}

registarApresentacao('recurring', {
  nome: 'Planeados',
  resumo: 'O que espera confirmação, de onde vem e os modelos',
  imagens: [
    { titulo: 'O que já chegou à data',
      texto: 'O cartão <b>Por confirmar</b> junta o que já chegou à data, com os em atraso primeiro: toca no cabeçalho para o abrires. <b>Confirmar</b> regista tal e qual; <b>Rever</b> deixa-te acertar o valor ou a data antes.',
      maquete: aprDPlaneadosConfirmar, quando: function () { return aprPodeCriar('recurring', 'rec.add'); } },
    { titulo: 'Os meses que ficaram para trás',
      texto: 'Um planeado que começou antes de o registares deixa meses por registar. A faixa «vem de trás» propõe registá-los de uma vez, com a etiqueta «Estimativa»; <b>Agora não</b> esconde-a até faltar mais algum.',
      maquete: aprDPlaneadosRetro, quando: function () { return aprPodeCriar('recurring', 'rec.add'); } },
    { titulo: 'Cada linha diz de onde vem', texto: aprDPlaneadosListaTexto, maquete: aprDPlaneadosLista },
    { titulo: 'Os modelos, no fim da página', texto: aprDPlaneadosModelosTexto, maquete: aprDPlaneadosModelos },
  ],
});

/* ------------------------------------------------------------- os Créditos */

/* O resumo dos Créditos: as abas do Dinheiro, com os Créditos acesos, e o
   cartão azul-noite do resumo inteiro, até ao eixo dos anos.
   Devolve: o HTML da imagem. */
function aprDCreditosResumo() {
  return aprCena(aprColuna([aprSurge(aprAbas(APR_ABAS_DINHEIRO, 'Créditos'), 0), aprSurge(aprDResumoCredito(), 1)]), { tom: 't0', arranjo: 'coluna' });
}

/* O cartão de uma hipoteca, com o Pagamento a quem pode registar
   pagamentos de crédito e o Plano em destaque.
   Devolve: o HTML da imagem. */
function aprDCreditosCartao() {
  return aprCena(aprColuna([aprDCartaoHipoteca({ pagar: aprDPodePagar(), alvo: true, flutua: true })]), { tom: 't2', arranjo: 'coluna' });
}

/* O capital que desce: atrás, a ficha da próxima prestação, com quanto foi
   juros, capital e selo; à frente, o capital em dívida antes e depois dela.
   Devolve: o HTML da imagem. */
function aprDCreditosCapital() {
  var ex = APR_EXEMPLO, h = ex.creditos[0], p = aprDPrestacao(), b = ex.imovel(h.imovel);
  var ficha = aprDFicha('Prestação ' + h.nome + ' · ' + b.nome,
    aprLinha({ titulo: 'Montante', valor: aprDinheiro(-h.prestacao), tom: 'prest' }) +
    aprLinha({ titulo: 'Hipoteca', valor: h.nome }) +
    aprLinha({ titulo: 'Distribuição do pagamento', sub: 'Juros ' + aprDinheiro(p.juros) + ' · capital ' + aprDinheiro(p.capital), sub2: 'imposto do selo ' + aprDinheiro(p.selo) }),
    { pontos: true });
  var frente = aprCartao('<span class="apr-m-cartao-cab"><b>' + esc(h.nome + ' · ' + b.nome) + '</b></span>' +
    '<span class="apr-m-sub">Em dívida</span>' +
    '<span class="apr-d-desce"><s>' + esc(money(h.divida)) + '</s>' + ic('chevR', 11) + '<b>' + esc(money(p.depois)) + '</b></span>' +
    '<span class="apr-m-sub">' + esc(aprDinheiro(-p.capital)) + ' de capital</span>', { flutua: true, alvo: true });
  return aprCena(aprPar(ficha, frente), { tom: 't1', arranjo: 'par' });
}

/* A hipoteca nova: atrás, o título «Ativas» com o «Nova hipoteca» em
   destaque e o cartão; à frente, a escolha do imóvel (creditos.js:newMort),
   com quantas hipotecas cada um já tem.
   Devolve: o HTML da imagem. */
function aprDCreditosNova() {
  var ex = APR_EXEMPLO;
  var atras = aprCartao(aprDCabecaSecao('Ativas', 'Nova hipoteca', true) + aprDCartaoHipoteca({ pagar: aprDPodePagar() }), { classe: 'apr-d-ativas' });
  var escolha = aprFolha('Hipoteca de que imóvel?', ex.imoveis.map(function (p) {
    var n = ex.creditos.filter(function (h) { return h.imovel === p.id; }).length;
    return aprLinha({ icone: 'building', titulo: p.nome, sub: n ? n + (n === 1 ? ' hipoteca' : ' hipotecas') : 'sem hipotecas' });
  }).join(''), { flutua: true });
  return aprCena(aprPar(atras, escolha), { tom: 't3', arranjo: 'par' });
}

/* Quem pode registar um pagamento de crédito daqui (o botão Pagamento do
   cartão, creditos.js:credCartao): com os Movimentos ligados, e, a quem
   colabora, um cargo que registe movimentos e edite a ficha do imóvel
   (acessos.js:motivoCredito).
   Devolve: true/false. */
function aprDPodePagar() {
  return aprPodeCriar('transactions', 'tx.add') && aprPodeCriar('credits', 'house.edit');
}

/* O texto do cartão: o Pagamento só a quem o tem.
   Devolve: o HTML (de confiança). */
function aprDCreditosCartaoTexto() {
  return 'Cada cartão diz a taxa, a prestação e o capital em dívida, com a barra do que já pagaste. ' +
    (aprDPodePagar() ? '<b>Pagamento</b> regista uma prestação e <b>Plano</b> mostra-as até ao fim' : '<b>Plano</b> mostra as prestações até ao fim') +
    '; no computador, tocar abre o plano ao lado.';
}

/* O texto do capital: sem os Planeados, a prestação regista-se nos Movimentos.
   Devolve: o HTML (de confiança). */
function aprDCreditosCapitalTexto() {
  return 'O capital em dívida de hoje não se escreve à mão: é o do início menos o capital de cada pagamento registado. ' +
    (servicoLigado('recurring') ? 'Confirmar a prestação nos <b>Planeados</b> chega para ele descer.' : 'Registar a prestação nos <b>Movimentos</b> chega para ele descer.');
}

/* O texto da hipoteca nova: a prestação lembrada só com os Planeados ligados.
   Devolve: o HTML (de confiança). */
function aprDCreditosNovaTexto() {
  return '<b>Nova hipoteca</b> pergunta primeiro o imóvel, porque fica na ficha dele' +
    (servicoLigado('recurring') ? ', e a prestação passa a ser lembrada nos <b>Planeados</b>' : '') + '. As que acabares de pagar descem para <b>Liquidadas</b>.';
}

registarApresentacao('credits', {
  nome: 'Créditos',
  resumo: 'O que deves, a prestação e o plano',
  imagens: [
    { titulo: 'Quanto deves, de relance',
      texto: 'Em <b>Dinheiro → Créditos</b>, o resumo soma as hipotecas ativas: o que falta pagar, as prestações do mês e os juros e o selo até ao fim. No telemóvel, passa o dedo pelas barras para leres a dívida no fim de cada ano.',
      maquete: aprDCreditosResumo },
    { titulo: 'Uma hipoteca, um cartão', texto: aprDCreditosCartaoTexto, maquete: aprDCreditosCartao },
    { titulo: 'O capital desce a cada pagamento', texto: aprDCreditosCapitalTexto, maquete: aprDCreditosCapital,
      quando: function () { return servicoLigado('transactions'); } },
    { titulo: 'Cada hipoteca vive num imóvel', texto: aprDCreditosNovaTexto, maquete: aprDCreditosNova,
      quando: function () { return aprPodeCriar('credits', 'house.edit'); } },
  ],
});

/* ------------------------------------------------------------ o Calendário */

/* O mês de relance: o cartão do mês (o de hoje, ou o seguinte na segunda
   quinzena: aprDMesDoCalendario), com os pontos.
   Devolve: o HTML da imagem. */
function aprDCalendarioMesImagem() {
  return aprCena(aprSurge(aprDCalendarioMes(aprDMesDoCalendario()), 0, 'apr-d-cal-cena'), { tom: 't0', arranjo: 'centro' });
}

/* O que tem cada dia: o ecrã do Calendário com o painel do próximo dia com
   planeados — a visita marcada nesse dia, a renda que lá chega e os dois
   botões.
   Devolve: o HTML da imagem. */
function aprDCalendarioDia() {
  return aprCena(aprDTela({ titulo: 'Calendário', corpo: aprDPainelDia(aprDDiaDoPainel(), { alvo: true }) }, ''), { tom: 't2', arranjo: 'tela' });
}

/* O número da Agenda: o ecrã do Calendário com o painel de hoje e os
   botões, o cartão «Por confirmar» em destaque por baixo, e a barra de
   baixo com o crachá da Agenda.
   Devolve: o HTML da imagem. */
function aprDCalendarioPend() {
  var tela = aprDTela({ titulo: 'Calendário', barra: 'agenda',
    corpo: aprDPainelDia(today(), { plano: true }) + aprDCartaoPend({ agenda: true, alvoCartao: true }) }, '');
  return aprCena(tela.replace(aprBarra('agenda'), aprDBarraComCracha('agenda', aprDPendentes().length)), { tom: 't1', arranjo: 'tela' });
}

/* O texto do mês: os pontos dos serviços ligados.
   Devolve: o HTML (de confiança). */
function aprDCalendarioMesTexto() {
  var v = servicoLigado('visits'), p = servicoLigado('recurring');
  var pontos = v && p ? ': um ponto azul nos dias com visitas, um laranja nos dias com planeados' : v ? ': um ponto azul nos dias com visitas' : p ? ': um ponto laranja nos dias com planeados' : '';
  return 'Em <b>Agenda → Calendário</b> está o mês inteiro' + pontos + '. Desliza o mês para o lado, ou usa as setas, para mudares de mês.';
}

/* O texto do dia: o que cada serviço ligado põe no painel e os botões que lá estão.
   Devolve: o HTML (de confiança). */
function aprDCalendarioDiaTexto() {
  var v = servicoLigado('visits'), p = servicoLigado('recurring'), planear = aprPodeCriar('recurring', 'rec.add');
  var tem = v && p ? 'as visitas, com a hora, e os planeados, com o valor' : v ? 'as visitas, com a hora' : 'os planeados, com o valor';
  var botoes = [v ? '<b>Marcar visita</b>' : '', planear ? '<b>Recorrente</b>' : ''].filter(Boolean);
  return 'Tocar num dia mostra o que ele tem: ' + tem + '.' +
    (botoes.length ? ' ' + botoes.join(' e ') + (botoes.length > 1 ? ' abrem' : ' abre') + ' já com esse dia escolhido.' : '');
}

registarApresentacao('calendar', {
  nome: 'Calendário',
  imagens: [
    { titulo: 'O mês de relance', texto: aprDCalendarioMesTexto, maquete: aprDCalendarioMesImagem },
    { titulo: 'O que tem cada dia', texto: aprDCalendarioDiaTexto, maquete: aprDCalendarioDia,
      quando: function () { return servicoLigado('visits') || servicoLigado('recurring'); } },
    { titulo: 'O número da Agenda',
      texto: 'Por baixo do dia, o <b>Por confirmar</b> junta os planeados que já chegaram à data: são eles o número da <b>Agenda</b> na barra de baixo. Confirmar daqui é o mesmo que nos <b>Planeados</b>.',
      maquete: aprDCalendarioPend, quando: function () { return servicoLigado('recurring'); } },
  ],
});
