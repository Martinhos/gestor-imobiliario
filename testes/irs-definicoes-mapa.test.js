// As Definições e as Projeções perante o IRS (KAN-127, folha 2.2.6 do plano das
// correções, com os contratos rev. 5 e rev. 6): as categorias que o IRS lê
// reconhecem-se pelo identificador fixo, e o id segue o nome quando se muda
// (moverEscolhas, renameCat, renameSub; D19) — uma categoria que ficou sem id
// tem o caminho «Esta categoria é a das Rendas?»; não se removem (decisão do
// Martinho); o «Fora dos totais» nelas diz o que continua a declarar-se; o mapa das colunas oferece «A confirmar em cada
// despesa» e a omissão passa a «A confirmar» (D61); o cartão do art. 41.º e as
// notas das regras de origem dizem o mesmo que o guia (D07, D24–D27, D60); o
// AIMI tem a coluna fixa, «vai ao quadro 9» (D66); o CSV do Anexo F das
// Definições é o da Declaração (D75) e o cartão aponta para «A tratar» (D34);
// as Projeções dizem que o IRS é sobre a renda bruta (D100). Cada defeito tem
// aqui pelo menos um assert, que falhava antes.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, limpar, igual, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-17' });
afterEach(() => repor(app));

/* Tira o ecrã às ações (gravam, repintam e avisam) e guarda o último aviso.
   Devolve: um objeto {toast} com o último texto do toast. */
function semEcra() {
  const dito = { toast: '' };
  app.save = () => {};
  app.render = () => {};
  app.buildNav = () => {};
  app.closeModal = () => {};
  app.closeAllModals = () => {};
  app.toast = (m) => { dito.toast = m; };
  return dito;
}
/* Uma receita de 2026 no imóvel P1.
   Recebe: category, sub; extra (opcional).
   Devolve: o movimento normalizado, já na base. */
function receita(category, sub, extra) {
  const t = app.normTx(Object.assign({ kind: 'income', amount: 800, date: '2026-03-05', propertyId: 'P1', contractId: 'C1', category, sub }, extra || {}));
  app.db.transactions.push(t);
  return t;
}
/* o papel de uma receita, como texto */
const papel = (t) => app.irsReceitaDe(t).papel;
/* o HTML de uma árvore das categorias, sem o Voltar */
const pagina = (tk) => app.vCats(tk);

beforeEach(() => {
  limpar(app);
  app.db.properties.push(app.normProp({ id: 'P1', name: 'T2', ownerIds: ['O1'] }));
  app.db.contracts.push(app.normContract({ id: 'C1', name: 'T2', propertyId: 'P1', rent: 800, start: '2026-01-01', end: '2030-12-31', fisco: { finalidade: 'hp' } }));
});

describe('D19 — o id segue o nome', () => {
  test('renomear «Rendas» leva o id e o das subcategorias, e as receitas continuam rendas', () => {
    semEcra();
    const r = receita('Rendas', 'Renda mensal'), c = receita('Rendas', 'Caução');
    app.renameCat('catsIn', 'Rendas', 'Arrendamento');
    assert.equal(r.category, 'Arrendamento');
    assert.equal(app.catIrsId('catsIn', 'Arrendamento'), 'rendas');
    assert.equal(app.catIrsId('catsIn', 'Arrendamento', 'Caução'), 'rendas/caucao');
    assert.equal(app.db.settings.catIds.catsIn.Rendas, undefined, 'a chave antiga sai');
    assert.equal(papel(r), 'renda');
    assert.equal(papel(c), 'caucao');
    // e sobrevive à normalização de cada leitura (fillCats)
    app.fillCats(app.db.settings);
    assert.equal(app.catIrsId('catsIn', 'Arrendamento'), 'rendas');
  });

  test('renomear a subcategoria «Caução» leva o id dela', () => {
    semEcra();
    const c = receita('Rendas', 'Caução');
    app.promptModal = (t, l, v, fn) => fn('Caução (depósito)');
    app.renameSub('catsIn', 'Rendas', 'Caução');
    assert.equal(c.sub, 'Caução (depósito)');
    assert.equal(app.catIrsId('catsIn', 'Rendas', 'Caução (depósito)'), 'rendas/caucao');
    assert.equal(papel(c), 'caucao');
  });

  test('renomear «Impostos» deixa o AIMI fixo e o IMI no IMI', () => {
    semEcra();
    app.renameCat('cats', 'Impostos', 'Impostos e taxas');
    const aimi = app.normTx({ kind: 'expense', amount: 300, date: '2026-09-01', propertyId: 'P1', category: 'Impostos e taxas', sub: 'AIMI', irsCol: 'outros' });
    const imi = app.normTx({ kind: 'expense', amount: 300, date: '2026-09-01', propertyId: 'P1', category: 'Impostos e taxas', sub: 'IMI' });
    assert.equal(app.irsColunaDe(aimi).col, 'nao');
    assert.equal(app.irsColunaDe(aimi).origem, 'lei');
    assert.equal(app.irsColunaDe(imi).col, 'imi');
  });

  test('«Repor as de origem» devolve os ids às categorias de origem', () => {
    semEcra();
    app.confirmModal = (t, x, sim) => sim();
    app.renameCat('catsIn', 'Rendas', 'Arrendamento');
    app.fillCats(app.db.settings);
    app.resetCats();
    app.fillCats(app.db.settings);
    assert.equal(app.catIrsId('catsIn', 'Rendas'), 'rendas');
    assert.equal(app.catIrsId('catsIn', 'Rendas', 'Caução'), 'rendas/caucao');
    assert.equal(app.catIrsId('cats', 'Impostos', 'AIMI'), 'impostos/aimi');
  });
});

describe('D19 — a categoria renomeada antes da migração', () => {
  /* Uma conta de antes da migração (catsV por marcar) com «Rendas» já renomeada
     para «Arrendamento»: a migração não adivinha, e fica sem id. */
  function contaAntiga() {
    const st = app.db.settings;
    const arv = {};
    Object.keys(st.catsIn).forEach((k) => { arv[k === 'Rendas' ? 'Arrendamento' : k] = st.catsIn[k].filter((s) => s !== 'Indemnização' && s !== 'Outras receitas prediais'); });
    st.catsIn = arv;
    delete st.catsV;
    delete st.catIds;
    app.fillCats(st);
  }

  test('fica sem id, e a página pergunta qual é', () => {
    contaAntiga();
    assert.equal(app.catIrsId('catsIn', 'Arrendamento'), '');
    const falta = app.catIdsEmFalta().find((e) => e.tk === 'catsIn' && e.id === 'rendas');
    assert.ok(falta, 'as Rendas estão em falta');
    assert.equal(falta.candidatos[0].cat, 'Arrendamento');
    assert.equal(falta.candidatos[0].forte, true, 'tem «Renda mensal» e «Caução»');
    const h = pagina('cats');
    assert.match(h, /que a Declaração não reconhece/);
    assert.match(h, /data-click="catIrsEscolher\('catsIn','rendas'\)"/);
    // o ⋯ da categoria candidata pergunta «Esta categoria é a das Rendas?»
    assert.match(pagina('catsIn'), /É a categoria das Rendas/);
  });

  test('«Esta categoria é a das Rendas?» devolve o id, também às subcategorias de origem', () => {
    contaAntiga();
    const dito = semEcra();
    const r = receita('Arrendamento', 'Renda mensal'), c = receita('Arrendamento', 'Caução');
    let titulo = '';
    app.confirmModal = (t, x, sim) => { titulo = t; sim(); };
    app.catIrsPerguntar('catsIn', 'rendas', 'Arrendamento', '');
    assert.equal(titulo, 'Esta categoria é a das Rendas?');
    assert.equal(app.catIrsId('catsIn', 'Arrendamento'), 'rendas');
    assert.equal(app.catIrsId('catsIn', 'Arrendamento', 'Caução'), 'rendas/caucao');
    assert.equal(papel(r), 'renda');
    assert.equal(papel(c), 'caucao');
    assert.match(dito.toast, /A Declaração já reconhece «Arrendamento» como a categoria das Rendas/);
    assert.doesNotMatch(pagina('cats'), /catIrsEscolher\('catsIn','rendas'\)/, 'e o cartão sai');
    app.fillCats(app.db.settings);
    assert.equal(app.catIrsId('catsIn', 'Arrendamento'), 'rendas', 'fica depois da leitura seguinte');
  });

  test('o «Escolher» lista as candidatas, as fortes primeiro', () => {
    contaAntiga();
    semEcra();
    app.db.settings.catsIn['Garagens'] = [];
    let ops = null, titulo = '', escolher = null;
    app.pickModal = (t, o, fn) => { titulo = t; ops = o; escolher = fn; };
    app.catIrsEscolher('catsIn', 'rendas');
    assert.equal(titulo, 'Qual é a categoria das Rendas?');
    assert.equal(ops[0].label, 'Arrendamento');
    assert.match(ops[0].sub, /Tem «Renda mensal», «Renda em atraso» e «Caução»/);
    assert.ok(ops.some((o) => o.label === 'Garagens'));
    escolher(ops[0]);
    assert.equal(app.catIrsId('catsIn', 'Arrendamento'), 'rendas');
  });

  test('o catIrsDar recusa o que não bate', () => {
    contaAntiga();
    semEcra();
    assert.equal(app.catIrsDar('cats', 'rendas', 'Arrendamento', ''), false, 'um id de outra árvore');
    assert.equal(app.catIrsDar('catsIn', 'rendas/caucao', 'Arrendamento', ''), false, 'o id de uma subcategoria numa categoria');
    assert.equal(app.catIrsDar('catsIn', 'rendas', 'Reembolsos', ''), false, 'uma chave que já tem outro id');
    assert.equal(app.catIrsDar('catsIn', 'rendas', 'Não existe', ''), false);
    assert.equal(app.catIrsId('catsIn', 'Reembolsos'), 'reembolsos');
  });

  test('uma subcategoria renomeada antes: a pergunta é a da subcategoria', () => {
    const st = app.db.settings;
    st.catsIn.Rendas = st.catsIn.Rendas.map((s) => (s === 'Caução' ? 'Depósito' : s));
    delete st.catsV; delete st.catIds;
    app.fillCats(st);
    assert.equal(app.catIrsId('catsIn', 'Rendas', 'Depósito'), '');
    semEcra();
    assert.match(pagina('cats'), /catIrsEscolher\('catsIn','rendas\/caucao'\)/);
    let titulo = '';
    app.confirmModal = (t, x, sim) => { titulo = t; sim(); };
    app.catIrsPerguntar('catsIn', 'rendas/caucao', 'Rendas', 'Depósito');
    assert.equal(titulo, 'Esta é a subcategoria «Caução»?');
    assert.equal(app.catIrsId('catsIn', 'Rendas', 'Depósito'), 'rendas/caucao');
  });

  test('sem candidata forte, uma categoria removida não fica no cartão', () => {
    const st = app.db.settings;
    delete st.cats['Devoluções ao inquilino'];
    st.cats['Jardim'] = [];
    app.fillCats(st);
    assert.doesNotMatch(pagina('cats'), /que a Declaração não reconhece/);
  });
});

describe('D19 — o «Fora dos totais» nas categorias que o IRS lê', () => {
  /* Só se diz o que o resumo faz hoje: as despesas contam pelo irsColunaDe (o
     IMI, o selo e a devolução da caução ficam); as rendas fora dos totais ainda
     saem do resumo, e por isso nas receitas não se diz nada. */
  test('nos Impostos o IMI e o selo continuam, nas Devoluções a caução; nas Rendas não se promete', () => {
    semEcra();
    app.toggleExc('catsIn', 'Rendas');
    assert.doesNotMatch(pagina('catsIn'), /continua a declarar-se|continuam a declarar-se/);
    app.toggleExc('cats', 'Devoluções ao inquilino');
    app.toggleExc('cats', 'Impostos');
    const h = pagina('cats');
    assert.match(h, /Sai dos totais e dos gráficos; no Anexo F, «Devolução da caução» continua a declarar-se\./);
    assert.match(h, /Sai dos totais e dos gráficos; no Anexo F, «IMI» e «Imposto do selo» continuam a declarar-se\./);
    app.toggleExc('cats', 'Seguros');
    assert.equal((pagina('cats').match(/Sai dos totais e dos gráficos/g) || []).length, 2, 'nos Seguros não');
  });

  test('e é verdade no resumo: o IMI e a devolução da caução fora dos totais contam no Anexo F', () => {
    semEcra();
    app.toggleExc('cats', 'Impostos');
    app.toggleExc('cats', 'Devoluções ao inquilino');
    const d = (category, sub) => app.normTx({ kind: 'expense', amount: 100, date: '2026-05-01', propertyId: 'P1', category, sub });
    assert.equal(app.irsColunaDe(d('Impostos', 'IMI')).col, 'imi');
    assert.equal(app.irsColunaDe(d('Devoluções ao inquilino', 'Devolução da caução')).col, 'outros');
    assert.equal(app.irsColunaDe(d('Impostos', 'Outro imposto')).col, 'nao');
  });

  test('a nota da página diz que fora dos totais sai do Anexo F, salvo o que fica', () => {
    assert.match(pagina('catsIn'), /«Fora dos totais» tira-os do Anexo F e deixa-os na lista, mas não somam\./);
    assert.match(pagina('cats'), /salvo o IMI, o imposto do selo do contrato e a devolução da caução, que continuam a declarar-se/);
  });
});

describe('D19 — as categorias que o IRS lê não se removem', () => {
  /* o ⋯ de uma linha, pelo id do menu */
  const menuDe = (h, id) => { const i = h.indexOf('id="menu_' + id + '"'); return h.slice(i, h.indexOf('</span>', h.indexOf('</div>', i)) + 7); };

  test('o ⋯ das Rendas e da Caução não tem «Apagar»: diz que se lhes pode mudar o nome', () => {
    const h = pagina('catsIn');
    const ks = Object.keys(app.db.settings.catsIn), i = ks.indexOf('Rendas'), j = app.db.settings.catsIn.Rendas.indexOf('Caução');
    const cat = menuDe(h, 'dc_catsIn_' + i), sub = menuDe(h, 'ds_catsIn_' + i + '_' + j);
    assert.doesNotMatch(cat, /delCat\(/);
    assert.match(cat, /O IRS usa esta categoria: podes mudar-lhe o nome\./);
    assert.match(cat, /mudarNomeCategoria\(/);
    assert.doesNotMatch(sub, /delSub\(/);
    assert.match(sub, /O IRS usa esta subcategoria: podes mudar-lhe o nome\./);
    // uma categoria sem id remove-se como antes
    const e = ks.indexOf('Empréstimos recebidos');
    assert.match(menuDe(h, 'dc_catsIn_' + e), /delCat\('catsIn','Empréstimos recebidos'\)/);
  });

  test('o delCat e o delSub recusam uma do IRS, com o aviso, mesmo com outro nome', () => {
    const dito = semEcra();
    let pediu = false;
    app.confirmModal = (t, x, sim) => { pediu = true; sim(); };
    app.delCat('catsIn', 'Rendas');
    assert.equal(pediu, false);
    assert.ok(app.db.settings.catsIn.Rendas);
    assert.equal(dito.toast, 'O IRS usa esta categoria: podes mudar-lhe o nome.');
    app.delSub('cats', 'Impostos', 'IMI');
    assert.ok(app.db.settings.cats.Impostos.includes('IMI'));
    assert.equal(dito.toast, 'O IRS usa esta subcategoria: podes mudar-lhe o nome.');
    app.renameCat('catsIn', 'Rendas', 'Arrendamento');
    app.delCat('catsIn', 'Arrendamento');
    assert.ok(app.db.settings.catsIn.Arrendamento, 'o id seguiu o nome, e a recusa também');
    // uma subcategoria da pessoa dentro das Rendas e uma categoria sem id removem-se
    app.db.settings.catsIn.Arrendamento.push('Garagem');
    app.delSub('catsIn', 'Arrendamento', 'Garagem');
    assert.equal(pediu, true);
    assert.ok(!app.db.settings.catsIn.Arrendamento.includes('Garagem'));
    app.delCat('catsIn', 'Outras receitas');
    assert.equal(app.db.settings.catsIn['Outras receitas'], undefined);
  });

  test('uma categoria renomeada antes da migração, ainda sem id, remove-se', () => {
    const st = app.db.settings, arv = {};
    Object.keys(st.catsIn).forEach((k) => { arv[k === 'Rendas' ? 'Arrendamento' : k] = st.catsIn[k]; });
    st.catsIn = arv; delete st.catsV; delete st.catIds;
    app.fillCats(st);
    semEcra();
    app.confirmModal = (t, x, sim) => sim();
    assert.match(pagina('catsIn'), /delCat\('catsIn','Arrendamento'\)/);
    app.delCat('catsIn', 'Arrendamento');
    assert.equal(app.db.settings.catsIn.Arrendamento, undefined);
  });
});

describe('D61 — «A confirmar» no mapa das colunas', () => {
  test('o mapa oferece «A confirmar em cada despesa» e a omissão é «A confirmar (por omissão)»', () => {
    app.db.settings.cats['Jardim'] = [];
    const h = pagina('cats');
    assert.doesNotMatch(h, /Outros gastos \(por omissão\)/);
    assert.match(h, /A confirmar \(por omissão\)/, 'a categoria sem regra');
    const i = app.irsMapaChaves().indexOf('Gestão e mediação');
    const ops = app.window.__sel['irsm_' + i].options.map((o) => o.v);
    assert.ok(ops.includes('confirmar'));
    assert.ok(ops.includes(''));
  });

  test('o setIrsMapa aceita «confirmar», e o vazio de uma regra de origem fica a confirmar', () => {
    semEcra();
    app.setIrsMapa('Gestão e mediação', 'confirmar');
    assert.equal(app.db.settings.irsMapa['Gestão e mediação'], 'confirmar');
    app.setIrsMapa('Limpeza e jardim', '');
    app.fillCats(app.db.settings);
    assert.equal(app.db.settings.irsMapa['Limpeza e jardim'], 'confirmar', 'a regra de origem não volta');
    app.setIrsMapa('Gestão e mediação', 'inventada');
    assert.equal(app.db.settings.irsMapa['Gestão e mediação'], 'confirmar', 'uma coluna que não existe não entra');
  });
});

describe('D07, D24–D27, D60 — o cartão do art. 41.º e as notas das regras', () => {
  test('o cartão diz o mesmo que o guia', () => {
    const h = app.cartaoDoArt41();
    const nao = (h.match(/Não dedutível:<\/b>([^<]*)/) || [])[1] || '';
    const conf = (h.match(/A confirmar em cada despesa:<\/b>([^<]*)/) || [])[1] || '';
    assert.match(nao, /eletrodomésticos — comprar, trocar ou reparar, o esquentador incluído/, 'D24');
    assert.match(nao, /seguro multirriscos facultativo/, 'D07');
    assert.match(nao, /fundo comum de reserva/, 'D25');
    assert.match(nao, /o IMT e o imposto do selo da compra/, 'D27');
    assert.match(nao, /os registos e a avaliação/, 'D60');
    assert.match(conf, /a água, a luz, o gás e a Internet/, 'D26');
    assert.match(conf, /honorários de advogado e de contabilista/, 'D60');
    assert.match(conf, /a caldeira/, 'D24');
    assert.match(conf, /quota extraordinária/, 'D25');
    assert.doesNotMatch(h, /Depende:|caíram em «Outros gastos»/);
    assert.match(h, /«A tratar antes de entregar»/);
  });

  test('as notas das regras de origem aparecem por baixo das subcategorias', () => {
    const h = pagina('cats');
    for (const k of Object.keys(app.IRS_MAPA_NOTAS)) assert.ok(h.includes(app.esc(app.IRS_MAPA_NOTAS[k])), k);
  });
});

describe('D66 — o AIMI tem a coluna fixa', () => {
  test('sem menu, «Não dedutível · vai ao quadro 9», mesmo com outro nome na categoria', () => {
    let h = pagina('cats');
    let i = app.irsMapaChaves().indexOf('Impostos / AIMI');
    assert.ok(i > -1);
    assert.equal(app.window.__sel['irsm_' + i], undefined, 'não há menu para o AIMI');
    assert.match(h, /vai ao quadro 9/);
    semEcra();
    app.renameCat('cats', 'Impostos', 'Impostos e taxas');
    app.window.__sel = {};
    h = pagina('cats');
    i = app.irsMapaChaves().indexOf('Impostos e taxas / AIMI');
    assert.equal(app.window.__sel['irsm_' + i], undefined);
    assert.match(h, /vai ao quadro 9/);
  });
});

describe('D75 e D34 — o cartão Exportar', () => {
  test('o CSV do Anexo F é o da Declaração, e o cartão aponta para «A tratar»', () => {
    const h = app.vImport();
    assert.match(h, /data-click="fiscoCsv\(\)"/, 'D75: sem passar pelo exportarSoMeu');
    assert.doesNotMatch(h, /exportarSoMeu\(fiscoCsv\)/);
    assert.match(h, /exportarSoMeu\(downloadCsv\)/, 'o dos movimentos continua só com o que é meu');
    assert.match(h, /«A tratar antes de entregar»/, 'D34');
    assert.match(h, /data-click="go\('fisco'\)"/);
  });

  test('com pontos por tratar, diz quantos', () => {
    app.db.contracts[0].fisco.finalidade = '';
    app.db.transactions.push(app.normTx({ kind: 'income', amount: 800, date: '2026-02-05', propertyId: 'P1', contractId: 'C1', category: 'Rendas', sub: 'Renda mensal' }));
    app.fiscoAno = '2026';
    const r = app.resumoFiscal(2026);
    const n = r.avisos.filter((a) => a.nivel !== 'info').length;
    assert.ok(n > 0);
    const h = app.vImport();
    assert.match(h, new RegExp('O CSV leva no fim ' + (n === 1 ? 'o ponto' : 'os ' + n + ' pontos') + ' de «A tratar antes de entregar» de 2026'));
    assert.match(h, /Ver o que falta tratar/);
  });

  test('com um imóvel só de colaboração, a nota já não diz que o Anexo F fica sem ele', () => {
    app.casasDeColaboracao = () => [{ id: 'X' }];
    const h = app.vImport();
    assert.match(h, /ficam de fora da cópia e do CSV dos movimentos; o do Anexo F é o mesmo da Declaração/);
  });
});

describe('D100 — as Projeções', () => {
  test('o IRS é sobre a renda bruta, e a página di-lo', () => {
    const p = app.db.properties[0];
    p.imi = 600; p.condominio = 50;
    app.db.contracts[0] = app.normContract({ id: 'C1', name: 'T2', propertyId: 'P1', rent: 2500, start: '2024-01-01', active: true, fisco: { estado: 'declarado', numero: '111', finalidade: 'hp' } });
    app.syncPropRecs(p);
    const pr = app.projRows(null), y = pr.rows[1];
    assert.ok(y.exp > 0, 'há despesas previstas');
    assert.equal(Math.round(y.irs * 100), Math.round(y.rent * 25), 'o IRS é a renda bruta à taxa');
    const txt = app.projDespesasTxt(pr.base);
    assert.match(txt, /IRS sobre as rendas brutas, à taxa de cada contrato: o IMI, o condomínio e as obras baixam-no na declaração, e aqui não se descontam/);
  });
});

test('as categorias por id não mudam o que os outros testes esperam da base vazia', () => {
  const st = app.db.settings;
  igual(app.catIdsEmFalta(), []);
  assert.equal(app.cartaoDasCategoriasDoIrs(), '');
  assert.equal(st.catIds.catsIn.Rendas, 'rendas');
});
