# O que cada comando faz

Mantido à mão, ao lado do registo: as opções e permissões saem do código,
mas o «o que acontece a seguir» explica-se aqui. O gerador de docs funde
os dois — e rebenta se um comando registado não tiver secção neste
ficheiro.

## pedidos
Lista os pedidos por tratar que o teu papel vê (o suporte vê os de
pessoas; o dev vê erros de app e servidor; o admin vê infraestrutura e
segurança). Sem opções, mostra os abertos de todas as categorias tuas.
`categoria` restringe a uma origem; `estado` filtra por recebidos, em
resolução ou concluídos. Resultado: uma lista com botões por pedido —
responder, fechar — que agem na hora, sem sair do Discord.

## pedido
Mostra um pedido concreto por inteiro: quem escreveu, o fio de mensagens,
o estado. O `id` aceita só os primeiros caracteres (o mesmo prefixo que
vem nos emails, tipo `AB12CD34`). Resultado: o embed completo com botões
de ação; se o prefixo bater em mais do que um, vem o primeiro.

## responder
Escreve a resposta num pedido e marca-o «em resolução». A resposta entra
no fio (visível na app e no back office) e, se o pedido for de uma pessoa,
ela recebe email com o número do pedido. Resultado: o embed atualizado;
num pedido técnico (erro), nunca sai email para ninguém.

## fechar
Marca um pedido como concluído, com nota opcional. Se o mesmo erro voltar
a acontecer, o pedido reabre sozinho e o canal é avisado. Resultado: o
embed sem botões — concluído é o fim da linha até alguém o reabrir.

## erros
Os erros recentes apanhados pela app e pelo servidor, agrupados por
impressão digital (o ×n diz quantas vezes repetiu, e «pessoas» quantas
contas diferentes o apanharam). Resultado: uma lista curta para triagem —
os detalhes vivem no /pedido de cada um.

## uso
O consumo da infraestrutura Cloudflare neste momento: pedidos ao worker,
leituras e escritas na D1, KV e R2, contra os limites do plano gratuito.
Precisa do token de analytics configurado; sem ele diz que não consegue.
Resultado: um embed de números — informativo, não muda nada.

## comandos
O que TU podes correr, com a origem de cada acesso (do cargo, dado à mão,
ou retirado). Resultado: a tua lista pessoal — é a resposta certa para
«porque é que não me deixa correr X?».

## entrar
Uma ligação de uso único para o back office (/equipa) no browser. Vale
cinco minutos e gasta-se ao entrar; entras com os papéis que tens no
Discord. Resultado: a ligação em privado — não a partilhes, quem a abrir
entra em teu nome.

## docs
Esta documentação. A ligação vem com o bilhete de entrada embutido (o
mesmo mecanismo do /entrar): clicas e aterras logo aqui, sem passos
intermédios. Resultado: a ligação privada, válida cinco minutos e uma
utilização.

## test
Entra no ambiente de teste (dev.rendorium.com) numa conta de teste tua.
Sem opções, RETOMA a tua conta mais recente com os dados intactos — de um
dia para o outro. As opções mudam isso: `extra` cria uma conta adicional
sem tocar nas existentes (para testar partilhas entre duas contas);
`limpar` apaga as tuas contas de teste e começa do zero (as dos outros
devs ficam); `dados` carrega os dados de exemplo — só conta ao criar,
retomar nunca semeia por cima; `email` regista para onde vai o correio
das tuas contas de teste (fica guardado — sem registo vai para
test@rendorium.com). Resultado: uma ligação privada de 10 minutos; na
app, o seletor no topo do menu troca entre as tuas contas.

## access
Só do master: quem pode correr que comandos, com caixas na própria
mensagem. O papel continua a mandar — o que se guarda é a diferença para
o cargo, por isso mudar o cargo de alguém no Discord continua a mudar os
acessos. Resultado: a mensagem com as caixas; cada clique grava na hora.

## copias
As cópias diárias da base no R2: lista, tamanho e idade. Resultado: um
embed de consulta; verificar e descarregar uma cópia faz-se no back
office (Operação), não daqui.

## resumo
Envia já o resumo diário (consumo + estado) para o canal de administração
— o mesmo que o cron manda todas as manhãs. Resultado: a mensagem no
canal de administração; se não houver canal configurado, diz que não tem
para onde.
