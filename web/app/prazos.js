/* ================= PRAZOS ================= */
/* O calendário do ciclo de vida do portefólio.

   Os dados sempre cá estiveram — o fim do contrato, a percentagem do
   aumento anual, a validade do cartão de cidadão, o certificado
   energético, o fim da taxa fixa — mas ninguém os olhava até ser tarde.
   Este módulo transforma-os em avisos com antecedência certa: os prazos
   legais do arrendamento medem-se em dias de pré-aviso, e perder um
   custa dinheiro (um aumento que não se fez) ou um ano de contrato
   (uma oposição fora de prazo).

   Cada aviso tem uma chave que inclui a data-alvo: silenciar cala ESTA
   ocorrência; quando a data mudar (o contrato renova, o CC renova-se),
   a chave muda e o aviso volta sozinho.

   E os prazos da AT, que a lei mede em meses e a app conta em dias: o
   Modelo 2 (comunicar o contrato até ao fim do mês seguinte ao início — só
   os começados desde 1 de abril de 2015; os de antes têm o registo dos
   elementos mínimos, sem prazo —, e a cessação até ao fim do mês seguinte ao
   dia em que o contrato acabou mesmo), o recibo eletrónico de cada renda,
   caução ou reembolso do inquilino (passa-se quando se recebe), a entrega do
   Anexo F e a comunicação de fevereiro dos contratos com redução de taxa
   pela duração — uma vez por período, o contrato e cada renovação, e outra
   na cessação (Portaria 110/2019) —, estas duas com as datas da versão do
   ano (irs-AAAA.js). A comunicação de um período e o envio ao IHRU dos
   contratos do RSAA (15 de janeiro do ano seguinte à celebração) calam-se
   quando se marcam com o dia, no próprio aviso. E o Modelo 44 de quem está
   dispensado do recibo eletrónico nesse ano (irs-papeis.js:irsSituacao,
   escolhido na página Declaração) — que, por isso mesmo, deixa de ser
   avisado dos recibos por emitir. Um contrato que o senhorio marcou como
   «não declarado» é uma escolha dele: nenhum destes prazos nasce dele, e
   nenhum texto o julga. */

// dias de antecedência com que cada tipo de prazo começa a avisar
const PZ_ANTECEDENCIA = { oposicao: 150, fim: 60, aumento: 45, cc: 60, energia: 90, taxa: 90, spread: 60,
  modelo2: 45, cessacao: 45, recibos: 40, irs: 90, fev15: 45, rsaa: 45, modelo44: 45 };

/* O Modelo 44 (a declaração anual das rendas de quem está dispensado do recibo
   eletrónico, CIRS art. 115.º n.º 5 b)) entrega-se até ao fim de fevereiro
   desde o DL 49/2025, em vigor a 1 de julho de 2025 — antes era até ao fim de
   janeiro (Portaria 98-A/2015, art. 8.º). Conta o dia do prazo: o fim de
   fevereiro de 2026 já é depois dessa data, o fim de janeiro de 2025 não. */
const PZ_MODELO44 = { fevereiroDesde: '2025-07-01' };

/* O Modelo 2 só vale para os contratos com início desde 1 de abril de 2015
   (Portaria 98-A/2015; FAQ 1523 da AT). Os de antes não o têm: o n.º que o
   Anexo F pede é o do registo dos elementos mínimos no Portal das Finanças. */
const PZ_MODELO2_DESDE = '2015-04-01';

/* As receitas que vão ao Anexo F (irs-papeis.js:irsReceitaDe) e, delas, as que
   pedem o recibo de renda eletrónico (CIRS art. 115.º n.º 5 a)): a renda, a
   caução (a AT trata-a como renda do ano em que se recebe, OC 20256) e o
   reembolso do inquilino, que o papel já dá como renda. A indemnização e as
   outras receitas prediais vão ao Anexo F sem recibo de renda; o reembolso
   que abate a um gasto, o que fica fora e o que está por classificar não vão. */
const PZ_PAPEIS_ANEXO_F = ['renda', 'caucao', 'indemnizacao', 'outra'];
const PZ_PAPEIS_RECIBO = ['renda', 'caucao'];

/* Uma data local como 'AAAA-MM-DD', sem passar pelo toISOString: esse
   converte para UTC e, com o horário de verão, meia-noite local vira o dia
   ANTERIOR — um prazo legal deslocado um dia é um prazo errado.
   Recebe: d — um objeto Date.
   Devolve: a data local em 'AAAA-MM-DD'. */
function pzIso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}

/* Data ISO de hoje, isolada para os testes poderem fingir outro dia.
   Devolve: 'AAAA-MM-DD' de hoje, na hora local. */
function pzHoje(){return pzIso(new Date())}

/* Soma dias a uma data ISO, em hora local (imune ao horário de verão).
   Recebe: iso — a data base; n — dias a somar (negativo anda para trás).
   Devolve: a data ISO resultante. */
function pzAddDias(iso,n){const d=new Date(iso+'T00:00:00');d.setDate(d.getDate()+n);return pzIso(d)}

/* Dias entre hoje e uma data ISO (positivo = ainda falta).
   Recebe: iso — a data alvo 'AAAA-MM-DD'; hoje (opcional) — outra base, para testes.
   Devolve: número inteiro de dias (negativo se a data já passou). */
function pzDias(iso,hoje){return Math.round((new Date(iso+'T00:00:00')-new Date((hoje||pzHoje())+'T00:00:00'))/86400000)}

/* Soma anos a uma data ISO, mantendo mês e dia (29/2 cai para 28/2).
   Recebe: iso — a data base; n — quantos anos somar.
   Devolve: a data ISO resultante. */
function pzAddAnos(iso,n){const d=new Date(iso+'T00:00:00');const dia=d.getDate();d.setFullYear(d.getFullYear()+n);if(d.getDate()!==dia)d.setDate(0);return pzIso(d)}

/* O próximo aniversário estrito de uma data (o primeiro > hoje). O aumento
   anual da renda só pode existir a partir do primeiro aniversário.
   Recebe: startIso — o início do contrato; hoje (opcional) — a base, para testes.
   Devolve: a data ISO do próximo aniversário, ou '' sem início válido. */
function pzAniversario(startIso,hoje){
  if(!startIso)return '';
  const h=hoje||pzHoje();
  let n=Math.max(1,new Date(h+'T00:00:00').getFullYear()-new Date(startIso+'T00:00:00').getFullYear());
  let a=pzAddAnos(startIso,n);
  while(a<=h)a=pzAddAnos(startIso,++n);
  return a;
}

/* A urgência visual de um prazo pelo que falta.
   Recebe: dias — quantos faltam para a data alvo.
   Devolve: 'passado' (já foi), 'urgente' (≤7), 'breve' (≤30) ou 'info'. */
function pzUrg(dias){return dias<0?'passado':dias<=7?'urgente':dias<=30?'breve':'info'}

/* O mês por extenso de uma data ou de um período, como se diz a meio de uma
   frase («Renda de junho de 2026»): o nome vem do pt-PT do aparelho, em
   minúsculas, que é como o português o escreve.
   Recebe: iso — 'AAAA-MM-DD' ou 'AAAA-MM' (aguenta vazio).
   Devolve: 'junho de 2026' (texto); '' sem data válida. */
function pzMes(iso){
  const m=/^(\d{4})-(\d{2})/.exec(String(iso||''));if(!m)return '';
  return new Date(Number(m[1]),Number(m[2])-1,1).toLocaleDateString('pt-PT',{month:'long',year:'numeric'});
}

/* A oposição do senhorio à renovação de um contrato com termo (CC art. 1097.º,
   na redação da Lei 13/2019). A antecedência mede-se pela duração do período
   que acaba no termo — o contrato, ou a última renovação registada
   (irs.js:irsPeriodos) —: 240 dias com seis anos ou mais, 120 de um a seis
   anos, 60 de seis meses a um ano e um terço do prazo abaixo de seis meses
   (arredondado para cima: um dia cedo não faz mal, um dia tarde perde-se). E
   a oposição à primeira renovação só produz efeitos três anos depois da
   celebração (n.º 3): num contrato de habitação permanente (ou por indicar)
   inicial mais curto do que isso, o contrato continua até lá — a habitação
   não permanente (art. 1095.º n.º 3) e o não habitacional (art. 1110.º) têm
   regras próprias, e aí a app só dá a antecedência, que vale na falta de
   estipulação. Sem início conhecido, 120 dias.
   Recebe: c — o contrato (aguenta null).
   Devolve: null sem termo; senão {alvo, dias, terco, efeitos} — alvo o último
   dia para o aviso seguir, dias a antecedência, terco true quando ela é um
   terço do prazo, efeitos o dia em que a oposição produz efeitos quando é
   depois do termo (a primeira renovação), senão ''. */
function pzOposicao(c){
  if(!c||!/^\d{4}-\d{2}-\d{2}$/.test(String(c.end||'')))return null;
  const ps=irsPeriodos(c);let i=-1;
  ps.forEach((p,k)=>{if(p.inicio&&p.inicio<=c.end)i=k});
  let dias=120,terco=false,efeitos='';
  if(i>-1){
    const ini=ps[i].inicio,m=irsMeses(ini,c.end);
    if(m>=72)dias=240;
    else if(m>=12)dias=120;
    else if(m>=6)dias=60;
    else{dias=Math.max(1,Math.ceil((pzDias(c.end,ini)+1)/3));terco=true}
    const fin=fiscoDe(c).finalidade;
    if(i===0&&(!fin||fin==='hp')){
      const cel=fiscoDe(c).celebracao||ini,e=pzAddAnos(cel,3);
      if(e>pzAddDias(c.end,1))efeitos=e;
    }
  }
  return {alvo:pzAddDias(c.end,-dias),dias:dias,terco:terco,efeitos:efeitos};
}

/* O dia em que um contrato acabou mesmo, para a cessação que se comunica à AT:
   o da cessação (fisco.cessacao, que o «Terminar» grava); num contrato
   terminado de antes dela, o c.end, se já passou (o «Terminar» antigo
   escrevia lá o dia). Um contrato ativo com o termo passado renovou-se (CC
   art. 1096.º) e não acabou; e um terminado com o termo no futuro não diz
   quando acabou — a Declaração pede-lhe o dia (fisco-avisos.js).
   Recebe: c — o contrato; h — o hoje dos prazos ('AAAA-MM-DD').
   Devolve: 'AAAA-MM-DD', ou '' quando não acabou ou não se sabe o dia. */
function pzDiaDaCessacao(c,h){
  const d=irsCessacao(c).data;if(d)return d;
  return c&&c.active===false&&c.end&&c.end<=h?c.end:'';
}

/* O prazo do envio ao IHRU de um contrato do RSAA (DL 97/2026, anexo III,
   art. 6.º n.º 3): o 15 de janeiro do ano seguinte ao da celebração (o
   `prazoIhru` da isenção na versão desse ano). Só quando a isenção vale com o
   envio feito a tempo — as outras condições dela (o `desde`, a finalidade…)
   decide-as o irs.js:irsIsencao, com o envio posto no próprio dia do prazo.
   Recebe: c — o contrato (aguenta null).
   Devolve: 'AAAA-MM-DD', ou '' sem RSAA (ou sem o que o envio resolva). */
function pzPrazoIhru(c){
  const f=fiscoDe(c),cel=f.celebracao||(c&&c.start)||'';
  if(!c||f.isencao!=='rsaa'||!/^\d{4}-\d{2}-\d{2}$/.test(cel))return '';
  const a=Number(cel.slice(0,4)),is=(irsAno(a).isencoes||[]).find(x=>x&&x.id==='rsaa');
  const md=is&&String(is.prazoIhru||'');
  if(!md||!/^\d{2}-\d{2}$/.test(md))return '';
  const prazo=(a+1)+'-'+md;
  return irsIsencao(Object.assign({},c,{fisco:Object.assign({},f,{ihru:prazo})}),a)?prazo:'';
}

/* Quem pode marcar uma coisa feita num contrato (a comunicação de fevereiro, o
   envio ao IHRU): quem o pode alterar, como na ficha.
   Recebe: c — o contrato.
   Devolve: true ou false. */
function pzPodeMarcar(c){return !!c&&!!podeEditar(c.propertyId,'contract.add',c)}

/* Todos os prazos do portefólio que já entraram na janela de aviso, do mais
   urgente para o menos. Função pura sobre o db; os testes passam o dia.
   As fontes: contratos em vigor com fim (a oposição, pela antecedência da
   lei — pzOposicao —, e o fim, que num ativo com o termo passado pede para
   registar a renovação), o aumento anual (o aviso de 30 dias), os cartões de
   cidadão de inquilinos ativos e de proprietários, os certificados
   energéticos, o fim da fase fixa das mistas e o de uma redução de spread.
   E a AT: o Modelo 2 dos por indicar começados desde 1 de abril de 2015 (os
   de antes, um aviso sem data: os elementos mínimos e o n.º); a cessação de
   quem acabou mesmo, pelo dia em que acabou (pzDiaDaCessacao), nunca a de um
   ativo com o termo passado, que se renovou; os recibos das receitas que os
   pedem (PZ_PAPEIS_RECIBO) dos últimos três meses, desde o dia em que se
   receberam, salvo com a dispensa nesse ano; o Anexo F do ano anterior; o 15
   de fevereiro dos declarados com redução pela duração, um por período por
   marcar (irs.js:irsPrazosDeComunicacao), haja ou não rendas, enquanto o
   período pesar numa declaração por entregar, e outro no ano seguinte à
   cessação de um período com redução; o envio ao IHRU do RSAA, até se marcar
   o dia; e o Modelo 44 de quem teve a dispensa no ano anterior. Nada nasce
   de um contrato «não declarado».
   Recebe: hoje (opcional) — data ISO de referência; sem ela usa o dia real.
   Devolve: lista de {chave, tipo, titulo, sub, alvo, dias, urg, abrir}, do
   mais urgente para o menos e os sem data no fim; `abrir` é código para o
   data-click do cartão. Alguns têm ainda acao e acaoTexto (o «feito» que se
   marca no próprio aviso, só para quem pode alterar o contrato: código para
   o data-click e o texto do botão), semData (true no aviso sem prazo: alvo
   é o hoje, dias 0, urg 'info') ou evento ('inicio', 'renovacao' ou
   'cessacao', no 15 de fevereiro). */
function prazosDe(hoje){
  const h=hoje||pzHoje();
  const out=[];
  /* extra: os campos do prazo para lá dos de sempre (acao, acaoTexto, evento) */
  const poe=(tipo,chave,alvo,titulo,sub,abrir,aposAlvo,extra)=>{
    const dias=pzDias(alvo,h);
    if(dias>PZ_ANTECEDENCIA[tipo])return;                       // ainda longe
    if(dias<0&&!aposAlvo)return;                                // passou e já não é acionável
    out.push(Object.assign({chave:tipo+':'+chave,tipo,titulo,sub,alvo,dias,urg:pzUrg(dias),abrir},extra||{}));
  };

  (db.contracts||[]).forEach(c=>{
    /* Só o que acabou (terminado à mão, ou com o dia da cessação) fica de
       fora. Um contrato com início futuro entra: num contrato curto o aviso
       de oposição à renovação cai ANTES do início, e calá-lo até lá é
       perdê-lo de vez. E um contrato cujo fim já passou sem ninguém o
       terminar entra também: é precisamente o caso do «fim» que aguenta
       depois de passar (renovou-se sozinho; atualiza a data).
       Era o ctVivo que decidia isto, pelo dia REAL — o «fim» morria no próprio
       dia em que passava, e um teste com hoje fingido só passava por acaso. */
    if(c.active===false||irsCessacao(c).data)return;
    const nome=c.name||propName(c.propertyId)||'contrato';
    /* o toque abre a ficha do contrato (tocar num registo é lê-lo; o «Editar»
       está lá para quem pode) — só com os Contratos ligados nesta conta; sem
       eles o prazo continua a dizer-se, mas não leva a lado nenhum */
    const abrir=servicoLigado('contracts')?`ctView('${jsq(c.id)}')`:'';
    const o=pzOposicao(c);
    if(o){
      poe('oposicao',c.id+':'+c.end,o.alvo,'Oposição à renovação — '+nome,
        'Para o contrato não renovar a '+dPT(c.end)+', o aviso ao inquilino tem de seguir até '+dPT(o.alvo)+' ('+(o.terco?'um terço do prazo, ':'')+o.dias+' dias).'
        +(o.efeitos?' É a primeira renovação: a oposição do senhorio só produz efeitos três anos depois da celebração, e o contrato continua até '+dPT(o.efeitos)+'.':''),abrir,false);
      poe('fim',c.id+':'+c.end,c.end,'Fim do prazo do contrato — '+nome,
        'Termina a '+dPT(c.end)+'. Sem oposição, renova-se automaticamente pelo período legal — regista a renovação na ficha do contrato («Renovar…»).',abrir,true);
    }
    if(c.increase!=null&&c.start){
      const aniv=pzAniversario(c.start,h);
      const aviso=pzAddDias(aniv,-30);
      /* a atualização pelo coeficiente legal não se comunica (FAQ 5005 da AT: a
         renda nova vai no recibo); um aumento combinado entre as partes é uma
         alteração do contrato — Modelo 2 até ao fim do mês seguinte, com imposto
         do selo sobre o aumento (CIS art. 60.º; TGIS verba 2; FAQ 5069) */
      poe('aumento',c.id+':'+aniv,aviso,'Aumento anual da renda — '+nome,
        'Para valer a '+dPT(aniv)+', o aviso ao inquilino (30 dias) segue até '+dPT(aviso)+'. Renda '+euro(c.rent)+' '+(c.increase>0?'+':'')+c.increase+'%.'
        +(ctDeclarado(c)?' A atualização pelo coeficiente legal não se comunica à AT: a renda nova vai no recibo. Um aumento combinado com o inquilino comunica-se pelo Modelo 2 até ao fim do mês seguinte, e o imposto do selo que paga é dedutível no Anexo F.':''),abrir,false);
    }
  });

  /* ---- a AT. Só de contratos que o senhorio não marcou como «não declarado»:
     essa marca é uma escolha, e não há aviso nenhum a discuti-la. O ano de
     referência (Y) é o anterior ao de `hoje`: é o que se entrega em junho e o
     que se comunica em fevereiro. */
  const ano=Number(h.slice(0,4)),Y=ano-1,vY=irsAno(Y);   // as datas da AT são da versão desse ano (irs-AAAA.js)
  /* a escolha da página Declaração, a de cada ano (irs-papeis.js:irsSituacao,
     herdada do ano anterior até mudar): dispensado do recibo eletrónico (65
     anos ou mais, ou sem caixa postal eletrónica e com poucas rendas). Pode
     não haver db.settings.irs nenhum */
  const dispensas={};
  const dispensaEm=a=>{if(!(a in dispensas))dispensas[a]=!!irsSituacao(a).dispensaRecibos;return dispensas[a]};
  const nomeDe=c=>c.name||propName(c.propertyId)||'contrato';
  /* vivo em `hoje` (e não no dia real, como o ctVivo): um contrato que já
     terminou não pede o Modelo 2 do início */
  const vivoEm=c=>c.active!==false&&!(c.end&&c.end<h)&&!irsCessacao(c).data;
  const desde=pzIso(new Date(ano,Number(h.slice(5,7))-1-3,1));   // primeiro dia de há três meses
  let houveRendasEmY=false,houveRecibosEmY=false;
  (db.transactions||[]).forEach(t=>{
    if(!t||!t.date)return;
    const papel=irsReceitaDe(t).papel;
    if(PZ_PAPEIS_ANEXO_F.indexOf(papel)<0)return;
    const c=t.contractId?contract(t.contractId):null;
    if(c&&ctNaoDeclarado(c))return;
    const pede=PZ_PAPEIS_RECIBO.indexOf(papel)>-1;
    /* uma renda sem contrato (ou de contrato entretanto apagado) é renda na
       mesma: conta para o Anexo F, e a página Declaração lista-a à parte */
    if(t.date.slice(0,4)===String(Y)){houveRendasEmY=true;if(pede)houveRecibosEmY=true}
    /* o recibo é de quitação: passa-se quando se recebe (CIRS art. 115.º n.º
       5 a); a lei não lhe dá outro prazo, e o «fim do mês seguinte» que aqui
       havia era o do Modelo 2). Uma receita com data à frente ainda não se
       recebeu */
    if(c&&ctDeclarado(c)&&pede&&!t.recibo&&t.date>=desde&&t.date<=h&&!dispensaEm(Number(t.date.slice(0,4)))){
      const reembolso=catIrsId('catsIn',t.category)==='reembolsos';
      const o=papel==='caucao'
        ?'Caução recebida a '+dPT(t.date)+': a AT trata-a como renda do ano em que a recebes, com recibo eletrónico. Emite-o no Portal das Finanças e marca-o no movimento.'
        :reembolso
          ?'Reembolso do inquilino recebido a '+dPT(t.date)+': para a AT é renda, com recibo eletrónico. Emite-o no Portal das Finanças e marca-o no movimento.'
          :'Renda de '+pzMes(t.periodo||t.date)+' recebida a '+dPT(t.date)+': emite o recibo eletrónico no Portal das Finanças — passa-se quando se recebe — e marca-o no movimento.';
      poe('recibos',t.id+':'+t.date,t.date,'Recibo de renda por emitir — '+nomeDe(c),o,
        servicoLigado('transactions')?`txView('${jsq(t.id)}')`:'',true);
    }
  });
  (db.contracts||[]).forEach(c=>{
    if(ctNaoDeclarado(c))return;
    const nome=nomeDe(c),abrir=servicoLigado('contracts')?`ctView('${jsq(c.id)}')`:'',pode=pzPodeMarcar(c),id=jsq(c.id);
    if(ctFiscoPorIndicar(c)&&c.start&&vivoEm(c)){
      if(c.start<PZ_MODELO2_DESDE){
        /* sem Modelo 2 nem prazo (FAQ 1523 e 1525 da AT): fica um aviso sem
           data até se indicar o estado do contrato na ficha */
        out.push({chave:'elementos:'+c.id,tipo:'elementos',titulo:'Registar o contrato no Portal das Finanças — '+nome,
          sub:'Começou antes de 1 de abril de 2015: não tem Modelo 2 nem prazo. O n.º do contrato que o Anexo F pede é o do registo dos elementos mínimos do contrato no Portal das Finanças. Escreve-o na ficha e marca o contrato como declarado — ou como não declarado, se não o vais declarar —, e este aviso desaparece.',
          alvo:h,dias:0,urg:'info',abrir:abrir,semData:true});
      }else{
        const alvo=fimDoMesSeguinte(c.start);
        poe('modelo2',c.id+':'+alvo,alvo,'Comunicar o contrato à AT (Modelo 2) — '+nome,
          'Até '+dPT(alvo)+', o fim do mês seguinte ao início. Com ele paga-se o imposto do selo (10 % de uma renda), que é dedutível no Anexo F: regista-o como despesa. Se já o comunicaste, ou se não vais declarar este contrato, marca-o na ficha e este aviso desaparece.',
          abrir,true);
      }
    }
    /* RSAA (anexo III do DL 97/2026, art. 6.º n.os 3 e 4): a cópia do contrato
       vai à plataforma do IHRU até 15 de janeiro do ano seguinte ao da
       celebração — sem isso não há isenção. Também por indicar (o Modelo 2
       pode ainda vir antes do dia). Cala-se quando se marca o dia do envio
       (fisco.ihru); passado o prazo fica, para quem o enviou a tempo marcar o
       dia — sem ele, a isenção não conta (irs.js:irsIsencao) */
    const pIhru=pzPrazoIhru(c);
    if(pIhru&&!fiscoDe(c).ihru){
      const passou=pIhru<h;
      poe('rsaa',c.id+':'+pIhru,pIhru,'Enviar o contrato ao IHRU (RSAA) — '+nome,
        passou?'O prazo era '+dPT(pIhru)+': sem o envio à plataforma do IHRU até esse dia, as rendas não ficam isentas de IRS. Se o enviaste a tempo, marca o dia em que o enviaste.'
          :'Até '+dPT(pIhru)+', a cópia do contrato e o comprovativo da comunicação às Finanças vão à plataforma do IHRU. Sem isto as rendas não ficam isentas de IRS. Depois de enviar, marca-o como enviado, com o dia.',
        abrir,true,pode?{acao:`pzIhruPergunta('${id}')`,acaoTexto:'Marcar como enviado'}:null);
    }
    if(!ctDeclarado(c))return;
    /* a cessação (CIS art. 60.º n.º 2): só a de um contrato que acabou mesmo,
       pelo dia em que acabou. Nos contratos com redução pela duração, a
       Portaria 110/2019 (art. 2.º c)) pede ainda a data e o motivo até 15 de
       fevereiro do ano seguinte (o 15 de fevereiro da cessação, mais abaixo) */
    const fimR=pzDiaDaCessacao(c,h),segR=fimR?irsTaxaNaData(c,fimR):null,comRed=!!(segR&&segR.reducao);
    const fev15Ces=comRed?irsAno(Number(fimR.slice(0,4))).prazos.comunicacaoDuracao:'';
    if(fimR){
      const alvo=fimDoMesSeguinte(fimR);
      poe('cessacao',c.id+':'+alvo,alvo,'Comunicar a cessação à AT — '+nome,
        'Até '+dPT(alvo)+', o fim do mês seguinte ao da cessação: o contrato acabou a '+dPT(fimR)+'. O Modelo 2 também serve para a cessação.'
        +(fev15Ces?' Como tinha redução de taxa pela duração, a data e o motivo comunicam-se ainda no Portal das Finanças até '+dPT(fev15Ces)+'.':'')
        +' Depois de a comunicares, silencia este aviso.',
        abrir,true);
    }
    /* a comunicação da duração (Portaria 110/2019 art. 2.º b); FAQ 5936 da
       AT): uma vez por período com redução — o contrato e cada renovação —,
       até 15 de fevereiro do ano seguinte ao início dele, haja ou não rendas.
       Só a redução pela duração (art. 72.º) a pede; a taxa das rendas
       moderadas (EBF art. 45.º-C) não. Um período que começou depois do dia
       em que o contrato acabou não existiu; e um que acabou antes do ano
       anterior já não pesa em nenhuma declaração por entregar. O «feito»
       grava pela chave do período (o ano do início), como a ficha */
    const ps=irsPeriodos(c),iniY=Y+'-01-01',vistos={};
    irsPrazosDeComunicacao(c).forEach(x=>{
      if(x.data||!x.prazo||vistos[x.chave])return;
      vistos[x.chave]=1;
      if(fimR&&x.periodoInicio>fimR)return;
      const i=ps.findIndex(p=>p.inicio===x.periodoInicio),prox=ps[i+1]&&ps[i+1].inicio?irsVespera(ps[i+1].inicio):'';
      let fimP=i>-1?(ps[i].fim||''):'';if(prox&&(!fimP||prox<fimP))fimP=prox;
      if(fimR&&(!fimP||fimR<fimP))fimP=fimR;
      if(fimP&&fimP<iniY)return;
      const ren=i>0,pr=ren?'a':'o',qual=(ren?'Esta renovação começou a ':'Este contrato começou a ')+dPT(x.periodoInicio);
      /* passado o dia, quem já a fez (a pessoa que começa a usar a app com
         contratos antigos) só tem de dizer quando */
      poe('fev15',c.id+':'+x.prazo,x.prazo,(ren?'Comunicar a renovação do contrato à AT — ':'Comunicar a duração do contrato à AT — ')+nome,
        'Nos contratos com redução de taxa pela duração, comunica-se uma vez, até 15/02 do ano seguinte ao início do contrato ou de cada renovação. '
        +(x.prazo<h
          ?qual+': o prazo para '+pr+' comunicar no Portal das Finanças era '+dPT(x.prazo)+'. Se já '+pr+' comunicaste, marca a comunicação com o dia em que a fizeste; se não, comunica-'+pr+' quanto antes.'
          :qual+': comunica-'+pr+' no Portal das Finanças até '+dPT(x.prazo)+', com a duração. Depois, marca a comunicação como feita e este aviso desaparece.'),
        abrir,true,Object.assign({evento:ren?'renovacao':'inicio'},pode?{acao:`pzComunicadaPergunta('${id}','${x.chave}')`,acaoTexto:'Marcar como comunicada'}:{}));
    });
    if(fev15Ces&&fimR>=iniY){
      poe('fev15',c.id+':'+fev15Ces+':cessacao',fev15Ces,'Comunicar a cessação do contrato à AT (Portaria 110/2019) — '+nome,
        'O contrato acabou a '+dPT(fimR)+' e tinha redução de taxa pela duração: até '+dPT(fev15Ces)+', comunica a data e o motivo da cessação no Portal das Finanças. Depois de comunicar, silencia este aviso.',
        abrir,true,{evento:'cessacao'});
    }
  });
  /* o Modelo 44: só para quem a página Declaração diz estar dispensado do
     recibo eletrónico no ano anterior, e só quando nele houve rendas */
  if(dispensaEm(Y)&&houveRecibosEmY){
    const fev=pzIso(new Date(ano,2,0)),alvo=fev>=PZ_MODELO44.fevereiroDesde?fev:ano+'-01-31';
    poe('modelo44',String(Y),alvo,'Modelo 44 — as rendas de '+Y,
      'Quem tem dispensa do recibo de renda eletrónico entrega, até '+dPT(alvo)+', a declaração anual das rendas (Modelo 44) no Portal das Finanças: as rendas recebidas em '+Y+', discriminadas. É ela que faz as vezes dos recibos que não se emitiram.',
      servicoLigado('fisco')?"go('fisco')":'',true);
  }
  if(houveRendasEmY){
    const alvo=vY.entrega.ate;
    poe('irs',String(Y),alvo,'Entregar o IRS — Anexo F de '+Y,
      'De '+irsDiaMes(vY.entrega.de)+' a '+irsDiaMes(alvo)+'.'+(servicoLigado('fisco')?' A página Declaração tem as linhas dos quadros 4.1 e 4.2 e o que ainda falta.':''),
      servicoLigado('fisco')?"go('fisco')":'',false);
  }

  // pessoas: inquilinos de contratos ativos + proprietários, com CC datado
  const ativos={};(db.contracts||[]).forEach(c=>{if(ctVivo(c))(c.tenantIds||[]).forEach(t=>{ativos[t]=1})});
  const vistos={};
  const pessoa=(p,papel)=>{
    if(!p||!p.ccValid||vistos[p.id])return;vistos[p.id]=1;
    /* a ficha da pessoa é dos Inquilinos ou dos Proprietários: sem o serviço
       ligado o prazo diz-se na mesma, mas não abre nada. A ficha, e não o
       formulário: num proprietário com conta ela manda o «Editar» para o perfil
       dele (pessoas.js:personView), e o formulário gravava só neste aparelho */
    poe('cc',p.id+':'+p.ccValid,p.ccValid,'Cartão de cidadão — '+(p.name||'pessoa'),
      'Caduca a '+dPT(p.ccValid)+'. Um contrato novo (ou renovado) precisa do documento válido.',
      servicoLigado(papel==='owner'?'owners':'tenants')?`personView('${papel}','${jsq(p.id)}')`:'',true);
  };
  (db.tenants||[]).forEach(t=>{if(ativos[t.id])pessoa(t,'tenant')});
  (db.owners||[]).forEach(o=>pessoa(o,'owner'));

  (db.properties||[]).forEach(p=>{
    if(p.energyValid){
      poe('energia',p.id+':'+p.energyValid,p.energyValid,'Certificado energético — '+(p.name||'imóvel'),
        'Expira a '+dPT(p.energyValid)+'. É obrigatório para anunciar e celebrar arrendamentos.',
        servicoLigado('properties')?`propView('${jsq(p.id)}')`:'',true);
    }
    (p.loans||[]).forEach(l=>{
      /* o fim de uma redução de spread temporária: a prestação volta a subir,
         pelo mesmo relógio do fim da fase fixa (credito.js:fimDaReducao) */
      const abrirCred=servicoLigado('credits')?`mortView('${jsq(p.id)}','${jsq(l.id)}')`:(servicoLigado('properties')?`propView('${jsq(p.id)}')`:'');
      if(Number(l.outstanding)>0&&fimDaReducaoMes(l)){
        const r1=servicoLigado('recurring')?loanRecOf(l):null;
        const fimR=fimDaReducao(l,db.transactions||[],h,r1&&r1.next),mR=fimDaReducaoMes(l);
        if(fimR&&mR<Math.round((Number(l.years)||0)*12))poe('spread',l.id+':'+fimR,fimR,'Fim da redução do spread — '+(l.name||l.bank||'crédito')+' ('+(p.name||'imóvel')+')',
          'A '+dPT(fimR)+' acaba a redução de spread: o spread passa de '+dec(taxa3(spreadEmVigor(l,mR-1)))+'% para '+dec(taxa3(spreadEmVigor(l,mR)))+'%, e a prestação sobe.',
          abrirCred,false);
      }
      if(l.type!=='mista'||!l.fixedYears||!(Number(l.outstanding)>0))return;
      /* o mesmo relógio da simulação (credito.js:fimDaFaseFixa): as prestações
         registadas, e não o calendário desde o início — os dois discordavam por
         anos num crédito introduzido a meio, e o aviso dizia uma data que as
         contas não usavam */
      const r0=servicoLigado('recurring')?loanRecOf(l):null;
      const fim=fimDaFaseFixa(l,db.transactions||[],h,r0&&r0.next);
      if(!fim)return;
      /* as taxas em vigor: com os produtos facultativos ligados (credito.js:spreadEmVigor, taxaFixaEmVigor) */
      const depois=taxa3((Number(l.euribor)||0)+spreadEmVigor(l));
      poe('taxa',l.id+':'+fim,fim,'Fim da taxa fixa — '+(l.name||l.bank||'crédito')+' ('+(p.name||'imóvel')+')',
        'A '+dPT(fim)+' a taxa passa de '+dec(taxaFixaEmVigor(l))+'% para Euribor+spread (hoje ~'+dec(depois)+'%). Bom momento para comparar propostas.',
        servicoLigado('credits')?`mortView('${jsq(p.id)}','${jsq(l.id)}')`:(servicoLigado('properties')?`propView('${jsq(p.id)}')`:''),false);
    });
  });

  return out.sort((a,b)=>(a.semData?1:0)-(b.semData?1:0)||a.dias-b.dias);
}

/* Os prazos por mostrar: os de prazosDe menos os silenciados.
   Recebe: hoje (opcional) — data ISO de referência, para os testes.
   Devolve: a mesma lista de prazosDe, filtrada pelos silenciados. */
function prazosAtivos(hoje){
  const s=(db.settings&&db.settings.prazosVistos)||{};
  return prazosDe(hoje).filter(p=>!s[p.chave]);
}

/* Silencia um prazo (esta ocorrência: a chave inclui a data — quando a data
   mudar, o aviso volta) e redesenha, com «Anular» por seis segundos.
   Recebe: chave — a chave do prazo, como vem de prazosDe.
   Devolve: nada — grava em settings.prazosVistos e redesenha a vista. */
function pzSilencia(chave){
  db.settings.prazosVistos=db.settings.prazosVistos||{};
  db.settings.prazosVistos[chave]=true;
  save();
  comDesfazer('Prazo silenciado — volta quando a data mudar.',()=>{
    delete db.settings.prazosVistos[chave];save();render();
  });
  render();
}

/* A janela de «Marcar como comunicada» de um aviso de fevereiro: o dia em que
   a comunicação da duração de um período (o contrato ou uma renovação) se fez
   no Portal. Proposto hoje enquanto o prazo não passou; depois dele, vazio —
   o 4.2A pergunta se foi a tempo, e um dia adivinhado responde por quem
   não o disse.
   Recebe: id — o id do contrato; chave — o ano do início do período ('AAAA',
   irs.js:irsPrazosDeComunicacao).
   Devolve: nada — abre a janela. */
function pzComunicadaPergunta(id,chave){
  const c=contract(id);if(!c)return;
  const recusa=motivoRecusa(c.propertyId,'contract.add',c);if(recusa)return toast(recusa);
  const k=String(chave),x=irsPrazosDeComunicacao(c).find(p=>p.chave===k);if(!x)return;
  const h=today(),dia=x.prazo&&h<=x.prazo?h:'',ren=x.periodoInicio!==c.start;
  openModal('Comunicação da duração',`<div class="form">
    <div class="hint">${ren?'A renovação que começou':'O contrato, que começou'} a ${esc(dPT(x.periodoInicio))}, comunica-se no Portal das Finanças até ${esc(dPT(x.prazo))}, com a duração. O quadro 4.2A pergunta se foi até esse dia.</div>
    <label>Comunicada a <span class="req">*</span><input id="pz_comdia" type="date" max="${esc(h)}" value="${esc(dia)}"></label></div>`,
    `<button class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button><button class="btn primary" data-toca="dados" data-click="pzMarcarComunicada('${jsq(id)}','${k}')">Marcar</button>`);
}

/* Marca a comunicação da duração de um período com o dia da janela
   (pzComunicadaPergunta), pela chave do período e com a marca das chaves
   novas (comunicacoesV=2), como a ficha (contrato.js:ctMarcarComunicada); um
   bloco por migrar migra antes (dados.js:migrarComunicacoes). Grava pelo
   caminho de sempre (save + render), e o aviso cala-se; «Anular» devolve o
   que lá estava.
   Recebe: id — o id do contrato; chave — o ano do início do período ('AAAA').
   Devolve: nada. */
function pzMarcarComunicada(id,chave){
  const c=contract(id);if(!c)return;
  const recusa=motivoRecusa(c.propertyId,'contract.add',c);if(recusa)return toast(recusa);
  const k=String(chave),dia=val('pz_comdia'),h=today();
  if(!/^\d{4}$/.test(k))return;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dia))return falhaCampo('pz_comdia','Indica o dia da comunicação.');
  if(dia>h)return falhaCampo('pz_comdia','O dia da comunicação não pode ser depois de hoje.');
  const f=normFisco(Object.assign({},fiscoDe(c)));
  if(f.comunicacoesV!==2)migrarComunicacoes({start:c.start,fisco:f});
  const antes=f.comunicacoes[k]||'';
  f.comunicacoes=Object.assign({},f.comunicacoes,{[k]:dia});f.comunicacoesV=2;
  c.fisco=f;
  closeModal();save();render();
  comDesfazer('Comunicação marcada como feita.',()=>{
    const c2=contract(id);if(!c2)return;
    const g=normFisco(Object.assign({},fiscoDe(c2))),com=Object.assign({},g.comunicacoes);
    if(antes)com[k]=antes;else delete com[k];
    g.comunicacoes=com;c2.fisco=g;save();render();
  });
}

/* A janela de «Marcar como enviado» do aviso do IHRU (RSAA): o dia em que a
   cópia do contrato foi à plataforma do IHRU. Proposto hoje enquanto o prazo
   não passou; depois dele, vazio — a isenção depende de ter sido a tempo.
   Recebe: id — o id do contrato.
   Devolve: nada — abre a janela. */
function pzIhruPergunta(id){
  const c=contract(id);if(!c)return;
  const recusa=motivoRecusa(c.propertyId,'contract.add',c);if(recusa)return toast(recusa);
  const prazo=pzPrazoIhru(c);if(!prazo)return;
  const h=today(),dia=h<=prazo?h:'';
  openModal('Envio ao IHRU',`<div class="form">
    <div class="hint">A cópia do contrato e o comprovativo da comunicação às Finanças vão à plataforma do IHRU até ${esc(dPT(prazo))}: só assim as rendas ficam isentas de IRS (RSAA).</div>
    <label>Enviado a <span class="req">*</span><input id="pz_ihru" type="date" max="${esc(h)}" value="${esc(dia)}"></label></div>`,
    `<button class="btn" data-toca="camada" data-click="closeModal()">Cancelar</button><button class="btn primary" data-toca="dados" data-click="pzMarcarIhru('${jsq(id)}')">Marcar</button>`);
}

/* Grava o dia do envio ao IHRU (fisco.ihru, da janela pzIhruPergunta): o aviso
   cala-se, e a Declaração conta a isenção se foi até ao prazo
   (irs.js:irsIsencao). Nunca antes da celebração nem depois de hoje.
   «Anular» devolve o que lá estava.
   Recebe: id — o id do contrato.
   Devolve: nada. */
function pzMarcarIhru(id){
  const c=contract(id);if(!c)return;
  const recusa=motivoRecusa(c.propertyId,'contract.add',c);if(recusa)return toast(recusa);
  const dia=val('pz_ihru'),h=today(),cel=fiscoDe(c).celebracao||c.start||'';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dia))return falhaCampo('pz_ihru','Indica o dia do envio.');
  if(dia>h)return falhaCampo('pz_ihru','O dia do envio não pode ser depois de hoje.');
  if(cel&&dia<cel)return falhaCampo('pz_ihru','O dia do envio não pode ser antes da celebração ('+dPT(cel)+').');
  const antes=fiscoDe(c).ihru||'';
  c.fisco=normFisco(Object.assign({},fiscoDe(c),{ihru:dia}));
  closeModal();save();render();
  comDesfazer('Envio ao IHRU marcado.',()=>{
    const c2=contract(id);if(!c2)return;
    c2.fisco=normFisco(Object.assign({},fiscoDe(c2),{ihru:antes}));save();render();
  });
}

/* O que falta (ou o que já passou) para um prazo, dito por extenso como o
   selo o mostra: «Passou há 17 dias», «É hoje», «Falta 1 dia», «Faltam 14 dias»;
   num aviso sem data, «Sem prazo».
   Recebe: p — o prazo (com dias, ou semData).
   Devolve: o texto. */
function pzQuando(p){
  if(p&&p.semData)return 'Sem prazo';
  const d=Number(p&&p.dias)||0;
  if(d<0)return 'Passou há '+(-d)+(d===-1?' dia':' dias');
  if(d===0)return 'É hoje';
  return d===1?'Falta 1 dia':'Faltam '+d+' dias';
}

/* A cor do selo de um prazo, pela regra do contrato visual: vermelho o que
   passou ou falta 7 dias ou menos, âmbar até 30, cinzento o resto.
   Recebe: p — o prazo (com urg, de pzUrg).
   Devolve: a classe do .badge ('red', 'amber' ou 'grey'). */
function pzSelo(p){return p.urg==='info'?'grey':p.urg==='breve'?'amber':'red'}

/* O título de um prazo partido em duas linhas curtas: o que há a fazer e de
   quem é, com a data-alvo — «Comunicar a cessação à AT» e «Estúdio Arroios ·
   30/09/2026». O título vem de prazosDe como «o quê — de quem»; a frase longa
   (o porquê e o como) fica para o «Pede atenção» (notificacoes.js:notifModal).
   Um aviso sem data diz só de quem é.
   Recebe: p — o prazo (com titulo e alvo, ou semData).
   Devolve: {titulo, onde} — texto por escapar. */
function pzPartes(p){
  const t=String((p&&p.titulo)||''),i=t.lastIndexOf(' — ');
  const titulo=i>0?t.slice(0,i):t,quem=i>0?t.slice(i+3):'';
  if(p&&p.semData)return {titulo,onde:quem};
  return {titulo,onde:(quem?quem+' · ':'')+dPT(p.alvo)};
}

/* HTML do cartão «Prazos legais e fiscais» da Visão geral (o canvas: um dos
   três cartões do «Pede atenção» no computador). Os quatro mais urgentes,
   cada um numa linha curta — o que há a fazer, de quem e quando, e o selo
   do que falta —, que abre o sítio certo (o contrato, a pessoa, o imóvel); o
   ✕ silencia esta ocorrência com «Anular» (pzSilencia). «Ver todos» abre o
   «Pede atenção» só com os prazos, onde cada um traz a frase inteira. Era um
   cartão que se recolhia (fechado, dizia quantos; aberto, ocupava o ecrã):
   com quatro linhas curtas e o resto a um toque, já não há o que recolher.
   Um prazo que se resolve no próprio aviso (o «Marcar como enviado» do IHRU,
   o «Marcar como comunicada» de fevereiro) leva o botão antes do ✕.
   Devolve: o HTML do cartão (texto), ou '' quando não há prazos na janela. */
function prazosCard(){
  /* o mesmo guarda do sino (espera.js:sabemosOEstado): um prazo silenciado
     noutro aparelho reaparecia aqui, com selo vermelho, até o estado chegar */
  if(!sabemosOEstado())return '';
  const lista=prazosAtivos();
  if(!lista.length)return '';
  /* sem «abrir» (o serviço que abria está desligado nesta conta) a linha não
     se apresenta como tocável: diz o prazo, e o ✕ continua a silenciar */
  const row=p=>{
    const x=pzPartes(p);
    const dentro=`<span class="vg-item-txt"><b>${esc(x.titulo)}</b><span class="small">${esc(x.onde)}</span></span><span class="badge ${pzSelo(p)}">${pzQuando(p)}</span>`;
    const feito=p.acao?`<button type="button" class="btn sm vg-feito" data-toca="camada" aria-label="${esc(p.acaoTexto)}: ${esc(x.titulo)}" data-click="${p.acao}">${esc(p.acaoTexto)}</button>`:'';
    return `<div class="vg-item">${p.abrir?`<button type="button" class="vg-item-abrir" data-toca="camada" data-click="${p.abrir}">${dentro}</button>`:`<div class="vg-item-abrir">${dentro}</div>`}${feito}
      <button type="button" class="btn sm ghost so-icone vg-silenciar" aria-label="Silenciar: ${esc(x.titulo)}" title="Silenciar até a data mudar" data-toca="dados" data-click="pzSilencia('${jsq(p.chave)}')">${ic('x',16)}</button></div>`;
  };
  return `<div class="card vg-cartao vg-prazos" id="pzCard">
    <div class="vg-card-cab"><h3 class="title vg-tit">Prazos legais e fiscais</h3>
      <button type="button" class="vg-ligacao vg-cab-acao" data-toca="camada" data-click="notifModal('prazos')">${lista.length>4?'Ver os '+lista.length:'Ver todos'}</button></div>
    <div class="vg-itens">${lista.slice(0,4).map(row).join('')}</div></div>`;
}

/* Lembretes de prazos para a ponte Android (o scheduleReminders junta-os aos
   dos movimentos): um por prazo não silenciado, no dia-alvo às 9h, mais um
   aviso 7 dias antes quando a antecedência o permite. Um aviso sem data não
   tem dia para lembrar.
   Devolve: lista de {id, at, title, text} com datas futuras. */
function prazosLembretes(){
  const at=iso=>{const d=new Date(iso+'T00:00:00');d.setHours(9,0,0,0);return d.getTime()};
  const list=[];
  prazosAtivos().forEach(p=>{
    if(p.semData)return;
    list.push({id:'pz_'+p.chave,at:at(p.alvo),title:'Prazo: '+p.titulo,text:p.sub});
    const antes=pzAddDias(p.alvo,-7);
    if(pzDias(antes)>0)list.push({id:'pz7_'+p.chave,at:at(antes),title:'Daqui a 7 dias: '+p.titulo,text:p.sub});
  });
  return list.filter(x=>x.at>Date.now());
}
