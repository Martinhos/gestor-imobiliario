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
   'contrato.diaPagamento' numérico — ou '' sem dia —, 'fotos' com a contagem das
   fotografias escolhidas que ainda existem no imóvel — uma apagada não conta,
   e sem nenhuma o Anexo II (o registo fotográfico) não existe —, 'semFotos'
   ('sim' sem nenhuma) e 'anexo.chaves', o número do Auto de entrega de chaves:
   'III' com o registo fotográfico, 'II' sem ele). */
function contractData(c){
  const p=prop(c.propertyId)||{};
  const fotos=(p.photos||[]).filter(f=>(c.photoIds||[]).indexOf(f.id)>-1).length;
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
    fotos:fotos,semFotos:fotos?'':'sim','anexo.chaves':fotos?'III':'II'
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
  /* as letras da app (pdfLetras); sem elas o PDF sai na Helvetica */
  await pdfLetras();
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
    if(tag==='titulo'){pdf.titulo(T(el));return}
    /* o imóvel num cartão: o nome a forte e a morada por baixo (o subtítulo
       do modelo é «nome · morada») */
    if(tag==='subtitulo'){
      const s=T(el),i=s.indexOf(' · '),nome=i>-1?s.slice(0,i).trim():'',morada=i>-1?s.slice(i+3).trim():s;
      pdf.cartao({rotulo:'Imóvel',itens:[nome?{texto:nome,forte:true}:null,morada?{texto:morada,cor:PDF_COR.secundario}:null].filter(Boolean),after:16});
      return;
    }
    if(tag==='secao'||tag==='anexo'){
      if(tag==='anexo')pdf.newPage();
      pdf.gap(6);pdf.need(13*1.3+10*1.42*3);
      pdf.text(fillTpl(el.getAttribute('titulo'),d),{size:13,titulo:true,lead:13*1.3,after:8});
      [].slice.call(el.childNodes).forEach(ch=>{
        if(ch.nodeType!==1||skip(ch))return;
        /* as partes («SENHORIOS — …», «INQUILINOS — …») em cartões, com a
           cabeça a cobalto; o texto é o do modelo, palavra por palavra */
        const parte=ch.tagName==='p'&&/^(SENHORIOS|INQUILINOS) —/.exec(T(ch));
        if(parte)pdf.cartao({itens:[{texto:T(ch),cabeca:parte[0]}],after:8});
        else if(ch.tagName==='p')pdf.text(T(ch),{after:5});
        else if(ch.tagName==='lista')[].slice.call(ch.getElementsByTagName('item')).filter(it=>!skip(it)).forEach(it=>pdf.text(T(it),{marca:'•',recuo:12,corMarca:PDF_COR.cobalto,after:3}));
        else if(ch.tagName==='tabela')tabela(pdf,ch,c,p,d,imgs);
        else if(ch.tagName==='assinaturas')assinaturas(pdf,ch.getAttribute('parte'),c,p);
      });
      pdf.gap(6);return;
    }
    if(tag==='clausula'){
      nCl++;
      pdf.gap(8);
      pdf.clausula(nCl,`CLÁUSULA ${ROMANOS[nCl]||nCl+'.ª'} — ${el.getAttribute('titulo')}`);
      let i=0;
      [].slice.call(el.getElementsByTagName('n')).forEach(nEl=>{
        if(skip(nEl))return;
        i++;pdf.text(T(nEl),{indent:pdf.RECUO,marca:i+'.',recuo:16,after:4});
      });
      return;
    }
    if(tag==='destaque'){pdf.gap(6);pdf.caixa(T(el),{bold:true,cor:PDF_COR.cobaltoTexto,fundo:PDF_COR.cobaltoSuave,after:12});return}
  });
  const name=ctPdfNome(p);
  const bytes=pdf.build();
  if(window.Android&&window.Android.saveAs)window.Android.saveAs(name,'application/pdf',b64Latin1(bytes));
  else downloadBytes(name,'application/pdf',bytes);
  toast('Contrato gerado.');
}
/* O nome do ficheiro do contrato: «contrato-<imóvel>-<hoje>.pdf», só com
   letras sem acento, algarismos e hífenes.
   Recebe: p — o imóvel do contrato.
   Devolve: o nome (texto). */
function ctPdfNome(p){
  return ('contrato-'+((p&&p.name)||'imovel')+'-'+today()).replace(/[^\w\-]+/g,'-').toLowerCase()+'.pdf';
}
/* O prazo de um contrato em palavras curtas, para a folha do PDF: «2 anos»,
   «6 meses». O PDF escreve-o por extenso (prazoTexto).
   Recebe: a — o início; b — o fim ('AAAA-MM-DD').
   Devolve: o texto; '' sem as duas datas. */
function ctPdfPrazoCurto(a,b){
  const t=prazoTexto(a,b);if(!t)return '';
  return t.replace(/\s*\([^)]*\)/,'');
}
/* O que o contrato em PDF leva e o que lhe falta, lido das fichas — a mesma
   regra do modelo: o que falta fica de fora, nunca a meio de uma frase. Os
   bloqueios são os do generateContractPdf (sem eles não se gera); o resto são
   linhas «vai» (as partes, o prazo e a renda, os anexos) e «falta» (o que o
   modelo omite: a licença, o registo, o certificado energético, a frase do
   pagamento, os dados de identificação de cada pessoa, o inventário e as
   chaves), cada uma com o caminho para completar a quem o pode fazer.
   Recebe: c — o contrato.
   Devolve: {falta: [{txt, act}], vai: [{txt, sub}], avisos: [{txt, sub, act}]} — act é a
   ação do «Completar» ('' sem caminho). */
function ctPdfVerificar(c){
  const pid=c.propertyId,p=prop(pid),ts=ctTenants(c),owners=p?ownersOfProp(p).map(owner).filter(Boolean):[];
  const editaCt=podeEditar(pid,'contract.add',c)?`ctModal('${jsq(c.id)}')`:'',editaImovel=p&&servicoLigado('properties')&&pode(pid,'house.edit')?`propModal('${jsq(pid)}')`:'';
  const falta=[],vai=[],avisos=[];
  if(!p)falta.push({txt:'O contrato não tem imóvel',act:editaCt});
  if(!ts.length)falta.push({txt:'Falta pelo menos um inquilino',act:editaCt});
  if(p&&!owners.length)falta.push({txt:'O imóvel não tem proprietários',act:editaImovel});
  if(p&&!fullAddress(p))falta.push({txt:'Falta a morada do imóvel',act:editaImovel});
  /* diz a data que falta, e não as duas: um contrato que começou e não tem
     fim mandava procurar no formulário um início que já lá está */
  if(!c.start||!c.end)falta.push({txt:!c.start&&!c.end?'Faltam as datas de início e de fim do contrato':!c.end?'Falta a data de fim do contrato':'Falta a data de início do contrato',act:editaCt});
  if(owners.length){
    const um=owners.length===1,o=owners[0];
    vai.push({txt:(um?(o.gender==='f'?'Senhoria: ':'Senhorio: '):'Senhorios: ')+listaE(owners.map(x=>x.name)),sub:um?'':o.name+' representa'});
  }
  if(ts.length&&p&&fullAddress(p)&&c.start&&c.end)
    vai.push({txt:(ts.length>1?'Inquilinos':'Inquilino')+', morada, prazo de '+ctPdfPrazoCurto(c.start,c.end)+' e renda',sub:''});
  const inv=c.inventory||[],ch=c.keys||[],fotos=((p&&p.photos)||[]).filter(f=>(c.photoIds||[]).indexOf(f.id)>-1);
  const anexos=[inv.length?'inventário ('+inv.length+')':'',fotos.length?'fotos ('+fotos.length+')':'',ch.length?'chaves ('+(ch.length===1?'1 tipo':ch.length+' tipos')+')':''].filter(Boolean);
  if(anexos.length)vai.push({txt:'Anexos: '+anexos.join(', '),sub:''});
  if(p){
    if(!p.licence)avisos.push({txt:'Sem licença de utilização',sub:'Essa frase fica de fora.',act:editaImovel});
    if(!p.registry)avisos.push({txt:'Sem o registo predial',sub:'Essa frase fica de fora.',act:editaImovel});
    if(!p.energyCert)avisos.push({txt:'Sem certificado energético',sub:'Essa frase fica de fora.',act:editaImovel});
  }
  if(!c.iban&&!c.payDay&&!c.payDayTo)avisos.push({txt:'Sem IBAN nem dia de pagamento',sub:'A frase de como se paga a renda fica de fora.',act:editaCt});
  /* O «Completar» de uma pessoa abre logo o formulário dela, como o do
     imóvel e o do contrato — e só a quem a pode alterar (pessoas.js:
     personEditavel, a mesma regra do «Editar» da ficha). O meu próprio perfil
     edita-se pela nuvem (CW.editProfile), que é quem o sabe guardar. */
  const pessoa=(x,kind)=>{
    const sem=[x.cc?'':'n.º do CC',x.nif?'':'NIF',x.taxAddress?'':'morada fiscal'].filter(Boolean);
    if(!sem.length)return;
    const serv=kind==='owner'?'owners':'tenants';
    const ed=servicoLigado(serv)&&personEditavel(kind,x);
    const euSou=kind==='owner'&&!!(window.CW&&CW.user&&CW.user.id===x.id&&CW.editProfile);
    avisos.push({txt:x.name+' sem '+listaE(sem),sub:'Vai só o que está preenchido.',act:!ed?'':euSou?'CW.editProfile()':`personModal('${kind}','${jsq(x.id)}')`});
  };
  owners.forEach(x=>pessoa(x,'owner'));
  ts.forEach(x=>pessoa(x,'tenant'));
  if(!inv.length)avisos.push({txt:'Sem inventário',sub:'O anexo I diz «sem elementos registados».',act:editaCt});
  if(!ch.length)avisos.push({txt:'Sem chaves registadas',sub:'O auto de entrega diz «sem elementos registados».',act:editaCt});
  return {falta:falta,vai:vai,avisos:avisos};
}
/* O corpo da folha «Contrato em PDF» (a prancheta M-ContratoPDF): de quem e
   de onde é, a miniatura do documento com o nome do ficheiro, o que falta
   para se poder gerar (a vermelho), o que vai e o que fica de fora (com o
   «Completar» a quem o pode fazer), o total a entregar na assinatura — as
   rendas antecipadas e a caução que o contrato pede — e o aviso de que é uma
   minuta genérica.
   Recebe: id — o id do contrato.
   Devolve: o HTML do corpo, ou '' se o contrato já não existir. */
function ctPdfFicha(id){
  const c=contract(id);if(!c)return '';
  const p=prop(c.propertyId),v=ctPdfVerificar(c);
  const completar=a=>a?`<button type="button" class="btn sm" data-toca="camada" data-click="${a}">Completar</button>`:'';
  const linha=(tipo,txt,sub,act)=>`<div class="ct-pdf-ck"><span class="ct-pdf-ic ct-pdf-${tipo}" aria-hidden="true">${ic(tipo==='ok'?'check':'aviso',14)}</span>
    <div class="ct-pdf-ck-txt"><p>${esc(txt)}</p>${sub?`<p class="small">${esc(sub)}</p>`:''}</div>${completar(act)}</div>`;
  const adv=Math.max(0,Math.round(Number(c.advance)||0)),antecipado=adv*(Number(c.rent)||0),caucao=Number(c.deposit)||0,total=antecipado+caucao;
  const detalhe=[antecipado?(adv===1?'1 renda antecipada ':adv+' rendas antecipadas ')+euro2(antecipado):'',caucao?'caução '+euro2(caucao):''].filter(Boolean).join(' + ');
  const quem=[ctNames(c),p?p.name:'',c.roomId&&p?roomName(p,c.roomId):''].filter(Boolean).join(' · ');
  return `<div class="ct-pdf">
    <p class="small ct-pdf-quem">${esc(quem)}</p>
    <div class="ct-pdf-topo">
      <div class="ct-pdf-mini" aria-hidden="true"><p>Contrato de arrendamento urbano para habitação com prazo certo</p>
        <span class="ct-pdf-ln ct-pdf-t"></span><span class="ct-pdf-ln"></span><span class="ct-pdf-ln"></span><span class="ct-pdf-ln ct-pdf-80"></span>
        <span class="ct-pdf-ln ct-pdf-t"></span><span class="ct-pdf-ln"></span><span class="ct-pdf-ln ct-pdf-90"></span>
        <span class="ct-pdf-ln ct-pdf-t ct-pdf-55"></span><span class="ct-pdf-ln"></span><span class="ct-pdf-ln ct-pdf-70"></span>
        <span class="ct-pdf-faixa"></span></div>
      <div class="ct-pdf-sobre"><p class="ct-pdf-modelo">Modelo único da app</p>
        <p class="small">Usa os dados das fichas. O que falta fica de fora, nunca a meio de uma frase.</p>
        <p class="small num ct-pdf-ficheiro">${esc(ctPdfNome(p))}</p></div>
    </div>
    ${v.falta.length?`<div class="card ct-pdf-lista ct-pdf-bloqueio"><p class="lbl">Antes de gerar</p>${v.falta.map(x=>`<div class="ct-pdf-ck"><span class="ct-pdf-ic ct-pdf-mau" aria-hidden="true">${ic('x',14)}</span><div class="ct-pdf-ck-txt"><p>${esc(x.txt)}</p></div>${completar(x.act)}</div>`).join('')}</div>`:''}
    <div class="card ct-pdf-lista"><p class="lbl">O que vai no contrato</p>
      ${v.vai.map(x=>linha('ok',x.txt,x.sub,'')).join('')}${v.avisos.map(x=>linha('wn',x.txt,x.sub,x.act)).join('')}
      ${v.vai.length||v.avisos.length?'':'<p class="small ct-pdf-nada">Completa o que falta para veres o que o contrato leva.</p>'}</div>
    ${total>0?`<div class="ct-pdf-total"><div><p>Total a entregar na assinatura</p><p class="small">${esc(detalhe)}</p></div><b class="disp num">${euro2(total)}</b></div>`:''}
    <p class="small">É uma minuta genérica: lê-a com atenção antes de assinar.</p>
  </div>`;
}
/* Abre a folha «Contrato em PDF»: diz o que vai e o que falta, e o
   «Descarregar PDF» do rodapé gera-o. É uma ficha (componentes.js:abrirFicha):
   completar um dado por cima dela (a ficha do imóvel, a de uma pessoa) e
   voltar deixa-a já com o que mudou.
   Recebe: id — o id do contrato.
   Devolve: nada — abre a janela (ou avisa, se o contrato já não existir). */
function ctPdfJanela(id){
  if(!contract(id))return toast('Contrato não encontrado.');
  abrirFicha({titulo:'Contrato em PDF',corpo:()=>ctPdfFicha(id),editar:{rotulo:'Descarregar PDF',act:`ctPdfDescarregar('${jsq(id)}')`}});
}
/* O «Descarregar PDF» da folha: com o que falta para gerar, diz o primeiro e
   fica; senão fecha a folha e gera o contrato (generateContractPdf).
   Recebe: id — o id do contrato.
   Devolve: nada. */
function ctPdfDescarregar(id){
  const c=contract(id);if(!c)return toast('Contrato não encontrado.');
  const f=ctPdfVerificar(c).falta;
  if(f.length)return toast(f[0].txt+'.');
  closeModal();
  generateContractPdf(id);
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
    if(!metas.length){pdf.text('(sem fotografias selecionadas)',{size:9.5,after:4,cor:PDF_COR.secundario});return}
    metas.forEach((f,i)=>{
      const im=(imgs||{})[f.id],cap=`${i+1}. ${f.name||'Fotografia '+(i+1)}`;
      if(im)pdf.photo(im.n,im.w,im.h,cap,300);
      else pdf.text(cap+' (imagem não disponível neste dispositivo)',{size:9.5,after:6,cor:PDF_COR.secundario});
    });
    pdf.gap(4);return;
  }
  if(!rows.length){pdf.text('(sem elementos registados)',{size:9.5,after:4,cor:PDF_COR.secundario});return}
  pdf.tabela(cols,widths,rows,{size:9.5,direita:fonte==='chaves'?[1]:(fonte==='inventario'?[2]:[]),after:10});
}
// Blocos de assinatura de uma das partes, dois por linha: o traço, o nome a forte e o papel ajustado ao género (Senhoria/Senhorio, Inquilina/Inquilino) a cinzento, sem quebrar a meio da página; o título da parte fica com a primeira linha de assinaturas.
// Recebe: pdf — o documento em construção; parte — 'senhorios' ou 'inquilinos'; c — o contrato; p — o imóvel.
// Devolve: nada — escreve os blocos de assinatura no PDF.
function assinaturas(pdf,parte,c,p){
  const gente=parte==='senhorios'?ownersOfProp(p).map(owner).filter(Boolean):ctTenants(c);
  if(!gente.length)return;
  const sep=24,col=(pdf.W-pdf.ML-pdf.MR-sep)/2,papel=g=>parte==='senhorios'?(g.gender==='f'?'Senhoria':'Senhorio'):(g.gender==='f'?'Inquilina':'Inquilino');
  pdf.gap(10);
  pdf.need(14+34+40);
  pdf.text(parte==='senhorios'?'OS SENHORIOS':'OS INQUILINOS',{size:10,titulo:true,after:2});
  for(let i=0;i<gente.length;i+=2){
    const par=gente.slice(i,i+2).map(g=>({g,ls:pdf.linhas(g.name||'',9.5,true,col)}));
    const h=34+Math.max.apply(null,par.map(x=>x.ls.length))*12+24;
    pdf.need(h);
    pdf.gap(34);
    par.forEach((x,j)=>{
      const x0=pdf.ML+j*(col+sep);
      pdf.traco(x0,pdf.y,x0+col);
      x.ls.forEach((ln,k)=>pdf.escreve(ln,x0,pdf.y-13-k*12,9.5,'forte',PDF_COR.tinta));
      pdf.escreve(papel(x.g),x0,pdf.y-13-x.ls.length*12,8.5,'texto',PDF_COR.secundario);
    });
    pdf.gap(h-34);
  }
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
    <n>O imóvel é entregue em condições de habitabilidade e conservação, no estado descrito no Inventário{{#fotos}}, no Auto de Entrega e no registo fotográfico anexos{{/}}{{#semFotos}} e no Auto de Entrega anexos{{/}}, que fazem parte integrante do contrato.</n>
    <n>Os INQUILINOS dispõem de 10 dias após a entrega das chaves para comunicar por escrito anomalias preexistentes não registadas nos anexos, juntando fotografias sempre que possível.</n>
    <n>A ausência dessa comunicação não impede a invocação de defeitos ocultos, mas presume-se que os elementos visíveis foram recebidos no estado documentado no inventário{{#fotos}} e nas fotografias{{/}}.</n>
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
      <item opcional="fotos">Anexo II — Registo fotográfico</item>
      <item>Anexo {{anexo.chaves}} — Auto de entrega de chaves</item>
    </lista>
  </secao>

  <secao titulo="ASSINATURA E FORMALIZAÇÃO">
    <p>Celebrado em {{local}}, no dia {{data.hoje}}, em exemplares destinados a cada uma das partes.</p>
    <assinaturas parte="senhorios"/>
    <assinaturas parte="inquilinos"/>
  </secao>

  <anexo titulo="ANEXO I — INVENTÁRIO E ESTADO DE CONSERVAÇÃO">
    <p>O inventário identifica os bens, equipamentos e principais elementos fixos entregues com o imóvel. O estado deverá ser confirmado na entrega{{#fotos}} e complementado pelo registo fotográfico anexo{{/}}. A indicação “Novo” significa que o elemento é entregue sem uso anterior; “Usado” identifica um elemento já utilizado, prevalecendo sempre o estado efetivamente documentado na data da entrega.</p>
    <tabela fonte="inventario" colunas="N.º|Elemento / equipamento|Qt.|Estado"/>
  </anexo>

  <anexo titulo="ANEXO II — REGISTO FOTOGRÁFICO" opcional="fotos">
    <p>As fotografias seguintes integram o presente contrato e documentam o estado geral do imóvel na data da entrega.</p>
    <tabela fonte="fotos" colunas="N.º|Fotografia"/>
  </anexo>

  <anexo titulo="ANEXO {{anexo.chaves}} — AUTO DE ENTREGA DE CHAVES">
    <p>Na data de início do contrato, os INQUILINOS declaram receber as seguintes chaves:</p>
    <tabela fonte="chaves" colunas="Tipo|Quantidade"/>
    <p opcional="contrato.inicio">Entregue em {{contrato.inicio}}.</p>
    <assinaturas parte="senhorios"/>
    <assinaturas parte="inquilinos"/>
  </anexo>

</contrato>
`;

/* ================= GERADOR DE PDF =================
   Escritor de PDF mínimo, sem bibliotecas, em WinAnsi (cobre todos os
   acentos portugueses), com a quebra de linha calculada com as larguras
   reais dos glifos da letra em uso. A letra é a da app — a Geist no texto
   (400 e 600) e a Bricolage Grotesque nos títulos (700), embutidas como
   TrueType (PDF_LETRAS, pdfLetras) —, e sem elas (sem rede, ou um ficheiro
   que não veio) a Helvetica, uma das catorze que todo o leitor de PDF tem.
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
/* Os símbolos de 128 a 159 do WinAnsi na Helvetica, [normal, negrito]: o
   travessão é largo (1000) e media como um hífen, e a cabeça «SENHORIOS —»
   pisava a palavra a seguir. */
const HW_WIN={128:[556,556],130:[222,278],132:[333,500],133:[1000,1000],134:[556,556],135:[556,556],145:[222,278],146:[222,278],
  147:[333,500],148:[333,500],149:[350,350],150:[556,556],151:[1000,1000],152:[333,333],153:[1000,1000],155:[333,333]};
/* acentuados: a largura é a da letra base */
const BASE={192:'A',193:'A',194:'A',195:'A',196:'A',197:'A',199:'C',200:'E',201:'E',202:'E',
  203:'E',204:'I',205:'I',206:'I',207:'I',209:'N',210:'O',211:'O',212:'O',213:'O',214:'O',
  217:'U',218:'U',219:'U',220:'U',221:'Y',224:'a',225:'a',226:'a',227:'a',228:'a',229:'a',
  231:'c',232:'e',233:'e',234:'e',235:'e',236:'i',237:'i',238:'i',239:'i',241:'n',242:'o',
  243:'o',244:'o',245:'o',246:'o',249:'u',250:'u',251:'u',252:'u',253:'y',186:'o',170:'a',
  8364:'E',8220:'"',8221:'"',8216:"'",8217:"'",8212:'-',8211:'-',183:'.',176:'o',
  /* os espaços que não partem (o fino dos milhares do money, o não
     separável): saem como um espaço e medem como ele — a quebra de linha
     já não parte neles, e «2 500 €» fica junto */
  160:' ',8239:' ',8201:' ',8199:' '};
// Largura de um carácter (milésimos de em) na letra pedida: com as larguras de uma letra embutida, a do byte WinAnsi em que ele sai (pdfByte); na Helvetica, acentuados usam a letra base e desconhecidos levam uma largura média.
// Recebe: code — o código do carácter (charCodeAt); bold — true para a Helvetica-Bold; larg (opcional) — as larguras dos códigos 32–255 de uma letra de PDF_LETRAS.
// Devolve: a largura em milésimos de em (número).
function charW(code,bold,larg){
  const byte=pdfByte(code);
  if(larg)return byte>=32?larg[byte-32]:0;
  if(HW_WIN[byte])return HW_WIN[byte][bold?1:0];
  const w=bold?HWB:HW;
  if(w[code]!==undefined)return w[code];
  const b=BASE[code];
  if(b)return w[b.charCodeAt(0)]||500;
  return bold?611:556;
}
// Largura de uma linha de texto em pontos, para o tamanho e peso dados — é isto que decide as quebras de linha.
// Recebe: s — o texto; size — o tamanho da fonte em pontos; bold — true para negrito; larg (opcional) — as larguras da letra embutida em uso (sem elas, a Helvetica).
// Devolve: a largura do texto em pontos (número).
const textW=(s,size,bold,larg)=>{let t=0;for(let i=0;i<s.length;i++)t+=charW(s.charCodeAt(i),bold,larg);return t*size/1000};

/* As três letras da app que o PDF embute, convertidas dos woff2 variáveis de
   web/fonts/ para TrueType estáticos cortados ao WinAnsi pelo
   .unlazy/pdf-estilo/letras.py, que escreveu este bloco (OFL 1.1, sem nome
   reservado; as licenças em web/fonts/LICENCA-*.txt): texto — a Geist 400;
   forte — a Geist 600; titulo — a Bricolage Grotesque 700 no tamanho ótico
   24. Por letra: o ficheiro, o nome PostScript, as métricas do
   FontDescriptor e as larguras dos códigos 32 a 255 em milésimos de em — o
   /Widths do PDF e o que a quebra de linha mede. Os glifos que as letras não
   têm (Š Ž š ž Ÿ ƒ † ‡ ‰, o hífen suave) levam a largura do .notdef. */
const PDF_LETRAS={
  texto:{ficheiro:'/fonts/geist-400.ttf',nome:'Geist-Regular',
    desc:{ascent:1005,descent:-295,capHeight:710,bbox:[-200,-220,1031,940],flags:32,italicAngle:0.0,stemV:88},
    larguras:[250,213,346,478,629,802,620,178,274,274,430,558,201,419,201,480,663,384,619,613,615,626,593,524,604,593,297,297,544,540,544,559,906,668,680,703,694,603,590,700,713,270,597,640,580,877,743,739,650,733,672,640,552,689,667,945,606,576,544,347,455,347,426,557,248,551,595,546,595,561,395,594,581,244,260,590,267,877,581,573,595,595,379,520,392,575,536,819,585,537,537,389,264,389,523,600,727,600,201,600,366,571,600,600,362,600,600,331,1088,600,600,600,600,203,203,368,368,312,591,907,403,894,600,331,958,600,600,600,250,213,546,611,624,576,264,549,350,828,401,533,500,600,635,356,404,538,348,332,248,575,596,201,317,242,419,537,732,800,782,559,668,668,668,668,668,669,972,703,603,603,603,603,270,270,270,270,694,743,739,739,739,739,739,502,739,689,689,689,689,576,620,587,551,551,551,551,551,551,919,546,561,561,561,561,244,244,244,244,573,581,573,573,573,573,573,540,573,575,575,575,575,537,595,537]},
  forte:{ficheiro:'/fonts/geist-600.ttf',nome:'Geist-SemiBold',
    desc:{ascent:1005,descent:-295,capHeight:710,bbox:[-200,-228,1060,952],flags:32,italicAngle:0.0,stemV:135},
    larguras:[236,243,376,552,656,818,677,195,306,306,424,566,225,418,225,508,683,427,642,637,643,656,615,538,644,618,306,306,548,548,548,581,944,709,695,724,708,615,600,726,719,290,617,672,586,902,748,763,664,757,689,668,584,699,709,991,660,613,577,375,485,375,450,560,268,580,621,580,621,591,429,620,601,269,308,628,297,892,601,603,621,621,409,553,427,597,584,839,628,570,567,401,284,401,523,600,752,600,225,600,423,654,600,600,394,600,600,364,1109,600,600,600,600,232,232,431,431,345,594,910,412,904,600,364,984,600,600,600,236,243,580,635,630,613,284,587,404,824,422,607,508,600,644,367,420,546,364,357,268,597,640,225,325,268,437,616,770,830,827,581,709,709,709,709,709,713,1019,724,615,615,615,615,290,290,290,290,708,748,763,763,763,763,763,528,763,699,699,699,699,613,634,633,580,580,580,580,580,580,945,580,591,591,591,591,269,269,269,269,603,601,603,603,603,603,603,556,603,597,597,597,597,570,614,570]},
  titulo:{ficheiro:'/fonts/bricolage-grotesque-700.ttf',nome:'BricolageGrotesque-Bold',
    desc:{ascent:930,descent:-270,capHeight:660,bbox:[-115,-230,1035,903],flags:32,italicAngle:0.0,stemV:166},
    larguras:[227,286,355,623,633,972,746,176,318,313,436,523,194,347,232,358,657,340,596,600,620,604,649,506,649,645,241,220,523,523,523,418,978,692,673,674,690,611,583,712,712,286,367,678,502,923,764,715,638,716,670,644,563,716,667,977,686,634,568,320,355,316,566,553,283,579,630,562,630,575,394,594,622,270,274,583,268,934,622,604,629,630,428,540,393,613,566,854,564,594,518,346,263,340,523,649,737,649,194,649,385,759,649,649,366,649,649,244,990,649,649,649,649,202,202,393,393,326,531,798,380,996,649,240,959,649,649,649,227,286,562,714,649,622,263,560,390,952,419,460,523,649,683,336,357,523,427,417,283,627,690,232,300,256,420,460,922,925,1067,414,692,692,692,692,692,692,942,674,611,611,611,611,286,286,286,286,735,764,715,715,715,715,715,523,724,716,716,716,716,634,639,675,579,579,579,579,579,579,917,562,575,575,575,575,272,270,270,270,606,622,604,604,604,604,604,523,604,613,613,613,613,594,629,594]},
};
/* Os bytes das três letras, quando o pdfLetras já os trouxe: {texto, forte,
   titulo}, cada um numa string latin-1 (um carácter por byte); null antes
   disso. O PDF() usa as que houver aqui. */
let pdfLetrasBytes=null;
/* Um ArrayBuffer numa string latin-1, um carácter por byte — é assim que o
   escritor guarda o que vai para dentro do PDF.
   Recebe: buf — o ArrayBuffer (ou uma vista de bytes).
   Devolve: a string. */
function pdfBinario(buf){
  const u=buf instanceof Uint8Array?buf:new Uint8Array(buf);let s='';
  for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));
  return s;
}
/* Os bytes são de um TrueType? Começa por 00 01 00 00 ou por «true»: um 404
   ou a página da app no lugar da letra não entram no PDF.
   Recebe: s — os bytes numa string latin-1.
   Devolve: true/false. */
function pdfEhTrueType(s){const m=String(s||'').slice(0,4);return m==='\x00\x01\x00\x00'||m==='true'}
/* Vai buscar as três letras à mesma origem (/fonts/*.ttf, PDF_LETRAS) e
   guarda-as em pdfLetrasBytes, para o PDF() as embutir — uma vez por sessão:
   com elas já em memória, resolve logo. Nunca rejeita: sem rede, com um
   ficheiro que não veio ou que não é um TrueType, ou passados 5 segundos,
   resolve com null e o PDF sai na Helvetica (e a próxima vez tenta outra vez).
   Recebe: nada.
   Devolve: Promise das letras ({texto, forte, titulo}, strings latin-1) ou de null. */
function pdfLetras(){
  if(pdfLetrasBytes)return Promise.resolve(pdfLetrasBytes);
  if(typeof fetch!=='function')return Promise.resolve(null);
  const chaves=Object.keys(PDF_LETRAS);
  const traz=k=>Promise.resolve().then(()=>fetch(PDF_LETRAS[k].ficheiro))
    .then(r=>{if(!r||!r.ok)throw new Error('sem a letra '+k);return r.arrayBuffer()}).then(pdfBinario);
  const todas=Promise.all(chaves.map(traz)).then(bins=>{
    if(!bins.every(pdfEhTrueType))return null;
    const out={};chaves.forEach((k,i)=>{out[k]=bins[i]});
    pdfLetrasBytes=out;return out;
  });
  let relogio=null;
  const prazo=new Promise(res=>{relogio=setTimeout(()=>res(null),5000)});
  return Promise.race([todas,prazo]).catch(()=>null).then(v=>{clearTimeout(relogio);return v});
}

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
    const ch=String.fromCharCode(pdfByte(s.charCodeAt(i)));
    out+=(ch==='('||ch===')'||ch==='\\')?'\\'+ch:ch;
  }
  return out;
}
/* O byte WinAnsi em que um carácter sai no PDF: os símbolos tipográficos
   pela tabela WIN, o resto do não-latin-1 na letra base (ou «?»), o latin-1
   tal e qual. É por ele que se escreve (pdfEsc) e que se mede numa letra
   embutida (charW).
   Recebe: c — o código do carácter (charCodeAt).
   Devolve: o byte (0–255). */
function pdfByte(c){
  if(WIN[c]!==undefined)return WIN[c];
  if(c>255){const b=BASE[c];return b?b.charCodeAt(0):63}
  return c;
}

/* As cores do contrato em PDF: as do tema claro da app (o papel é claro), em
   frações de 0 a 1 como o PDF as pede (o operador rg/RG). São os tokens do
   contrato visual e não hex à mão: tinta #121826 (--ink), secundário #4F586B
   (--muted), cobalto #2952D9 (--accent) nos títulos das cláusulas e das
   secções, o texto cobalto #1D3FB0 (--accent-text) sobre o fundo #E9EEFC
   (--accent-soft) no total a entregar, o contorno #E2E5EB (--line) nos
   traços e o #CDD2DB (--line2) nas linhas das assinaturas, o #687083
   (--faint) no rodapé, o fundo #F2F3F6 (--bg) nos cartões e no cabeçalho das
   tabelas, e o branco no número das pílulas. */
const PDF_COR={tinta:[.071,.094,.149],secundario:[.31,.345,.42],fraco:[.408,.439,.514],cobalto:[.161,.322,.851],cobaltoTexto:[.114,.247,.69],
  cobaltoSuave:[.914,.933,.988],suave:[.949,.953,.965],linha:[.886,.898,.922],linha2:[.804,.824,.859],branco:[1,1,1]};
/* O caminho de um retângulo de cantos arredondados (quatro quartos de
   círculo em curvas de Bézier, k = 0,5523), pronto a encher («f») ou a
   recortar («W n») — os cartões, as pílulas e as fotografias do PDF.
   Recebe: x, y — o canto de baixo à esquerda (pontos); w, h — a largura e a
   altura; r — o raio (no máximo metade do lado menor).
   Devolve: os operadores do caminho (texto), fechado com «h». */
function pdfArredondado(x,y,w,h,r){
  r=Math.max(0,Math.min(r,w/2,h/2));
  const k=r*0.5523,f=n=>n.toFixed(2),x1=x+w,y1=y+h;
  return `${f(x+r)} ${f(y)} m ${f(x1-r)} ${f(y)} l ${f(x1-r+k)} ${f(y)} ${f(x1)} ${f(y+r-k)} ${f(x1)} ${f(y+r)} c `+
    `${f(x1)} ${f(y1-r)} l ${f(x1)} ${f(y1-r+k)} ${f(x1-r+k)} ${f(y1)} ${f(x1-r)} ${f(y1)} c `+
    `${f(x+r)} ${f(y1)} l ${f(x+r-k)} ${f(y1)} ${f(x)} ${f(y1-r+k)} ${f(x)} ${f(y1-r)} c `+
    `${f(x)} ${f(y+r)} l ${f(x)} ${f(y+r-k)} ${f(x+r-k)} ${f(y)} ${f(x+r)} ${f(y)} c h`;
}
/* Uma cor de PDF_COR como operandos do PDF.
   Recebe: c — [r, g, b] de 0 a 1.
   Devolve: o texto «r g b». */
const pdfCor=c=>(c||PDF_COR.tinta).map(x=>Number(x).toFixed(3)).join(' ');
/* Cria um documento A4 e devolve o escritor. Escreve na letra da app quando o
   pdfLetras já a trouxe (pdfLetrasBytes) e na Helvetica quando não — a
   assinatura dos métodos é a mesma nas duas, e as quebras de linha medem com
   as larguras da letra em uso. text() escreve parágrafos com quebra de linha
   calculada e mudança de página automática (com a cor pedida, a tinta por
   omissão; titulo:true na letra dos títulos, bold:true na forte; marca e
   recuo para um número ou um ponto pendurado à esquerda; cabeca para as
   primeiras palavras a forte e a cobalto); caixa() escreve um parágrafo num
   cartão arredondado de cor; titulo() é o título do documento com o traço
   cobalto; cartao() um cartão arredondado de fundo suave com rótulo e
   parágrafos ou campo → valor; pilula() um número numa pílula cobalto;
   clausula() o título de uma cláusula com o número na pílula; tabela() uma
   tabela com cabeçalho num fundo suave, que se repete ao mudar de página;
   line() uma linha de tabela simples; photo() um JPEG de cantos arredondados
   com legenda; traco()/rule()/gap() separam; e build() devolve o ficheiro
   completo como string latin-1 (um carácter = um byte), com o rodapé em
   todas as páginas — «Feito com o Rendorium» e «Página N de M».
   Recebe: nada.
   Devolve: o objeto escritor, com esses métodos (e image/draw/need/newPage/
   linhas/medir/escreve), já com a primeira página aberta. */
function PDF(){
  const L=pdfLetrasBytes;
  const P={pages:[],cur:null,y:0,W:595.28,H:841.89,ML:56,MR:56,MT:60,MB:68,images:[],letras:!!L,RAIO:9,RECUO:30};
  /* as três letras do PDF: F1 o texto, F2 a forte, F3 os títulos (na
     Helvetica, a F2 e a F3 são a Helvetica-Bold); só se embutem as usadas */
  const FONTE={texto:'F1',forte:'F2',titulo:'F3'},usadas={};
  const pesoDe=o=>o&&o.titulo?'titulo':(o&&o.bold?'forte':'texto');
  P.newPage=()=>{P.cur=[];P.pages.push(P.cur);P.y=P.H-P.MT};
  /* imagem JPEG (bytes numa string latin-1); devolve o número para desenhar */
  P.image=(bin,w,h)=>{P.images.push({bin,w,h});return P.images.length};
  /* desenha a imagem n no retângulo dado; com r, recortada de cantos arredondados */
  P.draw=(n,x,y,w,h,r)=>{
    const im=`${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im${n} Do`;
    P.cur.push(r?`q ${pdfArredondado(x,y,w,h,r)} W n ${im} Q`:`q ${im} Q`);
  };
  /* desenha uma fotografia com legenda, ajustada à largura e a uma altura máxima */
  P.photo=(n,iw,ih,caption,maxH)=>{
    const full=P.W-P.ML-P.MR,k=Math.min(full/iw,(maxH||300)/ih),w=iw*k,h=ih*k;
    P.need(h+24);
    P.draw(n,P.ML,P.y-h,w,h,P.RAIO);P.y-=h+6;
    P.text(caption,{size:9,after:12,cor:PDF_COR.secundario});
  };
  P.space=()=>P.y-P.MB;
  P.need=h=>{if(P.y-h<P.MB)P.newPage()};
  /* A largura de um texto em pontos, na letra em uso.
     Recebe: s — o texto; size — o tamanho; peso — 'texto', 'forte' ou 'titulo'.
     Devolve: a largura (pontos). */
  P.medir=(s,size,peso)=>textW(String(s),size,!!peso&&peso!=='texto',L?PDF_LETRAS[peso||'texto'].larguras:null);
  /* Escreve uma linha de texto já partida, com a linha de base em y.
     Recebe: s — o texto; x, y — a posição; size — o tamanho; peso — 'texto',
     'forte' ou 'titulo'; cor — [r, g, b] (a tinta por omissão).
     Devolve: nada. */
  P.escreve=(s,x,y,size,peso,cor)=>{
    const f=FONTE[peso]||'F1';usadas[f]=1;
    P.cur.push(`BT ${pdfCor(cor)} rg /${f} ${size} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${pdfEsc(String(s))}) Tj ET`);
  };
  /* Escreve uma linha que pode começar pela cabeça do parágrafo (a forte, na
     cor dela) e continuar no peso do texto.
     Recebe: ln — a linha; cab — a cabeça ('' sem ela); x, y, size, peso, cor —
     como no escreve; corCab — a cor da cabeça.
     Devolve: nada. */
  const linhaComCabeca=(ln,cab,x,y,size,peso,cor,corCab)=>{
    if(!cab||ln.indexOf(cab)!==0)return P.escreve(ln,x,y,size,peso,cor);
    P.escreve(cab,x,y,size,'forte',corCab||PDF_COR.cobalto);
    const resto=ln.slice(cab.length).trim();
    if(resto)P.escreve(resto,x+P.medir(cab,size,'forte')+P.medir(' ',size,peso),y,size,peso,cor);
  };
  /* As linhas de um parágrafo partido à largura dada, com as larguras reais
     dos glifos da letra em uso.
     Recebe: s — o texto; size — o tamanho; bold — true para a forte; maxW — a
     largura (pontos); o (opcional) — {titulo (a letra dos títulos), extra (pontos
     a mais na primeira linha, os da cabeça a forte)}.
     Devolve: a lista das linhas. */
  P.linhas=(s,size,bold,maxW,o)=>{
    o=o||{};const peso=o.titulo?'titulo':(bold?'forte':'texto');
    /* só os espaços normais partem: o não separável dos valores («2 500 €»)
       fica com o número */
    const words=String(s).split(/[ \t\r\n]+/).filter(Boolean);
    const lines=[];let line='';
    words.forEach(w=>{
      const cand=line?line+' '+w:w,extra=lines.length?0:(o.extra||0);
      if(P.medir(cand,size,peso)+extra>maxW&&line){lines.push(line);line=w}else line=cand;
    });
    if(line)lines.push(line);
    return lines;
  };
  /* A cabeça de um parágrafo, se ele começar por ela, e quanto ela alarga a
     primeira linha por ir a forte. */
  const cabecaDe=(s,cab,size,peso)=>{
    const c=cab&&String(s).indexOf(cab)===0?cab:'';
    return {cab:c,extra:c?P.medir(c,size,'forte')-P.medir(c,size,peso):0};
  };
  P.text=(s,o)=>{
    o=o||{};
    const size=o.size||10,peso=pesoDe(o),lead=o.lead||size*1.42,recuo=o.recuo||0;
    const x0=P.ML+(o.indent||0),maxW=P.W-P.ML-P.MR-(o.indent||0)-(o.right||0)-recuo;
    const k=cabecaDe(s,o.cabeca,size,peso);
    P.linhas(s,size,peso!=='texto',maxW,{titulo:peso==='titulo',extra:k.extra}).forEach((ln,i)=>{
      P.need(lead);
      const y=P.y-size;
      let x=x0+recuo;
      if(o.center)x=(P.W-P.medir(ln,size,peso))/2;
      if(i===0&&o.marca)P.escreve(o.marca,x0,y,size,'forte',o.corMarca||PDF_COR.secundario);
      linhaComCabeca(ln,i===0?k.cab:'',x,y,size,peso,o.cor,o.corCabeca);
      P.y-=lead;
    });
    if(o.after)P.y-=o.after;
  };
  /* um parágrafo num cartão arredondado de cor, com 12pt de margem à volta, sem partir de página */
  P.caixa=(s,o)=>{
    o=o||{};
    const size=o.size||10,bold=!!o.bold,lead=size*1.42,pad=12,w=P.W-P.ML-P.MR;
    const lines=P.linhas(s,size,bold,w-pad*2),h=lines.length*lead+pad*2-(lead-size);
    P.need(h+2);
    P.cur.push(`q ${pdfCor(o.fundo)} rg ${pdfArredondado(P.ML,P.y-h,w,h,P.RAIO)} f Q`);
    let y=P.y-pad;
    lines.forEach(ln=>{P.escreve(ln,P.ML+pad,y-size,size,bold?'forte':'texto',o.cor);y-=lead});
    P.y-=h+(o.after||0);
  };
  /* O título do documento: grande, na letra dos títulos, à esquerda, com um
     traço cobalto curto por baixo — o dos títulos da app.
     Recebe: s — o título; o (opcional) — {size (19), after (14)}.
     Devolve: nada. */
  P.titulo=(s,o)=>{
    o=o||{};const size=o.size||19;
    P.text(s,{size,titulo:true,lead:size*1.14,cor:PDF_COR.tinta});
    P.y-=4;
    P.cur.push(`q ${pdfCor(PDF_COR.cobalto)} rg ${pdfArredondado(P.ML,P.y-4,36,4,2)} f Q`);
    P.y-=4+(o.after==null?14:o.after);
  };
  /* Um cartão arredondado de fundo suave, como os da app, que não se parte
     entre páginas: um rótulo pequeno a cobalto (opcional) e, por baixo, os
     itens — parágrafos ({texto, forte, titulo, cabeca, corCabeca, cor, size})
     ou linhas campo → valor ({campo, valor, forte, cor, size}). Mais alto do
     que uma página, sai sem o cartão, em texto corrido.
     Recebe: o — {rotulo, itens, fundo (PDF_COR.suave por omissão), colCampo
     (a largura da coluna do campo, 150 por omissão), after (10)}.
     Devolve: nada. */
  P.cartao=o=>{
    o=o||{};
    /* as contas são do montarCartao (mais abaixo, chamado só aqui dentro) */
    const {blocos,h,pad,w,K,sizeR,leadR,sep}=montarCartao(o);
    if(h>P.H-P.MT-P.MB){
      if(o.rotulo)P.text(String(o.rotulo).toUpperCase(),{size:sizeR,bold:true,cor:PDF_COR.cobalto,after:3});
      blocos.forEach(b=>P.text(b.a?b.it.campo+': '+(b.it.valor==null?'—':b.it.valor):b.it.texto,
        {size:b.size,bold:b.peso==='forte',titulo:b.peso==='titulo',cabeca:b.it.cabeca,cor:b.it.cor,after:5}));
      P.y-=o.after==null?10:o.after;return;
    }
    P.need(h+2);
    P.cur.push(`q ${pdfCor(o.fundo||PDF_COR.suave)} rg ${pdfArredondado(P.ML,P.y-h,w,h,P.RAIO)} f Q`);
    const x=P.ML+pad;let y=P.y-pad;
    if(o.rotulo){P.escreve(String(o.rotulo).toUpperCase(),x,y-sizeR,sizeR,'forte',PDF_COR.cobalto);y-=leadR}
    blocos.forEach((b,i)=>{
      y-=sep(i);
      if(b.a){
        b.a.forEach((ln,j)=>P.escreve(ln,x,y-b.size-j*b.lead,b.size,'texto',PDF_COR.secundario));
        b.b.forEach((ln,j)=>P.escreve(ln,x+K,y-b.size-j*b.lead,b.size,b.it.forte?'forte':'texto',b.it.cor));
      }else b.ls.forEach((ln,j)=>linhaComCabeca(ln,j===0?b.cab:'',x,y-b.size-j*b.lead,b.size,b.peso,b.it.cor,b.it.corCabeca));
      y-=b.h;
    });
    P.y-=h+(o.after==null?10:o.after);
  };
  /* A altura que um cartão vai ter, sem o desenhar — para um título ficar
     na mesma página que o primeiro cartão dele.
     Recebe: o — as opções do cartao().
     Devolve: a altura (pontos). */
  P.alturaCartao=o=>montarCartao(o||{}).h;
  /* As contas de um cartão: cada item partido em linhas, o espaço entre
     eles (pouco entre duas linhas campo → valor, mais à volta de um
     parágrafo) e a altura total. */
  const montarCartao=o=>{
    const pad=14,w=P.W-P.ML-P.MR,inner=w-pad*2,K=o.colCampo||150,itens=o.itens||[],sizeR=7.5,leadR=13;
    const blocos=itens.map(it=>{
      const size=it.size||10,lead=size*1.42;
      if(it.campo!=null){
        const a=P.linhas(String(it.campo),size,false,K-10),b=P.linhas(String(it.valor==null||it.valor===''?'—':it.valor),size,!!it.forte,inner-K);
        return {it,size,lead,a,b,h:Math.max(a.length,b.length,1)*lead};
      }
      const peso=it.titulo?'titulo':(it.forte?'forte':'texto'),k=cabecaDe(it.texto,it.cabeca,size,peso);
      const ls=P.linhas(String(it.texto==null?'':it.texto),size,peso!=='texto',inner,{titulo:peso==='titulo',extra:k.extra});
      return {it,size,lead,peso,cab:k.cab,ls,h:ls.length*lead};
    });
    const sep=i=>!i?0:(blocos[i].a&&blocos[i-1].a?1:5);
    const ult=blocos[blocos.length-1];
    const h=pad*2+(o.rotulo?leadR:0)+blocos.reduce((t,b,i)=>t+b.h+sep(i),0)-(ult?ult.lead-ult.size:0);
    return {blocos,h,pad,w,K,sizeR,leadR,sep};
  };
  /* Uma pílula cobalto com um texto curto a branco (o número de uma
     cláusula), com o topo em yTop.
     Recebe: txt — o texto; x — a esquerda; yTop — o topo; o (opcional) — {w
     (a largura mínima), h (a altura, 16), size (8.5), fundo, cor}.
     Devolve: a largura desenhada (pontos). */
  P.pilula=(txt,x,yTop,o)=>{
    o=o||{};
    const h=o.h||16,size=o.size||8.5,t=String(txt),tw=P.medir(t,size,'forte'),w=Math.max(o.w||h,tw+12);
    P.cur.push(`q ${pdfCor(o.fundo||PDF_COR.cobalto)} rg ${pdfArredondado(x,yTop-h,w,h,h/2)} f Q`);
    P.escreve(t,x+(w-tw)/2,yTop-h/2-size*0.35,size,'forte',o.cor||PDF_COR.branco);
    return w;
  };
  /* O título de uma cláusula: o número numa pílula cobalto à esquerda e, ao
     lado, o título na letra dos títulos; fica na mesma página que as duas
     primeiras linhas do texto dela. O texto da cláusula alinha pelo título
     com indent RECUO (uma pílula mais larga, como a «4.2» de um quadro do
     Anexo F, empurra o título).
     Recebe: n — o número (ou um código curto); titulo — o texto do título; o
     (opcional) — {size (10.5), cor (a tinta), after (5)}.
     Devolve: nada. */
  P.clausula=(n,titulo,o)=>{
    o=o||{};
    const size=o.size||10.5,lead=size*1.3,hp=17,pw=Math.max(P.RECUO-8,P.medir(String(n),8.5,'forte')+12),x=P.ML+Math.max(P.RECUO,pw+8);
    const ls=P.linhas(titulo,size,true,P.W-P.MR-x,{titulo:true}),h=Math.max(hp,(ls.length-1)*lead+hp);
    P.need(h+10*1.42*2+6);
    P.pilula(n,P.ML,P.y,{w:pw,h:hp});
    ls.forEach((ln,j)=>P.escreve(ln,x,P.y-hp/2-size*0.35-j*lead,size,'titulo',o.cor||PDF_COR.tinta));
    P.y-=h+(o.after==null?5:o.after);
  };
  /* Uma tabela: o cabeçalho num fundo suave arredondado (repetido no topo de
     cada página nova), as linhas separadas por um traço fino, o texto de cada
     célula partido à largura da coluna (nada se corta).
     Recebe: cols — os títulos das colunas; widths — as larguras (pontos);
     rows — as linhas (listas de valores); o (opcional) — {size (9.5), direita
     (os índices das colunas alinhadas à direita), after (6)}.
     Devolve: nada. */
  P.tabela=(cols,widths,rows,o)=>{
    o=o||{};
    const size=o.size||9.5,lead=size*1.35,pad=5,dir=o.direita||[],full=widths.reduce((a,b)=>a+b,0);
    const parte=(r,peso)=>r.map((c,i)=>{const ls=P.linhas(String(c==null?'':c),size,peso!=='texto',widths[i]-12);return ls.length?ls:['']});
    const altura=cells=>Math.max.apply(null,cells.map(l=>l.length))*lead+pad;
    const desenha=(cells,peso,cor)=>{
      let x=P.ML;
      cells.forEach((ls,i)=>{
        ls.forEach((ln,j)=>{
          const y=P.y-pad/2-(lead+0.7*size)/2-j*lead;
          P.escreve(ln,dir.indexOf(i)>-1?x+widths[i]-6-P.medir(ln,size,peso):x+6,y,size,peso,cor);
        });
        x+=widths[i];
      });
    };
    const cab=parte(cols,'forte'),hc=altura(cab);
    const cabecalho=()=>{
      P.cur.push(`q ${pdfCor(PDF_COR.suave)} rg ${pdfArredondado(P.ML,P.y-hc,full,hc,6)} f Q`);
      desenha(cab,'forte',PDF_COR.secundario);
      P.y-=hc;
    };
    const linhas=rows.map(r=>parte(r,'texto'));
    P.need(hc+(linhas.length?altura(linhas[0]):0));
    cabecalho();
    linhas.forEach((cells,k)=>{
      const h=altura(cells);
      if(P.y-h<P.MB){P.newPage();cabecalho()}
      desenha(cells,'texto',PDF_COR.tinta);
      P.y-=h;
      if(k<linhas.length-1)P.cur.push(`0.5 w ${pdfCor(PDF_COR.linha)} RG ${P.ML.toFixed(2)} ${P.y.toFixed(2)} m ${(P.ML+full).toFixed(2)} ${P.y.toFixed(2)} l S`);
    });
    P.y-=o.after==null?6:o.after;
  };
  /* Um traço horizontal de x1 a x2 na altura y (as linhas das assinaturas).
     Recebe: x1, y, x2 — a posição; o (opcional) — {cor (PDF_COR.linha2), w (0,75)}.
     Devolve: nada. */
  P.traco=(x1,y,x2,o)=>{
    o=o||{};
    P.cur.push(`${o.w||0.75} w ${pdfCor(o.cor||PDF_COR.linha2)} RG ${x1.toFixed(2)} ${y.toFixed(2)} m ${x2.toFixed(2)} ${y.toFixed(2)} l S`);
  };
  P.rule=(o)=>{o=o||{};P.need(6);
    P.cur.push(`0.75 w ${pdfCor(PDF_COR.linha)} RG ${(P.ML+(o.indent||0)).toFixed(2)} ${P.y.toFixed(2)} m ${(P.W-P.MR).toFixed(2)} ${P.y.toFixed(2)} l S`);
    P.y-=(o.after===undefined?8:o.after);};
  P.gap=h=>{P.y-=h};
  P.line=(cols,widths,o)=>{                        /* linha de tabela */
    o=o||{};const size=o.size||9.5,lead=size*1.5,peso=o.bold?'forte':'texto';
    P.need(lead+2);
    let x=P.ML;
    cols.forEach((c,i)=>{
      const w=widths[i];
      let s=String(c==null?'':c);
      while(P.medir(s,size,peso)>w-6&&s.length>1)s=s.slice(0,-1);
      const tx=o.right&&o.right.indexOf(i)>-1?x+w-6-P.medir(s,size,peso):x+3;
      P.escreve(s,tx,P.y-size,size,peso,o.cor);
      x+=w;
    });
    P.y-=lead;
    if(o.rule)P.rule({after:3});
  };
  /* O rodapé de uma página, já com o total: um traço fino, «Feito com o
     Rendorium» à esquerda e «Página N de M» à direita, pequenos e a cinzento.
     Recebe: n — o número da página; m — o total.
     Devolve: os operadores (lista), sem mexer na página. */
  const rodape=(n,m)=>{
    const guarda=P.cur,ops=[],size=7.5,cor=PDF_COR.fraco,pag=`Página ${n} de ${m}`;
    P.cur=ops;
    P.traco(P.ML,44,P.W-P.MR,{cor:PDF_COR.linha,w:0.5});
    P.escreve('Feito com o Rendorium',P.ML,30,size,'texto',cor);
    P.escreve(pag,P.W-P.MR-P.medir(pag,size,'texto'),30,size,'texto',cor);
    P.cur=guarda;
    return ops;
  };
  P.build=()=>{
    const objs=[];
    const push=s=>{objs.push(s);return objs.length};
    const kids=[],m=P.pages.length;
    const rodapes=P.pages.map((ops,i)=>rodape(i+1,m));
    /* as letras: embutidas (TrueType simples em WinAnsi, com o ficheiro no
       /FontFile2) quando as há, a Helvetica quando não; a etiqueta de seis
       letras antes do nome é a de um subconjunto, como a norma pede */
    const fontes={},ETIQ={texto:'RNDAAA',forte:'RNDAAB',titulo:'RNDAAC'};
    Object.keys(FONTE).forEach(peso=>{
      const f=FONTE[peso];if(!usadas[f])return;
      if(!L){fontes[f]=push(`<< /Type /Font /Subtype /Type1 /BaseFont /${peso==='texto'?'Helvetica':'Helvetica-Bold'} /Encoding /WinAnsiEncoding >>`);return}
      const m=PDF_LETRAS[peso],d=m.desc,bin=L[peso],nome=ETIQ[peso]+'+'+m.nome;
      const ff=push(`<< /Length ${bin.length} /Length1 ${bin.length} >>\nstream\n${bin}\nendstream`);
      const fd=push(`<< /Type /FontDescriptor /FontName /${nome} /Flags ${d.flags} /FontBBox [${d.bbox.join(' ')}] /ItalicAngle ${d.italicAngle} `+
        `/Ascent ${d.ascent} /Descent ${d.descent} /CapHeight ${d.capHeight} /StemV ${d.stemV} /MissingWidth ${m.larguras[0]} /FontFile2 ${ff} 0 R >>`);
      fontes[f]=push(`<< /Type /Font /Subtype /TrueType /BaseFont /${nome} /FirstChar 32 /LastChar 255 /Widths [${m.larguras.join(' ')}] `+
        `/FontDescriptor ${fd} 0 R /Encoding /WinAnsiEncoding >>`);
    });
    const fontRes=Object.keys(fontes).map(f=>`/${f} ${fontes[f]} 0 R`).join(' ');
    const imIds=P.images.map(im=>push(`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bin.length} >>\nstream\n${im.bin}\nendstream`));
    const xobj=imIds.length?` /XObject << ${imIds.map((id,i)=>`/Im${i+1} ${id} 0 R`).join(' ')} >>`:'';
    const pagesId=push('');                        /* reservado */
    P.pages.forEach((ops,i)=>{
      const stream=ops.concat(rodapes[i]).join('\n');
      const cid=push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      const pid=push(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${P.W.toFixed(2)} ${P.H.toFixed(2)}] `+
        `/Resources << /Font << ${fontRes} >>${xobj} >> /Contents ${cid} 0 R >>`);
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
