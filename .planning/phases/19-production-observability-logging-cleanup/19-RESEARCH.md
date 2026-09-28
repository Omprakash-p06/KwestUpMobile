# Phase 19 Research: Production Observability & Logging Cleanup

**Phase:** 19 of 19 (Milestone 2 Final Phase)  
**Requirements Addressed:** `OBS-01`, `OBS-02`  
**Domain:** React Native Logging, Babel AST Transforms, React Error Boundaries, On-Device Crash Diagnostics  
**Date:** 2026-09-28  

---

## 1. Executive Summary

Phase 19 hardens KwestUp Mobile for production release by eliminating runtime log pollution and providing resilient crash boundaries:
1. **`OBS-01` (Log Stripping):** Strip over 100 verbose emoji-prefixed `console.log` statements in production builds while preserving critical `console.error` and `console.warn` diagnostics. We achieve this via a dual-layer approach:
   - **Build-Time AST Stripping:** `babel-plugin-transform-remove-console` activated during production bundle compilation (`process.env.NODE_ENV === 'production'`), stripping `console.log/info/debug` with `{ exclude: ['error', 'warn'] }`.
   - **Runtime Structured Logger:** A zero-dependency environment-aware logger (`src/utils/logger.js`) that captures structured diagnostics into an in-memory circular ring-buffer (last 50 events) so crash forensics are available even when console output is silenced.
2. **`OBS-02` (Crash Boundaries & Diagnostics):** A top-level React `ErrorBoundary` component (`src/components/ErrorBoundary.js`) wrapping the application tree in `App.js`. Catches unexpected component render crashes, logs breadcrumbs, and displays a themed recovery UI with options to retry, inspect sanitized error diagnostics, or copy a forensic crash report without risk of user data corruption.

---

## 2. Codebase Investigation: Existing Log Surface

A grep search across the codebase reveals **151 total `console.*` calls**:
- `console.log`: 69 calls (lifecycle markers, migration steps, debug confirmations)
- `console.error`: 59 calls (caught exceptions in storage, backup, sync, AI)
- `console.warn`: 23 calls (deprecation notices, checksum warnings, non-fatal fallbacks)

### Key Call Locations
- `src/utils/storage.js`: Cache clear progress, migration status
- `src/utils/exportService.js`: Backup progress, decryption failures
- `src/utils/syncService.js`: LAN sync handshake, connection status
- `src/utils/aiService.js`: Model verification status, fallback warnings
- `src/utils/vaultService.js`: Vault creation and directory scan logs
- `src/utils/fileStorage.js`: File read/write operations
- `src/context/*.js`: Provider initialization and storage synchronization
- `App.js`: Boot orchestration, throttled persistence, widget sync

### Analysis
`console.error` and `console.warn` contain critical operational diagnostics and must **never** be stripped, as they aid in field troubleshooting. `console.log`, however, creates logcat noise on Android, leaks internal state names to device logs, and consumes CPU cycles during high-frequency persistence.

---

## 3. Technical Strategy

### 3.1. Build-Time Log Stripping (`babel.config.js`)
Install `babel-plugin-transform-remove-console` as a devDependency. In `babel.config.js`:
```javascript
module.exports = function (api) {
  api.cache(true);
  const plugins = [];
  if (process.env.NODE_ENV === "production") {
    plugins.push(["transform-remove-console", { exclude: ["error", "warn"] }]);
  }
  plugins.push("react-native-reanimated/plugin");
  return {
    presets: ["babel-preset-expo"],
    plugins,
  };
};
```
- In development and test runs (`NODE_ENV !== 'production'`), logs flow normally.
- In EAS/release bundle builds, Babel transforms all `console.log(...)` and `console.info(...)` into empty statements, eliminating logcat output and string allocations.

### 3.2. Runtime Structured Logger (`src/utils/logger.js`)
To provide observability without console pollution:
- **API:**
  - `logger.debug(...args)`: Emits only in `__DEV__`; records in ring-buffer.
  - `logger.info(...args)`: Emits only in `__DEV__`; records in ring-buffer.
  - `logger.warn(...args)`: Always emits to `console.warn`; records in ring-buffer.
  - `logger.error(...args)`: Always emits to `console.error`; records in ring-buffer.
  - `logger.getRecentLogs()`: Returns array of `{ timestamp, level, message }` from the in-memory ring-buffer (max 50 entries).
  - `logger.clearLogs()`: Resets buffer.
- **Ring-Buffer Design:** Fixed array capacity using FIFO eviction. Does not write to disk, ensuring zero I/O overhead.

### 3.3. Root Error Boundary Component (`src/components/ErrorBoundary.js`)
- Standard React class component implementing `static getDerivedStateFromError(error)` and `componentDidCatch(error, errorInfo)`.
- **Error Capture:**
  - Invokes `logger.error("Unhandled React Error:", error.message, errorInfo.componentStack)`.
  - Captures error stack trace and component hierarchy.
- **Recovery UI:**
  - Styled with KwestUp LiquidGlass themes (`src/theme/styles.js`).
  - Clear, non-technical explanation: *"KwestUp encountered an unexpected issue. Your notes and data remain safe on your device."*
  - **Action 1 ("Try Again"):** Resets error state `this.setState({ hasError: false, error: null })` to re-attempt rendering.
  - **Action 2 ("Copy Error Report"):** Formats device metadata (Platform, Version, App Version) + error stack + recent log breadcrumbs for easy reporting.
- **Mount Point:** Wrap the root UI container in `App.js` around the inner navigation tree so that catastrophic render failures are contained gracefully.

---

## 4. Test & Verification Plan

1. **Logger Unit Tests (`__tests__/unit/logger.test.js`):**
   - Verify `logger.debug` and `logger.info` behavior in dev vs prod modes.
   - Verify `logger.warn` and `logger.error` always invoke native console methods.
   - Verify circular ring-buffer caps at max entries (e.g. 50) and evicts oldest items.
   - Verify `logger.getRecentLogs()` returns correctly formatted objects with timestamps.
2. **ErrorBoundary Unit Tests (`__tests__/unit/errorBoundary.test.js`):**
   - Render a child component that throws an error.
   - Verify ErrorBoundary catches the error and displays the recovery UI.
   - Verify "Try Again" resets state and re-renders successfully once the child error is resolved.
   - Verify error details are recorded via `logger.error`.
3. **Full System Verification:**
   - Run all 12 test suites (`npm test`).
   - Run `npm run lint` (0 errors).
