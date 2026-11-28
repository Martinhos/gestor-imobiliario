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
// Os de 2026-11-27 (base: false, só para quem os pediu) respondem aos
// subtickets do IRS que o Martinho não conseguia testar sem dados: a
// tributação conjunta (KAN-153-1, KAN-129-6), o imóvel em França (KAN-129-2),
// os donos por confirmar (KAN-128-6, KAN-154-4), o bloco fiscal (KAN-128-3),
// as obras antes do início (KAN-128-2), os encargos do inquilino (KAN-129-3),
// a renda paga em parte (KAN-129-4), a categoria B (KAN-129-5) e o imóvel por
// quartos (KAN-152-1); e as isenções já escolhidas (KAN-126-10) e a
// comunicação da duração na ficha (KAN-127-18) nos de base.

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
   cima da que lá está, as coleções trocadas, as definições que o cenário
   traz juntas às da conta (como o cloud/modelos.js:mdlEntidadesDoCenario), e
   os planeados derivados.
   Recebe: app; d — o que o construir() devolveu.
   Devolve: d. */
function aplicar(app, d) {
  app.db.owners = d.owners.length ? d.owners : [app.normPerson({ id: EU.id, name: EU.name })];
  COLECOES.slice(1).forEach((k) => { app.db[k] = d[k]; });
  if (d.settings) Object.assign(app.db.settings, d.settings);
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
  const L = json(app.MODELOS_CENARIOS.map((m) => ({ id: m.id, nome: m.nome, descricao: m.descricao, f: typeof m.construir, base: m.base })));
  const DE_BASE = ['exemplo', 'vazio', 'prejuizo', 'isencoes-6h-6f', 'reducao', 'reducao-terminada', 'renda-dezembro'];
  const DOS_TICKETS = ['conjunta', 'imovel-franca', 'donos-por-confirmar', 'bloco-fiscal', 'obras-antes', 'encargos-inquilino', 'renda-parcial', 'categoria-b', 'quartos'];

  test('cada um é {id, nome, descricao, construir}, com ids estáveis e sem repetir', () => {
    assert.deepEqual(L.map((m) => m.id), DE_BASE.concat(DOS_TICKETS));
    assert.equal(new Set(L.map((m) => m.id)).size, L.length, 'sem ids repetidos');
    assert.equal(new Set(L.map((m) => m.nome)).size, L.length, 'sem nomes repetidos');
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

  test('os dos tickets não nascem a toda a gente (base: false); os de base sim', () => {
    L.forEach((m) => assert.equal(m.base, DOS_TICKETS.includes(m.id) ? false : undefined, m.id));
    // a lista do ?base= do GET /api/modelos (cloud/modelos.js:mdlIdsDeBase) é a dos de base
    assert.deepEqual(L.filter((m) => m.base !== false).map((m) => m.id), DE_BASE);
  });

  test('o construir() não mexe na base, devolve as coleções todas e aguenta ir e voltar em JSON', () => {
    for (const m of L) {
      const a = montar('2026-11-26');
      const antes = JSON.stringify(a.db);
      const d = a.cenarioDeBase(m.id).construir();
      assert.equal(JSON.stringify(a.db), antes, m.id + ': a base ficou igual');
      assert.deepEqual(Object.keys(d).filter((k) => k !== 'settings').sort(), COLECOES.slice().sort(), m.id + ': as coleções');
      if (d.settings) assert.deepEqual(Object.keys(d.settings), ['irs'], m.id + ': das definições, só as escolhas do IRS');
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
      assert.equal(r.linhas.length, 5, 'os cinco na Declaração');
      const linha = (c) => r.linhas.find((l) => l.contratoId === c.id);
      assert.ok([cA, cB, cC].every((c) => linha(c).quadro === '4.1' && !linha(c).isencao), 'sem isenção escolhida, os três no 4.1');
      // KAN-126-10: os dois com a isenção já escolhida e confirmada, cada um no seu quadro, sem imposto
      const [, , , cD, cE] = d.contracts;
      igualSimples(cD.fisco, { isencao: 'al', alRegistado2022: true, estado: 'declarado', finalidade: 'hp' });
      igualSimples(cE.fisco, { isencao: 'prerau', nrau3536: true, estado: 'declarado', finalidade: 'hp' });
      assert.ok(cD.fisco.celebracao >= '2023-01-01' && cD.fisco.celebracao <= '2024-12-31', '6F: celebrado em 2023 ou 2024');
      assert.ok(cE.fisco.celebracao < '1990-12-31', '6H: anterior ao RAU');
      assert.ok(oferecidas(cD).includes('al') && oferecidas(cE).includes('prerau'), 'a escolhida vê-se no formulário');
      assert.equal((linha(cD).isencao || {}).quadro, '6F');
      assert.equal((linha(cE).isencao || {}).quadro, '6H');
      assert.equal(linha(cD).imposto, 0, '6F: isento');
      assert.equal(linha(cE).imposto, 0, '6H: isento');
      assert.ok(linha(cD).rendas > 0 && linha(cE).rendas > 0, 'com rendas no ano');
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
      // KAN-127-18: a ficha do contrato tem a comunicação a fazer (contrato.js:ctComunicacoesDaFicha)
      const naFicha = json(app.ctComunicacoesDaFicha(c));
      assert.equal(naFicha.length, 1, 'uma comunicação na ficha');
      igualSimples(naFicha[0], { periodoInicio: c.start, chave: String(T), prazo: (T + 1) + '-02-15', data: '' });
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

    test('«Tributação conjunta» (KAN-153-1, KAN-129-6): dois titulares, um Anexo J por titular, e o aviso da conjunta a cinzento', () => {
      const { app, d, T, r } = cenario(hoje, 'conjunta');
      const sit = d.settings.irs.porAno[String(T)];
      igualSimples(sit, { conjunta: true, bensComuns: true, conjugeId: '', minhaLetra: 'A' });
      const [pA, pB] = d.properties, [cA, cB] = d.contracts;
      [pA, pB].forEach((p) => {
        assert.deepEqual(json(p.ownerIds), [EU.id], p.name + ': só a conta na app');
        assert.deepEqual(json(p.comproprietariosFora).map((x) => [x.nome, x.quota]), [['Jorge Almeida', 50]], p.name + ': o cônjuge, a metade');
      });
      igualSimples(pA, { pais: '', distrito: 'Lisboa' });
      igualSimples(pB, { pais: 'França', paisCodigo: '250' });
      assert.deepEqual(json(r.titulares), [EU.id, app.fiscoConjugeForaId(EU.id)], 'eu e o cônjuge sem conta');
      igualSimples(r.conjugeFora, { nome: 'Jorge Almeida', letra: 'B' });
      // o imóvel de Lisboa no Anexo F, uma linha por titular, cada uma com metade
      const lA = r.linhas.filter((l) => l.contratoId === cA.id);
      assert.deepEqual(json(lA.map((l) => l.titular).sort()), ['A', 'B']);
      assert.equal(lA[0].rendas, lA[1].rendas, 'metade cada um');
      // Lyon fora do Anexo F, no 7A do Anexo J: uma entrada por titular, com o imposto pago lá a meias
      assert.ok(!r.linhas.some((l) => l.contratoId === cB.id), 'Lyon não vai ao Anexo F');
      const rendasLyon = d.transactions.filter((t) => t.contractId === cB.id && t.date.startsWith(String(T))).reduce((s, t) => s + t.amount, 0);
      assert.ok(rendasLyon > 0, 'rendas de Lyon no ano');
      assert.equal(r.anexoJ.length, 2, 'duas entradas do Anexo J');
      assert.deepEqual(json(r.anexoJ.map((e) => e.titular).sort()), ['A', 'B']);
      r.anexoJ.forEach((e) => {
        igualSimples(e, { contratoId: cB.id, paisCodigo: '250', rendas: rendasLyon / 2, impostoEstrangeiro: 800 });
      });
      const J = app.fiscoExpAnexoJ(r);
      assert.equal(J.conjunta, true);
      assert.deepEqual(json(J.porTitular.map((g) => [g.titulo, g.totais.n, g.totais.rendas])),
        [['Anexo J do titular A', 1, rendasLyon / 2], ['Anexo J do titular B', 1, rendasLyon / 2]], 'o PDF e o CSV fazem um por titular, cada um com o seu total');
      const av = r.avisos.filter((a) => /^Tributação conjunta/.test(a.texto));
      assert.equal(av.length, 1, 'um aviso da conjunta');
      assert.equal(av[0].nivel, 'info', 'a cinzento (informativo)');
      assert.match(av[0].texto, /Jorge Almeida/);
      assert.match(av[0].texto, /Os imóveis só de Jorge Almeida, que não estão na app, inserem-se à mão no Portal/);
      assert.ok(!r.avisos.some((a) => a.nivel === 'falta'), 'sem faltas: ' + r.avisos.filter((a) => a.nivel === 'falta').map((a) => a.texto).join(' | '));
    });

    test('«Imóvel em França» (KAN-129-2): vai ao Anexo J, com o imposto pago lá, e sem os prazos do Código Civil', () => {
      const { app, d, T, r } = cenario(hoje, 'imovel-franca');
      const p = d.properties[0], c = d.contracts[0];
      igualSimples(p, { pais: 'França', paisCodigo: '250' });
      assert.deepEqual(json(p.comproprietariosFora), [], 'só da proprietária, confirmado');
      assert.equal(c.fisco.impostoEstrangeiro[String(T)], 2100);
      assert.equal(app.fiscoForaDoAnexoF(c), 'anexoJ');
      assert.equal(r.linhas.length, 0, 'nada no Anexo F');
      assert.equal(r.anexoJ.length, 1, 'o cartão do Anexo J tem o contrato');
      igualSimples(r.anexoJ[0], { contratoId: c.id, titular: 'A', paisCodigo: '250', impostoEstrangeiro: 2100 });
      assert.ok(r.anexoJ[0].rendas > 0);
      assert.equal(app.pzForaDePortugal(p.id), true);
      const doContrato = app.prazosDe(app.today()).filter((x) => JSON.stringify(x).includes(c.id));
      assert.deepEqual(json(doContrato.map((x) => x.titulo)), [], 'nenhum prazo deste contrato');
      assert.ok(!r.avisos.some((a) => a.nivel === 'falta'), 'sem faltas: ' + r.avisos.filter((a) => a.nivel === 'falta').map((a) => a.texto).join(' | '));
    });

    test('«Donos por confirmar» (KAN-128-6, KAN-154-4): «A tratar» pergunta se há mais donos, com «É só meu»', () => {
      const { app, d, T, r } = cenario(hoje, 'donos-por-confirmar');
      const p = d.properties[0];
      assert.equal(p.comproprietariosFora, null, 'sem resposta a «Há outros donos fora da app?»');
      assert.deepEqual(json(p.ownerIds), [EU.id]);
      assert.equal(app.fiscoAvSoDeUmDono(p, T), true);
      assert.ok(r.linhas.some((l) => l.propertyId === p.id && l.rendas > 0), 'com rendas no ano');
      const av = r.avisos.find((a) => a.texto.includes('Imóvel ' + p.name + ': há mais donos além de ti?'));
      assert.ok(av, 'o aviso dos donos');
      assert.equal(av.abrirTexto, 'Há outros donos');
      assert.equal(av.acaoTexto, 'É só meu');
      assert.match(av.acao, /imvSoMeu\(/);
    });

    test('«Bloco fiscal do contrato» (KAN-128-3): cada pergunta do bloco fiscal tem razão para aparecer', () => {
      const { app, d } = cenario(hoje, 'bloco-fiscal');
      const [cA, cB] = d.contracts;
      [cA, cB].forEach((c) => igualSimples(c.fisco, { estado: 'declarado', finalidade: 'hp' }));
      // o de 2019: a renda de 2023, as renovações e os consumos incluídos
      assert.ok(cA.start < '2022-01-01');
      assert.equal(cA.fisco.atualizacao2023, '', 'a renda de 2023 por responder');
      assert.equal(app.ctAtualizacao2023Visivel(cA), true);
      assert.equal(app.ctRenovacoesVisivel(cA), true);
      assert.equal(cA.fisco.consumosIncluidos, true);
      assert.equal(app.ctEncargosTem(cA), true, 'a pergunta dos encargos abre');
      assert.equal(app.ctConsumosValor(cA), 'incluidos');
      // o do RSAA: a particularidade, a isenção, o IHRU, o pago à parte, os n.os 23 e 24, as obras
      igualSimples(cB.fisco, { isencao: 'rsaa', ihru: '', extrasMensais: 40, obrasSemOutroUso: null });
      assert.ok(cB.fisco.celebracao >= '2026-09-01', 'celebrado no tempo do RSAA');
      assert.equal(app.ctParticularidadeTem(cB), true, 'a particularidade fiscal abre');
      assert.ok(app.ctIsencoesOferecidas(cB).some((x) => x.v === 'rsaa'));
      assert.equal(app.ctIsencaoPede(cB, 'ihru'), true, 'o envio ao IHRU pergunta-se');
      assert.equal(app.ctExtrasVisivel(cB), true);
      assert.equal(app.ctN23Visivel(cB), true);
      assert.equal(app.ctN24Visivel(cB), true);
      assert.equal(app.ctAtualizacao2023Visivel(cB), false);
      const pintura = d.transactions.find((t) => t.label === 'Pintura do T1 Lumiar');
      if (app.addDays(cB.start, -60) <= app.today()) {
        assert.ok(pintura, 'a pintura antes do início');
        assert.ok(app.ctObrasAntes(cB), 'a pergunta das obras aparece');
      } else {
        assert.equal(pintura, undefined, 'a pintura ainda não aconteceu: nada depois de hoje');
      }
      assert.equal(app.ctObrasAntes(cA), null, 'o de 2019 não tem obras');
      assert.ok(d.transactions.every((t) => t.date <= app.today()), 'nada depois de hoje');
    });

    test('«Obras antes do início» (KAN-128-2): as obras ficam fora até à resposta, e «A tratar» tem o «Responder»', () => {
      const { app, d, T, r } = cenario(hoje, 'obras-antes');
      const c = d.contracts[0];
      assert.equal(c.start, T + '-03-01');
      assert.equal(c.fisco.obrasSemOutroUso, null, 'por responder');
      const o = app.ctObrasAntes(c);
      assert.equal(o && o.desde, (T - 1) + '-10-15', 'a pergunta das obras, no contrato');
      const pc = r.obrasPorConfirmar.find((x) => x.contratoId === c.id);
      igualSimples(pc, { valor: 3750, resposta: null });
      const av = r.avisos.find((a) => a.abrir && a.abrir.includes('ctIrParaPergunta') && a.abrir.includes('c_fobras'));
      assert.ok(av, 'o aviso das obras abre a pergunta do contrato');
      assert.equal(av.nivel, 'aviso');
      assert.equal(av.abrirTexto || app.fiscoRotuloDoAviso(av.abrir), 'Responder');
    });

    test('«Encargos do inquilino» (KAN-129-3): marcar o condomínio no contrato suspende o planeado', () => {
      const { app } = cenario(hoje, 'encargos-inquilino');
      const c = app.db.contracts[0], rec = app.db.recurring.find((x) => !x.auto);
      assert.deepEqual(json(c.encargosInquilino), [], 'nenhum encargo marcado');
      assert.equal(app.db.recurring.filter((x) => !x.auto).length, 1, 'só o planeado feito à mão (os automáticos derivam-se)');
      igualSimples(rec.tx, { kind: 'expense', category: 'Condomínio', sub: 'Quota mensal', propertyId: c.propertyId });
      assert.equal(rec.every, 'month');
      assert.equal(app.recEncargoDoInquilino(rec), 'condominio');
      assert.equal(rec.next, app.today().slice(0, 7) + '-01', 'a quota deste mês');
      assert.equal(app.recIsLate(rec), true, 'por confirmar');
      assert.equal(app.recSuspensaPeloInquilino(rec, rec.next), null);
      // o teste: marcar «Condomínio» no contrato
      c.encargosInquilino = ['condominio'];
      app.syncContractRec(c);
      assert.ok(rec.next > app.today(), 'o planeado passou os meses do contrato (' + rec.next + ')');
      assert.ok(app.recSuspensaPeloInquilino(rec, rec.next), 'e os seguintes estão suspensos');
    });

    test('«Renda paga em parte» (KAN-129-4): 300 € em dívida da renda de há dois meses, e as duas seguintes em falta', () => {
      const { app, d } = cenario(hoje, 'renda-parcial');
      const c = d.contracts[0], rec = app.ctRecOf(c);
      const mes = (n) => { const x = app.cenMesAtras(n); return x.y + '-' + String(x.m).padStart(2, '0'); };
      assert.equal(c.rent, 800);
      const rendas = d.transactions.filter(app.ehRenda);
      const parcial = rendas.filter((t) => t.parcial);
      assert.equal(parcial.length, 1);
      igualSimples(parcial[0], { amount: 500, periodo: mes(2) });
      assert.ok(!rendas.some((t) => t.periodo === mes(1) || t.periodo === mes(0)), 'as duas seguintes por pagar');
      assert.ok(rendas.filter((t) => !t.parcial).every((t) => t.amount === 800 && t.periodo <= mes(3)));
      assert.equal(app.rendaJaLancada(c, mes(2) + '-01'), false, 'a parcial não fecha o mês');
      assert.equal(rec.next.slice(0, 7), mes(2), 'o planeado continua a pedir a renda de há dois meses');
      assert.equal(app.recIsLate(rec), true);
      assert.deepEqual(json(app.recRestoDaRenda(rec)), { amount: 300, retencao: 0 }, 'o resto: 300 €');
    });

    test('«Categoria B» (KAN-129-5): fora do Anexo F, com um total de cinco algarismos', () => {
      const { app, d, r } = cenario(hoje, 'categoria-b');
      const c = d.contracts[0];
      assert.equal(c.fisco.categoriaB, true);
      assert.equal(app.fiscoForaDoAnexoF(c), 'categoriaB');
      assert.equal(r.linhas.length, 0, 'nada no Anexo F');
      assert.equal(r.categoriaB.length, 1);
      const tot = r.categoriaB[0].rendas;
      assert.ok(tot >= 10000 && tot < 100000, 'cinco algarismos (' + tot + ')');
    });

    test('«Imóvel por quartos» (KAN-152-1): partes de 18, 22 e 30 %, dois arrendados, e os gastos da casa em 40 %', () => {
      const { app, d, T, r } = cenario(hoje, 'quartos');
      const p = d.properties[0];
      assert.equal(p.rentalMode, 'quartos');
      assert.deepEqual(json(p.rooms.map((q) => q.parte)), [18, 22, 30]);
      assert.deepEqual(json(d.contracts.map((c) => c.roomId)), [p.rooms[0].id, p.rooms[1].id], 'os de 18 e 22 % arrendados');
      d.contracts.forEach((c) => assert.ok(c.start < T + '-01-01' && !c.end, 'o ano todo'));
      const gastos = d.transactions.filter((t) => t.kind === 'expense');
      assert.deepEqual(json([...new Set(gastos.map((t) => t.category))].sort()), ['Condomínio', 'Impostos', 'Manutenção e reparações']);
      // o motor: a parte arrendada do ano é a soma das partes dos quartos com contrato
      const pa = app.fiscoParteArrendadaDoAno(p, T);
      assert.ok(Math.abs(pa.parte - 0.4) < 1e-9, 'a parte arrendada é 40 % (' + pa.parte + ')');
      assert.equal(pa.porOmissao, false);
      const av = r.avisos.find((a) => a.texto.includes('Imóvel ' + p.name) && /parte arrendada/.test(a.texto));
      assert.ok(av, 'o aviso da parte arrendada');
      assert.match(av.texto, /40 %/);
    });
  });
}

describe('a situação fiscal vem com o cenário', () => {
  test('a conjunta de um cenário não fica ligada no que se usar a seguir, e o resto das escolhas fica', () => {
    const app = montar('2026-11-26');
    app.db.settings.irs = app.normIrsDefs({ porAno: { 2026: { conjunta: false, dispensaRecibos: true, aimi: { total: 120 } } } });
    const T = app.cenAnoDaDeclaracao();
    aplicar(app, app.cenarioDeBase('conjunta').construir());
    let s = app.irsSituacao(T, EU.id);
    assert.equal(s.conjunta, true);
    assert.equal(s.dispensaRecibos, true, 'a dispensa dos recibos ficou');
    assert.equal(s.aimi.total, 120, 'e os números do AIMI');
    aplicar(app, app.cenarioDeBase('prejuizo').construir());
    s = app.irsSituacao(T, EU.id);
    assert.equal(s.conjunta, false, 'o cenário seguinte volta à separada');
    assert.equal(s.dispensaRecibos, true);
  });
});
