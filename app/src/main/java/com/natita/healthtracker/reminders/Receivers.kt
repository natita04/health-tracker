package com.natita.healthtracker.reminders

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationManagerCompat
import com.natita.healthtracker.data.AppDatabase
import com.natita.healthtracker.data.Category
import com.natita.healthtracker.data.Repository
import com.natita.healthtracker.data.Settings
import com.natita.healthtracker.data.morningSummary
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.time.LocalDate

private fun BroadcastReceiver.runAsync(block: suspend () -> Unit) {
    val pending = goAsync()
    CoroutineScope(Dispatchers.IO).launch {
        try {
            block()
        } finally {
            pending.finish()
        }
    }
}

class AlarmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) = runAsync {
        val date = intent.getStringExtra(ReminderScheduler.EXTRA_DATE)?.let(LocalDate::parse) ?: LocalDate.now()
        val minutes = intent.getIntExtra(ReminderScheduler.EXTRA_MINUTES, -1)
        val settings = Settings(context)
        val db = AppDatabase.get(context)
        val tasks = db.tasks().active()

        if (settings.morningEnabled && minutes == settings.morningMinutes) {
            Notifications.showMorning(context, date, morningSummary(tasks, date))
        }
        if (settings.medRemindersEnabled) {
            val done = db.completions().doneIds(date.toString()).toSet()
            val due = tasks.filter {
                it.cat == Category.MEDS && it.timeMinutes == minutes && it.isOn(date.dayOfWeek) && it.id !in done
            }
            Notifications.showMeds(context, date, minutes, due)
        }
        ReminderScheduler.scheduleNext(context)
    }
}

class MarkDoneReceiver : BroadcastReceiver() {
    companion object {
        const val EXTRA_DATE = "date"
        const val EXTRA_TASK_IDS = "taskIds"
        const val EXTRA_NOTIFICATION_ID = "notificationId"
    }

    override fun onReceive(context: Context, intent: Intent) = runAsync {
        val date = intent.getStringExtra(EXTRA_DATE)?.let(LocalDate::parse) ?: LocalDate.now()
        val ids = intent.getStringArrayExtra(EXTRA_TASK_IDS)?.toList().orEmpty()
        Repository(context).markDone(date, ids)
        NotificationManagerCompat.from(context).cancel(intent.getIntExtra(EXTRA_NOTIFICATION_ID, 0))
    }
}

/** Alarms are wiped by reboots and app updates, so set the next one again. */
class RescheduleReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) = runAsync {
        Repository(context).seedDefaults()
        ReminderScheduler.scheduleNext(context)
    }
}
