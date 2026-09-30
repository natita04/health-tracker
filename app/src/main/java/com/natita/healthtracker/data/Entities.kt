package com.natita.healthtracker.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.time.DayOfWeek

enum class Category(val label: String, val emoji: String) {
    WEIGH("Weigh-in", "⚖️"),
    WALK("Walk", "🚶"),
    WORKOUT("Workout", "🏋️"),
    MEDS("Meds & supplements", "💊"),
    BEAUTY("Beauty", "💆");

    companion object {
        fun of(name: String): Category = entries.firstOrNull { it.name == name } ?: BEAUTY
    }
}

const val ALL_DAYS = 0b1111111

fun dayBit(day: DayOfWeek): Int = 1 shl (day.value - 1)

fun daysMaskOf(vararg days: DayOfWeek): Int = days.fold(0) { acc, d -> acc or dayBit(d) }

/**
 * One thing on the plan. `id` is a stable key, completions point at it, so renaming or
 * rescheduling a task never loses its history. Deleting only archives it.
 */
@Entity(tableName = "tasks")
data class TaskEntity(
    @PrimaryKey val id: String,
    val category: String,
    val title: String,
    val details: String = "",
    val durationMin: Int? = null,
    val daysMask: Int = ALL_DAYS,
    /** Minutes after midnight for a reminder, or null for none. */
    val timeMinutes: Int? = null,
    val link: String? = null,
    val sortOrder: Int = 0,
    val archived: Boolean = false,
) {
    val cat: Category get() = Category.of(category)
    fun isOn(day: DayOfWeek): Boolean = daysMask and dayBit(day) != 0
}

@Entity(tableName = "completions", primaryKeys = ["date", "taskId"])
data class CompletionEntity(
    /** ISO date, e.g. 2026-09-30. */
    val date: String,
    val taskId: String,
    val completedAt: Long,
    /** Title at the time it was done, so history still reads right if the task is renamed. */
    val titleSnapshot: String,
)

@Entity(tableName = "weights")
data class WeightEntity(
    @PrimaryKey val date: String,
    val kg: Double,
)
