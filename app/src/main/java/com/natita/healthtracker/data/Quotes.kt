package com.natita.healthtracker.data

import java.time.LocalDate

data class Quote(val text: String, val author: String)

object Quotes {
    private val all = listOf(
        Quote("We are what we repeatedly do. Excellence, then, is not an act, but a habit.", "Will Durant"),
        Quote("You do not rise to the level of your goals. You fall to the level of your systems.", "James Clear"),
        Quote("Habits are the compound interest of self-improvement.", "James Clear"),
        Quote("What you do every day matters more than what you do once in a while.", "Gretchen Rubin"),
        Quote("Success is the sum of small efforts, repeated day in and day out.", "Robert Collier"),
        Quote("A journey of a thousand miles begins with a single step.", "Lao Tzu"),
        Quote("Fall seven times, stand up eight.", "Japanese proverb"),
        Quote("The best time to plant a tree was 20 years ago. The second best time is now.", "Proverb"),
        Quote("Hard choices, easy life. Easy choices, hard life.", "Jerzy Gregorek"),
        Quote("Well done is better than well said.", "Benjamin Franklin"),
        Quote("You miss 100% of the shots you don't take.", "Wayne Gretzky"),
        Quote("I am not a product of my circumstances. I am a product of my decisions.", "Stephen Covey"),
        Quote("Do what you can, with what you have, where you are.", "Theodore Roosevelt"),
        Quote("Take care of your body. It's the only place you have to live.", "Jim Rohn"),
        Quote("Our bodies are our gardens, to the which our wills are gardeners.", "William Shakespeare, Othello"),
        Quote("Caring for myself is not self-indulgence, it is self-preservation.", "Audre Lorde"),
        Quote("Almost everything will work again if you unplug it for a few minutes, including you.", "Anne Lamott"),
        Quote("Motivation is what gets you started. Habit is what keeps you going.", "Jim Ryun"),
        Quote("The groundwork for all happiness is good health.", "Leigh Hunt"),
        Quote("Don't count the days, make the days count.", "Muhammad Ali"),
        Quote("The man who moves a mountain begins by carrying away small stones.", "Proverb"),
        Quote("Consistency beats intensity.", "Unknown"),
        Quote("Small steps every day add up to big results.", "Unknown"),
        Quote("You don't have to be extreme, just consistent.", "Unknown"),
        Quote("Be stronger than your excuses.", "Unknown"),
        Quote("Progress, not perfection.", "Unknown"),
        Quote("A one-hour workout is 4% of your day. No excuses.", "Unknown"),
        Quote("The only bad workout is the one that didn't happen.", "Unknown"),
        Quote("Every day is a fresh start.", "Unknown"),
    )

    fun forDate(date: LocalDate): Quote = all[Math.floorMod(date.toEpochDay(), all.size.toLong()).toInt()]
}
