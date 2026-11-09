/* ================= FISCO · PDF =================
   O PDF do Anexo F do ano e do titular que a Declaração mostra: os quadros
   4.1 e 4.2 contrato a contrato, cada um em bloco campo → valor pela ordem do
   impresso, com o total de cada quadro, o 4.2A, o 4.2B e o 4.2C, os isentos
   do 6D, as rendas de anos anteriores (quadro 8), o AIMI (quadro 9), as faltas
   de cada linha e o que há a tratar antes de entregar. Os números são os do
   resumoFiscal — os mesmos da página, do resumo partilhado e do CSV — e nada
   se inventa: o que não está nos dados diz «—», ou «falta» quando a AT o pede.

   O escritor é o do contrato (contrato-pdf.js:PDF, com as cores PDF_COR do
   tema claro: cobalto nos títulos, tinta no texto, secundário nas notas), que
   vive no serviço Contratos. A Declaração usa-o mas não o exige: sem ele o
   botão não aparece, e o fiscoPdf diz porquê. O PDF escreve latin-1
   (WinAnsi): o espaço fino dos milhares e o sinal de menos da app passam a
   um espaço e a um hífen (fiscoPdfTxt), em vez de saírem como «?». */

/* Descarrega o PDF do Anexo F do ano e do titular da página: o ano do
   fiscoAnoAtual e o titular como no fiscoTexto (um grupo de proprietários
   não se aplica — os valores vão por inteiro). No Android entrega o ficheiro
   ao seletor nativo, como o contrato em PDF. Sem o escritor (o serviço
   Contratos desligado nesta conta) ou sem linhas nos quadros, não descarrega
   e diz porquê num aviso.
   Devolve: nada — descarrega o PDF, ou avisa porque não o fez. */
function fiscoPdf(){
  if(typeof PDF!=='function'||typeof PDF_COR==='undefined'){
    toast(servicoLigado('contracts')?'Não foi possível preparar o PDF. Recarrega a página e tenta outra vez.'
      :'O PDF faz-se com o serviço Contratos. '+fraseServicoDesligado('contracts'));
    return;
  }
  const ano=fiscoAnoAtual(),r=resumoFiscal(ano,ownerIsGrp()?'':ownerFilter);
  if(!r.linhas.length){toast('Sem contratos nos quadros 4.1 e 4.2 em '+ano+': não há PDF para exportar.');return}
  const nomeTit=r.titularId?ownerFilterName():'',hoje=today();
  const bytes=fiscoPdfDocumento(r,nomeTit,hoje),name=fiscoPdfNome(ano,nomeTit,hoje);
  if(window.Android&&window.Android.saveAs)window.Android.saveAs(name,'application/pdf',b64Latin1(bytes));
  else downloadBytes(name,'application/pdf',bytes);
  toast('PDF exportado.');
}
/* O nome do ficheiro: «anexo-f-AAAA-<titular>-<hoje>.pdf», o titular só
   quando há um escolhido, tudo em minúsculas sem acentos, só com letras,
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
/* Uma linha campo → valor: o campo à esquerda, no secundário, e o valor à
   direita, na tinta, cada um a partir na sua coluna. A linha não se parte
   entre páginas.
   Recebe: pdf — o escritor (PDF()); campo — o nome do campo; valor — o
   valor (vazio escreve «—»); o (opcional) — {bold, cor}.
   Devolve: nada — escreve a linha e desce. */
function fiscoPdfCampo(pdf,campo,valor,o){
  o=o||{};
  const size=9.5,lead=size*1.42,K=160,larg=pdf.W-pdf.ML-pdf.MR,bold=!!o.bold;
  const c=fiscoPdfTxt(campo),v=fiscoPdfTxt(valor==null||valor===''?'—':valor);
  const n=Math.max(1,pdf.linhas(c,size,false,K-12).length,pdf.linhas(v,size,bold,larg-K).length);
  pdf.need(n*lead);
  const y0=pdf.y;
  pdf.text(c,{size:size,lead:lead,right:larg-K+12,cor:PDF_COR.secundario});
  const y1=pdf.y;pdf.y=y0;
  pdf.text(v,{size:size,lead:lead,indent:K,bold:bold,cor:o.cor||PDF_COR.tinta});
  pdf.y=Math.min(pdf.y,y1)-2;
}
/* O título de uma secção (um quadro, os totais, o que há a tratar), em
   cobalto, com a linha de baixo no secundário. Não fica sozinho no fim de
   uma página.
   Recebe: pdf — o escritor; titulo — o título; sub (opcional) — a linha de baixo.
   Devolve: nada — escreve o título e desce. */
function fiscoPdfTitulo(pdf,titulo,sub){
  pdf.need(90);pdf.gap(10);
  pdf.text(fiscoPdfTxt(titulo),{size:12.5,bold:true,cor:PDF_COR.cobalto,after:sub?2:8});
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
   true no quadro 4.2.
   Devolve: nada — escreve o bloco e desce. */
function fiscoPdfLinha(pdf,r,l,red){
  const v=r.versao,nat=v.naturezas||{},F=(c,x,o)=>fiscoPdfCampo(pdf,c,x,o);
  const MOTIVO={nh:'não habitacional',duracao:'redução pela duração',moderada:'renda moderada',base:'taxa base'};
  pdf.need(120);pdf.gap(4);
  pdf.text(fiscoPdfTxt(l.nome+(l.imovel?' · '+l.imovel:'')),{size:10.5,bold:true,after:4});
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
  if(l.faltas.length){const f=l.faltas.join(', ');F('Falta',f.charAt(0).toUpperCase()+f.slice(1)+'.',{bold:true})}
  pdf.gap(2);pdf.rule({after:4});
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
  const v=r.versao,red=q===v.quadros.comReducao,s=f=>r2(sum(ls.map(f))),F=(c,x)=>fiscoPdfCampo(pdf,c,x,{bold:true});
  fiscoPdfTitulo(pdf,'Quadro '+q+' · '+(red?'habitação permanente com redução pela duração':'contratos sem redução pela duração'),
    fiscoN(ls.length,'contrato','contratos')+' com rendas em '+r.ano+' · '+(r.titularId?'na quota-parte do titular':'valores por inteiro'));
  ls.forEach(l=>fiscoPdfLinha(pdf,r,l,red));
  const ob=s(l=>l.obras24.valor);
  /* o total não se parte entre páginas: o título e as linhas dele vão juntos */
  pdf.need(24+(2+r.colunas.length+(ob?1:0))*16);pdf.gap(4);
  pdf.text(fiscoPdfTxt('Total do quadro '+q),{size:10.5,bold:true,cor:PDF_COR.cobaltoTexto,after:4});
  F('Rendas ilíquidas',fiscoPdfEuro(s(l=>l.rendas)));
  F('Retenções na fonte',fiscoPdfEuro(s(l=>l.retencoes)));
  r.colunas.forEach(k=>F(fiscoColRotulo(k),fiscoPdfEuro(s(l=>l.gastos[k]))));
  if(ob)F('Obras dos 24 meses',fiscoPdfEuro(ob));
  if(!red)return;
  if(v.prazos&&v.prazos.comunicacaoDuracao){pdf.gap(4);fiscoPdfNota(pdf,'No '+v.quadros.datas+', «Sim» na comunicação é a duração e as renovações comunicadas no Portal até '+dPT(v.prazos.comunicacaoDuracao)+' (Portaria 110/2019); sem ela arriscas a redução.')}
  const L23=(v.taxas&&v.taxas.limiteRendaAlta)||{desde:'2024-01-01'};
  const n23=ls.filter(l=>l.celebracao&&l.celebracao>=L23.desde);
  if(!n23.length)return;
  const por=n23.filter(l=>l.acimaDoLimite!==false);
  pdf.need(70);pdf.gap(6);
  pdf.text(fiscoPdfTxt('Quadro 4.2C · limite das rendas (n.º 23)'),{size:10.5,bold:true,cor:PDF_COR.cobaltoTexto,after:4});
  fiscoPdfCampo(pdf,'Celebrados desde '+dPT(L23.desde),listaE(n23.map(l=>l.nome)));
  fiscoPdfCampo(pdf,'Resposta',por.length?'falta confirmar na ficha do contrato: '+listaE(por.map(l=>l.nome)):'Sim (01)',{bold:true});
  fiscoPdfNota(pdf,'O 4.2C pergunta se nenhum destes contratos passa 150 % dos limites de renda por tipologia e concelho (Portaria 176/2019). Um que passe não tem redução e vai ao 4.1.');
}
/* O documento inteiro, a partir do resumo: o cabeçalho (IRS · Anexo F, o ano
   dos rendimentos e o prazo da entrega, o titular na quota-parte ou os
   valores por inteiro, a data), o aviso das regras quando o ano não tem
   versão própria ou ela é provisória, os totais do ano (os números à cabeça
   da página), os quadros 4.1 e 4.2, o 6D, o quadro 8, o quadro 9, o que há a
   tratar e a nota final.
   Recebe: r — o resumo (resumoFiscal); nomeTit — o nome do titular ('' por
   inteiro); hoje — a data 'AAAA-MM-DD'.
   Devolve: os bytes do PDF (string latin-1, um carácter por byte). */
function fiscoPdfDocumento(r,nomeTit,hoje){
  const pdf=PDF(),C=PDF_COR,v=r.versao,T=r.totais,Q=v.quadros,e=v.entrega||{};
  const F=(c,x,o)=>fiscoPdfCampo(pdf,c,x,o),E=fiscoPdfEuro;
  pdf.text('IRS · Anexo F',{size:18,bold:true,cor:C.cobalto,after:3});
  pdf.text(fiscoPdfTxt('Rendimentos de '+r.ano+(e.de&&e.ate?' · entrega de '+irsDiaMes(e.de)+' a '+irsDiaMes(e.ate)+' de '+e.ate.slice(0,4):'')),{size:10.5,after:2});
  pdf.text(fiscoPdfTxt(r.titularId?'Titular: '+(nomeTit||'—')+', na quota-parte':'Valores por inteiro, de todos os proprietários'),{size:10.5,after:2});
  pdf.text(fiscoPdfTxt('Feito a '+dPT(hoje)+', com o que a app tem registado.'),{size:9,cor:C.secundario,after:8});
  const regras=!v.exato?'Ainda não há versão das regras de '+r.ano+': usam-se as de '+v.ano+(v.pedido>v.ano?', com as datas passadas para '+r.ano+' — as taxas e os quadros podem ter mudado.':', a mais antiga que a app tem.')
    :v.modelo&&!v.modelo.oficial?'Regras de '+v.ano+' em versão provisória: o Anexo F deste ano ainda não foi aprovado.':'';
  if(regras)pdf.caixa(fiscoPdfTxt(regras),{size:9.5,cor:C.cobaltoTexto,fundo:C.cobaltoSuave,after:8});
  pdf.rule({after:4});

  const g=r2(sum(r.colunas.map(k=>T.gastos[k]))+T.obras24),aPagar=r2(T.imposto-T.retencoes);
  fiscoPdfTitulo(pdf,'Totais de '+r.ano,fiscoN(r.linhas.length,'contrato','contratos')+' nos quadros 4.1 e 4.2');
  F('Rendas ilíquidas',E(T.rendas),{bold:true});
  F('Retenções na fonte',E(T.retencoes),{bold:true});
  F('Gastos dedutíveis',E(g)+(T.obras24?' (com '+E(T.obras24)+' de obras dos 24 meses)':''),{bold:true});
  F('Rendimento líquido',E(T.liquido)+(T.isentos.n?' (sem os '+E(T.isentos.liquido)+' isentos do 6D)':''),{bold:true});
  F('Imposto estimado',E(T.imposto)+' · sem englobamento',{bold:true});
  if(T.retencoes)F('Depois das retenções',aPagar>=0?'falta pagar '+E(aPagar):'a receber '+E(-aPagar));
  if(T.prejuizo)fiscoPdfNota(pdf,'As rendas não chegaram para os gastos: o resultado negativo abate às rendas dos seis anos seguintes (CIRS art. 55.º).');
  fiscoPdfNota(pdf,'Rendas ilíquidas: o que entrou mais o que o inquilino reteve na fonte. Os gastos de um imóvel com mais do que um contrato no ano repartem-se pelas linhas na proporção das rendas de cada uma (estimativa); o rateio por VPT ou por área fica para quem preenche.');

  fiscoPdfQuadro(pdf,r,Q.semReducao);
  fiscoPdfQuadro(pdf,r,Q.comReducao);

  const is=r.linhas.filter(l=>l.isencao);
  if(is.length){
    fiscoPdfTitulo(pdf,'Quadro 6D · rendimentos isentos',fiscoN(is.length,'contrato isento','contratos isentos')+' · ficam também na linha do 4.1');
    is.forEach(l=>{
      pdf.need(60);pdf.text(fiscoPdfTxt(l.nome+(l.imovel?' · '+l.imovel:'')),{size:10.5,bold:true,after:4});
      F('N.º do contrato na AT',l.atNumero||'falta');
      F('Programa',l.isencao.nome||l.isencao.curto||'—');
      F('Código',l.isencao.codigo||'por conhecer');
      F('Rendas ilíquidas',E(l.rendas));
      pdf.gap(4);
    });
    F('Rendimento líquido isento',E(T.isentos.liquido),{bold:true});
    fiscoPdfNota(pdf,'No 6D indicas o campo do 4.1 onde ficaram, o n.º do contrato e o código do programa. Não pagam imposto e ficam fora do imposto estimado.');
  }

  const ant=r.linhas.filter(l=>l.anosAnteriores.length);
  if(ant.length){
    fiscoPdfTitulo(pdf,'Quadro '+Q.anosAnteriores+' · rendas de anos anteriores','recebidas em '+r.ano+' · já estão nas rendas de cada linha');
    ant.forEach(l=>l.anosAnteriores.forEach(a=>F(l.nome+' · de '+a.ano,E(a.valor)+' · linha do quadro '+l.quadro)));
    fiscoPdfNota(pdf,'No 8A se optares pelo englobamento (o valor reparte-se pelos anos a que respeita), ou no 8B se entregares declarações de substituição desses anos, até cinco para trás.');
  }

  const a=r.aimi;
  if(a){
    fiscoPdfTitulo(pdf,'Quadro '+(Q.aimi||'9')+' · AIMI','adicional ao IMI pago em '+r.ano+' · '+fiscoN(a.n,'pagamento','pagamentos'));
    a.predios.forEach(p=>F(p.imovel+' · VPT',p.vpt?E(p.vpt):'falta'));
    F('9101 · AIMI liquidado',E(a.total),{bold:true});
    F('9102 · VPT dos prédios urbanos',a.semVpt.length?'falta o VPT de '+listaE(a.semVpt):E(a.vptTotal),{bold:true});
    F('Parte que abate (estimativa)',a.abate==null?'—':E(a.abate),{bold:true});
    fiscoPdfNota(pdf,'O AIMI não é gasto das rendas: abate ao imposto na proporção do VPT dos prédios que deram rendas, e nunca mais do que o imposto delas. Os valores certos estão na demonstração de liquidação do AIMI.');
  }

  if(r.avisos.length){
    fiscoPdfTitulo(pdf,'A tratar antes de entregar',fiscoN(r.avisos.length,'ponto','pontos')+' de '+r.ano);
    r.avisos.forEach((x,i)=>pdf.text(fiscoPdfTxt((i+1)+'. '+x.texto),{size:9.5,indent:4,after:3,cor:x.nivel==='info'?C.secundario:C.tinta}));
  }

  pdf.gap(12);
  pdf.caixa(fiscoPdfTxt('A app resume; quem declara és tu, no Portal das Finanças. Confirma cada valor antes de entregar: o imposto aqui é uma estimativa.'),
    {size:9.5,cor:C.cobaltoTexto,fundo:C.cobaltoSuave});
  return pdf.build();
}
