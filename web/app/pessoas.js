/* ================= PESSOAS (inquilinos e proprietários) ================= */
let perForm={},perKind='tenant',perAfter=null;
/* Posso mesmo alterar a ficha desta pessoa?

   Num inquilino é a regra de sempre: quem o adicionou, ou o dono. Num
   proprietário é outra coisa — o db.owners é reconstruído a partir dos
   perfis do servidor a cada sincronização, e só o meu perfil é exportado.
   Editar a ficha de outro proprietário COM conta gravava localmente e
   desaparecia no pull seguinte; um proprietário sem conta é um registo meu
   como outro qualquer.
   Recebe: kind — 'tenant' ou 'owner'; p — a pessoa.
   Devolve: true se o «Editar» deve existir. */
function personEditavel(kind,p){
  if(!p)return false;
  if(kind==='tenant')return podeEditarInquilino(p);
  return !p._userId||!!(window.CW&&CW.user&&CW.user.id===p.id);
}
/* Posso apagar a ficha desta pessoa?

   Como o «Editar», mas mais estreito: o meu perfil edita-se e não se apaga
   (sou eu), e um proprietário com conta sai desfazendo a partilha, não
   apagando a ficha — a nuvem recusava os dois com um aviso
   (cloud/utilizadores.js:delPerson), e um botão que só serve para ouvir
   «não podes» não se escreve.
   Recebe: kind — 'tenant' ou 'owner'; p — a pessoa.
   Devolve: true se o «Apagar» deve existir. */
function personApagavel(kind,p){
  if(!personEditavel(kind,p))return false;
  if(kind==='tenant')return true;
  return !p._userId&&!(window.CW&&CW.user&&CW.user.id===p.id);
}
/* ---- as peças das pessoas (o canvas M-Pessoas, M-Inquilino e M-Proprietario) ---- */

/* O avatar de uma pessoa: as iniciais num círculo, cobalto suave; cinzento
   num inquilino sem contrato que conte (o canvas). Lê-se o nome ao lado, por
   isso o leitor de ecrã salta-o.
   Recebe: p — a pessoa; grande (opcional) — true para o da ficha (56px);
   apagado (opcional) — true para o cinzento.
   Devolve: o HTML do avatar. */
function pesAvatar(p,grande,apagado){
  return `<span class="avatar pes-av${grande?' pes-av-g':''}${apagado?' pes-av-sem':''}" aria-hidden="true">${esc(initials(p&&p.name))}</span>`;
}
/* Os contratos de um inquilino, arrumados pelo que dizem dele hoje: os em
   vigor, os por começar e os terminados (o que acabou mais tarde primeiro).
   Só com os Contratos ligados nesta conta: desligados, tudo vazio — a ficha
   e a lista não falam de um serviço que a conta não tem.
   Recebe: t — o inquilino.
   Devolve: {ativos, futuros, findos} — arrays de contratos. */
function pesContratos(t){
  const cs=t&&servicoLigado('contracts')?contractsOfTenant(t.id):[];
  return {ativos:cs.filter(isActive),futuros:cs.filter(c=>ctEstado(c)==='futuro'),
    findos:cs.filter(c=>ctEstado(c)==='terminado').sort((a,b)=>String(b.end||'').localeCompare(String(a.end||'')))};
}
/* O estado da renda de um contrato em vigor, pelo planeado que a app mantém
   para ela (planeados.js:ctRecOf): em atraso quando a janela fechou sem
   confirmação, por confirmar enquanto está aberta, em dia quando a próxima
   ainda não chegou. Só com os Planeados ligados, só depois de o estado do
   servidor chegar (espera.js:sabemosOEstado) e só quando o planeado está na
   base — quem colabora sem os ver não o recebe. Sem isso não se diz nada:
   «em dia» sobre o que a conta não vê seria inventado. Um planeado
   silenciado também não fala: foi a pessoa que o mandou calar.
   Recebe: c — o contrato.
   Devolve: {cls, txt} para o selo (cls '' é o cobalto), ou null. */
function pesRenda(c){
  if(!c||!isActive(c)||!servicoLigado('recurring')||!sabemosOEstado())return null;
  const r=ctRecOf(c);if(!r||r.muted||!r.next)return null;
  if(r.next<=today())return recIsLate(r)?{cls:'red',txt:'Renda em atraso'}:{cls:'',txt:'Renda por confirmar'};
  return {cls:'in',txt:'Renda em dia'};
}
/* Uma data curta para os selos e as linhas: sem o ano quando é o deste ano.
   Recebe: iso — 'AAAA-MM-DD'.
   Devolve: '12/11' ou '12/11/2027' (texto). */
function pesDataCurta(iso){const t=dPT(iso);return String(iso||'').slice(0,4)===today().slice(0,4)?t.slice(0,5):t}
/* O selo do cartão de cidadão que está a caducar, com a janela e as cores dos
   prazos (prazos.js:PZ_ANTECEDENCIA, prazos.js:pzUrg, prazos.js:pzSelo): só
   dentro dos dias de aviso, e só de quem o «Pede atenção» avisa — um
   inquilino com um contrato que ainda não acabou, ou um proprietário.
   Recebe: p — a pessoa; kind — 'tenant' ou 'owner'.
   Devolve: o HTML do selo, ou ''. */
function pesSeloCC(p,kind){
  if(!p||!p.ccValid)return '';
  if(kind==='tenant'&&!(db.contracts||[]).some(c=>ctVivo(c)&&(c.tenantIds||[]).indexOf(p.id)>-1))return '';
  const d=pzDias(p.ccValid);if(!(d<=PZ_ANTECEDENCIA.cc))return '';
  return `<span class="badge ${pzSelo({urg:pzUrg(d)})}">${d<0?'CC caducou a ':'CC caduca a '}${esc(pesDataCurta(p.ccValid))}</span>`;
}
/* A renda que cabe a um proprietário: a dos contratos em vigor dos imóveis
   que são meus, na quota dele. Só nos meus: o servidor apaga as quotas de uma
   casa de colaboração, e o sharesOf reparte por igual quando não há
   percentagens — ali era um número inventado. E só com os Contratos ligados.
   Recebe: p — o proprietário; casas — os imóveis dele (propsOf).
   Devolve: euros por mês (número). */
function pesRendaDoDono(p,casas){
  if(!servicoLigado('contracts'))return 0;
  return sum((casas||[]).filter(x=>souDono(x.id)&&pode(x.id,'contract.view')).map(x=>rentOf(x)*shareOf(x,p.id)));
}
/* O estado civil escrito para a pessoa: «Solteiro(a)» lê-se «Solteira» ou
   «Solteiro» quando a ficha diz o género; sem ele fica como está.
   Recebe: p — a pessoa.
   Devolve: o texto (por escapar), ou ''. */
function pesEstadoCivil(p){
  const m=String((p&&p.marital)||'');
  return p&&(p.gender==='f'||p.gender==='m')?m.replace(/o\(a\)$/,p.gender==='f'?'a':'o'):m;
}
/* Uma linha rótulo/valor de um cartão da ficha (o .kv do canvas). Com uma
   ligação, a linha inteira toca: o telemóvel liga, o email escreve.
   Recebe: rotulo — o texto da esquerda; valor — o HTML da direita, já escapado;
   href (opcional) — a ligação ('tel:…', 'mailto:…').
   Devolve: o HTML da linha. */
function pesKv(rotulo,valor,href){
  if(!valor)return '';
  return href?`<a class="pes-kv pes-liga" href="${esc(href)}" data-toca="nada"><span>${esc(rotulo)}</span><span>${valor}</span></a>`
    :`<div class="pes-kv"><span>${esc(rotulo)}</span><span>${valor}</span></div>`;
}
/* Um cartão da ficha: o título (h3), o que fica à direita dele (um número) e
   as linhas. Sem linhas, não há cartão.
   Recebe: titulo — o texto do título; corpo — o HTML das linhas; extra
   (opcional) — o HTML à direita do título; cls (opcional) — classes a juntar.
   Devolve: o HTML do cartão, ou ''. */
function pesCartao(titulo,corpo,extra,cls){
  if(!String(corpo||'').trim())return '';
  return `<section class="card pes-sec${cls?' '+cls:''}"><div class="pes-sec-cab"><h3>${esc(titulo)}</h3>${extra||''}</div>${corpo}</section>`;
}
/* As linhas de contacto (tocáveis) e de identificação de uma pessoa, a partir
   do que a ficha tem — o mesmo para um inquilino e um proprietário.
   Recebe: p — a pessoa; kind — 'tenant' ou 'owner'.
   Devolve: {contactos, ident} — o HTML das linhas de cada cartão. */
function pesLinhasDaPessoa(p,kind){
  const tel=String(p.phone||'').trim(),mail=String(p.email||'').trim();
  const contactos=(tel?pesKv('Telemóvel',esc(fmtPhone(tel)),'tel:'+fmtPhone(tel).replace(/\s+/g,'')):'')+
    (mail?pesKv('Email',esc(mail),/@/.test(mail)?'mailto:'+mail:''):'');
  /* um NIF que não bate certo diz-se aqui, ao lado do número: é onde se lê
     antes de ir para o contrato em PDF ou para o Anexo F */
  const nif=p.nif?esc(fmtNIF(p.nif))+(nifValido(p.nif)===false?'<span class="pes-mau">não bate certo</span>':''):'';
  /* o número e a validade são campos à parte no formulário: a validade
     gravada lê-se aqui mesmo sem o número (o selo do topo só a diz nos dias
     de aviso) */
  const cc=p.cc||p.ccValid?(p.cc?esc(fmtCC(p.cc)):'')+(p.ccValid?`<span class="small">${pzDias(p.ccValid)<0?'caducou a ':'válido até '}${dPT(p.ccValid)}</span>`:''):'';
  const ident=pesKv('NIF',nif)+pesKv('Cartão de Cidadão',cc)+
    pesKv('Data de nascimento',p.birth?dPT(p.birth):'')+pesKv('Estado civil',esc(pesEstadoCivil(p)))+
    pesKv('Nacionalidade',p.nationality&&p.nationality!=='Portuguesa'?esc(p.nationality):'')+
    pesKv('País',esc(p.pais||''))+
    (kind==='tenant'&&p.retem?pesKv('Retenção na fonte','retém IRS ao pagar a renda'):'')+
    pesKv('Morada fiscal',esc(String(p.taxAddress||'').trim()).replace(/\n/g,'<br>'));
  return {contactos,ident};
}
/* Uma linha de contrato na ficha de um inquilino: onde, desde e até quando,
   a renda e — num contrato em vigor — o estado da renda. Toca para abrir o
   contrato, a quem o cargo deixa ver.
   Recebe: c — o contrato; modo — 'ativo', 'futuro' ou 'findo'.
   Devolve: o HTML da linha. */
function pesLinhaContrato(c,modo){
  const ver=servicoLigado('contracts')&&pode(c.propertyId,'contract.view');
  const datas=modo==='futuro'?(c.start?'a partir de '+dPT(c.start):''):modo==='findo'?(c.end?'terminou a '+dPT(c.end):''):
    [c.start?'desde '+dPT(c.start):'',c.end?'até '+dPT(c.end):''].filter(Boolean).join(' · ');
  const r=modo==='ativo'?pesRenda(c):null;
  return `<div class="pes-linha-f${ver?' tap':''}"${ver?` data-toca="camada" data-click="ctView('${jsq(c.id)}')"`:''}>
    <span class="pes-linha-txt"><b>${esc(ctLabel(c))}</b>${datas?`<span class="small num">${datas}</span>`:''}${r?`<span class="badge${r.cls?' '+r.cls:''}">${r.txt}</span>`:''}</span>
    ${Number(c.rent)>0?`<b class="num pes-renda">${euro2(c.rent)}<span class="small">/mês</span></b>`:''}
    ${ver?`<span class="seta">${ic('chevR',18)}</span>`:''}</div>`;
}
/* O corpo da ficha de uma pessoa: o que se sabe sobre ela, para ler.

   Um inquilino e um proprietário partilham o formulário, mas lêem-se por
   razões diferentes: de um inquilino quer-se o contacto, onde mora, desde
   quando e até quando; de um proprietário, a quota-parte e se estamos em dia.
   Cada uma tem o seu desenho (pesFichaInquilino, pesFichaDono).
   Recebe: kind — 'tenant' ou 'owner'; id — o id da pessoa.
   Devolve: o HTML do corpo, ou vazio se a pessoa já não existir. */
function personFicha(kind,id){
  const lista=kind==='owner'?db.owners:db.tenants;
  const p=(lista||[]).find(x=>x.id===id);if(!p)return '';
  return kind==='owner'?pesFichaDono(p):pesFichaInquilino(p);
}
/* A ficha de um inquilino (o canvas M-Inquilino): o avatar com o selo do
   contrato, as ações rápidas, onde mora (e onde vai morar, e onde morou), os
   contactos que tocam, a identificação, os documentos e as notas.

   A guarda é a do cargo no imóvel do inquilino, e diz-se ANTES de tudo:
   pode(null,perm) devolve sempre true, e numa ficha só minha não há casa.
   Recebe: p — o inquilino.
   Devolve: o HTML do corpo. */
function pesFichaInquilino(p){
  const casa=casaDoInquilino(p),ver=pode(casa,'tenant.view'),comCt=servicoLigado('contracts');
  /* os contratos só com o serviço que os traz ligado nesta conta: desligado,
     a ficha fica com a pessoa e mais nada — sem «Mora em» */
  const s=pesContratos(p),vivo=s.ativos[0]||s.futuros[0];
  const selos=[];
  if(comCt)selos.push(s.ativos.length?'<span class="badge in">Com contrato em vigor</span>':s.futuros.length?'<span class="badge">Contrato por começar</span>':
    `<span class="badge grey">${s.findos.length?'Contrato terminado':'Sem contrato'}</span>`);
  if(s.ativos.some(c=>{const r=pesRenda(c);return r&&r.cls==='red'}))selos.push('<span class="badge red">Renda em atraso</span>');
  if(ver)selos.push(pesSeloCC(p,'tenant'));
  /* as ações rápidas, só as que o cargo e os serviços deixam: o contrato que
     conta (o em vigor, ou o que ainda não começou) e um contrato novo já com
     esta pessoa lá dentro (o critério de lista-contratos.js:lpExtrasContratosPessoa) */
  const acoes=[];
  if(vivo&&pode(vivo.propertyId,'contract.view'))acoes.push({r:'Ver contrato',i:'contract',a:`ctView('${jsq(vivo.id)}')`});
  if(comCt&&casasComo('contract.add').some(x=>x.use==='investimento'))acoes.push({r:'Novo contrato',i:'plus',a:`ctModal(null,null,'${jsq(p.id)}')`});
  const L=ver?pesLinhasDaPessoa(p,'tenant'):{contactos:'',ident:''};
  /* os anexos de um inquilino pedem tenant.view E file.view no servidor:
     listar os nomes sem ambas dava linhas que rebentam ao toque */
  const fs=ver&&pode(casa,'file.view')?(p.files||[]):[];
  const juntar=ver&&podeEditarInquilino(p)&&pode(casa,'file.add');
  const docs=fs.map(f=>`<div class="pes-linha-f tap" data-toca="camada" data-click="openMeta('${jsq(f.id)}')">
      <span class="pes-doc-ic">${ic('contract',20)}</span><span class="pes-linha-txt"><b>${esc(f.name||'ficheiro')}</b></span>${f.size?`<span class="small num">${kb(f.size)}</span>`:''}</div>`).join('')
    +(juntar?`<button type="button" class="pes-mais" data-toca="dados" data-click="pesEscolherDocs('${jsq(p.id)}')">${ic('plus',20)} Adicionar documentos</button>`:'');
  const notas=ver&&String(p.notes||'').trim()?`<div class="pes-texto rich">${rich(p.notes)}</div>`:'';
  /* «só tem o nome» só a quem vê a ficha toda: a quem o cargo esconde o resto,
     a nota do cargo já diz porquê, e a ficha pode ter mais do que se vê */
  const vazia=ver&&!L.contactos&&!L.ident&&!fs.length&&!notas&&!s.ativos.length&&!s.futuros.length&&!s.findos.length;
  return `<div class="pes-ficha">
    <div class="pes-topo">${pesAvatar(p,true,comCt&&!vivo)}<div class="pes-topo-txt"><p class="pes-papel">Inquilino</p>${selos.filter(Boolean).length?`<div class="pes-selos">${selos.join('')}</div>`:''}</div></div>
    ${p._sharedFrom?`<p class="hint">Ficha de <b>${esc(p._sharedFrom)}</b>.</p>`:''}
    ${ver?'':'<p class="hint">O teu cargo mostra só o nome desta pessoa.</p>'}
    ${acoes.length?`<div class="chips-fila pes-acoes" role="group" aria-label="Ações rápidas">${acoes.map(x=>
      `<button type="button" class="chip" data-toca="camada" data-click="${x.a}">${ic(x.i,16)} ${x.r}</button>`).join('')}</div>`:''}
    ${pesCartao('Mora em',s.ativos.map(c=>pesLinhaContrato(c,'ativo')).join(''))}
    ${pesCartao('Vai morar em',s.futuros.map(c=>pesLinhaContrato(c,'futuro')).join(''))}
    ${pesCartao('Contactos',L.contactos)}
    ${pesCartao('Identificação',L.ident)}
    ${pesCartao('Documentos',docs,fs.length?`<span class="small num">${fs.length}</span>`:'')}
    ${pesCartao('Notas',notas)}
    ${pesCartao('Contratos anteriores',s.findos.map(c=>pesLinhaContrato(c,'findo')).join(''))}
    ${vazia?`<p class="hint">Esta ficha só tem o nome. ${podeEditarInquilino(p)?'Toca em «Editar» para juntar contacto e identificação.':'O perfil é mantido por quem tem a conta.'}</p>`:''}
  </div>`;
}
/* A ficha de um proprietário (o canvas M-Proprietario): o avatar com o selo da
   conta, a nota de quem manda no perfil, as contas entre proprietários com o
   plano de acerto, os imóveis e a quota-parte com a renda que lhe cabe, e os
   contactos e a identificação.
   Recebe: p — o proprietário.
   Devolve: o HTML do corpo. */
function pesFichaDono(p){
  const eu=!!(window.CW&&CW.user&&CW.user.id===p.id),comConta=!!p._userId&&!eu;
  /* os imóveis só com o serviço que os traz ligado nesta conta */
  const casas=servicoLigado('properties')?propsOf(p.id):[];
  const renda=pesRendaDoDono(p,casas);
  /* o saldo só com os Movimentos ligados: sem eles não se diz «em dia» sobre
     o que a conta não vê */
  const bal=servicoLigado('transactions')?ownerBalances(null):null;
  const saldo=bal?bal[p.id]:undefined;
  let contas='';
  if(saldo!==undefined){
    const z=Math.abs(saldo)<0.01,plano=z?[]:settlePlan(bal).filter(x=>x.from===p.id||x.to===p.id);
    const ids=[].concat(...plano.map(x=>[x.from,x.to])),nm=id=>esc(nomeCurto(id,ids));
    contas=`<section class="card pes-contas${z?'':saldo>0?' in':' out'}">
      <div class="pes-contas-cab num"><p>Contas entre proprietários</p><p class="pes-contas-valor">${z?'Em dia':saldo>0?'A receber '+euro2(saldo):'A pagar '+euro2(-saldo)}</p></div>
      ${plano.length?`<p class="small num">Plano: ${plano.map(x=>nm(x.from)+' paga '+euro2(x.amount)+' a '+nm(x.to)).join('; ')}.</p>
      <button type="button" class="btn sm" data-toca="camada" data-click="settleModal(null)">Acertar contas</button>`:''}</section>`;
  }
  const verCasa=casas.length>0;   /* os imóveis só vêm com os Imóveis ligados, e a ficha é deles */
  const linhasCasas=casas.map(x=>`<div class="pes-kv num${verCasa?' tap':''}"${verCasa?` data-toca="camada" data-click="propView('${jsq(x.id)}')"`:''}>
      <span class="pes-forte">${esc(x.name||x.address||'imóvel')}</span><span>${souDono(x.id)?pct(shareOf(x,p.id),0):''}${verCasa?`<span class="seta">${ic('chevR',18)}</span>`:''}</span></div>`).join('')
    +(renda>0?`<div class="pes-kv pes-total num"><span>Renda que lhe cabe</span><span><b>${euro2(renda)}</b>/mês</span></div>`:'');
  const L=pesLinhasDaPessoa(p,'owner'),cc=pesSeloCC(p,'owner');
  const vazia=!L.contactos&&!L.ident&&!casas.length;
  return `<div class="pes-ficha">
    <div class="pes-topo">${pesAvatar(p,true)}<div class="pes-topo-txt"><p class="pes-papel">Proprietário</p>${eu||comConta||cc?`<div class="pes-selos">${eu?'<span class="badge">O teu perfil</span>':comConta?'<span class="badge">Tem conta Rendorium</span>':''}${cc}</div>`:''}</div></div>
    ${comConta?`<div class="pes-nota">${ic('lock',20)}<p>Este perfil é de ${esc(p.name||'quem tem a conta')}, que tem conta: só quem tem a conta o edita. Para o remover das casas, desfaz a partilha em Pessoas → Proprietários.</p></div>`:''}
    ${contas}
    ${pesCartao('Imóveis e quota-parte',linhasCasas,casas.length?`<span class="small num">${casas.length}</span>`:'')}
    ${pesCartao('Contactos e identificação',L.contactos+L.ident)}
    ${vazia?`<p class="hint">Esta ficha só tem o nome. ${personEditavel('owner',p)?'Toca em «Editar» para juntar contacto e identificação.':'O perfil é mantido por quem tem a conta.'}</p>`:''}
  </div>`;
}
/* «Adicionar documentos» da ficha de um inquilino: abre o seletor de
   ficheiros do sistema. O campo nasce aqui, fora da janela, e não dentro da
   ficha: uma ficha lê-se e não tem campos (testes/ui/invariantes.js).
   Recebe: id — o id do inquilino.
   Devolve: nada — abre o seletor; o pesJuntarDocs trata do que vier. */
function pesEscolherDocs(id){
  const p=(db.tenants||[]).find(x=>x.id===id);if(!p)return;
  const recusa=motivoRecusa(casaDoInquilino(p),'tenant.add',p);if(recusa)return toast(recusa);
  const velho=document.getElementById('pesDocsIn');if(velho)velho.remove();
  const inp=document.createElement('input');
  inp.type='file';inp.multiple=true;inp.id='pesDocsIn';inp.className='u-d-none';
  inp.addEventListener('change',()=>{pesJuntarDocs(id,inp);inp.remove()},{once:true});
  document.body.appendChild(inp);inp.click();
}
/* Junta à ficha de um inquilino os ficheiros escolhidos: o conteúdo vai para o
   IndexedDB (anexos.js:takeFiles), os metadados para a ficha, e grava — a
   nuvem sobe-os na sincronização seguinte. A permissão volta a ver-se no
   momento de gravar.
   Recebe: id — o id do inquilino; input — o campo de ficheiros.
   Devolve: nada — grava e repinta (a ficha aberta repinta-se sozinha). */
function pesJuntarDocs(id,input){
  takeFiles(input).then(ms=>{
    const p=(db.tenants||[]).find(x=>x.id===id);if(!p||!ms.length)return;
    const recusa=motivoRecusa(casaDoInquilino(p),'tenant.add',p);if(recusa)return toast(recusa);
    p.files=(p.files||[]).concat(ms);save();render();
    toast(ms.length===1?'Documento adicionado.':ms.length+' documentos adicionados.');
  });
}
/* A ficha de uma pessoa: o que tocar num inquilino ou num proprietário abre.

   Um proprietário com conta não tem «Editar», e não é uma limitação de
   feitio: o db.owners é reconstruído a partir dos perfis do servidor a cada
   sincronização, e só o meu perfil é exportado — editar a ficha de outro
   gravava localmente e desaparecia na sincronização seguinte. No meu próprio
   perfil, o «Editar» vai ao editProfile da nuvem, que é quem sabe guardar.
   O contrato abre-se no corpo (a ação rápida «Ver contrato» e as linhas de
   «Mora em»); o ⋯ fica com o que destrói.
   Recebe: kind — 'tenant' ou 'owner'; id — o id da pessoa.
   Devolve: nada — abre a janela. */
function personView(kind,id){
  const lista=kind==='owner'?db.owners:db.tenants;
  const p=(lista||[]).find(x=>x.id===id);if(!p)return;
  const euSou=kind==='owner'&&window.CW&&CW.user&&CW.user.id===p.id;
  const ok=personEditavel(kind,p);
  const act=euSou&&window.CW&&CW.editProfile?'CW.editProfile()':`personModal('${jsq(kind)}','${jsq(id)}')`;
  abrirFicha({
    titulo:()=>{const x=(kind==='owner'?db.owners:db.tenants||[]).find(y=>y.id===id);return x?x.name:'Ficha'},
    corpo:()=>personFicha(kind,id),
    menu:()=>{
      const x=(kind==='owner'?db.owners:db.tenants||[]).find(y=>y.id===id);
      /* apagar um proprietário com conta não é apagar um registo meu: é
         mexer numa pessoa que o servidor volta a mandar no pull seguinte */
      return x&&personApagavel(kind,x)?menu('fichaPer',[{label:kind==='owner'?'Apagar proprietário':'Apagar inquilino',
        icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delPerson('${jsq(kind)}','${jsq(id)}')`}]):'';
    },
    editar:ok?{rotulo:'Editar',act:act}:null,
  });
}
/* Abre a ficha de pessoa (kind 'owner' ou 'tenant'); sem id cria uma nova.
   after, se vier, é chamado com o id da ficha depois de guardar, em vez do
   fecho normal — é assim que o contrato cria um inquilino sem perder o fluxo.
   Quem não é dono de imóvel nenhum só cria fichas presas a um imóvel onde
   pode «Adicionar inquilinos» (senão a ficha ficava privada e nunca chegava
   ao dono): com um só, fica esse; com vários, escolhe-se primeiro.
   Recebe: kind — 'owner' ou 'tenant', diz que lista se usa; id (opcional) —
   id da ficha a editar, sem ele cria uma nova; after (opcional) — função
   chamada com o id da ficha depois de guardar; houseId (opcional) — o imóvel
   a que a ficha nova fica presa.
   Devolve: nada — abre o modal da ficha (ou, antes, a escolha do imóvel). */
function personModal(kind,id,after,houseId){
  if(kind==='tenant'&&!id&&!houseId&&souSoColaborador()){
    const cs=casasComo('tenant.add');
    if(!cs.length)return toast(fraseSemPerm('tenant.add'));
    if(cs.length>1)return pickModal('Inquilino de que imóvel?',cs.map(p=>({v:p.id,label:p.name||p.address||'imóvel',sub:p._sharedFrom?'de '+p._sharedFrom:''})),
      o=>{closeModal();personModal(kind,null,after,o.v)});
    houseId=cs[0].id;
  }
  foldState={};
  /* Quem não pode alterar a ficha de um inquilino recebe a FICHA de leitura,
     e não este formulário com os campos apagados. O mesmo no perfil de outro
     proprietário com conta: só quem tem a conta o edita, e o que se gravasse
     aqui perdia-se no pull seguinte (personEditavel). */
  const _p=id?((kind==='owner'?db.owners:db.tenants)||[]).find(x=>x.id===id):null;
  if(kind==='tenant'&&_p&&!podeEditarInquilino(_p))return personView(kind,id);
  if(kind==='owner'&&_p&&!personEditavel('owner',_p))return personView(kind,id);
  perKind=kind;perAfter=after||null;
  const listOf=kind==='owner'?db.owners:db.tenants,orig=id?listOf.find(x=>x.id===id):null;
  perForm=normPerson(orig?JSON.parse(JSON.stringify(orig)):null);
  if(!orig&&houseId&&kind==='tenant')perForm.houseId=houseId;
  const word=kind==='owner'?'proprietário':'inquilino';
  const m=orig&&personApagavel(kind,orig)?menu('per',[{label:'Apagar '+word,icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delPerson('${kind}','${id}')`}]):'';
  openModal((id?'Editar ':'Novo ')+word,personBody(),null,m);
  onSave=()=>{
    collectPerson();
    if(!perForm.name.trim())return falhaCampo('pe_name','Escreve o nome.');
    if(perKind==='tenant'){const recusa=motivoRecusa(casaDoInquilino(orig||perForm),'tenant.add',orig);if(recusa)return toast(recusa)}
    const list=perKind==='owner'?db.owners:db.tenants;
    const i=list.findIndex(x=>x.id===perForm.id);
    if(i<0)list.push(perForm);else list[i]=perForm;
    save();
    const cb=perAfter,nid=perForm.id;perAfter=null;
    if(cb){cb(nid);return}
    closeModal();render();toast('Ficha guardada.');
  };
}
// HTML do formulário da ficha, montado a partir de perForm. Proprietários
// não têm a secção de documentos nem as notas.
// Devolve: string com o HTML do formulário da ficha.
function personBody(){
  const t=perForm;
  return `<div class="form">
    <label>Nome completo <span class="req">*</span><input id="pe_name" value="${esc(t.name)}" placeholder="Ex: Ana Rodrigues" autocomplete="off"></label>
    <div class="row">
      <label>Telemóvel<input id="pe_phone" value="${esc(t.phone)}" placeholder="Opcional" autocomplete="off"></label>
      <label>Email<input id="pe_mail" value="${esc(t.email)}" placeholder="Opcional" autocomplete="off"></label></div>
    ${fold('ident','Identificação',`
    <div class="row">
      <label>Género${sel('pe_gender',t.gender,GENDER.map(g=>({v:g[0],label:g[1]})),'','rascunho')}</label>
      <label>Estado civil${sel('pe_marital',t.marital,MARITAL.map(x=>({v:x,label:x||'—'})),'','rascunho')}</label></div>
    <div class="row">
      <label>Nacionalidade<input id="pe_nat" value="${esc(t.nationality)}" placeholder="Opcional" autocomplete="off"></label>
      <label>Data de nascimento<input id="pe_birth" type="date" value="${t.birth||''}"></label></div>
    <div class="row">
      <label>N.º do Cartão de Cidadão (opcional)<input id="pe_cc" value="${esc(t.cc)}" placeholder="Ex: 12345678 9 ZX4" autocomplete="off"></label>
      <label>Validade do CC<input id="pe_ccv" type="date" value="${t.ccValid||''}"></label></div>
    <label>NIF<input id="pe_nif" value="${esc(t.nif)}" placeholder="Opcional" inputmode="numeric" data-input="pessoaNifHint()"></label>
    <div class="hint u-mt-n4px" id="pe_nifHint"${pessoaNifHint(t.nif)?'':' hidden'}>${esc(pessoaNifHint(t.nif))}</div>
    <label>País (opcional; só sem NIF português)<input id="pe_pais" value="${esc(t.pais)}" placeholder="Ex: Espanha" autocomplete="off"></label>
    <div class="hint u-mt-n4px">Sem NIF português, o Anexo F identifica a pessoa pelo país.</div>
    ${perKind==='tenant'?`<label class="check"><input type="checkbox" id="pe_retem" ${t.retem?'checked':''}> Retém IRS na fonte</label>
    <div class="hint u-mt-n4px">Uma empresa com contabilidade organizada retém IRS ao pagar a renda. A retenção regista-se em cada renda; aqui fica só o aviso.</div>`:''}
    <label>Morada fiscal (opcional)<textarea id="pe_addr" class="u-minh-66px" placeholder="Ex: Rua das Flores 12, 1200-195 Lisboa">${esc(t.taxAddress)}</textarea></label>
    <div class="hint">A morada com rua, número, código postal e localidade. Estes dados identificam as partes no contrato em PDF; o NIF e o país entram no resumo do Anexo F.</div>`,
      {icon:'contract',summary:[t.nif?'NIF '+esc(fmtNIF(t.nif)):'',t.cc?'CC':''].filter(Boolean).join(' · ')||'para o contrato'})}
    ${perKind==='owner'?'':fold('docs','Documentos',
      fileBlock('',t.files||[],'pe_filein','personAddFiles','delPersonFile',{hint:'Cartão de cidadão, contrato de trabalho, comprovativo de morada, recibos de vencimento.'}),
      {icon:'clip',open:!!(t.files||[]).length,summary:(t.files||[]).length?t.files.length+' doc.':''})
      +`<label>Notas (opcional)<textarea id="pe_notes" placeholder="Ex: Fiador: João Rodrigues, 913 456 789">${esc(t.notes)}</textarea></label>
    <div class="hint u-mt-n4px">O fiador, as referências, outras observações.</div>`}</div>`;
}
/* A dica por baixo do NIF: avisa quando o dígito de controlo não bate certo — um
   erro de dedo apanhado antes de ir para o contrato em PDF ou para o Anexo F.
   Vazio não se julga: pode não haver NIF, ou a pessoa ser de fora. Serve nos dois
   momentos: ao montar o formulário (com o NIF, devolve o texto) e a cada tecla no
   campo (sem argumento: lê o campo e reescreve a dica no ecrã).
   Recebe: nif (opcional) — o NIF a avaliar; sem ele, lê o campo pe_nif.
   Devolve: o texto da dica, ou '' quando não há nada a dizer. */
function pessoaNifHint(nif){
  const txt=nifValido(nif===undefined?val('pe_nif'):nif)===false?'Este NIF não bate certo: confere os dígitos.':'';
  /* vazia, a dica esconde-se: um div sem nada ainda abria o gap do formulário */
  if(nif===undefined){const e=document.getElementById('pe_nifHint');if(e){e.textContent=txt;e.hidden=!txt}}
  return txt;
}
// Copia os campos do modal para perForm. Chamar antes de repintar ou de
// mexer nos documentos, senão perde-se o que o utilizador escreveu.
// Devolve: nada — só atualiza o objeto perForm.
function collectPerson(){
  const t=perForm;
  t.name=val('pe_name');t.phone=val('pe_phone');t.email=val('pe_mail');
  t.gender=val('pe_gender');t.marital=val('pe_marital');t.nationality=val('pe_nat');
  t.birth=val('pe_birth');t.cc=val('pe_cc');t.ccValid=val('pe_ccv');
  t.nif=val('pe_nif');t.taxAddress=val('pe_addr');t.pais=val('pe_pais');
  if(document.getElementById('pe_retem'))t.retem=chk('pe_retem');   /* só o inquilino tem a caixa; num proprietário fica o que estava */
  if(document.getElementById('pe_notes'))t.notes=val('pe_notes');
  (t.files||[]).forEach(f=>{const e=document.getElementById('fn_'+f.id);if(e)f.name=e.value});
}
// Recebe os ficheiros do input de documentos: o conteúdo vai para o IndexedDB
// (takeFiles) e os metadados juntam-se a perForm.files. Assíncrono — repinta no fim.
// Recebe: input — o elemento <input type="file"> com os ficheiros escolhidos.
// Devolve: nada — repinta quando os ficheiros acabarem de entrar.
function personAddFiles(input){
  collectPerson();
  takeFiles(input).then(ms=>{perForm.files=(perForm.files||[]).concat(ms);
    repaintPerson();
    if(ms.length)toast('Documento adicionado.')});
}
// Repinta o corpo do modal a partir de perForm (sem recolher os campos antes).
// Devolve: nada — redesenha o corpo do modal.
function repaintPerson(){const b=modalBodyEl();if(!b)return;b.innerHTML=personBody();marcarDatasVazias(b)}
// Tira um documento da ficha e apaga logo o conteúdo do IndexedDB — sem desfazer.
// Recebe: fid — id do documento a remover.
// Devolve: nada — repinta o formulário.
function delPersonFile(fid){collectPerson();perForm.files=(perForm.files||[]).filter(f=>f.id!==fid);idbDel(fid).catch(()=>{});repaintPerson()}
/* Apaga a ficha, com confirmação: a pessoa sai da lista e o seu id é tirado
   dos imóveis (proprietário) ou contratos (inquilino), que se mantêm. Os
   documentos saem já do IndexedDB — aqui não há desfazer.
   Recebe: kind — 'owner' ou 'tenant', diz em que lista procurar; id — id da
   ficha a apagar.
   Devolve: nada — pede confirmação e, se aceite, grava e redesenha a vista. */
function delPerson(kind,id){
  const list=kind==='owner'?db.owners:db.tenants;
  const p=list.find(x=>x.id===id),word=kind==='owner'?'proprietário':'inquilino';
  if(!p)return;
  if(kind==='tenant'){const recusa=motivoRecusa(casaDoInquilino(p),'tenant.add',p,true);if(recusa)return toast(recusa)}
  /* a contagem só fala do que a conta vê: com os Imóveis ou os Contratos
     desligados, o id sai deles na mesma, mas a pergunta não os nomeia */
  const used=kind==='owner'?(servicoLigado('properties')?propsOf(id).length:0):(servicoLigado('contracts')?contractsOfTenant(id).length:0);
  confirmModal('Apagar '+word,`Apagar “${esc(p.name)}”?${used?` Sai de ${used} ${kind==='owner'?'imóvel(is)':'contrato(s)'}, que se mantêm.`:''}`,()=>{
    (p.files||[]).forEach(f=>idbDel(f.id).catch(()=>{}));
    if(kind==='owner'){db.owners=db.owners.filter(x=>x.id!==id);db.properties.forEach(x=>{x.ownerIds=(x.ownerIds||[]).filter(o=>o!==id)});if(ownerFilter===id)ownerFilter=''}
    else{db.tenants=db.tenants.filter(x=>x.id!==id);db.contracts.forEach(c=>{c.tenantIds=(c.tenantIds||[]).filter(t=>t!==id)})}
    save();closeAllModals();render();toast('Ficha apagada.');
  });
}
