package pt.gestorimobiliario.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Mostra o lembrete na hora marcada e volta a agendar tudo depois de um reinicio. */
public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent i) {
        String action = i == null ? null : i.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) {
            Reminders.scheduleAll(ctx);
            return;
        }
        Reminders.show(ctx,
                i == null ? "" : i.getStringExtra("title"),
                i == null ? "" : i.getStringExtra("text"),
                i == null ? 1 : i.getIntExtra("nid", 1));
    }
}
