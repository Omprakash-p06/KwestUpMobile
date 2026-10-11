# Integrations

**Analysis Date:** 2026-10-11

> Convention: **internal** = first-party module in this repo; **external** = third-party SDK / OS / network service.

| name | type | purpose | entry point file | config |
|---|---|---|---|---|
| On-device LLM (llama.rn + Qwen2.5-0.5B Q4_K_M) | external | Offline intent extraction + AI assist inference | `src/utils/aiService.js:10,391-419` | `MODEL_DOWNLOAD_URL`, `MODEL_PATH`, SHA/size pins (`src/utils/aiService.js:23-31`); plugin `llama.rn` (`app.json:33`); postinstall Gradle unwrap (`patch-llama-gradle.js:6-68`) |
| AI intent parser (LLM + heuristic fallback) | internal | NL → typed `ExtractedIntent` bare facts; 500-char clamp, 15 s timeout, rule-RAG prompt | `src/ai/intentParser.ts:33-71` | `MAX_USER_INPUT_LENGTH=500`, `MAX_OUTPUT_TOKENS=120` (`src/ai/intentParser.ts:18-20`) |
| Heuristic parser | internal | Regex/keyword fallback when model missing/times out/malformed | `src/ai/heuristicParser.ts` (via `src/ai/index.ts:13`) | `forceHeuristic` flag (`src/ai/types.ts:30-35`) |
| Rule packet retriever (mini-RAG) | internal | Keyword scan → 2–3 machine-rule snippets for prompt grounding | `src/ai/rulePacketRetriever.ts:19-50` | rulebook `rulebook/machine/*.json` |
| Behavior compiler | internal | Deterministic intent → `CompiledHabitPlan` + `DispatchedCommand`; enforces caps, 2-min rule, identity anchor, Never-Miss-Twice | `src/ai/behaviorCompiler.ts:1-23` | via `src/behavior/habitEngine.ts` (`compileHabitPlan`, `validateHabitCreation`) |
| Command gateway hook | internal | Safe typed dispatch for UI/widget/AI; registers habit handlers | `src/commands/useCommandGateway.ts:29-76` | `DispatchCommandOptions` (`src/commands/useCommandGateway.ts:23-27`) |
| Command executor + validator | internal | Idempotency dedup (200-entry, 15-min TTL), handler registry, `COMMAND_EXECUTED` telemetry | `src/commands/commandExecutor.ts:22-60` | `MAX_IDEMPOTENCY_CACHE_SIZE`, `IDEMPOTENCY_TTL_MS` (`src/commands/commandExecutor.ts:22-23`) |
| AI sandbox | internal | Prototype-pollution strip, storage-key/path-injection block, destructive-action confirm gate | `src/commands/aiSandbox.ts:15-30` | `PROHIBITED_KEYS`, `STORAGE_KEY_PATTERN`, `PATH_TRAVERSAL_PATTERN` (`src/commands/aiSandbox.ts:15-18`) |
| Behavior engines (habit/cue/reward/recovery/intervention/rule/eventBus) | internal | Atomic-Habits state machines, streaks, rewards, rule evaluation | `src/behavior/habitEngine.ts`, `src/behavior/eventBus.ts`, `src/behavior/ruleEngine.ts` | rulebook `rulebook/rules/*.md`, `rulebook/machine/rules.json` |
| AsyncStorage KV store | external | Habits, identities, events, vaults, billing, notif history, model-download resume state | `src/utils/storage.js:34-63`, `src/context/HabitContext.js:72-75,222-225` | keys `kwestup_*` (`src/utils/storage.js:19`); history key `kwestup_notification_history_v1` (`src/services/notificationService.ts:33`) |
| expo-file-system | external | GGUF model download dir, vault/note files, backup read/write | `src/utils/fileStorage.js:1`, `src/utils/vaultService.js:2`, `src/utils/exportService.js:2` | `MODEL_DIR = documentDirectory/models/` (`src/utils/aiService.js:29-30`) |
| Encrypted backup/restore (crypto-js AES-256) | external (crypto-js) + internal envelope | PBKDF2-SHA256 100k-iter v2 envelope export; v1 legacy fallback; share + re-import | `src/utils/exportService.js:21-60` | passphrase user-supplied; no server |
| Vault import/export (document-picker + sharing) | external | Pick `.json`/encrypted vault files; share backup via OS sheet | `src/utils/vaultImport.js:1-2`, `src/utils/exportService.js:3` | — |
| Local notifications (expo-notifications) | external (OS) | 5 Android channels; policy-gated behavior cues; recurring task/birthday/bill reminders | `src/services/notificationService.ts:78-104,328-395` | channels `kwestup_{behavior_cues,daily_tasks,birthdays,billing,system}` (`src/services/notificationService.ts:35-73`) |
| LAN sync (fetch REST handshake) | external (LAN PC companion) | Ping + secure-transport validation + bidirectional sync; QR-provisioned `{ip,port,token}` | `src/utils/syncService.js:9-50,135` | strict IPv4/hostname/port validation (`src/utils/syncService.js:46-49`); 4 s fetch timeout |
| QR sync provisioning (expo-camera) | external | Scan sync QR codes to configure LAN sync | `app.json:34-39` (permission text) | camera permission string (`app.json:37`) |
| Android home widgets (react-native-android-widget) | external (OS) | 5 widgets: FocusTimer, DailyTasks, ImportantTasks, TasksList, HabitWidget; headless handler | `index.js:2-11`, `widgets/widget-task-handler.tsx:38-44` | widget defs `app.json:48-115`; sizing-fallback Java patch (`patch-llama-gradle.js:70-161`) |
| Fonts (expo-font + google-fonts) | external | Inter / HankenGrotesk / JetBrainsMono | `App.js:12-29` | `@expo-google-fonts/* ^0.4.x` (`package.json:19-21`) |
| Haptics / clipboard / status-bar / linear-gradient | external | Tactile feedback, copy tokens, status bar, backgrounds | `App.js:8,11`, `src/components/*` | — |
| Diagnostics + opt-in telemetry stub | external (placeholder) | Dev network probe; `POST https://api.kwestup.com/telemetry` only when `kwestup_telemetry_optin` set | `src/utils/diagnostics.js:18,129-132` | **no real backend — URL is a stub** |
| EAS Build/Submit | external | Internal APK distribution (dev/preview/prod) | `eas.json:5-24` | projectId (`app.json:117-120`), CLI `>=3.10.0` |

## Data flows

1. **Voice/text → habit:** UI/AI input → `parseUserIntent` (`src/ai/intentParser.ts:33`) → rule packet (`src/ai/rulePacketRetriever.ts`) → Qwen via `loadModel` (`src/utils/aiService.js:391`) or heuristic fallback → `behaviorCompiler` (`src/ai/behaviorCompiler.ts`) → `executeAiCommand` sandbox (`src/commands/aiSandbox.ts`) → `executeCommand` idempotent dispatch (`src/commands/commandExecutor.ts`) → `habitCommandHandlers` → `HabitContext` → AsyncStorage + `eventBus` → widget refresh (`widgets/widget-task-handler.tsx`).
2. **Widget tap → state:** headless `widgetTaskHandler` (`widgets/widget-task-handler.tsx:38+`) reads AsyncStorage directly (separate JS env), mutates via `habitEngine`/`toggleTask`, writes back, calls `requestWidgetUpdate` — never touches in-memory app state.
3. **Notify:** domain code → `scheduleNotification` (`src/services/notificationService.ts:328`) → policy eval (quiet-hours/cap/gap/dedup) → `Notifications.scheduleNotificationAsync` → history write to AsyncStorage (only on native success).
4. **Model install:** `downloadModel` streams HuggingFace GGUF → `documentDirectory/models/` → size + SHA-256 verify (`src/utils/aiService.js:206-262`); idle 5-min timer + AppState background unload frees native context (`src/utils/aiService.js:41,69-73`).
5. **Backup:** `collectAsyncStorageData` → `encryptBackup` (AES-256/PBKDF2 v2 envelope) → FileSystem write → `expo-sharing` sheet; restore reverses with v1 fallback (`src/utils/exportService.js:21-60,188-323`).
6. **LAN sync:** QR/camera → `{ip,port,token}` → `validateSyncConfig` → `fetchWithTimeout` ping → REST handshake `performSync` (`src/utils/syncService.js:9-24,135`).

## Env/config required

- **No `.env` / no remote secrets** — fully offline-first; only external URL is the opt-in telemetry stub (`src/utils/diagnostics.js:132`).
- **Model download** needs network on first AI use (~468 MB from `huggingface.co`); works offline after.
- **Android permissions:** camera (QR), notifications (reminders), storage via FileSystem/Sharing intents.
- **EAS:** `eas.json` profiles + `extra.eas.projectId` (`app.json:117-120`); owner `omprakash-p06` (`app.json:122`).
- **Native build flags:** `newArchEnabled=false`, `hermesEnabled=true`, legacy packaging, edge-to-edge (`android/gradle.properties:60,64,79,84`).

---
*Integration audit: 2026-10-11*
