// Correções dos serviços de domínio (a avaliação de 2026-09-14, área A.2):
// cada teste prende uma regra que o código partia. O nome diz a regra; o
// achado vai no comentário por cima. Tudo pelo arnês, sem browser: as funções
// puras (contractData, resumoFiscal, prazosDe, cursorDaRenda, saldoEmDivida,
// distribuicaoDe) chamam-se pelo nome, e o resto com as janelas numa pilha.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregarApp, carregarServico, limpar, igual, perto } from './arnes.js';

const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web');
const ler = (rel) => fs.readFileSync(path.join(WEB, rel), 'utf8');
/* os ficheiros desta área: 18 módulos de serviço e quatro da base que ela também
   corrigiu (prazos, notificacoes, splitwise e o motor do crédito) */
const MEUS = ['painel-geral', 'lista-imoveis', 'imovel', 'lista-contratos', 'contrato', 'contrato-pdf', 'lista-pessoas',
  'pessoas', 'lista-colaboradores', 'lista-movimentos', 'movimento', 'planeados', 'prazos', 'notificacoes', 'visitas',
  'calendario', 'creditos', 'splitwise', 'projecoes', 'avaliacao', 'fisco', 'credito'].map((n) => 'app/' + n + '.js');
const MAU = '<img src=x onerror=alert(1)>';

/* janelas numa pilha observável, sem pintar nem gravar */
function janelas(app) {
  const abertas = [];
  app.openModal = (t, b, f, m) => { const L = { t, b, f, m: m || '', el: { querySelector: () => null }, onSave: null }; app.modalStack.push(L); abertas.push(L); return L; };
  app.setModal = (t, b) => { const L = abertas[abertas.length - 1]; if (L) { L.t = t; L.b = b; } };
  app.closeModal = () => { app.modalStack.pop(); };
  app.closeAllModals = () => { app.modalStack.length = 0; };
  app.render = () => {}; app.buildNav = () => {}; app.save = () => {}; app.toast = () => {}; app.paintThumbs = () => {};
  app.refreshDetail = () => {};
  return abertas;
}
/* uma data n anos antes de hoje, no dia 10 (a prestação desse dia já venceu ou vence hoje) */
function haAnos(app, n) {
  const h = app.today();
  return (Number(h.slice(0, 4)) - n) + '-' + h.slice(5, 7) + '-10';
}

describe('as visitas sob a CSP da app', () => {
  // achado A.2-1
  test('o toque longo de uma visita abre as opções sem gerar código a partir de texto', () => {
    const app = carregarApp(); limpar(app); janelas(app);
    app.db.properties = [app.normProp({ id: 'P1', name: 'T2' })];
    app.db.visits = [app.normVisit({ id: 'V1', nomes: 'Ana', propertyId: 'P1', date: '2026-09-20' })];
    /* a CSP (web/_headers) não tem 'unsafe-eval': no browser, new Function e eval rebentam */
    const proibido = () => { throw new EvalError('Refused to evaluate a string as JavaScript'); };
    app.__ctx.Function = proibido; app.__ctx.eval = proibido;
    let opts = null;
    app.lpShow = (t, o) => { opts = o; };
    app.lpVisita(['vis', 'V1']);
    assert.ok(opts, 'a folha de opções abriu');
    igual(opts.map((o) => o.label), ['Editar visita', 'Marcar realizada', 'Marcar falta', 'Converter em inquilino', 'Apagar visita']);
    opts.forEach((o) => assert.equal(typeof o.act, 'function', o.label));
    opts.find((o) => o.label === 'Marcar realizada').act();
    assert.equal(app.db.visits[0].estado, 'realizada', 'e a opção faz o que diz');
    // a mesma lista continua a servir a ficha e o kebab, em texto de onclick
    assert.match(app.visOpcoes(app.db.visits[0]).map((o) => o.act).join(' '), /visApaga\('V1'\)/);
    for (const f of MEUS) assert.doesNotMatch(ler(f), /new Function\(|\beval\(/, f);
  });
});

describe('o texto do utilizador no HTML', () => {
  // achado A.2-2
  test('os resumos das dobras e a taxa das hipotecas saem escapados', () => {
    const app = carregarApp(); limpar(app); const abertas = janelas(app);
    app.perKind = 'tenant';
    app.perForm = app.normPerson({ name: 'Ana', nif: MAU });
    assert.doesNotMatch(app.personBody(), /<img src=x/, 'o NIF no resumo da identificação');
    app.db.properties = [app.normProp({ id: 'P1', name: 'Casa', loans: [
      { id: 'L1', name: 'Aquisição', outstanding: 90000, years: 20, type: 'variavel', index: MAU, euribor: 2, spread: 1, start: '2020-01-10' },
      { id: 'L2', name: 'Obras', outstanding: 9000, years: '8' + MAU, type: 'fixa', rate: 4, start: '2024-01-10' },
    ] })];
    app.tForm = app.normTx({ kind: 'expense', propertyId: 'P1', category: MAU, sub: MAU });
    assert.doesNotMatch(app.txBody(), /<img src=x/, 'a categoria no resumo da dobra');
    assert.doesNotMatch(app.vCredits(), /<img src=x/, 'a taxa no cartão da hipoteca');
    assert.doesNotMatch(app.loanBox(app.prop('P1').loans[0]), /<img src=x/, 'a taxa na caixa da simulação');
    app.amortModal('P1');
    assert.doesNotMatch(abertas[0].b, /<img src=x/, 'o prazo na tabela de todas as hipotecas');
  });
});

describe('a renda do mês e a caução', () => {
  function monta(app) {
    limpar(app); janelas(app);
    app.db.properties = [app.normProp({ id: 'P1', name: 'Casa' })];
    app.db.contracts = [app.normContract({ id: 'C1', name: 'Ana', propertyId: 'P1', rent: 750, deposit: 750, payDay: 5, start: '2026-09-01' })];
  }
  const caucao = (app, date) => app.db.transactions.push(app.normTx({ id: 'CAU', kind: 'income', label: 'Caução', amount: 750,
    propertyId: 'P1', contractId: 'C1', category: 'Rendas', sub: 'Caução', date }));

  // achado A.2-3
  test('uma caução no mês de início não conta como a renda desse mês', () => {
    const app = carregarApp(); monta(app);
    const c = app.contract('C1');
    caucao(app, '2026-09-01');
    assert.equal(app.rendaJaLancada(c, '2026-09-05'), false, 'a caução não é a renda de setembro');
    assert.equal(app.cursorDaRenda(c, '2026-09-05', '2026-09-05', 5), '2026-09-05', 'o cursor fica na renda de setembro');
    const r = app.normRec({ id: 'R1', auto: true, name: 'Renda Ana', every: 'month', next: '2026-09-05',
      tx: { kind: 'income', amount: 750, propertyId: 'P1', contractId: 'C1', category: 'Rendas', sub: 'Renda mensal' } });
    app.db.recurring = [r];
    assert.equal(app.jaRegistado(r, '2026-09-05'), false, 'as datas em falta também não a contam');
    app.quickConfirmRec('R1');
    const rendas = app.db.transactions.filter((t) => t.id !== 'CAU');
    assert.equal(rendas.length, 1, 'confirmar regista a renda de setembro em vez de saltar');
    assert.equal(rendas[0].date, '2026-09-05');
    assert.equal(app.rendaJaLancada(c, '2026-09-20'), true, 'e a renda a sério, essa, conta');
  });

  // achado A.2-3
  test('os dados já gravados recuperam: o cursor que saltou por causa da caução volta ao mês de início', () => {
    const app = carregarApp(); monta(app);
    caucao(app, '2026-09-01');
    assert.equal(app.cursorDaRenda(app.contract('C1'), '2026-10-05', '2026-09-05', 5), '2026-09-05');
  });

  // achado A.2-3
  test('a renda de um mês conta pelo mês a que respeita, e não pelo dia em que entrou', () => {
    const app = carregarApp(); monta(app);
    const c = app.contract('C1');
    app.db.transactions.push(app.normTx({ kind: 'income', amount: 750, propertyId: 'P1', contractId: 'C1', category: 'Rendas',
      date: '2026-10-03', periodo: '2026-09' }));
    assert.equal(app.rendaJaLancada(c, '2026-09-05'), true, 'a de setembro, paga a 3 de outubro');
    assert.equal(app.rendaJaLancada(c, '2026-10-05'), false, 'e a de outubro continua por pagar');
  });
});

describe('o contrato em PDF', () => {
  /* O que o gerador escreve, sem browser: os parágrafos do modelo com a mesma
     regra de omissão do generateContractPdf — um elemento com «opcional» sai
     quando o marcador está vazio (as cláusulas e os anexos inteiros) — e os
     marcadores preenchidos pelo fillTpl. */
  function paragrafos(app, c) {
    const d = app.contractData(c);
    const ok = (k) => !(d[k] === '' || d[k] == null || d[k] === 0);
    const xml = app.CONTRACT_XML.replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<(clausula|secao|anexo)([^>]*)>([\s\S]*?)<\/\1>/g, (m, tag, attrs, inner) => {
        const o = /opcional="([^"]+)"/.exec(attrs);
        return o && (o[1] === 'fotos' ? !d.fotos : !ok(o[1])) ? '' : inner;
      });
    const out = [];
    for (const m of xml.matchAll(/<(n|p|destaque|item|titulo|subtitulo)((?:\s+[\w-]+="[^"]*")*)>([\s\S]*?)<\/\1>/g)) {
      const o = /opcional="([^"]+)"/.exec(m[2]);
      if (o && !ok(o[1])) continue;
      out.push(app.fillTpl(m[3].replace(/\s+/g, ' ').trim(), d));
    }
    return out;
  }
  function monta(app, extra) {
    limpar(app); janelas(app);
    app.db.owners = [app.normPerson({ id: 'O1', name: 'Ana Senhoria', taxAddress: 'Rua A, 1' })];
    app.db.tenants = [app.normPerson({ id: 'T1', name: 'Rui Inquilino' })];
    app.db.properties = [app.normProp({ id: 'P1', name: 'T2', ownerIds: ['O1'], street: 'Rua B', doorNumber: '2', postalCode: '1000-001', locality: 'Lisboa' })];
    app.db.contracts = [app.normContract(Object.assign({ id: 'C1', propertyId: 'P1', tenantIds: ['T1'], rent: 750, deposit: 750,
      advance: 2, payDay: null, payDayTo: null, iban: '', start: '2026-10-01', end: '2027-09-30' }, extra || {}))];
    return app.contract('C1');
  }
  const buraco = /\s{2}|\s[,.;]|\(\s*\)|IBAN\s*[,.]/;

  // achado A.2-4
  test('o contrato em PDF só diz o que o contrato tem: sem dia inventado, com as rendas antecipadas pedidas e sem frases vazias', () => {
    const app = carregarApp();
    const c = monta(app);
    const d = app.contractData(c);
    assert.equal(d['contrato.diaPagamento'], '', 'sem dia de pagamento não se inventa o 8');
    const ps = paragrafos(app, c), tudo = ps.join('\n');
    assert.doesNotMatch(tudo, /até ao dia/, 'a frase do dia sai');
    assert.ok(tudo.includes('antecipadamente ' + app.money(1500) + ' (mil e quinhentos euros)'), 'as duas rendas antecipadas: ' + tudo);
    assert.match(tudo, /2 \(dois\) meses/);
    assert.ok(tudo.includes('VALOR TOTAL A ENTREGAR NA ASSINATURA: ' + app.money(2250)), 'o total leva as duas rendas e a caução');
    ps.forEach((p) => assert.doesNotMatch(p, buraco, 'um marcador vazio a meio: «' + p + '»'));
    // sem rendas antecipadas não há cláusula delas, e o total é só a caução
    const c0 = monta(app, { advance: 0, payDay: 5, iban: 'PT50000201231234567890154' });
    const ps0 = paragrafos(app, c0), tudo0 = ps0.join('\n');
    assert.doesNotMatch(tudo0, /antecipad/);
    assert.match(tudo0, /até ao dia 5 do mês a que respeita/);
    assert.ok(tudo0.includes('VALOR TOTAL A ENTREGAR NA ASSINATURA: ' + app.money(750)));
    ps0.forEach((p) => assert.doesNotMatch(p, buraco, 'um marcador vazio a meio: «' + p + '»'));
  });

  // achado A.2-4
  test('sem datas, sem senhorio ou sem morada o PDF não se gera: diz o que falta', async () => {
    const app = carregarApp();
    let dito = '';
    const gera = async (extra, mexe) => { monta(app, extra); if (mexe) mexe(); app.toast = (m) => { dito = m; }; dito = ''; await app.generateContractPdf('C1'); return dito; };
    assert.equal(await gera({ end: '' }), 'Indica o início e o fim do contrato antes de gerar o PDF.');
    assert.equal(await gera({ start: '' }), 'Indica o início e o fim do contrato antes de gerar o PDF.');
    assert.equal(await gera({}, () => { app.db.properties[0].ownerIds = []; }), 'Associa pelo menos um proprietário ao imóvel antes de gerar o contrato.');
    assert.equal(await gera({}, () => { Object.assign(app.db.properties[0], { street: '', doorNumber: '', postalCode: '', locality: '', address: '' }); }),
      'Indica a morada do imóvel antes de gerar o contrato.');
    assert.equal(app.contractData(app.normContract({ propertyId: 'P1' }))['contrato.prazo'], '', 'sem datas o prazo fica vazio, e não «prazo certo»');
  });

  // achado A.2-17
  test('o prazo por extenso acerta o singular e as datas contam-se em hora local', () => {
    const app = carregarApp();
    assert.equal(app.prazoTexto('2026-01-01', '2026-02-01'), '1 (um) mês');
    assert.equal(app.prazoTexto('2026-01-01', '2026-07-01'), '6 (seis) meses');
    assert.equal(app.prazoTexto('2026-10-01', '2027-09-30'), '1 (um) ano');
    assert.equal(app.prazoTexto('2026-10-01', '2028-09-30'), '2 (dois) anos');
    assert.equal(app.prazoTexto('', ''), '');
    assert.match(app.pessoaTexto(app.normPerson({ name: 'Ana', gender: 'f', taxAddress: 'Rua A' })), /, residente em Rua A$/);
    const src = ler('app/contrato-pdf.js');
    assert.doesNotMatch(src, /'residente':'residente'/, 'sem o ternário de ramos iguais');
    assert.doesNotMatch(src, /new Date\((a|b)\)/, 'sem datas lidas em UTC');
  });
});

describe('o capital em dívida das hipotecas', () => {
  function casa(app, loan) {
    limpar(app); janelas(app);
    app.db.owners = [app.normPerson({ id: 'O1', name: 'Ana' })];
    app.db.properties = [app.normProp({ id: 'P1', name: 'Casa', ownerIds: ['O1'], loans: [Object.assign({
      id: 'L1', name: 'Aquisição', years: 30, type: 'fixa', rate: 3, start: '2026-01-10' }, loan)] })];
    return () => app.findLoan(app.prop('P1'), 'L1');
  }
  const paga = (app, id, date) => { const t = app.normTx({ id, kind: 'loan', loanId: 'L1', propertyId: 'P1', amount: 421.6, date }); app.applyLoan(t); app.db.transactions.push(t); return t; };

  // achado A.2-5a
  test('o capital da data de início fica guardado e o capital em dívida deriva dele e dos movimentos', () => {
    const app = carregarApp();
    const l = casa(app, { capitalInicio: 100000, outstanding: 100000 });
    const t = paga(app, 'T1', '2026-02-10');
    assert.equal(l().capitalInicio, 100000, 'pagar não mexe no capital do início');
    perto(l().outstanding, 100000 - t.principal, 0.001);
    assert.equal(app.saldoEmDivida(l(), app.db.transactions), l().outstanding);
    assert.match(app.loanSect(l(), 0), /id="l_out_L1"[^>]*value="100000"/, 'o formulário mostra o capital da data de início');
    // apagar o pagamento repõe-no a partir do capital do início, e não por aritmética sobre o velho
    app.delTx('T1');
    assert.equal(l().outstanding, 100000);
    const t2 = paga(app, 'T2', '2026-03-10');
    perto(l().outstanding, 100000 - t2.principal, 0.001);
    const antes = JSON.stringify([l(), app.db.transactions]);
    app.saldoEmDivida(l(), app.db.transactions); app.capitalDoInicio(l(), app.db.transactions);
    assert.equal(JSON.stringify([l(), app.db.transactions]), antes, 'as funções que derivam não mexem em nada');
  });

  // achado A.2-5a
  test('duas escritas cruzadas na mesma casa já não perdem o capital abatido', () => {
    const app = carregarApp();
    casa(app, { capitalInicio: 100000, outstanding: 100000 });
    const casaDeB = JSON.parse(JSON.stringify(app.prop('P1')));   // o aparelho B tem a casa aberta desde antes
    paga(app, 'T1', '2026-02-10');                               // o aparelho A regista a prestação
    const devia = app.prop('P1').loans[0].outstanding;
    assert.ok(devia < 100000);
    app.db.properties = [casaDeB];                               // B grava a casa por cima: a última escrita ganha a casa inteira
    assert.equal(app.prop('P1').loans[0].outstanding, 100000, 'a casa voltou com o capital velho');
    app.acertarCreditos(app.db);                                 // o que dados.js e nucleo.js correm depois de aplicar o estado
    perto(app.prop('P1').loans[0].outstanding, devia, 0.001);
  });

  // achado A.2-5a
  test('os dados antigos, sem o capital do início, migram sem mudar o que se vê', () => {
    const app = carregarApp();
    const l = casa(app, { outstanding: 95234.17 });
    [150.33, 151.1, 152].forEach((p, k) => app.db.transactions.push(app.normTx({ kind: 'loan', loanId: 'L1', propertyId: 'P1', amount: 421.6,
      principal: p, interest: 261.2, stamp: 10.45, date: '2026-0' + (k + 2) + '-10' })));
    const antes = { o: l().outstanding, total: app.loanCalc(l()).total, n: app.amort(l()).n };
    assert.equal(app.capitalDoInicio(l(), app.db.transactions), 95687.6, 'o capital implícito: o de hoje mais o já abatido');
    app.acertarCreditos(app.db);
    assert.equal(l().capitalInicio, 95687.6);
    assert.equal(l().outstanding, antes.o);
    assert.equal(app.loanCalc(l()).total, antes.total);
    assert.equal(app.amort(l()).n, antes.n);
    // e a partir daí as escritas cruzadas também não perdem nada
    const casaDeB = JSON.parse(JSON.stringify(app.prop('P1')));
    paga(app, 'T9', '2026-05-10');
    const devia = l().outstanding;
    app.db.properties = [casaDeB];
    app.acertarCreditos(app.db);
    perto(l().outstanding, devia, 0.001);
  });
});

describe('as obras dos 24 meses', () => {
  function monta(app, inicio) {
    limpar(app);
    app.db.owners = [app.normPerson({ id: 'ana', name: 'Ana' })];
    app.db.tenants = [app.normPerson({ id: 't1', name: 'Tiago', nif: '123456789' })];
    app.db.properties = [app.normProp({ id: 'v1', name: 'T2', ownerIds: ['ana'], freguesiaCodigo: '110623', tipoPredio: 'U', matrix: '4651' })];
    app.db.contracts = [app.normContract({ id: 'C1', name: 'Tiago', propertyId: 'v1', tenantIds: ['t1'], rent: 800, start: inicio, active: true,
      fisco: { estado: 'declarado', numero: '1', finalidade: 'hp' } })];
    app.db.transactions = [app.normTx({ kind: 'expense', label: 'Pintura', category: 'Manutenção e reparações', amount: 1200, propertyId: 'v1', date: '2024-06-10' })];
    ['2025-01-05', '2025-02-05', '2026-01-05'].forEach((d) => app.db.transactions.push(app.normTx({ kind: 'income', category: 'Rendas', amount: 800,
      propertyId: 'v1', contractId: 'C1', date: d })));
  }
  // achado A.2-6
  test('as obras entram no primeiro ano em que o contrato tem rendas, mesmo quando começa no fim do ano anterior', () => {
    const app = carregarApp();
    for (const inicio of ['2024-12-15', '2025-01-02']) {
      monta(app, inicio);
      const r24 = app.resumoFiscal(2024, ''), r25 = app.resumoFiscal(2025, ''), r26 = app.resumoFiscal(2026, '');
      assert.equal(r24.linhas.length, 0, inicio + ': em 2024 não há rendas');
      perto(r24.totais.obras24 + r24.totais.gastos.conservacao, 0, 1e-9, inicio + ': nem conta como gasto de 2024');
      perto(r25.linhas[0].obras24.valor, 1200, 1e-9, inicio + ': entra em 2025, o primeiro ano com rendas');
      assert.equal(r25.linhas[0].obras24.inicioGastos, '2024-06-10');
      perto(r26.linhas[0].obras24.valor, 0, 1e-9, inicio + ': e só uma vez');
    }
  });
});

describe('tocar num registo é lê-lo, também nas entradas laterais', () => {
  // achado A.2-7
  test('o calendário e os prazos abrem a ficha, e o formulário da visita recua para ela quando não se pode alterar', () => {
    const app = carregarApp(); limpar(app); const abertas = janelas(app);
    app.db.owners = [app.normPerson({ id: 'O1', name: 'Ana', ccValid: '2026-10-01' })];
    app.db.tenants = [app.normPerson({ id: 'T1', name: 'Rui' })];
    app.db.properties = [app.normProp({ id: 'P1', name: 'T2', ownerIds: ['O1'], energyValid: '2026-10-15', loans: [
      { id: 'L1', name: 'Aquisição', outstanding: 90000, years: 30, type: 'mista', rate: 2, fixedYears: 2, euribor: 3, spread: 1, start: '2024-10-01' }] })];
    app.db.contracts = [app.normContract({ id: 'C1', name: 'Rui', propertyId: 'P1', tenantIds: ['T1'], rent: 700, start: '2026-08-20', end: '2027-01-10',
      fisco: { estado: 'declarado', numero: '9' } })];
    app.db.transactions = [app.normTx({ id: 'R9', kind: 'income', category: 'Rendas', amount: 700, propertyId: 'P1', contractId: 'C1', date: '2026-08-25' })];
    for (let k = 0; k < 23; k++) { const y = 2024 + Math.floor((9 + k) / 12), m = ((9 + k) % 12) + 1;
      app.db.transactions.push(app.normTx({ kind: 'loan', loanId: 'L1', propertyId: 'P1', amount: 340, principal: 190, date: y + '-' + String(m).padStart(2, '0') + '-01' })); }
    app.db.visits = [app.normVisit({ id: 'V1', nomes: 'Bruno', propertyId: 'P1', date: '2026-09-20' })];
    const html = app.calDiaPanel('2026-09-20');
    assert.match(html, /visView\('V1'\)/);
    assert.doesNotMatch(html, /visitModal\('V1'\)/);
    let ficha = null;
    app.abrirFicha = (o) => { ficha = o; };
    const real = app.podeEditar;
    app.podeEditar = () => false;
    app.visitModal('V1');
    app.podeEditar = real;
    assert.ok(ficha, 'abriu a ficha da visita');
    assert.equal(abertas.length, 0, 'e não o formulário');
    const ps = app.prazosDe('2026-09-10');
    const de = (tipo) => (ps.find((p) => p.tipo === tipo) || {}).abrir;
    assert.equal(de('cc'), "personView('owner','O1')");
    assert.equal(de('oposicao'), "ctView('C1')");
    assert.equal(de('energia'), "propView('P1')");
    assert.equal(de('taxa'), "mortView('P1','L1')");
    assert.equal(de('recibos'), "txView('R9')");
    ps.forEach((p) => assert.doesNotMatch(p.abrir, /Modal\(/, p.tipo + ' abre um formulário'));
  });
});

describe('as fronteiras dos serviços', () => {
  // achado A.2-8
  test('a tabela de amortização é dos Créditos e abre com os Movimentos desligados', () => {
    const app = carregarServico(['credits']);
    assert.ok(!app.servicoLigado('transactions'), 'os Movimentos não estão nesta conta');
    limpar(app); const abertas = janelas(app);
    app.db.properties = [app.normProp({ id: 'P1', name: 'Casa', loans: [{ id: 'L1', name: 'Aquisição', outstanding: 90000, years: 20, rate: 3 }] })];
    assert.equal(typeof app.amortModal, 'function');
    let opts = null;
    app.lpShow = (t, o) => { opts = o; };
    app.lpHipoteca(['mort', 'P1', 'L1']);
    const am = opts.find((o) => o.label === 'Amortização');
    assert.ok(am, opts.map((o) => o.label).join(', '));
    am.act();
    assert.match(abertas[0].t, /Amortização · Casa/);
    let ficha = null;
    app.abrirFicha = (o) => { ficha = o; };
    app.mortView('P1', 'L1');
    assert.match(ficha.menu(), /amortModal\('P1','L1'\)/);
    assert.doesNotMatch(ler('app/movimento.js'), /function (amortModal|yearRows|onAmortSel)\b/);
  });

  // achado A.2-12a
  test('o modelo do contrato e o escritor de PDF vivem nos Contratos, e não no ficheiro do Splitwise', () => {
    const sw = ler('app/splitwise.js'), pdf = ler('app/contrato-pdf.js');
    for (const nome of ['CONTRACT_XML', 'PDF', 'photoJpeg', 'pdfEsc', 'textW', 'charW', 'HW', 'HWB']) {
      assert.doesNotMatch(sw, new RegExp('^(const|function) ' + nome + '\\b', 'm'), nome + ' saiu do splitwise.js');
      assert.match(pdf, new RegExp('^(const|function) ' + nome + '\\b', 'm'), nome + ' está no contrato-pdf.js');
    }
    assert.doesNotMatch(sw + pdf, /contrato-modelo\.xml/, 'nenhum comentário manda ver um ficheiro que não existe');
    const app = carregarServico(['contracts']);
    assert.equal(typeof app.PDF, 'function');
    assert.equal(typeof app.CONTRACT_XML, 'string');
  });
});

describe('o formulário do movimento', () => {
  function semear(app) {
    limpar(app);
    app.db.owners = [app.normPerson({ id: 'O1', name: 'Ana' })];
    app.db.properties = [app.normProp({ id: 'P1', name: 'Casa', ownerIds: ['O1'], loans: [{ id: 'L1', name: 'Aquisição', capitalInicio: 100000, outstanding: 100000, years: 30, rate: 3 }] })];
    app.db.contracts = [app.normContract({ id: 'C1', propertyId: 'P1', rent: 800, start: '2024-01-01' })];
    app.db.transactions = [app.normTx({ id: 'T1', kind: 'expense', label: 'Luz', amount: 30, propertyId: 'P1', date: '2026-03-01' })];
    app.db.recurring = [app.normRec({ id: 'R1', name: 'Seguro', every: 'month', next: '2026-01-05', tx: { kind: 'expense', label: 'Seguro', amount: 20, propertyId: 'P1' } })];
  }
  // achado A.2-9a
  test('o modo do formulário vive fora do movimento, e o formulário abre-se por objeto', () => {
    const app = carregarApp(); semear(app); const abertas = janelas(app);
    let dito = ''; app.toast = (m) => { dito = m; };
    const marcas = () => Object.keys(app.tForm).filter((k) => /^_(rec|tpl|every|until|recEnd|alsoTx|next|saver)/.test(k));
    app.txModal({ kind: 'expense', propId: 'P1' });
    assert.equal(app.tForm.propertyId, 'P1'); assert.equal(app.txModo.modo, 'tx');
    app.editRec('R1');
    assert.equal(app.txModo.modo, 'rec'); assert.equal(app.txModo.recId, 'R1');
    assert.equal(abertas[abertas.length - 1].t, 'Editar movimento recorrente');
    igual(marcas(), [], 'o movimento não leva as marcas do modo');
    app.applyTemplate({ tx: { kind: 'expense', label: 'Água', amount: 25, propertyId: 'P1' } });
    assert.equal(app.txModo.recId, 'R1', 'aplicar um modelo não troca o modo');
    app.collectTx = () => {};
    Object.assign(app.tForm, { label: 'Seguro novo', amount: 22 });
    app.onSave();
    assert.equal(dito, 'Movimento recorrente atualizado.');
    assert.equal(app.db.recurring[0].tx.amount, 22);
    app.confirmRec('R1');
    assert.equal(app.txModo.modo, 'confirmar');
    assert.equal(abertas[abertas.length - 1].t, 'Confirmar movimento');
    igual(marcas(), []);
    // a forma curta: um id sozinho abre esse movimento para o alterar
    app.txModal('T1');
    assert.equal(app.tForm.id, 'T1'); assert.equal(app.txModo.modo, 'tx');
    app.txModal({ kind: 'income', propId: 'P1', ctId: 'C1' });
    assert.equal(app.tForm.contractId, 'C1');
    assert.doesNotMatch(ler('app/movimento.js'), /function txModal\(id,kind,propId,_x/);
  });

  // achado A.2-10
  test('a distribuição de uma prestação é uma função pura, e pintar o formulário não escreve no movimento', () => {
    const app = carregarApp(); semear(app); janelas(app);
    const l = app.findLoan(app.prop('P1'), 'L1');
    app.tForm = app.normTx({ kind: 'loan', propertyId: 'P1', loanId: 'L1', amount: 500 });
    app.tForm._edit = false;
    const antes = JSON.stringify(app.tForm);
    app.txBody();
    assert.equal(JSON.stringify(app.tForm), antes, 'o txBody só pinta');
    const d = app.distribuicaoDe(app.tForm, l);
    perto(d.interest, 250, 0.005); perto(d.stamp, 10, 0.005); perto(d.principal, 240, 0.005); assert.equal(d.fee, 0);
    const a = app.distribuicaoDe(Object.assign({}, app.tForm, { payType: 'amortizacao', amount: 1020 }), l);
    perto(a.principal, 1000, 0.005); perto(a.fee, 20, 0.005); assert.equal(a.interest, 0);
    // guardar grava a distribuição da função, mesmo sem DOM
    app.txModal({ kind: 'loan', propId: 'P1' });
    app.collectTx = () => {};
    Object.assign(app.tForm, { label: 'Prestação', amount: 500, loanId: 'L1' });
    app.onSave();
    const t = app.db.transactions.find((x) => x.kind === 'loan');
    assert.ok(t, 'gravou');
    perto(t.interest, 250, 0.005); perto(t.principal, 240, 0.005);
    perto(l.outstanding, 100000 - 240, 0.005);
  });
});

describe('o crédito sem os Planeados e com um relógio só', () => {
  // achado A.2-11
  test('as prestações desde o início inserem-se com os Planeados desligados', () => {
    const app = carregarServico(['properties', 'credits', 'transactions']);
    assert.ok(!app.servicoLigado('recurring'));
    limpar(app); janelas(app);
    const perguntas = [];
    app.confirmModal = (t, txt, cb) => { perguntas.push(txt); cb(); };
    app.comDesfazer = () => {}; app.collectProp = () => {};
    app.db.owners = [app.normPerson({ id: 'O1', name: 'Ana' })];
    app.propModal(null);
    app.pForm = app.normProp({ id: 'P1', name: 'Casa', ownerIds: ['O1'], loans: [{ id: 'L1', name: 'Aquisição', capitalInicio: 100000, outstanding: 100000, years: 30, rate: 3, start: haAnos(app, 2) }] });
    app.onSave();
    assert.equal(perguntas.length, 1, 'pergunta pelas prestações desde o início');
    assert.ok(app.db.transactions.length >= 23, 'e insere-as: ' + app.db.transactions.length);
    assert.ok(app.prop('P1').loans[0].outstanding < 100000, 'o capital desce com elas');
  });

  // achado A.2-11
  test('o prazo do fim da taxa fixa usa o mesmo relógio da simulação: as prestações registadas', () => {
    const app = carregarApp(); limpar(app);
    const l = app.normLoan({ id: 'L1', name: 'Aquisição', outstanding: 90000, years: 30, type: 'mista', rate: 2, fixedYears: 2, euribor: 3, spread: 1, start: '2024-06-01' });
    app.db.properties = [app.normProp({ id: 'P1', name: 'Casa', loans: [l] })];
    for (let k = 0; k < 22; k++) { const y = 2024 + Math.floor((5 + k) / 12), m = ((5 + k) % 12) + 1;
      app.db.transactions.push(app.normTx({ kind: 'loan', loanId: 'L1', propertyId: 'P1', amount: 340, principal: 190, date: y + '-' + String(m).padStart(2, '0') + '-01' })); }
    const hoje = '2026-09-10';
    assert.equal(app.fimDaFaseFixa(app.prop('P1').loans[0], app.db.transactions, hoje, ''), '2026-11-01', '24 − 22 = 2 prestações depois da de setembro');
    const p = app.prazosDe(hoje).find((x) => x.tipo === 'taxa');
    assert.ok(p, 'o aviso está na janela');
    assert.equal(p.alvo, '2026-11-01', 'e não o calendário (2026-06-01), que a simulação não usa');
    const f = app.fimDaFaseFixa(app.prop('P1').loans[0], app.db.transactions, app.today(), '');
    assert.ok(app.loanBox(app.prop('P1').loans[0]).includes('a partir de ' + app.MES[Number(f.slice(5, 7)) - 1] + ' ' + f.slice(0, 4)),
      'a caixa da simulação diz o mesmo mês');
  });
});

describe('os botões que acabavam numa recusa', () => {
  // achado A.2-15
  test('«Nova hipoteca» só aparece a quem pode editar a ficha de algum imóvel, e só lista esses', () => {
    const app = carregarApp(); limpar(app); janelas(app);
    const meu = app.normProp({ id: 'P1', name: 'T1 Meu', ownerIds: ['eu'] });
    const doRui = Object.assign(app.normProp({ id: 'P2', name: 'T2 Rui', ownerIds: ['rui'], loans: [{ id: 'L2', name: 'Aquisição', outstanding: 50000, years: 20, rate: 3 }] }),
      { _sharedFrom: 'Rui', _ownerUserId: 'rui', _cargo: 'Contabilista' });
    app.db.owners = [app.normPerson({ id: 'eu', name: 'Eu' }), Object.assign(app.normPerson({ id: 'rui', name: 'Rui' }), { _userId: 'rui' })];
    app.window.CW = { user: { id: 'eu' }, cargos: { P2: { dono: false, nome: 'Contabilista', perms: ['loan.view', 'report.view', 'tx.view'] } }, pessoas: {} };
    app.db.properties = [meu, doRui];
    assert.match(app.vCredits(), /newMort\(\)/, 'com um imóvel meu há botão');
    let itens = null;
    app.pickModal = (t, o) => { itens = o; };
    app.newMort();
    igual(itens.map((o) => o.v), ['P1'], 'e só lista os imóveis que posso editar');
    app.db.properties = [doRui];
    assert.doesNotMatch(app.vCredits(), /newMort\(\)/, 'o contabilista não vê o botão');
    let dito = ''; app.toast = (m) => { dito = m; }; itens = null;
    app.newMort();
    assert.equal(itens, null, 'nem a escolha abre');
    assert.match(dito, /editar a ficha/i);
  });

  // achado A.2-16
  test('a lista dos imóveis percorre os movimentos um número fixo de vezes por pintura, e não seis por cartão', () => {
    const app = carregarApp(); limpar(app);
    app.db.owners = [app.normPerson({ id: 'O1', name: 'Ana' }), app.normPerson({ id: 'O2', name: 'Rui' })];
    for (let i = 0; i < 30; i++) app.db.properties.push(app.normProp({ id: 'P' + i, name: 'Casa ' + i, ownerIds: ['O1', 'O2'] }));
    for (let k = 0; k < 600; k++) app.db.transactions.push(app.normTx({ kind: 'expense', label: 'Obra', amount: 10 + (k % 7), paidBy: k % 3 ? 'O1' : 'O2',
      propertyId: 'P' + (k % 30), date: '2026-01-' + String((k % 28) + 1).padStart(2, '0') }));
    app.db.transactions.push(app.normTx({ kind: 'expense', label: 'Global', amount: 90, paidBy: 'O2', date: '2026-02-01' }));
    const esperado = {};
    app.db.properties.forEach((p) => { esperado[p.id] = app.propDebt(p.id); });
    let passagens = 0;
    const real = app.db.transactions;
    app.db.transactions = new Proxy(real, { get(a, k) { if (['filter', 'forEach', 'map', 'some', 'reduce', 'find', 'every'].includes(k)) passagens++; return Reflect.get(a, k); } });
    const html = app.vProperties();
    app.db.transactions = real;
    assert.ok(passagens <= 6, 'passagens pela lista inteira: ' + passagens);
    for (const p of app.db.properties) if (esperado[p.id] > 0.005) assert.ok(html.includes(app.euro(esperado[p.id]) + ' entre proprietários'), p.id);
  });
});

describe('higiene', () => {
  // achado A.2-18
  test('sem código morto nos contratos, e os comentários dos colaboradores apontam para onde a vista vive', () => {
    for (const f of MEUS) assert.doesNotMatch(ler(f), /\bctGroupF\b|\bonCtGroupF\b/, f);
    const onde = fs.readdirSync(path.join(WEB, 'cloud')).filter((n) => n.endsWith('.js')).find((n) => /\nfunction vColaboradores\s*\(/.test(ler('cloud/' + n)));
    assert.equal(onde, 'partilha.js');
    const lc = ler('app/lista-colaboradores.js');
    assert.doesNotMatch(lc, /vista é da nuvem \(cloud\/colaboradores\.js\)/, 'a vista não vive em cloud/colaboradores.js');
    assert.match(lc, /cloud\/partilha\.js/);
  });

  // achado A.2-19a
  test('um idioma de guarda: servicoLigado para o que é de serviço, typeof só para o que vem da nuvem', () => {
    const topo = new Set();
    for (const n of fs.readdirSync(path.join(WEB, 'app')).filter((x) => x.endsWith('.js'))) {
      for (const m of ler('app/' + n).matchAll(/^(?:const|let|var|function|async function)\s+([A-Za-z_$][\w$]*)/gm)) topo.add(m[1]);
    }
    for (const f of MEUS) {
      for (const m of ler(f).matchAll(/typeof\s+([A-Za-z_$][\w$]*)\s*[!=]==?\s*'(?:function|undefined)'/g)) {
        assert.ok(!topo.has(m[1]), f + ': «typeof ' + m[1] + '» guarda um nome que a app carrega sempre — a guarda é o servicoLigado');
      }
    }
    assert.doesNotMatch(ler('app/calendario.js'), /servicoLigado\('recurring'\)&&typeof/, 'sem a guarda dupla');
  });
});
