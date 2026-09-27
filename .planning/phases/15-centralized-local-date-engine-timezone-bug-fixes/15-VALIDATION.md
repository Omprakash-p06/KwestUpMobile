---
phase: 15
slug: centralized-local-date-engine-timezone-bug-fixes
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-27
---

# Phase 15 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x + jest-expo / babel-jest |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npm test -- __tests__/unit/dateUtils.test.js` |
| **Full suite command** | `npm test` |
| **Lint command** | `npm run lint` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --bail`
- **After every plan wave:** Run `npm test` and `npm run lint`
- **Before `/gsd-verify-work`:** Full suite must be green with zero failures
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 01 | 1 | DATE-01 | unit | `npm test -- __tests__/unit/dateUtils.test.js` | ❌ W0 | ⬜ pending |
| 15-01-02 | 01 | 1 | DATE-01 | unit | `npm test -- __tests__/unit/dateUtils.test.js` | ❌ W0 | ⬜ pending |
| 15-02-01 | 02 | 2 | DATE-02 | unit | `npm test` | ✅ | ⬜ pending |
| 15-02-02 | 02 | 2 | DATE-02 | unit | `npm test && npm run lint` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/utils/dateUtils.js` — Core centralized date utilities module
- [ ] `__tests__/unit/dateUtils.test.js` — Timezone, leap year, and boundary test suite

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Android Widget local date synchronization | DATE-02 | Headless Jest mocks Android AppWidget bridge | Toggle task in Android home-screen widget and observe task completion timestamp on device |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-27
