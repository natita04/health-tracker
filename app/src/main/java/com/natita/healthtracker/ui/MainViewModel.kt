package com.natita.healthtracker.ui

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.natita.healthtracker.HealthApp
import com.natita.healthtracker.data.CompletionEntity
import com.natita.healthtracker.data.TaskEntity
import com.natita.healthtracker.data.WeightEntity
import com.natita.healthtracker.data.morningSummary
import com.natita.healthtracker.reminders.Notifications
import com.natita.healthtracker.reminders.ReminderScheduler
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDate

data class SettingsState(val morningEnabled: Boolean, val morningMinutes: Int, val medRemindersEnabled: Boolean)

@OptIn(ExperimentalCoroutinesApi::class)
class MainViewModel(app: Application) : AndroidViewModel(app) {
    private val repo = (app as HealthApp).repository
    private val db = repo.db

    private val _date = MutableStateFlow(LocalDate.now())
    val date: StateFlow<LocalDate> = _date.asStateFlow()

    val tasks: StateFlow<List<TaskEntity>> = db.tasks().observeActive()
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    val doneIds: StateFlow<Set<String>> = _date
        .flatMapLatest { d -> db.completions().observeFor(d.toString()) }
        .map { list -> list.map { it.taskId }.toSet() }
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptySet())

    val weights: StateFlow<List<WeightEntity>> = db.weights().observeAll()
        .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    val recentCompletions: StateFlow<List<CompletionEntity>> =
        db.completions().observeSince(LocalDate.now().minusDays(90).toString())
            .stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    private val _settings = MutableStateFlow(readSettings())
    val settings: StateFlow<SettingsState> = _settings.asStateFlow()

    private fun readSettings() = repo.settings.let { SettingsState(it.morningEnabled, it.morningMinutes, it.medRemindersEnabled) }

    fun setDate(d: LocalDate) { _date.value = d }

    fun toggle(task: TaskEntity, done: Boolean) = viewModelScope.launch { repo.setDone(_date.value, task, done) }

    fun saveWeight(date: LocalDate, kg: Double) = viewModelScope.launch { repo.saveWeight(date, kg) }

    fun deleteWeight(date: String) = viewModelScope.launch { repo.deleteWeight(date) }

    fun saveTask(task: TaskEntity) = viewModelScope.launch { repo.saveTask(task) }

    fun archiveTask(id: String) = viewModelScope.launch { repo.archiveTask(id) }

    suspend fun nextSortOrder() = repo.nextSortOrder()

    fun updateSettings(morningEnabled: Boolean? = null, morningMinutes: Int? = null, medReminders: Boolean? = null) {
        morningEnabled?.let { repo.settings.morningEnabled = it }
        morningMinutes?.let { repo.settings.morningMinutes = it }
        medReminders?.let { repo.settings.medRemindersEnabled = it }
        _settings.value = readSettings()
        viewModelScope.launch { ReminderScheduler.scheduleNext(getApplication()) }
    }

    fun testNotification() {
        val d = LocalDate.now()
        Notifications.showMorning(getApplication(), d, morningSummary(tasks.value, d))
    }

    fun export(uri: Uri, onResult: (String) -> Unit) = viewModelScope.launch {
        val msg = runCatching {
            val json = repo.exportJson()
            withContext(Dispatchers.IO) {
                getApplication<Application>().contentResolver.openOutputStream(uri)?.use { it.write(json.toByteArray()) }
            }
            "Backup saved ✓"
        }.getOrElse { "Backup failed: ${it.message}" }
        onResult(msg)
    }

    fun import(uri: Uri, onResult: (String) -> Unit) = viewModelScope.launch {
        val msg = runCatching {
            val json = withContext(Dispatchers.IO) {
                getApplication<Application>().contentResolver.openInputStream(uri)?.use { it.readBytes().decodeToString() }
            } ?: error("couldn't read file")
            repo.importJson(json)
            _settings.value = readSettings()
            "Backup restored ✓"
        }.getOrElse { "Restore failed: ${it.message}" }
        onResult(msg)
    }
}
