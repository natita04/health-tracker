package com.natita.healthtracker.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Upsert
import kotlinx.coroutines.flow.Flow

@Dao
interface TaskDao {
    @Query("SELECT * FROM tasks WHERE archived = 0 ORDER BY sortOrder, title")
    fun observeActive(): Flow<List<TaskEntity>>

    @Query("SELECT * FROM tasks WHERE archived = 0 ORDER BY sortOrder, title")
    suspend fun active(): List<TaskEntity>

    @Query("SELECT * FROM tasks WHERE id IN (:ids)")
    suspend fun byIds(ids: List<String>): List<TaskEntity>

    @Query("SELECT * FROM tasks")
    suspend fun all(): List<TaskEntity>

    @Query("SELECT COALESCE(MAX(sortOrder), 0) FROM tasks")
    suspend fun maxSortOrder(): Int

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertIfMissing(tasks: List<TaskEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(tasks: List<TaskEntity>)

    @Upsert
    suspend fun upsert(task: TaskEntity)

    @Query("UPDATE tasks SET archived = 1 WHERE id = :id")
    suspend fun archive(id: String)

    @Query("DELETE FROM tasks")
    suspend fun deleteAll()
}

@Dao
interface CompletionDao {
    @Query("SELECT * FROM completions WHERE date = :date")
    fun observeFor(date: String): Flow<List<CompletionEntity>>

    @Query("SELECT * FROM completions WHERE date >= :from")
    fun observeSince(from: String): Flow<List<CompletionEntity>>

    @Query("SELECT taskId FROM completions WHERE date = :date")
    suspend fun doneIds(date: String): List<String>

    @Query("SELECT * FROM completions")
    suspend fun all(): List<CompletionEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(c: CompletionEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(list: List<CompletionEntity>)

    @Query("DELETE FROM completions WHERE date = :date AND taskId = :taskId")
    suspend fun delete(date: String, taskId: String)

    @Query("DELETE FROM completions")
    suspend fun deleteAll()
}

@Dao
interface WeightDao {
    @Query("SELECT * FROM weights ORDER BY date")
    fun observeAll(): Flow<List<WeightEntity>>

    @Query("SELECT * FROM weights")
    suspend fun all(): List<WeightEntity>

    @Upsert
    suspend fun upsert(w: WeightEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(list: List<WeightEntity>)

    @Query("DELETE FROM weights WHERE date = :date")
    suspend fun delete(date: String)

    @Query("DELETE FROM weights")
    suspend fun deleteAll()
}
