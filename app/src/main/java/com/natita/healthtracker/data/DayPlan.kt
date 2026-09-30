package com.natita.healthtracker.data

import java.time.LocalDate

fun formatTime(minutes: Int): String = "%02d:%02d".format(minutes / 60, minutes % 60)

fun parseTime(text: String): Int? {
    val m = Regex("""^\s*(\d{1,2})[:.](\d{2})\s*$""").find(text) ?: return null
    val h = m.groupValues[1].toInt()
    val min = m.groupValues[2].toInt()
    return if (h in 0..23 && min in 0..59) h * 60 + min else null
}

fun tasksFor(tasks: List<TaskEntity>, date: LocalDate): List<TaskEntity> =
    tasks.filter { it.isOn(date.dayOfWeek) }.sortedWith(
        compareBy<TaskEntity>({ it.cat.ordinal }, { it.timeMinutes ?: -1 }, { it.sortOrder })
    )

/** The text of the morning notification. */
fun morningSummary(tasks: List<TaskEntity>, date: LocalDate): String {
    val today = tasksFor(tasks, date)
    val lines = mutableListOf<String>()
    today.filter { it.cat == Category.WEIGH }.forEach { lines += "⚖️ ${it.title} (weigh-in day!)" }
    today.filter { it.cat == Category.WALK }.forEach { lines += "🚶 ${it.title}" }
    today.filter { it.cat == Category.WORKOUT }.forEach { lines += "🏋️ ${it.durationMin?.let { m -> "$m min: " } ?: ""}${it.title}" }
    today.filter { it.cat == Category.BEAUTY }.takeIf { it.isNotEmpty() }?.let { b ->
        lines += "💆 " + b.joinToString(", ") { it.title }
    }
    today.filter { it.cat == Category.MEDS }.takeIf { it.isNotEmpty() }?.let { m ->
        lines += "💊 " + m.joinToString(" · ") { t -> (t.timeMinutes?.let { formatTime(it) + " " } ?: "") + t.title }
    }
    val q = Quotes.forDate(date)
    lines += ""
    lines += "✨ \"${q.text}\" - ${q.author}"
    return lines.joinToString("\n")
}
