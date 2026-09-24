# O que cada comando faz

Mantido à mão, ao lado do registo: as opções e permissões saem do código,
mas o «o que acontece a seguir» explica-se aqui. O gerador de docs funde
os dois — e rebenta se um comando registado não tiver secção neste
ficheiro, ou se uma secção daqui não for de comando nenhum: o que não é
comando do Discord não é lido aqui, e vive onde é servido (o cartão dos
serviços de uma conta, no back office, está em «A app em serviços», no
docs/design.md).

## pedidos
Lista os pedidos por tratar que o teu papel vê (o suporte vê os de
pessoas; o dev vê erros de app e servidor; o admin vê infraestrutura e
segurança). Sem opções, mostra os abertos de todas as categorias tuas.
`categoria` restringe a uma origem; `estado` filtra por recebidos, em
resolução ou concluídos. Resultado: uma lista com botões por pedido —
«Em resolução» e «Concluir» — que agem na hora, sem sair do Discord. Cada
botão conta como o comando dele (o /responder e o /fechar): quem não o pode
correr é recusado, e o pedido fica como estava.

## pedido
Mostra um pedido concreto por inteiro: quem escreveu, o fio de mensagens,
o estado. O `id` aceita só os primeiros caracteres (o mesmo prefixo que
vem nos emails, tipo `AB12CD34`). Resultado: o embed completo com botões
de ação; se o prefixo bater em mais do que um, vem o primeiro. A resposta é
privada — só quem correu o comando a vê, como a dos outros comandos —,
porque a ficha de quem escreveu leva o nome e o email da pessoa; os botões
funcionam na mesma.

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
O consumo da infraestrutura Cloudflare contra os tectos do plano gratuito,
cada um com a percentagem (⚠️ a partir de 70%, 🔴 a partir de 90%): as
linhas lidas e escritas na D1 e os pedidos aos Workers, nas últimas 24
horas; as leituras e as escritas do KV no dia UTC, que é quando o tecto
dele volta a zero (as escritas são o tecto mais apertado de todos: mil por
dia); e o R2 — o espaço ocupado pelos dois buckets somados, em GB, e as
operações de classe A desde o dia 1 do mês. Uma medida que a API de análise
não devolva aparece na linha dela como «sem medida», em vez de faltar calada.
Por cima, o que se conta por dentro: contas, ativos nas últimas 24 horas,
casas e registos, pedidos abertos, erros e o estado das cópias de segurança.
Precisa do token de analytics (CF_ANALYTICS_TOKEN, com Account Analytics ·
Read); sem ele, o consumo da Cloudflare diz que está indisponível e o resto
vem na mesma. Resultado: um embed de números — informativo, não muda nada.

## comandos
O que TU podes correr, com a origem de cada acesso (do cargo, dado à mão,
ou retirado). Resultado: a tua lista pessoal — é a resposta certa para
«porque é que não me deixa correr X?».

## entrar
Uma ligação de uso único para o back office (/equipa) no browser. Vale
cinco minutos e gasta-se ao entrar; entras com os papéis que tens no
Discord, e a sessão volta a perguntá-los ao Discord de quinze em quinze
minutos — quem perde o cargo, ou sai do servidor, sai também do back office.
Resultado: a ligação em privado — não a partilhes, quem a abrir entra em teu
nome.

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
app, o seletor no topo do menu troca entre as tuas contas. Um worker sem
TESTE_CHAVE (nem o token do bot) não assina ligações: o comando responde com
o aviso do que falta.

## access
Só do master: quem pode correr que comandos, com caixas na própria
mensagem. O papel continua a mandar — o que se guarda é a diferença para
o cargo, por isso mudar o cargo de alguém no Discord continua a mudar os
acessos. Resultado: a mensagem com as caixas; cada clique grava na hora.

## copias
As cópias diárias da base no R2: lista, tamanho e idade. Resultado: um
embed de consulta. Verificar uma cópia (o resumo do que ela tem) faz-se no
back office, em Operação, por quem vê a infraestrutura; descarregá-la é só
do master, porque leva a base inteira — os dados de todas as contas.

## resumo
Envia já o resumo diário (consumo + estado) para o canal de administração
— o mesmo que o cron manda todas as manhãs. Resultado: a mensagem no
canal de administração; se não houver canal configurado, diz que não tem
para onde.
