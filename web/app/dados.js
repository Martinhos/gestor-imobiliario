/* ================= ARMAZENAMENTO ================= */
/* Onde a nuvem guarda a sessão. Vive aqui, e não só lá, porque o guarda da
   espera (espera.js:sabemosOEstado) tem de saber se há sessão ANTES de a
   nuvem carregar: os ficheiros de web/app correm todos primeiro. O
   cloud/nucleo.js usa esta mesma constante, para não haver duas verdades. */
const LS_SESSAO='gi_cloud_user';
const KEY='gi_v13', OLDS=['gi_v12','gi_v11','gi_v10','gi_v9','gi_v8','gi_v6','gi_v5','gi_v4','gi_v3','gi_v2','gi_v1'];
let mem={};
/* lê do localStorage; se estiver bloqueado (modo privado), vale a cópia em memória desta sessão
   Recebe: k — a chave a ler (string, ex.: 'gi_v13').
   Devolve: o valor guardado (string), ou null se não existir nem no disco nem em memória. */
function rawGet(k){try{const v=localStorage.getItem(k);return v===null&&k in mem?mem[k]:v}catch(e){return k in mem?mem[k]:null}}
/* escreve no localStorage e numa cópia em memória; se o disco falhar, a app continua só em memória e avisa uma vez
   Recebe: k — a chave onde guardar; v — o valor, guardado como string.
   Devolve: nada — grava a chave (em memória sempre; no disco quando dá). */
function rawSet(k,v){mem[k]=String(v);try{localStorage.setItem(k,v)}catch(e){
  /* sem isto, «Guardado.» era mentira em modo privado ou com a quota cheia:
     um reinício levava a sessão toda sem nunca ter avisado */
  if(!rawSet._avisado){rawSet._avisado=1;
    setTimeout(function(){try{toast('Não consegui guardar neste aparelho — armazenamento cheio ou bloqueado. O que fizeres vive só nesta sessão.')}catch(x){}},0)}
}}

const STAMP=0.04;
/* taxa do imposto do selo sobre os juros: configurável em Definições, 4% por omissão
   Devolve: a taxa em fração (ex.: 0.04 para 4%). */
const stampPct=()=>{const v=Number((db&&db.settings||{}).stampPct);return isFinite(v)&&v>=0?v/100:STAMP};
/* Arredonda ao cêntimo.
   Recebe: v — o valor em euros (número).
   Devolve: o número com duas casas, no máximo. */
const r2=v=>Math.round(v*100)/100;
/* comissão de amortização antecipada, conforme a fase da taxa (mista: fixa até
   fixedYears, variável depois). A fase vem de loanMes — a mesma conta que o
   plano de amortização usa, para a comissão e a taxa nunca discordarem.
   Recebe: l — a hipoteca (usa type, amortFeeFix, amortFeeVar, fixedYears e as prestações registadas).
   Devolve: a comissão em fração (ex.: 0.02 para 2%). */
function amortFeeRate(l){
  const F=isFinite(Number(l.amortFeeFix))?Number(l.amortFeeFix)/100:0.02;
  const V=isFinite(Number(l.amortFeeVar))?Number(l.amortFeeVar)/100:0.005;
  if(l.type==='variavel')return V;
  if(l.type==='fixa')return F;
  return loanMes(l)<Math.round((Number(l.fixedYears)||5)*12)?F:V;
}
/* quanto ainda se pode amortizar nesta prestação: dívida atual + o capital do próprio registo (em edição)
   Recebe: t — o movimento em causa (pode ser null; só pesa se estiver em edição, t._edit); l — a hipoteca.
   Devolve: o valor amortizável em euros (número). */
function loanAvail(t,l){
  let a=Number(l.outstanding)||0;
  if(t&&t._edit&&t.id){const old=db.transactions.find(x=>x.id===t.id);
    if(old&&old.kind==='loan'&&old.loanId===l.id&&old.principal)a=r2(a+old.principal)}
  return a;
}
/* As categorias de origem. As da versão 2 das árvores (settings.catsV, fillCats:
   o IMT, o selo da compra e as taxas municipais nos Impostos; as Devoluções ao
   inquilino; a Indemnização e as Outras receitas prediais nas Rendas) entram uma
   vez nas árvores que já existem (CATS_NOVAS). */
const CATS0={
  'Impostos':['IMI','AIMI','IRS sobre rendas','Imposto do selo','Mais-valias','Outro imposto','IMT','Imposto do selo da compra','Taxas municipais'],
  'Condomínio':['Quota mensal','Quota extraordinária','Fundo de reserva'],
  'Seguros':['Multirriscos','Vida (crédito)','Renda garantida','Responsabilidade civil'],
  'Obras e benfeitorias':['Remodelação','Pintura','Canalização','Eletricidade','Cozinha','Casa de banho','Janelas'],
  'Manutenção e reparações':['Eletrodomésticos','Caldeira / AVAC','Pequenas reparações','Chaves e fechaduras','Pragas'],
  'Água, luz e gás':['Água','Eletricidade','Gás','Internet e TV'],
  'Gestão e mediação':['Comissão de arrendamento','Gestão do imóvel','Anúncios','Vistorias'],
  'Serviços profissionais':['Contabilidade','Advogado','Notário e registos','Certificado energético','Avaliação'],
  'Mobiliário e equipamento':['Mobiliário','Eletrodomésticos','Decoração'],
  'Limpeza e jardim':['Limpeza','Jardinagem','Recolha de lixo'],
  'Custos bancários':['Comissões','Amortização antecipada','Avaliação do banco'],
  'Crédito à habitação':['Prestação mensal','Amortização antecipada'],
  'Dívidas a terceiros':['Reembolso de empréstimo','Juros'],
  /* o que se devolve ao inquilino: a caução (gasto do ano em que se devolve) e uma
     renda (abate às rendas da linha do contrato, não é gasto) */
  'Devoluções ao inquilino':['Devolução da caução','Devolução de renda'],
  'Outros':[]
};
/* receitas: rendas, reembolsos, empréstimos recebidos… */
const CATS_IN0={
  'Rendas':['Renda mensal','Renda em atraso','Caução','Indemnização','Outras receitas prediais'],
  'Reembolsos':['Seguro','Condomínio','Inquilino','Estado'],
  'Empréstimos recebidos':['Família','Amigos','Outro'],
  'Subsídios e apoios':[],
  'Outras receitas':[]
};
/* O que a versão 2 das árvores acrescenta (settings.catsV=2, fillCats): por árvore,
   categoria → as subcategorias novas. Entram uma vez — quem as remover depois não as
   vê voltar. Numa categoria que já existe juntam-se as subcategorias que faltam; a
   categoria só se cria quando é nova nesta versão (nova:true), para não ressuscitar
   uma de origem que a pessoa mudou de nome ou removeu. */
const CATS_NOVAS={
  cats:{'Impostos':{subs:['IMT','Imposto do selo da compra','Taxas municipais']},
    'Devoluções ao inquilino':{subs:['Devolução da caução','Devolução de renda'],nova:true}},
  catsIn:{'Rendas':{subs:['Indemnização','Outras receitas prediais']}}
};
/* As categorias e subcategorias que o IRS lê, por um identificador fixo: o nome pode
   mudar à vontade, o id não (rev. 5 §5.1, D19). O id vive em settings.catIds, pela
   chave do nome atual ('Categoria' ou 'Categoria / Sub', como o irsMapa) e lê-se pelo
   catIrsId. Uma lista de ids, não de nomes. */
const CATS_DO_IRS=['rendas','rendas/renda-mensal','rendas/renda-em-atraso','rendas/caucao','rendas/indemnizacao',
  'rendas/outras-receitas-prediais','reembolsos','reembolsos/inquilino','reembolsos/condominio','reembolsos/seguro',
  'reembolsos/estado','impostos','impostos/imi','impostos/aimi','impostos/imposto-do-selo','devolucoes',
  'devolucoes/caucao','devolucoes/renda'];
/* De cada id, o nome de origem na sua árvore (catsIn: receitas; cats: despesas). É
   por ele que a migração (fillCats, catsV=2) dá o id às categorias de cada conta: só
   a quem ainda tem o nome de origem — uma renomeada antes fica sem id (não se adivinha). */
const CATS_IRS_ORIGEM={
  catsIn:{'Rendas':'rendas','Rendas / Renda mensal':'rendas/renda-mensal','Rendas / Renda em atraso':'rendas/renda-em-atraso',
    'Rendas / Caução':'rendas/caucao','Rendas / Indemnização':'rendas/indemnizacao','Rendas / Outras receitas prediais':'rendas/outras-receitas-prediais',
    'Reembolsos':'reembolsos','Reembolsos / Inquilino':'reembolsos/inquilino','Reembolsos / Condomínio':'reembolsos/condominio',
    'Reembolsos / Seguro':'reembolsos/seguro','Reembolsos / Estado':'reembolsos/estado'},
  cats:{'Impostos':'impostos','Impostos / IMI':'impostos/imi','Impostos / AIMI':'impostos/aimi','Impostos / Imposto do selo':'impostos/imposto-do-selo',
    'Devoluções ao inquilino':'devolucoes','Devoluções ao inquilino / Devolução da caução':'devolucoes/caucao',
    'Devoluções ao inquilino / Devolução de renda':'devolucoes/renda'}
};
const TAGS0=['Urgente','A reembolsar','Recorrente','Dedutível','Em disputa'];
/* ---- fiscal: o que o Anexo F e o Modelo 2 pedem, na forma em que a app o guarda ----
   A app resume, não declara: guarda o que a AT pergunta e aponta o que falta. */
/* o estado de um contrato perante a AT: por indicar (vazio), comunicado pelo Modelo 2
   («declarado»), ou «naoDeclarado» — uma escolha do senhorio, sem juízo da app */
const FISCO_ESTADOS=['','declarado','naoDeclarado'];
/* a finalidade do arrendamento, como o Modelo 2 a pergunta (a natureza no Anexo F sai daqui) */
const FISCO_FINALIDADES=[['hp','Habitação permanente'],['hnp','Habitação não permanente'],['nh','Não habitacional']];
/* as colunas de gastos do quadro 4.1 do Anexo F, a das obras dos 24 meses anteriores ao
   arrendamento, e «não dedutível» — o que o artigo 41.º do CIRS deixa de fora */
const IRS_COLUNAS=[['conservacao','Conservação e manutenção'],['condominio','Condomínio'],['imi','IMI'],['selo','Imposto do selo'],
  ['taxas','Taxas autárquicas'],['outros','Outros gastos'],['obras24','Obras antes do arrendamento (24 meses)'],['nao','Não dedutível']];
/* As colunas que o mapa das definições aceita: as do Anexo F (IRS_COLUNAS) e
   'confirmar' — depende do caso: a despesa não conta em coluna nenhuma até a pessoa a
   escolher na ficha dela, e aparece em «A tratar» com o nome e o valor (decisão do
   Martinho, D06/D07/D24–D27/D60/D61). Só o mapa a aceita: o irsCol de um movimento
   continua a ser só um id de IRS_COLUNAS (normTx). */
const IRS_MAPA_VALORES=IRS_COLUNAS.concat([['confirmar','A confirmar em cada despesa']]);
/* de cada categoria de origem (ou «Categoria / Sub») à coluna do Anexo F. Fora, por lei: os
   gastos financeiros (juros, comissões, seguro de vida do crédito), as depreciações, o
   mobiliário, os eletrodomésticos e a decoração; e o que acrescenta valor (beneficiação:
   uma cozinha nova, uma remodelação) não é conservação. O IMI e o selo têm coluna própria.
   O que a AT recusa é «não dedutível» (o IMT e o selo da compra, o fundo de reserva, o
   multirriscos, a responsabilidade civil, a reparação de eletrodomésticos, os registos e a
   avaliação); o que depende do caso fica 'confirmar' (os honorários, a caldeira, os
   consumos, a quota extraordinária, um imposto sem subcategoria, «Outros»). O que aqui não
   está fica também a confirmar (irs-papeis.js:irsColunaDe, origem 'omissao'). O AIMI é
   «não dedutível» fixo: o irsColunaDe ignora a escolha do movimento e do mapa. */
const IRS_MAPA0={
  'Impostos':'confirmar','Impostos / IMI':'imi','Impostos / AIMI':'nao','Impostos / IRS sobre rendas':'nao',
  'Impostos / Imposto do selo':'selo','Impostos / Mais-valias':'nao','Impostos / Outro imposto':'confirmar',
  'Impostos / IMT':'nao','Impostos / Imposto do selo da compra':'nao','Impostos / Taxas municipais':'taxas',
  'Condomínio':'condominio','Condomínio / Fundo de reserva':'nao','Condomínio / Quota extraordinária':'confirmar',
  'Seguros':'confirmar','Seguros / Vida (crédito)':'nao','Seguros / Multirriscos':'nao','Seguros / Responsabilidade civil':'nao',
  'Seguros / Renda garantida':'outros',
  'Obras e benfeitorias':'conservacao','Obras e benfeitorias / Remodelação':'nao','Obras e benfeitorias / Cozinha':'nao','Obras e benfeitorias / Casa de banho':'nao',
  'Manutenção e reparações':'conservacao','Manutenção e reparações / Eletrodomésticos':'nao','Manutenção e reparações / Caldeira / AVAC':'confirmar',
  'Água, luz e gás':'confirmar','Gestão e mediação':'outros',
  'Serviços profissionais':'confirmar','Serviços profissionais / Certificado energético':'outros',
  'Serviços profissionais / Notário e registos':'nao','Serviços profissionais / Avaliação':'nao',
  'Mobiliário e equipamento':'nao','Limpeza e jardim':'outros','Custos bancários':'nao',
  'Crédito à habitação':'nao','Dívidas a terceiros':'nao',
  'Devoluções ao inquilino':'confirmar','Devoluções ao inquilino / Devolução da caução':'outros',
  'Devoluções ao inquilino / Devolução de renda':'nao',
  'Outros':'confirmar'
};
/* A migração do mapa para a versão 2 (settings.irsMapaV, fillCats): as chaves de origem
   que mudaram de valor, com o valor ANTIGO de origem. Numa conta muda-se só a chave cujo
   valor gravado é ainda esse — o que a pessoa escolheu fica. As chaves novas do
   IRS_MAPA0 entram pelo Object.assign do fillCats. */
const IRS_MAPA_MIGRA={'Impostos':'taxas','Impostos / Outro imposto':'taxas','Seguros':'outros',
  'Água, luz e gás':'outros','Serviços profissionais':'outros','Outros':'outros'};
/* As notas das regras de origem que pedem uma explicação (a tabela da §1.5 do plano):
   quem mostra a regra ou a despesa «a confirmar» pode dizê-las. */
const IRS_MAPA_NOTAS={
  'Condomínio / Quota extraordinária':'Escolhe Conservação e manutenção no ano em que o condomínio paga a obra.',
  'Seguros / Multirriscos':'Só a parte do seguro obrigatório de incêndio, se a apólice a separar, em Conservação e manutenção.',
  'Manutenção e reparações / Caldeira / AVAC':'A inspeção e a manutenção da instalação deduzem-se; reparar ou trocar o aparelho não.'
};
const blank={v:13,properties:[],owners:[],tenants:[],contracts:[],transactions:[],settlements:[],templates:[],recurring:[],groups:[],visits:[],
  settings:{growth:2,inflation:2,years:10,theme:'auto',capTarget:5,quota:100,payTax:true,stampPct:4,
            cats:JSON.parse(JSON.stringify(CATS0)),catsIn:JSON.parse(JSON.stringify(CATS_IN0)),tags:TAGS0.slice(),
            /* as árvores e o mapa já nascem na versão 2, e as categorias do IRS já com
               o id. As marcas catsV e irsMapaV NÃO vivem aqui: a nuvem junta o blank
               por baixo das definições do servidor (nucleo.js:normalizarDaChave,
               nucleo.js:rebuildDb — Object.assign({}, blank.settings, dados)), e uma
               marca vinda daqui fazia uma conta antiga saltar a migração. Põe-nas a
               primeira passagem pelo fillCats, onde a migração não muda nada. */
            catIds:catIdsDeOrigem(CATS0,CATS_IN0),
            irsMapa:JSON.parse(JSON.stringify(IRS_MAPA0)),
            /* o que só o senhorio sabe e muda o Anexo F (fisco.js, «A tua situação»):
               tributação conjunta, a letra de cada proprietário (A ou B), a dispensa
               dos recibos eletrónicos (Modelo 44) e os outros rendimentos coletáveis
               do agregado por ano, para simular o englobamento; e a situação de cada
               ano dos rendimentos (porAno), que manda sobre os campos de topo
               (normIrsDefs) */
            irs:{conjunta:false,titulares:{},dispensaRecibos:false,outrosRendimentos:{},porAno:{}}}};

/* Uma data AAAA-MM-DD que existe no calendário: 2026-02-30 não passa.
   Recebe: s — o valor tal como veio (qualquer tipo).
   Devolve: true quando é uma data ISO que existe. */
function dataExiste(s){
  const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof s==='string'?s:'');if(!m)return false;
  const d=new Date(Number(m[1]),Number(m[2])-1,Number(m[3]));
  return d.getFullYear()===Number(m[1])&&d.getMonth()===Number(m[2])-1&&d.getDate()===Number(m[3]);
}
/* Verdadeiro, falso, ou por responder: só true e false passam, o resto é null.
   Recebe: v — o valor tal como veio.
   Devolve: true, false ou null. */
const simNaoNulo=v=>v===true||v===false?v:null;
/* Os ids das categorias do IRS nas árvores de origem: a cada nome de origem
   (CATS_IRS_ORIGEM) que exista na árvore, o seu id. É o catIds do blank e o
   ponto de partida da migração (fillCats).
   Recebe: cats, catsIn — as duas árvores ({categoria: [subcategorias]}).
   Devolve: um objeto novo {cats:{chave:id}, catsIn:{chave:id}}. */
function catIdsDeOrigem(cats,catsIn){
  const out={cats:{},catsIn:{}},arv={cats:cats,catsIn:catsIn};
  ['cats','catsIn'].forEach(tk=>{const chaves=chavesDaArvore(arv[tk]);
    Object.keys(CATS_IRS_ORIGEM[tk]).forEach(k=>{if(chaves.has(k))out[tk][k]=CATS_IRS_ORIGEM[tk][k]})});
  return out;
}
/* As chaves de uma árvore de categorias, como o irsMapa e o catIds as escrevem:
   'Categoria' e 'Categoria / Sub'. Vai pela árvore, e não partindo o texto: um
   nome pode ter ' / ' dentro (Caldeira / AVAC).
   Recebe: arv — a árvore ({categoria: [subcategorias]}; o que não for, vale vazia).
   Devolve: um Map chave → {cat, sub} (sub '' na da categoria); a primeira ganha. */
function chavesDaArvore(arv){
  const m=new Map();
  if(!arv||typeof arv!=='object'||Array.isArray(arv))return m;
  Object.keys(arv).forEach(c=>{if(!m.has(c))m.set(c,{cat:c,sub:''});
    (Array.isArray(arv[c])?arv[c]:[]).forEach(s=>{if(typeof s!=='string'||!s)return;const k=c+' / '+s;if(!m.has(k))m.set(k,{cat:c,sub:s})})});
  return m;
}
/* id único para qualquer registo novo; onde não há crypto.randomUUID, serve data + aleatório
   Devolve: uma string única (UUID, ou 'id' + data + aleatório como recurso). */
function uid(){try{return crypto.randomUUID()}catch(e){return 'id'+Date.now()+Math.random().toString(16).slice(2,8)}}
/* A forma de um id: a mesma que o servidor aceita (worker/src/lib/http.js:badId).
   O uid() e o servidor só fazem ids assim. Os que fogem a ela só chegam de
   fora — uma cópia colada ou importada à mão, a ficha que outra pessoa gravou
   numa casa partilhada —, e um id acaba dentro de uma ação declarada (o
   data-click de um botão, f('…')): é aqui, à entrada, que se garante que
   nunca leva uma plica, uma aspa ou um parêntese. */
const ID_FORMA=/^[A-Za-z0-9_-]{1,64}$/;
/* Um id com a forma certa passa tal e qual. Um fora dela troca-se por um que a
   tem — e sempre o MESMO para o mesmo texto (um hash, e não um uid()), para as
   referências a ele (o propertyId de um movimento, os ownerIds de um imóvel)
   continuarem a apontar para o mesmo registo sem ninguém as ter de seguir. O
   vazio fica vazio (é «sem ligação»), e um número passa: não fecha string
   nenhuma.
   Recebe: v — o id, ou a referência a um, tal como veio.
   Devolve: o próprio v quando já serve; senão 'id_' e dezasseis dígitos hexadecimais. */
function idSeguro(v){
  if(v==null||v===''||(typeof v==='number'&&isFinite(v)))return v;
  if(typeof v==='string'&&ID_FORMA.test(v))return v;
  const s=typeof v==='string'?v:(JSON.stringify(v)||String(v));
  let a=0x811c9dc5,b=0x9747b28c;
  for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);a=Math.imul(a^c,0x01000193);b=Math.imul(b^c,0x5bd1e995)}
  return 'id_'+(a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
}
/* uma lista de ids pelo idSeguro (o que não for lista vira lista vazia)
   Recebe: l — a lista de ids tal como veio.
   Devolve: um array novo com cada id pelo idSeguro. */
const idsSeguros=l=>(Array.isArray(l)?l:[]).map(idSeguro);
/* um mapa cujas chaves são ids (as quotas por dono, as partes de uma divisão),
   com as chaves pelo idSeguro
   Recebe: o — o objeto tal como veio.
   Devolve: um objeto novo com as mesmas entradas e as chaves pelo idSeguro. */
const chavesSeguras=o=>{const r={};if(o&&typeof o==='object')Object.keys(o).forEach(k=>{r[idSeguro(k)]=o[k]});return r};
/* versões anteriores guardavam a imagem em base64 dentro dos dados (rebentava a quota do localStorage);
   agora fica só em IndexedDB. O que vier em "data" é migrado para lá e retirado dos dados. */
const INLINE_DATA=[];
/* normaliza os metadados de um anexo: omissões preenchidas, o id pelo idSeguro, e o
   base64 das versões antigas despachado para o INLINE_DATA
   Recebe: f — os metadados em bruto (objeto parcial, ou nada).
   Devolve: um objeto novo {id,name,type,size,added}, já sem o "data". */
const normFile=f=>{const o=Object.assign({id:uid(),name:'',type:'',size:0,added:''},f||{});
  o.id=idSeguro(o.id);
  if(o.data){INLINE_DATA.push({id:o.id,data:o.data});delete o.data}return o};
/* despacha para o IndexedDB os anexos que o normFile apanhou em base64 e grava os dados já sem eles;
   o que já existir lá não é reescrito, e uma falha num ficheiro não trava os outros
   Devolve: nada — esvazia INLINE_DATA, envia os anexos para o IndexedDB e grava a base no fim. */
function migrateInline(){
  if(!INLINE_DATA.length)return;
  const list=INLINE_DATA.splice(0);
  Promise.all(list.map(x=>idbGet(x.id).then(b=>{if(b)return;return fetch(x.data).then(r=>r.blob()).then(bl=>idbPut(x.id,bl))}).catch(()=>{})))
    .then(()=>{save()});
}
/* Os produtos facultativos de uma hipoteca (seguros, cartões, ordenado
   domiciliado…): uma lista FECHADA, a mesma e pela mesma ordem no servidor
   (worker/src/lib/fine.js, a leitura da FINE). Cada produto guardado na
   hipoteca é um destes tipos; um tipo desconhecido passa a 'outro'. Vive aqui,
   ao lado do normLoan, porque a base é o primeiro ficheiro a carregar: o
   formulário (imovel.js:loanProdSect), a ficha (creditos.js:mortFicha) e a
   leitura da FINE (fine.js:fineLimparProdutos) leem-na todos. A «Redução de
   spread» é a única que a lista do servidor não tem: é o spread mais baixo
   que o banco dá durante um tempo, contado em meses desde o início
   (normProduto: meses), e não uma venda associada que a FINE indique. */
var PRODUTOS_HIPOTECA=[
  {id:'seguro_vida',nome:'Seguro de vida'},
  {id:'seguro_multirriscos',nome:'Seguro multirriscos'},
  {id:'ordenado',nome:'Ordenado domiciliado'},
  {id:'debitos',nome:'Débitos diretos domiciliados'},
  {id:'cartao_credito',nome:'Cartão de crédito'},
  {id:'cartao_debito',nome:'Cartão de débito'},
  {id:'poupanca',nome:'Poupança ou PPR'},
  {id:'conjunto',nome:'Todos os produtos facultativos'},
  {id:'reducao_spread',nome:'Redução de spread'},
  {id:'outro',nome:'Outro produto'},
];
/* A redução de um produto, em pontos percentuais: um número em (0, 3],
   arredondado às milésimas. O que não for número, ou ficar fora da gama
   (depois de arredondado), não é redução nenhuma.
   Recebe: v — o valor (só um number conta; um texto já passou pelo numTaxa).
   Devolve: o número, ou null. */
function produtoReducao(v){
  if(typeof v!=='number'||!isFinite(v))return null;
  const r=Math.round(v*1000)/1000;
  return r>0&&r<=3?r:null;
}
/* Os meses de uma redução de spread temporária: um inteiro de 1 a 600 (os 50
   anos do prazo mais longo). O que não for um número inteiro nessa gama não é
   duração nenhuma.
   Recebe: v — o valor (só um number conta; o texto do campo já passou pelo
   imovel.js:loanProdColher).
   Devolve: o número, ou null. */
function produtoMeses(v){
  return typeof v==='number'&&Number.isInteger(v)&&v>=1&&v<=600?v:null;
}
/* normaliza um produto facultativo de uma hipoteca: o id seguro (ou um novo),
   o tipo da lista fechada (PRODUTOS_HIPOTECA, senão 'outro'), as reduções do
   spread e da TAN (produtoReducao, null quando não há), os meses que dura
   (produtoMeses: só na «Redução de spread»; nos outros tipos é sempre null) e
   se está ligado.
   Recebe: x — o produto em bruto (objeto parcial, ou nada).
   Devolve: um objeto novo {id, tipo, spread, tan, meses, ativo}. */
function normProduto(x){
  const o=x&&typeof x==='object'&&!Array.isArray(x)?x:{};
  const tipo=PRODUTOS_HIPOTECA.some(p=>p.id===o.tipo)?o.tipo:'outro';
  return {id:idSeguro(o.id||uid()),tipo,
    spread:produtoReducao(o.spread),tan:produtoReducao(o.tan),meses:tipo==='reducao_spread'?produtoMeses(o.meses):null,ativo:o.ativo===true};
}
/* normaliza uma hipoteca: omissões preenchidas, campos extintos (active, taeg, mtic) fora, anexos pelo normFile
   e os produtos facultativos pelo normProduto (o spread e a rate são a BASE, sem eles: a taxa em vigor
   é a de credito.js:spreadEmVigor e taxaFixaEmVigor)
   Recebe: l — a hipoteca em bruto (objeto parcial de qualquer versão, ou nada).
   Devolve: um objeto novo com todos os campos da hipoteca preenchidos. */
function normLoan(l){const o=Object.assign({id:uid(),name:'',bank:'',outstanding:0,years:30,type:'fixa',
  rate:0,fixedYears:5,euribor:0,spread:0,index:'6m',start:'',stampTax:true,amortFeeFix:2,amortFeeVar:0.5,files:[],produtos:[]},l||{});
  o.id=idSeguro(o.id);delete o.active;delete o.taeg;delete o.mtic;
  if(o.stampTax===undefined)o.stampTax=true;
  o.produtos=(Array.isArray(o.produtos)?o.produtos:[]).filter(x=>x&&typeof x==='object'&&!Array.isArray(x)).map(normProduto);
  o.files=(o.files||[]).map(normFile);return o}
/* normaliza uma visita a um imóvel: quem vem (texto livre — ainda não é
   inquilino, não há ficha), onde, quando (data + horas), estado, desfecho
   e comentários. O contacto é opcional, para confirmar ou remarcar.
   Recebe: v — a visita em bruto (objeto parcial, ou nada).
   Devolve: um objeto novo com todos os campos da visita preenchidos. */
function normVisit(v){const o=Object.assign({id:uid(),propertyId:'',roomId:'',nomes:'',contacto:'',
  date:'',start:'',end:'',estado:'agendada',resultado:'',notas:''},v||{});
  o.id=idSeguro(o.id);o.propertyId=idSeguro(o.propertyId);o.roomId=idSeguro(o.roomId);
  return o}
/* normaliza uma ficha de pessoa (dono ou inquilino): campos em falta ficam vazios, anexos pelo normFile.
   houseId é o imóvel a que a ficha está presa (vazio numa ficha só minha): é
   com ele que a ficha de um inquilino criada por um colaborador sobe como
   registo desse imóvel, mesmo sem contrato — persiste e mantém o que vier.
   pais é o país de residência de quem não tem NIF português (o Anexo F pede o
   código do país nesse caso); retem diz que o inquilino retém IRS na fonte
   (uma empresa com contabilidade organizada) — a app não decide isso, regista;
   retemVisto é o «confirmei: este inquilino não retém», que cala o aviso de um
   inquilino empresa sem retenção (D58).
   Recebe: p — a ficha em bruto (objeto parcial, ou nada).
   Devolve: um objeto novo com todos os campos da ficha preenchidos. */
function normPerson(p){const o=Object.assign({id:uid(),name:'',phone:'',email:'',nif:'',gender:'',marital:'',
  nationality:'Portuguesa',birth:'',cc:'',ccValid:'',taxAddress:'',notes:'',files:[],houseId:'',pais:'',retem:false,retemVisto:false},p||{});
  o.id=idSeguro(o.id);o.houseId=idSeguro(o.houseId);
  o.pais=String(o.pais||'');o.retem=!!o.retem;o.retemVisto=o.retemVisto===true;
  o.files=(o.files||[]).map(normFile);return o}
/* normaliza a lista de tarefas de um imóvel ou de um contrato (tarefas.js): as
   secções pela ordem em que foram criadas, e as tarefas, cada uma presa a uma
   secção ou a nenhuma (seccao vazia). Uma tarefa que aponte para uma secção que
   já não existe passa para «sem secção» em vez de desaparecer; feitaEm é o dia
   em que foi marcada como cumprida, e só fica numa tarefa cumprida; notas é o
   texto livre da tarefa, aparado nas pontas ('' sem notas). As secções fazem
   uma árvore: pai é o id da secção onde está ('' no topo), e a ordem entre
   irmãs é a do array; uma mãe que não existe, ou que fecha um ciclo, leva-a
   para o topo.
   Recebe: t — a lista em bruto ({seccoes, itens}, parcial, ou nada).
   Devolve: um objeto novo {seccoes:[{id,nome,pai}], itens:[{id,nome,seccao,feita,feitaEm,notas}]}. */
function normTarefas(t){
  const o=t&&typeof t==='object'&&!Array.isArray(t)?t:{};
  const seccoes=(Array.isArray(o.seccoes)?o.seccoes:[]).filter(x=>x&&typeof x==='object')
    .map(x=>({id:idSeguro(x.id||uid()),nome:String(x.nome||'').trim(),pai:idSeguro(x.pai||'')}));
  const ids=seccoes.map(x=>x.id);
  /* a mãe de uma secção tem de existir e não pode ser ela nem fechar um ciclo
     (fusões a três de dois aparelhos podem cruzar dois «mover»): senão vai para o topo */
  const porId=new Map(seccoes.map(s=>[s.id,s]));
  seccoes.forEach(s=>{
    if(!s.pai||!porId.has(s.pai)||s.pai===s.id){s.pai='';return}
    // sobe pelas mães: voltar a ela é um ciclo (a primeira do ciclo pela ordem vai para o topo);
    // um ciclo mais acima, que não passa por ela, desfaz-se quando chegar a vez de uma das que o fecham
    const vistos=new Set([s.id]);
    for(let p=porId.get(s.pai);p&&p.pai;p=porId.get(p.pai)){
      if(p.pai===s.id){s.pai='';break}
      if(vistos.has(p.pai))break;
      vistos.add(p.id);
    }
  });
  const itens=(Array.isArray(o.itens)?o.itens:[]).filter(x=>x&&typeof x==='object')
    .map(x=>{const feita=!!x.feita,sec=idSeguro(x.seccao||'');
      return {id:idSeguro(x.id||uid()),nome:String(x.nome||'').trim(),seccao:ids.indexOf(sec)>-1?sec:'',
        feita:feita,feitaEm:feita&&/^\d{4}-\d{2}-\d{2}$/.test(String(x.feitaEm||''))?String(x.feitaEm):'',
        notas:typeof x.notas==='string'?x.notas.trim():''}});
  return {seccoes:seccoes,itens:itens};
}
/* normaliza um imóvel e migra o que mudou entre versões: equity passa a purchase, o crédito único
   vira lista de hipotecas, quartos em texto ganham id, e quotas de donos removidos são descartadas.
   Os campos fiscais (o que o Anexo F e o Modelo 2 pedem por imóvel): distrito, código da
   freguesia (seis dígitos, da caderneta ou da nota do IMI), tipo de prédio (U/R), tipologia,
   VPT e data de aquisição. O vpt das versões antigas deixou de ser apagado — é o mesmo valor,
   e o rateio dos gastos num imóvel arrendado por partes faz-se por ele.
   As despesas fixas do imóvel, que criam planeados sozinhas (planeados.js:syncPropRecs):
   imi (€/ano), condominio (€/mês), seguro (€/ano) e seguroMes (1–12; 0 é o mês corrente
   quando o planeado nasce). Zero é «sem valor»: não há planeado.
   As tarefas (tarefas.js) passam pelo normTarefas.
   O que o IRS precisa da casa para lá da caderneta (o Anexo F é por titular e por
   ano): comproprietariosFora (normForaDaApp: null é «não confirmado», [] «não há
   outros», ou os de fora com nome e quota — D08), quotasHist (normQuotasHist: as
   quotas que valeram até cada data — D29; estes dois, na nuvem, só o servidor os
   escreve), vendido (o dia da venda, ou '' — D33, imovelVendido), subarrendamento
   ({ativo, nifSenhorio, rendaMensal}: «arrendo este imóvel e subarrendo-o», o quadro 5
   — D52) e afetacao (a da caderneta, que decide o AIMI — D71). Cada um com lixo
   volta à omissão.
   Recebe: p — o imóvel em bruto, de qualquer versão dos dados (ou nada).
   Devolve: um objeto novo com o imóvel completo e já migrado. */
function normProp(p){
  const o=Object.assign({id:uid(),name:'',address:'',use:'investimento',rentalMode:'inteiro',rooms:[],
    value:0,purchase:0,ownerIds:[],ownerShares:{},notes:'',listing:'',photos:[],loans:[],
    parish:'',concelho:'',freguesia:'',fraction:'',floor:'',street:'',doorNumber:'',postalCode:'',locality:'',registry:'',matrix:'',licence:'',energyCert:'',energyClass:'',energyValid:'',
    distrito:'',freguesiaCodigo:'',tipoPredio:'',tipologia:'',vpt:0,purchaseDate:'',imi:0,condominio:0,seguro:0,seguroMes:0,
    comproprietariosFora:null,quotasHist:[],vendido:'',subarrendamento:null,afetacao:''},p||{});
  o.id=idSeguro(o.id);o.ownerIds=idsSeguros(o.ownerIds);
  ['imi','condominio','seguro'].forEach(k=>{o[k]=Math.max(0,Math.round((Number(o[k])||0)*100)/100)});
  o.seguroMes=Math.min(12,Math.max(0,Math.round(Number(o.seguroMes)||0)));
  if(!o.purchase&&p&&p.equity)o.purchase=p.equity;   /* v12 chamava-lhe capital próprio */
  delete o.equity;
  /* v8 tinha um crédito único; passa a ser a primeira hipoteca da lista */
  if(!o.loans.length&&o.loan&&o.loan.active)o.loans=[Object.assign({},o.loan,{name:'Aquisição'})];
  if(!o.loans.length&&Array.isArray(p&&p.loans))o.loans=p.loans.slice();
  o.loans=(o.loans||[]).map(normLoan).map(l=>Object.assign(l,{name:l.name||l.bank||'Hipoteca'}));
  ['imiRate','status','monthlyRent','rentIncrease','tenant','loan','loanId'].forEach(k=>{delete o[k]});
  o.distrito=String(o.distrito||'');
  o.freguesiaCodigo=String(o.freguesiaCodigo||'').replace(/\D/g,'').slice(0,6);
  o.tipoPredio=(o.tipoPredio==='U'||o.tipoPredio==='R')?o.tipoPredio:'';
  o.tipologia=/^T\d$/.test(String(o.tipologia||''))?String(o.tipologia):'';
  o.vpt=Math.max(0,Number(o.vpt)||0);
  o.purchaseDate=/^\d{4}-\d{2}-\d{2}$/.test(String(o.purchaseDate||''))?String(o.purchaseDate):'';
  o.rooms=(o.rooms||[]).map(r=>{const q=typeof r==='string'?{id:uid(),name:r}:Object.assign({id:uid(),name:''},r);q.id=idSeguro(q.id);return q});
  o.photos=(o.photos||[]).map(normFile);
  /* as quotas são por dono: as chaves passam pela mesma troca dos ownerIds */
  const osh=chavesSeguras(o.ownerShares),sh={};
  Object.keys(osh).forEach(k=>{const v=Number(osh[k]);if(o.ownerIds.indexOf(k)>-1&&isFinite(v)&&v>=0)sh[k]=v});
  o.ownerShares=sh;
  o.tarefas=normTarefas(o.tarefas);
  o.comproprietariosFora=normForaDaApp(o.comproprietariosFora);
  o.quotasHist=normQuotasHist(o.quotasHist);
  o.vendido=dataExiste(o.vendido)?o.vendido:'';
  const sub=o.subarrendamento&&typeof o.subarrendamento==='object'&&!Array.isArray(o.subarrendamento)?o.subarrendamento:{};
  const rm=Number(sub.rendaMensal);
  o.subarrendamento={ativo:sub.ativo===true,nifSenhorio:String(sub.nifSenhorio==null?'':sub.nifSenhorio).replace(/\D/g,'').slice(0,9),
    rendaMensal:typeof sub.rendaMensal!=='boolean'&&isFinite(rm)&&rm>0?Math.round(rm*100)/100:0};
  o.afetacao=['habitacao','comercio','servicos','industria','outros'].indexOf(o.afetacao)>-1?o.afetacao:'';
  return o;
}
/* Os comproprietários de uma casa que não têm conta na app (D08): null é «não
   confirmado» (a casa conta como só dos donos com conta, e a Declaração pergunta);
   [] é «confirmado: não há outros»; senão cada um com {id, nome, quota}, a quota em
   % da casa inteira, 0 < quota < 100 (ao centésimo), e o nome até 80 caracteres —
   as regras do servidor (worker/src/lib/acesso.js:validarFora), para a cópia
   normalizada ser igual à dele. Um sem nome ou sem quota válida cai (o que lê também
   o ignora, saldos.js:quotasForaLimpos); se as quotas somam 100 ou mais, a lista não faz sentido e volta a
   null (por confirmar), em vez de se cortar alguém à sorte. Um sem id ganha um
   derivado do nome e da posição — sempre o mesmo, para dois aparelhos normalizarem
   igual (um uid() fazia a casa parecer mexida e subir); com o id repetido, fica o
   primeiro (a fusão a três junta as listas pelo id).
   Recebe: v — o valor tal como veio.
   Devolve: null, ou um array novo de {id, nome, quota}. */
function normForaDaApp(v){
  if(!Array.isArray(v))return null;
  const out=[],vistos=new Set();
  v.forEach((x,i)=>{
    if(!x||typeof x!=='object'||Array.isArray(x))return;
    const q=typeof x.quota==='boolean'?NaN:Math.round(Number(x.quota)*100)/100;
    const nome=typeof x.nome==='string'?x.nome.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,80):'';
    if(!nome||!isFinite(q)||q<=0||q>=100)return;
    const id=x.id!=null&&x.id!==''?idSeguro(String(x.id)):idSeguro('fora '+i+' '+nome);
    if(vistos.has(id))return;
    vistos.add(id);out.push({id:id,nome:nome,quota:q});
  });
  return out.reduce((s,x)=>s+Math.round(x.quota*100),0)<10000?out:null;
}
/* O histórico das quotas de uma casa (D29): cada entrada é o que valeu até esse dia,
   inclusive — {ate, ownerIds, ownerShares, fora}; o estado de hoje é o da própria
   casa. Uma entrada sem data válida cai; as quotas só dos donos dessa entrada, como no
   normProp; o fora pelo normForaDaApp. Fica por ordem de ate e, com duas no mesmo dia,
   fica a primeira (a segunda é um estado que não chegou a valer um dia).
   Recebe: l — a lista tal como veio.
   Devolve: um array novo, ordenado por ate. */
function normQuotasHist(l){
  const out=[],dias={};
  (Array.isArray(l)?l:[]).forEach(x=>{
    if(!x||typeof x!=='object'||Array.isArray(x)||!dataExiste(x.ate)||dias[x.ate])return;
    dias[x.ate]=1;
    const ids=idsSeguros(x.ownerIds),sh0=chavesSeguras(x.ownerShares),sh={};
    Object.keys(sh0).forEach(k=>{const v=Number(sh0[k]);if(ids.indexOf(k)>-1&&typeof sh0[k]!=='boolean'&&isFinite(v)&&v>=0)sh[k]=v});
    out.push({ate:x.ate,ownerIds:ids,ownerShares:sh,fora:normForaDaApp(x.fora)});
  });
  return out.sort((a,b)=>a.ate<b.ate?-1:a.ate>b.ate?1:0);
}
/* Um imóvel vendido até um dia (D33): sai das listas do dia a dia, e as rendas e os
   gastos ficam na Declaração dos anos em que foi da pessoa.
   Recebe: p — o imóvel; hoje (opcional) — 'AAAA-MM-DD' (por omissão, o dia de hoje).
   Devolve: true quando tem a data da venda e ela é até esse dia, inclusive. */
function imovelVendido(p,hoje){
  const v=p&&typeof p.vendido==='string'?p.vendido:'';
  return !!v&&v<=(hoje||today());
}
/* normaliza o bloco fiscal de um contrato: o estado perante a AT (FISCO_ESTADOS — o vazio
   é «por indicar»; «naoDeclarado» é uma escolha do senhorio, não um erro da app), o número
   que a AT atribui ao contrato na entrega do Modelo 2, a finalidade, a data de celebração,
   se é renovável, as renovações (cada uma com id, início e fim — o quadro 4.2A do Anexo F
   pede as datas da última) e o motivo da cessação em texto livre (cessacaoMotivo, o
   antigo: não se migra, mostra-se como nota).
   A cessação (D02, D09, D10, D14, D39): cessacao = {data, motivo} — o dia em que o
   contrato acabou mesmo ('' enquanto não acabou) e o código do motivo no quadro 10
   ('01'…'12'; a lista vive na versão do ano, irsAno(ano).quadro10.motivos). O c.end é
   sempre o termo estipulado e nunca leva a data da cessação.
   E o que mexe na taxa: as comunicações da duração já feitas ({'AAAA': 'AAAA-MM-DD'} —
   desde a marca comunicacoesV=2 a chave é o ano do INÍCIO do período, o contrato
   inicial ou uma renovação, e não o ano dos rendimentos: comunica-se uma vez por
   período, D01; a migração das chaves antigas é do normContract, que sabe as datas),
   se a renda passa os 150 % do limite do concelho (CIRS art. 72.º n.º 23: true, false
   ou null — por indicar), a renda do contrato anterior no mesmo imóvel (n.º 24: euros
   ≥ 0, 0 é «não se aplica»), a isenção ('', 'paa', 'rsaa', 'pma', 'pmae', 'prerau' —
   EBF 46.º-A, quadro 6H — ou 'al' — EBF 74.º-A, quadro 6F; os detalhes de cada uma
   vivem na versão do ano, irs-AAAA.js:isencoes) e as condições dela: ihru (o dia em
   que o contrato do RSAA foi ao IHRU, D46), nrau3536 (o contrato anterior ao RAU está
   sujeito aos arts. 35.º/36.º do NRAU) e alRegistado2022 (AL registado até 31/12/2022
   e contrato inscrito até 31/12/2024) — D18.
   O resto que o IRS pergunta ao contrato: empresaHabitacao (inquilino pessoa coletiva:
   o contrato identifica quem lá mora e proíbe a sublocação? — D47), consumosIncluidos
   (a renda inclui água, luz e gás, o campo 30 da Modelo 2 — D26), obrasSemOutroUso
   (nos 24 meses antes o imóvel esteve só à espera de inquilino? art. 41.º n.º 7 —
   D28), extrasMensais (móveis, equipamentos e serviços pagos à parte, € por mês, para
   o limite dos 10 % — D48) e atualizacao2023 ('sim', 'nao' ou '' — a renda de 2023
   subiu mais de 2 %? — D76). As perguntas de sim/não são true, false ou null (por
   responder); cada campo com lixo volta à omissão.
   Recebe: f — o bloco em bruto (objeto parcial, ou nada).
   Devolve: um objeto novo com todos os campos do bloco preenchidos. */
function normFisco(f){
  const o=Object.assign({estado:'',numero:'',finalidade:'',celebracao:'',renovavel:null,renovacoes:[],cessacaoMotivo:'',
    cessacao:null,comunicacoes:{},comunicacoesV:0,rendaAcimaDoLimite:null,rendaAnterior:0,isencao:'',ihru:'',
    nrau3536:null,alRegistado2022:null,empresaHabitacao:null,consumosIncluidos:false,obrasSemOutroUso:null,
    extrasMensais:0,atualizacao2023:''},f&&typeof f==='object'&&!Array.isArray(f)?f:{});
  const com={},cIn=o.comunicacoes&&typeof o.comunicacoes==='object'&&!Array.isArray(o.comunicacoes)?o.comunicacoes:{};
  Object.keys(cIn).forEach(k=>{if(/^\d{4}$/.test(k)&&dataExiste(cIn[k]))com[k]=cIn[k]});
  o.comunicacoes=com;
  o.comunicacoesV=o.comunicacoesV===2?2:0;
  o.rendaAcimaDoLimite=simNaoNulo(o.rendaAcimaDoLimite);
  const ra=Number(o.rendaAnterior);o.rendaAnterior=isFinite(ra)&&ra>0?ra:0;
  if(['','paa','rsaa','pma','pmae','prerau','al'].indexOf(o.isencao)<0)o.isencao='';
  if(FISCO_ESTADOS.indexOf(o.estado)<0)o.estado='';
  if(!FISCO_FINALIDADES.some(x=>x[0]===o.finalidade))o.finalidade='';
  o.numero=String(o.numero||'').trim();
  o.celebracao=/^\d{4}-\d{2}-\d{2}$/.test(String(o.celebracao||''))?String(o.celebracao):'';
  o.renovavel=simNaoNulo(o.renovavel);
  o.renovacoes=(Array.isArray(o.renovacoes)?o.renovacoes:[]).map(r=>{const q=Object.assign({id:uid(),inicio:'',fim:''},r||{});q.id=idSeguro(q.id);return q});
  o.cessacaoMotivo=String(o.cessacaoMotivo||'');
  const ces=o.cessacao&&typeof o.cessacao==='object'&&!Array.isArray(o.cessacao)?o.cessacao:{};
  o.cessacao={data:dataExiste(ces.data)?ces.data:'',motivo:/^(0[1-9]|1[0-2])$/.test(String(ces.motivo||''))?String(ces.motivo):''};
  o.ihru=dataExiste(o.ihru)?o.ihru:'';
  o.nrau3536=simNaoNulo(o.nrau3536);
  o.alRegistado2022=simNaoNulo(o.alRegistado2022);
  o.empresaHabitacao=simNaoNulo(o.empresaHabitacao);
  o.consumosIncluidos=o.consumosIncluidos===true;
  o.obrasSemOutroUso=simNaoNulo(o.obrasSemOutroUso);
  const ex=typeof o.extrasMensais==='boolean'?NaN:Number(o.extrasMensais);
  o.extrasMensais=isFinite(ex)&&ex>0?Math.round(ex*100)/100:0;
  if(['','sim','nao'].indexOf(o.atualizacao2023)<0)o.atualizacao2023='';
  return o;
}
/* A migração das comunicações da duração (D01): até à marca comunicacoesV=2 a chave
   era o ano dos rendimentos; passa a ser o ano do início do período em vigor nesse
   ano — o último de [c.start, ...renovações] que começou até 31/12 dele. Duas que caiam
   no mesmo período ficam com a data mais antiga (a primeira comunicação); uma de antes
   do início do contrato cai. Sem chaves, só se põe a marca; sem início válido não se
   adivinha: fica por migrar até o contrato o ter. Não chama o irs.js (carrega depois
   deste ficheiro). Idempotente e determinística: dois aparelhos migram igual, e uma
   chave já no sentido novo (o ano do início de um período) fica onde está.
   Recebe: o — o contrato, já com o bloco pelo normFisco.
   Devolve: nada — muda o.fisco.comunicacoes e o.fisco.comunicacoesV. */
function migrarComunicacoes(o){
  const f=o.fisco;
  if(f.comunicacoesV===2)return;
  const chaves=Object.keys(f.comunicacoes).sort();
  if(!chaves.length){f.comunicacoesV=2;return}
  if(!dataExiste(o.start))return;
  const inicios=[o.start].concat(f.renovacoes.map(r=>r.inicio).filter(d=>dataExiste(d)&&d>o.start)).sort();
  const novo={};
  chaves.forEach(y=>{
    const ate=y+'-12-31',dentro=inicios.filter(d=>d<=ate);
    if(!dentro.length)return;
    const k=dentro[dentro.length-1].slice(0,4),d=f.comunicacoes[y];
    if(!novo[k]||d<novo[k])novo[k]=d;
  });
  f.comunicacoes=novo;f.comunicacoesV=2;
}
/* normaliza um contrato: omissões preenchidas; itens do inventário e chaves ganham id próprio;
   as tarefas (tarefas.js) passam pelo normTarefas;
   o bloco fiscal passa por normFisco (um contrato antigo ganha-o vazio: «por indicar»),
   e o que precisa das datas do contrato faz-se aqui: uma renovação escrita no bloco
   com o fim depois do termo leva o termo (c.end) com ela, como o «Renovar…» faz (D42 —
   só num contrato com termo; um sem termo não ganha um), e as comunicações antigas
   migram para a chave do período (migrarComunicacoes, D01)
   Recebe: c — o contrato em bruto (objeto parcial, ou nada).
   Devolve: um objeto novo com todos os campos do contrato preenchidos. */
function normContract(c){
  const o=Object.assign({id:uid(),name:'',propertyId:null,roomId:null,tenantIds:[],rent:0,taxRate:0,iban:'',
    ownerEmail:'',ownerPhone:'',tenantEmail:'',tenantPhone:'',ownerContactId:'',tenantContactId:'',
    photoIds:[],keys:[],fisco:null,
    deposit:0,payDay:1,payDayTo:0,advance:0,autoRec:true,start:'',end:'',increase:null,active:true,notes:'',files:[],inventory:[]},c||{});
  o.id=idSeguro(o.id);o.propertyId=idSeguro(o.propertyId);o.roomId=idSeguro(o.roomId);
  o.tenantIds=idsSeguros(o.tenantIds);o.photoIds=idsSeguros(o.photoIds);
  o.ownerContactId=idSeguro(o.ownerContactId);o.tenantContactId=idSeguro(o.tenantContactId);
  o.fisco=normFisco(o.fisco);
  /* só uma renovação inteira (início e fim que existem, por ordem): uma sem início o
     motor não a conta (irs.js:irsPeriodos), e o termo levado por ela alongava o período
     inicial — outro escalão */
  if(dataExiste(o.end))o.fisco.renovacoes.forEach(r=>{
    if(dataExiste(r.inicio)&&dataExiste(r.fim)&&r.inicio<=r.fim&&r.fim>o.end)o.end=r.fim});
  migrarComunicacoes(o);
  o.files=(o.files||[]).map(normFile);
  o.inventory=(o.inventory||[]).map(i=>{const q=Object.assign({id:uid(),name:'',qty:1,state:'usado'},i);q.id=idSeguro(q.id);return q});
  o.keys=(o.keys||[]).map(i=>{const q=Object.assign({id:uid(),name:'',qty:1},i);q.id=idSeguro(q.id);return q});
  o.tarefas=normTarefas(o.tarefas);
  return o;
}
/* Os modos de dividir um valor pelos imóveis (o psplit de um movimento de
   grupo ou de «Todos os imóveis», e o modo gravado no lote das partes):
   [chave, nome, explicação]. Vive aqui, e não no formulário (movimento.js),
   porque o normTx só deixa passar um destes — e o normTx corre quando este
   ficheiro carrega, antes de haver formulário.
   O custo: o formulário lê daqui os nomes e as explicações. */
const PSPLIT_MODES=[['equal','Partes iguais','o mesmo para cada imóvel'],['value','Pelo valor de mercado','proporcional ao valor atual'],['purchase','Pelo valor de aquisição','proporcional ao que custou'],['pct','Quotas a definir','em partes: 2 e 1 → 2/3 e 1/3'],['percent','Percentagem','de cada imóvel; devem somar 100'],['amount','Valor certo','montante de cada imóvel; têm de somar o total'],['adjust','Ajuste','um extra por cima da parte igual: o total menos os extras divide-se em partes iguais por todos os imóveis e cada um soma o seu']];
/* A marca de uma parte de um lote (um movimento de vários imóveis partido por
   imóvel ao guardar): {id, n, total, alvo, modo, partes} — o id do lote, de
   quantas partes é, o valor do lote inteiro (euros), 'todos' ou 'g:<grupo>',
   o modo da divisão (PSPLIT_MODES) e os valores da divisão por imóvel ({} nos
   modos sem valores). Uma marca que não se perceba cai inteira: a parte fica
   um movimento normal do seu imóvel, que é o que ela é de qualquer forma — o
   custo é deixar de a ver como parte do lote (e de a editar com ele).
   Recebe: l — a marca tal como veio.
   Devolve: a marca limpa (objeto novo), ou null quando não serve. */
function normLote(l){
  if(!l||typeof l!=='object'||Array.isArray(l))return null;
  const id=idSeguro(l.id),n=Number(l.n),total=Number(l.total),alvo=String(l.alvo||'');
  if(id==null||id===''||!Number.isInteger(n)||n<1||!isFinite(total))return null;
  const g=/^g:./.test(alvo)?idSeguro(alvo.slice(2)):'';
  if(alvo!=='todos'&&!g)return null;
  const modo=PSPLIT_MODES.some(m=>m[0]===l.modo)?l.modo:'equal';
  return {id,n,total,alvo:alvo==='todos'?'todos':'g:'+g,modo,partes:chavesSeguras(l.partes)};
}
/* kind: income (renda), expense (despesa), loan (prestação), owed (dívida recebida de terceiro),
   repay (pagamento dessa dívida), settle (acerto entre proprietários: paidBy → toId).
   split: como o valor se divide entre os donos — {mode:'equal'|'quota'|'pct'|'percent'|'amount'|'adjust',parts:{ownerId:n}};
   em 'adjust', parts é o extra de cada um por cima da parte igual.
   O que o IRS pede a um movimento: numa renda, retencao (o que o inquilino reteve na fonte —
   o amount é o que entrou, e a renda ilíquida é a soma), periodo (o mês 'AAAA-MM' a que a
   renda respeita) e recibo (o recibo eletrónico já foi emitido); numa despesa, irsCol (a
   coluna do Anexo F escolhida à mão, um id de IRS_COLUNAS; vazio = pela categoria) e
   notaPropria (só numa despesa: «é a minha nota» do IMI de uma casa com mais de um
   dono — conta inteira para quem pagou, sem quota, D32; false em tudo o resto).
   Onde o movimento vive: propertyId (um imóvel), ou — só num molde (planeado ou
   modelo) e nos antigos — groupId (um grupo) ou todos (todos os meus imóveis à
   data, só numa receita ou despesa), com o psplit a dizer como se divide; um e
   só um dos três ganha, por esta ordem. lote marca uma parte de um movimento de
   vários imóveis (normLote) e só existe com imóvel, numa receita ou despesa.
   Os ids — o do movimento e os que ele refere, e as chaves das divisões — passam
   pelo idSeguro.
   criado é quando o movimento foi adicionado (ms, o Date.now() de então): é o
   que ordena os do mesmo dia (txPorDataECriacao). Um que já venha, número
   positivo, fica; um objeto sem id é um movimento novo e nasce com ele; os
   outros (os de antes do carimbo) ficam SEM o campo — nada de 0 nem de uma
   data inventada, que os fazia mudar e subir todos ao servidor.
   files são os anexos do movimento (a fatura, o recibo), pelo normFile, como
   os de um contrato; pela mesma razão do criado, só existe num movimento que
   já os teve — um que nunca os teve não ganha o campo. Uma lista que ficou
   vazia (removeram-se todos) fica vazia, para a fusão a três ver a remoção.
   Recebe: t — o movimento em bruto (objeto parcial, ou nada).
   Devolve: um objeto novo com todos os campos do movimento preenchidos. */
const normTx=t=>{const novo=!t||t.id==null||t.id==='';
  const o=Object.assign({id:uid(),kind:'expense',label:'',amount:0,date:'',propertyId:null,contractId:null,
  loanId:null,payType:'prestacao',paidBy:null,toId:null,creditor:'',category:'',sub:'',tags:[],notes:'',split:null,groupId:null,psplit:null,
  todos:false,lote:null,retencao:0,periodo:'',recibo:false,irsCol:'',notaPropria:false},t||{});
  const criado=typeof o.criado==='number'||typeof o.criado==='string'?Number(o.criado):NaN;
  if(isFinite(criado)&&criado>0)o.criado=criado;else if(novo)o.criado=Date.now();else delete o.criado;
  o.retencao=Math.max(0,Number(o.retencao)||0);
  o.periodo=/^\d{4}-\d{2}$/.test(String(o.periodo||''))?String(o.periodo):'';
  o.recibo=!!o.recibo;
  if(!IRS_COLUNAS.some(c=>c[0]===o.irsCol))o.irsCol='';
  o.notaPropria=o.kind==='expense'&&o.notaPropria===true;
  o.id=idSeguro(o.id);
  ['propertyId','contractId','loanId','paidBy','toId','groupId'].forEach(k=>{o[k]=idSeguro(o[k])});
  if(o.split&&(!o.split.mode||o.split.mode==='quota'))o.split=null;
  if(o.split){o.split={mode:o.split.mode,parts:chavesSeguras(o.split.parts)}}      // as partes são por dono
  const deLote=o.kind==='income'||o.kind==='expense';
  if(o.propertyId)o.groupId=null;
  o.todos=!!o.todos&&!o.propertyId&&!o.groupId&&deLote;
  if(!o.groupId&&!o.todos)o.psplit=null;
  if(o.psplit&&!o.psplit.mode)o.psplit=null;
  if(o.psplit){o.psplit={mode:o.psplit.mode,parts:chavesSeguras(o.psplit.parts)}}  // e estas por imóvel
  o.lote=o.propertyId&&deLote?normLote(o.lote):null;
  /* sem id não é anexo de nada (e o normFile dava-lhe um novo a cada leitura) */
  if(o.files!==undefined)o.files=Array.isArray(o.files)?o.files.filter(f=>f&&typeof f==='object'&&f.id!=null&&f.id!=='').map(normFile):[];
  return o};
/* A ordem dos movimentos: pela data, e no mesmo dia pela hora a que foram
   adicionados (o criado do normTx) — assim, do mais recente para o mais
   antigo, o adicionado depois fica em cima. Um sem criado (de antes do
   carimbo) conta como 0: fica abaixo dos novos do mesmo dia, e dois deles
   empatam, como sempre empataram. É ascendente; quem quer do mais recente
   para o mais antigo multiplica por -1.
   Recebe: a, b — dois movimentos (ou qualquer objeto com date e criado).
   Devolve: número negativo quando a vem antes de b, positivo depois, 0 no empate. */
function txPorDataECriacao(a,b){
  return String(a.date).localeCompare(String(b.date))||((Number(a.criado)||0)-(Number(b.criado)||0));
}
/* as liquidações antigas (lista própria) passam a movimentos do tipo "acerto"
   Recebe: d — a base de dados (usa d.settlements e d.transactions).
   Devolve: nada — acrescenta os acertos a d.transactions e esvazia d.settlements. */
function migrateSettlements(d){
  (d.settlements||[]).forEach(x=>{
    if(d.transactions.some(t=>t.id===x.id))return;
    d.transactions.push(normTx({id:x.id||uid(),kind:'settle',label:'Transferência entre proprietários',amount:Number(x.amount)||0,date:x.date||'',
      propertyId:x.propertyId||null,paidBy:x.fromId||null,toId:x.toId||null}));
  });
  d.settlements=[];
}
/* categorias novas que uma base antiga ainda não tem; e o mapa categoria → coluna do
   Anexo F, completado com as regras de origem que faltem sem pisar as que a pessoa mudou.
   O «repete» (as escolhas da página «Despesas que se repetem», que já não existe: a
   projeção conta os planeados) sai de uma base que ainda o traga. E o bloco irs
   (normIrsDefs), que um settings antigo não tem — sempre um objeto novo, para
   nunca partilhar o do blank (o Object.assign das bases copia a referência).
   Duas migrações com marca de versão, cada uma uma vez por conta (corre no load e em
   cada leitura da nuvem: idempotentes e determinísticas — dois aparelhos migram igual
   —, e com a marca gravada nunca desfazem uma escolha feita depois dela):
   · catsV=2 — as categorias novas de origem (CATS_NOVAS) entram nas árvores, e as
     categorias do IRS ganham o id (catIds) se ainda têm o nome de origem;
   · irsMapaV=2 — as chaves do IRS_MAPA_MIGRA passam ao valor novo, só se o gravado
     é ainda o antigo de origem.
   Uma árvore que falta (ou não é árvore) volta à de origem, e com ela os ids de origem.
   Uma marca maior do que a desta versão fica como está. Depois, sempre: o catIds só
   com ids de CATS_DO_IRS da árvore certa e chaves que existem nela (normCatIds), e o
   mapa só com colunas de IRS_MAPA_VALORES, completado com as regras de origem.
   Recebe: st — o objeto settings da base.
   Devolve: nada — completa st.cats, st.catsIn, st.catsV, st.catIds, st.exclude,
   st.irsMapa, st.irsMapaV e st.irs no próprio objeto. */
function fillCats(st){
  st.irs=normIrsDefs(st.irs);
  st.exclude=(st.exclude&&typeof st.exclude==='object')?st.exclude:{};
  delete st.repete;
  const arvore=a=>a&&typeof a==='object'&&!Array.isArray(a)&&Object.keys(a).length;
  const deOrigem={cats:false,catsIn:false};
  /* uma cópia colada à mão pode trazer um texto onde há uma árvore: o «in» rebentava */
  if(!arvore(st.cats)){st.cats=JSON.parse(JSON.stringify(CATS0));deOrigem.cats=true}
  else['Crédito à habitação','Dívidas a terceiros'].forEach(k=>{if(!(k in st.cats))st.cats[k]=CATS0[k].slice()});
  if(!arvore(st.catsIn)){st.catsIn=JSON.parse(JSON.stringify(CATS_IN0));deOrigem.catsIn=true}
  const vCats=Number(st.catsV)>0?Number(st.catsV):0;
  /* (cópias novas da árvore e das listas: a árvore pode ser a do blank, por referência) */
  if(vCats<2)['cats','catsIn'].forEach(tk=>{
    if(deOrigem[tk])return;
    const a=st[tk]=Object.assign({},st[tk]);
    Object.keys(CATS_NOVAS[tk]).forEach(c=>{
      const nv=CATS_NOVAS[tk][c];
      if(Array.isArray(a[c]))a[c]=a[c].concat(nv.subs.filter(s=>a[c].indexOf(s)<0));
      else if(nv.nova&&!Object.prototype.hasOwnProperty.call(a,c))a[c]=nv.subs.slice();
    });
  });
  /* depois das categorias novas, para elas também levarem o id: a árvore que acabou de
     vir da origem leva os ids de origem; antes da marca, cada categoria de origem que
     ainda tem o nome ganha o id que lhe falta (se nenhuma outra chave o tem já) */
  const ids=normCatIds(st.catIds,st),ori=catIdsDeOrigem(st.cats,st.catsIn);
  ['cats','catsIn'].forEach(tk=>{
    if(deOrigem[tk]){ids[tk]=ori[tk];return}
    if(vCats>=2)return;
    const usados=Object.values(ids[tk]);
    Object.keys(ori[tk]).forEach(k=>{if(!ids[tk][k]&&usados.indexOf(ori[tk][k])<0){ids[tk][k]=ori[tk][k];usados.push(ori[tk][k])}});
  });
  st.catIds=normCatIds(ids,st);
  st.catsV=Math.max(vCats,2);
  /* o mapa: só colunas que existem; antes da marca, as chaves de origem que mudaram
     passam ao valor novo onde a pessoa não lhes mexeu */
  const g={},gIn=st.irsMapa&&typeof st.irsMapa==='object'&&!Array.isArray(st.irsMapa)?st.irsMapa:{};
  Object.keys(gIn).forEach(k=>{if(k&&k!=='__proto__'&&IRS_MAPA_VALORES.some(c=>c[0]===gIn[k]))g[k]=gIn[k]});
  const vMapa=Number(st.irsMapaV)>0?Number(st.irsMapaV):0;
  if(vMapa<2)Object.keys(IRS_MAPA_MIGRA).forEach(k=>{if(g[k]===IRS_MAPA_MIGRA[k])g[k]=IRS_MAPA0[k]});
  st.irsMapa=Object.assign({},IRS_MAPA0,g);
  st.irsMapaV=Math.max(vMapa,2);
}
/* O catIds das definições, limpo: por árvore, só chaves que existem nela (a
   categoria ou 'Categoria / Sub', chavesDaArvore) e só ids de CATS_DO_IRS dessa árvore
   (os das receitas no catsIn, os das despesas no cats), com o id de uma subcategoria
   numa subcategoria e o de uma categoria numa categoria. Cada id numa chave só: com
   duas, fica a do nome de origem, senão a primeira.
   Recebe: x — o catIds tal como veio; st — as definições (as árvores cats e catsIn).
   Devolve: um objeto novo {cats:{chave:id}, catsIn:{chave:id}}. */
function normCatIds(x,st){
  const out={cats:{},catsIn:{}},obj=o=>o&&typeof o==='object'&&!Array.isArray(o)?o:{};
  x=obj(x);
  ['cats','catsIn'].forEach(tk=>{
    const chaves=chavesDaArvore(st&&st[tk]),validos=Object.values(CATS_IRS_ORIGEM[tk]),dentro=obj(x[tk]),dono={};
    Object.keys(dentro).forEach(k=>{
      const id=dentro[k],sitio=chaves.get(k);
      if(typeof id!=='string'||validos.indexOf(id)<0||!sitio||(id.indexOf('/')>-1)!==!!sitio.sub)return;
      const ja=dono[id];
      if(ja!==undefined){
        /* o id já tem chave: só a troca a chave com o nome de origem dele */
        if(CATS_IRS_ORIGEM[tk][k]!==id||CATS_IRS_ORIGEM[tk][ja]===id)return;
        delete out[tk][ja];
      }
      dono[id]=k;out[tk][k]=id;
    });
  });
  return out;
}
/* O identificador fixo de uma categoria ou subcategoria que o IRS lê (CATS_DO_IRS,
   rev. 5 §5.1): o nome muda, o id não. Lê o db.settings.catIds pela chave do nome
   atual, e só se a categoria (e a subcategoria) ainda existem na árvore. Pura e
   nunca lança — nem durante o primeiro load(), quando o db ainda não existe.
   Recebe: tk — a árvore: 'catsIn' (receitas) ou 'cats' (despesas); aceita também o
   kind de um movimento ('income' → catsIn, 'expense' → cats); cat — o nome da
   categoria (t.category); sub (opcional) — o da subcategoria (t.sub): sem ela, o id
   é o da categoria.
   Devolve: o id (texto, ex.: 'rendas/caucao'), ou '' quando não tem. */
function catIrsId(tk,cat,sub){
  try{
    const t=tk==='income'?'catsIn':tk==='expense'?'cats':tk;
    if(t!=='cats'&&t!=='catsIn')return '';
    const st=db&&db.settings,c=String(cat==null?'':cat).trim(),s=String(sub==null?'':sub).trim();
    if(!st||!c)return '';
    const arv=st[t],ids=st.catIds&&st.catIds[t];
    if(!arv||typeof arv!=='object'||!ids||typeof ids!=='object'||!Object.prototype.hasOwnProperty.call(arv,c))return '';
    if(s&&!(Array.isArray(arv[c])&&arv[c].indexOf(s)>-1))return '';
    const k=s?c+' / '+s:c,id=Object.prototype.hasOwnProperty.call(ids,k)?ids[k]:'';
    return typeof id==='string'&&CATS_DO_IRS.indexOf(id)>-1&&(id.indexOf('/')>-1)===!!s?id:'';
  }catch(e){return ''}
}
/* O bloco irs das definições, sempre completo: a tributação conjunta e a
   dispensa dos recibos como verdadeiro/falso, a letra de cada proprietário só
   'A' ou 'B' (a chave pelo idSeguro), e os outros rendimentos só com chave de
   ano de quatro dígitos e valor ≥ 0. O que mais lá vier fica.
   A situação de cada ano dos rendimentos (porAno, D30/D71/D91): {'AAAA': {conjunta,
   conjugeId, minhaLetra, dispensaRecibos, aimi:{total, valorTributavel}}} — o cônjuge
   (um id seguro, '' sem cônjuge) separado da minha letra no Rosto ('A' ou 'B'; o
   resto vale 'A'), e os dois números da demonstração do AIMI (€ ≥ 0, ou null por
   indicar). Só chaves de ano com quatro dígitos e entradas que são objetos; o que
   mais vier numa entrada fica. Os campos de topo continuam a valer para os anos sem
   entrada (irs-papeis.js:irsSituacao).
   Recebe: x — o bloco em bruto (objeto parcial, ou nada).
   Devolve: um objeto novo {conjunta, titulares, dispensaRecibos, outrosRendimentos, porAno}. */
function normIrsDefs(x){
  x=(x&&typeof x==='object'&&!Array.isArray(x))?x:{};
  const obj=o=>(o&&typeof o==='object'&&!Array.isArray(o))?o:{},tit={},outros={},porAno={};
  const t=obj(x.titulares),o=obj(x.outrosRendimentos),pa=obj(x.porAno);
  Object.keys(t).forEach(k=>{if(t[k]==='A'||t[k]==='B')tit[idSeguro(k)]=t[k]});
  Object.keys(o).forEach(k=>{const n=Number(o[k]);if(/^\d{4}$/.test(k)&&o[k]!==''&&o[k]!==null&&isFinite(n)&&n>=0)outros[k]=n});
  /* um valor do AIMI: um número (ou o texto de um) ≥ 0, ao cêntimo; o resto é por indicar */
  const euros=v=>{if(typeof v!=='number'&&typeof v!=='string')return null;if(v==='')return null;const n=Number(v);return isFinite(n)&&n>=0?Math.round(n*100)/100:null};
  Object.keys(pa).forEach(k=>{
    const e=pa[k];if(!/^\d{4}$/.test(k)||!e||typeof e!=='object'||Array.isArray(e))return;
    const cj=e.conjugeId,a=obj(e.aimi);
    porAno[k]=Object.assign({},e,{conjunta:e.conjunta===true,
      conjugeId:(typeof cj==='string'||typeof cj==='number')&&cj!==''?String(idSeguro(String(cj))):'',
      minhaLetra:e.minhaLetra==='B'?'B':'A',dispensaRecibos:e.dispensaRecibos===true,
      aimi:{total:euros(a.total),valorTributavel:euros(a.valorTributavel)}});
  });
  return Object.assign({},x,{conjunta:x.conjunta===true,titulares:tit,dispensaRecibos:x.dispensaRecibos===true,outrosRendimentos:outros,porAno:porAno});
}
/* normaliza uma liquidação da lista antiga (de antes de os acertos serem movimentos)
   Recebe: x — a liquidação em bruto (objeto parcial, ou nada).
   Devolve: um objeto novo com todos os campos, e os ids pelo idSeguro. */
const normSettle=x=>{const o=Object.assign({id:uid(),date:'',propertyId:null,fromId:null,toId:null,amount:0},x||{});
  ['id','propertyId','fromId','toId'].forEach(k=>{o[k]=idSeguro(o[k])});return o};
/* modelo: um movimento guardado para repetir à mão; recorrência: repete-se sozinho e pede confirmação.
   propRec e propRecN são a origem de um planeado automático da ficha do imóvel (o IMI e a sua
   prestação, o condomínio, o seguro — planeados.js:syncPropRecs), como o loanId e o contractId
   são a das prestações e das rendas. */
const TX_TPL_KEYS=['kind','label','amount','propertyId','groupId','todos','psplit','contractId','loanId','paidBy','toId','creditor','category','sub','tags','notes','split','interest','stamp','principal','fee','payType','retencao','irsCol','notaPropria','propRec','propRecN'];
/* cópia profunda de um movimento só com os campos que fazem sentido repetir (TX_TPL_KEYS):
   é o que os modelos e as recorrências guardam — data e id ficam de fora de propósito
   Recebe: t — o movimento a copiar.
   Devolve: um objeto novo só com os campos de TX_TPL_KEYS presentes em t (cópia profunda). */
function txSnapshot(t){const o={};TX_TPL_KEYS.forEach(k=>{if(t[k]!==undefined)o[k]=JSON.parse(JSON.stringify(t[k]))});return o}
/* normaliza um modelo (um movimento guardado para repetir à mão)
   Recebe: x — o modelo em bruto (objeto parcial, ou nada).
   Devolve: um objeto novo {id,name,tx}, com o tx pelo normTx e pelo txSnapshot. */
const normTpl=x=>{const o=Object.assign({id:uid(),name:''},x||{});o.id=idSeguro(o.id);o.tx=txSnapshot(normTx(o.tx||{}));return o};
/* normaliza uma recorrência (um movimento que se repete sozinho e pede confirmação)
   Recebe: x — a recorrência em bruto (objeto parcial, ou nada).
   Devolve: um objeto novo com todos os campos, o tx pelo normTx e o fim nunca antes da próxima. */
const normRec=x=>{const o=Object.assign({id:uid(),name:'',every:'month',next:'',until:'',end:'',muted:false,auto:false},x||{});o.id=idSeguro(o.id);o.tx=txSnapshot(normTx(o.tx||{}));if(o.until&&o.until<o.next)o.until=o.next;return o};
/* grupo: conjunto de imóveis, proprietários ou contratos com um nome
   Recebe: g — o grupo em bruto (objeto parcial, ou nada).
   Devolve: um objeto novo {id,name,kind,ids}, com os ids pelo idSeguro. */
const normGroup=g=>{const o=Object.assign({id:uid(),name:'',kind:'prop',ids:[]},g||{});o.id=idSeguro(o.id);o.ids=idsSeguros(o.ids);return o};

const CATMAP={'IMI':['Impostos','IMI'],'Seguro':['Seguros','Multirriscos'],'Água/Luz/Gás':['Água, luz e gás',''],
  'Obras':['Obras e benfeitorias',''],'Manutenção':['Manutenção e reparações',''],'Comissões':['Gestão e mediação','']};

let db=load();
/* lê os dados guardados (ou a versão antiga mais recente que houver) e passa-os pelo
   normalizarBase; devolve sempre uma base utilizável
   Devolve: a base de dados completa e normalizada (o objeto que passa a viver em db). */
function load(){
  let d=null;
  try{d=JSON.parse(rawGet(KEY)||'null')}catch(e){}
  if(!d)for(const k of OLDS){let o=null;try{o=JSON.parse(rawGet(k)||'null')}catch(e){}if(o){d=o;break}}
  return normalizarBase(d);
}
/* O único caminho de normalização e de migração de uma base inteira: é por aqui
   que passa o que está no aparelho (load) e uma cópia de segurança reposta
   (copias.js:bkLoad). Havia duas cópias disto, e a das cópias ficou para trás.
   Normaliza cada coleção (e os ids, pelo idSeguro) e faz as migrações maiores:
   inquilinos com renda passam a contratos, categorias renomeadas são remapeadas, os
   movimentos presos a um inquilino passam a estar presos ao contrato, e as
   liquidações antigas viram movimentos de acerto; e o capital em dívida das
   hipotecas volta a derivar-se dos pagamentos (acertarCreditos), que uma casa
   gravada por cima noutro aparelho traz de antes. O que numa lista não for um
   registo (um nulo, um texto, uma lista que não é lista) cai, em vez de rebentar.
   Recebe: d — a base em bruto, de qualquer versão (o JSON lido; aguenta nulo e lixo).
   Devolve: a base de dados completa e normalizada. */
function normalizarBase(d){
  d=(d&&typeof d==='object'&&!Array.isArray(d))?d:{};
  const registos=l=>(Array.isArray(l)?l:[]).filter(x=>x&&typeof x==='object'&&!Array.isArray(x));
  const out=Object.assign({},blank,d,{settings:Object.assign({},blank.settings,(d.settings&&typeof d.settings==='object')?d.settings:{})});
  fillCats(out.settings);
  if(!Array.isArray(out.settings.tags))out.settings.tags=TAGS0.slice();
  const newContracts=[],inquilinosAntigos=registos(d.tenants),semContratos=!registos(d.contracts).length;

  out.properties=registos(d.properties).map(p=>{
    const np=normProp(p);
    if(p.use==null)np.use=(p.status==='proprio')?'proprio':'investimento';
    /* versões antigas guardavam a renda no imóvel ou nos inquilinos (os ids já
       normalizados dos dois lados, para a ligação bater certo) */
    const olds=inquilinosAntigos.filter(t=>idSeguro(t.propertyId)===np.id);
    if(olds.length&&semContratos){
      if(olds.length>1){
        np.rentalMode='quartos';
        olds.forEach((t,i)=>{
          const room={id:uid(),name:(t.notes&&/quarto/i.test(t.notes))?t.notes:'Quarto '+(i+1)};
          np.rooms.push(room);
          newContracts.push(normContract({propertyId:np.id,roomId:room.id,tenantIds:[t.id],rent:t.rent||0,
            deposit:t.deposit||0,start:t.start||'',end:t.end||'',increase:p.rentIncrease==null?null:p.rentIncrease,active:t.active!==false}));
        });
      }else{
        const t=olds[0];
        newContracts.push(normContract({propertyId:np.id,tenantIds:[t.id],rent:t.rent||p.monthlyRent||0,
          deposit:t.deposit||0,start:t.start||'',end:t.end||'',increase:p.rentIncrease==null?null:p.rentIncrease,active:t.active!==false}));
      }
    }else if(!olds.length&&semContratos&&Number(p.monthlyRent)>0&&p.status==='arrendado'){
      newContracts.push(normContract({propertyId:np.id,rent:Number(p.monthlyRent),increase:p.rentIncrease==null?null:p.rentIncrease}));
    }
    return np;
  });

  out.owners=registos(d.owners).map(normPerson);
  out.groups=registos(d.groups).map(normGroup);
  out.settlements=registos(d.settlements).map(normSettle);
  out.templates=registos(d.templates).map(normTpl);
  out.recurring=registos(d.recurring).map(normRec);
  out.visits=registos(d.visits).map(normVisit);
  out.tenants=inquilinosAntigos.map(normPerson);
  out.contracts=registos(d.contracts).map(normContract).concat(newContracts);
  out.transactions=registos(d.transactions).map(t=>{
    const n=normTx(Object.assign({},t,{kind:t.kind==='debt'?'loan':t.kind}));
    if(n.category&&CATMAP[n.category]){n.sub=n.sub||CATMAP[n.category][1];n.category=CATMAP[n.category][0]}
    if(!n.contractId&&t.tenantId){
      const tid=idSeguro(t.tenantId);
      const c=out.contracts.find(x=>x.propertyId===n.propertyId&&x.tenantIds.indexOf(tid)>-1);
      if(c)n.contractId=c.id;
    }
    return n;
  });
  migrateSettlements(out);
  /* o capital em dívida das hipotecas é derivado (credito.js:acertarCreditos),
     e acerta-se aqui, por onde passa o que está no aparelho e uma cópia
     reposta. O typeof é pela ordem de carregamento, e não por um serviço: o
     primeiro load() corre quando o dados.js carrega, antes do credito.js — que
     acerta a db ele próprio ao chegar. */
  if(typeof acertarCreditos==='function')acertarCreditos(out);
  return out;
}
/* grava a base inteira no aparelho e reagenda os lembretes no telemóvel
   Devolve: nada — grava db no localStorage e chama scheduleReminders. */
function save(){rawSet(KEY,JSON.stringify(db));scheduleReminders()}
/* lembretes no telemovel: quando um recorrente entra para confirmar e quando passa a atraso */
let _remT=null;
/* reagenda as notificações locais via ponte Android (fora da app instalada não faz nada): espera
   400ms para juntar gravações seguidas numa só chamada e envia até 60 lembretes futuros, por data
   Devolve: nada — entrega a lista de lembretes à ponte Android (fora dela, não faz nada). */
function scheduleReminders(){
  if(!(window.Android&&Android.scheduleReminders))return;
  clearTimeout(_remT);
  _remT=setTimeout(()=>{try{
    const at=(iso,h)=>{const d=new Date(iso+'T00:00:00');d.setHours(h,0,0,0);return d.getTime()};
    const list=[];
    (db.recurring||[]).forEach(r=>{
      if(!r.next||r.muted)return;
      const v=r.tx&&r.tx.amount?' ('+euro2(r.tx.amount)+')':'';
      list.push({id:'c_'+r.id+'_'+r.next,at:at(r.next,9),title:'Por confirmar: '+r.name,
        text:'“'+r.name+'”'+v+' entrou hoje para os movimentos por confirmar.'});
      const lim=addDays(r.until&&r.until>r.next?r.until:r.next,1);
      list.push({id:'l_'+r.id+'_'+lim,at:at(lim,9),title:'Em atraso: '+r.name,
        text:'“'+r.name+'”'+v+' passou o prazo sem confirmação.'});
    });
    if(typeof prazosLembretes==='function')list.push(...prazosLembretes());
    Android.scheduleReminders(JSON.stringify(list.filter(x=>x.at>Date.now()).sort((a,b)=>a.at-b.at).slice(0,60)));
  }catch(e){}},400);
}
