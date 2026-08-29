package pt.gestorimobiliario.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Lembretes dos movimentos recorrentes.
 *
 * A pagina entrega a lista completa de avisos futuros (entrada na janela de
 * confirmacao e passagem a atraso) sempre que os dados mudam; aqui limpa-se o
 * que estava agendado e agenda-se de novo com o AlarmManager. Depois de um
 * reinicio, o ReminderReceiver volta a agendar a partir da copia guardada.
 */
final class Reminders {

    static final String PREFS = "gi";
    static final String K_JSON = "reminders_json";
    static final String CHANNEL = "lembretes";
    private static final int MAX = 60;

    private Reminders() { }

    static void ensureChannel(Context ctx) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL,
                "Movimentos por confirmar", NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("Avisos quando um movimento recorrente entra para confirmacao ou fica em atraso.");
        nm.createNotificationChannel(ch);
    }

    /** Guarda a lista e (re)agenda tudo. json: [{id,at,title,text}] com at em epoch ms. */
    static void save(Context ctx, String json) {
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        cancelAll(ctx, p.getString(K_JSON, "[]"));
        p.edit().putString(K_JSON, json == null ? "[]" : json).apply();
        scheduleAll(ctx);
    }

    static void scheduleAll(Context ctx) {
        ensureChannel(ctx);
        SharedPreferences p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        long now = System.currentTimeMillis();
        try {
            JSONArray a = new JSONArray(p.getString(K_JSON, "[]"));
            int n = 0;
            for (int i = 0; i < a.length() && n < MAX; i++) {
                JSONObject o = a.getJSONObject(i);
                long at = o.optLong("at", 0);
                if (at <= now) continue;
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pending(ctx, o));
                n++;
            }
        } catch (Exception ignored) { }
    }

    private static void cancelAll(Context ctx, String oldJson) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        try {
            JSONArray a = new JSONArray(oldJson);
            for (int i = 0; i < a.length(); i++) am.cancel(pending(ctx, a.getJSONObject(i)));
        } catch (Exception ignored) { }
    }

    private static PendingIntent pending(Context ctx, JSONObject o) {
        Intent i = new Intent(ctx, ReminderReceiver.class);
        i.setAction("pt.gestorimobiliario.app.REMIND");
        String id = o.optString("id", "x");
        i.setData(android.net.Uri.parse("gi://remind/" + id));
        i.putExtra("title", o.optString("title", "Gestor Imobiliario"));
        i.putExtra("text", o.optString("text", ""));
        i.putExtra("nid", id.hashCode());
        return PendingIntent.getBroadcast(ctx, id.hashCode(), i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static void show(Context ctx, String title, String text, int nid) {
        ensureChannel(ctx);
        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent tap = PendingIntent.getActivity(ctx, 0, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = new Notification.Builder(ctx, CHANNEL)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setContentIntent(tap)
                .setAutoCancel(true);
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(nid, b.build());
    }
}
