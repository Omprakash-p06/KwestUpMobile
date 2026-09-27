---
phase: 14
slug: automated-testing-framework-ci-cd-pipeline
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-27
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x + jest-expo / babel-jest |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npm test -- __tests__/unit/exportService.test.js` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --bail`
- **After every plan wave:** Run `npm test` and `npm run lint`
- **Before `/gsd:verify-work`:** Full suite must be green with zero failures
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | TEST-01 | config | `npm test -- -v` | ❌ W0 | ⬜ pending |
| 14-01-02 | 01 | 1 | TEST-01 | unit | `npm test -- __tests__/setup/jest.setup.test.js` | ❌ W0 | ⬜ pending |
| 14-02-01 | 02 | 2 | TEST-02 | unit | `npm test -- __tests__/unit/exportService.test.js` | ❌ W0 | ⬜ pending |
| 14-02-02 | 02 | 2 | TEST-02 | unit | `npm test -- __tests__/unit/vaultAndFileStorage.test.js` | ❌ W0 | ⬜ pending |
| 14-03-01 | 03 | 3 | TEST-03 | ci | `npm run lint && npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `package.json` — add `jest`, `jest-expo`, `babel-jest`, `@types/jest` devDependencies and `test` script
- [ ] `jest.config.js` — jest configuration with preset and transformIgnorePatterns
- [ ] `__tests__/setup/jest.setup.js` — mock declarations for native modules
- [ ] `.github/workflows/ci.yml` — GitHub Actions CI pipeline

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| GitHub Actions PR trigger | TEST-03 | Requires pushing branch to GitHub | Push to `development` and verify GitHub Actions runner executes CI workflow |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-27
