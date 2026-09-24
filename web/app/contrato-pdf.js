/* ================= NÚMEROS POR EXTENSO ================= */
const EXT_U=['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','catorze','quinze','dezasseis','dezassete','dezoito','dezanove'];
const EXT_D=['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
const EXT_C=['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'];
// Escreve 1–999 por extenso ("cento e vinte e três"); devolve '' para zero, para o extenso() ligar os grupos sem restos.
// Recebe: n — um inteiro de 0 a 999.
// Devolve: o número por extenso (string); '' para zero.
function ext3(n){
  if(n===0)return '';
  if(n===100)return 'cem';
  const c=Math.floor(n/100),r=n%100;
  const parts=[];
  if(c)parts.push(EXT_C[c]);
  if(r){
    if(r<20)parts.push(EXT_U[r]);
    else{const d=Math.floor(r/10),u=r%10;parts.push(u?EXT_D[d]+' e '+EXT_U[u]:EXT_D[d])}
  }
  return parts.join(' e ');
}
/* Número inteiro por extenso até aos milhões, com as ligações certas do português:
   "mil e cem", "duzentos e trinta mil quatrocentos e doze". Ignora o sinal e a parte decimal.
   Recebe: n — o número a escrever (aceita string numérica).
   Devolve: o número por extenso (string); "zero" para zero. */
function extenso(n){
  n=Math.floor(Math.abs(Number(n)||0));
  if(n===0)return 'zero';
  const mi=Math.floor(n/1000000),mil=Math.floor((n%1000000)/1000),un=n%1000;
  const p=[];
  if(mi)p.push(mi===1?'um milhão':ext3(mi)+' milhões');
  if(mil)p.push(mil===1?'mil':ext3(mil)+' mil');
  if(un)p.push(ext3(un));
  if(p.length===1)return p[0];
  const liga=un&&(un<100||un%100===0)?' e ':' ';
  if(p.length===2)return p[0]+liga+p[1];
  return p[0]+' '+p[1]+liga+p[2];
}
// Valor em euros por extenso: "mil duzentos e trinta euros e cinquenta cêntimos". Arredonda ao cêntimo.
// Recebe: v — o valor em euros (número; aceita string numérica).
// Devolve: o valor por extenso, com euros e cêntimos (string).
function euroExtenso(v){
  const n=Math.round((Number(v)||0)*100),int=Math.floor(n/100),cent=n%100;
  let s=extenso(int)+(int===1?' euro':' euros');
  if(cent)s+=' e '+extenso(cent)+(cent===1?' cêntimo':' cêntimos');
  return s;
}
const MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
// "2026-03-05" -> "5 de março de 2026"; devolve o valor tal e qual se não vier em ISO.
// Recebe: iso — a data em "AAAA-MM-DD".
// Devolve: a data por extenso (string); '' sem valor.
function dataLonga(iso){
  if(!iso)return '';
  const p=String(iso).split('-');if(p.length<3)return iso;
  return `${Number(p[2])} de ${MESES[Number(p[1])-1]||''} de ${p[0]}`;
}
/* Duração entre duas datas por extenso: anos certos como "2 (dois) anos", o
   resto em meses arredondados, com o singular certo ("1 (um) mês"). Os dias
   contam-se em hora local (prazos.js:pzDias), como em toda a app. Sem as duas
   datas devolve vazio — era "prazo certo", e a cláusula dizia «pelo prazo
   certo de prazo certo»; o PDF já não se gera sem elas.
   Recebe: a — a data de início ("AAAA-MM-DD"); b — a data de fim ("AAAA-MM-DD").
   Devolve: a duração por extenso (string), p. ex. "2 (dois) anos" ou "6 (seis) meses"; '' sem datas. */
function prazoTexto(a,b){
  const iso=/^\d{4}-\d{2}-\d{2}$/;
  if(!iso.test(String(a||''))||!iso.test(String(b||'')))return '';
  const meses=Math.round(pzDias(b,a)/30.44);
  if(meses>=12&&meses%12===0){const y=meses/12;return `${y} (${extenso(y)}) ano${y>1?'s':''}`}
  return `${meses} (${extenso(meses)}) ${meses===1?'mês':'meses'}`;
}

/* ================= IDENTIFICAÇÃO DAS PARTES ================= */
/* "Casado(a)" -> "casado" ou "casada", conforme o género da ficha
   Recebe: t — o texto com as marcas "o(a)"/"(a)"; g — o género da ficha ('f' ou 'm'; outro valor deixa as marcas).
   Devolve: o texto em minúsculas com as marcas resolvidas (string). */
function generoTexto(t,g){
  let s=String(t||'').toLowerCase();
  if(g==='f')s=s.replace(/o\(a\)/g,'a').replace(/\(a\)/g,'a');
  else if(g==='m')s=s.replace(/o\(a\)/g,'o').replace(/\(a\)/g,'');
  return s;
}
/* Frase de identificação de uma pessoa para o contrato: nome em maiúsculas, estado
   civil ajustado ao género, nacionalidade, nascimento, Cartão de Cidadão, NIF e
   morada fiscal — só entram os campos preenchidos na ficha.
   Recebe: p — a ficha da pessoa (name, marital, gender, nationality, birth, cc, ccValid, nif, taxAddress).
   Devolve: a frase de identificação (string), com os campos separados por vírgulas. */
function pessoaTexto(p){
  const b=[];
  b.push((p.name||'').toUpperCase());
  if(p.marital)b.push(generoTexto(p.marital,p.gender));
  if(p.nationality)b.push('de nacionalidade '+p.nationality.toLowerCase());
  if(p.birth)b.push((p.gender==='f'?'nascida':'nascido')+' em '+dataLonga(p.birth));
  if(p.cc)b.push('titular do Cartão de Cidadão n.º '+fmtCC(p.cc)+(p.ccValid?', válido até '+dataLonga(p.ccValid):''));
  if(p.nif)b.push('NIF '+fmtNIF(p.nif));
  if(p.taxAddress)b.push('residente em '+p.taxAddress.replace(/\s*\n\s*/g,', '));
  return b.join(', ');
}
/* Várias pessoas numa frase do contrato: cada uma pela pessoaTexto, ligadas por «;
   e».
   Recebe: arr — as fichas das pessoas (array).
   Devolve: o texto. */
const listaPessoas=arr=>arr.map(pessoaTexto).filter(Boolean).join('; e ');

/* ================= GERAR O CONTRATO ================= */
/* morada completa a partir dos campos registais; se não houver, a morada curta da ficha
   Recebe: p — a ficha do imóvel (street, doorNumber, floor, fraction, postalCode, locality, address).
   Devolve: a morada numa linha (string); '' sem nada preenchido. */
function fullAddress(p){
  const a=[];
  const rua=[p.street,p.doorNumber].filter(Boolean).join(', ');if(rua)a.push(rua);
  const piso=[p.floor,p.fraction?'fração '+p.fraction:''].filter(Boolean).join(', ');if(piso)a.push(piso);
  const cp=[p.postalCode,p.locality].filter(Boolean).join(' ');if(cp)a.push(cp);
  return a.length?a.join(', '):(p.address||'');
}
/* Constrói o dicionário de marcadores {{...}} do modelo a partir do contrato, do
   imóvel e das fichas das partes: moradas, identificações, valores por extenso,
   datas longas e o local de assinatura. Um marcador vazio faz o modelo omitir a
   frase ou a cláusula que o usa — por isso nada aqui se inventa: sem dia de
   pagamento a frase do dia sai (era «até ao dia 8»), e o que se entrega na
   assinatura são as rendas antecipadas que o contrato pede (c.advance, o
   campo «Rendas antecipadas (meses)» do formulário) mais a caução.
   Recebe: c — o contrato (objeto da base local).
   Devolve: o dicionário marcador → valor (objeto; strings prontas a inserir, mais
   'contrato.diaPagamento' numérico — ou '' sem dia — e 'fotos' com a contagem de fotografias). */
function contractData(c){
  const p=prop(c.propertyId)||{};
  const owners=ownersOfProp(p).map(owner).filter(Boolean);
  const tenants=ctTenants(c);
  const adv=Math.max(0,Math.round(Number(c.advance)||0)),antecipado=adv*(Number(c.rent)||0),caucao=Number(c.deposit)||0;
  const total=antecipado+caucao,dia=c.payDayTo||c.payDay||'',iban=fmtIBAN(c.iban);
  const rep=owners[0]||{};
  const freg=p.freguesia||p.parish||'',conc=p.concelho||'';
  const fregTxt=freg&&conc?(freg===conc?`freguesia e concelho de ${freg}`:`freguesia de ${freg}, concelho de ${conc}`):(freg?(/freguesia|concelho/i.test(freg)?freg:'freguesia de '+freg):(conc?'concelho de '+conc:''));
  return {
    'imovel.nome':p.name||'',
    'imovel.morada':fullAddress(p),
    'imovel.freguesia':fregTxt,
    'imovel.registo':p.registry||'','imovel.matriz':p.matrix||'','imovel.licenca':p.licence||'',
    'imovel.certificado':p.energyCert||'','imovel.classe':p.energyClass||'','imovel.validadeCert':dataLonga(p.energyValid),
    'senhorios.identificacao':listaPessoas(owners),
    'inquilinos.identificacao':listaPessoas(tenants),
    'senhorios.representante':rep.name||'',
    'senhorios.morada':(rep.taxAddress||'').replace(/\s*\n\s*/g,', '),
    'contacto.email':c.ownerEmail||rep.email||'',
    'contacto.telefone':fmtPhone(c.ownerPhone||rep.phone||''),
    'contrato.renda':money(c.rent),'contrato.rendaLetras':euroExtenso(c.rent),
    'contrato.caucao':caucao?money(caucao):'','contrato.caucaoLetras':caucao?euroExtenso(caucao):'',
    'contrato.antecipado':antecipado?money(antecipado):'','contrato.antecipadoLetras':antecipado?euroExtenso(antecipado):'',
    'contrato.antecipadoMeses':antecipado?(adv===1?'à renda do primeiro mês':`às rendas dos primeiros ${adv} (${extenso(adv)}) meses`):'',
    'contrato.antecipadoApos':antecipado?(adv===1?'o mês abrangido':'os meses abrangidos'):'',
    'contrato.total':total?money(total):'','contrato.totalLetras':total?euroExtenso(total):'',
    'contrato.totalDetalhe':[antecipado?money(antecipado)+' de renda antecipada':'',caucao?money(caucao)+' de caução':''].filter(Boolean).join(' + '),
    'contrato.iban':iban,
    'contrato.diaPagamento':dia,
    /* a frase de como se paga só existe com o IBAN ou com o dia */
    'contrato.pagamento':iban||dia?'sim':'',
    'contrato.inicio':dataLonga(c.start),'contrato.fim':dataLonga(c.end),
    'contrato.prazo':prazoTexto(c.start,c.end),
    'data.hoje':dataLonga(today()),
    'local':p.locality||p.concelho||(p.address||'').split(',').pop().replace(/\d{4}-\d{3}/,'').trim()||'Portugal',
    fotos:(c.photoIds||[]).length
  };
}
// Substitui os marcadores {{chave}} pelos valores de d; os blocos {{#chave}}…{{/}} só sobrevivem se a chave tiver valor.
// Recebe: str — o texto do modelo, com {{chave}} e blocos {{#chave}}…{{/}}; d — o dicionário de valores (de contractData).
// Devolve: o texto preenchido (string); chaves sem valor saem vazias.
function fillTpl(str,d){
  /* blocos condicionais {{#chave}}…{{/}} */
  str=String(str).replace(/\{\{#([\w.]+)\}\}([\s\S]*?)\{\{\/\}\}/g,(m,k,inner)=>d[k]?inner:'');
  return str.replace(/\{\{([\w.]+)\}\}/g,(m,k)=>d[k]==null?'':String(d[k]));
}
const ROMANOS=['','PRIMEIRA','SEGUNDA','TERCEIRA','QUARTA','QUINTA','SEXTA','SÉTIMA','OITAVA','NONA','DÉCIMA',
  'DÉCIMA PRIMEIRA','DÉCIMA SEGUNDA','DÉCIMA TERCEIRA','DÉCIMA QUARTA','DÉCIMA QUINTA','DÉCIMA SEXTA',
  'DÉCIMA SÉTIMA','DÉCIMA OITAVA','DÉCIMA NONA','VIGÉSIMA'];

/* Gera e descarrega o PDF do contrato: valida (imóvel, pelo menos um inquilino e
   um senhorio, a morada do imóvel e as datas de início e de fim — é um contrato
   com prazo certo, e sem elas as cláusulas ficavam a meio), lê o modelo
   CONTRACT_XML, preenche os marcadores com contractData e percorre
   cláusulas, secções e anexos a escrever no PDF — incluindo as fotografias
   escolhidas, carregadas do IndexedDB e redimensionadas (daí ser assíncrona).
   No Android entrega o ficheiro ao seletor nativo em vez de descarregar.
   Recebe: cid — o id do contrato.
   Devolve: nada de útil (é assíncrona) — descarrega o PDF (ou entrega-o ao Android)
   e avisa com um toast quando falta alguma coisa. */
async function generateContractPdf(cid){
  const c=contract(cid);if(!c)return toast('Contrato não encontrado.');
  const p=prop(c.propertyId);
  if(!p)return toast('O contrato não tem imóvel.');
  if(!ctTenants(c).length)return toast('Adiciona pelo menos um inquilino antes de gerar o contrato.');
  if(!ownersOfProp(p).map(owner).filter(Boolean).length)return toast('Associa pelo menos um proprietário ao imóvel antes de gerar o contrato.');
  if(!fullAddress(p))return toast('Indica a morada do imóvel antes de gerar o contrato.');
  if(!c.start||!c.end)return toast('Indica o início e o fim do contrato antes de gerar o PDF.');
  let doc;
  try{doc=new DOMParser().parseFromString(CONTRACT_XML,'application/xml')}
  catch(e){return toast('Não foi possível ler o modelo do contrato.')}
  const d=contractData(c),pdf=PDF();
  /* fotografias do registo fotográfico: entram no PDF como imagens JPEG */
  const imgs={},metas=(p.photos||[]).filter(f=>(c.photoIds||[]).indexOf(f.id)>-1);
  if(metas.length){
    toast('A preparar '+metas.length+' fotografia'+(metas.length===1?'':'s')+'…');
    for(const f of metas){const j=await photoJpeg(f,1200);if(j)imgs[f.id]={n:pdf.image(j.bin,j.w,j.h),w:j.w,h:j.h}}
  }
  const ok=k=>{const v=d[k];return !(v===''||v==null||v===0)};
  const skip=el=>{const o=el.getAttribute('opcional');return o&&!ok(o)&&o!=='fotos'?true:(o==='fotos'&&!d.fotos)};
  const T=el=>fillTpl((el.textContent||'').replace(/\s+/g,' ').trim(),d);
  let nCl=0;

  const root=doc.documentElement;
  [].slice.call(root.childNodes).forEach(el=>{
    if(el.nodeType!==1)return;
    const tag=el.tagName;
    if(skip(el))return;
    if(tag==='titulo'){pdf.text(T(el),{size:14,bold:true,center:true,after:4});return}
    if(tag==='subtitulo'){pdf.text(T(el),{size:10,center:true,after:10});pdf.rule({after:12});return}
    if(tag==='secao'||tag==='anexo'){
      if(tag==='anexo')pdf.newPage();
      pdf.gap(4);pdf.text(el.getAttribute('titulo'),{size:11.5,bold:true,after:6});
      [].slice.call(el.childNodes).forEach(ch=>{
        if(ch.nodeType!==1||skip(ch))return;
        if(ch.tagName==='p')pdf.text(T(ch),{after:5});
        else if(ch.tagName==='lista')[].slice.call(ch.getElementsByTagName('item')).forEach(it=>pdf.text('• '+T(it),{indent:10,after:2}));
        else if(ch.tagName==='tabela')tabela(pdf,ch,c,p,d,imgs);
        else if(ch.tagName==='assinaturas')assinaturas(pdf,ch.getAttribute('parte'),c,p);
      });
      pdf.gap(6);return;
    }
    if(tag==='clausula'){
      nCl++;
      pdf.gap(5);
      pdf.text(`CLÁUSULA ${ROMANOS[nCl]||nCl+'.ª'} — ${el.getAttribute('titulo')}`,{size:10.5,bold:true,after:5});
      let i=0;
      [].slice.call(el.getElementsByTagName('n')).forEach(nEl=>{
        if(skip(nEl))return;
        i++;pdf.text(i+'. '+T(nEl),{indent:12,after:4});
      });
      return;
    }
    if(tag==='destaque'){pdf.gap(4);pdf.text(T(el),{bold:true,after:6});pdf.rule({after:10});return}
  });
  const name=('contrato-'+(p.name||'imovel')+'-'+today()).replace(/[^\w\-]+/g,'-').toLowerCase()+'.pdf';
  const bytes=pdf.build();
  if(window.Android&&window.Android.saveAs)window.Android.saveAs(name,'application/pdf',b64Latin1(bytes));
  else downloadBytes(name,'application/pdf',bytes);
  toast('Contrato gerado.');
}
/* Desenha um elemento <tabela> do modelo: inventário e chaves saem como tabela de
   texto; a fonte "fotos" sai como sequência de fotografias com legenda. Sem dados
   escreve uma nota entre parênteses em vez de deixar o anexo vazio.
   Recebe: pdf — o documento em construção (de PDF()); el — o elemento <tabela> do modelo;
   c — o contrato; p — o imóvel; d — o dicionário de contractData; imgs — as imagens
   já embutidas no PDF, por id de fotografia ({id: {n, w, h}}).
   Devolve: nada — escreve a tabela (ou as fotografias) no PDF. */
function tabela(pdf,el,c,p,d,imgs){
  const cols=(el.getAttribute('colunas')||'').split('|');
  const fonte=el.getAttribute('fonte');
  const full=pdf.W-pdf.ML-pdf.MR;
  let rows=[],widths=[];
  if(fonte==='inventario'){
    widths=[34,full-34-46-80,46,80];
    rows=(c.inventory||[]).map((it,i)=>[i+1,it.name||'—',it.qty,it.state==='novo'?'Novo':'Usado']);
  }else if(fonte==='chaves'){
    widths=[full-90,90];
    rows=(c.keys||[]).map(k=>[k.name||'—',k.qty]);
  }else if(fonte==='fotos'){
    const metas=(p.photos||[]).filter(f=>(c.photoIds||[]).indexOf(f.id)>-1);
    if(!metas.length){pdf.text('(sem fotografias selecionadas)',{size:9.5,after:4});return}
    metas.forEach((f,i)=>{
      const im=(imgs||{})[f.id],cap=`${i+1}. ${f.name||'Fotografia '+(i+1)}`;
      if(im)pdf.photo(im.n,im.w,im.h,cap,300);
      else pdf.text(cap+' (imagem não disponível neste dispositivo)',{size:9.5,after:6});
    });
    pdf.gap(4);return;
  }
  if(!rows.length){pdf.text('(sem elementos registados)',{size:9.5,after:4});return}
  pdf.line(cols,widths,{bold:true,rule:true,size:9.5});
  rows.forEach(r=>pdf.line(r,widths,{size:9.5,right:fonte==='chaves'?[1]:(fonte==='inventario'?[2]:[])}));
  pdf.gap(6);
}
// Blocos de assinatura de uma das partes: linha, nome e papel ajustado ao género (Senhoria/Senhorio, Inquilina/Inquilino), sem quebrar a meio da página.
// Recebe: pdf — o documento em construção; parte — 'senhorios' ou 'inquilinos'; c — o contrato; p — o imóvel.
// Devolve: nada — escreve os blocos de assinatura no PDF.
function assinaturas(pdf,parte,c,p){
  const gente=parte==='senhorios'?ownersOfProp(p).map(owner).filter(Boolean):ctTenants(c);
  if(!gente.length)return;
  pdf.gap(8);
  pdf.text(parte==='senhorios'?'OS SENHORIOS':'OS INQUILINOS',{size:10,bold:true,after:6});
  gente.forEach(g=>{
    pdf.need(46);
    pdf.gap(20);
    pdf.text('__________________________________',{after:1});
    pdf.text(g.name||'',{size:9.5,after:0});
    pdf.text(parte==='senhorios'?(g.gender==='f'?'Senhoria':'Senhorio'):(g.gender==='f'?'Inquilina':'Inquilino'),{size:8.5,after:6});
  });
}
/* o PDF é texto latin-1: converte byte a byte, sem passar por UTF-8
   Recebe: s — a string de bytes do PDF (um byte por carácter, 0–255).
   Devolve: a string em base64; '' se a conversão falhar. */
function b64Latin1(s){
  try{let out='';for(let i=0;i<s.length;i++)out+=String.fromCharCode(s.charCodeAt(i)&0xFF);return btoa(out)}
  catch(e){return ''}
}

/* ================= O MODELO DO CONTRATO =================
   O XML que o generateContractPdf percorre: cláusulas, secções e anexos, com
   os marcadores {{…}} que o contractData preenche. Um elemento com
   opcional="marcador" sai quando esse marcador vem vazio; um {{#marcador}}…{{/}}
   sai quando vem vazio — é assim que o PDF nunca fica com uma frase a meio. */
const CONTRACT_XML=`<?xml version="1.0" encoding="utf-8"?>
<!--
  Modelo de contrato de arrendamento urbano para habitação com prazo certo.
  Derivado do documento Word fornecido.

  Marcadores {{...}} são substituídos pelos dados da aplicação.
  Se um marcador não tiver valor, a frase que o contém é omitida (opcional="1")
  ou o parágrafo inteiro desaparece (quando todo o parágrafo é opcional).

  Marcadores disponíveis:
    imovel.nome, imovel.morada, imovel.freguesia
    imovel.registo, imovel.matriz, imovel.licenca
    imovel.certificado, imovel.classe, imovel.validadeCert
    senhorios.identificacao   inquilinos.identificacao
    senhorios.representante   senhorios.morada
    contacto.email            contacto.telefone
    contrato.renda            contrato.rendaLetras
    contrato.caucao           contrato.caucaoLetras
    contrato.antecipado       contrato.antecipadoLetras
    contrato.antecipadoMeses  contrato.antecipadoApos
    contrato.total            contrato.totalLetras    contrato.totalDetalhe
    contrato.iban             contrato.diaPagamento   contrato.pagamento
    contrato.inicio           contrato.fim            contrato.prazo
    data.hoje                 local
-->
<contrato tipo="arrendamento-habitacao-prazo-certo">

  <titulo>CONTRATO DE ARRENDAMENTO URBANO PARA HABITAÇÃO COM PRAZO CERTO</titulo>
  <subtitulo>{{imovel.nome}} · {{imovel.morada}}</subtitulo>

  <secao titulo="IDENTIFICAÇÃO DAS PARTES">
    <p>SENHORIOS — {{senhorios.identificacao}}, adiante designados conjuntamente por SENHORIOS.</p>
    <p>INQUILINOS — {{inquilinos.identificacao}}, adiante designados conjuntamente por INQUILINOS.</p>
    <p>É celebrado o presente contrato de arrendamento urbano para habitação com prazo certo, regido pelo Código Civil, pelo Novo Regime do Arrendamento Urbano (NRAU) e pelas cláusulas seguintes.</p>
  </secao>

  <clausula titulo="OBJETO">
    <n>Os SENHORIOS dão de arrendamento aos INQUILINOS, que aceitam, o imóvel destinado a habitação sito em {{imovel.morada}}{{#imovel.freguesia}}, {{imovel.freguesia}}{{/}}.</n>
    <n opcional="imovel.registo">O imóvel encontra-se descrito na Conservatória do Registo Predial sob o n.º {{imovel.registo}}{{#imovel.matriz}} e inscrito na matriz predial urbana sob o artigo {{imovel.matriz}}{{/}}.</n>
    <n opcional="imovel.licenca">A utilização para habitação encontra-se titulada por {{imovel.licenca}}.</n>
    <n opcional="imovel.certificado">O imóvel dispõe do Certificado Energético n.º {{imovel.certificado}}{{#imovel.validadeCert}}, válido até {{imovel.validadeCert}}{{/}}{{#imovel.classe}}, com classe energética {{imovel.classe}}{{/}}.</n>
    <n>O arrendamento inclui o imóvel, os bens e equipamentos identificados no Inventário e as chaves registadas no Auto de Entrega, anexos ao presente contrato.</n>
  </clausula>

  <clausula titulo="FINALIDADE E OCUPAÇÃO">
    <n>O imóvel destina-se exclusivamente à habitação permanente dos INQUILINOS.</n>
    <n>É proibida a utilização para alojamento local, hospedagem, atividade profissional aberta ao público ou outra finalidade distinta da habitação, salvo autorização prévia e escrita dos SENHORIOS e desde que legalmente admissível.</n>
    <n>Os INQUILINOS não poderão subarrendar, ceder, emprestar ou dar em comodato, total ou parcialmente, o imóvel, nem permitir a sua ocupação habitual por terceiros não identificados no contrato, sem autorização prévia e escrita dos SENHORIOS.</n>
  </clausula>

  <clausula titulo="PRAZO, RENOVAÇÃO E CESSAÇÃO">
    <n>O contrato é celebrado pelo prazo certo de {{contrato.prazo}}, com início em {{contrato.inicio}} e termo em {{contrato.fim}}.</n>
    <n>No termo do prazo inicial, o contrato renova-se automaticamente pelo período legalmente aplicável. À data da celebração deste contrato, tratando-se de prazo inicial inferior a três anos, a renovação automática opera por períodos de três anos, sem prejuízo de alteração legislativa imperativa que venha a ser aplicável.</n>
    <n>Os SENHORIOS podem opor-se à renovação mediante comunicação aos INQUILINOS com a antecedência legalmente exigida. Num contrato com prazo inicial de um ano, a antecedência é, à data da celebração, de 120 dias; a oposição à primeira renovação pelo senhorio apenas produz efeitos após decorridos três anos da celebração, salvo as exceções previstas na lei.</n>
    <n>Os INQUILINOS podem opor-se à renovação do contrato de um ano mediante comunicação aos SENHORIOS com a antecedência legalmente exigida, que à data da celebração é de 90 dias.</n>
    <n>Decorrido um terço do prazo de duração inicial ou da renovação, os INQUILINOS podem denunciar o contrato a todo o tempo, mediante o pré-aviso legal aplicável. Para prazo igual ou superior a um ano, o pré-aviso é, à data da celebração, de 120 dias.</n>
    <n>A simples saída ou desocupação do imóvel não faz cessar o contrato nem extingue a obrigação de pagamento de renda. As rendas mantêm-se devidas até à data em que a cessação produza legalmente efeitos. A falta do pré-aviso devido obriga ao pagamento das rendas correspondentes ao período de pré-aviso em falta, sem prejuízo das exceções legalmente previstas.</n>
  </clausula>

  <clausula titulo="RENDA, PAGAMENTO E ATUALIZAÇÃO">
    <n>A renda mensal é de {{contrato.renda}} ({{contrato.rendaLetras}}).</n>
    <n opcional="contrato.pagamento">A renda é paga{{#contrato.iban}} por transferência bancária para o IBAN {{contrato.iban}}{{/}}{{#contrato.diaPagamento}}, devendo o montante estar disponível na conta dos SENHORIOS até ao dia {{contrato.diaPagamento}} do mês a que respeita{{/}}.</n>
    <n opcional="contrato.antecipado">Na assinatura, os INQUILINOS pagam antecipadamente {{contrato.antecipado}} ({{contrato.antecipadoLetras}}), correspondentes {{contrato.antecipadoMeses}} do arrendamento.</n>
    <n opcional="contrato.antecipado">Após {{contrato.antecipadoApos}} pelo pagamento antecipado, o pagamento mensal da renda retoma-se nos termos desta cláusula.</n>
    <n>O comprovativo bancário constitui prova do pagamento, sem prejuízo da emissão do respetivo recibo de renda pelos SENHORIOS.</n>
    <n>A renda pode ser atualizada anualmente nos termos legais. A primeira atualização só pode ser exigida decorrido um ano de vigência e será comunicada por escrito com a antecedência legalmente exigida.</n>
  </clausula>

  <clausula titulo="CAUÇÃO" opcional="contrato.caucao">
    <n>Na assinatura, os INQUILINOS entregam aos SENHORIOS {{contrato.caucao}} ({{contrato.caucaoLetras}}), a título de caução destinada a garantir o cumprimento das obrigações emergentes do contrato.</n>
    <n>A caução pode ser aplicada a rendas, consumos ou encargos em dívida, indemnizações, despesas de limpeza, substituição de chaves ou fechaduras e reparação de danos imputáveis aos INQUILINOS, sem prejuízo do direito dos SENHORIOS a exigir o remanescente quando a caução seja insuficiente.</n>
    <n>A caução não substitui o pagamento das últimas rendas, salvo acordo escrito e expresso dos SENHORIOS.</n>
    <n>Após a restituição do imóvel e das chaves, os SENHORIOS verificarão o estado do imóvel e as obrigações pendentes. O saldo da caução será devolvido depois dessa verificação, deduzidas apenas as quantias identificadas e justificadas.</n>
    <n>Se existirem faturas de consumos ainda não emitidas, orçamentos pendentes ou danos cujo custo não possa ser apurado de imediato, os SENHORIOS podem reter provisoriamente a quantia razoavelmente necessária, comunicando por escrito a respetiva fundamentação.</n>
  </clausula>

  <destaque opcional="contrato.total">VALOR TOTAL A ENTREGAR NA ASSINATURA: {{contrato.total}} — {{contrato.totalDetalhe}}</destaque>

  <clausula titulo="ENCARGOS E SERVIÇOS">
    <n>São da responsabilidade dos INQUILINOS os consumos e contratos de água, eletricidade, gás, telecomunicações e demais serviços utilizados no imóvel durante o arrendamento.</n>
    <n>Sempre que possível, os contratos de fornecimento serão colocados em nome dos INQUILINOS no prazo de 10 dias após a entrega das chaves.</n>
    <n>No final do arrendamento, os INQUILINOS apresentarão, quando solicitado, comprovativos de pagamento e de cessação ou transferência dos contratos de fornecimento.</n>
    <n>O IMI e os encargos relativos à propriedade e à administração, conservação e fruição das partes comuns são suportados pelos SENHORIOS, sem prejuízo dos encargos que a lei ou o presente contrato atribuam ao utilizador.</n>
  </clausula>

  <clausula titulo="ESTADO, INVENTÁRIO E ENTREGA INICIAL">
    <n>O imóvel é entregue em condições de habitabilidade e conservação, no estado descrito no Inventário, no Auto de Entrega e no registo fotográfico anexos, que fazem parte integrante do contrato.</n>
    <n>Os INQUILINOS dispõem de 10 dias após a entrega das chaves para comunicar por escrito anomalias preexistentes não registadas nos anexos, juntando fotografias sempre que possível.</n>
    <n>A ausência dessa comunicação não impede a invocação de defeitos ocultos, mas presume-se que os elementos visíveis foram recebidos no estado documentado no inventário e nas fotografias.</n>
    <n>No Auto de Entrega serão registadas as chaves entregues aos INQUILINOS.</n>
  </clausula>

  <clausula titulo="UTILIZAÇÃO, CONSERVAÇÃO E AVARIAS">
    <n>Os INQUILINOS obrigam-se a utilizar o imóvel e os equipamentos de forma prudente, diligente e de acordo com a respetiva finalidade.</n>
    <n>Os INQUILINOS comunicarão de imediato qualquer infiltração, fuga de água, avaria elétrica, risco estrutural ou outra situação suscetível de agravar danos, respondendo pelo prejuízo adicional causado por atraso injustificado nessa comunicação.</n>
    <n>São da responsabilidade dos INQUILINOS as pequenas reparações decorrentes do uso corrente e a reparação de danos causados por si, pelos visitantes e prestadores por si contratados ou animais autorizados.</n>
    <n>São da responsabilidade dos SENHORIOS as obras de conservação legalmente a seu cargo e as reparações de avarias não imputáveis aos INQUILINOS.</n>
  </clausula>

  <clausula titulo="OBRAS, FUROS, PINTURA E ALTERAÇÕES">
    <n>É expressamente proibido fazer furos nas paredes, azulejos, pedra, caixilharias ou quaisquer outros elementos do imóvel sem autorização prévia e escrita dos SENHORIOS.</n>
    <n>É igualmente proibido pintar, repintar, aplicar papel de parede ou alterar a cor, acabamento ou revestimento das paredes sem autorização prévia e escrita dos SENHORIOS.</n>
    <n>Os INQUILINOS não podem realizar obras, instalar equipamentos fixos, alterar fechaduras, redes técnicas, fachadas ou a disposição permanente do imóvel sem autorização prévia e escrita dos SENHORIOS.</n>
    <n>As benfeitorias autorizadas que não possam ser retiradas sem dano ficam integradas no imóvel, sem direito a indemnização ou retenção, salvo acordo escrito em contrário.</n>
    <n>Em situação urgente destinada a evitar dano iminente, os INQUILINOS deverão contactar os SENHORIOS e atuar apenas na medida estritamente necessária, conservando comprovativos e documentação da ocorrência.</n>
  </clausula>

  <clausula titulo="FUMO E ANIMAIS">
    <n>É proibido fumar no interior da habitação, incluindo cigarros eletrónicos, dispositivos de tabaco aquecido e produtos semelhantes.</n>
    <n>Os custos de limpeza, desodorização, pintura ou reparação decorrentes do incumprimento são suportados pelos INQUILINOS.</n>
    <n>A permanência de animais no imóvel depende de autorização prévia e escrita dos SENHORIOS, sem prejuízo das situações legalmente protegidas.</n>
    <n>Os INQUILINOS respondem pelos danos, ruídos, odores, falta de higiene ou prejuízos causados pelos animais.</n>
  </clausula>

  <clausula titulo="BOA VIZINHANÇA E SEGURANÇA">
    <n>Os INQUILINOS comprometem-se a respeitar as regras de boa vizinhança, o descanso dos moradores, as normas de segurança e, quando aplicável, o regulamento do condomínio.</n>
    <n>É proibido armazenar no imóvel substâncias perigosas ou inflamáveis em quantidade incompatível com o uso doméstico normal.</n>
    <n>Os INQUILINOS não podem alterar ou inutilizar detetores, ventilação ou equipamentos de segurança existentes.</n>
  </clausula>

  <clausula titulo="ACESSO, INSPEÇÕES E VISITAS">
    <n>Mediante marcação prévia, motivo legítimo e horário razoável, os INQUILINOS permitirão o acesso dos SENHORIOS ou de técnicos por estes indicados para verificar o estado do imóvel, executar obras ou realizar reparações necessárias.</n>
    <n>Em caso de emergência, risco para pessoas ou bens, fuga de água, incêndio ou situação semelhante, deverá ser facultado acesso tão rapidamente quanto razoavelmente possível.</n>
    <n>Nos três meses anteriores à cessação do contrato, os INQUILINOS permitirão visitas de potenciais arrendatários ou adquirentes, mediante marcação prévia e conciliação razoável de horários.</n>
    <n>As visitas e inspeções não podem ser utilizadas de forma abusiva nem perturbar injustificadamente a vida privada dos INQUILINOS.</n>
  </clausula>

  <clausula titulo="RESTITUIÇÃO DO IMÓVEL">
    <n>Na cessação do contrato, o imóvel será entregue livre de pessoas e bens, limpo, com todos os equipamentos e chaves, e em estado equivalente ao da entrega inicial, ressalvado o desgaste normal de uma utilização prudente.</n>
    <n>Caso o imóvel não seja entregue com nível de limpeza equivalente ao documentado no início, os SENHORIOS podem contratar a limpeza necessária e imputar o respetivo custo aos INQUILINOS.</n>
    <n>A entrega será formalizada, sempre que possível, por Auto de Restituição, com registo fotográfico, identificação de danos e entrega das chaves.</n>
    <n>A perda ou não devolução de chaves obriga ao pagamento da respetiva substituição e, quando razoavelmente necessário por razões de segurança, da substituição das fechaduras.</n>
    <n>A não restituição atempada do imóvel produz as consequências indemnizatórias previstas na lei.</n>
  </clausula>

  <clausula titulo="INCUMPRIMENTO E MORA">
    <n>A falta de pagamento pontual da renda ou de outros valores devidos constitui mora e confere aos SENHORIOS os direitos e indemnizações previstos na lei.</n>
    <n>O incumprimento grave ou reiterado das obrigações contratuais pode fundamentar a resolução do contrato nos termos legais.</n>
    <n>A aceitação de pagamentos posteriores não constitui, por si só, renúncia aos direitos relativos a incumprimentos anteriores.</n>
    <n>Os INQUILINOS suportarão os custos razoáveis e comprovados diretamente causados pelo seu incumprimento, dentro dos limites legalmente admissíveis.</n>
  </clausula>

  <clausula titulo="COMUNICAÇÕES, DOMICÍLIO E ALTERAÇÕES">
    <n>Para receção de comunicações dirigidas aos SENHORIOS, estes designam {{senhorios.representante}} como representante comum{{#senhorios.morada}}, no endereço {{senhorios.morada}}{{/}}{{#contacto.email}}, e no e-mail {{contacto.email}}{{/}}{{#contacto.telefone}}. Contacto telefónico: {{contacto.telefone}}{{/}}.</n>
    <n>Para efeitos de comunicações formais, os INQUILINOS indicam como domicílio o imóvel arrendado, salvo se comunicarem por escrito outro endereço.</n>
    <n>As comunicações legalmente exigíveis relativas à cessação do arrendamento, atualização da renda e obras serão efetuadas pela forma legalmente prevista, designadamente por escrito assinado e carta registada com aviso de receção quando essa seja a forma exigida pelo NRAU.</n>
    <n>As comunicações correntes podem ser efetuadas por correio eletrónico. Qualquer alteração ou aditamento ao presente contrato só será válido se reduzido a escrito e expressamente aceite por todas as partes, podendo a aceitação ser comprovada por correio registado ou por correio eletrónico com prova de envio e receção, sem prejuízo de formalidade legal imperativa.</n>
    <n>Cada parte comunicará por escrito qualquer alteração de morada ou endereço eletrónico. Até essa comunicação, serão utilizados os contactos constantes do contrato.</n>
  </clausula>

  <clausula titulo="DISPOSIÇÕES FINAIS">
    <n>A invalidade ou ineficácia de uma disposição não determina a invalidade das restantes, aplicando-se em sua substituição a solução legalmente admissível que mais se aproxime da finalidade pretendida.</n>
    <n>Em tudo o que esteja omisso aplicam-se o Código Civil, o NRAU e a demais legislação portuguesa em vigor.</n>
    <n>Os litígios serão submetidos aos tribunais e demais meios legalmente competentes, sem prejuízo de resolução por acordo entre as partes.</n>
    <n>Os SENHORIOS comunicarão o contrato e os factos legalmente relevantes à Autoridade Tributária e emitirão os recibos de renda nos termos aplicáveis.</n>
  </clausula>

  <secao titulo="ANEXOS">
    <lista>
      <item>Anexo I — Inventário e estado de conservação</item>
      <item>Anexo II — Registo fotográfico</item>
      <item>Anexo III — Auto de entrega de chaves</item>
    </lista>
  </secao>

  <secao titulo="ASSINATURA E FORMALIZAÇÃO">
    <p>Celebrado em {{local}}, no dia {{data.hoje}}, em exemplares destinados a cada uma das partes.</p>
    <assinaturas parte="senhorios"/>
    <assinaturas parte="inquilinos"/>
  </secao>

  <anexo titulo="ANEXO I — INVENTÁRIO E ESTADO DE CONSERVAÇÃO">
    <p>O inventário identifica os bens, equipamentos e principais elementos fixos entregues com o imóvel. O estado deverá ser confirmado na entrega e complementado pelo registo fotográfico anexo. A indicação “Novo” significa que o elemento é entregue sem uso anterior; “Usado” identifica um elemento já utilizado, prevalecendo sempre o estado efetivamente documentado na data da entrega.</p>
    <tabela fonte="inventario" colunas="N.º|Elemento / equipamento|Qt.|Estado"/>
  </anexo>

  <anexo titulo="ANEXO II — REGISTO FOTOGRÁFICO" opcional="fotos">
    <p>As fotografias seguintes integram o presente contrato e documentam o estado geral do imóvel na data da entrega.</p>
    <tabela fonte="fotos" colunas="N.º|Fotografia"/>
  </anexo>

  <anexo titulo="ANEXO III — AUTO DE ENTREGA DE CHAVES">
    <p>Na data de início do contrato, os INQUILINOS declaram receber as seguintes chaves:</p>
    <tabela fonte="chaves" colunas="Tipo|Quantidade"/>
    <p opcional="contrato.inicio">Entregue em {{contrato.inicio}}.</p>
    <assinaturas parte="senhorios"/>
    <assinaturas parte="inquilinos"/>
  </anexo>

</contrato>
`;

/* ================= GERADOR DE PDF =================
   Escritor de PDF mínimo, sem bibliotecas: fontes Helvetica padrão,
   codificação WinAnsi (cobre todos os acentos portugueses) e quebra de
   linha calculada com as larguras reais dos glifos.
   O HW é a tabela de larguras da Helvetica normal, construída uma vez pelo IIFE.
   Devolve: objeto {código do carácter → largura em milésimos de em}. */
const HW=(function(){
  const w={},a=(s,v)=>{for(const c of s)w[c.charCodeAt(0)]=v};
  a(' ',278);a('!',278);a('"',355);a('#',556);a('$',556);a('%',889);a('&',667);a("'",191);
  a('()',333);a('*',389);a('+',584);a(',',278);a('-',333);a('.',278);a('/',278);
  a('0123456789',556);a(':;',278);a('<=>',584);a('?',556);a('@',1015);
  a('A',667);a('B',667);a('C',722);a('D',722);a('E',667);a('F',611);a('G',778);a('H',722);
  a('I',278);a('J',500);a('K',667);a('L',556);a('M',833);a('N',722);a('O',778);a('P',667);
  a('Q',778);a('R',722);a('S',667);a('T',611);a('U',722);a('V',667);a('W',944);a('X',667);
  a('Y',667);a('Z',611);a('[]',278);a('\\',278);a('^',469);a('_',556);a('`',333);
  a('a',556);a('b',556);a('c',500);a('d',556);a('e',556);a('f',278);a('g',556);a('h',556);
  a('i',222);a('j',222);a('k',500);a('l',222);a('m',833);a('n',556);a('o',556);a('p',556);
  a('q',556);a('r',333);a('s',500);a('t',278);a('u',556);a('v',500);a('w',722);a('x',500);
  a('y',500);a('z',500);a('{',334);a('|',260);a('}',334);a('~',584);
  return w;
})();
// Larguras dos glifos da Helvetica-Bold — o par negrito da tabela HW acima.
// Devolve: objeto {código do carácter → largura em milésimos de em}, construído uma vez pelo IIFE.
const HWB=(function(){
  const w={},a=(s,v)=>{for(const c of s)w[c.charCodeAt(0)]=v};
  a(' ',278);a('!',333);a('"',474);a('#',556);a('$',556);a('%',889);a('&',722);a("'",238);
  a('()',333);a('*',389);a('+',584);a(',',278);a('-',333);a('.',278);a('/',278);
  a('0123456789',556);a(':;',333);a('<=>',584);a('?',611);a('@',975);
  a('A',722);a('B',722);a('C',722);a('D',722);a('E',667);a('F',611);a('G',778);a('H',722);
  a('I',278);a('J',556);a('K',722);a('L',611);a('M',833);a('N',722);a('O',778);a('P',667);
  a('Q',778);a('R',722);a('S',667);a('T',611);a('U',722);a('V',667);a('W',944);a('X',667);
  a('Y',667);a('Z',611);a('[]',333);a('\\',278);a('^',584);a('_',556);a('`',333);
  a('a',556);a('b',611);a('c',556);a('d',611);a('e',556);a('f',333);a('g',611);a('h',611);
  a('i',278);a('j',278);a('k',556);a('l',278);a('m',889);a('n',611);a('o',611);a('p',611);
  a('q',611);a('r',389);a('s',556);a('t',333);a('u',611);a('v',556);a('w',778);a('x',556);
  a('y',556);a('z',500);a('{',389);a('|',280);a('}',389);a('~',584);
  return w;
})();
/* acentuados: a largura é a da letra base */
const BASE={192:'A',193:'A',194:'A',195:'A',196:'A',197:'A',199:'C',200:'E',201:'E',202:'E',
  203:'E',204:'I',205:'I',206:'I',207:'I',209:'N',210:'O',211:'O',212:'O',213:'O',214:'O',
  217:'U',218:'U',219:'U',220:'U',221:'Y',224:'a',225:'a',226:'a',227:'a',228:'a',229:'a',
  231:'c',232:'e',233:'e',234:'e',235:'e',236:'i',237:'i',238:'i',239:'i',241:'n',242:'o',
  243:'o',244:'o',245:'o',246:'o',249:'u',250:'u',251:'u',252:'u',253:'y',186:'o',170:'a',
  8364:'E',8220:'"',8221:'"',8216:"'",8217:"'",8212:'-',8211:'-',183:'.',176:'o'};
// Largura de um carácter (milésimos de em) na fonte pedida; acentuados usam a letra base, desconhecidos levam uma largura média.
// Recebe: code — o código do carácter (charCodeAt); bold — true para a Helvetica-Bold.
// Devolve: a largura em milésimos de em (número).
function charW(code,bold){
  const w=bold?HWB:HW;
  if(w[code]!==undefined)return w[code];
  const b=BASE[code];
  if(b)return w[b.charCodeAt(0)]||500;
  return bold?611:556;
}
// Largura de uma linha de texto em pontos, para o tamanho e peso dados — é isto que decide as quebras de linha.
// Recebe: s — o texto; size — o tamanho da fonte em pontos; bold — true para negrito.
// Devolve: a largura do texto em pontos (número).
const textW=(s,size,bold)=>{let t=0;for(let i=0;i<s.length;i++)t+=charW(s.charCodeAt(i),bold);return t*size/1000};

/* WinAnsi: mapeia o que precisamos e substitui o resto */
const WIN={8364:128,8218:130,8222:132,8230:133,8224:134,8225:135,8216:145,8217:146,
  8220:147,8221:148,8226:149,8211:150,8212:151,732:152,8482:153,8250:155};
/* Prepara texto para uma string literal do PDF: converte os símbolos tipográficos
   via tabela WIN, reduz o resto do não-latin-1 à letra base (ou "?") e escapa
   parênteses e barra invertida.
   Recebe: s — o texto a escrever no PDF.
   Devolve: a string pronta para o literal do PDF (só latin-1, com escapes). */
function pdfEsc(s){
  let out='';
  for(let i=0;i<s.length;i++){
    let c=s.charCodeAt(i);
    if(WIN[c]!==undefined)c=WIN[c];
    else if(c>255){const b=BASE[c];c=b?b.charCodeAt(0):63}
    const ch=String.fromCharCode(c);
    out+=(ch==='('||ch===')'||ch==='\\')?'\\'+ch:ch;
  }
  return out;
}

/* Cria um documento A4 e devolve o escritor: text() escreve parágrafos com quebra
   de linha calculada e mudança de página automática, line() faz linhas de tabela,
   photo() coloca um JPEG com legenda, rule()/gap() separam, e build() devolve o
   ficheiro completo como string latin-1 (um carácter = um byte).
   Devolve: o objeto escritor, com esses métodos (e image/draw/need/newPage/gap),
   já com a primeira página aberta. */
function PDF(){
  const P={pages:[],cur:null,y:0,W:595.28,H:841.89,ML:56,MR:56,MT:64,MB:64,images:[]};
  P.newPage=()=>{P.cur=[];P.pages.push(P.cur);P.y=P.H-P.MT};
  /* imagem JPEG (bytes numa string latin-1); devolve o número para desenhar */
  P.image=(bin,w,h)=>{P.images.push({bin,w,h});return P.images.length};
  P.draw=(n,x,y,w,h)=>{P.cur.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im${n} Do Q`)};
  /* desenha uma fotografia com legenda, ajustada à largura e a uma altura máxima */
  P.photo=(n,iw,ih,caption,maxH)=>{
    const full=P.W-P.ML-P.MR,k=Math.min(full/iw,(maxH||300)/ih),w=iw*k,h=ih*k;
    P.need(h+24);
    P.draw(n,P.ML,P.y-h,w,h);P.y-=h+4;
    P.text(caption,{size:9.5,after:10});
  };
  P.space=()=>P.y-P.MB;
  P.need=h=>{if(P.y-h<P.MB)P.newPage()};
  P.text=(s,o)=>{
    o=o||{};
    const size=o.size||10,bold=!!o.bold,lead=o.lead||size*1.42;
    const x0=P.ML+(o.indent||0),maxW=P.W-P.ML-P.MR-(o.indent||0)-(o.right||0);
    const words=String(s).split(/\s+/).filter(Boolean);
    const lines=[];let line='';
    words.forEach(w=>{
      const cand=line?line+' '+w:w;
      if(textW(cand,size,bold)>maxW&&line){lines.push(line);line=w}else line=cand;
    });
    if(line)lines.push(line);
    lines.forEach((ln,i)=>{
      P.need(lead);
      let x=x0;
      if(o.center)x=(P.W-textW(ln,size,bold))/2;
      P.cur.push(`BT /${bold?'F2':'F1'} ${size} Tf ${x.toFixed(2)} ${(P.y-size).toFixed(2)} Td (${pdfEsc(ln)}) Tj ET`);
      P.y-=lead;
    });
    if(o.after)P.y-=o.after;
  };
  P.rule=(o)=>{o=o||{};P.need(6);
    P.cur.push(`0.75 w 0.7 0.7 0.7 RG ${(P.ML+(o.indent||0)).toFixed(2)} ${P.y.toFixed(2)} m ${(P.W-P.MR).toFixed(2)} ${P.y.toFixed(2)} l S`);
    P.y-=(o.after===undefined?8:o.after);};
  P.gap=h=>{P.y-=h};
  P.line=(cols,widths,o)=>{                        /* linha de tabela */
    o=o||{};const size=o.size||9.5,lead=size*1.5;
    P.need(lead+2);
    let x=P.ML;
    cols.forEach((c,i)=>{
      const w=widths[i];
      let s=String(c==null?'':c);
      while(textW(s,size,o.bold)>w-6&&s.length>1)s=s.slice(0,-1);
      const tx=o.right&&o.right.indexOf(i)>-1?x+w-6-textW(s,size,o.bold):x+3;
      P.cur.push(`BT /${o.bold?'F2':'F1'} ${size} Tf ${tx.toFixed(2)} ${(P.y-size).toFixed(2)} Td (${pdfEsc(s)}) Tj ET`);
      x+=w;
    });
    P.y-=lead;
    if(o.rule)P.rule({after:3});
  };
  P.build=()=>{
    const objs=[];
    const push=s=>{objs.push(s);return objs.length};
    const kids=[];
    const fontA=push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const fontB=push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const imIds=P.images.map(im=>push(`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bin.length} >>\nstream\n${im.bin}\nendstream`));
    const xobj=imIds.length?` /XObject << ${imIds.map((id,i)=>`/Im${i+1} ${id} 0 R`).join(' ')} >>`:'';
    const pagesId=push('');                        /* reservado */
    P.pages.forEach(ops=>{
      const stream=ops.join('\n');
      const cid=push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      const pid=push(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${P.W.toFixed(2)} ${P.H.toFixed(2)}] `+
        `/Resources << /Font << /F1 ${fontA} 0 R /F2 ${fontB} 0 R >>${xobj} >> /Contents ${cid} 0 R >>`);
      kids.push(pid);
    });
    objs[pagesId-1]=`<< /Type /Pages /Count ${kids.length} /Kids [${kids.map(k=>k+' 0 R').join(' ')}] >>`;
    const catId=push(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    let out='%PDF-1.4\n';const offs=[];
    objs.forEach((o,i)=>{offs.push(out.length);out+=`${i+1} 0 obj\n${o}\nendobj\n`});
    const xref=out.length;
    out+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`;
    offs.forEach(o=>{out+=String(o).padStart(10,'0')+' 00000 n \n'});
    out+=`trailer\n<< /Size ${objs.length+1} /Root ${catId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return out;
  };
  P.newPage();
  return P;
}

/* fotografia guardada em IndexedDB -> JPEG redimensionado, em string de bytes (para o PDF)
   Recebe: meta — os metadados da fotografia (usa meta.id como chave no IndexedDB);
   maxPx (opcional) — lado máximo da imagem em píxeis (por omissão 1200).
   Devolve: Promise de {bin, w, h} — os bytes JPEG numa string latin-1 e as
   dimensões em píxeis — ou de null se a foto faltar ou a conversão falhar. */
function photoJpeg(meta,maxPx){
  return idbGet(meta.id).then(blob=>{
    if(!blob)return null;
    return new Promise(res=>{
      const url=URL.createObjectURL(blob),img=new Image();
      const done=v=>{try{URL.revokeObjectURL(url)}catch(e){}res(v)};
      img.onload=()=>{
        try{
          const k=Math.min(1,(maxPx||1200)/Math.max(1,img.naturalWidth,img.naturalHeight));
          const w=Math.max(1,Math.round(img.naturalWidth*k)),h=Math.max(1,Math.round(img.naturalHeight*k));
          const cv=document.createElement('canvas');cv.width=w;cv.height=h;
          const ctx=cv.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h);ctx.drawImage(img,0,0,w,h);
          const b64=cv.toDataURL('image/jpeg',0.82).split(',')[1];
          done({bin:atob(b64),w,h});
        }catch(e){done(null)}
      };
      img.onerror=()=>done(null);
      img.src=url;
    });
  }).catch(()=>null);
}
