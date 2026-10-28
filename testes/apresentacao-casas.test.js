// As apresentações das Casas (cloud/apresentacao-casas.js): os Imóveis, os
// Grupos, os Contratos, os Inquilinos, os Proprietários, os Colaboradores e
// as Visitas estão registadas com o nome do separador e 2 a 4 imagens para
// cada conta; cada maquete escreve HTML sem style= nem on…=, em todas as
// variantes (quem é dono, quem só colabora, o computador, sem imóveis, com
// serviços desligados); os textos seguem a casa e ensinam os caminhos com os
// rótulos reais da navegação; o segurar só se ensina onde há seleção; e o
// portefólio das Casas fecha com o APR_EXEMPLO. A app inteira, nuvem
// incluída (carregarTudo), com a sessão simulada em CW.user.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarTudo, limpar, repor, igual } from './arnes.js';

const app = carregarTudo();
afterEach(() => repor(app));
afterEach(() => { app.definirServicosDesligados([]); });

const CASAS = ['properties', 'groups', 'contracts', 'tenants', 'owners', 'colaboradores', 'visits'];

/* A app limpa, com sessão e o primeiro estado, sem cargos (a conta é dona
   de tudo o que tiver) e no telemóvel (o matchMedia do arnês diz que não).
   Recebe: opcoes (opcional) — {imoveis: quantos imóveis meus pôr na base}.
   Devolve: nada. */
function montar(opcoes = {}) {
  limpar(app);
  app.CW.user = { id: 'K7Q2MPXA', name: 'Maria Costa', email: 'eu@exemplo.pt' };
  app.CW._pulled = 1;
  app.CW.cargos = {};
  for (let k = 0; k < (opcoes.imoveis || 0); k++) app.db.properties.push(app.normProp({ id: 'M' + k, name: 'Casa ' + k }));
}

/* Quem só colabora: um imóvel de outra pessoa, com um cargo.
   Recebe: perms — as permissões do cargo.
   Devolve: nada. */
function soColaborador(perms) {
  montar();
  app.db.properties.push(app.normProp({ id: 'P1', name: 'T1 Foz', ownerIds: ['OUTRO'], _sharedFrom: 'Duarte Pinto', _cargo: 'Gestor de visitas' }));
  app.CW.cargos = { P1: { dono: false, perms, nome: 'Gestor de visitas' } };
  assert.ok(app.souSoColaborador());
}

/* Faz de conta que o ecrã é o do computador (a partir dos 901 px).
   Devolve: nada. */
function noComputador() {
  app.matchMedia = (q) => ({ matches: /min-width:\s*901px/.test(q), addEventListener() {}, addListener() {} });
}

const imagens = (id) => app.aprImagensDe(id);
const titulos = (id) => imagens(id).map((x) => x.titulo);
const tudo = (id) => imagens(id).map((x) => x.titulo + ' ' + x.texto + ' ' + x.html.replace(/<[^>]*>/g, ' ')).join(' ');

describe('o registo', () => {
  test('as sete estão registadas, com o nome do separador e 2 a 4 imagens, cada uma com título, texto e maquete', () => {
    montar({ imoveis: 1 });
    for (const id of CASAS) {
      const def = app.APRESENTACOES[id], tab = app.TABS.find((t) => t.id === id);
      assert.ok(def, id + ' registada');
      assert.equal(def.nome, tab.label, id + ': o nome é o do separador');
      assert.ok(def.imagens.length >= 2 && def.imagens.length <= 4, id + ': ' + def.imagens.length + ' imagens registadas');
      for (const im of def.imagens) {
        assert.ok(im.titulo && im.texto, id + ': título e texto');
        assert.equal(typeof im.maquete, 'function', id + ': a maquete é uma função');
        assert.match(im.maquete.name, /^aprC[A-Z]/, id + ': a maquete é uma function de topo com o prefixo da folha');
      }
      const n = imagens(id).length;
      assert.ok(n >= 2 && n <= 4, id + ': ' + n + ' imagens à vista de quem é dono');
    }
  });

  test('abrem na janela como as outras: o fim é o «Percebi», e todas as imagens entram na fita', () => {
    montar({ imoveis: 1 });
    for (const id of CASAS) {
      assert.equal(app.aprFimDe(id).rotulo, 'Percebi', id);
      assert.ok(app.aprImagensVisiveis(id).length === imagens(id).length, id);
    }
    // na Ajuda, pela ordem da navegação, a seguir às boas-vindas
    const ordem = app.aprDaConta().filter((x) => CASAS.includes(x));
    igual(ordem, ['properties', 'groups', 'contracts', 'tenants', 'owners', 'colaboradores', 'visits']);
  });
});

describe('as maquetes', () => {
  test('cada uma escreve HTML sem style= nem on…=, e nenhuma fica vazia — no telemóvel, no computador, para quem só colabora e sem imóveis', () => {
    const conferir = (cena) => {
      for (const id of CASAS) for (const im of imagens(id)) {
        assert.ok(im.html.length > 200, cena + ' · ' + id + ' · ' + im.titulo + ': a maquete desenhou-se');
        assert.doesNotMatch(im.html, /style=|\son[a-z]+=|<script/i, cena + ' · ' + id + ' · ' + im.titulo);
        assert.match(im.html, /^<div class="apr-cena /, cena + ' · ' + id + ': a peça de fora é a aprCena');
      }
    };
    montar({ imoveis: 1 }); conferir('dono');
    montar(); conferir('sem imóveis');
    noComputador(); montar({ imoveis: 1 }); conferir('computador');
    repor(app);
    soColaborador(['visit.view', 'visit.add', 'tenant.view', 'tenant.add']); conferir('colaborador');
  });

  test('o texto passa pelo esc, e o que a imagem ensina a tocar leva o contorno de destaque', () => {
    montar({ imoveis: 1 });
    assert.match(app.aprCChip('<x>'), /&lt;x&gt;/);
    assert.match(app.aprCLinhaPessoa({ nome: 'A <b>', sub: '<i>' }), /A &lt;b&gt;.*&lt;i&gt;/);
    for (const [id, i] of [['properties', 3], ['contracts', 0], ['contracts', 3], ['owners', 1], ['visits', 1]]) {
      assert.match(imagens(id)[i].html, /apr-alvo/, id + ' ' + i + ': há um alvo');
    }
    // a seleção: a caixa cheia e o contorno nos marcados, a meio no cabeçalho
    const sel = imagens('properties')[2].html;
    assert.match(sel, /apr-c-caixa meio/);
    assert.equal((sel.match(/apr-c-caixa on/g) || []).length, 2, 'dois imóveis marcados');
    assert.match(sel, /2 selecionados/);
  });
});

describe('os textos', () => {
  test('seguem a casa: sem «pôr»/«tirar», sem «(s)», sem «Bem-vindo», sem ponto de exclamação, sem emojis, e o texto só com <b> e <i>', () => {
    const conferir = () => {
      for (const id of CASAS) {
        const t = tudo(id);
        assert.doesNotMatch(t, /(^|[^\p{L}])(pôr|põe|põem|puser|tirar|tira|tiras|tirou)([^\p{L}]|$)/iu, id);
        assert.doesNotMatch(t, /\(s\)|\(as\)|\(os\)/, id);
        assert.doesNotMatch(t, /Bem-vind/i, id);
        assert.doesNotMatch(t, /!/, id);
        assert.doesNotMatch(t, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, id);
        for (const im of imagens(id)) {
          assert.doesNotMatch(im.texto.replace(/<\/?(b|i)>/g, ''), /<[a-z/]/i, id + ' · ' + im.titulo + ': só <b> e <i>');
          assert.doesNotMatch(im.titulo, /[<>]/, id + ': o título é texto simples');
        }
      }
    };
    montar({ imoveis: 1 }); conferir();
    montar(); conferir();
    noComputador(); montar({ imoveis: 1 }); conferir();
    repor(app);
    soColaborador(['visit.view', 'visit.add', 'tenant.view', 'tenant.add']); conferir();
  });

  test('os caminhos «Casas → …» usam os rótulos da navegação, e cada uma diz onde está o separador dela', () => {
    montar({ imoveis: 1 });
    const rotulos = new Set(app.TABS.map((t) => t.label).concat(app.NAV_GROUPS.map((g) => g.label).filter(Boolean), [app.rotuloDaPorta('pessoas').label]));
    for (const id of CASAS) {
      const t = imagens(id).map((x) => x.texto.replace(/<[^>]*>/g, '')).join(' ');
      // de cada lado de cada seta, um rótulo da navegação: o que acaba antes dela e o que começa depois
      const partes = t.split(' → ');
      for (let k = 0; k < partes.length - 1; k++) {
        const antes = partes[k], depois = partes[k + 1];
        assert.ok([...rotulos].some((r) => antes.endsWith(r)), id + ': antes da seta, «…' + antes.slice(-20) + '» acaba num rótulo da navegação');
        assert.ok([...rotulos].some((r) => depois.startsWith(r)), id + ': depois da seta, «' + depois.slice(0, 20) + '…» começa num rótulo da navegação');
      }
    }
    const caminho = { properties: 'Casas → Imóveis', groups: 'Casas → Grupos', contracts: 'Casas → Contratos', tenants: 'Casas → Pessoas → Inquilinos',
      owners: 'Casas → Pessoas → Proprietários', colaboradores: 'Casas → Pessoas → Colaboradores', visits: 'Casas → Visitas' };
    for (const id of CASAS) assert.ok(imagens(id)[0].texto.replace(/<[^>]*>/g, '').includes(caminho[id]), id + ': a primeira imagem diz ' + caminho[id]);
  });

  test('o segurar ensina-se só onde há seleção de vários, e o ⋮ só onde a ficha o tem', () => {
    montar({ imoveis: 1 });
    const comSelecao = new Set(Object.values(app.TABS_SEL));
    for (const id of CASAS) {
      const t = imagens(id).map((x) => x.texto).join(' ');
      if (comSelecao.has(id)) assert.match(t, /\b(Segura|segurar|segura)\b/, id + ' tem seleção');
      else assert.doesNotMatch(t, /\b(Segura|segurar|segura)\b/, id + ' não tem seleção');
    }
    assert.match(imagens('properties')[1].texto, /<b>⋮<\/b>/);
    assert.match(imagens('contracts')[2].texto, /<b>⋮<\/b>/);
    assert.match(imagens('owners')[2].texto, /<b>Remover ligação<\/b>/);
  });
});

describe('quem vê e onde', () => {
  test('quem só colabora não vê como se cria o que o cargo não deixa, e a ficha diz o cargo em vez do Editar', () => {
    soColaborador(['visit.view', 'tenant.view']);
    igual(titulos('properties'), ['Cada imóvel, um cartão', 'A ficha do imóvel', 'Segura para escolher vários'], 'sem «Adicionar um imóvel»');
    assert.match(imagens('properties')[1].texto, /o que o cargo deixa ver/);
    assert.doesNotMatch(imagens('properties')[1].html, /Editar/, 'sem o Editar no rodapé');
    assert.match(imagens('properties')[2].texto, /deixar de colaborar/);
    assert.equal(titulos('tenants').length, 2, 'sem «Adicionar inquilinos», sem a seleção nem o novo');
    assert.equal(titulos('visits').includes('Várias de uma vez'), false, 'sem «Marcar visitas», sem a seleção');
    assert.match(imagens('visits')[1].texto, /^Na ficha estão o dia por extenso, o imóvel/, 'sem converter em inquilino');
    igual(titulos('colaboradores'), ['Onde colaboras', 'Os imóveis onde colaboras'], 'do lado de quem colabora');
    assert.match(imagens('colaboradores')[1].texto, /<b>Em que colaboro<\/b>/);
    // com o cargo a deixar, voltam
    app.CW.cargos.P1.perms = ['visit.view', 'visit.add', 'tenant.view', 'tenant.add'];
    assert.equal(titulos('tenants').length, 3);
    assert.ok(titulos('visits').includes('Várias de uma vez'));
    assert.match(imagens('visits')[1].texto, /Converter em inquilino/);
    assert.doesNotMatch(tudo('properties'), /És colaborador/, 'a nota não presume o género de quem lê');
  });

  test('quem tem imóveis seus e também colabora vê o «Onde colaboras» no fim dos Colaboradores', () => {
    montar({ imoveis: 1 });
    igual(titulos('colaboradores'), ['Quem te ajuda a gerir', 'O cargo diz o que se pode', 'Convidar com uma ligação']);
    app.db.properties.push(app.normProp({ id: 'P1', name: 'T1 Foz', ownerIds: ['OUTRO'], _sharedFrom: 'Duarte Pinto', _cargo: 'Gestor de visitas' }));
    app.CW.cargos = { P1: { dono: false, perms: ['visit.view', 'visit.add'], nome: 'Gestor de visitas' } };
    assert.ok(!app.souSoColaborador());
    igual(titulos('colaboradores'), ['Quem te ajuda a gerir', 'O cargo diz o que se pode', 'Convidar com uma ligação', 'Onde és tu a colaborar']);
  });

  test('no telemóvel ensina-se o + da barra de baixo; no computador, o botão do cabeçalho, que a maquete desenha', () => {
    montar({ imoveis: 1 });
    assert.match(imagens('properties')[3].texto, /O <b>\+<\/b> da barra de baixo abre o <b>Criar<\/b>/);
    assert.match(imagens('properties')[3].html, /neste ecrã/);
    assert.match(imagens('contracts')[3].texto, /No <b>\+<\/b> da barra de baixo, <b>Contrato<\/b>/);
    assert.match(imagens('tenants')[2].texto, /no <b>\+<\/b> da barra de baixo/);
    assert.match(imagens('groups')[1].texto, /no <b>\+<\/b>, já do tipo à vista/);
    noComputador();
    assert.match(imagens('properties')[3].texto, /^<b>Novo imóvel<\/b>, no cabeçalho/);
    assert.match(imagens('properties')[3].html, /apr-c-cabeca-larga/);
    assert.doesNotMatch(imagens('properties')[3].html, /neste ecrã/);
    assert.match(imagens('contracts')[3].texto, /^<b>Novo contrato<\/b>, no cabeçalho/);
    assert.match(imagens('tenants')[2].texto, /em <b>Novo inquilino<\/b>, no cabeçalho/);
    assert.match(imagens('visits')[2].texto, /em <b>Marcar visita<\/b>, no cabeçalho/);
    assert.match(imagens('groups')[1].texto, /<b>Novo grupo de imóveis<\/b>, no cabeçalho/);
    // os rótulos são os do cabeçalho (navegacao.js:ROTULO_ACAO)
    for (const k of ['imovel', 'contrato', 'inquilino', 'visita']) assert.ok(tudo(k === 'imovel' ? 'properties' : k === 'contrato' ? 'contracts' : k === 'inquilino' ? 'tenants' : 'visits').includes(app.ROTULO_ACAO[k]), k);
  });

  test('sem imóveis, criar um contrato ou marcar uma visita começa por criar o imóvel (o «Criar» ainda não os oferece)', () => {
    montar();
    assert.equal(app.acoesDeAdicionar().some((a) => a.id === 'contrato' || a.id === 'visita'), false, 'o «Criar» não os oferece');
    assert.match(imagens('contracts')[3].texto, /cria primeiro o imóvel, em <b>Casas → Imóveis<\/b>/);
    assert.match(imagens('visits')[2].texto, /com o primeiro, em <b>Casas → Imóveis<\/b>, a <b>Visita<\/b> passa a estar no <b>\+<\/b>/);
    montar({ imoveis: 1 });
    assert.ok(app.acoesDeAdicionar().some((a) => a.id === 'contrato'));
    assert.doesNotMatch(imagens('contracts')[3].texto, /cria primeiro/);
  });

  test('com um serviço desligado, sai o que é dele: a partilha entre contas, o grupo partilhado, a dica dos Movimentos, a Agenda', () => {
    montar({ imoveis: 1 });
    assert.ok(titulos('groups').includes('Partilhar um grupo'));
    assert.ok(titulos('owners').includes('Ligar-te a outra conta'));
    assert.match(imagens('owners')[2].html, /Editar casas partilhadas/);
    app.definirServicosDesligados(['colaboradores']);
    assert.ok(!titulos('groups').includes('Partilhar um grupo'));
    assert.doesNotMatch(imagens('groups')[0].html, /Partilhado · teu/, 'a lista sem o grupo partilhado');
    igual(titulos('owners'), ['As contas com quem partilhas', 'A ficha de cada conta']);
    assert.doesNotMatch(imagens('owners')[1].html, /Editar casas partilhadas/);
    assert.doesNotMatch(imagens('owners')[1].texto, /Remover ligação/);
    app.definirServicosDesligados(['transactions']);
    assert.ok(!titulos('groups').includes('Dica: um grupo no filtro'), 'sem os Movimentos não há o filtro deles');
    assert.doesNotMatch(imagens('contracts')[3].texto, /fica planeada/, 'sem os Planeados (que pedem os Movimentos) a renda não fica planeada');
    app.definirServicosDesligados(['calendar']);
    assert.ok(!titulos('visits').includes('Dica: as visitas na Agenda'));
    app.definirServicosDesligados(['recurring']);
    assert.doesNotMatch(imagens('visits')[3].texto, /planeados/);
    assert.doesNotMatch(imagens('contracts')[0].texto, /Confirmar/, 'sem os Planeados, nada por confirmar por baixo do contrato');
    assert.doesNotMatch(imagens('contracts')[0].html, /por confirmar/);
  });
});

describe('o portefólio das Casas', () => {
  test('fecha com o APR_EXEMPLO: 7 contratos (5 em vigor), 8 inquilinos, o T1 Cedofeita vago, as datas contadas a partir de hoje', () => {
    montar({ imoveis: 1 });
    const ex = app.APR_EXEMPLO, c = app.aprCExemplo;
    assert.equal(c.nContratos.vigor, ex.contratos.length, 'os em vigor são os cinco do APR_EXEMPLO');
    assert.equal(c.nContratos.todos, ex.contratos.length + 2, 'mais o terminado e o por começar');
    assert.equal(c.nInquilinos, ex.inquilinos.length + 3, 'mais o Rui, a Carolina e o Paulo');
    assert.equal(c.terminado.imovel, 'cedofeita');
    assert.equal(ex.rendaDe('cedofeita'), 0, 'o T1 Cedofeita está vago');
    assert.ok(app.aprCFimDeAgosto() < app.today() && app.aprCFimDeAgosto().slice(5) === '08-31', 'o contrato da Carolina acabou no último 31 de agosto');
    assert.ok(app.aprProximoDia(1) > app.today(), 'o do Rui começa no próximo dia 1');
    assert.ok(app.aprCUltimo(8) <= app.today() && app.aprCUltimo(8).slice(8) === '08');
    assert.equal(app.aprCDias('2026-01-01', '2026-03-01'), 59);
    assert.equal(app.aprCIso('29/02/2028'), '2028-02-29');
    for (const g of c.grupos) for (const id of g.imoveis) assert.ok(ex.imovel(id), g.nome + ': ' + id);
    assert.ok(c.quemColabora.imoveis.every((id) => ex.imovel(id)));
    // a renda que cabe à Helena é a quota dela da renda do T3 Bonfim
    assert.match(imagens('owners')[0].html, new RegExp(app.money(ex.rendaDe('bonfim') * ex.proprietarios[0].quota / 100).replace(/\s/g, '\\s')));
    assert.ok(!/João Silva/.test(JSON.stringify(c)), 'nada de nomes de fachada');
  });
});
