package com.lightonpluslab.couponbook.twa;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Rearms pending expiry reminders after boot or an app update. */
public class BootReceiver extends BroadcastReceiver {

    private static final long MISSED_REMINDER_WINDOW_MS = 24L * 60L * 60L * 1000L;

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (!Intent.ACTION_BOOT_COMPLETED.equals(action)
                && !Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)) return;

        long now = System.currentTimeMillis();
        for (ReminderStore.Entry entry : ReminderStore.all(context)) {
            if (entry.when > now) {
                ReminderScheduler.schedule(context, entry.id, entry.title, entry.body, entry.when);
            } else if (now - entry.when <= MISSED_REMINDER_WINDOW_MS) {
                ReminderReceiver.post(context, entry.id, entry.title, entry.body);
                ReminderStore.remove(context, entry.id);
            } else {
                ReminderStore.remove(context, entry.id);
            }
        }
    }
}
