---
id: privacy
title: Privacy & Local-First Security Policy
section: rules
source: product-decision
review_date: 2026-10-01
---

# Privacy & Local-First Security Policy

## Core Principle
KwestUp is an absolute privacy-first, offline-first personal workspace. User behavioral habits, identity declarations, personal reflections, note vaults, and financial data belong exclusively to the user on their physical device.

## Hard Architectural Privacy Guarantees

1. **Zero Cloud Egress:**
   No habit definitions, streaks, check-in answers, reflection notes, or behavioral telemetry are ever transmitted to remote cloud servers, third-party analytics providers, or external telemetry collectors.
2. **Local AI Execution:**
   All natural-language intent parsing, habit compilation, and check-in dialogues execute locally on the device using quantized models (`llama.rn`). No prompts or user strings are sent over the internet.
3. **Local Network Sync Isolation:**
   When using LAN synchronization (`syncService.js`), data is transferred exclusively across the user's encrypted local Wi-Fi connection directly to the paired desktop client. No intermediate relay servers exist.

## Logger Redaction & Forensic Buffer Boundary

> [!CAUTION]
> **Strict Forensic Logging Constraints:**
> The in-memory forensic ring-buffer (`logger.js`) is intended solely for diagnosing unexpected application crashes. To protect user privacy, logger output must **NEVER** contain user-identifiable behavioral data or personal content:
> - **Habit titles, identity statements, and behaviors** must NEVER be logged as raw string values.
> - **Reminder times and cue labels** must NEVER appear in logger details.
> - **Vault paths and file names** must NEVER appear in logger details (use safe counts or anonymized IDs instead, e.g., `{ fileCount }`).
> - **Notification bodies and recipient names** must NEVER be logged.

### Mandatory Phase 22 Extension:
In Phase 22 (Unified Notification Service), the `logger.js` redaction filter (`SENSITIVE_KEYS`) must be explicitly extended to ensure regex coverage for behavioral keys:
```javascript
const SENSITIVE_KEYS =
  /(content|body|note|title|text|message|passphrase|token|key|secret|password|habitTitle|cueText)/i;
```
Any utility or context module passing raw behavioral text through logger calls violates this governance rule and will fail code review and static analysis.
