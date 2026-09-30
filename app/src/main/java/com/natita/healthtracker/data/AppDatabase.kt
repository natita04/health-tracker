package com.natita.healthtracker.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

/**
 * HOW TO CHANGE THE SCHEMA WITHOUT LOSING HISTORY:
 * bump `version`, add a Migration (or an AutoMigration) from the old version, and keep
 * the old exported schema in app/schemas. Never use fallbackToDestructiveMigration,
 * that wipes everything.
 */
@Database(
    entities = [TaskEntity::class, CompletionEntity::class, WeightEntity::class],
    version = 1,
    exportSchema = true,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun tasks(): TaskDao
    abstract fun completions(): CompletionDao
    abstract fun weights(): WeightDao

    companion object {
        @Volatile private var instance: AppDatabase? = null

        fun get(context: Context): AppDatabase = instance ?: synchronized(this) {
            instance ?: Room.databaseBuilder(context.applicationContext, AppDatabase::class.java, "health.db")
                .build()
                .also { instance = it }
        }
    }
}
