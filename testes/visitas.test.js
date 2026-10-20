// Visitas e calendário: quem vem ver as casas antes de haver contrato, e o
// mês com visitas e planeados dia a dia. O que se prova: o modelo tem as
// omissões certas, as listas e a grelha renderizam o que devem, a expansão
// dos planeados respeita o passo de cada um, e a conversão em inquilino
// leva o contacto para o campo certo.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, repor } from './arnes.js';

const app = carregarApp();
afterEach(() => repor(app));

function monta() {
  app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa', rentalMode: 'quartos',
    rooms: [{ id: 'Q1', name: 'Quarto 1' }] })];
  app.db.tenants = [];
  app.db.visits = [];
  app.db.recurring = [];
}

describe('o modelo', () => {
  test('normVisit preenche as omissões e aceita o que vier', () => {
    const v = app.normVisit({ nomes: 'Ana e Bruno', propertyId: 'P1', date: '2026-09-10' });
    assert.equal(v.estado, 'agendada');
    assert.equal(v.resultado, '');
    assert.equal(v.roomId, '');
    assert.ok(v.id, 'id atribuído');
    assert.equal(app.normVisit(null).nomes, '');
  });
});

describe('a página das visitas', () => {
  test('vazia convida a marcar; com visitas separa próximas de passadas', () => {
    monta();
    assert.match(app.vVisits(), /Ainda não há visitas/);
    app.db.visits = [
      app.normVisit({ nomes: 'Ana', propertyId: 'P1', date: '2999-01-01' }),
      app.normVisit({ nomes: 'Bruno', propertyId: 'P1', date: '2001-01-01', estado: 'realizada', resultado: 'interessado' }),
    ];
    const html = app.vVisits();
    assert.match(html, /<div class="vis-grupo-cab"><h2>Próximas<\/h2><span class="small num">1<\/span><\/div>/, 'cada grupo diz quantas são');
    assert.match(html, /<div class="vis-grupo-cab"><h2>Passadas<\/h2><span class="small num">1<\/span><\/div>/);
    assert.match(html, /Ana/);
    assert.match(html, /<span class="badge in">Interessado<\/span>/, 'o desfecho aparece nas realizadas, a verde');
    assert.doesNotMatch(html, /class="fab"/, 'sem FAB: o «Marcar visita» está no cabeçalho e no + da barra');
    assert.doesNotMatch(html, /lpMenu\(/, 'nem ⋮: as opções estão na ficha e no toque longo');
    assert.match(html, /fpanel/, 'os filtros vivem no painel comum da app');
    assert.match(html, /type="date"[\s\S]*type="time"/, 'intervalos de dia e de hora no painel');
    assert.match(vazioDeVisitas(), /data-click="visitModal\(\)">Marcar visita<\/button>/, 'o vazio continua a ter o seu botão');
  });

  test('as linhas: o bloco da data, a hora e o imóvel, e os selos com as cores da Agenda — à direita nas que vêm, por baixo nas passadas', () => {
    monta();
    const hoje = app.pzHoje(), dia = (n) => app.pzAddDias(hoje, n);
    app.db.visits = [
      app.normVisit({ id: 'V1', nomes: 'Carlos Pinto', propertyId: 'P1', roomId: 'Q1', date: hoje, start: '11:00', end: '11:30' }),
      app.normVisit({ id: 'V2', nomes: 'Daniel Sousa', propertyId: 'P1', date: dia(5), start: '10:00' }),
      app.normVisit({ id: 'V3', nomes: 'Joana Reis', propertyId: 'P1', date: dia(-2), start: '18:00', estado: 'realizada', resultado: 'interessado' }),
      app.normVisit({ id: 'V4', nomes: 'Bruno Matos', propertyId: 'P1', date: dia(-30), estado: 'faltou' }),
      app.normVisit({ id: 'V5', nomes: 'Rita', propertyId: 'P1', date: dia(-40), estado: 'cancelada' }),
    ];
    const html = app.vVisits();
    const linha = (id) => html.split('data-lp="vis:').find((x) => x.startsWith(id + '"')) || '';
    assert.match(linha('V1'), /<span class="vis-data num hoje"><b>\d+<\/b><span>hoje<\/span><\/span>/, 'hoje a cheio');
    assert.match(linha('V1'), /11:00 – 11:30 · T2 Lisboa · Quarto 1/);
    assert.match(linha('V1'), /<span class="vis-selos vis-selos-dir"><span class="badge">Agendada<\/span><\/span>/, 'agendada a cobalto, à direita');
    assert.match(linha('V2'), /10:00 · T2 Lisboa · daqui a 5 dias/, 'a semana diz quanto falta');
    assert.ok(linha('V2').includes('<span>' + app.MES[Number(dia(5).slice(5, 7)) - 1] + '</span>'), 'mais longe, o mês');
    assert.match(linha('V3'), /18:00 · T2 Lisboa · há 2 dias/);
    assert.match(linha('V3'), /<span class="vis-selos"><span class="badge in">Realizada<\/span><span class="badge in">Interessado<\/span><\/span>/, 'por baixo, o estado e o desfecho');
    assert.match(linha('V4'), /<span class="badge amber">Faltou<\/span>/, 'faltou a âmbar, como na Agenda');
    assert.doesNotMatch(linha('V4'), /há 30 dias/, 'longe de mais para o «há N dias»');
    assert.match(linha('V5'), /<span class="badge grey">Cancelada<\/span>/);
    assert.match(html, /<div class="list vis-lista" data-listaviva="visitas:Próximas">/);
    // a Visão geral de quem colabora chama-a pelo map: o índice que chega a mais não muda nada
    assert.equal(app.visCard(app.db.visits[0], 3, app.db.visits), app.visCard(app.db.visits[0]));
  });

  test('os chips dos filtros: escolhidos dizem o valor e têm o ×; os dias e horas levam ao painel', () => {
    monta();
    app.db.visits = [app.normVisit({ id: 'V1', nomes: 'Ana', propertyId: 'P1', date: '2999-01-01' })];
    let html = app.vVisits();
    assert.match(html, /<div class="chips-fila mov-chips" role="group" aria-label="Filtros das visitas">/, 'a fila dos Movimentos (vistas.js:lfCabeca)');
    for (const [k, nome] of [['pr', 'Imóvel'], ['es', 'Estado'], ['rs', 'Desfecho']]) {
      assert.match(html, new RegExp('<span class="mov-chip"><div class="sel" id="sel_lfc_lvis_' + k + '">[\\s\\S]*?aria-label="' + nome + '"[\\s\\S]*?<span id="lab_lfc_lvis_' + k + '">' + nome + '</span>'), nome);
    }
    assert.match(html, /<span class="mov-chip mov-so-largo lfm-chip-abre"><button type="button" class="mov-chip-txt" data-toca="vista" data-click="lfAbrirEm\('lvis','lfi_lvis_d1'\)">Dias e horas<\/button><\/span>/, 'desligado, só no ecrã largo, e leva ao primeiro dia');
    app.lf('lvis').pr = 'P1';
    app.lf('lvis').d1 = '2026-10-15';
    app.lf('lvis').h1 = '18:00';
    html = app.vVisits();
    assert.match(html, /<span class="mov-chip on"><div class="sel" id="sel_lfc_lvis_pr">[\s\S]*?aria-label="Imóvel: T2 Lisboa"[\s\S]*?<span id="lab_lfc_lvis_pr">T2 Lisboa<\/span>/);
    assert.match(html, /aria-label="Limpar imóvel" data-toca="vista" data-click="lfLimparCampo\('lvis','pr'\)"/);
    const dias = 'desde ' + (app.pzHoje().slice(0, 4) === '2026' ? '15/10' : '15/10/2026') + ' · desde 18:00';
    assert.ok(html.includes('aria-label="Dias e horas: ' + dias + '. Mudar nos filtros"'), 'o chip diz o intervalo');
    assert.match(html, /aria-label="Limpar dias e horas" data-toca="vista" data-click="visLimparChip\('lvis','dias'\)"/);
    assert.equal(app.lfNFiltros('lvis'), 3, 'o imóvel, o dia e a hora: o «de» e o «até» contam como um');
    app.lf('lvis').d2 = '2026-10-20';
    app.vVisits();
    assert.equal(app.lfNFiltros('lvis'), 3, 'o «até» do mesmo intervalo não soma');
    let pintou = 0;
    app.render = () => { pintou++; };
    app.visLimparChip('lvis', 'dias');
    assert.deepEqual([app.lf('lvis').d1, app.lf('lvis').d2, app.lf('lvis').h1, app.lf('lvis').pr], ['', '', '', 'P1'], 'limpa os quatro limites, e só eles');
    app.visLimparChip('lvis', 'pr');
    assert.equal(app.lf('lvis').pr, '');
    assert.equal(pintou, 2);
    // um nome com «$&» não vira outra coisa na troca do rótulo
    app.db.properties[0].name = 'Casa $& Cia';
    app.lf('lvis').pr = 'P1';
    try { assert.match(app.vVisits(), /<span id="lab_lfc_lvis_pr">Casa \$&amp; Cia<\/span>/); } finally { app.lf('lvis').pr = ''; }
  });

  test('os intervalos do painel: cada campo de dia e de hora diz o nome inteiro, lado a lado na grelha', () => {
    monta();
    app.db.visits = [app.normVisit({ id: 'V1', nomes: 'Ana', propertyId: 'P1', date: '2999-01-01' })];
    const html = app.vVisits();
    const campos = [...html.matchAll(/<label>([^<]*)<input id="lfi_lvis_(\w+)" type="(date|time)"[^>]*data-change="lfMudar\('lvis','\2',this\.value\)">/g)].map((m) => [m[3], m[1], m[2]]);
    assert.deepEqual(campos, [['date', 'Dia — de', 'd1'], ['date', 'Dia — até', 'd2'], ['time', 'Hora de início — de', 'h1'], ['time', 'Hora de início — até', 'h2']]);
    const grelha = html.slice(html.indexOf('<div class="mov-grelha">'));
    const ordem = ['lfsel_lvis_pr', 'lfsel_lvis_es', 'lfi_lvis_d1', 'lfi_lvis_d2', 'lfi_lvis_h1', 'lfi_lvis_h2', 'lfsel_lvis_rs'].map((id) => grelha.indexOf('id="' + id + '"'));
    assert.ok(ordem.every((i, n) => i > 0 && (!n || i > ordem[n - 1])), 'o imóvel e o estado, os dias, as horas, o desfecho: ' + ordem.join(','));
  });
});

/* O vazio da página das visitas, com um imóvel onde se pode marcar.
   Devolve: o HTML da vista sem visitas nenhumas. */
function vazioDeVisitas() {
  const guardadas = app.db.visits;
  app.db.visits = [];
  try { return app.vVisits(); } finally { app.db.visits = guardadas; }
}

describe('a ficha da visita', () => {
  test('lê-se primeiro: quando por extenso, os selos, o imóvel, o contacto que liga, os comentários e as outras visitas ao imóvel', () => {
    monta();
    const hoje = app.pzHoje(), dia = (n) => app.pzAddDias(hoje, n);
    app.db.visits = [
      app.normVisit({ id: 'V1', nomes: 'Joana Reis', propertyId: 'P1', roomId: 'Q1', date: dia(-2), start: '18:00', end: '18:30', estado: 'realizada', resultado: 'pensar', contacto: '926 410 775', notas: 'Gostou da luz.\nTem um gato.' }),
      app.normVisit({ id: 'V2', nomes: 'Carlos Pinto', propertyId: 'P1', date: hoje, start: '11:00' }),
      app.normVisit({ id: 'V3', nomes: 'Daniel Sousa', propertyId: 'P1', date: dia(7), start: '10:00' }),
      app.normVisit({ id: 'V4', nomes: 'Já foi', propertyId: 'P1', date: dia(-5) }),
      app.normVisit({ id: 'V5', nomes: 'Desistiu', propertyId: 'P1', date: dia(3), estado: 'cancelada' }),
    ];
    const f = app.visFicha('V1');
    assert.match(f, /<p class="vis-quando num">[A-ZÀ-Ú][a-zà-ú]+, \d\d\/\d\d\/\d{4} · 18:00 – 18:30 · há 2 dias<\/p>/, 'o dia da semana, a data, as horas e quanto foi');
    assert.match(f, /<div class="vis-selos"><span class="badge in">Realizada<\/span><span class="badge">A pensar<\/span><\/div>/);
    assert.match(f, /<div class="vis-kv"><span>Imóvel<\/span><span>T2 Lisboa<\/span><\/div>/);
    assert.match(f, /<div class="vis-kv"><span>Quarto<\/span><span>Quarto 1<\/span><\/div>/);
    assert.match(f, /<a class="vis-kv pes-liga" href="tel:926410775" data-toca="nada"><span>Contacto<\/span><span>926 410 775<\/span><\/a>/, 'o contacto liga');
    assert.match(f, /<p class="lbl">Comentários<\/p><p class="vis-texto">Gostou da luz\.<br>Tem um gato\.<\/p>/);
    assert.match(f, /<p class="lbl">Outras visitas a este imóvel<\/p>\s*<p class="small num">Hoje às 11:00 · Carlos Pinto<br>[\d/]+ às 10:00 · Daniel Sousa<\/p>/, 'só as que vêm, e não as canceladas');
    assert.doesNotMatch(f, /Converter em inquilino/, 'a pensar ainda não convida a converter');
    assert.doesNotMatch(f, /<input|<textarea|<select/, 'uma ficha lê-se, não se edita');
    // um email escreve
    app.db.visits[0].contacto = 'joana@exemplo.pt';
    assert.match(app.visFicha('V1'), /href="mailto:joana@exemplo\.pt"/);
  });

  test('numa realizada com interesse convida a converter em inquilino, só com os Inquilinos e a permissão', () => {
    monta();
    app.db.visits = [app.normVisit({ id: 'V1', nomes: 'Joana Reis', propertyId: 'P1', date: '2001-01-01', estado: 'realizada', resultado: 'interessado' })];
    const f = app.visFicha('V1');
    assert.match(f, /<section class="vis-converte"><p class="vis-converte-tit">Há interesse em arrendar\.<\/p>/);
    assert.match(f, /data-toca="camada" data-click="visConverte\('V1'\)">[\s\S]*? Converter em inquilino<\/button>/);
    app.definirServicosDesligados(['tenants']);
    try { assert.doesNotMatch(app.visFicha('V1'), /vis-converte/); } finally { app.definirServicosDesligados([]); }
    const pode = app.pode;
    app.pode = (pid, perm) => perm !== 'tenant.add';
    try { assert.doesNotMatch(app.visFicha('V1'), /vis-converte/); } finally { app.pode = pode; }
  });
});

describe('o calendário', () => {
  test('expande os planeados pelo passo de cada um, e o once só uma vez', () => {
    monta();
    app.db.recurring = [
      { id: 'R1', name: 'Renda', next: '2026-09-08', every: 'month', muted: false, tx: { kind: 'income', amount: 800, propertyId: 'P1' } },
      { id: 'R2', name: 'Obra', next: '2026-09-10', every: 'once', muted: false, tx: { kind: 'expense', amount: 150, propertyId: 'P1' } },
      { id: 'R3', name: 'Silenciada', next: '2026-09-12', every: 'month', muted: true, tx: { kind: 'expense', amount: 1 } },
    ];
    const out = app.calPlaneados('2026-09-01', '2026-11-30');
    const rendas = out.filter((o) => o.rec.id === 'R1').map((o) => o.date);
    assert.deepEqual(Array.from(rendas), ['2026-09-08', '2026-10-08', '2026-11-08'], 'mensal, três meses');
    assert.equal(out.filter((o) => o.rec.id === 'R2').length, 1, 'once não repete');
    assert.equal(out.filter((o) => o.rec.id === 'R3').length, 0, 'silenciados fora');
  });

  test('o «Até» do planeado (end) fecha a série: de 19 de outubro até 19 de fevereiro, março já não tem nada', () => {
    monta();
    app.db.recurring = [
      { id: 'R1', name: 'Seguro', next: '2026-10-19', until: '', end: '2027-02-19', every: 'month', muted: false, tx: { kind: 'expense', amount: 30, propertyId: 'P1' } },
    ];
    const datas = app.calPlaneados('2026-10-01', '2027-06-30').map((o) => o.date);
    assert.deepEqual(Array.from(datas), ['2026-10-19', '2026-11-19', '2026-12-19', '2027-01-19', '2027-02-19'], 'a última é a do dia do fim');
    assert.equal(app.calPlaneados('2027-03-01', '2027-03-31').length, 0, 'março vazio');
  });

  test('a grelha do mês marca visitas e planeados com pontos', () => {
    monta();
    app.calMes = '2026-09';
    app.db.visits = [app.normVisit({ nomes: 'Ana', propertyId: 'P1', date: '2026-09-10' })];
    app.db.recurring = [{ id: 'R1', name: 'Renda', next: '2026-09-08', every: 'month', muted: false, tx: { kind: 'income', amount: 800 } }];
    const html = app.vCalendar();
    assert.ok((html.match(/pt vis/g) || []).length >= 2, 'ponto de visita (célula + legenda)');
    assert.ok((html.match(/pt pla/g) || []).length >= 2, 'ponto de planeado');
    assert.match(html, /setembro de 2026/i);
    assert.match(html, /id="calDiaPanel"/, 'o painel do dia vive na própria vista');
    assert.doesNotMatch(html, /calDia\(/, 'já não há modal do dia');
    app.calMes = '';
  });

  test('o dia em foco: o escolhido no mês em vista, senão hoje, senão o dia 1', () => {
    monta();
    const hoje = app.pzHoje();
    app.calMes = ''; app.calDiaSel = '';
    assert.equal(app.calSelDia(), hoje, 'no mês de hoje o foco é hoje');
    app.calMes = '2031-03';
    assert.equal(app.calSelDia(), '2031-03-01', 'noutro mês cai no dia 1');
    app.calDiaSel = '2031-03-14';
    assert.equal(app.calSelDia(), '2031-03-14', 'o escolhido manda se for deste mês');
    app.calDiaSel = '2030-01-05';
    assert.equal(app.calSelDia(), '2031-03-01', 'um escolhido de outro mês não conta');
    app.calMes = ''; app.calDiaSel = '';
  });

  test('o painel do dia lista as visitas e os planeados dele, ou convida a marcar', () => {
    monta();
    app.db.visits = [app.normVisit({ id: 'V1', nomes: 'Ana', propertyId: 'P1', date: '2026-09-10', start: '15:00' })];
    app.db.recurring = [{ id: 'R1', name: 'Renda', next: '2026-09-10', every: 'month', muted: false, tx: { kind: 'income', amount: 800, propertyId: 'P1' } }];
    const cheio = app.calDiaPanel('2026-09-10');
    assert.match(cheio, /Visitas/); assert.match(cheio, /Ana/); assert.match(cheio, /15:00/);
    assert.match(cheio, /Planeados/); assert.match(cheio, /Renda/);
    assert.match(cheio, /visView\('V1'\)/, 'a visita abre a ficha');
    assert.match(cheio, /go\('recurring'\)/, 'o planeado leva aos Planeados');
    const vazio = app.calDiaPanel('2026-09-11');
    assert.match(vazio, /Nada marcado/);
    // uma ação declarada não leva objetos: o {date:…} vive no calMarcarVisita(iso)
    assert.match(vazio, /calMarcarVisita\('2026-09-11'\)/, 'marcar visita já com a data');
    // a célula do dia em foco leva a classe .on e o aria-pressed
    app.calMes = '2026-09'; app.calDiaSel = '2026-09-10';
    const html = app.vCalendar();
    assert.match(html, /calday tap[^"]*on" data-d="2026-09-10"[^>]*aria-pressed="true"/);
    app.calMes = ''; app.calDiaSel = '';
  });

  test('o painel do dia adiciona um movimento recorrente com a primeira ocorrência nesse dia', () => {
    monta();
    const painel = app.calDiaPanel('2026-09-11');
    assert.match(painel, /calNovoPlaneado\('2026-09-11'\)/, 'o botão leva o dia');
    assert.match(painel, /Adicionar movimento recorrente/);
    // escolhido o tipo, o formulário abre em modo planeado com a data do dia (o «next»)
    let aberto = null;
    const { newTxPick, txModal } = app;
    app.newTxPick = (depois) => depois('expense');
    app.txModal = (o) => { aberto = o; };
    try { app.calNovoPlaneado('2026-09-11'); } finally { app.newTxPick = newTxPick; app.txModal = txModal; }
    assert.equal(aberto.modo, 'rec');
    assert.equal(aberto.kind, 'expense');
    assert.equal(aberto.preset.date, '2026-09-11');
  });

  test('a grelha dos dias arrasta-se, e o mês vizinho sai pelos mesmos dias', () => {
    monta();
    app.calMes = '2026-09';
    assert.match(app.vCalendar(), /id="calDias" data-pointerdown="calArrastar\(event,this\)"/);
    // outubro de 2026 começa a uma quinta: três células em branco antes do dia 1
    const out = app.calCelulas('2026-10-01', '').html;
    assert.equal((out.match(/calday fora/g) || []).length, 3);
    assert.equal((out.match(/data-d="2026-10-/g) || []).length, 31);
    assert.doesNotMatch(out, / on"/, 'um vizinho não tem dia em foco');
    app.calMes = '';
  });
});

describe('converter em inquilino', () => {
  test('o contacto vai para telefone ou email conforme o formato', () => {
    monta();
    app.db.visits = [
      app.normVisit({ id: 'V1', nomes: 'Ana', propertyId: 'P1', date: '2026-09-01', contacto: 'ana@x.pt', notas: 'gostou' }),
      app.normVisit({ id: 'V2', nomes: 'Bruno', propertyId: 'P1', date: '2026-09-02', contacto: '912 000 000' }),
    ];
    app.personModal = () => {};   // o modal a sério não corre no arnês
    app.visConverte('V1');
    app.visConverte('V2');
    const [ana, bruno] = app.db.tenants;
    assert.equal(ana.email, 'ana@x.pt');
    assert.equal(ana.phone, '');
    assert.match(ana.notes, /gostou/, 'as notas da visita seguem na ficha');
    assert.equal(bruno.phone, '912 000 000');
    assert.equal(bruno.email, '');
  });
});
