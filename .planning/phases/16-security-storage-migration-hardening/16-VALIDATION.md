---
phase: 16
slug: security-storage-migration-hardening
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-27
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x + jest-expo / babel-jest |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npm test -- __tests__/unit/exportImportService.test.js` |
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
| 16-01-01 | 01 | 1 | SEC-01 | unit | `npm test -- __tests__/unit/exportImportService.test.js` | ✅ | ⬜ pending |
| 16-01-02 | 01 | 1 | SEC-01 | unit | `npm test -- __tests__/unit/exportImportService.test.js` | ✅ | ⬜ pending |
| 16-02-01 | 02 | 2 | SEC-02 | unit | `npm test -- __tests__/unit/syncService.test.js` | ✅ | ⬜ pending |
| 16-02-02 | 02 | 2 | STORE-01 | unit | `npm test -- __tests__/unit/storageMigration.test.js` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/unit/storageMigration.test.js` — Unit test suite for storage migration and cache clearing protection

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Wi-Fi synchronization with Electron Desktop App | SEC-02 | Requires running desktop PC server on same LAN | Scan QR code from desktop app, initiate sync, verify notes transfer without disruption |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-27
