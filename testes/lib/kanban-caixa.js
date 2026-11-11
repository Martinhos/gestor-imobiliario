// A caixa onde os testes do kanban correm o guião do browser (worker/src/equipa-kanban.js
// e os pedaços dele): o mínimo do browser e os globais do guião principal de que
// precisa, para lhe chamar as funções puras. Cada teste novo do kanban importa-a
// daqui, em vez de a copiar.

import vm from 'node:vm';
import { GUIAO_KANBAN } from '../../worker/src/equipa-kanban.js';

/* Corre o guião do kanban numa caixa com o mínimo do browser e os globais
   do guião principal de que precisa, para lhe chamar as funções puras.
   Devolve: o contexto (as funções e as var de topo ficam nele). */
export function caixa() {
  const ctx = {
    ICONES: {}, ACOES: {}, eu: { nome: 'Eu', discordId: 'eu1', master: false, cats: ['user'] },
    document: { addEventListener() {}, getElementById() { return null; } },
    window: { addEventListener() {} },
    sessionStorage: { getItem() { return null; }, setItem() {} },
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])),
    maiuscula: (t) => { t = String(t || ''); return t.charAt(0).toUpperCase() + t.slice(1); },
    // as peças do guião principal que o HTML do cartão usa, na forma que ele as escreve
    badge: (tom, html) => '<span class="badge' + (tom ? ' ' + tom : '') + '">' + html + '</span>',
    ic: (nome) => '<svg class="i" data-ic="' + nome + '"></svg>',
    ligarA: (tipo, nome, args) => ' data-' + tipo + '="' + nome + '"' + (args || []).map((v, i) => ' data-arg' + (i ? i + 1 : '') + '="' + v + '"').join(''),
    comAcao: (nome, args) => ' data-acao="' + nome + '"' + (args || []).map((v, i) => ' data-arg' + (i ? i + 1 : '') + '="' + v + '"').join(''),
    data: (t) => (t ? 'dia ' + t : '—'),
    iniciais: (t) => String(t || '?').slice(0, 2).toUpperCase(),
    curto: (id) => String(id || '').replace(/-/g, '').slice(0, 8).toUpperCase(),
    // o travão da página por baixo da janela (equipa-guiao.js:travarPagina): o browser tranca; aqui não faz nada
    travarPagina() {},
  };
  vm.createContext(ctx);
  vm.runInContext(GUIAO_KANBAN, ctx);
  return ctx;
}
