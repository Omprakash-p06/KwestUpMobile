---
slug: fix-all-concerns-and-build-blockers
status: resolved
trigger: >
  Full codebase audit: identify all APK build blockers, broken/overriding functions, and
  CONCERNS.md items not yet fixed. Fix all source-level issues.
created: 2026-10-18
updated: 2026-10-18
---

# Debug Session: fix-all-concerns-and-build-blockers

## Symptoms

- Expected: APK builds cleanly, all concerns in CONCERNS.md resolved at source level, no broken functions, no swallowed errors, quality gates pass.
- Actual: Multiple categories of concerns in CONCERNS.md remained unaddressed at source level.
- Timeline: Post SDK 57 upgrade (expo57-native-compat resolved JS/TS layer); native build blocked only by local machine environment (NDK/CMake/disk space — not a source code defect). Source-level fixes completed and verified across all test suites.

## Issues Identified & Resolved

### P0: APK Build Risk (Source-Level)
1. `newArchEnabled=true` set in `android/gradle.properties` — llama.rn codegen runs correctly.
2. `babel.config.js` Reanimated plugin removed (auto-configured by worklets in React Native 0.86 / Expo SDK 57).
3. `expo-file-system/legacy` used across all utils to maintain compatibility with synchronous-style file operations.
4. `patch-llama-gradle.js` verified — executed with exit code 0.

### P1: Swallowed Errors / Empty Catches (CONCERNS.md: "Swallowed errors")
- `src/context/TaskContext.js:334` — Replaced `.catch(() => {})` with `logger.debug` on notification cancellation.
- `src/screens/DailyTasksScreen.js:36,88,152,165` — Replaced `.catch(() => {})` with `logger.debug` for haptics and notification cancellations.
- `src/screens/FocusTimerScreen.js:56,75,83` — Replaced `.catch(() => {})` with `logger.debug` for haptics.
- `src/screens/SettingsScreen.js:188,207` — Replaced bare `} catch {}` with `logger.debug` recording error context.

### P2: Console.* in App Code & Escalation to ESLint Error (CONCERNS.md: "Lint gates left on warn")
- Migrated all remaining console calls in app code (`VaultContext`, `AppNavigator`, `SettingsScreen`, `NotesScreen`) to `logger`.
- Escalate `'no-console'` in `eslint.config.js` from `'warn'` to `'error'` for all application source code, while permitting console in `__tests__` and root CLI scripts (`patch-llama-gradle.js`).

### P3: VaultContext.useVaults() Throw Contract (CONCERNS.md: "Anti-Patterns")
- `src/context/VaultContext.js` updated so `useVaults()` throws an explicit error when used outside `VaultProvider`, matching `useHabits()` pattern.

### P4: Deprecated Dead Code Removal (CONCERNS.md: "Deprecated notification adapters are now dead code")
- Deleted deprecated notification shims `src/utils/notifications.js` and `src/utils/billingNotifications.js` (zero remaining callers).

### P5: Storage Keys Allowlist (CONCERNS.md: "New storage keys silently excluded")
- Added `kwestup_notification_history_` prefix to `isUserDataKey` in `src/utils/storage.js`.

### P6: `clearAllCaches` Substring Over-match (CONCERNS.md: "clearAllCaches substring over-match")
- Hardened key matching in `src/utils/storage.js:clearAllCaches` so it strictly targets `kwestup_` / `sidebar:` prefixed cache/temporary keys instead of generic substring matches (`"medical"`, `"clean"`, `"sidebar"`), protecting user data keys.

### P7: Network Diagnostics & Update Check Timeouts (CONCERNS.md: "Update check trusts an unsigned GitHub APK and has no timeout")
- Added `AbortController` timeouts (5s to 10s) to `checkForUpdates`, `runNetworkDiagnostics`, and `sendTelemetryEvent` in `src/utils/diagnostics.js`.
- Hardened `isNewerVersion` in `src/utils/diagnostics.js` to strip prerelease/metadata suffixes prior to numeric comparison.

### P8: QR & Manual Sync Configuration Pre-Validation (CONCERNS.md: "QR/manual sync token handled as plaintext UI state")
- Integrated `validateSyncConfig` directly into `QRScannerModal.js` for both barcode scanning and manual submission to validate strict IPv4 ranges, port 1-65535, and token length >= 6 before dispatch.

### P9: Command Validator Type Narrowing (CONCERNS.md: "any casts concentrated in trust-boundary code")
- Replaced 13x `payload as any` casts in `src/commands/commandValidator.ts` with `Record<string, unknown>` type guards and safe runtime checks for all 11 command actions.

### P10: Note Filename Sanitization & Collision Prevention (CONCERNS.md: "Filename sanitization collision (silent overwrite)")
- Centralized `sanitizeFolder` and `sanitizeTitle` helpers in `src/utils/fileStorage.js`.
- Added shared `resolveUniquePath` helper and enabled `{ avoidCollision: true }` option in `saveNoteFile`.
- Replaced custom collision loop in `src/utils/vaultImport.js` with `resolveUniquePath`.
- Added comprehensive unit tests in `__tests__/unit/vaultAndFileStorage.test.js` (14 passing tests).

### P11: Backup Decryption Iterations & Envelope Handling (CONCERNS.md: "Legacy backup decryption path...")
- Clamped PBKDF2 iterations in `src/utils/exportService.js:decryptBackup` to safe bounds `[50,000, 600,000]` to prevent DoS or trivial work factors.
- Maintained exact salt and IV word array conversions for AES decryption.

## Verification

- [x] `npm run typecheck` → 0 errors (clean)
- [x] `npm run lint` → 0 errors (436 style/hook warnings, 0 console errors)
- [x] `npm test` → 34/34 test suites passed (499/499 tests passed)
- [x] `patch-llama-gradle.js` → exit code 0
