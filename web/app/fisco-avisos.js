/* ================= FISCO · AVISOS =================
   O que há a tratar antes de preencher o quadro (fiscoAvisos): lê o resumo
   inteiro (resumoFiscal) e devolve os avisos, cada um com o toque que leva
   ao sítio certo. Partiu-se do fisco.js (KAN-125). Os avisos das rendas de
   cada contrato (o termo, as retenções, os meses, as antecipadas) leem as
   rendas do contrato na base, mês a mês (fiscoAvRendasDe,
   fiscoAvAnaliseDasRendas); os outros leem só o resumo. */

/* As subcategorias de Rendas que não são a renda de um mês, pelo id fixo
   (dados.js:CATS_DO_IRS): a caução, as indemnizações e as outras receitas
   prediais. Não entram nas contas dos meses nem das retenções. */
const FISCO_AV_NAO_MENSAL=['rendas/caucao','rendas/indemnizacao','rendas/outras-receitas-prediais'];

/* As rendas de um mês de um contrato, de todos os anos: as receitas que são
   renda (irs-papeis.js:ehRenda) ligadas a ele, sem a caução, as
   indemnizações e as outras receitas prediais (pelo id da subcategoria,
   dados.js:catIrsId — o nome pode mudar).
   Recebe: c — o contrato (aguenta null).
   Devolve: [movimentos], pela data. */
function fiscoAvRendasDe(c){
  const id=c&&c.id;if(!id)return [];
  const sid=t=>typeof catIrsId==='function'?catIrsId('catsIn',t.category,t.sub):'';
  return (db.transactions||[]).filter(t=>t&&t.contractId===id&&ehRenda(t)&&FISCO_AV_NAO_MENSAL.indexOf(sid(t))<0)
    .sort((a,b)=>String(a.date||'')<String(b.date||'')?-1:String(a.date||'')>String(b.date||'')?1:0);
}
/* O mês antes de outro.
   Recebe: m — 'AAAA-MM'.
   Devolve: 'AAAA-MM' do mês anterior, ou '' sem mês válido. */
function fiscoAvMesAntes(m){
  const x=/^(\d{4})-(\d{2})$/.exec(String(m||''));if(!x)return '';
  const y=Number(x[1]),n=Number(x[2]);
  return n>1?y+'-'+String(n-1).padStart(2,'0'):(y-1)+'-12';
}
/* Os meses de uma lista numa frase, como se diz: «março, abril e maio de
   2026» (o ano uma vez), «dezembro de 2025 e janeiro de 2026» (anos
   diferentes), e com mais de quatro «7 meses, de janeiro a julho de 2026».
   Recebe: ms — ['AAAA-MM'], sem repetidos.
   Devolve: o texto ('' sem meses). */
function fiscoAvMeses(ms){
  const xs=(ms||[]).filter(m=>/^\d{4}-\d{2}$/.test(m)).slice().sort();
  if(!xs.length)return '';
  const so=m=>pzMes(m).replace(/ de \d{4}$/,'');
  if(xs.length>4)return xs.length+' meses, de '+(xs[0].slice(0,4)===xs[xs.length-1].slice(0,4)?so(xs[0]):pzMes(xs[0]))+' a '+pzMes(xs[xs.length-1]);
  if(xs.every(m=>m.slice(0,4)===xs[0].slice(0,4)))return listaE(xs.map(so))+' de '+xs[0].slice(0,4);
  return listaE(xs.map(pzMes));
}
/* As retenções que estão certas numa renda (CIRS art. 101.º n.º 1 e) e f);
   art. 101.º-B n.º 1 d)), lidas da versão do ano (o bloco `retencao` do
   irs-AAAA.js: {taxa, moderada, moderadaDesde, minimo, minimoDesde}): a
   taxa geral e, numa renda de habitação que cabe nas rendas moderadas do ano
   (a mesma conta do irs.js:irsTaxaDoPeriodo), a das rendas moderadas — só
   ela a partir do dia em que vale, as duas antes, que a retenção não volta
   atrás. E o mínimo: abaixo dele o inquilino não retém (desde o dia em que
   vale). Sem o bloco na versão, a app não sabe as taxas e não as confere.
   Recebe: c — o contrato; t — a renda (o dia do pagamento decide); ano — o
   ano dos rendimentos.
   Devolve: {taxas:[%], minimo:€ (0 sem mínimo)}, ou null sem as regras. */
function fiscoAvRetencaoCerta(c,t,ano){
  const v=irsAno(ano),R=v&&v.retencao;
  if(!R||typeof R!=='object'||!(Number(R.taxa)>0))return null;
  const d=String((t&&t.date)||''),m=v.taxas&&v.taxas.rendaModerada;
  let taxas=[Number(R.taxa)];
  if(c&&Number(R.moderada)>0&&m&&fiscoDe(c).finalidade!=='nh'&&Number(ano)<=Number(m.ate)){
    const renda=irsRendaMensalDoTeste(c,ano);
    if(renda>0&&Math.round(renda*100)<=Math.round(Number(m.limiteMensal)*100))
      taxas=R.moderadaDesde&&d>=String(R.moderadaDesde)?[Number(R.moderada)]:taxas.concat([Number(R.moderada)]);
  }
  const minimo=Number(R.minimo)>0&&(!R.minimoDesde||d>=String(R.minimoDesde))?Number(R.minimo):0;
  return {taxas:taxas,minimo:minimo};
}
/* O que as rendas de um contrato dizem num ano, para os avisos de cada
   contrato — tudo pelo mês a que a renda respeita (irs.js:irsMesDaRenda) e
   renda a renda, nunca pelo total do ano (uma renda de dezembro paga em
   janeiro, ou uma atualização a meio do ano, não são um erro):
   - depoisDoTermo: as rendas do ano que caem depois do termo sem renovação
     registada, num contrato que continua (o troço `semRenovacao` do
     irs.js:irsTaxaDaRenda), e o termo;
   - dobradas: os meses do ano com rendas que somam vez e meia a renda do
     contrato ou mais — duas rendas no mesmo mês, ou uma só com o mês de antes
     (dentro do contrato) sem nenhuma. Pagamentos parciais que somam a renda
     não contam;
   - nas rendas com retenção: acima (o que entrou mais o retido passa a renda
     do contrato em mais de 1 %), retMaior (o retido é maior do que o que
     entrou) e taxa (o retido não é nenhuma das taxas certas,
     fiscoAvRetencaoCerta, com um ponto de folga; abaixo do mínimo não se
     confere). Uma renda conta só no primeiro destes; as dos meses dobrados
     não contam no acima;
   - semRetencao: há rendas no ano e nenhuma tem retenção; dispensada: todas
     ficam abaixo do mínimo da retenção (o inquilino não retém).
   Recebe: c — o contrato; ano — o ano dos rendimentos.
   Devolve: {rendas, depoisDoTermo:{n, termo, ids}|null, dobradas:[{mes, n,
   valor, falta}], acima:[{id, mes, montante, retencao}], retMaior:[…],
   taxa:[{id, mes, pct, certas:[%]}], semRetencao, dispensada} — rendas as
   do ano; falta o mês sem renda antes de um dobrado ('' quando o mês tem
   duas); os meses antes do início não se apontam como dobrados (são os das
   rendas antecipadas). */
function fiscoAvAnaliseDasRendas(c,ano){
  const A=String(ano),renda=Number(c&&c.rent)||0,rs=fiscoAvRendasDe(c);
  const doAno=rs.filter(t=>String(t.date||'').startsWith(A));
  const out={rendas:doAno.length,depoisDoTermo:null,dobradas:[],acima:[],retMaior:[],taxa:[],semRetencao:false,dispensada:false};
  if(!c||!doAno.length)return out;
  /* depois do termo, sem renovação registada: só pode haver num contrato que
     continua, e nos meses a partir do fim do primeiro período — só esses vão
     ao motor (cada chamada refaz os troços do ano) */
  const p0=irsPeriodos(c)[0],fim0=p0&&/^\d{4}-\d{2}/.test(String(p0.fim||''))?p0.fim.slice(0,7):'';
  const vive=c.active!==false&&!irsCessacao(c).data&&!!fim0;
  const tarde=(vive?doAno.filter(t=>irsMesDaRenda(t)>=fim0):[]).map(t=>({t:t,s:irsTaxaDaRenda(c,t)})).filter(x=>x.s&&x.s.semRenovacao);
  if(tarde.length)out.depoisDoTermo={n:tarde.length,termo:irsVespera(tarde[0].s.de),ids:tarde.map(x=>x.t.id)};
  /* os meses: todas as rendas do contrato, de todos os anos, para saber se o
     mês de antes tem a sua; só se apontam os meses com rendas pagas no ano */
  const porMes={};
  rs.forEach(t=>{const m=irsMesDaRenda(t);if(/^\d{4}-\d{2}$/.test(m))(porMes[m]||(porMes[m]=[])).push(t)});
  const ini=/^\d{4}-\d{2}/.test(String(c.start||''))?c.start.slice(0,7):'';
  const dobrado={};
  /* os meses antes do início são os das rendas antecipadas pagas sem o mês a
     que respeitam (fiscoAvAntecipadas) — não são meses repetidos */
  if(renda>0)Object.keys(porMes).sort().forEach(m=>{
    const ts=porMes[m];if((ini&&m<ini)||!ts.some(t=>String(t.date||'').startsWith(A)))return;
    const valor=r2(sum(ts.map(rendaBruta)));
    if(valor<renda*1.5)return;
    const ant=fiscoAvMesAntes(m);
    if(ts.length>1){out.dobradas.push({mes:m,n:ts.length,valor:valor,falta:''});dobrado[m]=1}
    else if(ini&&ant>=ini&&!porMes[ant]){out.dobradas.push({mes:m,n:1,valor:valor,falta:ant});dobrado[m]=1}
  });
  /* as retenções, renda a renda */
  doAno.forEach(t=>{
    const ret=Number(t.retencao)||0,mont=Number(t.amount)||0,bruto=ret+mont,m=irsMesDaRenda(t);
    if(!(ret>0))return;
    const x={id:t.id,mes:m,montante:mont,retencao:ret};
    if(ret>mont){out.retMaior.push(x);return}
    if(renda>0&&!dobrado[m]&&bruto>renda*1.01){out.acima.push(x);return}
    const certa=fiscoAvRetencaoCerta(c,t,ano);
    if(!certa||!(bruto>0))return;
    if(certa.minimo&&bruto*Math.min.apply(null,certa.taxas)/100<certa.minimo)return;
    const pct=ret/bruto*100;
    if(!certa.taxas.some(k=>Math.abs(pct-k)<=1))out.taxa.push({id:t.id,mes:m,pct:Math.round(pct*10)/10,certas:certa.taxas.slice()});
  });
  out.semRetencao=doAno.every(t=>!((Number(t.retencao)||0)>0));
  out.dispensada=out.semRetencao&&doAno.every(t=>{
    const certa=fiscoAvRetencaoCerta(c,t,ano);
    return !!(certa&&certa.minimo&&rendaBruta(t)*Math.min.apply(null,certa.taxas)/100<certa.minimo);
  });
  return out;
}
/* O inquilino de um contrato que devia ter retido e não se vê retenção: o
   marcado na ficha como «Retém IRS na fonte» (retem), ou com NIF de pessoa
   coletiva (irs-papeis.js:nifColetivo — um sinal, nunca o critério legal);
   nenhum dos dois quando a ficha diz «confirmei: não retém» (retemVisto).
   Recebe: l — a linha do resumo (os inquilinos dela).
   Devolve: {id, nome, porque:'retem'|'nif'} do primeiro, ou null. */
function fiscoAvQuemRetem(l){
  for(const x of (l&&l.inquilinos)||[]){
    const p=(typeof tenant==='function'&&tenant(x.id))||x;
    if(!p||p.retemVisto===true)continue;
    const nome=p.name||x.nome||'';
    if(p.retem===true)return {id:x.id,nome:nome,porque:'retem'};
    if(typeof nifColetivo==='function'&&nifColetivo(p.nif!=null?p.nif:x.nif))return {id:x.id,nome:nome,porque:'nif'};
  }
  return null;
}
/* Os contratos com rendas antecipadas (c.advance) a que faltam rendas dos
   primeiros meses, para o aviso do D56: a antecipação é renda do ano em que
   se recebe, com recibo (CIRS art. 8.º; art. 115.º n.º 5 a)), e a app nunca
   a lança — o planeado começa depois dela. Entram os contratos com linha no
   ano e os dos imóveis desta declaração (a quota de algum titular no ano,
   fisco-titulares.js:fiscoQuotaNoAno, e a permissão de ver) que começaram ou
   se celebraram no ano, já assinados; os não declarados ficam fora. Os
   meses antecipados são os primeiros do contrato; cada renda paga antes do
   início sem o mês a que respeita conta por um deles.
   Recebe: r — o resumo.
   Devolve: [{contrato, meses:['AAAA-MM'], advance}] — os meses ainda sem renda. */
function fiscoAvAntecipadas(r){
  const ano=r.ano,A=String(ano),hoje=today(),comLinha={},tits=r.titulares||[];
  (r.linhas||[]).forEach(l=>{comLinha[l.contratoId]=1});
  const daDeclaracao=c=>{
    if(comLinha[c.id])return true;
    const p=c.propertyId?prop(c.propertyId):null;if(!p||!pode(p.id,'report.view'))return false;
    return !tits.length||tits.some(o=>(typeof fiscoQuotaNoAno==='function'?fiscoQuotaNoAno(p,o,ano):1)>0);
  };
  const out=[];
  (db.contracts||[]).forEach(c=>{
    const n=Math.max(0,Math.min(36,Math.round(Number(c&&c.advance)||0)));
    if(!n||!/^\d{4}-\d{2}-\d{2}$/.test(String(c.start||''))||ctNaoDeclarado(c))return;
    const cel=/^\d{4}-\d{2}-\d{2}$/.test(String(fiscoDe(c).celebracao||''))?fiscoDe(c).celebracao:'';
    if((cel||c.start)>hoje)return;
    if(c.start.slice(0,4)!==A&&cel.slice(0,4)!==A)return;
    if(!daDeclaracao(c))return;
    const meses=[];let m=c.start.slice(0,7);
    for(let i=0;i<n;i++){meses.push(m);const y=Number(m.slice(0,4)),k=Number(m.slice(5,7));m=k<12?y+'-'+String(k+1).padStart(2,'0'):(y+1)+'-01'}
    const rs=fiscoAvRendasDe(c),tem={};let antes=0;
    rs.forEach(t=>{const x=irsMesDaRenda(t);tem[x]=1;if(x&&x<c.start.slice(0,7))antes++});
    const faltam=meses.filter(x=>!tem[x]).slice(antes);
    if(faltam.length)out.push({contrato:c,meses:faltam,advance:n});
  });
  return out;
}

/* O que há a tratar antes de preencher o quadro, cada ponto com o nível e o
   toque que abre a ficha onde se trata (com esse serviço desligado o aviso
   fica, sem o toque). Um contrato conta uma vez, mesmo com uma linha por
   titular. Pela ordem: o ano sem versão própria das regras (irs.js:irsAno,
   o `exato`) — depois da última, âmbar; antes da primeira, vermelho, e os
   números não servem para esse ano (D50) —, a versão provisória (cinzento)
   e os valores por inteiro sem sessão; os contratos por indicar, sem o n.º,
   sem a data de início (D43), sem finalidade (a 07 assumida, D16) e com
   rendas depois do termo sem renovação registada (D15); os inquilinos sem
   NIF nem país; os imóveis sem os dados matriciais ou com mais do que uma
   fração no campo (D69); o Modelo 44 ou as rendas sem recibo; o selo do
   contrato que começou no ano; as rendas sem contrato, com o valor —
   declaram-se na mesma (D34); a taxa escrita que não é a da lei do ano
   (D17); por contrato (fiscoAvAnaliseDasRendas), as retenções que não batem
   com a renda (D23), o inquilino que devia reter e o ano sem retenção (D58),
   os meses com duas rendas (D88) e as antecipadas por lançar (D56,
   fiscoAvAntecipadas), sempre «confirma no recibo»; as despesas «a
   confirmar», por categoria, com o nome e o valor (D06, D07, D24–D27, D60,
   D61); as pagas sem contrato em vigor e as obras dos 24 meses soltas; e no
   fim, sem toque, os não declarados (uma escolha, não uma falta).
   Recebe: r — o resumo inteiro (resumoFiscal), menos os avisos: ano,
   titulares, linhas (faltas, naturezaAssumida, taxa, taxaEscrita,
   inquilinos…), fora, semContrato, aConfirmar ([{txId, nome, valor,
   categoria, sub, origem…}]; sem ele, o número semRegra), obrasSoltas,
   foraDoPeriodo e semSessao. O que falte lê-se como vazio.
   Devolve: [{texto, abrir, toca, nivel}] — abrir o código do onclick (''
   sem ação); toca 'camada' (abre uma ficha) ou 'ecra' (muda de ecrã); nivel
   'falta' (o que a AT pede e não está, ou números que não servem), 'aviso'
   (o que convém tratar antes de entregar) ou 'info' (o que só se diz). */
function fiscoAvisos(r){
  const ano=r.ano,A=String(ano),F=r.fora||[],S=r.semContrato||[],obrasSoltas=r.obrasSoltas,foraDoPeriodo=r.foraDoPeriodo,semSessao=r.semSessao;
  let L=r.linhas||[];
  const out=[],add=(texto,abrir,toca,nivel)=>out.push({texto:texto,abrir:abrir||'',toca:toca||'',nivel:nivel||'aviso'});
  /* o toque só se o serviço que ele abre está ligado; senão [abrir, toca] vazios */
  const se=(id,abrir,toca)=>servicoLigado(id)?[abrir,toca]:['',''];
  const v=irsAno(ano);
  if(!v.exato){
    if(v.pedido>v.ano)add('Ainda não há versão das regras de '+ano+'. Usam-se as de '+v.ano+', a mais recente, com as datas passadas para '+ano+' — as taxas e os quadros podem ter mudado.','','','aviso');
    else add('A app não tem as regras de '+ano+': as taxas, os quadros e os códigos desse ano podem ser outros. Não uses estes números para a declaração desse ano.','','','falta');
  }
  else if(v.modelo&&!v.modelo.oficial&&v.modelo.texto)add(v.modelo.texto,'','','info');
  if(semSessao)add('Sem sessão não se sabe qual dos proprietários és: os valores vão por inteiro, de todos, e não pela tua quota-parte. O Anexo F é por titular.','','','aviso');
  /* os avisos de um contrato contam-no uma vez: em conjunta, um imóvel dos
     dois tem uma linha por titular */
  const visto={};L=L.filter(l=>!visto[l.contratoId]&&(visto[l.contratoId]=1));
  const falta=(l,re)=>(l.faltas||[]).some(x=>re.test(x));
  const umCt=ls=>ls.length===1?se('contracts',`ctView('${jsq(ls[0].contratoId)}')`,'camada'):se('contracts',"go('contracts')",'ecra');
  const verCt=id=>se('contracts',`ctView('${jsq(id)}')`,'camada');
  const porIndicar=L.filter(l=>!l.estado);
  if(porIndicar.length)add(porIndicar.length===1?'Contrato '+porIndicar[0].nome+': por indicar se foi declarado à AT'
    :porIndicar.length+' contratos com rendas em '+ano+' por indicar se foram declarados à AT',...umCt(porIndicar),'falta');
  const semNum=L.filter(l=>l.estado==='declarado'&&!l.atNumero);
  if(semNum.length)add(semNum.length===1?'Contrato '+semNum[0].nome+': declarado à AT, sem o n.º do contrato'
    :semNum.length+' contratos declarados à AT sem o n.º do contrato',...umCt(semNum),'falta');
  /* sem início: o Anexo F pede a data, e sem ela nenhum gasto do imóvel cai
     no período arrendado (fisco-resumo.js:fiscoHaviaContrato) */
  const semInicio=L.filter(l=>!l.inicio||falta(l,/^data de início/));
  if(semInicio.length)add((semInicio.length===1?'Contrato '+semInicio[0].nome+': sem a data de início'
    :semInicio.length+' contratos sem a data de início')+', que o Anexo F pede — sem ela, os gastos do ano ficam de fora',...umCt(semInicio),'falta');
  /* sem finalidade a app assume habitação (07), em todas as linhas */
  const semFin=L.filter(l=>l.naturezaAssumida===true||falta(l,/^finalidade/));
  if(semFin.length){
    const nat=v.naturezas||{},hab=nat.habitacional?' (natureza '+nat.habitacional+')':'';
    add((semFin.length===1?'Contrato '+semFin[0].nome+': sem finalidade, a app assume habitação'+hab+'. Diz se é habitação permanente, não permanente ou não habitacional'
      :semFin.length+' contratos sem finalidade: a app assume habitação'+hab+'. Diz em cada um se é habitação permanente, não permanente ou não habitacional')
      +' — a natureza, a taxa e a redução pela duração dependem dela',...umCt(semFin),'falta');
  }
  /* as rendas depois do termo, sem renovação registada: o contrato renovou-se
     sozinho (Código Civil art. 1096.º) ou as datas estão erradas; até lá
     essas rendas vão sem a redução do período que acabou (D15) */
  const analise={};
  L.forEach(l=>{const c=contract(l.contratoId);analise[l.contratoId]=c?fiscoAvAnaliseDasRendas(c,ano):null});
  L.forEach(l=>{
    const x=analise[l.contratoId],d=x&&x.depoisDoTermo;if(!d)return;
    add('Contrato '+l.nome+': '+fiscoN(d.n,'renda','rendas')+' de '+ano+' depois do termo ('+dPT(d.termo)+') — renovou-se? Usa o «Renovar…» do contrato, ou corrige as datas. Até lá, '
      +(d.n===1?'essa renda vai':'essas rendas vão')+' sem a redução do período que acabou',...verCt(l.contratoId),'falta');
  });
  const vistos={};
  L.forEach(l=>(l.inquilinos||[]).forEach(t=>{
    if(vistos[t.id])return;vistos[t.id]=1;
    const ok=nifValido(t.nif);
    if(ok===false)add('Inquilino '+t.nome+': o NIF não bate certo',...se('tenants',`personView('tenant','${jsq(t.id)}')`,'camada'),'falta');
    else if(ok===null&&!String(t.pais||'').trim())add('Inquilino '+t.nome+': sem NIF nem país de residência',...se('tenants',`personView('tenant','${jsq(t.id)}')`,'camada'),'falta');
  }));
  const imv={},frac={};
  L.forEach(l=>{
    if(!l.propertyId||imv[l.propertyId])return;imv[l.propertyId]=1;
    const fal=[!l.freguesiaCodigo?'código da freguesia':'',!l.tipoPredio?'tipo de prédio':'',!l.artigo?'artigo matricial':''].filter(Boolean);
    if(fal.length)add('Imóvel '+l.imovel+': sem '+listaE(fal),...se('properties',`propView('${jsq(l.propertyId)}')`,'camada'),'falta');
  });
  /* mais do que uma fração no mesmo campo: a app ainda não as separa (Q3) */
  L.forEach(l=>{
    if(!l.propertyId||frac[l.propertyId]||!falta(l,/^fração/))return;frac[l.propertyId]=1;
    add('Imóvel '+l.imovel+': o campo da fração tem mais do que uma («'+String(l.fracao||'').trim()+'»). No Anexo F cada fração vai numa linha, com a parte da renda que lhe cabe; a app faz uma linha por contrato, por isso divide-a por fração ao preencher',
      ...se('properties',`propView('${jsq(l.propertyId)}')`,'camada'),'falta');
  });
  /* quem está dispensado dos recibos eletrónicos não tem recibos em falta: tem
     o Modelo 44, a declaração anual das rendas (CIRS art. 115.º) */
  const dispensa=fiscoIrsDefs().dispensaRecibos;
  if(dispensa&&L.length)add('Modelo 44: tens dispensa dos recibos eletrónicos — entrega a declaração anual das rendas de '+ano+' até '+dPT(fiscoPrazoModelo44(ano))+', no Portal das Finanças','','','info');
  const comRecibos=dispensa?[]:L.filter(l=>l.recibosPorEmitir>0),nRec=sum(comRecibos.map(l=>l.recibosPorEmitir));
  if(nRec)add(fiscoN(nRec,'renda','rendas')+' de '+ano+' sem recibo eletrónico emitido',
    ...(comRecibos.length===1?umCt(comRecibos):se('transactions',"go('transactions')",'ecra')));
  /* o selo do contrato (10 % de uma renda, pago com o Modelo 2) é dedutível e
     esquece-se: só se o contrato começou no ano e o prazo do Modelo 2 ainda
     caía nele — senão o selo pode ter sido pago no ano seguinte, com razão */
  const semSelo=L.filter(l=>l.estado==='declarado'&&String(l.inicio||'').slice(0,4)===A&&fimDoMesSeguinte(l.inicio).slice(0,4)===A&&!(l.gastos&&l.gastos.selo>0));
  if(semSelo.length)add((semSelo.length===1?'Contrato '+semSelo[0].nome+': começou em '+ano+' e não há imposto do selo nos gastos'
    :semSelo.length+' contratos começaram em '+ano+' sem imposto do selo nos gastos')+' — o que se paga com o Modelo 2 (10 % de uma renda) é dedutível: adiciona-o como despesa, em Impostos › Imposto do selo',
    ...se('transactions',"go('transactions')",'ecra'));
  /* as rendas sem contrato são rendimento na mesma (CIRS art. 8.º): não estão
     em linha nenhuma do quadro, e é uma falta (D34) */
  const nSem=sum(S.map(s=>s.n||0)),vSem=sum(S.map(s=>Number(s.rendas)||0));
  if(nSem)add(fiscoN(nSem,'renda','rendas')+' de '+ano+' sem contrato ligado ('+euroS(vSem)+') '+(nSem===1?'não está':'não estão')+' em nenhuma linha do quadro, mas '
    +(nSem===1?'declara-se na mesma: liga-a':'declaram-se na mesma: liga-as')+' ao contrato',
    ...(nSem===1&&S[0].ids&&S[0].ids[0]?se('transactions',`txView('${jsq(S[0].ids[0])}')`,'camada'):se('transactions',"go('transactions')",'ecra')),'falta');
  /* a taxa escrita no contrato não manda na Declaração: aqui é sempre a da
     lei do ano (Q9/D17). O resumo dá a escrita em taxaEscrita (o número); um
     resumo antigo dava só true, e então a da lei sai do irs.js:irsTaxa */
  const escritas=[];
  L.forEach(l=>{
    if(l.isencao)return;
    const c=contract(l.contratoId);let e=null,lei=null;
    if(typeof l.taxaEscrita==='number'){e=l.taxaEscrita;lei=Number(l.taxa)}
    else if(l.taxaEscrita===true&&c){e=Number(c.taxRate)||null;lei=irsTaxa(c,ano).taxa}
    if(e!=null&&lei!=null&&isFinite(lei)&&Math.abs(e-lei)>1e-9)escritas.push({l:l,e:e,lei:lei,porque:c?irsTaxaPorque(c,ano):''});
  });
  if(escritas.length){
    const x=escritas[0];
    add((escritas.length===1?'Contrato '+x.l.nome+': tem '+dec(x.e)+' % escrito no contrato, mas pelas regras de '+ano+' a taxa é '+dec(x.lei)+' %'+(x.porque?' ('+x.porque+')':'')
      :escritas.length+' contratos têm escrita uma taxa que não é a das regras de '+ano+': '+listaE(escritas.map(y=>y.l.nome+' ('+dec(y.e)+' %, a lei dá '+dec(y.lei)+' %)')))
      +'. A Declaração usa a da lei; a escrita fica só para a renda líquida',...umCt(escritas.map(y=>y.l)),'aviso');
  }
  /* as retenções de cada contrato, renda a renda (D23): a app não sabe o que
     o inquilino reteve — o recibo sabe */
  const toqueRendas=ids=>ids.length===1?se('transactions',`txView('${jsq(ids[0])}')`,'camada'):se('transactions',"go('transactions')",'ecra');
  const meses=xs=>{const u={};xs.forEach(y=>{u[y.mes]=1});return Object.keys(u)};
  L.forEach(l=>{
    const x=analise[l.contratoId];if(!x)return;
    const c=contract(l.contratoId),renda=Number(c&&c.rent)||0,ids=xs=>xs.map(y=>y.id);
    const nas=xs=>{const ms=meses(xs);return (ms.length===1?'na renda de ':'nas rendas de ')+fiscoAvMeses(ms)};
    if(x.retMaior.length)add('Contrato '+l.nome+': '+nas(x.retMaior)+', o retido é maior do que o que entrou. Confirma no recibo o que entrou e o que o inquilino reteve',
      ...toqueRendas(ids(x.retMaior)),'aviso');
    if(x.acima.length)add('Contrato '+l.nome+': '+nas(x.acima)+', o que entrou mais o retido passa a renda do contrato ('+euroS(renda)+'). Confirma no recibo: a renda ilíquida é a do recibo, e o que entrou é ela menos o retido. Se a renda subiu, atualiza-a no contrato',
      ...toqueRendas(ids(x.acima)),'aviso');
    if(x.taxa.length){
      const pcts=[],ks=[];
      x.taxa.forEach(y=>{if(pcts.indexOf(y.pct)<0)pcts.push(y.pct);(y.certas||[]).forEach(k=>{if(ks.indexOf(k)<0)ks.push(k)})});
      ks.sort((a,b)=>b-a);
      add('Contrato '+l.nome+': '+nas(x.taxa)+', o retido é '+listaE(pcts.map(p=>dec(p)+' %'))+' da renda, e não '+ks.map(k=>dec(k)+' %').join(' nem ')+'. Confirma no recibo o que o inquilino reteve',
        ...toqueRendas(ids(x.taxa)),'aviso');
    }
  });
  /* o inquilino que devia reter e o ano sem retenção (D58): um sinal, não o
     critério legal — há a dispensa do art. 101.º-B, e abaixo do mínimo não
     se retém; cala-se com o «confirmei: não retém» da ficha (retemVisto) */
  L.forEach(l=>{
    const x=analise[l.contratoId];if(!x||!x.rendas||!x.semRetencao||x.dispensada||l.isencao)return;
    const q=fiscoAvQuemRetem(l);if(!q)return;
    const c=contract(l.contratoId),R=v.retencao&&Number(v.retencao.taxa)>0?v.retencao:null,m=v.taxas&&v.taxas.rendaModerada;
    const hab=c&&fiscoDe(c).finalidade!=='nh',mod=R&&Number(R.moderada)>0&&m&&hab&&ano<=Number(m.ate);
    const taxas=R?' retém '+dec(R.taxa)+' %'+(mod?' ('+dec(R.moderada)+' % nas rendas de habitação até '+euro(m.limiteMensal)+')':''):' retém IRS na fonte';
    add('Contrato '+l.nome+': '+(q.porque==='retem'?'na ficha, o inquilino '+q.nome+' retém IRS':'o inquilino '+q.nome+' tem NIF de empresa ou de outra entidade')
      +', e as rendas de '+ano+' não têm retenção. Confirma no recibo se reteve: uma empresa com contabilidade organizada'+taxas
      +', e o retido soma-se à renda ilíquida e vai às Retenções na fonte. Se pediste a dispensa, o recibo diz «Sem retenção»',
      ...se('tenants',`personView('tenant','${jsq(q.id)}')`,'camada'),'aviso');
  });
  /* os meses repetidos ou com o anterior vazio (D88): a renda de outro ano
     vai ao quadro 8, e só se sabe pelo mês a que respeita */
  L.forEach(l=>{
    const x=analise[l.contratoId];if(!x||!x.dobradas.length)return;
    const ds=x.dobradas.map(d=>d.falta?pzMes(d.falta)+' sem renda e '+pzMes(d.mes)+' com '+euroS(d.valor)
      :pzMes(d.mes)+' com '+d.n+' rendas ('+euroS(d.valor)+')');
    add('Contrato '+l.nome+': '+listaE(ds)+' — confirma a que mês respeita cada renda: a de um ano anterior vai ao quadro 8',
      ...se('transactions',"go('transactions')",'ecra'),'aviso');
  });
  /* as rendas antecipadas por lançar (D56) */
  fiscoAvAntecipadas(r).forEach(x=>{
    const um=x.meses.length===1;
    add('Contrato '+ctName(x.contrato)+': tem '+fiscoN(x.advance,'renda antecipada','rendas antecipadas')+' e não há renda de '+fiscoAvMeses(x.meses)
      +(um?'. Se a recebeste à cabeça, adiciona-a com o dia em que entrou: declara-se no ano em que a recebeste, com recibo'
        :'. Se as recebeste à cabeça, adiciona-as com o dia em que entraram: declaram-se no ano em que as recebeste, com recibo'),
      ...verCt(x.contrato.id),'aviso');
  });
  /* as despesas «a confirmar» não contam em coluna nenhuma até a pessoa
     escolher: uma por categoria, com o nome e o valor de cada despesa */
  if(Array.isArray(r.aConfirmar)){
    const grupos={},ordem=[];
    r.aConfirmar.forEach(d=>{const k=String(d.categoria||'').trim()||'Sem categoria';if(!grupos[k]){grupos[k]=[];ordem.push(k)}grupos[k].push(d)});
    const notas=typeof IRS_MAPA_NOTAS==='object'&&IRS_MAPA_NOTAS?IRS_MAPA_NOTAS:{};
    ordem.forEach(k=>{
      const ds=grupos[k],n=ds.length,tot=sum(ds.map(d=>Number(d.valor)||0));
      const semRegra=ds.every(d=>d.origem==='omissao');
      const nome=d=>(String(d.nome||'').trim()||'Despesa')+', '+euroS(Number(d.valor)||0);
      const resto=ds.slice(5),lista=ds.slice(0,5).map(nome).join('; ')+(resto.length?'; e mais '+resto.length+', '+euroS(sum(resto.map(d=>Number(d.valor)||0))):'');
      const subs={},ns=[];
      ds.forEach(d=>{const s=String(d.sub||'').trim(),nt=s&&notas[k+' / '+s];if(nt&&!subs[s]){subs[s]=1;ns.push(s+': '+nt.charAt(0).toLowerCase()+nt.slice(1))}});
      add(k+': '+fiscoN(n,'despesa','despesas')+' de '+ano+(semRegra?' sem regra de dedução':' a confirmar')+(n===1?' não conta':' ('+euroS(tot)+') não contam')+' nos gastos — '+lista
        +'. Escolhe na ficha '+(n===1?'dela':'de cada uma')+' a coluna do Anexo F (ou Não dedutível), ou a regra da categoria em Definições → Categorias, etiquetas e IRS'
        +(ns.length?'. '+ns.join(' ').replace(/\.?$/,''):''),
        ...(n===1&&ds[0].txId?se('transactions',`txView('${jsq(ds[0].txId)}')`,'camada'):se('transactions',"go('transactions')",'ecra')),'aviso');
    });
  }
  else if(r.semRegra)add(fiscoN(r.semRegra,'despesa sem regra de dedução','despesas sem regra de dedução')+' de '+ano+': escolhe a coluna do Anexo F nas Definições → Categorias, etiquetas e IRS',
    "go('settings');goSet('irs')",'ecra');
  if(foraDoPeriodo)add(fiscoN(foraDoPeriodo,'despesa paga','despesas pagas')+' em '+ano+' com o imóvel sem contrato em vigor '+(foraDoPeriodo===1?'fica':'ficam')+' fora: só conta o período arrendado. Se é deste período, corrige as datas do contrato ou escolhe a coluna na ficha da despesa',
    ...se('transactions',"go('transactions')",'ecra'));
  if(obrasSoltas)add(fiscoN(obrasSoltas,'despesa marcada como obras dos 24 meses','despesas marcadas como obras dos 24 meses')+' de '+ano+' sem contrato a começar depois: '+(obrasSoltas===1?'fica':'ficam')+' fora até o haver',
    ...se('transactions',"go('transactions')",'ecra'));
  if(F.length)add(fiscoN(F.length,'contrato marcado como não declarado fica','contratos marcados como não declarados ficam')+' fora deste resumo.','','','info');
  return out;
}
