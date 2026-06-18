---
phase: 11
slug: encrypted-data-export-import
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-18
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — export/import pipeline relies on native platform APIs (expo-sharing, expo-file-system, expo-document-picker) |
| **Config file** | N/A |
| **Quick run command** | `npm run lint` (verify syntax sanity and style compliance) |
| **Full suite command** | `npm run lint` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint` to verify that there are zero ESLint errors.
- **After every plan wave:** Check that the newly added export/import methods and settings elements compile properly.
- **Before final sign-off:** Confirm export/import UI components and passphrase validation checks exist and meet the design specifications.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | EXPORT-01 | N/A | N/A | config | `node -e "const p = require('./package.json'); console.assert(p.dependencies['crypto-js'], 'crypto-js not found'); console.log('✓ crypto-js installed')"` | ✅ exists | ✅ green |
| 11-01-02 | 01 | 1 | EXPORT-01 | N/A | N/A | build | `grep -q "encryptBackup" src/utils/exportService.js` | ✅ exists | ✅ green |
| 11-01-03 | 01 | 1 | EXPORT-01 | T-11-01 | Passphrases must match and not be empty before initiating export. Temporary archive file must be deleted in the finally block. | build | `grep -q "deleteAsync" src/utils/exportService.js` | ✅ exists | ✅ green |
| 11-02-01 | 02 | 2 | EXPORT-01 | T-11-02 | Archive decryption must throw standardized authentication error on incorrect passphrase. | build | `grep -q "decryptBackup" src/utils/exportService.js` | ✅ exists | ✅ green |
| 11-02-02 | 02 | 2 | EXPORT-01 | T-11-03 | Settings Screen handles document selection, displays appropriate progress states, and securely updates UI states. | build | `grep -q "handleImportConfirm" src/screens/SettingsScreen.js` | ✅ exists | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Data Export Native share sheet triggers correctly | EXPORT-01 | Invokes native `expo-sharing` share sheet dialogue | 1. Navigate to Settings Screen. 2. Tap "EXPORT ENCRYPTED". 3. Enter and confirm a secure passphrase. 4. Tap "CONFIRM". 5. Verify that the native iOS/Android sharing sheet overlays correctly. |
| Data Import file picker launches successfully | EXPORT-01 | Native file manager modal | 1. Navigate to Settings Screen. 2. Tap "RESTORE BACKUP". 3. Verify that the system document picker displays to choose a `.kwestup` file. |
| Passphrase modal validation errors show inline | EXPORT-01 | Dynamic modal error states | 1. In the Export Modal, input mismatching passphrases. Verify "PASSPHRASES DO NOT MATCH" displays inline. 2. In the Import Modal, input an incorrect passphrase for a backup file. Verify "INVALID PASSPHRASE OR CORRUPTED ARCHIVE" shows inline without closing the modal. |
| Full data restoration wipes old data and restores vaults/preferences | EXPORT-01 | End-to-end data integrity | 1. Export workspace state with a passphrase. 2. Change your user name and add a new note. 3. Select "RESTORE BACKUP", select the export file, and input the passphrase. 4. Accept the warning dialog. 5. Confirm that the workspace returns to the exported state (restored user name, original notes, and original settings). |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-18
