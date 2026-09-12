// Os dados de exemplo contam a história do IRS, e o CSV leva o que o Anexo F
// pede. O exemplo é a primeira coisa que alguém vê da página Fisco: se os NIFs
// não batem certo, se os contratos declarados não têm o número da AT, se as
// rendas não sabem a que mês respeitam, a página aponta faltas que a própria
// app inventou — e a promessa da landing («resume, e aponta o que falta»)
// fica desmentida pelo exemplo. O CSV é a saída de quem faz o IRS noutro lado:
// tem de levar o mês, a retenção, o recibo, a coluna e o estado do contrato.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { carregarTudo, igual } from './arnes.js';

/* A app inteira: o seed vive no arranque, e a nuvem embrulha-o para recusar
   em produção (cloud/guia.js) — por isso o ambiente finge-se antes. */
const app = carregarTudo();
app.CW.ambiente = 'desenvolvimento';
app.seed();
const db = app.db;
const YEAR = app.YEAR;

const porNome = (lista, nome) => lista.find((x) => x.name === nome);
const contratoDe = (tx) => db.contracts.find((c) => c.id === tx.contractId);

describe('o exemplo traz o que o Anexo F e o Modelo 2 pedem', () => {
  test('o seed encheu a base', () => {
    assert.ok(db.properties.length >= 3, 'imóveis');
    assert.ok(db.contracts.length >= 4, 'contratos');
    assert.ok(db.transactions.length > 20, 'movimentos');
  });

  test('cada imóvel tem código de freguesia de seis dígitos e tipo de prédio', () => {
    db.properties.forEach((p) => {
      assert.match(p.freguesiaCodigo, /^\d{6}$/, p.name + ': código da freguesia');
      assert.ok(['U', 'R'].includes(p.tipoPredio), p.name + ': tipo U ou R');
      assert.ok(p.distrito, p.name + ': distrito');
      assert.match(p.tipologia, /^T\d$/, p.name + ': tipologia');
      assert.ok(p.vpt > 0, p.name + ': VPT');
    });
    /* a escritura foi uns dias antes de o crédito de aquisição começar */
    const t2 = porNome(db.properties, 'T2 Lisboa');
    const credito = t2.loans.find((l) => l.name === 'Aquisição');
    assert.ok(t2.purchaseDate < credito.start, 'a compra antecede o crédito de aquisição');
    assert.ok(credito.start.startsWith(String(YEAR - 6)), 'no ano do crédito');
  });

  test('os NIFs preenchidos passam o dígito de controlo; quem não tem NIF tem país', () => {
    const pessoas = db.owners.concat(db.tenants);
    const comNif = pessoas.filter((p) => p.nif);
    assert.ok(comNif.length >= 3, 'há NIFs no exemplo (' + comNif.length + ')');
    comNif.forEach((p) => assert.equal(app.nifValido(p.nif), true, p.name + ': ' + p.nif + ' não passa o dígito de controlo'));
    const semNif = db.tenants.filter((t) => !t.nif && t.pais);
    assert.ok(semNif.length >= 1, 'um inquilino sem NIF português mostra o caso do país');
    assert.equal(semNif[0].pais, 'Brasil');
    /* nenhuma retenção inventada: as rendas do exemplo são de pessoas singulares */
    assert.ok(pessoas.every((p) => p.retem === false), 'ninguém retém na fonte');
    assert.ok(db.transactions.every((t) => !t.retencao), 'nenhuma renda com retenção');
  });

  test('três contratos declarados com o número da AT, um por indicar, nenhum não declarado', () => {
    const declarados = db.contracts.filter(app.ctDeclarado);
    const porIndicar = db.contracts.filter(app.ctFiscoPorIndicar);
    assert.ok(declarados.length >= 2, 'pelo menos dois declarados (' + declarados.length + ')');
    assert.equal(porIndicar.length, 1, 'um por indicar — o que faz aparecer o prazo do Modelo 2');
    assert.equal(db.contracts.filter(app.ctNaoDeclarado).length, 0, 'a app não escolhe «não declarado» por ninguém');
    const numeros = new Set();
    declarados.forEach((c) => {
      assert.match(c.fisco.numero, /^\d{7}$/, 'número da AT com sete dígitos');
      numeros.add(c.fisco.numero);
      assert.equal(c.fisco.finalidade, 'hp', 'habitação permanente');
      assert.ok(c.fisco.celebracao && c.fisco.celebracao < c.start, 'celebrado antes de começar');
      assert.equal(c.fisco.renovavel, true);
    });
    assert.equal(numeros.size, declarados.length, 'cada contrato tem o seu número');
    /* o por indicar é o do quarto 3, com rendas já lançadas: é o caso que a página Fisco aponta */
    assert.ok(db.transactions.some((t) => t.contractId === porIndicar[0].id && app.ehRenda(t)), 'o por indicar tem rendas');
  });

  test('cada renda sabe o mês a que respeita; a última do T2 é a que está sem recibo', () => {
    const rendas = db.transactions.filter(app.ehRenda);
    assert.ok(rendas.length >= 8, 'há rendas (' + rendas.length + ')');
    rendas.forEach((t) => {
      assert.equal(t.periodo, t.date.slice(0, 7), t.label + ' ' + t.date + ': o mês é o da data');
      assert.equal(t.category, 'Rendas');
      assert.equal(t.sub, 'Renda mensal');
    });
    const t2 = rendas.filter((t) => app.ctDeclarado(contratoDe(t)) && t.label === 'Renda T2 Lisboa')
      .sort((a, b) => a.date.localeCompare(b.date));
    assert.ok(t2.length >= 2, 'rendas do T2 declarado');
    assert.ok(t2.slice(0, -1).every((t) => t.recibo === true), 'as anteriores têm recibo emitido');
    assert.equal(t2[t2.length - 1].recibo, false, 'a última ainda não: é o prazo dos recibos a mostrar-se');
  });

  test('a pintura antes do arrendamento é conservação sem contrato ativo; a escolha no movimento manda', () => {
    const pintura = db.transactions.find((t) => t.label === 'Pintura do quarto');
    assert.ok(pintura, 'existe');
    assert.equal(app.irsColunaDe(pintura).col, 'conservacao');
    assert.equal(pintura.date.slice(0, 4), String(YEAR), 'no ano corrente, senão o exemplo esconde-a');
    const quarto3 = db.contracts.find(app.ctFiscoPorIndicar);
    assert.equal(pintura.propertyId, quarto3.propertyId, 'no mesmo imóvel');
    assert.ok(pintura.date < quarto3.start, 'antes de o quarto ser arrendado');
    const ativos = db.contracts.filter((c) => c.propertyId === pintura.propertyId && c.start <= pintura.date);
    assert.equal(ativos.length, 0, 'e sem nenhum contrato ativo no imóvel nesse dia');
    const esquentador = db.transactions.find((t) => t.label === 'Substituição do esquentador');
    igual(app.irsColunaDe(esquentador), { col: 'conservacao', origem: 'movimento' });
  });
});

describe('o CSV leva o que o IRS pede', () => {
  /* cada campo vai entre aspas, ponto e vírgula a separar; uma aspa dentro dobra-se */
  const campos = (linha) => linha.replace(/^"|"$/g, '').split('";"').map((x) => x.split('""').join('"'));
  let guardado = null;
  app.download = (name, mime, content) => { guardado = { name, mime, content }; };
  app.downloadCsv();
  const linhas = guardado.content.split('\n');
  const cab = campos(linhas[0]);
  const col = (nome) => cab.indexOf(nome);
  const rows = linhas.slice(1).map(campos);
  const row = (label) => rows.filter((r) => r[col('descricao')] === label);

  test('o ficheiro sai com o nome e o tipo de sempre', () => {
    assert.equal(guardado.name, 'movimentos-imobiliarios.csv');
    assert.match(guardado.mime, /^text\/csv/);
  });

  test('o cabeçalho acaba nas seis colunas do IRS, e cada linha tem as mesmas colunas', () => {
    assert.deepEqual(cab.slice(-6), ['mes_renda', 'retencao', 'recibo', 'coluna_irs', 'contrato_fisco', 'contrato_at']);
    assert.equal(rows.length, db.transactions.length, 'uma linha por movimento — nenhum comentário parte uma linha');
    rows.forEach((r, i) => assert.equal(r.length, cab.length, 'linha ' + (i + 1) + ' com ' + r.length + ' campos'));
    assert.ok(linhas.every((l) => l.startsWith('"') && l.endsWith('"')), 'tudo entre aspas');
  });

  test('uma renda de contrato declarado leva o mês, o recibo e o número da AT', () => {
    const t2 = row('Renda T2 Lisboa');
    assert.ok(t2.length >= 8, 'as rendas do T2');
    const c1 = db.contracts.find((c) => c.propertyId === porNome(db.properties, 'T2 Lisboa').id);
    t2.forEach((r) => {
      assert.equal(r[col('contrato_fisco')], 'declarado');
      assert.equal(r[col('contrato_at')], c1.fisco.numero);
      assert.equal(r[col('mes_renda')], r[col('data')].slice(0, 7));
      assert.ok(['sim', 'nao'].includes(r[col('recibo')]), 'recibo sim/nao');
      assert.equal(r[col('retencao')], '', 'sem retenção inventada');
      assert.equal(r[col('coluna_irs')], '', 'uma renda não tem coluna de gasto');
    });
    const ultima = t2.slice().sort((a, b) => a[col('data')].localeCompare(b[col('data')])).pop();
    assert.equal(ultima[col('recibo')], 'nao');
  });

  test('uma renda de contrato por indicar di-lo, sem número', () => {
    const q3 = row('Renda Quarto 3');
    assert.ok(q3.length >= 1);
    q3.forEach((r) => {
      assert.equal(r[col('contrato_fisco')], 'por indicar');
      assert.equal(r[col('contrato_at')], '');
    });
  });

  test('uma despesa leva a coluna do Anexo F pelo nome; o que não é despesa nem renda vai vazio', () => {
    assert.equal(row('Pintura do quarto')[0][col('coluna_irs')], 'Conservação e manutenção');
    assert.equal(row('Substituição do esquentador')[0][col('coluna_irs')], 'Conservação e manutenção');
    assert.equal(row('Quota do condomínio')[0][col('coluna_irs')], 'Condomínio');
    assert.equal(row('IMI ' + YEAR)[0][col('coluna_irs')], 'IMI');
    const despesa = row('Pintura do quarto')[0];
    assert.equal(despesa[col('recibo')], '', 'recibo só nas rendas');
    assert.equal(despesa[col('mes_renda')], '');
    assert.equal(despesa[col('contrato_fisco')], '', 'sem contrato, sem estado');
    const prestacao = row('Prestação casa de família')[0];
    assert.equal(prestacao[col('coluna_irs')], '', 'uma prestação não é um gasto do Anexo F');
    assert.equal(prestacao[col('recibo')], '');
  });
});
