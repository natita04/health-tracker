package com.natita.healthtracker.data

import java.time.DayOfWeek.FRIDAY
import java.time.DayOfWeek.MONDAY
import java.time.DayOfWeek.SATURDAY
import java.time.DayOfWeek.SUNDAY
import java.time.DayOfWeek.THURSDAY
import java.time.DayOfWeek.TUESDAY
import java.time.DayOfWeek.WEDNESDAY

/**
 * The built-in plan.
 *
 * To ship a new default item in a future APK: add it with `since = VERSION + 1`, then bump VERSION.
 * On update the app inserts only items newer than what it already has, so your edits,
 * deleted items and all history are left alone. (You can also just add items in the app's Plan tab.)
 */
object Defaults {
    const val VERSION = 1

    private fun yt(id: String) = "https://www.youtube.com/watch?v=$id"
    private fun hm(h: Int, m: Int = 0) = h * 60 + m

    private class Item(val since: Int, val task: TaskEntity)

    private val items: List<Item> = run {
        var order = 0
        fun t(
            id: String, cat: Category, title: String, details: String = "", minutes: Int? = null,
            days: Int = ALL_DAYS, time: Int? = null, link: String? = null,
        ) = Item(1, TaskEntity(id, cat.name, title, details, minutes, days, time, link, order++))

        listOf(
            // Weigh-in
            t("weigh_in", Category.WEIGH, "Weigh yourself", "Morning, after the bathroom, before eating or drinking.",
                days = daysMaskOf(THURSDAY)),

            // Walk
            t("walk_10k", Category.WALK, "Walk 10,000 steps", "Aim for 10k steps across the day."),

            // Meds (Eltroxin needs a 4h gap from iron, multivitamin and magnesium)
            t("med_eltroxin", Category.MEDS, "Eltroxin",
                "First thing, empty stomach, water only. Wait 30-60 min before breakfast or coffee.", time = hm(5)),
            t("med_iron", Category.MEDS, "Iron",
                "4h+ after Eltroxin. Best with vitamin C (e.g. orange juice), away from coffee, tea and dairy.", time = hm(10)),
            t("med_multivitamin", Category.MEDS, "Multivitamin", "With lunch.", time = hm(13)),
            t("med_omega3", Category.MEDS, "Omega 3", "With lunch, fat in the meal helps absorption.", time = hm(13)),
            t("med_magnesium", Category.MEDS, "Magnesium", "Evening, helps you wind down.", time = hm(21)),

            // 45 min workouts: Sun lower, Mon upper, Wed lower, Fri full body
            t("full_sun_lower", Category.WORKOUT, "Lower Body Strength (Fierce Day 2)",
                "45 min · Heather Robertson · dumbbells", 45, daysMaskOf(SUNDAY), link = yt("C6MyDJMddYE")),
            t("full_mon_upper", Category.WORKOUT, "Arms & Shoulders Upper Body Strength (Fierce Day 1)",
                "49 min · Heather Robertson · dumbbells", 45, daysMaskOf(MONDAY), link = yt("LF-fA0g9KNg")),
            t("full_wed_lower", Category.WORKOUT, "Killer Leg Day // Lower Body Strength",
                "41 min · Heather Robertson · heavier dumbbells", 45, daysMaskOf(WEDNESDAY), link = yt("eemRXHKsGIc")),
            t("full_fri_full", Category.WORKOUT, "Total Body Strength & Cardio (Fierce Day 14)",
                "43 min · Heather Robertson · dumbbells", 45, daysMaskOf(FRIDAY), link = yt("HpKRKd3R8A0")),

            // Quick 15 min workout, every day
            t("quick_sun", Category.WORKOUT, "15 Min Full Body HIIT + Abs", "15 min · Heather Robertson",
                15, daysMaskOf(SUNDAY), link = yt("GDY8g5KME9E")),
            t("quick_mon", Category.WORKOUT, "15 Min HIIT // Glutes, Hips & Thighs", "15 min · Heather Robertson",
                15, daysMaskOf(MONDAY), link = yt("QhwMoUbDSnI")),
            t("quick_tue", Category.WORKOUT, "Bodyweight HIIT // 15 Minutes", "15 min · Heather Robertson · no equipment",
                15, daysMaskOf(TUESDAY), link = yt("DPFr0AZqjbQ")),
            t("quick_wed", Category.WORKOUT, "HIIT Cardio + Core // No Repeats", "~15 min · Heather Robertson · no equipment",
                15, daysMaskOf(WEDNESDAY), link = yt("6aX-OGw881Q")),
            t("quick_thu", Category.WORKOUT, "15 Min Booty Workout", "~18 min · Heather Robertson",
                15, daysMaskOf(THURSDAY), link = yt("Bpd1JZ3oGLY")),
            t("quick_fri", Category.WORKOUT, "Low Impact HIIT // No Equipment", "15 min · Heather Robertson · no jumping",
                15, daysMaskOf(FRIDAY), link = yt("BtKje1m613w")),
            t("quick_sat", Category.WORKOUT, "15 Min Full Body HIIT + Abs", "15 min · Heather Robertson",
                15, daysMaskOf(SATURDAY), link = yt("GDY8g5KME9E")),

            // Beauty
            t("beauty_vibration", Category.BEAUTY, "Vibration plate", "10 min", 10),
            t("beauty_red_light", Category.BEAUTY, "Red light", "10 min", 10),
            t("beauty_legs_wall", Category.BEAUTY, "Legs up the wall", "10 min", 10),
            t("beauty_dry_brush", Category.BEAUTY, "Dry brushing", "10 min", 10),
            t("beauty_face", Category.BEAUTY, "Face therapy", "Weekly", days = daysMaskOf(FRIDAY)),
            t("beauty_hair", Category.BEAUTY, "Hair therapy", "Weekly", days = daysMaskOf(SATURDAY)),
        )
    }

    fun newSince(version: Int): List<TaskEntity> = items.filter { it.since > version }.map { it.task }

    /** More workouts to swap in, used as a hint in the Plan editor. */
    const val MORE_WORKOUTS_URL = "https://www.youtube.com/@Heatherrobertsoncom/videos"
}
