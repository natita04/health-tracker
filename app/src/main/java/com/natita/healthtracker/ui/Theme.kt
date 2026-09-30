package com.natita.healthtracker.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Light = lightColorScheme(
    primary = Color(0xFFB8336A),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFFFD9E3),
    onPrimaryContainer = Color(0xFF3E0020),
    secondary = Color(0xFF6D5A8E),
    secondaryContainer = Color(0xFFEBDDFF),
    tertiary = Color(0xFF2E7D6B),
    tertiaryContainer = Color(0xFFCDEFE4),
    background = Color(0xFFFDF7F9),
    surface = Color(0xFFFDF7F9),
    surfaceVariant = Color(0xFFF3E6EB),
)

private val Dark = darkColorScheme(
    primary = Color(0xFFFFB0C9),
    onPrimary = Color(0xFF5F1136),
    primaryContainer = Color(0xFF7E2A4F),
    onPrimaryContainer = Color(0xFFFFD9E3),
    secondary = Color(0xFFD3BCFD),
    secondaryContainer = Color(0xFF4F3F6E),
    tertiary = Color(0xFF8FD6C1),
    tertiaryContainer = Color(0xFF0E5445),
)

@Composable
fun HealthTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (isSystemInDarkTheme()) Dark else Light, content = content)
}
