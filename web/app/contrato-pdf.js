/* ================= NÚMEROS POR EXTENSO ================= */
const EXT_U=['zero','um','dois','três','quatro','cinco','seis','sete','oito','nove','dez','onze','doze','treze','catorze','quinze','dezasseis','dezassete','dezoito','dezanove'];
const EXT_D=['','','vinte','trinta','quarenta','cinquenta','sessenta','setenta','oitenta','noventa'];
const EXT_C=['','cento','duzentos','trezentos','quatrocentos','quinhentos','seiscentos','setecentos','oitocentos','novecentos'];
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
function euroExtenso(v){
  const n=Math.round((Number(v)||0)*100),int=Math.floor(n/100),cent=n%100;
  let s=extenso(int)+(int===1?' euro':' euros');
  if(cent)s+=' e '+extenso(cent)+(cent===1?' cêntimo':' cêntimos');
  return s;
}
const MESES=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
function dataLonga(iso){
  if(!iso)return '';
  const p=String(iso).split('-');if(p.length<3)return iso;
  return `${Number(p[2])} de ${MESES[Number(p[1])-1]||''} de ${p[0]}`;
}
function prazoTexto(a,b){
  if(!a||!b)return 'prazo certo';
  const d1=new Date(a),d2=new Date(b);
  const meses=Math.round((d2-d1)/(1000*60*60*24*30.44));
  if(meses>=12&&meses%12===0){const y=meses/12;return `${y} (${extenso(y)}) ano${y>1?'s':''}`}
  return `${meses} (${extenso(meses)}) meses`;
}

/* ================= IDENTIFICAÇÃO DAS PARTES ================= */
/* "Casado(a)" -> "casado" ou "casada", conforme o género da ficha */
function generoTexto(t,g){
  let s=String(t||'').toLowerCase();
  if(g==='f')s=s.replace(/o\(a\)/g,'a').replace(/\(a\)/g,'a');
  else if(g==='m')s=s.replace(/o\(a\)/g,'o').replace(/\(a\)/g,'');
  return s;
}
function pessoaTexto(p){
  const b=[];
  b.push((p.name||'').toUpperCase());
  if(p.marital)b.push(generoTexto(p.marital,p.gender));
  if(p.nationality)b.push('de nacionalidade '+p.nationality.toLowerCase());
  if(p.birth)b.push((p.gender==='f'?'nascida':'nascido')+' em '+dataLonga(p.birth));
  if(p.cc)b.push('titular do Cartão de Cidadão n.º '+fmtCC(p.cc)+(p.ccValid?', válido até '+dataLonga(p.ccValid):''));
  if(p.nif)b.push('NIF '+fmtNIF(p.nif));
  if(p.taxAddress)b.push((p.gender==='f'?'residente':'residente')+' em '+p.taxAddress.replace(/\s*\n\s*/g,', '));
  return b.join(', ');
}
const listaPessoas=arr=>arr.map(pessoaTexto).filter(Boolean).join('; e ');

/* ================= GERAR O CONTRATO ================= */
/* morada completa a partir dos campos registais; se não houver, a morada curta da ficha */
function fullAddress(p){
  const a=[];
  const rua=[p.street,p.doorNumber].filter(Boolean).join(', ');if(rua)a.push(rua);
  const piso=[p.floor,p.fraction?'fração '+p.fraction:''].filter(Boolean).join(', ');if(piso)a.push(piso);
  const cp=[p.postalCode,p.locality].filter(Boolean).join(' ');if(cp)a.push(cp);
  return a.length?a.join(', '):(p.address||'');
}
function contractData(c){
  const p=prop(c.propertyId)||{};
  const owners=ownersOfProp(p).map(owner).filter(Boolean);
  const tenants=ctTenants(c);
  const total=(Number(c.rent)||0)+(Number(c.deposit)||0);
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
    'contrato.caucao':c.deposit?money(c.deposit):'','contrato.caucaoLetras':c.deposit?euroExtenso(c.deposit):'',
    'contrato.total':total?money(total):'','contrato.totalLetras':total?euroExtenso(total):'',
    'contrato.iban':fmtIBAN(c.iban),
    'contrato.diaPagamento':c.payDayTo||c.payDay||8,
    'contrato.inicio':dataLonga(c.start),'contrato.fim':dataLonga(c.end),
    'contrato.prazo':prazoTexto(c.start,c.end),
    'data.hoje':dataLonga(today()),
    'local':p.locality||p.concelho||(p.address||'').split(',').pop().replace(/\d{4}-\d{3}/,'').trim()||'Portugal',
    fotos:(c.photoIds||[]).length
  };
}
function fillTpl(str,d){
  /* blocos condicionais {{#chave}}…{{/}} */
  str=String(str).replace(/\{\{#([\w.]+)\}\}([\s\S]*?)\{\{\/\}\}/g,(m,k,inner)=>d[k]?inner:'');
  return str.replace(/\{\{([\w.]+)\}\}/g,(m,k)=>d[k]==null?'':String(d[k]));
}
const ROMANOS=['','PRIMEIRA','SEGUNDA','TERCEIRA','QUARTA','QUINTA','SEXTA','SÉTIMA','OITAVA','NONA','DÉCIMA',
  'DÉCIMA PRIMEIRA','DÉCIMA SEGUNDA','DÉCIMA TERCEIRA','DÉCIMA QUARTA','DÉCIMA QUINTA','DÉCIMA SEXTA',
  'DÉCIMA SÉTIMA','DÉCIMA OITAVA','DÉCIMA NONA','VIGÉSIMA'];

async function generateContractPdf(cid){
  const c=contract(cid);if(!c)return toast('Contrato não encontrado.');
  const p=prop(c.propertyId);
  if(!p)return toast('O contrato não tem imóvel.');
  if(!ctTenants(c).length)return toast('Adiciona pelo menos um inquilino antes de gerar o contrato.');
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
/* o PDF é texto latin-1: converte byte a byte, sem passar por UTF-8 */
function b64Latin1(s){
  try{let out='';for(let i=0;i<s.length;i++)out+=String.fromCharCode(s.charCodeAt(i)&0xFF);return btoa(out)}
  catch(e){return ''}
}
