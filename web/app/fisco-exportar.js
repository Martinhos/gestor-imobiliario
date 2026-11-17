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
   Recebe: r — o resumo (resumoFiscal).
   Devolve: a frase, ex.: «Regras de 2025 (oficiais), revistas a 17/11/2026 ·
   versão da app 77». */
function fiscoRegrasTexto(r){
  const v=r.versao||{},app=typeof VERSAO!=='undefined'&&VERSAO!=null&&VERSAO!==''?' · versão da app '+VERSAO:'';
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
   das substituições (D84). O texto e o PDF escrevem-no igual.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: a frase. */
function fiscoQuadro8Texto(r){
  const ate=fiscoSubstituicaoAte(r);
  return 'No 8A se optares pelo englobamento (o valor reparte-se pelos anos a que respeita), ou no 8B se entregares declarações de substituição desses anos, até cinco para trás'
    +(ate?', até '+dPT(ate)+' (30 dias depois do fim do prazo da entrega)':'')+'. Em cada linha do quadro 8 vai o campo do 4.1 ou do 4.2 de onde a renda é.';
}
/* Como um inquilino se identifica no Anexo F: pelo NIF português, ou, sem
   ele, pelo país de residência. Um número estrangeiro (letras, outro
   comprimento) não vai na coluna do NIF: com o país escrito, vale o país, e
   não se acusa o NIF (D59). O NIF é válido pelo irs-papeis.js:nifValido.
   Recebe: t — o inquilino da linha ({nome, nif, pais}).
   Devolve: {nif, pais, valido, texto} — nif o NIF português ('' sem ele; um NIF que
   não bate certo e sem país vai como foi escrito, para se ver o erro), pais
   o país quando é ele que vale, valido true só com o NIF português que bate
   certo, e texto a forma curta para ler («NIF
   123456789», «sem NIF português · país Espanha», «NIF 12345 — não bate
   certo», «falta o NIF ou o país»). */
function fiscoIdInquilino(t){
  const nif=String((t&&t.nif)||'').trim(),pais=String((t&&t.pais)||'').trim(),ok=nifValido(nif);
  if(ok===true)return {nif:nif,pais:'',valido:true,texto:'NIF '+nif};
  if(pais)return {nif:'',pais:pais,valido:false,texto:'sem NIF português · país '+pais};
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
    const letra={};(r.linhas||[]).forEach(l=>{if(!(l.titularId in letra))letra[l.titularId]=l.titular||''});
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

/* O resumo em texto simples (era o do «Partilhar resumo», que saiu da barra;
   fica como o retrato legível do resumo, que os testes leem): a linha das
   regras (fiscoRegrasTexto), os totais (com o prejuízo a reportar de cada
   titular, os isentos do 6D e o AIMI do quadro 9, quando os há; o imposto
   sem englobamento e nunca negativo), uma entrada por linha do quadro, pela
   ordem em que se preenche, com o campo (4001…, 4501…), o quadro, o titular, a
   identificação (o NIF português ou o país de cada inquilino), os valores, o
   4.2A e o 4.2B no 4.2 com o campo a que se ligam, e as faltas; e depois o
   que ficou fora, as rendas sem contrato com o valor, o quadro 8 com o prazo
   das substituições, o que há a tratar e, no fim, o IRS_AVISO. Os mesmos
   números da página, de quem declara (fiscoQuemDeclara).
   Recebe: r (opcional) — o resumo; sem ele, o do ano da página (resumoFiscal).
   Devolve: o texto (string, várias linhas). */
function fiscoTexto(r){
  r=r||resumoFiscal(fiscoAnoAtual());
  const ano=r.ano,Q=r.versao.quadros||{};
  const gastos=g=>r.colunas.map(k=>fiscoColRotulo(k)+' '+euro2(g[k])).join(' · '),a=r.aimi,I=r.totais.isentos,pre=fiscoPrejuizoTexto(r);
  const campo=l=>l.campo?' (campo '+l.campo+')':'';
  const ant=l=>{const c=l.contratoAnterior;return c&&c.numero?'n.º '+c.numero+' ('+c.nome+')':c?c.nome+', sem n.º na AT':'—'};
  const aimi=a?'\nAIMI (quadro 9): pago '+euro2(a.total)+(a.abate!=null?' · abate ao imposto cerca de '+euro2(a.abate)+' (leitura da app: até ao imposto estimado das rendas; a lei fala da coleta à taxa de 28 % — a AT faz a conta) · imposto depois do AIMI '+euro2(Math.max(0,r2(r.totais.imposto-a.abate))):a.semVpt.length?' · falta o VPT de '+listaE(a.semVpt):''):'';
  const q8=r.linhas.some(l=>l.anosAnteriores.length)?'\nQUADRO '+(Q.anosAnteriores||'8')+' · RENDAS DE ANOS ANTERIORES\n  '+fiscoQuadro8Texto(r)+'\n':'';
  return `ANEXO F · QUADROS 4.1 E 4.2 — ${ano}${r.porInteiro?' · valores por inteiro':' · '+fiscoQuemDeclara(r)+' (quota-parte)'}
${fiscoRegrasTexto(r)}

Rendas ilíquidas ${euro2(r.totais.rendas)} · retenções ${euro2(r.totais.retencoes)}
${gastos(r.totais.gastos)}${r.totais.obras24?'\nObras antes do arrendamento '+euro2(r.totais.obras24):''}
Rendimento líquido ${euro2(r.totais.liquido)} · imposto estimado ${euro2(Math.max(0,r.totais.imposto))} (sem englobamento)${pre?'\n'+pre:''}${I.n?'\nIsentos (quadro 6D): rendas '+euro2(I.rendas)+' · líquido '+euro2(I.liquido)+' — fora do imposto':''}${aimi}

POR CONTRATO (preenche por esta ordem: cada entrada é uma linha do quadro, com o seu campo)
${r.linhas.map(l=>`  ${l.campo?'Campo '+l.campo+' · ':''}[${l.quadro}] ${l.atNumero?'n.º '+l.atNumero:'sem n.º na AT'} · ${l.nome} — ${l.imovel||'sem imóvel'}${l.quota<1?' · quota-parte '+pct(l.quota,0):''} · titular ${l.titular||'A'}
    Início ${dPT(l.inicio)||'—'} · freguesia ${l.freguesiaCodigo||'—'} · ${l.tipoPredio||'—'} · artigo ${l.artigo||'—'}${l.fracao?' · fração '+l.fracao:''} · natureza ${l.natureza}${l.isencao?' · isento (quadro '+l.isencao.quadro+(l.isencao.codigo?', código '+l.isencao.codigo:'')+')':' · taxa '+dec(l.taxa)+' %'}
    Inquilinos: ${l.inquilinos.length?l.inquilinos.map(t=>t.nome+' ('+fiscoIdInquilino(t).texto+')').join(', '):'—'}
    Rendas ilíquidas ${euro2(l.rendas)} · retenções ${euro2(l.retencoes)}${l.anosAnteriores.length?' · de anos anteriores: '+l.anosAnteriores.map(a=>a.ano+' '+euro2(a.valor)).join(', '):''}
    ${gastos(l.gastos)}${l.obras24.valor?'\n    Obras antes do arrendamento '+euro2(l.obras24.valor)+' (desde '+dPT(l.obras24.inicioGastos)+')':''}${fiscoPrejuizoLinha(l)?'\n    Resultado negativo '+euro2(fiscoPrejuizoLinha(l))+' · imposto estimado '+euro2(0)+': abate às rendas das outras linhas do mesmo titular, e o que sobrar é prejuízo a reportar':''}${l.quadro===Q.comReducao?'\n    '+Q.datas+campo(l)+': '+(l.comunicado==null?'':(l.comunicado?'comunicada a '+dPT(l.comunicado):'por comunicar')+' · ')+'início '+(dPT(l.datas.inicio)||'—')+' · termo '+(dPT(l.datas.fim)||'—')+(l.datas.renovacaoInicio?' · última renovação '+dPT(l.datas.renovacaoInicio)+' a '+(dPT(l.datas.renovacaoFim)||'—'):'')+(l.bonus?'\n    4.2B'+campo(l)+': −5 p.p. · renda deste contrato '+euro2(l.renda)+' · contrato anterior '+ant(l)+' · renda anterior '+(l.rendaAnterior?euro2(l.rendaAnterior):'—'):''):''}${l.faltas.length?'\n    Falta: '+l.faltas.join(', ')+'.':''}`).join('\n')}
${r.fora.length?'\nFORA DA DECLARAÇÃO\n'+r.fora.map(f=>`  ${f.nome}${f.imovel?' — '+f.imovel:''}: ${euro2(f.rendas)}`).join('\n')+'\n':''}${r.semContrato.length?'\nRENDAS SEM CONTRATO (não estão em nenhuma linha do quadro: liga-as ao contrato — declaram-se na mesma)\n'+r.semContrato.map(s=>`  ${s.imovel}: ${euro2(s.rendas)} (${fiscoN(s.n,'movimento','movimentos')})`).join('\n')+'\n':''}${q8}${r.avisos.length?'\nA TRATAR\n'+r.avisos.map(a=>'  · '+a.texto).join('\n')+'\n':''}
Resumo feito pela app com o que tem registado. Os gastos de um imóvel com mais do que um contrato repartem-se pelas rendas; o rateio por VPT ou área fica para quem preenche.
${IRS_AVISO}
`;
}
/* O CSV do Anexo F do ano (ponto e vírgula, para abrir no Excel português):
   um cabeçalho e uma linha por linha do quadro, pela ordem em que se
   preenche; as dos contratos não declarados com «nao» na coluna declarado —
   só com nome, imóvel, quota e rendas, porque é só isso que se sabe deles
   aqui —; uma por imóvel com rendas sem contrato ligado («sem contrato», com
   o valor: declaram-se na mesma, D34); e no fim as linhas de rodapé, com o
   texto na coluna contrato: cada ponto de «A tratar» («a tratar (falta)»,
   «(aviso)» ou «(nota)»), a das regras («regras», fiscoRegrasTexto) e a do
   aviso («aviso», o IRS_AVISO). Todas as linhas têm as colunas do cabeçalho.
   As células: o texto pelo copias.js:celulaCsv (com a plica no que o Excel
   lia como fórmula); os códigos — freguesia, natureza, campo, n.º na AT,
   código da isenção, quadro — pelo celulaCodigo (="040810", que o Excel
   não converte em número); os valores pelo celulaNumero, com vírgula e duas
   casas (6147,00), as percentagens com as casas que têm.
   As colunas que já existem não mudam de sítio, para quem tem uma folha
   montada sobre elas; as novas vão sempre no fim: o titular (A, B ou A/B), o
   código da isenção do 6D, a data da comunicação de fevereiro (4.2A), a
   descida do n.º 24 com a renda anterior (4.2B), e depois o campo da linha
   (4001…, 4501…), o prejuízo da linha (o líquido negativo dela, que abate
   às outras linhas do mesmo titular; o imposto_estimado nunca é negativo),
   o NIF português e o país de residência, cada um na sua coluna (o
   nif_ou_pais fica como era), e a renda deste contrato e o n.º do anterior
   do 4.2B. É a declaração da página (resumoFiscal de quem declara): em
   conjunta, um contrato dos dois cônjuges dá uma linha por titular.
   Recebe: r — o resumo (resumoFiscal).
   Devolve: o conteúdo do CSV (string, linhas separadas por \n, sem a marca
   de ordem de bytes, que é do download). */
function fiscoCsvTexto(r){
  const ano=String(r.ano),cols=r.colunas,T=celulaCsv,C=celulaCodigo,N=v=>celulaNumero(v),P=v=>celulaNumero(v,null);
  const cab=['ano','declarado','contrato','n_at','inicio','imovel','freguesia','tipo_predio','artigo','fracao','natureza','inquilinos','nif_ou_pais','quota_pct','rendas_iliquidas','retencoes']
    .concat(cols).concat(['obras24','obras24_desde','recibos_por_emitir','faltas','quadro','taxa_pct','liquido','imposto_estimado','anos_anteriores','termo','ultima_renovacao',
    'titular','isencao_6d','comunicacao_4_2a','reducao_4_2b','renda_anterior_4_2b',
    'campo','prejuizo','nif','pais','renda_4_2b','n_at_anterior_4_2b']);
  /* uma linha a partir das células por nome; as que faltam vão vazias */
  const linha=o=>cab.map(k=>o[k]==null?'""':o[k]).join(';');
  /* uma lista de valores numa célula: um só como código, vários como texto */
  const codigos=xs=>{xs=xs.filter(Boolean);return xs.length===1?C(xs[0]):T(xs.join(' / '))};
  const out=[cab.map(k=>T(k)).join(';')];
  r.linhas.forEach(l=>{
    const ids=l.inquilinos.map(fiscoIdInquilino),ant=l.contratoAnterior,o={
      ano:T(ano),declarado:T(l.estado==='declarado'?'sim':'por indicar'),contrato:T(l.nome),n_at:C(l.atNumero),inicio:T(l.inicio),imovel:T(l.imovel),
      freguesia:C(l.freguesiaCodigo),tipo_predio:T(l.tipoPredio),artigo:T(l.artigo),fracao:T(l.fracao),natureza:C(l.natureza),
      inquilinos:T(l.inquilinos.map(t=>t.nome).join(' / ')),nif_ou_pais:T(l.inquilinos.map(t=>t.nif||t.pais||'').join(' / ')),
      quota_pct:P(l.quota*100),rendas_iliquidas:N(l.rendas),retencoes:N(l.retencoes),
      obras24:N(l.obras24.valor),obras24_desde:T(l.obras24.inicioGastos),recibos_por_emitir:celulaNumero(l.recibosPorEmitir,0),faltas:T(l.faltas.join('; ')),
      quadro:C(l.quadro),taxa_pct:P(l.taxa),liquido:N(l.liquido),imposto_estimado:N(fiscoImpostoLinha(l)),
      anos_anteriores:T(l.anosAnteriores.map(a=>a.ano+':'+r2(a.valor).toFixed(2).replace('.',',')).join(' ')),termo:T(l.datas.fim),
      ultima_renovacao:T(l.datas.renovacaoInicio?l.datas.renovacaoInicio+'/'+l.datas.renovacaoFim:''),
      titular:T(l.titular||'A'),isencao_6d:C(l.isencao?(l.isencao.codigo||l.isencao.id):''),comunicacao_4_2a:T(l.comunicado||''),
      reducao_4_2b:T(l.bonus?'sim':''),renda_anterior_4_2b:l.bonus&&l.rendaAnterior?N(l.rendaAnterior):'""',
      campo:C(l.campo||''),prejuizo:N(fiscoPrejuizoLinha(l)),nif:codigos(ids.map(x=>x.nif)),pais:T(ids.map(x=>x.pais).filter(Boolean).join(' / ')),
      renda_4_2b:l.bonus?N(l.renda):'""',n_at_anterior_4_2b:C(l.bonus&&ant?ant.numero:'')};
    cols.forEach(k=>{o[k]=N(l.gastos[k])});
    out.push(linha(o));
  });
  r.fora.forEach(f=>{const c=contract(f.contratoId),o={ano:T(ano),declarado:T('nao'),contrato:T(f.nome),inicio:T(c?c.start||'':''),imovel:T(f.imovel),
    inquilinos:T(c?ctNames(c):''),quota_pct:P(f.quota*100),rendas_iliquidas:N(f.rendas),retencoes:N(0),obras24:N(0)};
    cols.forEach(k=>{o[k]=N(0)});out.push(linha(o))});
  r.semContrato.forEach(s=>out.push(linha({ano:T(ano),declarado:T('sem contrato'),imovel:T(s.imovel),rendas_iliquidas:N(s.rendas),
    faltas:T(s.n===1?'1 renda sem contrato ligado: não está em nenhuma linha do quadro; liga-a ao contrato — declara-se na mesma'
      :s.n+' rendas sem contrato ligado: não estão em nenhuma linha do quadro; liga-as ao contrato — declaram-se na mesma')})));
  (r.avisos||[]).forEach(a=>out.push(linha({ano:T(ano),declarado:T('a tratar ('+fiscoNivelNome(a)+')'),contrato:T(a.texto)})));
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
