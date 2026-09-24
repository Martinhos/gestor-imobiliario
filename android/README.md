# Gestor Imobiliário — app Android

Concha nativa (WebView) que carrega a **versão web** publicada em
`https://app.rendorium.com` (o `HOST` da `MainActivity.java`) — multi-utilizador,
com sincronização e partilha de casas. A app atualiza-se sem reinstalar: ao
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

## Compilar

O APK é compilado e assinado automaticamente pelo GitHub Actions a cada deploy e
fica disponível para download nas **Definições** da própria app web.

Localmente (JDK 17 + Android SDK):

```bash
./gradlew assembleRelease
```

O APK fica em `app/build/outputs/apk/release/app-release.apk`.

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

- `applicationId`: `pt.gestorimobiliario.app`
- Mínimo: Android 10 (API 29) · Alvo: Android 15 (API 35)
- AGP 8.7.3 · Gradle 8.9 · JDK 17
- Dependências: `androidx.webkit`, `androidx.core`
