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
    assert.match(html, /Próximas/);
    assert.match(html, /Passadas/);
    assert.match(html, /Ana/);
    assert.match(html, /Interessado/, 'o desfecho aparece nas realizadas');
    assert.match(html, /class="fab"/, 'há FAB para marcar');
    assert.match(html, /fpanel/, 'os filtros vivem no painel comum da app');
    assert.match(html, /type="date"[\s\S]*type="time"/, 'intervalos de dia e de hora no painel');
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
