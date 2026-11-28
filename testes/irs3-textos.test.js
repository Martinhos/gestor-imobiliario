// Os textos e os prazos que a pessoa lê antes de entregar o IRS das rendas
// (a ronda 2 das correções da segunda auditoria ao IRS, a folha dos textos):
//   N029 as rendas da categoria B não pedem o recibo de renda eletrónico, nem
//        entram no Modelo 44 de quem tem a dispensa; o guia diz a exceção
//   N030 a dispensa dos recibos é da pessoa, e as rendas de um arrendamento
//        rural vão ao Modelo 44 só por opção
//   N093 as rendas de um arrendamento rural (fisco.arrendamentoRural) não
//        pedem recibo, e um urbano ao lado continua a pedir
//   N077 as outras receitas prediais (a cedência de uso) pedem recibo; a
//        indemnização não
//   N062 o aviso do recibo por emitir marca-o como emitido num toque
//   N094 o IMI e o selo contam fora do período arrendado (art. 41.º n.º 5)
//   N095 o regime de 2019 e o n.º 24 nos contratos longos
//   N155 o quadro 10 dos contratos do Programa de Apoio ao Arrendamento
//   N045 a cozinha e a casa de banho dependem do que se fez
//   N046 os gastos de antes do contrato, que na dúvida não se abatem
//   N151 os benefícios fiscais caem com dívidas por regularizar
//   N128 a retenção do inquilino numa pergunta de três respostas, e o país só
//        quando conta
//   N036 apagar inquilinos e contratos pela seleção diz o que a Declaração perde
//   N067 apagar imóveis partilhados pela seleção diz quem mais os perde, e
//        sair de vários diz o que sair de um diz
//   N001 comunicar a cessação à AT não dispensa o quadro 10
//
// O dia da app é fixo (2026-11-13); os prazos leem o `hoje` que se lhes passa.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarTudo, limpar, repor } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';
import { paginaGuia } from '../worker/src/guia-vista.js';

const app = carregarTudo({ hoje: '2026-11-13' });
afterEach(() => repor(app));

const guia = await paginaGuia({ raiz: true }).text();
// Recebe: h — o HTML. Devolve: o texto visível, sem etiquetas e com os espaços (finos incluídos) normais
// (as ligações das referências do guia, KAN-164, saem sem espaço à volta: a frase lê-se como no ecrã).
const texto = (h) => String(h).replace(/<\/?a\b[^>]*>/g, '').replace(/<[^>]+>/g, ' ').replace(/[\s  ]+/g, ' ');
// Recebe: id — o id de uma secção do guia. Devolve: o HTML dela.
const parte = (id) => new RegExp('<section class="bloco" id="' + id + '"[\\s\\S]*?\\n {2}</section>').exec(guia)[0];
// Recebe: h — o HTML; titulo — o subtítulo de um grupo. Devolve: o HTML do grupo.
const grupo = (h, titulo) => new RegExp('<div class="grupo">\\s*<h[34]>' + titulo + '</h[34]>[\\s\\S]*?\\n {4}</div>').exec(h)[0];
// Recebe: tipo — 'sim' ou 'nao'. Devolve: os textos das linhas dessas listas do guia.
const linhas = (tipo) => [...guia.matchAll(new RegExp('<ul class="lista ' + tipo + '">([\\s\\S]*?)</ul>', 'g'))]
  .flatMap((m) => [...m[1].matchAll(/<li>[\s\S]*?<\/li>/g)].map((l) => texto(l[0]).trim()));

/* Um imóvel urbano, um inquilino e um contrato declarado de habitação; os
   recibos da dispensa vazios.
   Recebe: extra (opcional) — campos do contrato C1 (o fisco por inteiro, se vier).
   Devolve: o contrato. */
function monta(extra) {
  limpar(app);
  app.db.owners = [app.normPerson({ id: 'O1', name: 'Rui' })];
  app.db.tenants = [app.normPerson({ id: 'T1', name: 'Ana' })];
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Arroios', ownerIds: ['O1'], tipoPredio: 'U' }),
    app.normProp({ id: 'P2', name: 'Pinhal', ownerIds: ['O1'], tipoPredio: 'R' })];
  app.db.contracts = [app.normContract(Object.assign({ id: 'C1', name: 'Arroios', propertyId: 'P1', tenantIds: ['T1'], rent: 900,
    start: '2025-03-01', end: '', active: true, fisco: { estado: 'declarado', numero: '111', finalidade: 'hp' } }, extra || {}))];
  app.db.transactions = [];
  app.db.settings.prazosVistos = {};
  return app.db.contracts[0];
}

/* Um segundo contrato declarado, o do pinhal (prédio rústico).
   Recebe: fisco (opcional) — campos a juntar ao fisco dele.
   Devolve: o contrato. */
function pinhal(fisco) {
  const c = app.normContract({ id: 'C2', name: 'Pinhal', propertyId: 'P2', tenantIds: [], rent: 300, start: '2019-01-01', end: '', active: true,
    fisco: Object.assign({ estado: 'declarado', numero: '222', finalidade: 'nh' }, fisco || {}) });
  app.db.contracts.push(c);
  return c;
}

/* Uma receita de um contrato (uma renda sem recibo, por omissão).
   Recebe: id; date; extra (opcional) — campos do movimento.
   Devolve: o movimento. */
function receita(id, date, extra) {
  const t = app.normTx(Object.assign({ id, kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 900, date,
    propertyId: 'P1', contractId: 'C1', recibo: false }, extra || {}));
  app.db.transactions.push(t);
  return t;
}

// os prazos de um tipo, copiados para fora do contexto da app
const doTipo = (h, tipo) => JSON.parse(JSON.stringify(app.prazosDe(h).filter((p) => p.tipo === tipo)));

describe('N029 · as rendas da categoria B não pedem recibo de renda', () => {
  test('um contrato declarado com a categoria B não pede o recibo; o mesmo sem ela pede', () => {
    monta({ fisco: { estado: 'declarado', numero: '111', finalidade: 'nh', categoriaB: true } });
    receita('R1', '2026-11-05');
    assert.deepEqual(doTipo('2026-11-13', 'recibos'), [], 'categoria B: o documento é o da atividade (Portaria 98-A/2015, art. 5.º n.º 1)');
    assert.equal(app.pzPedeRecibo(app.contract('C1')), false);
    app.db.contracts[0].fisco.categoriaB = false;
    assert.equal(doTipo('2026-11-13', 'recibos').length, 1, 'controlo: sem a categoria B, pede');
    assert.equal(app.pzPedeRecibo(app.contract('C1')), true);
  });

  test('com a dispensa, as rendas da categoria B não pedem o Modelo 44 (não são da categoria F)', () => {
    monta({ fisco: { estado: 'declarado', numero: '111', finalidade: 'nh', categoriaB: true } });
    receita('R1', '2025-11-05');
    app.db.settings.irs = { dispensaRecibos: false, porAno: { 2025: { dispensaRecibos: true } } };
    assert.deepEqual(doTipo('2026-02-01', 'modelo44'), []);
    assert.match(doTipo('2026-04-01', 'irs')[0].titulo, /Anexo B \(ou C\)/, 'a entrega do IRS continua, com o Anexo B ou C');
    app.db.contracts[0].fisco.categoriaB = false;
    assert.equal(doTipo('2026-02-01', 'modelo44').length, 1, 'controlo: na categoria F, o Modelo 44');
  });

  test('o guia diz a exceção da categoria B no recibo de cada renda', () => {
    const t = texto(grupo(parte('como-preencher'), 'O que mudou em 2025'));
    assert.match(t, /o recibo de renda eletrónico de cada renda é obrigatório, salvo nas rendas de um arrendamento rural \(agrícola, florestal ou de campanha\) e nas que tributas na categoria B, que levam a fatura, a fatura-recibo ou o recibo da tua atividade \(artigo 115\.º, n\.º 1, alínea a\)\)/);
  });
});

describe('N093 e N030 · o arrendamento rural, por contrato', () => {
  test('as rendas de um contrato com o arrendamento rural marcado não pedem recibo; o urbano ao lado continua a pedir', () => {
    monta();
    pinhal({ arrendamentoRural: true });
    receita('R1', '2026-11-05');
    receita('R2', '2026-11-06', { contractId: 'C2', propertyId: 'P2', amount: 300 });
    assert.deepEqual(doTipo('2026-11-13', 'recibos').map((p) => p.chave.split(':')[1]), ['R1'], 'só o do T2 (Portaria 98-A/2015, art. 5.º n.º 3 a))');
    assert.equal(app.pzArrendamentoRural(app.contract('C2')), true);
    assert.equal(app.pzPedeRecibo(app.contract('C2')), false);
    app.db.contracts[1].fisco.arrendamentoRural = false;
    assert.equal(doTipo('2026-11-13', 'recibos').length, 2, 'controlo: um rústico sem a marca pede como um urbano');
  });

  test('um contrato gravado antes da pergunta (sem o campo) não é rural', () => {
    monta();
    assert.equal(app.pzArrendamentoRural(app.contract('C1')), false);
    assert.equal(app.pzArrendamentoRural(null), false);
    assert.equal(app.pzPedeRecibo(null), false);
  });

  test('com a dispensa: as rendas rurais sozinhas não pedem o Modelo 44, e com outras o aviso diz que podem ir nele por opção', () => {
    monta();
    pinhal({ arrendamentoRural: true });
    app.db.settings.irs = { dispensaRecibos: false, porAno: { 2025: { dispensaRecibos: true } } };
    receita('R2', '2025-11-06', { contractId: 'C2', propertyId: 'P2', amount: 300 });
    assert.deepEqual(doTipo('2026-02-01', 'modelo44'), [], 'só rurais: o Modelo 44 é uma opção (art. 8.º n.º 4)');
    receita('R1', '2025-11-05');
    const m = doTipo('2026-02-01', 'modelo44');
    assert.equal(m.length, 1, 'com a renda do T2, o Modelo 44 é obrigatório');
    assert.match(m[0].sub, /As de um arrendamento rural não pedem recibo: podes declará-las no Modelo 44, se quiseres\./);
    app.db.transactions = app.db.transactions.filter((t) => t.id !== 'R2');
    assert.doesNotMatch(doTipo('2026-02-01', 'modelo44')[0].sub, /arrendamento rural/, 'sem rendas rurais, não se fala delas');
  });

  test('o guia: o recibo não é obrigatório nas rendas rurais, e o Modelo 44 delas é uma opção que não dispensa os outros recibos', () => {
    const t = texto(grupo(parte('como-preencher'), 'O que mudou em 2025'));
    assert.match(t, /salvo nas rendas de um arrendamento rural/);
    assert.match(t, /As rendas de um arrendamento rural podes declará-las no Modelo 44, se quiseres; isso não te dispensa dos recibos das outras rendas \(artigo 5\.º, n\.º 3, alínea a\), e artigo 8\.º, n\.º 4, da mesma portaria\)/);
    assert.match(t, /\(ou não as recebeu e não conta passar esse valor\)/, 'a outra hipótese do n.º 2');
    // o que o D80 fixou continua
    for (const f of ['o recibo de renda eletrónico de cada renda é obrigatório', 'só de quem está dispensado dele', 'Portaria n.º 98-A/2015, artigos 5.º e 8.º']) {
      assert.ok(t.includes(f), 'falta: ' + f);
    }
  });
});

describe('N077 · as outras receitas prediais pedem recibo', () => {
  test('a cedência de uso (natureza 02) pede o recibo como a renda; a indemnização não', () => {
    monta();
    receita('R1', '2026-11-05', { sub: 'Outras receitas prediais', amount: 200 });
    receita('R2', '2026-11-06', { sub: 'Indemnização', amount: 3000 });
    const r = doTipo('2026-11-13', 'recibos');
    assert.deepEqual(r.map((p) => p.chave.split(':')[1]), ['R1'], 'só a da cedência de uso (CIRS art. 115.º n.º 5 a))');
    assert.match(r[0].sub, /^Receita predial recebida a 05\/11\/2026: a cedência de uso .* também pede recibo eletrónico, ou entra no Modelo 44 de quem tem a dispensa\./);
    assert.equal(r[0].acaoTexto, 'Marcar como emitido');
  });

  test('com a dispensa, entra no Modelo 44; num contrato da categoria B ou rural, não pede', () => {
    monta();
    receita('R1', '2025-11-05', { sub: 'Outras receitas prediais', amount: 200 });
    app.db.settings.irs = { dispensaRecibos: false, porAno: { 2025: { dispensaRecibos: true } } };
    assert.equal(doTipo('2026-02-01', 'modelo44').length, 1, 'só ela no ano: o Modelo 44 pede-a');
    app.db.settings.irs = {};
    receita('R2', '2026-11-05', { sub: 'Outras receitas prediais', amount: 200 });
    app.db.contracts[0].fisco.categoriaB = true;
    assert.deepEqual(doTipo('2026-11-13', 'recibos'), [], 'categoria B: o documento é o da atividade');
    app.db.contracts[0].fisco.categoriaB = false;
    app.db.contracts[0].fisco.arrendamentoRural = true;
    assert.deepEqual(doTipo('2026-11-13', 'recibos'), [], 'arrendamento rural: sem recibo');
  });
});

describe('N062 · o recibo marca-se como emitido no próprio aviso', () => {
  test('o prazo «Recibo de renda por emitir» tem a ação «Marcar como emitido»', () => {
    monta();
    receita('R1', '2026-11-05');
    const r = doTipo('2026-11-13', 'recibos')[0];
    assert.equal(r.acao, "pzMarcarRecibos('R1')");
    assert.equal(r.acaoTexto, 'Marcar como emitido');
    assert.match(r.sub, /e marca-o como emitido\.$/);
    assert.equal(r.abrir, "txView('R1')", 'e o toque continua a abrir a renda');
  });

  test('o cartão dos prazos leva o botão, ao lado do ✕', () => {
    monta();
    receita('R1', '2026-11-05');
    app.prazosAtivos = () => app.prazosDe('2026-11-13');
    assert.match(app.prazosCard(), /<button type="button" class="btn sm vg-feito" data-toca="camada" aria-label="Marcar como emitido: Recibo de renda por emitir" data-click="pzMarcarRecibos\('R1'\)">Marcar como emitido<\/button>/);
  });

  test('um toque marca o recibo, o aviso cala-se, e o Anular devolve-o a por emitir', () => {
    monta();
    receita('R1', '2026-11-05');
    receita('R2', '2026-10-05', { recibo: true });
    let desfaz = null, msg = '';
    app.save = () => {}; app.render = () => {};
    app.comDesfazer = (m, restaurar) => { msg = m; desfaz = restaurar; };
    app.pzMarcarRecibos('R1');
    assert.equal(app.db.transactions.find((t) => t.id === 'R1').recibo, true);
    assert.equal(msg, 'Recibo marcado como emitido.');
    assert.deepEqual(doTipo('2026-11-13', 'recibos'), []);
    desfaz();
    assert.equal(app.db.transactions.find((t) => t.id === 'R1').recibo, false, 'o Anular devolve-o');
    assert.equal(app.db.transactions.find((t) => t.id === 'R2').recibo, true, 'e não mexe no que já estava emitido');
    receita('R3', '2026-09-05');
    app.pzMarcarRecibos(['R1', 'R3', 'R2', 'X9']);
    assert.equal(msg, '2 recibos marcados como emitidos.', 'vários de uma vez (a Declaração), sem contar os já emitidos nem os que não existem');
  });

  test('quem não pode alterar o movimento não o marca, e não vê a ação', () => {
    monta();
    receita('R1', '2026-11-05');
    const toasts = [];
    app.toast = (m) => { toasts.push(m); };
    app.podeEditar = () => false;
    app.save = () => {}; app.render = () => {};
    app.pzMarcarRecibos('R1');
    assert.equal(app.db.transactions[0].recibo, false);
    assert.equal(toasts.length, 1, 'diz porquê');
    assert.equal(doTipo('2026-11-13', 'recibos')[0].acao, undefined, 'sem a ação no aviso');
  });
});

describe('N001 · a cessação comunicada não dispensa o quadro 10', () => {
  test('um contrato com redução que acabou: os dois avisos da cessação dizem o quadro 10 do ano em que acabou', () => {
    monta({ start: '2024-01-01', end: '2033-12-31', active: false,
      fisco: { estado: 'declarado', numero: '111', finalidade: 'hp', cessacao: { data: '2026-06-30', motivo: '02' } } });
    const c = doTipo('2026-07-05', 'cessacao')[0];
    assert.match(c.sub, /Comunicar a cessação não dispensa o quadro 10 do Anexo F de 2026: o contrato vai lá, com a data e o motivo\./);
    const f = doTipo('2027-01-10', 'fev15').find((p) => p.evento === 'cessacao');
    assert.match(f.sub, /não dispensa o quadro 10 do Anexo F de 2026/);
  });

  test('um contrato sem redução nem isenção não vai ao quadro 10, e o aviso não fala dele', () => {
    monta({ start: '2025-03-01', end: '2027-02-28', active: false,
      fisco: { estado: 'declarado', numero: '111', finalidade: 'hp', cessacao: { data: '2026-06-30', motivo: '02' } } });
    const c = doTipo('2026-07-05', 'cessacao')[0];
    assert.ok(c, 'controlo: o aviso existe');
    assert.doesNotMatch(c.sub, /quadro 10/);
  });
});

describe('o guia diz o que a Declaração faz', () => {
  test('N094 · o IMI e o selo contam fora do período arrendado, na parte 3 e na parte 4', () => {
    const linha = texto(grupo(parte('como-preencher'), 'Linha a linha'));
    assert.match(linha, /O IMI e o imposto do selo são a exceção: contam os que pagaste no ano, mesmo com o prédio vazio, desde que ele tenha dado rendas tributadas nesse ano \(artigo 41\.º, n\.º 5; vê a parte 4\)/);
    const regra = texto(parte('regra'));
    assert.match(regra, /Contam os gastos do tempo em que o imóvel esteve arrendado/);
    assert.match(regra, /O IMI e o imposto do selo são a exceção: contam os que pagaste no ano em que o imóvel deu rendas, mesmo que no dia do pagamento estivesse vazio \(artigo 41\.º, n\.º 5\)/);
    // a ficha 1115/2017 aceitou também o condomínio do ano inteiro: o guia não o afirma
    assert.doesNotMatch(texto(guia), /condomínio[^.]*(ano inteiro|totalidade)/);
  });

  test('N095 · os contratos longos: o regime de 2019, o recálculo na renovação e o n.º 24', () => {
    const t = texto(grupo(parte('tens-de-declarar'), 'Os contratos longos'));
    for (const f of ['para os contratos celebrados ou renovados desde 7 de outubro de 2023',
      'Um contrato celebrado ou renovado de 1 de janeiro de 2019 a 6 de outubro de 2023 mantém as reduções do regime anterior, que contavam a partir dos 28 %',
      'Lei n.º 56/2023, artigo 50.º, n.º 7', '23 % num contrato de 5 a menos de 10 anos', 'artigo 50.º, n.º 8',
      'Na primeira renovação desde 7 de outubro de 2023, a redução conta-se de novo a partir dos 25 %', 'fica com 13 %',
      'Ofício-Circulado n.º 20268, de 12 de março de 2024, pontos 4 e 6 a 8', 'artigo 72.º, n.º 24', 'quadro 4.2B']) {
      assert.ok(t.includes(f), 'falta: ' + f);
    }
    assert.match(guia, /href="https:\/\/info\.portaldasfinancas\.gov\.pt\/[^"]*Oficio_circulado_20268_2024\.pdf"/);
  });

  test('N155 · o quadro 10 também dos contratos do Programa de Apoio ao Arrendamento e dos municipais', () => {
    const q10 = texto(grupo(parte('como-preencher'), 'Os outros quadros')).split('Quadro 10:')[1];
    assert.match(q10, /os do Programa de Apoio ao Arrendamento \(Decreto-Lei n\.º 68\/2019\) ou de um programa municipal com isenção, que acabaram ou saíram do programa, com a data e o motivo/);
  });

  test('N045 · a cozinha e a casa de banho dependem do que se fez: saíram do «podes» para «o que pede cuidado»', () => {
    const sim = linhas('sim');
    assert.ok(!sim.some((l) => /sanita|bancadas de cozinha/.test(l)), 'não se dão como dedutíveis sem mais');
    const cuidado = texto(parte('cuidado'));
    assert.match(cuidado, /Cozinha e casa de banho Depende do que fizeste\. Reparar ou substituir o que já lá estava/);
    assert.match(cuidado, /Uma cozinha ou uma casa de banho nova, que acrescenta ao que havia e valoriza o imóvel, é uma melhoria, e pode não se abater/);
  });

  test('N046 · os gastos de antes do contrato: na dúvida não se abatem, com as duas respostas da AT', () => {
    const sim = linhas('sim');
    assert.ok(!sim.includes('Podes deduzir: O certificado energético, porque precisas dele para arrendar.'), 'a promessa sem condição saiu');
    assert.ok(sim.some((l) => /O certificado energético e a comissão da imobiliária por te encontrar inquilino, pagos com o imóvel arrendado/.test(l)));
    const cuidado = texto(parte('cuidado'));
    assert.match(cuidado, /Gastos pagos antes de o arrendamento começar/);
    assert.match(cuidado, /processo 1115\/2017/);
    assert.match(cuidado, /processo 26713, de 2024/);
    assert.match(cuidado, /Na dúvida, não os abatas\./);
    assert.match(guia, /href="https:\/\/info\.portaldasfinancas\.gov\.pt\/[^"]*PIV_26713\.pdf"/);
  });

  test('N151 · os benefícios fiscais só valem sem dívidas por regularizar', () => {
    const t = texto(grupo(parte('tens-de-declarar'), 'Rendas isentas'));
    assert.match(t, /as isenções, a taxa de 10 % das rendas moderadas e os dos quadros 6A a 6C/);
    assert.match(t, /não tiveres dívidas por regularizar às Finanças nem à Segurança Social/);
    assert.match(t, /artigo 14\.º, n\.os 5 a 7, do Estatuto dos Benefícios Fiscais/);
    assert.match(guia, /href="https:\/\/diariodarepublica\.pt\/dr\/legislacao-consolidada\/decreto-lei\/1989-34554075#:~:text=Artigo%2014\.%C2%BA-,Extin%C3%A7%C3%A3o%20dos%20benef%C3%ADcios%20fiscais"/, 'o artigo 14.º do EBF, no DR (KAN-164)');
    // o dinheiro e as percentagens novas com o espaço fino da casa
    assert.doesNotMatch(parte('tens-de-declarar'), /\d [%€]/);
  });
});

/* O formulário do inquilino com uma ficha.
   Recebe: p — os campos da pessoa.
   Devolve: o HTML do formulário. */
function formInquilino(p) {
  app.perKind = 'tenant';
  app.perForm = app.normPerson(Object.assign({ id: 'T9', name: 'Ana' }, p));
  return app.personBody();
}
// Recebe: html; id. Devolve: true quando o elemento com esse id nasce escondido.
const escondido = (html, id) => new RegExp('id="' + id + '" hidden').test(html);

/* Os campos no ecrã, a partir de um objeto {id: valor}; os outros ids não existem.
   Recebe: valores. Devolve: a função que repõe o getElementById. */
function noEcra(valores) {
  const doc = app.document, original = doc.getElementById;
  doc.getElementById = (id) => (id in valores
    ? { value: valores[id] === true ? 'on' : String(valores[id]), checked: valores[id] === true, hidden: false, focus() {} }
    : null);
  return () => { doc.getElementById = original; };
}

describe('N128 · a retenção do inquilino, numa pergunta só, e o país quando conta', () => {
  test('num NIF de pessoa a pergunta fica atrás da ligação «Este inquilino retém IRS?»; num de empresa, à vista', () => {
    monta();
    let h = formInquilino({ nif: '234567899' });
    assert.ok(escondido(h, 'pe_retemBox'), 'particular: a pergunta escondida');
    assert.ok(!escondido(h, 'pe_retemLig'), 'e a ligação à vista');
    assert.match(h, /data-click="pessoaRetemAbrir\(\)">Este inquilino retém IRS\?<\/button>/);
    h = formInquilino({ nif: '509123456' });
    assert.ok(!escondido(h, 'pe_retemBox'), 'empresa: a pergunta à vista');
    assert.ok(escondido(h, 'pe_retemLig'));
  });

  test('três respostas — Retém, Não retém, Por confirmar —, e a ficha marcada abre-a com a resposta', () => {
    monta();
    let h = formInquilino({ nif: '509123456' });
    assert.deepEqual([...h.matchAll(/data-click="pessoaRetem\('(\w*)'\)">.*?<span>([^<]+)<\/span>/g)].map((m) => [m[1], m[2]]),
      [['sim', 'Retém'], ['nao', 'Não retém'], ['', 'Por confirmar']]);
    assert.match(h, /id="pe_retemR" value=""/, 'sem resposta: por confirmar');
    assert.match(h, /role="radio" aria-checked="true" class="chip on" data-v=""/);
    h = formInquilino({ nif: '234567899', retem: true });
    assert.ok(!escondido(h, 'pe_retemBox'), 'já marcada: à vista mesmo com NIF de pessoa');
    assert.match(h, /id="pe_retemR" value="sim"/);
    h = formInquilino({ nif: '234567899', retemVisto: true });
    assert.ok(!escondido(h, 'pe_retemBox'));
    assert.match(h, /id="pe_retemR" value="nao"/);
    assert.doesNotMatch(h, /id="pe_retem"|id="pe_retemVisto"/, 'as duas caixas de antes saíram');
  });

  test('o inquilino de um contrato não habitacional vê a pergunta logo (um empresário em nome individual)', () => {
    monta({ fisco: { estado: 'declarado', numero: '111', finalidade: 'nh' }, tenantIds: ['T9'] });
    const h = formInquilino({ nif: '234567899' });
    assert.match(h, /<div id="pe_retemBox">/, 'a pergunta à vista, sem a ligação');
    assert.ok(escondido(h, 'pe_retemLig'));
    monta({ fisco: { estado: 'declarado', numero: '111', finalidade: 'hp' }, tenantIds: ['T9'] });
    assert.ok(escondido(formInquilino({ nif: '234567899' }), 'pe_retemBox'), 'controlo: num de habitação, atrás da ligação');
  });

  test('o collectPerson lê a resposta: «Retém» é retem, «Não retém» é retemVisto, mesmo com NIF de pessoa', () => {
    monta();
    formInquilino({ nif: '234567899' });
    for (const [r, retem, visto] of [['sim', true, false], ['nao', false, true], ['', false, false]]) {
      const desfaz = noEcra({ pe_name: 'Ana', pe_nif: '234567899', pe_retemR: r });
      try { app.collectPerson(); } finally { desfaz(); }
      assert.equal(app.perForm.retem, retem, r);
      assert.equal(app.perForm.retemVisto, visto, r);
    }
    app.perForm.retem = true; app.perKind = 'owner';
    const desfaz = noEcra({ pe_name: 'Rui' });
    try { app.collectPerson(); } finally { desfaz(); }
    assert.equal(app.perForm.retem, true, 'num proprietário, sem a pergunta, fica o que estava');
  });

  test('a ficha do inquilino diz «confirmaste que não retém» também com NIF de pessoa', () => {
    monta();
    assert.equal(app.pesRetencaoTexto(app.normPerson({ nif: '234567899', retemVisto: true })), 'confirmaste que não retém');
    assert.equal(app.pesRetencaoTexto(app.normPerson({ nif: '234567899' })), '', 'sem resposta, nada');
  });

  test('o país só com o NIF em branco ou que não é português, ou já escrito', () => {
    monta();
    assert.ok(escondido(formInquilino({ nif: '234567899' }), 'pe_paisL'), 'NIF português: escondido');
    assert.ok(!escondido(formInquilino({ nif: '' }), 'pe_paisL'), 'sem NIF: à vista');
    assert.ok(!escondido(formInquilino({ nif: 'X1234567L' }), 'pe_paisL'), 'um número de fora: à vista');
    assert.ok(!escondido(formInquilino({ nif: '234567899', pais: 'Espanha' }), 'pe_paisL'), 'já escrito: à vista');
    assert.match(formInquilino({}), /<label>País \(opcional\)<input id="pe_pais"/, 'a condição aplica-se, já não se escreve no rótulo');
    assert.equal(app.pessoaPedePais('123456789', ''), false);
    assert.equal(app.pessoaPedePais('123456780', ''), true, 'um NIF que não bate certo pode ser de fora');
  });

  test('passar a reter propõe levar a retenção ao planeado da renda, depois de guardar', () => {
    monta();
    app.db.tenants = [app.normPerson({ id: 'T1', name: 'Ana', nif: '509123456' })];
    const chamadas = [];
    app.recPropoeRetencaoDoInquilino = (id) => { chamadas.push(id); return false; };
    janelasFalsas(app, 'render', 'save', 'toast', 'buildNav');
    app.collectPerson = () => { app.perForm.retem = true; };
    app.personModal('tenant', 'T1');
    app.onSave();
    assert.deepEqual(chamadas, ['T1']);
    app.personModal('tenant', 'T1');
    app.onSave();
    assert.deepEqual(chamadas, ['T1'], 'já retinha: não volta a propor');
  });
});

describe('N036 · apagar pela seleção diz o que a Declaração perde', () => {
  let perguntas;
  /* A seleção pronta: o confirmModal guarda a pergunta e não confirma. */
  function selecao() {
    perguntas = [];
    app.confirmModal = (t, txt) => { perguntas.push({ t, txt }); };
    app.CW.user = { id: 'EU' };
  }

  test('um inquilino de um contrato com rendas do ano: o aviso da ficha, com o «Terminar contrato» a sair da seleção', () => {
    monta();
    receita('R1', '2026-10-05', { recibo: true });
    selecao();
    app.CW.selL = { tipo: 'ten', ids: { T1: 1 } };
    app.CW.selLApagar();
    const txt = perguntas[0].txt;
    assert.match(txt, /^Apagar “Ana”\? Sai de 1 contrato, que se mantém\. A Declaração do IRS de 2026, ainda por entregar, tem rendas do contrato «Arroios» \(900,00/);
    assert.match(txt, /fica sem este inquilino, e o Anexo F pede o NIF dele/);
    assert.match(txt, /data-click="closeModal\(\);(CW\.selLSair\(\);)?endContract\('C1'\)">Terminar contrato<\/button>/);
  });

  test('vários inquilinos: uma frase curta com cada um que tenha rendas por entregar', () => {
    monta();
    app.db.tenants.push(app.normPerson({ id: 'T2', name: 'Bruno' }), app.normPerson({ id: 'T3', name: 'Carla' }));
    app.db.contracts.push(app.normContract({ id: 'C3', name: 'Benfica', propertyId: 'P1', tenantIds: ['T2'], rent: 700, start: '2025-01-01',
      fisco: { estado: 'declarado', numero: '333', finalidade: 'hp' } }));
    receita('R1', '2026-10-05', { recibo: true });
    receita('R3', '2026-10-06', { recibo: true, contractId: 'C3', amount: 700 });
    selecao();
    app.CW.selL = { tipo: 'ten', ids: { T1: 1, T2: 1, T3: 1 } };
    app.CW.selLApagar();
    const txt = perguntas[0].txt;
    assert.match(txt, /^Saem de 2 contratos, que se mantêm\. A Declaração do IRS de 2026, ainda por entregar, tem rendas dos contratos de <b>Ana<\/b> \(«Arroios», 900,00.€\) e <b>Bruno<\/b> \(«Benfica», 700,00.€\): sem estas fichas/);
    assert.match(txt, /Se saíram, termina os contratos em vez de apagar as fichas: ficam na Declaração com eles, nos anos em que lá moraram\.$/);
    assert.doesNotMatch(txt, /Carla/, 'quem não tem contrato não entra na lista');
  });

  test('vários inquilinos sem rendas por entregar: só a contagem de sempre', () => {
    monta({ fisco: { estado: 'naoDeclarado' } });
    receita('R1', '2026-10-05', { recibo: true });
    app.db.tenants.push(app.normPerson({ id: 'T2', name: 'Bruno' }));
    selecao();
    app.CW.selL = { tipo: 'ten', ids: { T1: 1, T2: 1 } };
    app.CW.selLApagar();
    assert.equal(perguntas[0].txt, 'Saem de 1 contrato, que se mantém.', 'um contrato «não declarado» já está fora');
  });

  test('um contrato pela seleção: o aviso do apagar de um; vários: quanto sai de cada um', () => {
    monta();
    receita('R1', '2026-10-05', { recibo: true });
    selecao();
    app.CW.selL = { tipo: 'ct', ids: { C1: 1 } };
    app.CW.selLApagar();
    assert.match(perguntas[0].txt, /^Os movimentos ficam, mas deixam de estar ligados a eles\. As rendas de 2026 deste contrato \(900,00.€\) ficam sem contrato, e a Declaração do IRS desse ano, ainda por entregar, perde a linha dele/);
    app.db.contracts.push(app.normContract({ id: 'C3', name: 'Benfica', propertyId: 'P1', tenantIds: [], rent: 700, start: '2025-01-01', active: false, end: '2026-10-31',
      fisco: { estado: 'declarado', numero: '333', finalidade: 'hp', cessacao: { data: '2026-10-31', motivo: '02' } } }));
    receita('R3', '2026-10-06', { recibo: true, contractId: 'C3', amount: 700 });
    app.CW.selL = { tipo: 'ct', ids: { C1: 1, C3: 1 } };
    app.CW.selLApagar();
    const txt = perguntas[1].txt;
    assert.match(txt, /As rendas de 2026 de «Arroios» \(900,00.€\) e «Benfica» \(700,00.€\) ficam sem contrato, e a Declaração do IRS desse ano, ainda por entregar, perde a linha de cada um: a taxa e as datas, e a cessação nos que já terminaram\./);
    assert.match(txt, /Se um contrato acabou, termina-o em vez de o apagar/);
  });
});

describe('N067 · apagar imóveis partilhados pela seleção, e sair de vários', () => {
  let perguntas;
  /* O estado das casas: P1 minha e só minha, P3 minha com o Bruno, P4 minha
     com a Carla, H2 e H5 de outros, onde sou comproprietário. */
  function casas() {
    limpar(app);
    perguntas = [];
    app.CW.user = { id: 'EU' };
    app.db.owners = [app.normPerson({ id: 'EU', name: 'Eu' }), app.normPerson({ id: 'BRUNO', name: 'Bruno' }), app.normPerson({ id: 'CARLA', name: 'Carla' })];
    app.db.properties = [app.normProp({ id: 'P1', name: 'Só minha', ownerIds: ['EU'] }),
      app.normProp({ id: 'P3', name: 'T2 Benfica', ownerIds: ['EU', 'BRUNO'] }),
      app.normProp({ id: 'P4', name: 'T1 Lumiar', ownerIds: ['EU', 'CARLA'] }),
      app.normProp({ id: 'H2', name: 'Partilhada', ownerIds: ['RUI', 'EU'] }),
      app.normProp({ id: 'H5', name: 'Só nós', ownerIds: ['RUI', 'EU'] })];
    app.CW.cargos = { H2: { dono: true, criador: false }, H5: { dono: true, criador: false } };
    app.confirmModal = (t, txt) => { perguntas.push({ t, txt }); };
  }

  test('um imóvel meu partilhado: diz quem mais o perde', () => {
    casas();
    app.CW.selL = { tipo: 'prop', ids: { P3: 1 } };
    app.CW.selLApagar();
    assert.match(perguntas[0].txt, /O imóvel desaparece também para <b>Bruno<\/b>, que deixa de o ter na lista e na Declaração do IRS, também nos meses em que foi dono, e recebe um aviso\./);
  });

  test('vários partilhados: os nomes e os donos de cada um, e «Transferir o controlo» a quem pode', () => {
    casas();
    app.imvPossoTransferir = () => true;
    app.CW.selL = { tipo: 'prop', ids: { P1: 1, P3: 1, P4: 1 } };
    app.CW.selLApagar();
    const txt = perguntas[0].txt;
    assert.match(txt, /<b>T2 Benfica<\/b> \(de <b>Bruno<\/b>\) e <b>T1 Lumiar<\/b> \(de <b>Carla<\/b>\) desaparecem também para os outros donos/);
    assert.doesNotMatch(txt, /Só minha<\/b> \(/, 'o que é só meu não entra');
    assert.match(txt, /data-click="closeModal\(\);CW\.selLTransferir\(\)">Transferir o controlo<\/button>/);
  });

  test('um só meu partilhado entre vários: diz qual', () => {
    casas();
    app.CW.selL = { tipo: 'prop', ids: { P1: 1, P3: 1 } };
    app.CW.selLApagar();
    assert.match(perguntas[0].txt, /<b>T2 Benfica<\/b> desaparece também para <b>Bruno<\/b>/);
  });

  test('sair de vários em compropriedade diz o que sair de um diz: as quotas de antes ficam, e a Declaração e o PDF', () => {
    casas();
    app.db.transactions = [app.normTx({ id: 'X1', kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 500, date: '2026-03-02', propertyId: 'H2' })];
    app.CW.selL = { tipo: 'prop', ids: { H2: 1, H5: 1 } };
    app.CW.selLApagar();
    const txt = perguntas[0].txt;
    assert.doesNotMatch(txt, /e os saldos e o IRS passam a contar com as quotas novas/, 'a frase de antes, que mudava o IRS para trás, saiu');
    assert.match(txt, /a partir de hoje\. As quotas de antes ficam guardadas até ontem: o IRS dos outros conta com elas nos dias em que eras dono/);
    assert.match(txt, /Deixam de entrar na tua Declaração do IRS, também nos anos em que foste dono: antes de saíres, guarda o PDF ou a folha de cálculo de 2026./);
    assert.match(txt, /data-click="imvExportarAno\('pdf',2026\)">PDF de 2026<\/button>/);
  });
});
