package com.natita.healthtracker.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.natita.healthtracker.data.Category
import com.natita.healthtracker.data.Quotes
import com.natita.healthtracker.data.TaskEntity
import com.natita.healthtracker.data.formatTime
import com.natita.healthtracker.data.tasksFor
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@Composable
fun TodayScreen(vm: MainViewModel) {
    val date by vm.date.collectAsStateWithLifecycle()
    val tasks by vm.tasks.collectAsStateWithLifecycle()
    val done by vm.doneIds.collectAsStateWithLifecycle()
    val weights by vm.weights.collectAsStateWithLifecycle()
    var showWeightDialog by remember { mutableStateOf(false) }

    val todays = tasksFor(tasks, date)
    val weighTasks = todays.filter { it.cat == Category.WEIGH }
    val weightToday = weights.firstOrNull { it.date == date.toString() }
    val doneCount = todays.count { it.id in done }

    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        item { DateHeader(date, onChange = vm::setDate) }

        item {
            Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
                Column(Modifier.fillMaxWidth().padding(16.dp)) {
                    Text(
                        if (todays.isNotEmpty() && doneCount == todays.size) "All done, you rock! 🎉" else "$doneCount of ${todays.size} done",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Spacer(Modifier.height(8.dp))
                    LinearProgressIndicator(
                        progress = { if (todays.isEmpty()) 0f else doneCount / todays.size.toFloat() },
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Spacer(Modifier.height(12.dp))
                    val q = Quotes.forDate(date)
                    Text("\"${q.text}\"", style = MaterialTheme.typography.bodyMedium, fontStyle = FontStyle.Italic)
                    Text("- ${q.author}", style = MaterialTheme.typography.bodySmall)
                }
            }
        }

        item {
            Card {
                Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(
                            if (weighTasks.isNotEmpty()) "⚖️ Weigh-in day!" else "⚖️ Weight",
                            style = MaterialTheme.typography.titleMedium,
                        )
                        Text(
                            weightToday?.let { "%.1f kg logged".format(it.kg) }
                                ?: if (weighTasks.isNotEmpty()) "Morning, before eating" else "Log anytime you like",
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                    FilledTonalButton(onClick = { showWeightDialog = true }) {
                        Text(if (weightToday == null) "Log" else "Edit")
                    }
                }
            }
        }

        Category.entries.filter { it != Category.WEIGH }.forEach { cat ->
            val list = todays.filter { it.cat == cat }
            if (list.isNotEmpty()) {
                item(key = "h_${cat.name}") {
                    Text(
                        "${cat.emoji} ${cat.label}",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(top = 12.dp, bottom = 2.dp),
                    )
                }
                items(list, key = { it.id }) { task ->
                    TaskRow(task, task.id in done) { vm.toggle(task, it) }
                }
            }
        }
    }

    if (showWeightDialog) {
        WeightDialog(
            initial = weightToday?.kg,
            onDismiss = { showWeightDialog = false },
            onSave = { vm.saveWeight(date, it); showWeightDialog = false },
        )
    }
}

@Composable
private fun DateHeader(date: LocalDate, onChange: (LocalDate) -> Unit) {
    val today = LocalDate.now()
    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
        IconButton(onClick = { onChange(date.minusDays(1)) }) { Icon(Icons.Filled.ChevronLeft, "Previous day") }
        Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                when (date) {
                    today -> "Today"
                    today.minusDays(1) -> "Yesterday"
                    today.plusDays(1) -> "Tomorrow"
                    else -> date.format(DateTimeFormatter.ofPattern("EEEE"))
                },
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
            )
            Text(date.format(DateTimeFormatter.ofPattern("EEE, d MMM yyyy")), style = MaterialTheme.typography.bodySmall)
            if (date != today) {
                TextButton(onClick = { onChange(today) }) { Text("Back to today") }
            }
        }
        IconButton(onClick = { onChange(date.plusDays(1)) }) { Icon(Icons.Filled.ChevronRight, "Next day") }
    }
}

@Composable
private fun TaskRow(task: TaskEntity, done: Boolean, onToggle: (Boolean) -> Unit) {
    val uri = LocalUriHandler.current
    Card(
        modifier = Modifier.fillMaxWidth().clickable { onToggle(!done) },
        colors = CardDefaults.cardColors(
            containerColor = if (done) MaterialTheme.colorScheme.tertiaryContainer else MaterialTheme.colorScheme.surfaceVariant,
        ),
    ) {
        Row(Modifier.padding(horizontal = 8.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Checkbox(checked = done, onCheckedChange = onToggle)
            Column(Modifier.weight(1f)) {
                Text(
                    (task.timeMinutes?.let { formatTime(it) + "  " } ?: "") + task.title,
                    style = MaterialTheme.typography.bodyLarge,
                    fontWeight = FontWeight.Medium,
                    textDecoration = if (done) TextDecoration.LineThrough else null,
                )
                if (task.details.isNotBlank()) {
                    Text(task.details, style = MaterialTheme.typography.bodySmall)
                }
            }
            if (!task.link.isNullOrBlank()) {
                Spacer(Modifier.width(4.dp))
                IconButton(onClick = { runCatching { uri.openUri(task.link) } }) {
                    Icon(Icons.Filled.PlayCircle, "Open video", tint = MaterialTheme.colorScheme.primary)
                }
            }
        }
    }
}

@Composable
fun WeightDialog(initial: Double?, onDismiss: () -> Unit, onSave: (Double) -> Unit) {
    var text by remember { mutableStateOf(initial?.let { "%.1f".format(it) } ?: "") }
    val value = text.replace(',', '.').toDoubleOrNull()?.takeIf { it in 20.0..400.0 }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Log weight") },
        text = {
            OutlinedTextField(
                value = text,
                onValueChange = { text = it },
                label = { Text("Weight (kg)") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            )
        },
        confirmButton = { TextButton(enabled = value != null, onClick = { value?.let(onSave) }) { Text("Save") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
