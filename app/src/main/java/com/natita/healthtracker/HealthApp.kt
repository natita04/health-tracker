package com.natita.healthtracker

import android.app.Application
import com.natita.healthtracker.data.Repository
import com.natita.healthtracker.reminders.Notifications
import com.natita.healthtracker.reminders.ReminderScheduler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class HealthApp : Application() {
    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    val repository by lazy { Repository(this) }

    override fun onCreate() {
        super.onCreate()
        Notifications.createChannels(this)
        appScope.launch {
            repository.seedDefaults()
            ReminderScheduler.scheduleNext(this@HealthApp)
        }
    }
}
