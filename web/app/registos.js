/* ================= REGISTOS =================
   As perguntas que se fazem à base (db) sobre os registos: o imóvel, a
   pessoa, o contrato e o grupo por id; o estado de um contrato (ctEstado:
   terminado, futuro ou ativo) e os nomes com que se mostra; as hipotecas de
   um imóvel e a dívida delas; os imóveis de um filtro (pidProps); o estado
   de ocupação de um imóvel (propStatus); e as tabelas fixas das fichas
   (RATE, GENDER, MARITAL).
   Recebe: id — o id do imóvel.
   Devolve: o imóvel (objeto), ou undefined se não existir. */
const prop=id=>db.properties.find(p=>p.id===id);
/* O nome do imóvel com este id.
   Recebe: id — o id do imóvel.
   Devolve: o nome (texto); '' se não existir. */
const propName=id=>{const p=prop(id);return p?p.name:''};
/* A ficha do proprietário com este id.
   Recebe: id — o id do proprietário.
   Devolve: a ficha (objeto), ou undefined se não existir. */
const owner=id=>db.owners.find(o=>o.id===id);
/* A ficha do inquilino com este id.
   Recebe: id — o id do inquilino.
   Devolve: a ficha (objeto), ou undefined se não existir. */
const tenant=id=>db.tenants.find(t=>t.id===id);
/* O contrato com este id.
   Recebe: id — o id do contrato.
   Devolve: o contrato (objeto), ou undefined se não existir. */
const contract=id=>db.contracts.find(c=>c.id===id);
/* Os contratos de um imóvel, em qualquer estado.
   Recebe: pid — o id do imóvel.
   Devolve: os contratos (array). */
const contractsOf=pid=>db.contracts.filter(c=>c.propertyId===pid);
/* O estado de um contrato, que são TRÊS e não dois.

   A app sabia só «ativo» e «não ativo», e um contrato assinado que ainda não
   começou caía no segundo — passava a exibir o selo «terminado» ao lado da
   data de início, e o menu oferecia «Reativar», que apaga a data de fim.
   «Ainda não começou» não é «acabou».
   Recebe: c — o contrato.
   Devolve: 'terminado', 'futuro' ou 'ativo'. */
function ctEstado(c){
  if(!c||c.active===false)return 'terminado';
  const h=today();
  if(c.end&&c.end<h)return 'terminado';
  if(c.start&&c.start>h)return 'futuro';
  return 'ativo';
}
/* Está em vigor HOJE — entre o início e o fim. É a pergunta das contas: a
   renda que se recebe este mês, o imóvel que está arrendado, o yield.
   Recebe: c — o contrato.
   Devolve: true se está em vigor hoje. */
const isActive=c=>ctEstado(c)==='ativo';
/* Ainda não acabou — inclui o que ainda não começou. É a pergunta do que há
   para PLANEAR e para AVISAR: a renda recorrente de um contrato que começa
   daqui a um ano tem de continuar marcada, e o prazo da oposição à renovação
   pode cair antes do início num contrato curto.
   Recebe: c — o contrato.
   Devolve: true se o contrato ainda conta para o futuro. */
const ctVivo=c=>ctEstado(c)!=='terminado';
/* Os contratos em vigor hoje num imóvel (isActive).
   Recebe: pid — o id do imóvel.
   Devolve: os contratos em vigor (array). */
const activeContracts=pid=>contractsOf(pid).filter(isActive);
/* Os inquilinos de um contrato que têm ficha.
   Recebe: c — o contrato.
   Devolve: as fichas (array), pela ordem do contrato. */
const ctTenants=c=>(c.tenantIds||[]).map(tenant).filter(Boolean);
/* Os nomes dos inquilinos de um contrato, separados por vírgulas.
   Recebe: c — o contrato.
   Devolve: o texto; «Sem inquilino» quando não há nenhum com ficha. */
const ctNames=c=>ctTenants(c).map(t=>t.name).join(', ')||'Sem inquilino';
// nome do quarto rid do imóvel p; vazio se não existir.
// Recebe: p — o imóvel (objeto; aguenta null); rid — o id do quarto.
// Devolve: o nome do quarto (string); vazia se não existir.
const roomName=(p,rid)=>{const r=((p||{}).rooms||[]).find(x=>x.id===rid);return r?r.name:''};
/* O imóvel de um contrato, com o quarto quando o há: «Casa · Quarto 2».
   Recebe: c — o contrato.
   Devolve: o texto; «?» no lugar de um imóvel que já não existe. */
const ctLabel=c=>{const p=prop(c.propertyId);return (p?p.name:'?')+(c.roomId?' · '+roomName(p,c.roomId):'')};
/* nome pelos inquilinos (e quarto, se houver) — para escolher o contrato
   Recebe: c — o contrato.
   Devolve: o texto, ex.: «Ana, Rui · Quarto 2». */
const ctPick=c=>{const p=prop(c.propertyId),r=c.roomId?roomName(p,c.roomId):'';return ctNames(c)+(r?' · '+r:'')};
/* o contrato identifica-se pelo nome que lhe deres; sem nome, pelos inquilinos
   Recebe: c — o contrato (aguenta null).
   Devolve: o nome a mostrar (texto). */
const ctName=c=>String((c&&c.name)||'').trim()||ctPick(c);
/* Os contratos em que uma pessoa é inquilina.
   Recebe: tid — o id do inquilino.
   Devolve: os contratos (array). */
const contractsOfTenant=tid=>db.contracts.filter(c=>(c.tenantIds||[]).indexOf(tid)>-1);
/* A renda mensal dos contratos em vigor de um imóvel.
   Recebe: p — o imóvel.
   Devolve: o total em euros (número). */
const rentOf=p=>sum(activeContracts(p.id).map(c=>c.rent));

/* As hipotecas de um imóvel.
   Recebe: p — o imóvel (aguenta null).
   Devolve: as hipotecas (array; vazio quando não tem). */
const loansOf=p=>((p||{}).loans)||[];
/* As hipotecas de um imóvel que ainda têm capital em dívida.
   Recebe: p — o imóvel.
   Devolve: as hipotecas vivas (array). */
const liveLoans=p=>loansOf(p).filter(l=>Number(l.outstanding)>0);
/* O capital em dívida das hipotecas vivas de um imóvel, somado.
   Recebe: p — o imóvel.
   Devolve: euros (número). */
const debtOf=p=>sum(liveLoans(p).map(l=>l.outstanding));
/* A prestação mensal das hipotecas vivas de um imóvel, com o selo (loanCalc).
   Recebe: p — o imóvel.
   Devolve: euros por mês (número). */
const payOf=p=>sum(liveLoans(p).map(l=>loanCalc(l).total));
// hipoteca com este id dentro do imóvel p; null se lá não estiver.
// Recebe: p — o imóvel (objeto; aguenta null); id — o id da hipoteca.
// Devolve: o objeto da hipoteca, ou null se lá não estiver.
const findLoan=(p,id)=>loansOf(p).find(l=>l.id===id)||null;
/* hipoteca por id, procurada em todos os imóveis
   Recebe: id — o id da hipoteca.
   Devolve: {p, l} — o imóvel e a hipoteca; null se não existir em lado nenhum. */
function anyLoan(id){for(const p of db.properties){const l=findLoan(p,id);if(l)return{p,l}}return null}
/* grupos de imóveis, proprietários ou contratos
   Recebe: id — o id do grupo.
   Devolve: o grupo (objeto), ou undefined se não existir. */
const grp=id=>(db.groups||[]).find(g=>g.id===id);
/* Os grupos de um tipo.
   Recebe: kind — o tipo dos grupos ('prop', 'owner'…).
   Devolve: os grupos (array). */
const grpsOf=kind=>(db.groups||[]).filter(g=>g.kind===kind);
/* imóveis de um filtro: id de imóvel, 'g:ID' de grupo, ou vazio = âmbito atual. Num grupo
   só entram os imóveis do âmbito: com um proprietário filtrado, os dos outros ficam de fora.
   Recebe: pid — o id de um imóvel, 'g:ID' de um grupo, ou vazio para o âmbito atual.
   Devolve: os imóveis abrangidos pelo filtro (array de objetos). */
function pidProps(pid){
  if(!pid)return scope();
  if(String(pid).startsWith('g:')){const g=grp(String(pid).slice(2));return g?g.ids.map(prop).filter(p=>p&&inScope(p.id)):[]}
  const p=prop(pid);return p?[p]:[];
}
/* O nome de uma hipoteca nas listas: «nome · banco», só um dos dois, ou «Hipoteca».
   Recebe: l — a hipoteca (aguenta null).
   Devolve: o texto. */
const loanName=l=>{const n=((l&&l.name)||'').trim(),b=((l&&l.bank)||'').trim();
  return n&&b?n+' · '+b:(n||b||'Hipoteca')};
/* Os imóveis de que um proprietário é dono.
   Recebe: oid — o id do proprietário.
   Devolve: os imóveis (array). */
const propsOf=oid=>db.properties.filter(p=>(p.ownerIds||[]).indexOf(oid)>-1);
/* Os nomes dos donos de um imóvel, separados por vírgulas.
   Recebe: p — o imóvel.
   Devolve: o texto; '' sem donos com ficha. */
const ownerNames=p=>(p.ownerIds||[]).map(owner).filter(Boolean).map(o=>o.name).join(', ');

/* estado de ocupação de um imóvel, para cartões e filtros: devolve {key,label,badge}
   — uso próprio, vago, parcial ("2/3 quartos", no modo de quartos) ou arrendado.
   Recebe: p — o imóvel (objeto).
   Devolve: {key, label, badge} — a chave do estado, o texto a mostrar e a cor do selo. */
function propStatus(p){
  if(p.use==='proprio')return{key:'proprio',label:'Uso próprio',badge:'grey'};
  const ac=activeContracts(p.id);
  if(!ac.length)return{key:'vago',label:'Vago',badge:'amber'};
  if(p.rentalMode==='quartos'){
    const tot=(p.rooms||[]).length,occ=new Set(ac.map(c=>c.roomId).filter(Boolean)).size;
    if(tot&&occ<tot)return{key:'parcial',label:`${occ}/${tot} quartos`,badge:'amber'};
    return{key:'arrendado',label:`${occ||ac.length} quartos arrendados`,badge:''};
  }
  return{key:'arrendado',label:'Arrendado',badge:''};
}
/* O imóvel está arrendado, todo ou em parte (propStatus).
   Recebe: p — o imóvel.
   Devolve: true/false. */
const isRented=p=>['arrendado','parcial'].indexOf(propStatus(p).key)>-1;

const RATE={fixa:'Taxa fixa',mista:'Taxa mista',variavel:'Taxa variável'};
const GENDER=[['','—'],['f','Feminino'],['m','Masculino']];
const MARITAL=['','Solteiro(a)','Casado(a)','União de facto','Divorciado(a)','Viúvo(a)'];
