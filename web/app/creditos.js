/* ================= CRÉDITOS (todas as hipotecas) ================= */
/* A hipoteca aberta ao lado da lista no computador, 'idImovel:idHipoteca'
   (vazio: a primeira da lista à vista), e se a lista mostra as liquidadas — no
   computador em vez das ativas (os chips), no telemóvel por baixo delas (o
   botão «Liquidadas»). Duram enquanto a app estiver aberta. */
let credSel='',credPagas=false;
/* o tipo da taxa no selo do cartão, curto como no canvas */
const CRED_TIPO={fixa:'Fixa',variavel:'Variável',mista:'Mista'};
/* A chave de uma hipoteca na página: o imóvel e a hipoteca.
   Recebe: p — o imóvel; l — a hipoteca.
   Devolve: 'idImovel:idHipoteca' (texto). */
function credChave(p,l){return p.id+':'+l.id}
/* Quando acaba a taxa fixa de uma mista, pelo mesmo relógio dos prazos e da
   simulação (credito.js:fimDaFaseFixa: as prestações registadas, e a próxima
   por confirmar quando os Planeados a têm).
   Recebe: l — a hipoteca.
   Devolve: {fim, dias} — a data e os dias que faltam; null quando não é mista
   ou a fase fixa já acabou. */
function credFimFixa(l){
  const r0=servicoLigado('recurring')?loanRecOf(l):null;
  const fim=fimDaFaseFixa(l,db.transactions||[],today(),r0&&r0.next);
  if(!fim)return null;
  return {fim,dias:Math.round((new Date(fim+'T00:00:00')-new Date(today()+'T00:00:00'))/864e5)};
}
/* A prestação depois da fase fixa de uma mista: a linha da amortização do mês
   em que a taxa muda (a mesma conta da ficha, creditos.js:mortFicha).
   Recebe: l — a hipoteca viva.
   Devolve: euros com o selo (número), ou null fora de uma mista em fase fixa. */
function credDepois(l){
  if(l.type!=='mista')return null;
  const k=Math.round((Number(l.fixedYears)||0)*12)-loanMes(l);if(k<=0)return null;
  const row=amort(l).rows[k];
  return row?row.pay+row.st:null;
}
/* O selo do fim da taxa fixa, só dentro da janela de aviso dos prazos
   (prazos.js:PZ_ANTECEDENCIA, a taxa): âmbar, e vermelho a sete dias ou menos.
   Recebe: l — a hipoteca viva.
   Devolve: o HTML do selo (texto), ou ''. */
function credSeloFixa(l){
  const f=credFimFixa(l);
  if(!f||f.dias<0||f.dias>PZ_ANTECEDENCIA.taxa)return '';
  const txt=f.dias===0?'A taxa fixa acaba hoje':f.dias===1?'A taxa fixa acaba amanhã':'Taxa fixa acaba em '+f.dias+' dias';
  return `<span class="badge ${f.dias<=7?'red':'amber'} cred-selo">${txt}</span>`;
}
/* O resumo das hipotecas ativas: em dívida, as prestações de um mês e os
   juros e o selo até ao fim — e, no telemóvel, a dívida no fim de cada ano em
   barras (a soma das hipotecas por ano civil, creditos.js:credDividaPorAno,
   como o gráfico de todas na amortização; a barra do ano corrente acesa). No
   telemóvel é o cartão azul-noite do canvas M-Creditos; no computador, três
   cartões (D-Creditos). As contas são as de sempre.
   Recebe: live — as {p,l} com capital em dívida.
   Devolve: o HTML do resumo (texto). */
function credResumo(live){
  const n=live.length,tot=sum(live.map(x=>x.l.outstanding)),pay=sum(live.map(x=>loanCalc(x.l).total));
  const juros=sum(live.map(x=>{const a=amort(x.l);return a.totInt+a.totStamp}));
  const d=credDividaPorAno(live.map(x=>x.l)),somas=d.somas,nY=d.anos.length,y0=d.anos[0],y1=d.anos[nY-1];
  const topo=Math.max(tot,...somas,1),agora=Math.max(0,d.anos.indexOf(Number(today().slice(0,4))));
  /* as barras são atributos do SVG (x, y, width, height), e não estilos: a CSP não os trava */
  const barras=somas.map((v,i)=>{const h=Math.max(2,Math.round(v/topo*52));
    return `<rect class="${i===agora?'agora':''}" x="${i*10+1}" y="${56-h}" width="8" height="${h}" rx="1.5"></rect>`}).join('');
  return `<section class="cred-resumo" aria-label="Resumo das hipotecas">
    <div class="cred-r cred-r-divida"><p class="cred-r-rot">Em dívida · ${n} ${n===1?'hipoteca ativa':'hipotecas ativas'}</p><p class="disp num cred-r-v">${euro(tot)}</p></div>
    <div class="cred-r cred-r-prest"><p class="cred-r-rot">Prestações</p><p class="disp num cred-r-v2">${euro2(pay)}<span class="cred-r-mes">/mês</span></p></div>
    <div class="cred-r cred-r-juros"><p class="cred-r-rot">Juros e selo até ao fim</p><p class="disp num cred-r-v2">${euro(juros)}</p></div>
    ${nY>1?`<div class="cred-r-graf"><svg class="cred-barras" viewBox="0 0 ${nY*10} 56" preserveAspectRatio="none" role="img" aria-label="${esc('Dívida no fim de cada ano, de '+y0+' a '+y1+', a descer até '+euro(somas[nY-1])+'.')}">${barras}</svg>
      <div class="cred-r-eixo num"><span>${y0}</span><span>Dívida no fim de cada ano</span><span>${y1}</span></div></div>`:''}</section>`;
}
/* O cartão de uma hipoteca: o nome e o imóvel, o selo do tipo de taxa, a taxa
   por extenso, o fim da taxa fixa quando está perto, a prestação (e a de
   depois da fase fixa), o capital em dívida com as prestações por pagar e a
   barra do capital do início já pago; no telemóvel, os botões Pagamento e
   Plano. Tocar lê (mortView: a ficha, ou no computador o painel ao lado). Uma
   liquidada diz só que já não há dívida.
   Recebe: x — {p,l}; sel — a chave da hipoteca aberta ao lado.
   Devolve: o HTML do cartão (texto). */
function credCartao(x,sel){
  const {p,l}=x,viva=Number(l.outstanding)>0,c=viva?loanCalc(l):null,id=jsq(p.id),lid=jsq(l.id);
  const depois=viva?credDepois(l):null,c0=viva?capitalDoInicio(l,db.transactions||[]):0;
  const pct=c0>0?Math.max(0,Math.min(100,(c0-Number(l.outstanding))/c0*100)):0;
  /* pagar abre o formulário do movimento (dos Movimentos) e mexe na hipoteca (motivoCredito); o plano é dos Créditos */
  const pagar=viva&&servicoLigado('transactions')&&!motivoCredito(p.id);
  const acoes=viva?(pagar?`<button type="button" class="btn sm" data-toca="camada" data-click="pagarCreditoDaHipoteca('${id}','${lid}')">Pagamento</button>`:'')
    +`<button type="button" class="btn sm" data-toca="camada" data-click="amortModal('${id}','${lid}')">Plano</button>`:'';
  return `<div class="card cred-hp${credChave(p,l)===sel?' on':''}${viva?'':' paga'}" data-cred="${esc(credChave(p,l))}">
    <div class="cred-hp-corpo tap" data-lp="mort:${esc(p.id)}:${esc(l.id)}" data-fk="mort:${esc(p.id)}:${esc(l.id)}" data-toca="camada" data-click="mortView('${id}','${lid}')">
      <div class="cred-hp-cab"><div class="cred-hp-nome"><h3>${esc(loanName(l))}</h3><p class="small">${esc(p.name)}</p></div>
        ${viva?`<span class="badge loan">${esc(CRED_TIPO[l.type]||'')}</span>`:'<span class="badge grey">Liquidada</span>'}</div>
      <p class="small num cred-hp-taxa">${esc(rateLabel(l))}</p>
      ${viva?credSeloFixa(l)+`<div class="cred-hp-nums num">
        <div><p class="small cred-rot">Prestação</p><p class="cred-v">${euro2(c.total)}<span class="small">/mês</span></p>${depois?`<p class="small cred-sub">depois: ${euro2(depois)}</p>`:''}</div>
        <div class="cred-hp-div"><p class="small cred-rot">Em dívida</p><p class="cred-v">${euro(l.outstanding)}</p><p class="small cred-sub">${c.esgotado?'Prazo esgotado':c.n+(c.n===1?' prestação':' prestações')+' por pagar'}</p></div></div>
      <div class="cred-barra" role="img" aria-label="${Math.round(pct)}% do capital do início já pago"><i data-largura="${pct.toFixed(1)}"></i></div>`
      :'<p class="small">Crédito liquidado: já não há capital em dívida.</p>'}</div>
    ${acoes?`<div class="cred-hp-acoes">${acoes}</div>`:''}</div>`;
}
/* O plano de amortização ano a ano numa tabela que rola dentro da sua caixa:
   o ano, a taxa, o capital, os juros, o selo e a dívida no fim (yearRows —
   as contas de sempre). Com max, as primeiras linhas e uma última com o ano
   em que acaba.
   Recebe: l — a hipoteca viva; max (opcional) — quantas linhas mostrar.
   Devolve: o HTML da caixa com a tabela (texto). */
function credTabela(l,max){
  const r=yearRows(l),ys=r.yrs,corta=!!max&&ys.length>max,ult=ys[ys.length-1];
  const taxa=v=>dec(Math.round((Number(v)||0)*1000)/1000)+'%';
  return `<div class="cred-plano" role="region" aria-label="Plano de amortização ano a ano" tabindex="0"><table class="table cred-tab cred-tab-plano">
    <thead><tr><th scope="col">Ano</th><th scope="col">Taxa</th><th scope="col">Capital</th><th scope="col">Juros</th><th scope="col">Selo</th><th scope="col">Dívida no fim</th></tr></thead>
    <tbody>${(corta?ys.slice(0,max):ys).map(y=>`<tr><td><b>${y.yr}</b></td><td>${esc(taxa(y.rate))}</td><td>${euro(y.cap)}</td><td>${euro(y.int)}</td><td>${euro(y.st)}</td><td><b>${euro(y.bal)}</b></td></tr>`).join('')}
    ${corta?`<tr class="cred-tab-fim"><td>…</td><td></td><td></td><td></td><td></td><td>${ult.yr}: ${euro(ult.bal)}</td></tr>`:''}</tbody></table></div>`;
}
/* O painel da hipoteca aberta, ao lado da lista no computador (o canvas
   D-Creditos): o nome e o imóvel, o capital do início, o prazo, as prestações
   registadas e os documentos; Pagamento, Plano e Editar (só a quem pode); a
   prestação do próximo mês por dentro, a de depois da fase fixa, os juros e o
   selo até ao fim; e o plano ano a ano, nas dez primeiras linhas. O «Plano»
   abre o plano inteiro e o gráfico (amortModal): no computador tocar numa
   hipoteca escolhe-a aqui e não abre a ficha, e era na ficha que estava a
   amortização. No telemóvel o painel não aparece: lá o plano abre-se no botão
   «Plano» de cada cartão.
   Recebe: x — {p,l} da hipoteca a mostrar, ou null.
   Devolve: o HTML do painel (texto), com id credDetalhe para o credEscolher o repintar. */
function credDetalhe(x){
  if(!x)return '<section class="card cred-det" id="credDetalhe"><p class="hint">Escolhe uma hipoteca para veres o plano.</p></section>';
  const {p,l}=x,viva=Number(l.outstanding)>0,id=jsq(p.id),lid=jsq(l.id),txs=db.transactions||[];
  const c0=capitalDoInicio(l,txs),pagas=loanPaidN(l),docs=(l.files||[]).length,anos=Number(l.years)||0;
  const meta=[c0>0?'Capital do início '+euro(c0):'',anos?anos+(anos===1?' ano':' anos')+(l.start?' desde '+dPT(l.start):''):(l.start?'Desde '+dPT(l.start):''),
    pagas+(pagas===1?' prestação registada':' prestações registadas'),docs?docs+(docs===1?' documento':' documentos'):''].filter(Boolean).join(' · ');
  const acoes=(viva&&servicoLigado('transactions')&&!motivoCredito(p.id)?`<button type="button" class="btn sm" data-toca="camada" data-click="pagarCreditoDaHipoteca('${id}','${lid}')">Pagamento</button>`:'')
    +(viva?`<button type="button" class="btn sm" data-toca="camada" data-click="amortModal('${id}','${lid}')">Plano</button>`:'')
    +(pode(p.id,'house.edit')?`<button type="button" class="btn sm" data-toca="camada" data-click="mortModal('${id}','${lid}')">Editar</button>`:'');
  const cab=`<div class="cred-det-cab"><div class="cred-det-nome"><h2>${esc(loanName(l))} · ${esc(p.name)}</h2><p class="small num">${esc(meta)}</p></div>${acoes?`<div class="cred-det-acoes">${acoes}</div>`:''}</div>`;
  if(!viva)return `<section class="card cred-det" id="credDetalhe">${cab}<p class="hint cred-det-nada">Crédito liquidado: já não há capital em dívida nem plano por cumprir.</p></section>`;
  const c=loanCalc(l),a=amort(l),depois=credDepois(l),f=depois?credFimFixa(l):null;
  const prox=credPrimeiraData(l);
  const mes=d=>(MES[Number(String(d).slice(5,7))-1]||'')+(String(d).slice(0,4)!==today().slice(0,4)?' '+String(d).slice(0,4):'');
  const vr=(Number(l.euribor)||0)+(Number(l.spread)||0);
  return `<section class="card cred-det" id="credDetalhe">${cab}
    <div class="cred-det-stats num">
      <div><p class="small">Prestação de ${esc(mes(prox))}</p><p class="cred-v">${euro2(c.total)}</p><p class="small">capital ${euro2(c.principal)} · juros ${euro2(c.interest)}${l.stampTax===false?'':' · selo '+euro2(c.stamp)}</p></div>
      ${depois?`<div><p class="small">${f?'A partir de '+esc(mes(f.fim)):'Depois da fase fixa'}</p><p class="cred-v">${euro2(depois)}</p><p class="small">Euribor ${esc(l.index||'')} ${esc(dec(l.euribor))}% + ${esc(dec(l.spread))}% = ${esc(dec(Math.round(vr*1000)/1000))}%</p></div>`:''}
      <div><p class="small">Juros e selo até ao fim</p><p class="cred-v">${euro(a.totInt+a.totStamp)}</p></div></div>
    ${credTabela(l,10)}</section>`;
}
/* No computador, tocar numa hipoteca da lista abre-a no painel ao lado: repinta
   só o painel e acende o cartão, como o dia do calendário (calendario.js:calSel).
   Recebe: pid — o id do imóvel; lid — o id da hipoteca.
   Devolve: nada — mexe no DOM (ou redesenha a vista, se o painel não estiver lá). */
function credEscolher(pid,lid){
  credSel=pid+':'+lid;
  const det=document.getElementById('credDetalhe'),p=prop(pid),l=p?findLoan(p,lid):null;
  if(!det||!l)return render();
  det.outerHTML=credDetalhe({p,l});
  [].slice.call(document.querySelectorAll('.cred-hp[data-cred]')).forEach(e=>e.classList.toggle('on',e.getAttribute('data-cred')===credSel));
  tornarFocavel(document.getElementById('credDetalhe'));
}
/* Os chips Ativas / Liquidadas do computador: que lista mostrar ao lado do painel.
   Recebe: v — verdadeiro para as liquidadas.
   Devolve: nada — muda a escolha e redesenha. */
function credVerPagas(v){credPagas=!!v;credSel='';render()}
/* O botão «Liquidadas» do telemóvel: abre e fecha a lista das já pagas por baixo das ativas.
   Devolve: nada — muda a escolha e redesenha. */
function credPagasAlternar(){credPagas=!credPagas;render()}
/* A página dos Créditos (os canvas M-Creditos e D-Creditos): o resumo, o aviso
   dos pagamentos sem hipoteca, e as hipotecas em cartões — no telemóvel as
   ativas e, por um botão, as liquidadas; no computador a lista à esquerda
   (chips Ativas / Liquidadas) e a hipoteca escolhida aberta à direita, com o
   plano ano a ano. «Nova hipoteca» está no cabeçalho do computador; no
   telemóvel, ao lado do título das ativas, e no vazio.
   Devolve: o HTML da vista (texto). */
function vCredits(){
  const K='lcred',s=lf(K);
  const rows=[];
  scope().forEach(p=>loansOf(p).forEach(l=>rows.push({p,l})));
  const live=rows.filter(x=>Number(x.l.outstanding)>0);
  const shown=lfSort(K,rows.filter(({p,l})=>{
    if(s.p&&p.id!==s.p)return false;
    if(s.st==='on'&&!(Number(l.outstanding)>0))return false;
    if(s.st==='off'&&Number(l.outstanding)>0)return false;
    return lfHit(K,[loanName(l),l.name,l.bank,p.name,RATE[l.type],String(l.outstanding)].join(' '));
  }),{divida:x=>x.l.outstanding,prestacao:x=>Number(x.l.outstanding)>0?loanCalc(x.l).total:0,nome:x=>loanName(x.l),imovel:x=>x.p.name});
  /* uma hipoteca grava-se na ficha do imóvel: sem «Editar a ficha» em imóvel
     nenhum (o Contabilista de fábrica vê os créditos e não os edita), o botão
     — o do título e o do vazio — só levava a uma recusa no Guardar */
  const adiciona=casasComo('house.edit').length;
  const head=lfBar(K,[lfSel(K,'p',lfPropOpts()),
      lfSel(K,'st',[{v:'',label:'Ativas e liquidadas'},{v:'on',label:'Ativas'},{v:'off',label:'Liquidadas'}])],shown.length,
      {opts:[{v:'divida',label:'Ordenar por dívida'},{v:'prestacao',label:'Ordenar por prestação'},{v:'nome',label:'Ordenar por nome'},{v:'imovel',label:'Ordenar por imóvel'}]});
  /* sem imóveis, o botão do canto só dava um aviso a dizer que faltava um
     imóvel: um caminho que acaba num aviso não é um caminho */
  if(!rows.length)return head+(esperaDoServidor()||`<div class="empty"><b>Sem hipotecas</b>${db.properties.length
    ?'Uma hipoteca está sempre associada a um imóvel.'+(adiciona?' Cria a primeira aqui ou na ficha do imóvel.'+saida('Nova hipoteca','newMort()','camada'):'')
    :'Uma hipoteca está sempre associada a um imóvel, e ainda não há nenhum.'+saida('Adicionar imóvel',"go('properties')",'ecra')}</div>`);
  const resumo=credResumo(live);
  if(!shown.length)return head+resumo+vazioFiltro();
  /* os pagamentos sem crédito são movimentos: sem o serviço dos Movimentos nesta conta não há aviso a mostrar */
  const aviso=(servicoLigado('transactions')?creditosOrfaos():[]).filter(x=>!motivoCredito(x.p.id)).map(({p,l,txs})=>`<div class="cred-aviso">
    <span class="cred-aviso-ic">${ic('bank',20)}</span>
    <p><b>${txs.length===1?'1 pagamento sem crédito associado':txs.length+' pagamentos sem crédito associado'}</b> em ${esc(p.name)} (${euro2(sum(txs.map(t=>t.amount||0)))}): ${txs.length===1?'não abateu':'não abateram'} capital nenhum a «${esc(loanName(l))}». Associar dá a cada um os juros, o selo e o capital do plano na sua data.</p>
    <button type="button" class="btn sm" data-toca="dados" data-click="associarOrfaos('${jsq(p.id)}','${jsq(l.id)}')" aria-label="${esc('Associar à hipoteca '+loanName(l))}">Associar</button></div>`).join('');
  const act=shown.filter(x=>Number(x.l.outstanding)>0),paid=shown.filter(x=>!(Number(x.l.outstanding)>0));
  const verPagas=(credPagas&&paid.length>0)||!act.length,aVista=verPagas?paid:act;
  const x=aVista.find(y=>credChave(y.p,y.l)===credSel)||aVista[0]||null;
  const sel=x?credChave(x.p,x.l):'';
  const emLista=(id,xs)=>listaViva(id,xs.map(y=>({chave:'mort:'+y.p.id+':'+y.l.id,html:credCartao(y,sel)})));
  const novo=adiciona?'<button type="button" class="btn sm ghost plan-novo" data-toca="camada" data-click="newMort()">Nova hipoteca</button>':'';
  const chips=act.length&&paid.length?`<div class="chips-fila cred-chips" role="group" aria-label="Mostrar">
      <button type="button" class="chip${verPagas?'':' on'}" aria-pressed="${verPagas?'false':'true'}" data-toca="vista" data-click="credVerPagas(false)">Ativas <span class="n">${act.length}</span></button>
      <button type="button" class="chip${verPagas?' on':''}" aria-pressed="${verPagas?'true':'false'}" data-toca="vista" data-click="credVerPagas(true)">Liquidadas <span class="n">${paid.length}</span></button></div>`:'';
  const col=chips
    +`<div class="plan-cab cred-cab"><h2>${act.length?'Ativas':'Liquidadas'}</h2>${novo}</div>`
    +(act.length?`<div class="cred-ativas">${emLista('creditos-ativos',act)}</div>`:'')
    +(paid.length&&act.length?`<button type="button" class="btn cred-liq" aria-expanded="${verPagas?'true':'false'}" data-toca="vista" data-click="credPagasAlternar()"><span>Liquidadas <span class="small">· ${paid.length}</span></span><span class="cred-liq-chev${verPagas?' aberto':''}">${ic('chevD',20)}</span></button>`:'')
    +(paid.length?`<div class="cred-pagas">${emLista('creditos-pagos',paid)}<p class="hint">Se editares um pagamento e a dívida voltar a subir, o crédito volta para as ativas.</p></div>`:'');
  return head+resumo+aviso+`<div class="cred-corpo${verPagas?' pagas':''}"><div class="cred-col">${col}</div>${credDetalhe(x)}</div>`;
}
/* Os pagamentos de crédito de um imóvel que estão à espera de hipoteca: os que
   nasceram de um planeado sem crédito e por isso nunca abateram capital
   nenhum. Ficam de fora os que o delMort desligou de propósito (loanOff) — o
   utilizador apagou a hipoteca e escolheu ficar com os movimentos, que já
   abateram capital no seu tempo; oferecê-los à hipoteca sobrevivente abatia
   duas vezes o mesmo dinheiro, e a hipoteca errada.
   Recebe: pid — o id do imóvel.
   Devolve: os movimentos por ligar, por ordem de data (array). */
function orfaosDe(pid){
  return (db.transactions||[]).filter(t=>t.kind==='loan'&&!t.loanId&&!t.loanOff&&t.propertyId===pid)
    .sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')));
}
/* Pagamentos de crédito já registados sem hipoteca associada, imóvel a
   imóvel — os do orfaosDe. Só entram os que se podem ligar sem dúvida: o
   imóvel tem uma e uma só hipoteca viva. Com duas ou mais, ninguém pode
   adivinhar qual delas e o movimento fica como está, para se corrigir à mão.
   Devolve: array de {p,l,txs} — o imóvel, a hipoteca única e os movimentos
   por ligar por ordem de data; vazio quando não há nada a reparar. */
function creditosOrfaos(){
  const out=[];
  scope().forEach(p=>{
    const ls=liveLoans(p);if(ls.length!==1)return;
    const txs=orfaosDe(p.id);
    if(txs.length)out.push({p,l:ls[0],txs});
  });
  return out;
}
/* Liga à hipoteca os pagamentos daquele imóvel que ficaram sem crédito: por
   ordem de data, cada um passa pelo applyLoan, que lhe reparte juros, selo e
   capital sobre a dívida do momento (ou respeita a distribuição que já
   trouxer, se bater certo com o montante) e a abate — o mesmo que teria
   acontecido se tivessem sido confirmados um a um. Daí o _paidOfs=−1 em cada
   um: sem ele o movimento contava-se a si próprio nas prestações registadas
   (já está em db.transactions), o que numa mista podia dar-lhe a fase de taxa
   seguinte. Quando o capital em dívida deixa de chegar, o applyLoan cortava-o
   e gravava uma distribuição que já não somava o montante: esse pára a fila —
   é desfeito, e ele e os seguintes ficam como estavam, com a mensagem a dizer
   quantos. Não se faz sozinho no arranque de propósito: mexer no capital em
   dívida sem o utilizador saber era pior do que o erro. Deixa Anular, que
   repõe os movimentos, a dívida e os planeados.
   Recebe: pid — o id do imóvel; lid — o id da hipoteca.
   Devolve: nada — pede confirmação e, com o sim, grava e redesenha. */
function associarOrfaos(pid,lid){
  if(!servicoLigado('transactions'))return toast(hintServicoDesligado('transactions'));   /* o applyLoan é dos Movimentos */
  const recusa=motivoCredito(pid);if(recusa)return toast(recusa);
  const p=prop(pid),l=p?findLoan(p,lid):null;if(!l)return;
  const txs=orfaosDe(pid);
  if(!txs.length)return toast('Já não há pagamentos por associar.');
  const antes=l.outstanding,copias={};txs.forEach(t=>{copias[t.id]=JSON.parse(JSON.stringify(t))});
  const recsAntes=JSON.parse(JSON.stringify(db.recurring||[]));
  confirmModal('Associar à hipoteca',`${txs.length===1?'1 pagamento de crédito':txs.length+' pagamentos de crédito'} de ${esc(p.name)} (${euro2(sum(txs.map(t=>t.amount||0)))} no total) ${txs.length===1?'ficou':'ficaram'} sem hipoteca associada e nunca ${txs.length===1?'abateu':'abateram'} capital. Associar a “${esc(loanName(l))}”? Cada um fica com os juros, o selo e o capital do plano na sua data, e o capital em dívida desce a partir dos <b>${euro2(antes)}</b> de agora.`,()=>{
    /* o capital do início fica gravado antes de estes pagamentos passarem a contar nele */
    fixarCapitalInicio(l,db.transactions);
    const capital=l.capitalInicio,feitos=[];
    for(const t of txs){
      t.loanId=l.id;l._paidOfs=-1;chamarServico('transactions','applyLoan',t);delete l._paidOfs;
      if(!distribuicaoBate(t)){   /* o capital em dívida não chegou: desfaz-se este e páram os seguintes */
        ['interest','stamp','principal','fee'].forEach(k=>delete t[k]);
        Object.assign(t,JSON.parse(JSON.stringify(copias[t.id])));
        acertarCapital(l);
        db.recurring=JSON.parse(JSON.stringify(recsAntes));   /* a tentativa chegou a liquidar o crédito: o applyLoan apagou o planeado */
        break;
      }
      feitos.push(t);
    }
    const fora=txs.length-feitos.length;
    if(!feitos.length)return toast('Só faltam '+euro2(antes)+' de capital em “'+loanName(l)+'”: o pagamento de '+euro2(txs[0].amount||0)+' não cabe. Associa-o à mão, ajustando a distribuição.');
    if(servicoLigado('recurring'))syncLoanRec(p,l);   /* a prestação planeada é dos Planeados */
    save();buildNav();render();
    const frase=(feitos.length===1?'Pagamento associado a “'+loanName(l)+'”.':feitos.length+' pagamentos associados a “'+loanName(l)+'”.')
      +(fora?' '+(fora===1?'1 ficou':fora+' ficaram')+' de fora: o capital em dívida acabou.':'');
    comDesfazer(frase,()=>{
      db.transactions=db.transactions.map(t=>copias[t.id]?normTx(JSON.parse(JSON.stringify(copias[t.id]))):t);
      db.recurring=JSON.parse(JSON.stringify(recsAntes));   /* o planeado que o applyLoan apagou volta como estava, e não um novo */
      /* volta a procurar a hipoteca: um sync entretanto pode ter trocado os objetos da db */
      const x=anyLoan(lid);if(!x)return;
      if(x.l.capitalInicio==null)x.l.capitalInicio=capital;
      acertarCapital(x.l);
    });
  });
}
/* Um pagamento de crédito cuja distribuição soma o montante, ao cêntimo — o
   mesmo que o formulário exige para gravar. Serve para apanhar o corte que o
   applyLoan faz quando o capital em dívida não chega para o movimento todo.
   Recebe: t — o movimento já passado pelo applyLoan.
   Devolve: true quando juros + selo + capital (+ comissão) dão o montante. */
function distribuicaoBate(t){
  const s=r2(Number(t.interest||0)+Number(t.stamp||0)+Number(t.principal||0)+Math.max(0,Number(t.fee||0)));
  return Math.abs(s-(Number(t.amount)||0))<=0.011;
}
/* nova hipoteca: escolhe-se primeiro o imóvel (uma hipoteca tem sempre um),
   entre os que posso editar — a hipoteca grava-se na ficha do imóvel
   Devolve: nada — abre o seletor de imóvel e depois o modal da hipoteca nova
   (ou um toast, quando ainda não há imóveis ou nenhum que eu possa editar). */
function newMort(){
  if(!db.properties.length)return toast('Cria primeiro um imóvel.');
  const casas=casasComo('house.edit');
  if(!casas.length)return toast(fraseSemPerm('house.edit'));
  pickModal('Hipoteca de que imóvel?',casas.map(p=>({v:p.id,label:p.name,sub:loansOf(p).length?loansOf(p).length+' hipoteca(s)':'sem hipotecas',icon:'building'})),
    o=>{closeAllModals();
      pForm=normProp(JSON.parse(JSON.stringify(prop(o.v))));
      const l=normLoan({name:pForm.loans.length?'':'Aquisição'});
      pForm.loans.push(l);
      mortOpen(l.id,true);
    });
}
/* O corpo da ficha de uma hipoteca.

   «Quanto falta pagar, quanto sai por mês, a que taxa e até quando — e
   quanto me custa até ao fim.» A taxa vai inteira numa linha (o rateLabel já
   escreve «fixa 3,2%» ou «Euribor 6m 2,1% + 1% = 3,1%»): a ficha diz a taxa,
   não os campos que a compõem. O custo até ao fim chama-se «Juros e selo até
   ao fim», como no resumo e no painel (só «Juros» numa hipoteca sem selo).
   Recebe: pid — o id do imóvel; lid — o id da hipoteca.
   Devolve: o HTML do corpo, ou vazio se a hipoteca já não existir. */
function mortFicha(pid,lid){
  const p=prop(pid),l=p?findLoan(p,lid):null;if(!l)return '';
  const viva=Number(l.outstanding)>0;
  const c=(viva&&Number(l.years)>0)?loanCalc(l):null;
  const a=c?amort(l):null;
  const faseFixa=l.type==='mista'?Math.round((Number(l.fixedYears)||0)*12)-loanMes(l):0;
  const depois=(a&&faseFixa>0)?a.rows[faseFixa]:null;
  return ficha([
    pode(pid,'house.edit')?null:{tipo:'nota',valor:'Hipoteca de <b>'+esc(p.name)+'</b>, um imóvel onde colaboras — a ficha é só de leitura.'},
    viva?null:{tipo:'nota',valor:'Crédito liquidado: já não há capital em dívida.'},
    viva?{rotulo:'Em dívida',valor:euro(l.outstanding)}:null,
    c?{rotulo:'Prestação mensal',valor:euro2(c.total)}:null,
    /* é o que explica porque é que a dívida desce tão devagar */
    c?{tipo:'bloco',rotulo:'A prestação por dentro',
      valor:'capital '+euro2(c.principal)+' · juros '+euro2(c.interest)+(l.stampTax===false?'':' · selo '+euro2(c.stamp))}:null,
    depois?{rotulo:'Depois da fase fixa',valor:euro2(depois.pay+depois.st)}:null,
    {rotulo:'Taxa',valor:esc(rateLabel(l))},
    l.start?{rotulo:'Início',valor:dPT(l.start)}:null,
    Number(l.years)>0?{rotulo:'Prazo',valor:l.years+(Number(l.years)===1?' ano':' anos')}:null,
    /* o mesmo número e o mesmo nome do resumo e do painel; sem selo, são só juros */
    a?{rotulo:l.stampTax===false?'Juros até ao fim':'Juros e selo até ao fim',valor:euro(a.totInt+a.totStamp)}:null,
    l.stampTax===false?{tipo:'nota',valor:'Sem imposto do selo.'}:null,
    l.autoRec===false?{tipo:'nota',valor:'Não cria o movimento recorrente da prestação.'}:null,
  ]);
}
/* O «Pagamento de crédito» da ficha de uma hipoteca: abre o formulário do
   movimento com o imóvel e a hipoteca já escolhidos. Era um objeto literal
   escrito no atributo, que a gramática das ações não tem; faz o mesmo.
   Recebe: pid — o id do imóvel; lid — o id da hipoteca.
   Devolve: nada — abre o modal do movimento. */
function pagarCreditoDaHipoteca(pid,lid){
  txModal({kind:'loan',propId:pid,preset:{loanId:lid}});
}
/* A ficha de uma hipoteca: o que tocar numa hipoteca passa a abrir. Na página
   dos Créditos de um ecrã largo a hipoteca lê-se no painel ao lado da lista
   (#credDetalhe, à vista só no computador): aí tocar escolhe-a lá
   (credEscolher), em vez de abrir uma janela por cima do que já se está a ler.
   Recebe: pid — o id do imóvel; lid — o id da hipoteca.
   Devolve: nada — abre a janela (ou escolhe a hipoteca no painel). */
function mortView(pid,lid){
  const p=prop(pid),l=p?findLoan(p,lid):null;if(!l)return;
  if(!pode(pid,'loan.view'))return;
  const det=typeof document!=='undefined'?document.getElementById('credDetalhe'):null;
  if(tab==='credits'&&det&&det.isConnected===true&&det.offsetParent)return credEscolher(pid,lid);
  abrirFicha({
    titulo:()=>{const q=prop(pid),x=q?findLoan(q,lid):null;return x?loanName(x):'Hipoteca'},
    corpo:()=>mortFicha(pid,lid),
    menu:()=>{const q=prop(pid),x=q?findLoan(q,lid):null;if(!x)return '';
      const it=[];
      /* pagar abre o formulário do movimento: só com os Movimentos ligados nesta
         conta; a tabela da amortização é da hipoteca, e fica */
      const viva=Number(x.outstanding)>0&&!motivoCredito(pid);
      if(viva&&servicoLigado('transactions'))it.push(
        {label:'Pagamento de crédito',icon:'bank',toca:'camada',act:`pagarCreditoDaHipoteca('${jsq(pid)}','${jsq(lid)}')`});
      if(viva)it.push({label:'Amortização',icon:'trend',toca:'camada',act:`amortModal('${jsq(pid)}','${jsq(lid)}')`});
      if(pode(pid,'house.edit'))it.push({label:'Apagar hipoteca',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delMortFrom('${jsq(pid)}','${jsq(lid)}')`});
      return it.length?menu('fichaMort',it):''},
    editar:pode(pid,'house.edit')?{rotulo:'Editar',act:`mortModal('${jsq(pid)}','${jsq(lid)}')`}:null,
  });
}
/* editar uma hipoteca num modal próprio, gravando no imóvel
   Recebe: pid — o id do imóvel; lid — o id da hipoteca dentro dele.
   Devolve: nada — carrega o imóvel em pForm e abre o modal. */
function mortModal(pid,lid){
  pForm=normProp(JSON.parse(JSON.stringify(prop(pid))));
  mortOpen(lid,false);
}
/* Abre o modal da hipoteca `lid` do imóvel já carregado em pForm (newMort e
   mortModal tratam disso primeiro). Liga o repaint ao mortBody, põe o menu de
   apagar quando é edição, e define o onSave: sem capital em dívida (nova ou
   editada) recusa e aponta o campo; senão grava o imóvel inteiro na db, sincroniza os
   movimentos planeados das prestações e fecha.
   Recebe: lid — o id da hipoteca dentro de pForm; isNew — verdadeiro quando
   acabou de ser criada pelo newMort.
   Devolve: nada — abre o modal e deixa o onSave armado. */
function mortOpen(lid,isNew){
  foldState={};
  _propPaint=()=>mortBody(lid);
  const m=!isNew?menu('mort',[{label:'Apagar hipoteca',icon:'trash',danger:true,toca:'dados',risco:'destroi',act:`delMort('${lid}')`}]):'';
  openModal(isNew?'Nova hipoteca':'Editar hipoteca',mortBody(lid),null,m);
  onSave=()=>{
    /* o propModal testa isto antes de gravar e este não testava: escondia-se
       o «Editar» e ficava o buraco, para quem lá chegasse por outro caminho */
    if(pForm.id&&prop(pForm.id)&&!pode(pForm.id,'house.edit'))return toast(fraseSemPerm('house.edit'));
    collectProp();
    const l=findLoan(pForm,lid);
    /* o capital tem o asterisco dos obrigatórios (imovel.js:loanSect), e por
       isso recusa-se em branco também ao editar — só na nova, o campo dizia
       «obrigatório» e gravava-se vazio */
    if(l&&!(capitalDoInicio(l,db.transactions)>0))return falhaCampo('l_out_'+l.id,'Indica o capital em dívida.');
    if(l)l.name=l.name||l.bank||'Hipoteca';   /* a recorrência identifica-se pelo nome */
    /* a pergunta pelas prestações desde o início cria movimentos: com os
       Movimentos ligados; o planeado da prestação só com os Planeados */
    const historia=servicoLigado('transactions');
    const antes=historia?loanStartsAntes(prop(pForm.id)):null;   /* antes de trocar o objeto na db */
    const i=db.properties.findIndex(x=>x.id===pForm.id);
    if(i>-1)db.properties[i]=pForm;
    if(servicoLigado('recurring'))syncAllLoanRecs();
    save();closeModal();render();toast('Hipoteca guardada.');
    if(historia)perguntarPrestacoesEmFalta(pForm,antes)};
}
// O corpo do modal: o formulário da hipoteca `lid` dentro de pForm — o mesmo
// loanSect da ficha do imóvel. É também a função de repaint do modal.
// Recebe: lid — o id da hipoteca dentro de pForm.
// Devolve: o HTML do formulário, ou um aviso se a hipoteca já não existir.
function mortBody(lid){
  const i=(pForm.loans||[]).findIndex(x=>x.id===lid),l=pForm.loans[i];
  if(!l)return '<div class="hint">Hipoteca não encontrada.</div>';
  return `<div class="form">
    <div class="hint u-m-n2px-0-0">Imóvel: <b>${esc(pForm.name)}</b></div>
    ${loanSect(l,i)}</div>`;
}
// Apagar a partir da lista, onde ainda não há pForm: carrega o imóvel e delega no delMort.
// Recebe: pid — o id do imóvel; lid — o id da hipoteca.
// Devolve: nada — o delMort trata da confirmação e do resto.
function delMortFrom(pid,lid){pForm=normProp(JSON.parse(JSON.stringify(prop(pid))));delMort(lid)}
/* Apagar a hipoteca `lid` de pForm, com confirmação. As prestações já
   registadas não se apagam — só lhes tira o loanId, e o aviso diz quantas
   ficam assim; ficam com a marca loanOff, que as distingue para sempre das
   que nunca tiveram hipoteca (o cartão dos órfãos não as oferece à hipoteca
   sobrevivente: o capital delas já foi abatido, na hipoteca que se apagou).
   Os planeados que a pediam também não se apagam: perdem a hipoteca e a mesma
   marca, para o recLoanId não os apontar à seguinte pelas costas do
   utilizador — as listas passam a pedir-lhe que escolha. O planeado
   automático desta hipoteca é do syncAllLoanRecs, que o apaga logo a seguir.
   Limpa também os anexos dela do IndexedDB antes de gravar o imóvel e repintar.
   Recebe: lid — o id da hipoteca dentro de pForm.
   Devolve: nada — pede confirmação e, com o sim, grava, fecha e repinta. */
function delMort(lid){
  const l=findLoan(pForm,lid),used=db.transactions.filter(t=>t.loanId===lid).length;
  confirmModal('Apagar hipoteca',`Apagar “${esc(loanName(l))}”?${used?` ${used} prestação(ões) ficam sem hipoteca associada.`:''}`,()=>{
    db.transactions.forEach(t=>{if(t.loanId===lid){t.loanId=null;t.loanOff=true}});
    (db.recurring||[]).forEach(r=>{if(!r.auto&&r.tx&&r.tx.loanId===lid){r.tx.loanId=null;r.loanOff=true}});
    ((l||{}).files||[]).forEach(f=>idbDel(f.id).catch(()=>{}));
    pForm.loans=pForm.loans.filter(x=>x.id!==lid);
    const i=db.properties.findIndex(x=>x.id===pForm.id);
    if(i>-1)db.properties[i]=pForm;
    if(servicoLigado('recurring'))syncAllLoanRecs();   /* o planeado automático desta hipoteca é dos Planeados */
    save();closeAllModals();render();toast('Hipoteca apagada.');
  });
}
/* ---- as prestações desde o início de uma hipoteca ----
   São movimentos (dos Movimentos) numa hipoteca (dos Créditos): a pergunta
   corre com esses dois serviços ligados, e só o planeado da prestação é dos
   Planeados. Estavam em planeados.js e só perguntavam com os Planeados
   ligados — sem eles, um crédito antigo ficava com o capital da data de
   início e o prazo inteiro a partir de hoje, sem a app o dizer. */
/* Retrato dos inícios das hipotecas de um imóvel, {idDaHipoteca: início},
   tirado ANTES de gravar — depois de db.properties[i]=pForm o prop(id) já é
   o próprio pForm e não há com que comparar.
   Recebe: p — o imóvel tal como está na db (objeto; aguenta null/undefined).
   Devolve: objeto {loanId: 'AAAA-MM-DD' ou ''}; vazio sem imóvel. */
function loanStartsAntes(p){const o={};loansOf(p).forEach(l=>{o[l.id]=l.start||''});return o}
/* Depois de gravar o imóvel: para cada hipoteca com dívida cujo início recuou
   (ou que é nova e começou no passado, ou cujo início acabou de ser
   preenchido) e à qual faltam prestações entre o início e a primeira
   registada, pergunta se se inserem — uma hipoteca de cada vez. Com os
   Planeados ligados, correr depois de syncAllLoanRecs, para a janela parar
   onde a recorrência começa (r.next). O mesPt («set 2026») é dos Movimentos,
   que quem chama garante ligados.
   Recebe: p — o imóvel acabado de gravar (objeto de db.properties); antes — o
   retrato de loanStartsAntes tirado antes da gravação ({} num imóvel novo).
   Devolve: nada — abre a(s) pergunta(s); ao confirmar, insere e grava. */
function perguntarPrestacoesEmFalta(p,antes){
  const hoje=today();antes=antes||{};
  const fila=loansOf(p).filter(l=>{
    if(!(Number(l.outstanding)>0)||!l.start||l.start>hoje)return false;
    if(!(l.id in antes))return true;            /* hipoteca nova com início no passado */
    return !antes[l.id]||l.start<antes[l.id];   /* início preenchido agora, ou recuou */
  }).map(l=>{const r=servicoLigado('recurring')?loanRecOf(l):null;return {l,lista:loanPrestacoesEmFalta(l,db.transactions,hoje,r?r.next:'')}}).filter(x=>x.lista.length);
  const seguinte=()=>{const x=fila.shift();if(!x)return;
    const {l,lista}=x,n=lista.length,de=lista[0].date,a=lista[n-1].date;
    /* o capital em dívida desce o capital destas — as que já estavam registadas também o abateram */
    const fim=Math.max(0,r2((Number(l.outstanding)||0)-sum(lista.map(x2=>x2.principal))));
    confirmModal('Prestações em falta',`“${esc(loanName(l))}” começou a ${esc(mesPt(de))} e não tem ${n===1?'a prestação de '+esc(mesPt(de))+' registada':n+' prestações registadas, de '+esc(mesPt(de))+' a '+esc(mesPt(a))} (${euro2(sum(lista.map(x2=>x2.amount)))} no total). Inserir agora? Ficam com os juros, o selo e o capital do plano, e o capital em dívida desce de <b>${euro2(l.outstanding)}</b> para <b>${euro2(fim)}</b>${fim>0?'':' — o crédito fica liquidado'}.`,
      ()=>{inserirPrestacoesEmFalta(p,l,lista);seguinte()});
  };
  seguinte();
}
/* Regista as prestações calculadas como movimentos normais, com a cara da
   recorrência automática e a etiqueta "Estimativa": cada uma abate o seu
   capital ao capital do início, como se fossem confirmadas uma a uma — o
   capital em dívida volta a derivar-se (credito.js:saldoEmDivida). Com os
   Planeados ligados, ressincroniza a recorrência (o prazo restante encurtou:
   a prestação muda; com o crédito liquidado, desaparece). Grava, redesenha e
   dá Anular em bloco — que tira os movimentos e repõe o capital.
   Recebe: p — o imóvel (objeto de db.properties); l — a hipoteca (objeto de
   p.loans); lista — as prestações de loanPrestacoesEmFalta.
   Devolve: nada — mexe em db.transactions, na hipoteca e em db.recurring, grava e redesenha. */
function inserirPrestacoesEmFalta(p,l,lista){
  if(!lista||!lista.length)return;
  fixarCapitalInicio(l,db.transactions);   /* os dados antigos: antes de os movimentos novos contarem */
  const capital=l.capitalInicio;
  const base=loanRecTx(p,l),os=ownersOfProp(p),paidBy=os.length===1?os[0]:null;
  const tags=db.settings.tags||(db.settings.tags=[]);if(tags.indexOf('Estimativa')<0)tags.push('Estimativa');
  const novos=lista.map(x=>normTx(Object.assign({},base,{date:x.date,amount:x.amount,interest:x.interest,stamp:x.stamp,principal:x.principal,fee:0,paidBy,tags:['Estimativa']})));
  db.transactions=db.transactions.concat(novos);
  acertarCapital(l);
  if(servicoLigado('recurring'))syncLoanRec(p,l);
  save();buildNav();render();
  const ids=novos.map(t=>t.id);
  comDesfazer(novos.length===1?'Prestação inserida.':novos.length+' prestações inseridas.',()=>{
    db.transactions=db.transactions.filter(t=>ids.indexOf(t.id)<0);
    /* volta a procurar a hipoteca: um sync entretanto pode ter trocado os objetos da db (como o delTx faz) */
    const x=anyLoan(l.id);if(!x)return;
    if(x.l.capitalInicio==null)x.l.capitalInicio=capital;
    acertarCapital(x.l);
    if(servicoLigado('recurring'))syncLoanRec(x.p,x.l);
  });
}
/* ---- a amortização: a projeção ano a ano de uma hipoteca ----
   É informação da hipoteca, e não toca em movimentos: vive nos Créditos, e
   abre com os Movimentos desligados. */
/* O dia da primeira prestação do plano — a primeira linha da amortização: a
   próxima por confirmar, quando os Planeados a têm; senão, hoje. É o relógio
   do painel (creditos.js:credDetalhe, «Prestação de …») e o das linhas por ano
   (creditos.js:yearRows). A amortização abre com os Planeados desligados, daí
   a guarda.
   Recebe: l — a hipoteca.
   Devolve: a data em 'AAAA-MM-DD' (texto). */
function credPrimeiraData(l){
  const r0=servicoLigado('recurring')?loanRecOf(l):null,d=String((r0&&r0.next)||'');
  return /^\d{4}-\d{2}-\d{2}$/.test(d)?d:today();
}
/* Agrega o plano de amortização da hipoteca em linhas por ano civil (capital,
   juros, selo, taxa e dívida no fim do ano) e devolve também os totais de
   juros e selo até ao fim. A primeira linha leva as prestações do mês da
   primeira (creditos.js:credPrimeiraData) até dezembro; as seguintes, doze
   cada; e cada uma tem o seu ano verdadeiro. Eram blocos de doze prestações a
   contar de hoje com o nome dos anos civis: a linha «2026» levava prestações
   de 2027, e a tabela acabava um ano antes da última.
   Recebe: l — a hipoteca (objeto).
   Devolve: {yrs,totInt,totStamp} — yrs é a lista anual de {yr,int,st,cap,bal,rate}
   (yr o ano civil, valores em euros, rate em % — a do último mês do ano). */
function yearRows(l){
  const a=amort(l),yrs=[],d0=credPrimeiraData(l);
  let ai=0,as=0,ac=0,bal=l.outstanding,yr=Number(d0.slice(0,4)),mes=Number(d0.slice(5,7));
  a.rows.forEach((r,i)=>{ai+=r.int;as+=r.st;ac+=r.cap;bal=r.bal;
    if(mes===12||i===a.rows.length-1){yrs.push({yr,int:ai,st:as,cap:ac,bal,rate:r.rate});ai=as=ac=0}
    if(++mes>12){mes=1;yr++}});
  return {yrs,totInt:a.totInt,totStamp:a.totStamp};
}
/* A dívida no fim de cada ano civil de várias hipotecas, para as barras do
   resumo (creditos.js:credResumo) e o gráfico de todas na amortização
   (creditos.js:amortModal). Soma-se pelo ano de cada linha, e não pela
   posição: os anos vão do primeiro ano do plano de alguma delas ao último;
   antes do primeiro ano do seu plano uma hipoteca ainda deve o capital em
   dívida de agora (a próxima prestação só cai no ano seguinte), e depois do
   último já não deve nada.
   Recebe: ls — as hipotecas (array).
   Devolve: {anos, por, somas} — anos os anos civis por ordem (números); por a
   dívida de cada hipoteca no fim de cada ano (um array por hipoteca, na ordem
   de ls); somas a soma de todas em cada ano. Sem planos, tudo vazio. */
function credDividaPorAno(ls){
  const planos=(ls||[]).map(l=>yearRows(l).yrs),cheios=planos.filter(y=>y.length);
  if(!cheios.length)return {anos:[],por:planos.map(()=>[]),somas:[]};
  const y0=Math.min(...cheios.map(y=>y[0].yr)),y1=Math.max(...cheios.map(y=>y[y.length-1].yr)),anos=[];
  for(let a=y0;a<=y1;a++)anos.push(a);
  const por=planos.map((y,i)=>anos.map(a=>{
    if(!y.length)return 0;
    if(a<y[0].yr)return Number(ls[i].outstanding)||0;
    const r=y.find(x=>x.yr===a);return r?r.bal:0}));
  return {anos,por,somas:anos.map((_,k)=>sum(por.map(v=>v[k])))};
}
let amortPid=null,amortLid='';
/* Modal da amortização de um imóvel: com uma hipoteca escolhida, gráfico e tabela ano a ano;
   sem escolha, todas as hipotecas com a linha do total. Abre sempre uma janela nova (a ficha
   e o toque longo de uma hipoteca já trazem a hipoteca escolhida); só o seletor da própria
   janela (onAmortSel) troca o conteúdo no sítio. Sem hipoteca dada, escolhe sozinho se só
   houver uma.
   Recebe: pid — o id do imóvel (string); lid (opcional) — o id da hipoteca a mostrar ('' mostra
   todas; sem ele, a única ou todas); trocar (opcional) — verdadeiro para trocar o conteúdo da
   janela aberta em vez de abrir outra.
   Devolve: nada — abre ou atualiza o modal. */
function amortModal(pid,lid,trocar){
  const p=prop(pid),ls=liveLoans(p);if(!ls.length)return;
  amortPid=pid;amortLid=lid==null?(ls.length===1?ls[0].id:''):lid;
  const opts=(ls.length>1?[{v:'',label:'Todas as hipotecas'}]:[]).concat(ls.map(l=>({v:l.id,label:loanName(l)})));
  let body='';
  if(amortLid){
    const l=findLoan(p,amortLid),r=yearRows(l);
    /* a tabela é a do painel do computador (credTabela), inteira, e rola na sua caixa */
    body=`${cLine([{name:'Em dívida',values:r.yrs.map(y=>y.bal),color:COR_SERIE.divida}],r.yrs.map(y=>String(y.yr)),{h:180,marks:decadeMarks(r.yrs[0]?r.yrs[0].yr:YEAR,r.yrs.length)})}
      ${credTabela(l)}
      <div class="hint">Juros ${euro(r.totInt)} + imposto do selo ${euro(r.totStamp)} = <b>${euro(r.totInt+r.totStamp)}</b>.</div>`;
  }else{
    /* as linhas somam-se pelo ano civil de cada uma (credDividaPorAno), e não pela posição */
    const per=ls.map(l=>({l,r:yearRows(l)})),d=credDividaPorAno(ls);
    body=`${cLine(per.map((x,i)=>({name:loanName(x.l),values:d.por[i],color:PAL[i%PAL.length]}))
        .concat([{name:'Total',values:d.somas,color:COR_SERIE.divida}]),d.anos.map(String),{h:200,marks:decadeMarks(d.anos[0]||YEAR,d.anos.length)})}
      <div class="cred-plano" role="region" aria-label="As hipotecas do imóvel" tabindex="0"><table class="table cred-tab"><thead><tr><th scope="col">Hipoteca</th><th scope="col">Em dívida</th><th scope="col">Prestação</th><th scope="col">Juros até ao fim</th><th scope="col">Selo</th></tr></thead>
      <tbody>${per.map(x=>`<tr><td><b>${esc(loanName(x.l))}</b><div class="small">${esc(RATE[x.l.type]||'')} · ${esc(x.l.years)} anos</div></td>
        <td>${euro(x.l.outstanding)}</td><td>${euro2(loanCalc(x.l).total)}</td><td>${euro(x.r.totInt)}</td><td>${euro(x.r.totStamp)}</td></tr>`).join('')}
        <tr class="cred-tab-total"><td><b>Total</b></td><td><b>${euro(debtOf(p))}</b></td><td><b>${euro2(payOf(p))}</b></td>
          <td><b>${euro(sum(per.map(x=>x.r.totInt)))}</b></td><td><b>${euro(sum(per.map(x=>x.r.totStamp)))}</b></td></tr>
      </tbody></table></div>`;
  }
  (trocar?setModal:openModal)('Amortização · '+p.name,`<div class="form">
    ${ls.length>1?`<label>Ver${sel('amSel',amortLid,opts,'onAmortSel','vista')}</label>`:''}
    ${body}</div>`,`<button class="btn" data-toca="camada" data-click="closeModal()">Fechar</button>`);
}
// Mudou a hipoteca no select do modal da amortização: reconstrói o conteúdo.
// Devolve: nada — reconstrói o modal via amortModal.
function onAmortSel(){amortModal(amortPid,val('amSel'),true)}
/* ---- registo do serviço (servicos.js) ---- */
/* O menu de toque longo de uma hipoteca (data-lp "mort:<idImovel>:<idHipoteca>").
   Pagar abre o formulário do movimento, que é dos Movimentos: só com esse
   serviço ligado nesta conta. A amortização é dos Créditos e fica. Os outros
   serviços acrescentam as suas opções por lpExtras.
   Recebe: a — as partes do data-lp (['mort', idImovel, idHipoteca]).
   Devolve: nada — abre a folha de opções (ou nada, se a hipoteca já não existir). */
function lpHipoteca(a){
  const pid=a[1],lid=a[2],p=prop(pid),l=findLoan(p,lid);if(!l)return;
  const opts=pode(pid,'house.edit')?[{label:'Editar hipoteca',icon:'pen',act:()=>mortModal(pid,lid)}]:[];
  const viva=Number(l.outstanding)>0&&!motivoCredito(pid);
  if(viva&&servicoLigado('transactions'))opts.push({label:'Pagamento de crédito',icon:'bank',act:()=>chamarServico('transactions','txModal',{kind:'loan',propId:pid,preset:{loanId:lid}})});
  if(viva)opts.push({label:'Amortização',icon:'trend',act:()=>amortModal(pid,lid)});
  lpExtrasDe('mort',a).forEach(o=>opts.push(o));
  if(pode(pid,'house.edit'))opts.push({label:'Apagar hipoteca',icon:'trash',act:()=>delMortFrom(pid,lid)});
  return lpShow(loanName(l),opts);
}
/* O que os Créditos acrescentam ao menu de toque longo de um imóvel
   (lista-imoveis.js:lpImovel, por servicos.js:lpExtrasDe): «Pagamento de
   crédito» e «Amortização», quando o imóvel tem hipoteca viva e posso abater
   capital (pagar crédito mexe na hipoteca, que vive na ficha do imóvel: pede
   também «Editar a ficha» — motivoCredito). Pagar abre o formulário do
   movimento, que é dos Movimentos: só com esse serviço ligado nesta conta; a
   amortização é dos Créditos e fica.
   Recebe: a — as partes do data-lp (['prop', id]).
   Devolve: um array de {label, icon, act}; vazio quando não há o que acrescentar. */
function lpExtrasCreditosImovel(a){
  const id=a[1],p=prop(id);if(!p)return [];
  if(!liveLoans(p).length||motivoCredito(id))return [];
  return (servicoLigado('transactions')?[{label:'Pagamento de crédito',icon:'bank',act:()=>chamarServico('transactions','txModal',{kind:'loan',propId:id})}]:[])
    .concat([{label:'Amortização',icon:'trend',act:()=>amortModal(id)}]);
}
registarServico({id:'credits',vistas:{credits:'vCredits'},lp:{mort:'lpHipoteca'},lpExtras:{prop:'lpExtrasCreditosImovel'}});
