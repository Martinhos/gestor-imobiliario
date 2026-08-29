# Gestor Imobiliário — app Android

Concha nativa (WebView) que carrega a **versão web** publicada em
`https://gestor-imobiliario.martinhos.workers.dev` — multi-utilizador, com
sincronização e partilha de casas. A app está sempre atualizada sem reinstalar:
cada deploy da web chega logo ao telemóvel.

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

O projeto inclui `app/gestor.keystore`, uma chave fixa versionada de propósito:
sem ela, cada compilação usaria uma chave diferente e o Android recusaria
instalar a atualização por cima da anterior. Serve para uso pessoal / sideload —
para a Play Store, gera uma chave tua e substitui o bloco `signingConfigs`.

## Especificações

- `applicationId`: `pt.gestorimobiliario.app`
- Mínimo: Android 10 (API 29) · Alvo: Android 15 (API 35)
- AGP 8.7.3 · Gradle 8.9 · JDK 17
- Dependências: `androidx.webkit`, `androidx.core`
