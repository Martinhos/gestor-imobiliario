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
/* O que o quadro 8 diz de quem recebeu rendas de anos anteriores — um texto
   só, o do cartão da página (fisco-quadros.js:fiscoAnosAnterioresCard), do
   texto e do PDF: as rendas já estão na linha e pagam imposto no ano em que
   entraram; o quadro é facultativo (só o preenche quem quer o regime do art.
   74.º do CIRS: o 8A com o englobamento, o 8B com as declarações de
   substituição, até ao prazo delas — D84) e, sem isso, fica em branco; cada
   linha leva o campo do 4.1, 4.2, 4.3 ou 5 de onde a renda é, e no 8B as
   retenções e os gastos de cada ano — estes a app não os separa, quando
   nenhuma entrada os traz (a.gastos) —, e um pagamento de vários anos é um
   movimento por ano (D55).
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o texto (simples, sem HTML). */
function fiscoQuadro8Texto(r){
  const ate=fiscoSubstituicaoAte(r),Q=(((r||{}).versao||{}).quadros)||{};
  const qs=listaE([Q.semReducao||'4.1',Q.comReducao||'4.2',Q.dhd||'4.3',Q.sublocacao||'5']).replace(/ e (\S+)$/,' ou $1');
  const comGastos=fiscoExpAnosAnteriores(r).some(x=>x.anos.some(a=>typeof a.gastos==='number'&&isFinite(a.gastos)));
  return 'Estas rendas já estão nas rendas da linha e pagam imposto este ano, porque contam no ano em que se recebem. O quadro '+(Q.anosAnteriores||'8')
    +' é facultativo: só o preenches se quiseres o regime do artigo 74.º do CIRS — o 8A se optares pelo englobamento (o valor reparte-se pelos anos a que respeita), o 8B se preferires entregar declarações de substituição dos anos a que respeitam (até cinco anos para trás)'
    +(ate?', até '+dPT(ate)+', 30 dias depois do fim do prazo da entrega':', até 30 dias depois do fim do prazo da entrega')+'. Se não, deixa-o em branco.'
    +' Cada linha do quadro '+(Q.anosAnteriores||'8')+' leva o campo do '+qs+' de onde a renda é; no 8B também as retenções na fonte e os gastos desse ano que não entraram na declaração dele'+(comGastos?'':' — esses gastos soma-os tu: a app não os separa')+'.'
    +' O quadro pede uma linha por ano a que as rendas respeitam: um pagamento de vários anos regista-se num movimento por ano, cada um com o mês a que respeita.';
}
/* As linhas com rendas de anos anteriores (quadro 8): as do 4.1, 4.2 e 4.3
   (l.anosAnteriores) e as entradas do quadro 5, a sublocação, quando o
   resumo lhas dá (e.anosAnteriores; lidas com cuidado — um resumo que não as
   traz não tem nenhuma).
   Recebe: r — o resumo (resumoFiscal).
   Devolve: [{linha, quadro, campo, anos:[{ano, valor, retencoes, gastos}]}],
   só com as que têm anos; quadro e campo os de onde a renda é (o quadro 5
   não tem campo). */
function fiscoExpAnosAnteriores(r){
  const Q5=((((r||{}).versao||{}).quadros)||{}).sublocacao||'5',ok=x=>x&&Array.isArray(x.anosAnteriores)&&x.anosAnteriores.filter(Boolean).length;
  return ((r&&r.linhas)||[]).filter(ok).map(l=>({linha:l,quadro:String(l.quadro||''),campo:String(l.campo||''),anos:l.anosAnteriores.filter(Boolean)}))
    .concat((Array.isArray(r&&r.quadro5)?r.quadro5:[]).filter(ok).map(e=>({linha:e,quadro:String(Q5),campo:'',anos:e.anosAnteriores.filter(Boolean)})));
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
/* Os títulos das duas secções do CSV que não são linhas do Anexo F, cada uma
   depois de uma linha vazia (fiscoCsvTexto, KAN-126-5): os avisos de «A
   tratar» e, no fim, a estimativa do imposto com as regras e o aviso (sem
   regras do ano, só as notas). */
const FISCO_CSV_SECCAO_AVISOS='AVISOS: o que a app encontrou para tratares antes de entregar. Não são linhas do Anexo F.';
const FISCO_CSV_SECCAO_NOTAS='ESTIMATIVA E NOTAS: o imposto que a app estima, as regras e o aviso. Não são linhas do Anexo F.';
const FISCO_CSV_SECCAO_SO_NOTAS='NOTAS: as regras e o aviso. Não são linhas do Anexo F.';
/* Os nomes do cabeçalho do CSV escritos em português, com os acentos, nas
   colunas que os têm: «início», «imóvel» e «fração» (as outras ficam como
   eram). Não é só ortografia (KAN-126-5): o Google Sheets adivinha a
   codificação de um CSV pelo começo do ficheiro e não chega a marca de ordem
   de bytes; com o cabeçalho e as primeiras linhas só em ASCII (os primeiros
   2 KB), lia o ficheiro como Latin-1 e os acentos de mais abaixo saíam
   estragados («nÃ£o»). Com estes três nos primeiros 80 bytes, o começo já
   é UTF-8 com acentos. Por dentro, as linhas continuam a usar as chaves sem
   acento (inicio, imovel, fracao); só o cabeçalho as escreve assim.
   Recebe: k — a chave da coluna.
   Devolve: o nome que o cabeçalho escreve. */
const FISCO_CSV_NOMES={inicio:'início',imovel:'imóvel',fracao:'fração'};

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
   l.comunicado de antes. Sem o dia do período e com a marca do modelo antigo
   por confirmar (a app pedia a comunicação todos os anos e guardava-a pelo ano
   dos rendimentos: a data dessa marca, depois do prazo do período para onde
   a migração a levou, não diz quando a duração foi comunicada —
   fiscoExpComPorConfirmar), a resposta fica «a confirmar», e nunca NÃO.
   Recebe: r — o resumo; l — a linha (do quadro 4.2).
   Devolve: null quando não há nada a comunicar; senão {resposta ('sim',
   'nao', 'a confirmar', ou '' por fazer com o prazo à frente), data, prazo,
   periodoInicio ('AAAA-MM-DD' ou ''), foraDePrazo, porConfirmar, dataAntiga
   ('AAAA-MM-DD' da marca antiga, ou ''), texto} — texto a forma curta, ex.:
   «comunicada a 10/02/2025», «comunicada fora do prazo (a 20/03/2026; o
   prazo era 15/02/2026) — no 4.2A é NÃO», «por comunicar · até 15/02/2027»,
   «a confirmar — a marca de 10/02/2026 vem da app antiga, …». */
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
  const pc=data?null:fiscoExpComPorConfirmar(l,x);
  const passou=!data&&!pc&&!!prazo&&prazo<today();
  return {resposta:pc?'a confirmar':data&&!fora?'sim':fora||passou?'nao':'',data:data,prazo:prazo,periodoInicio:String(x.periodoInicio||''),foraDePrazo:fora,
    porConfirmar:!!pc,dataAntiga:pc?pc.data:'',
    texto:pc?'a confirmar — '+(pc.data?'a marca de '+dPT(pc.data)+' vem':'a marca vem')+' da app antiga, que pedia a comunicação todos os anos; se comunicaste a duração deste período até '
        +(prazo?dPT(prazo):'15 de fevereiro do ano seguinte ao início dele')+', no '+Q+' é SIM, senão é NÃO'
      :data&&!fora?'comunicada a '+dPT(data)
      :fora?'comunicada fora do prazo (a '+dPT(data)+(prazo?'; o prazo era '+dPT(prazo):'')+') — no '+Q+' é NÃO'
      :passou?'por comunicar (o prazo acabou a '+dPT(prazo)+') — no '+Q+' é NÃO'
      :'por comunicar'+(prazo?' · até '+dPT(prazo):'')};
}
/* A marca do modelo antigo por confirmar na comunicação de um período (a
   migração das comunicações, dados.js): a do resumo (x.porConfirmar, com a
   x.dataAntiga) ou, sem ela, a do contrato — fisco.comunicacoesPorConfirmar
   pela chave do período (o ano do início dele), com a data da marca antiga.
   Lida com cuidado: um contrato sem ela não está por confirmar.
   Recebe: l — a linha (com contratoId); x — a comunicação do período
   (l.comunicacao, irs.js:irsComunicacaoDoAno).
   Devolve: null sem marca; senão {data} — a data da marca antiga
   ('AAAA-MM-DD', ou '' quando a marca não a tem). */
function fiscoExpComPorConfirmar(l,x){
  const dia=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v):'';
  if(x&&x.porConfirmar===true)return {data:dia(x.dataAntiga)};
  const k=String((x&&x.chave)||String((x&&x.periodoInicio)||'').slice(0,4));
  if(!/^\d{4}$/.test(k)||!l||l.contratoId==null)return null;
  const c=contract(l.contratoId),m=c&&c.fisco&&c.fisco.comunicacoesPorConfirmar;
  if(!m||typeof m!=='object'||Array.isArray(m)||!m[k])return null;
  return {data:dia(m[k])};
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
/* O quadro 4.2C (art. 72.º n.º 23): a resposta obrigatória sempre que o 4.2
   tem contratos celebrados desde a data do n.º 23 (taxas.limiteRendaAlta
   .desde, 01/01/2024) — «Todos os contratos do 4.2 cumprem o n.º 23?» —, com
   a mesma conta do cartão da página (fisco-quadros.js:fiscoReducoesHtml): os
   contratos do 4.2 celebrados desde essa data, os que têm a renda confirmada
   dentro do limite (l.acimaDoLimite false) e os que falta confirmar. Um
   contrato acima do limite não tem redução e já está no 4.1. Em conjunta, um
   contrato dos dois conta uma vez.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: null sem nenhum; senão {quadro ('4.2C'), desde ('AAAA-MM-DD'),
   percentagem, contratos (nomes), porConfirmar (nomes), resposta ('sim' com
   todos confirmados, '' com algum por confirmar), texto} — texto ex.:
   «celebrados desde 01/01/2024: Benfica · resposta Sim (01)», ou «… · falta
   confirmar na ficha do contrato: Benfica». */
function fiscoExpLimite42C(r){
  const v=(r&&r.versao)||{},Q=v.quadros||{},L=((v.taxas||{}).limiteRendaAlta)||{desde:'2024-01-01'},desde=String(L.desde||'2024-01-01');
  const ja={},n23=((r&&r.linhas)||[]).filter(l=>l&&l.quadro===(Q.comReducao||'4.2')&&l.celebracao&&l.celebracao>=desde)
    .filter(l=>{const k=l.contratoId!=null?l.contratoId:l.nome;if(ja[k])return false;ja[k]=1;return true});
  if(!n23.length)return null;
  const por=n23.filter(l=>l.acimaDoLimite!==false).map(l=>l.nome);
  return {quadro:(Q.comReducao||'4.2')+'C',desde:desde,percentagem:Number(L.percentagem)||150,contratos:n23.map(l=>l.nome),porConfirmar:por,resposta:por.length?'':'sim',
    texto:'celebrados desde '+dPT(desde)+': '+listaE(n23.map(l=>l.nome))+' · '+(por.length?'falta confirmar na ficha do contrato: '+listaE(por):'resposta Sim (01)')};
}
/* O que o 4.2C pergunta, numa nota (o texto e o PDF): se nenhum dos contratos
   passa a percentagem dos limites de renda que a versão do ano escreve
   (fiscoExpLimites23), e que um que passe vai ao 4.1.
   Recebe: r — o resumo; x — o fiscoExpLimite42C(r).
   Devolve: o texto. */
function fiscoExpLimite42CNota(r,x){
  const lim=fiscoExpLimites23(r),Q41=((((r||{}).versao||{}).quadros)||{}).semReducao||'4.1';
  return 'O '+x.quadro+' pergunta se nenhum destes contratos passa '+dec(x.percentagem)+' % dos limites de renda'+(lim?' ('+lim+')':' por tipologia e concelho')+'. Um que passe não tem redução e vai ao '+Q41+'.'
    +(x.porConfirmar.length?' Confirmados todos, a resposta é «Sim» (01).':'');
}
/* Os contratos do quadro 10 (os que acabaram no ano e tiveram redução ou
   isenção, D09), com os textos das tabelas da versão (quadro10.regimes e
   .motivos) e, no motivo que regulariza (o 01, art. 72.º n.º 20), a
   diferença estimada (D10, r.regularizacoes do resumo). Cada entrada leva
   também o que o impresso pede depois da cessação, «conforme as instruções
   do quadro 4.1»: a identificação matricial, o titular e o NIF do inquilino
   ou o país (fiscoExpIdent10) — uma por titular em conjunta, como as linhas
   do 4.x. O ano de início do benefício que a app não sabe ao certo (o
   contrato começou antes das rendas que tem dele: c.anoInicioConfirmar e o
   c.anoInicioPorque do resumo) vai «a confirmar», e é uma falta.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: [{contratoId, nome, imovel, numero, regime, regimeTexto,
   anoInicioBeneficio, anoInicioConfirmar, anoInicioPorque, data, motivo,
   motivoCurto, regulariza, regularizacaoAcima, faltas, regularizacao,
   regularizacaoFalta} + a identificação de fiscoExpIdent10] —
   regularizacao null ou {anos:[{ano, diferenca}], total, anosEmFalta,
   anosSemRegras, porConfirmar, totalPorConfirmar}, a do contrato, só na
   primeira entrada dele (regularizacaoAcima nas outras, em conjunta);
   regularizacaoFalta null ou o fiscoExpRegularizacaoFalta dela, quando há
   anos em falta ou por confirmar (também com a diferença estimada a zero:
   N031, N125); faltas o que o quadro pede e não há, ou está a confirmar. */
function fiscoExpQuadro10(r){
  const q=(((r||{}).versao||{}).quadro10)||{},rs=Array.isArray(q.regimes)?q.regimes:[],ms=Array.isArray(q.motivos)?q.motivos:[];
  const regs={};(Array.isArray(r.regularizacoes)?r.regularizacoes:[]).forEach(x=>{if(x&&x.contratoId!=null&&!x.dhd)regs[x.contratoId]=x});
  /* a regularização é do contrato (os dois titulares juntos): vai só na
     primeira entrada dele, para não se somar duas vezes em conjunta */
  const ja={};
  return (Array.isArray(r.cessados)?r.cessados:[]).filter(Boolean).map(c=>{
    const regime=String(c.regime||''),motivo=String(c.motivo||''),rg=rs.find(x=>x&&String(x.codigo)===regime),m=ms.find(x=>x&&String(x.codigo)===motivo);
    const acima=!!ja[c.contratoId],g=acima?null:regs[c.contratoId],anos=g&&Array.isArray(g.anos)?g.anos.filter(a=>a&&Number(a.diferenca)):[];ja[c.contratoId]=1;
    const total=g?r2(Number(g.total)||sum(anos.map(a=>Number(a.diferenca)||0))):0;
    const id=fiscoExpIdent10(r,c),ano=c.anoInicioBeneficio?String(c.anoInicioBeneficio):'',conf=fiscoExpAnoInicioConfirmar(c),porque=conf?conf.porque:'';
    const faltas=[];
    if(!c.numero)faltas.push('n.º do contrato na AT');
    if(!regime)faltas.push('regime fiscal');
    if(!ano)faltas.push('ano de início do benefício');
    else if(conf)faltas.push('ano de início do benefício a confirmar'+(porque?' ('+porque+')':': o da primeira declaração em que as rendas deste contrato tiveram o benefício'));
    if(!motivo)faltas.push('motivo da cessação');
    /* o que a estimativa não conta (N031, N125): os anos sem rendas na app e
       os por confirmar, sem as regras desses anos — também com total 0 */
    const fx=g?fiscoExpRegularizacaoFalta(g):null,ext=g?{anosEmFalta:fx.emFalta,anosSemRegras:fx.semRegras,porConfirmar:fx.porConfirmar,totalPorConfirmar:fx.totalPorConfirmar}:{};
    return Object.assign({contratoId:c.contratoId,nome:c.nome||'',imovel:c.imovel||'',numero:c.numero||'',regime:regime,regimeTexto:rg?String(rg.texto||''):'',
      anoInicioBeneficio:ano,anoInicioConfirmar:!!conf,anoInicioPorque:porque,data:c.data||'',motivo:motivo,motivoCurto:m?String(m.curto||m.texto||''):'',
      regulariza:!!(m&&m.regulariza),regularizacaoAcima:acima&&!!regs[c.contratoId],
      regularizacao:g&&total>0?Object.assign({anos:anos.map(a=>({ano:a.ano,diferenca:r2(Number(a.diferenca))})),total:total},ext):null,
      regularizacaoFalta:fx&&fx.texto?fx:null},id,{faltas:faltas.concat(id.faltas)});
  });
}
/* Se o ano de início do benefício de uma entrada do quadro 10 está por
   confirmar, e porquê: a marca do resumo (x.anoInicioConfirmar, com o
   x.anoInicioPorque — a frase sem ponto final); um resumo que ainda não a
   tenha está por confirmar quando o contrato começou antes desse ano (as
   rendas que a app tem dele podem não chegar ao ano da primeira
   declaração com o benefício), como o cartão da página.
   Recebe: x — a entrada de r.cessados.
   Devolve: null quando o ano é certo (ou não há ano); senão {porque} — a
   frase, sem ponto final ('' quando o resumo não a diz). */
function fiscoExpAnoInicioConfirmar(x){
  const ano=Number((x&&x.anoInicioBeneficio)||0);if(!ano)return null;
  const marca=typeof x.anoInicioConfirmar==='boolean'?x.anoInicioConfirmar:typeof x.anoInicioPorConfirmar==='boolean'?x.anoInicioPorConfirmar:null;
  const porque=String(x.anoInicioPorque||x.anoInicioNota||'').trim().replace(/\.$/,'');
  if(marca!=null)return marca?{porque:porque}:null;
  const c=x.contratoId!=null?contract(x.contratoId):null,ini=Number(String((c&&c.start)||'').slice(0,4));
  return ini&&ini<ano?{porque:porque||'o contrato começou em '+ini+', antes do primeiro ano com rendas dele na app'}:null;
}
/* O que uma linha do quadro 10 pede depois da cessação, pela ordem do
   impresso: a identificação matricial (o código da freguesia, o tipo, o
   artigo, a fração), o titular e o arrendatário (o NIF português ou o país,
   fiscoIdInquilino), «conforme as instruções do quadro 4.1». Lê os campos
   que o resumo põe em cada entrada de r.cessados, com os nomes das linhas do
   4.x (uma entrada por titular em conjunta); um resumo que ainda não os
   tenha cai na ficha do imóvel e nos inquilinos do contrato. As faltas são
   as das linhas (fisco-resumo.js:fiscoLinhaNova, fiscoFaltaDoInquilino) e a
   da freguesia de uma união extinta por confirmar (fiscoExpFreguesia).
   Recebe: r — o resumo; x — a entrada de r.cessados.
   Devolve: {propertyId, titularId, titular ('A', 'B', 'A/B', ou '' sem se
   saber em conjunta), freguesiaCodigo, tipoPredio, artigo, fracao,
   freguesiaUniao, matrizConfirmada, inquilinos:[{nome, nif, pais}], ids
   (fiscoIdInquilino de cada inquilino), faltas}. */
function fiscoExpIdent10(r,x){
  x=x||{};
  const c=x.contratoId!=null?contract(x.contratoId):null,pid=x.propertyId!=null?x.propertyId:c?c.propertyId:null,p=pid!=null?prop(pid):null;
  const tem=k=>x[k]!=null,s=v=>String(v==null?'':v);
  const ts=Array.isArray(x.inquilinos)?x.inquilinos.filter(Boolean).map(t=>({nome:s(t.nome),nif:s(t.nif),pais:s(t.pais),paisCodigo:s(t.paisCodigo)}))
    :c?ctTenants(c).map(t=>({nome:s(t.name),nif:s(t.nif),pais:s(t.pais),paisCodigo:''})):[];
  const out={propertyId:pid,titularId:s(x.titularId),titular:s(x.titular)||(r&&r.variosTitulares?'':'A'),
    freguesiaCodigo:s(tem('freguesiaCodigo')?x.freguesiaCodigo:p&&p.freguesiaCodigo),tipoPredio:s(tem('tipoPredio')?x.tipoPredio:p&&p.tipoPredio),
    artigo:s(tem('artigo')?x.artigo:p&&p.matrix),fracao:s(tem('fracao')?x.fracao:p&&p.fraction),
    freguesiaUniao:tem('freguesiaUniao')?x.freguesiaUniao:p?fiscoFreguesiaUniao(p,Number(r&&r.ano)):null,
    matrizConfirmada:s(tem('matrizConfirmada')?x.matrizConfirmada:p&&p.matrizConfirmada),inquilinos:ts,ids:ts.map(fiscoIdInquilino),faltas:[]};
  const f=out.faltas,fx=fiscoExpFreguesia(out);
  if(!out.freguesiaCodigo)f.push('código da freguesia');
  if(!out.tipoPredio)f.push('tipo de prédio');
  if(!out.artigo)f.push('artigo matricial');
  if(fx&&fx.falta)f.push(fx.falta);
  if(!out.titular)f.push('titular (A ou B)');
  if(!ts.length)f.push('inquilino do contrato');
  ts.forEach(t=>{const m=fiscoFaltaDoInquilino(t.nome,t.nif,t.pais);if(m)f.push(m)});
  return out;
}
/* Se o ano tem uma regularização do art. 72.º n.º 20 a somar ao imposto (a
   do quadro 10 ou a de um DHD cessado por acordo, r.regularizacoes; sem
   elas, o totais.regularizacao do resumo).
   Recebe: r — o resumo (resumoFiscal).
   Devolve: true ou false. */
function fiscoExpComRegularizacao(r){
  const gs=Array.isArray(r&&r.regularizacoes)?r.regularizacoes:[];
  return gs.some(g=>g&&Number(g.total)>0)||Number(((r&&r.totais)||{}).regularizacao)>0;
}
/* Se a regularização do n.º 20 que se soma ao imposto deixa anos de fora:
   anos do período sem rendas na app, ou por confirmar, sem as regras desses
   anos (N031, N125 — fiscoExpRegularizacaoFalta). O caminho do imposto
   (fiscoExpImpostoTexto) e o total do PDF dizem-no ao lado da soma.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: true ou false. */
function fiscoExpRegularizacaoIncompleta(r){
  return (Array.isArray(r&&r.regularizacoes)?r.regularizacoes:[]).some(g=>{if(!g)return false;const f=fiscoExpRegularizacaoFalta(g);return f.emFalta.length>0||(f.semRegras.length>0&&!f.somados)});
}
/* O que o texto e o PDF dizem de um ano sem rendas nos quadros das linhas
   que leva o quadro 10 (um contrato que acabou antes de qualquer renda do
   ano) ou a regularização do n.º 20: o Anexo F desse ano entrega-se na
   mesma, com eles — o quadro 10 não depende de haver rendas no ano, e a
   regularização é imposto dessa declaração.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: a frase, ou '' quando o ano tem linhas, ou não tem nem quadro 10
   nem regularização. */
function fiscoExpSemRendasTexto(r){
  if((r.linhas||[]).length)return '';
  const q10=fiscoExpQuadro10(r),reg=fiscoExpComRegularizacao(r),Q=(((r||{}).versao||{}).quadros)||{};
  if(!q10.length&&!reg)return '';
  return 'Sem rendas em '+r.ano+' nos quadros '+listaE(fiscoExpQuadrosDasLinhas(r))+': o Anexo F deste ano leva na mesma '
    +(q10.length?'o quadro '+(Q.cessados||'10')+', com '+(fiscoNContratos(q10)===1?'o contrato que acabou':'os contratos que acabaram')+' no ano (o quadro não depende de haver rendas nele)'+(reg?', e ':''):'')
    +(reg?'a regularização do n.º 20 do art. 72.º, que acresce ao imposto de '+r.ano:'')+'.';
}
/* A frase da regularização de um contrato do quadro 10 com o motivo 01
   (art. 72.º n.º 20): a diferença estimada, ano a ano, sem juros; num DHD
   cessado por acordo (g.dhd, o motivo 01 do quadro 4.3 — D120), a redução
   do n.º 5 que cai desde o início.
   Recebe: r — o resumo; g — a regularizacao de fiscoExpQuadro10 (ou a de
   fiscoExpDhd, com dhd).
   Devolve: o texto. */
function fiscoExpRegularizacaoTexto(r,g){
  const dif='diferença estimada de '+euro2(g.total)+(g.anos.length?' ('+g.anos.map(a=>a.ano+': '+euro2(a.diferenca)).join('; ')+')':'')+', sem os juros compensatórios: ';
  const fx=fiscoExpRegularizacaoFalta(g),mais=fx.texto?'. '+fx.texto.charAt(0).toUpperCase()+fx.texto.slice(1):'';
  /* num DHD cessado por acordo (D120) a redução do n.º 5 cai desde o início */
  if(g.dhd)return dif+'o direito real de habitação duradoura cessou por acordo das partes, por isso a taxa reduzida cai desde o início do contrato (CIRS art. 72.º n.º 20), e a diferença acresce ao imposto de '+r.ano+mais;
  return dif+'com a cessação antes do prazo por motivo do senhorio, o período em que o contrato acabou passa à taxa da duração efetivamente decorrida (CIRS art. 72.º n.º 20), e a diferença acresce ao imposto de '+r.ano+mais;
}
/* Os anos de uma lista numa frase curta, como a página os diz (fisco.js): os
   seguidos «de 2019 a 2024», um só «de 2019», com buracos a lista («de 2019,
   2021 e 2023»).
   Recebe: ys — os anos (números ou 'AAAA'; os repetidos e o que não é ano
   saem).
   Devolve: o texto, ou '' sem anos. */
function fiscoExpAnos(ys){
  const a=(Array.isArray(ys)?ys:[]).map(Number).filter(y=>y>1900&&y<3000).filter((y,i,xs)=>xs.indexOf(y)===i).sort((x,y)=>x-y);
  if(!a.length)return '';
  if(a.length===1)return 'de '+a[0];
  return a[a.length-1]-a[0]===a.length-1?'de '+a[0]+' a '+a[a.length-1]:'de '+listaE(a.map(String));
}
/* O que a estimativa da regularização do n.º 20 não conta (N031, N125), de
   uma entrada de r.regularizacoes (fisco-resumo.js:fiscoRegularizacoes): os
   anos do período de que a app não tem rendas (anosEmFalta) — a diferença
   deles também se regulariza — e os anos para os quais a app não tem as
   regras (antes de 2025), «por confirmar»: a diferença que as regras de 2025
   dariam (porConfirmar [{ano, diferenca}], totalPorConfirmar), fora do total
   e da estimativa; um resumo que só traz anosSemRegras, sem porConfirmar, di
   os anos sem valor; e um resumo de antes que os somava com as regras de
   outro ano (o ano está também em anos) di-los somados mas por confirmar.
   Lida com cuidado: sem os campos, nada.
   Recebe: g — a entrada (ou a regularizacao de fiscoExpQuadro10/fiscoExpDhd,
   que os leva).
   Devolve: {emFalta:[AAAA], semRegras:[AAAA], porConfirmar:[{ano,
   diferenca}], totalPorConfirmar, somados (true quando os anos sem regras
   estão no total), texto ('' sem nada; senão a frase sem ponto final, ex.:
   «faltam os anos de 2020 a 2021, de que a app não tem rendas: a diferença
   deles também se regulariza; por confirmar, de 2022 a 2024 (2022: 720,00 €;
   2023: 720,00 €; 2024: 720,00 €, com as regras de 2025): a app não tem as
   regras desses anos, e a diferença deles fica fora da estimativa»)}. */
function fiscoExpRegularizacaoFalta(g){
  g=g||{};
  const anos=xs=>(Array.isArray(xs)?xs:[]).map(Number).filter(y=>y>1900&&y<3000).filter((y,i,a)=>a.indexOf(y)===i).sort((x,y)=>x-y);
  const pc=(Array.isArray(g.porConfirmar)?g.porConfirmar:[]).filter(a=>a&&Number(a.ano)>1900).map(a=>({ano:Number(a.ano),diferenca:r2(Number(a.diferenca)||0)})).sort((x,y)=>x.ano-y.ano);
  const emFalta=anos(g.anosEmFalta),semRegras=anos((Array.isArray(g.anosSemRegras)?g.anosSemRegras:[]).concat(pc.map(a=>a.ano)));
  const comDif=(Array.isArray(g.anos)?g.anos:[]).filter(a=>a&&Number(a.diferenca)).map(a=>Number(a.ano));
  const somados=semRegras.length>0&&semRegras.some(y=>comDif.includes(y));
  const tpc=r2(Number(g.totalPorConfirmar)||sum(pc.map(a=>a.diferenca))),um=semRegras.length===1;
  const versao=String(((typeof irsAno==='function'?irsAno(semRegras[0]||0):null)||{}).ano||'');
  const ps=[];
  if(emFalta.length)ps.push((emFalta.length===1?'falta o ano ':'faltam os anos ')+fiscoExpAnos(emFalta)+', de que a app não tem rendas: a diferença '+(emFalta.length===1?'dele':'deles')+' também se regulariza');
  if(semRegras.length)ps.push('por confirmar, '+fiscoExpAnos(semRegras)
    +(pc.some(a=>a.diferenca)&&!somados?' ('+pc.filter(a=>a.diferenca).map(a=>a.ano+': '+euro2(a.diferenca)).join('; ')+(versao?', com as regras de '+versao:'')+')':'')
    +': a app não tem as regras '+(um?'desse ano':'desses anos')
    +(somados?', e estima-'+(um?'o':'os')+' com as de outro ano':', e a diferença '+(um?'dele':'deles')+' fica fora da estimativa'));
  return {emFalta:emFalta,semRegras:semRegras,porConfirmar:pc,totalPorConfirmar:somados?0:tpc,somados:somados,texto:ps.join('; ')};
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
   o PDF: quanto abate (de cada titular, em conjunta) ao rendimento, quanto
   desce o imposto e em quanto fica — com o mesmo par de nomes do KPI da
   página (N123): «imposto estimado» é o das linhas, e o de depois é «depois
   dos prejuízos de anos anteriores» —, e o que pode faltar à conta da app.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o texto, ou '' sem abate. */
function fiscoExpReporteTexto(r){
  const x=fiscoExpReporte(r);if(!x)return '';
  const quem=x.porTitular.some(t=>t.letra)?' ('+x.porTitular.map(t=>(t.letra?'titular '+t.letra+' ':'')+euro2(t.usado)).join(' e ')+')':'';
  return 'Prejuízos de anos anteriores: abatem '+euro2(x.usado)+quem+' ao rendimento líquido; o imposto desce '+euro2(x.imposto)+': depois dos prejuízos de anos anteriores, '+euro2(x.depois)+'.'
    +(x.resto>0?' Ficam '+euro2(x.resto)+' para os anos seguintes.':'')
    +' A conta é feita com o que a app sabe e pode faltar informação: imóveis fora da app, anos sem registos'+(x.anosSemDados.length?' ('+fiscoExpAnos(x.anosSemDados)+')':'')
    +' e a condição de os prédios darem rendas 36 meses nos cinco anos seguintes (CIRS art. 55.º n.º 8). A AT faz a conta, titular a titular.';
}
/* A ressalva das regiões autónomas (N120): a estimativa usa as taxas do
   continente, e nos Açores as taxas do IRS são 30 % mais baixas (DLR 2/99/A,
   art. 4.º), também as especiais do art. 72.º — a AT aplica-as pela
   residência. Na Madeira as taxas especiais não descem, e não se diz. O
   texto, o CSV e o PDF dizem-na junto do imposto estimado, como a página. */
const FISCO_EXP_ACORES='taxas do continente; nos Açores a AT aplica menos 30 %';
/* Os prejuízos de anos que não estão na app (N124): a estimativa só abate os
   que a app conhece (o r.reporte), e quem tem prejuízos de anos sem registos
   não o lê em lado nenhum. Uma frase, com os anos da janela do reporte sem
   dados (r.reporte.anosSemDados), só quando há imposto estimado, as regras do
   ano e nenhum abate (com abate, a frase do reporte já diz os anos sem
   registos — fiscoExpReporteTexto). A mesma frase da explicação do KPI da
   página.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: a frase, ex.: «Prejuízos de anos que não estão na app (de 2019 a
   2024) não entram nesta estimativa; a AT abate-os na liquidação.», ou ''. */
function fiscoExpPrejuizosForaTexto(r){
  const R=(r&&r.reporte)||{},ys=Array.isArray(R.anosSemDados)?R.anosSemDados:[];
  if(!ys.length||fiscoExpSemRegras(r)||fiscoExpReporte(r)||!(Number(((r&&r.totais)||{}).imposto)>0))return '';
  const a=fiscoExpAnos(ys);
  return 'Prejuízos de anos que não estão na app'+(a?' ('+a+')':'')+' não entram nesta estimativa; a AT abate-os na liquidação.';
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
  const I=fiscoExpImpostos(r),T=r.totais||{},out=['imposto estimado '+euro2(I.imposto)];
  if(I.reporte)out.push('depois dos prejuízos de anos anteriores '+euro2(I.depoisReporte));
  if(I.abate)out.push('depois do AIMI '+euro2(I.final));
  if(I.regularizacao)out.push('com a regularização '+fiscoExpRegularizacaoQuadros(r)+' '+euro2(I.comRegularizacao)+' (+'+euro2(I.regularizacao)+', estimativa sem juros'+(fiscoExpRegularizacaoIncompleta(r)?' e sem os anos em falta ou por confirmar':'')+')');
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
   com o texto da tabela da versão do ano (naturezasTexto). No quadro 4.3
   (D120), todas as linhas, com a tabela dele (quadro43.naturezasTexto: 01 a
   prestação mensal, 02 a prestação anual da caução).
   Recebe: r — o resumo; l — a linha.
   Devolve: '' na linha das rendas do 4.1 e do 4.2; senão o texto da
   natureza, ex.: «indemnizações que visem compensar perdas de rendimentos da
   categoria F», «prestação pecuniária mensal (rendas)». */
function fiscoExpNaturezaTexto(r,l){
  if(!l)return '';
  /* no quadro 4.3 (D120) a tabela é a dele, também na linha das rendas */
  if(fiscoExpEhDhd(r,l)){
    const t=String(((((((r||{}).versao||{}).quadro43)||{}).naturezasTexto)||{})[l.natureza]||'');
    return t?t.charAt(0).toLowerCase()+t.slice(1):'';
  }
  if(!l.papel||l.papel==='renda')return '';
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

/* Os ajudantes da vaga 4 da auditoria ao IRS (a ronda 2): leem os campos da
   1.7 do resumo (fisco-resumo.js — o quadro 4.3, os benefícios do quadro 6, o
   Anexo J, a categoria B, as freguesias repostas) com cuidado: um resumo que
   ainda não os tenha cai no que havia antes. Os nomes e os códigos do
   impresso vêm da versão do ano (irs-AAAA.js: quadros, quadro43, beneficios,
   anexoJ). */

/* O que a renda ilíquida é (D112): a do recibo, por inteiro. O texto e o PDF
   dizem-no. */
const FISCO_EXP_RENDA_DO_RECIBO='a renda do recibo, antes da retenção, da comissão e de descontos';
/* De onde vêm o código da freguesia, o tipo e o artigo (D137): a caderneta de
   agora, não a da compra, desde a reposição das freguesias de 2025. O PDF
   di-lo ao lado da identificação matricial. */
const FISCO_EXP_CADERNETA_NOTA='O código da freguesia, o tipo e o artigo são os da caderneta predial atual (Portal das Finanças › Imóveis) ou da nota de cobrança do IMI mais recente, não os da caderneta da compra: em outubro de 2025 foram repostas 303 freguesias (Lei 25-A/2025), e nas que eram uniões de freguesias o código e o artigo mudaram.';
/* Para onde vão as rendas da categoria B (D134), e porquê. */
const FISCO_EXP_CATEGORIA_B_NOTA='Rendas tributadas na categoria B — por opção (CIRS art. 4.º n.º 1 n), na declaração de início ou de alterações de atividade) ou por o imóvel estar afeto à tua atividade (art. 3.º n.º 2 a)): declaram-se no Anexo B ou C, com a atividade, e não no Anexo F. O Modelo 2 e os recibos continuam.';
/* Se uma linha é do quadro 4.3, o do direito real de habitação duradoura
   (D120): o quadro da linha é o quadros.dhd da versão.
   Recebe: r — o resumo; l — a linha.
   Devolve: true ou false. */
function fiscoExpEhDhd(r,l){
  const Q=(((r||{}).versao||{}).quadros)||{};
  return !!(l&&Q.dhd&&l.quadro===Q.dhd);
}
/* Os quadros que as linhas do Anexo F podem ter, para os títulos e os
   totais: o 4.1 e o 4.2 sempre, e o 4.3 quando o ano tem um direito real de
   habitação duradoura (D120).
   Recebe: r — o resumo.
   Devolve: os quadros (array), ex.: ['4.1', '4.2', '4.3']. */
function fiscoExpQuadrosDasLinhas(r){
  const Q=(((r||{}).versao||{}).quadros)||{},qs=[Q.semReducao||'4.1',Q.comReducao||'4.2'];
  if((r.linhas||[]).some(l=>fiscoExpEhDhd(r,l)))qs.push(Q.dhd);
  return qs;
}
/* O nome de uma coluna do quadro 4.3, ou de um dos gastos obrigatórios dele,
   como as instruções o escrevem (quadro43.colunas, quadro43.gastos).
   Recebe: r — o resumo; id — o id da coluna ('escritura', 'caucao'…) ou do
   gasto ('conservacaoExtra'…); lista (opcional) — 'colunas' (sem ela) ou
   'gastos'.
   Devolve: o nome; sem ele na versão, o id. */
function fiscoExpNome43(r,id,lista){
  const xs=((((r||{}).versao||{}).quadro43)||{})[lista||'colunas'];
  const x=(Array.isArray(xs)?xs:[]).find(c=>Array.isArray(c)&&c[0]===id);
  return String(x?x[1]:id);
}
/* O que o quadro 4.3 pede de uma linha de um DHD, além do que o 4.1 também
   tem (D120): a data da escritura, a caução dela, a caução recebida no ano
   (não é rendimento: CIRS art. 8.º n.º 5 b)), os gastos obrigatórios com os
   nomes das instruções, a cessação com o motivo da tabela do 4.3 e, num DHD
   cessado por acordo, a regularização do art. 72.º n.º 20 (r.regularizacoes
   com dhd, só na linha das rendas). Lê o l.dhd do resumo.
   Recebe: r — o resumo; l — a linha.
   Devolve: null fora do 4.3; senão {escritura, caucao, caucaoRecebida,
   gastosTitulo, gastos:[{id, nome, valor}], cessacao (null ou {data, motivo,
   curto}), cessacaoTexto (ex.: «30/06/2026 · motivo 01 (Por acordo das
   partes)», ou '—'), regularizacao (null ou {anos:[{ano, diferenca}], total,
   dhd:true, anosEmFalta, anosSemRegras, porConfirmar, totalPorConfirmar}),
   regularizacaoFalta (null ou o fiscoExpRegularizacaoFalta, com anos em
   falta ou por confirmar)}. */
function fiscoExpDhd(r,l){
  if(!fiscoExpEhDhd(r,l))return null;
  const d=l.dhd&&typeof l.dhd==='object'?l.dhd:{},q=((((r||{}).versao||{}).quadro43)||{}),g=d.gastos||{};
  const gs=(Array.isArray(q.gastos)?q.gastos:[]).filter(x=>Array.isArray(x)&&x[0]).map(x=>({id:x[0],nome:String(x[1]||x[0]),valor:r2(Number(g[x[0]])||0)}));
  const cs=d.cessacao&&d.cessacao.data?d.cessacao:null,mo=cs?String(cs.motivo||''):'';
  const m=mo&&(Array.isArray(q.motivos)?q.motivos:[]).find(x=>x&&String(x.codigo)===mo);
  const reg=(l.papel||'renda')==='renda'?(Array.isArray(r.regularizacoes)?r.regularizacoes:[]).find(x=>x&&x.dhd&&x.contratoId===l.contratoId):null;
  const anos=reg&&Array.isArray(reg.anos)?reg.anos.filter(a=>a&&Number(a.diferenca)):[],total=reg?r2(Number(reg.total)||sum(anos.map(a=>Number(a.diferenca)||0))):0;
  const cessacao=cs?{data:String(cs.data),motivo:mo,curto:m?String(m.curto||m.texto||''):''}:null;
  /* os anos sem rendas na app e os por confirmar (N031, N125), também com total 0 */
  const fx=reg?fiscoExpRegularizacaoFalta(reg):null;
  return {escritura:String(d.escritura||''),caucao:r2(Number(d.caucao)||0),caucaoRecebida:r2(Number(d.caucaoRecebida)||0),
    gastosTitulo:fiscoExpNome43(r,'gastos'),gastos:gs,cessacao:cessacao,
    cessacaoTexto:cessacao?dPT(cessacao.data)+' · '+(mo?'motivo '+mo+(cessacao.curto?' ('+cessacao.curto+')':''):'motivo por indicar'):'—',
    regularizacao:total>0?{anos:anos.map(a=>({ano:a.ano,diferenca:r2(Number(a.diferenca))})),total:total,dhd:true,
      anosEmFalta:fx.emFalta,anosSemRegras:fx.semRegras,porConfirmar:fx.porConfirmar,totalPorConfirmar:fx.totalPorConfirmar}:null,
    regularizacaoFalta:fx&&fx.texto?fx:null};
}
/* De que quadros é a regularização que acresce ao imposto do ano: a do
   quadro 10 (um contrato que acabou antes do prazo por motivo do senhorio,
   D10) e a do quadro 4.3 (um DHD cessado por acordo, D120). Sem
   regularização nenhuma, o quadro 10.
   Recebe: r — o resumo.
   Devolve: o texto, ex.: «do quadro 10», «do quadro 4.3», «dos quadros 10 e
   4.3». */
function fiscoExpRegularizacaoQuadros(r){
  const Q=(((r||{}).versao||{}).quadros)||{},rs=(Array.isArray(r&&r.regularizacoes)?r.regularizacoes:[]).filter(x=>x&&Number(x.total)>0),qs=[];
  if(!rs.length||rs.some(x=>!x.dhd))qs.push(Q.cessados||'10');
  if(rs.some(x=>x.dhd))qs.push(Q.dhd||'4.3');
  return (qs.length>1?'dos quadros ':'do quadro ')+listaE(qs);
}
/* O líquido sobre que o imposto de uma linha se estima (D119, D121): o
   l.liquidoTributavel do resumo (as rendas do 6C a 50 %, as obras do 6B a
   110 %); sem ele, o líquido do quadro.
   Recebe: l — a linha.
   Devolve: euros. */
function fiscoExpLiquidoImposto(l){
  const x=l&&l.liquidoTributavel;
  return r2(typeof x==='number'&&isFinite(x)?x:Number(l&&l.liquido)||0);
}
/* Os benefícios do quadro 6 de uma linha (D117, D119, D121: o 6A, o 6B, o
   6C), cada um com o campo do 4.1 que o quadro aponta e o que muda: a taxa
   (6A), a parte das rendas (6C) ou das obras dos 24 meses (6B) que conta no
   imposto. Lê o l.beneficios do resumo.
   Recebe: r — o resumo; l — a linha.
   Devolve: [{id, quadro, nome, curto, lei, aviso, campo, muda, efeito}] —
   muda 'taxa', 'rendas', 'obras' ou ''; efeito a
   frase, ex.: «taxa de 5 %», «as rendas (6 000,00 €) contam 50 % no
   imposto»; [] sem benefícios. */
function fiscoExpBeneficios(r,l){
  const pct=x=>dec(r2(Number(x)*100))+' %';
  return (Array.isArray(l&&l.beneficios)?l.beneficios:[]).filter(b=>b&&b.quadro).map(b=>({id:String(b.id||''),quadro:String(b.quadro),
    nome:String(b.nome||b.curto||''),curto:String(b.curto||b.nome||''),lei:String(b.lei||''),aviso:String(b.aviso||''),campo:String(l.campo||''),
    muda:b.taxa!=null&&isFinite(Number(b.taxa))?'taxa':b.fator!=null&&isFinite(Number(b.fator))?'rendas':b.fatorObras24!=null&&isFinite(Number(b.fatorObras24))?'obras':'',
    efeito:b.taxa!=null&&isFinite(Number(b.taxa))?'taxa de '+dec(Number(b.taxa))+' %'
      :b.fator!=null&&isFinite(Number(b.fator))?'as rendas ('+euro2(l.rendas)+') contam '+pct(b.fator)+' no imposto'
      :b.fatorObras24!=null&&isFinite(Number(b.fatorObras24))?'as obras dos 24 meses ('+euro2(Number((l.obras24||{}).valor)||0)+') contam '+pct(b.fatorObras24)+' no imposto':''}));
}
/* Os quadros 6A, 6B e 6C do ano com linhas, cada um com as linhas que
   aponta (como o 6D, pelo campo do 4.1), pela ordem do impresso.
   Recebe: r — o resumo.
   Devolve: [{quadro, nome, lei, campos, linhas:[{linha, beneficio}]}] —
   beneficio o de fiscoExpBeneficios. */
function fiscoExpQuadros6(r){
  const por={};
  (r.linhas||[]).forEach(l=>fiscoExpBeneficios(r,l).forEach((b,i)=>{
    const o=(l.beneficios||[]).filter(x=>x&&x.quadro)[i]||{};
    const x=por[b.quadro]||(por[b.quadro]={quadro:b.quadro,nome:b.nome,lei:b.lei,campos:Array.isArray(o.campos)?o.campos.slice():[],linhas:[]});
    x.linhas.push({linha:l,beneficio:b});
  }));
  return Object.keys(por).sort().map(k=>por[k]);
}
/* O líquido sobre que o imposto do ano se estima, quando não é o do quadro
   (D119, D121): o quadro leva as rendas e as obras por inteiro, e é a AT que
   aplica os fatores pelos campos do 6B e do 6C; a estimativa usa-os já. O
   KPI do líquido (totais.liquido) continua o do quadro.
   Recebe: r — o resumo.
   Devolve: null quando é igual ao rendimento líquido; senão {valor,
   porque} — porque ex.: «no 6C as rendas contam 50 %, no 6B as obras dos 24
   meses 110 %». */
function fiscoExpLiquidoTributavel(r){
  /* só as linhas com um benefício que muda o líquido (o 6C, o 6B) */
  const ls=(r.linhas||[]).filter(l=>l&&!l.isencao&&fiscoExpBeneficios(r,l).some(b=>b.muda==='rendas'||b.muda==='obras'));
  const dif=r2(sum(ls.map(l=>fiscoExpLiquidoImposto(l)-(Number(l.liquido)||0))));
  if(!dif)return null;
  const pct=x=>dec(r2(Number(x)*100))+' %',ps=[];
  ls.forEach(l=>(Array.isArray(l.beneficios)?l.beneficios:[]).forEach(b=>{
    const t=!b?'':b.fator!=null&&isFinite(Number(b.fator))?'no '+b.quadro+' as rendas contam '+pct(b.fator)
      :b.fatorObras24!=null&&isFinite(Number(b.fatorObras24))?'no '+b.quadro+' as obras dos 24 meses '+pct(b.fatorObras24):'';
    if(t&&!ps.includes(t))ps.push(t);
  }));
  return {valor:r2((Number((r.totais||{}).liquido)||0)+dif),porque:ps.join(', ')};
}
/* O código da freguesia de uma linha que é o de uma união de freguesias
   desagregada em outubro de 2025 (D135; o l.freguesiaUniao do resumo, só nas
   declarações de 2025 em diante): o prédio passou para uma das freguesias
   repostas, e o artigo pode ter mudado; só a caderneta atual diz qual. O
   código de uma união já não está em nenhuma caderneta atual: é sempre
   falta, também com o dia da marca da caderneta (l.matrizConfirmada, N087).
   Recebe: l — a linha.
   Devolve: null sem união extinta; senão {codigo, repostas (texto, ex.:
   «130818 Leça da Palmeira ou 130820 Matosinhos»), repostasLista
   (['130818 Leça da Palmeira', …]), confirmada ('AAAA-MM-DD' ou ''), frase,
   falta (que começa por «código da freguesia»)}. */
function fiscoExpFreguesia(l){
  const u=l&&l.freguesiaUniao;if(!u||!u.codigo)return null;
  const rs=(Array.isArray(u.repostas)?u.repostas:[]).filter(Boolean).map(x=>(String(x.codigo||'')+' '+String(x.nome||'')).trim()).filter(Boolean);
  const lista=rs.length<2?(rs[0]||''):rs.slice(0,-1).join(', ')+' ou '+rs[rs.length-1];
  const conf=/^\d{4}-\d{2}-\d{2}$/.test(String(l.matrizConfirmada||''))?String(l.matrizConfirmada):'';
  const frase=String(u.codigo)+' é o código de uma união de freguesias que deixou de existir em outubro de 2025 (Lei 25-A/2025): o prédio passou para '
    +(rs.length>1?'uma destas: ':'')+(lista||'uma das freguesias repostas')+', e o artigo pode ter mudado';
  return {codigo:String(u.codigo),repostas:lista,repostasLista:rs,confirmada:conf,frase:frase,
    falta:'código da freguesia e artigo a trocar pelos da caderneta predial atual ('+frase+')'};
}
/* As faltas de uma linha como o texto e o CSV as escrevem: as do resumo e,
   numa freguesia de uma união extinta ainda por confirmar, a dela (D135).
   Recebe: l — a linha.
   Devolve: as faltas (array de textos). */
function fiscoExpFaltas(l){
  const fx=fiscoExpFreguesia(l),fs=(Array.isArray(l&&l.faltas)?l.faltas:[]).slice();
  if(fx&&fx.falta)fs.push(fx.falta);
  return fs;
}
/* O quadro 7A do Anexo J (D133, Q12): as rendas de imóveis fora de Portugal,
   que não vão ao Anexo F — por contrato e titular, com o código do
   rendimento e o quadro da versão (anexoJ), o país e o código dele (tabela X
   das instruções do Anexo J), as rendas, os gastos do período arrendado, o
   líquido e o imposto pago lá. Sem imposto estimado. Lê o r.anexoJ do
   resumo.
   O Anexo J é individual (instruções do Anexo J, quadro 3A: um anexo por
   titular, com o NIF dele, e o 7A não tem coluna de titular — N010): em
   conjunta, as entradas agrupam-se por titular, cada grupo com o seu total
   («Anexo J do titular A»), e não há total dos dois que se copie.
   Recebe: r — o resumo.
   Devolve: null sem nenhum; senão {quadro, codigo, conjunta, entradas:[entrada
   do resumo + {paisTexto, faltas}], porTitular:[{titular, titulo, entradas,
   totais}], totais:{n, rendas, gastos, liquido, impostoEstrangeiro,
   retencoes}} — porTitular um grupo por titular, pela letra (um só fora da
   conjunta); titulo «Anexo J do titular A» em conjunta, «Anexo J» fora
   (fiscoExpAnexoJTitulo); totais os de todas as entradas, só para a linha
   do que saiu do Anexo F (nunca para copiar para um anexo). */
function fiscoExpAnexoJ(r){
  const es=(Array.isArray(r&&r.anexoJ)?r.anexoJ:[]).filter(Boolean);if(!es.length)return null;
  const J=((((r||{}).versao||{}).anexoJ)||{}),conj=fiscoExpConjunta(r);
  const xs=es.map(e=>{
    const pais=String(e.pais||''),cod=String(e.paisCodigo||'');
    return Object.assign({},e,{codigo:String(e.codigo||J.codigo||''),pais:pais,paisCodigo:cod,faltas:Array.isArray(e.faltas)?e.faltas.slice():[],
      paisTexto:(pais||'país por indicar')+(cod?' · código '+cod:' · falta o código do país (tabela X das instruções do Anexo J)')});
  });
  const tot=ys=>{const s=k=>r2(sum(ys.map(e=>Number(e[k])||0)));return {n:ys.length,rendas:s('rendas'),gastos:s('gastos'),liquido:s('liquido'),impostoEstrangeiro:s('impostoEstrangeiro'),retencoes:s('retencoes')}};
  /* um grupo por titular, pela letra; fora da conjunta, um só */
  const letras=conj?xs.map(e=>String(e.titular||'A')).filter((x,i,a)=>a.indexOf(x)===i).sort():[''];
  const porTitular=letras.map(t=>{const ys=conj?xs.filter(e=>String(e.titular||'A')===t):xs;
    return {titular:conj?t:'',titulo:fiscoExpAnexoJTitulo(r,conj?t:''),entradas:ys,totais:tot(ys)}});
  return {quadro:String(J.quadro||'7A'),codigo:String(J.codigo||''),conjunta:conj,entradas:porTitular.reduce((a,g)=>a.concat(g.entradas),[]),porTitular:porTitular,totais:tot(xs)};
}
/* Se a declaração é conjunta para as saídas: dois titulares e a quota-parte
   de cada um (não os valores por inteiro). Não é o r.variosTitulares, que é
   das linhas do Anexo F e fica false com o Anexo J sozinho.
   Recebe: r — o resumo.
   Devolve: true ou false. */
function fiscoExpConjunta(r){return !!r&&!r.porInteiro&&(r.titulares||[]).length>1}
/* O nome do Anexo J de um titular (N010): em conjunta, «Anexo J do titular
   A» — cada titular entrega o seu —; fora dela, «Anexo J»; com os valores
   por inteiro dos dois («A/B»), o Anexo J de cada um, na sua quota-parte.
   Recebe: r — o resumo; t — a letra do titular ('' fora da conjunta).
   Devolve: o texto, ex.: «Anexo J do titular A». */
function fiscoExpAnexoJTitulo(r,t){
  t=String(t||'');
  return !t?'Anexo J':t.indexOf('/')>-1?'Anexo J de cada titular ('+t+'), na sua quota-parte':'Anexo J do titular '+t;
}
/* O que o texto e o PDF dizem do Anexo J (D133, Q12): porque é que estas
   rendas não estão no Anexo F, o que o quadro pede (os imóveis do mesmo país
   podem somar-se numa linha), que a app não estima o imposto delas e, em
   conjunta, que o anexo é individual — cada titular entrega o seu, com o NIF
   dele no quadro 3A (N010).
   Recebe: r — o resumo.
   Devolve: o texto. */
function fiscoExpAnexoJNota(r){
  const J=fiscoExpAnexoJ(r)||{quadro:String(((((r||{}).versao||{}).anexoJ)||{}).quadro||'7A'),codigo:'',conjunta:fiscoExpConjunta(r)};
  return (J.conjunta?'O Anexo J é individual: cada titular entrega o seu, com o NIF dele no quadro 3A, e só com as rendas da sua quota-parte. ':'')
    +'O Anexo F é só dos imóveis em Portugal. As rendas de um imóvel no estrangeiro declaram-se no quadro '+J.quadro+' do Anexo J'
    +(J.codigo?', com o código '+J.codigo:'')+', o país (tabela X das instruções do Anexo J), o rendimento líquido dos gastos do período arrendado e o imposto pago lá, com o comprovativo;'
    +' os imóveis do mesmo país podem somar-se numa linha. O crédito por dupla tributação (CIRS art. 81.º) calcula-o a AT. A app não estima o imposto destas rendas.';
}
/* As rendas da categoria B (D134), fora do Anexo F: por contrato, com o
   valor na quota da declaração, as rendas contadas à parte da caução
   (e.nCaucao, dentro de e.n) e a parte dos gastos do imóvel que saiu com
   elas (e.gastos ou e.gastosTotal; sem eles, a soma de e.gastosColunas —
   N141), como o cartão da página (fisco-quadros.js:fiscoCategoriaBCard). Lê
   o r.categoriaB do resumo, com cuidado: sem os campos, sem gastos.
   Recebe: r — o resumo.
   Devolve: null sem nenhuma; senão {entradas:[{contratoId, nome, imovel,
   rendas, retencoes, n, nCaucao, caucao, quota, gastos, liquido, conta}],
   totais:{n, rendas, retencoes, gastos}} — conta o texto, ex.: «12 rendas e
   a caução»; liquido as rendas menos os gastos. */
function fiscoExpCategoriaB(r){
  const es=(Array.isArray(r&&r.categoriaB)?r.categoriaB:[]).filter(Boolean).map(e=>{
    const n=Number(e.n)||0,nc=Math.max(0,Number(e.nCaucao)||0),cau=r2(Number(e.caucao)||0),nr=Math.max(0,n-nc),rendas=r2(Number(e.rendas)||0);
    const cols=e.gastosColunas&&typeof e.gastosColunas==='object'?e.gastosColunas:e.gastos&&typeof e.gastos==='object'?e.gastos:{};
    const gt=typeof e.gastos==='number'?e.gastos:Number(e.gastosTotal),g=isFinite(gt)&&gt>0?r2(gt):r2(sum(Object.keys(cols).map(k=>Math.max(0,Number(cols[k])||0))));
    return {contratoId:e.contratoId,nome:String(e.nome||''),imovel:String(e.imovel||''),rendas:rendas,retencoes:r2(Number(e.retencoes)||0),n:n,nCaucao:nc,caucao:cau,
      quota:Number(e.quota)||0,gastos:g,liquido:r2(rendas-g),
      conta:nr>0?fiscoN(nr,'renda','rendas')+(cau>0||nc>0?' e a caução':''):cau>0||nc>0?'a caução':fiscoN(n,'renda','rendas')};
  });
  if(!es.length)return null;
  return {entradas:es,totais:{n:es.length,rendas:r2(sum(es.map(e=>e.rendas))),retencoes:r2(sum(es.map(e=>e.retencoes))),gastos:r2(sum(es.map(e=>e.gastos)))}};
}
/* O que se diz dos gastos da categoria B (N141), quando há: no regime
   simplificado, o resultado destas rendas é o rendimento líquido pelas
   regras da categoria F, as rendas menos estes gastos (CIRS art. 31.º n.º
   4), como a página o diz. */
const FISCO_EXP_CATEGORIA_B_GASTOS='Os gastos do imóvel que saíram com estas rendas estão em cada contrato, pelas mesmas regras do Anexo F: no regime simplificado, o resultado destas rendas é o rendimento líquido pelas regras da categoria F, as rendas menos estes gastos (CIRS art. 31.º n.º 4).';
/* A frase dos totais com o que saiu do Anexo F (D133, D134): o Anexo J — o
   de cada titular, em conjunta (N010) — e a categoria B, com o valor de cada
   um.
   Recebe: r — o resumo.
   Devolve: o texto, ex.: «Fora do Anexo F: Anexo J (quadro 7A) — rendas
   12 000,00 €, líquido 11 400,00 € · categoria B (Anexo B ou C) — rendas
   9 600,00 €», ou '' sem nada fora. */
function fiscoExpForaDoAnexoFTexto(r){
  const J=fiscoExpAnexoJ(r),B=fiscoExpCategoriaB(r),out=[];
  if(J)J.porTitular.forEach(g=>out.push(g.titulo+' (quadro '+J.quadro+') — rendas '+euro2(g.totais.rendas)+', líquido '+euro2(g.totais.liquido)));
  if(B)out.push('categoria B (Anexo B ou C) — rendas '+euro2(B.totais.rendas));
  return out.length?'Fora do Anexo F: '+out.join(' · '):'';
}

/* O resumo em texto simples (o retrato legível do resumo, que os testes
   leem): a linha das regras (fiscoRegrasTexto), os totais (o prejuízo a
   reportar de cada titular, os isentos do 6D, o AIMI do quadro 9; o imposto
   sem englobamento, nunca negativo, com a ressalva dos Açores —
   FISCO_EXP_ACORES), uma entrada por linha do quadro, pela ordem em que se
   preenche, com o campo (4001…), o quadro, o titular, o NIF ou o país de
   cada inquilino, os valores, o 4.2A e o 4.2B com o campo a que se ligam, e
   as faltas; o 4.2C (fiscoExpLimite42C); depois o que ficou fora, as rendas
   sem contrato, o quadro 8, facultativo, com as partes do 4.x e do 5 e o
   prazo das substituições (fiscoQuadro8Texto), o quadro 10 (fiscoExpQuadro10:
   por contrato e titular, pela ordem do impresso, com a regularização do
   motivo 01 e os anos que ela não conta — fiscoExpRegularizacaoFalta; num ano
   sem linhas, fiscoExpSemRendasTexto), o que há a tratar e o IRS_AVISO. Os
   mesmos números da página, de quem declara (fiscoQuemDeclara). Nos totais, o
   imposto estimado das linhas e, quando os há, o abate dos prejuízos de anos
   anteriores com o imposto «depois dos prejuízos de anos anteriores»
   (fiscoExpReporteTexto) — sem abate, os prejuízos de anos que não estão na
   app (fiscoExpPrejuizosForaTexto) — e o imposto depois do AIMI; sem regras
   do ano, sem taxa nem imposto (D50). Em cada linha, a taxa de cada período
   (fiscoExpTaxa), a natureza assumida, a taxa escrita no contrato quando não
   é a da lei, o campo do modelo novo por conhecer, a resposta do 4.2A
   (fiscoExpComunicacao) e o 4.2B sempre que o contrato o tem
   (fiscoExpElegivel24). Da vaga 3: as linhas 05 e 02 com o texto da
   natureza; a quota com as casas que tem, a de cada parte do ano e os de
   fora; a caução, os reembolsos e as devoluções; os gastos e as obras com os
   nomes do impresso e a condição das obras; a atualização de 2023; o quadro
   5, as obras por confirmar e os prédios do quadro 9; e, em conjunta, a
   frase das letras do Rosto. Da ronda 2 (vaga 4): o quadro 4.3 de um direito
   real de habitação duradoura (fiscoExpDhd — D120); os quadros 6A, 6B e 6C
   (fiscoExpQuadros6 — D117, D119, D121), com o líquido sobre que o imposto se
   estima (fiscoExpLiquidoTributavel); o quadro 7A do Anexo J, um bloco por
   titular em conjunta, com o total de cada um (fiscoExpAnexoJ — D133, N010)
   e a categoria B (fiscoExpCategoriaB — D134), fora do Anexo F, com o valor
   nos totais; a freguesia de uma união extinta em 2025 a confirmar
   (fiscoExpFreguesia — D135); e o que a renda ilíquida é (D112).
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
  /* o quadro 8, facultativo (N082): cada parte de um ano anterior com o
     quadro e o campo de onde é — também as do quadro 5 (N110) — e o texto
     do cartão da página */
  const aa=fiscoExpAnosAnteriores(r),q8=aa.length?'\nQUADRO '+(Q.anosAnteriores||'8')+' · RENDAS DE ANOS ANTERIORES (facultativo)\n'
    +aa.map(x=>x.anos.map(a=>`  ${x.linha.nome}${x.linha.imovel?' — '+x.linha.imovel:''}${r.variosTitulares?' · titular '+(x.linha.titular||'A'):''} · respeitam a ${a.ano}: ${euro2(a.valor)} · quadro ${x.quadro}${x.campo?', campo '+x.campo:''}${Number(a.retencoes)>0?' · retenções '+euro2(a.retencoes):''}`).join('\n')).join('\n')
    +'\n  '+fiscoQuadro8Texto(r)+'\n':'';
  /* o código da freguesia, e o de uma união extinta em 2025 a trocar (D135),
     também com a marca da caderneta (N087) */
  const fregTxt=l=>{const fx=fiscoExpFreguesia(l);return (l.freguesiaCodigo||'—')+(fx?' (a trocar: deixou de existir)':'')};
  /* o quadro 10 pela ordem do impresso: o regime, o n.º, o ano de início do
     benefício (a confirmar quando a app não o sabe), a cessação e, na linha
     de baixo, a identificação matricial, o titular e os inquilinos — uma
     entrada por titular em conjunta */
  const q10t=q10.length?'\nQUADRO '+(Q.cessados||'10')+' · CONTRATOS QUE ACABARAM (com redução pela duração ou isenção)\n'+q10.map(x=>`  ${x.nome}${x.imovel?' — '+x.imovel:''}${r.variosTitulares&&x.titular?' · titular '+x.titular:''}: regime ${x.regime?x.regime+(x.regimeTexto?' ('+x.regimeTexto+')':''):'—'} · ${x.numero?'n.º '+x.numero:'sem n.º na AT'} · benefício desde ${x.anoInicioBeneficio||'—'}${x.anoInicioConfirmar?' (a confirmar)':''} · cessação ${dPT(x.data)||'—'} · motivo ${x.motivo?x.motivo+(x.motivoCurto?' ('+x.motivoCurto+')':''):'por indicar'}
    Freguesia ${fregTxt(x)} · ${x.tipoPredio||'—'} · artigo ${x.artigo||'—'}${x.fracao?' · fração '+x.fracao:''} · titular ${x.titular||'—'} · inquilinos: ${x.inquilinos.length?x.inquilinos.map((t,i)=>t.nome+' ('+x.ids[i].texto+')').join(', '):'—'}${x.regularizacao&&!sem?'\n    Regularização: '+fiscoExpRegularizacaoTexto(r,x.regularizacao)+'.':x.regularizacaoFalta&&!sem?'\n    Regularização (art. 72.º n.º 20, sem diferença estimada): '+x.regularizacaoFalta.texto+'.':''}${x.faltas.length?'\n    Falta: '+x.faltas.join(', ')+'.':''}`).join('\n')+'\n':'';
  /* a taxa, a natureza e o que vem com elas, numa linha do contrato */
  const taxaDe=l=>{
    /* o código do 6D ainda por conhecer diz-se, e nunca o id da app (N106) */
    if(l.isencao){const pi=fiscoExpPorConhecer(r,l);return ' · isento (quadro '+l.isencao.quadro+(l.isencao.codigo?', código '+l.isencao.codigo:pi?', código '+pi.valor:'')+')'}
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
  /* o imposto com a ressalva dos Açores (N120) e, sem abate, os prejuízos de
     anos que não estão na app (N124) */
  const impTxt=sem?'imposto estimado por conhecer (a app não tem as regras de '+ano+')':'imposto estimado '+euro2(imp.imposto)+' (sem englobamento) — '+FISCO_EXP_ACORES;
  const preFora=fiscoExpPrejuizosForaTexto(r);
  /* o 4.2C (N039): os contratos do 4.2 celebrados desde a data do n.º 23 e a resposta */
  const c42=fiscoExpLimite42C(r),c42Txt=c42?'\nQUADRO '+c42.quadro+' · LIMITE DAS RENDAS (n.º 23 do art. 72.º)\n  '+c42.texto.charAt(0).toUpperCase()+c42.texto.slice(1)+'\n  '+fiscoExpLimite42CNota(r,c42)+'\n':'';
  /* uma linha do quadro, com a natureza das linhas 05 e 02 (D21, D51), a
     quota usada e os de fora (D93, D08), o que as rendas levam (D03), os
     gastos e as obras com os nomes do impresso e a condição delas (D90, D28)
     e a atualização de 2023 (D76) */
  /* da ronda 2: o 4.3 de um DHD (D120) — a escritura, a caução, a cessação,
     os gastos obrigatórios —, os benefícios do quadro 6 (D117, D119, D121),
     a freguesia de uma união extinta (D135) */
  const dhdTxt=(l,dx)=>'\n    Quadro '+l.quadro+': escritura '+(dPT(dx.escritura)||'—')+' · caução '+(dx.caucao?euro2(dx.caucao)+' (a da escritura)':'por indicar')
    +(dx.caucaoRecebida?' · caução recebida em '+ano+': '+euro2(dx.caucaoRecebida)+' — não é rendimento (só a prestação anual do 11.º ano em diante)':'')+' · cessação '+dx.cessacaoTexto
    +(dx.regularizacao&&!sem?'\n    Regularização (art. 72.º n.º 20): '+fiscoExpRegularizacaoTexto(r,dx.regularizacao)+'.'
      :dx.regularizacaoFalta&&!sem?'\n    Regularização (art. 72.º n.º 20, sem diferença estimada): '+dx.regularizacaoFalta.texto+'.':'');
  const benTxt=l=>fiscoExpBeneficios(r,l).map(b=>'\n    Quadro '+b.quadro+(b.campo?' (campo '+b.campo+' do 4.1)':'')+': '+b.curto+(b.efeito?' · '+b.efeito:'')
    +(b.muda&&b.muda!=='taxa'&&fiscoExpLiquidoImposto(l)!==r2(Number(l.liquido)||0)?' · líquido para o imposto '+euro2(fiscoExpLiquidoImposto(l)):'')+(b.aviso?' — '+b.aviso:'')).join('');
  const linhaTxt=l=>{
    const nt=fiscoExpNaturezaTexto(r,l),qx=fiscoExpQuota(r,l),rec=fiscoExpReceitas(l),at=fiscoExpAtualizacao(r,l),dx=fiscoExpDhd(r,l),fs=fiscoExpFaltas(l);
    const outra=!!(l.papel&&l.papel!=='renda');
    return `  ${l.campo?'Campo '+l.campo+' · ':''}[${l.quadro}] ${l.atNumero?'n.º '+l.atNumero:'sem n.º na AT'} · ${l.nome} — ${l.imovel||'sem imóvel'}${outra&&nt?' · natureza '+l.natureza:''}${l.quota<1?' · quota-parte '+qx.quota+(qx.periodos?' ('+qx.periodos+')':''):''} · titular ${l.titular||'A'}
    Início ${dPT(l.inicio)||'—'} · freguesia ${fregTxt(l)} · ${l.tipoPredio||'—'} · artigo ${l.artigo||'—'}${l.fracao?' · fração '+l.fracao:''} · natureza ${l.natureza}${nt?' ('+nt+')':''}${l.naturezaAssumida&&l.natureza?' (assumida: finalidade por indicar)':''}${taxaDe(l)}${qx.foraTexto?'\n    Comproprietários fora da app: '+qx.foraTexto+' — declaram a parte deles':''}${dx?dhdTxt(l,dx):''}${benTxt(l)}
    ${dx?'Moradores':'Inquilinos'}: ${l.inquilinos.length?l.inquilinos.map(t=>t.nome+' ('+fiscoIdInquilino(t).texto+')').join(', '):'—'}
    Rendas ilíquidas ${euro2(l.rendas)}${rec.texto?' ('+rec.texto+')':''} · retenções ${euro2(l.retencoes)}${l.anosAnteriores.length?' · de anos anteriores: '+l.anosAnteriores.map(a=>a.ano+' '+euro2(a.valor)+(Number(a.retencoes)>0?' (retenções '+euro2(a.retencoes)+')':'')).join(', '):''}
    ${dx?dx.gastosTitulo+': '+dx.gastos.map(g=>g.nome+' '+euro2(g.valor)).join(' · '):gastos(l.gastos)}${l.obras24.valor&&!dx?'\n    '+G.obras+': '+G.inicioContrato+' '+(fiscoExpMesAno(l.inicio)||'—')+' · '+G.inicioGastos+' '+(fiscoExpMesAno(l.obras24.inicioGastos)||'—')+' · '+G.valor+' '+euro2(l.obras24.valor)+' ('+FISCO_EXP_OBRAS_CONDICAO+')':''}${at?'\n    '+at.nome+' '+at.texto:''}${fiscoPrejuizoLinha(l)?'\n    Resultado negativo '+euro2(fiscoPrejuizoLinha(l))+(sem?'':' · imposto estimado '+euro2(0))+': abate às rendas das outras linhas do mesmo titular, e o que sobrar é prejuízo a reportar':''}${l.quadro===Q.comReducao?'\n    '+Q.datas+campo(l)+': '+d42a(l)+'início '+(dPT(l.datas.inicio)||'—')+' · termo '+(dPT(l.datas.fim)||'—')+(l.datas.renovacaoInicio?' · última renovação '+dPT(l.datas.renovacaoInicio)+' a '+(dPT(l.datas.renovacaoFim)||'—'):'')+d42b(l):''}${fs.length?'\n    Falta: '+fs.join(', ')+'.':''}`;
  };
  /* os quadros 6A, 6B e 6C (D117, D119, D121): o campo do 4.1 de cada linha */
  const q6=fiscoExpQuadros6(r),q6Txt=q6.map(x=>'\nQUADRO '+x.quadro+' · '+x.nome.toUpperCase()+' — indica o campo do 4.1 de cada linha'+(x.campos.length?', nos campos '+x.campos[0]+' a '+x.campos[x.campos.length-1]:'')+(x.lei?' ('+x.lei+')':'')+'\n'
    +x.linhas.map(({linha:l,beneficio:b})=>`  Campo ${l.campo||'—'} — ${l.nome}${l.imovel?' — '+l.imovel:''}${r.variosTitulares?' · titular '+(l.titular||'A'):''}${b.efeito?': '+b.efeito:''}`).join('\n')+'\n').join('');
  const lt=sem?null:fiscoExpLiquidoTributavel(r);
  /* o Anexo J (D133, Q12) e a categoria B (D134): fora do Anexo F */
  const J=fiscoExpAnexoJ(r),B=fiscoExpCategoriaB(r),foraF=fiscoExpForaDoAnexoFTexto(r),semR=fiscoExpSemRendasTexto(r);
  /* o Anexo J é individual (N010): em conjunta, um bloco por titular, com o
     total dele, e nenhum total dos dois */
  const jE=e=>`  ${e.nome}${e.imovel?' — '+e.imovel:''}${e.quota<1?' · quota-parte '+fiscoExpQuota(r,e).quota:''} · titular ${e.titular||'A'}: código ${e.codigo||'—'} · país ${e.pais||'—'}${e.paisCodigo?' (código '+e.paisCodigo+')':''} · rendas ${euro2(e.rendas)} · gastos ${euro2(e.gastos)} · líquido ${euro2(e.liquido)} · imposto pago no estrangeiro ${euro2(e.impostoEstrangeiro)}${Number(e.retencoes)>0?' · retenções em Portugal '+euro2(e.retencoes):''}${e.faltas.length?'\n    Falta: '+e.faltas.join(', ')+'.':''}`;
  const jTxt=J?J.porTitular.map(g=>'\n'+g.titulo.toUpperCase()+' · QUADRO '+J.quadro+' (imóveis fora de Portugal: não vão ao Anexo F; a app não estima o imposto)\n'+g.entradas.map(jE).join('\n')
      +(g.entradas.length>1?'\n  Total do '+g.titulo+': rendas '+euro2(g.totais.rendas)+' · gastos '+euro2(g.totais.gastos)+' · líquido '+euro2(g.totais.liquido)+' · imposto pago no estrangeiro '+euro2(g.totais.impostoEstrangeiro):'')).join('\n')
    +'\n  '+fiscoExpAnexoJNota(r)+'\n':'';
  const bTxt=B?'\nFORA DO ANEXO F · CATEGORIA B (declaram-se no Anexo B ou C, com a tua atividade)\n'+B.entradas.map(e=>`  ${e.nome}${e.imovel?' — '+e.imovel:''}: ${euro2(e.rendas)} (${e.conta})${e.retencoes?' · retenções '+euro2(e.retencoes):''}${e.gastos>0?' · gastos do imóvel que saíram com estas rendas '+euro2(e.gastos)+' · rendas menos gastos '+euro2(e.liquido):''}`).join('\n')
    +'\n  '+FISCO_EXP_CATEGORIA_B_NOTA+(B.totais.gastos>0?' '+FISCO_EXP_CATEGORIA_B_GASTOS:'')+'\n':'';
  const QL=fiscoExpQuadrosDasLinhas(r),cabQ=QL.length>2?listaE(QL.concat(q5.length?[Q.sublocacao||'5']:[])):'4.1 E 4.2'+(q5.length?' E '+(Q.sublocacao||'5'):'');
  return `ANEXO F · QUADROS ${cabQ.toUpperCase()} — ${ano}${r.porInteiro?' · valores por inteiro':' · '+fiscoQuemDeclara(r)+' (quota-parte)'}
${fiscoRegrasTexto(r)}${letras?'\n'+letras:''}

Rendas ilíquidas ${euro2(r.totais.rendas)}${recT.texto?' ('+recT.texto+')':''} · retenções ${euro2(r.totais.retencoes)}${q5T.retencoes?' (com '+euro2(q5T.retencoes)+' do quadro '+(Q.sublocacao||'5')+')':''}
${gastos(r.totais.gastos)}${r.totais.obras24?'\n'+G.obras+' (24 meses antes do contrato): '+G.valor+' '+euro2(r.totais.obras24):''}
Rendimento líquido ${euro2(r.totais.liquido)}${q5.length?' (quadros '+listaE(QL)+')':''} · ${impTxt}${lt?'\nLíquido para o imposto estimado '+euro2(lt.valor)+' (o quadro leva os valores por inteiro: '+lt.porque+')':''}${q5.length?'\nSublocação (quadro '+(Q.sublocacao||'5')+'): renda recebida '+euro2(q5T.rendaRecebida)+' · renda paga ao senhorio '+euro2(q5T.rendaPaga)+' · diferença '+euro2(q5T.liquido)+(sem?'':' · imposto estimado '+euro2(q5T.imposto)+' (já no imposto estimado)'):''}${pre?'\n'+pre:''}${rep&&!sem?'\n'+rep:''}${preFora?'\n'+preFora:''}${isTxt}${aimi}${!sem&&(imp.regularizacao||Number(r.totais.retencoes)||imp.reporte||imp.abate)?'\nImposto: '+fiscoExpImpostoTexto(r):''}${foraF?'\n'+foraF:''}${semR?'\n'+semR:''}
${r.linhas.length?'\nPOR CONTRATO (preenche por esta ordem: cada entrada é uma linha do quadro, com o seu campo)\n'+r.linhas.map(linhaTxt).join('\n')+'\n':''}${c42Txt}${q6Txt}${q5Txt}${obPTxt}${jTxt}${bTxt}${r.fora.length?'\nFORA DA DECLARAÇÃO\n'+r.fora.map(f=>`  ${f.nome}${f.imovel?' — '+f.imovel:''}: ${euro2(f.rendas)}`).join('\n')+'\n':''}${r.semContrato.length?'\nRENDAS SEM CONTRATO (não estão em nenhuma linha do quadro: liga-as ao contrato — declaram-se na mesma)\n'+r.semContrato.map(s=>`  ${s.imovel}: ${euro2(s.rendas)} (${fiscoN(s.n,'movimento','movimentos')})`).join('\n')+'\n':''}${q8}${q10t}${r.avisos.length?'\nA TRATAR\n'+r.avisos.map(a=>'  · '+a.texto).join('\n')+'\n':''}
Resumo feito pela app com o que tem registado. As rendas ilíquidas são ${FISCO_EXP_RENDA_DO_RECIBO}. Os gastos de um imóvel com mais do que um contrato repartem-se pelas rendas; o rateio por VPT ou área fica para quem preenche.
${IRS_AVISO}
`;
}
/* O CSV do Anexo F do ano (ponto e vírgula, para o Excel português): o
   cabeçalho e uma linha por linha do quadro (4.1, 4.2, 4.3), pela ordem em
   que se preenche; as dos contratos não declarados («nao»); uma por imóvel
   com rendas sem contrato («sem contrato», D34); uma por contrato de
   sublocação («quadro 5», D52), por contrato com obras dos 24 meses por
   confirmar («obras por confirmar», D28), do AIMI («quadro 9») e por prédio
   dele («quadro 9 · prédio», D71), por contrato e titular do quadro 10
   («quadro 10», com a matriz, o titular e o NIF ou o país, e nas faltas o ano
   de início a confirmar e os anos que a regularização não conta), por
   contrato e titular de um imóvel fora de Portugal («anexo J», D133, sem
   imposto estimado; em conjunta, o anexo_destino diz o Anexo J de que
   titular — N010) e por contrato da categoria B («categoria B», D134); e as
   de rodapé: o 4.2C («quadro 4.2C», N039). Depois, cada uma após uma linha
   vazia e com o título na 1.ª coluna (KAN-126-5), as secções que não são do
   Anexo F: os avisos («a tratar (falta|aviso|nota)», havendo) e a estimativa
   e as notas («reporte», «imposto» com os Açores e os prejuízos de fora, as
   regras e o IRS_AVISO, no fim). Todas as linhas, vazias e títulos também,
   têm as colunas do cabeçalho: o texto pelo celulaCsv, os códigos pelo
   celulaCodigo (="040810") e os valores pelo celulaNumero (6147,00). As colunas
   que já existem não mudam de sítio; as novas vão sempre no fim: as da vaga 1
   (titular, 6D, 4.2A, 4.2B, campo, prejuízo, NIF e país), da vaga 2 (o 4.2A
   pelo período, as taxas de cada período, o quadro 10, a regularização, o
   reporte, o 9101 e o 9102), as da vaga 3 (a natureza, a caução, os reembolsos,
   as devoluções, a atualização de 2023, as quotas e os de fora, o quadro 5, as
   obras dos 24 meses, o VPT), as da vaga 4 (os quadros 6A, 6B e 6C, o líquido
   do imposto, os benefícios — D117, D119, D121; o 4.3 de um DHD — D120; o anexo
   fora do Anexo F, os códigos do rendimento e do país, o imposto pago lá e os
   gastos — D133; as freguesias repostas e o dia confirmado — D135) e as da 2.ª
   auditoria: o 4.2C nas linhas do 4.2 celebradas desde a data do n.º 23 (sim ou
   por confirmar, N039) e os anos que a regularização do n.º 20 não conta, com a
   diferença dos por confirmar (N031, N125). O isencao_6d só leva o código
   (N106); o nif_ou_pais é o NIF português ou o país (D59); o
   comunicacao_4_2a_resposta é 'sim', 'nao', 'a confirmar' ou '' por fazer; o
   4.2B sempre que o contrato o tem (D36); sem regras do ano, a taxa e o imposto
   vão vazios (D50). Em conjunta, um contrato dos dois cônjuges dá uma linha por
   titular.
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
    'renda_paga_senhorio','nif_senhorio','obras24_inicio_contrato','obras24_condicao','vpt',
    'quadro_6a','quadro_6b','quadro_6c','liquido_tributavel','beneficios_texto',
    'dhd_escritura','dhd_caucao','dhd_caucao_recebida','dhd_conservacao_extra','dhd_condominio','dhd_outros','dhd_cessacao_data','dhd_cessacao_motivo',
    'anexo_destino','anexo_j_codigo','pais_codigo','imposto_estrangeiro','gastos_total','freguesia_repostas','matriz_confirmada',
    'limite_n23_4_2c','regularizacao_anos_em_falta','regularizacao_anos_por_confirmar','regularizacao_por_confirmar']);
  /* da segunda auditoria ao IRS: o que a regularização do n.º 20 não conta — os
     anos sem rendas na app e os por confirmar, com a diferença que as regras
     de 2025 dariam, fora da soma (N031, N125) */
  const regCols=fx=>fx?{regularizacao_anos_em_falta:T(fx.emFalta.join(' ')),regularizacao_anos_por_confirmar:T(fx.semRegras.join(' ')),
    regularizacao_por_confirmar:fx.totalPorConfirmar>0?N(fx.totalPorConfirmar):'""'}:{};
  const c42=fiscoExpLimite42C(r);
  /* uma linha a partir das células por nome; as que faltam vão vazias */
  const linha=o=>cab.map(k=>o[k]==null?'""':o[k]).join(';');
  /* uma lista de valores numa célula: um só como código, vários como texto */
  const codigos=xs=>{xs=xs.filter(Boolean);return xs.length===1?C(xs[0]):T(xs.join(' / '))};
  const out=[cab.map(k=>T(FISCO_CSV_NOMES[k]||k)).join(';')];
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
      /* só o código do 6D, nunca o id da app: sem ele, vazio, e o porquê nas faltas (N106) */
      titular:T(l.titular||'A'),isencao_6d:C(l.isencao&&(l.isencao.quadro||'6D')==='6D'?(l.isencao.codigo||''):''),comunicacao_4_2a:T(com?com.data:(l.comunicado||'')),
      reducao_4_2b:T(b?'sim':''),renda_anterior_4_2b:b&&l.rendaAnterior?N(l.rendaAnterior):'""',
      campo:C(l.campo||''),prejuizo:N(fiscoPrejuizoLinha(l)),nif:codigos(ids.map(x=>x.nif)),pais:T(ids.map(x=>x.pais).filter(Boolean).join(' / ')),
      renda_4_2b:b?N(l.renda):'""',n_at_anterior_4_2b:C(b&&ant?ant.numero:''),
      comunicacao_4_2a_resposta:T(com?com.resposta:''),comunicacao_4_2a_prazo:T(com?com.prazo:''),comunicacao_4_2a_periodo:T(com?com.periodoInicio:''),
      taxa_desceu_4_2b:T(b?(l.bonus?'sim':'nao'):''),taxas_por_periodo:T(tx&&tx.partes.length>1?tx.texto:''),taxa_escrita_pct:escr!=null?P(escr):'""',
      taxa_campo_por_conhecer:T(pc?pc.campo+': '+pc.valor:''),natureza_assumida:T(l.naturezaAssumida?'sim':''),isencao_quadro:C(l.isencao?(l.isencao.quadro||'6D'):''),
      anos_anteriores_retencoes:T(l.anosAnteriores.some(a=>a.retencoes!=null)?l.anosAnteriores.map(a=>a.ano+':'+r2(Number(a.retencoes)||0).toFixed(2).replace('.',',')).join(' '):'')};
    cols.forEach(k=>{o[k]=N(l.gastos[k])});
    /* da ronda 2: os quadros 6A, 6B e 6C pelo campo do 4.1 e o líquido do
       imposto (D117, D119, D121), o 4.3 (D120) e a freguesia de uma união
       extinta, com a falta (D135) */
    const bs=fiscoExpBeneficios(r,l),dx=fiscoExpDhd(r,l),fx=fiscoExpFreguesia(l),q6=q=>{const b=bs.find(x=>x.quadro===q);return b?C(b.campo||'sim'):'""'};
    /* o código do 6D por conhecer vai às faltas, com o porquê (N106) */
    const f6d=l.isencao&&(l.isencao.quadro||'6D')==='6D'&&!l.isencao.codigo?[pc?pc.campo.charAt(0).toLowerCase()+pc.campo.slice(1)+': '+pc.valor:'código do quadro 6D por conhecer']:[];
    Object.assign(o,{quadro_6a:q6('6A'),quadro_6b:q6('6B'),quadro_6c:q6('6C'),liquido_tributavel:N(fiscoExpLiquidoImposto(l)),
      beneficios_texto:T(bs.map(b=>b.quadro+' · '+b.curto+(b.efeito?' · '+b.efeito:'')+(b.aviso?' — '+b.aviso:'')).join(' / ')),
      faltas:T(fiscoExpFaltas(l).concat(f6d).join('; ')),freguesia_repostas:T(fx?fx.repostasLista.join(' / '):''),matriz_confirmada:T(l.matrizConfirmada||''),
      /* o 4.2C (N039): só nas linhas do 4.2 celebradas desde a data do n.º 23 */
      limite_n23_4_2c:T(c42&&red&&l.celebracao&&l.celebracao>=c42.desde?(l.acimaDoLimite===false?'sim':'por confirmar'):'')});
    if(dx){
      const g=id=>N((dx.gastos.find(x=>x.id===id)||{}).valor||0);
      Object.assign(o,{dhd_escritura:T(dx.escritura),dhd_caucao:N(dx.caucao),dhd_caucao_recebida:N(dx.caucaoRecebida),
        dhd_conservacao_extra:g('conservacaoExtra'),dhd_condominio:g('condominio'),dhd_outros:g('outros'),
        dhd_cessacao_data:T(dx.cessacao?dx.cessacao.data:''),dhd_cessacao_motivo:C(dx.cessacao?dx.cessacao.motivo:''),
        regularizacao_estimada:dx.regularizacao&&!sem?N(dx.regularizacao.total):'""'},sem?{}:regCols(dx.regularizacaoFalta));
    }
    out.push(linha(o));
  });
  /* o quadro 7A do Anexo J (D133): uma linha por contrato e titular de um
     imóvel fora de Portugal, sem taxa nem imposto estimado (Q12) */
  /* o Anexo J é individual (N010): em conjunta, anexo_destino diz de que titular */
  const J=fiscoExpAnexoJ(r);
  if(J)J.porTitular.forEach(g=>g.entradas.forEach(e=>out.push(linha({ano:T(ano),declarado:T('anexo J'),quadro:C(J.quadro),contrato:T(e.nome),imovel:T(e.imovel),titular:T(e.titular||'A'),
    quota_pct:P((Number(e.quota)||0)*100),rendas_iliquidas:N(e.rendas),retencoes:N(e.retencoes),liquido:N(e.liquido),pais:T(e.pais),pais_codigo:C(e.paisCodigo),
    anexo_j_codigo:C(e.codigo),imposto_estrangeiro:N(e.impostoEstrangeiro),gastos_total:N(e.gastos),anexo_destino:T(g.titulo+' · quadro '+J.quadro),faltas:T(e.faltas.join('; '))}))));
  /* as rendas da categoria B (D134): fora do Anexo F, com o anexo para onde vão */
  const B=fiscoExpCategoriaB(r);
  if(B)B.entradas.forEach(e=>{const c=contract(e.contratoId);out.push(linha({ano:T(ano),declarado:T('categoria B'),contrato:T(e.nome),inicio:T(c?c.start||'':''),imovel:T(e.imovel),
    inquilinos:T(c?ctNames(c):''),quota_pct:P(e.quota*100),rendas_iliquidas:N(e.rendas),retencoes:N(e.retencoes),anexo_destino:T('Anexo B ou C'),
    /* a caução dentro das rendas e a parte dos gastos que saiu com elas (N141) */
    caucao:e.caucao>0?N(e.caucao):'""',gastos_total:e.gastos>0?N(e.gastos):'""',liquido:e.gastos>0?N(e.liquido):'""'}))});
  r.fora.forEach(f=>{const c=contract(f.contratoId),o={ano:T(ano),declarado:T('nao'),contrato:T(f.nome),inicio:T(c?c.start||'':''),imovel:T(f.imovel),
    inquilinos:T(c?ctNames(c):''),quota_pct:P(f.quota*100),rendas_iliquidas:N(f.rendas),retencoes:N(0),obras24:N(0)};
    cols.forEach(k=>{o[k]=N(0)});out.push(linha(o))});
  r.semContrato.forEach(s=>out.push(linha({ano:T(ano),declarado:T('sem contrato'),imovel:T(s.imovel),rendas_iliquidas:N(s.rendas),
    faltas:T(s.n===1?'1 renda sem contrato ligado: não está em nenhuma linha do quadro; liga-a ao contrato — declara-se na mesma'
      :s.n+' rendas sem contrato ligado: não estão em nenhuma linha do quadro; liga-as ao contrato — declaram-se na mesma')})));
  /* o quadro 5 (D52): uma linha por contrato de sublocação e titular, com a
     renda recebida em rendas_iliquidas, a paga ao senhorio e o NIF dele, e a
     diferença no líquido */
  const aa5=e=>(Array.isArray(e.anosAnteriores)?e.anosAnteriores:[]).filter(Boolean);
  fiscoExpQuadro5(r).forEach(e=>{
    const at=e.atualizacao;
    out.push(linha({ano:T(ano),declarado:T('quadro '+(Q.sublocacao||'5')),quadro:C(Q.sublocacao||'5'),contrato:T(e.nome),n_at:C(e.numero),inicio:T(e.inicio),imovel:T(e.imovel),
      natureza:C(e.natureza),natureza_texto:T(e.naturezaTexto),inquilinos:T(e.inquilinos.map(t=>t.nome).join(' / ')),nif_ou_pais:T(e.ids.map(x=>x.nif||x.pais||'').join(' / ')),
      nif:codigos(e.ids.map(x=>x.nif)),pais:T(e.ids.map(x=>x.pais).filter(Boolean).join(' / ')),quota_pct:P((Number(e.quota)||0)*100),titular:T(e.titular||'A'),
      rendas_iliquidas:N(e.rendaRecebida),retencoes:N(e.retencoes),renda_paga_senhorio:N(e.rendaPaga),nif_senhorio:C(e.nifSenhorio),liquido:N(e.liquido),
      taxa_pct:sem?'""':P(e.taxa),imposto_estimado:sem?'""':N(Math.max(0,Number(e.imposto)||0)),faltas:T(e.faltas.join('; ')),
      atualizacao_1_02:T(at?at.resposta||'por responder':''),
      /* as rendas de anos anteriores do quadro 5, que o quadro 8 também leva (N110) */
      anos_anteriores:T(aa5(e).map(a=>a.ano+':'+r2(Number(a.valor)||0).toFixed(2).replace('.',',')).join(' ')),
      anos_anteriores_retencoes:T(aa5(e).some(a=>a.retencoes!=null)?aa5(e).map(a=>a.ano+':'+r2(Number(a.retencoes)||0).toFixed(2).replace('.',',')).join(' '):'')}));
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
  /* o quadro 10: uma linha por contrato e titular, com a matriz, o titular e
     o NIF do inquilino (ou o país) nas colunas de sempre; o ano de início do
     benefício a confirmar fica na coluna dele e diz-se nas faltas */
  fiscoExpQuadro10(r).forEach(x=>{const fx=fiscoExpFreguesia(x);out.push(linha(Object.assign({ano:T(ano),declarado:T('quadro '+(Q.cessados||'10')),contrato:T(x.nome),n_at:C(x.numero),imovel:T(x.imovel),
    freguesia:C(x.freguesiaCodigo),tipo_predio:T(x.tipoPredio),artigo:T(x.artigo),fracao:T(x.fracao),titular:T(x.titular),
    inquilinos:T(x.inquilinos.map(t=>t.nome).join(' / ')),nif_ou_pais:T(x.ids.map(t=>t.nif||t.pais||'').join(' / ')),nif:codigos(x.ids.map(t=>t.nif)),pais:T(x.ids.map(t=>t.pais).filter(Boolean).join(' / ')),
    freguesia_repostas:T(fx?fx.repostasLista.join(' / '):''),matriz_confirmada:T(x.matrizConfirmada||''),
    quadro:C(Q.cessados||'10'),faltas:T(x.faltas.concat(x.regularizacaoFalta&&!sem?['regularização: '+x.regularizacaoFalta.texto]:[]).join('; ')),
    cessacao_regime:C(x.regime),cessacao_ano_beneficio:T(x.anoInicioBeneficio),cessacao_data:T(x.data),
    cessacao_motivo:C(x.motivo),regularizacao_estimada:x.regularizacao&&!sem?N(x.regularizacao.total):'""'},sem?{}:regCols(x.regularizacaoFalta))))});
  /* o 4.2C (N039): a resposta, numa linha de rodapé, como as do quadro 9 e 10 */
  if(c42)out.push(linha({ano:T(ano),declarado:T('quadro '+c42.quadro),quadro:C(c42.quadro),
    contrato:T('Todos os contratos do '+(Q.comReducao||'4.2')+' cumprem o n.º 23 do art. 72.º do CIRS? '+c42.texto.charAt(0).toUpperCase()+c42.texto.slice(1)+'. '+fiscoExpLimite42CNota(r,c42)),
    limite_n23_4_2c:T(c42.resposta||'por confirmar'),faltas:T(c42.porConfirmar.length?'confirmar a renda dentro do limite na ficha do contrato: '+listaE(c42.porConfirmar):'')}));
  /* o que não é uma linha do Anexo F vai em secções à parte, cada uma depois
     de uma linha vazia e com o seu título na primeira coluna (KAN-126-5): os
     avisos de «A tratar», e no fim a estimativa e as notas */
  const vazia=()=>linha({}),seccao=t=>linha({ano:T(t)});
  if((r.avisos||[]).length){
    out.push(vazia(),seccao(FISCO_CSV_SECCAO_AVISOS));
    r.avisos.forEach(a=>out.push(linha({ano:T(ano),declarado:T('a tratar ('+fiscoNivelNome(a)+')'),contrato:T(a.texto)})));
  }
  out.push(vazia(),seccao(sem?FISCO_CSV_SECCAO_SO_NOTAS:FISCO_CSV_SECCAO_NOTAS));
  const rep=sem?null:fiscoExpReporte(r);
  if(rep)out.push(linha({ano:T(ano),declarado:T('reporte'),contrato:T(fiscoExpReporteTexto(r)),reporte_abatido:N(rep.usado),imposto_depois_reporte:N(rep.depois)}));
  /* o caminho do imposto, com a ressalva dos Açores (N120) e, sem abate, os
     prejuízos de anos que não estão na app (N124) */
  if(!sem){const I=fiscoExpImpostos(r),lt=fiscoExpLiquidoTributavel(r),pf=fiscoExpPrejuizosForaTexto(r);out.push(linha({ano:T(ano),declarado:T('imposto'),
    contrato:T(fiscoExpImpostoTexto(r)+'. Estimativa sem englobamento, com as '+FISCO_EXP_ACORES+'.'+(pf?' '+pf:'')),
    liquido:N(r.totais.liquido),liquido_tributavel:N(lt?lt.valor:r.totais.liquido),
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
