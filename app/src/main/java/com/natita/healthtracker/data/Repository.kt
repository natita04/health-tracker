package com.natita.healthtracker.data

import android.content.Context
import androidx.room.withTransaction
import com.natita.healthtracker.reminders.ReminderScheduler
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate

class Repository(private val context: Context) {
    val db = AppDatabase.get(context)
    val settings = Settings(context)

    /** Adds any built-in plan items this install hasn't seen yet. Safe to call on every start. */
    suspend fun seedDefaults() {
        val have = settings.defaultsVersion
        if (have >= Defaults.VERSION) return
        db.tasks().insertIfMissing(Defaults.newSince(have))
        settings.defaultsVersion = Defaults.VERSION
    }

    suspend fun setDone(date: LocalDate, task: TaskEntity, done: Boolean) {
        if (done) {
            db.completions().insert(CompletionEntity(date.toString(), task.id, System.currentTimeMillis(), task.title))
        } else {
            db.completions().delete(date.toString(), task.id)
        }
    }

    suspend fun markDone(date: LocalDate, taskIds: List<String>) {
        db.tasks().byIds(taskIds).forEach { setDone(date, it, true) }
    }

    suspend fun saveWeight(date: LocalDate, kg: Double) {
        db.weights().upsert(WeightEntity(date.toString(), kg))
        // Logging a weight counts as the weigh-in for that day.
        db.tasks().active().filter { it.cat == Category.WEIGH && it.isOn(date.dayOfWeek) }
            .forEach { setDone(date, it, true) }
    }

    suspend fun deleteWeight(date: String) = db.weights().delete(date)

    suspend fun saveTask(task: TaskEntity) {
        db.tasks().upsert(task)
        ReminderScheduler.scheduleNext(context)
    }

    suspend fun archiveTask(id: String) {
        db.tasks().archive(id)
        ReminderScheduler.scheduleNext(context)
    }

    suspend fun nextSortOrder(): Int = db.tasks().maxSortOrder() + 1

    // ---- Backup: a plain JSON file with everything, for safekeeping or moving phones ----

    suspend fun exportJson(): String {
        val root = JSONObject()
        root.put("format", 1)
        root.put("exportedAt", System.currentTimeMillis())
        root.put("tasks", JSONArray().apply {
            db.tasks().all().forEach { t ->
                put(JSONObject().apply {
                    put("id", t.id); put("category", t.category); put("title", t.title)
                    put("details", t.details); put("durationMin", t.durationMin ?: JSONObject.NULL)
                    put("daysMask", t.daysMask); put("timeMinutes", t.timeMinutes ?: JSONObject.NULL)
                    put("link", t.link ?: JSONObject.NULL); put("sortOrder", t.sortOrder); put("archived", t.archived)
                })
            }
        })
        root.put("completions", JSONArray().apply {
            db.completions().all().forEach { c ->
                put(JSONObject().apply {
                    put("date", c.date); put("taskId", c.taskId)
                    put("completedAt", c.completedAt); put("title", c.titleSnapshot)
                })
            }
        })
        root.put("weights", JSONArray().apply {
            db.weights().all().forEach { w -> put(JSONObject().apply { put("date", w.date); put("kg", w.kg) }) }
        })
        root.put("settings", JSONObject().apply {
            put("morningEnabled", settings.morningEnabled)
            put("morningMinutes", settings.morningMinutes)
            put("medRemindersEnabled", settings.medRemindersEnabled)
            put("defaultsVersion", settings.defaultsVersion)
        })
        return root.toString(2)
    }

    /** Replaces everything with the contents of a backup file. */
    suspend fun importJson(json: String) {
        val root = JSONObject(json)
        fun JSONObject.optIntOrNull(k: String): Int? = if (isNull(k) || !has(k)) null else getInt(k)
        fun JSONObject.optStrOrNull(k: String): String? = if (isNull(k) || !has(k)) null else getString(k)

        val tasks = root.getJSONArray("tasks").let { arr ->
            List(arr.length()) { i ->
                val o = arr.getJSONObject(i)
                TaskEntity(
                    id = o.getString("id"), category = o.getString("category"), title = o.getString("title"),
                    details = o.optString("details"), durationMin = o.optIntOrNull("durationMin"),
                    daysMask = o.optInt("daysMask", ALL_DAYS), timeMinutes = o.optIntOrNull("timeMinutes"),
                    link = o.optStrOrNull("link"), sortOrder = o.optInt("sortOrder"), archived = o.optBoolean("archived"),
                )
            }
        }
        val completions = root.getJSONArray("completions").let { arr ->
            List(arr.length()) { i ->
                val o = arr.getJSONObject(i)
                CompletionEntity(o.getString("date"), o.getString("taskId"), o.optLong("completedAt"), o.optString("title"))
            }
        }
        val weights = root.getJSONArray("weights").let { arr ->
            List(arr.length()) { i -> arr.getJSONObject(i).let { WeightEntity(it.getString("date"), it.getDouble("kg")) } }
        }
        db.withTransaction {
            db.tasks().deleteAll(); db.tasks().insertAll(tasks)
            db.completions().deleteAll(); db.completions().insertAll(completions)
            db.weights().deleteAll(); db.weights().insertAll(weights)
        }
        root.optJSONObject("settings")?.let { s ->
            settings.morningEnabled = s.optBoolean("morningEnabled", true)
            settings.morningMinutes = s.optInt("morningMinutes", 5 * 60)
            settings.medRemindersEnabled = s.optBoolean("medRemindersEnabled", true)
            settings.defaultsVersion = s.optInt("defaultsVersion", 0)
        }
        seedDefaults()
        ReminderScheduler.scheduleNext(context)
    }
}
