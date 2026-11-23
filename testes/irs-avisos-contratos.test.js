// Os avisos dos contratos na Declaração (KAN-127, folha 2.2.9 da vaga 2 do
// IRS): os meses em vigor sem renda registada e os contratos sem renda
// nenhuma (D04), a comunicação da duração por período e o 4.2C por confirmar
// (D12), o inquilino pessoa coletiva num contrato de habitação (D47), a
// versão provisória depois de a entrega abrir (D49), a isenção que não conta
// (D46), o contrato terminado sem o dia em que acabou (D02), o motivo da
// cessação em falta (D09), a regularização do n.º 20 (D10), o selo pago antes
// da celebração (D27), o prejuízo de anos anteriores que o imposto estimado
// já abate (Q10), a conjunta sem o cônjuge escolhido (D30), e o AIMI sem quem
// o pagou e os prédios sem a afetação da caderneta (D32, D71). O resumo que
// os avisos leem monta-se à mão, com a forma do contrato de interfaces
// (fiscoAvisos recebe-o inteiro): os campos novos são do fisco-resumo.js e do
// fisco-titulares.js, que mudam na mesma vaga; os contratos e as rendas
// leem-se da base.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-17' });
/* a mesma app em abril de 2027, com a entrega dos rendimentos de 2026 aberta */
const tarde = carregarApp({ hoje: '2027-04-15' });
afterEach(() => repor(app));
afterEach(() => repor(tarde));

const ANO = 2026;
/* a base de cada teste: um proprietário, um imóvel com os dados matriciais,
   uma inquilina particular e uma empresa
   Recebe: a — a app.
   Devolve: nada. */
const base = (a) => {
  limpar(a);
  a.fiscoAno = '';
  a.db.owners.push(a.normPerson({ id: 'o1', name: 'Eu' }));
  a.db.properties.push(a.normProp({ id: 'p1', name: 'T2 Arroios', ownerIds: ['o1'], freguesiaCodigo: '110658', tipoPredio: 'U', matrix: '1234' }));
  a.db.tenants.push(a.normPerson({ id: 't1', name: 'Ana', nif: '123456789' }),
    a.normPerson({ id: 'emp', name: 'Empresa, Lda.', nif: '500000000' }));
};
beforeEach(() => { base(app); base(tarde); });

/* um contrato na base
   Recebe: extra — o que muda (id, rent, start, end, fisco…); a (opcional) — a app.
   Devolve: o contrato normalizado. */
const ct = (extra, a = app) => {
  const fisco = Object.assign({ estado: 'declarado', numero: '123', finalidade: 'nh' }, (extra && extra.fisco) || {});
  const c = a.normContract(Object.assign({ id: 'C1', name: 'Loja', propertyId: 'p1', tenantIds: ['t1'], rent: 1000,
    start: '2024-01-01', end: '2028-12-31', active: true }, extra, { fisco }));
  a.db.contracts.push(c);
  return c;
};
/* as rendas de um contrato, uma por mês, no dia 5
   Recebe: contractId; ano; meses ([1..12]); a (opcional) — a app; extra (periodo…).
   Devolve: nada. */
const rendas = (contractId, ano, meses, a = app) => meses.forEach((m) => {
  const mm = String(m).padStart(2, '0');
  a.db.transactions.push(a.normTx({ id: contractId + '-' + ano + mm, kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 1000,
    date: `${ano}-${mm}-05`, periodo: `${ano}-${mm}`, propertyId: 'p1', contractId, recibo: true }));
});
/* uma linha do resumo, com a forma da 1.4 do plano, feita a partir do contrato
   Recebe: c — o contrato; extra — os campos que mudam; a (opcional) — a app.
   Devolve: a linha. */
const linha = (c, extra, a = app) => Object.assign({ contratoId: c.id, propertyId: c.propertyId, nome: c.name, imovel: 'T2 Arroios',
  atNumero: '123', inicio: c.start, estado: 'declarado', freguesiaCodigo: '110658', tipoPredio: 'U', artigo: '1234', fracao: '',
  quota: 1, natureza: '06', naturezaAssumida: false, titular: 'A', titularId: '', quadro: '4.1', taxaReduzida: false, taxa: 28,
  taxaEscrita: null, motivoTaxa: 'nh', isencao: null, celebracao: c.start, acimaDoLimite: null,
  inquilinos: c.tenantIds.map((id) => { const t = a.tenant(id); return { id, nome: t.name, nif: t.nif, pais: '' }; }),
  rendas: 12000, retencoes: 0, gastos: { selo: 10 }, faltas: [], recibosPorEmitir: 0, mesesEmVigor: 12, mesesComRenda: 12 }, extra);
/* o resumo à mão
   Recebe: linhas; extra — o que muda (ano, cessados, reporte…).
   Devolve: o resumo. */
const resumo = (linhas, extra) => Object.assign({ ano: ANO, titulares: [], linhas, fora: [], semContrato: [], aConfirmar: [],
  obrasSoltas: 0, foraDoPeriodo: 0, semSessao: false, contratosSemRendas: [] }, extra);
/* os avisos cujo texto casa
   Recebe: r — o resumo; re — a expressão; a (opcional) — a app.
   Devolve: os avisos (cópia simples). */
const avisos = (r, re, a = app) => JSON.parse(JSON.stringify(a.fiscoAvisos(r))).filter((x) => re.test(x.texto));

describe('a comunicação da duração e o 4.2C (D12)', () => {
  /* o contrato do cenário d12-a-tratar: habitação permanente, 10 anos desde
     1/3/2024, declarado, no 4.2 */
  const hp = (fisco, a = app) => ct({ rent: 1000, start: '2024-03-01', end: '2034-02-28',
    fisco: Object.assign({ finalidade: 'hp', celebracao: '2024-03-01' }, fisco) }, a);
  const l42 = (c, extra) => linha(c, Object.assign({ quadro: '4.2', taxaReduzida: true, taxa: 10, motivoTaxa: 'duracao', natureza: '07' }, extra));

  test('por fazer, com o prazo passado, é uma falta com o prazo e o 4.2A; a app não tira a redução', () => {
    const c = hp();
    const a = avisos(resumo([l42(c)], { ano: 2025 }), /comunica/);
    assert.deepEqual(a, [{ texto: 'Contrato Loja: a duração do contrato não está marcada como comunicada, e o prazo era 15/02/2025. Se a comunicaste, marca no contrato o dia em que o fizeste; se não, no quadro 4.2A do Anexo F a resposta é NÃO, e a AT pode não aplicar a redução pela duração',
      abrir: "ctView('C1')", toca: 'camada', nivel: 'falta' }]);
  });

  test('sem o falso positivo dos anos seguintes: a comunicação de um período vale em todos os anos dele', () => {
    const c = hp({ comunicacoes: { 2024: '2025-02-10' }, comunicacoesV: 2 });
    for (const ano of [2024, 2025, 2026]) assert.equal(avisos(resumo([l42(c)], { ano }), /comunica/).length, 0, 'em ' + ano);
    // sem a marca, o mesmo período continua a pedi-la nos anos seguintes, com o prazo dele
    c.fisco.comunicacoes = {};
    assert.match(avisos(resumo([l42(c)]), /comunica/)[0].texto, /^Contrato Loja: a duração do contrato não está marcada como comunicada, e o prazo era 15\/02\/2025\./);
    // a marca antiga, pela chave do ano dos rendimentos, migra para a do período e também vale
    app.db.contracts = [];
    const d = hp({ comunicacoes: { 2025: '2025-02-10' } });
    for (const ano of [2025, 2026]) assert.equal(avisos(resumo([l42(d)], { ano }), /comunica/).length, 0, 'migrada, em ' + ano);
  });

  test('por fazer antes do prazo é âmbar; a renovação comunica-se à parte', () => {
    const c = ct({ start: '2021-01-01', end: '2025-12-31', rent: 800,
      fisco: { finalidade: 'hp', comunicacoes: { 2021: '2021-02-01' }, comunicacoesV: 2, renovacoes: [{ inicio: '2026-01-01', fim: '2030-12-31' }] } });
    const a = avisos(resumo([l42(c)]), /comunica/);
    assert.deepEqual(a, [{ texto: 'Contrato Loja: a renovação de 01/01/2026 está por comunicar no Portal das Finanças. A renovação comunica-se uma vez, até 15/02/2027, e o quadro 4.2A do Anexo F pergunta se foi a tempo; quando o fizeres, marca-o no contrato',
      abrir: "ctView('C1')", toca: 'camada', nivel: 'aviso' }]);
    assert.equal(avisos(resumo([l42(c)], { ano: 2025 }), /comunica/).length, 0, 'o período de 2021 está comunicado');
  });

  test('feita depois do prazo é um aviso: o 4.2A é NÃO', () => {
    const c = hp({ comunicacoes: { 2024: '2025-03-20' }, comunicacoesV: 2 });
    const a = avisos(resumo([l42(c)], { ano: 2025 }), /comunica/);
    assert.equal(a.length, 1);
    assert.equal(a[0].nivel, 'aviso');
    assert.equal(a[0].texto, 'Contrato Loja: a duração do contrato foi comunicada a 20/03/2025, depois do prazo (15/02/2025). Se a comunicaste antes, corrige o dia no contrato; se não, no quadro 4.2A do Anexo F a resposta é NÃO, e a AT pode não aplicar a redução pela duração');
  });

  test('o resumo manda quando traz a comunicação da linha; sem redução, nada', () => {
    const c = hp();
    assert.equal(avisos(resumo([l42(c, { comunicacao: null })], { ano: 2025 }), /comunica/).length, 0, 'l.comunicacao null: sem nada a comunicar');
    const x = { periodoInicio: '2024-03-01', chave: '2024', prazo: '2025-02-15', data: '2025-01-30', foraDePrazo: false };
    assert.equal(avisos(resumo([l42(c, { comunicacao: x })], { ano: 2025 }), /comunica/).length, 0, 'feita a tempo');
    app.db.contracts = [];
    const nh = ct({ start: '2024-03-01', end: '2034-02-28' });
    assert.equal(avisos(resumo([linha(nh)], { ano: 2025 }), /comunica/).length, 0, 'não habitacional');
  });

  test('o 4.2C em «Não sei» nos celebrados desde 2024 é âmbar, sem tirar a redução; com a resposta, ou antes de 2024, nada', () => {
    const c = hp({ comunicacoes: { 2024: '2025-02-10' }, comunicacoesV: 2 });
    const a = avisos(resumo([l42(c, { celebracao: '2024-03-01' })], { ano: 2025 }), /4\.2C/);
    assert.deepEqual(a, [{ texto: 'Contrato Loja: celebrado a 01/03/2024, com «Não sei» em «Renda acima de 150 % do limite do concelho?». Confirma-o no contrato: o quadro 4.2C pergunta-o, e uma renda acima do limite não tem a redução pela duração. Até lá, a app conta a redução',
      abrir: "ctView('C1')", toca: 'camada', nivel: 'aviso' }]);
    assert.equal(avisos(resumo([l42(c, { acimaDoLimite: false })], { ano: 2025 }), /4\.2C/).length, 0, 'respondido');
    assert.equal(avisos(resumo([l42(c, { celebracao: '2023-06-01' })], { ano: 2025 }), /4\.2C/).length, 0, 'celebrado antes');
    assert.equal(avisos(resumo([linha(c, { celebracao: '2024-03-01' })], { ano: 2025 }), /4\.2C/).length, 0, 'no 4.1');
  });

  test('o cenário d12-a-tratar, de ponta a ponta: a comunicação e o 4.2C vão a «A tratar»; marcada, os anos seguintes não a pedem', () => {
    const c = hp();
    rendas('C1', 2024, [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    rendas('C1', 2025, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    rendas('C1', 2026, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const r = app.resumoFiscal(2025, 'o1');
    assert.equal(r.linhas[0].quadro, '4.2', 'a linha continua no 4.2');
    assert.equal(r.linhas[0].taxa, 10, 'com a redução');
    const com = r.avisos.filter((x) => /comunica/.test(x.texto));
    assert.equal(com.length, 1);
    assert.equal(com[0].nivel, 'falta');
    assert.match(com[0].texto, /^Contrato Loja: a duração do contrato não está marcada como comunicada, e o prazo era 15\/02\/2025/);
    assert.ok(r.avisos.some((x) => /4\.2C/.test(x.texto) && x.nivel === 'aviso'), 'o 4.2C');
    assert.ok(r.avisos.filter((x) => x.nivel !== 'info').length >= 2, '«A tratar» deixa de dizer que não falta nada');
    c.fisco.comunicacoes = { 2024: '2025-02-12' };
    c.fisco.rendaAcimaDoLimite = false;
    for (const ano of [2025, 2026]) {
      const s = app.resumoFiscal(ano, 'o1');
      assert.equal(s.avisos.filter((x) => /comunica|4\.2C/.test(x.texto)).length, 0, 'nada em ' + ano);
    }
  });
});

describe('as rendas em falta (D04)', () => {
  test('os meses em vigor sem renda registada, pelo mês a que respeitam, contados da base', () => {
    const c = ct();
    rendas('C1', 2026, [9, 10, 11]);
    // a renda de dezembro de 2025 paga em janeiro é de dezembro: não cobre janeiro
    app.db.transactions.push(app.normTx({ id: 'dez', kind: 'income', category: 'Rendas', sub: 'Renda mensal', amount: 1000,
      date: '2026-01-04', periodo: '2025-12', propertyId: 'p1', contractId: 'C1' }));
    const l = linha(c);
    delete l.mesesEmVigor; delete l.mesesComRenda;
    const a = avisos(resumo([l]), /em vigor em 2026/);
    assert.deepEqual(a, [{ texto: 'Contrato Loja: 11 meses em vigor em 2026 e só 3 rendas registadas — se recebeste as outras, regista-as; as que não recebeste não se declaram',
      abrir: "ctView('C1')", toca: 'camada', nivel: 'aviso' }]);
  });

  test('os números do resumo mandam; com todos os meses cobertos, nada', () => {
    const c = ct();
    assert.equal(avisos(resumo([linha(c, { mesesEmVigor: 12, mesesComRenda: 12 })]), /em vigor em/).length, 0);
    const a = avisos(resumo([linha(c, { mesesEmVigor: 10, mesesComRenda: 1 })]), /em vigor em/);
    assert.equal(a[0].texto, 'Contrato Loja: 10 meses em vigor em 2026 e só 1 renda registada — se recebeste as outras, regista-as; as que não recebeste não se declaram');
    rendas('C1', 2026, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    const l = linha(c);
    delete l.mesesEmVigor; delete l.mesesComRenda;
    assert.equal(avisos(resumo([l]), /em vigor em/).length, 0, 'contados da base: janeiro a novembro, todos com renda');
  });

  test('os contratos em vigor sem nenhuma renda no ano, do resumo ou da base', () => {
    ct({ id: 'C2', name: 'Benfica', start: '2025-06-01', end: '' });
    const a = avisos(resumo([], { contratosSemRendas: [{ contratoId: 'C2', nome: 'Benfica' }] }), /sem nenhuma renda/);
    assert.deepEqual(a, [{ texto: 'Contrato Benfica: em vigor em 2026 e sem nenhuma renda registada neste ano — se recebeste rendas dele, regista-as ligadas ao contrato; as que não recebeste não se declaram',
      abrir: "ctView('C2')", toca: 'camada', nivel: 'aviso' }]);
    const r = resumo([]);
    delete r.contratosSemRendas;
    assert.equal(avisos(r, /sem nenhuma renda/).length, 1, 'sem a lista no resumo, conta-se da base');
    ct({ id: 'C3', name: 'Alvalade', start: '2025-01-01', end: '' });
    const b = avisos(resumo([], { contratosSemRendas: [{ contratoId: 'C2', nome: 'Benfica' }, { contratoId: 'C3', nome: 'Alvalade' }] }), /sem nenhuma renda/);
    assert.equal(b[0].texto, '2 contratos em vigor em 2026 sem nenhuma renda registada neste ano: Benfica e Alvalade — se recebeste rendas deles, regista-as ligadas a cada contrato; as que não recebeste não se declaram');
    assert.equal(b[0].abrir, "go('contracts')");
  });
});

describe('o inquilino pessoa coletiva num contrato de habitação (D47)', () => {
  test('sem a confirmação é uma falta, e a app não muda a natureza nem a taxa', () => {
    const c = ct({ tenantIds: ['emp'], start: '2025-01-01', end: '2034-12-31', fisco: { finalidade: 'hp' } });
    const a = avisos(resumo([linha(c, { natureza: '07', quadro: '4.2', taxa: 10 })]), /pessoa|empresa|quem lá mora/);
    assert.deepEqual(a, [{ texto: 'Contrato Loja: arrendamento de habitação a Empresa, Lda., com NIF de empresa ou de outra entidade. Confirma se o contrato identifica pelo nome quem lá mora: sem isso, a AT trata o arrendamento como não habitacional (natureza 06, 28 %, sem a redução pela duração). A app mantém a finalidade escolhida até responderes',
      abrir: "ctResponderEmpresa('C1')", toca: 'camada', nivel: 'falta' }]);
    rendas('C1', 2026, [1, 2, 3]);
    const r = app.resumoFiscal(2026, 'o1');
    assert.equal(r.linhas[0].natureza, '07', 'a natureza fica a da finalidade');
    assert.notEqual(r.linhas[0].taxa, 28, 'a taxa não passa a 28 %');
    assert.ok(r.avisos.some((x) => /^Contrato Loja: arrendamento de habitação a Empresa, Lda\., com NIF de empresa/.test(x.texto) && x.nivel === 'falta'));
  });

  test('com «não» a linha já vai como não habitacional e só se diz; o «não» antigo fica por responder; com «sim», num não habitacional ou com um particular, nada', () => {
    // D16: só conta a identificação de quem lá mora (fisco.empresaMorador, lido por irsEmpresaMorador)
    const c = ct({ tenantIds: ['emp'], fisco: { finalidade: 'hnp', empresaMorador: false } });
    const a = avisos(resumo([linha(c, { empresaNaoHabitacional: true })]), /quem lá mora/);
    assert.equal(a.length, 1);
    assert.equal(a[0].nivel, 'info');
    assert.equal(a[0].texto, 'Contrato Loja: o contrato com Empresa, Lda. não identifica quem lá mora — para a AT o arrendamento é não habitacional (natureza 06, 28 %, sem a redução pela duração), e a Declaração já o conta assim');
    assert.equal(a[0].abrir, "ctView('C1')");
    // um resumo sem a marca da linha: a falta manda mudar a finalidade, sem falar da sublocação
    const b = avisos(resumo([linha(c)]), /quem lá mora/);
    assert.equal(b[0].nivel, 'falta');
    assert.match(b[0].texto, /^Contrato Loja: o contrato com Empresa, Lda\. não identifica quem lá mora — para a AT o arrendamento é não habitacional \(natureza 06, 28 %, sem a redução pela duração\)\. Muda a finalidade do contrato para não habitacional$/);
    assert.doesNotMatch(b[0].texto, /subloca/);
    // o «não» antigo (empresaHabitacao) não diz qual das duas faltava: fica por responder
    delete c.fisco.empresaMorador; c.fisco.empresaHabitacao = false;
    const d = avisos(resumo([linha(c)]), /quem lá mora/);
    assert.equal(d[0].abrir, "ctResponderEmpresa('C1')");
    assert.match(d[0].texto, /Confirma se o contrato identifica pelo nome quem lá mora/);
    c.fisco.empresaHabitacao = true;
    assert.equal(avisos(resumo([linha(c)]), /quem lá mora/).length, 0, 'confirmado (o «sim» antigo)');
    c.fisco.empresaHabitacao = null; c.fisco.empresaMorador = true;
    assert.equal(avisos(resumo([linha(c)]), /quem lá mora/).length, 0, 'confirmado');
    c.fisco.empresaMorador = null; c.fisco.finalidade = 'nh';
    assert.equal(avisos(resumo([linha(c)]), /quem lá mora/).length, 0, 'não habitacional');
    c.fisco.finalidade = 'hp'; c.tenantIds = ['t1'];
    assert.equal(avisos(resumo([linha(c)]), /quem lá mora/).length, 0, 'particular');
  });
});

describe('a versão provisória depois de a entrega abrir (D49)', () => {
  test('antes de 1 de abril do ano seguinte é cinzenta; depois sobe a âmbar, com o dia da revisão', () => {
    const antes = avisos(resumo([]), /Anexo F/);
    assert.equal(antes.length, 1);
    assert.equal(antes[0].nivel, 'info');
    assert.match(antes[0].texto, /^Ainda não há Anexo F aprovado para os rendimentos de 2026/);
    const depois = avisos(resumo([]), /Anexo F|provisórias/, tarde);
    assert.deepEqual(depois, [{ texto: 'As regras de 2026 desta página ainda são as provisórias, revistas a 17/11/2026, e o Anexo F de 2026 pode já ter saído com outros quadros, campos ou códigos — o da taxa de 10 % incluído. Antes de copiar, confirma-os nas instruções do modelo oficial, no Portal das Finanças.',
      abrir: '', toca: '', nivel: 'aviso' }]);
    assert.equal(avisos(resumo([], { ano: 2025 }), /provisórias|Anexo F aprovado/, tarde).length, 0, 'um ano com o modelo oficial não diz nada');
  });
});

describe('a isenção escolhida que não conta (D46)', () => {
  test('o RSAA sem o envio ao IHRU, passado o prazo: aviso com o toque que marca o envio; com o dia, nada', () => {
    const c = ct({ start: '2026-10-01', end: '2031-09-30', rent: 700, fisco: { finalidade: 'hp', celebracao: '2026-09-20', isencao: 'rsaa' } }, tarde);
    const a = avisos(resumo([linha(c, {}, tarde)]), /IHRU/, tarde);
    assert.deepEqual(a, [{ texto: 'Contrato Loja: sem a data do envio ao IHRU, a isenção não conta (RSAA). As rendas dele vão à Declaração com imposto; se o enviaste a tempo, marca o dia em que o enviaste',
      abrir: "pzIhruPergunta('C1')", toca: 'camada', nivel: 'aviso' }]);
    c.fisco.ihru = '2027-01-10';
    assert.equal(avisos(resumo([linha(c, {}, tarde)]), /IHRU/, tarde).length, 0);
    // antes do prazo do envio, a isenção ainda conta: nada a dizer
    ct({ id: 'C2', start: '2026-10-01', end: '2031-09-30', fisco: { finalidade: 'hp', celebracao: '2026-09-20', isencao: 'rsaa' } });
    assert.equal(avisos(resumo([linha(app.contract('C2'))]), /isenção/).length, 0);
  });

  test('o PAA celebrado depois do fim do programa: aviso com o porquê e o toque no contrato', () => {
    const c = ct({ start: '2026-11-01', end: '2031-10-31', rent: 700, fisco: { finalidade: 'hp', celebracao: '2026-10-20', isencao: 'paa' } });
    const a = avisos(resumo([linha(c)]), /isenção/);
    assert.deepEqual(a, [{ texto: 'Contrato Loja: a isenção só vale para contratos celebrados até 31/08/2026 (PAA). As rendas dele vão à Declaração com imposto',
      abrir: "ctView('C1')", toca: 'camada', nivel: 'aviso' }]);
  });
});

describe('o fim do contrato: o dia, o motivo e a regularização (D02, D09, D10)', () => {
  test('D02: terminado à moda antiga com o termo no futuro e sem o dia é uma falta, e os meses sem renda não se apontam', () => {
    const c = ct({ active: false, start: '2024-01-01', end: '2029-12-31', fisco: { finalidade: 'hp' } });
    rendas('C1', 2026, [1, 2, 3, 4, 5]);
    const l = linha(c);
    delete l.mesesEmVigor; delete l.mesesComRenda;
    const a = avisos(resumo([l]), /terminado/);
    assert.deepEqual(a, [{ texto: 'Contrato Loja: terminado sem o dia em que acabou, e o termo (31/12/2029) ainda não chegou — a app conta-o em vigor até lá, com os gastos da casa vazia, e o prazo da cessação não aparece. Escreve no contrato o dia em que acabou e o motivo',
      abrir: "ctView('C1')", toca: 'camada', nivel: 'falta' }]);
    assert.equal(avisos(resumo([l]), /em vigor em 2026/).length, 0, 'sem o aviso dos meses');
    c.fisco.cessacao = { data: '2026-05-31', motivo: '02' };
    assert.equal(avisos(resumo([l]), /terminado/).length, 0, 'com o dia, nada');
  });

  test('D02: com o fim escrito já passado pede para o confirmar; no quadro 10, é uma falta e pede o motivo', () => {
    const c = ct({ active: false, start: '2024-01-01', end: '2026-03-31' });
    const a = avisos(resumo([]), /terminado/);
    assert.deepEqual(a, [{ texto: 'Contrato Loja: terminado sem o dia em que acabou — a app usa o fim escrito, 31/03/2026. Confirma no contrato o dia em que acabou e o motivo: o dia decide os gastos que contam e o prazo da cessação',
      abrir: "ctView('C1')", toca: 'camada', nivel: 'aviso' }]);
    const q10 = avisos(resumo([], { cessados: [{ contratoId: 'C1', nome: 'Loja', data: '2026-03-31', motivo: '' }] }), /terminado|motivo da cessação/);
    assert.equal(q10.length, 1, 'um só aviso: o do dia já pede o motivo');
    assert.equal(q10[0].nivel, 'falta');
    assert.match(q10[0].texto, /e o motivo, que o quadro 10 pede: o dia decide/);
    c.end = '2025-06-30';
    assert.equal(avisos(resumo([]), /terminado/).length, 0, 'acabou antes do ano');
    c.end = '';
    assert.equal(avisos(resumo([]), /terminado/).length, 0, 'sem fim e sem rendas no ano, não pesa');
    assert.equal(avisos(resumo([linha(c)]), /terminado sem o dia em que acabou, e sem termo/).length, 1, 'sem fim, com rendas no ano');
    c.fisco.estado = 'naoDeclarado';
    assert.equal(avisos(resumo([]), /terminado/).length, 0, 'não declarado');
  });

  test('D09: no quadro 10 sem o motivo é uma falta; com ele, nada', () => {
    ct({ active: false, start: '2024-01-01', end: '2028-12-31', fisco: { finalidade: 'hp', cessacao: { data: '2026-04-30', motivo: '' } } });
    const x = { contratoId: 'C1', nome: 'Loja', imovel: 'T2 Arroios', regime: '02', numero: '123', anoInicioBeneficio: 2024, data: '2026-04-30', motivo: '' };
    const a = avisos(resumo([], { cessados: [x] }), /motivo da cessação/);
    assert.deepEqual(a, [{ texto: 'Contrato Loja: acabou a 30/04/2026 sem o motivo da cessação, que o quadro 10 pede com o regime, o n.º, o ano de início do benefício e a data. Escolhe-o no contrato',
      abrir: "ctView('C1')", toca: 'camada', nivel: 'falta' }]);
    assert.equal(avisos(resumo([], { cessados: [Object.assign({}, x, { motivo: '02' })] }), /motivo da cessação/).length, 0);
  });

  test('D10: o motivo 01 é uma falta com a diferença estimada, sem juros; sem diferença, nada', () => {
    ct({ active: false, start: '2024-01-01', end: '2033-12-31', fisco: { finalidade: 'hp', cessacao: { data: '2026-06-30', motivo: '01' } } });
    const reg = { contratoId: 'C1', nome: 'Loja', anos: [{ ano: 2024, diferenca: 4500 }, { ano: 2025, diferenca: 4500 }], total: 9000 };
    const a = avisos(resumo([], { regularizacoes: [reg] }), /senhorio/);
    assert.deepEqual(a, [{ texto: 'Contrato Loja: acabou antes do prazo por motivo do senhorio (o motivo 01 do quadro 10). A redução pela duração do período em que acabou cai (CIRS art. 72.º n.º 20), e a diferença de imposto dos anos dele já declarados paga-se com esta declaração, com juros compensatórios — a app estima '
      + app.euroS(9000) + ' sem os juros (2024: ' + app.euroS(4500) + '; 2025: ' + app.euroS(4500) + ')',
      abrir: "ctView('C1')", toca: 'camada', nivel: 'falta' }]);
    // sem diferença e sem anos em falta, nada; com os anos do período sem rendas na app, a regularização é devida na mesma (N031)
    assert.equal(avisos(resumo([], { regularizacoes: [Object.assign({}, reg, { anos: [], total: 0, anosEmFalta: [] })] }), /senhorio/).length, 0);
    const f = avisos(resumo([], { regularizacoes: [Object.assign({}, reg, { anos: [], total: 0, anosEmFalta: [2024, 2025] })] }), /senhorio/);
    assert.equal(f.length, 1);
    assert.match(f[0].texto, /com juros compensatórios\. Faltam os anos 2024 e 2025, de que a app não tem rendas: a diferença deles regulariza-se na mesma\./);
  });
});

describe('o selo do contrato (D27)', () => {
  const selo = (id, date, amount) => app.db.transactions.push(app.normTx({ id, kind: 'expense', category: 'Impostos', sub: 'Imposto do selo',
    amount, date, propertyId: 'p1' }));

  test('um selo pago antes da celebração não é o do contrato: o aviso fica, e diz porquê', () => {
    const c = ct({ start: '2026-06-01', end: '2031-05-31', fisco: { celebracao: '2026-05-20' } });
    selo('s1', '2026-02-10', 1600);
    const a = avisos(resumo([linha(c, { gastos: { selo: 1600 } })]), /selo/);
    assert.equal(a.length, 1);
    assert.match(a[0].texto, /^Contrato Loja: começou em 2026 e não há imposto do selo nos gastos \(o de 10\/02\/2026 foi pago antes de o contrato se celebrar: não é o dele\) — o que se paga com o Modelo 2/);
    selo('s2', '2026-06-15', 100);
    assert.equal(avisos(resumo([linha(c, { gastos: { selo: 1700 } })]), /selo/).length, 0, 'com o do contrato, nada');
  });

  test('sem a data da celebração, o selo pago nos 60 dias antes do início conta; sem selos na base vale a linha', () => {
    const c = ct({ start: '2026-06-01', end: '2031-05-31' });
    assert.equal(avisos(resumo([linha(c, { gastos: { selo: 100 } })]), /selo/).length, 0, 'a linha diz que há');
    assert.equal(avisos(resumo([linha(c, { gastos: { selo: 0 } })]), /selo/).length, 1, 'a linha diz que não');
    selo('s1', '2026-05-10', 100);
    assert.equal(avisos(resumo([linha(c, { gastos: { selo: 100 } })]), /selo/).length, 0);
  });
});

describe('o prejuízo de anos anteriores (Q10)', () => {
  test('com o abate, um aviso âmbar com o valor, os anos sem registos e a condição do n.º 8; sem ele, nada', () => {
    const reporte = { porTitular: { o1: { anos: [{ ano: 2025, prejuizo: 5400, usado: 5400 }], usado: 5400, resto: 0, imposto: 1350 } },
      usado: 5400, imposto: 1350, anosSemDados: [2021, 2020] };
    const a = avisos(resumo([], { reporte }), /prejuízos/);
    assert.deepEqual(a, [{ texto: 'O imposto estimado já abate ' + app.euroS(5400) + ' de prejuízos de anos anteriores (menos ' + app.euroS(1350) + ' de imposto), com o que a app sabe. Pode faltar informação: imóveis que não estão na app, os anos de 2020 e 2021, em que a app não tem registos, e a condição do art. 55.º n.º 8 do CIRS — os prédios darem rendas em 36 meses dos cinco anos seguintes ao prejuízo. A AT faz a conta titular a titular, com as declarações que entregaste',
      abrir: '', toca: '', nivel: 'aviso' }]);
    assert.match(avisos(resumo([], { reporte: Object.assign({}, reporte, { anosSemDados: [] }) }), /prejuízos/)[0].texto,
      /Pode faltar informação: imóveis que não estão na app e a condição/);
    assert.equal(avisos(resumo([], { reporte: { porTitular: {}, usado: 0, imposto: 0, anosSemDados: [2021] } }), /prejuízos/).length, 0);
    assert.equal(avisos(resumo([], { reporte: null }), /prejuízos/).length, 0);
    assert.equal(avisos(resumo([]), /prejuízos/).length, 0);
  });
});

describe('a conjunta sem o cônjuge e o AIMI do quadro 9 (D30, D32, D71)', () => {
  test('a conjunta ligada sem o cônjuge escolhido é uma falta: só entram as tuas rendas', () => {
    // sem ninguém para escolher (D5, N020): diz o que fazer, em vez de mandar escolher
    const texto = 'Tributação conjunta sem o cônjuge na app: só entram as tuas rendas. Os imóveis do teu cônjuge que não estão na app inserem-se à mão no Portal das Finanças, '
      + 'e uma casa que é um bem comum do casal conta-se com o cônjuge escrito na ficha como dono fora da app e «Os bens são comuns do casal» ligado em «A tua situação em 2026».';
    assert.deepEqual(avisos(resumo([], { semConjuge: true }), /conjunta/), [{ texto, abrir: '', toca: '', nivel: 'falta' }]);
    assert.equal(avisos(resumo([], { semConjuge: false }), /conjunta/).length, 0);
    // sem o campo no resumo, pergunta-se aos titulares de quem declara
    app.db.owners.push(app.normPerson({ id: 'o2', name: 'Rui' }));
    app.db.settings.irs.porAno = { 2026: { conjunta: true, conjugeId: '', minhaLetra: 'A' } };
    assert.equal(app.fiscoTitulares('o1', 2026).semConjuge, true, 'a forma dos titulares');
    const comQuem = avisos(resumo([], { titularId: 'o1' }), /conjunta/);
    assert.equal(comQuem.length, 1);
    assert.match(comQuem[0].texto, /^Tributação conjunta sem o cônjuge escolhido: só entram as tuas rendas\. Se o teu cônjuge tem conta na app, escolhe-o em «A tua situação em 2026»; se não tem, /);
    app.db.settings.irs.porAno = { 2026: { conjunta: true, conjugeId: 'o2', minhaLetra: 'A' } };
    app.db.properties[0].ownerIds = ['o1', 'o2'];
    assert.equal(avisos(resumo([], { titularId: 'o1' }), /conjunta/).length, 0, 'com o cônjuge escolhido');
  });

  test('o AIMI sem quem o pagou e os prédios sem a afetação são âmbar, com o toque', () => {
    const um = avisos(resumo([], { aimi: { semPagador: [{ txId: 'x1', imovel: 'T2 Arroios', valor: 700 }] } }), /AIMI/);
    assert.deepEqual(um, [{ texto: 'AIMI de ' + app.euroS(700) + ' (T2 Arroios) sem quem o pagou: contou inteiro na tua declaração. Se o pagou outro proprietário, escolhe-o no movimento — o AIMI abate-se no quadro 9 só a quem o pagou',
      abrir: "txView('x1')", toca: 'camada', nivel: 'aviso' }]);
    const dois = avisos(resumo([], { aimi: { semPagador: [{ txId: 'x1', imovel: 'A', valor: 700 }, { txId: 'x2', imovel: 'B', valor: 300 }] } }), /AIMI/);
    assert.ok(dois[0].texto.startsWith('2 pagamentos do AIMI (' + app.euroS(1000) + ') sem quem os pagou: contaram inteiros na tua declaração'), dois[0].texto);
    assert.equal(dois[0].abrir, "go('transactions')");
    const af = avisos(resumo([], { aimi: { afetacaoPorConfirmar: [{ propertyId: 'p1', imovel: 'T2 Arroios' }] } }), /afetação/);
    assert.deepEqual(af, [{ texto: 'Imóvel T2 Arroios: sem a afetação da caderneta, e com um contrato não habitacional — o quadro 9 (AIMI) conta-o, mas um prédio de comércio, serviços ou indústria não entra. Escreve a afetação na ficha do imóvel',
      abrir: "propView('p1')", toca: 'camada', nivel: 'aviso' }]);
    assert.equal(avisos(resumo([], { aimi: { semPagador: [], afetacaoPorConfirmar: [] } }), /AIMI|afetação/).length, 0);
    assert.equal(avisos(resumo([], { aimi: null }), /AIMI|afetação/).length, 0);
  });
});

describe('os textos com os campos novos do resumo', () => {
  test('nenhum aviso deixa entrar um booleano, um null ou um undefined no texto', () => {
    ct({ active: false, start: '2024-01-01', end: '2026-03-31', fisco: { finalidade: 'hp' } });
    ct({ id: 'C2', name: 'Benfica', active: false, start: '2024-01-01', end: '2029-12-31', tenantIds: ['emp'], fisco: { finalidade: 'hp', cessacao: { data: '2026-04-30', motivo: '' } } });
    ct({ id: 'C3', name: 'Alvalade', start: '2026-01-01', end: '', fisco: { finalidade: 'hp', isencao: 'paa', celebracao: '2026-10-20' } });
    const c2 = app.contract('C2'), c3 = app.contract('C3');
    const r = resumo([
      linha(c2, { quadro: '4.2', natureza: '07', comunicacao: { periodoInicio: '2024-01-01', chave: '2024', prazo: '2025-02-15', data: '', foraDePrazo: false }, mesesEmVigor: null, mesesComRenda: 0 }),
      linha(c3, { mesesEmVigor: 11, mesesComRenda: 4, comunicacao: null })], {
      semConjuge: true,
      cessados: [{ contratoId: 'C1', nome: 'Loja', imovel: 'T2 Arroios', regime: '02', numero: '123', anoInicioBeneficio: 2024, data: '2026-03-31', motivo: '' },
        { contratoId: 'C2', nome: 'Benfica', imovel: 'T2 Arroios', regime: '02', numero: '123', anoInicioBeneficio: 2024, data: '2026-04-30', motivo: '' }],
      regularizacoes: [{ contratoId: 'C2', nome: 'Benfica', anos: [{ ano: 2025, diferenca: 1200 }], total: 1200 }],
      contratosSemRendas: [{ contratoId: 'C1', nome: 'Loja', imovel: 'T2 Arroios', propertyId: 'p1', mesesEmVigor: 3, mesesComRenda: 0 }],
      reporte: { porTitular: { o1: { anos: [{ ano: 2025, prejuizo: 500, usado: 500 }], usado: 500, resto: 0, imposto: 125 } }, usado: 500, imposto: 125, anosSemDados: [] },
      aimi: { semPagador: [{ txId: 'x1', imovel: 'T2 Arroios', valor: 700 }], afetacaoPorConfirmar: [{ propertyId: 'p1', imovel: 'T2 Arroios' }] } });
    const xs = app.fiscoAvisos(r);
    assert.ok(xs.length >= 8, 'os avisos novos acendem (' + xs.length + ')');
    for (const x of xs) assert.doesNotMatch(x.texto, /\b(true|false|undefined|null|NaN)\b|\[object/, x.texto);
    assert.equal(xs.filter((x) => /em vigor em 2026 e (só|nenhuma)/.test(x.texto) && /Benfica/.test(x.texto)).length, 0, 'mesesEmVigor null: não se sabe, não se aponta');
    assert.ok(xs.some((x) => /^Contrato Loja: terminado sem o dia em que acabou — a app usa o fim escrito, 31\/03\/2026\. Confirma no contrato o dia em que acabou e o motivo, que o quadro 10 pede:/.test(x.texto)));
  });
});
