/* Atualizações e novidades.
   ------------------------
   Três coisas, por esta ordem de importância:

   1. A app verifica sozinha, ao abrir, se há versão nova, e instala-a.
   2. Se a versão em uso já não for aceitável, tranca e obriga a atualizar.
   3. Havendo novidades, mostra o que mudou — só as partes que dizem
      respeito a quem está a ver. */

'use strict';

var LS_VISTO = 'gi_novidades_v';     // última versão cujas novidades já viu
var SS_RECARGA = 'gi_recarga_para';  // para não entrar em ciclo de recargas

// Se algum dos cargos abre esta permissão (temPerm de acessos.js, com as implicações).
// Recebe: cargos — o CW.cargos ({houseId: {dono, perms}}); perm — a chave.
// Devolve: true/false.
function algumCargoAbre(cargos, perm) {
  return Object.keys(cargos).some(function (id) {
    var c = cargos[id];
    return !!c && !c.dono && temPerm(c.perms || [], perm);
  });
}

/* Que funcionalidades esta pessoa usa.
   Quem é dono (ou comproprietário) de algum imóvel — ou não tem sessão nem
   imóveis — tem todas. Quem é só colaborador tem a união do que os cargos
   abrem: movimentos com tx/rec, contratos com contract/tenant, créditos com
   loan, anexos com file; imóveis, a app, a conta e o suporte sempre; a
   partilha entre proprietários nunca.
   Devolve: array com as chaves das funcionalidades desta pessoa. */
function funcsDoUtilizador() {
  var todas = Object.keys(FUNCIONALIDADES);
  var cargos = (window.CW && CW.cargos) || {};
  var ids = Object.keys(cargos);
  if (!ids.length || ids.some(function (id) { return cargos[id] && cargos[id].dono; })) return todas;
  var out = ['app', 'conta', 'suporte', 'imoveis', 'colaboradores'];
  if (algumCargoAbre(cargos, 'tx.view') || algumCargoAbre(cargos, 'rec.view')) out.push('movimentos');
  if (algumCargoAbre(cargos, 'contract.view') || algumCargoAbre(cargos, 'tenant.view')) out.push('contratos');
  if (algumCargoAbre(cargos, 'loan.view')) out.push('creditos');
  if (algumCargoAbre(cargos, 'file.view')) out.push('anexos');
  return out.filter(function (f) { return todas.indexOf(f) > -1; });
}

// Diz se uma secção de novidades toca nalguma funcionalidade desta pessoa.
// Recebe: sec — secção de um aviso ({titulo, itens, afeta?}); afeta é a lista de
// chaves de funcionalidades que toca (sem ela, conta como ['app']).
// Devolve: true/false — se a secção diz respeito a quem está a ver.
function afetaMe(sec) {
  var minhas = funcsDoUtilizador();
  var toca = sec.afeta || ['app'];
  return toca.some(function (f) { return minhas.indexOf(f) > -1; });
}

// Um aviso só conta se sobrar alguma secção depois de filtrar.
// Recebe: a — um aviso de AVISOS ({v, data, titulo, seccoes}).
// Devolve: cópia do aviso só com as secções que dizem respeito a quem vê,
// ou null se não sobrar nenhuma.
function avisoParaMim(a) {
  var secs = (a.seccoes || []).filter(afetaMe);
  return secs.length ? { v: a.v, data: a.data, titulo: a.titulo, seccoes: secs } : null;
}

// Os avisos posteriores à versão v, já filtrados ao que diz respeito a quem vê.
// Recebe: v — número de versão (só entram avisos com a.v acima dele).
// Devolve: array de avisos já passados por avisoParaMim (sem os que ficaram vazios).
function avisosDesde(v) {
  return AVISOS.filter(function (a) { return a.v > v; }).map(avisoParaMim).filter(Boolean);
}

// Até que versão as novidades já foram vistas (0 se nunca, ou sem localStorage).
// Devolve: número da versão até à qual está tudo visto (0 na dúvida).
function vistoAte() {
  try { return Number(localStorage.getItem(LS_VISTO)) || 0; } catch (e) { return 0; }
}
// Guarda no localStorage que as novidades até à versão v já foram vistas.
// Recebe: v — número da versão até à qual fica tudo visto.
// Devolve: nada — grava no localStorage.
function marcarVisto(v) {
  try { localStorage.setItem(LS_VISTO, String(v)); } catch (e) {}
}

/* ---------------------------------------------------------- o que há de novo */

var novAbertas = {};   // que secções estão abertas ({'versão:índice': true/false}); sem marca, só a primeira
var novPrimeira = '';  // a chave da primeira secção da lista à vista: abre sozinha

// Uma secção de novidades que abre e fecha (o .ar do canvas M-Novidades): o
// título num botão da largura toda, com quantas coisas tem quando está
// fechada, e as novidades em lista por baixo quando está aberta. O botão diz
// se está aberto (aria-expanded).
// Recebe: sec — a secção ({titulo, itens}); chave — texto único ('versão:índice')
// que a identifica em novAbertas.
// Devolve: o HTML da secção, em texto.
function secHtml(sec, chave) {
  var aberta = novAbertas[chave] === undefined ? chave === novPrimeira : !!novAbertas[chave];
  var n = (sec.itens || []).length;
  return '<button type="button" class="nov-ar" aria-expanded="' + aberta + '" data-toca="vista" data-click="CW.novToggle(\'' + chave + '\')">' +
      '<span class="nov-ar-tit">' + esc(sec.titulo) + (aberta ? '' : ' <span class="small num">· ' + n + '</span>') + '</span>' +
      ic('chevD', 18) + '</button>' +
    (aberta
      ? '<ul class="nov-itens">' + sec.itens.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>'
      : '');
}

// A lista de avisos inteira em HTML — serve o modal e a secção das Definições:
// por versão, o rótulo «Versão N» com a data à direita, e as secções num
// cartão, a primeira aberta e as outras fechadas.
// Recebe: avisos — array de avisos já filtrados ({v, data, titulo, seccoes}).
// Devolve: o HTML da lista completa (um <div id="novLista">), em texto.
function novHtml(avisos) {
  novPrimeira = avisos.length && avisos[0].seccoes.length ? avisos[0].v + ':0' : '';
  // o id permite redesenhar só esta lista, sem a página saltar para o topo
  return '<div class="nov-lista" id="novLista">' + avisos.map(function (a) {
    return '<section class="nov-versao" aria-label="' + esc('Versão ' + a.v) + '">' +
      '<div class="nov-v-cab"><p class="lbl">Versão ' + a.v + '</p><span class="small num">' + dPT(a.data) + '</span></div>' +
      '<div class="card nov-secs">' +
      a.seccoes.map(function (s, i) { return secHtml(s, a.v + ':' + i); }).join('') +
      '</div></section>';
  }).join('') + '</div>';
}

/* Abrir e fechar uma secção.

   Redesenhava só o corpo do modal. Na secção das Definições não há modal
   nenhum, por isso o toque mudava o estado e não se via nada — era preciso
   sair do submenu e voltar a entrar. Agora redesenha a lista onde quer que
   ela esteja (o #novLista, no modal ou na vista). A primeira secção abre
   sozinha (novPrimeira); a partir do primeiro toque manda o novAbertas.
   Recebe: chave — a chave da secção em novAbertas ('versão:índice').
   Devolve: nada — inverte o estado e redesenha a lista onde ela estiver. */
CW.novToggle = function (chave) {
  var aberta = novAbertas[chave] === undefined ? chave === novPrimeira : !!novAbertas[chave];
  novAbertas[chave] = !aberta;
  if (!CW._novAvisos) return;
  /* a lista tem o seu id, no modal e na página: troca-se só ela, e o foco
     volta ao botão tocado (o nó novo), para o teclado não cair no topo */
  var lista = document.getElementById('novLista');
  if (!lista) return;
  lista.outerHTML = novHtml(CW._novAvisos);
  var nova = document.getElementById('novLista');
  var b = nova && nova.querySelector('[data-click="CW.novToggle(\'' + chave + '\')"]');
  if (b) try { b.focus(); } catch (e) {}
};

// Abre o modal "O que há de novo"; aoFechar, se vier, corre quando a pessoa
// carrega em Continuar.
// Recebe: avisos — array de avisos filtrados a mostrar; aoFechar (opcional) —
// função a correr quando o modal fechar.
// Devolve: nada — abre o modal.
CW.verNovidades = function (avisos, aoFechar) {
  CW._novAvisos = avisos;
  novAbertas = {};
  openModal('O que há de novo', '<p class="small nov-sub">Só o que diz respeito ao que usas.</p>' + novHtml(avisos),
    '<button class="btn primary" data-toca="camada" data-click="CW.novFechar()">Continuar</button>');
  CW._novFecho = aoFechar;
};

// Fecha o modal, marca as novidades como vistas e corre o combinado ao fechar.
// Devolve: nada — fecha os modais e grava a versão vista.
CW.novFechar = function () {
  closeAllModals();
  marcarVisto(VERSAO);
  var f = CW._novFecho;
  CW._novFecho = null;
  if (f) f();
};

// Mostra as novidades por ver, se sobrar alguma depois de filtrar.
// Devolve: true se abriu o modal; false se não havia nada para mostrar.
function mostrarNovidadesSeHouver() {
  var visto = vistoAte();
  if (visto >= VERSAO) return false;
  var avisos = avisosDesde(visto);
  if (!avisos.length) { marcarVisto(VERSAO); return false; }   // nada que lhe diga respeito
  // quem instala de novo não leva com o histórico todo à frente
  if (!visto) { marcarVisto(VERSAO); return false; }
  CW.verNovidades(avisos);
  return true;
}

/* ------------------------------------------------------ atualização forçada */

/* O miolo dos dois ecrãs da versão (o canvas M-Atualizar): o azul-noite da
   barra lateral de ponta a ponta, o mosaico azul-noite por cima (o .tile do
   canvas, estilos.css:.imv-noite — o cobalto claro das capas, imv-t0, dava
   um cinzento-lavanda sobre o --side), o título, a frase, e por baixo o que
   cada um tem — a caixa dos passos, a nota e o botão.
   Recebe: titulo — o título; frase — o texto por baixo dele (de confiança);
   resto — o HTML que vem a seguir (a caixa dos passos, a nota, o botão).
   Devolve: o HTML do ecrã (texto). */
function ecraDaVersao(titulo, frase, resto) {
  return '<div class="upd-mosaico imv-mosaico imv-noite" aria-hidden="true"></div>' +
    '<div class="upd-corpo">' +
      '<h1 class="upd-tit">' + titulo + '</h1>' +
      '<p class="upd-frase num">' + frase + '</p>' +
      resto +
    '</div>';
}

/* O ecrã que tranca a app quando a versão em uso desceu abaixo da mínima
   aceite (o canvas M-Atualizar): tapa tudo e só deixa atualizar — a frase
   diz a versão que se tem e a mais antiga que serve, e que enquanto não se
   atualizar nada sobe; a nota diz que atualizar não apaga nada. O
   «Atualizar agora» abre o ecrã dos passos (ecraAtualizar) por cima deste.
   Por cima do botão fica a caixa do que correu mal (#cwUpdErro, role=alert,
   vazia e escondida até ser precisa): é aí que o CW.atualizarAgora diz que
   não há servidor, porque um aviso em baixo (.toast, z 90) ficava por trás
   deste ecrã. Chamado duas vezes não duplica.
   Recebe: minima — número da versão mais antiga que ainda é aceite.
   Devolve: nada — acrescenta o ecrã ao body (ou nada, se já lá estiver). */
function gateAtualizar(minima) {
  if (document.getElementById('cwUpd')) return;
  /* Trancado quer dizer trancado: o ciclo de sincronização de 30 segundos
     (nucleo.js:startSync) continuava armado por trás deste ecrã, a empurrar o
     estado local para o servidor a partir de uma versão que acabámos de
     declarar inutilizável. Se ela é velha demais para se usar, é velha demais
     para escrever: o pushNow e a api() olham para a tranca (nada que escreva
     sai), e o envio que já estava agendado desarma-se aqui. */
  CW.trancado = true;
  try { clearTimeout(pushTimer); pushTimer = null; } catch (e) {}
  try { lockScroll(true); } catch (e) {}
  var el = document.createElement('div');
  el.id = 'cwUpd';
  /* 235: acima do portão de login (200) e da reposição de palavra-passe (230),
     abaixo do ecrã de progresso (240). Esteve em 198, ou seja POR BAIXO da
     entrada, e portanto invisível a quem ainda não entrou — que é justamente
     quem o comentário do fim deste ficheiro diz que ele existe para servir:
     quem está preso no ecrã de entrada por causa de um erro já corrigido. */
  el.style.cssText = 'position:fixed;inset:0;z-index:235;overflow:auto';
  el.className = 'upd-ecra';
  el.setAttribute('role', 'alertdialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'cwUpdTit');
  el.innerHTML = ecraDaVersao('<span id="cwUpdTit">É preciso atualizar a app</span>',
    'A versão que tens (' + VERSAO + ') deixou de ser aceite; a mais antiga que serve é a ' + minima +
    '. Enquanto não atualizares, nada é enviado para a tua conta.',
    caixaDosPassos('nova', '') +
    '<p class="upd-nota">Atualizar não apaga nada. O que registaste neste aparelho e ainda não subiu sobe logo a seguir.</p>' +
    '<p id="cwUpdErro" class="upd-erro" role="alert"></p>' +
    '<button type="button" class="btn upd-botao" data-toca="ecra" data-click="CW.atualizarAgora()">Atualizar agora</button>');
  document.body.appendChild(el);
  try { el.querySelector('.upd-botao').focus(); } catch (e) {}
}

/* Espera que apareça um worker em espera. Depois de um update() o worker novo
   pode ainda estar a instalar-se — e o install dele é o addAll da shell
   inteira, que demora. Se não houver nada a instalar-se, não vale a pena
   esperar: desiste já.
   Recebe: r — a ServiceWorkerRegistration; ate — quanto esperar, em ms.
   Devolve: Promise com o worker em espera, ou null se não aparecer a tempo. */
function esperarEmEspera(r, ate) {
  return new Promise(function (ok) {
    if (r.waiting) return ok(r.waiting);
    if (!r.installing) return ok(null);
    var passado = 0;
    var passo = setInterval(function () {
      passado += 250;
      if (r.waiting) { clearInterval(passo); return ok(r.waiting); }
      if (passado >= ate || (!r.installing && !r.waiting)) { clearInterval(passo); ok(null); }
    }, 250);
  });
}

/* Pede ao worker em espera que assuma, e confirma que assumiu mesmo.
   Um location.reload() não promove um worker em espera (o documento antigo e o
   novo sobrepõem-se, o registo nunca fica sem clientes), por isso é preciso
   pedir. Vale a pena porque um worker que chega a "em espera" é a PROVA de que
   a versão nova está inteira em disco: o install dele é um addAll, que só
   termina com todos os ficheiros lá dentro. Trocando por aqui, a app arranca
   de uma cache construída de uma vez — que é a invariante que a v31 partiu.
   Devolve: Promise com true se o worker trocou, false se não havia nenhum em
   espera ou se a troca não chegou a tempo (nunca rejeita). */
function trocarDeWorker() {
  var sw = navigator.serviceWorker;
  if (!sw || !sw.getRegistration) return Promise.resolve(false);
  return sw.getRegistration().then(function (r) {
    if (!r) return false;
    return Promise.resolve(r.update()).catch(function () {})
      .then(function () { return esperarEmEspera(r, 15000); })
      .then(function (w) {
        if (!w) return false;
        // o controllerchange é a confirmação: o worker novo está a mandar
        var trocou = new Promise(function (ok) {
          var feito = false;
          var fim = function (v) { if (!feito) { feito = true; ok(v); } };
          sw.addEventListener('controllerchange', function () { fim(true); }, { once: true });
          setTimeout(function () { fim(false); }, 4000);
        });
        w.postMessage({ tipo: 'assumir' });
        return trocou;
      });
  }).catch(function () { return false; });
}

/* Pergunta ao servidor se ele responde, com tempo-limite curto. É a condição
   mínima para valer a pena apagar a cópia local: sem servidor do outro lado,
   apagar não atualiza nada e só deixa a pessoa sem app. O /versao.json nunca é
   servido da cache (web/sw.js), portanto a resposta é sempre da rede. O
   tempo-limite desarma-se quando a resposta chega.
   Devolve: Promise com true se o servidor respondeu (nunca rejeita). */
function servidorResponde() {
  return new Promise(function (ok) {
    var feito = false, limite = null;
    var diz = function (v) { if (!feito) { feito = true; clearTimeout(limite); ok(v); } };
    limite = setTimeout(function () { diz(false); }, 4000);
    fetch('/versao.json', { cache: 'no-store' }).then(
      function (r) { diz(!!(r && r.ok)); },
      function () { diz(false); }
    );
  });
}

/* O caminho de todos os botões "Atualizar", com o passo a passo à vista.
   Tenta primeiro a troca de worker, que é a boa: a versão nova entra inteira,
   de uma cache já construída. Só se ela não acontecer é que se pega no machado
   — e aí confirma-se que o servidor responde antes de apagar a única cópia
   local que existe.
   Sem servidor, o ecrã dos passos sai e diz-se porquê. Com a app trancada
   (o #cwUpd), a frase fica no próprio ecrã, por cima do botão (#cwUpdErro):
   o aviso em baixo (.toast, z 90) ficava por trás dele (z 235), e quem tocava
   no único botão que há voltava ao ecrã trancado sem saber porquê. Da faixa
   discreta (bannerAtualizar), que não tapa nada, vai no aviso. A caixa
   esvazia-se a cada tentativa.
   Devolve: Promise que resolve quando não houver mais nada a fazer; no caminho
   feliz não chega a resolver, porque a página recarrega. */
CW.atualizarAgora = function () {
  var erro = document.getElementById('cwUpdErro');
  if (erro) erro.textContent = '';
  ecraAtualizar('nova', 'procurar');
  return trocarDeWorker().then(function (trocou) {
    if (trocou) { ecraAtualizar('nova', 'reiniciar'); location.reload(); return; }
    return servidorResponde().then(function (ha) {
      if (!ha) {
        var el = document.getElementById('cwUpd2');
        if (el) el.remove();
        var noEcra = document.getElementById('cwUpd') && document.getElementById('cwUpdErro');
        if (noEcra) noEcra.textContent = 'Sem ligação ao servidor. Quando houver rede, toca outra vez em «Atualizar agora».';
        else toast('Sem ligação ao servidor. A atualização fica para quando houver rede.');
        return;
      }
      ecraAtualizar('nova', 'limpar');
      return limparCaches().then(function () {
        ecraAtualizar('nova', 'reiniciar');
        location.reload();
      });
    });
  });
};

/* Apaga as caches do browser. É o machado: serve para quando a troca de worker
   não acontece e a única maneira de a versão nova chegar é tirar a antiga da
   frente do worker que está a servir.

   O que NÃO se apaga é a cache da versão para onde se vai. Ela é o addAll que
   o worker em espera acabou de fazer — a versão nova inteira, gravada de uma
   vez. Apagá-la (era o que acontecia: apagavam-se todas, sem filtro) obrigava
   a app a voltar a buscar a shell ficheiro a ficheiro, que é exatamente como
   se misturam versões.

   Nunca rejeita nem fica pendurada: o que importa é a recarga que vem a
   seguir, e uma limpeza que não acaba não a pode impedir.
   Recebe: guardar (opcional) — número da versão cuja cache fica de pé.
   Devolve: Promise que resolve quando as limpezas acabarem, ou ao fim de
   quatro segundos, o que vier primeiro. */
function limparCaches(guardar) {
  var poupada = guardar ? 'gi-shell-v' + guardar : null;
  var limpeza = Promise.resolve();
  try {
    if (window.caches && caches.keys) {
      limpeza = caches.keys().then(function (ks) {
        return Promise.all(ks
          .filter(function (k) { return k !== poupada; })
          .map(function (k) { return caches.delete(k); }));
      });
    }
  } catch (e) {}
  return Promise.race([
    limpeza.catch(function () {}),
    new Promise(function (ok) { setTimeout(ok, 4000); }),
  ]);
}

/* --------------------------------------------------- verificação ao arrancar */

// Uma recarga por versão-alvo. Se depois de recarregar continuar velha, o
// problema não é a cache — e um ciclo de recargas seria pior do que o atraso.
// Recebe: alvo — número da versão para a qual a recarga iria.
// Devolve: true se esta sessão já recarregou a caminho dessa versão (e também
// se o sessionStorage falhar — na dúvida, antes parada que em ciclo).
function jaRecarreguei(alvo) {
  try { return Number(sessionStorage.getItem(SS_RECARGA)) === alvo; } catch (e) { return true; }
}
// Regista (na sessão) que já se recarregou a caminho desta versão.
// Recebe: alvo — número da versão-alvo da recarga.
// Devolve: nada — grava no sessionStorage.
function marcarRecarga(alvo) {
  try { sessionStorage.setItem(SS_RECARGA, String(alvo)); } catch (e) {}
}

/* O «Depois» da faixa: tira do ecrã a faixa inteira, que é o pai do botão.
   Era um onclick com this.parentNode, que a gramática das ações não tem — o
   botão passa-se a si próprio e a função faz exatamente o mesmo.
   Recebe: botao — o botão «Depois» (o this da ação).
   Devolve: nada — remove do documento a faixa que o contém. */
function fecharFaixaAtualizar(botao) {
  botao.parentNode.remove();
}

// A faixa discreta no fundo do ecrã: há versão nova, atualiza quando quiseres.
// É o plano B, para quando a recarga automática não chegou à versão nova.
// Recebe: v — número da versão disponível, para mostrar na faixa.
// Devolve: nada — acrescenta a faixa ao body (nunca mais do que uma).
function bannerAtualizar(v) {
  if (document.getElementById('cwUpdBar')) return;
  var el = document.createElement('div');
  el.id = 'cwUpdBar';
  // 59: acima do botão flutuante (58) e abaixo dos modais — senão
  // tapava o rodapé de um modal aberto
  el.className = 'card';
  el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(12px + var(--inset-bottom));z-index:59;' +
    'display:flex;align-items:center;gap:11px;padding:11px 13px;box-shadow:var(--shadow)';
  el.innerHTML = '<span class="small u-fx-1 u-minw-0">Está disponível a versão ' + v + '.</span>' +
    '<button class="btn sm primary u-fx-0-0-auto" data-toca="ecra" data-click="CW.atualizarAgora()">Atualizar</button>' +
    '<button class="btn sm u-fx-0-0-auto" data-toca="vista" data-click="fecharFaixaAtualizar(this)">Depois</button>';
  document.body.appendChild(el);
}

/* Os passos de uma atualização, pela ordem em que se veem: procurar,
   descarregar (ou, pelo machado, limpar a versão antiga) e reiniciar. */
var PASSOS_DA_ATUALIZACAO = ['procurar', 'descarregar', 'reiniciar'];

/* A caixa dos passos (role=status, para o leitor de ecrã os ir dizendo):
   os que já passaram com o visto, o que está a correr com a roda, e os que
   faltam com um círculo vazio.
   Recebe: versao — número da versão de destino, ou 'nova'; passo — o passo
   em curso ('procurar', 'descarregar', 'limpar' ou 'reiniciar').
   Devolve: o HTML da caixa (texto). */
function caixaDosPassos(versao, passo) {
  var agora = PASSOS_DA_ATUALIZACAO.indexOf(passo === 'limpar' ? 'descarregar' : passo);
  var rotulo = {
    procurar: 'A procurar a versão nova',
    descarregar: passo === 'limpar' ? 'A limpar a versão antiga'
      : (versao === 'nova' ? 'A descarregar a versão nova' : 'A descarregar a versão ' + versao),
    reiniciar: 'A reiniciar',
  };
  return '<ol class="upd-passos" role="status">' + PASSOS_DA_ATUALIZACAO.map(function (k, i) {
    if (i < agora) return '<li class="upd-passo feito">' + ic('check', 20) + '<span>' + rotulo[k] + '</span></li>';
    if (i === agora) return '<li class="upd-passo atual"><span id="cwUpdRoda" class="nov-roda" aria-hidden="true"></span><span>' + rotulo[k] + '…</span></li>';
    return '<li class="upd-passo"><span class="upd-circulo" aria-hidden="true"></span><span>' + rotulo[k] + '</span></li>';
  }).join('') + '</ol>';
}

/* O ecrã que se vê enquanto a app se atualiza (o canvas M-Atualizar). Antes
   era um piscar mudo: a página recarregava sem dizer porquê, e quem visse
   ficava sem saber se era um erro. Agora diz o que está a fazer, passo a
   passo, na caixa dos passos (caixaDosPassos), e que não se perde nada.
   Recebe: versao — número da versão de destino (ou o texto 'nova', quando não
   se sabe qual é); passo — o passo em curso ('procurar', 'descarregar',
   'limpar' ou 'reiniciar').
   Devolve: nada — cria o ecrã se ainda não existir e atualiza os passos. */
function ecraAtualizar(versao, passo) {
  var el = document.getElementById('cwUpd2');
  if (!el) {
    el = document.createElement('div');
    el.id = 'cwUpd2';
    // acima de tudo, portao de login incluido (z 200): enquanto se atualiza,
    // atualizar E o estado da app
    el.style.cssText = 'position:fixed;inset:0;z-index:240;overflow:auto';
    el.className = 'upd-ecra';
    el.innerHTML = ecraDaVersao(versao === 'nova' ? 'A atualizar a app' : 'A atualizar para a versão ' + versao,
      'Atualizar não apaga nada: os teus dados ficam onde estão, e o que registaste neste aparelho sobe logo a seguir.',
      '<div id="cwUpdPassos"></div>');
    /* A roda e a animação dela viviam numa folha criada aqui por JavaScript,
       que é CSS em linha e a CSP sem 'unsafe-inline' recusa tal como recusa um
       atributo de estilo: passaram para o web/estilos.css (secção
       g12-novidades), na classe .nov-roda. */
    document.body.appendChild(el);
  }
  var p = document.getElementById('cwUpdPassos');
  if (p) p.innerHTML = caixaDosPassos(versao, passo);
}

/* Pergunta ao servidor (/versao.json) que versão há: abaixo da mínima tranca
   a app; havendo mais nova, limpa as caches e recarrega sozinha uma vez, com
   o ecrã de progresso à vista; se mesmo assim continuar velha, resta a faixa.
   Sem rede não faz nada — a app fica com o que tem.
   Devolve: Promise que resolve quando a verificação acabar (nunca rejeita). */
CW.verificarVersao = function () {
  /* acabada de atualizar? diz-se — é a outra metade de mostrar o estado */
  try {
    if (Number(sessionStorage.getItem(SS_RECARGA)) === VERSAO) {
      sessionStorage.removeItem(SS_RECARGA);
      setTimeout(function () { toast('App atualizada para a versão ' + VERSAO + '.'); }, 700);
    }
  } catch (e) {}
  return fetch('/versao.json', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d) return;
      if (Number(d.minima) > VERSAO) { gateAtualizar(Number(d.minima)); return; }
      if (!(Number(d.versao) > VERSAO)) return;
      // há versão nova: buscar sozinho e recarregar, uma vez — à vista
      var nova = Number(d.versao);
      if (jaRecarreguei(nova)) { bannerAtualizar(nova); return; }
      marcarRecarga(nova);
      ecraAtualizar(nova, 'descarregar');
      return trocarDeWorker().then(function (trocou) {
        ecraAtualizar(nova, 'reiniciar');
        /* Trocou: o worker novo já está a mandar, com a shell inteira na cache
           dele — não há nada para limpar, e limpar seria desfazê-la.
           Não trocou: resta o machado, que é o que faz a versão nova chegar a
           um separador que ficou aberto — menos a cache da versão nova, se
           ela chegou a existir. */
        if (trocou) { location.reload(); return; }
        return limparCaches(nova).then(function () { location.reload(); });
      });
    })
    .catch(function () { /* sem rede: fica com o que tem */ });
};

/* ------------------------------------------------- a secção nas definições */

// A secção "Novidades" das Definições: todos os avisos que dizem respeito a
// esta pessoa, ou uma nota de que ainda não há nenhum.
// Devolve: o HTML da secção, em texto.
function vNovidades() {
  var todas = AVISOS.map(avisoParaMim).filter(Boolean);
  if (!todas.length) return '<div class="hint">Ainda não há novidades que te digam respeito.</div>';
  CW._novAvisos = todas;
  return novHtml(todas);
}

/* O cabeçalho da página (vistas.js:render lê-o de SUBPAGE): sem entrada,
   caía no do separador e dizia «Definições», com o subtítulo do Tema. */
SUBPAGE.novidades = { label: 'Novidades', sub: 'O que mudou em cada versão' };

var _vSettingsNov = vSettings;
vSettings = function () {
  if (setPage === 'novidades') return backRow + vNovidades();
  return _vSettingsNov();
};

// A linha das novidades na raiz das Definições: na secção «Sobre», ao lado do
// aviso legal, que é a outra coisa que se lê e não se mexe. Entra como linha
// (definicoes.js:linhaDefinicoes), e já não por procura e troca no HTML da
// raiz — que dependia da forma exata do navRow do aviso legal.
/* O crachá (o canvas M-Definicoes) é o número do «N por ler». */
linhaDefinicoes({ sec: 'sobre', ordem: 20, page: 'novidades', label: 'Novidades', icon: 'info', sub: function () {
  var novas = avisosDesde(vistoAte()).length;
  return novas ? novas + ' por ler · versão ' + VERSAO : 'O que mudou · versão ' + VERSAO;
}, cracha: function () { return avisosDesde(vistoAte()).length; } });

/* ------------------------------------------------------------- o arranque */

/* As novidades entram na fila atrás dos avisos que já existem: primeiro o
   aviso inicial, depois os termos, e só com o ecrã livre é que se
   conta o que mudou. Três janelas empilhadas seriam pior do que nenhuma.
   Devolve: true se há sessão e nenhum desses avisos está no ecrã. */
function ecraLivre() {
  return !!CW.user &&
    !document.getElementById('cwLegal') &&
    !document.getElementById('cwTerms') &&
    !document.getElementById('cwUpd');
}

// Mostra as novidades por ver, mas só com o ecrã livre de avisos mais
// importantes (aviso inicial, termos, atualização forçada).
// Devolve: nada — abre o modal das novidades se for caso disso.
CW.talvezNovidades = function () {
  if (ecraLivre()) mostrarNovidadesSeHouver();
};

// quando um desses avisos se fecha, é a vez das novidades
['acceptLegal', 'acceptTerms'].forEach(function (nome) {
  var antes = CW[nome];
  if (typeof antes !== 'function') return;
  CW[nome] = function () {
    var r = antes.apply(this, arguments);
    setTimeout(CW.talvezNovidades, 80);
    return r;
  };
});

// A versão verifica-se sempre, com sessão ou sem ela: quem está preso no
// ecrã de entrada por causa de um erro já corrigido também precisa.
CW.verificarVersao();
setTimeout(CW.talvezNovidades, 500);
