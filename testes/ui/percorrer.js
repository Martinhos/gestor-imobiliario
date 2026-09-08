/* Percorre a app e verifica o interface em cada estado.
   ----------------------------------------------------
     node testes/ui/percorrer.js [url]        (por omissão http://127.0.0.1:8788)
     node testes/ui/percorrer.js --sem-fotos  só as regras, sem capturas

   Faz duas coisas de cada vez:

   1. Verifica invariantes — nada transborda, os menus cabem, os modais
      cobrem o que está por trás e não deixam passar o toque. São regras
      duras: falham o processo. Cada uma nasceu de um defeito real.

   2. Guarda uma captura e um resumo de cada estado em testes/ui/relatorio/,
      para o avaliar.js os dar a ler a um modelo. A qualidade de um interface
      não cabe numa asserção; o que cabe é a estabilidade.

   Precisa da app a correr. Em CI é o workflow que a levanta. */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const invariantes = require('./invariantes.js');

const URL_BASE = process.argv.find((a) => a.startsWith('http')) || 'http://127.0.0.1:8788';
const SEM_FOTOS = process.argv.includes('--sem-fotos');
const SAIDA = path.join(__dirname, 'relatorio');

const ECRAS = [
  { nome: 'telemovel', width: 375, height: 812 },
  { nome: 'telemovel-deitado', width: 915, height: 412 },
  { nome: 'computador', width: 1440, height: 900 },
];

const VISTAS = ['dashboard', 'properties', 'contracts', 'transactions', 'recurring', 'tenants', 'settings'];

// Estados que só existem depois de mexer: modais, menus abertos, modo de edição.
const CENAS = [
  { nome: 'modal-movimento', fazer: `txModal(null,'expense')` },
  { nome: 'modal-imovel', fazer: `propModal()` },
  { nome: 'modal-contrato', fazer: `ctModal()` },
  { nome: 'modal-pessoa', fazer: `personModal('tenant')` },
  {
    nome: 'menu-no-fundo-do-modal',
    fazer: `txModal(null,'expense');
      [...document.querySelectorAll('.modal.open .fold-head')].forEach(h=>h.click());
      const b=document.querySelector('.modal.open .body');
      const s=[...document.querySelectorAll('.modal.open .selbtn')].filter(x=>x.offsetParent).pop();
      if(s){ const r=b.getBoundingClientRect(); b.scrollTop += s.getBoundingClientRect().top-(r.bottom-55); s.click(); }`,
  },
  {
    nome: 'modais-empilhados',
    fazer: `txModal(null,'expense'); pickModal('Escolhe',[{v:1,label:'Um'},{v:2,label:'Dois'}],()=>{})`,
  },
  { nome: 'painel-de-filtros', fazer: `go('properties'); render(); document.getElementById('hdrFilt').click()` },
  { nome: 'novidades', fazer: `CW.verNovidades(AVISOS.slice(0,1))` },
  { nome: 'tutorial', fazer: `CW.guiaAbrir('imoveis')` },
  {
    // o caso que estava partido: o cartão ficava por baixo da janela
    nome: 'tutorial-sobre-janela',
    fazer: `CW.guiaAbrir('perfil'); propModal();`,
  },
  {
    nome: 'primeiros-passos',
    fazer: `localStorage.removeItem('gi_passos_fora'); go('dashboard'); render();`,
  },
  { nome: 'edicao-dos-cartoes', fazer: `go('dashboard'); render(); CW.enterEdit()` },
  { nome: 'selo-por-enviar', fazer: `go('dashboard'); render(); setSyncBadge('pend',3)` },
  { nome: 'selo-sem-ligacao', fazer: `go('dashboard'); render(); setSyncBadge('off')` },
  { nome: 'selo-guardado', fazer: `go('dashboard'); render(); setSyncBadge('ok')` },
  {
    /* Andar no calendario, que e o gesto desta vista. O percurso passava por
       ca e nunca mudava de mes: tres defeitos seguidos nesta zona nao podiam
       falhar em CI, porque o ecra estava coberto e os gestos nao. */
    nome: 'calendario-mes-seguinte',
    fazer: `go('calendar'); render();
      const m0=document.querySelector('#view .toolbar b').textContent.trim();
      calNav(1);
      const m1=document.querySelector('#view .toolbar b').textContent.trim();
      if(m0===m1) throw new Error('o mes nao mudou: ' + m0);`,
  },
  {
    /* O caso que falhou a serio: voltar ao mes de hoje pela SETA deixa o calMes
       posto (com o mes de hoje la dentro), e o botao ficava no ecra sem nada
       para fazer. Duas voltas, uma para cada lado. */
    nome: 'calendario-voltar-pela-seta',
    fazer: `go('calendar'); render();
      calNav(1); calNav(-1);
      calNav(-1); calNav(1);`,
  },
  {
    nome: 'calendario-botao-hoje',
    fazer: `go('calendar'); render();
      calNav(2);
      const b=[...document.querySelectorAll('#view .toolbar .btn')].find(x=>x.textContent.trim()==='Hoje');
      if(!b) throw new Error('dois meses a frente e sem botao Hoje');
      b.click();`,
  },
  {
    /* Escolher um dia repinta so o painel de baixo (calSel), sem passar pelo
       render — e um dos tres repintes locais da app. */
    nome: 'calendario-dia-escolhido',
    fazer: `go('calendar'); render();
      const d=[...document.querySelectorAll('#view .calday.tap')];
      if(d.length<8) throw new Error('a grelha do mes tem ' + d.length + ' dias tocaveis');
      d[7].click();
      if(!document.querySelector('#view .calday.on')) throw new Error('nenhum dia ficou escolhido');`,
  },
  {
    /* O caminho curto: mudar o que se ve sem passar pelo render. E aqui que
       uma linha pode ficar sem as decoracoes da nuvem e ninguem dar por isso —
       a lista fica certa a olho e o kebab desapareceu. */
    nome: 'movimentos-filtrados-sem-render',
    fazer: `go('transactions'); render();
      const n0=document.querySelectorAll('#view .txrow').length;
      if(!n0) throw new Error('a vista dos Movimentos nao tem linhas');
      txSearch='a'; refrescarMovimentos();
      const n1=document.querySelectorAll('#view .txrow').length;
      if(n1===0) throw new Error('a pesquisa deixou a lista vazia: a cena nao prova nada');
      if(n1>n0) throw new Error('a pesquisa devolveu mais linhas do que havia');`,
  },
  {
    /* E o mesmo com a selecao ligada: as linhas refeitas nascem sem a marca, e
       e o motor que tem de a repor. */
    nome: 'movimentos-filtrados-em-selecao',
    fazer: `go('transactions'); render();
      const l=document.querySelector('#view .txrow');
      if(!l) throw new Error('a vista dos Movimentos nao tem linhas');
      CW.selEntrar(l.getAttribute('data-tx'));
      txSearch='a'; refrescarMovimentos();`,
  },
  {
    nome: 'selecao-de-movimentos',
    fazer: `go('transactions'); render();
      const l=document.querySelector('#view .txrow');
      if(!l) throw new Error('a vista dos Movimentos não tem linhas: a cena não prova nada');
      CW.selEntrar(l.getAttribute('data-lp').replace('tx:',''));`,
  },
  {
    /* Marcar várias e repintar por OUTRO caminho que não o de entrar em
       seleção. O selToggle só repinta as marcas (selPintar), sem regerar
       linha nenhuma; o render a seguir regera-as todas, e as marcas têm de lá
       estar à mesma. Uma cena que apenas entrasse em seleção não provava
       nada: o CW.selEntrar já repinta por dentro. */
    nome: 'selecao-marcada-sobrevive-a-repintura',
    fazer: `go('transactions'); render();
      const ls=[...document.querySelectorAll('#view .txrow')];
      if(ls.length<3) throw new Error('sem movimentos que cheguem para marcar (' + ls.length + ')');
      CW.selEntrar(ls[0].getAttribute('data-tx'));
      [...document.querySelectorAll('#view .txrow')].slice(1,3)
        .forEach(l=>CW.selToggle(l.getAttribute('data-tx')));
      txDir = txDir==='desc' ? 'asc' : 'desc';   // uma repintura que não vem da seleção
      render();`,
  },
  {
    nome: 'selecao-com-tudo-marcado',
    fazer: `go('transactions'); render();
      const l=document.querySelector('#view .txrow');
      if(!l) throw new Error('a vista dos Movimentos não tem linhas: a cena não prova nada');
      CW.selEntrar(l.getAttribute('data-lp').replace('tx:','')); CW.selTodos();`,
  },
];

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function limpar(pagina) {
  await pagina.evaluate(`(() => {
    try { closeAllModals(); } catch (e) {}
    try { closePops(); } catch (e) {}
    try { if (CW.editMode) CW.exitEdit(true); } catch (e) {}
    document.getElementById('cwUpdBar')?.remove();
    document.getElementById('cwLegal')?.remove();
    document.getElementById('cwTerms')?.remove();
  })()`);
}

async function entrar(pagina) {
  /* Entra pelo formulário, como uma pessoa entraria.

     A primeira versão chamava a API de entrada por fetch. A sessão ficava no
     cookie, mas o cliente guarda o utilizador em localStorage — e sem isso
     continuava a mostrar o ecrã de entrada. O percurso corria as 48 cenas
     todas sobre o ecrã de entrada e dava tudo verde, que é pior do que
     falhar. Daí o formulário, e daí o confirmar() lá em baixo. */
  const EMAIL = 'percurso-ui@teste.local';
  const SENHA = 'Percurso#2026';

  await pagina.goto(URL_BASE, { waitUntil: 'networkidle' });
  await dormir(1200);

  if (!(await pagina.evaluate('!!(window.CW && CW.user)'))) {
    const temForm = await pagina.$('#cwa_email');
    if (!temForm) throw new Error('sem sessão e sem formulário de entrada');

    await pagina.fill('#cwa_email', EMAIL);
    await pagina.fill('#cwa_pass', SENHA);
    await pagina.evaluate('CW.submitAuth()');
    await dormir(1800);

    // conta ainda não existe: criar pelo formulário de registo
    if (!(await pagina.evaluate('!!(window.CW && CW.user)'))) {
      await pagina.evaluate(`CW.showAuthMode = 'register'; CW.showAuth();`).catch(() => {});
      await dormir(400);
      if (!(await pagina.$('#cwa_name'))) {
        const b = await pagina.$('text=Ainda não tenho conta');
        if (b) { await b.click(); await dormir(400); }
      }
      await pagina.fill('#cwa_name', 'Percurso UI');
      await pagina.fill('#cwa_email', EMAIL);
      await pagina.fill('#cwa_pass', SENHA);
      await pagina.fill('#cwa_pass2', SENHA);
      await pagina.check('#cwa_terms');
      await pagina.evaluate('CW.submitAuth()');
      await dormir(2200);
    }
  }

  if (!(await pagina.evaluate('!!(window.CW && CW.user)'))) {
    /* A mensagem no ecrã é a da última tentativa — normalmente a do registo,
       que diz "já existe uma conta com este email" e faz parecer que o
       problema é esse. O que costuma estar por trás é o tecto de tentativas
       de entrada. Diz-se o que o servidor respondeu de facto. */
    const diz = await pagina.evaluate(`(async () => {
      const r = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: '${EMAIL}', password: '${SENHA}' }),
      });
      return r.status + ' ' + (await r.text()).slice(0, 120);
    })()`);
    throw new Error('não deu para entrar. A entrada responde: ' + diz);
  }

  // fechar os avisos de primeira abertura, que não são o objeto deste percurso
  await pagina.evaluate(`(() => { try { CW.acceptLegal && CW.acceptLegal(); } catch (e) {} })()`);
  await dormir(400);
  await preparar(pagina);
}

/* Dados de exemplo: sem eles as vistas estão vazias e não há nada que medir.

   Com insistência de propósito. A sincronização inicial chega depois do
   arranque e pode passar por cima do que se semeou — semear uma vez e seguir
   em frente dava um percurso sobre uma app vazia. */
async function preparar(pagina) {
  /* Em producao os dados de exemplo sao recusados de proposito. O percurso
     precisa deles para ter o que medir, por isso corre contra um ambiente
     marcado -- e diz-se porque, em vez de falhar mais a frente com um
     "sem dados" que nao explica nada. */
  const amb = await pagina.evaluate('(window.CW && CW.ambiente) || "?"');
  if (amb === 'producao') {
    throw new Error('a app diz estar em producao, onde os dados de exemplo sao recusados.\n' +
      'Levanta-a com: npx wrangler dev --port 8788 --var ENV_NAME:percurso');
  }
  for (let i = 0; i < 6; i++) {
    const n = await pagina.evaluate(`(typeof db !== 'undefined' && db.properties) ? db.properties.length : 0`);
    if (n > 0) break;
    await pagina.evaluate(`(() => { try { seed(); } catch (e) {} })()`);
    await dormir(1000);
  }
  await dormir(400);
  await limpar(pagina);
}

/* Antes de medir seja o que for, confirmar que estamos mesmo dentro da app e
   com dados à frente. É o que impede um percurso de dar verde sobre o ecrã
   de entrada. */
async function confirmar(pagina, onde) {
  const e = await pagina.evaluate(`({
    sessao: !!(window.CW && CW.user),
    // o hideAuth() só esconde o elemento, não o remove: conta a visibilidade
    entrada: (() => { const e = document.getElementById('cwAuth');
      return !!e && getComputedStyle(e).display !== 'none'; })(),
    vista: (document.getElementById('view') || {}).children ? document.getElementById('view').children.length : 0,
    // o db é declarado com let: existe no âmbito global mas não em window.db,
    // e olhar para window.db dava sempre "sem dados"
    imoveis: (typeof db !== 'undefined' && db.properties) ? db.properties.length : -1,
    /* nos Movimentos, uma lista vazia desliga em silêncio a regra das linhas
       (invariantes.js) e as cenas de seleção: passa a haver verde sem haver
       verificação nenhuma */
    movimentos: (typeof tab !== 'undefined' && tab === 'transactions')
      ? document.querySelectorAll('#view .txrow').length : -1,
  })`);
  const mal = [];
  if (!e.sessao) mal.push('sem sessão');
  if (e.entrada) mal.push('ecrã de entrada à frente');
  if (!e.vista) mal.push('vista vazia');
  if (e.imoveis <= 0) mal.push('sem dados de exemplo');
  if (e.movimentos === 0) mal.push('nos Movimentos sem uma única linha');
  if (mal.length) throw new Error('estado inválido em "' + onde + '": ' + mal.join(', '));
}

async function verificar(pagina, estado, ecra) {
  await confirmar(pagina, ecra + ' · ' + estado);
  const r = await pagina.evaluate(invariantes.fonte());
  const nome = ecra + '__' + estado;
  if (!SEM_FOTOS) {
    await pagina.screenshot({ path: path.join(SAIDA, nome + '.png'), fullPage: false });
  }
  return { estado, ecra, ...r };
}

(async () => {
  fs.rmSync(SAIDA, { recursive: true, force: true });
  fs.mkdirSync(SAIDA, { recursive: true });

  const navegador = await chromium.launch();
  const resultados = [];
  const erros = [];

  for (const ecra of ECRAS) {
    const ctx = await navegador.newContext({
      viewport: { width: ecra.width, height: ecra.height },
      colorScheme: 'dark',
      deviceScaleFactor: 1,
    });
    const pagina = await ctx.newPage();
    pagina.on('pageerror', (e) => erros.push({ ecra: ecra.nome, erro: String(e.message).slice(0, 200) }));
    pagina.on('console', (m) => { if (m.type() === 'error') erros.push({ ecra: ecra.nome, consola: m.text().slice(0, 200) }); });

    await entrar(pagina);

    for (const v of VISTAS) {
      await pagina.evaluate(`go('${v}'); render();`);
      await dormir(250);
      resultados.push(await verificar(pagina, 'vista-' + v, ecra.nome));
    }

    for (const c of CENAS) {
      await limpar(pagina);
      await pagina.evaluate(`go('dashboard'); render();`);
      await dormir(150);
      try { await pagina.evaluate(`(() => { ${c.fazer} })()`); } catch (e) {
        erros.push({ ecra: ecra.nome, cena: c.nome, erro: String(e.message).slice(0, 200) });
        continue;
      }
      await dormir(350);
      resultados.push(await verificar(pagina, c.nome, ecra.nome));
    }

    await limpar(pagina);
    await ctx.close();
  }
  await navegador.close();

  const falhas = resultados.filter((r) => r.falhas.length);
  const resumo = {
    url: URL_BASE,
    estados: resultados.length,
    ecras: ECRAS.map((e) => e.nome),
    errosDeConsola: erros,
    falhas: falhas.map((f) => ({ ecra: f.ecra, estado: f.estado, falhas: f.falhas })),
    medidas: resultados.map((r) => ({ ecra: r.ecra, estado: r.estado, ...r.medidas })),
  };
  fs.writeFileSync(path.join(SAIDA, 'resumo.json'), JSON.stringify(resumo, null, 2));

  console.log(resultados.length + ' estados verificados em ' + ECRAS.length + ' ecrãs.');
  if (erros.length) {
    console.log('\nerros na consola (' + erros.length + '):');
    erros.slice(0, 8).forEach((e) => console.log('  ' + JSON.stringify(e)));
  }
  if (falhas.length) {
    console.error('\ninvariantes quebrados:');
    falhas.forEach((f) => f.falhas.forEach((x) =>
      console.error('  [' + f.ecra + ' · ' + f.estado + '] ' + x.regra + ' — ' + x.detalhe)));
    process.exit(1);
  }
  console.log('todos os invariantes cumpridos.');
  if (!SEM_FOTOS) console.log('capturas e resumo em testes/ui/relatorio/');
})().catch((e) => { console.error(e); process.exit(1); });
