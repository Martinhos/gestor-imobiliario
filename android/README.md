# Rendorium — app Android

Concha nativa (WebView) que carrega a **versão web** publicada em
`https://app.rendorium.com` (o `HOST` do flavor `producao` em `app/build.gradle`,
que a `MainActivity.java` lê de `BuildConfig.HOST`; a app de dev carrega
`https://dev.rendorium.com`) — multi-utilizador, com sincronização e partilha de
casas. A app atualiza-se sem reinstalar: ao
abrir, pergunta ao `/versao.json` que versão está publicada e, havendo uma mais
nova, recarrega-se com ela. Por isso uma publicação da web só chega ao telemóvel
quando sobe a versão (a primeira entrada de `web/avisos.js`) — a cache offline
tem o nome da versão.

O que a concha nativa acrescenta ao site:

| Detalhe | Porquê |
|---|---|
| Ponte `Android.saveAs()` / `Android.openFile()` | Guardar/abrir cópias e PDFs pelo seletor do sistema (o Google Drive aparece como destino). |
| Ponte `Android.shareText()` | O botão Partilhar da Avaliação abre o menu de partilha do sistema. |
| `Android.scheduleReminders()` | Notificações locais dos movimentos por confirmar/em atraso (AlarmManager), mesmo com a app fechada. |
| Interceção de downloads `blob:` | O WebView não sabe descarregar blobs (CSV, cópias, PDFs). |
| Cookie persistente + `setDomStorageEnabled` | A sessão e a cache local sobrevivem a fechar a app; o service worker mantém a app a abrir offline. |
| Insets da barra de estado | Desenho bordo a bordo sem tapar o cabeçalho. |

## Dois flavors: produção e dev

A app de dev instala-se **ao lado** da de produção, no mesmo telemóvel, e cada
uma carrega o seu domínio. O que as distingue é o *product flavor* (dimensão
`ambiente` em `app/build.gradle`):

| | `producao` | `dev` |
|---|---|---|
| `applicationId` | `pt.gestorimobiliario.app` | `pt.gestorimobiliario.app.dev` (`applicationIdSuffix`) |
| Nome | Rendorium | Rendorium DEV |
| Ícone | casa a branco sobre verde | casa a branco sobre âmbar, com «DEV» por baixo |
| `HOST` (`BuildConfig.HOST`) | `app.rendorium.com` | `dev.rendorium.com` |
| `versionName` | `23.0` | `23.0-dev` (`versionNameSuffix`) |
| Recursos | `app/src/main/res` | `app/src/dev/res` sobrepõe-se a main pelo nome (`app_name`, `ic_launcher_background`, `ic_launcher_foreground`) |

O Android distingue apps pelo `applicationId`, e é só por isso que as duas
coexistem — não pela chave de assinatura.

## Compilar

O APK é compilado e assinado automaticamente pelo GitHub Actions a cada deploy,
nos dois ambientes: o `main` compila o flavor `producao` e o `dev` o flavor
`dev`. Fica disponível para download nas **Definições** da própria app web de
cada ambiente (em `dev.rendorium.com` é o APK de dev).

Localmente (JDK 17 + Android SDK):

```bash
./gradlew assembleProducaoRelease
./gradlew assembleDevRelease
```

O APK fica em `app/build/outputs/apk/<flavor>/release/app-<flavor>-release.apk`
(`app-producao-release.apk`, `app-dev-release.apk`). O `assembleRelease` a secas
compila os dois.

## Assinatura

A chave é fixa — sem isso cada compilação usaria uma chave diferente e o Android
recusaria instalar a atualização por cima da anterior —, mas **não vive no
repositório**. Vive em dois sítios:

- **No CI**, nos segredos `ANDROID_KEYSTORE_B64` (a chave em base64) e
  `ANDROID_KEYSTORE_PASS`. O deploy escreve-a no disco do runner antes de
  compilar, e o runner morre com o trabalho.
- **Nesta máquina**, em `android/keystore.properties`, que o `.gitignore` cobre:

```properties
storeFile=app/release.keystore
storePassword=…
keyAlias=gestor
keyPassword=…
```

Sem chave, o `assembleDebug` compila com a chave automática do Android e o
`assembleRelease` para com uma mensagem a dizer o que falta.

### Chave de dev

O flavor `dev` assina com uma **chave de dev** quando ela existe; sem ela, cai
na chave fixa de produção, e o Gradle diz qual usou (uma linha «Assinatura:
producao -> …; dev -> …» ao configurar; o deploy escreve-o também no resumo da
corrida). A chave de dev é opcional porque a coexistência das duas apps vem do
`applicationId`, não da chave. Vale a pena tê-la para não andar a usar a chave
de produção em cada push ao `dev` — e, ao contrário da de produção, pode
tratar-se como descartável: se se perder, faz-se outra e reinstala-se a app de
dev, que ninguém tem senão quem programa.

Criar uma (o `.gitignore` cobre `app/*.keystore`):

```bash
keytool -genkeypair -v -keystore app/dev.keystore -alias dev -keyalg RSA -keysize 2048 -validity 10000
```

Onde o Gradle a vai buscar:

- **No CI**, nos segredos `ANDROID_KEYSTORE_DEV_B64` (a chave em base64) e
  `ANDROID_KEYSTORE_DEV_PASS`. Fora de produção, o deploy escreve-a no disco do
  runner como `ANDROID_KEYSTORE_DEV_FILE` e nem toca na de produção; se faltar
  um dos dois segredos, escreve a de produção e deixa no resumo da corrida que
  o APK de dev foi assinado com ela.
- **Nesta máquina**, nas linhas `dev*` do mesmo `android/keystore.properties`
  (ou nas variáveis `ANDROID_KEYSTORE_DEV_FILE`, `ANDROID_KEYSTORE_DEV_PASS`,
  `ANDROID_KEYSTORE_DEV_ALIAS`, `ANDROID_KEY_DEV_PASS`):

```properties
devStoreFile=app/dev.keystore
devStorePassword=…
devKeyAlias=dev
devKeyPassword=…
```

### A chave anterior está comprometida

Até setembro de 2026 a chave e a palavra-passe estavam neste repositório. Quando
ele passou a público, qualquer pessoa ficou a poder assinar um APK com a
identidade da app — e o Android aceitaria esse APK como atualização por cima do
que as pessoas têm instalado. Por isso a chave foi substituída.

Reescrever o histórico não resolveria nada: a chave antiga já esteve exposta e
conta-se como perdida para sempre. O que muda é que a nova nunca lá entra.

**Consequência para quem já tem a app:** o próximo APK não instala por cima. É
preciso desinstalar e voltar a instalar. Quem tiver conta na nuvem recupera tudo
ao entrar; quem usa a app só neste aparelho deve guardar uma cópia antes, em
**Definições → Importar e cópias**. O aviso está no botão de descarregar, dentro
da app.

## Especificações

- `applicationId`: `pt.gestorimobiliario.app` (produção) · `pt.gestorimobiliario.app.dev` (dev)
- Mínimo: Android 10 (API 29) · Alvo: Android 15 (API 35)
- AGP 8.7.3 · Gradle 8.9 · JDK 17
- Dependências: `androidx.webkit`, `androidx.core`
