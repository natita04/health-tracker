package com.natita.healthtracker.reminders

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.natita.healthtracker.data.AppDatabase
import com.natita.healthtracker.data.Category
import com.natita.healthtracker.data.Settings
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneId

/**
 * Keeps exactly one alarm set: the next upcoming reminder (morning plan or a med time).
 * When it fires, AlarmReceiver shows what's due and calls scheduleNext() again.
 */
object ReminderScheduler {
    const val EXTRA_DATE = "date"
    const val EXTRA_MINUTES = "minutes"

    /** Reminder times (minutes after midnight) due on a given date. */
    suspend fun timesFor(context: Context, date: LocalDate): Set<Int> {
        val settings = Settings(context)
        val times = sortedSetOf<Int>()
        if (settings.morningEnabled) times += settings.morningMinutes
        if (settings.medRemindersEnabled) {
            AppDatabase.get(context).tasks().active()
                .filter { it.cat == Category.MEDS && it.timeMinutes != null && it.isOn(date.dayOfWeek) }
                .forEach { times += it.timeMinutes!! }
        }
        return times
    }

    suspend fun scheduleNext(context: Context) {
        val now = LocalDateTime.now()
        var next: LocalDateTime? = null
        for (offset in 0L..7L) {
            val date = now.toLocalDate().plusDays(offset)
            val t = timesFor(context, date).firstOrNull { date.atTime(it / 60, it % 60).isAfter(now) }
            if (t != null) {
                next = date.atTime(t / 60, t % 60)
                break
            }
        }

        val am = context.getSystemService(AlarmManager::class.java)
        val intent = Intent(context, AlarmReceiver::class.java)
        if (next == null) {
            am.cancel(PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
            return
        }
        intent.putExtra(EXTRA_DATE, next.toLocalDate().toString())
            .putExtra(EXTRA_MINUTES, next.hour * 60 + next.minute)
        val pi = PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val at = next.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()

        if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        } else {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
        }
    }
}
