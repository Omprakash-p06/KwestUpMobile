---
slug: fix-all-concerns-and-build-blockers
status: in_progress
trigger: >
  Full codebase audit: identify all APK build blockers, broken/overriding functions, and
  CONCERNS.md items not yet fixed. Fix all source-level issues.
created: 2026-10-18
updated: 2026-10-18
---

# Debug Session: fix-all-concerns-and-build-blockers

## Symptoms

- Expected: APK builds cleanly, all concerns in CONCERNS.md resolved at source level, no broken functions, no swallowed errors.
- Actual: Multiple categories of concerns in CONCERNS.md remain unaddressed at source level.
- Timeline: Post SDK 57 upgrade (expo57-native-compat resolved JS/TS layer); native build blocked by environment (NDK/CMake/disk — not a code issue). Source-level fixes needed.

## Issues Identified

### P0: APK Build Risk (Source-Level)
1. `newArchEnabled=true` set — llama.rn codegen runs correctly — OK
2. `babel.config.js` Reanimated plugin removed (auto-configured by worklets) — OK per expo57-native-compat session
3. `expo-file-system/legacy` used across all utils — OK

### P1: Swallowed Errors / Empty Catches (CONCERNS.md: "Swallowed errors")
- `src/context/TaskContext.js:334` — `.catch(() => {})` on `cancelNotification`
- `src/screens/DailyTasksScreen.js:36,88,152,165` — `.catch(() => {})` on haptics + cancelNotification
- `src/screens/FocusTimerScreen.js:56,75,83` — `.catch(() => {})` on haptics
- `src/screens/SettingsScreen.js:188,207` — bare `} catch {}` (no error object)

### P2: Console.* in App Code (CONCERNS.md: "Lint gates left on warn")
- `src/context/VaultContext.js:48,60,62,73` — 4 raw console.* calls
- `src/navigation/AppNavigator.js:128,397` — 2 console.warn (context unavailable)
- `src/screens/SettingsScreen.js:106,134` — 2 console.error
- `src/screens/NotesScreen.js:744` — 1 console.error

### P3: VaultContext.useVaults() does not throw when unmounted (CONCERNS.md: "Anti-Patterns")
- `src/context/VaultContext.js:94-97` — returns null silently; should throw like `useHabits`

### P4: Deprecated dead code (CONCERNS.md: "Deprecated notification adapters are now dead code")
- `src/utils/notifications.js` — zero importers, safe to delete
- `src/utils/billingNotifications.js` — zero importers, safe to delete

### P5: `isUserDataKey` missing `kwestup_notification_history_v1` prefix (CONCERNS.md: "New storage keys silently excluded")
- `src/utils/storage.js:8-27` — `kwestup_notification_history_` not in allowlist

## Resolution Log

### Fix 1: Replace empty catches with logger.debug (P1)
- Files: TaskContext.js, DailyTasksScreen.js, FocusTimerScreen.js, SettingsScreen.js

### Fix 2: Replace console.* with logger in VaultContext, AppNavigator, SettingsScreen, NotesScreen (P2)
- Files: VaultContext.js, AppNavigator.js, SettingsScreen.js, NotesScreen.js

### Fix 3: Make useVaults() throw when context is null (P3)
- File: VaultContext.js

### Fix 4: Delete deprecated dead code adapters (P4)
- Delete: src/utils/notifications.js, src/utils/billingNotifications.js

### Fix 5: Add kwestup_notification_history_ to isUserDataKey (P5)
- File: src/utils/storage.js

## Verification

- [ ] npm run typecheck → 0 errors
- [ ] npm run lint → 0 errors (no increase in errors)
- [ ] npm test → all suites pass
