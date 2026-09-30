package com.natita.healthtracker.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.natita.healthtracker.data.WeightEntity
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@Composable
fun WeightScreen(vm: MainViewModel) {
    val weights by vm.weights.collectAsStateWithLifecycle()
    var showDialog by remember { mutableStateOf(false) }
    val today = LocalDate.now()
    val todayEntry = weights.firstOrNull { it.date == today.toString() }

    LazyColumn(contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            Text("Weight", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text("Thursday is weigh-in day, but you can log any day.", style = MaterialTheme.typography.bodySmall)
        }
        item {
            Button(onClick = { showDialog = true }, modifier = Modifier.fillMaxWidth()) {
                Text(if (todayEntry == null) "Log today's weight" else "Edit today's weight")
            }
        }
        if (weights.isNotEmpty()) {
            item { StatsCard(weights) }
            if (weights.size >= 2) item { ChartCard(weights.takeLast(60)) }
            item { Text("Entries", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp)) }
            items(weights.reversed(), key = { it.date }) { w ->
                Card {
                    Row(Modifier.fillMaxWidth().padding(start = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            LocalDate.parse(w.date).format(DateTimeFormatter.ofPattern("EEE, d MMM yyyy")),
                            modifier = Modifier.weight(1f),
                        )
                        Text("%.1f kg".format(w.kg), fontWeight = FontWeight.SemiBold)
                        IconButton(onClick = { vm.deleteWeight(w.date) }) { Icon(Icons.Filled.Delete, "Delete") }
                    }
                }
            }
        } else {
            item { Text("No entries yet. Log your first one above!", modifier = Modifier.padding(top = 16.dp)) }
        }
    }

    if (showDialog) {
        WeightDialog(
            initial = todayEntry?.kg,
            onDismiss = { showDialog = false },
            onSave = { vm.saveWeight(today, it); showDialog = false },
        )
    }
}

@Composable
private fun StatsCard(weights: List<WeightEntity>) {
    val latest = weights.last()
    val first = weights.first()
    val weekAgo = LocalDate.parse(latest.date).minusDays(7).toString()
    val prevWeek = weights.lastOrNull { it.date <= weekAgo }
    fun delta(d: Double) = (if (d > 0) "+" else "") + "%.1f kg".format(d)
    Card {
        Row(Modifier.fillMaxWidth().padding(16.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            Stat("Latest", "%.1f kg".format(latest.kg))
            Stat("Since start", delta(latest.kg - first.kg))
            Stat("vs a week ago", prevWeek?.let { delta(latest.kg - it.kg) } ?: "-")
        }
    }
}

@Composable
private fun Stat(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Text(label, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
private fun ChartCard(points: List<WeightEntity>) {
    val line = MaterialTheme.colorScheme.primary
    val grid = MaterialTheme.colorScheme.outlineVariant
    val min = points.minOf { it.kg }
    val max = points.maxOf { it.kg }
    val days = points.map { LocalDate.parse(it.date).toEpochDay() }
    val firstDay = days.first()
    val span = (days.last() - firstDay).coerceAtLeast(1)
    val range = (max - min).coerceAtLeast(0.5)

    Card {
        Column(Modifier.padding(16.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Trend", style = MaterialTheme.typography.titleSmall)
                Text("%.1f - %.1f kg".format(min, max), style = MaterialTheme.typography.bodySmall)
            }
            Spacer(Modifier.height(8.dp))
            Canvas(Modifier.fillMaxWidth().height(160.dp)) {
                val pad = 6.dp.toPx()
                val w = size.width - pad * 2
                val h = size.height - pad * 2
                for (i in 0..3) {
                    val y = pad + h * i / 3f
                    drawLine(grid, Offset(pad, y), Offset(pad + w, y), strokeWidth = 1f)
                }
                val offsets = points.mapIndexed { i, p ->
                    Offset(
                        pad + w * ((days[i] - firstDay).toFloat() / span),
                        pad + h * (1f - ((p.kg - min) / range).toFloat()),
                    )
                }
                val path = Path().apply {
                    moveTo(offsets.first().x, offsets.first().y)
                    offsets.drop(1).forEach { lineTo(it.x, it.y) }
                }
                drawPath(path, line, style = Stroke(width = 3.dp.toPx(), cap = StrokeCap.Round))
                offsets.forEach { drawCircle(line, radius = 4.dp.toPx(), center = it) }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                val f = DateTimeFormatter.ofPattern("d MMM")
                Text(LocalDate.parse(points.first().date).format(f), style = MaterialTheme.typography.bodySmall)
                Text(LocalDate.parse(points.last().date).format(f), style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}
