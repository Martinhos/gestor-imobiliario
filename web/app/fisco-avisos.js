/* ================= FISCO · AVISOS =================
   O que há a tratar antes de preencher o quadro (fiscoAvisos): lê o resumo
   inteiro (resumoFiscal) e devolve os avisos, cada um com o toque que leva
   ao sítio certo. Partiu-se do fisco.js (KAN-125). Os avisos das rendas de
   cada contrato (o termo, as retenções, os meses, as antecipadas) leem as
   rendas do contrato na base, mês a mês (fiscoAvRendasDe,
   fiscoAvAnaliseDasRendas); os outros leem só o resumo. */

/* As rendas de um mês de um contrato, de todos os anos: as receitas ligadas
   a ele que são a renda de um mês, pelo papel — como o resumo
   (fisco-resumo.js:fiscoRendaDoMes, irs-papeis.js:irsReceitaDe, pelo id das
   categorias e não pelo nome): sem a caução, as indemnizações, as outras
   receitas prediais nem os reembolsos do inquilino; e com as rendas que
   estão «Fora dos totais» ou numa categoria Rendas renomeada, que continuam
   a declarar-se (D19).
   Recebe: c — o contrato (aguenta null).
   Devolve: [movimentos], pela data. */
function fiscoAvRendasDe(c){
  const id=c&&c.id;if(!id)return [];
  return (db.transactions||[]).filter(t=>t&&t.contractId===id&&t.kind==='income'&&fiscoRendaDoMes(t))
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
  const A=String(r.ano),hoje=today(),daDeclaracao=fiscoAvDaDeclaracao(r);
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
/* Os contratos que contam para a declaração de um ano, mesmo sem linha nele:
   os que têm linha, e os dos imóveis desta declaração — a quota de algum
   titular no ano (fisco-titulares.js:fiscoQuotaNoAno) e a permissão de ver.
   Recebe: r — o resumo (ano, titulares, linhas).
   Devolve: uma função c → true|false. */
function fiscoAvDaDeclaracao(r){
  const ano=r.ano,comLinha={},tits=r.titulares||[];
  (r.linhas||[]).forEach(l=>{comLinha[l.contratoId]=1});
  return c=>{
    if(!c)return false;
    if(comLinha[c.id])return true;
    const p=c.propertyId?prop(c.propertyId):null;if(!p||!pode(p.id,'report.view'))return false;
    return !tits.length||tits.some(o=>(typeof fiscoQuotaNoAno==='function'?fiscoQuotaNoAno(p,o,ano):1)>0);
  };
}
/* O mês a seguir a outro.
   Recebe: m — 'AAAA-MM'.
   Devolve: 'AAAA-MM' do mês seguinte, ou '' sem mês válido. */
function fiscoAvMesDepois(m){
  const x=/^(\d{4})-(\d{2})$/.exec(String(m||''));if(!x)return '';
  const y=Number(x[1]),n=Number(x[2]);
  return n<12?y+'-'+String(n+1).padStart(2,'0'):(y+1)+'-01';
}
/* Os meses de um ano em que um contrato esteve em vigor e quantos deles têm
   renda registada, pelo mês a que ela respeita (irs.js:irsMesDaRenda) e não
   pelo dia em que entrou (D04): de o mais tarde de o início, a compra do
   imóvel e 1 de janeiro, a o mais cedo de o fim real (irs.js:irsFimReal),
   hoje e 31 de dezembro. Lê-os da linha do resumo (mesesEmVigor,
   mesesComRenda — números, ou listas de meses) quando ela os tem; com o
   mesesEmVigor null o resumo não sabe (terminado sem data, sem início) e
   não se aponta nada; sem os campos, conta-os da base, pela mesma regra.
   Recebe: c — o contrato; ano — o ano dos rendimentos; l (opcional) — a
   linha do resumo.
   Devolve: {emVigor, comRenda} — números ≥ 0. */
function fiscoAvCobertura(c,ano,l){
  const n=x=>Array.isArray(x)?x.length:typeof x==='number'&&isFinite(x)&&x>=0?x:null;
  const ev=l?n(l.mesesEmVigor):null,cr=l?n(l.mesesComRenda):null;
  if(ev!=null&&cr!=null)return {emVigor:ev,comRenda:cr};
  if(l&&l.mesesEmVigor===null)return {emVigor:0,comRenda:0};
  const A=String(ano),out={emVigor:0,comRenda:0},data=x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x||''))?String(x):'';
  if(!c||!data(c.start))return out;
  const p=c.propertyId?prop(c.propertyId):null;
  const de=[c.start,data(p&&p.purchaseDate),A+'-01-01'].filter(Boolean).sort().pop();
  const ate=[data(irsFimReal(c))||A+'-12-31',today(),A+'-12-31'].sort()[0];
  if(ate<de)return out;
  const tem={};fiscoAvRendasDe(c).forEach(t=>{tem[irsMesDaRenda(t)]=1});
  for(let m=de.slice(0,7);m&&m<=ate.slice(0,7);m=fiscoAvMesDepois(m)){out.emVigor++;if(tem[m])out.comRenda++}
  return out;
}
/* Os contratos terminados sem o dia em que acabaram (D02): os terminados à
   moda antiga (active:false sem fisco.cessacao.data), que a app conta em
   vigor até ao c.end que lá ficou — o termo, às vezes ainda por chegar (e
   então os gastos da casa vazia contam e o prazo da cessação não chega), ou
   o dia em que se carregou no «Terminar», num contrato sem termo. Entram os
   que podem pesar no ano: com linha nele, ou com o fim escrito nele ou
   depois, começados até 31 de dezembro, dos imóveis desta declaração
   (fiscoAvDaDeclaracao); os não declarados ficam fora.
   Recebe: r — o resumo.
   Devolve: [{contrato, fim, futuro}] — fim o c.end ('' sem ele), futuro se
   ele ainda não chegou. */
function fiscoAvSemCessacao(r){
  const A=String(r.ano),ini=A+'-01-01',fimAno=A+'-12-31',hoje=today(),daDecl=fiscoAvDaDeclaracao(r),comLinha={};
  (r.linhas||[]).forEach(l=>{comLinha[l.contratoId]=1});
  return (db.contracts||[]).filter(c=>{
    if(!c||c.active!==false||irsCessacao(c).data||ctNaoDeclarado(c))return false;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(c.start||''))||c.start>fimAno)return false;
    const fim=/^\d{4}-\d{2}-\d{2}$/.test(String(c.end||''))?c.end:'';
    if(fim?fim<ini:!comLinha[c.id])return false;
    return daDecl(c);
  }).map(c=>({contrato:c,fim:/^\d{4}-\d{2}-\d{2}$/.test(String(c.end||''))?c.end:'',futuro:!!c.end&&c.end>hoje}));
}
/* O imposto do selo do contrato já está nos gastos de um ano (D27): uma
   despesa do ano que vai à coluna do selo (irs-papeis.js:irsColunaDe) no
   imóvel do contrato, paga no dia da celebração ou depois — o selo é do
   Modelo 2, que só existe depois de o contrato se celebrar; um selo de antes
   é outro (o da compra do imóvel, o de um crédito). Sem a data da
   celebração, conta desde 60 dias antes do início (assina-se antes de
   começar). Sem nenhuma despesa do selo na base (um resumo feito sem ela),
   vale o que a linha diz (l.gastos.selo).
   Recebe: c — o contrato; l — a linha do resumo; ano — o ano dos rendimentos.
   Devolve: {pago, antes} — pago se há o selo do contrato; antes o dia do
   último selo de antes da celebração ('' sem ele). */
function fiscoAvSeloDoContrato(c,l,ano){
  const A=String(ano),pid=(c&&c.propertyId)||(l&&l.propertyId)||'',f=fiscoDe(c);
  const ini=String((c&&c.start)||(l&&l.inicio)||'');
  const cel=/^\d{4}-\d{2}-\d{2}$/.test(String(f.celebracao||''))?String(f.celebracao):ini?irsSomaDias(ini,-60):'';
  const selos=(db.transactions||[]).filter(t=>t&&t.kind==='expense'&&String(t.date||'').startsWith(A)
    &&(irsColunaDe(t)||{}).col==='selo'&&(typeof txWeight==='function'?txWeight(t,pid,false)>0:t.propertyId===pid));
  if(!selos.length)return {pago:!!(l&&l.gastos&&l.gastos.selo>0),antes:''};
  const antes=selos.filter(t=>cel&&String(t.date)<cel).map(t=>String(t.date)).sort();
  return {pago:selos.some(t=>!cel||String(t.date)>=cel),antes:antes.length?antes[antes.length-1]:''};
}
/* Um contrato anterior ao RAU (Regime do Arrendamento Urbano, em vigor desde
   18 de novembro de 1990), o que recebe a compensação do IHRU por não
   transitar para o NRAU: o contrato da receita ou, sem ele, algum contrato do
   imóvel, celebrado (fisco.celebracao) ou começado antes desse dia, ou com a
   isenção da renda antiga (6H, 'prerau').
   Recebe: contratoId — o id do contrato (ou vazio); propertyId — o do imóvel
   (ou vazio).
   Devolve: true ou false. */
function fiscoAvAntesDoRau(contratoId,propertyId){
  const antigo=c=>{
    if(!c)return false;
    const f=fiscoDe(c),d=[f.celebracao,c.start].filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x||''))).sort()[0]||'';
    return (!!d&&d<'1990-11-18')||f.isencao==='prerau';
  };
  if(contratoId)return antigo(contract(contratoId));
  return !!propertyId&&(db.contracts||[]).some(c=>c&&c.propertyId===propertyId&&antigo(c));
}
/* Um imóvel que conta por inteiro para um dono só, sem estar confirmado que
   não há outros fora da app (D08): em algum dia do ano em que as quotas podem
   mudar (fisco-titulares.js:fiscoDiasDasQuotas), só uma conta tem quota
   (saldos.js:quotasFiscais) e os comproprietários sem conta estão por
   confirmar (saldos.js:quotasForaConfirmados — o comproprietariosFora null).
   Com o «Não, mais ninguém» ou com os de fora escritos, não.
   Recebe: p — o imóvel (aguenta null); ano — o ano dos rendimentos.
   Devolve: true ou false. */
function fiscoAvSoDeUmDono(p,ano){
  if(!p)return false;
  return fiscoDiasDasQuotas(p,ano).some(d=>{
    if(quotasForaConfirmados(p,d))return false;
    const q=quotasFiscais(p,d);
    return Object.keys(q).filter(o=>q[o]>0).length===1;
  });
}

/* ---- Os avisos da ronda 2 (vaga 4, KAN-129): cada função devolve os avisos
   de um tema, na forma do fiscoAvisos, e lê o resumo pela forma da 1.7 do
   plano, com cuidado (um campo que falte é vazio). ---- */

/* O toque de um aviso: o código da ação e onde abre, só se o serviço que ela
   abre está ligado (o mesmo que o se() do fiscoAvisos).
   Recebe: servico — o id do serviço; abrir — o código da ação; toca —
   'camada' ou 'ecra'.
   Devolve: {abrir, toca} — vazios com o serviço desligado. */
function fiscoAvToque(servico,abrir,toca){return servicoLigado(servico)?{abrir:abrir,toca:toca}:{abrir:'',toca:''}}
/* Um aviso, na forma que o fiscoAvisos devolve.
   Recebe: texto — a frase; t — o toque (fiscoAvToque) ou null; nivel —
   'falta', 'aviso' ou 'info'.
   Devolve: {texto, abrir, toca, nivel}. */
function fiscoAvNovo(texto,t,nivel){return {texto:texto,abrir:(t&&t.abrir)||'',toca:(t&&t.toca)||'',nivel:nivel||'aviso'}}
/* Uma lista agrupada pelo contrato, pela ordem em que cada um aparece.
   Recebe: xs — [{contratoId, …}].
   Devolve: [[entradas de um contrato], …]. */
function fiscoAvPorContrato(xs){
  const por={},ordem=[];
  (xs||[]).forEach(x=>{if(!x||!x.contratoId)return;if(!por[x.contratoId]){por[x.contratoId]=[];ordem.push(x.contratoId)}por[x.contratoId].push(x)});
  return ordem.map(id=>por[id]);
}
/* Os avisos de um direito real de habitação duradoura (DHD, quadro 4.3 —
   D120), das linhas das rendas que o resumo marca com l.dhd:
   - sem o valor da caução, que o 4.3 pede (a falta 'valor da caução do
     direito real…' do resumo): falta, com o «Responder» no campo da caução;
   - acabou no ano sem o motivo da cessação, que a coluna da cessação do 4.3
     pede (l.dhd.cessacao sem motivo): falta;
   - acabou no ano com caução (l.dhd.cessacao, l.dhd.caucao): a parte da
     caução que o proprietário fica por incumprimento do morador é rendimento
     desse ano (CIRS art. 8.º n.º 5 b)), com a natureza «dedução à caução» do
     4.3 (quadro43.naturezas.deducaoCaucao, '03'). A app não sabe que parte
     ficou: declara-se à mão (decisão do Martinho de 2026-11-18);
   - a caução recebida no ano (l.dhd.caucaoRecebida) não é rendimento — só a
     prestação anual do 11.º ano em diante, que o resumo conta: só se diz.
   Recebe: r — o resumo; L — as linhas das rendas, uma por contrato.
   Devolve: [{texto, abrir, toca, nivel}]. */
function fiscoAvDhd(r,L){
  const v=irsAno(r.ano),Q=v.quadros||{},Q43=v.quadro43||{},out=[];
  const q43=Q.dhd?'o quadro '+Q.dhd:'o quadro do direito real de habitação duradoura';
  const nat=(Q43.naturezas||{}).deducaoCaucao||'',natTx=nat?String((Q43.naturezasTexto||{})[nat]||''):'';
  (L||[]).forEach(l=>{
    const d=l&&l.dhd;if(!d||typeof d!=='object')return;
    const id=l.contratoId,ct=fiscoAvToque('contracts',`ctView('${jsq(id)}')`,'camada');
    if((l.faltas||[]).some(x=>/^valor da caução do direito real/.test(String(x))))
      out.push(fiscoAvNovo('Contrato '+l.nome+': direito real de habitação duradoura sem o valor da caução, que '+q43+' pede — o da escritura. Escreve-o no contrato, em Caução',
        fiscoAvToque('contracts',`ctIrParaPergunta('${jsq(id)}','c_dep')`,'camada'),'falta'));
    const cx=d.cessacao&&typeof d.cessacao==='object'&&/^\d{4}-\d{2}-\d{2}$/.test(String(d.cessacao.data||''))?d.cessacao:null;
    if(cx&&!String(cx.motivo||'').trim())out.push(fiscoAvNovo('Contrato '+l.nome+': o direito real de habitação duradoura acabou a '+dPT(cx.data)
      +' sem o motivo da cessação, que '+q43+' pede. Escolhe-o no contrato',ct,'falta'));
    if(cx&&Number(d.caucao)>0)out.push(fiscoAvNovo('Contrato '+l.nome+': o direito real de habitação duradoura acabou a '+dPT(cx.data)
      +'. Se ficaste com parte da caução ('+euroS(Number(d.caucao))+') por incumprimento do morador, essa parte é rendimento de '+r.ano+' e declara-se à mão n'+q43
      +(nat?', com a natureza '+nat+(natTx?' («'+natTx+'»)':''):'')+': a app não a conta. A parte que devolves não é gasto',ct,'aviso'));
    if(Number(d.caucaoRecebida)>0)out.push(fiscoAvNovo('Contrato '+l.nome+': a caução recebida em '+r.ano+' ('+euroS(Number(d.caucaoRecebida))
      +') não é rendimento e fica fora d'+q43+' — num direito real de habitação duradoura só o é a prestação anual, do 11.º ano em diante, que a app conta sozinha',null,'info'));
  });
  return out;
}
/* Os benefícios do quadro 6 (D117, D119, D121) das linhas das rendas:
   - marcados no imóvel ou no contrato e que não contam no ano
     (irs.js:irsBeneficiosAvaliados): porquê, e o que a Declaração faz sem
     eles (a taxa da linha, as rendas ou as obras por inteiro). Na
     reabilitação do 6A (a lei dele cita uma informação vinculativa), a app
     segue a posição mais recente da AT: confirma-se. O toque abre o imóvel
     (as marcas imovel.*) ou a pergunta do contrato (a da gestão florestal);
   - os que contam e cuja versão traz um aviso (l.beneficios[].aviso — os 5 %
     do 6A): só se diz, um por benefício, com os contratos dele.
   Recebe: r — o resumo; L — as linhas das rendas, uma por contrato.
   Devolve: [{texto, abrir, toca, nivel}]. */
function fiscoAvBeneficios(r,L){
  const ano=r.ano,out=[],comAviso={},ordem=[];
  (L||[]).forEach(l=>{
    const c=contract(l.contratoId);if(!c)return;
    irsBeneficiosAvaliados(c,ano).forEach(x=>{
      const b=x&&x.beneficio;if(!b||x.aplica||!String(x.motivo||'').trim())return;
      /* o motivo diz às vezes «o quadro 6A não conta» no fim: aqui di-lo o
         princípio (o da vigência fica: fala do ano seguinte) */
      const m=String(x.motivo).replace(/(, o quadro \S+ não conta|: o quadro \S+ não conta( em \d{4})?)$/,'');
      const taxa=Number(l.taxa),efeito=l.isencao?''
        :b.taxa!=null?(isFinite(taxa)&&taxa!==Number(b.taxa)?'as rendas vão a '+dec(taxa)+' %, e não a '+dec(b.taxa)+' %':'')
        :b.fator!=null?'as rendas contam por inteiro, e não a '+dec(Math.round(Number(b.fator)*100))+' %'
        :b.fatorObras24!=null?'as obras dos 24 meses antes do arrendamento contam a 100 %, e não a '+dec(Math.round(Number(b.fatorObras24)*100))+' %':'';
      /* a doutrina da AT (a informação vinculativa da lei do benefício) é a das
         condições da reabilitação: o certificado, as datas, ser dono no dia */
      const piv=/\bPIV (\d+)/.exec(String(b.lei||'')),daAT=!!(piv&&/certificado|dono|começou entre|concluída|data de início|data de conclusão/.test(m));
      const marca=String(b.marca||''),k=marca.slice(marca.indexOf('.')+1);
      const toque=marca.indexOf('imovel.')===0&&l.propertyId?fiscoAvToque('properties',`propView('${jsq(l.propertyId)}')`,'camada')
        :k==='egf'?fiscoAvToque('contracts',`ctIrParaPergunta('${jsq(c.id)}','c_fegf')`,'camada')
        :fiscoAvToque('contracts',`ctView('${jsq(c.id)}')`,'camada');
      out.push(fiscoAvNovo('Contrato '+l.nome+': o quadro '+b.quadro+' ('+String(b.curto||b.nome||'')+') está marcado, mas não conta em '+ano+' — '+m
        +(efeito?'. Sem ele, '+efeito:'')+(daAT?'. É a posição mais recente da AT (informação vinculativa '+piv[1]+'); confirma-a antes de entregar':''),toque,'aviso'));
    });
    (Array.isArray(l.beneficios)?l.beneficios:[]).forEach(b=>{
      if(!b||!b.id||!String(b.aviso||'').trim())return;
      if(!comAviso[b.id]){comAviso[b.id]={b:b,nomes:[]};ordem.push(b.id)}
      if(comAviso[b.id].nomes.indexOf(l.nome)<0)comAviso[b.id].nomes.push(l.nome);
    });
  });
  ordem.forEach(id=>{
    const x=comAviso[id],b=x.b,av=String(b.aviso).trim().replace(/\.$/,'');
    out.push(fiscoAvNovo('Quadro '+b.quadro+' ('+String(b.curto||b.nome||'')+'), '+(x.nomes.length===1?'contrato ':'contratos ')+listaE(x.nomes)+': '
      +av.charAt(0).toLowerCase()+av.slice(1),null,'info'));
  });
  return out;
}
/* O código da freguesia das linhas (um aviso por imóvel):
   - fora do formato da AT (a falta 'código da freguesia fora do formato' do
     resumo — D136): falta;
   - de uma união de freguesias desagregada em outubro de 2025
     (l.freguesiaUniao, nas declarações de 2025 em diante — D135): âmbar,
     com as freguesias repostas pelo código e pelo nome (o nome da união não
     se mostra: a tabela da AT tra-lo em maiúsculas e abreviado); cala-se com
     o «Confirmei na caderneta» do imóvel (l.matrizConfirmada).
   Recebe: L — as linhas das rendas, uma por contrato.
   Devolve: [{texto, abrir, toca, nivel}]. */
function fiscoAvFreguesias(L){
  const out=[],fora={},uniao={};
  (L||[]).forEach(l=>{
    if(!l||!l.propertyId)return;
    const pv=fiscoAvToque('properties',`propView('${jsq(l.propertyId)}')`,'camada');
    if(!fora[l.propertyId]&&(l.faltas||[]).some(x=>/^código da freguesia fora do formato/.test(String(x)))){
      fora[l.propertyId]=1;
      out.push(fiscoAvNovo('Imóvel '+l.imovel+': o código da freguesia, «'+String(l.freguesiaCodigo||'').trim()+'», não tem o formato da AT — são 6 caracteres, 4 algarismos e 2 algarismos ou letras, como na caderneta. Corrige-o na ficha do imóvel',pv,'falta'));
    }
    const u=l.freguesiaUniao;
    if(uniao[l.propertyId]||!u||typeof u!=='object'||!u.codigo||String(l.matrizConfirmada||'').trim())return;
    uniao[l.propertyId]=1;
    const rs=(Array.isArray(u.repostas)?u.repostas:[]).filter(x=>x&&x.codigo).map(x=>x.codigo+' '+String(x.nome||'').trim());
    const lista=rs.length<2?(rs[0]||''):rs.slice(0,-1).join(', ')+' ou '+rs[rs.length-1];
    out.push(fiscoAvNovo('Imóvel '+l.imovel+': o código da freguesia, '+u.codigo+', é o de uma união de freguesias desagregada em outubro de 2025 (Lei 25-A/2025)'
      +(lista?'. O prédio passou para '+(rs.length>1?'uma destas: ':'')+lista:'')+', e o artigo matricial pode ter mudado. Confirma os dois na caderneta predial atual e corrige-os na ficha do imóvel; se estão certos, marca lá «Confirmei na caderneta»',pv,'aviso'));
  });
  return out;
}
/* As rendas recebidas antes do início do contrato a que estão ligadas, e que
   não respeitam a um mês dele (r.rendasAntesDoInicio — D130): é deste
   contrato? Continuam a contar nele. Um aviso por contrato.
   Recebe: r — o resumo.
   Devolve: [{texto, abrir, toca, nivel}]. */
function fiscoAvAntesDoInicio(r){
  const xs=(Array.isArray(r.rendasAntesDoInicio)?r.rendasAntesDoInicio:[]).filter(x=>x&&x.contratoId&&Number(x.valor)>0);
  return fiscoAvPorContrato(xs).map(ds=>{
    const um=ds.length===1,c=contract(ds[0].contratoId),nome=String(ds[0].nome||(c?ctName(c):'')),ini=String(ds[0].inicio||(c&&c.start)||'');
    const ms=[];ds.forEach(d=>{const m=String(d.mes||String(d.data||'').slice(0,7));if(/^\d{4}-\d{2}$/.test(m)&&ms.indexOf(m)<0)ms.push(m)});
    const toque=um&&ds[0].txId?fiscoAvToque('transactions',`txView('${jsq(ds[0].txId)}')`,'camada'):fiscoAvToque('transactions',"go('transactions')",'ecra');
    const antes=/^\d{4}-\d{2}-\d{2}$/.test(ini)?' ('+dPT(ini)+')':'';
    return fiscoAvNovo('Contrato '+nome+': '+(um
      ?'a renda de '+euroS(Number(ds[0].valor))+' recebida a '+dPT(ds[0].data)+' é de antes do início do contrato'+antes+' — é deste contrato? Se é uma renda antecipada, escolhe no movimento o mês da renda; se é de outro contrato, liga-a a ele. Até lá, conta nas rendas deste'
      :fiscoN(ds.length,'renda','rendas')+' ('+euroS(sum(ds.map(d=>Number(d.valor)||0)))+') recebidas antes do início do contrato'+antes+(ms.length?', de '+fiscoAvMeses(ms):'')
        +' — são deste contrato? Se são rendas antecipadas, escolhe em cada movimento o mês da renda; se são de outro contrato, liga-as a ele. Até lá, contam nas rendas deste'),toque,'aviso');
  });
}
/* Os encargos do imóvel que o contrato põe a cargo do inquilino
   (c.encargosInquilino — Q13), pelos nomes de dados.js:ENCARGOS_DO_INQUILINO.
   Recebe: c — o contrato (aguenta null).
   Devolve: os nomes, em minúsculas menos as siglas (['condomínio', 'IMI']). */
function fiscoAvEncargosDoInquilino(c){
  const ids=c&&Array.isArray(c.encargosInquilino)?c.encargosInquilino:[];
  if(!ids.length)return [];
  return ENCARGOS_DO_INQUILINO.filter(e=>ids.indexOf(e.id)>-1).map(e=>/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]{2,}$/.test(e.nome)?e.nome:e.nome.charAt(0).toLowerCase()+e.nome.slice(1));
}
/* As rendas abaixo da do contrato com o recibo emitido (r.rendasAbaixo —
   D115, D114), uma pergunta por contrato: se o recibo foi pela renda
   inteira, o quadro da linha vai abaixo dos recibos (e, com um inquilino
   empresa, da declaração que ela entrega à AT); a renda do recibo regista-se
   inteira e o desconto como despesa; um encargo descontado não se confirma
   também como despesa (com os do Q13 pelo nome); e o que não se recebeu não
   se declara.
   Recebe: r — o resumo; L — as linhas das rendas, uma por contrato (o
   quadro).
   Devolve: [{texto, abrir, toca, nivel}]. */
function fiscoAvRendasAbaixo(r,L){
  const xs=(Array.isArray(r.rendasAbaixo)?r.rendasAbaixo:[]).filter(x=>x&&x.contratoId&&/^\d{4}-\d{2}$/.test(String(x.mes||'')));
  const v=irsAno(r.ano),Q=v.quadros||{},linha={};
  (L||[]).forEach(l=>{if(l&&!linha[l.contratoId])linha[l.contratoId]=l});
  return fiscoAvPorContrato(xs).map(ds=>{
    const id=ds[0].contratoId,c=contract(id),l=linha[id],nome=String(ds[0].nome||(l&&l.nome)||(c?ctName(c):''));
    const q=String((l&&l.quadro)||Q.semReducao||''),um=ds.length===1;
    const ms=[];ds.forEach(d=>{if(ms.indexOf(d.mes)<0)ms.push(d.mes)});
    const ids=[];ds.forEach(d=>(Array.isArray(d.txIds)?d.txIds:[]).forEach(t=>{if(t&&ids.indexOf(t)<0)ids.push(t)}));
    const pares={};ds.forEach(d=>{pares[r2(Number(d.valor)||0)+'|'+r2(Number(d.referencia)||0)]=1});
    const par=Object.keys(pares).length===1;
    const quanto=par?' ('+euroS(Number(ds[0].valor)||0)+' em vez de '+euroS(Number(ds[0].referencia)||0)+')'
      :' ('+euroS(sum(ds.map(d=>Number(d.diferenca)||0)))+' abaixo, no total)';
    const enc=fiscoAvEncargosDoInquilino(c);
    const encTx=enc.length?' ('+(enc.length<2?enc[0]:enc.slice(0,-1).join(', ')+' ou '+enc[enc.length-1])+')':'';
    const empresa=ds.some(d=>d.empresa===true)?' e da declaração que a empresa inquilina entrega à AT':'';
    const toque=ids.length===1?fiscoAvToque('transactions',`txView('${jsq(ids[0])}')`,'camada'):fiscoAvToque('transactions',"go('transactions')",'ecra');
    return fiscoAvNovo('Contrato '+nome+': '+(um?'a renda de ':'as rendas de ')+fiscoAvMeses(ms)+(ms.length>4?',':'')+(um?' ficou':' ficaram')+' abaixo da renda'+quanto
      +', com o recibo emitido. '+(um?'Foi':'Foram')+' pela renda inteira? Então o quadro '+q+' vai abaixo '+(um?'do recibo':'dos recibos')+empresa
      +': regista '+(um?'':'em cada mês ')+'a renda do recibo, e o que se descontou (a comissão da gestora, uma obra) como despesa. Se o inquilino descontou um encargo'+encTx
      +', não o confirmes também como despesa. Se pagou só uma parte, o resto fica em dívida e não se declara',toque,'aviso');
  });
}
/* As retenções na fonte de contratos em que todos os inquilinos com NIF são
   particulares (r.retencoesParticulares — D116): só retém quem tem
   contabilidade organizada; confirma-se nos recibos, nunca se bloqueia.
   Recebe: r — o resumo.
   Devolve: [{texto, abrir, toca, nivel}]. */
function fiscoAvRetencoesParticulares(r){
  return (Array.isArray(r.retencoesParticulares)?r.retencoesParticulares:[]).filter(x=>x&&x.contratoId&&Number(x.retencoes)>0).map(x=>{
    const c=contract(x.contratoId),nome=String(x.nome||(c?ctName(c):''));
    const ns=(Array.isArray(x.inquilinos)?x.inquilinos:[]).map(t=>String((t&&t.nome)||'').trim()).filter(Boolean);
    const quem=ns.length>1?'os inquilinos '+listaE(ns)+' são particulares':ns.length?'o inquilino '+ns[0]+' é um particular':'o inquilino é um particular';
    return fiscoAvNovo('Contrato '+nome+': '+euroS(Number(x.retencoes))+' de retenções na fonte em '+r.ano+', e '+quem
      +' — só retém IRS quem tem contabilidade organizada. Confirma-as nos recibos: a comissão da gestora e os descontos não são retenção, e uma retenção que o recibo não tem não abate ao imposto',
      fiscoAvToque('contracts',`ctView('${jsq(x.contratoId)}')`,'camada'),'aviso');
  });
}
/* As despesas do Splitwise cortadas pela quota (r.splitwiseCortadas) que se
   podem repor, e as que têm outra igual no mesmo imóvel — a mesma data e a
   mesma descrição, noutra despesa do Splitwise —, que podem ser a mesma
   despesa importada por cada dono (cada um com a sua parte: a soma já está
   certa) ou duas vezes: essas não se repõem.
   Recebe: xs — as entradas do resumo.
   Devolve: {repor:[…], repetidas:[…]} — as entradas, como vieram. */
function fiscoAvSplitwiseRepor(xs){
  const out={repor:[],repetidas:[]},T=db.transactions||[];
  (xs||[]).forEach(x=>{
    const t=x&&x.txId?T.find(y=>y&&y.id===x.txId):null;if(!t)return;
    const lab=String(t.label||'').trim();
    const outra=T.some(y=>y&&y!==t&&y.kind==='expense'&&y.src==='splitwise'&&y.propertyId===t.propertyId&&y.date===t.date&&String(y.label||'').trim()===lab);
    (outra?out.repetidas:out.repor).push(x);
  });
  return out;
}
/* A chave do Splitwise (t.swKey) que o «Repor o total» grava: a data, a
   descrição e o custo total, com a categoria do CSV em branco (a app não a
   guardou) — o mesmo formato do splitwise.js:swChave. Uma chave não vazia é
   o que diz ao resumo que a despesa já tem o custo total.
   Recebe: t — a despesa; total — o custo total (euros).
   Devolve: a chave (dados.js:normSwKey). */
function fiscoAvChaveSplitwise(t,total){
  return normSwKey([String((t&&t.date)||''),String((t&&t.label)||''),(Number(total)||0).toFixed(2),''].join('|'));
}
/* As despesas do Splitwise importadas antes da v79 com o valor já cortado
   pela quota (r.splitwiseCortadas — D122): a Declaração volta a aplicar a
   quota do imóvel, e cada dono deduz menos do que pagou. O toque repõe o
   custo total (fiscoAvReporSplitwise); as que têm outra igual no mesmo
   imóvel dizem-se à parte, para se apagar a que está a mais.
   Recebe: r — o resumo.
   Devolve: [{texto, abrir, toca, nivel}]. */
function fiscoAvSplitwise(r){
  const xs=(Array.isArray(r.splitwiseCortadas)?r.splitwiseCortadas:[]).filter(x=>x&&x.txId&&Number(x.total)>0);
  if(!xs.length)return [];
  const g=fiscoAvSplitwiseRepor(xs),out=[],ano=r.ano;
  const item=x=>(String(x.nome||'').trim()||'Despesa')+', '+euroS(Number(x.valor)||0);
  const lista=ds=>{const resto=ds.slice(5);return ds.slice(0,5).map(item).join('; ')+(resto.length?'; e mais '+resto.length+', '+euroS(sum(resto.map(d=>Number(d.valor)||0))):'')};
  const R=g.repor;
  if(R.length){
    const um=R.length===1;
    out.push(fiscoAvNovo((um?'Despesa de '+ano+' importada do Splitwise com o valor já cortado pela tua quota: '+lista(R)+'. A Declaração volta a aplicá-la, e deduzes menos do que pagaste. Repor põe-lhe o custo total, '+euroS(Number(R[0].total))
      :fiscoN(R.length,'despesa','despesas')+' de '+ano+' importadas do Splitwise com o valor já cortado pela tua quota ('+euroS(sum(R.map(x=>Number(x.valor)||0)))+'): '+lista(R)
        +'. A Declaração volta a aplicá-la, e deduzes menos do que pagaste. Repor põe em cada uma o custo total ('+euroS(sum(R.map(x=>Number(x.total)||0)))+' ao todo)')
      +', pela quota de hoje no imóvel — confirma-o no Splitwise',fiscoAvToque('transactions',`fiscoAvReporSplitwise(${Number(ano)},'${jsq(r.titularId||'')}')`,'camada'),'aviso'));
  }
  const D=g.repetidas;
  if(D.length){
    const um=D.length===1;
    out.push(fiscoAvNovo((um?'Despesa de '+ano+' importada do Splitwise com o valor já cortado pela tua quota, e com outra igual no mesmo imóvel (a mesma data e descrição): '
      :fiscoN(D.length,'despesa','despesas')+' de '+ano+' importadas do Splitwise com o valor já cortado pela tua quota, e com outra igual no mesmo imóvel (a mesma data e descrição): ')+lista(D)
      +'. Pode ser a mesma despesa importada por cada dono, com a parte de cada um, ou importada duas vezes: confirma no Splitwise e apaga a que está a mais, ou corrige o valor na ficha',
      um?fiscoAvToque('transactions',`txView('${jsq(D[0].txId)}')`,'camada'):fiscoAvToque('transactions',"go('transactions')",'ecra'),'aviso'));
  }
  return out;
}
/* O toque «Repor o total» do aviso do Splitwise (D122): recalcula a lista do
   ano com quem declara (resumoFiscal, como o resumo do aviso), fica com as
   que se podem repor (fiscoAvSplitwiseRepor) e que eu posso alterar
   (acessos.js:podeEditar), pergunta com cada uma (o valor de agora e o
   total), e grava em cada a quantia total e a chave (fiscoAvChaveSplitwise),
   com o «Anular».
   Recebe: ano — o ano da Declaração; eu — o titular do resumo do aviso
   (r.titularId; '' por inteiro).
   Devolve: nada — abre a confirmação (ou um toast, sem nada a repor). */
function fiscoAvReporSplitwise(ano,eu){
  const r=resumoFiscal(ano,String(eu||'')),T=db.transactions||[];
  const xs=fiscoAvSplitwiseRepor((Array.isArray(r.splitwiseCortadas)?r.splitwiseCortadas:[]).filter(x=>x&&x.txId&&Number(x.total)>0)).repor;
  const ok=xs.filter(x=>{const t=T.find(y=>y&&y.id===x.txId);return !!t&&podeEditar(t.propertyId,'tx.add',t)});
  if(!ok.length)return toast(xs.length?'Só quem as importou as pode alterar — pede-lhe que reponha o total.':'Não há despesas para repor.');
  const alheias=xs.length-ok.length,mais=ok.length>8?ok.length-8:0;
  const li=ok.slice(0,8).map(x=>`<li>${esc(String(x.nome||'Despesa'))} · ${esc(dPT(x.data))}: ${esc(euroS(Number(x.valor)||0))} → <b>${esc(euroS(Number(x.total)||0))}</b></li>`).join('')
    +(mais?`<li>e mais ${mais}</li>`:'');
  confirmModal('Repor o custo total',`<p>${ok.length===1?'Esta despesa passa a ter':'Estas '+ok.length+' despesas passam a ter'} o custo total, pela quota de hoje no imóvel. Confirma-o no Splitwise.</p><ul>${li}</ul>`
    +(alheias?`<p>${alheias===1?'Uma outra foi importada':alheias+' outras foram importadas'} por outra pessoa: só ela a${alheias===1?'':'s'} pode repor.</p>`:''),()=>{
    const antes=[];
    ok.forEach(x=>{
      const t=(db.transactions||[]).find(y=>y&&y.id===x.txId);if(!t)return;
      antes.push({t:t,amount:t.amount,swKey:t.swKey});
      t.amount=r2(Number(x.total)||0);t.swKey=fiscoAvChaveSplitwise(t,t.amount);
    });
    save();render();
    comDesfazer(fiscoN(antes.length,'despesa reposta','despesas repostas')+' com o custo total.',()=>{antes.forEach(a=>{a.t.amount=a.amount;a.t.swKey=a.swKey})});
  });
}
/* O que saiu do Anexo F (D133, D134), e para onde vai:
   - os imóveis fora de Portugal (r.anexoJ): sem o código do país da tabela X
     é uma falta (as faltas da entrada), um aviso por imóvel; e, só a dizer,
     as rendas que vão ao Anexo J (o quadro e o código da versão,
     irs-AAAA.js:anexoJ), sem imposto estimado (Q12);
   - as rendas na categoria B (r.categoriaB): só se diz que vão ao Anexo B ou C.
   Recebe: r — o resumo.
   Devolve: [{texto, abrir, toca, nivel}]. */
function fiscoAvForaDoAnexoF(r){
  const v=irsAno(r.ano),J=v.anexoJ||{},out=[],ano=r.ano;
  const AJ=(Array.isArray(r.anexoJ)?r.anexoJ:[]).filter(x=>x&&x.contratoId);
  const ondeJ='o Anexo J'+(J.quadro?', quadro '+J.quadro:'')+(J.codigo?' (código '+J.codigo+')':'');
  const semCod={};
  AJ.forEach(x=>{
    if(!x.propertyId||semCod[x.propertyId]||!(x.faltas||[]).some(f=>/^código do país/.test(String(f))))return;
    semCod[x.propertyId]=1;
    out.push(fiscoAvNovo('Imóvel '+x.imovel+(x.pais?' ('+x.pais+')':'')+': sem o código do país da tabela X, que '+(J.quadro?'o quadro '+J.quadro+' do Anexo J':'o Anexo J')+' pede. Escreve-o na ficha do imóvel',
      fiscoAvToque('properties',`propView('${jsq(x.propertyId)}')`,'camada'),'falta'));
  });
  const cts=fiscoAvPorContrato(AJ).map(es=>({contratoId:es[0].contratoId,nome:String(es[0].nome||''),pais:String(es[0].pais||''),
    rendas:sum(es.map(e=>Number(e.rendas)||0)),imposto:sum(es.map(e=>Number(e.impostoEstrangeiro)||0))}));
  if(cts.length){
    const um=cts.length===1,x=cts[0],imp=sum(cts.map(c=>c.imposto));
    out.push(fiscoAvNovo((um?'Contrato '+x.nome+(x.pais?' ('+x.pais+')':'')+': as rendas de '+ano+' ('+euroS(x.rendas)+') não vão ao Anexo F — o imóvel fica fora de Portugal. Declaram-se n'
      :fiscoN(cts.length,'contrato','contratos')+' de imóveis fora de Portugal ('+euroS(sum(cts.map(c=>c.rendas)))+'): '+listaE(cts.map(c=>c.nome+(c.pais?' ('+c.pais+')':'')))+'. As rendas não vão ao Anexo F: declaram-se n')
      +ondeJ+', com os gastos e o imposto pago lá'+(imp>0?' ('+euroS(imp)+')':', que se escreve no contrato')+'. A app não estima o imposto: o crédito por dupla tributação depende do país',
      um?fiscoAvToque('contracts',`ctView('${jsq(x.contratoId)}')`,'camada'):null,'info'));
  }
  const CB=(Array.isArray(r.categoriaB)?r.categoriaB:[]).filter(x=>x&&x.contratoId);
  if(CB.length){
    const um=CB.length===1;
    out.push(fiscoAvNovo((um?'Contrato '+CB[0].nome+': as rendas de '+ano+' ('+euroS(Number(CB[0].rendas)||0)+') estão na categoria B'
      :fiscoN(CB.length,'contrato','contratos')+' com as rendas na categoria B ('+euroS(sum(CB.map(x=>Number(x.rendas)||0)))+'): '+listaE(CB.map(x=>String(x.nome||''))))
      +' — saem do Anexo F e declaram-se no Anexo B ou C, com os rendimentos da atividade',
      um?fiscoAvToque('contracts',`ctView('${jsq(CB[0].contratoId)}')`,'camada'):null,'info'));
  }
  return out;
}

/* O que há a tratar antes de preencher o quadro, cada ponto com o nível e o
   toque que abre a ficha onde se trata (com o serviço desligado, sem toque).
   Um contrato conta uma vez, mesmo com uma linha por titular ou por natureza
   (fica a das rendas, papel 'renda'). Pela ordem: as regras do ano (D50, D49);
   por inteiro sem sessão; a conjunta sem o cônjuge escolhido (D30, falta) e,
   com ele, só os imóveis dele partilhados com esta conta (D31, info); os
   contratos por indicar, sem o n.º, sem início (D43), sem finalidade (D16),
   com inquilino pessoa coletiva (D47); o fim — sem o dia (D02,
   fiscoAvSemCessacao), sem o motivo do quadro 10 (D09), a regularização do
   n.º 20 (D10, e a de um DHD); o DHD (fiscoAvDhd); as rendas depois do termo
   (D15); a comunicação da duração e o 4.2C (D12); a isenção que não conta
   (D46); o quadro 6 (fiscoAvBeneficios); os inquilinos sem NIF nem país; os
   imóveis sem os dados matriciais ou com várias frações (D69) e o código da
   freguesia (fiscoAvFreguesias); o que falta ao quadro 5 (D52); os imóveis
   por inteiro sem os donos fora da app confirmados (D08, fiscoAvSoDeUmDono)
   e as quotas que mudaram no ano (D29, info); o Modelo 44 ou os recibos; o
   selo do contrato (D27, fiscoAvSeloDoContrato); as rendas sem contrato
   (D34) e as de antes do início (fiscoAvAntesDoInicio); as receitas que a
   app não conta como renda (D05, D51, com o IHRU, fiscoAvAntesDoRau), o
   seguro num imóvel com seguro de renda (D21) e as rendas «Fora dos totais»
   (D19, info); a taxa escrita (D17); por contrato (fiscoAvAnaliseDasRendas),
   as retenções (D23, D58), as rendas abaixo (fiscoAvRendasAbaixo), as
   retenções de particulares (fiscoAvRetencoesParticulares), os meses
   dobrados (D88), as antecipadas (D56) e os meses sem renda (D04,
   fiscoAvCobertura); as despesas «a confirmar» (D06, D07, D24–D27, D60,
   D61), as pagas sem contrato e as obras soltas; as obras dos 24 meses por
   confirmar (D28), as despesas sem imóvel (D68), os reembolsos de um gasto
   (D20), as que contam fora do período por escolha (D65, info) e as do
   Splitwise cortadas (fiscoAvSplitwise); o AIMI (D32, D71); o reporte (Q10);
   o Anexo J e a categoria B (fiscoAvForaDoAnexoF); e os não declarados.
   Recebe: r — o resumo (resumoFiscal), menos os avisos, na forma da 1.4 e da
   1.7 do plano (linhas, fora, semContrato, aConfirmar ou semRegra, cessados,
   regularizacoes, aimi, reporte, quadro5, os movimentos apontados, anexoJ,
   categoriaB, rendasAbaixo…). O que falte lê-se como vazio; a comunicação,
   os meses e os contratos sem rendas, sem eles, contam-se da base.
   Devolve: [{texto, abrir, toca, nivel}] — abrir o código do toque (''
   sem ação); toca 'camada' ou 'ecra'; nivel 'falta' (o que a AT pede e não
   está), 'aviso' (o que convém tratar) ou 'info' (o que só se diz). */
function fiscoAvisos(r){
  const ano=r.ano,A=String(ano),F=r.fora||[],S=r.semContrato||[],obrasSoltas=r.obrasSoltas,foraDoPeriodo=r.foraDoPeriodo,semSessao=r.semSessao,hoje=today();
  let L=r.linhas||[];
  const out=[],add=(texto,abrir,toca,nivel)=>out.push({texto:texto,abrir:abrir||'',toca:toca||'',nivel:nivel||'aviso'});
  /* o toque só se o serviço que ele abre está ligado; senão [abrir, toca] vazios */
  const se=(id,abrir,toca)=>servicoLigado(id)?[abrir,toca]:['',''];
  const v=irsAno(ano);
  if(!v.exato){
    if(v.pedido>v.ano)add('Ainda não há versão das regras de '+ano+'. Usam-se as de '+v.ano+', a mais recente, com as datas passadas para '+ano+' — as taxas e os quadros podem ter mudado.','','','aviso');
    else add('A app não tem as regras de '+ano+': as taxas, os quadros e os códigos desse ano podem ser outros. Não uses estes números para a declaração desse ano.','','','falta');
  }
  /* a versão provisória: cinzenta até a entrega abrir; daí em diante o Anexo
     F do ano já pode ter saído com outros campos, e a app ainda não o
     conferiu — âmbar, com o dia da última revisão (D49) */
  else if(v.modelo&&!v.modelo.oficial){
    const entrega=v.entrega&&/^\d{4}-\d{2}-\d{2}$/.test(String(v.entrega.de||''))?String(v.entrega.de):'';
    if(entrega&&hoje>=entrega)add('As regras de '+ano+' desta página ainda são as provisórias'+(v.revisto?', revistas a '+dPT(v.revisto):'')
      +', e o Anexo F de '+ano+' pode já ter saído com outros quadros, campos ou códigos — o da taxa de 10 % incluído. Antes de copiar, confirma-os nas instruções do modelo oficial, no Portal das Finanças.','','','aviso');
    else if(v.modelo.texto)add(v.modelo.texto,'','','info');
  }
  if(semSessao)add('Sem sessão não se sabe qual dos proprietários és: os valores vão por inteiro, de todos, e não pela tua quota-parte. O Anexo F é por titular.','','','aviso');
  /* a conjunta sem o cônjuge escolhido (D30): só entra quem declara — quem
     tinha os dois marcados B nos campos antigos perde o cônjuge em silêncio.
     O resumo di-lo em r.semConjuge; sem ele, pergunta-se aos titulares
     (fisco-titulares.js:fiscoTitulares). Escolhe-se no cartão da situação */
  const semConjuge=typeof r.semConjuge==='boolean'?r.semConjuge
    :!!(r.titularId&&typeof fiscoTitulares==='function'&&(fiscoTitulares(r.titularId,ano)||{}).semConjuge===true);
  if(semConjuge)add('Tributação conjunta sem o cônjuge escolhido: só entram as tuas rendas. Escolhe-o em «A tua situação em '+ano+'».','','','falta');
  /* a conjunta com o cônjuge escolhido (D31): a app só vê os imóveis dele
     partilhados com esta conta; os que estão só na conta dele faltam, e
     juntam-se à mão. Só se diz (cinzento: não há nada a corrigir na app —
     decisão do Martinho de 2026-11-18). Os titulares são eu e ele
     (r.titulares) */
  const tits=Array.isArray(r.titulares)?r.titulares:[],conjuge=tits.length>1?tits.find((x,i)=>i>0&&x&&x!==tits[0]):'';
  if(conjuge&&!semConjuge){
    const cj=(db.owners||[]).find(o=>o&&o.id===conjuge),nomeCj=String((cj&&cj.name)||'').trim();
    add('Tributação conjunta'+(nomeCj?' com '+nomeCj:'')+': entram só os imóveis do cônjuge partilhados com esta conta. Os que estão só na conta '
      +(nomeCj?'de '+nomeCj:'do cônjuge')+' não chegam aqui: junta-os no Portal das Finanças, a partir do PDF ou do CSV da Declaração dessa conta','','','info');
  }
  /* os avisos de um contrato contam-no uma vez: em conjunta, um imóvel dos
     dois tem uma linha por titular, e um contrato com indemnizações (05) ou
     outras receitas prediais (02) tem uma linha por natureza — fica a das
     rendas (papel 'renda'), que é a que leva a comunicação, os recibos e o
     selo, mesmo quando a 05/02 vem antes no array (a das rendas no 4.2, a
     outra no 4.1) */
  const daRenda=l=>!l.papel||l.papel==='renda',fica={};
  L.forEach(l=>{const x=fica[l.contratoId];if(!x||(!daRenda(x)&&daRenda(l)))fica[l.contratoId]=l});
  L=L.filter(l=>fica[l.contratoId]===l);
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
  /* o inquilino pessoa coletiva num contrato de habitação (D47): a AT só o
     trata como habitacional se o contrato identifica quem lá mora (PIV
     25679), e os 10 % pedem ainda a proibição de sublocar (PIV 30751) — a
     pergunta é fisco.empresaHabitacao. O NIF é só o sinal que a acende; a
     app não muda a natureza nem a taxa por ele: diz o que falta */
  L.forEach(l=>{
    const c=contract(l.contratoId);if(!c)return;
    const f=fiscoDe(c);if(['hp','hnp'].indexOf(f.finalidade)<0||f.empresaHabitacao===true)return;
    let emp=null;
    (l.inquilinos||[]).forEach(x=>{
      if(emp)return;
      const p=(typeof tenant==='function'&&tenant(x.id))||x;
      if(p&&typeof nifColetivo==='function'&&nifColetivo(p.nif!=null?p.nif:x.nif))emp={id:x.id,nome:p.name||x.nome||''};
    });
    if(!emp)return;
    const T=v.taxas||{},nat=(v.naturezas||{}).naoHabitacional,nh='não habitacional'+(nat||T.naoHabitacional?' ('+[nat?'natureza '+nat:'',T.naoHabitacional?dec(T.naoHabitacional)+' %':''].filter(Boolean).join(', ')+', sem a redução pela duração)':'');
    add('Contrato '+l.nome+': '+(f.empresaHabitacao===false
      ?'o contrato com '+emp.nome+' não identifica quem lá mora, ou não proíbe a sublocação — para a AT o arrendamento é '+nh+'. Muda a finalidade do contrato para não habitacional'
      :'arrendamento de habitação a '+emp.nome+', com NIF de empresa ou de outra entidade. Confirma se o contrato identifica quem lá mora e proíbe a sublocação: sem isso, a AT trata o arrendamento como '+nh+'. A app mantém a finalidade escolhida até o confirmares'),
      // o toque abre a pergunta no formulário do contrato (contrato.js:ctResponderEmpresa)
      ...(f.empresaHabitacao===false?verCt(l.contratoId):se('contracts',`ctResponderEmpresa('${jsq(l.contratoId)}')`,'camada')),'falta');
  });
  /* o fim de cada contrato (D02, D09, D10): os terminados à moda antiga sem o
     dia em que acabaram, os que vão ao quadro 10 sem o motivo, e a
     regularização do art. 72.º n.º 20 quando acabou antes do prazo por
     motivo do senhorio. O dia e o motivo escrevem-se no contrato */
  const Q=v.quadros||{},q10=Q.cessados?'o quadro '+Q.cessados:'o quadro dos contratos que acabaram';
  const cessados=Array.isArray(r.cessados)?r.cessados.filter(x=>x&&x.contratoId):[];
  const noQ10={};cessados.forEach(x=>{noQ10[x.contratoId]=1});
  const semCessacao=fiscoAvSemCessacao(r),semDia={};
  semCessacao.forEach(x=>{
    const c=x.contrato,vaiAoQ10=!!noQ10[c.id];semDia[c.id]=1;
    const motivo=vaiAoQ10?' e o motivo, que '+q10+' pede':' e o motivo';
    if(!x.fim)add('Contrato '+ctName(c)+': terminado sem o dia em que acabou, e sem termo — a app não sabe até quando esteve em vigor. Escreve no contrato o dia em que acabou'+motivo,...verCt(c.id),'falta');
    else if(x.futuro)add('Contrato '+ctName(c)+': terminado sem o dia em que acabou, e o termo ('+dPT(x.fim)+') ainda não chegou — a app conta-o em vigor até lá, com os gastos da casa vazia, e o prazo da cessação não aparece. Escreve no contrato o dia em que acabou'+motivo,...verCt(c.id),'falta');
    else add('Contrato '+ctName(c)+': terminado sem o dia em que acabou — a app usa o fim escrito, '+dPT(x.fim)+'. Confirma no contrato o dia em que acabou'+motivo+': o dia decide os gastos que contam e o prazo da cessação',...verCt(c.id),vaiAoQ10?'falta':'aviso');
  });
  cessados.forEach(x=>{
    if(x.motivo||semDia[x.contratoId])return;
    const c=contract(x.contratoId),nome=x.nome||(c?ctName(c):'');
    add('Contrato '+nome+': acabou'+(x.data?' a '+dPT(x.data):'')+' sem o motivo da cessação, que '+q10+' pede com o regime, o n.º, o ano de início do benefício e a data. Escolhe-o no contrato',...verCt(x.contratoId),'falta');
  });
  const m01=((v.quadro10||{}).motivos||[]).find(x=>x&&x.regulariza);
  /* num direito real de habitação duradoura cessado por acordo das partes
     (o motivo do quadro 4.3 que regulariza, x.dhd) os 5 % caem desde o início
     do contrato (CIRS art. 72.º n.º 20) */
  const Q43=v.quadro43||{},m43=(Q43.motivos||[]).find(x=>x&&x.regulariza);
  (Array.isArray(r.regularizacoes)?r.regularizacoes:[]).forEach(x=>{
    if(!x||!x.contratoId||!(Number(x.total)>0))return;
    const c=contract(x.contratoId),nome=x.nome||(c?ctName(c):'');
    const anos=(x.anos||[]).filter(y=>y&&Number(y.diferenca)>0).map(y=>y.ano+': '+euroS(Number(y.diferenca)));
    if(x.dhd===true){
      add('Contrato '+nome+': o direito real de habitação duradoura acabou por acordo das partes'+(m43&&m43.codigo&&Q.dhd?' (o motivo '+m43.codigo+' do quadro '+Q.dhd+')':'')
        +'. '+(v.taxas&&Number(v.taxas.dhd)>0?'Os '+dec(v.taxas.dhd)+' % caem':'A taxa reduzida cai')+' desde o início do contrato (CIRS art. 72.º n.º 20), e a diferença de imposto dos anos anteriores paga-se com esta declaração, com juros compensatórios — a app estima '
        +euroS(Number(x.total))+' sem os juros'+(anos.length?' ('+anos.join('; ')+')':''),...verCt(x.contratoId),'falta');
      return;
    }
    add('Contrato '+nome+': acabou antes do prazo por motivo do senhorio'+(m01&&m01.codigo&&Q.cessados?' (o motivo '+m01.codigo+' do quadro '+Q.cessados+')':'')+'. A redução pela duração do período em que acabou cai (CIRS art. 72.º n.º 20), e a diferença de imposto dos anos dele já declarados paga-se com esta declaração, com juros compensatórios — a app estima '
      +euroS(Number(x.total))+' sem os juros'+(anos.length?' ('+anos.join('; ')+')':''),...verCt(x.contratoId),'falta');
  });
  fiscoAvDhd(r,L).forEach(a=>add(a.texto,a.abrir,a.toca,a.nivel));
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
  /* a comunicação da duração (D12), uma por período com redução — o
     contrato e cada renovação —, até 15 de fevereiro do ano seguinte ao
     início dele; feita, vale em todos os anos do período
     (irs.js:irsComunicacaoDoAno, ou o l.comunicacao do resumo). Por fazer é
     âmbar; passado o prazo, falta: o 4.2A pergunta se foi a tempo. Feita
     depois do prazo, o 4.2A é NÃO. A app não tira a redução por isso */
  const q4a='quadro '+Q.datas+' do Anexo F';
  L.forEach(l=>{
    const c=contract(l.contratoId);if(!c)return;
    const x=Object.prototype.hasOwnProperty.call(l,'comunicacao')?l.comunicacao:(typeof irsComunicacaoDoAno==='function'?irsComunicacaoDoAno(c,ano):null);
    if(!x||typeof x!=='object'||!/^\d{4}-\d{2}-\d{2}$/.test(String(x.prazo||'')))return;
    const ren=!!x.periodoInicio&&x.periodoInicio!==c.start;
    const oque=ren?'a renovação de '+dPT(x.periodoInicio):'a duração do contrato',Oque=ren?'A renovação':'A duração';
    if(x.data){
      if(x.foraDePrazo||String(x.data)>x.prazo)add('Contrato '+l.nome+': '+oque+' foi comunicada a '+dPT(x.data)+', depois do prazo ('+dPT(x.prazo)+'). Se a comunicaste antes, corrige o dia no contrato; se não, no '+q4a+' a resposta é NÃO, e a AT pode não aplicar a redução pela duração',...verCt(c.id),'aviso');
      return;
    }
    if(hoje>x.prazo)add('Contrato '+l.nome+': '+oque+' não está marcada como comunicada, e o prazo era '+dPT(x.prazo)+'. Se a comunicaste, marca no contrato o dia em que o fizeste; se não, no '+q4a+' a resposta é NÃO, e a AT pode não aplicar a redução pela duração',...verCt(c.id),'falta');
    else add('Contrato '+l.nome+': '+oque+' está por comunicar no Portal das Finanças. '+Oque+' comunica-se uma vez, até '+dPT(x.prazo)+', e o '+q4a+' pergunta se foi a tempo; quando o fizeres, marca-o no contrato',...verCt(c.id),'aviso');
  });
  /* o 4.2C (art. 72.º n.º 23) nos do 4.2 celebrados desde a data da versão
     com «Não sei» no limite da renda: a app conta a redução, e pede para
     confirmar (D12) */
  const L23=v.taxas&&v.taxas.limiteRendaAlta,q42=Q.comReducao;
  if(L23&&L23.desde&&q42){
    const n23=L.filter(l=>l.quadro===q42&&l.acimaDoLimite===null&&String(l.celebracao||l.inicio||'')>=L23.desde);
    const pct=dec(L23.percentagem)+' %',per='«Renda acima de '+pct+' do limite do concelho?»';
    if(n23.length)add((n23.length===1?'Contrato '+n23[0].nome+': celebrado a '+dPT(String(n23[0].celebracao||n23[0].inicio))+', com «Não sei» em '+per+'. Confirma-o no contrato'
      :n23.length+' contratos do quadro '+q42+' celebrados desde '+dPT(L23.desde)+' com «Não sei» em '+per+'. Confirma-o em cada um')
      +': o quadro '+q42+'C pergunta-o, e uma renda acima do limite não tem a redução pela duração. Até lá, a app conta a redução',...umCt(n23),'aviso');
  }
  /* a isenção escolhida no contrato que não conta no ano (D46): a primeira
     condição da versão que falha (irs.js:irsIsencaoMotivo). Sem o envio ao
     IHRU, o toque abre a janela de o marcar (prazos.js:pzIhruPergunta) */
  L.forEach(l=>{
    const c=contract(l.contratoId);if(!c||!fiscoDe(c).isencao||typeof irsIsencaoMotivo!=='function')return;
    const m=irsIsencaoMotivo(c,ano);if(!m)return;
    const id=fiscoDe(c).isencao,is=(v.isencoes||[]).find(x=>x&&x.id===id),nomeIs=is?(is.curto||is.nome||''):'';
    const ihru=!fiscoDe(c).ihru&&/IHRU/.test(m)&&typeof pzIhruPergunta==='function'&&typeof pzPrazoIhru==='function'&&!!pzPrazoIhru(c)
      &&(typeof pzPodeMarcar!=='function'||pzPodeMarcar(c));
    add('Contrato '+l.nome+': '+m+(nomeIs&&m.indexOf(nomeIs)<0?' ('+nomeIs+')':'')+'. As rendas dele vão à Declaração com imposto'+(ihru?'; se o enviaste a tempo, marca o dia em que o enviaste':''),
      ...(ihru?se('contracts',`pzIhruPergunta('${jsq(c.id)}')`,'camada'):verCt(c.id)),'aviso');
  });
  fiscoAvBeneficios(r,L).forEach(a=>add(a.texto,a.abrir,a.toca,a.nivel));
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
  fiscoAvFreguesias(L).forEach(a=>add(a.texto,a.abrir,a.toca,a.nivel));
  /* mais do que uma fração no mesmo campo: a app ainda não as separa (Q3) */
  L.forEach(l=>{
    if(!l.propertyId||frac[l.propertyId]||!falta(l,/^fração/))return;frac[l.propertyId]=1;
    add('Imóvel '+l.imovel+': o campo da fração tem mais do que uma («'+String(l.fracao||'').trim()+'»). No Anexo F cada fração vai numa linha, com a parte da renda que lhe cabe; a app faz uma linha por contrato, por isso divide-a por fração ao preencher',
      ...se('properties',`propView('${jsq(l.propertyId)}')`,'camada'),'falta');
  });
  /* o quadro 5 (a sublocação, D52): o que ele pede e falta — o NIF do
     senhorio e a renda que lhe pagas escrevem-se na ficha do imóvel; o
     inquilino e o NIF dele, no contrato */
  const Q5=(Array.isArray(r.quadro5)?r.quadro5:[]).filter(x=>x&&x.contratoId),visto5={};
  Q5.forEach(x=>{
    if(visto5[x.contratoId])return;visto5[x.contratoId]=1;
    const fs=(x.faltas||[]).map(String).filter(Boolean);if(!fs.length)return;
    const mal=fs.filter(f=>/não bate certo$/.test(f)),sem=fs.filter(f=>mal.indexOf(f)<0);
    const partes=(sem.length?['sem '+listaE(sem)]:[]).concat(mal.map(f=>'o '+f));
    const doImovel=fs.some(f=>/senhorio/.test(f))&&!!x.propertyId,doInquilino=fs.some(f=>/inquilino/.test(f));
    const onde=(doImovel?['o NIF do senhorio e a renda que lhe pagas escrevem-se na ficha do imóvel, no subarrendamento']:[])
      .concat(doInquilino?['o inquilino liga-se no contrato, e o NIF ou o país dele escrevem-se na ficha do inquilino']:[]).join('; ');
    add('Quadro '+(Q.sublocacao||'5')+' (sublocação), contrato '+String(x.nome||'')+': '+partes.join('; ')+(onde?'. '+onde.charAt(0).toUpperCase()+onde.slice(1):''),
      ...(doImovel?se('properties',`propView('${jsq(x.propertyId)}')`,'camada'):verCt(x.contratoId)),'falta');
  });
  /* as quotas (D08, D29): um imóvel que conta por inteiro nesta declaração,
     sem estar confirmado que não há donos fora da app (o
     comproprietariosFora por confirmar, fiscoAvSoDeUmDono) — cada um declara
     só a sua parte (CIRS art. 19.º); e, só a dizer, as quotas que mudaram a
     meio do ano (l.quotas do resumo): cada renda e cada gasto contam pela do
     seu dia. Os imóveis do quadro 5 ficam fora: neles és o arrendatário, e
     não o dono */
  const pids=[],vistoP={};
  L.forEach(l=>{if(l.propertyId&&!vistoP[l.propertyId]){vistoP[l.propertyId]=1;pids.push(l.propertyId)}});
  const aCem=pids.map(id=>prop(id)).filter(p=>p&&fiscoAvSoDeUmDono(p,ano));
  if(aCem.length)add((aCem.length===1?'Imóvel '+aCem[0].name+': conta por inteiro nesta declaração, e não está confirmado que não há outros donos'
    :fiscoN(aCem.length,'imóvel conta','imóveis contam')+' por inteiro nesta declaração sem estar confirmado que não há outros donos: '+listaE(aCem.map(p=>String(p.name||''))))
    +'. Se '+(aCem.length===1?'a casa tem':'algum tem')+' donos fora da app (um irmão, um herdeiro), escreve-os com a quota de cada um na ficha '+(aCem.length===1?'do imóvel':'dele')
    +', em «Há outros donos fora da app?» — cada um declara só a sua parte (CIRS art. 19.º); se '+(aCem.length===1?'é só tua':'são só teus')+', escolhe «Não, mais ninguém»',
    ...(aCem.length===1?se('properties',`propView('${jsq(aCem[0].id)}')`,'camada'):se('properties',"go('properties')",'ecra')),'aviso');
  const vistoQ={};
  (r.linhas||[]).filter(l=>l&&l.propertyId&&Array.isArray(l.quotas)&&l.quotas.length>1)
    .sort((a,b)=>(a.titularId===r.titularId?0:1)-(b.titularId===r.titularId?0:1))
    .forEach(l=>{
      if(vistoQ[l.propertyId])return;vistoQ[l.propertyId]=1;
      const dono=l.titularId?(db.owners||[]).find(o=>o&&o.id===l.titularId):null;
      const quem=!l.titularId?'a parte da casa nesta declaração':l.titularId===r.titularId?'a tua quota':'a quota de '+String((dono&&dono.name)||'quem declara contigo');
      const qs=l.quotas.filter(x=>x&&/^\d{4}-\d{2}-\d{2}$/.test(String(x.desde||''))).map(x=>dec(Math.round((Number(x.quota)||0)*10000)/100)+' % desde '+dPT(x.desde));
      add('Imóvel '+l.imovel+': '+quem+' mudou em '+ano+' ('+listaE(qs)+'). A Declaração conta cada renda e cada gasto pela quota do dia em que entrou ou foi pago (CIRS art. 19.º)',
        ...se('properties',`propView('${jsq(l.propertyId)}')`,'camada'),'info');
    });
  /* quem está dispensado dos recibos eletrónicos não tem recibos em falta: tem
     o Modelo 44, a declaração anual das rendas (CIRS art. 115.º) */
  const dispensa=fiscoIrsDefs().dispensaRecibos;
  if(dispensa&&L.length)add('Modelo 44: tens dispensa dos recibos eletrónicos — entrega a declaração anual das rendas de '+ano+' até '+dPT(fiscoPrazoModelo44(ano))+', no Portal das Finanças','','','info');
  /* o recibo pede-se à renda, à caução e ao reembolso do inquilino (CIRS art.
     115.º n.º 5 a); o l.recibosPorEmitir conta os três, D03, D20): quando há
     cauções ou reembolsos sem recibo, o aviso di-lo */
  const comRecibos=dispensa?[]:L.filter(l=>l.recibosPorEmitir>0),nRec=sum(comRecibos.map(l=>l.recibosPorEmitir));
  if(nRec){
    const ids={};comRecibos.forEach(l=>{ids[l.contratoId]=1});
    const outros={};
    (db.transactions||[]).forEach(t=>{
      if(!t||!ids[t.contractId]||t.recibo||!String(t.date||'').startsWith(A)||t.kind!=='income')return;
      if(fiscoPapelDe(t)==='caucao')outros.caucao=1;
      else if(fiscoNaLinhaDoContrato(t)&&catIrsId('catsIn',t.category)==='reembolsos')outros.reembolso=1;
    });
    const ks=(outros.caucao?['a caução']:[]).concat(outros.reembolso?['o reembolso do inquilino']:[]);
    add(ks.length?fiscoN(nRec,'recebimento','recebimentos')+' de '+ano+' sem recibo eletrónico emitido: '+listaE(ks)+' também '+(ks.length===1?'pede':'pedem')+' recibo, como a renda'
      :fiscoN(nRec,'renda','rendas')+' de '+ano+' sem recibo eletrónico emitido',
      ...(comRecibos.length===1?umCt(comRecibos):se('transactions',"go('transactions')",'ecra')));
  }
  /* o selo do contrato (10 % de uma renda, pago com o Modelo 2) é dedutível e
     esquece-se: só se o contrato começou no ano e o prazo do Modelo 2 ainda
     caía nele — senão o selo pode ter sido pago no ano seguinte, com razão.
     Um selo pago antes da celebração não é o do contrato (D27: o da compra
     do imóvel, o de um crédito) e não o cala (fiscoAvSeloDoContrato) */
  const selo={};
  const semSelo=L.filter(l=>{
    if(l.estado!=='declarado'||String(l.inicio||'').slice(0,4)!==A||fimDoMesSeguinte(l.inicio).slice(0,4)!==A)return false;
    selo[l.contratoId]=fiscoAvSeloDoContrato(contract(l.contratoId),l,ano);
    return !selo[l.contratoId].pago;
  });
  const antesDe=semSelo.length===1?selo[semSelo[0].contratoId].antes:'';
  if(semSelo.length)add((semSelo.length===1?'Contrato '+semSelo[0].nome+': começou em '+ano+' e não há imposto do selo nos gastos'
    +(antesDe?' (o de '+dPT(antesDe)+' foi pago antes de o contrato se celebrar: não é o dele)':'')
    :semSelo.length+' contratos começaram em '+ano+' sem imposto do selo nos gastos')+' — o que se paga com o Modelo 2 (10 % de uma renda) é dedutível: adiciona-o como despesa, em Impostos › Imposto do selo',
    ...se('transactions',"go('transactions')",'ecra'));
  /* as rendas sem contrato são rendimento na mesma (CIRS art. 8.º): não estão
     em linha nenhuma do quadro, e é uma falta (D34) */
  const nSem=sum(S.map(s=>s.n||0)),vSem=sum(S.map(s=>Number(s.rendas)||0));
  if(nSem)add(fiscoN(nSem,'renda','rendas')+' de '+ano+' sem contrato ligado ('+euroS(vSem)+') '+(nSem===1?'não está':'não estão')+' em nenhuma linha do quadro, mas '
    +(nSem===1?'declara-se na mesma: liga-a':'declaram-se na mesma: liga-as')+' ao contrato',
    ...(nSem===1&&S[0].ids&&S[0].ids[0]?se('transactions',`txView('${jsq(S[0].ids[0])}')`,'camada'):se('transactions',"go('transactions')",'ecra')),'falta');
  fiscoAvAntesDoInicio(r).forEach(a=>add(a.texto,a.abrir,a.toca,a.nivel));
  /* os movimentos que o resumo aponta sem os contar (D05, D19, D20, D21,
     D28, D51, D65, D68): até cinco com o nome e o valor, e o resto somado; o
     toque abre o movimento, ou os movimentos quando são vários */
  const nomeValor=d=>(String(d.nome||'').trim()||'Movimento')+', '+euroS(Number(d.valor)||0);
  const listaMov=ds=>{const resto=ds.slice(5);return ds.slice(0,5).map(nomeValor).join('; ')+(resto.length?'; e mais '+resto.length+', '+euroS(sum(resto.map(d=>Number(d.valor)||0))):'')};
  const toqueMov=ds=>ds.length===1&&ds[0].txId?se('transactions',`txView('${jsq(ds[0].txId)}')`,'camada'):se('transactions',"go('transactions')",'ecra');
  const movs=x=>(Array.isArray(x)?x:[]).filter(d=>d&&Number(d.valor)>0);
  const totalDe=ds=>euroS(sum(ds.map(d=>Number(d.valor)||0)));
  /* as receitas dos imóveis da declaração que não são renda nem passivo —
     Outras receitas, Subsídios, sem categoria e sem contrato, as categorias
     da pessoa (r.porClassificar, D05, D51): a app não as conta, e se são
     rendimentos do imóvel declaram-se (CIRS art. 8.º n.º 2: a cedência do
     uso, a publicidade, as partes comuns; uma renda paga por outro). A
     compensação do IHRU aos senhorios dos contratos anteriores ao RAU, de
     1990, não é rendimento: diz-se quando algum desses imóveis tem um
     contrato desses (fiscoAvAntesDoRau) */
  const PC=movs(r.porClassificar);
  if(PC.length){
    const n=PC.length,um=n===1,nat=(v.naturezas||{}).outras;
    const ihru=PC.some(d=>fiscoAvAntesDoRau(d.contratoId,d.propertyId));
    add((um?'Receita de '+ano+' que a app não conta como renda: '+listaMov(PC)+'. Se é rendimento do imóvel'
      :fiscoN(n,'receita','receitas')+' de '+ano+' dos imóveis desta declaração ('+totalDe(PC)+') que a app não conta como renda: '+listaMov(PC)+'. Se são rendimentos do imóvel')
      +' (publicidade, partes comuns, um lugar de garagem, uma renda paga por outro), '+(um?'declara-se: muda-lhe':'declaram-se: muda-lhes')
      +' a categoria para Rendas — a renda do contrato, ou Rendas › Outras receitas prediais'+(nat?' (natureza '+nat+')':'')+' — e '+(um?'liga-a':'liga-as')+' ao contrato'
      +(ihru?'. A compensação do IHRU aos senhorios dos contratos anteriores a 1990 (DL 132/2023) não é rendimento: essa fica como está':''),
      ...toqueMov(PC),'aviso');
  }
  /* os reembolsos do seguro num imóvel com seguro de renda no ano
     (r.seguroDeRenda, D21): podem ser a indemnização das rendas, que se
     declara com a natureza 05 (CIRS art. 8.º n.º 2 g)) */
  const SR=movs(r.seguroDeRenda);
  if(SR.length){
    const um=SR.length===1,nat=(v.naturezas||{}).indemnizacao;
    add((um?'Reembolso do seguro de '+ano+' num imóvel com seguro de renda: '+listaMov(SR)+'. Se compensa rendas que não recebeste, é uma indemnização'
      :fiscoN(SR.length,'reembolso','reembolsos')+' do seguro de '+ano+' em imóveis com seguro de renda ('+totalDe(SR)+'): '+listaMov(SR)+'. Os que compensam rendas que não recebeste são indemnizações')
      +(nat?' (natureza '+nat+')':'')+' e '+(um?'declara-se: muda-lhe':'declaram-se: muda-lhes')+' a categoria para Rendas › Indemnização e '+(um?'liga-a':'liga-as')+' ao contrato. '
      +(um?'Se reembolsa uma despesa, abate-o a essa despesa':'Os que reembolsam uma despesa abatem-se a ela'),
      ...toqueMov(SR),'aviso');
  }
  /* as rendas numa categoria «Fora dos totais» continuam a declarar-se
     (r.rendasForaDosTotais, D19): só se diz */
  const RF=r.rendasForaDosTotais&&typeof r.rendasForaDosTotais==='object'?r.rendasForaDosTotais:{},nRF=Math.max(0,Math.round(Number(RF.n)||0));
  if(nRF)add(fiscoN(nRF,'renda','rendas')+' de '+ano+(Number(RF.valor)>0?' ('+euroS(Number(RF.valor))+')':'')+(nRF===1?' está':' estão')+' numa categoria «Fora dos totais»: '
    +(nRF===1?'fica':'ficam')+' fora das contas da app, mas '+(nRF===1?'declara-se, e está':'declaram-se, e estão')+' nesta Declaração','','','info');
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
  fiscoAvRendasAbaixo(r,L).concat(fiscoAvRetencoesParticulares(r)).forEach(a=>add(a.texto,a.abrir,a.toca,a.nivel));
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
  /* as rendas antecipadas por lançar (D56); num imóvel fora de Portugal não
     há recibo eletrónico (vão ao Anexo J — D133) */
  fiscoAvAntecipadas(r).forEach(x=>{
    const um=x.meses.length===1,rec=fiscoForaDoAnexoF(x.contrato)==='anexoJ'?'':', com recibo';
    add('Contrato '+ctName(x.contrato)+': tem '+fiscoN(x.advance,'renda antecipada','rendas antecipadas')+' e não há renda de '+fiscoAvMeses(x.meses)
      +(um?'. Se a recebeste à cabeça, adiciona-a com o dia em que entrou: declara-se no ano em que a recebeste'+rec
        :'. Se as recebeste à cabeça, adiciona-as com o dia em que entraram: declaram-se no ano em que as recebeste'+rec),
      ...verCt(x.contrato.id),'aviso');
  });
  /* os meses em vigor sem renda registada (D04), pelo mês a que respeitam
     (fiscoAvCobertura): a app só soma as rendas registadas, e quem começou a
     usá-la a meio do ano, recusou um planeado ou começou «a partir de hoje»
     deixa meses de fora sem o saber. E os contratos em vigor no ano sem
     nenhuma renda registada, que nem têm linha (o r.contratosSemRendas do
     resumo, ou fisco.js:fiscoContratosSemRendas). Os terminados sem o dia em
     que acabaram ficam de fora: o aviso deles vem primeiro */
  L.forEach(l=>{
    if(semDia[l.contratoId])return;
    const c=contract(l.contratoId),x=fiscoAvCobertura(c,ano,l);
    if(!c||!x.emVigor||x.comRenda>=x.emVigor)return;
    add('Contrato '+l.nome+': '+fiscoN(x.emVigor,'mês','meses')+' em vigor em '+ano+' e '+(x.comRenda?'só '+fiscoN(x.comRenda,'renda registada','rendas registadas'):'nenhuma renda registada desses meses')
      +' — se recebeste as outras, regista-as; as que não recebeste não se declaram',...verCt(l.contratoId),'aviso');
  });
  const semRendas=(Array.isArray(r.contratosSemRendas)||typeof fiscoContratosSemRendas!=='function'?(r.contratosSemRendas||[]):fiscoContratosSemRendas(r))
    .map(x=>{const id=(x&&(x.contratoId||x.id))||'',c=id?contract(id):null;return {contratoId:id,nome:String((x&&x.nome)||(c?ctName(c):''))}})
    .filter(x=>x.contratoId&&x.nome&&!semDia[x.contratoId]);
  if(semRendas.length)add((semRendas.length===1?'Contrato '+semRendas[0].nome+': em vigor em '+ano+' e sem nenhuma renda registada neste ano — se recebeste rendas dele, regista-as ligadas ao contrato'
    :semRendas.length+' contratos em vigor em '+ano+' sem nenhuma renda registada neste ano: '+listaE(semRendas.slice(0,5).map(x=>x.nome).concat(semRendas.length>5?[fiscoN(semRendas.length-5,'outro','outros')]:[]))
      +' — se recebeste rendas deles, regista-as ligadas a cada contrato')+'; as que não recebeste não se declaram',...umCt(semRendas),'aviso');
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
  /* as obras dos 24 meses antes do início de um contrato só contam se,
     entretanto, o imóvel não teve outro uso (CIRS art. 41.º n.º 7; PIV
     26713 — D28): por responder, ficam fora até à resposta (âmbar, o toque
     abre a pergunta do contrato, contrato.js:ctIrParaPergunta); com «não»,
     só se diz porque ficam fora */
  movs(r.obrasPorConfirmar).forEach(x=>{
    if(!x.contratoId)return;
    const c=contract(x.contratoId),nome=String(x.nome||(c?ctName(c):'')),val=euroS(Number(x.valor)||0);
    const toque=se('contracts',`ctIrParaPergunta('${jsq(x.contratoId)}','c_fobras')`,'camada');
    if(x.resposta===false)add('Contrato '+nome+': as obras dos 24 meses antes do início ('+val+') não contam nos gastos — respondeste no contrato que, entretanto, o imóvel teve outro uso (CIRS art. 41.º n.º 7)',...toque,'info');
    else add('Contrato '+nome+': as obras dos 24 meses antes do início ('+val+') ficam fora dos gastos até responderes, no contrato, se entretanto o imóvel esteve só à espera de inquilino, sem uso teu nem da família — só assim contam (CIRS art. 41.º n.º 7)',...toque,'aviso');
  });
  /* as despesas sem imóvel nenhum, de quem declara, com uma coluna dedutível
     ou a confirmar (r.semImovel, D68): não entram nos gastos de linha nenhuma */
  const SI=movs(r.semImovel);
  if(SI.length)add((SI.length===1?'Despesa de '+ano+' sem imóvel: '+listaMov(SI)+'. Não entra nos gastos do Anexo F: se é de um imóvel arrendado, escolhe-o na ficha dela'
    :fiscoN(SI.length,'despesa','despesas')+' de '+ano+' sem imóvel ('+totalDe(SI)+') não entram nos gastos do Anexo F: '+listaMov(SI)+'. Se são de um imóvel arrendado, escolhe-o na ficha de cada uma'),
    ...toqueMov(SI),'aviso');
  /* os reembolsos de um gasto (r.reembolsosGasto, D20): o do seguro não abate
     sozinho — não se sabe a que despesa pertence —, e um gasto que outro
     pagou não é teu (CIRS art. 41.º n.º 1); o do condomínio sem contrato já
     abateu ao condomínio do imóvel (Q7), e só se diz */
  const RG=movs(r.reembolsosGasto),RS=RG.filter(d=>d.tipo!=='condominio'),RC=RG.filter(d=>d.tipo==='condominio'&&Number(d.abatido)>0);
  if(RS.length)add((RS.length===1?'Reembolso do seguro de '+ano+': '+listaMov(RS)+'. Se reembolsa uma despesa que está nos gastos, abate-o a ela (diminui-lhe o valor)'
    :fiscoN(RS.length,'reembolso','reembolsos')+' do seguro de '+ano+' ('+totalDe(RS)+'): '+listaMov(RS)+'. Os que reembolsam uma despesa que está nos gastos abatem-se a ela (diminui-lhe o valor)')
    +': só conta o que pagaste de facto, e um gasto que outro pagou não é teu (CIRS art. 41.º n.º 1)',...toqueMov(RS),'aviso');
  if(RC.length){
    const ab=sum(RC.map(d=>Number(d.abatido)||0));
    add((RC.length===1?'O reembolso do condomínio de '+ano+' ('+listaMov(RC)+') abate':fiscoN(RC.length,'reembolso','reembolsos')+' do condomínio de '+ano+' ('+totalDe(RC)+') abatem')
      +' '+euroS(ab)+' ao condomínio dos gastos desta declaração: um gasto que te devolveram não é teu','','','info');
  }
  /* as despesas pagas sem contrato em vigor que contam por a coluna ter sido
     escolhida à mão na ficha (r.foraPorEscolha, D65): a escolha manda, e só
     se diz, para quem a fez sem querer a desfazer */
  const FE=movs(r.foraPorEscolha);
  if(FE.length)add((FE.length===1?'Despesa de '+ano+' paga com o imóvel sem contrato em vigor que conta nos gastos por teres escolhido a coluna na ficha: '+listaMov(FE)+'. Se não é deste período arrendado, volta a «Pela categoria» na ficha dela'
    :fiscoN(FE.length,'despesa','despesas')+' de '+ano+' pagas com o imóvel sem contrato em vigor ('+totalDe(FE)+') contam nos gastos por teres escolhido a coluna na ficha: '+listaMov(FE)+'. Se alguma não é deste período arrendado, volta a «Pela categoria» na ficha dela'),
    ...toqueMov(FE),'info');
  fiscoAvSplitwise(r).forEach(a=>add(a.texto,a.abrir,a.toca,a.nivel));
  /* o AIMI do quadro 9 (D32, D71): o pago sem «quem pagou» numa casa com
     mais do que um dono contou inteiro para quem declara; um prédio da lista
     sem a afetação da caderneta e com contrato não habitacional pode não ser
     dela (o AIMI não toca o comércio nem os serviços). Âmbar, com o toque */
  const aimi=r.aimi&&typeof r.aimi==='object'?r.aimi:{},q9=Q.aimi?'o quadro '+Q.aimi:'o quadro do AIMI';
  const semPag=(Array.isArray(aimi.semPagador)?aimi.semPagador:[]).filter(x=>x&&Number(x.valor)>0);
  if(semPag.length)add((semPag.length===1?'AIMI de '+euroS(Number(semPag[0].valor))+(semPag[0].imovel?' ('+semPag[0].imovel+')':'')+' sem quem o pagou: contou inteiro na tua declaração. Se o pagou outro proprietário, escolhe-o no movimento'
    :fiscoN(semPag.length,'pagamento','pagamentos')+' do AIMI ('+euroS(sum(semPag.map(x=>Number(x.valor))))+') sem quem os pagou: contaram inteiros na tua declaração. Se os pagou outro proprietário, escolhe-o em cada movimento')
    +' — o AIMI abate-se n'+q9+' só a quem o pagou',
    ...(semPag.length===1&&semPag[0].txId?se('transactions',`txView('${jsq(semPag[0].txId)}')`,'camada'):se('transactions',"go('transactions')",'ecra')),'aviso');
  const semAfet=(Array.isArray(aimi.afetacaoPorConfirmar)?aimi.afetacaoPorConfirmar:[]).filter(x=>x&&(x.propertyId||x.imovel));
  if(semAfet.length)add((semAfet.length===1?'Imóvel '+semAfet[0].imovel+': sem a afetação da caderneta, e com um contrato não habitacional'
    :fiscoN(semAfet.length,'imóvel','imóveis')+' sem a afetação da caderneta, e com contratos não habitacionais: '+listaE(semAfet.map(x=>String(x.imovel||''))))
    +' — '+q9+' (AIMI) conta-'+(semAfet.length===1?'o':'os')+', mas um prédio de comércio, serviços ou indústria não entra. Escreve a afetação na ficha do imóvel',
    ...(semAfet.length===1&&semAfet[0].propertyId?se('properties',`propView('${jsq(semAfet[0].propertyId)}')`,'camada'):se('properties',"go('properties')",'ecra')),'aviso');
  /* o prejuízo de anos anteriores que o imposto estimado já abate (Q10/D73,
     CIRS art. 55.º): a app só conta com o que tem, e a AT faz a conta com as
     declarações entregues, titular a titular — âmbar, sem toque */
  const rep=r.reporte&&typeof r.reporte==='object'?r.reporte:{},usado=Number(rep.usado)||0;
  if(usado>0){
    const semDados=(Array.isArray(rep.anosSemDados)?rep.anosSemDados:[]).map(Number).filter(y=>y>0).sort((a,b)=>a-b);
    const desce=Number(rep.imposto)||0;
    add('O imposto estimado já abate '+euroS(usado)+' de prejuízos de anos anteriores'+(desce>0?' (menos '+euroS(desce)+' de imposto)':'')
      +', com o que a app sabe. Pode faltar informação: imóveis que não estão na app'
      +(semDados.length?', '+(semDados.length===1?'o ano de '+semDados[0]:'os anos de '+listaE(semDados.map(String)))+', em que a app não tem registos,':'')
      +' e a condição do art. 55.º n.º 8 do CIRS — os prédios darem rendas em 36 meses dos cinco anos seguintes ao prejuízo. A AT faz a conta titular a titular, com as declarações que entregaste','','','aviso');
  }
  fiscoAvForaDoAnexoF(r).forEach(a=>add(a.texto,a.abrir,a.toca,a.nivel));
  if(F.length)add(fiscoN(F.length,'contrato marcado como não declarado fica','contratos marcados como não declarados ficam')+' fora deste resumo.','','','info');
  return out;
}
