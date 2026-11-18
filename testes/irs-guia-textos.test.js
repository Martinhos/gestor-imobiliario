// Os textos públicos do IRS depois da auditoria (KAN-126, folha 2.1.6): o guia
// «Declarar as rendas» (worker/src/guia-vista.js), a montra
// (worker/src/landing.js) e a apresentação do separador IRS
// (web/cloud/apresentacao-analise.js).
//
// Cada defeito confirmado da auditoria que estes três ficheiros tinham fica
// aqui com pelo menos um assert, que falhava antes da correção:
//   D03 a caução (renda do ano em que se recebe; a devolução, gasto do ano em que se devolve)
//   D07 o «seguros» do guia e da montra passa a «seguro de renda»; a apresentação deixa de deduzir o seguro
//   D30 A e B são as posições no rosto, e a conjunta leva as rendas dos dois
//   D78 o n.º 23 desde a Portaria 454/2026/1, com a fonte e a data «Verificado a»
//   D79 as rendas isentas (6D, 6F, 6H) e os outros quadros (4.4, 5)
//   D80 o Modelo 44 só para quem está dispensado do recibo eletrónico
//   D81 a apresentação sem o titular no funil
//   D84 o prazo das declarações de substituição do 8B
//   D106 o quadro 4.4, com as condições
//   D107 o imposto da maquete da montra à taxa que a app dá nesse ano
//   D109 o limite das rendas moderadas como o DL 97/2026 o escreve, sem «no continente»
// e o aviso de responsabilidade (IRS_AVISO) no guia, à letra; e a decisão Q8:
// nenhuma ressalva junto da promessa do hero da montra.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { paginaGuia, IRS_AVISO_GUIA, GUIA_REVISTO, dataPorExtenso } from '../worker/src/guia-vista.js';
import { paginaLanding, IRS_DA_MAQUETE, anoIrsDaMontra, quadroDaMontra, rendasDaMaquete } from '../worker/src/landing.js';
import { carregarBase, carregarTudo, limpar, repor } from './arnes.js';

const guia = await paginaGuia({ raiz: true }).text();
const montra = await paginaLanding({ raiz: true }).text();
// Recebe: h — o HTML. Devolve: o texto visível, sem etiquetas e com os espaços (finos incluídos) normais.
const texto = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
// Recebe: id — o id de uma secção do guia. Devolve: o HTML dela (um cartão das partes 1 a 3 ou da 4).
const parte = (id) => new RegExp('<section class="bloco" id="' + id + '"[\\s\\S]*?\\n {2}</section>').exec(guia)[0];
// Recebe: h — o HTML; titulo — o subtítulo de um grupo. Devolve: o HTML do grupo (do h3/h4 ao fim do div).
const grupo = (h, titulo) => new RegExp('<div class="grupo">\\s*<h[34]>' + titulo + '</h[34]>[\\s\\S]*?\\n {4}</div>').exec(h)[0];
const fontes = /<ul class="fontes">([\s\S]*?)<\/ul>/.exec(guia)[1];

describe('o guia depois da auditoria ao IRS', () => {
  test('D03: a caução é renda do ano em que se recebe, e a devolução gasto do ano em que se devolve', () => {
    const g = texto(grupo(parte('como-preencher'), 'A caução'));
    assert.match(g, /a caução que recebes do inquilino é renda do ano em que a recebes/);
    assert.match(g, /Ofício-Circulado n\.º 20256, de 7 de junho de 2023, ponto 4/);
    assert.match(g, /passas recibo de renda eletrónico dela/);
    assert.match(g, /pode ser abatido como gasto no Anexo F do ano em que o devolves/);
    assert.match(fontes, /href="https:\/\/info\.portaldasfinancas\.gov\.pt\/[^"]*Oficio_Circulado_20256_2023\.pdf"/);
  });

  test('D07: o guia promete o seguro de renda, e não «seguros» em geral', () => {
    const desc = /<meta name="description" content="([^"]+)">/.exec(guia)[1];
    assert.doesNotMatch(desc, /\bseguros\b/);
    assert.match(desc, /seguro de renda/);
    assert.ok(desc.length <= 160, 'a descrição cabe nos 160: ' + desc.length);
  });

  test('D30: A e B são as posições no rosto, e a conjunta leva as rendas dos dois', () => {
    const t = texto(parte('como-preencher'));
    assert.doesNotMatch(t, /A ou B, como no rosto da declaração, ou/, 'a frase antiga saiu');
    assert.match(t, /A ou B, a posição de cada um no rosto da declaração \(o sujeito passivo A no quadro 3, o B no quadro 5A\)/);
    assert.match(t, /a declaração é uma só, com as rendas de todo o agregado, as tuas e as do teu cônjuge também/);
    assert.match(t, /artigo 59\.º, n\.º 2, alínea a\)/);
    assert.match(fontes, /cirs_rep\/Pages\/irs59\.aspx/);
  });

  test('D78: os limites do n.º 23 desde 1 de setembro de 2026 são os do RSAA, da Portaria 454/2026/1', () => {
    const t = texto(grupo(parte('tens-de-declarar'), 'Os contratos longos'));
    assert.doesNotMatch(t, /da Portaria n\.º 176\/2019 \(artigo 72\.º, n\.º 23\)/, 'já não só a Portaria 176/2019');
    assert.match(t, /Até 31 de agosto de 2026 esses limites eram os da Portaria n\.º 176\/2019/);
    assert.match(t, /Desde 1 de setembro de 2026 são os limites máximos de renda do Regime Simplificado de Arrendamento Acessível, que a Portaria n\.º 454\/2026\/1 fixou/);
    assert.match(t, /Decreto-Lei n\.º 97\/2026, artigo 14\.º, alínea b\)/);
    assert.match(fontes, /href="https:\/\/info\.portaldasfinancas\.gov\.pt\/[^"]*portaria-454-2026-1\.pdf"/);
    // a data «Verificado a» é a da verificação contra a portaria, depois de ela sair (13 de outubro de 2026)
    assert.ok(GUIA_REVISTO >= '2026-10-13', GUIA_REVISTO);
    assert.match(texto(guia), new RegExp('Verificado a ' + dataPorExtenso(GUIA_REVISTO)));
    assert.equal(dataPorExtenso('2026-11-17'), '17 de novembro de 2026');
    assert.equal(dataPorExtenso('2027-03-01'), '1 de março de 2027');
  });

  test('D79: as rendas isentas na parte 1, e os outros quadros (4.4, 5, 6D, 6F, 6H) na parte 3', () => {
    const isentas = texto(grupo(parte('tens-de-declarar'), 'Rendas isentas'));
    for (const f of ['Programa de Arrendamento Acessível (Decreto-Lei n.º 68/2019, artigo 20.º)',
      'artigo 71.º-A, n.os 3 a 6, do Estatuto dos Benefícios Fiscais', 'quadro 6D',
      'Regime Simplificado de Arrendamento Acessível, desde 1 de setembro de 2026', 'anexo III, artigos 4.º e 6.º',
      'até 31 de dezembro de 2022', 'até 31 de dezembro de 2024', 'até às rendas de 2029', 'quadro 6F',
      'artigo 74.º-A do Estatuto dos Benefícios Fiscais', 'artigos 35.º ou 36.º do Novo Regime do Arrendamento Urbano',
      'quadro 6H', 'artigo 46.º-A do Estatuto dos Benefícios Fiscais']) assert.ok(isentas.includes(f), 'falta: ' + f);
    // o 6H não é de todos os contratos antigos, só dos anteriores ao RAU nesse regime
    assert.doesNotMatch(isentas, /antes de 1990|anteriores a 1990/);
    assert.match(isentas, /Não são todos os contratos antigos/);
    // o RSAA ainda não tem código no 6D do modelo em vigor: o guia não o manda para lá
    assert.match(isentas, /ainda não tem código para ele no quadro 6D/);
    const outros = texto(grupo(parte('como-preencher'), 'Os outros quadros'));
    assert.doesNotMatch(outros, /há mais três quadros/);
    assert.match(outros, /Conforme o teu caso, há outros quadros a preencher/);
    for (const q of ['Quadro 4.4:', 'Quadro 5: a sublocação', 'Quadros 6D, 6F e 6H:', 'Quadro 8:', 'Quadro 9:', 'Quadro 10:']) {
      assert.ok(outros.includes(q), 'falta: ' + q);
    }
    for (const u of ['bf_rep/Pages/ebf71a.aspx', 'bf_rep/Pages/ebf74a.aspx', 'bf_rep/Pages/ebf46a.aspx', 'Documents/Decreto_Lei_68_2019.pdf']) {
      assert.ok(fontes.includes(u), 'a fonte ' + u);
    }
  });

  test('D80: o Modelo 44 é só de quem está dispensado do recibo eletrónico, com a Portaria 98-A/2015', () => {
    const t = texto(grupo(parte('como-preencher'), 'O que mudou em 2025'));
    assert.doesNotMatch(t, /se não passas recibo de cada renda, entregas a declaração anual/, 'a frase que fazia do Modelo 44 uma escolha saiu');
    for (const f of ['a declaração anual das rendas (Modelo 44)', 'o recibo de renda eletrónico de cada renda é obrigatório',
      'só de quem está dispensado dele', 'caixa postal eletrónica', 'duas vezes o IAS', '65 anos ou mais',
      'Portaria n.º 98-A/2015, artigos 5.º e 8.º', 'até ao fim de fevereiro do ano seguinte']) assert.ok(t.includes(f), 'falta: ' + f);
    assert.match(fontes, /Portaria_98_A-2015\.pdf/);
  });

  test('D84: o 8B diz até quando se entregam as declarações de substituição', () => {
    const q8 = texto(grupo(parte('como-preencher'), 'Os outros quadros')).split('Quadro 8:')[1].split('Quadro 9:')[0];
    assert.match(q8, /até 30 dias depois do fim do prazo dela, ou seja, até 30 de julho do ano em que a entregas/);
    assert.match(q8, /artigo 74\.º, n\.os 7 e 8; artigo 60\.º, n\.º 2/);
  });

  test('D106: o quadro 4.4, com as condições, na parte 3 e ao pé da mudança de habitação', () => {
    const q44 = texto(grupo(parte('como-preencher'), 'Os outros quadros')).split('Quadro 4.4:')[1].split('Quadro 5:')[0];
    for (const f of ['a mais de 100 km', 'durante pelo menos 12 meses', 'os dois contratos estão registados no Portal das Finanças',
      'artigo 41.º, n.º 8']) assert.ok(q44.includes(f), 'falta: ' + f);
    const mudanca = texto(grupo(parte('pode-deduzir'), 'Situação especial: mudança da habitação própria'));
    assert.match(mudanca, /declara-las no quadro 4\.4 do Anexo F/);
  });

  test('D109: o limite das rendas moderadas como o DL 97/2026 o escreve, sem «no continente»', () => {
    const t = texto(guia);
    assert.doesNotMatch(t, /no continente/);
    assert.match(t, /2,5 vezes o valor da retribuição mínima mensal prevista para 2026/);
    assert.match(t, /Decreto-Lei n\.º 97\/2026, artigo 2\.º, n\.º 2, alínea a\)/);
  });

  test('o aviso da Declaração (IRS_AVISO) está no guia, à letra, igual ao da app', () => {
    const app = carregarBase();
    assert.equal(IRS_AVISO_GUIA, app.IRS_AVISO, 'o texto do guia é o do irs.js');
    const nota = /<aside class="seguranca"[\s\S]*?<\/aside>/.exec(guia)[0];
    assert.ok(nota.includes('<p class="aviso-app">' + IRS_AVISO_GUIA + '</p>'), 'na nota do fim, à letra');
    // o passo «avisos» do verificar.mjs conta a frase no ficheiro
    assert.ok((fs.readFileSync(new URL('../worker/src/guia-vista.js', import.meta.url), 'utf8').match(/quem declara és tu/gi) || []).length >= 1);
  });
});

describe('a montra depois da auditoria ao IRS', () => {
  test('D107: o imposto da maquete é o que a app dá a estas rendas, no ano que o ecrã escreve', () => {
    const app = carregarBase();
    // uma taxa por cada ano com regras na app, e nenhuma a mais: um ano novo no irs-AAAA.js obriga a pô-lo aqui
    assert.deepEqual(Object.keys(IRS_DA_MAQUETE).map(Number), [...app.irsAnosConhecidos()]);
    for (const [ano, taxa] of Object.entries(IRS_DA_MAQUETE)) {
      for (const renda of rendasDaMaquete()) {
        const c = { rent: renda, start: (Number(ano) - 1) + '-09-01', end: '', active: true };
        assert.equal(app.irsRate(c, Number(ano)), taxa * 100, ano + ', renda de ' + renda + ' €');
      }
    }
    assert.equal(IRS_DA_MAQUETE[2026], 0.10, 'em 2026 as rendas moderadas pagam 10 % (EBF 45.º-C)');
    // o ano do ecrã: o do pedido, ou o último antes dele com regras, ou o primeiro de todos
    assert.equal(anoIrsDaMontra(new Date(Date.UTC(2026, 10, 17))), 2026);
    assert.equal(anoIrsDaMontra(new Date(Date.UTC(2027, 2, 1))), 2026, 'em 2027 declaram-se as rendas de 2026');
    assert.equal(anoIrsDaMontra(new Date(Date.UTC(2025, 5, 1))), 2025);
    assert.equal(anoIrsDaMontra(new Date(Date.UTC(2024, 5, 1))), 2025);
    for (const l of quadroDaMontra(2026)) assert.equal(l.imposto, Math.round((l.rendas - l.gastos) * 10) / 100, l.nome);
    // na página de hoje: o ano escrito é o do quadro, e as linhas sem gastos pagam a taxa desse ano sobre as rendas
    const ano = anoIrsDaMontra(new Date());
    const ecra = /<section[^>]*id="irs"[\s\S]*?<\/section>/.exec(montra)[0];
    assert.match(ecra, new RegExp('2 pontos de ' + ano + '<'));
    const euros = (t) => Number(t.replace(/\s/g, '').replace('€', '').replace(',', '.'));
    const linhas = [...ecra.matchAll(/<span class="m-q-linha"><span>([^<]+)<\/span><span>([^<]+)<\/span><b>([^<]+)<\/b><\/span>/g)]
      .map((m) => ({ nome: m[1], rendas: euros(m[2]), imposto: euros(m[3]) }));
    const esperado = quadroDaMontra(ano);
    assert.deepEqual(linhas.map((l) => l.imposto), esperado.map((l) => l.imposto));
    for (const nome of ['T0 Campanhã', 'T1 Cedofeita']) {
      const l = linhas.find((x) => x.nome === nome);
      assert.equal(l.imposto, Math.round(l.rendas * IRS_DA_MAQUETE[ano] * 100) / 100, nome + ': sem gastos, o imposto é a taxa do ano');
    }
  });

  test('D07: o cartão do guia promete o seguro de renda, e não «seguros» em geral', () => {
    const cartao = /<section class="wrap guia-seccao" id="guia"[\s\S]*?<\/section>/.exec(montra)[0];
    assert.doesNotMatch(cartao, /\bseguros\b/);
    assert.match(cartao, /o seguro de renda/);
  });

  test('D81: o ecrã do IRS não promete um titular a escolher', () => {
    const ecra = /<section[^>]*id="irs"[\s\S]*?<\/section>/.exec(montra)[0];
    assert.doesNotMatch(ecra, /Por titular/);
    assert.match(ecra, /A tua declaração, pela tua quota-parte de cada imóvel\./);
  });

  test('Q8: nenhuma ressalva junto da promessa do hero (decisão do Martinho, 2026-11-17)', () => {
    const hero = /<section class="wrap hero" id="inicio">[\s\S]*?<\/section>/.exec(montra)[0];
    assert.match(hero, /IRS preparado/);
    assert.doesNotMatch(hero, /quem declara|resume/i);
  });
});

describe('a apresentação do IRS depois da auditoria', () => {
  const app = carregarTudo();
  afterEach(() => repor(app));
  // Devolve: nada — uma conta com sessão, fora de produção, como a do apresentacao-analise.test.js.
  const montar = () => {
    limpar(app);
    app.CW.user = { id: 'EU', name: 'Maria Costa', email: 'eu@exemplo.pt' };
    app.CW._pulled = 1; app.CW._esperaFim = 1; app.CW.cargos = {}; app.CW.ambiente = 'percurso';
  };

  test('D81: a quarta imagem sem o titular no funil, e a maquete só com o ano', () => {
    montar();
    const img = app.APRESENTACOES.fisco.imagens[3];
    assert.doesNotMatch(img.texto, /escolhe-o no <b>funil<\/b>|por titular|quota-parte dele/i);
    assert.match(img.texto, /A declaração é a tua: as rendas e os gastos entram pela tua quota-parte de cada imóvel\./);
    const html = img.maquete();
    assert.doesNotMatch(html, new RegExp(app.APR_EXEMPLO.proprietarios[0].nome), 'nenhum proprietário no funil');
    assert.equal((html.match(/apr-a-sel/g) || []).length, 1, 'um só seletor, o do ano');
    assert.match(html, new RegExp('<span>' + app.aprAFiscoAno() + '</span>'));
    assert.match(html, /A declaração é a tua: rendas, retenções e gastos entram pela tua quota-parte de cada imóvel\./);
  });

  test('D07: o seguro do exemplo já não se deduz no resumo do IRS', () => {
    montar();
    const f = app.aprAFisco(app.aprAFiscoAno());
    assert.equal(f.gastos, Math.round((1350 + 1980 + 469.2) * 100) / 100, 'o condomínio, a manutenção e o IMI, sem o seguro');
    const textos = app.APRESENTACOES.fisco.imagens.map((x) => x.texto).join(' ');
    assert.doesNotMatch(textos, /seguro/i);
  });
});
