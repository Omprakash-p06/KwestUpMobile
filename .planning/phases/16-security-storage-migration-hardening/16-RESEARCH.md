# Phase 16: Security & Storage Migration Hardening - Research

**Date:** 2026-09-27  
**Target:** React Native 0.79.5 / Expo 53 / React 19 / Node 20  
**Requirements:** SEC-01, SEC-02, STORE-01  

---

## 1. Executive Summary

Phase 16 addresses three critical vulnerabilities and architectural drifts in KwestUp Mobile:
1. **Cryptographic Weakness in Backups:** `.kwestup` encrypted exports previously used a single hardcoded static salt (`4b77657374557053616c745f7632`), reused the salt directly as the AES initialization vector (IV), and executed only 1,000 PBKDF2 iterations.
2. **Untrusted LAN Sync Handshake:** Local Wi-Fi sync lacked URL/IP validation, did not enforce token presence prior to network calls, and had zero response schema validation, exposing users to note wipes if a peer returns malformed JSON.
3. **Storage Migration Drift & Cache Destruction:** Hardcoded `v5.0` vault keys failed to align with `STORAGE_VERSION = "v7.0"`, and `clearAllCaches()` inadvertently wiped user telemetry consent and resumable AI model download states because they were missing from the user data protection list.

---

## 2. Backup Cryptography Deep Dive (SEC-01)

### Vulnerability Analysis
- **Static Salt:** A fixed salt allows pre-computation of dictionary tables (rainbow tables) across all KwestUp users.
- **Salt Reused as IV:** Reusing a static salt as the AES-CBC IV means that two archives generated with the same passphrase produce identical ciphertext for identical initial blocks (violating indistinguishability under chosen-plaintext attack — CPA security).
- **1,000 PBKDF2 Iterations:** 1,000 iterations can be brute-forced on a modern GPU in fractions of a millisecond.

### Modernized Architecture (v2 Container Envelope)
- **Per-archive Random Salt:** 16 cryptographically random bytes generated via `CryptoJS.lib.WordArray.random(16)`.
- **Per-archive Random IV:** 16 cryptographically random bytes generated via `CryptoJS.lib.WordArray.random(16)`.
- **PBKDF2 Key Derivation:** 100,000 iterations with SHA-256 (`CryptoJS.algo.SHA256`).
- **Container Format:**
  ```json
  {
    "v": 2,
    "kdf": "PBKDF2",
    "hasher": "SHA256",
    "iterations": 100000,
    "salt": "<32-char hex>",
    "iv": "<32-char hex>",
    "ciphertext": "<base64>"
  }
  ```
- **Legacy Fallback Strategy:**
  When `decryptBackup` receives an archive:
  1. Attempt `JSON.parse(encryptedText)`.
  2. If the parsed object contains `v: 2` with `salt`, `iv`, and `ciphertext`, decrypt using envelope parameters.
  3. If JSON parsing fails (or envelope lacks v2 markers), treat as legacy v1 ciphertext:
     - Use static salt `"4b77657374557053616c745f7632"`
     - Use 1,000 iterations
     - Decrypt with salt as IV
  4. If decryption yields invalid UTF-8 or fails JSON parsing, throw: `"Unable to decrypt archive. Please verify the passphrase."`

---

## 3. LAN Synchronization Transport Hardening (SEC-02)

### Threat Model & Failure Mode
In `App.js`, when sync completes:
```javascript
await wipeNotesFilesystem(activeVaultId);
for (const note of result.notes || []) {
  await saveNoteFile(activeVaultId, note.folder, note.title, note.content);
}
```
If an untrusted device on the local network or a corrupted server responds with 200 OK but sends malformed data (e.g., `{ notes: null }` or `{ error: "unknown" }`), `wipeNotesFilesystem` executes and destroys all local notes.

### Hardening Specification
1. **Config Validation (`validateSyncConfig`):**
   - `ip`: Must be a valid IPv4 address (e.g. `192.168.1.5`), IPv6, or valid local hostname (`localhost`). Must reject characters like `/`, `@`, `?`, or spaces to prevent SSRF and path injection.
   - `port`: Integer between 1 and 65535.
   - `token`: Non-empty string with minimum 8 characters. Must reject empty/blank tokens before any network call.
2. **Payload Schema Validation (`validateSyncPayload`):**
   - The returned response must be a non-null object.
   - Must contain arrays for: `notes`, `tasks`, `taskLists`, and `birthdays`.
   - Each note in `notes` must be an object with valid `title` (string) and `content` (string).
   - If any validation fails, reject immediately with a descriptive error before returning to caller.

---

## 4. Storage Key Protection & Migration Unification (STORE-01)

### Key Protection in `clearAllCaches`
In `src/utils/storage.js`:
```javascript
export const isUserDataKey = (key) => {
  return (
    key.startsWith("kwestup_data_") ||
    key.startsWith("kwestup_userName_") ||
    key.startsWith("kwestup_theme_mode_") ||
    key.startsWith("kwestup_theme_name_") ||
    key.startsWith("kwestup_timer_state_") ||
    key.startsWith("kwestup_activeVault_") ||
    key.startsWith("kwestup_vaults_") ||
    key.startsWith("kwestup_billing_") ||
    key.startsWith("kwestup_widget_") ||
    key.startsWith("kwestup_telemetry_") ||
    key.startsWith("kwestup_ai_model_")
  );
};
```
Adding `kwestup_telemetry_` and `kwestup_ai_model_` guarantees that `clearAllCaches()` will never wipe:
- `kwestup_telemetry_optin`: User analytics consent choice.
- `kwestup_ai_model_download_resumable`: 400MB+ in-progress LLM download state.

### Version Key Drift Remediation
1. **`vaultService.js`:**
   - Change `const VAULTS_KEY = "kwestup_vaults_v5.0";` and `ACTIVE_KEY = "kwestup_activeVault_v5.0";` to dynamically use `STORAGE_VERSION`.
   - On initialization or load, if no data exists under `kwestup_vaults_${STORAGE_VERSION}`, scan for and migrate legacy `kwestup_vaults_v5.0` or older keys.
2. **`migrateUserDataIfNeeded(currentStorageVersion)` in `storage.js`:**
   - Target `kwestup_activeVault_${currentStorageVersion}` and `kwestup_vaults_${currentStorageVersion}` dynamically instead of hardcoding `"v5.0"`.
   - Also migrate `kwestup_billing_` keys if migrating between storage versions.

---

## 5. Test & Verification Strategy

- **`__tests__/unit/exportImportService.test.js`:**
  - Modern v2 round-trip with random salt & IV.
  - Verification that two encryptions of identical payload produce different ciphertexts.
  - Legacy v1 archive fallback decryption.
  - Corrupt envelope and incorrect passphrase rejection.
- **`__tests__/unit/syncService.test.js`:**
  - Config validation (reject invalid IP, port out of range, blank token).
  - Payload schema validation (reject non-object, missing arrays, corrupt notes).
- **`__tests__/unit/storageMigration.test.js`:**
  - `clearAllCaches` preserves telemetry opt-in and AI download state.
  - `migrateUserDataIfNeeded` migrates legacy data and vault keys to the dynamic target version.
