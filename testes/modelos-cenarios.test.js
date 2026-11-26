// Os modelos de dados de base do Lab (KAN-167, web/app/modelos-cenarios.js):
// cada cenário é {id, nome, descricao, construir()}, e o construir() devolve
// os dados de uma conta de teste, normalizados, sem tocar na base. Os do IRS
// existem porque o Martinho não tinha dados para testar quatro subtickets
// (KAN-126-3, KAN-126-7, KAN-127-3, KAN-127-11) e não percebia o quinto
// (KAN-127-4): cada um passa aqui no motor do IRS de verdade e tem de dar o
// que a descrição promete — em vários dias do ano, porque as datas contam-se
// de hoje (até junho a Declaração abre no ano anterior, depois no corrente).
// O «Exemplo completo» é o do «Carregar exemplo» (arranque.js:dadosDoExemplo):
// o seed põe na base o mesmo que o cenário constrói.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { carregarTudo } from './arnes.js';

const FICHEIRO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web', 'app', 'modelos-cenarios.js');
const EU = { id: 'U1', name: 'Conta de Teste', email: 'teste@rendorium.test' };
const COLECOES = ['owners', 'properties', 'tenants', 'contracts', 'transactions', 'templates', 'recurring'];
/* os dias em que a bateria vive: antes e depois de junho, o início de julho
   (a renda do mês ainda por vencer) e janeiro de um ano sem regras próprias */
const DIAS = ['2026-03-10', '2026-07-02', '2026-11-26', '2027-01-15'];
const json = (x) => JSON.parse(JSON.stringify(x));

/* A app inteira num dia, com sessão e as funções que pintam e gravam caladas.
   O modelos-cenarios.js carrega-se à mão enquanto o arnês não o tiver (o
   index.html é de outra folha): avaliado no mesmo contexto, como um <script>.
   Recebe: hoje — 'AAAA-MM-DD'.
   Devolve: a app (o proxy do arnês). */
function montar(hoje) {
  const app = carregarTudo({ hoje });
  ['render', 'buildNav', 'toast', 'save', 'refreshDetail', 'avisoComVer'].forEach((n) => { app[n] = () => {}; });
  app.CW.user = Object.assign({}, EU);
  app.CW.ambiente = 'desenvolvimento';
  app.definirServicosDesligados([]);
  if (app.MODELOS_CENARIOS === undefined) {
    vm.runInContext(fs.readFileSync(FICHEIRO, 'utf8'), app.__ctx, { filename: pathToFileURL(FICHEIRO).href });
  }
  return app;
}

/* Põe os dados de um cenário na base, como o seed: a ficha da conta por
   cima da que lá está, as coleções trocadas, e os planeados derivados.
   Recebe: app; d — o que o construir() devolveu.
   Devolve: d. */
function aplicar(app, d) {
  app.db.owners = d.owners.length ? d.owners : [app.normPerson({ id: EU.id, name: EU.name })];
  COLECOES.slice(1).forEach((k) => { app.db[k] = d[k]; });
  app.syncAllContractRecs(); app.syncAllLoanRecs(); app.syncAllPropRecs();
  return d;
}

/* Um cenário construído e posto na base, com o resumo do ano que a
   Declaração abre sozinha.
   Recebe: hoje — o dia; id — o id do cenário.
   Devolve: {app, d, T, r} — T o ano da Declaração, r o resumoFiscal dele. */
function cenario(hoje, id) {
  const app = montar(hoje);
  const d = aplicar(app, app.cenarioDeBase(id).construir());
  const T = app.fiscoAnoAuto();
  return { app, d, T, r: app.resumoFiscal(T, EU.id) };
}

describe('a lista dos modelos de base', () => {
  const app = montar('2026-11-26');
  const L = json(app.MODELOS_CENARIOS.map((m) => ({ id: m.id, nome: m.nome, descricao: m.descricao, f: typeof m.construir })));

  test('cada um é {id, nome, descricao, construir}, com ids estáveis e sem repetir', () => {
    assert.deepEqual(L.map((m) => m.id), ['exemplo', 'vazio', 'prejuizo', 'isencoes-6h-6f', 'reducao', 'reducao-terminada', 'renda-dezembro']);
    L.forEach((m) => {
      assert.match(m.id, /^[a-z0-9][a-z0-9-]{0,47}$/, m.id);
      assert.equal(m.f, 'function', m.id + ': construir');
      assert.ok(m.nome.length > 0 && m.nome.length <= 32, m.id + ': nome curto («' + m.nome + '»)');
      assert.ok(m.descricao.length > 20 && m.descricao.length <= 130 && !/\n/.test(m.descricao), m.id + ': uma linha de descrição');
      assert.match(m.descricao, /\.$/, m.id + ': a descrição acaba em ponto');
    });
    assert.equal(app.cenarioDeBase('prejuizo').nome, 'Ano com prejuízo');
    assert.equal(app.cenarioDeBase('nao-existe'), null);
  });

  test('o construir() não mexe na base, devolve as coleções todas e aguenta ir e voltar em JSON', () => {
    for (const m of L) {
      const a = montar('2026-11-26');
      const antes = JSON.stringify(a.db);
      const d = a.cenarioDeBase(m.id).construir();
      assert.equal(JSON.stringify(a.db), antes, m.id + ': a base ficou igual');
      assert.deepEqual(Object.keys(d).sort(), COLECOES.slice().sort(), m.id + ': as coleções');
      COLECOES.forEach((k) => assert.ok(Array.isArray(d[k]), m.id + ': ' + k + ' é uma lista'));
      assert.deepEqual(json(d), JSON.parse(JSON.stringify(json(d))), m.id);
    }
  });

  test('tudo se liga: imóveis dos donos, contratos de imóveis e inquilinos que existem, movimentos de contratos que existem', () => {
    for (const m of L) {
      const d = app.cenarioDeBase(m.id).construir();
      const props = new Set(d.properties.map((p) => p.id)), pessoas = new Set(d.tenants.map((t) => t.id)), cts = new Set(d.contracts.map((c) => c.id));
      d.properties.forEach((p) => p.ownerIds.forEach((o) => assert.ok(d.owners.some((x) => x.id === o), m.id + ': dono ' + o)));
      d.contracts.forEach((c) => {
        assert.ok(props.has(c.propertyId), m.id + ': imóvel do contrato');
        c.tenantIds.forEach((t) => assert.ok(pessoas.has(t), m.id + ': inquilino do contrato'));
      });
      d.transactions.forEach((t) => {
        assert.ok(!t.propertyId || props.has(t.propertyId), m.id + ': imóvel de ' + t.label);
        assert.ok(!t.contractId || cts.has(t.contractId), m.id + ': contrato de ' + t.label);
      });
    }
  });

  test('os NIF passam o dígito de controlo, e os dos cenários novos não repetem os do exemplo nem entre si', () => {
    const vistos = new Map();
    for (const m of L) {
      const d = app.cenarioDeBase(m.id).construir();
      d.owners.concat(d.tenants).filter((p) => p.nif).forEach((p) => {
        assert.equal(app.nifValido(p.nif), true, m.id + ': ' + p.name + ' ' + p.nif);
        if (d.tenants.includes(p)) {
          assert.ok(!vistos.has(p.nif) || vistos.get(p.nif) === p.name, m.id + ': o NIF ' + p.nif + ' já é de ' + vistos.get(p.nif));
          vistos.set(p.nif, p.name);
        }
      });
    }
  });

  test('a proprietária é a conta: os campos dela ficam, e o exemplo só preenche os vazios', () => {
    const a = montar('2026-11-26');
    a.db.owners = [a.normPerson({ id: EU.id, name: 'Ana Própria', phone: '911 111 111' })];
    const d = a.cenarioDeBase('prejuizo').construir();
    assert.equal(d.owners.length, 1);
    const o = d.owners[0];
    assert.equal(o.id, EU.id);
    assert.equal(o.name, 'Ana Própria');
    assert.equal(o.phone, '911 111 111');
    assert.equal(o.nif, '210000007', 'o NIF que faltava vem do exemplo');
    assert.equal(a.db.owners[0].nif, '', 'na base nada mudou');
    assert.deepEqual(json(d.properties[0].ownerIds), [EU.id]);
  });
});

describe('o «Exemplo completo» é o «Carregar exemplo»', () => {
  test('o seed põe na base o mesmo que o cenário constrói (menos os ids e o instante em que nasceram)', () => {
    const a = montar('2026-11-26');
    a.refreshKnown();
    a.seed();
    a.clearTimeout(a.pushTimer);
    const d = a.cenarioDeBase('exemplo').construir();
    /* os ids nascem novos a cada chamada, e o criado é o instante em que nasceu */
    const sem = (x) => JSON.stringify(x, (k, v) => (/^(id|propertyId|contractId|loanId|roomId|tenantIds|ownerIds|tenantContactId|ownerContactId|criado)$/.test(k) ? undefined : v));
    for (const k of ['properties', 'tenants', 'contracts', 'transactions', 'templates']) {
      assert.equal(sem(a.db[k]), sem(d[k]), k);
    }
    assert.equal(d.recurring.length, 1, 'só o planeado à mão; os automáticos derivam-se');
    assert.ok(a.db.recurring.length > 1, 'e o seed derivou os automáticos');
    assert.equal(a.db.owners.find((o) => o.id === EU.id).nif, '210000007');
  });

  test('sem sessão, a proprietária é a Maria Costa, sozinha', () => {
    const a = montar('2026-11-26');
    a.CW.user = null;
    a.db.owners = [a.normPerson({ id: 'X', name: 'Outra' })];
    a.seed();
    a.clearTimeout(a.pushTimer);
    assert.deepEqual(json(a.db.owners.map((o) => o.name)), ['Maria Costa']);
    assert.ok(a.db.properties.every((p) => p.ownerIds[0] === a.db.owners[0].id));
  });
});

describe('«Vazio»', () => {
  test('a conta sem dados, com a ficha da conta como estava', () => {
    const a = montar('2026-11-26');
    a.db.owners = [a.normPerson({ id: EU.id, name: 'Ana Própria' })];
    const d = a.cenarioDeBase('vazio').construir();
    COLECOES.slice(1).forEach((k) => assert.equal(d[k].length, 0, k));
    assert.equal(d.owners.length, 1);
    igualSimples(d.owners[0], { id: EU.id, name: 'Ana Própria', nif: '', phone: '' });
    a.CW.user = null;
    assert.equal(a.cenarioDeBase('vazio').construir().owners.length, 0, 'sem sessão, ficha nenhuma');
  });
});

/* Confere só os campos dados de um objeto.
   Recebe: o — o objeto; esperado — {campo: valor}.
   Devolve: nada — falha a asserção no primeiro que não bate. */
function igualSimples(o, esperado) {
  Object.keys(esperado).forEach((k) => assert.equal(o[k], esperado[k], k));
}

for (const hoje of DIAS) {
  describe('os cenários do IRS, a ' + hoje, () => {
    test('«Ano com prejuízo» (KAN-126-3): líquido negativo, imposto 0 € e o prejuízo a reportar', () => {
      const { app, d, T, r } = cenario(hoje, 'prejuizo');
      assert.equal(T, app.cenAnoDaDeclaracao(), 'a Declaração abre no ano do cenário');
      assert.ok(d.transactions.every((t) => t.date <= app.today()), 'nada depois de hoje');
      assert.ok(r.totais.rendas > 0, 'há rendas');
      assert.ok(r.totais.liquido < 0, 'o líquido é negativo (' + r.totais.liquido + ')');
      assert.ok(r.totais.prejuizo > 0, 'e é prejuízo');
      assert.equal(r.totais.imposto, 0, 'o imposto das linhas não é negativo');
      assert.equal(app.fiscoImpostoDoKpi(r), 0, 'o «Imposto estimado» fica em 0 €');
      assert.equal(app.fiscoPrejuizos(r).length, 1);
      assert.equal(app.fiscoPrejuizos(r)[0].valor, -r.totais.liquido);
      const kpis = app.fiscoKpis(r);
      assert.match(kpis, /prejuízo a reportar/);
      assert.doesNotMatch(kpis, /Imposto estimado[^]*?−\s*\d/, 'nenhum imposto com sinal de menos');
      assert.ok(!r.avisos.some((a) => a.nivel === 'falta'), 'sem faltas a desviar a atenção: ' + r.avisos.filter((a) => a.nivel === 'falta').map((a) => a.texto).join(' | '));
    });

    test('«Isenções 6H e 6F» (KAN-126-7): cada contrato mostra só a isenção que as datas lhe dão, e ela conta', () => {
      const { app, d, T, r } = cenario(hoje, 'isencoes-6h-6f');
      const [cA, cB, cC] = d.contracts;
      const oferecidas = (c) => app.ctIsencoesOferecidas(c).map((x) => x.v);
      assert.equal(cA.fisco.celebracao.slice(0, 4), '2024');
      assert.ok(cB.fisco.celebracao < '1990-12-31');
      assert.equal(cC.fisco.celebracao.slice(0, 4), '2025');
      [cA, cB, cC].forEach((c) => {
        assert.equal(c.fisco.finalidade, 'hp');
        assert.equal(c.fisco.estado, 'declarado');
        assert.match(c.fisco.numero, /^\d{7}$/);
        assert.equal(c.fisco.isencao, '', 'nenhuma escolhida: escolhe-a quem testa');
      });
      assert.ok(oferecidas(cA).includes('al') && !oferecidas(cA).includes('prerau'), '2024: o 6F e não o 6H');
      assert.ok(oferecidas(cB).includes('prerau') && !oferecidas(cB).includes('al'), '1985: o 6H e não o 6F');
      assert.ok(!oferecidas(cC).includes('al') && !oferecidas(cC).includes('prerau'), '2025: nenhuma das duas');
      // escolhidas e confirmadas, contam no ano da Declaração — e no 6F e 6H
      const com = (c, id, campo) => Object.assign({}, c, { fisco: Object.assign({}, c.fisco, { isencao: id, [campo]: true }) });
      assert.equal((app.irsIsencao(com(cA, 'al', 'alRegistado2022'), T) || {}).quadro, '6F');
      assert.equal((app.irsIsencao(com(cB, 'prerau', 'nrau3536'), T) || {}).quadro, '6H');
      assert.equal(app.irsIsencao(com(cC, 'al', 'alRegistado2022'), T), null);
      assert.match(app.irsIsencaoMotivo(com(cC, 'al', 'alRegistado2022'), T), /celebrados até 31\/12\/2024/);
      assert.equal(r.linhas.length, 3, 'os três na Declaração');
      assert.ok(r.linhas.every((l) => l.quadro === '4.1' && !l.isencao), 'sem isenção escolhida, os três no 4.1');
    });

    test('«Contrato com redução» (KAN-127-3): quadro 4.2, e a comunicação da duração por marcar', () => {
      const { app, d, T, r } = cenario(hoje, 'reducao');
      const c = d.contracts[0], v = app.irsAno(T);
      const red = app.irsReducao(c, T);
      assert.ok(red, 'tem redução pela duração');
      assert.equal(red.meses, 60, '5 anos');
      assert.ok(red.taxa < v.taxas.habitacional, 'abaixo da taxa base');
      const l = r.linhas.find((x) => x.contratoId === c.id);
      assert.equal(l.quadro, v.quadros.comReducao, 'no quadro 4.2');
      assert.equal(l.comunicacao.data, '', 'a comunicação está por marcar');
      assert.equal(l.comunicacao.prazo, (T + 1) + '-02-15');
      assert.equal(JSON.stringify(c.fisco.comunicacoes), '{}');
      assert.ok(r.avisos.some((a) => /duração do contrato/.test(a.texto) && a.texto.includes(app.ctName(c))), 'e «A tratar» lembra-a');
    });

    test('«Redução terminada» (KAN-127-11): os dois no quadro 10, e «A tratar» pede o motivo e a regularização', () => {
      const { app, d, T, r } = cenario(hoje, 'reducao-terminada');
      const [cA, cB] = d.contracts, v = app.irsAno(T);
      const reg3 = v.quadro10.regimes.find((x) => x.n === 3).codigo;
      assert.equal(r.cessados.length, 2, 'os dois no quadro 10');
      const qA = r.cessados.find((x) => x.contratoId === cA.id), qB = r.cessados.find((x) => x.contratoId === cB.id);
      igualSimples(qA, { regime: reg3, motivo: '01', data: T + '-06-30', anoInicioBeneficio: T - 1, anoInicioConfirmar: false });
      igualSimples(qB, { regime: reg3, motivo: '', data: T + '-04-30', anoInicioBeneficio: T - 1 });
      [cA, cB].forEach((c) => {
        assert.equal(c.active, false, 'terminado');
        assert.ok(app.irsFimEfetivo(c) > c.fisco.cessacao.data, 'antes do prazo: o termo fica o combinado');
        assert.ok(app.irsReducao(c, T - 1), 'com redução no ano antes');
      });
      const nomeA = app.ctName(cA), nomeB = app.ctName(cB);
      const avisos = r.avisos.filter((a) => a.nivel === 'falta').map((a) => a.texto);
      assert.ok(avisos.some((t) => t.includes(nomeB) && /sem o motivo da cessação/.test(t)), 'pede o motivo do que não o tem');
      assert.ok(avisos.some((t) => t.includes(nomeA) && /antes do prazo por motivo do senhorio/.test(t)), 'diz a regularização do outro');
      const reg = r.regularizacoes.find((x) => x.contratoId === cA.id);
      assert.ok(reg, 'a regularização do art. 72.º n.º 20');
      const ant = reg.anos.concat(reg.porConfirmar).find((y) => y.ano === T - 1);
      assert.ok(ant && ant.diferenca > 0, 'com a diferença do ano anterior');
      assert.ok(!r.regularizacoes.some((x) => x.contratoId === cB.id), 'sem motivo não há regularização');
    });

    test('«Renda de dezembro por confirmar» (KAN-127-4): o planeado está na de dezembro, e confirmá-la pergunta o dia', async () => {
      const { app, d } = cenario(hoje, 'renda-dezembro');
      const c = d.contracts[0], Y = app.YEAR - 1;
      assert.ok(d.transactions.filter(app.ehRenda).every((t) => t.periodo < Y + '-12'), 'as rendas param em novembro');
      const rec = app.ctRecOf(c);
      assert.ok(rec, 'os Planeados derivaram o planeado da renda');
      assert.equal(rec.next, Y + '-12-08', 'na renda de dezembro do ano passado');
      assert.equal(app.recIsLate(rec), true, 'em atraso');
      assert.equal(app.recPedeODia(rec), true, 'confirmada hoje, pergunta o dia');
      const janelas = [];
      app.openModal = (titulo) => { janelas.push(titulo); };
      app.quickConfirmRec(rec.id);
      await new Promise((ok) => setTimeout(ok, 10));
      assert.deepEqual(janelas, ['Em que dia entrou?']);
      assert.ok(!app.db.transactions.some((t) => t.periodo === Y + '-12'), 'e nada se regista antes da resposta');
    });
  });
}
