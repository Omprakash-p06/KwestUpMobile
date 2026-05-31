---
phase: 09
slug: android-widgets
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-31
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — widget testing requires physical Android device/emulator |
| **Config file** | N/A |
| **Quick run command** | `npx expo run:android` (requires dev client build after config changes) |
| **Full suite command** | Same — no widget-specific test framework exists |
| **Estimated runtime** | ~15 min (full dev client build) |

---

## Sampling Rate

- **After every task commit:** Run `npx expo export --platform android --dump-sourcemap` to verify Metro bundler compiles without errors
- **After every plan wave:** Build dev client with `npx expo run:android` and verify widgets appear in Android widget picker
- **Before `/gsd-verify-work`:** Both widgets must render on device home screen with live data
- **Max feedback latency:** 15 minutes (dev client build time)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | WIDG-01 | T-09-01 | N/A — no user input or data exposure | build | `npx expo export --platform android --dump-sourceflag` | ❌ W0 | ⬜ pending |
| 09-01-02 | 01 | 1 | WIDG-01 | T-09-01 | N/A — display-only widget | build | `grep -q "widgetTaskHandler" widgets/widget-task-handler.tsx` | ❌ W0 | ⬜ pending |
| 09-01-03 | 01 | 1 | WIDG-01 | T-09-01 | N/A — config only | config | `grep -q "react-native-android-widget" app.json` | ❌ W0 | ⬜ pending |
| 09-02-01 | 02 | 2 | WIDG-01 | T-09-01 | N/A — JS registration only | build | `grep -q "registerWidgetTaskHandler" index.js` | ❌ W0 | ⬜ pending |
| 09-02-02 | 02 | 2 | WIDG-01 | T-09-01 | N/A — read-only display | build | `grep -q "requestWidgetUpdate" App.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `widgets/FocusTimerWidget.tsx` — widget component
- [ ] `widgets/DailyTasksWidget.tsx` — widget component
- [ ] `widgets/widget-task-handler.tsx` — task handler with AsyncStorage reads

*No automated test framework exists for Android widgets — testing is 100% manual on device/emulator.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Focus Timer widget shows MM:SS countdown with running/paused state | WIDG-01 | Widget renders on Android launcher, not in RN JS | 1. Build dev client: `npx expo run:android` 2. Add FocusTimer widget to home screen 3. Start timer in app 4. Verify widget updates every 1-2 seconds |
| Daily Tasks widget shows completed/total count | WIDG-01 | Widget renders on Android launcher, not in RN JS | 1. Build dev client 2. Add DailyTasks widget to home screen 3. Toggle tasks in app 4. Verify widget updates with correct counts |
| Widget appears in Android widget picker | WIDG-01 | System UI interaction | 1. Long-press home screen 2. Tap "Widgets" 3. Scroll to find "Focus Timer" and "Daily Tasks" widgets |
| Widget shows data after app is killed and reopened | WIDG-01 | Background data flow | 1. Kill app process 2. Wait 30+ seconds 3. Verify widgets still show last known data (not blank) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 900s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** {pending / approved YYYY-MM-DD}
