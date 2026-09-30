package com.natita.healthtracker

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Checklist
import androidx.compose.material.icons.filled.Insights
import androidx.compose.material.icons.filled.MonitorWeight
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.lifecycle.viewmodel.compose.viewModel
import com.natita.healthtracker.ui.HealthTheme
import com.natita.healthtracker.ui.HistoryScreen
import com.natita.healthtracker.ui.MainViewModel
import com.natita.healthtracker.ui.PlanScreen
import com.natita.healthtracker.ui.TodayScreen
import com.natita.healthtracker.ui.WeightScreen
import kotlinx.coroutines.launch
import java.time.LocalDate

private enum class Tab(val label: String, val icon: ImageVector) {
    TODAY("Today", Icons.Filled.Checklist),
    WEIGHT("Weight", Icons.Filled.MonitorWeight),
    HISTORY("History", Icons.Filled.Insights),
    PLAN("Plan", Icons.Filled.Tune),
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { HealthTheme { App() } }
    }
}

@Composable
private fun App(vm: MainViewModel = viewModel()) {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= 33) permission.launch(Manifest.permission.POST_NOTIFICATIONS)
        // Coming back to the app on a new day should show that day.
        vm.setDate(LocalDate.now())
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        bottomBar = {
            NavigationBar {
                Tab.entries.forEachIndexed { i, t ->
                    NavigationBarItem(
                        selected = tab == i,
                        onClick = {
                            if (t == Tab.TODAY && tab == i) vm.setDate(LocalDate.now())
                            tab = i
                        },
                        icon = { Icon(t.icon, null) },
                        label = { Text(t.label) },
                    )
                }
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when (Tab.entries[tab]) {
                Tab.TODAY -> TodayScreen(vm)
                Tab.WEIGHT -> WeightScreen(vm)
                Tab.HISTORY -> HistoryScreen(vm) { d -> vm.setDate(d); tab = Tab.TODAY.ordinal }
                Tab.PLAN -> PlanScreen(vm) { msg -> scope.launch { snackbar.showSnackbar(msg) } }
            }
        }
    }
}
