// As versões de 2025 e 2026 com os dados que a auditoria ao IRS pediu (KAN-126,
// folha 2.1.3): as tabelas do quadro 10 (regime e motivo), as isenções 6H e 6F
// com as condições, as naturezas 05 e 02, o quadro 5, as condições do PAA e do
// RSAA, o n.º 24 desde 7 de outubro de 2023, a data da revisão, o IAS, a
// Portaria 454/2026/1 no lugar da 176/2019, os nomes do impresso, o quadro 4.4
// e os passos (a condição das obras, A e B como posições no rosto, o quadro 10
// de todos os motivos). Cada dado é conferido contra a fonte escrita no
// cabeçalho do irs-AAAA.js — aqui fica o que a fonte diz, para a versão não se
// afastar dela sem alguém dar por isso.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { carregarApp, repor } from './arnes.js';

const app = carregarApp({ hoje: '2026-11-17' });
afterEach(() => repor(app));
const copia = (x) => JSON.parse(JSON.stringify(x));
const v = (a) => copia(app.irsAno(a));
const ANOS = [2025, 2026];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const RAIZ = new URL('../', import.meta.url);
const ler = (rel) => readFileSync(new URL(rel, RAIZ), 'utf8');
const { anosNosPassos, textoNovo } = createRequire(import.meta.url)('../scripts/nova-versao-irs.js');

/* a entrada da portaria do n.º 23 em vigor num dia, como o motor a deve ler */
const portariaEm = (ano, dia) => v(ano).taxas.limiteRendaAlta.portaria.find((p) => p.desde <= dia && (!p.ate || dia <= p.ate)) || null;

describe('D09/D10 — o quadro 10, com as tabelas das instruções do Anexo F', () => {
  for (const a of ANOS) {
    test(a + ': «Regime fiscal» 01 a 10 — 01 a 04 pelo n.º do art. 72.º, 05 a 10 pela isenção', () => {
      const r = v(a).quadro10.regimes;
      assert.deepEqual(r.map((x) => x.codigo), ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']);
      assert.deepEqual(r.slice(0, 4).map((x) => x.n), [2, 3, 4, 5]);
      assert.equal(r[0].texto, 'Artigo 72.º, n.º 2, do Código do IRS');
      assert.deepEqual(r.slice(4).map((x) => x.isencao), ['paa', 'paa', 'pma', 'pma', 'pmae', 'pmae']);
      assert.deepEqual(r.slice(4).map((x) => !!x.sub), [false, true, false, true, false, true], 'os pares são arrendamento/subarrendamento');
      assert.equal(r[4].texto, 'Apoio ao Arrendamento');
      assert.equal(r[9].texto, 'Subarrendamento para Alojamento Estudantil');
    });

    test(a + ': «Motivo da cessação» 01 a 12, e só o 01 regulariza (art. 72.º n.º 20)', () => {
      const m = v(a).quadro10.motivos;
      assert.deepEqual(m.map((x) => x.codigo), ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']);
      assert.deepEqual(m.filter((x) => x.regulariza).map((x) => x.codigo), ['01']);
      assert.match(m[0].texto, /imputável ao senhorio\/locador \(número 20 do artigo 72\.º do Código do IRS\)$/);
      assert.match(m[1].texto, /imputável ao inquilino\/locatário$/);
      assert.match(m[2].texto, /^Cessação do contrato de arrendamento no final dos prazos/);
      assert.deepEqual(m.map((x) => x.para), ['reducao', 'reducao', 'reducao', 'paa', 'paa', 'pma', 'pma', 'paa', 'pma', 'pmae', 'pmae', 'pmae']);
      assert.deepEqual(m.map((x) => x.quem), ['senhorio', 'inquilino', 'fim', 'senhorio', 'inquilino', 'senhorio', 'inquilino', 'fim', 'fim', 'senhorio', 'inquilino', 'fim']);
      m.forEach((x) => assert.ok(x.curto && x.curto.length < 80 && x.texto.length > x.curto.length, x.codigo + ' tem o texto da AT e o curto da app'));
    });

    test(a + ': cada escalão da duração diz o n.º do art. 72.º, e esse n.º tem regime no quadro 10', () => {
      const ver = v(a), ns = ver.quadro10.regimes.filter((x) => x.n).map((x) => x.n);
      for (const reg of ver.taxas.duracao) for (const e of reg.escaloes) assert.ok(ns.includes(e.n), reg.desde + ' ' + e.meses + ' meses: n ' + e.n);
      const novo = ver.taxas.duracao.find((r) => r.desde === '2023-10-07'), velho = ver.taxas.duracao.find((r) => r.desde === '2019-01-01');
      assert.deepEqual(novo.escaloes.map((e) => [e.meses, e.n]), [[240, 5], [120, 4], [60, 3]]);
      assert.deepEqual(velho.escaloes.map((e) => [e.meses, e.n]), [[240, 5], [120, 4], [60, 3], [24, 2]]);
    });
  }

  test('o passo do quadro 10 deixa de dizer que só vai lá o contrato que o senhorio acabou', () => {
    for (const a of ANOS) {
      const p = v(a).passos.find((x) => /quadros 9 e 10/.test(x.titulo)).texto;
      assert.doesNotMatch(p, /acabou antes do prazo por iniciativa do senhorio declara-se no quadro 10/);
      assert.match(p, /seja qual for o motivo/);
      assert.match(p, /juros compensatórios/);
    }
  });
});

describe('D18 — as isenções 6H (EBF 46.º-A) e 6F (EBF 74.º-A), com as condições', () => {
  for (const a of ANOS) {
    test(a + ': renda antiga anterior ao RAU (6H) e ex-alojamento local (6F)', () => {
      const is = v(a).isencoes, pr = is.find((x) => x.id === 'prerau'), al = is.find((x) => x.id === 'al');
      assert.ok(pr && al, 'as duas existem');
      assert.equal(pr.quadro, '6H'); assert.equal(pr.lei, 'EBF art. 46.º-A'); assert.equal(pr.pede, 'nrau3536');
      assert.equal(pr.semCodigo, true); assert.equal(pr.codigo, '');
      assert.deepEqual(pr.finalidade, ['hp', 'hnp']);
      assert.equal(al.quadro, '6F'); assert.equal(al.lei, 'EBF art. 74.º-A'); assert.equal(al.pede, 'alRegistado2022');
      assert.equal(al.celebradoAte, '2024-12-31'); assert.equal(al.ateAno, 2029); assert.deepEqual(al.finalidade, ['hp']);
      assert.equal(al.semCodigo, true);
      for (const x of is) {
        assert.ok(x.nome && x.curto && x.lei && x.texto.length > 40, x.id);
        assert.doesNotMatch(x.texto, /\d{4}-\d{2}-\d{2}/, x.id + ': datas por extenso no texto que se mostra');
        if (x.quadro === '6D') assert.ok(!x.semCodigo, x.id + ': no 6D há código');
      }
      const cod = Object.fromEntries(is.filter((x) => x.quadro === '6D').map((x) => [x.id, x.codigo]));
      assert.equal(cod.paa, '01'); assert.equal(cod.pma, '02'); assert.equal(cod.pmae, '03');
    });
  }
});

describe('D21/D51 — as naturezas 05 (indemnizações) e 02 (cedência de uso)', () => {
  for (const a of ANOS) {
    test(a + ': os códigos por papel e o texto de cada código da tabela', () => {
      const ver = v(a);
      assert.deepEqual(ver.naturezas, { habitacional: '07', naoHabitacional: '06', indemnizacao: '05', outras: '02', dhd: '01' }, 'o dhd é a prestação mensal do 4.3 (D120)');
      assert.deepEqual(Object.keys(ver.naturezasTexto), ['01', '02', '03', '04', '05', '06', '07']);
      assert.equal(ver.naturezasTexto['05'], 'Indemnizações que visem compensar perdas de rendimentos da categoria F');
      assert.equal(ver.naturezasTexto['02'], 'Cedência de uso do prédio ou de parte dele, que não arrendamento');
      assert.equal(ver.naturezasTexto['07'], 'Arrendamento habitacional');
    });
  }
});

describe('D52 — o quadro 5 (sublocação)', () => {
  for (const a of ANOS) {
    test(a + ': 02 habitacional, 01 não habitacional, e o quadro na lista', () => {
      const ver = v(a);
      assert.deepEqual(ver.quadro5.naturezas, { habitacional: '02', naoHabitacional: '01' });
      assert.equal(ver.quadro5.naturezasTexto['02'], 'Subarrendamento habitacional');
      assert.equal(ver.quadros.sublocacao, '5');
      assert.match(ver.passos.map((p) => p.texto).join(' '), /quadro 5, com a renda que recebes, a que pagas ao senhorio/);
    });
  }
});

describe('D46 — as condições do PAA e do RSAA', () => {
  test('2026: o PAA só nos celebrados até 31/08/2026; o RSAA desde 1/9 e só com o envio ao IHRU', () => {
    const is = v(2026).isencoes, paa = is.find((x) => x.id === 'paa'), rs = is.find((x) => x.id === 'rsaa');
    assert.equal(paa.celebradoAte, '2026-08-31');
    assert.ok(!paa.pedeIhru, 'o art. 15.º n.º 2 não aplica ao PAA o envio ao IHRU');
    assert.equal(rs.desde, '2026-09-01'); assert.equal(rs.pedeIhru, true); assert.equal(rs.prazoIhru, '01-15');
    assert.deepEqual(rs.finalidade, ['hp', 'hnp'], 'residência permanente ou temporária (anexo III, art. 3.º)');
  });

  test('2025: o PAA ainda existia, sem data-limite; o RSAA ainda não', () => {
    const is = v(2025).isencoes;
    assert.equal(is.find((x) => x.id === 'paa').celebradoAte, undefined);
    assert.ok(!is.some((x) => x.id === 'rsaa'));
  });
});

describe('D37 — o n.º 24 desde 7 de outubro de 2023 (Lei 56/2023), o n.º 23 desde 1 de janeiro de 2024', () => {
  for (const a of ANOS) {
    test(a + ': as duas datas', () => {
      const T = v(a).taxas;
      assert.equal(T.bonusRendaMenor.desde, '2023-10-07');
      assert.equal(T.limiteRendaAlta.desde, '2024-01-01');
    });
  }

  test('um contrato novo de novembro de 2023 com a renda 10 % abaixo tem os 5 pontos e o 4.2B', () => {
    const c = app.normContract({ rent: 900, start: '2023-11-15', end: '2028-11-14', fisco: { estado: 'declarado', finalidade: 'hp', rendaAnterior: 1000 } });
    const r = copia(app.irsReducao(c, 2025));
    assert.equal(r.bonus, true); assert.equal(r.taxa, 10);
  });
});

describe('D49/D105 — a data da última revisão de cada versão', () => {
  for (const a of ANOS) {
    test(a + ': revisto é um dia (AAAA-MM-DD), e nunca no futuro', () => {
      const r = v(a).revisto;
      assert.match(r, ISO);
      assert.ok(r <= '2026-11-17' && r >= '2026-01-01', r);
    });
  }
  test('2026 continua provisória (não há Anexo F aprovado para os rendimentos de 2026)', () => {
    assert.equal(v(2026).modelo.oficial, false);
    assert.equal(v(2025).modelo.oficial, true);
  });
});

describe('D111 — o IAS de cada ano, da portaria do IAS', () => {
  test('2025: 522,50 € (Portaria 6-B/2025/1); 2026: 537,13 € (Portaria 480-A/2025/1)', () => {
    assert.equal(v(2025).ias, 522.5);
    assert.equal(v(2026).ias, 537.13);
    assert.equal(Math.round(2 * v(2025).ias * 100) / 100, 1045, 'a dispensa dos recibos de 2026 mede as rendas de 2025 contra 1 045,00 €');
  });
});

describe('D78 — a Portaria 454/2026/1 no RSAA, nas novidades e no n.º 23', () => {
  test('o texto do RSAA e as novidades de 2026 já não dizem que a portaria dos limites não saiu', () => {
    const ver = v(2026), rs = ver.isencoes.find((x) => x.id === 'rsaa');
    assert.doesNotMatch(rs.texto, /ainda não saiu/);
    assert.match(rs.texto, /Portaria 454\/2026\/1/);
    assert.match(rs.texto, /até 13 de outubro de 2026, os valores da Portaria 176\/2019/, 'a transição do art. 7.º n.º 3');
    assert.match(rs.lei, /Portaria 454\/2026\/1/);
    ver.novidades.forEach((n) => assert.doesNotMatch(n, /ainda não saiu/));
    assert.ok(ver.novidades.some((n) => /Portaria 454\/2026\/1/.test(n)));
  });

  test('2026: a portaria do n.º 23 em cada dia — a 176/2019 até 31/8, a 454/2026/1 desde 1/9 com os valores da 176/2019 até 13/10', () => {
    const P = v(2026).taxas.limiteRendaAlta.portaria;
    assert.deepEqual(P.map((p) => [p.desde, p.ate]), [['2024-01-01', '2026-08-31'], ['2026-09-01', '2026-10-13'], ['2026-10-14', '']]);
    const d = (dia) => { const p = portariaEm(2026, dia); return [p.portaria, p.valoresDa]; };
    assert.deepEqual(d('2026-08-31'), ['Portaria 176/2019', 'Portaria 176/2019']);
    assert.deepEqual(d('2026-09-01'), ['Portaria 454/2026/1', 'Portaria 176/2019']);
    assert.deepEqual(d('2026-10-13'), ['Portaria 454/2026/1', 'Portaria 176/2019']);
    assert.deepEqual(d('2026-10-14'), ['Portaria 454/2026/1', 'Portaria 454/2026/1']);
    assert.deepEqual(d('2031-01-01'), ['Portaria 454/2026/1', 'Portaria 454/2026/1']);
    P.forEach((p) => { assert.ok(p.texto.length > 40); assert.doesNotMatch(p.texto, /\d{4}-\d{2}-\d{2}/); });
  });

  test('2025: só a Portaria 176/2019 (é a que as instruções do modelo de 2025 citam)', () => {
    assert.deepEqual(v(2025).taxas.limiteRendaAlta.portaria.map((p) => [p.desde, p.ate, p.portaria, p.valoresDa]), [['2024-01-01', '', 'Portaria 176/2019', 'Portaria 176/2019']]);
  });
});

describe('D90 — os nomes das colunas de gastos no impresso', () => {
  for (const a of ANOS) {
    test(a + ': os dois grupos, um nome por coluna, e as colunas das obras com ano e mês', () => {
      const ver = v(a), N = ver.colunasNomes;
      assert.equal(N.apos.titulo, 'Após início do arrendamento');
      assert.deepEqual(ver.colunas.map((k) => N.apos[k]), ['Conservação e manutenção', 'Condomínio', 'Imposto municipal sobre imóveis', 'Imposto do selo', 'Taxas autárquicas', 'Outros']);
      assert.equal(N.obras.titulo, 'Com obras de conservação e manutenção');
      assert.equal(N.obras.inicioContrato, 'Data de início do contrato de arrendamento (ano, mês)');
      assert.equal(N.obras.inicioGastos, 'Data de início dos gastos (ano, mês)');
      assert.equal(N.obras.valor, 'Valor');
    });
  }
});

describe('D106 — o quadro 4.4 (casa nova a mais de 100 km)', () => {
  for (const a of ANOS) {
    test(String(a), () => {
      const ver = v(a);
      assert.equal(ver.quadros.mudanca100km, '4.4');
      assert.match(ver.passos.map((p) => p.texto).join(' '), /mais de 100 km[\s\S]*quadro 4\.4/);
    });
  }
});

describe('D28/D30 — os passos: a condição das obras e A e B como posições no rosto', () => {
  for (const a of ANOS) {
    test(String(a), () => {
      const P = v(a).passos, gastos = P.find((p) => p.titulo === 'Os gastos, na mesma linha').texto, rosto = P.find((p) => p.titulo === 'O rosto da declaração').texto;
      assert.match(gastos, /só se, entretanto, o imóvel não teve outro uso/, 'CIRS art. 41.º n.º 7');
      assert.doesNotMatch(rosto, /A és tu, B o cônjuge/);
      assert.match(rosto, /A é o sujeito passivo A \(quadro 3 do rosto\) e B o sujeito passivo B \(quadro 5A\)/);
      assert.match(rosto, /Em conjunta entram as rendas dos dois/);
    });
  }
});

describe('o guião do ano novo não arrasta o que é de um ano só', () => {
  test('os passos das versões não escrevem anos (dizem {ano} e {ate})', () => {
    for (const a of ANOS) assert.deepEqual(anosNosPassos(ler('web/app/irs-' + a + '.js')), [], 'irs-' + a + '.js');
  });

  test('a cópia leva a revisão e o IAS em branco, e as datas da lei como estão', () => {
    const t = textoNovo(ler('web/app/irs-2026.js'), 2026, 2027);
    assert.match(t, /\brevisto:''/); assert.doesNotMatch(t, /\brevisto:'2026-11-17'/);
    assert.match(t, /\bias:null/); assert.doesNotMatch(t, /\bias:537\.13/);
    assert.match(t, /celebradoAte:'2026-08-31'/, 'o fim do PAA é da lei, não do ano');
    assert.match(t, /celebradoAte:'2024-12-31',ateAno:2029/);
    assert.match(t, /desde:'2026-09-01',pedeIhru:true,prazoIhru:'01-15'/);
    assert.match(t, /\{desde:'2026-10-14',ate:'',portaria:'Portaria 454\/2026\/1'/);
    assert.match(t, /bonusRendaMenor:\{desde:'2023-10-07'/);
    assert.match(t, /entrega:\{de:'2028-04-01',ate:'2028-06-30'\}/);
    assert.match(t, /comunicacaoDuracao:'2028-02-15'/);
  });

  test('uma versão com anos nos passos não se copia, e o fim de linha CRLF não engana o guião', () => {
    const base = ler('web/app/irs-2026.js').replace(/\r\n/g, '\n');
    const comAno = base.replace('o primeiro escalão do ano é de 12,5 %', 'o primeiro escalão de 2026 é 12,5 %');
    assert.notEqual(comAno, base);
    assert.throws(() => textoNovo(comAno, 2026, 2027), /os passos do irs-2026\.js escrevem anos \(2026\)/);
    const crlf = textoNovo(base.replace(/\n/g, '\r\n'), 2026, 2027);
    assert.match(crlf, /Ainda sem novidades confirmadas para 2027/);
    assert.match(crlf, /^\/\* =+ IRS 2027 =+/);
  });
});
