package com.natita.healthtracker.reminders

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.natita.healthtracker.MainActivity
import com.natita.healthtracker.R
import com.natita.healthtracker.data.TaskEntity
import java.time.LocalDate

object Notifications {
    const val CHANNEL_MORNING = "morning"
    const val CHANNEL_MEDS = "meds"
    private const val ID_MORNING = 1000
    fun medId(minutes: Int) = 2000 + minutes

    fun createChannels(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_MORNING, "Morning plan", NotificationManager.IMPORTANCE_HIGH)
                .apply { description = "Your plan for the day" }
        )
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_MEDS, "Meds reminders", NotificationManager.IMPORTANCE_HIGH)
                .apply { description = "Reminders to take meds and supplements" }
        )
    }

    private fun canPost(context: Context) =
        Build.VERSION.SDK_INT < 33 ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    private fun openApp(context: Context): PendingIntent = PendingIntent.getActivity(
        context, 0,
        Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP),
        PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    fun showMorning(context: Context, date: LocalDate, summary: String) {
        if (!canPost(context)) return
        val n = NotificationCompat.Builder(context, CHANNEL_MORNING)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("Good morning ☀️ Here's your day")
            .setContentText(summary.lineSequence().firstOrNull() ?: "")
            .setStyle(NotificationCompat.BigTextStyle().bigText(summary))
            .setContentIntent(openApp(context))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
        try {
            NotificationManagerCompat.from(context).notify(ID_MORNING, n)
        } catch (_: SecurityException) {
        }
    }

    fun showMeds(context: Context, date: LocalDate, minutes: Int, meds: List<TaskEntity>) {
        if (!canPost(context) || meds.isEmpty()) return
        val id = medId(minutes)
        val names = meds.joinToString(" + ") { it.title }
        val details = meds.joinToString("\n") { "• ${it.title}: ${it.details}" }
        val taken = PendingIntent.getBroadcast(
            context, id,
            Intent(context, MarkDoneReceiver::class.java)
                .putExtra(MarkDoneReceiver.EXTRA_DATE, date.toString())
                .putExtra(MarkDoneReceiver.EXTRA_TASK_IDS, meds.map { it.id }.toTypedArray())
                .putExtra(MarkDoneReceiver.EXTRA_NOTIFICATION_ID, id),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val n = NotificationCompat.Builder(context, CHANNEL_MEDS)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("💊 Time for $names")
            .setContentText(meds.first().details)
            .setStyle(NotificationCompat.BigTextStyle().bigText(details))
            .setContentIntent(openApp(context))
            .addAction(0, "Taken ✓", taken)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .build()
        try {
            NotificationManagerCompat.from(context).notify(id, n)
        } catch (_: SecurityException) {
        }
    }
}
