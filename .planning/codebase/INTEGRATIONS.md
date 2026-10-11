# Integrations

**Analysis Date:** 2026-10-11

> No cloud backend. All integrations are on-device Expo/native modules, local files, LAN REST to a companion PC app, or optional outbound HTTPS (telemetry/update check). No Stripe/Supabase/Firebase/auth provider.

| Name | Type | Purpose | Entry point | Config |
|---|---|---|---|---|
| On-device LLM (llama.rn + Qwen2.5-0.5B GGUF) | External (native) | Offline note summarization / task extraction | `src/utils/aiService.js:1-30`, UI `src/components/AIAssistant.js` | Plugin `app.json:33`; model URL/SHA/size pins `src/utils/aiService.js:23-30` |
| PC sync (LAN REST: `GET /ping`, `POST /sync`, Bearer token) | External (companion app) | Bidirectional notes/tasks/birthdays merge, zero cloud | `src/utils/syncService.js:107-195`, orchestrated `App.js:769-847` | QR-scanned `{ip,port,token}` validated `src/utils/syncService.js:34-72`; QR scanner `src/components/QRScannerModal.js:14-52` |
| Encrypted backup export/import | Internal + OS share sheet | AES-256 v2 envelope backup (PBKDF2 100k) + `.md` vault import | `src/utils/exportService.js:21-80`, `src/utils/vaultImport.js:1-111` | Passphrase user-supplied; legacy v1 fallback `src/utils/exportService.js:58-80` |
| Vault filesystem (raw `.md` per vault/folder) | Internal (device disk) | Source of truth for notes | `src/utils/fileStorage.js:1-238` | `FileSystem.documentDirectory` vault paths; init per vault `App.js:218` |
| AsyncStorage KV | Internal (device disk) | Tasks, birthdays, theme, timer, billing, habits, telemetry opt-in | `src/utils/storage.js:1-27` (`STORAGE_VERSION v7.0`) | Keys `kwestup_*`; timer decoupled from main save `App.js:458-496` |
| Local notifications (5 Android channels) | External (OS) | Daily tasks, birthdays, bills, behavior cues, focus-timer done | `src/services/notificationService.ts:35-80`, legacy adapter `src/utils/notifications.js:1-131` | Channels behavior/daily/birthday/billing/system `src/services/notificationService.ts:35-73`; schedules from `App.js:732-739,399-418` |
| Android home-screen widgets (×5) | External (OS) | FocusTimer, DailyTasks, ImportantTasks, TasksList, HabitWidget | `index.js:2,11`, `widgets/widget-task-handler.tsx:90-512`, pushes `App.js:596-686` | Declarations `app.json:48-115` (30-min update); headless handler reads AsyncStorage directly |
| Camera (QR only) | External (OS) | Scan PC sync QR payload | `src/components/QRScannerModal.js:146-167` | Permission text `app.json:34-39` |
| Document picker + Share sheet | External (OS) | Pick `.kwestup`/`.md` restores; share backup/model | `src/screens/SettingsScreen.js:6,95-96,271`, `src/utils/exportService.js:245-249` | `mimeType`/extension filter `src/utils/vaultImport.js:20` |
| Clipboard | External (OS) | Copy crash report on ErrorBoundary | `src/components/ErrorBoundary.js:13,103-104` | None |
| Haptics | External (OS) | Success/error/impact feedback | `App.js:832,839`, `src/components/CustomButton.js:4,25` | None |
| Fonts (Inter/Hanken/JetBrains Mono) | External (Google Fonts pkg, bundled) | Typography | `App.js:107-119` | `@expo-google-fonts/*` `package.json:19-21` |
| GitHub Releases update check | External (HTTPS GET) | Notify of newer APK | `src/utils/diagnostics.js:62-106`, prompted `App.js:575-594` | `api.github.com/repos/Omprakash-p06/KwestUpMobile/releases/latest` |
| Telemetry (opt-in POST) | External (HTTPS POST) | Anonymous launch counting | `src/utils/diagnostics.js:127-149`, dialog `App.js:1034-1075` | `https://api.kwestup.com/telemetry`; gate `kwestup_telemetry_optin` |
| Dev-only network probe (httpbin) | External (HTTPS, dev only) | Connectivity log | `src/utils/diagnostics.js:14-42`, gated `App.js:234-237` | Never runs in release (`__DEV__` guard) |
| Behavior engine (internal) | Internal | Habit/reward/intervention/event-bus drives widgets + notifications | `src/behavior/*.ts`, `src/context/HabitContext.js`, emits `App.js:740-747` | Storage keys `kwestup_habits_/behavior_events_/rewards_` `src/utils/storage.js:21-25` |

## Data flows

1. **Cold start → local-first hydrate:** `App.js:178-256` reads AsyncStorage + `getAllNotesFromFilesystem(activeVault)` → state; fonts gate splash (`App.js:877-886`); background vault migration + cache clear fire-and-forget (`App.js:223-242`).
2. **Note write path:** screen edits → `saveNoteFile(vault,folder,title)` (`src/utils/fileStorage.js:33-52`) → metadata cache; main JSON save merges over stored object so task slices owned by `TaskContext` are never clobbered (`App.js:465-482`).
3. **LAN sync cycle:** QR scan (`QRScannerModal`) → `validateSyncConfig` → `pingSyncServer` (`GET /ping`) → `POST /sync` Bearer (`src/utils/syncService.js:135-195`) → wipe vault dir → rewrite `.md` files → cancel + reschedule birthday notifications → state overwrite (`App.js:783-830`).
4. **Backup out / restore in:** `encryptBackup` (AES-256/PBKDF2) → temp file → `Sharing.shareAsync` (`src/utils/exportService.js:21-47,245-249`); restore via `DocumentPicker.getDocumentAsync` → `decryptBackup` (v2, v1 fallback) → rewrite vault + billing + reschedule bills (`src/utils/exportService.js:58-80`, `src/screens/SettingsScreen.js:271`).
5. **AI inference path:** download GGUF to `documentDirectory/models/` with SHA-256/size gate → `initLlama` context → completion; idle-unload after 5 min, force-unload on background (`src/utils/aiService.js:33-114`).
6. **Notification fan-out:** task/birthday/bill/habit/behavior engines → `notificationService.scheduleNotification` (policy-gated for `behavior` category only) → OS channels; foreground handler set in `initNotificationChannels` (`src/services/notificationService.ts:78-80`).
7. **Widget loop (Android):** foreground pushes throttled/staggered `requestWidgetUpdate` (`App.js:596-686`); headless `widgetTaskHandler` (separate JS env) toggles tasks / completes habits via AsyncStorage + `eventBus` local emit, then re-renders siblings (`widgets/widget-task-handler.tsx:126-400`).

## Env/config required

- **No `.env` / secrets file in repo** — nothing to copy; all config is code + OS permissions.
- **Required at build:** EAS project ID (`app.json:117-119`); Android package + `versionCode` (`app.json:25-26`); camera permission string (`app.json:34-39`); widget declarations (`app.json:48-115`).
- **Required at runtime (user-supplied):** PC sync `{ip, port, token}` via QR/manual entry (`src/components/QRScannerModal.js:178`); backup passphrase (never stored); AI model file (~468 MB, downloaded on demand from pinned HuggingFace URL); telemetry opt-in flag (`kwestup_telemetry_optin`).
- **Outbound network (optional):** `api.github.com` (update check), `api.kwestup.com/telemetry` (opt-in only), `httpbin.org` (dev only), `images.unsplash.com` (decorative paper texture `src/components/LiquidGlassBackground.js:35`), HuggingFace model CDN.

---
*Integration audit: 2026-10-11*
