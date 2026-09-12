/* ================= ACESSOS ================= */
/* Quem pode o quê em cada imóvel. Um colaborador tem um cargo, e o cargo é
   uma lista de permissões (ver e adicionar, por entidade). O servidor é
   quem decide — já despe os dados que o cargo não vê e recusa o que o cargo
   não pode escrever; este módulo só serve para o cliente esconder ações e
   chips, e para recusar cedo com uma frase em vez de um selo vermelho.

   É puro de propósito: sem sessão (testes, uso local) não há window.CW e
   tudo é «dono», como sempre foi. A camada da nuvem preenche CW.cargos
   (casa → {dono, criador, nome, perms}) e CW.pessoas (id → {name, kind,
   roleName}) a partir de cargosDoEstado, e marca p._cargo / p._colaboradores
   nos imóveis. */

/* A lista canónica das permissões — igual à do servidor
   (worker/src/lib/permissoes.js); um teste compara as duas. */
const PERMS=['tx.view','tx.add','rec.view','rec.add','visit.view','visit.add','contract.view','contract.add',
  'tenant.view','tenant.add','loan.view','file.view','file.add','report.view','house.edit'];
/* O que cada permissão arrasta consigo: adicionar implica ver; editar a ficha
   do imóvel implica ver hipotecas e anexos (sem os ver, o PUT apagava-os);
   adicionar contratos implica adicionar planeados (o contrato cria a renda). */
const IMPLICA={'tx.add':['tx.view'],'rec.add':['rec.view'],'visit.add':['visit.view'],'contract.add':['contract.view','rec.add'],
  'tenant.add':['tenant.view'],'file.add':['file.view'],'house.edit':['loan.view','file.view']};
/* Rótulo, hint e grupo de cada permissão, para o modal do cargo e para as frases de recusa. */
const ROTULOS={
  'tx.view':{rotulo:'Ver movimentos',hint:'Movimentos, os indicadores de receita, despesas, prestações e cashflow, e o donut destes imóveis.',grupo:'Movimentos'},
  'tx.add':{rotulo:'Adicionar movimentos',hint:'Registar renda, despesa, pagamento de crédito e amortização.',grupo:'Movimentos'},
  'rec.view':{rotulo:'Ver planeados',hint:'Planeados, o cartão «por confirmar» e o calendário.',grupo:'Planeados'},
  'rec.add':{rotulo:'Adicionar e confirmar planeados',hint:'Confirmar, silenciar e criar planeados.',grupo:'Planeados'},
  'visit.view':{rotulo:'Ver visitas',hint:'Visitas e o calendário.',grupo:'Visitas'},
  'visit.add':{rotulo:'Marcar visitas',hint:'Marcar, dar por realizada ou por falta, comentar. Converter em inquilino pede «Adicionar inquilinos».',grupo:'Visitas'},
  'contract.view':{rotulo:'Ver contratos',hint:'Renda, datas, IBAN, inventário e o PDF.',grupo:'Contratos'},
  'contract.add':{rotulo:'Adicionar contratos',hint:'Criar contratos e terminar ou reativar os próprios. Traz consigo os planeados.',grupo:'Contratos'},
  'tenant.view':{rotulo:'Ver fichas de inquilinos',hint:'Contactos, NIF, CC, documentos e notas.',grupo:'Inquilinos'},
  'tenant.add':{rotulo:'Adicionar inquilinos',hint:'Criar fichas de inquilino.',grupo:'Inquilinos'},
  'loan.view':{rotulo:'Ver hipotecas',hint:'Créditos, banco, capital, plano e documentos da hipoteca. Editar hipotecas é editar a ficha do imóvel.',grupo:'Hipotecas'},
  'file.view':{rotulo:'Ver fotos e documentos',hint:'As fotos do imóvel e os anexos dos registos.',grupo:'Anexos'},
  'file.add':{rotulo:'Adicionar fotos e documentos',hint:'Nos registos que pode adicionar.',grupo:'Anexos'},
  'report.view':{rotulo:'Ver valores e avaliação',hint:'Valor de mercado, aquisição, dívida, património, Avaliação, Projeções, mais-valias e a Declaração (o resumo do Anexo F).',grupo:'Avaliação'},
  'house.edit':{rotulo:'Editar a ficha do imóvel',hint:'Nome, morada, quartos, dados registais, hipotecas, fotos e anúncio. Nunca donos, quotas nem apagar.',grupo:'Imóvel'}
};
/* Os três cargos prontos do modal «Novo cargo» — iguais aos do servidor. */
const CARGOS_EXEMPLO=[
  {nome:'Gestor de visitas',perms:['visit.view','visit.add','tenant.view','tenant.add'],sub:'Marca visitas e cria fichas de quem quer arrendar.'},
  {nome:'Contabilista',perms:['tx.view','tx.add','rec.view','rec.add','contract.view','loan.view','file.view','file.add','report.view'],sub:'Regista movimentos e vê contratos, hipotecas e avaliação. Não mexe nas fichas.'},
  {nome:'Ver tudo',perms:['tx.view','rec.view','visit.view','contract.view','tenant.view','loan.view','file.view','report.view'],sub:'Vê tudo sobre o imóvel, sem alterar nada.'}
];
/* De cada tipo de registo à raiz da permissão que o abre (kind + '.view' / '.add'). */
const KIND_PERM={contract:'contract',tx:'tx',rec:'rec',visit:'visit',tenant:'tenant'};

/* O fecho de uma lista de permissões: as que lá estão mais as que elas
   implicam, em cadeia (contract.add → rec.add → rec.view).
   Recebe: perms — as permissões de um cargo (array de chaves, Set, ou objeto {chave:true}).
   Devolve: um Set com todas as permissões efetivas. */
function fechoPerms(perms){
  const base=Array.isArray(perms)?perms:(perms instanceof Set?Array.from(perms):Object.keys(perms||{}).filter(k=>perms[k]));
  const out=new Set(),fila=base.slice();
  while(fila.length){const k=fila.pop();if(out.has(k))continue;out.add(k);(IMPLICA[k]||[]).forEach(x=>fila.push(x))}
  return out;
}
/* Um cargo tem esta permissão? Conta com as implicações.
   Recebe: perms — as permissões do cargo (array, Set ou objeto); perm — a chave a verificar.
   Devolve: true se a tem, diretamente ou por implicação. */
function temPerm(perms,perm){return fechoPerms(perms).has(perm)}

// O id do utilizador com sessão; vazio sem sessão.
// Devolve: o id (texto), ou '' sem sessão.
function meuId(){return (window.CW&&CW.user&&CW.user.id)||''}
/* O meu cargo num imóvel. Sem sessão, sem CW.cargos ou num imóvel só local,
   sou o dono (e o criador): é o comportamento de sempre.
   Recebe: pid — o id do imóvel.
   Devolve: {dono, criador?, nome?, perms?} — dono true para dono e comproprietários
   (criador false num imóvel que outro criou); nome e perms só num cargo. */
function cargoDe(pid){return (window.CW&&CW.cargos&&pid&&CW.cargos[pid])||{dono:true}}
// Sou dono ou comproprietário deste imóvel (edito tudo, entro nas contas)?
// Recebe: pid — o id do imóvel.
// Devolve: true se sim.
function souDono(pid){return !!cargoDe(pid).dono}
// Fui eu que criei este imóvel? Só quem o criou o apaga e gere colaboradores e quotas.
// Recebe: pid — o id do imóvel.
// Devolve: true se sim (também sem sessão).
function souCriador(pid){const c=cargoDe(pid);return !!c.dono&&c.criador!==false}
/* Posso fazer isto neste imóvel? Dono e comproprietários podem tudo; um
   colaborador só o que o cargo dá. Sem imóvel (movimento avulso, modelo) é
   meu e posso.
   Recebe: pid — o id do imóvel (vazio ou null para «sem imóvel»); perm — a chave da permissão.
   Devolve: true se posso. */
function pode(pid,perm){if(!pid)return true;const c=cargoDe(pid);return c.dono?true:temPerm(c.perms||[],perm)}
/* Posso alterar ou apagar este registo? Adicionar é criar; editar e apagar,
   só o que eu próprio criei (o dono e os comproprietários editam tudo). Um
   registo que veio do servidor sem marca de criador (anterior à marca) não é
   meu — o servidor recusava-o e o registo do dono sumia do ecrã até ao pull
   seguinte; um registo só local (ainda sem _atServidor) é meu por definição.
   A exceção são os planeados: com «Adicionar e confirmar planeados» confirmo
   e silencio qualquer um (o servidor só lhe funde next, until e muted), mas
   os campos edito só nos meus, e apago só os meus — ou um alheio que termina
   ao ser confirmado (recTermina, em planeados.js): confirmá-lo é apagá-lo, e
   é o único apagar alheio que o servidor aceita.
   Recebe: pid — o id do imóvel do registo; perm — a permissão de adicionar
   (ex.: 'tx.add'); x (opcional) — o registo, com _createdBy e _atServidor
   vindos do servidor; acao (opcional) — true quando a ação é apagar,
   'confirmar' quando é confirmar ou silenciar um planeado; omitida, é
   alterar os campos.
   Devolve: true se posso. */
function podeEditar(pid,perm,x,acao){
  if(!pid||souDono(pid))return true;
  if(!pode(pid,perm))return false;
  if(!x)return true;
  const meu=x._createdBy?x._createdBy===meuId():!x._atServidor;
  if(meu||perm!=='rec.add')return meu;
  if(acao==='confirmar')return true;
  return !!acao&&typeof recTermina==='function'&&recTermina(x);
}
/* A frase da recusa, para o toast: vazia quando posso.
   Recebe: pid — o id do imóvel; perm — a permissão de adicionar; x (opcional) —
   o registo a alterar; acao (opcional) — true quando a ação é apagar,
   'confirmar' quando é confirmar ou silenciar um planeado (ver podeEditar).
   Devolve: a frase (texto), ou '' quando não há nada a recusar. */
function motivoRecusa(pid,perm,x,acao){
  if(podeEditar(pid,perm,x,acao))return '';
  if(!pode(pid,perm))return fraseSemPerm(perm);
  return 'Só quem o adicionou pode '+(acao&&acao!=='confirmar'?'apagar':'alterar')+' este registo — pede ao dono.';
}
/* Um pagamento de crédito ou uma amortização abate capital à hipoteca — e a
   hipoteca vive na ficha do imóvel, que só sobe com «Editar a ficha do
   imóvel». Sem isso o movimento subia e a dívida ficava na mesma no servidor.
   Recebe: pid — o id do imóvel (vazio ou null para «sem imóvel»).
   Devolve: a frase da recusa (texto), ou '' quando posso registar pagamentos de crédito. */
function motivoCredito(pid){
  if(!pode(pid,'tx.add'))return fraseSemPerm('tx.add');
  return pode(pid,'house.edit')?'':'Registar pagamentos de crédito precisa de poder editar a ficha do imóvel — pede ao dono.';
}
// A frase «Não tens permissão para <rótulo> neste imóvel — pede ao dono.».
// Recebe: perm — a chave da permissão em falta.
// Devolve: a frase (texto).
function fraseSemPerm(perm){
  const r=(ROTULOS[perm]||{}).rotulo||'fazer isto';
  return 'Não tens permissão para '+r.charAt(0).toLowerCase()+r.slice(1)+' neste imóvel — pede ao dono.';
}
// Os imóveis onde posso fazer isto (os meus e os de colaboração com a permissão).
// Recebe: perm — a chave da permissão.
// Devolve: array de imóveis (objetos de db.properties).
function casasComo(perm){return db.properties.filter(p=>pode(p.id,perm))}
// Os imóveis onde sou colaborador (não dono nem comproprietário).
// Devolve: array de imóveis.
function casasDeColaboracao(){return db.properties.filter(p=>!souDono(p.id))}
// Só tenho imóveis de colaboração — nenhum meu?
// Devolve: true quando há imóveis e nenhum é meu.
function souSoColaborador(){return db.properties.length>0&&!db.properties.some(p=>souDono(p.id))}
// Posso registar movimentos e planeados sem imóvel (são meus)? Um só-colaborador não tem onde os pôr.
// Devolve: true se posso.
function podeSemImovel(){return !souSoColaborador()}
/* Opções de imóvel para o seletor de um formulário: só onde posso adicionar,
   mais o imóvel já escolhido (um registo antigo não pode ficar sem casa).
   Recebe: perm — a permissão de adicionar; atual (opcional) — o id já escolhido.
   Devolve: array de {v, label} para o sel(). */
function propOptsPara(perm,atual){
  const list=casasComo(perm);
  if(atual&&!list.some(p=>p.id===atual)){const p=prop(atual);if(p)list.push(p)}
  return list.map(p=>({v:p.id,label:p.name||p.address||'imóvel'}));
}
/* Os proprietários que contam nas contas sem imóvel: os que partilham comigo
   algum imóvel meu, ou não estão ligados a imóvel nenhum, e eu. Os donos dos
   imóveis onde só colaboro ficam de fora — não tenho contas com eles.
   Devolve: array de fichas de db.owners. */
function donosGlobais(){
  const eu=meuId();
  return db.owners.filter(o=>o.id===eu||!o._userId||db.properties.some(p=>(p.ownerIds||[]).indexOf(o.id)>-1&&souDono(p.id))||!db.properties.some(p=>(p.ownerIds||[]).indexOf(o.id)>-1));
}
/* O imóvel a que uma ficha de inquilino pertence: o houseId gravado na ficha
   (criada a partir de uma visita, ou por quem só colabora), a marca do
   servidor, ou o do primeiro contrato dela; null numa ficha só minha.
   Recebe: t — a ficha do inquilino.
   Devolve: o id do imóvel, ou null. */
function casaDoInquilino(t){
  if(!t)return null;
  if(t.houseId||t._houseId)return t.houseId||t._houseId;
  const c=contractsOfTenant(t.id)[0];
  return c?c.propertyId:null;
}
// Posso alterar esta ficha de inquilino?
// Recebe: t — a ficha.
// Devolve: true se posso.
function podeEditarInquilino(t){return podeEditar(casaDoInquilino(t),'tenant.add',t)}

/* O nome de um utilizador pelo id: nos proprietários (utilizadores com acesso),
   depois nas pessoas que o estado trouxe (colaboradores), e por fim o id
   encurtado — nunca «undefined».
   Recebe: uid — o id do utilizador.
   Devolve: um nome apresentável (texto). */
function nomeUtilizador(uid){
  const o=(db.owners||[]).find(x=>x.id===uid||x._userId===uid);
  if(o&&o.name)return o.name;
  const pe=window.CW&&CW.pessoas&&CW.pessoas[uid];
  if(pe&&pe.name)return pe.name;
  return String(uid||'?').slice(0,8);
}
// O cargo de um utilizador, quando é colaborador; vazio para donos e desconhecidos.
// Recebe: uid — o id do utilizador.
// Devolve: o nome do cargo (texto), ou ''.
function cargoDeUtilizador(uid){
  const pe=window.CW&&CW.pessoas&&CW.pessoas[uid];
  return (pe&&pe.kind==='collab'&&pe.roleName)||'';
}

/* A parte pura do rebuildDb: dos imóveis e das pessoas do estado, o meu
   cargo em cada casa e os nomes de toda a gente. Um imóvel é meu (dono) se
   é mine ou se estou em participants; senão o cargo é o de h.collab; sem
   nenhum dos dois é um cargo vazio (vê o mínimo).
   Recebe: st — o estado de GET /api/state ({houses, people, connections, …});
   myId — o meu id.
   Devolve: {cargos, pessoas, ownersIds} — cargos: houseId → {dono, criador, nome,
   perms}; pessoas: id → {name, kind, roleName}; ownersIds: Set com quem é
   dono ou comproprietário de alguma casa, as ligações aceites e eu. */
function cargosDoEstado(st,myId){
  const cargos={},pessoas={},ownersIds=new Set(myId?[myId]:[]);
  ((st&&st.houses)||[]).forEach(h=>{
    const parts=h.participants||[h.ownerId];
    parts.forEach(u=>{if(u)ownersIds.add(u)});
    if(h.mine||parts.indexOf(myId)>-1)cargos[h.id]={dono:true,criador:!!h.mine||h.ownerId===myId};
    else{const c=h.collab||{};cargos[h.id]={dono:false,id:c.roleId||'',nome:c.roleName||'',perms:(c.perms||[]).slice()}}
  });
  ((st&&st.connections)||[]).forEach(c=>{if(c.status==='accepted'&&c.peer&&c.peer.id)ownersIds.add(c.peer.id)});
  ((st&&st.people)||[]).forEach(pe=>{if(pe&&pe.id)pessoas[pe.id]={name:pe.name||'',kind:pe.kind||'owner',roleName:pe.roleName||''}});
  ((st&&st.houses)||[]).forEach(h=>{if(h.ownerId&&!pessoas[h.ownerId])pessoas[h.ownerId]={name:h.ownerName||'',kind:'owner',roleName:''}});
  return {cargos,pessoas,ownersIds};
}

/* Lê a porta de entrada do URL: ?convite=<token> (ligação de convite, uso
   único) ou ?ligar=<token> (ligação de partilha). O token são 64 hex.
   Recebe: search — o location.search (com ou sem o «?»).
   Devolve: {tipo:'convite'|'ligar', token}, ou null se não há porta válida. */
function parseConvite(search){
  const m=/(?:^|[?&])(convite|ligar)=([0-9a-fA-F]{64})(?:&|$)/.exec(String(search||''));
  return m?{tipo:m[1],token:m[2].toLowerCase()}:null;
}

/* Quem me deu acesso e com que cargos, para o vazio da vista geral e os hints.
   Devolve: {n, donos, cargos} — o número de imóveis de colaboração e as listas
   de nomes (sem repetidos, pela ordem em que aparecem). */
function resumoColaborador(){
  const cs=casasDeColaboracao(),donos=[],cargos=[];
  cs.forEach(p=>{
    const d=p._sharedFrom||(p._ownerUserId?nomeUtilizador(p._ownerUserId):'');
    if(d&&donos.indexOf(d)<0)donos.push(d);
    const n=cargoDe(p.id).nome||p._cargo||'';
    if(n&&cargos.indexOf(n)<0)cargos.push(n);
  });
  return {n:cs.length,donos,cargos};
}
// «Maria», «Maria e Rui», «Maria, Rui e Ana».
// Recebe: xs — os nomes (array de textos).
// Devolve: a lista escrita (texto).
function listaE(xs){return xs.length<2?(xs[0]||''):xs.slice(0,-1).join(', ')+' e '+xs[xs.length-1]}
/* «És colaborador de Maria em 3 imóveis como Contabilista.» — o vazio da
   vista geral de quem só colabora.
   Devolve: a frase (texto, já escapada), ou '' sem imóveis de colaboração. */
function fraseColaborador(){
  const r=resumoColaborador();if(!r.n)return '';
  return 'És colaborador'+(r.donos.length?' de '+esc(listaE(r.donos)):'')+' em '+r.n+(r.n===1?' imóvel':' imóveis')+(r.cargos.length?' como '+esc(listaE(r.cargos)):'')+'.';
}
/* O selo do cartão de um imóvel de colaboração: «de <dono> · <cargo>». Leva a
   classe cw-shared para a nuvem não pendurar por cima o «de <nome>» dela.
   Recebe: p — o imóvel.
   Devolve: HTML do selo (texto), ou '' num imóvel meu. */
function seloCargo(p){
  if(souDono(p.id))return '';
  const dono=p._sharedFrom||(p._ownerUserId?nomeUtilizador(p._ownerUserId):''),nome=cargoDe(p.id).nome||p._cargo||'';
  const txt=[dono?'de '+dono:'',nome].filter(Boolean).join(' · ');
  return txt?`<span class="badge grey cw-shared" style="margin-left:7px">${esc(txt)}</span>`:'';
}
/* O selo «N colaboradores» nos meus imóveis com colaboradores (lido de p._colaboradores).
   Recebe: p — o imóvel.
   Devolve: HTML do selo (texto), ou '' sem colaboradores. */
function seloColaboradores(p){
  const n=(p._colaboradores||[]).length;
  return n?`<span class="badge grey">${ic('users',12)} ${n} colaborador${n===1?'':'es'}</span>`:'';
}
/* Os separadores que não têm nada para mostrar a quem só colabora: os
   financeiros quando nenhum imóvel visível abre as finanças, e os outros
   quando nenhum cargo os abre. Para quem tem imóveis seus, nada se esconde.
   Devolve: array de ids de TABS a esconder. */
function separadoresEscondidos(){
  const out=[],nada=perm=>!casasComo(perm).length;
  /* cargos e convites vivem no servidor: sem conta na nuvem o separador não
     tem o que mostrar (a vista explica-o, mas não vale ocupar o menu) */
  if(!(typeof window!=='undefined'&&window.CW&&CW.user))out.push('colaboradores');
  if(!souSoColaborador())return out;
  if(!scope().length){out.push('credits','projections','reports','fisco');
    if(nada('tx.view')&&!db.transactions.length)out.push('transactions');
    if(nada('rec.view')&&!(db.recurring||[]).length)out.push('recurring')}
  if(nada('contract.view'))out.push('contracts');
  if(nada('tenant.view')&&!db.tenants.length)out.push('tenants');
  if(nada('visit.view')&&!(db.visits||[]).length)out.push('visits');
  return out;
}
/* Uma cópia da base só com o que é meu: os imóveis de colaboração e os seus
   registos ficam de fora das cópias de segurança e do CSV.
   Devolve: uma base nova (objeto com a forma de db), sem os imóveis de colaboração. */
function dbSoMeu(){
  const d=JSON.parse(JSON.stringify(db));
  const fora=new Set(casasDeColaboracao().map(p=>p.id));
  if(!fora.size)return d;
  d.properties=d.properties.filter(p=>!fora.has(p.id));
  ['contracts','transactions','visits'].forEach(k=>{d[k]=(d[k]||[]).filter(x=>!fora.has(x.propertyId))});
  d.recurring=(d.recurring||[]).filter(r=>!fora.has((r.tx||{}).propertyId));
  /* uma ficha de inquilino é de fora se está presa (houseId ou a marca do
     servidor) a um imóvel de colaboração, ou se só está em contratos desses imóveis */
  d.tenants=(d.tenants||[]).filter(t=>{
    const h=t.houseId||t._houseId;
    if(h)return !fora.has(h);
    const cs=(db.contracts||[]).filter(c=>(c.tenantIds||[]).indexOf(t.id)>-1);
    return !cs.length||cs.some(c=>!fora.has(c.propertyId));
  });
  return d;
}

if(typeof module!=='undefined'&&module.exports){
  module.exports={PERMS,IMPLICA,ROTULOS,CARGOS_EXEMPLO,KIND_PERM,temPerm,fechoPerms};
}
