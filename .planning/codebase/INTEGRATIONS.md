# External Integrations

**Analysis Date:** 2025-05-17

## APIs & External Services

**Diagnostics:**
- httpbin.org - Used for network connectivity diagnostics in `App.js` (line 132).
  - Client: `fetch`
  - Purpose: Verifies if the device has internet access.

**Code Repository:**
- GitHub - Linked in the application settings/about section.
  - URL: `https://github.com/Omprakash-p06/KwestUpMobile`

## Data Storage

**Databases:**
- Local Storage Only
  - Client: `@react-native-async-storage/async-storage`
  - Implementation: Primary data persistence for tasks, medical data, and user preferences.
  - Key Patterns: Keys prefixed with `kwestup_`, `medical_`, `clean_`.

**File Storage:**
- Local filesystem only via React Native/Expo assets.

**Caching:**
- Custom cache clearing system implemented in `App.js` using `AsyncStorage.multiRemove()`.

## Authentication & Identity

**Auth Provider:**
- None (Offline/Local only)
  - The application currently lacks an external authentication system. All data is tied to the local device.

## Monitoring & Observability

**Error Tracking:**
- None (Console logging used for diagnostics).

**Logs:**
- Console logging via `console.log` and `console.error`.

## CI/CD & Deployment

**Hosting:**
- Mobile Platforms (Android/iOS) via Expo/EAS.

**CI Pipeline:**
- EAS (Expo Application Services)
  - Project ID: `9b029b06-5b07-4a1d-9999-a543a3ef1614` (found in `app.json`)

## Environment Configuration

**Required env vars:**
- None detected. The application relies on hardcoded constants in `App.js`.

**Secrets location:**
- Not detected. No secret management detected in the current codebase.

## Webhooks & Callbacks

**Incoming:**
- None.

**Outgoing:**
- None.

---

*Integration audit: 2025-05-17*
