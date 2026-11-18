/* ================= IRS · FREGUESIAS REPOSTAS EM 2025 =================
   As uniões de freguesias que a Lei n.º 25-A/2025, de 13 de março, extinguiu em
   outubro de 2025 (arts. 2.º e 3.º, com efeitos na instalação dos órgãos eleitos
   nas autárquicas de 2025, art. 14.º) e as freguesias que repôs. Com a reposição
   a AT migrou os prédios para as freguesias repostas, e todas têm código novo:
   um imóvel guardado antes com o código da união (o que a caderneta e as notas
   do IMI traziam) tem de se confirmar na caderneta atual. A app não troca o
   código sozinha: uma união dá várias freguesias, e só a caderneta diz qual é a
   do prédio. Quem usa esta tabela (o formulário do imóvel e a Declaração de
   2025 em diante) só precisa de saber se um código é de uma união extinta e
   quais são as freguesias repostas dela.

   Fonte: a tabela de correspondência da Autoridade Tributária e Aduaneira,
   «Reposição de freguesias agregadas 2025»:
   https://info.portaldasfinancas.gov.pt/pt/apoio_ao_contribuinte/Cidadaos/Casa_e_propriedades/Certidoes_e_comprovativos/Documents/Reposicao-freguesias-agregadas-2025-tab-correspondencia.xlsx
   (página: https://info.portaldasfinancas.gov.pt/pt/destaques/Paginas/Reposicao-freguesias-agregadas-2025-tab-correspondencia.aspx),
   descarregada a 17 de novembro de 2026. São 303 linhas (uma por freguesia
   reposta) de 135 uniões, em 70 concelhos; os códigos novos são 302 (a freguesia
   de Bicos, em Odemira, repõe-se a partir de duas uniões e conta nas duas).
   Os códigos são os da AT, de 6 caracteres (distrito, concelho e freguesia) e,
   em Barcelos e em Guimarães, com letras no fim (0302FE, 0308FA); os nomes
   são os da tabela, tal como lá estão (o das uniões em maiúsculas, e em alguns
   casos abreviado).

   Cada linha: [código da união, nome da união, [[código da reposta, nome], …]],
   por ordem do código da união e, dentro dela, do código da reposta. */
const IRS_FREGUESIAS_2025=[
  ['010121','UNIÃO DAS FREGUESIAS DE ÁGUEDA E BORRALHA',[['010130','Águeda'],['010133','Borralha']]],
  ['010122','UNIÃO DAS FREGUESIAS DE BARRÔ E AGUADA DE BAIXO',[['010129','Aguada de Baixo'],['010131','Barrô']]],
  ['010123','UNIÃO DAS FREGUESIAS DE BELAZAIMA DO CHÃO, CASTANHEIRA DO VOUGA E AGADÃO',[['010128','Agadão'],['010132','Belazaima do Chão'],['010134','Castanheira do Vouga']]],
  ['010610','UNIÃO DAS FREGUESIAS DE RAIVA, PEDORIDO E PARAÍSO',[['010613','Paraíso'],['010614','Pedorido'],['010615','Raiva']]],
  ['010611','UNIÃO DAS FREGUESIAS DE SOBRADO E BAIRROS',[['010612','Bairros'],['010616','Sobrado']]],
  ['010706','UNIÃO DAS FREGUESIAS DE ANTA E GUETIM',[['010707','Anta'],['010708','Guetim']]],
  ['010808','UNIÃO DAS FREGUESIAS DE BEDUÍDO E VEIROS',[['010810','Beduído'],['010811','Veiros']]],
  ['010932','UNIÃO DAS FREGUESIAS DE CALDAS DE SÃO JORGE E PIGEIROS',[['010937','Caldas de São Jorge'],['010944','Pigeiros']]],
  ['010933','UNIÃO DAS FREGUESIAS DE CANEDO, VALE E VILA MAIOR',[['010938','Canedo'],['010946','Vale'],['010947','Vila Maior']]],
  ['010934','UNIÃO DAS FREGUESIAS DE LOBÃO, GIÃO, LOUREDO E GUISANDE',[['010939','Gião'],['010940','Guisande'],['010941','Lobão'],['010942','Louredo']]],
  ['010936','UNIÃO DAS FREGUESIAS DE SÃO MIGUEL DO SOUTO E MOSTEIRÔ',[['010943','Mosteirô'],['010945','São Miguel de Souto']]],
  ['011109','UNIÃO DAS FREGUESIAS DA MEALHADA, VENTOSA DO BAIRRO E ANTES',[['011110','Antes'],['011111','Mealhada'],['011112','Ventosa do Bairro']]],
  ['011320','UNIÃO DAS FREGUESIAS DE NOGUEIRA DO CRAVO E PINDELO',[['011323','Nogueira do Cravo'],['011324','Pindelo']]],
  ['011509','UNIÃO DAS FREGUESIAS DE OVAR, SÃO JOÃO, ARADA E SÃO VICENTE DE PEREIRA JUSÃ',[['011510','Arada'],['011511','Ovar'],['011512','São João'],['011513','São Vicente de Pereira Jusã']]],
  ['011710','UNIÃO DAS FREGUESIAS DE CEDRIM E PARADELA',[['011712','Cedrim'],['011714','Paradela']]],
  ['011711','UNIÃO DAS FREGUESIAS DE SILVA ESCURA E DORNELAS',[['011713','Dornelas'],['011715','Silva Escura']]],
  ['011812','UNIÃO DAS FREGUESIAS DE FONTE DE ANGEÃO E COVÃO DO LOBO',[['011815','Covão do Lobo'],['011816','Fonte de Angeão']]],
  ['011813','UNIÃO DAS FREGUESIAS DE PONTE DE VAGOS E SANTA CATARINA',[['011817','Ponte de Vagos'],['011818','Santa Catarina']]],
  ['011814','UNIÃO DAS FREGUESIAS DE VAGOS E SANTO ANTÓNIO',[['011819','Santo António'],['011820','Vagos']]],
  ['020106','UNIÃO DAS FREGUESIAS DE ALJUSTREL E RIO DE MOINHOS',[['020107','Aljustrel'],['020108','Rio de Moinhos']]],
  ['020209','UNIÃO DAS FREGUESIAS DE ALMODÔVAR E GRAÇA DOS PADRÕES',[['020211','Almodôvar'],['020214','Senhora da Graça dos Padrões']]],
  ['020210','UNIÃO DAS FREGUESIAS DE SANTA CLARA-A-NOVA E GOMES AIRES',[['020212','Gomes Aires'],['020213','Santa Clara-a-Nova']]],
  ['020807','UNIÃO DAS FREGUESIAS DE ALFUNDÃO E PEROGUARDA',[['020809','Alfundão'],['020812','Peroguarda']]],
  ['020808','UNIÃO DAS FREGUESIAS DE FERREIRA DO ALENTEJO E CANHESTROS',[['020810','Canhestros'],['020811','Ferreira do Alentejo']]],
  ['021010','UNIÃO DAS FREGUESIAS DE SAFARA E SANTO ALEIXO DA RESTAURAÇÃO',[['021011','Safara'],['021012','Santo Aleixo da Restauração']]],
  ['021118','COLOS',[['021123','Bicos'],['021124','Colos']]],
  ['021122','VALE DE SANTIAGO',[['021123','Bicos'],['021125','Vale de Santiago']]],
  ['021207','UNIÃO DAS FREGUESIAS DE GARVÃO E SANTA LUZIA',[['021209','Garvão'],['021210','Santa Luzia']]],
  ['021309','UNIÃO DAS FREGUESIAS DE VILA NOVA DE SÃO BENTO E VALE DE VARGO',[['021310','Vale de Vargo'],['021311','Vila Nova de São Bento']]],
  ['030293','UNIÃO FREG DE BARCELOS, VILA BOA E VILA FRESCAINHA (SÃO MARTINHO E SÃO PEDRO)',[['0302FI','Barcelos'],['0302FL','Vila Boa'],['0302FM','Vila Frescainha (São Martinho)'],['0302FN','Vila Frescainha (São Pedro)']]],
  ['0302FE','UNIÃO DAS FREGUESIAS DE SILVEIROS E RIO COVO (SANTA EULÁLIA)',[['0302FJ','Rio Covo (Santa Eulália)'],['0302FK','Silveiros']]],
  ['030421','UNIÃO DAS FREGUESIAS DE REFOJOS DE BASTO, OUTEIRO E PAINZELA',[['030422','Outeiro'],['030423','Painzela'],['030424','Refojos de Basto']]],
  ['030616','UNIÃO DAS FREGUESIAS DE APÚLIA E FÃO',[['030621','Apúlia'],['030625','Fão']]],
  ['030617','UNIÃO DAS FREGUESIAS DE BELINHO E MAR',[['030622','Belinho'],['030627','Mar']]],
  ['030618','UNIÃO DAS FREGUESIAS DE ESPOSENDE, MARINHAS E GANDRA',[['030624','Esposende'],['030626','Gandra'],['030628','Marinhas']]],
  ['030620','UNIÃO DAS FREGUESIAS DE PALMEIRA DE FARO E CURVOS',[['030623','Curvos'],['030629','Palmeira de Faro']]],
  ['030876','UNIÃO DAS FREGUESIAS DE AIRÃO SANTA MARIA, AIRÃO SÃO JOÃO E VERMIL',[['030892','Airão (Santa Maria)'],['030893','Airão São João'],['0308FE','Vermil']]],
  ['030882','UNIÃO DAS FREGUESIAS DE CONDE E GANDARELA',[['030895','Conde'],['030897','Gandarela']]],
  ['030885','UNIÃO DAS FREGUESIAS DE PRAZINS SANTO TIRSO E CORVITE',[['030896','Corvite'],['030898','Prazins Santo Tirso']]],
  ['030887','UNIÃO DAS FREGUESIAS DE SANDE VILA NOVA E SANDE SÃO CLEMENTE',[['030899','Sande (São Clemente)'],['0308FA','Sande (Vila Nova)']]],
  ['030889','UNIÃO DAS FREGUESIAS DE SERZEDO E CALVOS',[['030894','Calvos'],['0308FC','Serzedo']]],
  ['030891','UNIÃO DAS FREGUESIAS DE TABUADELO E SÃO FAUSTINO',[['0308FB','São Faustino'],['0308FD','Tabuadelo']]],
  ['031252','UNIÃO DAS FREGUESIAS DE AVIDOS E LAGOA',[['031261','Avidos'],['031266','Lagoa']]],
  ['031254','UNIÃO DAS FREGUESIAS DE ESMERIZ E CABEÇUDOS',[['031262','Cabeçudos'],['031264','Esmeriz']]],
  ['031255','UNIÃO DAS FREGUESIAS DE GONDIFELOS, CAVALÕES E OUTIZ',[['031263','Cavalões'],['031265','Gondifelos'],['031268','Outiz']]],
  ['031257','UNIÃO DAS FREGUESIAS DE RUIVÃES E NOVAIS',[['031267','Novais'],['031269','Ruivães']]],
  ['031409','UNIÃO DAS FREGUESIAS DE TAGILDE E VIZELA (SÃO PAIO)',[['031410','Tagilde'],['031411','Vizela (São Paio)']]],
  ['050106','UNIÃO DAS FREGUESIAS DE BELMONTE E COLMEAL DA TORRE',[['050107','Belmonte'],['050108','Colmeal da Torre']]],
  ['050227','UNIÃO DAS FREGUESIAS DE ESCALOS DE BAIXO E MATA',[['050232','Escalos de Baixo'],['050235','Mata']]],
  ['050228','UNIÃO DAS FREGUESIAS DE ESCALOS DE CIMA E LOUSA',[['050233','Escalos de Cima'],['050234','Lousa']]],
  ['050230','UNIÃO DAS FREGUESIAS DE NINHO DO AÇOR E SOBRAL DO CAMPO',[['050236','Ninho do Açor'],['050237','Sobral do Campo']]],
  ['050332','UNIÃO DAS FREGUESIAS DE BARCO E COUTADA',[['050339','Barco'],['050342','Coutada']]],
  ['050333','UNIÃO DAS FREGUESIAS DE CANTAR-GALO E VILA DO CARVALHO',[['050340','Cantar-Galo'],['050346','Vila do Carvalho']]],
  ['050334','UNIÃO DAS FREGUESIAS DE CASEGAS E OURONDO',[['050341','Casegas'],['050343','Ourondo']]],
  ['050336','UNIÃO DAS FREGUESIAS DE PESO E VALES DO RIO',[['050344','Peso'],['050345','Vales do Rio']]],
  ['060220','UNIÃO DAS FREGUESIAS DE CANTANHEDE E POCARIÇA',[['060225','Cantanhede'],['060226','Pocariça']]],
  ['060519','ALHADAS',[['060525','Alhadas'],['060526','Brenha']]],
  ['060520','BUARCOS E SAO JULIAO',[['060527','Buarcos'],['060530','São Julião da Figueira da Foz']]],
  ['060521','FERREIRA-A-NOVA',[['060528','Ferreira-a-Nova'],['060529','Santana']]],
  ['060708','UNIÃO DAS FREGUESIAS DE LOUSÃ E VILARINHO',[['060709','Lousã'],['060710','Vilarinho']]],
  ['061122','UNIÃO DAS FREGUESIAS DE ERVEDAL E VILA FRANCA DA BEIRA',[['061127','Ervedal'],['061128','Vila Franca da Beira']]],
  ['070208','UNIÃO DAS FREGUESIAS DE GAFANHOEIRA (SÃO PEDRO) E SABUGUEIRO',[['070210','Gafanhoeira (São Pedro)'],['070211','Sabugueiro']]],
  ['070611','UNIÃO DAS FREGUESIAS DE CORTIÇADAS DE LAVRE E LAVRE',[['070613','Cortiçadas de Lavre'],['070614','Lavre']]],
  ['070612','UNIÃO FREG DE NOSSA SENHORA DA VILA, NOSSA SENHORA DO BISPO E SILVEIRAS',[['070615','Nossa Senhora da Vila'],['070616','Nossa Senhora do Bispo'],['070617','Silveiras']]],
  ['070909','UNIÃO DAS FREGUESIAS DE AMIEIRA E ALQUEVA',[['070911','Alqueva'],['070912','Amieira']]],
  ['070910','UNIÃO DAS FREGUESIAS DE SÃO BARTOLOMEU DO OUTEIRO E ORIOLA',[['070913','Oriola'],['070914','São Bartolomeu do Outeiro']]],
  ['080507','UNIÃO DAS FREGUESIAS DE CONCEIÇÃO E ESTOI',[['080509','Conceição'],['080510','Estoi']]],
  ['080707','UNIÃO DAS FREGUESIAS DE BENSAFRIM E BARÃO DE SÃO JOÃO',[['080709','Barão de São João'],['080710','Bensafrim']]],
  ['080812','UNIÃO DE FREGUESIAS DE QUERENÇA, TÔR E BENAFIM',[['080813','Benafim'],['080814','Querença'],['080815','Tôr']]],
  ['081006','UNIÃO DAS FREGUESIAS DE MONCARAPACHO E FUSETA',[['081007','Fuseta'],['081008','Moncarapacho']]],
  ['081309','UNIÃO DAS FREGUESIAS DE ALCANTARILHA E PÊRA',[['081311','Alcantarilha'],['081313','Pêra']]],
  ['081310','UNIÃO DAS FREGUESIAS DE ALGOZ E TUNES',[['081312','Algoz'],['081314','Tunes']]],
  ['081410','UNIÃO DAS FREGUESIAS DE CONCEIÇÃO E CABANAS DE TAVIRA',[['081413','Cabanas de Tavira'],['081414','Conceição']]],
  ['081411','UNIÃO DAS FREGUESIAS DE LUZ DE TAVIRA E SANTO ESTÊVÃO',[['081415','Luz de Tavira'],['081416','Santo Estêvão']]],
  ['091232','UNIÃO DAS FREGUESIAS DE SANTA MARINHA E SÃO MARTINHO',[['091238','Santa Marinha'],['091239','São Martinho']]],
  ['091233','UNIÃO DAS FREGUESIAS DE SEIA, SÃO ROMÃO E LAPA DOS DINHEIROS',[['091237','Lapa dos Dinheiros'],['091240','São Romão'],['091241','Seia']]],
  ['100936','UNIÃO DAS FREGUESIAS DE MONTE REDONDO E CARREIRA',[['100941','Carreira'],['100942','Monte Redondo']]],
  ['100940','UNIÃO DAS FREGUESIAS DE SOUTO DA CARPALHOSA E ORTIGOSA',[['100943','Ortigosa'],['100944','Souto da Carpalhosa']]],
  ['101518','UNIÃO DAS FREGUESIAS DE GUIA, ILHA E MATA MOURISCA',[['101521','Guia'],['101522','Ilha'],['101523','Mata Mourisca']]],
  ['101519','UNIÃO DAS FREGUESIAS DE SANTIAGO E SÃO SIMÃO DE LITÉM E ALBERGARIA DOS DOZE',[['101520','Albergaria dos Doze'],['101524','Santiago de Litém'],['101525','São Simão de Litém']]],
  ['110812','UNIÃO DAS FREGUESIAS DE LOURINHÃ E ATALAIA',[['110815','Atalaia'],['110816','Lourinhã']]],
  ['111123','UNIÃO DAS FREGUESIAS DE ALMARGEM DO BISPO, PÊRO PINHEIRO E MONTELAVAR',[['111129','Almargem do Bispo'],['111131','Montelavar'],['111132','Pêro Pinheiro']]],
  ['111126','UNIÃO DAS FREGUESIAS DE QUELUZ E BELAS',[['111130','Belas'],['111133','Queluz']]],
  ['111127','UNIÃO DAS FREGUESIAS DE SÃO JOÃO DAS LAMPAS E TERRUGEM',[['111134','São João das Lampas'],['111135','Terrugem']]],
  ['111321','UNIÃO DAS FREGUESIAS DE A DOS CUNHADOS E MACEIRA',[['111327','A dos Cunhados'],['111329','Maceira']]],
  ['111324','UNIÃO DAS FREGUESIAS DE DOIS PORTOS E RUNA',[['111328','Dois Portos'],['111330','Runa']]],
  ['120715','UNIÃO DAS FREGUESIAS DE TERRUGEM E VILA BOIM',[['120716','Terrugem'],['120717','Vila Boim']]],
  ['121308','UNIÃO DAS FREGUESIAS DE PONTE DE SOR, TRAMAGA E VALE DE AÇOR',[['121309','Ponte de Sor'],['121310','Tramaga'],['121311','Vale de Açor']]],
  ['130530','UNIÃO DAS FREGUESIAS DE LUSTOSA E BARROSAS (SANTO ESTÊVÃO)',[['130533','Barrosas (Santo Estêvão)'],['130534','Lustosa']]],
  ['130738','PENHA LONGA e PAÇOS DE GAIOLO',[['130742','Paços de Gaiolo'],['130743','Penha Longa']]],
  ['130811','UNIÃO DAS FREGUESIAS DE CUSTÓIAS, LEÇA DO BALIO E GUIFÕES',[['130815','Custóias'],['130816','Guifões'],['130819','Leça do Balio']]],
  ['130812','UNIÃO DAS FREGUESIAS DE MATOSINHOS E LEÇA DA PALMEIRA',[['130818','Leça da Palmeira'],['130820','Matosinhos']]],
  ['130813','UNIÃO DAS FREGUESIAS DE PERAFITA, LAVRA E SANTA CRUZ DO BISPO',[['130817','Lavra'],['130821','Perafita'],['130822','Santa Cruz do Bispo']]],
  ['130814','UNIÃO DAS FREGUESIAS DE SÃO MAMEDE DE INFESTA E SENHORA DA HORA',[['130823','São Mamede de Infesta'],['130824','Senhora da Hora']]],
  ['130917','FRAZÃO ARREIGADA',[['130920','Arreigada'],['130922','Frazão']]],
  ['130918','PAÇOS DE FERREIRA',[['130924','Modelos'],['130925','Paços de Ferreira']]],
  ['130919','SANFINS LAMOSO CODESSOS',[['130921','Codessos'],['130923','Lamoso'],['130926','Sanfins de Ferreira']]],
  ['131313','UNIÃO DAS FREGUESIAS DE AVER-O-MAR, AMORIM E TERROSO',[['131317','Amorim'],['131319','Aver-o-Mar'],['131323','Terroso']]],
  ['131314','UNIÃO DAS FREGUESIAS DE AGUÇADOURA E NAVAIS',[['131316','Aguçadoura'],['131321','Navais']]],
  ['131315','UNIÃO DAS FREGUESIAS DA PÓVOA DE VARZIM, BEIRIZ E ARGIVAI',[['131318','Argivai'],['131320','Beiriz'],['131322','Póvoa de Varzim']]],
  ['131506','UNIÃO DAS FREGUESIAS DE CAMPO E SOBRADO',[['131507','Campo'],['131508','Sobrado']]],
  ['131632','UNIÃO DAS FREGUESIAS DE FORNELO E VAIRÃO',[['131640','Fornelo'],['131645','Vairão']]],
  ['131633','UNIÃO DAS FREGUESIAS DE MALTA E CANIDELO',[['131639','Canidelo'],['131641','Malta']]],
  ['131634','UNIÃO DAS FREGUESIAS DE RETORTA E TOUGUES',[['131642','Retorta'],['131644','Tougues']]],
  ['131635','UNIÃO DAS FREGUESIAS DE RIO MAU E ARCOS',[['131638','Arcos'],['131643','Rio Mau']]],
  ['131725','UNIÃO DAS FREGUESIAS DE GRIJÓ E SERMONDE',[['131733','Grijó'],['131744','Sermonde']]],
  ['131726','UNIÃO DAS FREGUESIAS DE GULPILHARES E VALADARES',[['131734','Gulpilhares'],['131746','Valadares']]],
  ['131727','UNIÃO DAS FREGUESIAS DE MAFAMUDE E VILAR DO PARAÍSO',[['131736','Mafamude'],['131747','Vilar do Paraíso']]],
  ['131728','UNIÃO DAS FREGUESIAS DE PEDROSO E SEIXEZELO',[['131738','Pedroso'],['131743','Seixezelo']]],
  ['131729','UNIÃO DAS FREGUESIAS DE SANDIM, OLIVAL, LEVER E CRESTUMA',[['131732','Crestuma'],['131735','Lever'],['131737','Olival'],['131740','Sandim']]],
  ['131730','UNIÃO DAS FREGUESIAS DE SANTA MARINHA E SÃO PEDRO DA AFURADA',[['131741','Santa Marinha'],['131742','São Pedro da Afurada']]],
  ['131731','UNIÃO DAS FREGUESIAS DE SERZEDO E PEROSINHO',[['131739','Perosinho'],['131745','Serzedo']]],
  ['131809','UNIÃO DAS FREGUESIAS DE ALVARELHOS E GUIDÕES',[['131812','Alvarelhos'],['131813','Guidões']]],
  ['140909','UNIÃO DAS FREGUESIAS DE CORUCHE, FAJARDA E ERRA',[['140910','Coruche'],['140911','Erra'],['140912','Fajarda']]],
  ['141507','UNIÃO DAS FREGUESIAS DE GLÓRIA DO RIBATEJO E GRANHO',[['141510','Glória do Ribatejo'],['141511','Granho']]],
  ['141508','UNIÃO DAS FREGUESIAS DE SALVATERRA DE MAGOS E FOROS DE SALVATERRA',[['141509','Foros de Salvaterra'],['141512','Salvaterra de Magos']]],
  ['141634','UNIÃO DAS FREGUESIAS DE SÃO VICENTE DO PAUL E VALE DE FIGUEIRA',[['141635','São Vicente do Paul'],['141636','Vale de Figueira']]],
  ['141820','UNIÃO DAS FREGUESIAS DE SERRA E JUNCEIRA',[['141822','Junceira'],['141823','Serra']]],
  ['142120','UNIÃO DAS FREGUESIAS DE GONDEMARIA E OLIVAL',[['142125','Gondemaria'],['142127','Olival']]],
  ['142121','UNIÃO DAS FREGUESIAS DE MATAS E CERCAL',[['142124','Cercal'],['142126','Matas']]],
  ['142122','UNIÃO DAS FREGUESIAS DE RIO DE COUROS E CASAL DOS BERNARDOS',[['142123','Casal dos Bernardos'],['142128','Rio de Couros']]],
  ['150107','UNIÃO FREG DE ALCÁCER DO SAL (SANTA MARIA DO CASTELO E SANTIAGO) E SANTA SUSANA',[['150108','Alcácer do Sal (Santa Maria do Castelo)'],['150109','Alcácer do Sal (Santiago)'],['150110','Santa Susana']]],
  ['150913','UNIÃO DAS FREGUESIAS DE SÃO DOMINGOS E VALE DE ÁGUA',[['150914','São Domingos'],['150915','Vale de Água']]],
  ['151007','UNIÃO DAS FREGUESIAS DO SEIXAL, ARRENTELA E ALDEIA DE PAIO PIRES',[['151008','Arrentela'],['151009','Paio Pires'],['151010','Seixal']]],
  ['160754','ASSOCIAÇÃO DE FREGUESIAS DO VALE DO NEIVA',[['160761','Gaifar'],['160762','Sandiães'],['160763','Vilar das Almas']]],
  ['160941','UNIÃO DAS FREGUESIAS DE BARROSELAS E CARVOEIRO',[['160949','Barroselas'],['160951','Carvoeiro']]],
  ['160942','UNIÃO DAS FREGUESIAS DE CARDIELOS E SERRELEIS',[['160950','Cardielos'],['160953','Serreleis']]],
  ['160944','UNIÃO DAS FREGUESIAS DE MAZAREFES E VILA FRIA',[['160952','Mazarefes'],['160954','Vila Fria']]],
  ['170816','UNIÃO DAS FREGUESIAS DE POIARES E CANELAS',[['170817','Canelas'],['170818','Poiares']]],
  ['171111','UNIÃO DAS FREGUESIAS DE LOBRIGOS (SÃO MIGUEL E SÃO JOÃO BAPTISTA) E SANHOANE',[['171113','Lobrigos (São João Baptista)'],['171114','Lobrigos (São Miguel)'],['171115','Sanhoane']]],
  ['182011','UNIÃO DAS FREGUESIAS DE GOUVIÃES E UCANHA',[['182015','Gouviães'],['182017','Ucanha']]],
  ['182013','UNIÃO DAS FREGUESIAS DE TAROUCA E DÁLVARES',[['182014','Dálvares'],['182016','Tarouca']]],
  ['182127','UNIÃO DAS FREGUESIAS DE BARREIRO DE BESTEIROS E TOURIGO',[['182134','Barreiro de Besteiros'],['182138','Tourigo']]],
  ['182131','UNIÃO DAS FREGUESIAS DE SÃO MIGUEL DO OUTEIRO E SABUGOSA',[['182136','Sabugosa'],['182137','São Miguel do Outeiro']]],
  ['182133','UNIÃO DAS FREGUESIAS DE VILAR DE BESTEIROS E MOSTEIRO DE FRÁGUAS',[['182135','Mosteiro de Fráguas'],['182139','Vilar de Besteiros']]],
];

/* o índice da tabela pelo código da união */
const IRS_FREGUESIAS_UNIAO=new Map(IRS_FREGUESIAS_2025.map(l=>[l[0],l]));

/* O código de uma freguesia posto na forma da tabela: sem espaços e em maiúsculas
   (a caderneta e o Portal escrevem 0302FE, quem digita escreve 0302fe).
   Recebe: codigo — o que a pessoa escreveu ou a app guardou (texto, ou um número).
   Devolve: o código normalizado (texto); '' se não for um texto nem um número. */
const freguesiaCodigoNorm=codigo=>
  typeof codigo==='string'||typeof codigo==='number'?String(codigo).replace(/\s+/g,'').toUpperCase():'';

/* Se um código de freguesia é o de uma união extinta em outubro de 2025 (Lei 25-A/2025),
   e que freguesias a substituíram. Pura, e nunca lança: o que não é um código dá null.
   As freguesias repostas saem pela ordem da tabela da AT (a do código) e são cópias,
   que quem chama pode mudar sem estragar a tabela.
   Recebe: codigo — o código da freguesia (texto de 6 caracteres; maiúsculas ou minúsculas,
   com ou sem espaços, e um número também se aceita).
   Devolve: null (não é uma união extinta, ou não é um código), ou
   {uniao:{codigo, nome}, repostas:[{codigo, nome}, …]}. */
function freguesiaReposta(codigo){
  const l=IRS_FREGUESIAS_UNIAO.get(freguesiaCodigoNorm(codigo));
  if(!l)return null;
  return {uniao:{codigo:l[0],nome:l[1]},repostas:l[2].map(r=>({codigo:r[0],nome:r[1]}))};
}
