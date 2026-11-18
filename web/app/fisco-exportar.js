/* ================= FISCO · EXPORTAR =================
   O resumo do Anexo F fora da página: em texto simples (fiscoTexto) e em CSV
   (fiscoCsv, com o conteúdo no fiscoCsvTexto). Os mesmos números da página,
   de quem declara. O PDF é o fisco-pdf.js, que usa os ajudantes de cá (a linha
   das regras, o prazo das substituições do quadro 8, o NIF ou o país de cada
   inquilino, o imposto e o prejuízo de cada linha). Partiu-se do fisco.js
   (KAN-125). Todas as saídas acabam no aviso aprovado (irs.js:IRS_AVISO). */

/* O que o resultado negativo vale, como o CIRS art. 55.º o diz (n.º 1 e n.º 8):
   reporta-se aos seis anos seguintes só se os prédios desses gastos derem
   rendas 36 meses nos cinco anos seguintes, e o reporte é de cada titular. O
   texto e o PDF escrevem-no igual. */
const FISCO_PREJUIZO_NOTA='Não se perde: abate às rendas dos seis anos seguintes, desde que os prédios desses gastos deem rendas durante pelo menos 36 meses nos cinco anos seguintes (CIRS art. 55.º n.º 8); a AT faz a conta, titular a titular.';

/* A linha das regras com que o resumo se fez, para o PDF, o CSV e o texto:
   o ano da versão, se é a oficial ou a provisória, o dia em que foi revista
   (irsAno(ano).revisto; uma versão emprestada a outro ano não o tem) e a
   versão da app, quando a app a sabe (o VERSAO do avisos.js). Numa correção
   da AT, é o que mostra com que regras o resumo se fez.
   Um ano antes da primeira versão (fiscoExpSemRegras) di-lo sem rodeios: as
   taxas, os quadros e os códigos podem ser outros (D50).
   Recebe: r — o resumo (resumoFiscal).
   Devolve: a frase, ex.: «Regras de 2025 (oficiais), revistas a 17/11/2026 ·
   versão da app 77». */
function fiscoRegrasTexto(r){
  const v=r.versao||{},app=typeof VERSAO!=='undefined'&&VERSAO!=null&&VERSAO!==''?' · versão da app '+VERSAO:'';
  if(fiscoExpSemRegras(r))return 'A app não tem as regras de '+r.ano+': as taxas, os quadros e os códigos podem ser outros, e a taxa e o imposto estimado não se mostram (usam-se as de '+v.ano+' só para arrumar as rendas e os gastos)'+app;
  if(!v.exato)return 'Ainda sem regras de '+r.ano+': usam-se as de '+v.ano+app;
  return 'Regras de '+v.ano+' ('+(v.modelo&&v.modelo.oficial?'oficiais':'provisórias')+')'+(v.revisto?', revistas a '+dPT(v.revisto):'')+app;
}
/* O último dia para as declarações de substituição dos anos anteriores
   (quadro 8B): 30 dias depois do fim do prazo da entrega do ano
   (irsAno(ano).entrega.ate; CIRS art. 74.º e art. 60.º). Contado em UTC,
   para a mudança da hora não tirar um dia.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: 'AAAA-MM-DD', ou '' sem o prazo da entrega na versão. */
function fiscoSubstituicaoAte(r){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(((r.versao||{}).entrega||{}).ate||''));if(!m)return '';
  const d=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])+30));
  return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0')+'-'+String(d.getUTCDate()).padStart(2,'0');
}
/* O que o quadro 8 diz de quem recebeu rendas de anos anteriores, com o prazo
   das substituições (D84), as retenções de cada ano que o 8B pede e a regra
   de um pagamento de vários anos (D55). O texto e o PDF escrevem-no igual.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: a frase. */
function fiscoQuadro8Texto(r){
  const ate=fiscoSubstituicaoAte(r);
  return 'No 8A se optares pelo englobamento (o valor reparte-se pelos anos a que respeita), ou no 8B se entregares declarações de substituição desses anos, até cinco para trás'
    +(ate?', até '+dPT(ate)+' (30 dias depois do fim do prazo da entrega)':'')+'. Em cada linha do quadro 8 vai o campo do 4.1 ou do 4.2 de onde a renda é, e no 8B também as retenções e os gastos de cada ano.'
    +' O quadro pede uma linha por ano a que as rendas respeitam: um pagamento de vários anos regista-se num movimento por ano, cada um com o mês a que respeita.';
}
/* Como um inquilino se identifica no Anexo F: pelo NIF português, ou, sem
   ele, pelo país de residência. Um número estrangeiro (letras, outro
   comprimento) não vai na coluna do NIF: com o país escrito, vale o país, e
   não se acusa o NIF (D59): a coluna do NIF português fica vazia e o país vai
   com o código da tabela X das instruções do Anexo J (fiscoExpPais). O NIF é
   válido pelo irs-papeis.js:nifValido.
   Recebe: t — o inquilino da linha ({nome, nif, pais}).
   Devolve: {nif, pais, valido, texto} — nif o NIF português ('' sem ele; um NIF que
   não bate certo e sem país vai como foi escrito, para se ver o erro), pais
   o país quando é ele que vale, valido true só com o NIF português que bate
   certo, e texto a forma curta para ler («NIF
   123456789», «NIF português — · país Espanha · código do país da tabela X
   das instruções do Anexo J», «NIF 12345 — não bate certo», «falta o NIF ou
   o país»). */
function fiscoIdInquilino(t){
  const nif=String((t&&t.nif)||'').trim(),pais=String((t&&t.pais)||'').trim(),ok=nifValido(nif);
  if(ok===true)return {nif:nif,pais:'',valido:true,texto:'NIF '+nif};
  if(pais)return {nif:'',pais:pais,valido:false,texto:'NIF português — · país '+fiscoExpPais(t)};
  if(nif)return {nif:nif,pais:'',valido:false,texto:'NIF '+nif+' — não bate certo'};
  return {nif:'',pais:'',valido:false,texto:'falta o NIF ou o país'};
}
/* O imposto estimado de uma linha, nunca negativo (D98): uma linha com mais
   gastos do que rendas não paga, e o que sobra é prejuízo (fiscoPrejuizoLinha).
   Recebe: l — a linha do resumo.
   Devolve: euros (≥ 0). */
function fiscoImpostoLinha(l){return Math.max(0,r2(Number(l.imposto)||0))}
/* O prejuízo de uma linha: o do resumo (l.prejuizo, fisco-resumo.js) e, se
   ele ainda não o tiver, o líquido negativo de uma linha que não é isenta.
   Recebe: l — a linha do resumo.
   Devolve: euros (≥ 0). */
function fiscoPrejuizoLinha(l){
  if(l.prejuizo!=null&&isFinite(Number(l.prejuizo)))return Math.max(0,r2(Number(l.prejuizo)));
  return l.isencao?0:Math.max(0,r2(-(Number(l.liquido)||0)));
}
/* O prejuízo a reportar do ano, por titular (o reporte é de cada um, CIRS
   art. 55.º n.º 1): pelo totais.porTitular do resumo, com a letra de cada um
   tirada das linhas; sem ele, o totais.prejuizo, sem letra.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: [{letra, valor}] só com os que têm prejuízo; letra '' quando há um
   titular só ou não se sabe. */
function fiscoPrejuizos(r){
  const T=r.totais||{},pt=T.porTitular;
  if(pt&&typeof pt==='object'){
    const letra=fiscoExpLetras(r);
    const ks=Object.keys(pt).filter(k=>pt[k]&&Number(pt[k].prejuizo)>0);
    return ks.map(k=>({letra:r.variosTitulares?(letra[k]||''):'',valor:r2(Number(pt[k].prejuizo))}))
      .sort((a,b)=>String(a.letra).localeCompare(String(b.letra)));
  }
  return Number(T.prejuizo)>0?[{letra:'',valor:r2(Number(T.prejuizo))}]:[];
}
/* O que se escreve do prejuízo à frente dos totais: o valor (de cada titular,
   em conjunta) e a condição do reporte (FISCO_PREJUIZO_NOTA).
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o texto, ou '' sem prejuízo. */
function fiscoPrejuizoTexto(r){
  const ps=fiscoPrejuizos(r);if(!ps.length)return '';
  return 'Prejuízo a reportar '+ps.map(p=>(p.letra?'do titular '+p.letra+' ':'')+euro2(p.valor)).join(' e ')+'. '+FISCO_PREJUIZO_NOTA;
}
/* O nome de um nível de «A tratar», como o CSV o escreve.
   Recebe: a — o aviso ({nivel}).
   Devolve: 'falta', 'aviso' ou 'nota'. */
function fiscoNivelNome(a){return a&&a.nivel==='falta'?'falta':a&&a.nivel==='info'?'nota':'aviso'}

/* Os ajudantes que o texto, o CSV e o PDF partilham para os contratos (vaga 2
   da auditoria ao IRS). Leem os campos do resumo (fisco-resumo.js, plano §1.4
   «Vaga 2» e o r.reporte) com cuidado: um resumo que ainda não os tenha cai
   no que se sabe do contrato, ou no que havia antes. */

/* Se o ano não tem regras na app: um ano antes da primeira versão, feito
   com uma versão emprestada de um ano mais à frente (D50). A taxa e o imposto
   estimado não se mostram (os cartões, o PDF, o CSV e o texto). O resumo
   di-lo em r.semRegrasDoAno; sem ele, vê-se pela versão.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: true ou false. */
function fiscoExpSemRegras(r){
  if(r&&typeof r.semRegrasDoAno==='boolean')return r.semRegrasDoAno;
  const v=(r&&r.versao)||{};
  return v.exato===false&&Number(v.ano)>Number(r&&r.ano);
}
/* A resposta do 4.2A à comunicação da duração (Portaria 110/2019), pelo
   período em que as rendas do ano assentam (D01): faz-se uma vez, até 15 de
   fevereiro do ano seguinte ao início do contrato ou de cada renovação, e o
   4.2A pergunta se foi feita até lá. Feita depois é NÃO (D35); por fazer com
   o prazo passado também. O período vem do resumo (l.comunicacao,
   irs.js:irsComunicacaoDoAno); sem ele, do contrato; sem o contrato, do
   l.comunicado de antes.
   Recebe: r — o resumo; l — a linha (do quadro 4.2).
   Devolve: null quando não há nada a comunicar; senão {resposta ('sim',
   'nao', ou '' por fazer com o prazo à frente), data, prazo, periodoInicio
   ('AAAA-MM-DD' ou ''), foraDePrazo, texto} — texto a forma curta, ex.:
   «comunicada a 10/02/2025», «comunicada fora do prazo (a 20/03/2026; o
   prazo era 15/02/2026) — no 4.2A é NÃO», «por comunicar · até 15/02/2027». */
function fiscoExpComunicacao(r,l){
  if(!l)return null;
  let x=l.comunicacao;
  if(x===undefined){
    const c=typeof contract==='function'?contract(l.contratoId):null;
    if(c&&typeof irsComunicacaoDoAno==='function')x=irsComunicacaoDoAno(c,r.ano);
    else if(l.comunicado!=null)x={data:l.comunicado,prazo:'',periodoInicio:'',foraDePrazo:false};
  }
  if(!x||typeof x!=='object')return null;
  const Q=(((r||{}).versao||{}).quadros||{}).datas||'4.2A';
  const data=String(x.data||''),prazo=String(x.prazo||''),fora=!!data&&(x.foraDePrazo===true||(!!prazo&&data>prazo));
  const passou=!data&&!!prazo&&prazo<today();
  return {resposta:data&&!fora?'sim':fora||passou?'nao':'',data:data,prazo:prazo,periodoInicio:String(x.periodoInicio||''),foraDePrazo:fora,
    texto:data&&!fora?'comunicada a '+dPT(data)
      :fora?'comunicada fora do prazo (a '+dPT(data)+(prazo?'; o prazo era '+dPT(prazo):'')+') — no '+Q+' é NÃO'
      :passou?'por comunicar (o prazo acabou a '+dPT(prazo)+') — no '+Q+' é NÃO'
      :'por comunicar'+(prazo?' · até '+dPT(prazo):'')};
}
/* Se a linha do 4.2 leva o 4.2B: o contrato novo com a renda pelo menos 5 %
   abaixo da do anterior (o n.º 24 do art. 72.º), mesmo quando a estimativa
   não desce a taxa por já estar no mínimo (D36) — o 4.2B é um facto, e a
   taxa decide-a a AT. O resumo dá-o em l.elegivel24; sem ele, o contrato
   (irs.js:irsReducao); o l.bonus (a taxa desceu) também conta.
   Recebe: r — o resumo; l — a linha.
   Devolve: true ou false. */
function fiscoExpElegivel24(r,l){
  if(!l||l.isencao)return false;
  if(l.bonus)return true;
  if(typeof l.elegivel24==='boolean')return l.elegivel24;
  const c=typeof contract==='function'?contract(l.contratoId):null;
  const red=c&&typeof irsReducao==='function'?irsReducao(c,r.ano):null;
  return !!(red&&red.elegivel24);
}
/* A taxa de uma linha como a AT a aplica: com uma renovação a meio do ano,
   cada parte das rendas à taxa do seu período (D41, OC 20217/2020); com
   rendas depois do termo sem renovação registada, essas à taxa base (D15).
   Os troços vêm do resumo (l.segmentos, só os que têm rendas, os seguidos
   com a mesma taxa juntos); sem eles, a taxa da linha. Sem regras do ano,
   não há taxa (D50).
   Recebe: r — o resumo; l — a linha (não isenta).
   Devolve: {texto, partes} — texto ex.: «23 % até 30/06/2025, 13 % depois»,
   «15 % até 28/02/2025, 25 % depois do termo, sem renovação registada», ou
   «10 %»; partes os troços juntos ([{taxa, de, ate, semRenovacao}]; mais do
   que um só quando a taxa muda no ano). */
function fiscoExpTaxa(r,l){
  if(fiscoExpSemRegras(r))return {texto:'por conhecer (a app não tem as regras de '+r.ano+')',partes:[]};
  const ps=[];
  (Array.isArray(l.segmentos)?l.segmentos:[]).forEach(s=>{
    if(!s||(s.rendas!=null&&!(Number(s.rendas)>0)))return;
    const u=ps[ps.length-1],sr=!!s.semRenovacao;
    if(u&&Number(u.taxa)===Number(s.taxa)&&u.semRenovacao===sr){u.ate=s.ate;return}
    ps.push({taxa:Number(s.taxa)||0,de:s.de||'',ate:s.ate||'',semRenovacao:sr});
  });
  const fim=p=>dec(p.taxa)+' %'+(p.semRenovacao?' depois do termo, sem renovação registada':'');
  if(ps.length<2)return {texto:ps.length&&ps[0].semRenovacao?fim(ps[0]):dec(ps.length?ps[0].taxa:l.taxa)+' %',partes:ps};
  return {texto:ps.map((p,i)=>i<ps.length-1?dec(p.taxa)+' % até '+dPT(p.ate):p.semRenovacao?fim(p):dec(p.taxa)+' % depois').join(', '),partes:ps};
}
/* O que ainda não se sabe do modelo do ano, numa linha, quando o Anexo F do
   ano não está aprovado (a versão provisória, D49): nas rendas moderadas, o
   campo onde se assinala a taxa de 10 % (EBF art. 45.º-C); num isento de um
   quadro com código, o código que a versão ainda não tem.
   Recebe: r — o resumo; l — a linha.
   Devolve: null, ou {campo, valor} — ex.: {campo:'Taxa de 10 % (EBF art.
   45.º-C)', valor:'campo do modelo novo por conhecer'}. */
function fiscoExpPorConhecer(r,l){
  const v=(r&&r.versao)||{};
  if(!l||(v.modelo&&v.modelo.oficial)||fiscoExpSemRegras(r))return null;
  if(l.isencao){
    const is=(v.isencoes||[]).find(x=>x&&x.id===l.isencao.id);
    return !l.isencao.codigo&&!(is&&is.semCodigo)?{campo:'Código do quadro '+(l.isencao.quadro||'6D'),valor:'do modelo novo, por conhecer'}:null;
  }
  const m=(v.taxas||{}).rendaModerada;
  const mod=l.motivoTaxa==='moderada'||(Array.isArray(l.segmentos)&&l.segmentos.some(s=>s&&s.motivo==='moderada'));
  return mod?{campo:'Taxa de '+dec(m&&m.taxa||10)+' % (EBF art. 45.º-C)',valor:'campo do modelo novo por conhecer'}:null;
}
/* Os limites de renda do n.º 23 do art. 72.º que o 4.2C pergunta, como a
   versão do ano os escreve (taxas.limiteRendaAlta.portaria, cada um com as
   datas em que vale), e não uma portaria escrita à mão (D78).
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o texto, ex.: «os limites gerais por tipologia e concelho das
   tabelas 1 e 2 do anexo I à Portaria 176/2019, de 6 de junho»; com mais do
   que um no ano, cada um com as datas («até 31/08/2026, …; desde 14/10/2026,
   …»); '' sem nada na versão. */
function fiscoExpLimites23(r){
  const L=((((r||{}).versao||{}).taxas)||{}).limiteRendaAlta||{},i=r.ano+'-01-01',f=r.ano+'-12-31';
  const ps=(Array.isArray(L.portaria)?L.portaria:[]).filter(p=>p&&(!p.ate||p.ate>=i)&&(!p.desde||p.desde<=f));
  const txt=p=>String(p.texto||p.portaria||'');
  if(ps.length<2)return ps.length?txt(ps[0]):'';
  return ps.map(p=>{
    const de=p.desde&&p.desde>i,ate=p.ate&&p.ate<f;
    return (de&&ate?'de '+dPT(p.desde)+' a '+dPT(p.ate):ate?'até '+dPT(p.ate):de?'desde '+dPT(p.desde):'em '+r.ano)+', '+txt(p);
  }).join('; ');
}
/* Os contratos do quadro 10 (os que acabaram no ano e tiveram redução ou
   isenção, D09), com os textos das tabelas da versão (quadro10.regimes e
   .motivos) e, no motivo que regulariza (o 01, art. 72.º n.º 20), a
   diferença estimada (D10, r.regularizacoes do resumo).
   Recebe: r — o resumo (resumoFiscal).
   Devolve: [{contratoId, nome, imovel, numero, regime, regimeTexto,
   anoInicioBeneficio, data, motivo, motivoCurto, regulariza, faltas,
   regularizacao}] — regularizacao null ou {anos:[{ano, diferenca}], total};
   faltas o que o quadro pede e não há. */
function fiscoExpQuadro10(r){
  const q=(((r||{}).versao||{}).quadro10)||{},rs=Array.isArray(q.regimes)?q.regimes:[],ms=Array.isArray(q.motivos)?q.motivos:[];
  const regs={};(Array.isArray(r.regularizacoes)?r.regularizacoes:[]).forEach(x=>{if(x&&x.contratoId!=null)regs[x.contratoId]=x});
  return (Array.isArray(r.cessados)?r.cessados:[]).filter(Boolean).map(c=>{
    const regime=String(c.regime||''),motivo=String(c.motivo||''),rg=rs.find(x=>x&&String(x.codigo)===regime),m=ms.find(x=>x&&String(x.codigo)===motivo);
    const g=regs[c.contratoId],anos=g&&Array.isArray(g.anos)?g.anos.filter(a=>a&&Number(a.diferenca)):[];
    const total=g?r2(Number(g.total)||sum(anos.map(a=>Number(a.diferenca)||0))):0;
    const faltas=[];
    if(!c.numero)faltas.push('n.º do contrato na AT');
    if(!regime)faltas.push('regime fiscal');
    if(!c.anoInicioBeneficio)faltas.push('ano de início do benefício');
    if(!motivo)faltas.push('motivo da cessação');
    return {contratoId:c.contratoId,nome:c.nome||'',imovel:c.imovel||'',numero:c.numero||'',regime:regime,regimeTexto:rg?String(rg.texto||''):'',
      anoInicioBeneficio:c.anoInicioBeneficio?String(c.anoInicioBeneficio):'',data:c.data||'',motivo:motivo,motivoCurto:m?String(m.curto||m.texto||''):'',
      regulariza:!!(m&&m.regulariza),faltas:faltas,
      regularizacao:g&&total>0?{anos:anos.map(a=>({ano:a.ano,diferenca:r2(Number(a.diferenca))})),total:total}:null};
  });
}
/* A frase da regularização de um contrato do quadro 10 com o motivo 01
   (art. 72.º n.º 20): a diferença estimada, ano a ano, sem juros.
   Recebe: r — o resumo; g — a regularizacao de fiscoExpQuadro10.
   Devolve: o texto. */
function fiscoExpRegularizacaoTexto(r,g){
  return 'diferença estimada de '+euro2(g.total)+(g.anos.length?' ('+g.anos.map(a=>a.ano+': '+euro2(a.diferenca)).join('; ')+')':'')
    +', sem os juros compensatórios: com a cessação antes do prazo por motivo do senhorio, o período em que o contrato acabou passa à taxa da duração efetivamente decorrida (CIRS art. 72.º n.º 20), e a diferença acresce ao imposto de '+r.ano;
}
/* O abate dos prejuízos de anos anteriores ao imposto estimado (rev. 6 do
   contrato, Q10/D73): o r.reporte do resumo, com o imposto depois dele
   (totais.impostoDepoisDoReporte). Lido com cuidado: sem nada abatido,
   null.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: null, ou {usado, imposto, antes, depois, resto, porTitular:[{letra,
   usado, resto}], anosSemDados:[AAAA]} — usado o que abate ao líquido,
   imposto quanto o imposto estimado desce, antes e depois o imposto estimado
   sem e com o abate, resto o que fica para os anos seguintes. */
function fiscoExpReporte(r){
  const R=r&&r.reporte;if(!R||typeof R!=='object')return null;
  const usado=r2(Number(R.usado)||0);if(!(usado>0))return null;
  const T=r.totais||{},antes=Math.max(0,r2(Number(T.imposto)||0)),desce=Math.max(0,r2(Number(R.imposto)||0));
  const depois=typeof T.impostoDepoisDoReporte==='number'&&isFinite(T.impostoDepoisDoReporte)?Math.max(0,r2(T.impostoDepoisDoReporte)):Math.max(0,r2(antes-desce));
  const letra=fiscoExpLetras(r);
  const pt=R.porTitular&&typeof R.porTitular==='object'?R.porTitular:{};
  const tits=Object.keys(pt).filter(k=>pt[k]&&Number(pt[k].usado)>0)
    .map(k=>({letra:r.variosTitulares?(letra[k]||''):'',usado:r2(Number(pt[k].usado)),resto:r2(Number(pt[k].resto)||0)}))
    .sort((a,b)=>String(a.letra).localeCompare(String(b.letra)));
  return {usado:usado,imposto:desce,antes:antes,depois:depois,resto:r2(sum(Object.keys(pt).map(k=>Number((pt[k]||{}).resto)||0))),porTitular:tits,
    anosSemDados:(Array.isArray(R.anosSemDados)?R.anosSemDados:[]).filter(a=>/^\d{4}$/.test(String(a))).map(String)};
}
/* O abate dos prejuízos de anos anteriores numa frase, para o texto, o CSV e
   o PDF: quanto abate (de cada titular, em conjunta), quanto desce o imposto
   e em quanto fica, e o que pode faltar à conta da app.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o texto, ou '' sem abate. */
function fiscoExpReporteTexto(r){
  const x=fiscoExpReporte(r);if(!x)return '';
  const quem=x.porTitular.some(t=>t.letra)?' ('+x.porTitular.map(t=>(t.letra?'titular '+t.letra+' ':'')+euro2(t.usado)).join(' e ')+')':'';
  return 'Prejuízos de anos anteriores: abatem '+euro2(x.usado)+quem+' ao rendimento líquido; o imposto estimado desce '+euro2(x.imposto)+' e fica em '+euro2(x.depois)+'.'
    +(x.resto>0?' Ficam '+euro2(x.resto)+' para os anos seguintes.':'')
    +' A conta é feita com o que a app sabe e pode faltar informação: imóveis fora da app, anos sem registos'+(x.anosSemDados.length?' ('+listaE(x.anosSemDados)+')':'')
    +' e a condição de os prédios darem rendas 36 meses nos cinco anos seguintes (CIRS art. 55.º n.º 8). A AT faz a conta, titular a titular.';
}
/* Os impostos do ano pela ordem em que se abatem, os mesmos números do KPI
   da página (fisco.js:fiscoKpis): o estimado das linhas; depois dos
   prejuízos de anos anteriores (fisco.js:fiscoImpostoDoKpi, rev6 §6.1);
   depois do AIMI (quadro 9, nunca mais do que o que sobra); mais a
   regularização do quadro 10 (fisco.js:fiscoRegularizacao, estimativa sem
   juros: a diferença acresce ao imposto do ano da cessação, art. 72.º n.º
   20, D10); e, tiradas as retenções, o que falta pagar (ou a receber).
   Recebe: r — o resumo (resumoFiscal).
   Devolve: {imposto, reporte (fiscoExpReporte), depoisReporte, abate,
   final (depois do AIMI), regularizacao, comRegularizacao, aPagar
   (negativo = a receber)} em euros. */
function fiscoExpImpostos(r){
  const T=r.totais||{},imposto=Math.max(0,r2(Number(T.imposto)||0)),rep=fiscoExpReporte(r),a=r.aimi;
  const dr=typeof fiscoImpostoDoKpi==='function'?fiscoImpostoDoKpi(r):rep?rep.depois:imposto;
  const abate=a&&Number(a.abate)>0?r2(Math.min(Number(a.abate),dr)):0,fim=r2(Math.max(0,dr-abate));
  const regs=Array.isArray(r.regularizacoes)?r.regularizacoes:[];
  const reg=typeof fiscoRegularizacao==='function'?fiscoRegularizacao(r)
    :T.regularizacao!=null&&isFinite(Number(T.regularizacao))?r2(Math.max(0,Number(T.regularizacao))):r2(Math.max(0,sum(regs.map(g=>Number((g||{}).total)||0))));
  return {imposto:imposto,reporte:rep,depoisReporte:dr,abate:abate,final:fim,regularizacao:reg>0?reg:0,
    comRegularizacao:r2(fim+(reg>0?reg:0)),aPagar:r2(fim+(reg>0?reg:0)-(Number(T.retencoes)||0))};
}
/* O caminho do imposto numa linha, para o texto e o CSV: o estimado, depois
   dos prejuízos de anos anteriores, depois do AIMI, com a regularização do
   quadro 10 (+X €, estimativa sem juros) e, com retenções, o que falta pagar
   — só os passos que o ano tem (fiscoExpImpostos, os números do KPI).
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o texto, ou '' sem regras do ano (fiscoExpSemRegras). */
function fiscoExpImpostoTexto(r){
  if(fiscoExpSemRegras(r))return '';
  const I=fiscoExpImpostos(r),T=r.totais||{},Q=(r.versao||{}).quadros||{},out=['imposto estimado '+euro2(I.imposto)];
  if(I.reporte)out.push('depois dos prejuízos de anos anteriores '+euro2(I.depoisReporte));
  if(I.abate)out.push('depois do AIMI '+euro2(I.final));
  if(I.regularizacao)out.push('com a regularização do quadro '+(Q.cessados||'10')+' '+euro2(I.comRegularizacao)+' (+'+euro2(I.regularizacao)+', estimativa sem juros)');
  if(Number(T.retencoes))out.push('depois das retenções ('+euro2(T.retencoes)+'): '+(I.aPagar>=0?'falta pagar '+euro2(I.aPagar):'a receber '+euro2(-I.aPagar)));
  return out.join(' → ');
}
/* Os dois campos do quadro 9 (D71, D32): o 9101 (o AIMI liquidado) e o 9102
   (o valor tributável) são os da demonstração de liquidação do AIMI do ano,
   quando a pessoa os escreveu (r.aimi.demonstracao, fisco-titulares.js);
   sem eles, os campos dizem «da demonstração do AIMI», sem valor — a app
   não os inventa. E os prédios que ficam fora do quadro 9, com o porquê
   (r.aimi.excluidos).
   Recebe: r — o resumo (resumoFiscal).
   Devolve: null sem AIMI; senão {c9101, c9102 (euros ou null),
   textos:{c9101, c9102} (o valor em euros, ou «da demonstração do AIMI»),
   excluidos:[{imovel, porque}], excluidosTexto ('' sem nenhum)}. */
function fiscoExpQuadro9(r){
  const a=r&&r.aimi;if(!a)return null;
  const d=a.demonstracao&&typeof a.demonstracao==='object'?a.demonstracao:{};
  const num=x=>x!=null&&x!==''&&isFinite(Number(x))?r2(Number(x)):null;
  const c1=num(d.total),c2=num(d.valorTributavel),dem='da demonstração do AIMI';
  const ex=(Array.isArray(a.excluidos)?a.excluidos:[]).filter(Boolean).map(x=>({imovel:String(x.imovel||''),porque:String(x.porque||'')}));
  return {c9101:c1,c9102:c2,textos:{c9101:c1!=null?euro2(c1):dem,c9102:c2!=null?euro2(c2):dem},excluidos:ex,
    excluidosTexto:ex.length?'Fora do quadro 9: '+ex.map(x=>x.imovel+(x.porque?' ('+x.porque+')':'')).join(', ')+'.':''};
}
/* Os quadros das isenções do ano com linhas (6D, 6F, 6H), cada um com as
   linhas isentas que lhe tocam (D18: o 6F e o 6H como o 6D, com o campo do
   4.1 e sem código).
   Recebe: r — o resumo (resumoFiscal).
   Devolve: [{quadro, linhas}], pela ordem do impresso. */
function fiscoExpIsentos(r){
  const por={};(r.linhas||[]).filter(l=>l.isencao).forEach(l=>{const q=l.isencao.quadro||'6D';(por[q]=por[q]||[]).push(l)});
  return Object.keys(por).sort().map(q=>({quadro:q,linhas:por[q]}));
}

/* Os ajudantes da vaga 3 da auditoria ao IRS (as receitas, os gastos e os
   quadros 5 e 9): leem os campos do resumo da 1.4 «Vaga 3» (fisco-resumo.js)
   com cuidado — um resumo que ainda não os tenha cai no que havia antes. Os
   nomes do impresso vêm da versão do ano (irs-AAAA.js). */

/* O nome de uma coluna de gastos como o impresso do 4.1 e do 4.2 a escreve,
   no grupo «Após início do arrendamento» (D90): o da versão do ano
   (colunasNomes.apos); sem ele, o nome da coluna na app.
   Recebe: r — o resumo; k — o id da coluna (de r.colunas).
   Devolve: o nome, ex.: «Imposto municipal sobre imóveis». */
function fiscoExpColNome(r,k){
  const ap=((((r||{}).versao||{}).colunasNomes)||{}).apos||{};
  return String(ap[k]||irsColunaNome(k)||fiscoColRotulo(k));
}
/* Os títulos dos dois grupos de gastos do impresso e os nomes das colunas
   das obras dos 24 meses (D90), da versão do ano (colunasNomes); sem eles, os
   rótulos curtos da app.
   Recebe: r — o resumo.
   Devolve: {apos, obras, inicioContrato, inicioGastos, valor} (texto). */
function fiscoExpGrupos(r){
  const cn=(((r||{}).versao||{}).colunasNomes)||{},ap=cn.apos||{},ob=cn.obras||{};
  return {apos:String(ap.titulo||'Gastos'),obras:String(ob.titulo||'Obras dos 24 meses antes do contrato'),
    inicioContrato:String(ob.inicioContrato||'Início do contrato'),inicioGastos:String(ob.inicioGastos||'Mês do primeiro pagamento'),valor:String(ob.valor||'Valor')};
}
/* Uma data como o impresso a pede nas obras dos 24 meses: o ano e o mês
   (D90).
   Recebe: iso — 'AAAA-MM-DD' (ou 'AAAA-MM').
   Devolve: 'MM/AAAA', ou '' sem data. */
function fiscoExpMesAno(iso){const s=String(iso||'');return /^\d{4}-\d{2}/.test(s)?s.slice(5,7)+'/'+s.slice(0,4):''}
/* A condição das obras dos 24 meses antes do contrato (CIRS art. 41.º n.º 7,
   D28): o texto, o CSV e o PDF dizem-na junto do valor. */
const FISCO_EXP_OBRAS_CONDICAO='só contam se, entre a obra e o contrato, o imóvel não teve outro uso (a tua casa, a de férias): CIRS art. 41.º n.º 7';
/* A coluna «Atualização da renda superior a 1,02?» do 4.1 e do 4.2 (D76):
   os contratos em vigor antes de 2022 respondem se a renda de 2023 subiu
   mais de 2 % (Lei 19/2022). O resumo dá a resposta (l.atualizacao2023:
   'sim', 'nao', '' por responder, null quando não se aplica); sem o campo,
   lê-se do contrato. O nome é o do impresso, da versão do ano
   (colunasNomes.atualizacao ou a coluna igual do quadro 4.3).
   Recebe: r — o resumo; l — a linha (ou uma entrada do quadro 5, com
   contratoId).
   Devolve: null quando não se aplica; senão {nome, resposta ('sim', 'nao'
   ou ''), texto} — texto «Sim», «Não» ou a pergunta por responder. */
function fiscoExpAtualizacao(r,l){
  if(!l)return null;
  let a=l.atualizacao2023;
  if(a===undefined){
    const c=l.contratoId!=null?contract(l.contratoId):null,f=c&&c.fisco||{};
    a=c&&c.start&&c.start<'2022-01-01'?(f.atualizacao2023==='sim'||f.atualizacao2023==='nao'?f.atualizacao2023:''):null;
  }
  if(a==null)return null;
  const v=(r&&r.versao)||{},cn=v.colunasNomes||{},q=((v.quadro43||{}).colunas||[]).find(x=>Array.isArray(x)&&x[0]==='atualizacao');
  const nome=String(cn.atualizacao||(q&&q[1])||'Atualização da renda de 2023');
  return {nome:nome,resposta:a,texto:a==='sim'?'Sim':a==='nao'?'Não':'por responder: a renda de 2023 subiu mais de 2 %? Responde na ficha do contrato'};
}
/* O que uma linha que não é a das rendas é (D21, D51): a natureza 05 (a
   indemnização que compensa rendas) ou a 02 (as outras receitas prediais),
   com o texto da tabela da versão do ano (naturezasTexto).
   Recebe: r — o resumo; l — a linha.
   Devolve: '' na linha das rendas; senão o texto da natureza, ex.:
   «indemnizações que visem compensar perdas de rendimentos da categoria F». */
function fiscoExpNaturezaTexto(r,l){
  if(!l||!l.papel||l.papel==='renda')return '';
  const t=String(((((r||{}).versao||{}).naturezasTexto)||{})[l.natureza]||(l.papel==='indemnizacao'?'indemnização':'outras receitas prediais'));
  return t.charAt(0).toLowerCase()+t.slice(1);
}
/* O que as rendas ilíquidas de uma linha levam além das rendas (D03, D20,
   D53): a caução (renda do ano em que se recebe), os reembolsos do inquilino
   e, já tiradas, as rendas devolvidas.
   Recebe: x — a linha (ou um objeto com caucao, reembolsos e devolucoes).
   Devolve: {caucao, reembolsos, devolucoes, texto} — texto ex.: «com 1 600,00 €
   de caução e 240,00 € de reembolsos do inquilino; já sem 800,00 € de rendas
   devolvidas», ou '' sem nada disso. */
function fiscoExpReceitas(x){
  const n=k=>Math.max(0,r2(Number((x||{})[k])||0)),c=n('caucao'),re=n('reembolsos'),d=n('devolucoes'),com=[];
  if(c)com.push(euro2(c)+' de caução');
  if(re)com.push(euro2(re)+' de reembolsos do inquilino');
  const t=(com.length?'com '+listaE(com):'')+(d?(com.length?'; ':'')+'já sem '+euro2(d)+' de rendas devolvidas':'');
  return {caucao:c,reembolsos:re,devolucoes:d,texto:t};
}
/* A quota usada numa linha (D93, D08, D29): a quota-parte com as casas que
   tem (uma escrita 49,8 % não se arredonda a 50 %), as de cada parte do ano
   quando mudaram (l.quotas) e os comproprietários fora da app no fim do ano
   (saldos.js:quotasForaNaData), que ficam com a parte deles.
   Recebe: r — o resumo; l — a linha (ou uma entrada do quadro 5).
   Devolve: {quota (texto, ex.: «49,8 %»), periodos ('' ou «50 % desde
   01/01/2025, 100 % desde 01/07/2025»), fora:[{nome, quota}], foraTexto (''
   ou «Irmão (50 %)»)}. */
function fiscoExpQuota(r,l){
  const q=x=>dec(r2((Number(x)||0)*100))+' %';
  const ps=Array.isArray(l&&l.quotas)?l.quotas.filter(x=>x&&x.desde):[];
  const p=l&&l.propertyId?prop(l.propertyId):null,A=String((r&&r.ano)||''),hoje=today();
  const dia=A&&A+'-12-31'<hoje?A+'-12-31':hoje;
  const fora=p?(quotasForaNaData(p,dia)||[]).filter(x=>x&&x.nome).map(x=>({nome:String(x.nome),quota:Number(x.quota)||0})):[];
  return {quota:q(l&&l.quota),periodos:ps.length>1?ps.map(x=>q(x.quota)+' desde '+dPT(x.desde)).join(', '):'',fora:fora,
    foraTexto:fora.map(x=>x.nome+' ('+dec(r2(x.quota))+' %)').join(', ')};
}
/* As letras do Rosto de cada titular do resumo (D30): a das linhas e, para
   quem só tem sublocação, a do quadro 5.
   Recebe: r — o resumo.
   Devolve: {titularId: letra}. */
function fiscoExpLetras(r){
  const out={};(r.linhas||[]).concat(Array.isArray(r.quadro5)?r.quadro5:[]).forEach(l=>{if(l&&!(l.titularId in out))out[l.titularId]=l.titular||''});
  return out;
}
/* O que são os valores de um quadro, para o subtítulo dele no PDF (D30): por
   inteiro; a tua parte e a do cônjuge, com a letra dele no Rosto (A ou B — a
   tua pode ser a B); a tua quota-parte; ou nada quando é tudo teu. As letras
   não decidem que rendas entram: são a posição no Rosto.
   Recebe: r — o resumo; ls — as linhas (ou entradas) do quadro.
   Devolve: o texto ('' quando é tudo teu). */
function fiscoExpParte(r,ls){
  if(r.porInteiro)return 'valores por inteiro';
  const meu=ls.some(l=>l.titularId===r.titularId),outras=ls.filter(l=>l.titularId!==r.titularId);
  if(outras.length){const t='titular '+(outras[0].titular||'B');return meu?'a tua parte e a do '+t:'a parte do '+t}
  return ls.some(l=>l.quota<1)?'a tua quota-parte':'';
}
/* A frase das letras em conjunta (D30): são a posição no Rosto e não mudam
   as rendas de ninguém.
   Recebe: r — o resumo.
   Devolve: o texto, ou '' sem conjunta (um titular só). */
function fiscoExpLetrasTexto(r){
  return !r.porInteiro&&(r.titulares||[]).length>1?'A e B são as letras de cada um no Rosto da declaração: as rendas dos dois entram, seja qual for a letra.':'';
}
/* Como um inquilino com o país se escreve (D59): o país e o código dele, que
   o Anexo F pede pela tabela X das instruções do Anexo J — o da pessoa, se a
   app o tiver (paisCodigo); senão, onde o procurar.
   Recebe: t — o inquilino ({pais, paisCodigo}).
   Devolve: o texto, ex.: «Espanha · código do país da tabela X das instruções
   do Anexo J», ou '' sem país. */
function fiscoExpPais(t){
  const p=String((t&&t.pais)||'').trim(),c=String((t&&t.paisCodigo)||'').trim();
  if(!p)return '';
  return p+(/^\d{3}$/.test(c)?' · código '+c:' · código do país da tabela X das instruções do Anexo J');
}
/* O quadro 5 — a sublocação (D52): as entradas do resumo (r.quadro5), cada
   uma com o que o impresso pede e a app tem: o n.º e o início do contrato de
   sublocação, a natureza com o texto da versão (quadro5.naturezasTexto), os
   sublocatários (o NIF português ou o país, fiscoIdInquilino), a renda
   recebida e a paga ao senhorio, o NIF dele, as retenções e a atualização de
   2023 (fiscoExpAtualizacao). Lido com cuidado: sem o campo, [].
   Recebe: r — o resumo.
   Devolve: [entrada do resumo + {numero, inicio, naturezaTexto (a começar
   por minúscula), ids,
   atualizacao}]. */
function fiscoExpQuadro5(r){
  const nt=((((r||{}).versao||{}).quadro5)||{}).naturezasTexto||{};
  return (Array.isArray(r&&r.quadro5)?r.quadro5:[]).filter(Boolean).map(e=>{
    const c=e.contratoId!=null?contract(e.contratoId):null,f=(c&&c.fisco)||{};
    return Object.assign({},e,{numero:String(e.numero!=null?e.numero:f.numero||''),inicio:String(e.inicio!=null?e.inicio:(c&&c.start)||''),
      naturezaTexto:String(nt[e.natureza]||'').replace(/^./,x=>x.toLowerCase()),inquilinos:Array.isArray(e.inquilinos)?e.inquilinos:[],
      ids:(Array.isArray(e.inquilinos)?e.inquilinos:[]).map(fiscoIdInquilino),atualizacao:fiscoExpAtualizacao(r,e),faltas:Array.isArray(e.faltas)?e.faltas:[]});
  });
}
/* Os totais do quadro 5 (totais.quadro5 do resumo; sem ele, a soma das
   entradas).
   Recebe: r — o resumo.
   Devolve: {n, rendaRecebida, rendaPaga, liquido, retencoes, imposto}. */
function fiscoExpTotaisQuadro5(r){
  const t=((r||{}).totais||{}).quadro5,es=Array.isArray(r&&r.quadro5)?r.quadro5:[],s=k=>r2(sum(es.map(e=>Number((e||{})[k])||0)));
  if(t&&typeof t==='object')return {n:Number(t.n)||es.length,rendaRecebida:r2(Number(t.rendaRecebida)||0),rendaPaga:r2(Number(t.rendaPaga)||0),
    liquido:r2(Number(t.liquido)||0),retencoes:r2(Number(t.retencoes)||0),imposto:r2(Number(t.imposto)||0)};
  return {n:es.length,rendaRecebida:s('rendaRecebida'),rendaPaga:s('rendaPaga'),liquido:s('liquido'),retencoes:s('retencoes'),imposto:s('imposto')};
}
/* As obras dos 24 meses que ficam fora até se responder à pergunta do
   contrato (D28, r.obrasPorConfirmar): cada uma com o que falta — a resposta
   por dar, ou o «não» que as tira.
   Recebe: r — o resumo.
   Devolve: [{contratoId, nome, imovel, valor, inicioGastos, resposta,
   texto}]. */
function fiscoExpObrasPorConfirmar(r){
  return (Array.isArray(r&&r.obrasPorConfirmar)?r.obrasPorConfirmar:[]).filter(x=>x&&Number(x.valor)>0).map(x=>({contratoId:x.contratoId,
    nome:String(x.nome||''),imovel:String(x.imovel||''),valor:r2(Number(x.valor)),inicioGastos:String(x.inicioGastos||''),resposta:x.resposta===false?false:null,
    texto:x.resposta===false?'ficam fora: respondeste no contrato que o imóvel teve outro uso entre a obra e o contrato'
      :'ficam fora até responderes no contrato se, entre a obra e o contrato, o imóvel esteve só à espera de inquilino'}));
}
/* Os prédios do quadro 9 (D71), cada um com o quadro e o campo das linhas
   onde ficou e o VPT (r.aimi.predios).
   Recebe: r — o resumo.
   Devolve: [{imovel, campos (texto, ex.: «4.1 / 4001»), vpt (euros ou null)}]. */
function fiscoExpQuadro9Predios(r){
  const a=r&&r.aimi;if(!a||!Array.isArray(a.predios))return [];
  return a.predios.filter(Boolean).map(p=>{
    const cs=(r.linhas||[]).filter(l=>l.propertyId===p.propertyId&&l.campo).map(l=>l.quadro+' / '+l.campo).filter((x,i,xs)=>xs.indexOf(x)===i);
    return {imovel:String(p.imovel||''),campos:cs.join(', '),vpt:Number(p.vpt)>0?r2(Number(p.vpt)):null};
  });
}

/* O resumo em texto simples (era o do «Partilhar resumo», que saiu da barra;
   fica como o retrato legível do resumo, que os testes leem): a linha das
   regras (fiscoRegrasTexto), os totais (com o prejuízo a reportar de cada
   titular, os isentos do 6D e o AIMI do quadro 9, quando os há; o imposto
   sem englobamento e nunca negativo), uma entrada por linha do quadro, pela
   ordem em que se preenche, com o campo (4001…, 4501…), o quadro, o titular, a
   identificação (o NIF português ou o país de cada inquilino), os valores, o
   4.2A e o 4.2B no 4.2 com o campo a que se ligam, e as faltas; e depois o
   que ficou fora, as rendas sem contrato com o valor, o quadro 8 com o prazo
   das substituições, o quadro 10 (os contratos que acabaram, com a
   regularização do motivo 01), o que há a tratar e, no fim, o IRS_AVISO. Os
   mesmos números da página, de quem declara (fiscoQuemDeclara). Nos totais, o
   imposto estimado e, quando os há, o abate dos prejuízos de anos anteriores
   com o imposto depois dele (fiscoExpReporteTexto) e o imposto depois do
   AIMI; sem regras do ano, sem taxa nem imposto (D50). Em cada linha, a taxa
   de cada período (fiscoExpTaxa), a natureza assumida, a taxa escrita no
   contrato quando não é a da lei, o campo do modelo novo por conhecer, a
   resposta do 4.2A pelo período (fiscoExpComunicacao) e o 4.2B sempre que o
   contrato o tem (fiscoExpElegivel24). Da vaga 3: as linhas 05 e 02 com o
   texto da natureza; a quota com as casas que tem, a de cada parte do ano e
   os comproprietários fora da app; a caução, os reembolsos e as rendas
   devolvidas nas rendas; os gastos e as obras com os nomes do impresso e a
   condição das obras; a atualização de 2023; o quadro 5 (a sublocação), as
   obras por confirmar e os prédios do quadro 9; e, em conjunta, a frase das
   letras do Rosto.
   Recebe: r (opcional) — o resumo; sem ele, o do ano da página (resumoFiscal).
   Devolve: o texto (string, várias linhas). */
function fiscoTexto(r){
  r=r||resumoFiscal(fiscoAnoAtual());
  const ano=r.ano,Q=r.versao.quadros||{},sem=fiscoExpSemRegras(r),bon=(r.versao.taxas||{}).bonusRendaMenor||{},G=fiscoExpGrupos(r);
  /* os gastos com os nomes do impresso, no grupo dele (D90) */
  const gastos=g=>G.apos+': '+r.colunas.map(k=>fiscoExpColNome(r,k)+' '+euro2(g[k])).join(' · '),a=r.aimi,I=r.totais.isentos,pre=fiscoPrejuizoTexto(r);
  const imp=fiscoExpImpostos(r),rep=fiscoExpReporteTexto(r),q10=fiscoExpQuadro10(r),isQ=fiscoExpIsentos(r);
  const campo=l=>l.campo?' (campo '+l.campo+')':'';
  const ant=l=>{const c=l.contratoAnterior;return c&&c.numero?'n.º '+c.numero+' ('+c.nome+')':c?c.nome+', sem n.º na AT':'—'};
  const q9=fiscoExpQuadro9(r),q9p=fiscoExpQuadro9Predios(r);
  const aimi=a?'\nAIMI (quadro 9): 9101 '+q9.textos.c9101+' · 9102 '+q9.textos.c9102+(q9.excluidosTexto?' · '+q9.excluidosTexto.slice(0,-1):'')+' · pago '+euro2(a.total)+(a.abate!=null&&!sem?' · abate ao imposto cerca de '+euro2(imp.abate)+' (leitura da app: até ao imposto estimado das rendas; a lei fala da coleta à taxa de 28 % — a AT faz a conta) · imposto depois do AIMI '+euro2(imp.final):a.semVpt&&a.semVpt.length?' · falta o VPT de '+listaE(a.semVpt):'')
    +(q9p.length?'\n  Prédios do quadro 9: '+q9p.map(p=>p.imovel+' ('+(p.campos?'quadro / campo '+p.campos+', ':'')+'VPT '+(p.vpt!=null?euro2(p.vpt):'por indicar')+')').join(', '):''):'';
  /* as receitas das linhas além das rendas (D03, D20, D53), somadas */
  const recT=fiscoExpReceitas({caucao:sum(r.linhas.map(l=>Number(l.caucao)||0)),reembolsos:sum(r.linhas.map(l=>Number(l.reembolsos)||0)),devolucoes:sum(r.linhas.map(l=>Number(l.devolucoes)||0))});
  /* o quadro 5 (D52): a sublocação, à parte do 4.1 e do 4.2 */
  const q5=fiscoExpQuadro5(r),q5T=fiscoExpTotaisQuadro5(r),q5Txt=q5.length?'\nQUADRO '+(Q.sublocacao||'5')+' · SUBLOCAÇÃO (só a diferença entre a renda recebida e a paga ao senhorio; sem gastos)\n'+q5.map(e=>{
      const at=e.atualizacao,qx=fiscoExpQuota(r,e);
      return `  ${e.numero?'n.º '+e.numero:'sem n.º na AT'} · ${e.nome}${e.imovel?' — '+e.imovel:''}${e.quota<1?' · quota-parte '+qx.quota:''} · titular ${e.titular||'A'}
    Início ${dPT(e.inicio)||'—'} · sublocatários: ${e.inquilinos.length?e.inquilinos.map((t,i)=>t.nome+' ('+e.ids[i].texto+')').join(', '):'—'}
    Renda recebida ${euro2(e.rendaRecebida)} · natureza ${e.natureza||'—'}${e.naturezaTexto?' ('+e.naturezaTexto+')':''} · renda paga ao senhorio ${euro2(e.rendaPaga)} · NIF do senhorio ${e.nifSenhorio||'—'} · retenções ${euro2(e.retencoes)}${at?'\n    '+at.nome+' '+at.texto:''}
    Diferença ${euro2(e.liquido)}${sem?'':' · taxa '+dec(e.taxa)+' % · imposto estimado '+euro2(Math.max(0,Number(e.imposto)||0))}${e.faltas.length?'\n    Falta: '+e.faltas.join(', ')+'.':''}`;
    }).join('\n')+'\n':'';
  /* as obras dos 24 meses que ficam fora até à resposta do contrato (D28) */
  const obP=fiscoExpObrasPorConfirmar(r),obPTxt=obP.length?'\nOBRAS DOS 24 MESES POR CONFIRMAR (não estão em nenhuma linha: '+FISCO_EXP_OBRAS_CONDICAO+')\n'
    +obP.map(x=>`  ${x.nome}${x.imovel?' — '+x.imovel:''}: ${euro2(x.valor)}${x.inicioGastos?' (desde '+fiscoExpMesAno(x.inicioGastos)+')':''} — ${x.texto}`).join('\n')+'\n':'';
  const letras=fiscoExpLetrasTexto(r);
  const q8=r.linhas.some(l=>l.anosAnteriores.length)?'\nQUADRO '+(Q.anosAnteriores||'8')+' · RENDAS DE ANOS ANTERIORES\n  '+fiscoQuadro8Texto(r)+'\n':'';
  const q10t=q10.length?'\nQUADRO '+(Q.cessados||'10')+' · CONTRATOS QUE ACABARAM (com redução pela duração ou isenção)\n'+q10.map(x=>`  ${x.nome}${x.imovel?' — '+x.imovel:''}: regime ${x.regime?x.regime+(x.regimeTexto?' ('+x.regimeTexto+')':''):'—'} · ${x.numero?'n.º '+x.numero:'sem n.º na AT'} · benefício desde ${x.anoInicioBeneficio||'—'} · cessação ${dPT(x.data)||'—'} · motivo ${x.motivo?x.motivo+(x.motivoCurto?' ('+x.motivoCurto+')':''):'por indicar'}${x.regularizacao&&!sem?'\n    Regularização: '+fiscoExpRegularizacaoTexto(r,x.regularizacao)+'.':''}${x.faltas.length?'\n    Falta: '+x.faltas.join(', ')+'.':''}`).join('\n')+'\n':'';
  /* a taxa, a natureza e o que vem com elas, numa linha do contrato */
  const taxaDe=l=>{
    if(l.isencao)return ' · isento (quadro '+l.isencao.quadro+(l.isencao.codigo?', código '+l.isencao.codigo:'')+')';
    const e=!sem&&typeof fiscoTaxaEscritaOutra==='function'?fiscoTaxaEscritaOutra(l):null,pc=fiscoExpPorConhecer(r,l);
    return ' · taxa '+fiscoExpTaxa(r,l).texto+(e!=null?' (escreveste '+dec(e)+' % no contrato; conta a da lei de '+ano+')':'')+(pc?' · '+pc.campo+': '+pc.valor:'');
  };
  const d42a=l=>{const x=fiscoExpComunicacao(r,l);return x?x.texto+' · ':''};
  const d42b=l=>{
    if(!fiscoExpElegivel24(r,l))return '';
    return '\n    4.2B'+campo(l)+': '+(l.bonus?'−'+dec(bon.pontos||5)+' p.p.':'a estimativa não desce a taxa abaixo de '+dec(bon.minimo||5)+' % (leitura prudente); a AT pode aplicar os '+dec(bon.pontos||5)+' pontos')
      +' · renda deste contrato '+euro2(l.renda)+' (a de hoje, a que a app comparou) · contrato anterior '+ant(l)+' · renda anterior '+(l.rendaAnterior?euro2(l.rendaAnterior):'—');
  };
  const isTxt=I.n?'\nIsentos (quadro'+(isQ.length>1?'s ':' ')+listaE(isQ.map(x=>x.quadro))+'): rendas '+euro2(I.rendas)+' · líquido '+euro2(I.liquido)+' — fora do imposto':'';
  const impTxt=sem?'imposto estimado por conhecer (a app não tem as regras de '+ano+')':'imposto estimado '+euro2(imp.imposto)+' (sem englobamento)';
  /* uma linha do quadro, com a natureza das linhas 05 e 02 (D21, D51), a
     quota usada e os de fora (D93, D08), o que as rendas levam (D03), os
     gastos e as obras com os nomes do impresso e a condição delas (D90, D28)
     e a atualização de 2023 (D76) */
  const linhaTxt=l=>{
    const nt=fiscoExpNaturezaTexto(r,l),qx=fiscoExpQuota(r,l),rec=fiscoExpReceitas(l),at=fiscoExpAtualizacao(r,l);
    return `  ${l.campo?'Campo '+l.campo+' · ':''}[${l.quadro}] ${l.atNumero?'n.º '+l.atNumero:'sem n.º na AT'} · ${l.nome} — ${l.imovel||'sem imóvel'}${nt?' · natureza '+l.natureza:''}${l.quota<1?' · quota-parte '+qx.quota+(qx.periodos?' ('+qx.periodos+')':''):''} · titular ${l.titular||'A'}
    Início ${dPT(l.inicio)||'—'} · freguesia ${l.freguesiaCodigo||'—'} · ${l.tipoPredio||'—'} · artigo ${l.artigo||'—'}${l.fracao?' · fração '+l.fracao:''} · natureza ${l.natureza}${nt?' ('+nt+')':''}${l.naturezaAssumida&&l.natureza?' (assumida: finalidade por indicar)':''}${taxaDe(l)}${qx.foraTexto?'\n    Comproprietários fora da app: '+qx.foraTexto+' — declaram a parte deles':''}
    Inquilinos: ${l.inquilinos.length?l.inquilinos.map(t=>t.nome+' ('+fiscoIdInquilino(t).texto+')').join(', '):'—'}
    Rendas ilíquidas ${euro2(l.rendas)}${rec.texto?' ('+rec.texto+')':''} · retenções ${euro2(l.retencoes)}${l.anosAnteriores.length?' · de anos anteriores: '+l.anosAnteriores.map(a=>a.ano+' '+euro2(a.valor)+(Number(a.retencoes)>0?' (retenções '+euro2(a.retencoes)+')':'')).join(', '):''}
    ${gastos(l.gastos)}${l.obras24.valor?'\n    '+G.obras+': '+G.inicioContrato+' '+(fiscoExpMesAno(l.inicio)||'—')+' · '+G.inicioGastos+' '+(fiscoExpMesAno(l.obras24.inicioGastos)||'—')+' · '+G.valor+' '+euro2(l.obras24.valor)+' ('+FISCO_EXP_OBRAS_CONDICAO+')':''}${at?'\n    '+at.nome+' '+at.texto:''}${fiscoPrejuizoLinha(l)?'\n    Resultado negativo '+euro2(fiscoPrejuizoLinha(l))+(sem?'':' · imposto estimado '+euro2(0))+': abate às rendas das outras linhas do mesmo titular, e o que sobrar é prejuízo a reportar':''}${l.quadro===Q.comReducao?'\n    '+Q.datas+campo(l)+': '+d42a(l)+'início '+(dPT(l.datas.inicio)||'—')+' · termo '+(dPT(l.datas.fim)||'—')+(l.datas.renovacaoInicio?' · última renovação '+dPT(l.datas.renovacaoInicio)+' a '+(dPT(l.datas.renovacaoFim)||'—'):'')+d42b(l):''}${l.faltas.length?'\n    Falta: '+l.faltas.join(', ')+'.':''}`;
  };
  return `ANEXO F · QUADROS 4.1 E 4.2${q5.length?' E '+(Q.sublocacao||'5'):''} — ${ano}${r.porInteiro?' · valores por inteiro':' · '+fiscoQuemDeclara(r)+' (quota-parte)'}
${fiscoRegrasTexto(r)}${letras?'\n'+letras:''}

Rendas ilíquidas ${euro2(r.totais.rendas)}${recT.texto?' ('+recT.texto+')':''} · retenções ${euro2(r.totais.retencoes)}${q5T.retencoes?' (com '+euro2(q5T.retencoes)+' do quadro '+(Q.sublocacao||'5')+')':''}
${gastos(r.totais.gastos)}${r.totais.obras24?'\n'+G.obras+' (24 meses antes do contrato): '+G.valor+' '+euro2(r.totais.obras24):''}
Rendimento líquido ${euro2(r.totais.liquido)}${q5.length?' (quadros 4.1 e 4.2)':''} · ${impTxt}${q5.length?'\nSublocação (quadro '+(Q.sublocacao||'5')+'): renda recebida '+euro2(q5T.rendaRecebida)+' · renda paga ao senhorio '+euro2(q5T.rendaPaga)+' · diferença '+euro2(q5T.liquido)+(sem?'':' · imposto estimado '+euro2(q5T.imposto)+' (já no imposto estimado)'):''}${pre?'\n'+pre:''}${rep&&!sem?'\n'+rep:''}${isTxt}${aimi}${!sem&&(imp.regularizacao||Number(r.totais.retencoes)||imp.reporte||imp.abate)?'\nImposto: '+fiscoExpImpostoTexto(r):''}
${r.linhas.length?'\nPOR CONTRATO (preenche por esta ordem: cada entrada é uma linha do quadro, com o seu campo)\n'+r.linhas.map(linhaTxt).join('\n')+'\n':''}${q5Txt}${obPTxt}${r.fora.length?'\nFORA DA DECLARAÇÃO\n'+r.fora.map(f=>`  ${f.nome}${f.imovel?' — '+f.imovel:''}: ${euro2(f.rendas)}`).join('\n')+'\n':''}${r.semContrato.length?'\nRENDAS SEM CONTRATO (não estão em nenhuma linha do quadro: liga-as ao contrato — declaram-se na mesma)\n'+r.semContrato.map(s=>`  ${s.imovel}: ${euro2(s.rendas)} (${fiscoN(s.n,'movimento','movimentos')})`).join('\n')+'\n':''}${q8}${q10t}${r.avisos.length?'\nA TRATAR\n'+r.avisos.map(a=>'  · '+a.texto).join('\n')+'\n':''}
Resumo feito pela app com o que tem registado. Os gastos de um imóvel com mais do que um contrato repartem-se pelas rendas; o rateio por VPT ou área fica para quem preenche.
${IRS_AVISO}
`;
}
/* O CSV do Anexo F do ano (ponto e vírgula, para o Excel português): o
   cabeçalho e uma linha por linha do quadro, pela ordem em que se preenche;
   as dos contratos não declarados («nao», só nome, imóvel, quota e rendas);
   uma por imóvel com rendas sem contrato («sem contrato», com o valor, D34);
   uma do AIMI («quadro 9», com os prédios de fora e porquê) e uma por
   contrato do quadro 10 («quadro 10»); e as de rodapé, com o texto na coluna
   contrato: cada ponto de «A tratar» («a tratar (falta|aviso|nota)»), o
   abate dos prejuízos de anos anteriores («reporte»), as regras («regras»,
   fiscoRegrasTexto) e o aviso («aviso», o IRS_AVISO). Todas as linhas têm as
   colunas do cabeçalho. O texto vai pelo copias.js:celulaCsv (a plica no que
   o Excel lia como fórmula), os códigos pelo celulaCodigo (="040810") e os
   valores pelo celulaNumero (6147,00; as percentagens com as casas que têm).
   As colunas que já existem não mudam de sítio; as novas vão sempre no fim:
   as da vaga 1 (titular, isenção do 6D, comunicação do 4.2A, o 4.2B, campo,
   prejuízo da linha, NIF e país à parte) e as dos contratos (vaga 2): a
   resposta do 4.2A pelo período (fora do prazo é nao), o prazo e o início do
   período, se a estimativa desceu a taxa no 4.2B, a taxa de cada período, a
   escrita no contrato quando não é a da lei, o campo do modelo novo por
   conhecer, a natureza assumida, o quadro da isenção (6D, 6F, 6H), as
   retenções de cada ano anterior, o quadro 10 (regime, ano do benefício,
   data, motivo), a regularização do motivo 01, o abate dos prejuízos com o
   imposto depois dele, e o 9101 e o 9102 da demonstração do AIMI; e as da
   vaga 3: o papel da linha (renda, indemnizacao, outra) com o texto da
   natureza (05, 02), a caução, os reembolsos do inquilino e as rendas
   devolvidas que as rendas ilíquidas levam, a resposta à atualização de 2023
   (atualizacao_1_02: sim, nao, por responder), as quotas de cada parte do
   ano e os comproprietários fora da app, a renda paga ao senhorio e o NIF
   dele (quadro 5), o mês do início do contrato e a condição das obras dos 24
   meses, e o VPT de cada prédio do quadro 9. Linhas novas: uma por contrato
   de sublocação («quadro 5»), uma por contrato com obras dos 24 meses por
   confirmar («obras por confirmar») e uma por prédio do quadro 9 («quadro 9
   · prédio»). O nif_ou_pais é o NIF português ou, sem ele, o país (D59). O 4.2B
   preenche-se sempre que o contrato o tem (D36); sem regras do ano, a taxa e
   o imposto vão vazios (D50). É a declaração de quem declara: em conjunta,
   um contrato dos dois cônjuges dá uma linha por titular.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o conteúdo do CSV (string, linhas separadas por \n, sem a marca
   de ordem de bytes, que é do download). */
function fiscoCsvTexto(r){
  const ano=String(r.ano),cols=r.colunas,T=celulaCsv,C=celulaCodigo,N=v=>celulaNumero(v),P=v=>celulaNumero(v,null);
  const sem=fiscoExpSemRegras(r),Q=(r.versao||{}).quadros||{};
  const cab=['ano','declarado','contrato','n_at','inicio','imovel','freguesia','tipo_predio','artigo','fracao','natureza','inquilinos','nif_ou_pais','quota_pct','rendas_iliquidas','retencoes']
    .concat(cols).concat(['obras24','obras24_desde','recibos_por_emitir','faltas','quadro','taxa_pct','liquido','imposto_estimado','anos_anteriores','termo','ultima_renovacao',
    'titular','isencao_6d','comunicacao_4_2a','reducao_4_2b','renda_anterior_4_2b',
    'campo','prejuizo','nif','pais','renda_4_2b','n_at_anterior_4_2b',
    'comunicacao_4_2a_resposta','comunicacao_4_2a_prazo','comunicacao_4_2a_periodo','taxa_desceu_4_2b','taxas_por_periodo','taxa_escrita_pct',
    'taxa_campo_por_conhecer','natureza_assumida','isencao_quadro','anos_anteriores_retencoes',
    'cessacao_regime','cessacao_ano_beneficio','cessacao_data','cessacao_motivo','regularizacao_estimada','reporte_abatido','imposto_depois_reporte','aimi_9101','aimi_9102','imposto_final','falta_pagar',
    'papel','natureza_texto','caucao','reembolsos_inquilino','devolucoes_renda','atualizacao_1_02','quotas_no_ano','comproprietarios_fora',
    'renda_paga_senhorio','nif_senhorio','obras24_inicio_contrato','obras24_condicao','vpt']);
  /* uma linha a partir das células por nome; as que faltam vão vazias */
  const linha=o=>cab.map(k=>o[k]==null?'""':o[k]).join(';');
  /* uma lista de valores numa célula: um só como código, vários como texto */
  const codigos=xs=>{xs=xs.filter(Boolean);return xs.length===1?C(xs[0]):T(xs.join(' / '))};
  const out=[cab.map(k=>T(k)).join(';')];
  r.linhas.forEach(l=>{
    const red=l.quadro===Q.comReducao,com=red?fiscoExpComunicacao(r,l):null,b=red&&fiscoExpElegivel24(r,l),tx=l.isencao?null:fiscoExpTaxa(r,l);
    const escr=!sem&&typeof fiscoTaxaEscritaOutra==='function'?fiscoTaxaEscritaOutra(l):null,pc=fiscoExpPorConhecer(r,l);
    const ids=l.inquilinos.map(fiscoIdInquilino),ant=l.contratoAnterior,rec=fiscoExpReceitas(l),at=fiscoExpAtualizacao(r,l),qx=fiscoExpQuota(r,l),o={
      ano:T(ano),declarado:T(l.estado==='declarado'?'sim':'por indicar'),contrato:T(l.nome),n_at:C(l.atNumero),inicio:T(l.inicio),imovel:T(l.imovel),
      freguesia:C(l.freguesiaCodigo),tipo_predio:T(l.tipoPredio),artigo:T(l.artigo),fracao:T(l.fracao),natureza:C(l.natureza),
      /* a identificação que conta (D59): o NIF português, ou o país sem ele */
      inquilinos:T(l.inquilinos.map(t=>t.nome).join(' / ')),nif_ou_pais:T(ids.map(x=>x.nif||x.pais||'').join(' / ')),
      papel:T(l.papel||'renda'),natureza_texto:T(fiscoExpNaturezaTexto(r,l)),caucao:N(rec.caucao),reembolsos_inquilino:N(rec.reembolsos),devolucoes_renda:N(rec.devolucoes),
      atualizacao_1_02:T(at?at.resposta||'por responder':''),quotas_no_ano:T(qx.periodos),comproprietarios_fora:T(qx.foraTexto),
      obras24_inicio_contrato:T(l.obras24.valor?fiscoExpMesAno(l.inicio):''),obras24_condicao:T(l.obras24.valor?FISCO_EXP_OBRAS_CONDICAO:''),
      quota_pct:P(l.quota*100),rendas_iliquidas:N(l.rendas),retencoes:N(l.retencoes),
      obras24:N(l.obras24.valor),obras24_desde:T(l.obras24.inicioGastos),recibos_por_emitir:celulaNumero(l.recibosPorEmitir,0),faltas:T(l.faltas.join('; ')),
      quadro:C(l.quadro),taxa_pct:sem?'""':P(l.taxa),liquido:N(l.liquido),imposto_estimado:sem?'""':N(fiscoImpostoLinha(l)),
      anos_anteriores:T(l.anosAnteriores.map(a=>a.ano+':'+r2(a.valor).toFixed(2).replace('.',',')).join(' ')),termo:T(l.datas.fim),
      ultima_renovacao:T(l.datas.renovacaoInicio?l.datas.renovacaoInicio+'/'+l.datas.renovacaoFim:''),
      titular:T(l.titular||'A'),isencao_6d:C(l.isencao&&(l.isencao.quadro||'6D')==='6D'?(l.isencao.codigo||l.isencao.id):''),comunicacao_4_2a:T(com?com.data:(l.comunicado||'')),
      reducao_4_2b:T(b?'sim':''),renda_anterior_4_2b:b&&l.rendaAnterior?N(l.rendaAnterior):'""',
      campo:C(l.campo||''),prejuizo:N(fiscoPrejuizoLinha(l)),nif:codigos(ids.map(x=>x.nif)),pais:T(ids.map(x=>x.pais).filter(Boolean).join(' / ')),
      renda_4_2b:b?N(l.renda):'""',n_at_anterior_4_2b:C(b&&ant?ant.numero:''),
      comunicacao_4_2a_resposta:T(com?com.resposta:''),comunicacao_4_2a_prazo:T(com?com.prazo:''),comunicacao_4_2a_periodo:T(com?com.periodoInicio:''),
      taxa_desceu_4_2b:T(b?(l.bonus?'sim':'nao'):''),taxas_por_periodo:T(tx&&tx.partes.length>1?tx.texto:''),taxa_escrita_pct:escr!=null?P(escr):'""',
      taxa_campo_por_conhecer:T(pc?pc.campo+': '+pc.valor:''),natureza_assumida:T(l.naturezaAssumida?'sim':''),isencao_quadro:C(l.isencao?(l.isencao.quadro||'6D'):''),
      anos_anteriores_retencoes:T(l.anosAnteriores.some(a=>a.retencoes!=null)?l.anosAnteriores.map(a=>a.ano+':'+r2(Number(a.retencoes)||0).toFixed(2).replace('.',',')).join(' '):'')};
    cols.forEach(k=>{o[k]=N(l.gastos[k])});
    out.push(linha(o));
  });
  r.fora.forEach(f=>{const c=contract(f.contratoId),o={ano:T(ano),declarado:T('nao'),contrato:T(f.nome),inicio:T(c?c.start||'':''),imovel:T(f.imovel),
    inquilinos:T(c?ctNames(c):''),quota_pct:P(f.quota*100),rendas_iliquidas:N(f.rendas),retencoes:N(0),obras24:N(0)};
    cols.forEach(k=>{o[k]=N(0)});out.push(linha(o))});
  r.semContrato.forEach(s=>out.push(linha({ano:T(ano),declarado:T('sem contrato'),imovel:T(s.imovel),rendas_iliquidas:N(s.rendas),
    faltas:T(s.n===1?'1 renda sem contrato ligado: não está em nenhuma linha do quadro; liga-a ao contrato — declara-se na mesma'
      :s.n+' rendas sem contrato ligado: não estão em nenhuma linha do quadro; liga-as ao contrato — declaram-se na mesma')})));
  /* o quadro 5 (D52): uma linha por contrato de sublocação e titular, com a
     renda recebida em rendas_iliquidas, a paga ao senhorio e o NIF dele, e a
     diferença no líquido */
  fiscoExpQuadro5(r).forEach(e=>{
    const at=e.atualizacao;
    out.push(linha({ano:T(ano),declarado:T('quadro '+(Q.sublocacao||'5')),quadro:C(Q.sublocacao||'5'),contrato:T(e.nome),n_at:C(e.numero),inicio:T(e.inicio),imovel:T(e.imovel),
      natureza:C(e.natureza),natureza_texto:T(e.naturezaTexto),inquilinos:T(e.inquilinos.map(t=>t.nome).join(' / ')),nif_ou_pais:T(e.ids.map(x=>x.nif||x.pais||'').join(' / ')),
      nif:codigos(e.ids.map(x=>x.nif)),pais:T(e.ids.map(x=>x.pais).filter(Boolean).join(' / ')),quota_pct:P((Number(e.quota)||0)*100),titular:T(e.titular||'A'),
      rendas_iliquidas:N(e.rendaRecebida),retencoes:N(e.retencoes),renda_paga_senhorio:N(e.rendaPaga),nif_senhorio:C(e.nifSenhorio),liquido:N(e.liquido),
      taxa_pct:sem?'""':P(e.taxa),imposto_estimado:sem?'""':N(Math.max(0,Number(e.imposto)||0)),faltas:T(e.faltas.join('; ')),
      atualizacao_1_02:T(at?at.resposta||'por responder':'')}));
  });
  /* as obras dos 24 meses fora até à resposta do contrato (D28) */
  fiscoExpObrasPorConfirmar(r).forEach(x=>out.push(linha({ano:T(ano),declarado:T('obras por confirmar'),contrato:T(x.nome),imovel:T(x.imovel),
    obras24:N(x.valor),obras24_desde:T(x.inicioGastos),faltas:T(x.texto),obras24_condicao:T(FISCO_EXP_OBRAS_CONDICAO)})));
  const q9=fiscoExpQuadro9(r);
  if(q9)out.push(linha({ano:T(ano),declarado:T('quadro '+(Q.aimi||'9')),quadro:C(Q.aimi||'9'),
    contrato:T('AIMI pago em '+ano+': '+euro2(r.aimi.total)+'. O 9101 e o 9102 são os da demonstração de liquidação do AIMI'+(q9.c9101==null||q9.c9102==null?' (escreve-os na Declaração, no cartão do AIMI)':'')+'.'+(q9.excluidosTexto?' '+q9.excluidosTexto:'')),
    aimi_9101:q9.c9101!=null?N(q9.c9101):'""',aimi_9102:q9.c9102!=null?N(q9.c9102):'""'}));
  /* os prédios do quadro 9 (D71), cada um com o quadro e o campo onde ficou e o VPT */
  if(q9)fiscoExpQuadro9Predios(r).forEach(p=>out.push(linha({ano:T(ano),declarado:T('quadro '+(Q.aimi||'9')+' · prédio'),quadro:C(Q.aimi||'9'),imovel:T(p.imovel),
    campo:T(p.campos),vpt:p.vpt!=null?N(p.vpt):'""'})));
  fiscoExpQuadro10(r).forEach(x=>out.push(linha({ano:T(ano),declarado:T('quadro '+(Q.cessados||'10')),contrato:T(x.nome),n_at:C(x.numero),imovel:T(x.imovel),
    quadro:C(Q.cessados||'10'),faltas:T(x.faltas.join('; ')),cessacao_regime:C(x.regime),cessacao_ano_beneficio:T(x.anoInicioBeneficio),cessacao_data:T(x.data),
    cessacao_motivo:C(x.motivo),regularizacao_estimada:x.regularizacao&&!sem?N(x.regularizacao.total):'""'})));
  (r.avisos||[]).forEach(a=>out.push(linha({ano:T(ano),declarado:T('a tratar ('+fiscoNivelNome(a)+')'),contrato:T(a.texto)})));
  const rep=sem?null:fiscoExpReporte(r);
  if(rep)out.push(linha({ano:T(ano),declarado:T('reporte'),contrato:T(fiscoExpReporteTexto(r)),reporte_abatido:N(rep.usado),imposto_depois_reporte:N(rep.depois)}));
  if(!sem){const I=fiscoExpImpostos(r);out.push(linha({ano:T(ano),declarado:T('imposto'),contrato:T(fiscoExpImpostoTexto(r)),
    imposto_estimado:N(I.imposto),imposto_final:N(I.comRegularizacao),falta_pagar:N(I.aPagar),regularizacao_estimada:I.regularizacao?N(I.regularizacao):'""',
    reporte_abatido:I.reporte?N(I.reporte.usado):'""',imposto_depois_reporte:I.reporte?N(I.depoisReporte):'""'}))}
  out.push(linha({ano:T(ano),declarado:T('regras'),contrato:T(fiscoRegrasTexto(r))}));
  out.push(linha({ano:T(ano),declarado:T('aviso'),contrato:T(IRS_AVISO)}));
  return out.join('\n');
}
/* Exporta os quadros do ano da página para CSV (fiscoCsvTexto), pelo download
   da app (copias.js:download, que lhe põe a marca de ordem de bytes).
   Devolve: nada — dispara a descarga do CSV. */
function fiscoCsv(){
  const ano=fiscoAnoAtual();
  download('anexo-f-'+ano+'.csv','text/csv;charset=utf-8',fiscoCsvTexto(resumoFiscal(ano)));
  toast('CSV exportado.');
}
