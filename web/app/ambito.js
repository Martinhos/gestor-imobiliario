/* ================= ÂMBITO =================
   O que a vista está a mostrar: o imóvel em foco na visão geral (dashProp) e
   o que sai do ownerFilter — os imóveis visíveis nas listas (visiveis) e o
   âmbito das contas (scope, inScope), que é o visível onde o cargo abre as
   finanças. É estado de interface: vive à parte das funções puras que o leem.

   A app já não tem filtro global de proprietário (o «Proprietário em foco»
   saiu da gaveta, a faixa do âmbito saiu do topo e o campo «Proprietário»
   saiu dos filtros das listas, das análises e dos filtros comuns). O
   ownerFilter ficou só como o titular do IRS · Anexo F (fisco.js, pelo
   seletor vistas.js:anaSelDono), que é por pessoa e na quota-parte dela; em
   qualquer outro ecrã é sempre '' (ambitoSemDono). A canalização ficou
   inteira — visiveis, scope, inScope, e a quota do saldos.js:sh e do
   metricas.js, que o leem —: com o ownerFilter vazio dá o mesmo que não a
   ter, e tirá-la era reescrever as contas da quota em ficheiros que o
   titular do IRS ainda usa. */
let ownerFilter='',dashProp='';
/* Larga o proprietário fora do IRS · Anexo F, o único ecrã onde ele é o
   titular da declaração: o render e a mudança de separador chamam-na, e assim
   nenhum valor de antes — o titular escolhido no IRS, um atalho antigo que o
   ponha — filtra outro ecrã às escondidas, sem faixa nem chip que o diga.
   Recebe: nada (lê o tab).
   Devolve: nada — põe o ownerFilter a '' fora do separador 'fisco'. */
function ambitoSemDono(){if(ownerFilter&&tab!=='fisco')ownerFilter=''}
// o filtro de proprietário atual é um grupo ('g:ID')?
// Devolve: true se o filtro atual for um grupo; false caso contrário.
const ownerIsGrp=()=>String(ownerFilter||'').startsWith('g:');
// ids de proprietário abrangidos pelo filtro atual: vazio sem filtro, os do grupo, ou só o escolhido.
// Devolve: os ids abrangidos (array de strings); vazio sem filtro.
function ownerFilterIds(){
  if(!ownerFilter)return [];
  if(ownerIsGrp()){const g=grp(ownerFilter.slice(2));return g?g.ids:[]}
  return [ownerFilter];
}
// nome a mostrar do filtro de proprietário atual (pessoa ou grupo); vazio sem filtro.
// Devolve: o nome a mostrar (string); vazia sem filtro ou se a ficha já não existir.
function ownerFilterName(){
  if(!ownerFilter)return '';
  if(ownerIsGrp()){const g=grp(ownerFilter.slice(2));return g?g.name:''}
  return (owner(ownerFilter)||{}).name||'';
}
/* imóveis da vista atual: todos sem filtro de proprietário; com filtro, os que
   pertencem a quem foi escolhido (e, para uma pessoa, só onde a quota é > 0).
   É o âmbito das listas (Imóveis, Contratos); o das contas é scope().
   Devolve: os imóveis da vista atual (array de objetos). */
const visiveis=()=>{if(!ownerFilter)return db.properties;const ids=ownerFilterIds();
  return db.properties.filter(p=>(p.ownerIds||[]).some(o=>ids.indexOf(o)>-1)&&(ownerIsGrp()||shareOf(p,ownerFilter)>0))};
/* o âmbito das contas: os imóveis visíveis onde o meu cargo abre as finanças —
   movimentos, valores ou hipotecas. Nos meus imóveis é tudo; num imóvel onde
   só colaboro sem nenhuma destas, os KPIs, a Avaliação e os Créditos não o contam
   (o servidor já não manda esses dados; aqui evita-se somar zeros e listá-lo).
   Devolve: os imóveis do âmbito financeiro (array de objetos). */
const scope=()=>visiveis().filter(p=>pode(p.id,'tx.view')||pode(p.id,'report.view')||pode(p.id,'loan.view'));
/* O imóvel conta nas contas da vista: sem filtro de proprietário, sempre; com
   filtro, se está no scope().
   Recebe: pid — o id do imóvel.
   Devolve: true/false. */
const inScope=pid=>!ownerFilter||scope().some(p=>p.id===pid);
