/* ================= O QUE O APARELHO JÁ SABE =================
   A app arranca com o que está guardado no aparelho e só depois ouve o
   servidor. Estas perguntas decidem o que ela pode afirmar entretanto: se há
   sessão (haSessao), se o estado do servidor já chegou ou a espera acabou
   (sabemosOEstado), o painel «À espera do servidor» (esperaDoServidor) e se
   este ambiente pode carregar dados de exemplo (podeExemplo). Leem a nuvem
   quando ela já carregou e o aparelho quando ainda não — o arranque corre
   antes do cloud/nucleo.js (index.html). */
/* O painel de «à espera do servidor», ou nada.

   Vem a par do sabemosOEstado, e resolve o outro lado do mesmo problema. A
   base local vive numa chave só (dados.js:KEY), e não uma por conta: sair não
   a limpa, e por isso o finishLogin apaga-a quando quem entra é outra pessoa
   (entrada.js) — senão mostravam-se os imóveis de um a outro. Está certo. Só
   que a app pintava logo essa base vazia e afirmava «Ainda não há nada
   registado» a quem tem doze imóveis, com um botão de carregar dados de
   exemplo ao lado. Não é uma vez por aparelho: é em todos os logins de quem
   partilha o aparelho com outra conta, mais a navegação privada, o
   armazenamento limpo pelo browser e a app reinstalada.

   Só fala quando não se sabe MESMO nada: com uma sessão à espera do primeiro
   estado e a base local inteiramente vazia. Quem tem dados cá nunca vê isto,
   e uma conta nova vê-o um instante antes do «ainda não há nada registado»
   verdadeiro — duas frases certas, em vez de uma errada.

   É o mesmo que a página dos cargos já fazia (partilha.js), e pela mesma
   razão: dizer «não tens» a quem tem parece perda de dados.
   Devolve: o HTML do painel de espera, ou '' quando há alguma coisa a dizer. */
function esperaDoServidor(){
  const nada=!(db.properties||[]).length&&!(db.transactions||[]).length&&
    !(db.contracts||[]).length&&!(db.tenants||[]).length&&
    !(db.owners||[]).length&&!(db.visits||[]).length;
  if(sabemosOEstado()||!nada)return '';
  return `<div class="empty"><b>À espera do servidor</b>Os dados desta conta ainda não chegaram a este aparelho. Aparecem assim que a app sincronizar.</div>`;
}
/* Este ambiente pode carregar dados de exemplo?

   Só fora de produção. Quem chega à app a sério deve encontrá-la vazia e ser
   levado pelos primeiros passos — dados de brincar por cima dos verdadeiros
   são um estorvo, e apagá-los à mão é trabalho. O ambiente vem do servidor
   (rotas/auth.js, em /api/auth/config, que devolve env.ENV_NAME ou
   'producao') e até a resposta chegar vale 'producao': o lado seguro.

   Pergunta-se ANTES de escrever o botão, e não se apaga o botão depois de o
   escrever. A app tem uma via de repintura parcial que não passa pelo render
   (vistas.js:refrescarListasVivas, usada pela pesquisa das listas), e por lá
   um botão apagado à posteriori voltava.
   Devolve: true onde os dados de exemplo fazem sentido. */
const podeExemplo=()=>!!(window.CW&&CW.ambiente&&CW.ambiente!=='producao');
/* Já se pode afirmar o que o aparelho sabe?

   Ao arrancar, a app trabalha com o que está guardado cá: corre o
   syncAllContractRecs, decide o que está por confirmar, e pinta. Se uma
   dessas rendas já foi confirmada noutro aparelho, isto aqui ainda não sabe —
   e afirmava-o na mesma: um «por confirmar» que não existe, um número no
   sino, um aviso. Um segundo depois o estado chega e as três coisas
   desaparecem.

   O trabalho do arranque fica: é preciso, e o pull corrige-o. O que espera é
   o que a app AFIRMA — e espera pouco. A espera acaba em três alturas: o
   servidor falou (CW._pulled), o pedido falhou, ou já demorou de mais
   (nucleo.js:fimDaEspera). As duas últimas contam: sem rede, o que está no
   aparelho é tudo o que há, e trocar um erro de um segundo por um silêncio
   permanente era pior negócio. Sem nuvem, ou sem sessão, não há espera
   nenhuma.
   Devolve: true quando o que se sabe já se pode dizer em voz alta. */
const sabemosOEstado=()=>!haSessao()||!!(window.CW&&CW._esperaFim);
/* Há uma sessão iniciada neste aparelho?

   Pergunta-se ao aparelho, e não à nuvem, por causa da ordem de carregamento:
   o app/arranque.js corre ANTES do cloud/nucleo.js (index.html), e na primeira
   pintura — a única que a pessoa vê antes de o servidor falar — o window.CW
   ainda não existe. Um guarda que perguntasse «a nuvem já carregou?» respondia
   «não há nuvem, diz tudo» exatamente no instante em que devia calar-se.
   Devolve: true se há sessão — pela nuvem, se já carregou, senão pelo aparelho. */
function haSessao(){
  if(window.CW&&CW.user)return true;
  const v=rawGet(LS_SESSAO);
  return !!v&&v!=='null';
}
