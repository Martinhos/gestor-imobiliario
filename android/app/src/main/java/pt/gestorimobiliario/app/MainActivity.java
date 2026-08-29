package pt.gestorimobiliario.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Locale;

/**
 * Embrulho nativo da versao web do "Gestor Imobiliario".
 *
 * A app carrega a versao publicada em Cloudflare (multi-utilizador, com
 * sincronizacao e partilha de casas) em vez de uma copia local do HTML:
 * assim esta sempre atualizada sem reinstalar. O service worker da pagina
 * mantem a app a abrir mesmo sem rede; a ponte nativa continua a tratar de
 * guardar/abrir ficheiros, partilhar e lembretes.
 */
public class MainActivity extends Activity {

    private static final String HOST = "gestor-imobiliario.martinhos.workers.dev";
    private static final String START_URL = "https://" + HOST + "/";

    private static final int REQ_PICK_FORM = 11;   // <input type="file"> da pagina
    private static final int REQ_CREATE_DOC = 12;  // guardar copia (Drive, Ficheiros, ...)
    private static final int REQ_OPEN_DOC = 13;    // abrir copia

    private WebView web;
    private ValueCallback<Uri[]> formCallback;
    private byte[] pendingBytes;
    private String insetsJs;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        // Lembretes dos movimentos recorrentes: canal + autorizacao (Android 13+).
        Reminders.ensureChannel(this);
        if (android.os.Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                   != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 21);
        }

        web = new WebView(this);
        setContentView(web);

        // Desenhamos de bordo a bordo e entregamos as medidas da area segura a
        // propria pagina: o fundo do cabecalho estende-se por baixo da barra de
        // estado, mas o conteudo nunca fica tapado.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        ViewCompat.setOnApplyWindowInsetsListener(web, (v, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            float d = getResources().getDisplayMetrics().density;
            insetsJs = String.format(Locale.US,
                    "window.__setInsets && window.__setInsets(%.1f,%.1f,%.1f,%.1f)",
                    bars.top / d, bars.bottom / d, bars.left / d, bars.right / d);
            runJs(insetsJs);
            return windowInsets;
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);       // localStorage (cache local + sessao)
        s.setDatabaseEnabled(true);         // IndexedDB (anexos)
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setTextZoom(100);

        // A sessao vive num cookie: persisti-lo evita voltar a pedir login.
        CookieManager.getInstance().setAcceptCookie(true);

        // A pagina tem tema escuro proprio: o WebView entrega-lhe a preferencia
        // do sistema (prefers-color-scheme) em vez de escurecer a forca.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(s, false);
        }

        // Sem WebChromeClient o WebView ignora os dialogos de JS e os <input type="file">.
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (formCallback != null) formCallback.onReceiveValue(null);
                formCallback = cb;
                // Abrimos tudo, excepto quando so se pedem imagens: um CSV do
                // Splitwise chega como application/octet-stream e ficava a
                // cinzento se respeitassemos o atributo accept.
                boolean onlyImages = false;
                int declared = 0;
                String[] accept = params.getAcceptTypes();
                if (accept != null) {
                    boolean all = true;
                    for (String a : accept) {
                        if (a == null || a.trim().isEmpty()) continue;
                        declared++;
                        if (!a.trim().toLowerCase(Locale.US).startsWith("image/")) { all = false; }
                    }
                    onlyImages = declared > 0 && all;
                }
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType(onlyImages ? "image/*" : "*/*");
                if (params.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                    i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                }
                try {
                    startActivityForResult(i, REQ_PICK_FORM);
                    return true;
                } catch (Exception e) {
                    formCallback = null;
                    toast("Nao foi possivel abrir o seletor de ficheiros.");
                    return false;
                }
            }
        });

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (HOST.equals(u.getHost())) return false;   // a app fica dentro do site
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (ActivityNotFoundException ignored) { }
                return true;
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                v.evaluateJavascript(DOWNLOAD_SHIM, null);
                if (insetsJs != null) v.evaluateJavascript(insetsJs, null);  // a pagina recarregou
                CookieManager.getInstance().flush();  // sessao sobrevive a fechar a app
            }
        });

        web.addJavascriptInterface(new Bridge(), "Android");

        // Rede de seguranca para downloads que escapem ao shim.
        web.setDownloadListener((url, agent, disposition, mime, size) -> {
            if (url.startsWith("blob:")) {
                web.evaluateJavascript(
                        "fetch('" + url + "').then(r=>r.blob()).then(b=>{var f=new FileReader();" +
                        "f.onloadend=function(){Android.saveAs('exportacao',b.type||'',String(f.result).split(',')[1])};" +
                        "f.readAsDataURL(b)})", null);
            }
        });

        boolean restored = state != null && web.restoreState(state) != null;
        if (!restored) web.loadUrl(START_URL);
    }

    /**
     * A app descarrega CSV, copias de seguranca e PDFs com <a download href="blob:">.
     * O WebView nao sabe tratar blobs: intercetamos o clique, lemos o conteudo em
     * base64 e entregamo-lo ao seletor do Android (onde aparece o Google Drive).
     */
    private static final String DOWNLOAD_SHIM =
            "(function(){if(window.__giShim)return;window.__giShim=1;" +
            "var c=HTMLAnchorElement.prototype.click;" +
            "HTMLAnchorElement.prototype.click=function(){try{" +
            "var h=this.getAttribute('href')||'',n=this.getAttribute('download');" +
            "if(n&&(h.indexOf('blob:')===0||h.indexOf('data:')===0)){" +
            "fetch(h).then(function(r){return r.blob()}).then(function(b){" +
            "var f=new FileReader();f.onloadend=function(){" +
            "Android.saveAs(n,b.type||'',String(f.result).split(',')[1])};" +
            "f.readAsDataURL(b)})['catch'](function(e){Android.toast('Nao foi possivel exportar: '+e)});return;}" +
            "}catch(e){}return c.apply(this,arguments)}})()";

    private final class Bridge {

        /** shareReport() na pagina: window.Android.shareText(titulo, texto). */
        @JavascriptInterface
        public void shareText(final String title, final String text) {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("text/plain");
                i.putExtra(Intent.EXTRA_SUBJECT, title == null ? "" : title);
                i.putExtra(Intent.EXTRA_TEXT, text == null ? "" : text);
                try {
                    startActivity(Intent.createChooser(i, "Partilhar"));
                } catch (ActivityNotFoundException e) {
                    toast("Nenhuma app disponivel para partilhar.");
                }
            });
        }

        /** Abre o seletor "guardar em" do Android (o Google Drive aparece la). */
        @JavascriptInterface
        public void saveAs(final String name, final String mime, final String base64) {
            try {
                pendingBytes = Base64.decode(base64, Base64.DEFAULT);
            } catch (Exception e) {
                toast("Conteudo invalido.");
                return;
            }
            final String type = (mime == null || mime.isEmpty()) ? "application/octet-stream"
                    : mime.split(";")[0].trim();
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType(type);
                i.putExtra(Intent.EXTRA_TITLE, name == null || name.isEmpty() ? "ficheiro" : name);
                try {
                    startActivityForResult(i, REQ_CREATE_DOC);
                } catch (ActivityNotFoundException e) {
                    toast("Nao ha nenhuma app para guardar ficheiros.");
                }
            });
        }

        /** Abre um ficheiro (copia de seguranca ou CSV) e devolve-o a pagina. */
        @JavascriptInterface
        public void openFile(final String mime) {
            runOnUiThread(() -> {
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{
                        mime == null || mime.isEmpty() ? "application/json" : mime,
                        "application/json", "text/csv", "text/plain", "text/comma-separated-values"});
                try {
                    startActivityForResult(i, REQ_OPEN_DOC);
                } catch (ActivityNotFoundException e) {
                    toast("Nao ha nenhuma app para escolher ficheiros.");
                }
            });
        }

        @JavascriptInterface
        public void toast(String msg) { MainActivity.this.toast(msg); }

        /** A pagina entrega a lista de lembretes futuros: [{id,at,title,text}] (at em epoch ms). */
        @JavascriptInterface
        public void scheduleReminders(final String json) {
            runOnUiThread(() -> Reminders.save(MainActivity.this, json));
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);

        if (req == REQ_PICK_FORM) {
            if (formCallback == null) return;
            Uri[] picked = null;
            if (res == RESULT_OK && data != null) {
                if (data.getClipData() != null) {
                    int n = data.getClipData().getItemCount();
                    picked = new Uri[n];
                    for (int k = 0; k < n; k++) picked[k] = data.getClipData().getItemAt(k).getUri();
                } else if (data.getData() != null) {
                    picked = new Uri[]{data.getData()};
                }
            }
            if (res == RESULT_OK && picked == null) toast("Nenhum ficheiro escolhido.");
            formCallback.onReceiveValue(picked);
            formCallback = null;
            return;
        }

        if (req == REQ_CREATE_DOC) {
            byte[] bytes = pendingBytes;
            pendingBytes = null;
            if (res != RESULT_OK || data == null || data.getData() == null || bytes == null) return;
            try (OutputStream out = getContentResolver().openOutputStream(data.getData(), "wt")) {
                if (out == null) throw new IllegalStateException("sem acesso ao ficheiro");
                out.write(bytes);
                toast("Guardado.");
            } catch (Exception e) {
                toast("Nao foi possivel guardar: " + e.getMessage());
            }
            return;
        }

        if (req == REQ_OPEN_DOC) {
            if (res != RESULT_OK || data == null || data.getData() == null) return;
            Uri uri = data.getData();
            try (InputStream in = getContentResolver().openInputStream(uri)) {
                if (in == null) throw new IllegalStateException("sem acesso ao ficheiro");
                ByteArrayOutputStream buf = new ByteArrayOutputStream();
                byte[] chunk = new byte[8192];
                int r;
                while ((r = in.read(chunk)) != -1) buf.write(chunk, 0, r);
                String text = buf.toString("UTF-8");
                String name = uri.getLastPathSegment();
                if (name == null) name = "ficheiro";
                final String js = "window.__fileLoaded && window.__fileLoaded("
                        + JSONObject.quote(name) + "," + JSONObject.quote(text) + ")";
                runOnUiThread(() -> web.evaluateJavascript(js, null));
            } catch (Exception e) {
                toast("Nao foi possivel ler o ficheiro: " + e.getMessage());
            }
        }
    }

    private void runJs(final String js) {
        runOnUiThread(() -> { if (web != null) web.evaluateJavascript(js, null); });
    }

    private void toast(final String msg) {
        runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show());
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
