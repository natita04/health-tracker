package com.natita.healthtracker.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.natita.healthtracker.data.Category
import com.natita.healthtracker.data.tasksFor
import java.time.LocalDate
import java.time.format.DateTimeFormatter

private data class DayStat(val date: LocalDate, val done: Int, val total: Int)

@Composable
fun HistoryScreen(vm: MainViewModel, onOpenDay: (LocalDate) -> Unit) {
    val tasks by vm.tasks.collectAsStateWithLifecycle()
    val completions by vm.recentCompletions.collectAsStateWithLifecycle()
    val today = LocalDate.now()
    val doneByDate: Map<String, Set<String>> = completions.groupBy { it.date }.mapValues { e -> e.value.map { it.taskId }.toSet() }

    fun stat(date: LocalDate, cat: Category? = null): DayStat {
        val scheduled = tasksFor(tasks, date).filter { cat == null || it.cat == cat }
        val done = doneByDate[date.toString()].orEmpty()
        return DayStat(date, scheduled.count { it.id in done }, scheduled.size)
    }

    val days = (0L until 30L).map { stat(today.minusDays(it)) }

    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            Text("History", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text("Tap a day to see or fix it.", style = MaterialTheme.typography.bodySmall)
        }
        item {
            Card {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row {
                        Text("", Modifier.weight(1f))
                        Text("7 days", Modifier.width(64.dp), style = MaterialTheme.typography.labelMedium)
                        Text("30 days", Modifier.width(64.dp), style = MaterialTheme.typography.labelMedium)
                        Text("Streak", Modifier.width(56.dp), style = MaterialTheme.typography.labelMedium)
                    }
                    Category.entries.forEach { cat ->
                        CategoryRow(cat, pct(7, today, cat, ::stat), pct(30, today, cat, ::stat), streak(today, cat, ::stat))
                    }
                }
            }
        }
        item { Text("Last 30 days", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp)) }
        items(days, key = { it.date.toString() }) { d -> DayRow(d) { onOpenDay(d.date) } }
    }
}

private fun pct(n: Int, today: LocalDate, cat: Category, stat: (LocalDate, Category?) -> DayStat): String {
    val s = (0L until n).map { stat(today.minusDays(it), cat) }
    val total = s.sumOf { it.total }
    return if (total == 0) "-" else "${s.sumOf { it.done } * 100 / total}%"
}

/** Days in a row where everything in this category got done. Today only counts once it's complete. */
private fun streak(today: LocalDate, cat: Category, stat: (LocalDate, Category?) -> DayStat): String {
    var count = 0
    for (i in 0L until 90L) {
        val s = stat(today.minusDays(i), cat)
        if (s.total == 0) continue
        if (s.done == s.total) count++ else if (i == 0L) continue else break
    }
    return if (count == 0) "-" else "🔥$count"
}

@Composable
private fun CategoryRow(cat: Category, week: String, month: String, streak: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text("${cat.emoji} ${cat.label}", Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
        Text(week, Modifier.width(64.dp), fontWeight = FontWeight.SemiBold)
        Text(month, Modifier.width(64.dp), fontWeight = FontWeight.SemiBold)
        Text(streak, Modifier.width(56.dp))
    }
}

@Composable
private fun DayRow(d: DayStat, onClick: () -> Unit) {
    Card(Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(d.date.format(DateTimeFormatter.ofPattern("EEE d MMM")), Modifier.width(96.dp))
            LinearProgressIndicator(
                progress = { if (d.total == 0) 0f else d.done / d.total.toFloat() },
                modifier = Modifier.weight(1f),
            )
            Spacer(Modifier.width(12.dp))
            Text(
                if (d.total > 0 && d.done == d.total) "✅" else "${d.done}/${d.total}",
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}
