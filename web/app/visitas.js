/* ================= VISITAS ================= */
/* Quem veio ver a casa, antes de haver contrato.

   Uma visita não é um inquilino: quem vem ver ainda não tem ficha, e
   pode nunca vir a ter — basta o nome (ou nomes) e, se quiseres, um
   contacto para remarcar. Quando a visita corre bem e vira arrendamento,
   o menu contextual converte-a numa ficha de inquilino num toque, com o
   nome e o contacto já lá dentro.

   Além do pedido — quem, onde, quando, comentários — cada visita tem
   estado (agendada, realizada, faltou, cancelada) e desfecho (interessado,
   a pensar, sem interesse): é o que transforma uma lista de datas num
   histórico com que se decide. */

// os estados de uma visita, por ordem de vida
const VESTADO={agendada:'Agendada',realizada:'Realizada',faltou:'Faltou',cancelada:'Cancelada'};
// o desfecho de uma visita realizada — vazio enquanto não se souber
const VDESFECHO={'':'—',interessado:'Interessado',pensar:'A pensar','sem-interesse':'Sem interesse'};

let visForm=null,visFiltroProp='',visFiltroEstado='';

/* A lista de visitas ordenada da mais próxima para a mais distante (as
   futuras primeiro, depois as passadas em ordem inversa).
   Devolve: a lista de visitas do db, ordenada por data e hora de início. */
function visOrdenadas(){
  const chave=v=>(v.date||'9999')+' '+(v.start||'');
  return (db.visits||[]).slice().sort((a,b)=>chave(a)<chave(b)?-1:1);
}

/* Se a visita já ficou para trás no calendário (dia anterior a hoje).
   Recebe: v — a visita.
   Devolve: verdadeiro quando a data é anterior a hoje. */
function visPassada(v){return (v.date||'')<pzHoje()}

/* A página das visitas: filtros no topo (imóvel e estado, com os menus da
   casa), as próximas e as passadas em blocos separados, e o FAB para marcar.
   Devolve: o HTML da página (texto). */
function vVisits(){
  const lista=visOrdenadas()
    .filter(v=>!visFiltroProp||v.propertyId===visFiltroProp)
    .filter(v=>!visFiltroEstado||v.estado===visFiltroEstado);
  const props=db.properties.map(p=>({v:p.id,label:p.name||p.address||'imóvel'}));
  const filtros=`<div class="toolbar" style="margin-bottom:14px;gap:10px;flex-wrap:wrap">
    <div style="flex:1;min-width:170px">${sel('vi_fp',visFiltroProp,[{v:'',label:'Todos os imóveis'}].concat(props),'visFiltra')}</div>
    <div style="flex:1;min-width:150px">${sel('vi_fe',visFiltroEstado,[{v:'',label:'Todos os estados'}].concat(Object.keys(VESTADO).map(k=>({v:k,label:VESTADO[k]}))),'visFiltra')}</div></div>`;
  if(!(db.visits||[]).length)
    return `<div class="empty"><b>Ainda não há visitas</b>Marca a primeira: quem vem, a que imóvel, e quando.
      <div class="toolbar" style="justify-content:center;margin-top:16px">
      <button class="btn primary" onclick="visitModal()">Marcar visita</button></div></div>`;
  const futuras=lista.filter(v=>!visPassada(v)),passadas=lista.filter(visPassada).reverse();
  const bloco=(titulo,vs)=>vs.length?`<div class="navh" style="margin:4px 0 8px">${titulo}</div>
    <div class="list" style="margin-bottom:16px">${vs.map(visCard).join('')}</div>`:'';
  return filtros+bloco('Próximas',futuras)+bloco('Passadas',passadas)+
    (lista.length?'':'<div class="empty">Nada com estes filtros.</div>')+
    `<button class="fab" onclick="visitModal()" aria-label="Marcar visita">${ic('plus',22)}</button>`;
}

/* Reage aos menus de filtro da página (imóvel e estado) e redesenha.
   Devolve: nada — lê os valores escolhidos e chama render(). */
function visFiltra(){
  visFiltroProp=(document.getElementById('vi_fp')||{}).value||'';
  visFiltroEstado=(document.getElementById('vi_fe')||{}).value||'';
  render();
}

/* O cartão de uma visita na lista: quem, onde e quando à esquerda, o selo
   de estado à direita, e o menu contextual (⋯) com as ações — marcar
   realizada ou falta, converter em inquilino, apagar com Anular.
   Recebe: v — a visita.
   Devolve: o HTML do cartão (texto). */
function visCard(v){
  const p=prop(v.propertyId);
  const quarto=v.roomId&&p?(p.rooms.find(r=>r.id===v.roomId)||{}).name:'';
  const hora=v.start?v.start+(v.end?'–'+v.end:''):'';
  const seloCls=v.estado==='realizada'?'':v.estado==='faltou'||v.estado==='cancelada'?'grey':'amber';
  const desf=v.estado==='realizada'&&v.resultado?' · '+VDESFECHO[v.resultado]:'';
  const acoes=[];
  if(v.estado==='agendada'){
    acoes.push({label:'Marcar realizada',icon:'check',act:`visEstado('${v.id}','realizada')`});
    acoes.push({label:'Marcar falta',icon:'clock',act:`visEstado('${v.id}','faltou')`});
  }
  acoes.push({label:'Converter em inquilino',icon:'users',act:`visConverte('${v.id}')`});
  acoes.push({label:'Apagar visita',icon:'trash',danger:true,act:`visApaga('${v.id}')`});
  return `<div class="card tap" onclick="visitModal('${v.id}')">
    <div class="row-between" style="align-items:flex-start;gap:8px">
      <div style="min-width:0">
        <b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(v.nomes||'(sem nome)')}</b>
        <span class="small">${esc(p?(p.name||p.address):'imóvel?')}${quarto?' · '+esc(quarto):''} · ${esc(v.date||'sem data')}${hora?' · '+esc(hora):''}${desf}</span>
        ${v.notas?`<span class="small" style="display:block;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(v.notas)}</span>`:''}</div>
      <span style="flex:0 0 auto;display:inline-flex;align-items:center;gap:4px">
        <span class="badge ${seloCls}">${VESTADO[v.estado]||v.estado}</span>
        <span onclick="event.stopPropagation()">${menu('vis'+v.id,acoes)}</span></span></div></div>`;
}

/* O formulário de uma visita — novo ou edição — no modal da casa: imóvel e
   quarto (quando o imóvel é por quartos) nos menus da app, data e horas
   nativas, estado e desfecho, nomes e contacto livres.
   Recebe: id (opcional) — a visita a editar; sem id, cria-se uma nova;
   extra (opcional) — campos a pré-preencher numa nova (ex.: a data, vinda
   do calendário).
   Devolve: nada — abre o modal e liga o onSave. */
function visitModal(id,extra){
  visForm=normVisit(id?JSON.parse(JSON.stringify((db.visits||[]).find(x=>x.id===id))):
    Object.assign({propertyId:visFiltroProp||(db.properties[0]||{}).id||'',date:pzHoje()},extra||{}));
  const m=id?menu('vism',[{label:'Apagar visita',icon:'trash',danger:true,act:`closeModal();visApaga('${id}')`}]):'';
  openModal(id?'Editar visita':'Marcar visita',visBody(),null,m);
  onSave=()=>{
    visColhe();
    if(!visForm.nomes.trim())return toast('Escreve quem vem à visita.');
    if(!visForm.propertyId)return toast('Escolhe o imóvel.');
    if(!visForm.date)return toast('Escolhe a data.');
    if(visForm.end&&visForm.start&&visForm.end<visForm.start)return toast('A hora de fim é antes da de início.');
    db.visits=db.visits||[];
    const i=db.visits.findIndex(x=>x.id===visForm.id);
    if(i<0)db.visits.push(visForm);else db.visits[i]=visForm;
    save();closeModal();render();toast('Visita guardada.');
  };
}

/* O corpo do formulário da visita, a partir de visForm.
   Devolve: o HTML do formulário (texto). */
function visBody(){
  const v=visForm;
  const props=db.properties.map(p=>({v:p.id,label:p.name||p.address||'imóvel'}));
  const p=prop(v.propertyId);
  const quartos=p&&p.rentalMode==='quartos'&&(p.rooms||[]).length
    ?[{v:'',label:'Casa inteira'}].concat(p.rooms.map(r=>({v:r.id,label:r.name||'quarto'})))
    :null;
  return `<div class="form">
    <label>Quem vem<input id="vi_nomes" value="${esc(v.nomes)}" placeholder="Ana Rodrigues (e o irmão)" autocomplete="off"></label>
    <label>Contacto<input id="vi_contacto" value="${esc(v.contacto)}" placeholder="Telemóvel ou email — opcional, para confirmar ou remarcar" autocomplete="off"></label>
    <label>Imóvel${sel('vi_prop',v.propertyId,props,'visPropMudou')}</label>
    ${quartos?`<label>Quarto${sel('vi_room',v.roomId,quartos)}</label>`:''}
    <div class="row3">
      <label>Data<input id="vi_date" type="date" value="${v.date||''}"></label>
      <label>Início<input id="vi_start" type="time" value="${v.start||''}"></label>
      <label>Fim<input id="vi_end" type="time" value="${v.end||''}"></label></div>
    <div class="row">
      <label>Estado${sel('vi_estado',v.estado,Object.keys(VESTADO).map(k=>({v:k,label:VESTADO[k]})))}</label>
      <label>Desfecho${sel('vi_res',v.resultado,Object.keys(VDESFECHO).map(k=>({v:k,label:VDESFECHO[k]})))}</label></div>
    <label>Comentários<textarea id="vi_notas" placeholder="Primeiras impressões, perguntas que fizeram, o que ficou combinado…">${esc(v.notas)}</textarea></label>
    <div class="hint">O desfecho preenche-se depois da visita — é o que separa um «talvez» de um «liga já».</div></div>`;
}

/* O menu do imóvel mudou dentro do formulário: recolhe o que está escrito e
   repinta o corpo (o menu do quarto aparece ou some conforme o imóvel).
   Devolve: nada — atualiza visForm e o HTML do modal. */
function visPropMudou(){
  visColhe();
  visForm.roomId='';
  const t=modalTop();const corpo=t&&t.el.querySelector('.body');
  if(corpo)corpo.innerHTML=visBody();
}

/* Copia os campos do modal para visForm — chamar antes de repintar ou gravar.
   Devolve: nada — atualiza visForm com o que está no formulário. */
function visColhe(){
  const g=id=>{const e=document.getElementById(id);return e?e.value:undefined};
  ['nomes','contacto','notas'].forEach(k=>{const x=g('vi_'+k);if(x!==undefined)visForm[k]=x});
  const mapa={propertyId:'vi_prop',roomId:'vi_room',date:'vi_date',start:'vi_start',end:'vi_end',estado:'vi_estado',resultado:'vi_res'};
  Object.keys(mapa).forEach(k=>{const x=g(mapa[k]);if(x!==undefined)visForm[k]=x});
}

/* Muda o estado de uma visita a partir do menu contextual, sem abrir o modal.
   Recebe: id — a visita; estado — o novo estado ('realizada', 'faltou', …).
   Devolve: nada — grava e redesenha, com um toast a dizer o que ficou. */
function visEstado(id,estado){
  const v=(db.visits||[]).find(x=>x.id===id);if(!v)return;
  v.estado=estado;save();render();
  toast(estado==='realizada'?'Realizada — preenche o desfecho quando souberes.':'Ficou registado.');
}

/* Apaga uma visita com rede: seis segundos de «Anular» antes de ser de vez.
   Recebe: id — a visita a apagar.
   Devolve: nada — remove, grava e redesenha, com Anular no toast. */
function visApaga(id){
  const i=(db.visits||[]).findIndex(x=>x.id===id);if(i<0)return;
  const copia=db.visits[i];
  db.visits.splice(i,1);save();render();
  comDesfazer('Visita apagada.',()=>{db.visits.splice(i,0,copia);save();render()});
}

/* Converte a visita numa ficha de inquilino: abre a ficha nova já com o nome
   e o contacto preenchidos (telefone ou email, conforme o que lá estiver) —
   o resto preenche-se quando o contrato for a sério.
   Recebe: id — a visita a converter.
   Devolve: nada — abre o personModal de um inquilino novo pré-preenchido. */
function visConverte(id){
  const v=(db.visits||[]).find(x=>x.id===id);if(!v)return;
  const c=(v.contacto||'').trim();
  const novo=normPerson({name:v.nomes,phone:/@/.test(c)?'':c,email:/@/.test(c)?c:'',
    notes:v.notas?'Da visita de '+(v.date||'?')+': '+v.notas:''});
  db.tenants.push(novo);save();
  personModal('tenant',novo.id);
  toast('Ficha criada a partir da visita — completa o que faltar.');
}
