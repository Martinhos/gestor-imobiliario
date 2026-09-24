// Os guardas da entrega: o que o deploy confere antes e depois de publicar.
//
//   node scripts/entrega.js testes              espera pelo «Testes» deste commit e só deixa seguir se ficou verde
//   node scripts/entrega.js plano <plano.json>  lê o plano do terraform (terraform show -json) e recusa destruições
//   node scripts/entrega.js publicacao <url>    confirma que <url> responde a versão acabada de gerar
//
// Três perguntas que o deploy não fazia a ninguém: os testes deste commit
// passaram? o terraform vai apagar alguma coisa? o que se publicou está mesmo
// a responder? Cada resposta é uma função pura — é o que os testes exercitam
// (testes/correcao-entrega.test.js) — com um bocado de rede à volta, que só o
// deploy corre. Sem dependências: o fetch do Node chega.

const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');

/* ------------------------------ os testes -------------------------------- */

/* O estado do «Testes» de um commit, a partir das corridas dele. A mesma árvore
   pode ter várias: a do push a dev e a do push a main num avanço rápido, ou
   uma repetição pedida à mão. Basta uma verde; enquanto houver uma a correr,
   espera-se; só com todas acabadas e nenhuma verde é que trava.
   Recebe: corridas — array de {status, conclusion} da API das Actions.
   Devolve: 'verde' | 'a correr' | 'vermelho' | 'nenhuma'. */
function estadoDosTestes(corridas) {
  if (!corridas.length) return 'nenhuma';
  if (corridas.some((c) => c.status === 'completed' && c.conclusion === 'success')) return 'verde';
  if (corridas.some((c) => c.status !== 'completed')) return 'a correr';
  return 'vermelho';
}

/* Pergunta de tempos a tempos como está o «Testes» deste commit, até acabar.
   Um erro da API não decide nada: volta-se a perguntar.
   Recebe: o — {pedir: () => Promise de array de corridas (lança em erro),
   dormir: (ms) => Promise, intervalo: ms entre perguntas, voltas: máximo de
   perguntas, semCorrida: quantas respostas vazias se aceitam antes de desistir,
   evento: 'push' | 'workflow_dispatch', escrever: (texto) => void}.
   Devolve: Promise de {ok, motivo} — ok false trava a publicação. */
async function esperarTestes(o) {
  let vazias = 0;
  for (let i = 0; i < o.voltas; i++) {
    let corridas = null;
    try {
      corridas = await o.pedir();
    } catch (e) {
      o.escrever('a API das Actions não respondeu (' + e.message + ') — volto a perguntar');
    }
    if (corridas) {
      const estado = estadoDosTestes(corridas);
      if (estado === 'verde') return { ok: true, motivo: 'os testes deste commit passaram.' };
      if (estado === 'vermelho') {
        return { ok: false, motivo: 'os testes deste commit falharam — não se publica: ' +
          corridas.map((c) => c.html_url).filter(Boolean).join(' ') };
      }
      if (estado === 'nenhuma' && ++vazias >= o.semCorrida) {
        return {
          ok: false,
          motivo: o.evento === 'workflow_dispatch'
            ? 'este commit não tem corrida do «Testes» (um commit do estado do terraform, por exemplo, não dispara ' +
              'workflows). Corre o «Testes» neste ramo (Actions → Testes → Run workflow) e, quando ficar verde, ' +
              'volta a correr o Deploy.'
            : 'o «Testes» não arrancou para este commit — confirma que o testes.yml corre em push a este ramo.',
        };
      }
      o.escrever(estado === 'nenhuma' ? 'o «Testes» deste commit ainda não apareceu…' : 'o «Testes» ainda está a correr…');
    }
    await o.dormir(o.intervalo);
  }
  return { ok: false, motivo: 'o «Testes» deste commit não acabou a tempo — não se publica às cegas.' };
}

/* ------------------------------ o plano ---------------------------------- */

/* O que um plano do terraform vai fazer, lido do JSON do `terraform show -json`.
   Uma substituição aparece como ["delete","create"] (ou ao contrário) e é tão
   destruição como um destroy: a D1 nova nasce vazia. Um recurso só com
   «no-op» (o file_size refrescado, por exemplo) não muda nada.
   Recebe: plano — o objeto do plano; aceites — os endereços que se aceitou
   destruir, escritos à mão no dispatch (array de texto; vazio num push).
   Devolve: {muda, destruir, recusadas} — muda: há alguma coisa a aplicar;
   destruir: os endereços que o plano apaga; recusadas: os que não foram aceites. */
function analisarPlano(plano, aceites) {
  const recursos = plano.resource_changes || [];
  const acoes = (c) => (c && c.actions) || [];
  const parado = (lista) => lista.every((a) => a === 'no-op' || a === 'read');
  const destruir = recursos.filter((r) => acoes(r.change).includes('delete')).map((r) => r.address);
  return {
    muda: recursos.some((r) => !parado(acoes(r.change))) ||
      Object.values(plano.output_changes || {}).some((s) => !parado(acoes(s))),
    destruir,
    recusadas: destruir.filter((a) => !aceites.includes(a)),
  };
}

/* --------------------------- a publicação -------------------------------- */

/* Duas versões são a mesma? Os três campos que o versao.js escreve.
   Recebe: a, b — objetos do /versao.json.
   Devolve: true se versão, mínima e data coincidem. */
function mesmaVersao(a, b) {
  return Number(a.versao) === Number(b.versao) && Number(a.minima) === Number(b.minima) && a.data === b.data;
}

/* O que diz uma tentativa de ler a publicação. A raiz passa pelo worker
   (run_worker_first no wrangler.toml), por isso um 5xx lá é o código novo
   partido; o /versao.json é um ficheiro estático e diz que versão está servida.
   Recebe: t — {versaoStatus, versao (objeto ou null), raizStatus}, com 0 quando
   não houve resposta; esperado — o objeto do web/versao.json gerado neste deploy.
   Devolve: 'ok' | 'avaria' (5xx) | 'outra-versao' (responde, mas a antiga) |
   'sem-resposta' (nada, ou um estado que não diz nada sobre o worker, como 403). */
function classificar(t, esperado) {
  if (t.versaoStatus >= 500 || t.raizStatus >= 500) return 'avaria';
  if (t.versaoStatus === 200 && t.versao) {
    if (!mesmaVersao(t.versao, esperado)) return 'outra-versao';
    if (t.raizStatus === 200) return 'ok';
  }
  return 'sem-resposta';
}

/* Um GET que nunca lança: sem resposta é status 0.
   Recebe: url — o endereço.
   Devolve: Promise de {status, texto}. */
async function pedirHttp(url) {
  try {
    const r = await fetch(url, {
      headers: { 'user-agent': 'rendorium-deploy (GitHub Actions)', 'cache-control': 'no-cache' },
      signal: AbortSignal.timeout(15000),
    });
    return { status: r.status, texto: await r.text() };
  } catch (e) {
    return { status: 0, texto: '' };
  }
}

/* Confirma que a publicação está a responder com a versão acabada de gerar,
   com algumas tentativas: a versão nova chega aos pontos de presença em
   segundos, não à primeira.
   Recebe: o — {base: o endereço do ambiente, sem barra no fim; esperado: o
   objeto do web/versao.json; pedir: (url) => Promise de {status, texto};
   dormir: (ms) => Promise; intervalo: ms; tentativas: número; escrever: (texto) => void}.
   Devolve: Promise de {veredicto, detalhe} — o veredicto é o da última tentativa
   (ver classificar), ou 'ok' à primeira que confirme. */
async function confirmarPublicacao(o) {
  let veredicto = 'sem-resposta', detalhe = '';
  for (let i = 1; i <= o.tentativas; i++) {
    // o número na pergunta fura qualquer cache pelo caminho; os assets ignoram-no
    const v = await o.pedir(o.base + '/versao.json?publicacao=' + Date.now() + '-' + i);
    const r = await o.pedir(o.base + '/');
    let versao = null;
    try { versao = JSON.parse(v.texto); } catch (e) { versao = null; }
    veredicto = classificar({ versaoStatus: v.status, versao, raizStatus: r.status }, o.esperado);
    detalhe = '/versao.json → ' + (v.status || 'sem resposta') +
      (versao && versao.versao !== undefined ? ' (versão ' + versao.versao + ')' : '') +
      ', / → ' + (r.status || 'sem resposta');
    if (veredicto === 'ok') return { veredicto, detalhe };
    o.escrever('tentativa ' + i + ' de ' + o.tentativas + ': ' + detalhe);
    if (i < o.tentativas) await o.dormir(o.intervalo);
  }
  return { veredicto, detalhe };
}

/* ------------------------------ a linha de comandos ---------------------- */

/* Acrescenta uma linha a um dos ficheiros que o GitHub Actions dá aos passos
   (GITHUB_OUTPUT, GITHUB_STEP_SUMMARY); fora do Actions não faz nada.
   Recebe: variavel — o nome da variável de ambiente com o caminho; texto — a linha.
   Devolve: nada. */
function paraOActions(variavel, texto) {
  if (process.env[variavel]) fs.appendFileSync(process.env[variavel], texto + '\n');
}

/* O comando «testes»: pergunta à API das Actions pelas corridas do testes.yml
   deste commit (GITHUB_SHA), com o token do workflow.
   Devolve: Promise do código de saída (0 segue, 1 trava). */
async function comandoTestes() {
  const api = process.env.GITHUB_API_URL || 'https://api.github.com';
  const url = api + '/repos/' + process.env.GITHUB_REPOSITORY +
    '/actions/workflows/testes.yml/runs?head_sha=' + process.env.GITHUB_SHA + '&per_page=100';
  const r = await esperarTestes({
    pedir: async () => {
      const resp = await fetch(url, {
        headers: {
          authorization: 'Bearer ' + process.env.GITHUB_TOKEN,
          accept: 'application/vnd.github+json',
          'x-github-api-version': '2022-11-28',
          'user-agent': 'rendorium-deploy',
        },
        signal: AbortSignal.timeout(20000),
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return (await resp.json()).workflow_runs || [];
    },
    dormir: (ms) => new Promise((ok) => setTimeout(ok, ms)),
    intervalo: 20000,
    voltas: 120,          // 40 minutos
    semCorrida: 15,       // 5 minutos à espera de que a corrida apareça
    evento: process.env.GITHUB_EVENT_NAME,
    escrever: (t) => console.log(t),
  });
  console.log((r.ok ? 'segue: ' : 'NÃO SEGUE: ') + r.motivo);
  return r.ok ? 0 : 1;
}

/* O comando «plano»: lê o plano, recusa o que destrói sem aceitação, e diz
   no stdout, numa palavra, se há alguma coisa a aplicar («muda» ou «nada») —
   o resto vai para o stderr, que é o que o log mostra.
   Recebe: ficheiro — o JSON do terraform show -json.
   Devolve: o código de saída (0 segue, 1 trava). */
function comandoPlano(ficheiro) {
  const aceites = (process.env.ACEITAR_DESTRUICAO || '').split(/[\s,]+/).filter(Boolean);
  const a = analisarPlano(JSON.parse(fs.readFileSync(ficheiro, 'utf8')), aceites);
  if (a.recusadas.length) {
    console.error('O plano destrói ou substitui recursos, e ninguém o aceitou:\n' +
      a.recusadas.map((x) => '  · ' + x).join('\n') +
      '\n\nNada foi aplicado. Uma substituição de uma base ou de um balde é perder os dados que lá estão.\n' +
      'Se é mesmo isso que se quer: tirar o prevent_destroy do recurso no terraform/main.tf, num commit, e\n' +
      'correr o Deploy à mão (workflow_dispatch) com os endereços em «aceitar_destruicao».');
    return 1;
  }
  if (a.destruir.length) console.error('Destruição aceite à mão: ' + a.destruir.join(', '));
  console.error(a.muda ? 'O plano muda recursos — aplica-se.' : 'O plano não muda nada.');
  console.log(a.muda ? 'muda' : 'nada');
  return 0;
}

/* O comando «publicacao»: confirma o ambiente em <base> contra o
   web/versao.json deste deploy; o veredicto sai para o passo seguinte (o do
   recuo) e, em falha, o caminho de recuo vai para o resumo da corrida.
   Recebe: base — o endereço do ambiente (https://app.rendorium.com); ritmo
   (opcional) — {tentativas, intervalo}, para os testes; o deploy usa 12 e 10 s.
   Devolve: Promise do código de saída (0 confirmado, 1 não). */
async function comandoPublicacao(base, ritmo) {
  const esperado = JSON.parse(fs.readFileSync(path.join(raiz, 'web', 'versao.json'), 'utf8'));
  const r = await confirmarPublicacao({
    base: base.replace(/\/+$/, ''),
    esperado,
    pedir: pedirHttp,
    dormir: (ms) => new Promise((ok) => setTimeout(ok, ms)),
    intervalo: (ritmo && ritmo.intervalo) || 10000,
    tentativas: (ritmo && ritmo.tentativas) || 12,
    escrever: (t) => console.log(t),
  });
  paraOActions('GITHUB_OUTPUT', 'veredicto=' + r.veredicto);
  if (r.veredicto === 'ok') {
    console.log('publicado: ' + base + ' responde a versão ' + esperado.versao + ' (' + r.detalhe + ')');
    return 0;
  }
  const porque = {
    avaria: 'o worker novo responde com erro — o passo seguinte volta à versão anterior.',
    'outra-versao': 'responde, mas com outra versão — a nova não chegou. Não se recua sozinho: a que responde já é a anterior.',
    'sem-resposta': 'não responde, ou responde com algo que não diz nada sobre o worker (um 403 de uma regra da zona, por exemplo). Não se recua sozinho.',
  }[r.veredicto];
  console.error('NÃO CONFIRMADO: ' + base + ' — ' + porque + '\núltima tentativa: ' + r.detalhe);
  paraOActions('GITHUB_STEP_SUMMARY', '### A publicação não se confirmou\n\n' + base + ' — ' + porque +
    '\n\nÚltima tentativa: ' + r.detalhe + '\n\nO caminho de recuo está no README, em «Se uma publicação correu mal».');
  return 1;
}

if (require.main === module) {
  const [comando, arg] = process.argv.slice(2);
  const correr = {
    testes: () => comandoTestes(),
    plano: () => comandoPlano(arg),
    publicacao: () => comandoPublicacao(arg),
  }[comando];
  if (!correr || (comando !== 'testes' && !arg)) {
    console.error('uso: node scripts/entrega.js testes | plano <plano.json> | publicacao <url>');
    process.exit(2);
  }
  Promise.resolve(correr()).then((codigo) => process.exit(codigo), (e) => { console.error(e); process.exit(1); });
}

module.exports = {
  estadoDosTestes, esperarTestes, analisarPlano, mesmaVersao, classificar, pedirHttp, confirmarPublicacao,
  comandoTestes, comandoPlano, comandoPublicacao,
};
