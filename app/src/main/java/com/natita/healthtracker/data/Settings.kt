package com.natita.healthtracker.data

import android.content.Context

class Settings(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("settings", Context.MODE_PRIVATE)

    var morningEnabled: Boolean
        get() = prefs.getBoolean("morning_enabled", true)
        set(v) = prefs.edit().putBoolean("morning_enabled", v).apply()

    /** Minutes after midnight, default 05:00. */
    var morningMinutes: Int
        get() = prefs.getInt("morning_minutes", 5 * 60)
        set(v) = prefs.edit().putInt("morning_minutes", v).apply()

    var medRemindersEnabled: Boolean
        get() = prefs.getBoolean("med_reminders", true)
        set(v) = prefs.edit().putBoolean("med_reminders", v).apply()

    /** Which version of the built-in plan has been added to the database already. */
    var defaultsVersion: Int
        get() = prefs.getInt("defaults_version", 0)
        set(v) = prefs.edit().putInt("defaults_version", v).apply()
}
