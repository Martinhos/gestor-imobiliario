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
/* A cor do selo de cada estado, a mesma do painel do dia da Agenda
   (calendario.js:calDiaPanel): agendada cobalto, realizada verde, faltou
   âmbar, cancelada cinzenta. '' é o cobalto do .badge. */
const VIS_COR={agendada:'',realizada:'in',faltou:'amber',cancelada:'grey'};
/* E a de cada desfecho: interessado verde, a pensar cobalto (ainda por
   decidir), sem interesse cinzento. */
const VIS_COR_DESF={interessado:'in',pensar:'','sem-interesse':'grey'};

let visForm=null;

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

/* Um par de campos de intervalo (de–até) para a grelha do painel de filtros
   (vistas.js:lfCabeca), lado a lado como o «De» e o «Até» dos Movimentos:
   datas ou horas, guardadas no estado da lista. Cada campo diz o nome
   inteiro («Dia — de», «Dia — até»), que é também o que o leitor de ecrã diz,
   e os dois contam como um filtro só no funil (o junto).
   Recebe: tipo — 'date' ou 'time'; k1/k2 — as chaves do estado para o «de» e
   o «até»; rotulo — o nome do intervalo («Dia»).
   Devolve: os dois campos [{chave, nome, tipo, junto}]. */
function visIntervalo(tipo,k1,k2,rotulo){
  return [{chave:k1,nome:rotulo+' — de',tipo:tipo,junto:k1},{chave:k2,nome:rotulo+' — até',tipo:tipo,junto:k1}];
}

/* A página das visitas (o canvas M-Visitas), com os filtros dos Movimentos
   (vistas.js:lfCabeca): por cima, a pesquisa à vista com o funil do painel
   completo, e os chips — o imóvel, o estado e o desfecho, cada um a sua
   escolha (visitas.js:visChipSel), e os dias e horas, que abrem o painel
   nos intervalos (visitas.js:visChips). O painel tem os mesmos três
   seletores e os intervalos de dia e de hora de início. Por baixo, as
   próximas e as passadas em dois cartões, cada um com o título e quantas
   são; no computador lado a lado. Sem FAB: o «Marcar visita» está no
   cabeçalho e no + da barra, e no vazio.
   Devolve: o HTML da página (texto). */
function vVisits(){
  const K='lvis',s=lf(K);
  const lista=visOrdenadas().filter(v=>{
    if(s.pr&&v.propertyId!==s.pr)return false;
    if(s.es&&v.estado!==s.es)return false;
    if(s.rs&&v.resultado!==s.rs)return false;
    if(s.d1&&(v.date||'')<s.d1)return false;
    if(s.d2&&(v.date||'')>s.d2)return false;
    if(s.h1&&(v.start||'')<s.h1)return false;
    if(s.h2&&(v.start||'99:99')>s.h2)return false;
    return lfHit(K,[v.nomes,v.contacto,v.notas,propName(v.propertyId)].join(' '));
  });
  const marca=casasComo('visit.add').length>0;   /* sem imóvel onde possa marcar, não há botão */
  if(!(db.visits||[]).length)
    return esperaDoServidor()||`<div class="empty"><b>Ainda não há visitas</b>${marca?'Marca a primeira: quem vem, a que imóvel, e quando.':'As visitas aos imóveis onde colaboras aparecem aqui.'}${marca?saida('Marcar visita','visitModal()','camada'):''}</div>`;
  /* na grelha os pares ficam lado a lado: o imóvel e o estado, os dias, as
     horas, e o desfecho no fim; os chips seguem a ordem dos campos rápidos */
  const head=lfCabeca(K,{nome:['visita','visitas'],dos:'das visitas',n:lista.length,
    campos:[visChipSel('pr','Imóvel'),visChipSel('es','Estado')]
      .concat(visIntervalo('date','d1','d2','Dia'),visIntervalo('time','h1','h2','Hora de início'),[visChipSel('rs','Desfecho')]),
    chips:visChips(K)});
  const futuras=lista.filter(v=>!visPassada(v)),passadas=lista.filter(visPassada).reverse();
  /* o título do grupo fica FORA do contentor: o motor deita fora tudo o que
     não seja um item com chave */
  const grupo=(titulo,vs)=>vs.length?`<section class="vis-grupo"><div class="vis-grupo-cab"><h2>${titulo}</h2><span class="small num">${vs.length}</span></div>`
    +listaViva('visitas:'+titulo,vs.map(v=>({chave:'vis:'+v.id,html:visCard(v)})),'vis-lista')+'</section>':'';
  return head+(lista.length?`<div class="vis-grupos">${grupo('Próximas',futuras)}${grupo('Passadas',passadas)}</div>`:vazioFiltro());
}
/* As opções de um filtro das visitas, iguais no painel e nos chips.
   Recebe: chave — 'pr' (imóvel), 'es' (estado) ou 'rs' (desfecho).
   Devolve: [{v, label}] com o «todos» à cabeça. */
function visOpcoesDoFiltro(chave){
  if(chave==='pr')return [{v:'',label:'Todos os imóveis'}].concat(db.properties.map(p=>({v:p.id,label:p.name||p.address||'imóvel'})));
  if(chave==='es')return [{v:'',label:'Todos os estados'}].concat(Object.keys(VESTADO).map(x=>({v:x,label:VESTADO[x]})));
  return [{v:'',label:'Todos os desfechos'}].concat(Object.keys(VDESFECHO).filter(Boolean).map(x=>({v:x,label:VDESFECHO[x]})));
}
/* Os chips das visitas que não são um campo (o.chips do vistas.js:lfCabeca):
   o «Dias e horas», que leva aos intervalos no painel
   (vistas.js:lfAbrirEm, com o foco no primeiro dia) e, ligado, diz o
   intervalo com o × que o limpa. Desligado só aparece no ecrã largo, para a
   fila caber no telemóvel: lá, os intervalos estão no funil.
   Recebe: k — a chave da lista ('lvis').
   Devolve: [{html, x}] — o chip e se tem o seu ×. */
function visChips(k){
  const s=lf(k),dias=visDiasRotulo(s),abrir=`lfAbrirEm('${jsq(k)}','lfi_${jsq(k)}_d1')`;
  if(dias)return [{x:true,html:`<span class="mov-chip on lfm-chip-abre"><button type="button" class="mov-chip-txt" aria-label="${esc('Dias e horas: '+dias+'. Mudar nos filtros')}" data-toca="vista" data-click="${abrir}">${esc(dias)}</button><button type="button" class="mov-chip-x" aria-label="Limpar dias e horas" data-toca="vista" data-click="visLimparChip('${jsq(k)}','dias')">${ic('x',14)}</button></span>`}];
  return [{x:false,html:`<span class="mov-chip mov-so-largo lfm-chip-abre"><button type="button" class="mov-chip-txt" data-toca="vista" data-click="${abrir}">Dias e horas</button></span>`}];
}
/* O campo de um filtro das visitas (o imóvel, o estado, o desfecho): um chip
   rápido — o menu da casa vestido de chip, que ligado diz o valor com o × —
   e um seletor do painel, o mesmo estado lf('lvis')[chave], aplicado ao
   escolher (vistas.js:lfCabeca).
   Recebe: chave — o campo do filtro ('pr', 'es', 'rs'); nome — o nome do filtro («Imóvel»).
   Devolve: o campo {chave, nome, opcoes, curto, rapido}. */
function visChipSel(chave,nome){
  return {chave:chave,nome:nome,curto:'Todos',rapido:true,opcoes:visOpcoesDoFiltro(chave)};
}
/* O × de um chip das visitas: limpa esse filtro (ou, nos dias e horas, os
   quatro limites) e repinta.
   Recebe: k — a chave da lista; chave — 'pr', 'es', 'rs' ou 'dias'.
   Devolve: nada — repinta a vista. */
function visLimparChip(k,chave){
  const s=lf(k);
  (chave==='dias'?['d1','d2','h1','h2']:[chave]).forEach(x=>{s[x]=''});
  closePops();render();
}
/* Uma data curta para os chips e as linhas: sem o ano quando é o deste ano.
   Recebe: iso — 'AAAA-MM-DD'.
   Devolve: '24/10' ou '24/10/2027' (texto). */
function visDataCurta(iso){const t=dPT(iso);return String(iso||'').slice(0,4)===pzHoje().slice(0,4)?t.slice(0,5):t}
/* O que o chip dos dias e horas diz quando há limites postos: «15/10 – 20/10 ·
   desde 18:00», por exemplo.
   Recebe: s — o estado do filtro (lf('lvis')).
   Devolve: o texto (por escapar), ou '' sem limites. */
function visDiasRotulo(s){
  const par=(a,b,f)=>a&&b?f(a)+' – '+f(b):a?'desde '+f(a):b?'até '+f(b):'';
  return [par(s.d1,s.d2,visDataCurta),par(s.h1,s.h2,x=>x)].filter(Boolean).join(' · ');
}
/* O bloco da data de uma visita na lista (o canvas): o dia em grande e, por
   baixo, «hoje», «amanhã», «ontem» ou o mês; hoje a cheio em cobalto.
   Recebe: v — a visita; d — os dias que faltam (pzDias), ou null sem data.
   Devolve: o HTML do bloco. */
function visBlocoData(v,d){
  if(!v.date)return '<span class="vis-data"><b>—</b><span>sem data</span></span>';
  const rot=d===0?'hoje':d===1?'amanhã':d===-1?'ontem':(MES[Number(v.date.slice(5,7))-1]||'');
  return `<span class="vis-data num${d===0?' hoje':''}"><b>${Number(v.date.slice(8,10))}</b><span>${rot}</span></span>`;
}
/* Os selos de uma visita: o estado, com a cor da Agenda, e — numa realizada —
   o desfecho, quando se sabe.
   Recebe: v — a visita.
   Devolve: o HTML dos selos (texto), ou ''. */
function visSelos(v){
  const cls=c=>'badge'+(c?' '+c:'');
  const e=VESTADO[v.estado]?`<span class="${cls(VIS_COR[v.estado])}">${VESTADO[v.estado]}</span>`:'';
  const r=v.estado==='realizada'&&v.resultado&&VDESFECHO[v.resultado]?`<span class="${cls(VIS_COR_DESF[v.resultado]===undefined?'grey':VIS_COR_DESF[v.resultado])}">${VDESFECHO[v.resultado]}</span>`:'';
  return e+r;
}

/* A linha de uma visita (o canvas M-Visitas): o bloco da data, quem vem, a
   hora e o imóvel (com o «daqui a N dias» ou o «há N dias» quando a semana o
   pede), quem a marcou quando não fui eu, e os selos — à direita numa que
   ainda vem, por baixo numa que já passou (o estado e o desfecho). Toca para
   a ficha (visView); o toque longo abre as opções. Sem o ⋮: as ações estão
   na ficha (o ⋯ da janela) e no toque longo, como nas outras listas do canvas.
   Serve também as próximas visitas da Visão geral de quem colabora
   (painel-geral.js:proximasVisitasColab, que a chama pelo map — por isso só
   lê o primeiro argumento).
   Recebe: v — a visita.
   Devolve: o HTML da linha (texto). */
function visCard(v){
  const p=prop(v.propertyId);
  const quarto=v.roomId&&p?roomName(p,v.roomId):'';
  const hora=v.start?esc(v.start)+(v.end?' – '+esc(v.end):''):'';
  const d=v.date?pzDias(v.date):null;
  const rel=d!==null&&Math.abs(d)>=2&&Math.abs(d)<=7?(d>0?'daqui a '+d+' dias':'há '+(-d)+' dias'):'';
  const onde=esc(p?(p.name||p.address||'imóvel'):'imóvel apagado')+(quarto?' · '+esc(quarto):'');
  const quem=v._createdBy&&v._createdBy!==meuId()?'Marcada por '+esc(nomeUtilizador(v._createdBy)):'';
  const passou=visPassada(v),selos=visSelos(v);
  return `<div class="vis-linha tap" data-lp="vis:${esc(v.id)}" data-fk="vis:${esc(v.id)}" data-toca="camada" data-click="visView('${jsq(v.id)}')">
    ${visBlocoData(v,d)}
    <span class="vis-txt"><b class="vis-nome">${esc(v.nomes||'(sem nome)')}</b>
      <span class="small num">${[hora,onde,rel].filter(Boolean).join(' · ')}</span>
      ${quem?`<span class="small">${quem}</span>`:''}${passou&&selos?`<span class="vis-selos">${selos}</span>`:''}</span>
    ${!passou&&selos?`<span class="vis-selos vis-selos-dir">${selos}</span>`:''}</div>`;
}

/* Quando é uma visita, por extenso: o dia da semana, a data, as horas e o
   «daqui a três dias» colado, que é o que a data sozinha não diz.
   Recebe: v — a visita.
   Devolve: o texto (HTML escapado), ex.: «Quinta, 15/10/2026 · 18:00 – 18:30 · há 2 dias». */
function visQuando(v){
  if(!v.date)return 'Sem data';
  let dia='';
  try{dia=new Date(v.date+'T00:00:00').toLocaleDateString('pt-PT',{weekday:'long'}).split('-')[0]}catch(e){}
  dia=dia?dia.charAt(0).toUpperCase()+dia.slice(1)+', ':'';
  const h=v.start?' · '+esc(v.start)+(v.end?' – '+esc(v.end):''):'';
  const d=pzDias(v.date);
  const rel=d===0?'hoje':d===1?'amanhã':d===-1?'ontem':(d>0?'daqui a '+d+' dias':'há '+(-d)+' dias');
  return dia+esc(dPT(v.date))+h+' · '+rel;
}
/* Uma linha rótulo/valor da ficha da visita (o .kv do canvas). Com uma
   ligação, a linha inteira toca: o telemóvel liga, o email escreve.
   Recebe: rotulo — o texto da esquerda; valor — o HTML da direita, já
   escapado; href (opcional) — a ligação.
   Devolve: o HTML da linha, ou '' sem valor. */
function visKv(rotulo,valor,href){
  if(!valor)return '';
  return href?`<a class="vis-kv pes-liga" href="${esc(href)}" data-toca="nada"><span>${esc(rotulo)}</span><span>${valor}</span></a>`
    :`<div class="vis-kv"><span>${esc(rotulo)}</span><span>${valor}</span></div>`;
}
/* A ligação de um contacto escrito à mão: um email escreve, um número de
   telefone (nove dígitos ou mais) liga; o resto não liga a nada.
   Recebe: c — o contacto.
   Devolve: 'mailto:…', 'tel:…' ou ''. */
function visLigacao(c){
  c=String(c||'').trim();
  if(/^[^\s@]+@[^\s@]+$/.test(c))return 'mailto:'+c;
  const n=c.replace(/[^\d+]/g,'');
  return n.replace(/\D/g,'').length>=9?'tel:'+n:'';
}
/* O corpo da ficha de uma visita (o canvas M-VisitaFicha).

   Abre-se por duas razões, e em momentos diferentes: na véspera, para
   confirmar a hora e ter o contacto à mão; depois, para reler o que ficou
   combinado e decidir a quem ligar. Por isso: quando, por extenso, e os
   selos do estado e do desfecho; numa realizada com interesse, o convite a
   converter em inquilino; o imóvel, o contacto que toca e quem a marcou; os
   comentários; e as outras visitas que vêm ao mesmo imóvel.

   O imóvel tem um valor de recurso: o delProp apaga contratos e movimentos
   em cascata mas não as visitas, e uma visita órfã tem de dizer que o imóvel
   desapareceu, em vez de ficar sem sítio.
   Recebe: id — o id da visita.
   Devolve: o HTML do corpo, ou vazio se a visita já não existir. */
function visFicha(id){
  const v=(db.visits||[]).find(x=>x.id===id);if(!v)return '';
  const p=prop(v.propertyId),nota=motivoRecusa(v.propertyId,'visit.add',v),selos=visSelos(v);
  const contacto=String(v.contacto||'').trim(),notas=String(v.notas||'').trim();
  /* converter é criar uma ficha de inquilino, que é dos Inquilinos: só com o
     serviço ligado e a permissão (o mesmo critério do visOpcoes) */
  const converte=v.estado==='realizada'&&v.resultado==='interessado'&&servicoLigado('tenants')&&pode(v.propertyId,'tenant.add');
  const outras=p?(db.visits||[]).filter(x=>x.id!==v.id&&x.propertyId===v.propertyId&&x.estado!=='cancelada'&&x.date&&!visPassada(x))
    .sort((a,b)=>((a.date||'')+(a.start||''))<((b.date||'')+(b.start||''))?-1:1).slice(0,4):[];
  const quandoCurto=x=>{const d=pzDias(x.date);return (d===0?'Hoje':d===1?'Amanhã':visDataCurta(x.date))+(x.start?' às '+esc(x.start):'')};
  return `<div class="vis-ficha">
    ${nota?`<p class="hint">${esc(nota)}</p>`:''}
    <div class="vis-topo"><p class="vis-quando num">${visQuando(v)}</p>${selos?`<div class="vis-selos">${selos}</div>`:''}</div>
    ${converte?`<section class="vis-converte"><p class="vis-converte-tit">Há interesse em arrendar.</p>
      <p>Cria a ficha de inquilino com o nome, o contacto e as notas desta visita. Depois, o contrato já a encontra.</p>
      <button type="button" class="btn primary" data-toca="camada" data-click="visConverte('${jsq(v.id)}')">${ic('pessoaMais',18)} Converter em inquilino</button></section>`:''}
    <section class="card vis-sec">
      ${visKv('Imóvel',esc(p?(p.name||p.address||'imóvel'):'imóvel apagado'))}
      ${v.roomId&&p?visKv('Quarto',esc(roomName(p,v.roomId))):''}
      ${visKv('Contacto',esc(contacto),visLigacao(contacto))}
      ${v._createdBy&&v._createdBy!==meuId()?visKv('Marcada por',esc(nomeUtilizador(v._createdBy))):''}
    </section>
    ${notas?`<section class="card vis-sec"><p class="lbl">Comentários</p><p class="vis-texto">${esc(notas).replace(/\n/g,'<br>')}</p></section>`:''}
    ${outras.length?`<section class="card vis-sec vis-outras"><p class="lbl">Outras visitas a este imóvel</p>
      <p class="small num">${outras.map(x=>quandoCurto(x)+' · '+esc(x.nomes||'(sem nome)')).join('<br>')}</p></section>`:''}
  </div>`;
}
/* As opções de uma visita, iguais na ficha, no kebab e no toque longo. A
   ficha e o kebab põem-nas num menu() de onclick em texto; o toque longo
   (lpShow) quer funções — e fazê-las a partir do texto com new Function é o
   que a CSP da app (sem 'unsafe-eval', web/_headers) recusa: o toque longo
   rebentava antes de abrir. Por isso cada opção vem escrita das duas formas,
   lado a lado, e sai na que se pede.
   Recebe: v — a visita; comoFuncao (opcional) — verdadeiro para o act vir como
   função (o toque longo); falso ou omisso para vir como texto de onclick.
   Devolve: a lista de itens {label,icon,toca,risco,danger,act} para o menu. */
function visOpcoes(v,comoFuncao){
  const id=v.id,ok=podeEditar(v.propertyId,'visit.add',v),it=[];
  const op=(o,texto,fn)=>it.push(Object.assign(o,{act:comoFuncao?fn:texto}));
  if(v.estado==='agendada'&&ok){
    op({label:'Marcar realizada',icon:'check',toca:'dados'},`visEstado('${jsq(id)}','realizada')`,()=>visEstado(id,'realizada'));
    op({label:'Marcar falta',icon:'x',toca:'dados'},`visEstado('${jsq(id)}','faltou')`,()=>visEstado(id,'faltou'));
  }
  /* converter é criar uma ficha de inquilino, que é dos Inquilinos: com o
     serviço desligado nesta conta a opção não aparece */
  if(servicoLigado('tenants')&&pode(v.propertyId,'tenant.add'))op({label:'Converter em inquilino',icon:'users',toca:'camada'},`visConverte('${jsq(id)}')`,()=>visConverte(id));
  /* o visApaga não fecha janelas: sem o closeModal ficava uma ficha vazia
     aberta por cima de uma visita apagada */
  if(ok)op({label:'Apagar visita',icon:'trash',danger:true,toca:'dados',risco:'destroi'},`closeModal();visApaga('${jsq(id)}')`,()=>{closeModal();visApaga(id)});
  return it;
}
/* A ficha de uma visita: o que tocar numa visita passa a abrir.

   O visitModal abria o formulário a toda a gente e só recusava no Guardar:
   quem não pode alterar via os campos editáveis e levava com a recusa no
   fim. Agora fica na ficha, sem «Editar», com a nota a dizer porquê.
   Recebe: id — o id da visita.
   Devolve: nada — abre a janela. */
function visView(id){
  const v=(db.visits||[]).find(x=>x.id===id);if(!v)return;
  abrirFicha({
    titulo:()=>{const x=(db.visits||[]).find(y=>y.id===id);return x?(x.nomes||'Visita'):'Visita'},
    corpo:()=>visFicha(id),
    menu:()=>{const x=(db.visits||[]).find(y=>y.id===id);if(!x)return '';
      const it=visOpcoes(x);return it.length?menu('fichaVis',it):''},
    editar:podeEditar(v.propertyId,'visit.add',v)?{rotulo:'Editar',act:`visitModal('${jsq(id)}')`}:null,
  });
}
/* O formulário de uma visita — novo ou edição — no modal da casa: imóvel e
   quarto (quando o imóvel é por quartos) nos menus da app, data e horas
   nativas, estado e desfecho, nomes e contacto livres. Quem não pode alterar
   a visita recebe a ficha, antes de abrir a janela — como o propModal, o
   ctModal e o txModal: era o formulário editável com a recusa só no Guardar,
   e é o que as entradas de lado (o calendário) abriam.
   Recebe: id (opcional) — a visita a editar; sem id, cria-se uma nova;
   extra (opcional) — campos a pré-preencher numa nova (ex.: a data, vinda
   do calendário).
   Devolve: nada — abre o modal e liga o onSave (ou a ficha, a quem não pode alterar). */
function visitModal(id,extra){
  const orig=id?(db.visits||[]).find(x=>x.id===id):null;
  if(orig&&!podeEditar(orig.propertyId,'visit.add',orig))return visView(id);
  const pr=lf('lvis').pr;
  visForm=normVisit(orig?JSON.parse(JSON.stringify(orig)):
    Object.assign({propertyId:(pr&&pode(pr,'visit.add')?pr:(casasComo('visit.add')[0]||{}).id)||'',date:pzHoje()},extra||{}));
  const m=id?menu('vism',[{label:'Apagar visita',icon:'trash',danger:true,act:`closeModal();visApaga('${jsq(id)}')`}]):'';
  openModal(id?'Editar visita':'Marcar visita',visBody(),null,m);
  onSave=()=>{
    visColhe();
    const recusa=motivoRecusa(visForm.propertyId,'visit.add',orig);if(recusa)return toast(recusa);
    /* o erro diz-se no campo (componentes.js:falhaCampo); no imóvel, no botão
       do menu da casa — o input escondido do sel() não se vê nem toma o foco,
       e escolher repinta o corpo (visPropMudou), o que larga o erro */
    if(!visForm.nomes.trim())return falhaCampo('vi_nomes','Escreve quem vem à visita.');
    if(!visForm.propertyId)return falhaCampo('selb_vi_prop','Escolhe o imóvel.');
    if(!visForm.date)return falhaCampo('vi_date','Escolhe a data.');
    if(visForm.end&&visForm.start&&visForm.end<visForm.start)return falhaCampo('vi_end','A hora de fim é antes da de início.');
    db.visits=db.visits||[];
    const i=db.visits.findIndex(x=>x.id===visForm.id);
    if(i<0)db.visits.push(visForm);else db.visits[i]=visForm;
    save();closeModal();render();toast('Visita guardada.');
  };
}

/* O corpo do formulário da visita, a partir de visForm. O Início e o Fim vão
   lado a lado também no telemóvel, em campos da largura da hora (.vis-par),
   e não um por linha a toda a largura.
   Recebe: nada — lê o visForm.
   Devolve: o HTML do formulário (texto). */
function visBody(){
  const v=visForm;
  const props=propOptsPara('visit.add',v.propertyId);
  const p=prop(v.propertyId);
  const quartos=p&&p.rentalMode==='quartos'&&(p.rooms||[]).length
    ?[{v:'',label:'Casa inteira'}].concat(p.rooms.map(r=>({v:r.id,label:r.name||'quarto'})))
    :null;
  return `<div class="form">
    <label>Quem vem <span class="req">*</span><input id="vi_nomes" value="${esc(v.nomes)}" placeholder="Ex: Ana Rodrigues e o irmão" autocomplete="off"></label>
    <label>Telemóvel ou email (opcional)<input id="vi_contacto" value="${esc(v.contacto)}" placeholder="Ex: 912 345 678" autocomplete="off"></label>
    <div class="hint u-m-n4px-0-0">Para confirmar ou remarcar — segue para a ficha se a visita virar inquilino.</div>
    <label>Imóvel <span class="req">*</span>${sel('vi_prop',v.propertyId,props,'visPropMudou','rascunho')}</label>
    ${quartos?`<label>Quarto${sel('vi_room',v.roomId,quartos,'','rascunho')}</label>`:''}
    <label>Data <span class="req">*</span><input id="vi_date" type="date" value="${v.date||''}"></label>
    <div class="vis-par">
      <label>Início<input id="vi_start" type="time" value="${v.start||''}"></label>
      <label>Fim<input id="vi_end" type="time" value="${v.end||''}"></label></div>
    <div class="row">
      <label>Estado${sel('vi_estado',v.estado,Object.keys(VESTADO).map(k=>({v:k,label:VESTADO[k]})),'','rascunho')}</label>
      <label>Desfecho${sel('vi_res',v.resultado,Object.keys(VDESFECHO).map(k=>({v:k,label:VDESFECHO[k]})),'','rascunho')}</label></div>
    <label>Comentários (opcional)<textarea id="vi_notas" placeholder="Ex: Gostaram da luz; perguntaram se aceita animais.">${esc(v.notas)}</textarea></label>
    <div class="hint">As primeiras impressões, as perguntas que fizeram, o que ficou combinado. O desfecho preenche-se depois da visita — é o que separa um «talvez» de um «liga já».</div></div>`;
}

/* O menu do imóvel mudou dentro do formulário: recolhe o que está escrito e
   repinta o corpo (o menu do quarto aparece ou some conforme o imóvel).
   Devolve: nada — atualiza visForm e o HTML do modal. */
function visPropMudou(){
  visColhe();
  visForm.roomId='';
  const t=modalTop();const corpo=t&&t.el.querySelector('.body');
  if(corpo){corpo.innerHTML=visBody();marcarDatasVazias(corpo)}
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
  const recusa=motivoRecusa(v.propertyId,'visit.add',v);if(recusa)return toast(recusa);
  v.estado=estado;save();render();
  toast(estado==='realizada'?'Realizada — preenche o desfecho quando souberes.':'Ficou registado.');
}

/* Apaga uma visita com rede: seis segundos de «Anular» antes de ser de vez.
   Recebe: id — a visita a apagar.
   Devolve: nada — remove, grava e redesenha, com Anular no toast. */
function visApaga(id){
  const i=(db.visits||[]).findIndex(x=>x.id===id);if(i<0)return;
  const copia=db.visits[i];
  const recusa=motivoRecusa(copia.propertyId,'visit.add',copia,true);if(recusa)return toast(recusa);
  db.visits.splice(i,1);save();render();
  comDesfazer('Visita apagada.',()=>{db.visits.splice(i,0,copia);save();render()});
}

/* Converte a visita numa ficha de inquilino: abre a ficha nova já com o nome
   e o contacto preenchidos (telefone ou email, conforme o que lá estiver) —
   o resto preenche-se quando o contrato for a sério. Num imóvel onde só
   colaboro a ficha fica presa a ele (houseId): é assim que sobe como registo
   desse imóvel e chega ao dono mesmo sem contrato. Num imóvel meu é uma
   ficha minha, como as do FAB (o critério de newTenantFromCt) — presa ao
   imóvel, perdia-se com ele.
   Recebe: id — a visita a converter.
   Devolve: nada — abre o personModal de um inquilino novo pré-preenchido. */
function visConverte(id){
  const v=(db.visits||[]).find(x=>x.id===id);if(!v)return;
  /* a ficha nova é um registo dos Inquilinos: desligados nesta conta, o
     servidor recusava-a — diz-se antes de criar o que não ia subir */
  if(!servicoLigado('tenants'))return toast(hintServicoDesligado('tenants'));
  if(!pode(v.propertyId,'tenant.add'))return toast(fraseSemPerm('tenant.add'));
  const c=(v.contacto||'').trim();
  const novo=normPerson({name:v.nomes,phone:/@/.test(c)?'':c,email:/@/.test(c)?c:'',houseId:souDono(v.propertyId)?'':(v.propertyId||''),
    /* a data vai na forma que se le. E prosa gravada: o que ja esta escrito
       nas fichas antigas fica como estava, e so o que se escreve de agora em
       diante e que leva a forma nova */
    notes:v.notas?'Da visita de '+(dPT(v.date)||'?')+': '+v.notas:''});
  db.tenants.push(novo);save();
  chamarServico('tenants','personModal','tenant',novo.id);
  toast('Ficha criada a partir da visita — completa o que faltar.');
}
/* ---- registo do serviço (servicos.js) ---- */
/* O menu de toque longo de uma visita (data-lp "vis:<id>"). Os cartões de
   visita têm data-lp desde sempre, e o toque longo não fazia nada: vibrava,
   enchia a barra da espera e acabava em silêncio, porque o ramo não existia.
   As opções vêm do visOpcoes já como funções — nunca feitas de texto, que a
   CSP não deixa avaliar. Os outros serviços acrescentam as suas por lpExtras.
   Recebe: a — as partes do data-lp (['vis', id]).
   Devolve: nada — abre a folha de opções (ou nada, se a visita já não existir). */
function lpVisita(a){
  const id=a[1],v=(db.visits||[]).find(x=>x.id===id);if(!v)return;
  const opts=podeEditar(v.propertyId,'visit.add',v)?[{label:'Editar visita',icon:'pen',act:()=>visitModal(id)}]:[];
  visOpcoes(v,true).forEach(it=>opts.push({label:it.label,icon:it.icon,act:it.act}));
  lpExtrasDe('vis',a).forEach(o=>opts.push(o));
  return lpShow(v.nomes||'Visita',opts);
}
registarServico({id:'visits',vistas:{visits:'vVisits'},lp:{vis:'lpVisita'}});
