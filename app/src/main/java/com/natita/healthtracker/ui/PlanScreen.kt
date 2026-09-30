@file:OptIn(ExperimentalLayoutApi::class)

package com.natita.healthtracker.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.natita.healthtracker.data.ALL_DAYS
import com.natita.healthtracker.data.Category
import com.natita.healthtracker.data.Defaults
import com.natita.healthtracker.data.TaskEntity
import com.natita.healthtracker.data.dayBit
import com.natita.healthtracker.data.formatTime
import com.natita.healthtracker.data.parseTime
import kotlinx.coroutines.launch
import java.time.DayOfWeek
import java.time.LocalDate
import java.util.UUID

private val WEEK = listOf(
    DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
    DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY,
)
private fun short(d: DayOfWeek) = d.name.take(3).lowercase().replaceFirstChar { it.uppercase() }

fun daysLabel(mask: Int): String = when (mask) {
    ALL_DAYS -> "Every day"
    0 -> "Never"
    else -> WEEK.filter { mask and dayBit(it) != 0 }.joinToString(", ") { short(it) }
}

@Composable
fun PlanScreen(vm: MainViewModel, toast: (String) -> Unit) {
    val tasks by vm.tasks.collectAsStateWithLifecycle()
    val settings by vm.settings.collectAsStateWithLifecycle()
    var editing by remember { mutableStateOf<TaskEntity?>(null) }
    var editingTime by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    val exportLauncher = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        if (uri != null) vm.export(uri, toast)
    }
    val importLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) vm.import(uri, toast)
    }

    Box(Modifier.fillMaxSize()) {
        LazyColumn(contentPadding = PaddingValues(16.dp, 16.dp, 16.dp, 96.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item {
                Text("Plan & settings", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            }
            item {
                Card {
                    Column(Modifier.padding(16.dp)) {
                        Text("Reminders", style = MaterialTheme.typography.titleMedium)
                        SettingSwitch("Morning plan at ${formatTime(settings.morningMinutes)}", settings.morningEnabled) {
                            vm.updateSettings(morningEnabled = it)
                        }
                        SettingSwitch("Meds reminders (with a \"Taken\" button)", settings.medRemindersEnabled) {
                            vm.updateSettings(medReminders = it)
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            OutlinedButton(onClick = { editingTime = true }) { Text("Change time") }
                            OutlinedButton(onClick = { vm.testNotification() }) { Text("Test it") }
                        }
                        HorizontalDivider(Modifier.padding(vertical = 12.dp))
                        Text("Backup", style = MaterialTheme.typography.titleMedium)
                        Text(
                            "Installing a newer APK over this one keeps everything. Just don't uninstall first. " +
                                "A backup file is extra insurance (e.g. for a new phone).",
                            style = MaterialTheme.typography.bodySmall,
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                            OutlinedButton(onClick = { exportLauncher.launch("health-backup-${LocalDate.now()}.json") }) { Text("Save backup") }
                            OutlinedButton(onClick = { importLauncher.launch(arrayOf("application/json", "*/*")) }) { Text("Restore") }
                        }
                    }
                }
            }
            Category.entries.forEach { cat ->
                val list = tasks.filter { it.cat == cat }.sortedWith(compareBy({ it.timeMinutes ?: -1 }, { it.sortOrder }))
                if (list.isNotEmpty()) {
                    item(key = "h_${cat.name}") {
                        Text("${cat.emoji} ${cat.label}", style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(top = 12.dp))
                    }
                    items(list, key = { it.id }) { t -> PlanRow(t) { editing = t } }
                }
            }
        }
        ExtendedFloatingActionButton(
            onClick = {
                scope.launch {
                    editing = TaskEntity(
                        id = "custom_" + UUID.randomUUID().toString().take(8),
                        category = Category.BEAUTY.name, title = "", sortOrder = vm.nextSortOrder(),
                    )
                }
            },
            icon = { Icon(Icons.Filled.Add, null) },
            text = { Text("Add item") },
            modifier = Modifier.align(Alignment.BottomEnd).padding(16.dp),
        )
    }

    editing?.let { t ->
        val isNew = tasks.none { it.id == t.id }
        EditTaskDialog(
            task = t,
            isNew = isNew,
            onDismiss = { editing = null },
            onSave = { vm.saveTask(it); editing = null },
            onDelete = { vm.archiveTask(t.id); editing = null },
        )
    }

    if (editingTime) {
        TimeDialog(settings.morningMinutes, onDismiss = { editingTime = false }) {
            vm.updateSettings(morningMinutes = it); editingTime = false
        }
    }
}

@Composable
private fun SettingSwitch(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(label, Modifier.weight(1f))
        Switch(checked = checked, onCheckedChange = onChange)
    }
}

@Composable
private fun PlanRow(t: TaskEntity, onClick: () -> Unit) {
    Card(Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(t.title, fontWeight = FontWeight.Medium)
                val bits = listOfNotNull(
                    daysLabel(t.daysMask),
                    t.timeMinutes?.let { formatTime(it) },
                    t.durationMin?.let { "$it min" },
                    if (!t.link.isNullOrBlank()) "▶ video" else null,
                )
                Text(bits.joinToString(" · "), style = MaterialTheme.typography.bodySmall)
            }
            Icon(Icons.Filled.Edit, "Edit", tint = MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
private fun EditTaskDialog(
    task: TaskEntity,
    isNew: Boolean,
    onDismiss: () -> Unit,
    onSave: (TaskEntity) -> Unit,
    onDelete: () -> Unit,
) {
    var title by remember { mutableStateOf(task.title) }
    var details by remember { mutableStateOf(task.details) }
    var category by remember { mutableStateOf(task.cat) }
    var duration by remember { mutableStateOf(task.durationMin?.toString() ?: "") }
    var days by remember { mutableStateOf(task.daysMask) }
    var time by remember { mutableStateOf(task.timeMinutes?.let { formatTime(it) } ?: "") }
    var link by remember { mutableStateOf(task.link ?: "") }
    var confirmDelete by remember { mutableStateOf(false) }

    val timeOk = time.isBlank() || parseTime(time) != null
    val valid = title.isNotBlank() && timeOk && days != 0

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (isNew) "New item" else "Edit item") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(title, { title = it }, label = { Text("Name") }, singleLine = true)
                OutlinedTextField(details, { details = it }, label = { Text("Notes") })
                Text("Category", style = MaterialTheme.typography.labelLarge)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Category.entries.forEach { c ->
                        FilterChip(selected = category == c, onClick = { category = c }, label = { Text("${c.emoji} ${c.label}") })
                    }
                }
                Text("Days", style = MaterialTheme.typography.labelLarge)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    WEEK.forEach { d ->
                        FilterChip(
                            selected = days and dayBit(d) != 0,
                            onClick = { days = days xor dayBit(d) },
                            label = { Text(short(d)) },
                        )
                    }
                    FilterChip(selected = days == ALL_DAYS, onClick = { days = ALL_DAYS }, label = { Text("All") })
                }
                OutlinedTextField(
                    duration, { duration = it.filter(Char::isDigit).take(3) },
                    label = { Text("Minutes (optional)") }, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                )
                OutlinedTextField(
                    time, { time = it }, label = { Text("Reminder time HH:MM (optional)") }, singleLine = true,
                    isError = !timeOk,
                    supportingText = { Text("Meds with a time get their own reminder.") },
                )
                OutlinedTextField(
                    link, { link = it }, label = { Text("Video link (optional)") }, singleLine = true,
                    supportingText = { Text("More: ${Defaults.MORE_WORKOUTS_URL}") },
                )
                if (!isNew) {
                    TextButton(onClick = { confirmDelete = true }) { Text("Remove from plan", color = Color(0xFFC62828)) }
                }
            }
        },
        confirmButton = {
            TextButton(enabled = valid, onClick = {
                onSave(
                    task.copy(
                        title = title.trim(), details = details.trim(), category = category.name,
                        durationMin = duration.toIntOrNull(), daysMask = days, timeMinutes = parseTime(time),
                        link = link.trim().ifBlank { null },
                    )
                )
            }) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )

    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Remove \"${task.title}\"?") },
            text = { Text("It disappears from your plan. Past history for it is kept.") },
            confirmButton = { TextButton(onClick = onDelete) { Text("Remove") } },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun TimeDialog(initial: Int, onDismiss: () -> Unit, onSave: (Int) -> Unit) {
    var text by remember { mutableStateOf(formatTime(initial)) }
    val parsed = parseTime(text)
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Morning notification time") },
        text = {
            OutlinedTextField(text, { text = it }, label = { Text("HH:MM") }, singleLine = true, isError = parsed == null)
        },
        confirmButton = { TextButton(enabled = parsed != null, onClick = { parsed?.let(onSave) }) { Text("Save") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
