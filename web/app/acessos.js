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
   único), ?ligar=<token> (ligação de partilha) ou ?grupo=<token> (ligação
   de um grupo partilhado, multi-uso). O token são 64 hex.
   Recebe: search — o location.search (com ou sem o «?»).
   Devolve: {tipo:'convite'|'ligar'|'grupo', token}, ou null se não há porta válida. */
function parseConvite(search){
  const m=/(?:^|[?&])(convite|ligar|grupo)=([0-9a-fA-F]{64})(?:&|$)/.exec(String(search||''));
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
  return txt?`<span class="badge grey cw-shared u-ml-7px">${esc(txt)}</span>`:'';
}
/* O selo «N colaboradores» nos meus imóveis com colaboradores (lido de p._colaboradores).
   Recebe: p — o imóvel.
   Devolve: HTML do selo (texto), ou '' sem colaboradores. */
function seloColaboradores(p){
  const n=(p._colaboradores||[]).length;
  return n?`<span class="badge grey">${ic('users',12)} ${n} colaborador${n===1?'':'es'}</span>`:'';
}
/* As ações de adicionar que um cargo abre, pela ordem em que se oferecem — a
   das visitas primeiro. Cada uma diz o serviço de que depende e escreve a
   ação com o imóvel (pid) ou sem ele (o formulário escolhe entre os imóveis
   onde se pode). A gramática das ações (eventos.js) não tem objetos
   literais: a visita com o imóvel e o «Novo movimento» com o imóvel posto
   vão por uma função com nome. */
const ACOES_DO_CARGO=[
  {perm:'visit.add',servico:'visits',rotulo:'Marcar visita',icon:'door',toca:'camada',
    act:pid=>pid?`marcarVisitaNoImovel('${jsq(pid)}')`:'visitModal()'},
  {perm:'tenant.add',servico:'tenants',rotulo:'Adicionar inquilino',icon:'users',toca:'camada',
    act:pid=>pid?`personModal('tenant',null,null,'${jsq(pid)}')`:`personModal('tenant')`},
  {perm:'contract.add',servico:'contracts',rotulo:'Novo contrato',icon:'contract',toca:'camada',
    act:pid=>pid?`ctModal(null,'${jsq(pid)}')`:'ctModal()'},
  {perm:'tx.add',servico:'transactions',rotulo:'Registar movimento',icon:'swap',toca:'camada',
    act:pid=>pid?`registarMovimentoNoImovel('${jsq(pid)}')`:'newTxPick()'},
  {perm:'rec.add',servico:'recurring',rotulo:'Confirmar planeados',icon:'clock',toca:'ecra',act:()=>"go('recurring')"},
  {perm:'house.edit',servico:'properties',rotulo:'Editar a ficha',icon:'pen',toca:'camada',
    act:pid=>pid?`propModal('${jsq(pid)}')`:'editarFichaDeColaboracao()'}
];
/* O que o meu cargo me deixa adicionar num imóvel de colaboração, com o
   imóvel já posto na ação. Só com o serviço ligado nesta conta; o «Novo
   contrato» só num imóvel de arrendamento (noutro o formulário só avisava).
   Recebe: pid — o id do imóvel.
   Devolve: array de {perm, rotulo, icon, toca, act} — vazio para o dono, sem imóvel ou sem nenhuma. */
function acoesNoImovel(pid){
  const p=pid?prop(pid):null;
  if(!p||souDono(pid))return [];
  return ACOES_DO_CARGO.filter(a=>pode(pid,a.perm)&&servicoLigado(a.servico)&&(a.perm!=='contract.add'||p.use==='investimento'))
    .map(a=>({perm:a.perm,rotulo:a.rotulo,icon:a.icon,toca:a.toca,act:a.act(pid)}));
}
/* As ações de todos os imóveis onde colaboro, sem repetir e pela ordem de
   ACOES_DO_CARGO, sem imóvel na ação: o formulário escolhe entre os imóveis
   onde se pode.
   Devolve: array de {perm, rotulo, icon, toca, act} — vazio sem imóveis de colaboração. */
function acoesDoColaborador(){
  const tem=new Set();
  casasDeColaboracao().forEach(p=>acoesNoImovel(p.id).forEach(a=>tem.add(a.perm)));
  return ACOES_DO_CARGO.filter(a=>tem.has(a.perm)).map(a=>({perm:a.perm,rotulo:a.rotulo,icon:a.icon,toca:a.toca,act:a.act(null)}));
}
/* O que o meu cargo me deixa adicionar num imóvel, em minúsculas e pela
   ordem de PERMS: os rótulos de ROTULOS das permissões de adicionar do fecho
   (contract.add traz os planeados), menos as de um serviço desligado.
   Recebe: pid — o id do imóvel.
   Devolve: array de textos (ex.: ['marcar visitas', 'adicionar inquilinos']); vazio para o dono. */
function podesNoImovel(pid){
  if(!pid||souDono(pid))return [];
  const f=fechoPerms(cargoDe(pid).perms||[]);
  const ligada=k=>{const a=ACOES_DO_CARGO.find(x=>x.perm===k);return !a||servicoLigado(a.servico)};
  return PERMS.filter(k=>(/\.add$/.test(k)||k==='house.edit')&&f.has(k)&&ligada(k))
    .map(k=>{const r=ROTULOS[k].rotulo;return r.charAt(0).toLowerCase()+r.slice(1)});
}
/* «Neste imóvel podes: marcar visitas e adicionar inquilinos.» — a nota da
   ficha de um imóvel de colaboração.
   Recebe: pid — o id do imóvel.
   Devolve: a frase (texto, por escapar), ou '' para o dono ou sem nada para adicionar. */
function frasePodesNoImovel(pid){const l=podesNoImovel(pid);return l.length?'Neste imóvel podes: '+listaE(l)+'.':''}
/* A mesma frase, curta, para o cartão do imóvel e para «Imóveis onde
   colaboras»: «Podes marcar visitas e adicionar inquilinos».
   Recebe: pid — o id do imóvel.
   Devolve: o texto (por escapar); «Só podes consultar» num cargo que só vê; '' para o dono. */
function fraseCurtaPodes(pid){
  if(!pid||souDono(pid))return '';
  const l=podesNoImovel(pid);
  return l.length?'Podes '+listaE(l):'Só podes consultar';
}
/* Marca uma visita já com o imóvel escolhido (a ação dos botões de um imóvel).
   Recebe: pid — o id do imóvel.
   Devolve: nada — abre o formulário da visita. */
function marcarVisitaNoImovel(pid){chamarServico('visits','visitModal',null,{propertyId:pid})}
/* Regista um movimento num imóvel: o caminho do FAB dos Movimentos (primeiro
   o tipo), com o imóvel posto. O pagamento de crédito abate capital na ficha
   do imóvel: sem a poder editar, diz-se antes de abrir o formulário.
   Recebe: pid — o id do imóvel.
   Devolve: nada — abre a escolha do tipo e, depois, o formulário. */
function registarMovimentoNoImovel(pid){
  chamarServico('transactions','newTxPick',k=>{
    if(k==='loan'){const rc=motivoCredito(pid);if(rc)return toast(rc)}
    chamarServico('transactions','txModal',{kind:k,propId:pid});
  });
}
/* «Editar a ficha» sem imóvel (o cartão da vista geral): com um só imóvel
   onde posso, abre esse; com vários, escolhe-se primeiro.
   Devolve: nada — abre o formulário do imóvel (ou, antes, a escolha). */
function editarFichaDeColaboracao(){
  const cs=casasDeColaboracao().filter(p=>pode(p.id,'house.edit'));
  if(!cs.length)return toast(fraseSemPerm('house.edit'));
  if(cs.length===1)return chamarServico('properties','propModal',cs[0].id);
  pickModal('Que imóvel?',cs.map(p=>({v:p.id,label:p.name||p.address||'imóvel',sub:p._sharedFrom?'de '+p._sharedFrom:'',icon:'building'})),
    o=>{closeModal();chamarServico('properties','propModal',o.v)});
}
/* Tudo o que se pode adicionar na app, pela ordem em que a folha do + da
   barra de baixo o oferece (navegacao.js:abrirAdicionar). É para toda a
   gente, dono incluído — ACOES_DO_CARGO é só de quem colabora. Cada uma diz
   o serviço de que depende, a condição que a mostra — a MESMA do FAB da
   lista respetiva, para o + e o FAB nunca discordarem — e a ação, escrita na
   gramática das ações (os nomes são de serviços: a gramática resolve-os na
   hora, e só se o serviço estiver ligado é que a ação se oferece). */
const ACOES_DE_ADICIONAR=[
  {id:'movimento',label:'Movimento',icon:'swap',servico:'transactions',quando:()=>podeSemImovel()||casasComo('tx.add').length>0,act:'newTxPick()'},
  {id:'imovel',label:'Imóvel',icon:'building',servico:'properties',quando:()=>!souSoColaborador(),act:'propModal()'},
  {id:'contrato',label:'Contrato',icon:'contract',servico:'contracts',quando:()=>casasComo('contract.add').length>0,act:'ctModal()'},
  {id:'inquilino',label:'Inquilino',icon:'users',servico:'tenants',quando:()=>!souSoColaborador()||casasComo('tenant.add').length>0,act:"personModal('tenant')"},
  {id:'proprietario',label:'Proprietário',icon:'crown',servico:'owners',quando:()=>!souSoColaborador(),act:"personModal('owner')"},
  {id:'visita',label:'Visita',icon:'door',servico:'visits',quando:()=>casasComo('visit.add').length>0,act:'visitModal()'},
  {id:'planeado',label:'Movimento recorrente',icon:'clock',servico:'recurring',quando:()=>podeSemImovel()||casasComo('rec.add').length>0,act:'newRec()'},
  {id:'modelo',label:'Modelo',icon:'file',servico:'recurring',quando:()=>podeSemImovel()||casasComo('rec.add').length>0,act:'newTpl()'},
  {id:'hipoteca',label:'Hipoteca',icon:'bank',servico:'credits',quando:()=>casasComo('house.edit').length>0,act:'newMort()'}
];
/* O que esta pessoa pode adicionar agora: as ações de ACOES_DE_ADICIONAR
   cujo serviço está ligado nesta conta e cuja condição se cumpre, pela
   ordem de lá. O dono tem as nove; um gestor de visitas tem a visita e o
   inquilino; um cargo que só vê não tem nenhuma — e sem nenhuma a barra de
   baixo não escreve o + (navegacao.js:buildTabbar).
   Devolve: array de {id, label, icon, act, toca:'camada'} — vazio sem nada para adicionar. */
function acoesDeAdicionar(){
  return ACOES_DE_ADICIONAR.filter(a=>servicoLigado(a.servico)&&a.quando()).map(a=>({id:a.id,label:a.label,icon:a.icon,act:a.act,toca:'camada'}));
}
/* A ação natural de cada ecrã — a que a folha do + põe em primeiro e marca
   «neste ecrã»: nos Movimentos e na visão geral o movimento, no Calendário
   (como nas Visitas) a visita. As Definições, as Projeções, a Avaliação, a
   Declaração e os Colaboradores não têm: a folha fica pela ordem de sempre.
   Recebe: tab — o id do separador.
   Devolve: o id da ação (um de ACOES_DE_ADICIONAR), ou '' num ecrã sem ação natural. */
function acaoDoSeparador(tab){
  return ({dashboard:'movimento',transactions:'movimento',properties:'imovel',contracts:'contrato',tenants:'inquilino',owners:'proprietario',
    visits:'visita',calendar:'visita',recurring:'planeado',credits:'hipoteca'})[tab]||'';
}
/* Os destinos da barra de baixo: cada destino escondido dá o lugar ao
   primeiro visível de visitas, contratos, inquilinos e planeados que ainda
   não esteja na barra; sem substituto, o lugar some. Quem nada esconde fica
   com a barra de sempre.
   Recebe: ids — os destinos de origem (TABBAR); fora (opcional) — os ids escondidos (separadoresEscondidos).
   Devolve: array de ids, sem repetidos. */
function barraDeBaixo(ids,fora){
  const f=fora||[],base=ids||[],out=[];
  const subs=['visits','contracts','tenants','recurring'].filter(id=>f.indexOf(id)<0&&base.indexOf(id)<0);
  base.forEach(id=>{
    const x=f.indexOf(id)<0?id:subs.shift();
    if(x&&out.indexOf(x)<0)out.push(x);
  });
  return out;
}
/* Os separadores que não têm nada para mostrar a quem só colabora: os
   financeiros quando nenhum imóvel visível abre as finanças, e os outros
   quando nenhum cargo os abre. Movimentos e Planeados escondem-se sem cargo
   que os abra mesmo quando o âmbito das finanças não está vazio (hipotecas
   ou valores sem movimentos): eram um separador vazio na barra de baixo.
   Para quem tem imóveis seus, nada se esconde.
   Devolve: array de ids de TABS a esconder, sem repetidos. */
function separadoresEscondidos(){
  const out=[],nada=perm=>!casasComo(perm).length;
  const poe=id=>{if(out.indexOf(id)<0)out.push(id)};
  /* os serviços desligados nesta conta (servicos.js): o separador some do
     menu, e o resto da app pergunta servicoLigado antes de lhes tocar */
  if(typeof servicosDesligados==='function')servicosDesligados().forEach(poe);
  /* cargos e convites vivem no servidor: sem conta na nuvem o separador não
     tem o que mostrar (a vista explica-o, mas não vale ocupar o menu) */
  if(!(typeof window!=='undefined'&&window.CW&&CW.user))poe('colaboradores');
  if(!souSoColaborador())return out;
  if(!scope().length)['credits','projections','reports','fisco'].forEach(poe);
  if(nada('tx.view')&&!db.transactions.length)poe('transactions');
  if(nada('rec.view')&&!(db.recurring||[]).length)poe('recurring');
  if(nada('contract.view'))poe('contracts');
  if(nada('tenant.view')&&!db.tenants.length)poe('tenants');
  if(nada('visit.view')&&!(db.visits||[]).length)poe('visits');
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
