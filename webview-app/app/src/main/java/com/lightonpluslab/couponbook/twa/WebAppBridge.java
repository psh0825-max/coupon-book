package com.lightonpluslab.couponbook.twa;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import androidx.core.app.NotificationManagerCompat;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Bridge the WebView cannot live without. A bare WebView (unlike Chrome/TWA) has
 * no blob download, no web Notifications, and no service-worker periodic sync, so
 * the web calls these native equivalents when running inside the app shell
 * (detected via the "CouponBookApp" user-agent tag). Exposed to JS as
 * `window.AndroidBridge`.
 */
public class WebAppBridge {

    private final Context ctx;
    private final Handler main = new Handler(Looper.getMainLooper());

    WebAppBridge(Context ctx) {
        this.ctx = ctx.getApplicationContext();
    }

    private void toast(String msg) {
        main.post(() -> Toast.makeText(ctx, msg, Toast.LENGTH_SHORT).show());
    }

    /** Save a text file (the JSON backup) to the device's Downloads. */
    @JavascriptInterface
    public void saveText(String filename, String content) {
        if (filename == null || filename.isEmpty()) filename = "coupon-backup.json";
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues v = new ContentValues();
                v.put(MediaStore.Downloads.DISPLAY_NAME, filename);
                v.put(MediaStore.Downloads.MIME_TYPE, "application/json");
                v.put(MediaStore.Downloads.IS_PENDING, 1);
                Uri collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI;
                Uri item = ctx.getContentResolver().insert(collection, v);
                if (item == null) { toast("백업 저장 실패"); return; }
                try (OutputStream os = ctx.getContentResolver().openOutputStream(item)) {
                    os.write(content.getBytes(StandardCharsets.UTF_8));
                }
                v.clear();
                v.put(MediaStore.Downloads.IS_PENDING, 0);
                ctx.getContentResolver().update(item, v, null, null);
            } else {
                // API 23–28: write to the app's external files dir (no permission needed).
                File dir = ctx.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                File out = new File(dir, filename);
                try (FileOutputStream fos = new FileOutputStream(out)) {
                    fos.write(content.getBytes(StandardCharsets.UTF_8));
                }
            }
            toast("백업 파일을 저장했어요 (다운로드 폴더)");
        } catch (Exception e) {
            toast("백업 저장 실패");
        }
    }

    /** Post a system notification immediately (used for on-open due reminders). */
    @JavascriptInterface
    public void showNotification(String title, String body) {
        Intent i = new Intent(ctx, ReminderReceiver.class);
        i.putExtra(ReminderReceiver.EXTRA_ID, (int) (System.currentTimeMillis() % 100000));
        i.putExtra(ReminderReceiver.EXTRA_TITLE, title);
        i.putExtra(ReminderReceiver.EXTRA_BODY, body);
        ctx.sendBroadcast(i);
    }

    /** Schedule a future expiry reminder (fires even if the app is closed). */
    @JavascriptInterface
    public void scheduleReminder(int id, String title, String body, double whenMillis) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Intent i = new Intent(ctx, ReminderReceiver.class);
        i.putExtra(ReminderReceiver.EXTRA_ID, id);
        i.putExtra(ReminderReceiver.EXTRA_TITLE, title);
        i.putExtra(ReminderReceiver.EXTRA_BODY, body);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getBroadcast(ctx, id, i, flags);
        // Inexact + doze-friendly: no exact-alarm permission needed for day-scale reminders.
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, (long) whenMillis, pi);
    }

    /** Cancel a previously scheduled reminder. */
    @JavascriptInterface
    public void cancelReminder(int id) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        Intent i = new Intent(ctx, ReminderReceiver.class);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getBroadcast(ctx, id, i, flags);
        am.cancel(pi);
    }

    /** Whether the app currently holds notification permission (for the web to know). */
    @JavascriptInterface
    public boolean canNotify() {
        return NotificationManagerCompat.from(ctx).areNotificationsEnabled();
    }
}
