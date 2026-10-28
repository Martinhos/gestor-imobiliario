/* ===== APRESENTAÇÃO DA VISÃO GERAL, DA ANÁLISE E DAS DEFINIÇÕES ===== */
/* As apresentações da Visão geral, da Análise (Avaliação, Projeções,
   IRS · Anexo F) e das Definições. Cada uma regista-se em
   cloud/apresentacao.js:registarApresentacao ao carregar, e desenha as
   imagens com o kit de lá (aprCena, aprTela, aprCartao…) e as peças
   daqui (aprAKpi, aprAColunas, aprATraco…), com o CSS no bloco «a Visão
   geral, a Análise e as Definições (folha 1.5)» do web/estilos.css.

   A Visão geral tem cinco caras, e a apresentação diz a de cada conta
   (aprACaraDoPainel, o quando de cada imagem): sem movimentos é a jornada
   dos primeiros passos (cloud/guia.js:jornadaInicial); com o cartão dos
   passos dispensado e ainda sem movimentos, o vazio que diz de onde vêm os
   números (e, sem imóveis, o que pede o primeiro); com movimentos, os
   indicadores, os gráficos, o «Pede atenção» e o «Personalizar painel»
   (painel-geral.js:vDashboard, cloud/painel.js); e a quem só colabora sem
   acesso às finanças, o «O que podes fazer». Quem
   cria conta já a tem por vista (as boas-vindas marcam-na): esta é
   sobretudo das contas de antes, e de quem a revê pela Ajuda.

   Os números são os do portefólio inventado (apresentacao.js:APR_EXEMPLO):
   o ano soma os meses dele (aprAAno), a Avaliação reparte-o pelos imóveis
   (aprAPorImovel), as Projeções levam-no para a frente (aprAProjecao). O
   que é da própria conta — o nome, os passos da jornada, o cargo, as
   definições — lê-se da conta, como a app o mostra por trás da janela. */

'use strict';

/* -------------------------------------------------------- os números */

/* A soma de uma lista de números.
   Recebe: xs — os números (array; o que não for número conta zero).
   Devolve: a soma. */
function aprASoma(xs) {
  return (xs || []).reduce(function (a, x) { return a + (Number(x) || 0); }, 0);
}

/* Arredonda aos cêntimos (os totais dos meses somam decimais).
   Recebe: v — o valor.
   Devolve: o valor com duas casas, no máximo. */
function aprACent(v) { return Math.round((Number(v) || 0) * 100) / 100; }

/* O ano do portefólio inventado, até ao último mês fechado: a receita, as
   despesas e as prestações dos meses do APR_EXEMPLO (os da montra), o
   cashflow e o NOI (anualizado ×12 sobre os meses, como a Avaliação faz), e
   o que os imóveis valem, custaram e devem. A Visão geral mostra os quatro
   primeiros, a Avaliação o resto.
   Devolve: {meses, receita, despesas, prestacoes, cashflow, noi, noiAnual,
   valor, aquisicao, divida, rendaMes, rendaAno, valorArrendados, yieldExigido}. */
function aprAAno() {
  var ex = APR_EXEMPLO, n = ex.receitaMes.length;
  var receita = aprASoma(ex.receitaMes), despesas = aprASoma(ex.despesaMes), prest = aprACent(ex.prestacaoMes * n);
  var arrendados = ex.imoveis.filter(function (p) { return ex.rendaDe(p.id) > 0; });
  var rendaMes = aprASoma(ex.contratos.map(function (c) { return c.renda; }));
  return {
    meses: n, receita: receita, despesas: despesas, prestacoes: prest, cashflow: aprACent(receita - despesas - prest),
    noi: receita - despesas, noiAnual: (receita - despesas) * 12 / n,
    valor: aprASoma(ex.imoveis.map(function (p) { return p.valor; })),
    aquisicao: aprASoma(ex.imoveis.map(function (p) { return p.aquisicao; })),
    divida: aprASoma(ex.creditos.map(function (c) { return c.divida; })),
    rendaMes: rendaMes, rendaAno: rendaMes * 12,
    valorArrendados: aprASoma(arrendados.map(function (p) { return p.valor; })),
    // o da app por omissão (dados.js:blank, capTarget)
    yieldExigido: 5,
  };
}

/* O ano de cada imóvel do exemplo, que soma o do portefólio (aprAAno): as
   rendas de cada contrato nos meses fechados (no T3 Bonfim mais os 140 € a
   mais de março; o T1 Cedofeita rendeu 690 € até agosto), as despesas
   repartidas e a prestação da hipoteca, que é toda do T3 Bonfim.
   Devolve: {id: {receita, despesas, prestacoes, cashflow, noiAnual}}. */
function aprAPorImovel() {
  var ex = APR_EXEMPLO, n = ex.receitaMes.length;
  var base = { bonfim: [10640, 2468], paranhos: [9500, 1652], campanha: [4250, 860], cedofeita: [5520, 1332] };
  var out = {};
  Object.keys(base).forEach(function (id) {
    var prest = id === 'bonfim' ? aprACent(ex.prestacaoMes * n) : 0, r = base[id][0], d = base[id][1];
    out[id] = { receita: r, despesas: d, prestacoes: prest, cashflow: aprACent(r - d - prest), noiAnual: (r - d) * 12 / n };
  });
  return out;
}

/* As despesas por categoria do ano do exemplo (somam as despesas do
   aprAAno), da maior para a menor — o donut da Visão geral.
   Devolve: [{nome, valor}]. */
function aprACategorias() {
  return [{ nome: 'Manutenção e reparações', valor: 1980 }, { nome: 'Condomínio', valor: 1350 }, { nome: 'Outros', valor: 1129 },
    { nome: 'Impostos', valor: 1102 }, { nome: 'Seguros', valor: 401 }, { nome: 'Limpeza e jardim', valor: 350 }];
}

/* A taxa do IRS de um contrato do exemplo num ano, pelas regras da app
   (irs.js:irsRate, com a versão desse ano — as rendas moderadas e o resto):
   um contrato de habitação com essa renda, sem nada escrito. Sem o motor, os
   25 % da habitação.
   Recebe: c — o contrato do APR_EXEMPLO; ano — o ano.
   Devolve: a taxa em percentagem. */
function aprATaxa(c, ano) {
  if (typeof irsRate !== 'function') return 25;
  try {
    var t = irsRate({ rent: c.renda, start: aprAIso(c.desde), end: '', active: true }, ano);
    return isFinite(t) ? Number(t) : 25;
  } catch (e) { return 25; }
}

/* Uma data dd/mm/aaaa (as do APR_EXEMPLO) em AAAA-MM-DD.
   Recebe: d — a data escrita.
   Devolve: a data em ISO ('' sem data). */
function aprAIso(d) {
  var m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(d || ''));
  return m ? m[3] + '-' + m[2] + '-' + m[1] : '';
}

/* A última vez que um dia do mês chegou, até hoje — a data de um movimento
   já registado (o contrário do apresentacao.js:aprProximoDia).
   Recebe: dia — o dia do mês (1 a 31).
   Devolve: a data em AAAA-MM-DD. */
function aprAUltimoDia(dia) {
  var hoje = today(), y = Number(hoje.slice(0, 4)), m = Number(hoje.slice(5, 7)) - 1;
  var d = dayInMonth(y, m, dia);
  return d <= hoje ? d : dayInMonth(m === 0 ? y - 1 : y, (m + 11) % 12, dia);
}

/* A projeção do exemplo, ano a ano, como a das Projeções a faz
   (projecoes.js:projRows): dez anos a partir deste (o horizonte por
   omissão), as rendas de cada contrato com 2 % ao ano (o aumento por
   omissão), cortadas no fim do contrato — o do Quarto 3 acaba daqui a 25
   dias (APR_EXEMPLO.contrato('c3').terminaEm), e é ele que o aviso das
   renovações nomeia; os outros contam-se renovados, para a imagem não
   envelhecer com as datas fixas do exemplo —, o IRS à taxa de cada ano
   (aprATaxa), as despesas fixas dos imóveis e as planeadas à mão com 2 % de
   inflação, a prestação da hipoteca e a dívida no fim de cada ano, pelo
   plano dela.
   Devolve: {anos: [{ano, rendas, irs, despesas, prestacoes, cashflow,
   divida, porContrato: {id: euros}}], fimQuarto3} — fimQuarto3 em AAAA-MM-DD. */
function aprAProjecao() {
  var ex = APR_EXEMPLO, y0 = Number(today().slice(0, 4)), mes0 = Number(today().slice(5, 7)) - 1;
  var fim = aprDia(ex.contrato('c3').terminaEm), fy = Number(fim.slice(0, 4)), fm = Number(fim.slice(5, 7));
  var fixas = aprASoma(ex.imoveis.map(function (p) { return p.imi + p.condominio * 12 + p.seguro; })) +
    aprASoma(ex.aMao.map(function (m) { return Math.abs(m.valor) * 12; }));
  var h = ex.creditos[0], taxaMes = 0.0345 / 12, divida = h.divida, anos = [];
  for (var i = 0; i < 10; i++) {
    var ano = y0 + i, rendas = 0, irs = 0, porContrato = {};
    ex.contratos.forEach(function (c) {
      var meses = c.id === 'c3' ? (ano < fy ? 12 : ano === fy ? fm : 0) : 12;
      var v = c.renda * meses * Math.pow(1.02, i);
      porContrato[c.id] = v;
      rendas += v;
      irs += v * aprATaxa(c, ano) / 100;
    });
    // a dívida desce mês a mês: este ano só nos meses que faltam
    for (var k = i ? 0 : mes0 + 1; k < 12; k++) divida = Math.max(0, divida * (1 + taxaMes) - h.prestacao);
    var despesas = fixas * Math.pow(1.02, i), prest = h.prestacao * 12;
    anos.push({ ano: ano, rendas: rendas, irs: irs, despesas: despesas, prestacoes: prest,
      cashflow: rendas - irs - despesas - prest, divida: divida, porContrato: porContrato });
  }
  return { anos: anos, fimQuarto3: fim };
}

/* O ano dos rendimentos que a página do IRS mostraria (fisco.js:fiscoAnoAtual
   sem a escolha da pessoa): o corrente — o do exemplo, que tem os meses dele.
   Devolve: o ano (número). */
function aprAFiscoAno() { return Number(today().slice(0, 4)); }

/* O resumo do IRS do exemplo, num ano: as rendas do ano do exemplo, os
   gastos que a regra das categorias deduz (o condomínio, a manutenção, a
   primeira prestação do IMI e o seguro, que cai em «Outros gastos»), o
   líquido e o imposto estimado à taxa desse ano (aprATaxa — as rendas são
   todas de habitação e abaixo do limite das moderadas). E o englobamento com
   21 400 € de outros rendimentos, pelos escalões da versão do ano
   (fisco.js:fiscoColeta), quando a versão os tem.
   Recebe: ano — o ano dos rendimentos.
   Devolve: {rendas, gastos, liquido, imposto, taxa, outros, englobando} —
   englobando é null sem escalões. */
function aprAFisco(ano) {
  var a = aprAAno(), gastos = aprACent(1350 + 1980 + 469.2 + 401), liquido = aprACent(a.receita - gastos);
  var taxa = aprATaxa(APR_EXEMPLO.contrato('c4'), ano), imposto = aprACent(liquido * taxa / 100), outros = 21400, englobando = null;
  try {
    var eng = typeof irsAno === 'function' ? irsAno(ano).englobamento : null, temEscaloes = !!(eng && (eng.escaloes || []).length);
    // a coleta é da Declaração (fisco.js): a guarda vai na linha da chamada
    if (temEscaloes && typeof fiscoColeta === 'function') englobando = aprACent(Math.max(0, fiscoColeta(outros + liquido, eng, false) - fiscoColeta(outros, eng, false)));
  } catch (e) { englobando = null; }
  return { rendas: a.receita, gastos: gastos, liquido: liquido, imposto: imposto, taxa: taxa, outros: outros, englobando: englobando };
}

/* -------------------------------------------------------- as peças */

/* Um indicador em miniatura (o .kpi da app): o rótulo com a bolinha da cor
   da série, o valor na letra dos títulos e, se houver, a nota por baixo. O
   escuro é o cartão azul-noite do Cashflow (estilos.css:.vg-kpi.cf).
   Recebe: rotulo — o texto; valor — o valor já escrito; o (opcional) —
   {cor: 'in', 'out', 'loan' ou 'acc' (a bolinha; sem ela não há), tom: 'pos'
   ou 'neg' (a cor do valor), nota (o texto pequeno), escuro, alvo}.
   Devolve: o HTML. */
function aprAKpi(rotulo, valor, o) {
  o = o || {};
  var cor = /^(in|out|loan|acc)$/.test(o.cor || '') ? o.cor : '';
  var tom = /^(pos|neg)$/.test(o.tom || '') ? ' ' + o.tom : '';
  return '<span class="apr-a-kpi' + (o.escuro ? ' escuro' : '') + (o.alvo ? ' apr-alvo' : '') + '"><span class="apr-a-kpi-rot">' +
      (cor ? '<i class="apr-a-bola ' + cor + '"></i>' : '') + esc(rotulo) + '</span>' +
    '<b class="apr-a-kpi-val' + tom + '">' + esc(valor) + '</b>' + (o.nota ? '<span class="apr-m-sub">' + esc(o.nota) + '</span>' : '') + '</span>';
}

/* Os indicadores numa grelha (duas colunas, ou três).
   Recebe: kpis — o HTML de cada um (array); tres (opcional) — verdade para
   três colunas.
   Devolve: o HTML. */
function aprAKpis(kpis, tres) {
  return '<div class="apr-a-kpis' + (tres ? ' tres' : '') + '">' + (kpis || []).join('') + '</div>';
}

/* Os quatro indicadores da Visão geral: a receita, as despesas, as
   prestações e o cashflow, com os cêntimos, como o painel os escreve.
   Recebe: v — {receita, despesas, prestacoes, cashflow}; alvo (opcional) —
   o índice do que a imagem ensina a tocar.
   Devolve: o HTML da grelha. */
function aprAQuatro(v, alvo) {
  return aprAKpis([
    aprAKpi('Receita', aprDinheiro(v.receita), { cor: 'in', alvo: alvo === 0 }),
    aprAKpi('Despesas', aprDinheiro(v.despesas), { cor: 'out', alvo: alvo === 1 }),
    aprAKpi('Prestações', aprDinheiro(v.prestacoes), { cor: 'loan', alvo: alvo === 2 }),
    aprAKpi('Cashflow', aprDinheiro(v.cashflow), { cor: 'acc', escuro: true, alvo: alvo === 3 }),
  ]);
}

/* A classe da altura de uma barra, em vigésimos da caixa dela
   (estilos.css:.apr-a-h0 a .apr-a-h20): a CSP não deixa escrever a altura.
   Recebe: v — o valor; max — o que enche a caixa.
   Devolve: a classe. */
function aprAAltura(v, max) {
  var n = max > 0 ? Math.round(Math.abs(Number(v) || 0) / max * 20) : 0;
  return 'apr-a-h' + Math.max(0, Math.min(20, n));
}

/* Colunas que sobem e descem, como as do graficos.js:cBars: o que entra
   para cima, o que sai empilhado para baixo (a primeira parte junto ao
   eixo), à mesma escala, e o rótulo por baixo (com o valor, se o trouxer).
   Recebe: colunas — [{rotulo, valor (opcional, já escrito), cima, baixo:
   [[valor, cor]]}] (cor: 'in', 'out', 'loan' ou 'irs'); o (opcional) —
   {aceso: o índice da coluna em destaque (a faixa da leitura), dedo:
   verdade para o dedo em cima dela}.
   Devolve: o HTML. */
function aprAColunas(colunas, o) {
  o = o || {};
  var max = Math.max.apply(null, colunas.map(function (c) {
    return Math.max(Math.abs(c.cima || 0), aprASoma((c.baixo || []).map(function (b) { return Math.abs(b[0]); })));
  }).concat([1]));
  return '<div class="apr-a-colunas">' + colunas.map(function (c, k) {
    var baixo = (c.baixo || []).map(function (b) { return '<i class="' + aprAAltura(b[0], max) + ' apr-a-' + esc(b[1]) + '"></i>'; }).join('');
    return '<span class="apr-a-coluna' + (o.aceso === k ? ' on' : '') + '">' +
      '<span class="apr-a-cima"><i class="' + aprAAltura(c.cima, max) + ' apr-a-in"></i></span>' +
      '<span class="apr-a-baixo">' + baixo + '</span>' +
      '<span class="apr-a-rot">' + esc(c.rotulo) + (c.valor ? '<b>' + esc(c.valor) + '</b>' : '') + '</span>' +
      (o.dedo && o.aceso === k ? '<span class="apr-a-dedo"></span>' : '') + '</span>';
  }).join('') + '</div>';
}

/* A leitura de um gráfico, no canto de cima (graficos.js:mostrarColuna): o
   mês e, por série, a bolinha, o nome e o valor.
   Recebe: titulo — o mês; linhas — [[nome, valor já escrito, cor]].
   Devolve: o HTML. */
function aprALeitura(titulo, linhas) {
  return '<span class="apr-a-leitura"><b>' + esc(titulo) + '</b>' + (linhas || []).map(function (l) {
    return '<span><i class="apr-a-bola ' + esc(l[2] || 'acc') + '"></i>' + esc(l[0]) + '</span><b>' + esc(l[1]) + '</b>';
  }).join('') + '</span>';
}

/* A legenda de um gráfico: a bolinha e o nome de cada série.
   Recebe: series — [[nome, cor]].
   Devolve: o HTML. */
function aprALegenda(series) {
  return '<span class="apr-a-legenda">' + (series || []).map(function (s) {
    return '<span><i class="apr-a-bola ' + esc(s[1]) + '"></i>' + esc(s[0]) + '</span>';
  }).join('') + '</span>';
}

/* O traço de um gráfico de linha, com a área por baixo (o cashflow
   acumulado, a dívida por amortizar), num SVG que estica com a caixa.
   Recebe: valores — os números (array); tom (opcional) — 'in', 'loan' (sem
   ele, o cobalto).
   Devolve: o HTML. */
function aprATraco(valores, tom) {
  var vs = (valores || []).map(function (v) { return Number(v) || 0; });
  if (vs.length < 2) return '';
  var min = Math.min.apply(null, vs), max = Math.max.apply(null, vs), amp = max - min || 1;
  var pts = vs.map(function (v, k) { return (k / (vs.length - 1) * 100).toFixed(1) + ',' + (4 + (1 - (v - min) / amp) * 32).toFixed(1); });
  var t = /^(in|loan)$/.test(tom || '') ? ' ' + tom : '';
  return '<svg class="apr-a-traco' + t + '" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">' +
    '<polygon points="0,40 ' + pts.join(' ') + ' 100,40"></polygon><polyline points="' + pts.join(' ') + '"></polyline></svg>';
}

/* Um donut em miniatura, com o total ao meio e a legenda ao lado (as
   despesas por categoria): cada fatia é um arco do mesmo círculo, com a
   parte dela no stroke-dasharray, pela ordem das cores da paleta
   (estilos.css:.apr-a-f0 a .apr-a-f5).
   Recebe: itens — [{nome, valor}], do maior para o menor; centro — o texto
   do meio; sub — a linha por baixo dele; n (opcional) — quantos vão na
   legenda (4).
   Devolve: o HTML. */
function aprADonut(itens, centro, sub, n) {
  var tot = aprASoma(itens.map(function (x) { return x.valor; })) || 1, ate = 0;
  var arcos = itens.map(function (x, k) {
    var p = x.valor / tot * 100, arco = '<circle class="apr-a-f' + Math.min(5, k) + '" cx="18" cy="18" r="15.9155" pathLength="100" stroke-dasharray="' +
      Math.max(0, p - 0.8).toFixed(2) + ' ' + (100 - Math.max(0, p - 0.8)).toFixed(2) + '" stroke-dashoffset="' + (-ate).toFixed(2) + '"></circle>';
    ate += p;
    return arco;
  }).join('');
  var legenda = itens.slice(0, n || 4).map(function (x, k) {
    return '<span><i class="apr-a-q' + Math.min(5, k) + '"></i><span class="apr-a-leg-nome">' + esc(x.nome) + '</span><b>' + Math.round(x.valor / tot * 100) + '%</b></span>';
  }).join('');
  return '<span class="apr-a-donut"><span class="apr-a-roda"><svg viewBox="0 0 36 36" aria-hidden="true">' + arcos + '</svg>' +
    '<span class="apr-a-centro"><b>' + esc(centro) + '</b><span class="apr-m-sub">' + esc(sub) + '</span></span></span>' +
    '<span class="apr-a-leg">' + legenda + '</span></span>';
}

/* Uma tabela em miniatura, com as linhas numa grelha de colunas iguais (a
   linha em destaque leva o contorno, que numa <tr> não se desenha).
   Recebe: cab — os títulos das colunas (array); linhas — as células de cada
   linha (arrays de HTML de confiança); o (opcional) — {alvo: o índice da
   linha em destaque, cols: a classe das colunas — 'c2' a 'c6', ou 'q4', a
   dos quadros do IRS, com o selo do quadro à frente}.
   Devolve: o HTML. */
function aprATabela(cab, linhas, o) {
  o = o || {};
  var cols = /^(c[2-6]|q4)$/.test(o.cols || '') ? o.cols : 'c4';
  return '<div class="apr-a-tabela ' + cols + '"><div class="apr-a-tl apr-a-tcab">' + cab.map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') + '</div>' +
    linhas.map(function (l, k) {
      return '<div class="apr-a-tl' + (o.alvo === k ? ' apr-alvo' : '') + '">' + l.map(function (c) { return '<span>' + c + '</span>'; }).join('') + '</div>';
    }).join('') + '</div>';
}

/* O chip «Imóvel» de uma análise (vistas.js:anaChips): desligado diz
   «Imóvel» e leva a seta; com um imóvel em foco diz o nome, no cobalto, com o ×.
   Recebe: nome (opcional) — o imóvel em foco; alvo (opcional).
   Devolve: o HTML. */
function aprAChipImovel(nome, alvo) {
  return '<span class="apr-m-chip apr-a-chip' + (nome ? ' on' : '') + (alvo ? ' apr-alvo' : '') + '">' + esc(nome || 'Imóvel') + ic(nome ? 'x' : 'chevD', 10) + '</span>';
}

/* Um seletor de formulário em miniatura (o sel da app): o valor e a seta.
   Recebe: valor — o que está escolhido; alvo (opcional).
   Devolve: o HTML. */
function aprASeletor(valor, alvo) {
  return '<span class="apr-m-caixa apr-a-sel' + (alvo ? ' apr-alvo' : '') + '"><span>' + esc(valor) + '</span>' + ic('chevD', 11) + '</span>';
}

/* Um interruptor em miniatura: ligado, a bola vai para a direita e o fundo
   é cobalto — a forma diz o estado, que o escurecimento forçado não apaga.
   Recebe: ligado — true/false.
   Devolve: o HTML. */
function aprAInterruptor(ligado) {
  return '<span class="apr-a-int' + (ligado ? ' on' : '') + '"></span>';
}

/* Um cartão com o título na cabeça e uma nota à direita (os cartões da
   Visão geral e da Análise).
   Recebe: titulo — o texto; nota — o texto da direita ('' sem nota);
   corpo — o HTML; o (opcional) — as opções do aprCartao ({flutua, alvo,
   classe}) e acao (HTML no lugar da nota).
   Devolve: o HTML. */
function aprACartao(titulo, nota, corpo, o) {
  o = o || {};
  return aprCartao('<span class="apr-m-cartao-cab"><b>' + esc(titulo) + '</b>' + (o.acao || (nota ? '<span class="apr-m-sub">' + esc(nota) + '</span>' : '')) + '</span>' + (corpo || ''), o);
}

/* O rótulo de uma secção (o «PEDE ATENÇÃO», o «CONTA» das Definições).
   Recebe: texto — o rótulo.
   Devolve: o HTML. */
function aprARotulo(texto) {
  return '<span class="apr-m-rot apr-m-maiusc apr-a-rotulo">' + esc(texto) + '</span>';
}

/* O cabeçalho dos ecrãs desta folha, com os botões da direita de cada um:
   o sino e o funil na Visão geral, a roda dentada nas Projeções e na
   Avaliação, o funil no IRS, nada nas Definições.
   Recebe: qual — 'painel', 'roda', 'funil' ou ''.
   Devolve: o HTML dos botões (para a opção direita do aprTela). */
function aprADireita(qual) {
  if (qual === 'painel') return ic('bell', 14) + ic('filter', 14);
  if (qual === 'roda') return ic('roda', 14);
  if (qual === 'funil') return ic('filter', 14);
  return '';
}

/* O ecrã do telemóvel de um separador desta folha: o aprTela com o
   cabeçalho e os botões dele, e a barra de baixo — acesa no Início na
   Visão geral, apagada na Análise e nas Definições, que vivem no menu.
   Recebe: titulo — o do cabeçalho; direita — os botões (aprADireita);
   corpo — o HTML; inicio (opcional) — verdade na Visão geral.
   Devolve: o HTML (o ecrã, para dentro de uma aprCena com arranjo 'tela'). */
function aprAEcra(titulo, direita, corpo, inicio) {
  /* o desenho do apresentacao.js:aprTela, com o cabeçalho de cada ecrã: o
     aprTela escreve-o sempre com o sino e o selecionar das listas */
  return '<div class="apr-tela com-barra">' + aprCabeca(titulo, { direita: direita }) +
    '<div class="apr-tela-corpo">' + (corpo || '') + '</div>' + aprBarra(inicio ? 'inicio' : '') + '</div>';
}

/* ------------------------------------------------------ a Visão geral */

/* A cara da Visão geral nesta conta, pela ordem do painel-geral.js:vDashboard:
   quem só colabora vê os números se o cargo abre as finanças, e o «O que
   podes fazer» se não; com movimentos, os números; sem eles, a jornada dos
   primeiros passos (cloud/guia.js:jornadaInicial) e, com ela dispensada (ou
   sem passos por fazer), o vazio — o que leva aos Movimentos, com imóveis,
   ou o «Ainda não há nada registado», que pede o primeiro imóvel, sem eles.
   Devolve: 'numeros', 'jornada', 'vazio', 'nada' ou 'podes'. */
function aprACaraDoPainel() {
  if (typeof db === 'undefined' || !db) return 'numeros';
  if (souSoColaborador()) return typeof scope === 'function' && scope().length ? 'numeros' : 'podes';
  if ((db.transactions || []).length) return 'numeros';
  if (typeof jornadaInicial === 'function' && jornadaInicial()) return 'jornada';
  return (db.properties || []).length ? 'vazio' : 'nada';
}

/* Uma das caras da Visão geral é a desta conta? (o quando das imagens)
   Recebe: caras — as caras em que a imagem entra (array).
   Devolve: true/false. */
function aprAPainelEm(caras) { return caras.indexOf(aprACaraDoPainel()) > -1; }

/* O «Personalizar painel» está no fim da Visão geral? Com os números, e
   quando a pessoa pode registar movimentos (painel-geral.js:dashDepois):
   quem só colabora precisa do cargo com tx.add.
   Devolve: true/false. */
function aprAPodeArrumar() {
  if (aprACaraDoPainel() !== 'numeros') return false;
  if (typeof podeSemImovel === 'function' && podeSemImovel()) return true;
  return casasComo('tx.add').length > 0;
}

/* Os passos da jornada como a vista os mostra a esta conta
   (cloud/guia.js:estadoDosPassos): o título, se está feito, o atual com o
   botão dele, e o rótulo do tutorial. Sem a jornada (a imagem revista
   noutra cara), os de uma conta acabada de criar com o perfil feito.
   Devolve: {ps: [{titulo, sub, feito, botao, mais, tutorial}], atual, nFeitos}. */
function aprAPassos() {
  var e = null;
  try { e = typeof estadoDosPassos === 'function' ? estadoDosPassos() : null; } catch (x) { e = null; }
  if (e && e.ps && e.ps.length) {
    var vistos = {};
    try { vistos = typeof feitos === 'function' ? feitos() : {}; } catch (x) { vistos = {}; }
    var tut = typeof TUTORIAIS !== 'undefined' ? TUTORIAIS : {};
    return { atual: e.atual, nFeitos: e.nFeitos, ps: e.ps.map(function (q) {
      var t = tut[q.id];
      return { titulo: q.titulo, sub: q.feito ? q.feitoTxt : q.porque, feito: !!q.feito, botao: q.botao, mais: !!q.mais,
        tutorial: t ? (vistos[q.id] ? 'Rever o tutorial' : 'Como se faz · ' + t.passos.length + ' passos') : '' };
    }) };
  }
  return { atual: 1, nFeitos: 1, ps: [
    { titulo: 'Preenche o teu perfil', sub: 'Nome e NIF preenchidos.', feito: true },
    { titulo: 'Adiciona os teus imóveis', sub: 'É a base de tudo o resto: contratos, rendas, despesas e o IRS partem daqui.', botao: 'Adicionar imóvel', mais: true, tutorial: 'Como se faz · 4 passos' },
    { titulo: 'Regista os contratos', sub: 'Para as rendas passarem a aparecer sozinhas.' },
    { titulo: 'Confirma os primeiros movimentos', sub: 'É daqui que saem os números da Visão geral.' },
  ] };
}

/* A imagem da jornada: o olá da conta e o cartão dos primeiros passos, com
   o passo de agora em destaque e os botões dele (guia.js:cartaoPassos).
   Devolve: o HTML da imagem. */
function aprAPainelJornada() {
  var j = aprAPassos(), nome = aprPrimeiroNome(), n = j.ps.length;
  var passos = j.ps.map(function (q, i) {
    var agora = i === j.atual;
    return '<span class="apr-a-passo' + (q.feito ? ' feito' : agora ? ' atual' : '') + '"><span class="apr-a-n">' + (q.feito ? ic('check', 9) : String(i + 1)) + '</span>' +
      '<span class="apr-a-passo-txt"><b>' + esc(q.titulo) + '</b>' + (q.sub ? '<span class="apr-m-sub">' + esc(q.sub) + '</span>' : '') +
        (agora && q.botao ? '<span class="apr-a-passo-acoes">' + aprBotao(q.botao, { primario: true, pequeno: true, icone: q.mais ? 'plus' : '', alvo: true }) +
          (q.tutorial ? aprBotao(q.tutorial, { pequeno: true }) : '') + '</span>' : '') + '</span></span>';
  }).join('');
  return aprCena(aprAEcra('Visão geral', aprADireita('painel'),
    '<span class="apr-a-ola"><i class="imv-mosaico imv-t0"></i><b>Olá' + (nome ? ', ' + esc(nome) : '') + '. Vamos adicionar as tuas casas à app.</b></span>' +
    aprCartao('<span class="apr-m-cartao-cab"><b>Primeiros passos</b><span class="apr-m-sub">' + j.nFeitos + ' de ' + n + ' feitos</span></span>' +
      aprProgresso(j.nFeitos / n * 100, { tom: 'in' }) + '<span class="apr-a-passos">' + passos + '</span>', { classe: 'apr-a-jornada' }), true),
    { tom: 't0', arranjo: 'tela' });
}

/* A imagem de quem ainda não tem nada: o vazio da Visão geral, com o
   «Adicionar imóvel» em destaque (painel-geral.js:vDashboard) — sem ele, com
   os Imóveis desligados nesta conta.
   Devolve: o HTML da imagem. */
function aprAPainelNada() {
  var ligado = typeof servicoLigado === 'function' && servicoLigado('properties');
  return aprCena(aprAEcra('Visão geral', aprADireita('painel'),
    '<div class="apr-m-vazio"><b>Ainda não há nada registado</b><span class="apr-m-sub">Começa por adicionar um imóvel.</span>' +
      (ligado ? aprBotao('Adicionar imóvel', { primario: true, alvo: true }) : '') + '</div>', true),
    { tom: 't0', arranjo: 'tela' });
}

/* O texto da imagem de quem ainda não tem nada: o que o vazio pede e, com os
   Imóveis desligados nesta conta, quem os liga (servicos.js:fraseServicoDesligado).
   Devolve: o HTML (de confiança). */
function aprAPainelNadaTexto() {
  if (typeof servicoLigado === 'function' && servicoLigado('properties')) {
    return 'Sem nada registado, a <b>Visão geral</b> pede só o primeiro imóvel: <b>Adicionar imóvel</b> abre o formulário, e o nome chega para começar.';
  }
  return 'Sem nada registado, a <b>Visão geral</b> fica à espera do primeiro imóvel. ' + esc(typeof fraseServicoDesligado === 'function' ? fraseServicoDesligado('properties') : '');
}

/* A imagem do primeiro movimento: a nova receita atrás e, à frente, os
   indicadores que ela acende — a primeira renda do exemplo, e nada mais.
   Devolve: o HTML da imagem. */
function aprAPainelPrimeiro() {
  var ct = APR_EXEMPLO.contrato('c4'), p = APR_EXEMPLO.imovel(ct.imovel);
  return aprCena(aprPar(
    aprFolha('Nova receita', aprCampo('Descrição', 'Renda ' + ct.inquilino, { obrigatorio: true }) +
      '<span class="apr-m-grelha apr-a-grelha-2">' + aprCampo('Montante (€)', dec(Number(ct.renda).toFixed(2)), { obrigatorio: true }) + aprCampo('Imóvel', p.nome) + '</span>'),
    aprCartao(aprAQuatro({ receita: ct.renda, despesas: 0, prestacoes: 0, cashflow: ct.renda }, 0), { flutua: true, classe: 'apr-a-cartao-kpis' })
  ), { tom: 't2', arranjo: 'par' });
}

/* A imagem dos números do ano: os quatro indicadores e, por baixo, a janela
   que um toque na Receita abre — o mês a mês, os movimentos que a somam e o
   «Ver nos movimentos» (cloud/painel.js:kpiModal).
   Devolve: o HTML da imagem. */
function aprAPainelNumeros() {
  var ex = APR_EXEMPLO, a = aprAAno(), m = ex.contrato('c4');
  return aprCena(aprColuna([
    aprAQuatro(a, 0),
    aprFolha('Receita', aprATraco(ex.receitaMes, 'in') + '<span class="apr-m-rot apr-m-maiusc">Movimentos que somam este valor</span>' +
      aprLinha({ titulo: 'Renda ' + m.inquilino, sub: aprData(aprAUltimoDia(m.dia)) + ' · ' + ex.imovel(m.imovel).nome, valor: aprDinheiro(m.renda), tom: 'pos',
        botao: aprBotao('Ver nos movimentos', { primario: true, pequeno: true, icone: 'swap' }) }), { flutua: true, classe: 'apr-a-folha-kpi' }),
  ]), { tom: 't2', arranjo: 'coluna' });
}

/* Uma linha do «Pede atenção» do telemóvel (painel-geral.js:atencaoLinha):
   o ícone na cor do assunto, o que é e quanto, e a seta.
   Recebe: icone — o nome no icones.js:ic; tom — a cor do ícone ('red',
   'amber' ou '' para o cobalto); titulo, sub — as duas linhas; alvo (opcional).
   Devolve: o HTML. */
function aprAAtencao(icone, tom, titulo, sub, alvo) {
  return aprLinha({ icone: icone, tomIcone: tom, titulo: titulo, sub: sub, seta: true, alvo: alvo });
}

/* A imagem do «Pede atenção»: o ecrã da Visão geral com o cartão das linhas
   por assunto — a renda em atraso, o contrato a terminar e a atividade
   numa casa partilhada — e, por baixo, os indicadores; ou, sem movimentos
   (a cara do vazio), o vazio que leva aos Movimentos (painel-geral.js:vDashboard).
   Devolve: o HTML da imagem. */
function aprAPainelAtencao() {
  var ex = APR_EXEMPLO, tm = ex.contrato('c2'), ines = ex.contrato('c3'), helena = ex.proprietarios[0];
  var baixo = aprACaraDoPainel() === 'vazio'
    ? '<div class="apr-m-vazio"><b>Ainda não há dados para mostrar</b><span class="apr-m-sub">Os indicadores e os gráficos da vista geral saem dos movimentos.</span>' +
      aprBotao('Ir para os movimentos', { pequeno: true }) + '</div>'
    : aprAQuatro(aprAAno());
  return aprCena(aprAEcra('Visão geral', aprADireita('painel'),
    aprCartao(aprARotulo('Pede atenção') +
      aprAAtencao('repetir', 'red', '1 por confirmar', '1 em atraso · ' + aprDinheiro(tm.renda), true) +
      aprAAtencao('clock', 'amber', '1 prazo', 'Faltam ' + ines.terminaEm + ' dias · Fim do prazo do contrato') +
      aprAAtencao('users', '', '1 novidade nas casas partilhadas', helena.nome + ' · Seguro multirriscos')) +
    baixo, true),
    { tom: 't1', arranjo: 'tela' });
}

/* A imagem dos gráficos: as entradas e saídas mês a mês, com o dedo numa
   coluna e a leitura dela no canto, e por baixo as despesas por categoria.
   Devolve: o HTML da imagem. */
function aprAPainelGraficos() {
  var ex = APR_EXEMPLO, n = ex.receitaMes.length, k = n - 2;
  var colunas = ex.receitaMes.map(function (r, i) {
    return { rotulo: MES[i], cima: r, baixo: [[ex.prestacaoMes, 'loan'], [ex.despesaMes[i], 'out']] };
  });
  var a = aprAAno();
  return aprCena(aprColuna([
    aprACartao('Entradas e saídas', 'mês a mês', '<span class="apr-a-graf-cab">' +
        aprALegenda([['Receita', 'in'], ['Despesas', 'out'], ['Prestações', 'loan']]) +
        aprALeitura(MES[k], [['Receita', aprDinheiro(ex.receitaMes[k]), 'in'], ['Despesas', aprDinheiro(-ex.despesaMes[k]), 'out'],
          ['Prestações', aprDinheiro(-ex.prestacaoMes), 'loan']]) + '</span>' +
      aprAColunas(colunas, { aceso: k, dedo: true }), { flutua: true }),
    aprACartao('Despesas por categoria', '', aprADonut(aprACategorias(), money(a.despesas), today().slice(0, 4)) +
      '<span class="apr-m-sub">Toca numa categoria para veres as subcategorias.</span>'),
  ]), { tom: 't3', arranjo: 'coluna' });
}

/* A imagem do «Personalizar painel»: o painel em modo de arrumar — a barra
   com «Repor ordem» e «Concluir», os cartões com a pega e um deles a ser
   levado — e, à frente, o painel do funil com o imóvel em foco.
   Devolve: o HTML da imagem. */
function aprAPainelArrumar() {
  var ex = APR_EXEMPLO, a = aprAAno(), acum = 0;
  var cum = ex.receitaMes.map(function (r, i) { acum += r - ex.despesaMes[i] - ex.prestacaoMes; return acum; });
  var pega = '<span class="apr-a-pega">' + ic('grip', 12) + '</span>';
  return aprCena(aprPar(
    aprCartao('<span class="apr-a-edicao"><span class="apr-m-sub">Arrasta os cartões para mudar a ordem.</span>' +
        aprBotao('Repor ordem', { pequeno: true }) + aprBotao('Concluir', { primario: true, pequeno: true, icone: 'check' }) + '</span>' +
      '<span class="apr-a-arrumar">' +
        aprACartao('Cashflow acumulado', '', aprATraco(cum), { acao: pega, classe: 'apr-a-levado apr-flutua' }) +
        aprACartao('Renda por contrato', aprDinheiro(a.rendaMes) + '/mês', '', { acao: pega }) + '</span>', { classe: 'apr-a-cartao-edicao' }),
    aprCartao(aprASeletor('Todos os imóveis', true) + '<span class="apr-a-opcoes">' +
      ['T3 Bonfim', 'T2 Paranhos', 'T0 Campanhã'].map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</span>' +
      '<span class="apr-a-pe">' + aprBotao('Limpar', { pequeno: true, icone: 'x' }) + aprBotao('Fechar', { primario: true, pequeno: true, icone: 'check' }) + '</span>',
    { flutua: true, classe: 'apr-a-painel-filtro' })
  ), { tom: 't0', arranjo: 'par' });
}

/* A imagem da dica da jornada: o fim do cartão dos passos com «Dispensar os
   primeiros passos» em destaque e, por baixo, os tutoriais de «Como se faz»
   na Ajuda (ajuda.js:tutoriaisNaAjuda), como a Ajuda os mostra a esta conta.
   Devolve: o HTML da imagem. */
function aprAPainelDispensar() {
  var ts = [];
  try { ts = window.CW && typeof CW.listaDeTutoriais === 'function' ? CW.listaDeTutoriais() : []; } catch (e) { ts = []; }
  if (!ts.length) {
    ts = [{ titulo: 'Preencher o teu perfil', passos: 3, resumo: 'Os teus dados nos contratos' },
      { titulo: 'Adicionar o primeiro imóvel', passos: 4, resumo: 'O nome chega para começar' }];
  }
  var mosaicos = ts.slice(0, 3).map(function (t) {
    return '<span class="apr-a-tutorial"><span class="apr-m-sub">' + esc(t.passos + ' passos') + '</span><b>' + esc(t.titulo) + '</b>' +
      (t.visto ? aprSelo('Visto', 'in') : '<span class="apr-m-sub">' + esc(t.resumo || '') + '</span>') + '</span>';
  }).join('');
  var j = aprAPassos(), ult = j.ps[j.ps.length - 1];
  return aprCena(aprColuna([
    aprCartao('<span class="apr-a-passos"><span class="apr-a-passo"><span class="apr-a-n">' + j.ps.length + '</span><span class="apr-a-passo-txt"><b>' +
      esc(ult.titulo) + '</b><span class="apr-m-sub">' + esc(ult.sub || '') + '</span></span></span></span>', { classe: 'apr-a-jornada apr-a-fim-passos' }),
    '<span class="apr-a-fantasma apr-alvo">Dispensar os primeiros passos</span>',
    '<span class="apr-m-desce">' + ic('down', 12) + '</span>',
    aprCartao('<span class="apr-m-cartao-cab"><b>Como se faz</b><span class="apr-m-sub">na Ajuda</span></span><span class="apr-a-tutoriais">' + mosaicos + '</span>'),
  ]), { tom: 't3', arranjo: 'coluna' });
}

/* O que o cargo deixa fazer, para a imagem de quem só colabora: os botões do
   «O que podes fazer» (acessos.js:acoesDoColaborador) e quem deu acesso a
   quantos imóveis (acessos.js:resumoColaborador). Sem cargo à mão (a imagem
   revista noutra cara), um exemplo.
   Devolve: {acoes: [rótulos], donos, n, cargos}. */
function aprACargo() {
  var acoes = [], r = null;
  try { acoes = typeof acoesDoColaborador === 'function' ? acoesDoColaborador().map(function (a) { return a.rotulo; }) : []; } catch (e) { acoes = []; }
  try { r = typeof resumoColaborador === 'function' ? resumoColaborador() : null; } catch (e) { r = null; }
  if (!r || !r.n) return { acoes: ['Marcar visita', 'Adicionar inquilino'], donos: ['Helena Moreira'], n: 2, cargos: ['Gestor'] };
  return { acoes: acoes, donos: r.donos || [], n: r.n, cargos: r.cargos || [] };
}

/* A imagem do «O que podes fazer»: o cartão do topo da Visão geral de quem
   só colabora, com quem deu acesso e um botão por cada coisa que o cargo deixa.
   Devolve: o HTML da imagem. */
function aprAPainelPodes() {
  var c = aprACargo();
  var quem = (c.donos.length ? listaE(c.donos) + ' deu-te acesso a ' : 'Tens acesso a ') + (c.n === 1 ? '1 imóvel' : c.n + ' imóveis') +
    (c.cargos.length ? ', com o cargo ' + listaE(c.cargos) : '') + '.';
  var botoes = c.acoes.length
    ? '<span class="apr-a-botoes">' + c.acoes.slice(0, 4).map(function (r, i) { return aprBotao(r, { primario: !i, pequeno: true, alvo: !i }); }).join('') + '</span>'
    : '<span class="apr-m-sub">O teu cargo deixa-te consultar estes imóveis, sem adicionar nada.</span>';
  return aprCena(aprAEcra('Visão geral', aprADireita('painel'),
    aprACartao('O que podes fazer', '', '<span class="apr-m-sub">' + esc(quem) + '</span>' + botoes), true),
    { tom: 't2', arranjo: 'tela' });
}

/* A imagem de quem só colabora sem as finanças: a frase que o diz e o «Ver
   os imóveis», com um imóvel de quem deu acesso por baixo.
   Devolve: o HTML da imagem. */
function aprAPainelSemContas() {
  var c = aprACargo(), p = APR_EXEMPLO.imovel('paranhos');
  var selo = [c.donos[0] ? 'de ' + c.donos[0] : '', c.cargos[0] || ''].filter(Boolean).join(' · ');
  return aprCena(aprColuna([
    aprCartao('<span class="apr-m-sub">As finanças destes imóveis ficam com o dono: o teu cargo não as abre, e por isso aqui não há contas.</span>' +
      aprBotao('Ver os imóveis', { icone: 'building', pequeno: true, alvo: true }), { classe: 'apr-a-semcontas' }),
    aprCartao(aprLinha({ capa: p.tom, titulo: p.nome, sub: p.morada, selos: selo ? [[selo, 'grey']] : [] }), { flutua: true }),
  ]), { tom: 't3', arranjo: 'coluna' });
}

registarApresentacao('dashboard', {
  nome: 'Visão geral',
  resumo: 'Os números do ano e o que pede atenção',
  imagens: [
    { titulo: 'Primeiros passos, um de cada vez',
      texto: 'Enquanto não há movimentos, a <b>Visão geral</b> é a lista dos primeiros passos. Só o de agora tem botões: o que o faz e o <b>Como se faz</b>, com o tutorial dele.',
      maquete: aprAPainelJornada, quando: function () { return aprAPainelEm(['jornada']); } },
    { titulo: 'O teu ano num relance',
      texto: 'A <b>Visão geral</b> soma o que entrou e saiu este ano: a receita, as despesas, as prestações e o cashflow. Toca num indicador para veres a evolução e os movimentos que o somam.',
      maquete: aprAPainelNumeros, quando: function () { return aprAPainelEm(['numeros']); } },
    { titulo: 'O que o teu cargo deixa fazer',
      texto: 'Quem colabora vê no cimo da <b>Visão geral</b> um botão por cada coisa que o cargo deixa fazer nos imóveis a que tem acesso.',
      maquete: aprAPainelPodes, quando: function () { return aprAPainelEm(['podes']); } },
    { titulo: 'Primeiro, um imóvel', texto: aprAPainelNadaTexto,
      maquete: aprAPainelNada, quando: function () { return aprAPainelEm(['nada']); } },
    { titulo: 'Os números saem dos movimentos',
      texto: 'Com a primeira renda ou despesa registada, a <b>Visão geral</b> passa a somar o ano: a receita, as despesas, as prestações e o cashflow, com os gráficos mês a mês.',
      maquete: aprAPainelPrimeiro, quando: function () { return aprAPainelEm(['jornada', 'vazio', 'nada']); } },
    { titulo: 'No cimo, o que pede atenção',
      texto: 'No cimo vai só o que muda decisões: os planeados por confirmar, os prazos legais e fiscais, os pedidos por responder. Um toque leva-te ao que há a fazer.',
      maquete: aprAPainelAtencao, quando: function () { return aprAPainelEm(['numeros', 'vazio']); } },
    { titulo: 'Um gráfico lê-se com o dedo',
      texto: 'Percorre as <b>Entradas e saídas</b> com o dedo, ou com o rato carregado: os valores do mês ficam no canto, onde a mão não tapa. Nas despesas, toca numa categoria para veres as subcategorias.',
      maquete: aprAPainelGraficos, quando: function () { return aprAPainelEm(['numeros']); } },
    { titulo: 'O painel arruma-se à tua maneira',
      texto: 'No fim da página, <b>Personalizar painel</b> deixa-te arrastar os cartões para a ordem que quiseres. O funil do cabeçalho mostra o painel de um imóvel ou de um grupo.',
      maquete: aprAPainelArrumar, quando: aprAPodeArrumar },
    { titulo: 'Os tutoriais ficam na Ajuda',
      texto: '<b>Dispensar os primeiros passos</b>, por baixo do cartão, deixa de os mostrar neste aparelho. Os tutoriais de cada passo continuam em <b>Ajuda → Como se faz</b>.',
      maquete: aprAPainelDispensar, quando: function () { return aprAPainelEm(['jornada']); } },
    { titulo: 'As contas ficam com o dono',
      texto: 'O teu cargo não abre as finanças destes imóveis, e por isso aqui não há indicadores nem gráficos. Os imóveis estão em <b>Casas → Imóveis</b>.',
      maquete: aprAPainelSemContas, quando: function () { return aprAPainelEm(['podes']); } },
  ],
});

/* -------------------------------------------------------- a Avaliação */

/* O herói da Avaliação (avaliacao.js:avaHeroi): o valor de mercado e o
   valor por rendimento em duas barras à mesma escala, a diferença em grande
   e a frase que a lê.
   Recebe: valor — o valor de mercado; noiAnual — o resultado anualizado;
   conta (opcional) — verdade para a linha da conta por baixo.
   Devolve: o HTML do corpo do cartão. */
function aprAHeroi(valor, noiAnual, conta) {
  var y = aprAAno().yieldExigido, rend = noiAnual / (y / 100), dif = valor > 0 ? rend / valor - 1 : NaN, topo = Math.max(valor, rend, 1);
  return '<span class="apr-a-heroi"><span class="apr-a-barra-lin"><span>Valor de mercado</span><b>' + esc(money(valor)) + '</b></span>' +
      '<span class="apr-a-mercado">' + aprProgresso(valor / topo * 100) + '</span>' +
      '<span class="apr-a-barra-lin apr-a-rend"><span>Valor por rendimento</span><b>' + esc(money(rend)) + '</b></span>' + aprProgresso(rend / topo * 100) +
      '<b class="apr-a-dif ' + (dif >= 0 ? 'pos' : 'neg') + '">' + esc((dif >= 0 ? '+' : '') + pct(dif)) + '</b>' +
      '<span class="apr-a-frase">' + esc(dif >= 0 ? 'As rendas de hoje justificam mais do que o valor de mercado.' : 'As rendas de hoje justificam menos do que o valor de mercado.') + '</span>' +
      (conta ? '<span class="apr-m-sub">' + esc('Resultado anualizado de ' + money(noiAnual) + ' ÷ yield exigido de ' + pct(y / 100) + '.') + '</span>' : '') +
    '</span>';
}

/* A imagem do herói: o ecrã da Avaliação com o chip «Imóvel», o botão de
   partilha e o herói do portefólio.
   Devolve: o HTML da imagem. */
function aprAAvaliacaoHeroi() {
  var a = aprAAno();
  return aprCena(aprAEcra('Avaliação', aprADireita('roda'),
    '<span class="apr-a-topo">' + aprAChipImovel('') + '<span class="apr-a-icobotao">' + ic('partilhar', 12) + '</span></span>' +
    aprCartao(aprAHeroi(a.valor, a.noiAnual, true), { classe: 'apr-a-cartao-heroi' })),
    { tom: 't0', arranjo: 'tela' });
}

/* A imagem dos rácios: os cinco cartões (o equity e os quatro de sempre,
   avaliacao.js:rentGrid), com a conta que os dá, e a conta de exploração
   por baixo, com o NOI na faixa (avaliacao.js:contaCard).
   Devolve: o HTML da imagem. */
function aprAAvaliacaoRacios() {
  var a = aprAAno();
  var linha = function (r, v, c, x) { return '<span class="apr-a-ce' + (x ? ' ' + x : '') + '"><span>' + esc(r) + '</span><b class="apr-m-valor ' + (c || '') + '">' + esc(v) + '</b></span>'; };
  return aprCena(aprColuna([
    aprAKpis([
      aprAKpi('Equity', money(a.valor - a.divida), { nota: 'mercado − dívida' }),
      aprAKpi('Yield bruto', pct(a.rendaAno / a.valorArrendados), { nota: 'renda ÷ valor', alvo: true }),
      aprAKpi('Cap rate', pct(a.noiAnual / a.valor), { nota: 'NOI ÷ valor' }),
      aprAKpi('Sobre a aquisição', pct(a.cashflow / a.aquisicao), { nota: 'cashflow ÷ aquisição' }),
      aprAKpi('LTV', pct(a.divida / a.valor), { nota: 'dívida ÷ valor' }),
    ], true),
    aprACartao('Conta de exploração · ' + today().slice(0, 4), '',
      linha('Rendas recebidas', money(a.receita), 'pos') + linha('Despesas operacionais', money(-a.despesas), 'neg') +
      linha('Resultado líquido (NOI)', money(a.noi), '', 'noi') + linha('Prestações pagas', money(-a.prestacoes), 'prest') +
      linha('Cashflow', money(a.cashflow), '', 'cf'), { flutua: true }),
  ]), { tom: 't2', arranjo: 'coluna' });
}

/* A imagem «Por imóvel»: a tabela com a ocupação, o valor e o cashflow de
   cada imóvel atrás, com a linha do T2 Paranhos em destaque, e à frente a
   avaliação dele, com o chip do imóvel em foco.
   Devolve: o HTML da imagem. */
function aprAAvaliacaoTabela() {
  var ex = APR_EXEMPLO, por = aprAPorImovel(), p = ex.imovel('paranhos');
  var estado = function (im) {
    var r = ex.rendaDe(im.id);
    if (!r) return aprSelo('Vago', 'amber');
    return im.modo === 'quartos' ? aprSelo(ex.contratosDe(im.id).length + '/' + im.quartos + ' quartos') : aprSelo('Arrendado', 'in');
  };
  var linhas = ex.imoveis.map(function (im) {
    var cf = por[im.id].cashflow;
    return ['<b>' + esc(im.nome) + '</b>', estado(im), esc(money(im.valor)), '<b class="apr-m-valor ' + (cf < 0 ? 'neg' : '') + '">' + esc(money(cf)) + '</b>'];
  });
  return aprCena(aprPar(
    aprACartao('Por imóvel', ex.imoveis.length + ' imóveis', aprATabela(['Imóvel', 'Ocupação', 'Valor', 'Cashflow'], linhas, { alvo: 1 })),
    aprCartao('<span class="apr-a-topo">' + aprAChipImovel(p.nome) + '</span>' + aprAHeroi(p.valor, por.paranhos.noiAnual), { flutua: true })
  ), { tom: 't1', arranjo: 'par' });
}

/* A imagem das opções e da partilha: a janela «Opções da avaliação» com o
   yield exigido (avaliacao.js:avaOpcoes) atrás e o menu do botão de
   partilha à frente (avaliacao.js:avaPartilha).
   Devolve: o HTML da imagem. */
function aprAAvaliacaoOpcoes() {
  var y = aprAAno().yieldExigido;
  return aprCena(aprPar(
    aprFolha('Opções da avaliação', '<span class="apr-a-opcao"><span><b>Yield exigido</b><span class="apr-m-sub">O resultado anual de cada imóvel a dividir por este yield dá o valor por rendimento</span></span>' +
      '<span class="apr-m-caixa apr-a-valor apr-alvo">' + esc(dec(y.toFixed(1))) + '<span class="apr-m-sub">%</span></span></span>' +
      '<span class="apr-m-sub">Tem de ser maior que zero; em branco volta aos 5 %.</span>'),
    aprCartao(aprLinha({ icone: 'partilhar', titulo: 'Partilhar avaliação' }) + aprLinha({ icone: 'down', titulo: 'Exportar movimentos (CSV)' }), { flutua: true, classe: 'apr-a-menu' })
  ), { tom: 't3', arranjo: 'par' });
}

registarApresentacao('reports', {
  nome: 'Avaliação',
  resumo: 'Quanto valem as casas pelo que rendem',
  imagens: [
    { titulo: 'Quanto valem pelo que rendem',
      texto: 'Em <b>Análise → Avaliação</b>, o valor de mercado fica ao lado do valor por rendimento: o resultado anual a dividir pelo yield que exiges. A diferença diz se as rendas justificam o preço.',
      maquete: aprAAvaliacaoHeroi },
    { titulo: 'Os rácios e a conta do ano',
      texto: 'Por baixo, o equity, o yield bruto, o cap rate, o retorno sobre a aquisição e o LTV; um toque abre a explicação ou a evolução de cada um. A conta de exploração chega ao NOI e ao cashflow.',
      maquete: aprAAvaliacaoRacios },
    { titulo: 'Do portefólio para cada imóvel',
      texto: 'A tabela <b>Por imóvel</b> compara as casas lado a lado. Toca numa linha e a página passa a ser a avaliação desse imóvel; o × do chip <b>Imóvel</b> volta ao portefólio.',
      maquete: aprAAvaliacaoTabela },
    { titulo: 'O yield exigido muda-se na roda',
      texto: 'A roda dentada do cabeçalho muda o yield exigido (em branco, 5 %), e a avaliação acompanha. O botão de partilha partilha-a em texto, ou exporta os movimentos em CSV.',
      maquete: aprAAvaliacaoOpcoes },
  ],
});

/* -------------------------------------------------------- as Projeções */

/* As colunas de um gráfico das Projeções (projecoes.js:prjFluxos): as
   rendas para cima; as prestações, as despesas e o IRS para baixo.
   Recebe: anos — as linhas do aprAProjecao.
   Devolve: as colunas para o aprAColunas. */
function aprAColunasDaProjecao(anos) {
  return anos.map(function (r) {
    return { rotulo: String(r.ano).slice(2), cima: r.rendas, baixo: [[r.prestacoes, 'loan'], [r.despesas, 'out'], [r.irs, 'irs']] };
  });
}

/* A imagem da projeção: o ecrã das Projeções com dois indicadores (a renda
   de hoje e a do último ano) e as entradas e saídas dos dez anos.
   Devolve: o HTML da imagem. */
function aprAProjecoesFluxos() {
  var pj = aprAProjecao().anos, ini = pj[0], fim = pj[pj.length - 1];
  return aprCena(aprAEcra('Projeções', aprADireita('roda'),
    aprAKpis([aprAKpi('Renda anual hoje', money(ini.rendas), { nota: 'a preços de ' + ini.ano }),
      aprAKpi('Cashflow em ' + fim.ano, money(fim.cashflow), { tom: fim.cashflow >= 0 ? 'pos' : 'neg', nota: 'com IRS, despesas e prestações' })]) +
    aprACartao('Entradas e saídas por ano', '', aprALegenda([['Rendas', 'in'], ['IRS', 'irs'], ['Despesas', 'out'], ['Prestações', 'loan']]) +
      aprAColunas(aprAColunasDaProjecao(pj)), { classe: 'apr-a-cartao-prj' })),
    { tom: 't0', arranjo: 'tela' });
}

/* A imagem «Ano a ano»: a tabela com uma coluna por contrato atrás (a do
   Quarto 3 com «—» depois de ele acabar) e, à frente, a dívida por
   amortizar, pelo plano da hipoteca.
   Devolve: o HTML da imagem. */
function aprAProjecoesTabela() {
  var ex = APR_EXEMPLO, pj = aprAProjecao().anos, fim = pj[pj.length - 1];
  // duas das colunas dos contratos (a do Quarto 3 com o «—» depois de acabar), e os totais
  var ids = ['c1', 'c3'], cab = ['Ano'].concat(ids.map(function (id) { return ex.contrato(id).parte; }), ['Rendas', 'Cashflow']);
  var linhas = pj.slice(0, 5).map(function (r) {
    return ['<b>' + r.ano + '</b>'].concat(ids.map(function (id) { return r.porContrato[id] ? esc(money(r.porContrato[id])) : '—'; }),
      ['<b class="apr-m-valor pos">' + esc(money(r.rendas)) + '</b>', '<b class="apr-m-valor ' + (r.cashflow < 0 ? 'neg' : 'pos') + '">' + esc(money(r.cashflow)) + '</b>']);
  });
  return aprCena(aprPar(
    aprACartao('Ano a ano', 'uma coluna por contrato', aprATabela(cab, linhas, { cols: 'c5' })),
    aprACartao('Dívida por amortizar', '', '<span class="apr-a-barra-lin"><span>No fim de ' + fim.ano + '</span><b>' + esc(money(fim.divida)) + '</b></span>' +
      aprATraco([ex.creditos[0].divida].concat(pj.map(function (r) { return r.divida; })), 'loan'), { flutua: true })
  ), { tom: 't2', arranjo: 'par' });
}

/* A imagem das renovações: o aviso «A projeção não inventa renovações»
   (projecoes.js:prjRenovacoes) com o contrato que acaba dentro do horizonte
   e o «Ver contratos», e por baixo as rendas a descer no ano a seguir.
   Devolve: o HTML da imagem. */
function aprAProjecoesRenovacoes() {
  var ex = APR_EXEMPLO, pj = aprAProjecao(), c = ex.contrato('c3');
  var nome = c.inquilino + ' · ' + c.parte;
  return aprCena(aprColuna([
    aprCartao('<span class="apr-a-aviso">' + ic('aviso', 14) + '<span><b>A projeção não inventa renovações.</b> ' +
      esc('O contrato de ' + nome + ' acaba em ' + pj.fimQuarto3.slice(0, 4) + '. Regista as renovações nos contratos para veres anos realistas.') + '</span></span>' +
      aprBotao('Ver contratos', { pequeno: true, alvo: true }), { classe: 'apr-a-cartao-aviso', flutua: true }),
    aprACartao('Rendas por ano', '', aprAColunas(pj.anos.slice(0, 5).map(function (r) { return { rotulo: String(r.ano), valor: money(r.rendas), cima: r.rendas, baixo: [] }; }), { aceso: 1 }),
      { classe: 'apr-a-so-rendas' }),
  ]), { tom: 't1', arranjo: 'coluna' });
}

/* A imagem das opções: a janela «Opções da projeção» (projecoes.js:prjOpcoes)
   com o horizonte, o aumento e a inflação atrás e, à frente, o chip «Imóvel»
   com um imóvel em foco.
   Devolve: o HTML da imagem. */
function aprAProjecoesOpcoes() {
  var b = APR_EXEMPLO.imovel('bonfim'), rendaB = APR_EXEMPLO.rendaDe('bonfim') * 12;
  var opcao = function (t, s, v, u, alvo) {
    return '<span class="apr-a-opcao"><span><b>' + esc(t) + '</b><span class="apr-m-sub">' + esc(s) + '</span></span>' +
      '<span class="apr-m-caixa apr-a-valor' + (alvo ? ' apr-alvo' : '') + '">' + esc(v) + '<span class="apr-m-sub">' + esc(u) + '</span></span></span>';
  };
  return aprCena(aprPar(
    aprFolha('Opções da projeção', opcao('Horizonte', 'Quantos anos a projeção mostra, de 1 a 30', '10', 'anos', true) +
      opcao('Aumento das rendas', 'Por ano, nos contratos sem aumento próprio', '2', '%') +
      opcao('Inflação das despesas', 'Por ano, faz crescer as despesas previstas', '2', '%')),
    aprCartao('<span class="apr-a-topo">' + aprAChipImovel(b.nome) + '</span>' + aprAKpi('Renda anual hoje', money(rendaB), { nota: 'a preços de ' + today().slice(0, 4) }), { flutua: true, classe: 'apr-a-cartao-foco' })
  ), { tom: 't0', arranjo: 'par' });
}

registarApresentacao('projections', {
  nome: 'Projeções',
  resumo: 'Os próximos anos, a partir do registado',
  imagens: [
    { titulo: 'Os próximos anos, ano a ano',
      texto: 'Em <b>Análise → Projeções</b>, cada ano soma as rendas dos contratos, com o aumento de cada um, e desconta o IRS, as despesas planeadas e as prestações das hipotecas.',
      maquete: aprAProjecoesFluxos },
    { titulo: 'Contrato a contrato',
      texto: 'A tabela <b>Ano a ano</b> tem uma coluna por contrato, e as rendas, o IRS, as despesas, as prestações e o cashflow. Com hipotecas, o gráfico da dívida diz quanto falta no fim de cada ano.',
      maquete: aprAProjecoesTabela },
    { titulo: 'A projeção não inventa renovações',
      texto: 'Um contrato conta até ao dia em que acaba: a renovação só entra quando está registada nele. Os que acabam dentro do horizonte vêm num aviso, com <b>Ver contratos</b>.',
      maquete: aprAProjecoesRenovacoes },
    { titulo: 'Os números afinam-se na roda',
      texto: 'A roda dentada do cabeçalho muda o horizonte (de 1 a 30 anos), o aumento das rendas e a inflação das despesas. O chip <b>Imóvel</b> projeta um imóvel ou um grupo.',
      maquete: aprAProjecoesOpcoes },
  ],
});

/* ---------------------------------------------------- o IRS · Anexo F */

/* A Declaração existe nesta conta e neste ambiente? Só fora de produção
   (servicos.js, o soDev do fisco) e com o serviço ligado: em produção a
   apresentação fica sem imagens, e não abre nem aparece na Ajuda.
   Devolve: true/false. */
function aprAFiscoAqui() { return typeof servicoLigado === 'function' && servicoLigado('fisco'); }

/* A faixa das regras do ano (fisco.js:fiscoAnoCard): o selo do modelo e o
   ano dos rendimentos com o prazo da entrega, lidos da versão do ano
   (irs.js:irsAno), e o «Guia de preenchimento».
   Recebe: ano — o ano dos rendimentos.
   Devolve: o HTML. */
function aprAFiscoFaixa(ano) {
  var selo = '', entrega = 'Rendimentos de ' + ano;
  try {
    var v = typeof irsAno === 'function' ? irsAno(ano) : null;
    if (v) {
      selo = !v.exato ? aprSelo('Regras de ' + v.ano, 'amber') : v.modelo && v.modelo.oficial ? aprSelo('Modelo oficial') : aprSelo('Versão provisória', 'amber');
      // os rendimentos já estão no título («IRS 2026»): a linha diz só a entrega
      if (v.entrega && typeof irsDiaMes === 'function') entrega = 'Entrega de ' + irsDiaMes(v.entrega.de) + ' a ' + irsDiaMes(v.entrega.ate) + ' de ' + String(v.entrega.ate).slice(0, 4);
    }
  } catch (e) { selo = ''; }
  return '<span class="apr-a-faixa">' + selo + '<b>IRS ' + ano + '</b><span class="apr-m-sub">' + esc(entrega) + '</span></span>';
}

/* A imagem do resumo: o ecrã do IRS · Anexo F com o ano em chips e o
   titular, a faixa das regras do ano e o começo do resumo dos quadros 4.1 e
   4.2, uma linha por contrato com as rendas e o imposto estimado
   (fisco.js:fisResumoQuadros).
   Devolve: o HTML da imagem. */
function aprAFiscoResumo() {
  var ex = APR_EXEMPLO, ano = aprAFiscoAno(), f = aprAFisco(ano), n = ex.receitaMes.length;
  // a parte do imposto de cada linha, pelas rendas dela (o resumo da app reparte os gastos por imóvel)
  var linha = function (q, id) {
    var c = ex.contrato(id), r = c.renda * n;
    return [aprSelo(q), esc(c.inquilino), esc(aprDinheiro(r)), '<b>' + esc(aprDinheiro(f.imposto * r / f.rendas)) + '</b>'];
  };
  return aprCena(aprAEcra('IRS · Anexo F', aprADireita('funil'),
    '<span class="apr-a-anos">' + aprChips([String(ano - 1), String(ano)], [1]) + '<span class="apr-m-chip apr-a-chip">Todos · por inteiro' + ic('chevD', 10) + '</span></span>' +
    aprAFiscoFaixa(ano) +
    aprACartao('Quadros 4.1 e 4.2', 'um contrato por linha', aprATabela(['Quadro', 'Contrato', 'Rendas', 'Imposto'],
      [linha('4.2', 'c4'), linha('4.1', 'c5'), linha('4.1', 'c1')], { cols: 'q4' }), { classe: 'apr-a-cartao-quadros' })),
    { tom: 't0', arranjo: 'tela' });
}

/* Um ponto de «A tratar antes de entregar» (fisco.js:fiscoObrigacoesCard): o
   número no selo do nível, o que falta e o botão que abre o sítio.
   Recebe: n — o número; tom — o do selo ('red' o que falta à AT, 'amber' o
   que convém tratar); texto — o que falta; botao — o rótulo do botão; alvo (opcional).
   Devolve: o HTML. */
function aprAPonto(n, tom, texto, botao, alvo) {
  return '<span class="apr-a-ponto">' + aprSelo(String(n), tom) + '<span class="apr-a-ponto-txt">' + esc(texto) + '</span>' + aprBotao(botao, { pequeno: true, alvo: alvo }) + '</span>';
}

/* A imagem do que falta: o cartão «A tratar antes de entregar», com três
   pontos do exemplo e a frase de que a app resume e não declara.
   Devolve: o HTML da imagem. */
function aprAFiscoTratar() {
  var ex = APR_EXEMPLO, ano = aprAFiscoAno();
  return aprCena(aprColuna([
    aprCartao('<span class="apr-m-cartao-cab"><b>A tratar antes de entregar ' + aprSelo('3', 'amber') + '</b><span class="apr-m-sub">3 pontos de ' + ano + '</span></span>' +
      aprAPonto(1, 'red', 'Inquilino ' + ex.inquilino('tiago').nome + ': sem NIF nem país de residência', 'Abrir inquilino', true) +
      aprAPonto(2, 'red', 'Imóvel ' + ex.imovel('campanha').nome + ': sem artigo matricial', 'Abrir imóvel') +
      aprAPonto(3, 'amber', '2 rendas de ' + ano + ' sem recibo eletrónico emitido', 'Ver movimentos') +
      '<span class="apr-m-sub apr-a-nota">A app resume, não declara: o que falta fica escrito aqui e ao pé de cada linha dos quadros.</span>', { flutua: true }),
  ]), { tom: 't1', arranjo: 'coluna' });
}

/* A imagem da situação: «A tua situação fiscal» com os dois interruptores
   atrás (fisco.js:fiscoSituacaoCard) e, à frente, «Englobar ou não?» com os
   outros rendimentos do exemplo e as duas contas (fisco.js:fiscoEnglobamentoCard).
   Sem escalões na versão do ano, a da frente fica de fora.
   Devolve: o HTML da imagem. */
function aprAFiscoSituacao() {
  var ano = aprAFiscoAno(), f = aprAFisco(ano);
  var linha = function (t, s, on) {
    return '<span class="apr-a-sit"><span><b>' + esc(t) + '</b>' + (s ? '<span class="apr-m-sub">' + esc(s) + '</span>' : '') + '</span>' + aprAInterruptor(on) + '</span>';
  };
  var atras = aprACartao('A tua situação fiscal', 'grava ao mexer',
    linha('Tributação conjunta', 'Casados ou unidos de facto', false) + linha('Dispensa dos recibos eletrónicos', 'Com ela, o Modelo 44', false));
  if (f.englobando == null) return aprCena(aprColuna([atras]), { tom: 't2', arranjo: 'coluna' });
  var dif = aprACent(f.imposto - f.englobando);
  var veredito = !dif ? 'Dá o mesmo englobar ou não.' : dif > 0 ? 'Englobar compensa: menos ' + aprDinheiro(dif) + ' de imposto.' : 'Não englobar compensa: menos ' + aprDinheiro(-dif) + ' de imposto.';
  return aprCena(aprPar(atras,
    aprACartao('Englobar ou não?', 'quadro 6G', aprCampo('Outros rendimentos do agregado', money(f.outros)) +
      '<span class="apr-a-ce"><span>Sem englobar</span><b>' + esc(aprDinheiro(f.imposto)) + '</b></span>' +
      '<span class="apr-a-ce"><span>Englobando</span><b>' + esc(aprDinheiro(f.englobando)) + '</b></span>' +
      '<span class="apr-a-veredito">' + ic('check', 11) + esc(veredito) + '</span>', { flutua: true })
  ), { tom: 't2', arranjo: 'par' });
}

/* A imagem do titular e do guia: o painel do funil com o titular e o ano
   (fisco.js:vFisco) atrás e, à frente, a barra com o chip do titular
   escolhido, na quota-parte, e a dobra «Como preencher, passo a passo» com
   os passos do guia da versão do ano (irs.js:irsAno).
   Devolve: o HTML da imagem. */
function aprAFiscoTitular() {
  var h = APR_EXEMPLO.proprietarios[0], ano = aprAFiscoAno(), n = 8;
  try { n = typeof irsAno === 'function' ? (irsAno(ano).passos || []).length || n : n; } catch (e) { n = 8; }
  return aprCena(aprPar(
    aprCartao(aprASeletor(h.nome, true) + aprASeletor(String(ano)) +
      '<span class="apr-m-sub">O Anexo F é por titular: com um escolhido, rendas e gastos entram na quota-parte dele.</span>' +
      '<span class="apr-a-pe">' + aprBotao('Limpar', { pequeno: true, icone: 'x' }) + aprBotao('Fechar', { primario: true, pequeno: true, icone: 'check' }) + '</span>',
    { classe: 'apr-a-painel-filtro' }),
    aprCartao('<span class="apr-a-titular"><span class="apr-m-rot apr-m-maiusc">Titular</span><span class="apr-m-chip on apr-a-chip">' + esc(h.nome + ' · quota-parte') + ic('x', 10) + '</span></span>' +
      '<span class="apr-a-dobra">' + ic('info', 12) + '<b>Como preencher, passo a passo</b><span class="apr-m-sub">' + n + ' passos</span>' + ic('chevD', 11) + '</span>',
    { flutua: true, classe: 'apr-a-cartao-titular' })
  ), { tom: 't3', arranjo: 'par' });
}

registarApresentacao('fisco', {
  nome: 'IRS · Anexo F',
  resumo: 'O resumo para preencheres o Anexo F',
  imagens: [
    { titulo: 'O resumo para o Anexo F',
      texto: 'Em <b>Análise → IRS · Anexo F</b>, as rendas e os gastos de cada contrato chegam arrumados pelos quadros 4.1 e 4.2, com o imposto estimado. A app resume; quem declara és tu, no Portal das Finanças.',
      maquete: aprAFiscoResumo, quando: aprAFiscoAqui },
    { titulo: 'O que falta, antes de entregar',
      texto: '<b>A tratar antes de entregar</b> numera o que falta nos teus dados, como um NIF ou um artigo matricial, com o botão que abre o sítio onde se trata. A app não inventa códigos nem números.',
      maquete: aprAFiscoTratar, quando: aprAFiscoAqui },
    { titulo: 'O que só tu sabes',
      texto: 'Em <b>A tua situação fiscal</b> dizes se há tributação conjunta e se tens dispensa dos recibos eletrónicos. <b>Englobar ou não?</b> estima o imposto com e sem englobamento.',
      maquete: aprAFiscoSituacao, quando: aprAFiscoAqui },
    { titulo: 'Por titular, com o guia do ano',
      texto: 'O Anexo F é por titular: escolhe-o no chip <b>Titular</b>, e as rendas e os gastos entram na quota-parte dele. No fim, <b>Como preencher, passo a passo</b> diz o que vai a cada quadro.',
      maquete: aprAFiscoTitular, quando: aprAFiscoAqui },
  ],
});

/* ------------------------------------------------------ as Definições */

/* Um resumo das Definições como a raiz o escreve (definicoes.js:
   resumoDasCategorias, resumoDosValores, resumoDosFiltros), ou o de
   omissão sem a função.
   Recebe: f — o nome da função; omissao — o texto sem ela.
   Devolve: o texto. */
function aprAResumo(f, omissao) {
  try { return typeof window !== 'undefined' && typeof window[f] === 'function' ? String(window[f]() || omissao) : omissao; } catch (e) { return omissao; }
}

/* A imagem da raiz: o ecrã das Definições com a Conta (o perfil e a
   Segurança) e o Dinheiro e IRS, as linhas com o ícone, o resumo e a seta.
   Devolve: o HTML da imagem. */
function aprADefinicoesRaiz() {
  var l = function (icone, t, s, alvo) { return aprLinha({ icone: icone, titulo: t, sub: s, seta: true, alvo: alvo }); };
  return aprCena(aprAEcra('Definições', aprADireita(''),
    aprARotulo('Conta') + aprCartao(l('crown', 'O meu perfil', 'Nome, NIF e contactos para os contratos') + l('lock', 'Segurança', 'Palavra-passe, sessões e apagar a conta')) +
    aprARotulo('Dinheiro e IRS') + aprCartao(l('tag', 'Categorias, etiquetas e IRS', aprAResumo('resumoDasCategorias', 'As categorias de pagamento e as etiquetas')) +
      l('trend', 'Valores por omissão', aprAResumo('resumoDosValores', 'Aumento 2% · inflação 2% · 10 anos · selo 4%')) +
      l('filter', 'Filtros comuns', aprAResumo('resumoDosFiltros', 'Um conjunto de escolhas, aplicado num toque'))) +
    aprARotulo('App')),
    { tom: 't0', arranjo: 'tela' });
}

/* O nome da conta, para o cartão do fundo do menu e o perfil
   (navegacao.js:gavetaFundo escreve-o assim).
   Devolve: o nome (texto, por escapar). */
function aprANomeDaConta() {
  var u = typeof window !== 'undefined' && window.CW && CW.user;
  return String((u && (u.name || u.email)) || 'A minha conta');
}

/* A imagem do perfil: o fundo do menu, com o cartão da conta em destaque
   (navegacao.js:gavetaFundo), atrás, e a janela «O meu perfil» à frente,
   com o nome e os campos que os contratos levam.
   Devolve: o HTML da imagem. */
function aprADefinicoesPerfil() {
  var nome = aprANomeDaConta();
  return aprCena(aprPar(
    '<span class="apr-a-gaveta"><span class="apr-a-gav-i">' + ic('gear', 12) + 'Definições</span><span class="apr-a-gav-i">' + ic('ajuda', 12) + 'Ajuda</span>' +
      '<span class="apr-a-conta apr-alvo"><span class="apr-m-avatar">' + esc(initials(nome)) + '</span><span><b>' + esc(nome) + '</b><span>O meu perfil</span></span></span></span>',
    aprFolha('O meu perfil', aprCampo('Nome completo', nome === 'A minha conta' ? '' : nome, { obrigatorio: true, vazio: 'Ex: Ana Rodrigues' }) +
      '<span class="apr-m-grelha apr-a-grelha-2">' + aprCampo('NIF', '', { vazio: 'Opcional' }) + aprCampo('Telemóvel', '', { vazio: 'Ex: 912 345 678' }) + '</span>' +
      aprCampo('Morada fiscal', '', { vazio: 'Opcional' }), { flutua: true })
  ), { tom: 't2', arranjo: 'par' });
}

/* A imagem das regras do dinheiro: a tabela das categorias com a coluna do
   Anexo F (definicoes.js:tabelaDeCategorias) atrás, e os valores por
   omissão desta conta à frente (definicoes.js:vDefaults).
   Devolve: o HTML da imagem. */
function aprADefinicoesDinheiro() {
  var s = (typeof db !== 'undefined' && db && db.settings) || {};
  var num = function (v, omissao) { return v == null || v === '' ? omissao : Number(v); };
  var cat = function (c, col, nao) { return [esc(c), '<span class="apr-a-col-anexo' + (nao ? ' nao' : '') + '">' + esc(col) + '</span>']; };
  var opcao = function (t, v, u) { return '<span class="apr-a-opcao"><span><b>' + esc(t) + '</b></span><span class="apr-m-caixa apr-a-valor">' + esc(v) + '<span class="apr-m-sub">' + esc(u) + '</span></span></span>'; };
  var anos = num(s.years, 10);
  return aprCena(aprPar(
    aprACartao('Categorias de pagamentos', '', aprATabela(['Categoria', 'Coluna no Anexo F'], [
      cat('Condomínio', 'Condomínio'), cat('Mobiliário e equipamento', 'Não dedutível', true), cat('Manutenção e reparações', 'Conservação e manutenção'),
      cat('Impostos › IMI', 'IMI')], { cols: 'c2' })),
    aprACartao('Valores por omissão', '', opcao('Aumento anual das rendas', dec(num(s.growth, 2)), '%') + opcao('Inflação das despesas', dec(num(s.inflation, 2)), '%') +
      opcao('Horizonte das projeções', String(anos), anos === 1 ? 'ano' : 'anos'), { flutua: true })
  ), { tom: 't1', arranjo: 'par' });
}

/* A imagem da App: o Tema com o segmentado (o que está escolhido neste
   aparelho), as linhas de «Importar e cópias» e de «Ajuda e sugestões», em
   destaque, e as Novidades.
   Devolve: o HTML da imagem. */
function aprADefinicoesApp() {
  var t = (typeof db !== 'undefined' && db && db.settings && db.settings.theme) || 'auto';
  var nomeTema = { auto: 'Automático', light: 'Claro', dark: 'Escuro' }[t] || 'Automático';
  var versao = typeof VERSAO !== 'undefined' ? ' · versão ' + VERSAO : '';
  return aprCena(aprColuna([
    aprCartao('<span class="apr-m-cartao-cab"><b>Tema</b><span class="apr-m-sub">Vale só neste aparelho</span></span>' + aprSegmentado(['Automático', 'Claro', 'Escuro'], nomeTema)),
    aprCartao(aprLinha({ icone: 'down', titulo: 'Importar e cópias', sub: 'Cópia de segurança, CSV, Splitwise', seta: true }) +
      aprLinha({ icone: 'ajuda', titulo: 'Ajuda e sugestões', sub: 'Como se faz, perguntas e pedidos', seta: true, alvo: true }) +
      aprLinha({ icone: 'info', titulo: 'Novidades', sub: 'O que mudou' + versao, seta: true }), { flutua: true }),
  ]), { tom: 't3', arranjo: 'coluna' });
}

registarApresentacao('settings', {
  nome: 'Definições',
  resumo: 'O perfil, as regras do dinheiro e a app',
  imagens: [
    { titulo: 'Três partes, uma página por linha',
      texto: 'As <b>Definições</b> arrumam-se na <b>Conta</b>, no <b>Dinheiro e IRS</b> e na <b>App</b>. Cada linha abre a sua página e, no computador, as outras ficam numa lista ao lado.',
      maquete: aprADefinicoesRaiz },
    { titulo: 'O teu perfil vai para os contratos',
      texto: '<b>O meu perfil</b> guarda o nome, o NIF e os contactos que entram nos contratos que a app gera. Abre-se também no cartão com o teu nome, no fundo do menu.',
      maquete: aprADefinicoesPerfil },
    { titulo: 'As regras do teu dinheiro',
      texto: 'Em <b>Categorias, etiquetas e IRS</b> escolhes a coluna do Anexo F de cada despesa. Os <b>Valores por omissão</b> valem quando um contrato ou uma hipoteca não diz outra coisa.',
      maquete: aprADefinicoesDinheiro },
    { titulo: 'A app à tua maneira',
      texto: 'O <b>Tema</b> escolhe-se aqui mesmo e vale só neste aparelho. Esta janela e a de cada separador reveem-se em <b>Ajuda → Apresentações</b>.',
      maquete: aprADefinicoesApp },
  ],
});
