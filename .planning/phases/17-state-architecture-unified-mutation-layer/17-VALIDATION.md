---
phase: 17
slug: state-architecture-unified-mutation-layer
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-27
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x + jest-expo / babel-jest |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npm test -- __tests__/unit/taskMutations.test.js` |
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
| 17-01-01 | 01 | 1 | ARCH-02 | unit | `npm test -- __tests__/unit/taskMutations.test.js` | ❌ W0 | ⬜ pending |
| 17-01-02 | 01 | 1 | ARCH-02 | unit | `npm test -- __tests__/unit/taskMutations.test.js __tests__/phase12-widget-logic.test.js` | ✅ | ⬜ pending |
| 17-02-01 | 02 | 2 | ARCH-01 | unit | `npm test -- __tests__/unit/taskContext.test.js` | ❌ W0 | ⬜ pending |
| 17-02-02 | 02 | 2 | ARCH-01 | integration | `npm test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/unit/taskMutations.test.js` — Unit test suite for pure task mutation operations and recurrence patterns (daily, weekly, monthly, progressive).
- [ ] `__tests__/unit/taskContext.test.js` — Unit test suite for `TaskContext` provider, actions, and storage sync.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Home-Screen Widget Click Parity | ARCH-02 | Android widget click requires active launcher host | Add widget to Android launcher, click task checkbox, verify recurrence task appears on launcher |
| Foreground App State Refresh | ARCH-01 | Requires backgrounding app and interacting with launcher | Toggle task in widget, return to KwestUp app, verify task list refreshes without app restart |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-27
