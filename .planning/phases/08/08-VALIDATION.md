---
phase: 8
slug: obsidian-vaults
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-31
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Custom Node.js Static Assertion Suite & ESLint |
| **Config file** | `scripts/validate_phase_8.js` |
| **Quick run command** | `node scripts/validate_phase_8.js` |
| **Full suite command** | `node scripts/validate_phase_8.js && npm run lint` |
| **Estimated runtime** | ~1.5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/validate_phase_8.js`
- **After every plan wave:** Run `node scripts/validate_phase_8.js && npm run lint`
- **Before `/gsd-verify-work`:** Full suite must be clean (0 errors)
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | NOTE-04 | T-08-01 / — | Default vault generated on disk, migrated from flat folder on first startup | unit | `node scripts/validate_phase_8.js` | ✅ | ✅ green |
| 08-01-02 | 01 | 1 | NOTE-04 | T-08-02 | Core note CRUD fully parameterized by `vaultId` and path-traversal sanitized | unit | `node scripts/validate_phase_8.js` | ✅ | ✅ green |
| 08-01-03 | 01 | 1 | NOTE-04 | T-08-04 | Vault configurations and active vault tracking persisted safely in AsyncStorage | unit | `node scripts/validate_phase_8.js` | ✅ | ✅ green |
| 08-02-01 | 02 | 2 | NOTE-04 | T-08-09 | Notes list in UI dynamically filtered by active vault ID on switch | unit | `node scripts/validate_phase_8.js` | ✅ | ✅ green |
| 08-02-02 | 02 | 2 | NOTE-04 | T-08-06 / 08 | Vault management actions (create modal, rename modal, delete confirmation) | unit | `node scripts/validate_phase_8.js` | ✅ | ✅ green |
| 08-02-03 | 02 | 2 | NOTE-04 | T-08-03 / 05 | Import files picker with extension filtering and copy-to-vault sandbox copy | unit | `node scripts/validate_phase_8.js` | ✅ | ✅ green |
| 08-02-04 | 02 | 2 | NOTE-04 | — | Sidebar active vault display rendered in a beautiful, frosted `LiquidGlassCard` | unit | `node scripts/validate_phase_8.js` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vault lifecycle test | NOTE-04 | AsyncStorage persistence & full React Native render loop | 1. Open app.<br>2. Expand "VAULTS" in sidebar.<br>3. Create a vault called "Test Vault".<br>4. Switch to it.<br>5. Create a note.<br>6. Verify note appears only in "Test Vault".<br>7. Rename vault to "Obsidian".<br>8. Switch back to "My Vault".<br>9. Delete "Obsidian" vault.<br>10. Verify notes in "My Vault" are unaffected. |
| Import .md Files | NOTE-04 | System document picker interaction | 1. Tap "Import .md Files" in vaults sidebar.<br>2. Select multiple `.md` or `.txt` files from local device.<br>3. Verify new "Imported" vault is created and auto-selected.<br>4. Verify imported notes appear in the folder list immediately. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 5s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-31

---

## Validation Audit 2026-05-31
| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 1 |
| Escalated | 0 |
