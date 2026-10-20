/* ================= COLABORADORES, O SEPARADOR (serviço colaboradores) ================= */
/* O separador dos colaboradores: a página e as ações dos cargos e dos
   convites são da nuvem (cloud/colaboradores.js; os cartões de antes do
   canvas de 2026-10, com o vColaboradores, ficaram em cloud/partilha.js), e
   aqui fica só o que se mostra sem ela. Veio de vistas.js quando a app
   passou a serviços; regista-se no fim. */
/* O separador dos Colaboradores, o terceiro das Pessoas (navegacao.js:PESSOAS)
   desde 2026-10-20 — antes vivia nas Definições, com o Voltar delas. É um
   ecrã de área como os Inquilinos e os Proprietários: os separadores da área
   e o segmentado das Pessoas põe-nos o render por cima
   (navegacao.js:abasDaArea), e a vista é só a página, que é da camada da
   nuvem (cloud/colaboradores.js:paginaDosColaboradores), porque cargos e
   convites são do servidor. Sem a nuvem — e o separador só aparece com uma
   conta — fica o convite a criar conta, em vez de um ecrã vazio sem
   explicação.
   Recebe: nada.
   Devolve: o HTML da página (texto). */
function vColabTab(){
  if(typeof paginaDosColaboradores==='function')return paginaDosColaboradores();
  return `<div class="empty"><b>Precisas de uma conta</b>Os colaboradores são pessoas que entram nos teus imóveis com um cargo — isso vive na tua conta, não só neste aparelho.
    <div class="toolbar u-jc-center u-mt-16px">
    <button class="btn primary" data-toca="ecra" data-click="goSet('cloud')">Criar conta ou entrar</button></div></div>`;
}
/* O separador Grupos é da base (os grupos são filtros de toda a app), mas o
   crachá dele é deste serviço: conta os pedidos para entrar nos meus grupos
   partilhados (cloud/grupos.js:crachaDosGrupos), que só existem com ele
   ligado. Desligado, o registo não se despacha e o separador fica sem crachá. */
registarServico({id:'colaboradores',vistas:{colaboradores:'vColabTab'},cracha:{groups:'crachaDosGrupos'}});
