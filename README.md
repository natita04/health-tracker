# Health Tracker

A personal Android app: a 05:00 morning plan notification, meds reminders with a "Taken" button,
daily check-offs, weight log with a trend chart, and history/streaks.

## Install / update

1. Open **Releases** on your phone: https://github.com/natita04/health-tracker/releases/latest
2. Download the `.apk` and open it (allow "install unknown apps" for your browser the first time).
3. To update, install the newer APK **over** the old one. Don't uninstall, that's what deletes data.

Every push builds a new APK via GitHub Actions (`.github/workflows/build.yml`).

## How your data survives updates

- **Same signing key every build** (`app/signing/release.keystore`), so Android accepts updates in place.
- **Version code = build number**, so each APK is newer than the last.
- **Stable task IDs**: check-offs point at an item's ID, so renaming or rescheduling keeps history.
  Removing an item only archives it.
- **Built-in plan is versioned** (`Defaults.kt`): new default items are added on update without
  touching your edits.
- **Room migrations**, never destructive (`AppDatabase.kt`).
- **Backups**: Android auto-backup to Google, plus a manual JSON backup/restore in the Plan tab.

## Changing the plan

Most changes need no new APK: use the Plan tab to add, edit or remove items.
To change the built-in defaults, edit `app/src/main/java/com/natita/healthtracker/data/Defaults.kt`.
