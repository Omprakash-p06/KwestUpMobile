# Concerns

**Analysis date:** 2026-10-11 — brownfield React Native/Expo (SDK 57, RN 0.86, React 19), local-first, on-device LLM via `llama.rn`.

## Tech Debt

| area | file | severity | note |
|------|------|----------|------|
| Old Architecture pinned off | `android/gradle.properties:60` (`newArchEnabled=false`), `app.json:33` | high | Startup crash with New Arch forces Old Arch; blocks RN/Fabric future, JSI via CatalystInstance bridge is fragile. Comment block `:46-60` documents the trap. |
| Native pins frozen | `package.json:41,44` (`llama.rn 0.12.4`, `react-native-android-widget ^0.16.1`), `patch-llama-gradle.js` | high | Postinstall Gradle patch + 16KB page-size linker flags; any Expo/RN bump risks breaking on-device inference and widgets. |
| Sync token in plaintext | `src/utils/syncService.js:67-71,169` | high | Min-6-char token validated then sent as `Bearer` over cleartext `http://` (`:110,:137`); stored/transmitted without `expo-secure-store` (not in `package.json`). LAN eavesdropper can replay. |
| Backup crypto in JS thread | `src/utils/exportService.js:21-37` | med | `crypto-js` PBKDF2 100k + AES with per-archive salt/IV (v2) runs on JS thread — slow on low-end, passphrase held as `string` in memory, no zeroization. Legacy v1 auto-fallback keeps weaker envelope readable. |
| Storage key sprawl | `src/utils/storage.js:5-25,76-181`, `src/utils/vaultService.js:8-10` | med | `STORAGE_VERSION=v7.0` plus `kwestup_data_v*`, `kwestup_habits_v1`, `kwestup_behavior_events_v1`, legacy `v5.0` migration paths; `isUserDataKey` allowlist must be hand-extended for every new key or cache-wipe deletes user data. |
| Non-crypto IDs | `src/behavior/habitEngine.ts:22-24`, `src/behavior/eventBus.ts:18-21`, `src/ai/behaviorCompiler.ts:201` | med | `Math.random().toString(36)` for entity/event/idempotency keys — collision + predictability risk; idempotency key includes `Date.now()` only. |
| Idempotency cache sweep | `src/commands/commandExecutor.ts:78-91,136-155` | low | Expired entries purged only at 200-item cap (IN-01, Phase 26 review); replayed-expired-key lookup path needed opportunistic purge — verify `bdc2c29` fix stuck. |
| Broad Android permissions | `android/app/src/main/AndroidManifest.xml:2-10` | med | `CAMERA`, `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`, `READ_EXTERNAL_STORAGE` (≤32), `WRITE_EXTERNAL_STORAGE` (≤29) — over-broad for a habits app; Play review + privacy-label risk. QR scan/audio justifications undocumented. |
| Logging remnants | `src/` (16 `console.*` hits, e.g. `src/context/VaultContext.js:60`, `src/utils/logger.js:145,156`) | low | `babel-plugin-transform-remove-console` strips prod logs but dev leakage of vault IDs via `console.log` remains in source. |
| Single-file AsyncStorage writes | `src/utils/storage.js`, `src/context/HabitContext.js`, `src/context/TaskContext.js` | med | No transactions; Phase 25 WR-05 debounce-write race (foreground re-hydrate vs pending writes) is a class, not a one-off. |

## Security & Privacy

- **Prompt-injection → destructive action (fixed, residual surface):** Phase 26 CR-01 (`src/commands/aiSandbox.ts:162`) allowed `parsed.confirmed:true` to self-authorize `DELETE_HABIT`. Fixed to `options.confirmed === true` only (`src/commands/aiSandbox.ts:169-170`, commit `bdc2c29`). Residual: only `DELETE_HABIT`/`ARCHIVE_HABIT` gated (`DESTRUCTIVE_ACTIONS`, `:21`); mass-`CREATE_HABIT`/`UPDATE_HABIT` floods from hallucinated LLM output have no rate/confirmation gate.
- **Path/storage injection (fixed, verify):** WR-01 hardened `PATH_TRAVERSAL_PATTERN` (`src/commands/aiSandbox.ts:17`) for drive-letter/UNC/system-dir; old regex false-flagged `/walk`. Re-audit after `bdc2c29`.
- **Heuristic regex crash (fixed, verify):** Phase 27 WR-01 `new RegExp(...${anchor})` (`src/ai/heuristicParser.ts:195`) threw on metacharacters — fixed in `e4ae876` by escaping. Any new interpolation must use the escape helper.
- **UPDATE validation gaps (fixed, verify):** WR-04 allowed unknown keys + unvalidated `stretchTarget` (`src/commands/commandValidator.ts:204-222`); fixed in `bdc2c29`. Unknown-key rejection must stay deny-by-default as payload schema grows.
- **Wrong-target habit resolution:** `resolveTargetHabitId` fuzzy match (`src/ai/behaviorCompiler.ts`, WR-04 fix in `e4ae876`) returns error when no match, but near-match typos can still compile `LOG/PAUSE/DELETE_HABIT` against the wrong habit — no user-facing disambiguation step; destructive wrong-target = data loss.
- **Enum/action validation:** 11-action catalog + `UPDATE_HABIT` gap (WR-03, fixed `e4ae876`); any LLM-emitted action outside catalog falls to `default` reject — good — but `cueType`/`identityId` optionality drift (`types.ts:29`, WR-05) shows schema and `compileHabitPlan` (`src/behavior/habitEngine.ts:98-139`, nested `cue:{type,time}` vs flat `cueType/cueTime` WR-03) desync easily.
- **LAN sync transport:** `http://<ip>:<port>` with `Bearer` token (`src/utils/syncService.js:110,137,169`), strict IP/port validation added but no TLS/pinning; token `trim().length<6` rejected but 6 chars is brute-forceable on LAN. No `expo-secure-store`; token lifetime/rotation undocumented.
- **Backup passphrase handling:** user-supplied passphrase → PBKDF2 in JS; wrong-passphrase error oracle, no Argon2 option, v1 legacy archives auto-decrypt — keep v1 reader read-only, never write v1.
- **On-device guarantee holds but brittle:** no cloud deps in `package.json`; `src/ai/intentParser.ts:52-70` falls back to heuristic when model missing. Risk is regression: any future analytics/crash-reporter addition breaks the core privacy promise. Widget headless path (`widgets/widget-task-handler.tsx:96-115`, `SWITCH_TAB` allowlist) is a second intent entry point — must stay allowlisted.

## Reliability Risks

- **LLM inference hangs:** `ctx.completion` unbounded pre-fix; `e4ae876` adds 15s `Promise.race` → heuristic fallback (`src/ai/intentParser.ts:98-137`). Low-end thermal-throttle still yields heuristic-quality parses silently — callers cannot distinguish `source:'heuristic'` without checking `rulesRetrieved`.
- **Ghost habit IDs (fixed):** compiler invented `generateEntityId('habit')` on no-match (`src/ai/behaviorCompiler.ts:221-367`); now returns compilation error. Downstream `HabitContext` `"Habit with ID ... not found"` throw remains for any stale ID — gateway should map to user-visible error, not crash.
- **Time/NLP misparses (fixed, class remains):** "7 in the evening" → 07:00 bug (`src/ai/heuristicParser.ts:136-155`); archetype collision `study→software engineer` (`src/ai/behaviorCompiler.ts:35`); both fixed in `e4ae876` but heuristic NLP has no confidence score — wrong time/cue silently schedules wrong reminder.
- **Missing rulebook rules (fixed):** `CUE_STACK_001`, `HABIT_PAUSE_001`, `HABIT_IDENTITY_ANCHOR_001` + `SYS_AI_CONFIRMATION_GATE_001` absent from `rulebook/machine/*.json` while cited in traces — fixed in `bdc2c29`/`e4ae876`; any new `rulesApplied` string without a JSON entry re-breaks governance audit.
- **Multi-mount gateway unregistration:** `useCommandGateway` cleanup removed singleton handlers while siblings mounted (`src/commands/useCommandGateway.ts:32-37`) — refcount fix in `bdc2c29`; pattern can regress with new providers.
- **In-memory event bus loss:** singleton bus (`src/behavior/eventBus.ts`) deep-freezes + isolates subscriber errors but buffer is RAM-only; restart wipes 100-event history relied on by telemetry/debugging.
- **Widget headless races:** Phase 25 fixes (double-tap dedupe, headless sleep removal, async-rejection guard, quiet-hours 08:00 boundary) show widget → app bridge is fragile; new widget actions must add dedupe + rejection handling.

## Scalability Limits

- **Telemetry ring 100:** `MAX_EVENT_BUFFER_SIZE=100` (`src/behavior/eventBus.ts:10,265`) FIFO drop — high-frequency habit events lose history; never persisted without redaction (`:163-164`).
- **Behavior events 500:** `kwestup_habits_v1` / `kwestup_behavior_events_v1` capped at 500 FIFO (Phase 24); long-term users lose training signal for adaptation (Phase 28 concern).
- **AsyncStorage ceiling:** ~6 MB Android practical limit across `kwestup_data_*`, vaults, billing, widgets; vault files use `expo-file-system` but indexes stay in AsyncStorage — large vaults risk quota/`JSON.parse` jank.
- **Idempotency 200:** `commandExecutor` cache cap 200 with TTL sweep — burst AI-compiled commands can evict live keys, allowing double-execution of non-idempotent habits.
- **Inference throughput:** one `llama.rn` context; concurrent `parseUserIntent` calls queue/block; no cancellation — rapid typing in `AIAssistant` can pile up 15s-timeout races.
- **Platform:** 16KB page-size devices require the linker-flag path; Old Arch + pinned `llama.rn`/`android-widget` block minor-version upgrades; `eas.json` build profile must be re-validated per SDK bump.

## Test Gaps

- **25 suites, mocked natives:** `npx jest --listTests` → 25 files (`__tests__/unit/`); Phase 27 reports 396 passing but native LLM (`ctx.completion`), `AsyncStorage`, widgets, notifications all mocked — no on-device inference, real LAN sync, or Play-store widget host coverage.
- **No E2E:** detox/maestro absent; critical paths untested E2E: backup encrypt→wipe→restore (v1+v2), LAN sync handshake with wrong/expired token, widget headless complete → rewards pipeline, destructive AI command confirmation gate.
- **Fuzz missing:** heuristic parser regex/metacharacter corpus, time-of-day matrix ("7 in the evening", "at 7", "19h"), archetype collision set ("study Spanish" vs "study DSA") added as unit cases in `e4ae876` but no property/fuzz harness.
- **Concurrency untested:** multi-mount `useCommandGateway`, debounce-write vs re-hydrate, idempotency TTL expiry replay, 100/500-cap eviction ordering.
- **Security tests thin:** prompt-injection corpus (`{"confirmed":true}`, drive-letter/UNC payloads, `../` traversals) covers known vectors only; token brute-force/length, passphrase-oracle, and wrong-target habit disambiguation lack tests.
- **Coverage artifact stale:** `coverage/` present but no enforced threshold in `jest.config.js`/CI gate beyond pass/fail — caps (100/500/200) and migration (`v5→v7`) paths can regress silently.

## Recommended Next Investigations

1. Re-verify `bdc2c29` + `e4ae876` fixes with targeted regression run (`aiSandbox`, `commandGateway`, `intentParser`, `behaviorCompiler` suites) before Phase 28 builds on the compiler.
2. Spike `expo-secure-store` migration for sync token + backup passphrase cache; add LAN TLS-or-PSK decision record.
3. Add wrong-target disambiguation UX contract (compiler returns candidates; gateway prompts) — prevents destructive mis-fire.
4. Load-test caps: 500-event FIFO, 100-ring, AsyncStorage quota with large vault; define Phase 28 retention policy.
5. Document permission justifications (`CAMERA`, `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`) or drop unused ones prior to store submission.
6. Add heuristic-parser fuzz corpus + prompt-injection suite to CI; enforce coverage threshold on `src/ai/*` and `src/commands/*`.
