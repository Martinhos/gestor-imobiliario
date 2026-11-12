/* ================= FISCO · PDF =================
   O PDF do Anexo F do ano e de quem declara, como a Declaração o mostra: os quadros
   4.1 e 4.2 contrato a contrato, cada um em bloco campo → valor pela ordem do
   impresso, com o total de cada quadro, o 4.2A, o 4.2B e o 4.2C, os isentos
   do 6D, as rendas de anos anteriores (quadro 8), o AIMI (quadro 9), as faltas
   de cada linha e o que há a tratar antes de entregar. Os números são os do
   resumoFiscal — os mesmos da página, do resumo partilhado e do CSV — e nada
   se inventa: o que não está nos dados diz «—», ou «falta» quando a AT o pede.

   O escritor é o do contrato (contrato-pdf.js:PDF, com as cores PDF_COR do
   tema claro e as letras da app, contrato-pdf.js:pdfLetras), que vive no
   serviço Contratos, e o aspeto é o dele: o título com o traço cobalto, cada
   quadro com o código numa pílula, cada contrato e cada total num cartão
   arredondado campo → valor, e o rodapé em todas as páginas. A Declaração usa-o mas não o exige: sem ele o
   botão não aparece, e o fiscoPdf diz porquê. O PDF escreve latin-1
   (WinAnsi): o espaço fino dos milhares e o sinal de menos da app passam a
   um espaço e a um hífen (fiscoPdfTxt), em vez de saírem como «?». */

/* Descarrega o PDF do Anexo F do ano e de quem declara, como a página: o
   ano do fiscoAnoAtual e o resumoFiscal de quem tem a sessão (com o titular
   B em conjunta), o mesmo do fiscoTexto e do CSV; o nome do ficheiro leva o
   meu nome, e nenhum quando os valores vão por inteiro. No Android entrega o ficheiro
   ao seletor nativo, como o contrato em PDF. Sem o escritor (o serviço
   Contratos desligado nesta conta) ou sem linhas nos quadros, não descarrega
   e diz porquê num aviso. Espera pelas letras da app (pdfLetras), que sem
   rede deixam o PDF na Helvetica.
   Devolve: Promise de nada — descarrega o PDF, ou avisa porque não o fez. */
async function fiscoPdf(){
  if(typeof PDF!=='function'||typeof PDF_COR==='undefined'){
    toast(servicoLigado('contracts')?'Não foi possível preparar o PDF. Recarrega a página e tenta outra vez.'
      :'O PDF faz-se com o serviço Contratos. '+fraseServicoDesligado('contracts'));
    return;
  }
  const ano=fiscoAnoAtual(),r=resumoFiscal(ano);
  if(!r.linhas.length){toast('Sem contratos nos quadros 4.1 e 4.2 em '+ano+': não há PDF para exportar.');return}
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
   as linhas [campo, valor, {bold, cor}] (valor vazio escreve «—»); o
   (opcional) — {fundo (o suave), corTitulo (a tinta), after, medir (true:
   só diz a altura, sem desenhar)}.
   Devolve: nada — escreve o cartão e desce; com medir, a altura (pontos). */
function fiscoPdfCartao(pdf,titulo,campos,o){
  o=o||{};
  const itens=campos.map(([c,v,x])=>({campo:fiscoPdfTxt(c),valor:fiscoPdfTxt(v==null||v===''?'—':v),forte:!!(x&&x.bold),cor:x&&x.cor,size:9.5}));
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
/* O bloco de um contrato num quadro, pela ordem do impresso: o n.º do
   contrato na AT, o início, a taxa e porquê, o imóvel (freguesia, tipo,
   artigo, fração), os inquilinos com NIF ou país, o titular, a natureza, as
   rendas ilíquidas, as retenções e cada coluna de gastos; as três colunas das
   obras dos 24 meses quando as há; no 4.2 o 4.2A e, com a descida do n.º 24,
   o 4.2B; e por fim a quota-parte, a estimativa da app (que não vai ao
   quadro) e o que falta.
   Recebe: pdf — o escritor; r — o resumo (resumoFiscal); l — a linha; red —
   true no quadro 4.2; medir (opcional) — true só diz a altura do cartão.
   Devolve: nada — escreve o cartão do contrato e desce; com medir, a altura. */
function fiscoPdfLinha(pdf,r,l,red,medir){
  const v=r.versao,nat=v.naturezas||{},campos=[],F=(c,x,o)=>campos.push([c,x,o]);
  const MOTIVO={nh:'não habitacional',duracao:'redução pela duração',moderada:'renda moderada',base:'taxa base'};
  F('N.º do contrato na AT',l.atNumero||(l.estado==='declarado'?'falta':'—'));
  F('Início do contrato',dPT(l.inicio)||'—');
  F('Taxa',l.isencao?'isento · quadro '+(l.isencao.quadro||'6D')+(l.isencao.codigo?' · código '+l.isencao.codigo:'')
    :dec(l.taxa)+' % · '+(l.taxaEscrita?'escrita no contrato':(MOTIVO[l.motivoTaxa]||'—')));
  F('Imóvel',l.imovel||'—');
  F('Freguesia (código)',l.freguesiaCodigo||'falta');
  F('Tipo de prédio',l.tipoPredio||'falta');
  F('Artigo matricial',l.artigo||'falta');
  F('Fração',l.fracao||'—');
  if(!l.inquilinos.length)F('Inquilino','falta');
  l.inquilinos.forEach((t,i)=>F(l.inquilinos.length>1?'Inquilino '+(i+1):'Inquilino',
    t.nome+' · '+(t.nif?'NIF '+fmtNIF(t.nif):t.pais?'sem NIF · país '+t.pais:'falta o NIF ou o país')));
  F('Titular',l.titular==='A/B'?'A/B (o imóvel é dos dois: uma linha por titular, cada uma com a sua quota-parte)':(l.titular||'A'));
  F('Natureza',l.natureza+(l.natureza===nat.habitacional?' · arrendamento habitacional':l.natureza===nat.naoHabitacional?' · arrendamento não habitacional':''));
  F('Rendas ilíquidas',fiscoPdfEuro(l.rendas));
  F('Retenções na fonte',fiscoPdfEuro(l.retencoes));
  r.colunas.forEach(k=>F(fiscoColRotulo(k),fiscoPdfEuro(l.gastos[k])));
  if(l.obras24.valor){
    const g=String(l.obras24.inicioGastos||'');
    F('Obras 24 meses · início',dPT(l.inicio)||'—');
    F('Obras 24 meses · 1.º gasto',/^\d{4}-\d{2}/.test(g)?g.slice(5,7)+'/'+g.slice(0,4):'—');
    F('Obras 24 meses · valor',fiscoPdfEuro(l.obras24.valor));
  }
  if(red){
    const D=v.quadros.datas;
    F(D+' · comunicação',l.comunicado==null?'—':l.comunicado?'Sim (comunicada a '+dPT(l.comunicado)+')':'Não (por comunicar)');
    F(D+' · início',dPT(l.datas.inicio)||'—');
    F(D+' · termo',dPT(l.datas.fim)||'—');
    F(D+' · última renovação',l.datas.renovacaoInicio?dPT(l.datas.renovacaoInicio)+' a '+(dPT(l.datas.renovacaoFim)||'—'):'—');
    if(l.bonus){
      const a=l.contratoAnterior;
      F('4.2B · renda deste contrato',fiscoPdfEuro(l.renda)+' por mês');
      F('4.2B · contrato anterior',a&&a.numero?'n.º '+a.numero:a?a.nome+' · falta o n.º na AT':'falta');
      F('4.2B · renda anterior',l.rendaAnterior?fiscoPdfEuro(l.rendaAnterior)+' por mês':'falta');
    }
  }
  if(l.quota<1)F('Quota-parte',dec(r2(l.quota*100))+' %');
  F('Estimativa da app','líquido '+fiscoPdfEuro(l.liquido)+' · imposto '+fiscoPdfEuro(l.imposto)+' (não vai ao quadro)',{cor:PDF_COR.secundario});
  if(l.faltas.length){const f=l.faltas.join(', ');F('Falta',f.charAt(0).toUpperCase()+f.slice(1)+'.',{bold:true,cor:PDF_COR.cobaltoTexto})}
  /* em conjunta, as duas linhas de um contrato dos dois cônjuges distinguem-se pela letra no título */
  return fiscoPdfCartao(pdf,l.nome+(l.imovel?' · '+l.imovel:'')+(r.variosTitulares?' · titular '+l.titular:''),campos,{medir:!!medir});
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
  const parte=fiscoParte(r,ls);
  fiscoPdfTitulo(pdf,'Quadro '+q+' · '+(red?'habitação permanente com redução pela duração':'contratos sem redução pela duração'),
    fiscoN(fiscoNContratos(ls),'contrato','contratos')+' com rendas em '+r.ano+(parte?' · '+parte:''),q,
    fiscoPdfLinha(pdf,r,ls[0],red,true));
  ls.forEach(l=>fiscoPdfLinha(pdf,r,l,red));
  const ob=s(l=>l.obras24.valor);
  /* o total num cartão cobalto suave, que não se parte entre páginas */
  F('Rendas ilíquidas',fiscoPdfEuro(s(l=>l.rendas)));
  F('Retenções na fonte',fiscoPdfEuro(s(l=>l.retencoes)));
  r.colunas.forEach(k=>F(fiscoColRotulo(k),fiscoPdfEuro(s(l=>l.gastos[k]))));
  if(ob)F('Obras dos 24 meses',fiscoPdfEuro(ob));
  fiscoPdfCartao(pdf,'Total do quadro '+q,tot,{fundo:PDF_COR.cobaltoSuave,corTitulo:PDF_COR.cobaltoTexto});
  if(!red)return;
  if(v.prazos&&v.prazos.comunicacaoDuracao){pdf.gap(4);fiscoPdfNota(pdf,'No '+v.quadros.datas+', «Sim» na comunicação é a duração e as renovações comunicadas no Portal até '+dPT(v.prazos.comunicacaoDuracao)+' (Portaria 110/2019); sem ela arriscas a redução.')}
  const L23=(v.taxas&&v.taxas.limiteRendaAlta)||{desde:'2024-01-01'};
  const n23=ls.filter(l=>l.celebracao&&l.celebracao>=L23.desde);
  if(!n23.length)return;
  const por=n23.filter(l=>l.acimaDoLimite!==false);
  pdf.gap(4);
  fiscoPdfCartao(pdf,'Quadro 4.2C · limite das rendas (n.º 23)',[['Celebrados desde '+dPT(L23.desde),listaE(n23.map(l=>l.nome))],
    ['Resposta',por.length?'falta confirmar na ficha do contrato: '+listaE(por.map(l=>l.nome)):'Sim (01)',{bold:true}]],{fundo:PDF_COR.cobaltoSuave,corTitulo:PDF_COR.cobaltoTexto});
  fiscoPdfNota(pdf,'O 4.2C pergunta se nenhum destes contratos passa 150 % dos limites de renda por tipologia e concelho (Portaria 176/2019). Um que passe não tem redução e vai ao 4.1.');
}
/* O documento inteiro, a partir do resumo: o cabeçalho (IRS · Anexo F, o ano
   dos rendimentos e o prazo da entrega, quem declara na quota-parte — com o
   titular B em conjunta, fisco.js:fiscoQuemDeclara — ou os valores por
   inteiro, a data), o aviso das regras quando o ano não tem
   versão própria ou ela é provisória, os totais do ano (os números à cabeça
   da página), os quadros 4.1 e 4.2, o 6D, o quadro 8, o quadro 9, o que há a
   tratar e a nota final.
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
  pdf.text(fiscoPdfTxt('Feito a '+dPT(hoje)+', com o que a app tem registado.'),{size:9,cor:C.secundario,after:8});
  const regras=!v.exato?'Ainda não há versão das regras de '+r.ano+': usam-se as de '+v.ano+(v.pedido>v.ano?', com as datas passadas para '+r.ano+' — as taxas e os quadros podem ter mudado.':', a mais antiga que a app tem.')
    :v.modelo&&!v.modelo.oficial?'Regras de '+v.ano+' em versão provisória: o Anexo F deste ano ainda não foi aprovado.':'';
  if(regras)pdf.caixa(fiscoPdfTxt(regras),{size:9.5,cor:C.cobaltoTexto,fundo:C.cobaltoSuave,after:8});

  const g=r2(sum(r.colunas.map(k=>T.gastos[k]))+T.obras24),aPagar=r2(T.imposto-T.retencoes);
  fiscoPdfTitulo(pdf,'Totais de '+r.ano,fiscoN(fiscoNContratos(r.linhas),'contrato','contratos')+' nos quadros 4.1 e 4.2');
  F('Rendas ilíquidas',E(T.rendas),{bold:true});
  F('Retenções na fonte',E(T.retencoes),{bold:true});
  F('Gastos dedutíveis',E(g)+(T.obras24?' (com '+E(T.obras24)+' de obras dos 24 meses)':''),{bold:true});
  F('Rendimento líquido',E(T.liquido)+(T.isentos.n?' (sem os '+E(T.isentos.liquido)+' isentos do 6D)':''),{bold:true});
  F('Imposto estimado',E(T.imposto)+' · sem englobamento',{bold:true});
  if(T.retencoes)F('Depois das retenções',aPagar>=0?'falta pagar '+E(aPagar):'a receber '+E(-aPagar));
  cartao('',{fundo:C.cobaltoSuave});
  if(T.prejuizo)fiscoPdfNota(pdf,'As rendas não chegaram para os gastos: o resultado negativo abate às rendas dos seis anos seguintes (CIRS art. 55.º).');
  fiscoPdfNota(pdf,'Rendas ilíquidas: o que entrou mais o que o inquilino reteve na fonte. Os gastos de um imóvel com mais do que um contrato no ano repartem-se pelas linhas na proporção das rendas de cada uma (estimativa); o rateio por VPT ou por área fica para quem preenche.');

  fiscoPdfQuadro(pdf,r,Q.semReducao);
  fiscoPdfQuadro(pdf,r,Q.comReducao);

  const is=r.linhas.filter(l=>l.isencao);
  if(is.length){
    fiscoPdfTitulo(pdf,'Quadro 6D · rendimentos isentos',fiscoN(fiscoNContratos(is),'contrato isento','contratos isentos')+' · ficam também na linha do 4.1','6D');
    is.forEach(l=>{
      F('N.º do contrato na AT',l.atNumero||'falta');
      F('Programa',l.isencao.nome||l.isencao.curto||'—');
      F('Código',l.isencao.codigo||'por conhecer');
      F('Rendas ilíquidas',E(l.rendas));
      cartao(l.nome+(l.imovel?' · '+l.imovel:'')+(r.variosTitulares?' · titular '+l.titular:''));
    });
    F('Rendimento líquido isento',E(T.isentos.liquido),{bold:true});
    cartao('',{fundo:C.cobaltoSuave});
    fiscoPdfNota(pdf,'No 6D indicas o campo do 4.1 onde ficaram, o n.º do contrato e o código do programa. Não pagam imposto e ficam fora do imposto estimado.');
  }

  const ant=r.linhas.filter(l=>l.anosAnteriores.length);
  if(ant.length){
    fiscoPdfTitulo(pdf,'Quadro '+Q.anosAnteriores+' · rendas de anos anteriores','recebidas em '+r.ano+' · já estão nas rendas de cada linha',Q.anosAnteriores);
    ant.forEach(l=>l.anosAnteriores.forEach(a=>F(l.nome+(r.variosTitulares?' · titular '+l.titular:'')+' · de '+a.ano,E(a.valor)+' · linha do quadro '+l.quadro)));
    cartao('');
    fiscoPdfNota(pdf,'No 8A se optares pelo englobamento (o valor reparte-se pelos anos a que respeita), ou no 8B se entregares declarações de substituição desses anos, até cinco para trás.');
  }

  const a=r.aimi;
  if(a){
    fiscoPdfTitulo(pdf,'Quadro '+(Q.aimi||'9')+' · AIMI','adicional ao IMI pago em '+r.ano+' · '+fiscoN(a.n,'pagamento','pagamentos'),Q.aimi||'9');
    a.predios.forEach(p=>F(p.imovel+' · VPT',p.vpt?E(p.vpt):'falta'));
    F('9101 · AIMI liquidado',E(a.total),{bold:true});
    F('9102 · VPT dos prédios urbanos',a.semVpt.length?'falta o VPT de '+listaE(a.semVpt):E(a.vptTotal),{bold:true});
    F('Parte que abate (estimativa)',a.abate==null?'—':E(a.abate),{bold:true});
    cartao('');
    fiscoPdfNota(pdf,'O AIMI não é gasto das rendas: abate ao imposto na proporção do VPT dos prédios que deram rendas, e nunca mais do que o imposto delas. Os valores certos estão na demonstração de liquidação do AIMI.');
  }

  if(r.avisos.length){
    fiscoPdfTitulo(pdf,'A tratar antes de entregar',fiscoN(r.avisos.length,'ponto','pontos')+' de '+r.ano);
    r.avisos.forEach((x,i)=>pdf.text(fiscoPdfTxt(x.texto),{size:9.5,marca:(i+1)+'.',recuo:16,after:3,cor:x.nivel==='info'?C.secundario:C.tinta}));
  }

  pdf.gap(12);
  pdf.caixa(fiscoPdfTxt('A app resume; quem declara és tu, no Portal das Finanças. Confirma cada valor antes de entregar: o imposto aqui é uma estimativa.'),
    {size:9.5,cor:C.cobaltoTexto,fundo:C.cobaltoSuave});
  return pdf.build();
}
