/* ================= FISCO · PDF =================
   O PDF do Anexo F do ano e de quem declara, como a Declaração o mostra: os quadros
   4.1 e 4.2 contrato a contrato, cada um em bloco campo → valor pela ordem do
   impresso, com o total de cada quadro, o 4.2A, o 4.2B e o 4.2C, os isentos
   do 6D, as rendas de anos anteriores (quadro 8), o AIMI (quadro 9), as rendas
   sem contrato e as dos contratos não declarados, com o valor, as faltas de
   cada linha e o que há a tratar antes de entregar. Cada linha leva o campo do
   quadro (4001…, 4501…), pela ordem em que se preenche, e os subquadros (4.2A,
   4.2B, 6D, 8, 9) dizem o campo a que se ligam. Os números são os do
   resumoFiscal — os mesmos da página, do texto e do CSV — e nada se inventa:
   o que não está nos dados diz «—», ou «falta» quando a AT o pede.

   O escritor é o do contrato (contrato-pdf.js:PDF, com as cores PDF_COR do
   tema claro e as letras da app, contrato-pdf.js:pdfLetras), que vive no
   serviço Contratos, e o aspeto é o dele: o título com o traço cobalto, cada
   quadro com o código numa pílula, cada contrato e cada total num cartão
   arredondado campo → valor, e o rodapé em todas as páginas. A Declaração
   requer os Contratos (servicos.js, D57): com ela ligada, o escritor está
   cá; sem ele (o ficheiro não carregou), o fiscoPdf diz que se recarregue. O
   PDF escreve latin-1 (WinAnsi): o espaço fino dos milhares e o sinal de
   menos da app passam a um espaço e a um hífen (fiscoPdfTxt), em vez de
   saírem como «?». */

/* Descarrega o PDF do Anexo F do ano e de quem declara, como a página: o
   ano do fiscoAnoAtual e o resumoFiscal de quem tem a sessão (com o titular
   B em conjunta), o mesmo do fiscoTexto e do CSV; o nome do ficheiro leva o
   meu nome, e nenhum quando os valores vão por inteiro. No Android entrega o ficheiro
   ao seletor nativo, como o contrato em PDF. Sem o escritor (o contrato-pdf.js
   não carregou: a Declaração requer os Contratos, por isso não é o serviço
   desligado) não descarrega e pede que se recarregue; sem nada a declarar no
   ano (nem linhas nos quadros, nem sublocação no quadro 5, nem rendas sem
   contrato, nem contratos fora) diz que não há PDF; um ano só com o quadro 5
   dá o PDF com ele (D52). Rendas sem contrato sozinhas dão o PDF com elas (D34):
   são rendimento, e recusá-lo escondia-as. Espera pelas letras da app
   (pdfLetras), que sem rede deixam o PDF na Helvetica.
   Devolve: Promise de nada — descarrega o PDF, ou avisa porque não o fez. */
async function fiscoPdf(){
  if(typeof PDF!=='function'||typeof PDF_COR==='undefined'){
    toast('Não foi possível preparar o PDF. Recarrega a página e tenta outra vez.');
    return;
  }
  const ano=fiscoAnoAtual(),r=resumoFiscal(ano);
  if(!r.linhas.length&&!(r.semContrato||[]).length&&!(r.fora||[]).length&&!fiscoExpQuadro5(r).length){toast('Sem contratos nos quadros 4.1, 4.2 e 5 em '+ano+': não há PDF para exportar.');return}
  const nomeTit=r.porInteiro?'':((owner(r.titularId)||{}).name||''),hoje=today();
  if(typeof pdfLetras==='function')await pdfLetras();
  const bytes=fiscoPdfDocumento(r,nomeTit,hoje),name=fiscoPdfNome(ano,nomeTit,hoje);
  if(window.Android&&window.Android.saveAs)window.Android.saveAs(name,'application/pdf',b64Latin1(bytes));
  else downloadBytes(name,'application/pdf',bytes);
  toast('PDF exportado.');
}
/* O nome do ficheiro: «anexo-f-AAAA-<titular>-<hoje>.pdf», o titular só
   quando se sabe quem declara, tudo em minúsculas sem acentos, só com letras,
   algarismos e hífenes.
   Recebe: ano — o ano dos rendimentos; titular — o nome do titular ('' por
   inteiro); hoje — a data 'AAAA-MM-DD'.
   Devolve: o nome (texto). */
function fiscoPdfNome(ano,titular,hoje){
  const limpo=x=>deacc(x).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
  return ['anexo-f',limpo(ano),limpo(titular),limpo(hoje)].filter(Boolean).join('-')+'.pdf';
}
/* Um texto pronto para o escritor do PDF, que só escreve latin-1 e os
   símbolos da tabela WIN do contrato-pdf.js (€, —, –, aspas curvas, •, …, ›):
   os espaços especiais (o fino dos milhares, o não separável) passam a
   espaço, o sinal de menos a hífen, a seta a «›», e o resto que não se
   escreve fica com a letra base, sem o acento — senão o PDF punha «?».
   Recebe: s — o texto (nulo vale vazio).
   Devolve: o texto (string). */
function fiscoPdfTxt(s){
  return String(s==null?'':s).replace(/[\s    ]+/g,' ').replace(/−/g,'-').replace(/→/g,'›')
    .replace(/[^ -ÿ€‚„…†‡‘’“”•–—˜™›]/g,ch=>{const b=ch.normalize('NFD').replace(/[̀-ͯ]/g,'');return b.length===1&&b.charCodeAt(0)<256?b:'?'});
}
/* Um valor em euros como a página o escreve (euro2, duas casas), pronto para
   o PDF.
   Recebe: v — o valor em euros.
   Devolve: o texto, ex.: «12 500,00 €». */
function fiscoPdfEuro(v){return fiscoPdfTxt(euro2(v))}
/* Um cartão campo → valor (contrato-pdf.js:PDF.cartao): o título a forte
   por cima, se o há, e cada campo à esquerda no secundário com o valor à
   direita na tinta, cada um a partir na sua coluna. O cartão não se parte
   entre páginas.
   Recebe: pdf — o escritor (PDF()); titulo — o título ('' sem ele); campos —
   as linhas [campo, valor, {bold, cor, grupo}] (valor vazio escreve «—»;
   com grupo, o campo é o título de um grupo de colunas do impresso, numa
   linha só, a forte e a cobalto, sem valor — D90); o
   (opcional) — {fundo (o suave), corTitulo (a tinta), after, medir (true:
   só diz a altura, sem desenhar)}.
   Devolve: nada — escreve o cartão e desce; com medir, a altura (pontos). */
function fiscoPdfCartao(pdf,titulo,campos,o){
  o=o||{};
  const itens=campos.map(([c,v,x])=>x&&x.grupo?{texto:fiscoPdfTxt(c),forte:true,size:9,cor:PDF_COR.cobaltoTexto}
    :{campo:fiscoPdfTxt(c),valor:fiscoPdfTxt(v==null||v===''?'—':v),forte:!!(x&&x.bold),cor:x&&x.cor,size:9.5});
  if(titulo)itens.unshift({texto:fiscoPdfTxt(titulo),forte:true,size:10.5,cor:o.corTitulo});
  const opc={itens:itens,colCampo:160,fundo:o.fundo,after:o.after==null?8:o.after};
  if(o.medir)return pdf.alturaCartao(opc);
  pdf.cartao(opc);
}
/* O título de uma secção (um quadro, os totais, o que há a tratar), na
   letra dos títulos, com a linha de baixo no secundário; com o código de um
   quadro, ele vai numa pílula cobalto à esquerda (PDF.clausula), e a linha
   de baixo alinha pelo título. Não fica sozinho no fim de uma página.
   Recebe: pdf — o escritor; titulo — o título; sub (opcional) — a linha de
   baixo; codigo (opcional) — o código do quadro ('4.1', '6D', '9'); junto
   (opcional) — a altura do que tem de ficar com o título na mesma página
   (o primeiro cartão do quadro).
   Devolve: nada — escreve o título e desce. */
function fiscoPdfTitulo(pdf,titulo,sub,codigo,junto){
  pdf.need(Math.max(110,56+(junto||0)));pdf.gap(12);
  if(codigo){
    const c=fiscoPdfTxt(codigo),x=Math.max(pdf.RECUO,pdf.medir(c,8.5,'forte')+20);
    pdf.clausula(c,fiscoPdfTxt(titulo),{size:12,after:sub?3:8});
    if(sub)pdf.text(fiscoPdfTxt(sub),{size:9,indent:x,cor:PDF_COR.secundario,after:8});
    return;
  }
  pdf.text(fiscoPdfTxt(titulo),{size:13,titulo:true,lead:13*1.3,after:sub?2:8});
  if(sub)pdf.text(fiscoPdfTxt(sub),{size:9,cor:PDF_COR.secundario,after:8});
}
/* Uma nota curta no secundário (o que é estimativa, de onde vem uma regra).
   Recebe: pdf — o escritor; s — o texto.
   Devolve: nada — escreve a nota e desce. */
function fiscoPdfNota(pdf,s){pdf.text(fiscoPdfTxt(s),{size:8.5,cor:PDF_COR.secundario,after:6})}
/* O bloco de um contrato num quadro, pela ordem do impresso: o campo da
   linha (4001…, 4501…), o n.º do contrato na AT, o início (só no 4.1: no 4.2
   a data de início é do 4.2A, D102), a taxa da lei do ano e porquê — a de
   cada período quando muda no ano (fiscoExpTaxa, D41, D15), nenhuma sem
   regras do ano (D50) —, a escrita no contrato quando é outra, como nota
   (D17), o campo do modelo novo por conhecer (D49), o imóvel (freguesia,
   tipo, artigo, fração), os inquilinos com o NIF português ou o país
   (fiscoIdInquilino), o titular, a natureza («07 (assumida)» sem a
   finalidade, D16), as rendas ilíquidas, as
   retenções e cada coluna de gastos; as três colunas das obras dos 24 meses
   quando as há; no 4.2 o 4.2A (a comunicação pelo período, Sim só até ao
   prazo dele: fiscoExpComunicacao, D01, D35) e o 4.2B sempre que o contrato
   o tem (fiscoExpElegivel24, D36), cada um com
   o campo do 4.2 a que se liga; e por fim a quota-parte, a estimativa da app
   (que não vai ao quadro: o imposto nunca negativo, e o resultado negativo,
   que abate às outras linhas do titular, quando as rendas não chegam) e o que falta.
   Da vaga 3: as linhas 05 e 02 com o texto da natureza (D21, D51); a caução,
   os reembolsos do inquilino e as rendas devolvidas que as rendas levam
   (D03); os gastos e as obras dos 24 meses com os grupos e os nomes do
   impresso, as datas das obras em MM/AAAA e a condição delas (D90, D28); a
   atualização de 2023 (D76); o NIF português e o país à parte (D59); a quota
   com as casas que tem, a de cada parte do ano e os de fora (D93, D08); e o
   porquê da taxa do imóvel reabilitado e do DHD.
   Recebe: pdf — o escritor; r — o resumo (resumoFiscal); l — a linha; red —
   true no quadro 4.2; medir (opcional) — true só diz a altura do cartão.
   Devolve: nada — escreve o cartão do contrato e desce; com medir, a altura. */
function fiscoPdfLinha(pdf,r,l,red,medir){
  const v=r.versao,nat=v.naturezas||{},campos=[],F=(c,x,o)=>campos.push([c,x,o]),sem=fiscoExpSemRegras(r),bon=(v.taxas||{}).bonusRendaMenor||{};
  const MOTIVO={nh:'não habitacional',duracao:'redução pela duração',moderada:'renda moderada',base:'taxa base',semRenovacao:'depois do termo, sem renovação registada',
    reabilitacao:'imóvel reabilitado',dhd:'direito real de habitação duradoura'};
  const G=fiscoExpGrupos(r),nt=fiscoExpNaturezaTexto(r,l),rec=fiscoExpReceitas(l),at=fiscoExpAtualizacao(r,l),qx=fiscoExpQuota(r,l);
  const AVISO={bold:true,cor:PDF_COR.cobaltoTexto};
  if(l.campo)F('Campo',l.campo,{bold:true});
  F('N.º do contrato na AT',l.atNumero||(l.estado==='declarado'?'falta':'—'));
  if(!red)F('Início do contrato',dPT(l.inicio)||'—');
  /* a taxa da lei do ano, a de cada período quando muda no ano (D41, D15);
     a escrita no contrato é só uma nota (D17); sem regras do ano, nenhuma (D50) */
  const tx=l.isencao?null:fiscoExpTaxa(r,l),escr=sem||l.isencao||typeof fiscoTaxaEscritaOutra!=='function'?null:fiscoTaxaEscritaOutra(l),pc=fiscoExpPorConhecer(r,l);
  F('Taxa',l.isencao?'isento · quadro '+(l.isencao.quadro||'6D')+(l.isencao.codigo?' · código '+l.isencao.codigo:'')
    :sem||tx.partes.length>1||(tx.partes[0]&&tx.partes[0].semRenovacao)?tx.texto:tx.texto+' · '+(MOTIVO[l.motivoTaxa]||'—'),sem?AVISO:undefined);
  if(escr!=null)F('Taxa escrita no contrato',dec(escr)+' % · não é a da lei de '+r.ano+': na declaração conta a de '+dec(l.taxa)+' %',{cor:PDF_COR.secundario});
  if(pc)F(pc.campo,pc.valor,AVISO);
  F('Imóvel',l.imovel||'—');
  F('Freguesia (código)',l.freguesiaCodigo||'falta');
  F('Tipo de prédio',l.tipoPredio||'falta');
  F('Artigo matricial',l.artigo||'falta');
  F('Fração',l.fracao||'—');
  fiscoPdfInquilinos(F,l.inquilinos,'Inquilino');
  F('Titular',l.titular==='A/B'?'A/B (o imóvel é dos dois: uma linha por titular, cada uma com a sua quota-parte)':(l.titular||'A'));
  /* sem finalidade, a 07 é assumida e di-lo (D16); as linhas 05 e 02 dizem o
     que são, pelo texto da versão (D21, D51) */
  const nTxt=nt?' · '+nt:l.natureza===nat.habitacional?' · arrendamento habitacional':l.natureza===nat.naoHabitacional?' · arrendamento não habitacional':'';
  if(l.naturezaAssumida&&l.natureza)F('Natureza',l.natureza+' (assumida)'+nTxt+' · falta a finalidade do contrato',AVISO);
  else F('Natureza',l.natureza+nTxt);
  F('Rendas ilíquidas',fiscoPdfEuro(l.rendas));
  /* o que as rendas levam (D03, D20, D53): a caução é renda do ano em que se recebe */
  if(rec.caucao)F('Inclui a caução',fiscoPdfEuro(rec.caucao)+' · renda do ano em que a recebeste',{cor:PDF_COR.secundario});
  if(rec.reembolsos)F('Inclui reembolsos do inquilino',fiscoPdfEuro(rec.reembolsos),{cor:PDF_COR.secundario});
  if(rec.devolucoes)F('Já sem as rendas devolvidas',fiscoPdfEuro(rec.devolucoes),{cor:PDF_COR.secundario});
  F('Retenções na fonte',fiscoPdfEuro(l.retencoes));
  /* os gastos com os nomes e os grupos do impresso (D90) */
  F(G.apos,null,{grupo:true});
  r.colunas.forEach(k=>F(fiscoExpColNome(r,k),fiscoPdfEuro(l.gastos[k])));
  if(l.obras24.valor){
    /* as obras dos 24 meses: o ano e o mês, e a condição do art. 41.º n.º 7 (D28) */
    F(G.obras,null,{grupo:true});
    F(G.inicioContrato,fiscoExpMesAno(l.inicio)||'—');
    F(G.inicioGastos,fiscoExpMesAno(l.obras24.inicioGastos)||'—');
    F(G.valor,fiscoPdfEuro(l.obras24.valor));
    F('Condição',FISCO_EXP_OBRAS_CONDICAO.charAt(0).toUpperCase()+FISCO_EXP_OBRAS_CONDICAO.slice(1)+'; respondeste que sim no contrato',{cor:PDF_COR.secundario});
  }
  /* a atualização de 2023 nos contratos em vigor antes de 2022 (D76) */
  if(at)F(at.nome,at.texto,at.resposta?undefined:AVISO);
  if(red){
    const D=v.quadros.datas,com=fiscoExpComunicacao(r,l);
    if(l.campo)F(D+' · campo do quadro 4.2',l.campo);
    /* a resposta pelo período em que as rendas assentam (D01): comunicada até
       ao prazo dele é Sim; depois, ou por fazer com o prazo passado, Não (D35) */
    F(D+' · comunicação',!com?'—':com.resposta==='sim'?'Sim (comunicada a '+dPT(com.data)+')'
      :com.foraDePrazo?'Não (comunicada fora do prazo, a '+dPT(com.data)+(com.prazo?'; o prazo era '+dPT(com.prazo):'')+')'
      :com.resposta==='nao'?'Não (por comunicar; o prazo acabou a '+dPT(com.prazo)+')'
      :'Por comunicar'+(com.prazo?' (até '+dPT(com.prazo)+'; sem ela, é Não)':''),com&&com.resposta!=='sim'?AVISO:undefined);
    F(D+' · início',dPT(l.datas.inicio)||'—');
    F(D+' · termo',dPT(l.datas.fim)||'—');
    F(D+' · última renovação',l.datas.renovacaoInicio?dPT(l.datas.renovacaoInicio)+' a '+(dPT(l.datas.renovacaoFim)||'—'):'—');
    /* o 4.2B sempre que o contrato o tem, mesmo que a estimativa não desça a
       taxa (D36, D37); a renda é a de hoje, a que a app comparou (Q2) */
    if(fiscoExpElegivel24(r,l)){
      const a=l.contratoAnterior;
      if(l.campo)F('4.2B · campo do quadro 4.2',l.campo);
      F('4.2B · renda deste contrato',fiscoPdfEuro(l.renda)+' por mês · a de hoje no contrato');
      F('4.2B · contrato anterior',a&&a.numero?'n.º '+a.numero:a?a.nome+' · falta o n.º na AT':'falta');
      F('4.2B · renda anterior',l.rendaAnterior?fiscoPdfEuro(l.rendaAnterior)+' por mês':'falta');
      if(!l.bonus)F('4.2B · taxa','a estimativa não desce abaixo de '+dec(bon.minimo||5)+' % (leitura prudente); a AT pode aplicar os '+dec(bon.pontos||5)+' pontos',{cor:PDF_COR.secundario});
    }
  }
  /* a quota usada, com as casas que tem, a de cada parte do ano e os de fora (D93, D08) */
  if(l.quota<1)F('Quota-parte',qx.quota+(qx.periodos?' · '+qx.periodos:''));
  if(qx.foraTexto)F('Comproprietários fora da app',qx.foraTexto+' · declaram a parte deles',{cor:PDF_COR.secundario});
  const pre=fiscoPrejuizoLinha(l);
  F('Estimativa da app',sem?'líquido '+fiscoPdfEuro(l.liquido)+' · sem taxa nem imposto: a app não tem as regras de '+r.ano
    :'líquido '+fiscoPdfEuro(l.liquido)+' · imposto estimado '+fiscoPdfEuro(fiscoImpostoLinha(l))+' (não vai ao quadro)',{cor:PDF_COR.secundario});
  if(pre)F('Resultado negativo',fiscoPdfEuro(pre)+' · abate às rendas das outras linhas do mesmo titular, e o que sobrar é prejuízo a reportar',{cor:PDF_COR.secundario});
  if(l.faltas.length){const f=l.faltas.join(', ');F('Falta',f.charAt(0).toUpperCase()+f.slice(1)+'.',{bold:true,cor:PDF_COR.cobaltoTexto})}
  /* em conjunta, as duas linhas de um contrato dos dois cônjuges distinguem-se pela letra no título */
  return fiscoPdfCartao(pdf,l.nome+(l.imovel?' · '+l.imovel:'')+(nt?' · natureza '+l.natureza:'')+(r.variosTitulares?' · titular '+l.titular:''),campos,{medir:!!medir});
}
/* Os inquilinos (ou sublocatários) de uma linha, um a um, com o NIF
   português e, sem ele, o país com o código da tabela X (D59): «NIF
   português: —» e «País: Espanha · …», em vez de um número estrangeiro na
   coluna do NIF.
   Recebe: F — o que junta um campo ao cartão (campo, valor, opções); ts — os
   inquilinos [{nome, nif, pais}]; rotulo — 'Inquilino' ou 'Sublocatário'.
   Devolve: nada — junta os campos. */
function fiscoPdfInquilinos(F,ts,rotulo){
  if(!ts.length){F(rotulo,'falta');return}
  ts.forEach((t,i)=>{const id=fiscoIdInquilino(t),n=ts.length>1?' '+(i+1):'';
    if(id.valido){F(rotulo+n,t.nome+' · NIF '+fmtNIF(id.nif));return}
    F(rotulo+n,t.nome);
    if(id.pais){F('NIF português','—');F('País',fiscoExpPais(t))}
    else F('NIF português',id.texto,{bold:true,cor:PDF_COR.cobaltoTexto});
  });
}
/* Um quadro de rendas (o 4.1 ou o 4.2): o título, um bloco por contrato
   (fiscoPdfLinha) e o total do quadro, com as mesmas somas do cartão da
   página. O 4.2 leva ainda a nota da comunicação de fevereiro e o 4.2C, com
   a mesma conta do fiscoReducoesHtml: os contratos celebrados desde a data do
   n.º 23 e a resposta, ou quais faltam confirmar. Sem linhas, não escreve.
   Recebe: pdf — o escritor; r — o resumo (resumoFiscal); q — o quadro ('4.1', '4.2').
   Devolve: nada — escreve o quadro e desce. */
function fiscoPdfQuadro(pdf,r,q){
  const ls=r.linhas.filter(l=>l.quadro===q);if(!ls.length)return;
  const v=r.versao,red=q===v.quadros.comReducao,s=f=>r2(sum(ls.map(f))),tot=[],F=(c,x)=>tot.push([c,x,{bold:true}]);
  const parte=fiscoExpParte(r,ls),rec=fiscoExpReceitas({caucao:s(l=>Number(l.caucao)||0),reembolsos:s(l=>Number(l.reembolsos)||0),devolucoes:s(l=>Number(l.devolucoes)||0)});
  fiscoPdfTitulo(pdf,'Quadro '+q+' · '+(red?'habitação permanente com redução pela duração':'contratos sem redução pela duração'),
    fiscoN(fiscoNContratos(ls),'contrato','contratos')+' com rendas em '+r.ano+(parte?' · '+parte:'')+(ls.some(l=>l.campo)?' · preenche por esta ordem, um campo por linha':''),q,
    fiscoPdfLinha(pdf,r,ls[0],red,true));
  ls.forEach(l=>fiscoPdfLinha(pdf,r,l,red));
  const ob=s(l=>l.obras24.valor);
  /* o total num cartão cobalto suave, que não se parte entre páginas */
  const G=fiscoExpGrupos(r);
  F('Rendas ilíquidas',fiscoPdfEuro(s(l=>l.rendas))+(rec.texto?' · '+rec.texto:''));
  F('Retenções na fonte',fiscoPdfEuro(s(l=>l.retencoes)));
  r.colunas.forEach(k=>F(fiscoExpColNome(r,k),fiscoPdfEuro(s(l=>l.gastos[k]))));
  if(ob)F(G.obras,fiscoPdfEuro(ob));
  fiscoPdfCartao(pdf,'Total do quadro '+q,tot,{fundo:PDF_COR.cobaltoSuave,corTitulo:PDF_COR.cobaltoTexto});
  /* o que são as linhas 05 e 02 do quadro (D21, D51), com os textos da versão */
  const outras=ls.filter(l=>l.papel&&l.papel!=='renda').map(l=>l.natureza).filter((x,i,xs)=>x&&xs.indexOf(x)===i);
  if(outras.length)fiscoPdfNota(pdf,'Cada contrato com '+outras.map(n=>'natureza '+n+' ('+fiscoExpNaturezaTexto(r,ls.find(l=>l.natureza===n&&l.papel!=='renda'))+')').join(' ou ')
    +' tem uma linha à parte da das rendas, com o mesmo n.º do contrato, à taxa base.');
  if(!red)return;
  /* a comunicação é uma por período, não uma por ano (D01) */
  pdf.gap(4);fiscoPdfNota(pdf,'No '+v.quadros.datas+', «Sim» na comunicação quer dizer que a duração do contrato, ou da renovação em que estas rendas assentam, foi comunicada no Portal até '+(v.prazos&&v.prazos.comunicacaoDuracao?irsDiaMes(v.prazos.comunicacaoDuracao):'15 de fevereiro')+' do ano seguinte ao início dela (Portaria 110/2019). Comunica-se uma vez por período, e não todos os anos; feita depois do prazo, a resposta é «Não».');
  const L23=(v.taxas&&v.taxas.limiteRendaAlta)||{desde:'2024-01-01'};
  const n23=ls.filter(l=>l.celebracao&&l.celebracao>=L23.desde);
  if(!n23.length)return;
  const por=n23.filter(l=>l.acimaDoLimite!==false);
  pdf.gap(4);
  fiscoPdfCartao(pdf,'Quadro 4.2C · limite das rendas (n.º 23)',[['Celebrados desde '+dPT(L23.desde),listaE(n23.map(l=>l.nome))],
    ['Resposta',por.length?'falta confirmar na ficha do contrato: '+listaE(por.map(l=>l.nome)):'Sim (01)',{bold:true}]],{fundo:PDF_COR.cobaltoSuave,corTitulo:PDF_COR.cobaltoTexto});
  /* os limites são os que a versão do ano escreve, com as datas (D78) */
  const lim=fiscoExpLimites23(r);
  fiscoPdfNota(pdf,'O 4.2C pergunta se nenhum destes contratos passa '+dec(L23.percentagem||150)+' % dos limites de renda'+(lim?' ('+lim+')':' por tipologia e concelho')+'. Um que passe não tem redução e vai ao 4.1.');
}
/* Um quadro das isenções (6D, 6F ou 6H, D18): um cartão por contrato isento
   com o campo do 4.1 onde ficou, o n.º do contrato, o programa ou a isenção
   (com a lei, quando não tem código) e o código, só no quadro que o tem; o
   líquido isento do quadro; e a nota do que se indica nele.
   Recebe: pdf — o escritor; r — o resumo; q — o quadro ('6D', '6F', '6H');
   ls — as linhas isentas desse quadro; varios — true quando o ano tem mais do
   que um quadro de isenções (o líquido isento passa a ser o das linhas dele).
   Devolve: nada — escreve o quadro e desce. */
function fiscoPdfIsentos(pdf,r,q,ls,varios){
  const v=r.versao,E=fiscoPdfEuro,comCodigo=ls.some(l=>{const is=(v.isencoes||[]).find(x=>x&&x.id===l.isencao.id);return !(is&&is.semCodigo)});
  fiscoPdfTitulo(pdf,'Quadro '+q+' · rendimentos isentos',fiscoN(fiscoNContratos(ls),'contrato isento','contratos isentos')+' · ficam também na linha do 4.1',q);
  ls.forEach(l=>{
    const is=(v.isencoes||[]).find(x=>x&&x.id===l.isencao.id),pc=fiscoExpPorConhecer(r,l),campos=[];
    campos.push(['Campo do quadro 4.1',l.campo||'—']);
    campos.push(['N.º do contrato na AT',l.atNumero||'falta']);
    campos.push([comCodigo?'Programa':'Isenção',(l.isencao.nome||l.isencao.curto||'—')+(!comCodigo&&is&&is.lei?' · '+is.lei:'')]);
    if(!(is&&is.semCodigo))campos.push(['Código',l.isencao.codigo||(pc?pc.valor:'por conhecer'),pc?{bold:true,cor:PDF_COR.cobaltoTexto}:undefined]);
    campos.push(['Rendas ilíquidas',E(l.rendas)]);
    fiscoPdfCartao(pdf,l.nome+(l.imovel?' · '+l.imovel:'')+(r.variosTitulares?' · titular '+l.titular:''),campos);
  });
  fiscoPdfCartao(pdf,'',[['Rendimento líquido isento',E(varios?r2(sum(ls.map(l=>Number(l.liquido)||0))):r.totais.isentos.liquido),{bold:true}]],{fundo:PDF_COR.cobaltoSuave});
  fiscoPdfNota(pdf,comCodigo?'No '+q+' indicas o campo do 4.1 onde ficaram, o n.º do contrato e o código do programa. Não pagam imposto e ficam fora do imposto estimado.'
    :'No '+q+' indicas só o campo do 4.1 onde ficaram (este quadro não tem código). Não pagam imposto e ficam fora do imposto estimado.');
}
/* O quadro 10 (D09): os contratos de habitação permanente com redução pela
   duração, ou isentos dos programas, que acabaram no ano, um cartão cada,
   com o regime fiscal, o n.º do contrato, o ano de início do benefício, a
   data e o motivo da cessação (os textos das tabelas da versão,
   fiscoExpQuadro10); com o motivo 01, a regularização do n.º 20 do art.
   72.º, com a diferença estimada sem juros (D10); e a nota do que o quadro
   pede. Sem contratos que acabaram, não escreve.
   Recebe: pdf — o escritor; r — o resumo (resumoFiscal).
   Devolve: nada — escreve o quadro e desce. */
function fiscoPdfQuadro10(pdf,r){
  const xs=fiscoExpQuadro10(r);if(!xs.length)return;
  const Q=r.versao.quadros||{},q=Q.cessados||'10',sem=fiscoExpSemRegras(r),FALTA={bold:true,cor:PDF_COR.cobaltoTexto};
  fiscoPdfTitulo(pdf,'Quadro '+q+' · contratos que acabaram',fiscoN(xs.length,'contrato','contratos')+' com redução pela duração ou isenção que acabaram em '+r.ano,q);
  xs.forEach(x=>{
    const cs=[];
    cs.push(['Regime fiscal',x.regime?x.regime+(x.regimeTexto?' · '+x.regimeTexto:''):'falta',x.regime?undefined:FALTA]);
    cs.push(['N.º do contrato na AT',x.numero||'falta',x.numero?undefined:FALTA]);
    cs.push(['Ano de início do benefício',x.anoInicioBeneficio||'falta',x.anoInicioBeneficio?undefined:FALTA]);
    cs.push(['Data da cessação',dPT(x.data)||'—']);
    cs.push(['Motivo da cessação',x.motivo?x.motivo+(x.motivoCurto?' · '+x.motivoCurto:''):'falta: escolhe-o na ficha do contrato',x.motivo?undefined:FALTA]);
    if(x.regularizacao&&!sem)cs.push(['Regularização (art. 72.º n.º 20)',fiscoExpRegularizacaoTexto(r,x.regularizacao),FALTA]);
    else if(x.regulariza)cs.push(['Regularização (art. 72.º n.º 20)','o período em que o contrato acabou passa à taxa da duração efetivamente decorrida, e a diferença acresce ao imposto de '+r.ano+', com juros compensatórios',FALTA]);
    fiscoPdfCartao(pdf,x.nome+(x.imovel?' · '+x.imovel:''),cs);
  });
  fiscoPdfNota(pdf,'O quadro '+q+' pede todos os contratos de habitação permanente com redução da taxa pela duração, ou isentos de um programa de arrendamento acessível, que acabaram em '+r.ano+', seja qual for o motivo. A app não calcula os juros compensatórios.');
}
/* O quadro 5 — a sublocação (D52): um cartão por contrato de sublocação e
   titular, com o que o impresso pede (o n.º e o início do contrato, os
   sublocatários com o NIF português ou o país, a renda recebida e a natureza
   da versão, a renda paga ao senhorio e o NIF dele, as retenções, a
   atualização de 2023), a estimativa (a diferença e o imposto dela) e o que
   falta; o total do quadro; e a nota de que só a diferença conta, sem gastos.
   Sem sublocação, não escreve.
   Recebe: pdf — o escritor; r — o resumo (resumoFiscal).
   Devolve: nada — escreve o quadro e desce. */
function fiscoPdfQuadro5(pdf,r){
  const es=fiscoExpQuadro5(r);if(!es.length)return;
  const q=((r.versao||{}).quadros||{}).sublocacao||'5',sem=fiscoExpSemRegras(r),E=fiscoPdfEuro,T=fiscoExpTotaisQuadro5(r),FALTA={bold:true,cor:PDF_COR.cobaltoTexto};
  const parte=fiscoExpParte(r,es);
  fiscoPdfTitulo(pdf,'Quadro '+q+' · sublocação',fiscoN(fiscoNContratos(es),'contrato','contratos')+' de sublocação em '+r.ano+(parte?' · '+parte:''),q);
  es.forEach(e=>{
    const cs=[],F=(c,x,o)=>cs.push([c,x,o]),at=e.atualizacao,qx=fiscoExpQuota(r,e);
    F('N.º do contrato na AT',e.numero||'falta',e.numero?undefined:FALTA);
    F('Data de início',dPT(e.inicio)||'—');
    fiscoPdfInquilinos(F,e.inquilinos,'Sublocatário');
    F('Renda recebida',E(e.rendaRecebida));
    F('Natureza',(e.natureza||'—')+(e.naturezaTexto?' · '+e.naturezaTexto:''));
    F('Renda paga ao senhorio',E(e.rendaPaga));
    F('NIF do senhorio',e.nifSenhorio?fmtNIF(e.nifSenhorio):'falta',e.nifSenhorio?undefined:FALTA);
    F('Retenções na fonte',E(e.retencoes));
    if(at)F(at.nome,at.texto,at.resposta?undefined:FALTA);
    F('Titular',e.titular||'A');
    if(e.quota<1)F('Quota-parte',qx.quota);
    F('Estimativa da app',sem?'diferença '+E(e.liquido)+' · sem taxa nem imposto: a app não tem as regras de '+r.ano
      :'diferença '+E(e.liquido)+' · taxa '+dec(e.taxa)+' % · imposto estimado '+E(Math.max(0,Number(e.imposto)||0))+' (não vai ao quadro)',{cor:PDF_COR.secundario});
    if(e.faltas.length){const f=e.faltas.join(', ');F('Falta',f.charAt(0).toUpperCase()+f.slice(1)+'.',FALTA)}
    fiscoPdfCartao(pdf,e.nome+(e.imovel?' · '+e.imovel:'')+(r.variosTitulares?' · titular '+e.titular:''),cs);
  });
  fiscoPdfCartao(pdf,'Total do quadro '+q,[['Renda recebida',E(T.rendaRecebida),{bold:true}],['Renda paga ao senhorio',E(T.rendaPaga),{bold:true}],
    ['Retenções na fonte',E(T.retencoes),{bold:true}],['Diferença',E(T.liquido),{bold:true}]],{fundo:PDF_COR.cobaltoSuave,corTitulo:PDF_COR.cobaltoTexto});
  fiscoPdfNota(pdf,'Na sublocação só conta a diferença entre a renda que recebes e a que pagas ao senhorio, sem gastos (CIRS art. 41.º n.º 6): estes contratos não vão ao 4.1 nem ao 4.2. O imposto estimado da diferença já está nos totais; uma diferença negativa não abate às outras rendas.');
}
/* As obras dos 24 meses que ficam fora até se responder à pergunta do
   contrato (D28, fiscoExpObrasPorConfirmar): um cartão com o valor de cada
   contrato e o que falta, e a condição do art. 41.º n.º 7. Sem nenhuma, não
   escreve.
   Recebe: pdf — o escritor; r — o resumo (resumoFiscal).
   Devolve: nada — escreve a secção e desce. */
function fiscoPdfObrasPorConfirmar(pdf,r){
  const xs=fiscoExpObrasPorConfirmar(r);if(!xs.length)return;
  fiscoPdfTitulo(pdf,'Obras dos 24 meses por confirmar',fiscoN(xs.length,'contrato','contratos')+' · não estão em nenhuma linha dos quadros');
  fiscoPdfCartao(pdf,'',xs.map(x=>[x.nome+(x.imovel?' · '+x.imovel:''),fiscoPdfEuro(x.valor)+(x.inicioGastos?' desde '+fiscoExpMesAno(x.inicioGastos):'')+' · '+x.texto]));
  fiscoPdfNota(pdf,'As obras de conservação dos 24 meses antes de um contrato '+FISCO_EXP_OBRAS_CONDICAO+'. Responde à pergunta na ficha do contrato para entrarem na linha dele.');
}
/* O documento inteiro, a partir do resumo: o cabeçalho (IRS · Anexo F, o ano
   dos rendimentos e o prazo da entrega, quem declara na quota-parte — com o
   titular B em conjunta, fisco.js:fiscoQuemDeclara — ou os valores por
   inteiro, a data, e a linha das regras com o ano, oficiais ou provisórias,
   a data da revisão e a versão da app — fisco-exportar.js:fiscoRegrasTexto,
   D105), o aviso das regras quando o ano não tem versão própria ou ela é
   provisória (sem regras do ano, sem taxa nem imposto, D50), os totais do
   ano (os números à cabeça da página; o imposto
   nunca negativo, o abate dos prejuízos de anos anteriores e o imposto
   depois dele (rev. 6, Q10), o prejuízo a reportar de cada titular com a
   condição do reporte, D72/D97, o imposto depois do AIMI quando ele abate,
   D99, e a regularização do quadro 10, D10), os
   quadros 4.1 e 4.2, os das isenções (6D, 6F, 6H, D18), o quadro 8 com o
   prazo das substituições e as retenções de cada ano (D84, D55), o
   quadro 9, o 10 (D09), as rendas sem contrato e as dos contratos não declarados com o
   valor (D34), o que há a tratar e o IRS_AVISO no fim. Da vaga 3: em
   conjunta, a frase das letras do Rosto (D30); nos totais, a caução, os
   reembolsos e as devoluções que as rendas levam (D03) e a sublocação à
   parte, com as retenções dela (D52); depois dos quadros 4.1 e 4.2, as obras
   dos 24 meses por confirmar (D28) e o quadro 5 (D52).
   Recebe: r — o resumo (resumoFiscal); nomeTit — o nome de quem declara (''
   por inteiro); hoje — a data 'AAAA-MM-DD'.
   Devolve: os bytes do PDF (string latin-1, um carácter por byte). */
function fiscoPdfDocumento(r,nomeTit,hoje){
  const pdf=PDF(),C=PDF_COR,v=r.versao,T=r.totais,Q=v.quadros,e=v.entrega||{};
  const E=fiscoPdfEuro;
  let campos=[];
  const F=(c,x,o)=>campos.push([c,x,o]),cartao=(t,o)=>{fiscoPdfCartao(pdf,t,campos,o);campos=[]};
  pdf.titulo('IRS · Anexo F',{size:22,after:10});
  pdf.text(fiscoPdfTxt('Rendimentos de '+r.ano+(e.de&&e.ate?' · entrega de '+irsDiaMes(e.de)+' a '+irsDiaMes(e.ate)+' de '+e.ate.slice(0,4):'')),{size:10.5,after:2});
  pdf.text(fiscoPdfTxt(r.porInteiro?'Valores por inteiro, de todos os proprietários'
    :r.titulares.length>1?'Titulares: '+fiscoQuemDeclara(r)+', cada um na sua quota-parte':'Titular: '+(nomeTit||'—')+', na quota-parte'),{size:10.5,after:2});
  const letras=fiscoExpLetrasTexto(r);
  if(letras)pdf.text(fiscoPdfTxt(letras),{size:9,cor:C.secundario,after:2});
  pdf.text(fiscoPdfTxt('Feito a '+dPT(hoje)+', com o que a app tem registado.'),{size:9,cor:C.secundario,after:2});
  pdf.text(fiscoPdfTxt(fiscoRegrasTexto(r)+'.'),{size:9,cor:C.secundario,after:8});
  const sem=fiscoExpSemRegras(r);
  const regras=sem?'A app não tem as regras de '+r.ano+': as taxas, os quadros e os códigos podem ser outros. Não uses estes números para a declaração desse ano — por isso a taxa e o imposto estimado não aparecem.'
    :!v.exato?'Ainda não há versão das regras de '+r.ano+': usam-se as de '+v.ano+(v.pedido>v.ano?', com as datas passadas para '+r.ano+' — as taxas e os quadros podem ter mudado.':', a mais antiga que a app tem.')
    :v.modelo&&!v.modelo.oficial?'Regras de '+v.ano+' em versão provisória: o Anexo F deste ano ainda não foi aprovado.'+(v.revisto?' Revistas a '+dPT(v.revisto)+'.':''):'';
  if(regras)pdf.caixa(fiscoPdfTxt(regras),{size:9.5,cor:C.cobaltoTexto,fundo:C.cobaltoSuave,after:8});

  /* o imposto nunca é negativo; abatem-lhe, por esta ordem, os prejuízos de
     anos anteriores (rev. 6, Q10) e o AIMI (quadro 9), soma-se a
     regularização do quadro 10 (estimativa sem juros, D10), e é do que fica
     que se tiram as retenções (fiscoExpImpostos, os números do KPI) */
  const a=r.aimi,I=fiscoExpImpostos(r),rep=I.reporte;
  const g=r2(sum(r.colunas.map(k=>T.gastos[k]))+T.obras24),aPagar=I.aPagar;
  const q5=fiscoExpQuadro5(r),q5T=fiscoExpTotaisQuadro5(r),q5n=Q.sublocacao||'5';
  const recT=fiscoExpReceitas({caucao:sum(r.linhas.map(l=>Number(l.caucao)||0)),reembolsos:sum(r.linhas.map(l=>Number(l.reembolsos)||0)),devolucoes:sum(r.linhas.map(l=>Number(l.devolucoes)||0))});
  fiscoPdfTitulo(pdf,'Totais de '+r.ano,fiscoN(fiscoNContratos(r.linhas),'contrato','contratos')+' nos quadros 4.1 e 4.2'+(q5.length?' · '+fiscoN(fiscoNContratos(q5),'contrato','contratos')+' no quadro '+q5n:''));
  F('Rendas ilíquidas',E(T.rendas)+(recT.texto?' · '+recT.texto:''),{bold:true});
  F('Retenções na fonte',E(T.retencoes)+(q5T.retencoes?' · com '+E(q5T.retencoes)+' do quadro '+q5n:''),{bold:true});
  F('Gastos dedutíveis',E(g)+(T.obras24?' (com '+E(T.obras24)+' de obras dos 24 meses)':''),{bold:true});
  const isQ=fiscoExpIsentos(r);
  F('Rendimento líquido',E(T.liquido)+(T.isentos.n?' (sem os '+E(T.isentos.liquido)+' isentos do '+listaE(isQ.map(x=>x.quadro))+')':'')+(q5.length?' · quadros 4.1 e 4.2':''),{bold:true});
  /* a sublocação vai à parte (D52): só a diferença, e o imposto dela já está no estimado */
  if(q5.length)F('Sublocação (quadro '+q5n+')','diferença '+E(q5T.liquido)+' · recebida '+E(q5T.rendaRecebida)+', paga ao senhorio '+E(q5T.rendaPaga),{bold:true});
  if(sem)F('Imposto estimado','por conhecer: a app não tem as regras de '+r.ano,{bold:true,cor:C.cobaltoTexto});
  else{
    F('Imposto estimado',E(I.imposto)+' · sem englobamento',{bold:true});
    if(rep){
      if(rep.porTitular.some(t=>t.letra))rep.porTitular.forEach(t=>F('Prejuízos de anos anteriores'+(t.letra?' · titular '+t.letra:''),'abatem '+E(t.usado)+' ao líquido',{bold:true}));
      else F('Prejuízos de anos anteriores','abatem '+E(rep.usado)+' ao líquido',{bold:true});
      F('Depois dos prejuízos de anos anteriores',E(rep.depois)+' · o imposto desce '+E(rep.imposto)+' (estimativa)',{bold:true});
    }
    if(I.abate)F('Depois do AIMI (quadro '+(Q.aimi||'9')+')',E(I.final)+' · abate '+E(I.abate)+' (estimativa)',{bold:true});
  }
  fiscoPrejuizos(r).forEach(p=>F('Prejuízo a reportar'+(p.letra?' · titular '+p.letra:''),E(p.valor),{bold:true}));
  /* a regularização acresce ao imposto do ano da cessação (art. 72.º n.º
     20): soma-se antes das retenções, como no KPI da página (D10) */
  if(I.regularizacao&&!sem)F('Com a regularização do quadro '+(Q.cessados||'10'),E(I.comRegularizacao)+' · +'+E(I.regularizacao)+' (estimativa, sem os juros compensatórios)',{bold:true,cor:C.cobaltoTexto});
  if(T.retencoes&&!sem)F('Depois das retenções',aPagar>=0?'falta pagar '+E(aPagar):'a receber '+E(-aPagar));
  cartao('',{fundo:C.cobaltoSuave});
  if(rep&&!sem)fiscoPdfNota(pdf,fiscoExpReporteTexto(r));
  if(fiscoPrejuizos(r).length)fiscoPdfNota(pdf,'As rendas não chegaram para os gastos. '+FISCO_PREJUIZO_NOTA);
  fiscoPdfNota(pdf,'Rendas ilíquidas: o que entrou mais o que o inquilino reteve na fonte, com a caução (renda do ano em que a recebes) e os reembolsos que o inquilino te pagou, menos as rendas que devolveste. Os gastos de um imóvel com mais do que um contrato no ano repartem-se pelas linhas na proporção das rendas de cada uma (estimativa); o rateio por VPT ou por área fica para quem preenche.');

  fiscoPdfQuadro(pdf,r,Q.semReducao);
  fiscoPdfQuadro(pdf,r,Q.comReducao);
  fiscoPdfObrasPorConfirmar(pdf,r);
  fiscoPdfQuadro5(pdf,r);

  /* os isentos, um quadro por isenção: o 6D com o código do programa, o 6F e
     o 6H só com o campo do 4.1 (D18) */
  isQ.forEach(x=>fiscoPdfIsentos(pdf,r,x.quadro,x.linhas,isQ.length>1));

  const ant=r.linhas.filter(l=>l.anosAnteriores.length);
  if(ant.length){
    fiscoPdfTitulo(pdf,'Quadro '+Q.anosAnteriores+' · rendas de anos anteriores','recebidas em '+r.ano+' · já estão nas rendas de cada linha',Q.anosAnteriores);
    /* uma linha por ano a que as rendas respeitam, com as retenções dele (D55) */
    ant.forEach(l=>l.anosAnteriores.forEach(x=>{
      const t=l.nome+(r.variosTitulares?' · titular '+l.titular:'')+' · de '+x.ano;
      F(t,E(x.valor)+' · quadro '+l.quadro+(l.campo?', campo '+l.campo:''));
      if(Number(x.retencoes)>0)F(t+' · retenções',E(x.retencoes));
    }));
    cartao('');
    fiscoPdfNota(pdf,fiscoQuadro8Texto(r));
  }

  if(a){
    fiscoPdfTitulo(pdf,'Quadro '+(Q.aimi||'9')+' · AIMI','adicional ao IMI pago em '+r.ano+' · '+fiscoN(a.n,'pagamento','pagamentos'),Q.aimi||'9');
    a.predios.forEach(p=>{const cs=r.linhas.filter(l=>l.propertyId===p.propertyId&&l.campo).map(l=>l.campo);
      F(p.imovel+(cs.length?' · campo '+listaE(cs):'')+' · VPT',p.vpt?E(p.vpt):'falta')});
    /* o 9101 e o 9102 são os da demonstração de liquidação; sem eles, os
       campos dizem de onde vêm, sem valor (D71); o AIMI conta inteiro para
       quem o pagou (D32) */
    const q9=fiscoExpQuadro9(r),DEM={bold:true,cor:C.cobaltoTexto};
    F('9101 · AIMI liquidado',q9.textos.c9101,q9.c9101!=null?{bold:true}:DEM);
    F('9102 · valor tributável',q9.textos.c9102,q9.c9102!=null?{bold:true}:DEM);
    F('AIMI pago (o que a app tem)',E(a.total));
    F('VPT dos prédios urbanos (estimativa)',a.semVpt.length?'falta o VPT de '+listaE(a.semVpt):E(a.vptTotal));
    q9.excluidos.forEach(x=>F('Fora do quadro 9 · '+x.imovel,x.porque||'—',{cor:C.secundario}));
    F('Parte que abate (estimativa)',a.abate==null||sem?'—':E(I.abate),{bold:true});
    cartao('');
    fiscoPdfNota(pdf,'O AIMI não é gasto das rendas: abate ao imposto na proporção do VPT dos prédios que deram rendas. A app limita o abate ao imposto estimado das rendas; a lei fala da coleta à taxa de 28 % (CIMI art. 135.º-I) — a AT faz a conta. Os valores certos estão na demonstração de liquidação do AIMI.');
  }

  fiscoPdfQuadro10(pdf,r);

  /* as rendas que não estão em nenhuma linha dos quadros, com o valor: as sem
     contrato ligado declaram-se na mesma (D34); as dos contratos marcados como
     não declarados ficam de fora por escolha, e diz-se quanto */
  const sc=r.semContrato||[],fo=r.fora||[];
  if(sc.length){
    fiscoPdfTitulo(pdf,'Rendas sem contrato ligado',fiscoN(sc.length,'imóvel','imóveis')+' · não estão em nenhuma linha dos quadros');
    sc.forEach(s=>F(s.imovel,E(s.rendas)+' · '+fiscoN(s.n,'renda','rendas')));
    F('Total',E(r2(sum(sc.map(s=>s.rendas)))),{bold:true});
    cartao('',{fundo:C.cobaltoSuave});
    fiscoPdfNota(pdf,'São rendimento do ano e declaram-se na mesma: liga cada uma ao seu contrato na app, para entrar na linha certa do quadro.');
  }
  if(fo.length){
    fiscoPdfTitulo(pdf,'Fora da declaração',fiscoN(fo.length,'contrato marcado como não declarado à AT','contratos marcados como não declarados à AT'));
    fo.forEach(f=>F(f.nome+(f.imovel?' · '+f.imovel:''),E(f.rendas)));
    cartao('');
  }

  if(r.avisos.length){
    fiscoPdfTitulo(pdf,'A tratar antes de entregar',fiscoN(r.avisos.length,'ponto','pontos')+' de '+r.ano);
    r.avisos.forEach((x,i)=>pdf.text(fiscoPdfTxt(x.texto),{size:9.5,marca:(i+1)+'.',recuo:16,after:3,cor:x.nivel==='info'?C.secundario:C.tinta}));
  }

  pdf.gap(12);
  pdf.caixa(fiscoPdfTxt(IRS_AVISO),
    {size:9.5,cor:C.cobaltoTexto,fundo:C.cobaltoSuave});
  return pdf.build();
}
