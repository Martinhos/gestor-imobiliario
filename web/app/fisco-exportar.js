/* ================= FISCO · EXPORTAR =================
   O resumo do Anexo F fora da página: em texto simples (fiscoTexto) e em CSV
   (fiscoCsv). Os mesmos números da página, de quem declara. O PDF é o
   fisco-pdf.js. Partiu-se do fisco.js (KAN-125). */

/* O resumo em texto simples (era o do «Partilhar resumo», que saiu da barra;
   fica como o retrato legível do resumo, que os testes leem): totais (com os isentos
   do 6D e o AIMI do quadro 9, quando os há; o imposto sem englobamento), uma
   entrada por contrato com o quadro, o titular, a identificação, os valores,
   a comunicação de fevereiro e o 4.2B no 4.2, e as faltas, e depois o
   que ficou fora, as rendas sem contrato e o que há a tratar. Os mesmos
   números da página, de quem declara (fiscoQuemDeclara).
   Devolve: o texto (string, várias linhas). */
function fiscoTexto(){
  const ano=fiscoAnoAtual(),r=resumoFiscal(ano);
  const gastos=g=>r.colunas.map(k=>fiscoColRotulo(k)+' '+euro2(g[k])).join(' · '),a=r.aimi,I=r.totais.isentos;
  return `ANEXO F · QUADROS 4.1 E 4.2 — ${ano}${r.porInteiro?' · valores por inteiro':' · '+fiscoQuemDeclara(r)+' (quota-parte)'}
${r.versao.exato?'Regras de '+r.versao.ano+(r.versao.modelo.oficial?'':' (provisórias)'):'Ainda sem regras de '+ano+': usam-se as de '+r.versao.ano}

Rendas ilíquidas ${euro2(r.totais.rendas)} · retenções ${euro2(r.totais.retencoes)}
${gastos(r.totais.gastos)}${r.totais.obras24?'\nObras antes do arrendamento '+euro2(r.totais.obras24):''}
Rendimento líquido ${euro2(r.totais.liquido)} · imposto estimado ${euro2(r.totais.imposto)} (sem englobamento)${I.n?'\nIsentos (quadro 6D): rendas '+euro2(I.rendas)+' · líquido '+euro2(I.liquido)+' — fora do imposto':''}${a?'\nAIMI (quadro 9): pago '+euro2(a.total)+(a.abate!=null?' · abate ao imposto cerca de '+euro2(a.abate):a.semVpt.length?' · falta o VPT de '+listaE(a.semVpt):''):''}

POR CONTRATO
${r.linhas.map(l=>`  [${l.quadro}] ${l.atNumero?'n.º '+l.atNumero:'sem n.º na AT'} · ${l.nome} — ${l.imovel||'sem imóvel'}${l.quota<1?' · quota-parte '+pct(l.quota,0):''} · titular ${l.titular||'A'}
    Início ${dPT(l.inicio)||'—'} · freguesia ${l.freguesiaCodigo||'—'} · ${l.tipoPredio||'—'} · artigo ${l.artigo||'—'}${l.fracao?' · fração '+l.fracao:''} · natureza ${l.natureza}${l.isencao?' · isento (quadro '+l.isencao.quadro+(l.isencao.codigo?', código '+l.isencao.codigo:'')+')':' · taxa '+dec(l.taxa)+' %'}
    Inquilinos: ${l.inquilinos.length?l.inquilinos.map(t=>t.nome+' ('+(t.nif||t.pais||'sem NIF')+')').join(', '):'—'}
    Rendas ilíquidas ${euro2(l.rendas)} · retenções ${euro2(l.retencoes)}${l.anosAnteriores.length?' · de anos anteriores: '+l.anosAnteriores.map(a=>a.ano+' '+euro2(a.valor)).join(', '):''}
    ${gastos(l.gastos)}${l.obras24.valor?'\n    Obras antes do arrendamento '+euro2(l.obras24.valor)+' (desde '+dPT(l.obras24.inicioGastos)+')':''}${l.quadro===r.versao.quadros.comReducao?'\n    '+r.versao.quadros.datas+': '+(l.comunicado==null?'':(l.comunicado?'comunicada a '+dPT(l.comunicado):'por comunicar')+' · ')+'início '+(dPT(l.datas.inicio)||'—')+' · termo '+(dPT(l.datas.fim)||'—')+(l.datas.renovacaoInicio?' · última renovação '+dPT(l.datas.renovacaoInicio)+' a '+(dPT(l.datas.renovacaoFim)||'—'):'')+(l.bonus?'\n    4.2B: −5 p.p. · renda '+euro2(l.renda)+' · renda anterior '+(l.rendaAnterior?euro2(l.rendaAnterior):'—'):''):''}${l.faltas.length?'\n    Falta: '+l.faltas.join(', ')+'.':''}`).join('\n')}
${r.fora.length?'\nFORA DA DECLARAÇÃO\n'+r.fora.map(f=>`  ${f.nome}${f.imovel?' — '+f.imovel:''}: ${euro2(f.rendas)}`).join('\n')+'\n':''}${r.semContrato.length?'\nRENDAS SEM CONTRATO\n'+r.semContrato.map(s=>`  ${s.imovel}: ${euro2(s.rendas)} (${fiscoN(s.n,'movimento','movimentos')})`).join('\n')+'\n':''}${r.avisos.length?'\nA TRATAR\n'+r.avisos.map(a=>'  · '+a.texto).join('\n')+'\n':''}
Resumo feito pela app com o que tem registado. Os gastos de um imóvel com mais do que um contrato repartem-se pelas rendas; o rateio por VPT ou área fica para quem preenche. O imposto é uma estimativa.
`;
}
/* Exporta os quadros do ano para CSV (ponto e vírgula, campos entre aspas,
   para abrir no Excel): um cabeçalho, uma linha por contrato, e as dos
   contratos não declarados com «nao» na coluna declarado — só com nome,
   imóvel, quota e rendas, porque é só isso que se sabe deles aqui. As colunas
   novas vão sempre no fim, para quem já tem uma folha montada sobre as velhas:
   as últimas são o titular (A, B ou A/B), o código da isenção do 6D, a data
   da comunicação de fevereiro (4.2A) e a descida do n.º 24 com a renda
   anterior (4.2B). É a declaração da página (resumoFiscal de quem declara):
   em conjunta, um contrato dos dois cônjuges dá uma linha por titular.
   Devolve: nada — dispara a descarga do CSV. */
function fiscoCsv(){
  const ano=fiscoAnoAtual(),r=resumoFiscal(ano),cols=r.colunas;
  const n=v=>String(r2(Number(v)||0));
  const rows=[['ano','declarado','contrato','n_at','inicio','imovel','freguesia','tipo_predio','artigo','fracao','natureza','inquilinos','nif_ou_pais','quota_pct','rendas_iliquidas','retencoes']
    .concat(cols).concat(['obras24','obras24_desde','recibos_por_emitir','faltas','quadro','taxa_pct','liquido','imposto_estimado','anos_anteriores','termo','ultima_renovacao',
    'titular','isencao_6d','comunicacao_4_2a','reducao_4_2b','renda_anterior_4_2b'])];
  r.linhas.forEach(l=>rows.push([ano,l.estado==='declarado'?'sim':'por indicar',l.nome,l.atNumero,l.inicio,l.imovel,l.freguesiaCodigo,l.tipoPredio,l.artigo,l.fracao,l.natureza,
    l.inquilinos.map(t=>t.nome).join(' / '),l.inquilinos.map(t=>t.nif||t.pais||'').join(' / '),n(l.quota*100),n(l.rendas),n(l.retencoes)]
    .concat(cols.map(k=>n(l.gastos[k]))).concat([n(l.obras24.valor),l.obras24.inicioGastos,l.recibosPorEmitir,l.faltas.join('; '),
      l.quadro,n(l.taxa),n(l.liquido),n(l.imposto),l.anosAnteriores.map(a=>a.ano+':'+n(a.valor)).join(' '),l.datas.fim,
      l.datas.renovacaoInicio?l.datas.renovacaoInicio+'/'+l.datas.renovacaoFim:'',
      l.titular||'A',l.isencao?(l.isencao.codigo||l.isencao.id):'',l.comunicado||'',l.bonus?'sim':'',l.bonus&&l.rendaAnterior?n(l.rendaAnterior):''])));
  r.fora.forEach(f=>{const c=contract(f.contratoId);
    rows.push([ano,'nao',f.nome,'',c?c.start||'':'',f.imovel,'','','','','',c?ctNames(c):'','',n(f.quota*100),n(f.rendas),'0']
      .concat(cols.map(()=>'0')).concat(['0','','','','','','','','','','','','','','','']))});
  download('anexo-f-'+ano+'.csv','text/csv;charset=utf-8',rows.map(row=>row.map(x=>'"'+String(x==null?'':x).split('"').join('""')+'"').join(';')).join('\n'));
  toast('CSV exportado.');
}
