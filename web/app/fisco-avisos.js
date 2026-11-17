/* ================= FISCO · AVISOS =================
   O que há a tratar antes de preencher o quadro (fiscoAvisos): lê o resumo
   inteiro (resumoFiscal) e devolve os avisos, cada um com o toque que leva
   ao sítio certo. Partiu-se do fisco.js (KAN-125). */

/* O que há a tratar antes de preencher o quadro: contratos por indicar,
   declarados sem número, inquilinos sem NIF, imóveis sem os dados matriciais,
   rendas sem recibo ou sem contrato, despesas sem regra ou pagas com o imóvel
   vazio, o imposto do selo de um contrato que começou no ano — cada um com o
   toque que leva ao sítio certo. Os contratos não declarados são o último,
   sem toque e sem pedido: não são uma falta, são uma escolha, e diz-se só que
   ficam fora. Cada toque abre a ficha de outro serviço (contratos,
   inquilinos, imóveis, movimentos): com esse serviço desligado nesta conta o
   aviso fica, que a falta é a mesma, mas sem o toque. Com a dispensa dos
   recibos ligada (fiscoIrsDefs), as rendas sem recibo não são falta e entra
   em vez delas a linha do Modelo 44, com o prazo (fiscoPrazoModelo44).
   À cabeça, o que vale para o ano inteiro e não se trata em ficha nenhuma:
   um ano sem versão própria das regras (o `exato` do irs.js:irsAno) usa as
   de outro, e as taxas e os quadros podem ter mudado — âmbar; e uma versão
   ainda provisória (o Anexo F do ano por aprovar) diz-se com o texto dela —
   cinzento; e, logo a seguir, os valores por inteiro quando não há sessão e
   há vários proprietários (fiscoTitulares) — âmbar, que não são os de
   ninguém. O que é de um contrato conta-se uma vez, mesmo com uma linha por
   titular (a conjunta).
   Recebe: r — o resumo inteiro (resumoFiscal), já com tudo menos os avisos:
   ano, linhas, fora (os contratos fora), semContrato (as rendas sem contrato),
   semRegra (n.º de despesas sem regra de dedução), obrasSoltas (n.º de
   despesas marcadas como obras24 sem contrato a seguir), foraDoPeriodo (n.º
   de despesas pagas sem contrato em vigor) e semSessao (true quando os
   valores vão por inteiro por falta de sessão).
   Cada aviso diz também o seu nível, para o selo da página: 'falta' (um dado
   que a AT pede e não está — o contrato, o NIF, a matriz), 'aviso' (o que
   convém tratar antes de entregar) e 'info' (o que só se diz: o Modelo 44 por
   entregar e os não declarados).
   Devolve: [{texto, abrir, toca, nivel}] — abrir é o código do onclick ('' sem
   ação); toca a família do ponto ('camada' abre uma ficha, 'ecra' muda de
   ecrã); nivel 'falta', 'aviso' ou 'info'. */
function fiscoAvisos(r){
  const ano=r.ano,F=r.fora,S=r.semContrato,semRegra=r.semRegra,obrasSoltas=r.obrasSoltas,foraDoPeriodo=r.foraDoPeriodo,semSessao=r.semSessao;
  let L=r.linhas;
  const out=[],add=(texto,abrir,toca,nivel)=>out.push({texto:texto,abrir:abrir||'',toca:toca||'',nivel:nivel||'aviso'});
  /* o toque só se o serviço que ele abre está ligado; senão [abrir, toca] vazios */
  const se=(id,abrir,toca)=>servicoLigado(id)?[abrir,toca]:['',''];
  const v=irsAno(ano);
  if(!v.exato)add('Ainda não há versão das regras de '+ano+'. '+(v.pedido>v.ano
    ?'Usam-se as de '+v.ano+', a mais recente, com as datas passadas para '+ano+' — as taxas e os quadros podem ter mudado.'
    :'Usam-se as de '+v.ano+', a mais antiga que a app tem.'),'','','aviso');
  else if(v.modelo&&!v.modelo.oficial&&v.modelo.texto)add(v.modelo.texto,'','','info');
  if(semSessao)add('Sem sessão não se sabe qual dos proprietários és: os valores vão por inteiro, de todos, e não pela tua quota-parte. O Anexo F é por titular.','','','aviso');
  /* os avisos de um contrato contam-no uma vez: em conjunta, um imóvel dos
     dois tem uma linha por titular */
  const visto={};L=L.filter(l=>!visto[l.contratoId]&&(visto[l.contratoId]=1));
  const umCt=ls=>ls.length===1?se('contracts',`ctView('${jsq(ls[0].contratoId)}')`,'camada'):se('contracts',"go('contracts')",'ecra');
  const porIndicar=L.filter(l=>!l.estado);
  if(porIndicar.length)add(porIndicar.length===1?'Contrato '+porIndicar[0].nome+': por indicar se foi declarado à AT'
    :porIndicar.length+' contratos com rendas em '+ano+' por indicar se foram declarados à AT',...umCt(porIndicar),'falta');
  const semNum=L.filter(l=>l.estado==='declarado'&&!l.atNumero);
  if(semNum.length)add(semNum.length===1?'Contrato '+semNum[0].nome+': declarado à AT, sem o n.º do contrato'
    :semNum.length+' contratos declarados à AT sem o n.º do contrato',...umCt(semNum),'falta');
  const semFin=L.filter(l=>l.taxaReduzida&&l.faltas.some(x=>/^finalidade/.test(x)));
  if(semFin.length)add(semFin.length===1?'Contrato '+semFin[0].nome+': diz se é habitação permanente — a redução pela duração depende disso'
    :semFin.length+' contratos longos sem finalidade: a redução pela duração é só da habitação permanente',...umCt(semFin),'falta');
  const vistos={};
  L.forEach(l=>l.inquilinos.forEach(t=>{
    if(vistos[t.id])return;vistos[t.id]=1;
    const v=nifValido(t.nif);
    if(v===false)add('Inquilino '+t.nome+': o NIF não bate certo',...se('tenants',`personView('tenant','${jsq(t.id)}')`,'camada'),'falta');
    else if(v===null&&!String(t.pais||'').trim())add('Inquilino '+t.nome+': sem NIF nem país de residência',...se('tenants',`personView('tenant','${jsq(t.id)}')`,'camada'),'falta');
  }));
  const imv={};
  L.forEach(l=>{
    if(!l.propertyId||imv[l.propertyId])return;imv[l.propertyId]=1;
    const falta=[!l.freguesiaCodigo?'código da freguesia':'',!l.tipoPredio?'tipo de prédio':'',!l.artigo?'artigo matricial':''].filter(Boolean);
    if(falta.length)add('Imóvel '+l.imovel+': sem '+listaE(falta),...se('properties',`propView('${jsq(l.propertyId)}')`,'camada'),'falta');
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
  const semSelo=L.filter(l=>l.estado==='declarado'&&l.inicio.slice(0,4)===String(ano)&&fimDoMesSeguinte(l.inicio).slice(0,4)===String(ano)&&!(l.gastos.selo>0));
  if(semSelo.length)add((semSelo.length===1?'Contrato '+semSelo[0].nome+': começou em '+ano+' e não há imposto do selo nos gastos'
    :semSelo.length+' contratos começaram em '+ano+' sem imposto do selo nos gastos')+' — o que se paga com o Modelo 2 (10 % de uma renda) é dedutível: regista-o como despesa, em Impostos › Imposto do selo',
    ...se('transactions',"go('transactions')",'ecra'));
  const nSem=sum(S.map(s=>s.n));
  if(nSem)add(fiscoN(nSem,'renda','rendas')+' de '+ano+' sem contrato ligado '+(nSem===1?'fica':'ficam')+' fora do quadro',
    ...(nSem===1?se('transactions',`txView('${jsq(S[0].ids[0])}')`,'camada'):se('transactions',"go('transactions')",'ecra')));
  if(semRegra)add(fiscoN(semRegra,'despesa sem regra de dedução conta','despesas sem regra de dedução contam')+' em Outros: define-a nas Definições → Categorias, etiquetas e IRS',
    "go('settings');goSet('irs')",'ecra');
  if(foraDoPeriodo)add(fiscoN(foraDoPeriodo,'despesa paga','despesas pagas')+' em '+ano+' com o imóvel sem contrato em vigor '+(foraDoPeriodo===1?'fica':'ficam')+' fora: só conta o período arrendado. Se é deste período, corrige as datas do contrato ou escolhe a coluna na ficha da despesa',
    ...se('transactions',"go('transactions')",'ecra'));
  if(obrasSoltas)add(fiscoN(obrasSoltas,'despesa marcada como obras dos 24 meses','despesas marcadas como obras dos 24 meses')+' de '+ano+' sem contrato a começar depois: '+(obrasSoltas===1?'fica':'ficam')+' fora até o haver',
    ...se('transactions',"go('transactions')",'ecra'));
  if(F.length)add(fiscoN(F.length,'contrato marcado como não declarado fica','contratos marcados como não declarados ficam')+' fora deste resumo.','','','info');
  return out;
}
