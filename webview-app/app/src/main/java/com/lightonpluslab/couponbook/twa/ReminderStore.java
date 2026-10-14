package com.lightonpluslab.couponbook.twa;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Stores pending expiry reminders so they survive device restarts. */
final class ReminderStore {

    private static final String PREFS = "expiry_reminders";

    private ReminderStore() {
    }

    static void save(Context context, int id, String title, String body, long when) {
        JSONObject value = new JSONObject();
        try {
            value.put("title", title);
            value.put("body", body);
            value.put("when", when);
            prefs(context).edit().putString(String.valueOf(id), value.toString()).apply();
        } catch (JSONException ignored) {
        }
    }

    static void remove(Context context, int id) {
        prefs(context).edit().remove(String.valueOf(id)).apply();
    }

    static List<Entry> all(Context context) {
        List<Entry> entries = new ArrayList<>();
        for (Map.Entry<String, ?> item : prefs(context).getAll().entrySet()) {
            try {
                int id = Integer.parseInt(item.getKey());
                if (!(item.getValue() instanceof String)) continue;
                JSONObject value = new JSONObject((String) item.getValue());
                entries.add(new Entry(id, value.getString("title"), value.getString("body"),
                        value.getLong("when")));
            } catch (NumberFormatException | JSONException ignored) {
                // Skip malformed persisted values.
            }
        }
        return entries;
    }

    private static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static final class Entry {
        final int id;
        final String title;
        final String body;
        final long when;

        Entry(int id, String title, String body, long when) {
            this.id = id;
            this.title = title;
            this.body = body;
            this.when = when;
        }
    }
}
