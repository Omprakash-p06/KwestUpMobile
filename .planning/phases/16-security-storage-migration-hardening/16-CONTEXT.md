# Phase 16: Security & Storage Migration Hardening - Context

**Gathered:** 2026-09-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Harden backup encryption security, secure local network synchronization, and eliminate storage migration version drift.
1. Upgrade `.kwestup` backup encryption to use per-archive cryptographically random salt and IV with PBKDF2 (100,000+ iterations) while preserving legacy archive decryption.
2. Secure LAN synchronization transport and token authentication, adding strict IP/port and payload schema validation to protect notes from being wiped by malformed responses.
3. Fix storage migration version key drift in `storage.js` and `vaultService.js`, and protect telemetry opt-in and AI model download state from cache clears.

</domain>

<decisions>
## Implementation Decisions

### Modernized Backup Encryption (SEC-01)
- **D-01:** Upgrade `encryptBackup` in `src/utils/exportService.js` to generate a 128-bit random salt (`CryptoJS.lib.WordArray.random(16)`) and 128-bit random IV (`CryptoJS.lib.WordArray.random(16)`) per archive.
- **D-02:** Derive encryption keys using PBKDF2-HMAC-SHA256 with 100,000 iterations.
- **D-03:** Store backups in an envelope format containing `{ v: 2, kdf: "PBKDF2", hasher: "SHA256", iterations: 100000, salt: "<hex>", iv: "<hex>", ciphertext: "<base64>" }`.
- **D-04:** `decryptBackup` detects envelope version. If v2, it uses the envelope parameters. If string is raw ciphertext (legacy v1), it falls back to the static salt (`"4b77657374557053616c745f7632"`) and 1,000 iterations.

### LAN Synchronization Security (SEC-02)
- **D-05:** Implement `validateSyncConfig(config)` validating that `ip` is a valid IPv4/IPv6/hostname, `port` is an integer in 1–65535, and `token` is non-empty with minimum length before making network requests.
- **D-06:** Implement `validateSyncPayload(data)` enforcing that incoming synchronized data contains valid arrays for `notes`, `tasks`, `taskLists`, and `birthdays` before returning to caller, preventing catastrophic notes filesystem wipes on malformed responses.
- **D-07:** Reject unauthenticated or empty tokens before calling `/sync`.

### Storage Key Protection & Migration Unification (STORE-01)
- **D-08:** Add `kwestup_telemetry_optin` and `kwestup_ai_model_` to `isUserDataKey` in `src/utils/storage.js` so `clearAllCaches` preserves user consent and resumable AI model downloads.
- **D-09:** Replace hardcoded `v5.0` vault keys in `migrateUserDataIfNeeded` with dynamic `currentStorageVersion` references, migrating active vaults and vault lists to the active version.
- **D-10:** Synchronize `vaultService.js` with `STORAGE_VERSION` from `./storage` with fallback migration from legacy `v5.0` keys.

</decisions>

<canonical_refs>
## Canonical References

### Requirements
- `SEC-01`: Modernize backup encryption with random salt/IV, PBKDF2 100k+, and legacy fallback.
- `SEC-02`: Secure LAN synchronization transport and token authentication.
- `STORE-01`: Fix storage migration version key drift and protect telemetry & AI download state.

### Codebase Audits
- `.planning/codebase/CONCERNS.md` § Security & Sensitive Data — Documents static salt, lack of per-archive IV, and sync validation gaps.
- `.planning/codebase/CONCERNS.md` § Storage Version Key Drift — Documents `v5.0` vs `v7.0` discrepancy.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CryptoJS` library (`crypto-js@^4.2.0`) already installed.
- Jest test runner and setup mocks configured in Phase 14 (`npm test`).
- Existing test suites in `__tests__/unit/exportImportService.test.js` and `__tests__/unit/syncService.test.js`.

### Target Modules
- `src/utils/exportService.js`
- `src/utils/syncService.js`
- `src/utils/storage.js`
- `src/utils/vaultService.js`

</code_context>

---

*Phase: 16-security-storage-migration-hardening*
*Context gathered: 2026-09-27*
