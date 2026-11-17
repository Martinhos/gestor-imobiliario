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

/* O que há a tratar antes de preencher o quadro, cada ponto com o nível e o
   toque que abre a ficha onde se trata (com o serviço desligado, sem o
   toque). Um contrato conta uma vez, mesmo com uma linha por titular. Pela
   ordem: o ano sem versão própria das regras (D50: depois da última, âmbar;
   antes da primeira, vermelho), a versão provisória (cinzenta até a entrega
   abrir, depois âmbar com o dia da revisão, D49), os valores por inteiro
   sem sessão e a conjunta sem o cônjuge escolhido (D30, falta); os contratos por indicar, sem o n.º, sem início (D43), sem
   finalidade (D16), com inquilino pessoa coletiva num de habitação sem a
   confirmação (D47, sem mudar a natureza nem a taxa); o fim — terminado sem
   o dia (D02, fiscoAvSemCessacao), no quadro 10 sem o motivo (D09), a
   regularização do art. 72.º n.º 20 (D10); as rendas depois do termo (D15);
   a comunicação da duração de cada período, âmbar por fazer e falta depois
   do prazo, e o 4.2C em «Não sei» (D12); a isenção que não conta (D46); os
   inquilinos sem NIF nem país; os imóveis sem os dados matriciais ou com
   várias frações (D69); o Modelo 44 ou os recibos; o selo do contrato que
   começou no ano, que um de antes da celebração não cala (D27,
   fiscoAvSeloDoContrato); as rendas sem contrato (D34); a taxa escrita
   (D17); por contrato (fiscoAvAnaliseDasRendas), as retenções (D23, D58), os
   meses com duas rendas (D88) e as antecipadas (D56), «confirma no recibo»;
   os meses em vigor sem renda e os contratos sem renda nenhuma (D04,
   fiscoAvCobertura); as despesas «a confirmar», por categoria (D06, D07,
   D24–D27, D60, D61); as pagas sem contrato e as obras soltas; o AIMI sem
   quem o pagou e os prédios sem a afetação (D32, D71); o prejuízo de
   anos anteriores que o imposto estimado abate (Q10); e, sem toque, os não
   declarados (uma escolha, não uma falta).
   Recebe: r — o resumo inteiro (resumoFiscal), menos os avisos: ano,
   titulares, linhas (faltas, quadro, taxa, taxaEscrita, inquilinos,
   celebracao, acimaDoLimite, comunicacao, mesesEmVigor, mesesComRenda…),
   fora, semContrato, aConfirmar (sem ele, o número semRegra), obrasSoltas,
   foraDoPeriodo, semSessao, semConjuge (sem ele, fiscoTitulares do
   titularId), contratosSemRendas, cessados, regularizacoes, aimi e reporte. O que falte lê-se como vazio; a comunicação, os meses e os
   contratos sem rendas, sem eles, contam-se da base.
   Devolve: [{texto, abrir, toca, nivel}] — abrir o código do onclick (''
   sem ação); toca 'camada' (abre uma ficha) ou 'ecra' (muda de ecrã); nivel
   'falta' (o que a AT pede e não está, ou números que não servem), 'aviso'
   (o que convém tratar antes de entregar) ou 'info' (o que só se diz). */
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
  (Array.isArray(r.regularizacoes)?r.regularizacoes:[]).forEach(x=>{
    if(!x||!x.contratoId||!(Number(x.total)>0))return;
    const c=contract(x.contratoId),nome=x.nome||(c?ctName(c):'');
    const anos=(x.anos||[]).filter(y=>y&&Number(y.diferenca)>0).map(y=>y.ano+': '+euroS(Number(y.diferenca)));
    add('Contrato '+nome+': acabou antes do prazo por motivo do senhorio'+(m01&&m01.codigo&&Q.cessados?' (o motivo '+m01.codigo+' do quadro '+Q.cessados+')':'')+'. A redução pela duração do período em que acabou cai (CIRS art. 72.º n.º 20), e a diferença de imposto dos anos dele já declarados paga-se com esta declaração, com juros compensatórios — a app estima '
      +euroS(Number(x.total))+' sem os juros'+(anos.length?' ('+anos.join('; ')+')':''),...verCt(x.contratoId),'falta');
  });
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
  if(F.length)add(fiscoN(F.length,'contrato marcado como não declarado fica','contratos marcados como não declarados ficam')+' fora deste resumo.','','','info');
  return out;
}
