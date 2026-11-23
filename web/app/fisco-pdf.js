/* ================= FISCO · PDF =================
   O PDF do Anexo F do ano e de quem declara, como a Declaração o mostra: os quadros
   4.1, 4.2 e 4.3 contrato a contrato (os 6A, 6B e 6C a apontá-los; fora do
   Anexo F, o quadro 7A do Anexo J e a categoria B), cada um em bloco campo → valor pela ordem do
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
   contrato, nem contratos fora, nem Anexo J, nem categoria B, nem contratos
   que acabaram no quadro 10, nem regularização) diz que não há PDF; um ano
   só com o quadro 5 dá o PDF com ele (D52), e um só com o Anexo J ou a
   categoria B também (D133, D134). Rendas sem contrato sozinhas dão o PDF com elas (D34):
   são rendimento, e recusá-lo escondia-as. Um ano só com o quadro 10 (um
   contrato que acabou antes de qualquer renda do ano) ou só com a
   regularização do n.º 20 dá o PDF com eles: as instruções do quadro 10
   pedem os contratos que acabaram no ano, haja ou não rendas nele, e a
   regularização é imposto dessa declaração. Espera pelas letras da app
   (pdfLetras), que sem rede deixam o PDF na Helvetica.
   Devolve: Promise de nada — descarrega o PDF, ou avisa porque não o fez. */
async function fiscoPdf(){
  if(typeof PDF!=='function'||typeof PDF_COR==='undefined'){
    toast('Não foi possível preparar o PDF. Recarrega a página e tenta outra vez.');
    return;
  }
  const ano=fiscoAnoAtual(),r=resumoFiscal(ano);
  if(!r.linhas.length&&!(r.semContrato||[]).length&&!(r.fora||[]).length&&!fiscoExpQuadro5(r).length&&!fiscoExpAnexoJ(r)&&!fiscoExpCategoriaB(r)
    &&!fiscoExpQuadro10(r).length&&!fiscoExpComRegularizacao(r)){
    toast('Sem rendas a declarar em '+ano+' (nos quadros 4.1, 4.2, 4.3 e 5 do Anexo F, nem no Anexo J): não há PDF para exportar.');return}
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
/* O bloco de um contrato num quadro, pela ordem das colunas do impresso,
   como o cartão da página (fiscoCamposDe, N108): o campo da linha (4001…,
   4501…), o n.º do contrato na AT, o início (só no 4.1: no 4.2 a data de
   início é do 4.2A, D102), o imóvel (freguesia, tipo, artigo, fração), o
   titular, as rendas ilíquidas, a natureza («07 (assumida)» sem a
   finalidade, D16) e o campo do modelo novo por conhecer (D49), as
   retenções, os inquilinos com o NIF português ou o país
   (fiscoIdInquilino), a atualização de 2023 e cada coluna de gastos; a taxa
   da lei do ano e porquê (a de cada período quando muda no ano, fiscoExpTaxa,
   D41, D15; nenhuma sem regras do ano, D50; a escrita no contrato, quando é
   outra, como nota, D17) vai no fim, com a estimativa;
   as três colunas das obras dos 24 meses
   quando as há; no 4.2 o 4.2A (a comunicação pelo período, Sim só até ao
   prazo dele: fiscoExpComunicacao, D01, D35; «A confirmar» com a marca do
   modelo antigo por confirmar) e o 4.2B sempre que o contrato
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
   porquê da taxa do imóvel reabilitado e do DHD. Da ronda 2 (vaga 4): a
   identificação matricial com a freguesia de uma união extinta em 2025 a
   «confirmar» (fiscoPdfMatriz, D135); os benefícios do quadro 6 que apontam a
   linha (D117, D119, D121); e a estimativa com o líquido do imposto quando o
   6C ou o 6B o mudam (fiscoPdfEstimativa).
   Recebe: pdf — o escritor; r — o resumo (resumoFiscal); l — a linha; red —
   true no quadro 4.2; medir (opcional) — true só diz a altura do cartão.
   Devolve: nada — escreve o cartão do contrato e desce; com medir, a altura. */
function fiscoPdfLinha(pdf,r,l,red,medir){
  const v=r.versao,nat=v.naturezas||{},campos=[],F=(c,x,o)=>campos.push([c,x,o]),sem=fiscoExpSemRegras(r),bon=(v.taxas||{}).bonusRendaMenor||{};
  const MOTIVO={nh:'não habitacional',duracao:'redução pela duração',moderada:'renda moderada',base:'taxa base',semRenovacao:'depois do termo, sem renovação registada',
    reabilitacao:'imóvel reabilitado',dhd:'direito real de habitação duradoura'};
  const G=fiscoExpGrupos(r),nt=fiscoExpNaturezaTexto(r,l),rec=fiscoExpReceitas(l),at=fiscoExpAtualizacao(r,l),qx=fiscoExpQuota(r,l);
  const AVISO={bold:true,cor:PDF_COR.cobaltoTexto};
  /* pela ordem das colunas do impresso, como o cartão da página
     (fisco-quadros.js:fiscoCamposDe — N108): o número, a data de início (só
     no 4.1), a identificação matricial, o titular, o valor ilíquido, a
     natureza, as retenções, o NIF ou o país, a atualização de 2023, os
     gastos e as obras; a taxa e a estimativa, que não vão ao quadro, no fim */
  if(l.campo)F('Campo',l.campo,{bold:true});
  F('N.º do contrato na AT',l.atNumero||(l.estado==='declarado'?'falta':'—'));
  if(!red)F('Início do contrato',dPT(l.inicio)||'—');
  const tx=l.isencao?null:fiscoExpTaxa(r,l),escr=sem||l.isencao||typeof fiscoTaxaEscritaOutra!=='function'?null:fiscoTaxaEscritaOutra(l),pc=fiscoExpPorConhecer(r,l);
  F('Imóvel',l.imovel||'—');
  fiscoPdfMatriz(F,l);
  F('Titular',l.titular==='A/B'?'A/B (o imóvel é dos dois: uma linha por titular, cada uma com a sua quota-parte)':(l.titular||'A'));
  F('Rendas ilíquidas',fiscoPdfEuro(l.rendas));
  /* o que as rendas levam (D03, D20, D53): a caução é renda do ano em que se recebe */
  if(rec.caucao)F('Inclui a caução',fiscoPdfEuro(rec.caucao)+' · renda do ano em que a recebeste',{cor:PDF_COR.secundario});
  if(rec.reembolsos)F('Inclui reembolsos do inquilino',fiscoPdfEuro(rec.reembolsos),{cor:PDF_COR.secundario});
  if(rec.devolucoes)F('Já sem as rendas devolvidas',fiscoPdfEuro(rec.devolucoes),{cor:PDF_COR.secundario});
  /* sem finalidade, a 07 é assumida e di-lo (D16); as linhas 05 e 02 dizem o
     que são, pelo texto da versão (D21, D51) */
  const nTxt=nt?' · '+nt:l.natureza===nat.habitacional?' · arrendamento habitacional':l.natureza===nat.naoHabitacional?' · arrendamento não habitacional':'';
  if(l.naturezaAssumida&&l.natureza)F('Natureza',l.natureza+' (assumida)'+nTxt+' · falta a finalidade do contrato',AVISO);
  else F('Natureza',l.natureza+nTxt);
  /* o campo da taxa de 10 % das rendas moderadas por conhecer (D49) fica
     onde a página o põe, a seguir à natureza */
  if(pc&&!l.isencao)F(pc.campo,pc.valor,AVISO);
  F('Retenções na fonte',fiscoPdfEuro(l.retencoes));
  fiscoPdfInquilinos(F,l.inquilinos,'Inquilino');
  /* a atualização de 2023 nos contratos em vigor antes de 2022 (D76) */
  if(at)F(at.nome,at.texto,at.resposta?undefined:AVISO);
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
  if(red){
    const D=v.quadros.datas,com=fiscoExpComunicacao(r,l);
    if(l.campo)F(D+' · campo do quadro 4.2',l.campo);
    /* a resposta pelo período em que as rendas assentam (D01): comunicada até
       ao prazo dele é Sim; depois, ou por fazer com o prazo passado, Não (D35);
       com a marca do modelo antigo por confirmar, nem Sim nem Não */
    F(D+' · comunicação',!com?'—'
      :com.porConfirmar?'A confirmar ('+(com.dataAntiga?'a marca de '+dPT(com.dataAntiga)+' vem':'a marca vem')+' da app antiga, que a pedia todos os anos: se comunicaste a duração deste período até '
        +(com.prazo?dPT(com.prazo):'15 de fevereiro do ano seguinte ao início dele')+', é Sim, senão é Não; confirma o dia na Declaração)'
      :com.resposta==='sim'?'Sim (comunicada a '+dPT(com.data)+')'
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
  /* os benefícios do quadro 6 que apontam esta linha (D117, D119, D121) */
  fiscoExpBeneficios(r,l).forEach(b=>F('Quadro '+b.quadro,b.curto+(b.campo?' · o campo '+b.campo+' vai ao '+b.quadro:'')+(b.efeito?' · '+b.efeito:''),{bold:true}));
  /* a taxa da lei do ano, a de cada período quando muda no ano (D41, D15);
     a escrita no contrato é só uma nota (D17); sem regras do ano, nenhuma
     (D50) — no fim, com a estimativa: não são colunas do quadro */
  F('Taxa',l.isencao?'isento · quadro '+(l.isencao.quadro||'6D')+(l.isencao.codigo?' · código '+l.isencao.codigo:'')
    :sem||tx.partes.length>1||(tx.partes[0]&&tx.partes[0].semRenovacao)?tx.texto:tx.texto+' · '+(MOTIVO[l.motivoTaxa]||'—'),sem?AVISO:undefined);
  if(escr!=null)F('Taxa escrita no contrato',dec(escr)+' % · não é a da lei de '+r.ano+': na declaração conta a de '+dec(l.taxa)+' %',{cor:PDF_COR.secundario});
  if(pc&&l.isencao)F(pc.campo,pc.valor,AVISO);
  fiscoPdfEstimativa(F,r,l,'líquido');
  if(l.faltas.length){const f=l.faltas.join(', ');F('Falta',f.charAt(0).toUpperCase()+f.slice(1)+'.',{bold:true,cor:PDF_COR.cobaltoTexto})}
  /* em conjunta, as duas linhas de um contrato dos dois cônjuges distinguem-se pela letra no título */
  return fiscoPdfCartao(pdf,l.nome+(l.imovel?' · '+l.imovel:'')+(l.papel&&l.papel!=='renda'&&nt?' · natureza '+l.natureza:'')+(r.variosTitulares?' · titular '+l.titular:''),campos,{medir:!!medir});
}
/* A identificação matricial de uma linha (o código da freguesia, o tipo, o
   artigo e a fração), com o que falta. O código de uma união de freguesias
   desagregada em outubro de 2025 (D135, fiscoExpFreguesia) diz «trocar» em
   vez do código, com as freguesias repostas, e o artigo que pode ter mudado
   — também com a marca da caderneta: esse código já não está em nenhuma
   caderneta atual (N087).
   Recebe: F — o que junta um campo ao cartão; l — a linha.
   Devolve: nada — junta os campos. */
function fiscoPdfMatriz(F,l){
  const fx=fiscoExpFreguesia(l),AVISO={bold:true,cor:PDF_COR.cobaltoTexto};
  if(fx)F('Freguesia (código)','trocar · '+fx.frase+'. Vê o código novo na caderneta predial atual e troca-o na ficha do imóvel',AVISO);
  else F('Freguesia (código)',l.freguesiaCodigo||'falta');
  F('Tipo de prédio',l.tipoPredio||'falta');
  if(fx)F('Artigo matricial',(l.artigo||'falta')+' · pode ter mudado: vê-o na caderneta predial atual',AVISO);
  else F('Artigo matricial',l.artigo||'falta');
  F('Fração',l.fracao||'—');
}
/* A estimativa da app numa linha (não vai ao quadro): o líquido do quadro e,
   quando os benefícios o mudam (o 6C, o 6B — D119, D121), o líquido sobre que
   o imposto se estima, o imposto nunca negativo, e o resultado negativo que
   abate às outras linhas do titular; sem regras do ano, sem taxa nem imposto
   (D50).
   Recebe: F — o que junta um campo ao cartão; r — o resumo; l — a linha;
   rotulo — o nome do líquido ('líquido').
   Devolve: nada — junta os campos. */
function fiscoPdfEstimativa(F,r,l,rotulo){
  const sem=fiscoExpSemRegras(r),pre=fiscoPrejuizoLinha(l),lt=fiscoExpLiquidoImposto(l);
  const pct=x=>dec(r2(Number(x)*100))+' %',ok=x=>x!=null&&isFinite(Number(x));
  const porque=(Array.isArray(l.beneficios)?l.beneficios:[]).map(b=>!b?'':ok(b.fator)?'no '+b.quadro+' as rendas contam '+pct(b.fator)
    :ok(b.fatorObras24)?'no '+b.quadro+' as obras dos 24 meses contam '+pct(b.fatorObras24):'').filter(Boolean);
  /* só os benefícios mudam o líquido do imposto */
  const dif=porque.length>0&&lt!==r2(Number(l.liquido)||0);
  F('Estimativa da app',rotulo+' '+fiscoPdfEuro(l.liquido)+(dif&&!sem?' · para o imposto '+fiscoPdfEuro(lt)+(porque.length?' ('+porque.join(', ')+')':''):'')
    +(sem?' · sem taxa nem imposto: a app não tem as regras de '+r.ano:' · imposto estimado '+fiscoPdfEuro(fiscoImpostoLinha(l))+' (não vai ao quadro)'),{cor:PDF_COR.secundario});
  if(pre)F('Resultado negativo',fiscoPdfEuro(pre)+' · abate às rendas das outras linhas do mesmo titular, e o que sobrar é prejuízo a reportar',{cor:PDF_COR.secundario});
}
/* O bloco de um direito real de habitação duradoura no quadro 4.3 (D120),
   pelas colunas das instruções (quadro43.colunas, os nomes da versão): o
   campo da linha (4901…), o n.º e o início do contrato, a data e a caução da
   escritura, o titular, a identificação matricial (fiscoPdfMatriz), o valor
   ilíquido e a natureza (a tabela do 4.3), as retenções, os moradores com o
   NIF, a atualização de 2023, os gastos obrigatórios (conservação
   extraordinária, condomínio, outros) e a cessação com o motivo; depois a
   caução recebida no ano, que não é rendimento, a regularização de um DHD
   cessado por acordo (art. 72.º n.º 20), a quota-parte, a estimativa e o que
   falta (fiscoExpDhd).
   Recebe: pdf — o escritor; r — o resumo; l — a linha (do 4.3); medir
   (opcional) — true só diz a altura do cartão.
   Devolve: nada — escreve o cartão e desce; com medir, a altura. */
function fiscoPdfLinha43(pdf,r,l,medir){
  const campos=[],F=(c,x,o)=>campos.push([c,x,o]),N=id=>fiscoExpNome43(r,id),dx=fiscoExpDhd(r,l),nt=fiscoExpNaturezaTexto(r,l);
  const at=fiscoExpAtualizacao(r,l),qx=fiscoExpQuota(r,l),sem=fiscoExpSemRegras(r),AVISO={bold:true,cor:PDF_COR.cobaltoTexto};
  const MOTIVO={dhd:'direito real de habitação duradoura',base:'taxa base'};
  if(l.campo)F('Campo',l.campo,{bold:true});
  F(N('numero'),l.atNumero||(l.estado==='declarado'?'falta':'—'));
  F(N('inicio'),dPT(l.inicio)||'—');
  F(N('escritura'),dPT(dx.escritura)||'falta');
  F(N('caucao'),dx.caucao?fiscoPdfEuro(dx.caucao):'falta',dx.caucao?undefined:AVISO);
  F(N('titular'),l.titular==='A/B'?'A/B (o imóvel é dos dois: uma linha por titular, cada uma com a sua quota-parte)':(l.titular||'A'));
  F(N('matriz'),null,{grupo:true});
  F('Imóvel',l.imovel||'—');
  fiscoPdfMatriz(F,l);
  F(N('valor'),fiscoPdfEuro(l.rendas));
  F(N('natureza'),l.natureza+(nt?' · '+nt:''));
  F(N('retencoes'),fiscoPdfEuro(l.retencoes));
  fiscoPdfInquilinos(F,l.inquilinos,'Morador');
  if(at)F(at.nome,at.texto,at.resposta?undefined:AVISO);
  F(N('gastos'),null,{grupo:true});
  dx.gastos.forEach(g=>F(g.nome,fiscoPdfEuro(g.valor)));
  F(N('cessacao'),dx.cessacao?dPT(dx.cessacao.data)+' · '+(dx.cessacao.motivo?'motivo '+dx.cessacao.motivo+(dx.cessacao.curto?' · '+dx.cessacao.curto:''):'falta o motivo'):'—',
    dx.cessacao&&!dx.cessacao.motivo?AVISO:undefined);
  /* a taxa: 5 % na prestação mensal (art. 72.º n.º 5); a base na prestação
     anual da caução e depois de uma cessação por acordo */
  const tx=fiscoExpTaxa(r,l);
  F('Taxa',sem?tx.texto:tx.texto+' · '+(MOTIVO[l.motivoTaxa]||'—'),sem?AVISO:undefined);
  if(dx.caucaoRecebida)F('Caução recebida em '+r.ano,fiscoPdfEuro(dx.caucaoRecebida)+' · não é rendimento (CIRS art. 8.º n.º 5 b)): só a prestação anual do 11.º ano em diante',{cor:PDF_COR.secundario});
  if(dx.regularizacao&&!sem)F('Regularização (art. 72.º n.º 20)',fiscoExpRegularizacaoTexto(r,dx.regularizacao),AVISO);
  else if(dx.regularizacaoFalta&&!sem)F('Regularização (art. 72.º n.º 20)','sem diferença estimada: '+dx.regularizacaoFalta.texto,AVISO);
  if(l.quota<1)F('Quota-parte',qx.quota+(qx.periodos?' · '+qx.periodos:''));
  if(qx.foraTexto)F('Comproprietários fora da app',qx.foraTexto+' · declaram a parte deles',{cor:PDF_COR.secundario});
  fiscoPdfEstimativa(F,r,l,'líquido');
  if(l.faltas.length){const f=l.faltas.join(', ');F('Falta',f.charAt(0).toUpperCase()+f.slice(1)+'.',AVISO)}
  return fiscoPdfCartao(pdf,l.nome+(l.imovel?' · '+l.imovel:'')+(l.papel&&l.papel!=='renda'?' · natureza '+l.natureza:'')+(r.variosTitulares?' · titular '+l.titular:''),campos,{medir:!!medir});
}
/* Os inquilinos (ou sublocatários) de uma linha, um a um, com o NIF
   português e, sem ele, o país com o código da tabela X (D59): «NIF
   português: —» e «País: Espanha · …», em vez de um número estrangeiro na
   coluna do NIF. O NIF vai com os nove algarismos seguidos (nifCopia, N107):
   no PDF o que se vê é o que se copia, e o campo do Portal tem nove casas.
   Recebe: F — o que junta um campo ao cartão (campo, valor, opções); ts — os
   inquilinos [{nome, nif, pais}]; rotulo — 'Inquilino' ou 'Sublocatário'.
   Devolve: nada — junta os campos. */
function fiscoPdfInquilinos(F,ts,rotulo){
  if(!ts.length){F(rotulo,'falta');return}
  ts.forEach((t,i)=>{const id=fiscoIdInquilino(t),n=ts.length>1?' '+(i+1):'';
    if(id.valido){F(rotulo+n,t.nome+' · NIF '+nifCopia(id.nif));return}
    F(rotulo+n,t.nome);
    if(id.pais){F('NIF português','—');F('País',fiscoExpPais(t))}
    else F('NIF português',id.texto,{bold:true,cor:PDF_COR.cobaltoTexto});
  });
}
/* Um quadro de rendas (o 4.1, o 4.2 ou o 4.3): o título, um bloco por
   contrato (fiscoPdfLinha; no 4.3 de um direito real de habitação
   duradoura, fiscoPdfLinha43 — D120) e o total do quadro, com as mesmas
   somas do cartão da página (no 4.3, os gastos obrigatórios dele), e a nota
   da caderneta atual ao lado da identificação matricial (D137). O 4.3 leva a
   nota do que pede e da caução; o 4.2 leva ainda a nota da comunicação de fevereiro e o 4.2C, com
   a mesma conta do fiscoReducoesHtml: os contratos celebrados desde a data do
   n.º 23 e a resposta, ou quais faltam confirmar. Sem linhas, não escreve.
   Recebe: pdf — o escritor; r — o resumo (resumoFiscal); q — o quadro ('4.1', '4.2', '4.3').
   Devolve: nada — escreve o quadro e desce. */
function fiscoPdfQuadro(pdf,r,q){
  const ls=r.linhas.filter(l=>l.quadro===q);if(!ls.length)return;
  const v=r.versao,red=q===v.quadros.comReducao,d43=!!v.quadros.dhd&&q===v.quadros.dhd,s=f=>r2(sum(ls.map(f))),tot=[],F=(c,x)=>tot.push([c,x,{bold:true}]);
  const parte=fiscoExpParte(r,ls),rec=fiscoExpReceitas({caucao:s(l=>Number(l.caucao)||0),reembolsos:s(l=>Number(l.reembolsos)||0),devolucoes:s(l=>Number(l.devolucoes)||0)});
  /* o 4.3 (D120) tem as colunas dele; o 4.1 e o 4.2, as do impresso de sempre */
  const linha=(l,medir)=>d43?fiscoPdfLinha43(pdf,r,l,medir):fiscoPdfLinha(pdf,r,l,red,medir);
  fiscoPdfTitulo(pdf,'Quadro '+q+' · '+(d43?'direito real de habitação duradoura':red?'habitação permanente com redução pela duração':'contratos sem redução pela duração'),
    fiscoN(fiscoNContratos(ls),'contrato','contratos')+' com rendas em '+r.ano+(parte?' · '+parte:'')+(ls.some(l=>l.campo)?' · preenche por esta ordem, um campo por linha':''),q,
    linha(ls[0],true));
  ls.forEach(l=>linha(l));
  const ob=s(l=>l.obras24.valor);
  /* o total num cartão cobalto suave, que não se parte entre páginas */
  const G=fiscoExpGrupos(r);
  F(d43?fiscoExpNome43(r,'valor'):'Rendas ilíquidas',fiscoPdfEuro(s(l=>l.rendas))+(rec.texto?' · '+rec.texto:''));
  F('Retenções na fonte',fiscoPdfEuro(s(l=>l.retencoes)));
  if(d43){
    const gs=ls.map(l=>fiscoExpDhd(r,l)).filter(Boolean),ids=gs.length?gs[0].gastos:[];
    ids.forEach(g=>F(g.nome,fiscoPdfEuro(r2(sum(gs.map(d=>Number((d.gastos.find(x=>x.id===g.id)||{}).valor)||0))))));
  }else{
    r.colunas.forEach(k=>F(fiscoExpColNome(r,k),fiscoPdfEuro(s(l=>l.gastos[k]))));
    if(ob)F(G.obras,fiscoPdfEuro(ob));
  }
  fiscoPdfCartao(pdf,'Total do quadro '+q,tot,{fundo:PDF_COR.cobaltoSuave,corTitulo:PDF_COR.cobaltoTexto});
  /* o que são as linhas 05 e 02 do quadro (D21, D51), com os textos da versão */
  const outras=d43?[]:ls.filter(l=>l.papel&&l.papel!=='renda').map(l=>l.natureza).filter((x,i,xs)=>x&&xs.indexOf(x)===i);
  if(outras.length)fiscoPdfNota(pdf,'Cada contrato com '+outras.map(n=>'natureza '+n+' ('+fiscoExpNaturezaTexto(r,ls.find(l=>l.natureza===n&&l.papel!=='renda'))+')').join(' ou ')
    +' tem uma linha à parte da das rendas, com o mesmo n.º do contrato, à taxa base.');
  /* o que o 4.3 pede e a caução que não é rendimento (D120) */
  if(d43){
    const n43=(v.quadro43||{}).naturezas||{};
    fiscoPdfNota(pdf,'No '+q+' vai cada direito real de habitação duradoura (DL 1/2020), com o n.º do contrato registado no Portal, a escritura e a caução. A prestação mensal (natureza '+(n43.prestacao||'01')+') paga 5 % (CIRS art. 72.º n.º 5).'
      +' A caução inicial não é rendimento: só a prestação anual do 11.º ano em diante (natureza '+(n43.caucao||'02')+') e a parte que fiques por incumprimento do morador (natureza '+(n43.deducaoCaucao||'03')+', que a app não regista: junta-a à mão).');
  }
  /* de onde vem a identificação matricial (D137) */
  fiscoPdfNota(pdf,FISCO_EXP_CADERNETA_NOTA);
  if(!red)return;
  /* a comunicação é uma por período, não uma por ano (D01) */
  pdf.gap(4);fiscoPdfNota(pdf,'No '+v.quadros.datas+', «Sim» na comunicação quer dizer que a duração do contrato, ou da renovação em que estas rendas assentam, foi comunicada no Portal até '+(v.prazos&&v.prazos.comunicacaoDuracao?irsDiaMes(v.prazos.comunicacaoDuracao):'15 de fevereiro')+' do ano seguinte ao início dela (Portaria 110/2019). Comunica-se uma vez por período, e não todos os anos; feita depois do prazo, a resposta é «Não».');
  /* o 4.2C com a conta do texto e do CSV (fiscoExpLimite42C, N039): um
     contrato dos dois cônjuges conta uma vez */
  const x=fiscoExpLimite42C(r);
  if(!x)return;
  pdf.gap(4);
  fiscoPdfCartao(pdf,'Quadro '+x.quadro+' · limite das rendas (n.º 23)',[['Celebrados desde '+dPT(x.desde),listaE(x.contratos)],
    ['Resposta',x.porConfirmar.length?'falta confirmar na ficha do contrato: '+listaE(x.porConfirmar):'Sim (01)',{bold:true}]],{fundo:PDF_COR.cobaltoSuave,corTitulo:PDF_COR.cobaltoTexto});
  /* os limites são os que a versão do ano escreve, com as datas (D78) */
  fiscoPdfNota(pdf,fiscoExpLimite42CNota(r,x));
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
   duração, ou isentos dos programas, que acabaram no ano, um cartão cada (um
   por titular em conjunta), pela ordem do impresso: o regime fiscal, o n.º
   do contrato, o ano de início do benefício («a confirmar», com o porquê,
   quando a app não o sabe ao certo), a data e o motivo da cessação (os
   textos das tabelas da versão, fiscoExpQuadro10), a identificação matricial
   (fiscoPdfMatriz), o titular e o inquilino com o NIF português ou o país
   (fiscoPdfInquilinos); com o motivo 01, a regularização do n.º 20 do art.
   72.º, com a diferença estimada sem juros (D10); e a nota do que o quadro
   pede. Num ano sem linhas nos quadros 4.1 a 4.3, também a nota da
   caderneta atual (FISCO_EXP_CADERNETA_NOTA), que nenhum outro quadro
   escreveu. Sem contratos que acabaram, não escreve.
   Recebe: pdf — o escritor; r — o resumo (resumoFiscal).
   Devolve: nada — escreve o quadro e desce. */
function fiscoPdfQuadro10(pdf,r){
  const xs=fiscoExpQuadro10(r);if(!xs.length)return;
  const Q=r.versao.quadros||{},q=Q.cessados||'10',sem=fiscoExpSemRegras(r),FALTA={bold:true,cor:PDF_COR.cobaltoTexto};
  const n=fiscoNContratos(xs);
  fiscoPdfTitulo(pdf,'Quadro '+q+' · contratos que acabaram',fiscoN(n,'contrato','contratos')+' com redução pela duração ou isenção que '+(n===1?'acabou':'acabaram')+' em '+r.ano,q);
  xs.forEach(x=>{
    const cs=[],F=(c,v,o)=>cs.push([c,v,o]);
    F('Regime fiscal',x.regime?x.regime+(x.regimeTexto?' · '+x.regimeTexto:''):'falta',x.regime?undefined:FALTA);
    F('N.º do contrato na AT',x.numero||'falta',x.numero?undefined:FALTA);
    F('Ano de início do benefício',!x.anoInicioBeneficio?'falta':x.anoInicioConfirmar?x.anoInicioBeneficio+' · a confirmar ('+(x.anoInicioPorque||'confirma o ano da primeira declaração em que as rendas deste contrato tiveram o benefício')+')'
      :x.anoInicioBeneficio,x.anoInicioBeneficio&&!x.anoInicioConfirmar?undefined:FALTA);
    F('Data da cessação',dPT(x.data)||'—');
    F('Motivo da cessação',x.motivo?x.motivo+(x.motivoCurto?' · '+x.motivoCurto:''):'falta: escolhe-o na ficha do contrato',x.motivo?undefined:FALTA);
    /* as colunas que o impresso pede depois da cessação, como no 4.1 */
    fiscoPdfMatriz(F,x);
    F('Titular',x.titular==='A/B'?'A/B (o imóvel é dos dois: uma linha por titular)':x.titular||'falta',x.titular?undefined:FALTA);
    fiscoPdfInquilinos(F,x.inquilinos,'Inquilino');
    /* com os anos que a estimativa não conta: sem rendas na app, ou por
       confirmar, sem as regras desses anos (N031, N125) */
    if(x.regularizacao&&!sem)F('Regularização (art. 72.º n.º 20)',fiscoExpRegularizacaoTexto(r,x.regularizacao),FALTA);
    else if(x.regulariza&&!x.regularizacaoAcima)F('Regularização (art. 72.º n.º 20)','o período em que o contrato acabou passa à taxa da duração efetivamente decorrida, e a diferença acresce ao imposto de '+r.ano+', com juros compensatórios'
      +(x.regularizacaoFalta&&!sem?'. '+x.regularizacaoFalta.texto.charAt(0).toUpperCase()+x.regularizacaoFalta.texto.slice(1):''),FALTA);
    fiscoPdfCartao(pdf,x.nome+(x.imovel?' · '+x.imovel:'')+(r.variosTitulares&&x.titular?' · titular '+x.titular:''),cs);
  });
  fiscoPdfNota(pdf,'O quadro '+q+' pede todos os contratos de habitação permanente com redução da taxa pela duração, ou isentos de um programa de arrendamento acessível, que acabaram em '+r.ano+', seja qual for o motivo, com a identificação matricial, o titular e o NIF do inquilino (ou o país), como no 4.1. O ano de início do benefício é o da primeira declaração em que as rendas do contrato tiveram a redução ou a isenção: quando a app não tem as rendas desse ano, diz «a confirmar». A app não calcula os juros compensatórios.');
  if(!r.linhas.length)fiscoPdfNota(pdf,FISCO_EXP_CADERNETA_NOTA);
}
/* O quadro 5 — a sublocação (D52): um cartão por contrato de sublocação e
   titular, com o que o impresso pede, pela ordem das colunas dele (N108: o
   titular, o n.º e o início do contrato, a renda recebida e a natureza da
   versão, as retenções, a atualização de 2023, os sublocatários com o NIF
   português ou o país, a renda paga ao senhorio e o NIF dele), a estimativa
   (a diferença e o imposto dela) e o que
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
    /* pela ordem das colunas do impresso, como a página (fiscoQuadro5Campos,
       N108): o titular, o n.º, a data, a renda recebida, a natureza, as
       retenções, a atualização de 2023, o NIF ou o país do sublocatário, a
       renda paga ao senhorio e o NIF dele (os nove algarismos seguidos) */
    F('Titular',e.titular||'A');
    F('N.º do contrato na AT',e.numero||'falta',e.numero?undefined:FALTA);
    F('Data de início',dPT(e.inicio)||'—');
    F('Renda recebida',E(e.rendaRecebida));
    F('Natureza',(e.natureza||'—')+(e.naturezaTexto?' · '+e.naturezaTexto:''));
    F('Retenções na fonte',E(e.retencoes));
    if(at)F(at.nome,at.texto,at.resposta?undefined:FALTA);
    fiscoPdfInquilinos(F,e.inquilinos,'Sublocatário');
    F('Renda paga ao senhorio',E(e.rendaPaga));
    F('NIF do senhorio',e.nifSenhorio?nifCopia(e.nifSenhorio):'falta',e.nifSenhorio?undefined:FALTA);
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
/* Os quadros 6A, 6B e 6C (D117, D119, D121), como o 6D: um quadro por
   benefício com linhas (fiscoExpQuadros6), um cartão por linha com o campo
   do 4.1 que o quadro aponta, o n.º do contrato, o benefício e a lei, o que
   muda (a taxa do 6A, as rendas do 6C a 50 %, as obras do 6B a 110 %) e o
   líquido sobre que o imposto se estima, e o aviso do 6A (a doutrina da AT,
   PIV 28153); e a nota de que o 4.1 leva os valores por inteiro. Sem
   benefícios, não escreve.
   Recebe: pdf — o escritor; r — o resumo (resumoFiscal).
   Devolve: nada — escreve os quadros e descem. */
function fiscoPdfBeneficios(pdf,r){
  fiscoExpQuadros6(r).forEach(x=>{
    const Q41=((r.versao||{}).quadros||{}).semReducao||'4.1';
    fiscoPdfTitulo(pdf,'Quadro '+x.quadro+' · '+x.nome,fiscoN(fiscoNContratos(x.linhas.map(y=>y.linha)),'contrato','contratos')+' · as linhas ficam no '+Q41+', e aqui vai o campo de cada uma',x.quadro);
    x.linhas.forEach(({linha:l,beneficio:b})=>{
      const cs=[['Campo do quadro '+Q41,l.campo||'—'],['N.º do contrato na AT',l.atNumero||'falta'],['Benefício',b.nome+(b.lei?' · '+b.lei:'')]];
      if(b.efeito)cs.push(['O que muda',b.efeito]);
      if((b.muda==='rendas'||b.muda==='obras')&&!fiscoExpSemRegras(r))cs.push(['Líquido para o imposto',fiscoPdfEuro(fiscoExpLiquidoImposto(l))+' · no quadro vai '+fiscoPdfEuro(l.liquido)+' (estimativa)',{cor:PDF_COR.secundario}]);
      if(b.aviso)cs.push(['Confirma',b.aviso,{bold:true,cor:PDF_COR.cobaltoTexto}]);
      fiscoPdfCartao(pdf,l.nome+(l.imovel?' · '+l.imovel:'')+' · quadro '+x.quadro+(r.variosTitulares?' · titular '+l.titular:''),cs);
    });
    fiscoPdfNota(pdf,'No '+x.quadro+' indicas o campo do '+Q41+' de cada linha'+(x.campos.length?' (campos '+x.campos[0]+' a '+x.campos[x.campos.length-1]+')':'')
      +'. A linha do '+Q41+' leva as rendas e os gastos por inteiro: é a AT que aplica o benefício pelo campo indicado aqui.');
  });
}
/* O quadro 7A do Anexo J (D133, Q12): um cartão por contrato e titular de um
   imóvel fora de Portugal, com o código do rendimento, o país e o código
   dele (tabela X), as rendas, os gastos do período arrendado, o líquido, o
   imposto pago lá e o que falta, sem imposto estimado; o total; e a nota de
   porque não vão ao Anexo F (fiscoExpAnexoJNota). O Anexo J é individual
   (N010): em conjunta, uma secção por titular («Anexo J do titular A»), com
   o total dele, e nenhum total dos dois. Sem nenhum, não escreve.
   Recebe: pdf — o escritor; r — o resumo (resumoFiscal).
   Devolve: nada — escreve a secção e desce. */
function fiscoPdfAnexoJ(pdf,r){
  const J=fiscoExpAnexoJ(r);if(!J)return;
  J.porTitular.forEach(g=>fiscoPdfAnexoJDe(pdf,r,J,g));
  fiscoPdfNota(pdf,fiscoExpAnexoJNota(r));
}
/* A secção do Anexo J de um titular (N010): o título («Anexo J do titular A
   · imóveis fora de Portugal» em conjunta, «Anexo J · …» fora dela), um
   cartão por contrato e o total desse titular, quando tem mais do que um.
   Recebe: pdf — o escritor; r — o resumo; J — o fiscoExpAnexoJ(r); g — o
   grupo do titular (J.porTitular).
   Devolve: nada — escreve a secção e desce. */
function fiscoPdfAnexoJDe(pdf,r,J,g){
  const E=fiscoPdfEuro,FALTA={bold:true,cor:PDF_COR.cobaltoTexto};
  fiscoPdfTitulo(pdf,g.titulo+' · imóveis fora de Portugal',fiscoN(fiscoNContratos(g.entradas),'contrato','contratos')+' · quadro '+J.quadro+' · não vão ao Anexo F',J.quadro);
  g.entradas.forEach(e=>{
    const cs=[],F=(c,x,o)=>cs.push([c,x,o]);
    F('Código do rendimento',e.codigo||'—');
    F('País',e.paisTexto,e.paisCodigo?undefined:FALTA);
    F('Rendas',E(e.rendas));
    F('Gastos (do período arrendado)',E(e.gastos));
    F('Rendimento líquido',E(e.liquido),{bold:true});
    F('Imposto pago no estrangeiro',E(e.impostoEstrangeiro));
    if(Number(e.retencoes)>0)F('Retenções em Portugal',E(e.retencoes));
    F('Titular',e.titular||'A');
    if(Number(e.quota)<1)F('Quota-parte',fiscoExpQuota(r,e).quota);
    F('Estimativa da app','sem imposto estimado: o crédito por dupla tributação (CIRS art. 81.º) depende do país e de englobares',{cor:PDF_COR.secundario});
    if(e.faltas.length){const f=e.faltas.join(', ');F('Falta',f.charAt(0).toUpperCase()+f.slice(1)+'.',FALTA)}
    fiscoPdfCartao(pdf,e.nome+(e.imovel?' · '+e.imovel:'')+(J.conjunta||r.variosTitulares?' · titular '+(e.titular||'A'):''),cs);
  });
  if(g.entradas.length>1)fiscoPdfCartao(pdf,'Total do '+g.titulo,[['Rendas',E(g.totais.rendas),{bold:true}],['Gastos',E(g.totais.gastos),{bold:true}],
    ['Rendimento líquido',E(g.totais.liquido),{bold:true}],['Imposto pago no estrangeiro',E(g.totais.impostoEstrangeiro),{bold:true}]],{fundo:PDF_COR.cobaltoSuave,corTitulo:PDF_COR.cobaltoTexto});
}
/* As rendas da categoria B (D134), fora do Anexo F: um cartão com o valor de
   cada contrato e o anexo para onde vão, o total, e a nota com as duas
   razões (FISCO_EXP_CATEGORIA_B_NOTA). Sem nenhuma, não escreve.
   Recebe: pdf — o escritor; r — o resumo (resumoFiscal).
   Devolve: nada — escreve a secção e desce. */
function fiscoPdfCategoriaB(pdf,r){
  const B=fiscoExpCategoriaB(r);if(!B)return;
  fiscoPdfTitulo(pdf,'Fora do Anexo F · categoria B',fiscoN(B.totais.n,'contrato','contratos')+' com as rendas na categoria B · Anexo B ou C');
  /* as rendas contadas à parte da caução e os gastos que saíram com elas (N141) */
  const cs=B.entradas.map(e=>[e.nome+(e.imovel?' · '+e.imovel:''),fiscoPdfEuro(e.rendas)+' · '+e.conta+(e.retencoes?' · retenções '+fiscoPdfEuro(e.retencoes):'')
    +(e.gastos>0?' · gastos '+fiscoPdfEuro(e.gastos)+' · rendas menos gastos '+fiscoPdfEuro(e.liquido):'')+' · Anexo B ou C']);
  if(B.entradas.length>1)cs.push(['Total',fiscoPdfEuro(B.totais.rendas)+(B.totais.gastos>0?' · gastos '+fiscoPdfEuro(B.totais.gastos):''),{bold:true}]);
  fiscoPdfCartao(pdf,'',cs);
  fiscoPdfNota(pdf,FISCO_EXP_CATEGORIA_B_NOTA+(B.totais.gastos>0?' '+FISCO_EXP_CATEGORIA_B_GASTOS:''));
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
   dos 24 meses por confirmar (D28) e o quadro 5 (D52). Da ronda 2 (vaga 4):
   nos totais, o líquido sobre que o imposto se estima quando o 6C ou o 6B o
   mudam (D119, D121), o que saiu do Anexo F (o Anexo J e a categoria B, D133,
   D134) e a regularização do quadro certo (o 10, o 4.3 de um DHD); a nota
   das rendas ilíquidas diz que são a renda do recibo (D112); o quadro 4.3
   depois do 4.2 (D120); os quadros 6A, 6B e 6C depois dos isentos; e o Anexo
   J e a categoria B depois do quadro 10. Num ano sem rendas nos quadros das
   linhas, mas com o quadro 10 ou a regularização do n.º 20, os totais dizem
   «sem rendas» e uma nota diz que o Anexo F desse ano os leva na mesma. Da
   2.ª auditoria: o imposto estimado com a ressalva dos Açores (N120); sem abate, a
   nota dos prejuízos de anos que não estão na app (N124); a regularização
   diz que deixa de fora os anos em falta ou por confirmar (N031, N125); o
   quadro 8, facultativo, com as partes do quadro 5 (N082, N110); e, em
   conjunta, o Anexo J de cada titular nos totais (N010).
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
  const QL=listaE(fiscoExpQuadrosDasLinhas(r)),lt=sem?null:fiscoExpLiquidoTributavel(r),J=fiscoExpAnexoJ(r),B=fiscoExpCategoriaB(r);
  fiscoPdfTitulo(pdf,'Totais de '+r.ano,(r.linhas.length?fiscoN(fiscoNContratos(r.linhas),'contrato','contratos'):'sem rendas')+' nos quadros '+QL+(q5.length?' · '+fiscoN(fiscoNContratos(q5),'contrato','contratos')+' no quadro '+q5n:''));
  F('Rendas ilíquidas',E(T.rendas)+(recT.texto?' · '+recT.texto:''),{bold:true});
  F('Retenções na fonte',E(T.retencoes)+(q5T.retencoes?' · com '+E(q5T.retencoes)+' do quadro '+q5n:''),{bold:true});
  F('Gastos dedutíveis',E(g)+(T.obras24?' (com '+E(T.obras24)+' de obras dos 24 meses)':''),{bold:true});
  const isQ=fiscoExpIsentos(r);
  F('Rendimento líquido',E(T.liquido)+(T.isentos.n?' (sem os '+E(T.isentos.liquido)+' isentos do '+listaE(isQ.map(x=>x.quadro))+')':'')+(q5.length?' · quadros '+QL:''),{bold:true});
  /* o líquido sobre que o imposto se estima, quando os benefícios o mudam
     (o 6C, o 6B — D119, D121): o quadro leva os valores por inteiro */
  if(lt)F('Líquido para o imposto',E(lt.valor)+' · '+lt.porque+' (estimativa)',{bold:true});
  /* a sublocação vai à parte (D52): só a diferença, e o imposto dela já está no estimado */
  if(q5.length)F('Sublocação (quadro '+q5n+')','diferença '+E(q5T.liquido)+' · recebida '+E(q5T.rendaRecebida)+', paga ao senhorio '+E(q5T.rendaPaga),{bold:true});
  if(sem)F('Imposto estimado','por conhecer: a app não tem as regras de '+r.ano,{bold:true,cor:C.cobaltoTexto});
  else{
    /* com a ressalva dos Açores à vista (N120) */
    F('Imposto estimado',E(I.imposto)+' · sem englobamento · '+FISCO_EXP_ACORES,{bold:true});
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
  if(I.regularizacao&&!sem)F('Com a regularização '+fiscoExpRegularizacaoQuadros(r),E(I.comRegularizacao)+' · +'+E(I.regularizacao)+' (estimativa, sem os juros compensatórios'
    +(fiscoExpRegularizacaoIncompleta(r)?' e sem os anos em falta ou por confirmar: vê o quadro '+(Q.cessados||'10'):'')+')',{bold:true,cor:C.cobaltoTexto});
  if(T.retencoes&&!sem)F('Depois das retenções',aPagar>=0?'falta pagar '+E(aPagar):'a receber '+E(-aPagar));
  /* o que saiu do Anexo F (D133, D134): não entra nos números de cima; o
     Anexo J de cada titular, em conjunta (N010) */
  if(J)J.porTitular.forEach(gj=>F('Fora do Anexo F · '+gj.titulo+' (quadro '+J.quadro+')','rendas '+E(gj.totais.rendas)+' · líquido '+E(gj.totais.liquido)+' · imposto pago lá '+E(gj.totais.impostoEstrangeiro)+' · sem estimativa',{cor:C.secundario}));
  if(B)F('Fora do Anexo F · categoria B','rendas '+E(B.totais.rendas)+' · Anexo B ou C',{cor:C.secundario});
  cartao('',{fundo:C.cobaltoSuave});
  /* um ano sem rendas nos quadros das linhas que leva o quadro 10 ou a
     regularização: o Anexo F entrega-se na mesma, com eles */
  const semRendas=fiscoExpSemRendasTexto(r);
  if(semRendas)fiscoPdfNota(pdf,semRendas);
  if(rep&&!sem)fiscoPdfNota(pdf,fiscoExpReporteTexto(r));
  /* os prejuízos de anos que não estão na app, sem abate (N124) */
  const preFora=fiscoExpPrejuizosForaTexto(r);
  if(preFora)fiscoPdfNota(pdf,preFora);
  if(fiscoPrejuizos(r).length)fiscoPdfNota(pdf,'As rendas não chegaram para os gastos. '+FISCO_PREJUIZO_NOTA);
  /* a renda ilíquida é a do recibo (D112): a comissão da gestora não a baixa, vai aos gastos */
  fiscoPdfNota(pdf,'Rendas ilíquidas: '+FISCO_EXP_RENDA_DO_RECIBO+' (se a gestora te transferiu a renda sem a comissão, a renda é a inteira e a comissão vai aos gastos), com a caução (renda do ano em que a recebes) e os reembolsos que o inquilino te pagou, menos as rendas que devolveste. Os gastos de um imóvel com mais do que um contrato no ano repartem-se pelas linhas na proporção das rendas de cada uma (estimativa); o rateio por VPT ou por área fica para quem preenche.');

  fiscoPdfQuadro(pdf,r,Q.semReducao);
  fiscoPdfQuadro(pdf,r,Q.comReducao);
  if(Q.dhd)fiscoPdfQuadro(pdf,r,Q.dhd);
  fiscoPdfObrasPorConfirmar(pdf,r);
  fiscoPdfQuadro5(pdf,r);

  /* os isentos, um quadro por isenção: o 6D com o código do programa, o 6F e
     o 6H só com o campo do 4.1 (D18); e os benefícios 6A, 6B e 6C (D117,
     D119, D121) */
  isQ.forEach(x=>fiscoPdfIsentos(pdf,r,x.quadro,x.linhas,isQ.length>1));
  fiscoPdfBeneficios(pdf,r);

  /* o quadro 8, facultativo (N082): as linhas do 4.x e as do quadro 5 com
     rendas de anos anteriores (N110), e o texto do cartão da página */
  const ant=fiscoExpAnosAnteriores(r);
  if(ant.length){
    fiscoPdfTitulo(pdf,'Quadro '+(Q.anosAnteriores||'8')+' · rendas de anos anteriores','recebidas em '+r.ano+' · já estão nas rendas de cada linha · facultativo',Q.anosAnteriores||'8');
    /* uma linha por ano a que as rendas respeitam, com as retenções dele (D55) */
    ant.forEach(y=>y.anos.forEach(x=>{
      const l=y.linha,t=l.nome+(r.variosTitulares?' · titular '+(l.titular||'A'):'')+' · de '+x.ano;
      F(t,E(x.valor)+' · quadro '+y.quadro+(y.campo?', campo '+y.campo:''));
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
  /* fora do Anexo F: o Anexo J (D133) e a categoria B (D134) */
  fiscoPdfAnexoJ(pdf,r);
  fiscoPdfCategoriaB(pdf,r);

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
