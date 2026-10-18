// Os formulários da nuvem e os que sobram da base, pela regra dos
// formulários: o que o guardar recusa vazio leva o asterisco vermelho no
// rótulo; o resto diz «Opcional», ou mostra um exemplo «Ex: …» com
// «(opcional)» no rótulo; e nenhum placeholder é uma instrução. O ecrã de
// entrada deixou de usar placeholders a fazer de rótulo, sem mexer nos ids,
// nos type e nos autocomplete de que vivem o gestor de palavras-passe e o
// submitAuth — nem na zona do Google.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { carregarApp, carregarTudo, repor, limpar } from './arnes.js';
import { janelasFalsas } from './lib/dom.js';
import { conferir, EX } from './lib/formularios.js';

const app = carregarApp();
afterEach(() => repor(app));

/* A app inteira com a nuvem por cima, sem rede: a API responde vazio, o
   toast e o pull calam-se, e há uma sessão.
   Recebe: comSessao — falso para ficar sem sessão (o ecrã de entrada).
   Devolve: o proxy da app. */
function nuvem(comSessao) {
  const a = carregarTudo();
  a.document.documentElement.style.removeProperty = () => {};
  a.api = () => Promise.resolve({});
  a.toast = () => {}; a.pullNow = () => Promise.resolve();
  a.CW.user = comSessao === false ? null : { id: 'EU', name: 'Eu', email: 'eu@exemplo.pt', token: 't' };
  return a;
}

/* O HTML do ecrã de entrada num dos modos.
   Recebe: a — a app com a nuvem; modo — 'login' ou 'register'.
   Devolve: o innerHTML do #cwAuth. */
function ecraDeEntrada(a, modo) {
  a.CW.showAuthMode = modo;
  a.showAuth();
  return a.authEl.innerHTML;
}

describe('o ecrã de entrada', () => {
  test('entrar: email e palavra-passe com rótulo à vista e asterisco; o email com exemplo, a palavra-passe sem', () => {
    const a = nuvem(false);
    const html = ecraDeEntrada(a, 'login');
    const cs = conferir('entrar', html, { obrigatorios: ['cwa_email', 'cwa_pass'] });
    assert.deepEqual(cs.map((c) => c.id), ['cwa_email', 'cwa_pass'], 'no «Entrar» não há nome nem confirmação');
    assert.equal(cs[0].rotulo, 'Email');
    assert.equal(cs[1].rotulo, 'Palavra-passe');
    // o que o gestor de palavras-passe e o submitAuth leem fica intacto
    assert.match(html, /<label>Email <span class="req">\*<\/span><input id="cwa_email" type="email" placeholder="Ex: ana@exemplo\.pt" autocomplete="email"><\/label>/);
    assert.match(html, /<input id="cwa_pass" type="password" autocomplete="current-password">/, 'a palavra-passe não leva exemplo');
    assert.doesNotMatch(html, /placeholder="(Email|Palavra-passe|Nome)"/, 'nenhum placeholder a fazer de rótulo');
    // o Google continua a ter onde montar, e o «Esqueci-me» continua lá
    assert.match(html, /<div id="cwa_social" class="u-d-none">/);
    assert.match(html, /<div id="cwa_gbtn"/);
    assert.ok(html.includes('data-click="CW.esqueci(event)"'));
  });

  test('criar conta: o nome é opcional com exemplo; email, palavra-passe, confirmação e termos levam o asterisco', () => {
    const a = nuvem(false);
    const html = ecraDeEntrada(a, 'register');
    const cs = conferir('criar conta', html, {
      obrigatorios: ['cwa_email', 'cwa_pass', 'cwa_pass2'],
      exemplos: { cwa_name: EX + 'Ana Rodrigues' },
    });
    assert.deepEqual(cs.map((c) => c.id), ['cwa_name', 'cwa_email', 'cwa_pass', 'cwa_pass2']);
    assert.match(html, /<label>Nome \(opcional\)<input id="cwa_name" placeholder="Ex: Ana Rodrigues" autocomplete="name"><\/label>/);
    // no registo a palavra-passe aponta para os requisitos (aria-describedby), que o leitor de ecrã lê com ela
    assert.match(html, /<input id="cwa_pass" type="password" autocomplete="new-password" aria-describedby="cwa_passreq">/);
    assert.match(html, /<label>Confirmar palavra-passe <span class="req">\*<\/span><input id="cwa_pass2" type="password" autocomplete="new-password"><\/label>/);
    // os requisitos da palavra-passe ficam entre a palavra-passe e a confirmação
    assert.ok(html.indexOf('id="cwa_pass"') < html.indexOf('id="cwa_passreq"') && html.indexOf('id="cwa_passreq"') < html.indexOf('id="cwa_pass2"'));
    // os termos (o submitAuth recusa sem eles) levam o asterisco
    assert.match(html, /Política de Privacidade<\/a>\. <span class="req">\*<\/span><\/span><\/label>/);
    assert.ok(html.includes('id="cwa_terms"'));
  });

  test('o submitAuth continua a ler os mesmos campos: no registo recusa sem termos, e no «Entrar» manda o email e a palavra-passe', () => {
    const a = nuvem(false);
    const pedidos = [];
    // o /api/auth/config do Google também passa por aqui: contam só os do formulário
    a.api = (m, rota, corpo) => { if (m === 'POST') pedidos.push({ rota, corpo }); return new Promise(() => {}); };
    ecraDeEntrada(a, 'register');
    const el = (id) => a.document.getElementById(id);
    el('cwa_name').value = 'Ana'; el('cwa_email').value = 'ana@exemplo.pt';
    el('cwa_pass').value = 'Forte#2026'; el('cwa_pass2').value = 'Forte#2026';
    el('cwa_terms').checked = false;
    a.CW.submitAuth();
    assert.match(el('cwa_err').textContent, /Termos/);
    assert.equal(pedidos.length, 0, 'sem termos não há pedido');
    a.CW.showAuthMode = 'login';
    a.CW.submitAuth();
    assert.deepEqual(JSON.parse(JSON.stringify(pedidos)), [{ rota: '/api/auth/login', corpo: { email: 'ana@exemplo.pt', password: 'Forte#2026' } }]);
  });
});

describe('a conta e a ligação a outro utilizador', () => {
  test('ligar: o id do outro é obrigatório, com rótulo, asterisco e exemplo; o convite pede cargo e imóveis', () => {
    const a = nuvem();
    limpar(a);
    a.db.properties = [a.normProp({ id: 'P1', name: 'T2 Lisboa', ownerIds: ['EU'] })];
    a.CW.state.roles = [{ id: 'R1', name: 'Gestor de visitas', perms: ['visit.view'] }];
    const conta = a.vCloud();
    const cs = conferir('ligar', conta, { obrigatorios: ['cw_peer'], deixados: ['cw_lig_'] });
    assert.equal(cs.find((c) => c.id === 'cw_peer').placeholder, EX + 'A7KQ2MPX');
    assert.match(conta, /<label class="u-fx-1 u-minw-0">O id dele <span class="req">\*<\/span><input id="cw_peer"/);
    const convite = a.convidarCard();
    conferir('convite', convite, { obrigatorios: [], exemplos: { cw_inv_label: EX + 'Para a Ana, contabilidade' } });
    assert.match(convite, /<label>Cargo <span class="req">\*<\/span>/);
    assert.match(convite, /<div class="flabel">Imóveis <span class="req">\*<\/span><\/div>/);
    assert.doesNotMatch(conta + convite, /Ex\.: /, 'nenhum «Ex.: » com ponto');
  });

  test('mudar palavra-passe e apagar a conta: a atual diz «Opcional» e o porquê fica numa nota; as novas e o APAGAR levam o asterisco', () => {
    const a = nuvem();
    const abertas = janelasFalsas(a);
    a.CW.passwordModal();
    conferir('mudar palavra-passe', abertas[0].b, { obrigatorios: ['cw_pw_new', 'cw_pw_new2'] });
    assert.match(abertas[0].b, /<input id="cw_pw_cur" type="password" autocomplete="current-password" placeholder="Opcional"><\/label><div class="hint[^"]*">Só fica vazia se entras com o Google\.<\/div>/);
    a.CW.deleteAccount();
    const cs = conferir('apagar a conta', abertas[1].b, { obrigatorios: [], deixados: ['cw_del_c'] });
    assert.equal(cs.find((c) => c.id === 'cw_del_p').placeholder, 'Opcional');
    assert.match(abertas[1].b, /<span class="rotulo-txt">Escreve <b>APAGAR<\/b> para confirmar<\/span> <span class="req">\*<\/span><input id="cw_del_c"[^>]*placeholder="APAGAR"/, 'a palavra a escrever é a exceção, e é obrigatória');
    assert.doesNotMatch(abertas[0].b + abertas[1].b, /deixa vazio/, 'a instrução saiu do placeholder');
  });

  test('cargo e colaborador: o nome do cargo com «Ex: Gestor de visitas»; as permissões, o cargo e os imóveis levam o asterisco', () => {
    const a = nuvem();
    limpar(a);
    a.db.properties = [a.normProp({ id: 'P1', name: 'T2 Lisboa', ownerIds: ['EU'] })];
    a.CW.state.roles = [{ id: 'R1', name: 'Gestor de visitas', perms: ['visit.view'] }];
    a.CW.state.collaborators = [{ id: 'C1', userId: 'ANA', name: 'Ana', roleId: 'R1', houses: [{ id: 'P1' }] }];
    const abertas = janelasFalsas(a);
    a.CW.cargoModal();
    const cs = conferir('cargo', abertas[0].b, { obrigatorios: ['cg_nome'] });
    assert.equal(cs[0].placeholder, EX + 'Gestor de visitas');
    assert.match(abertas[0].b, /<div class="flabel">O que pode fazer <span class="req">\*<\/span><\/div>/, 'o guardar recusa sem permissões');
    a.CW.mudarColaborador('C1');
    assert.match(abertas[1].b, /<label>Cargo <span class="req">\*<\/span>/);
    assert.match(abertas[1].b, /<div class="flabel">Imóveis <span class="req">\*<\/span><\/div>/);
  });
});

describe('o pedido de ajuda e a recusa dos termos', () => {
  test('problema e sugestão: assunto e descrição obrigatórios, com exemplos; o que era instrução passou para a nota', () => {
    const a = nuvem();
    const abertas = janelasFalsas(a);
    a.CW.newTicket('problema');
    a.CW.newTicket('sugestao');
    for (const [i, nota] of [[0, 'O que estavas a fazer, o que esperavas e o que aconteceu.'], [1, 'O que gostavas de conseguir fazer, e porquê.']]) {
      const cs = conferir('pedido ' + i, abertas[i].b, { obrigatorios: ['tk_s', 'tk_b'] });
      for (const c of cs) assert.ok(c.placeholder.startsWith(EX), c.id + ': «' + c.placeholder + '» é um exemplo');
      assert.ok(abertas[i].b.includes('</textarea></label><div class="hint u-m-n4px-0-0" id="tk_nota">' + nota + '</div>'), 'a instrução fica por baixo da caixa');
      assert.doesNotMatch(abertas[i].b, new RegExp('placeholder="' + nota.slice(0, 12)));
      // o tipo escolhe-se num segmentado (Problema / Sugestão), com o escolhido marcado
      assert.match(abertas[i].b, new RegExp('<div class="segm tk-tipo" role="radiogroup" aria-label="Tipo de pedido"><button type="button" role="radio" aria-checked="' + (i === 0) + '"'));
    }
    assert.equal(abertas[0].t, 'Novo pedido');
    // o envio continua a recusar vazio — é por isso que levam o asterisco —, e diz-se junto do campo
    const pedidos = [];
    let contexto = '';
    a.api = (m, rota, corpo) => { pedidos.push(m + ' ' + rota); contexto = (corpo && corpo.context) || ''; return new Promise(() => {}); };
    const falhas = [];
    a.falhaCampo = (id, msg) => { falhas.push(id + ': ' + msg); };
    a.document.getElementById('tk_s').value = '';
    a.document.getElementById('tk_b').value = 'algo';
    a.CW.sendTicket('problema');
    a.document.getElementById('tk_s').value = 'Um assunto';
    a.document.getElementById('tk_b').value = '';
    a.CW.sendTicket('problema');
    assert.deepEqual(falhas, ['tk_s: Escreve o assunto.', 'tk_b: Conta o que aconteceu.'], 'cada campo vazio diz-se junto dele');
    assert.deepEqual(pedidos, [], 'e nada vai ao servidor');
    // com os dois, segue — com a versão da app no contexto
    a.document.getElementById('tk_b').value = 'Aconteceu isto.';
    a.CW.sendTicket();
    assert.deepEqual(pedidos, ['POST /api/tickets'], 'sem argumento vale o tipo escolhido na janela');
    assert.ok(contexto.startsWith('v' + a.VERSAO + ' · '), 'o contexto leva a versão da app, e não a dos termos: ' + contexto);
  });

  test('recusar os termos: o APAGAR é obrigatório e fica a exceção', () => {
    const a = nuvem();
    const abertas = janelasFalsas(a);
    a.CW.refuseTerms();
    assert.match(abertas[0].b, /para confirmar<\/span> <span class="req">\*<\/span><input id="cw_ref_c" placeholder="APAGAR"/);
  });

  test('o perfil: o telemóvel ganha o exemplo com «Ex: » e o «(opcional)» no rótulo', () => {
    const a = nuvem();
    const lab = { firstChild: { nodeType: 3, nodeValue: 'Telemóvel' }, insertBefore() {} };
    const inp = { value: '', placeholder: 'Opcional', style: {}, parentNode: lab };
    a.document.getElementById = (id) => (id === 'pe_phone' ? inp : id === 'cw_cc' ? null : a.document.createElement('div'));
    a.injectPhoneCountry();
    assert.equal(inp.placeholder, 'Ex: 912 345 678');
    assert.equal(lab.firstChild.nodeValue, 'Telemóvel (opcional)');
  });
});

describe('o resto da base', () => {
  test('richEditor: «Opcional» por omissão; um exemplo sai sempre com um só «Ex: »', () => {
    assert.match(app.richEditor('Notas', 'x', '', undefined), /<textarea id="x" placeholder="Opcional">/);
    assert.match(app.richEditor('Notas', 'x', '', 'Opcional'), /placeholder="Opcional"/);
    assert.match(app.richEditor('Notas', 'x', '', 'Fiador: o pai'), /placeholder="Ex: Fiador: o pai"/);
    assert.match(app.richEditor('Notas', 'x', '', 'Ex: Fiador: o pai'), /placeholder="Ex: Fiador: o pai"/);
    assert.doesNotMatch(app.richEditor('Notas', 'x', ''), /Escreve aqui/);
  });

  test('colar uma cópia e colar o CSV do Splitwise: a caixa é obrigatória, com rótulo e exemplo', () => {
    const abertas = janelasFalsas(app);
    app.bkPasteBox();
    conferir('colar cópia', abertas[0].b, { obrigatorios: ['bkText'] });
    assert.match(abertas[0].b, /placeholder="Ex: \{&quot;properties&quot;:\[…\]/);
    app.swPasteBox();
    const cs = conferir('colar CSV', abertas[1].b, { obrigatorios: ['swText'] });
    assert.equal(cs[0].placeholder, EX + 'Date,Description,Category,Cost,Currency');
  });

  test('importar do Splitwise: o imóvel com asterisco; a quota-parte diz «Opcional» e o que vale em branco', () => {
    limpar(app);
    app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa' })];
    const abertas = janelasFalsas(app);
    app.swRows = [['2026-01-02', 'Luz', 'Utilities', '40', 'EUR']];
    app.swHead = ['Date', 'Description', 'Category', 'Cost', 'Currency'];
    app.swMapModal();
    conferir('importar Splitwise', abertas[0].b, { obrigatorios: [], deixados: ['sw_prop'] });
    assert.match(abertas[0].b, /Lançar em que imóvel\? <span class="req">\*<\/span>/);
    assert.match(abertas[0].b, /Em branco: 100 %\./);
  });

  test('a fotografia, a avaliação e as projeções: nenhum placeholder fora de «Opcional» ou «Ex: »', () => {
    const foto = app.fileBlock('Fotografias', [{ id: 'F1', name: 'IMG_001.jpg', size: 10 }], 'pf', 'x', 'y', { photos: true });
    assert.match(foto, /id="fn_F1" value="IMG_001\.jpg" placeholder="Ex: Sala de estar" aria-label="Nome da fotografia \(opcional\)"/);
    limpar(app);
    app.db.properties = [app.normProp({ id: 'P1', name: 'T2 Lisboa' })];
    const html = app.vReports() + app.vProjections();
    const ph = [...html.matchAll(/placeholder="([^"]*)"/g)].map((m) => m[1]);
    assert.ok(ph.filter((p) => p === 'Opcional').length >= 4, 'o yield, o horizonte, o aumento e a inflação');
    for (const p of ph) assert.ok(p === 'Opcional' || p.startsWith(EX) || p === 'Pesquisar…', 'placeholder «' + p + '»');
    assert.match(html, /em branco: 5 %/);
    assert.match(html, /Em branco: 1 ano, e 0 % de aumento e de inflação\./);
  });
});

/* Os erros de Conta e partilha dizem-se junto do campo, como no Entrar e no
   Novo pedido (componentes.js:falhaCampo): o «Ligar» vazio ou recusado pelo
   servidor era só um aviso em baixo, e a palavra-passe nova fraca ou
   desencontrada saía no fundo da janela, longe do campo e sem o marcar. */
describe('os erros de Conta e partilha junto do campo', () => {
  /* A app com a nuvem e o falhaCampo apanhado.
     Devolve: {a, falhas} — falhas são os [id, frase] marcados, pela ordem. */
  function comFalhas() {
    const a = nuvem();
    const falhas = [];
    a.falhaCampo = (id, msg) => { falhas.push([id, msg]); };
    return { a, falhas };
  }

  test('«Ligar» com o campo vazio marca o campo do id, e não pergunta ao servidor', () => {
    const { a, falhas } = comFalhas();
    let pedidos = 0;
    a.api = () => { pedidos++; return Promise.resolve({}); };
    a.document.getElementById('cw_peer').value = '   ';
    a.CW.addConn();
    assert.deepEqual(falhas, [['cw_peer', 'Escreve o id que o outro te deu.']]);
    assert.equal(pedidos, 0);
  });

  test('o que o servidor recusa ao ligar (o próprio id) diz-se no campo', async () => {
    const { a, falhas } = comFalhas();
    a.api = () => Promise.reject(new Error('Não te podes ligar a ti próprio.'));
    a.document.getElementById('cw_peer').value = 'eu123456';
    a.CW.addConn();
    await new Promise((r) => setTimeout(r, 5));
    assert.deepEqual(falhas, [['cw_peer', 'Não te podes ligar a ti próprio.']]);
  });

  test('mudar a palavra-passe: a fraca diz-se na nova, o desencontro na confirmação, e o fundo fica para o servidor', () => {
    const { a, falhas } = comFalhas();
    const el = (id) => a.document.getElementById(id);
    el('cw_pw_new').value = '';
    a.CW.savePassword();
    el('cw_pw_new').value = 'Casa2026!Bonfim';
    el('cw_pw_new2').value = 'Casa2026!Bonfi';
    a.CW.savePassword();
    assert.deepEqual(falhas, [['cw_pw_new', 'A palavra-passe precisa de pelo menos 8 caracteres.'], ['cw_pw_new2', 'As palavras-passe não coincidem.']]);
    assert.equal(el('cw_pw_err').textContent, '', 'o fundo da janela fica para o que o servidor responder');
  });

  test('o erro da palavra-passe nova não lhe tira a caixa dos requisitos (aria-describedby), e à primeira tecla volta a ela', () => {
    const a = nuvem();
    const attrs = { 'aria-describedby': 'cw_pw_req' }, ouvintes = [];
    const campo = {
      classList: { add() {}, remove() {} }, closest: () => null, focus() {}, scrollIntoView() {}, insertAdjacentElement() {},
      setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; },
      addEventListener: (t, f) => { ouvintes.push(f); },
    };
    a.document.getElementById = (id) => (id === 'cw_pw_new' ? campo : null);
    a.falhaPalavraNova('A palavra-passe precisa de um símbolo (ex.: ! ? € .).');
    assert.equal(attrs['aria-invalid'], 'true');
    assert.equal(attrs['aria-describedby'], 'cw_pw_new-erro cw_pw_req');
    ouvintes.forEach((f) => f());
    assert.equal(attrs['aria-describedby'], 'cw_pw_req');
  });
});

/* O ecrã de entrada não esconde o que acabou de acontecer: o que vai para
   um aviso em baixo (.toast, z 90) fica por trás dele (z 200). */
describe('o que o ecrã de entrada diz', () => {
  test('a palavra-passe nova guardada (a ligação «repor» do email) confirma-se no ecrã de entrada, e não num aviso por trás dele', async () => {
    const a = nuvem(false);
    const avisos = [];
    a.toast = (m) => { avisos.push(m); };
    const el = (id) => a.document.getElementById(id);
    a.CW._reporToken = 'f'.repeat(64);
    el('rp_1').value = 'Casa2026!Bonfim';
    el('rp_2').value = 'Casa2026!Bonfim';
    a.CW.reporConfirmar();
    await new Promise((r) => setTimeout(r, 5));
    assert.equal(el('cwa_info').textContent, 'Palavra-passe mudada. Entra com a nova.');
    assert.deepEqual(avisos, []);
  });

  /* Quem chega sem sessão por uma ligação de convite que já não serve: a
     pré-visualização falha, a ligação esquece-se, e o ecrã já aberto deixa de
     prometer o convite (o «Entrar e ver o convite», a faixa, a nota) — e o
     erro continua lá ao trocar de separador. A app carrega com a ligação no
     endereço e o servidor a responder 404 à pré-visualização. */
  test('a ligação de convite que já não serve: o ecrã aberto redesenha-se com o erro, sem o convite, e o erro fica ao trocar de separador', async () => {
    const guardado = new Map();
    const a = carregarTudo({
      antes(j) {
        j.location.search = '?convite=' + 'a'.repeat(64);
        j.sessionStorage = { getItem: (k) => (guardado.has(k) ? guardado.get(k) : null), setItem: (k, v) => { guardado.set(k, String(v)); }, removeItem: (k) => { guardado.delete(k); } };
        j.fetch = (url) => (String(url).indexOf('/api/convite/') === 0
          ? Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ error: 'Essa ligação já foi usada, expirou, ou não existe.' }) })
          : Promise.reject(new Error('sem rede nos testes')));
      },
    });
    assert.match(a.authEl.innerHTML, /Entrar e ver o convite/, 'controlo: ao abrir, o ecrã é o do convite');
    await new Promise((r) => setTimeout(r, 20));
    const h = a.authEl.innerHTML;
    assert.match(h, /<p class="ent-msg-erro" id="cwa_msg" role="alert">Essa ligação já foi usada, expirou, ou não existe\.<\/p>/);
    assert.doesNotMatch(h, /e ver o convite|ent-faixa|ent-convite/, 'nada promete o convite');
    assert.match(h, />Entrar<\/button>/);
    assert.equal(guardado.has('gi_convite'), false, 'a ligação esqueceu-se');
    a.CW.modoDaEntrada('register');
    assert.match(a.authEl.innerHTML, /role="alert">Essa ligação já foi usada/, 'trocar de separador não apaga o erro');
  });
});
