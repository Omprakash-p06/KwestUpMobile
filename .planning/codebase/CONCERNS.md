# Concerns

**Analysis Date:** 2026-09-27

> Milestone 2 (Hardened Offline-First & Production Readiness) is 84% complete — Phase 16 done, Phase 17 next (State Architecture & Unified Mutation Layer). This document was re-verified against code on the analysis date; resolved Phase 14/15/16 items are marked ✅ but retained for audit trail. Zero `TODO`/`FIXME`/`HACK`/`XXX` markers found in `src/`, `App.js`, `widgets/` (grep-verified).

## Tech Debt (ranked list with file refs)

**1. `App.js` is a state monolith — directly blocks Phase 17.**
- Files: `App.js` (1268 lines, 32 `useState` callsites, ~75 `useState`/`useEffect`/`AsyncStorage`/`setTimeout`/`setInterval` refs total)
- Issue: All app state (tasks, lists, birthdays, billing, settings, `timerState`, telemetry opt-in), persistence load/save, notification scheduling, and navigation callbacks (`handleAddTask`, `handleToggleTask`, recurrence spawning, birthday rescheduling) live in one component with props drilled to every screen.
- Impact: Every feature touches this file (merge-conflict magnet); widget-driven storage writes bypass in-memory state until next foreground reload (stale UI).
- Fix approach (Phase 17 scope): introduce a reducer/context (or equivalent) data-layer module so screens consume actions instead of callbacks; subscribe the foreground app to storage changes from the widget path.

**2. Screens are monolithic and oversized.**
- Files: `src/screens/NotesScreen.js` (2012 lines), `src/screens/SettingsScreen.js` (1100 lines), `src/components/AIAssistant.js` (1089 lines), `src/screens/BillingScreen.js` (813 lines), `src/screens/TaskListScreen.js` (803 lines), `src/screens/DailyTasksScreen.js` (691 lines), `src/utils/aiService.js` (634 lines)
- Impact: Untestable in isolation (all screens report 0% coverage — see Test Gaps); reviewers cannot meaningfully diff; high regression risk.
- Fix approach: Extract repeated editor/panel/task subcomponents and pure helpers (note sanitization, recurrence logic) into tested modules. Do NOT attempt in Phase 17 wholesale — carve out only the state/mutation pieces Phase 17 needs.

**3. Recurrence / toggle logic duplicated across app and widget.**
- Files: `App.js` (~`handleToggleTask` recurrence spawn) vs `widgets/widget-task-handler.tsx` (lines 141–179); widget writes directly to AsyncStorage while the running app keeps state in memory.
- Impact: Behavior drift (progressive-recurrence and notification re-scheduling differ); open app shows stale task lists after widget interaction until `AppState` foreground reload.
- Fix approach (Phase 17 scope): factor recurrence into a single shared module imported by both paths; add a foreground subscription to widget-driven storage changes. Note: `__tests__/phase12-widget-logic.test.js` re-implements toggle/sort helpers locally instead of importing the real handler, so drift is currently undetectable by tests.

**4. Release APK committed to git.**
- Files: `build/kwestup-v3.0.1.apk` (confirmed via `git ls-files build/` — 1 tracked file); `.gitignore` only ignores `coverage/` and `build/kwestup-v3.0.1.apk` partially yet the file is already tracked.
- Impact: Binary bloats every clone/fetch; stale artifact (v3.0.1 vs current v3.5.0) invites confusion about which build is canonical.
- Fix approach: `git rm --cached build/kwestup-v3.0.1.apk`, broaden `.gitignore` to `build/`, publish APKs via GitHub Releases / EAS instead.

**5. Two overlapping ESLint configs.**
- Files: `.eslintrc.js` (legacy) + `eslint.config.js` (flat; ignores `node_modules/**`, `.expo/**`, `dist/**`, `web-build/**`, `android/**`, `ios/**`, `assets/**`, `KwestUpPC/**`)
- Impact: Ambiguous which config is authoritative; `npm run lint` (`eslint .`) behavior depends on ESLint version resolution.
- Fix approach: Delete `.eslintrc.js`, standardize on `eslint.config.js` (ESLint 9).

**6. Native `node_modules` patches via postinstall regex.**
- Files: `patch-llama-gradle.js` (invoked by `package.json` `postinstall`), targets `node_modules/llama.rn/android/build.gradle` and `node_modules/react-native-android-widget/.../RNWidgetUtil.java`
- Impact: Any bump of `llama.rn` (^0.12.4) or `react-native-android-widget` (^0.16.1) can silently break the build if the regex no longer matches (script logs a warning and continues); patches only re-apply on `npm install`.
- Fix approach: Fail loudly on pattern mismatch; add a CI step asserting post-patch content; long-term, fork or use patch-package with checksums.

**7. App version in multiple sources of truth.**
- Files: `package.json` (`3.5.0`), `app.json` (`3.5.0`, `versionCode: 7`), `src/utils/storage.js` (`APP_VERSION = "v3.5.0"`), `android/app/build.gradle` (`versionCode 7`, `versionName "3.5.0"`)
- Impact: Values can drift; update checks in `src/utils/diagnostics.js` compare against `storage.js` value which may disagree with the shipped binary.
- Fix approach: Derive all version values from a single source at build time.

**8. 140 `console.*` callsites retained in shipped code.**
- Files (per-file counts): `App.js` (24), `src/utils/diagnostics.js` (20), `src/utils/vaultService.js` (15), `src/utils/exportService.js` (13), `src/utils/fileStorage.js` (13), `src/utils/storage.js` (13), `src/utils/aiService.js` (8), `src/utils/notifications.js` (6), `src/utils/vaultImport.js` (6), `widgets/widget-task-handler.tsx` (5), `src/utils/syncService.js` (4), `src/utils/billingStorage.js` (2), `src/utils/billingNotifications.js` (2)
- Impact: Noise in production logs; potential leakage of diagnostic/file-path details on user devices; minor bundle/performance cost.
- Fix approach: Gate behind `__DEV__` or strip in release builds via Babel plugin.

## Security Notes (encryption, validation, storage — v2 details verified)

**Backup encryption v2 — ✅ UPGRADED in Phase 16 (SEC-01), legacy risk remains by design.**
- Files: `src/utils/exportService.js` (lines 13–94)
- Verified v2 envelope: per-archive 128-bit random salt + 128-bit random IV (`CryptoJS.lib.WordArray.random(16)` ×2), PBKDF2-HMAC-SHA256 with 100,000 iterations, AES encrypt with explicit IV; envelope `{v: 2, kdf: "PBKDF2", hasher: "SHA256", iterations, salt(hex), iv(hex), ciphertext}`. Decrypt re-derives with stored salt/IV/iterations (defaults 100000).
- Verified v1 fallback (lines 83–87): static salt `Hex("4b77657374557053616c745f7632")` used as BOTH PBKDF2 salt and AES IV, 1,000 iterations. Any archive still in v1 format (or an attacker-supplied v1 blob) inherits the old weak parameters. Transparent fallback is a compatibility necessity, but there is no prompt/nudge to re-export v1 archives to v2.
- Good: wrong-passphrase path throws generic `"Unable to decrypt archive. Please verify the passphrase."` (line 94) — no oracle detail.
- Recommendation: on successful v1 import, flag the archive as legacy in UI and offer one-tap re-export to v2.

**LAN sync validation — ✅ HARDENED in Phase 16 (SEC-02), transport still plaintext HTTP.**
- Files: `src/utils/syncService.js` (193 lines; `validateSyncConfig` lines 32–69, `validateSyncPayload` lines 80–95, `pingSyncServer` 105–, `performSync` 133–185)
- Verified: strict IP-format rejection (plus path-injection rejection), port must be integer 1–65535, token must be string ≥6 chars trimmed; response payload must be object with `notes`/`tasks`/`birthdays`/`taskLists` arrays (`validateSyncPayload`, enforced at line 183).
- Residual risk 1 — plaintext transport: `baseUrl = http://${ip}:${port}` (lines 108, 135). Bearer token travels over unencrypted HTTP. Acceptable only under the LAN-only threat model; any use outside a trusted LAN (public Wi-Fi, routed networks) exposes the token to sniffing. Document this constraint in UI copy; consider optional HTTPS/self-signed pinning as a follow-up.
- Residual risk 2 — ping bypass: `pingSyncServer` substitutes `"ping-token-check"` when no token is supplied (line 107), so ping succeeds without the real credential. Low severity (ping returns no data) but worth noting in review.
- Recommendation: add timeout/abort handling audit on `fetch` calls in `pingSyncServer`/`performSync` (verify AbortController coverage) during Phase 17 touch-ups.

**Storage keys / versioning — ✅ MIGRATED in Phase 16 (STORE-01), key surface is wide.**
- Files: `src/utils/storage.js` (`STORAGE_VERSION = "v7.0"`, `APP_VERSION = "v3.5.0"`, `isUserDataKey` lines 7–19, migration lines 70–168), `src/utils/vaultService.js` (lines 6–9: `LEGACY_VAULTS_KEY = "kwestup_vaults_v5.0"`, `LEGACY_ACTIVE_KEY`, dynamic `VAULTS_KEY`/`ACTIVE_KEY`), `src/utils/billingStorage.js` (line 4: dynamic `BILLING_KEY`)
- Verified: `isUserDataKey` shields `kwestup_data_`, `kwestup_userName_`, `kwestup_theme_mode_`, `kwestup_theme_name_`, `kwestup_timer_state_`, `kwestup_activeVault_`, `kwestup_vaults_`, `kwestup_billing_`, `kwestup_widget_`, `kwestup_telemetry_`, `kwestup_ai_model_` — so `clearAllCaches` preserves telemetry consent and AI-model download state. Migration auto-moves legacy `v5.0` vault keys to current version.
- Residual: ~15 versioned key prefixes with coarse whole-version migration (no per-key schema versions); a future `v8.0` bump must migrate every prefix or strand data. `kwestup_last_version` / `kwestup_last_clear` bookkeeping keys (lines 56–57) are cache keys, not user data — confirm they survive/refresh correctly across upgrades.
- No `.env`/secret files detected in scope; app is local-first with no cloud credentials — nothing to leak via committed config.

**Telemetry consent — opt-in default verified.**
- Files: `App.js` (line 125 `useState(false)` default; lines 177, 1164 consent read; lines 1189–1209 first-run consent modal), `src/screens/SettingsScreen.js` (lines 36, 453–456 toggle writes `kwestup_telemetry_optin`)
- Verified: default is `false` (opt-in), persisted as `"true"`/`"false"` string, shielded from cache wipes. No concern beyond keeping the default `false` in any Phase 17 state refactor.

**AI model download — integrity gap (unchanged, still open).**
- Files: `src/utils/aiService.js` (line 17 mutable `resolve/main` URL `https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf`; line 35 `size < 450_000_000` validity check)
- Risk: mutable branch pointer means the bytes can change without the app noticing; size-only validation cannot detect truncated-but-large-enough or substituted files.
- Recommendation: pin to an immutable commit/tag URL and verify SHA-256 post-download before `initLlama`; store the checksum alongside `kwestup_ai_model_` keys.

## Reliability / Offline Risks

**AsyncStorage single-blob persistence has no per-entity schema.**
- Files: `src/utils/storage.js` (`kwestup_data_${STORAGE_VERSION}` + per-area keys), `App.js` (load/save), `src/utils/billingStorage.js`
- Risk: all tasks/lists/birthdays/billing/settings serialize into one JSON string; corruption or quota pressure fails atomically; no partial recovery. Large datasets grow a single payload. Notes are safely on-disk via `src/utils/fileStorage.js`, but structured data is not.
- Phase 17 relevance: the unified mutation layer should add write-through validation + atomic save guards (write-temp-then-rename equivalent for AsyncStorage: serialize → validate → multi-set), and keep a last-known-good fallback.

**`aiService` global mutable state + busy-wait mutex.**
- Files: `src/utils/aiService.js` (lines 23–24 `_llamaContext`/`_isInitializing`; lines 161–201 init with `while (_isInitializing)` spin-sleep; line 184 `n_ctx: 2048` CPU-only `n_gpu_layers: 0`; line 208 `unloadModel`)
- Risk: concurrent init storm spins on 100 ms sleep loop; any rejection resets context to `null`, forcing a multi-second reload on next call; 468 MB model + 10-retry resumable download (state in AsyncStorage per failure) is heavy on mid-range devices; `unloadModel`/`releaseAllLlama` exist but callers must remember to free RAM.
- Safe change: promise-chain mutex with single in-flight init; coalesce reloads; audit all `initLlama` callers for unload pairing.

**Note filename sanitizer + unsanitized folder path.**
- Files: `src/utils/fileStorage.js` (lines 37–50 `saveNote`, 72–77 path rebuild; title sanitized via `.replace(/[/\\?%*:|"<>._ ]/g, "_")` — note: the character class also flattens `.` and spaces; folder is only `.trim()`ed, not sanitized)
- Risk: titles colliding after sanitization overwrite each other; empty/whitespace titles fall back to `"Untitled Note"` (ok); folder names with `/`, `..`, or null bytes flow into `vaultPath + folder + /` unchecked — path traversal / unexpected directories if folder input is ever user-controlled.
- Safe change: share one sanitizer for folder + title, reject `..`/separators, add empty-title/unusual-char/null-byte tests (currently 0% screen-level coverage of these flows).

**Birthday/notification scheduling is untested date math.**
- Files: `src/utils/notifications.js` (lines 117–182 `scheduleCustomBirthdayReminders`; 0% coverage)
- Risk: this-year/next-year scheduling with `< today` skips, `getMonth()`-based Feb rollover fix, and `parts.length`-inferred date parsing break silently on format drift. No tests guard day/Feb-29/advance-day behavior.
- Safe change: add unit tests over `dateUtils.js` (already 95% — extend) + `notifications.js` scheduling pure logic before Phase 17 refactors touch scheduling.

**Widget ↔ app state divergence (offline interaction race).**
- Files: `widgets/widget-task-handler.tsx`, `App.js`
- Risk: widget toggles write AsyncStorage directly; foreground app holds stale in-memory state until next `AppState` reload — user sees reverted checkboxes. Same class of bug as the recurrence duplication above; Phase 17 must close it, not just document it.

## Test Gaps

- Suite status (verified `npm test -- --ci --coverage`): **7 suites, 88 tests, all passing.** Runners: `jest.config.js` (`jest-expo/android` preset, `__tests__/setup/jest.setup.js`, `testMatch __tests__/**/*.test.js`); CI (`.github/workflows/ci.yml`) runs ESLint + Jest with coverage on `main`/`development`. No Semgrep gate in CI despite `.semgrepignore` existing (it currently ignores only `UI Design plan/**`).
- Covered (good): `dateUtils.js` 95% stmts, `storage.js` ~92%, `syncService.js` ~95% — Phase 14/15/16 hardening is guarded.
- Partially covered: `exportService.js` ~67%, `fileStorage.js` ~67%, `vaultService.js` ~64% — encrypt/decrypt round-trip and vault migration have tests (`exportImportService.test.js`, `vaultAndFileStorage.test.js`, `storageMigration.test.js`) but filesystem/error branches (lines cited in coverage output) remain open.
- Zero coverage (priority-ordered): **all screens 0%** (`NotesScreen`, `SettingsScreen`, `TaskListScreen`, `DailyTasksScreen`, `DashboardScreen`, `FocusTimerScreen`, `SearchScreen`), `theme/*` 0%, `aiService.js` 0% (parse/command fallback regex, init failure paths), `notifications.js` 0%, `diagnostics.js` 0% (version-check logic that depends on the triple-source version), `vaultImport.js` 0%, `billingStorage.js` ~21%, `billingNotifications.js` ~10%.
- Structural gap: `__tests__/phase12-widget-logic.test.js` duplicates handler logic in local helper functions (only imports `getLocalDateString` from production) — it tests copies, not the shipped widget path. Either import the real handlers or delete in favor of `__tests__/unit/*` coverage.
- Missing types: no component/integration/E2E tests; no test for `clearAllCaches` shield list beyond migration unit tests; no checksum/pinning test (blocked on the AI-model fix itself).

## Recommended Next Investigations (esp. relevant to Phase 17)

1. **Inventory every `setState` + AsyncStorage write in `App.js`** (start: 32 `useState`, lines ~125–250 state declarations, ~700–950 mutation handlers, ~1100–1210 persistence/consent) and map them to the proposed unified mutation actions before writing the Phase 17 plan — this is the work-breakdown input.
2. **Decide widget→app notification mechanism** (storage subscription, event emitter, or polling on `AppState` change) and verify `react-native-android-widget` supports it without the postinstall-patched `RNWidgetUtil.java` breaking — prototype before committing the plan.
3. **Extract recurrence as the pilot shared module** (`App.js` spawn + `widget-task-handler.tsx` 141–179 → one tested module) to prove the Phase 17 pattern on a small surface before migrating all mutations.
4. **Close the plaintext-LAN-sync documentation gap**: confirm product stance (trusted-LAN-only) and add in-app copy + a `performSync`/`pingSyncServer` timeout audit while in the area.
5. **Un-track the committed APK** (`git rm --cached build/kwestup-v3.0.1.apk`, ignore `build/`) and delete `.eslintrc.js` — two 10-minute chores that remove confusion before Phase 17 diffs.
6. **Add the three highest-value tests first**: `notifications.js` scheduling, `fileStorage.js` sanitizer/collision/traversal, and a real-import widget-handler test to replace the phase-12 logic copy — these guard exactly the code Phase 17 will move.

---

*Concerns audit: 2026-09-27*
