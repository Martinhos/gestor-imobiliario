// A regra dos formulários, lida do HTML de cada janela: um campo obrigatório
// leva o asterisco vermelho no rótulo (<span class="req">*</span>) e nunca diz
// «opcional»; um campo opcional diz «Opcional» no placeholder — ou, quando o
// placeholder é um exemplo que vale a pena manter, diz «(opcional)» no
// rótulo; e todo o exemplo começa por «Ex: ». Partilhada pelos testes dos
// formulários de cada área, para a regra ser uma só.

import assert from 'node:assert/strict';

/* O prefixo de um exemplo, tal como o Martinho o pediu. */
export const EX = 'Ex: ';

/* Os campos de um formulário, lidos do HTML: id, tipo, placeholder, o
   rótulo (o texto do <label> que embrulha o campo, sem o asterisco), se o
   rótulo tem o asterisco dos obrigatórios, e se é um campo de texto (só
   esses levam placeholder). Ficam de fora as caixas, os ficheiros, os
   inputs escondidos dos sel() e a pesquisa.
   Recebe: html — o corpo do formulário.
   Devolve: [{id, type, placeholder, rotulo, obrig, texto}]. */
export function campos(html) {
  const out = [];
  const re = /<(input|textarea)\b([^>]*)>/g;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[2];
    const attr = (n) => { const x = new RegExp('\\b' + n + '="([^"]*)"').exec(attrs); return x ? x[1] : ''; };
    const type = attr('type') || 'text';
    if (m[1] === 'input' && ['checkbox', 'radio', 'file', 'hidden', 'search'].includes(type)) continue;
    const antes = html.slice(0, m.index);
    const abre = antes.lastIndexOf('<label'), fecha = antes.lastIndexOf('</label>');
    let rotulo = '', obrig = false;
    if (abre > fecha) {
      const cru = antes.slice(antes.indexOf('>', abre) + 1);
      obrig = /<span class="req">\*<\/span>/.test(cru);
      rotulo = cru.replace(/<[^>]+>/g, '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
    }
    const texto = m[1] === 'textarea' || ['text', 'email', 'tel', 'password'].includes(type);
    out.push({ id: attr('id'), type, placeholder: attr('placeholder'), rotulo, obrig, texto });
  }
  return out;
}

/* Confere um formulário contra a sua validação:
   - cada obrigatório tem o asterisco no rótulo, não diz «opcional» em lado
     nenhum, e o placeholder, se o tiver, é um exemplo («Ex: …»);
   - cada campo com exemplo começa por «Ex: » e tem «(opcional)» no rótulo;
   - os outros campos de texto dizem «Opcional» no placeholder;
   - nenhum campo que não esteja nos obrigatórios leva o asterisco.
   Recebe: nome — para as mensagens; html — o corpo; o — {obrigatorios: ids
   (de texto ou não: uma data obrigatória também leva o asterisco), exemplos:
   {id: o placeholder esperado, ou true para «qualquer exemplo»}, deixados:
   prefixos de ids que não se julgam (linhas sem rótulo)}.
   Devolve: os campos lidos, para quem quiser olhar mais. */
export function conferir(nome, html, o) {
  const cs = campos(html);
  const exemplos = o.exemplos || {}, deixados = o.deixados || [];
  assert.ok(cs.length, nome + ': há campos');
  for (const id of o.obrigatorios) assert.ok(cs.some((c) => c.id === id), nome + ': o obrigatório ' + id + ' está no formulário');
  for (const id of Object.keys(exemplos)) assert.ok(cs.some((c) => c.id === id), nome + ': o campo com exemplo ' + id + ' está no formulário');
  for (const c of cs) {
    const opc = /\(opcional\)|[,;] opcional\b|\(opcional[,;]/.test(c.rotulo);
    if (o.obrigatorios.includes(c.id)) {
      assert.ok(c.obrig, nome + ': ' + c.id + ' («' + c.rotulo + '») é obrigatório e não tem o asterisco vermelho');
      assert.notEqual(c.placeholder, 'Opcional', nome + ': ' + c.id + ' é obrigatório e diz «Opcional»');
      assert.ok(!opc, nome + ': ' + c.id + ' é obrigatório e o rótulo diz «opcional»');
      if (c.placeholder) assert.ok(c.placeholder.startsWith(EX), nome + ': ' + c.id + ' — o exemplo «' + c.placeholder + '» não começa por «' + EX + '»');
      continue;
    }
    if (deixados.some((p) => c.id.startsWith(p))) continue;
    assert.ok(!c.obrig, nome + ': ' + c.id + ' («' + c.rotulo + '») tem asterisco e não é obrigatório');
    if (!c.texto) continue;
    if (c.id in exemplos) {
      assert.ok(c.placeholder.startsWith(EX), nome + ': ' + c.id + ' — o exemplo «' + c.placeholder + '» não começa por «' + EX + '»');
      if (exemplos[c.id] !== true) assert.equal(c.placeholder, exemplos[c.id], nome + ': ' + c.id + ' mantém o exemplo');
      assert.ok(opc, nome + ': ' + c.id + ' tem exemplo e o rótulo «' + c.rotulo + '» não diz «(opcional)»');
      continue;
    }
    assert.equal(c.placeholder, 'Opcional', nome + ': ' + c.id + ' («' + c.rotulo + '») é opcional e o placeholder é «' + c.placeholder + '»');
  }
  return cs;
}
