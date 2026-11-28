/* ================= FREGUESIAS · O LUGAR PELO CÓDIGO =================
   O distrito, o concelho e, quando a app o tem, o nome da freguesia de um código
   de freguesia da AT (6 caracteres: distrito 2, concelho 2, freguesia 2) — o que
   o formulário do imóvel escreve sozinho nos Dados registais (imovel.js:imvLugarPreencher).

   Os dois primeiros pares do código da AT são os do Código da Divisão
   Administrativa do INE (o DICO: distrito ou ilha, e município), os mesmos da
   Carta Administrativa Oficial de Portugal da DGT. Fonte: INE, «Código da
   divisão administrativa (distritos/municípios/freguesias)», Revisão 2025,
   adotada pela Deliberação n.º 660/2025 do Conselho Superior de Estatística
   (Diário da República, 2.ª série, n.º 97, de 21 de maio de 2025), em
   https://smi.ine.pt/Versao/Detalhes/17 (a página da versão, vista a 27 de
   novembro de 2026). A Revisão 2025 só mexe nas freguesias (Lei n.º 25-A/2025):
   os 308 municípios e os códigos deles são os de sempre (os últimos criados
   foram em 1998: Odivelas 1116, Trofa 1318 e Vizela 0314). Conferidos com a
   tabela de correspondência da AT de 2025, que traz 438 códigos reais de 70
   concelhos (irs-freguesias-2025.js): todos caem num concelho daqui, e em
   todos os 70 o concelho é o das freguesias que lá estão (Anta e Guetim em
   Espinho, Grijó e Sermonde em Vila Nova de Gaia, Gouviães e Ucanha em
   Tarouca). Nas regiões autónomas, o primeiro par é a ilha (31 e 32 na
   Madeira, 41 a 49 nos Açores), e o campo do distrito leva o nome da região;
   a tabela da AT de 2025 não tem nenhuma, por isso estas não se conferiram
   com um código da AT.

   As freguesias pelo nome: só as que a tabela da AT de 2025 nomeia (as 302
   repostas em outubro de 2025, irs-freguesias-2025.js:IRS_FREGUESIAS_2025). As
   outras ficam por escrever: a lista inteira, com o código da AT de cada uma,
   está no ficheiro do INE da Revisão 2025, que a app ainda não traz. Um código
   de uma união extinta em 2025 dá o distrito e o concelho, sem freguesia: a
   união já não existe, e o aviso do formulário diz quais a substituíram. */

/* Os distritos e, nas regiões autónomas, as ilhas, pelo primeiro par do código. */
const FREG_DISTRITOS={
  '01':'Aveiro','02':'Beja','03':'Braga','04':'Bragança','05':'Castelo Branco','06':'Coimbra',
  '07':'Évora','08':'Faro','09':'Guarda','10':'Leiria','11':'Lisboa','12':'Portalegre',
  '13':'Porto','14':'Santarém','15':'Setúbal','16':'Viana do Castelo','17':'Vila Real','18':'Viseu',
  '31':'Região Autónoma da Madeira','32':'Região Autónoma da Madeira',
  '41':'Região Autónoma dos Açores','42':'Região Autónoma dos Açores','43':'Região Autónoma dos Açores',
  '44':'Região Autónoma dos Açores','45':'Região Autónoma dos Açores','46':'Região Autónoma dos Açores',
  '47':'Região Autónoma dos Açores','48':'Região Autónoma dos Açores','49':'Região Autónoma dos Açores'
};
/* Os concelhos de cada distrito (ou ilha), pela ordem do código: o primeiro é
   o 01, o segundo o 02, e assim por diante. */
const FREG_CONCELHOS_POR_DISTRITO={
  '01':['Águeda','Albergaria-a-Velha','Anadia','Arouca','Aveiro','Castelo de Paiva','Espinho','Estarreja','Santa Maria da Feira','Ílhavo','Mealhada','Murtosa','Oliveira de Azeméis','Oliveira do Bairro','Ovar','São João da Madeira','Sever do Vouga','Vagos','Vale de Cambra'],
  '02':['Aljustrel','Almodôvar','Alvito','Barrancos','Beja','Castro Verde','Cuba','Ferreira do Alentejo','Mértola','Moura','Odemira','Ourique','Serpa','Vidigueira'],
  '03':['Amares','Barcelos','Braga','Cabeceiras de Basto','Celorico de Basto','Esposende','Fafe','Guimarães','Póvoa de Lanhoso','Terras de Bouro','Vieira do Minho','Vila Nova de Famalicão','Vila Verde','Vizela'],
  '04':['Alfândega da Fé','Bragança','Carrazeda de Ansiães','Freixo de Espada à Cinta','Macedo de Cavaleiros','Miranda do Douro','Mirandela','Mogadouro','Torre de Moncorvo','Vila Flor','Vimioso','Vinhais'],
  '05':['Belmonte','Castelo Branco','Covilhã','Fundão','Idanha-a-Nova','Oleiros','Penamacor','Proença-a-Nova','Sertã','Vila de Rei','Vila Velha de Ródão'],
  '06':['Arganil','Cantanhede','Coimbra','Condeixa-a-Nova','Figueira da Foz','Góis','Lousã','Mira','Miranda do Corvo','Montemor-o-Velho','Oliveira do Hospital','Pampilhosa da Serra','Penacova','Penela','Soure','Tábua','Vila Nova de Poiares'],
  '07':['Alandroal','Arraiolos','Borba','Estremoz','Évora','Montemor-o-Novo','Mora','Mourão','Portel','Redondo','Reguengos de Monsaraz','Vendas Novas','Viana do Alentejo','Vila Viçosa'],
  '08':['Albufeira','Alcoutim','Aljezur','Castro Marim','Faro','Lagoa','Lagos','Loulé','Monchique','Olhão','Portimão','São Brás de Alportel','Silves','Tavira','Vila do Bispo','Vila Real de Santo António'],
  '09':['Aguiar da Beira','Almeida','Celorico da Beira','Figueira de Castelo Rodrigo','Fornos de Algodres','Gouveia','Guarda','Manteigas','Mêda','Pinhel','Sabugal','Seia','Trancoso','Vila Nova de Foz Côa'],
  '10':['Alcobaça','Alvaiázere','Ansião','Batalha','Bombarral','Caldas da Rainha','Castanheira de Pera','Figueiró dos Vinhos','Leiria','Marinha Grande','Nazaré','Óbidos','Pedrógão Grande','Peniche','Pombal','Porto de Mós'],
  '11':['Alenquer','Arruda dos Vinhos','Azambuja','Cadaval','Cascais','Lisboa','Loures','Lourinhã','Mafra','Oeiras','Sintra','Sobral de Monte Agraço','Torres Vedras','Vila Franca de Xira','Amadora','Odivelas'],
  '12':['Alter do Chão','Arronches','Avis','Campo Maior','Castelo de Vide','Crato','Elvas','Fronteira','Gavião','Marvão','Monforte','Nisa','Ponte de Sor','Portalegre','Sousel'],
  '13':['Amarante','Baião','Felgueiras','Gondomar','Lousada','Maia','Marco de Canaveses','Matosinhos','Paços de Ferreira','Paredes','Penafiel','Porto','Póvoa de Varzim','Santo Tirso','Valongo','Vila do Conde','Vila Nova de Gaia','Trofa'],
  '14':['Abrantes','Alcanena','Almeirim','Alpiarça','Benavente','Cartaxo','Chamusca','Constância','Coruche','Entroncamento','Ferreira do Zêzere','Golegã','Mação','Rio Maior','Salvaterra de Magos','Santarém','Sardoal','Tomar','Torres Novas','Vila Nova da Barquinha','Ourém'],
  '15':['Alcácer do Sal','Alcochete','Almada','Barreiro','Grândola','Moita','Montijo','Palmela','Santiago do Cacém','Seixal','Sesimbra','Setúbal','Sines'],
  '16':['Arcos de Valdevez','Caminha','Melgaço','Monção','Paredes de Coura','Ponte da Barca','Ponte de Lima','Valença','Viana do Castelo','Vila Nova de Cerveira'],
  '17':['Alijó','Boticas','Chaves','Mesão Frio','Mondim de Basto','Montalegre','Murça','Peso da Régua','Ribeira de Pena','Sabrosa','Santa Marta de Penaguião','Valpaços','Vila Pouca de Aguiar','Vila Real'],
  '18':['Armamar','Carregal do Sal','Castro Daire','Cinfães','Lamego','Mangualde','Moimenta da Beira','Mortágua','Nelas','Oliveira de Frades','Penalva do Castelo','Penedono','Resende','Santa Comba Dão','São João da Pesqueira','São Pedro do Sul','Sátão','Sernancelhe','Tabuaço','Tarouca','Tondela','Vila Nova de Paiva','Viseu','Vouzela'],
  '31':['Calheta','Câmara de Lobos','Funchal','Machico','Ponta do Sol','Porto Moniz','Ribeira Brava','Santa Cruz','Santana','São Vicente'],
  '32':['Porto Santo'],
  '41':['Vila do Porto'],
  '42':['Lagoa','Nordeste','Ponta Delgada','Povoação','Ribeira Grande','Vila Franca do Campo'],
  '43':['Angra do Heroísmo','Praia da Vitória'],
  '44':['Santa Cruz da Graciosa'],
  '45':['Calheta','Velas'],
  '46':['Lajes do Pico','Madalena','São Roque do Pico'],
  '47':['Horta'],
  '48':['Lajes das Flores','Santa Cruz das Flores'],
  '49':['Corvo']
};
/* Os concelhos pelo código de quatro algarismos (distrito e concelho): '1106' → 'Lisboa'.
   Feito uma vez, ao carregar, a partir de FREG_CONCELHOS_POR_DISTRITO.
   Devolve: o objeto código → nome do concelho. */
const FREG_CONCELHOS=(function(){
  const m={};
  Object.keys(FREG_CONCELHOS_POR_DISTRITO).forEach(d=>FREG_CONCELHOS_POR_DISTRITO[d].forEach((n,i)=>{m[d+String(i+1).padStart(2,'0')]=n}));
  return m;
})();
/* Os nomes das freguesias que a app conhece, pelo código; feito na primeira
   pergunta (a tabela da AT de 2025 é da base e carrega-se antes deste ficheiro). */
let _fregNomes=null;
/* O índice dos nomes das freguesias repostas em 2025, pelo código delas.
   Devolve: um Map código → nome. */
function fregNomes(){
  if(_fregNomes)return _fregNomes;
  const m=new Map();
  IRS_FREGUESIAS_2025.forEach(l=>(l[2]||[]).forEach(r=>{if(!m.has(r[0]))m.set(r[0],r[1])}));
  return (_fregNomes=m);
}
/* O lugar de um código de freguesia da AT: o distrito (ou a região autónoma),
   o concelho e, quando a app o tem, o nome da freguesia. Pura, e nunca lança.
   Recebe: codigo — o código (texto ou número; maiúsculas ou minúsculas, com ou
   sem espaços).
   Devolve: {codigo, distrito, concelho, freguesia} ('' na freguesia sem nome
   conhecido), ou null quando não é um código de 6 caracteres de um concelho
   que existe. */
function freguesiaLugar(codigo){
  const c=typeof codigo==='string'||typeof codigo==='number'?String(codigo).replace(/\s+/g,'').toUpperCase():'';
  if(!/^\d{4}[0-9A-Z]{2}$/.test(c))return null;
  const concelho=FREG_CONCELHOS[c.slice(0,4)];
  if(!concelho)return null;
  return {codigo:c,distrito:FREG_DISTRITOS[c.slice(0,2)]||'',concelho,freguesia:fregNomes().get(c)||''};
}
