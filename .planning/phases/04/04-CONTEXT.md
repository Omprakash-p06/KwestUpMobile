# Phase 4: Local Network Sync via QR Scanner - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning
**Source:** Autonomous Technical Research Phase (/gsd-research-phase)

---

## Phase Boundary

This phase implements a secure, local-first synchronization pipeline over Wi-Fi, allowing the mobile application to merge notes, tasks, task lists, and birthdays with the PC desktop application. It delivers:
- Native QR code camera scanner integration (`expo-camera` via `CameraView`).
- Fallback "Manual Connection" modal for environments without a functional physical camera (e.g. emulators/simulators).
- Local HTTP REST sync client utilizing browser-native `fetch()` to POST client data and retrieve merged datasets.
- Client-side data overwrite and sync execution engine updating `AsyncStorage` and filesystem note files dynamically.
- Desktop reference synchronization server (`sync_server.py`) built in Python (Flask) implementing dynamic local IP routing, security token generation, and timestamp-based conflict merges.

---

## Implementation Decisions

### 1. Connection Discovery
- **Decision**: **QR Scanning with Manual Fallback**.
- **Description**: The mobile application opens the camera to scan a QR code displayed by the PC server to retrieve the host's local IP address, port, and authentication token. To ensure seamless developer and testing access (and support for emulators), a manual setup dialog is accessible via a button on the scanner overlay where developers can type connection details directly.

### 2. Synchronization Strategy
- **Decision**: **LWW Timestamp Merge (Last-Write-Wins)**.
- **Description**: A server-side LWW merge coordinates conflicts. Every task, task list, birthday, and note must contain a tracking timestamp (`updatedAt`). When syncing, datasets from mobile and PC are pooled, sorted by ID, and duplicate conflicts are resolved by preserving the record with the most recent timestamp. Missing records are automatically synchronized bidirectionally.

### 3. File Sync Pipeline
- **Decision**: **JSON Array Exchange**.
- **Description**: Notes on mobile are stored as individual `.md` files on the filesystem. To optimize sync bandwidth and security, notes are read locally by the client, transformed into self-contained JSON note objects, and transmitted as a structured array alongside tasks and birthdays in a single POST payload. Upon return, the client writes returned files back to their respective subfolders in the `Notes/` vault.

### 4. Authentication and Security
- **Decision**: **Ephemeral Bearer Token**.
- **Description**: The reference Python server generates a strong random security token at startup (e.g. `kwestup_sec_<hex>`). This token is embedded in the connection QR code and must be passed in the `Authorization: Bearer <token>` header of the REST request. Any unauthenticated requests receive an immediate `401 Unauthorized` or `403 Forbidden` response.

---

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `App.js` — Core state, AsyncStorage persistence, and global reset handlers.
- `src/utils/fileStorage.js` — Native filesystem CRUD operations for notes.
- `src/screens/SettingsScreen.js` — Screen to trigger the synchronization view.
- `.planning/phases/04/04-RESEARCH.md` — Detailed technical findings and code blueprints.
- `.planning/REQUIREMENTS.md` — Scoped synchronization requirements (SYNC-01, SYNC-02).

---

## Specific Ideas
- **Visual Sync Status**: Design a premium glassmorphic overlay for the settings screen displaying "Last Synced: Date Time" or "Not Synced" with a modern status indicator (green/amber dot).
- **Haptic Alerts on Completion**: Trigger a success notification haptic alert (`expo-haptics`) once synchronization completes, accompanied by a dynamic progress loader.
- **Merge Diagnostics**: The reference Python server prints detailed debug traces in the terminal detailing the number of notes/tasks synced, modified, or merged during every synchronization operation.

---

## Deferred Ideas
- **Continuous Background Auto-Sync**: The initial version focuses on user-triggered synchronization via settings. Real-time background sync or Bonjour/mDNS autodiscovery are deferred to future milestones.
- **Note Content Line Diffs**: Granular line-by-line diffing is deferred; notes are replaced entirely based on the latest `updatedAt` metadata.
