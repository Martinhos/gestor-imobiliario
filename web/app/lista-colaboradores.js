/* ================= COLABORADORES, O SEPARADOR (serviço colaboradores) ================= */
/* O separador dos colaboradores: a vista é da nuvem (o vColaboradores, em
   cloud/partilha.js; as ações dos cargos e dos convites em
   cloud/colaboradores.js), e aqui fica só o que se mostra sem conta. Veio de
   vistas.js quando a app passou a serviços; regista-se no fim. */
/* O separador dos Colaboradores: a vista vive na camada da nuvem
   (vColaboradores, em cloud/partilha.js), porque cargos e convites são do
   servidor. Sem conta — e o separador só aparece com uma — fica o convite a
   criar conta, em vez de um ecrã vazio sem explicação.
   Devolve: o HTML da página (texto). */
function vColabTab(){
  if(typeof vColaboradores==='function')return vColaboradores();
  return `<div class="empty"><b>Precisas de uma conta</b>Os colaboradores são pessoas que entram nos teus imóveis com um cargo — isso vive na tua conta, não só neste aparelho.
    <div class="toolbar u-jc-center u-mt-16px">
    <button class="btn primary" data-toca="ecra" data-click="goSet('cloud')">Criar conta ou entrar</button></div></div>`;
}
registarServico({id:'colaboradores',vistas:{colaboradores:'vColabTab'}});
