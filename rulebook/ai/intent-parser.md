---
id: intent-parser
title: AI Intent Parser Policy
section: ai
source: product-decision
review_date: 2026-10-01
---

# AI Intent Parser Policy

## Purpose & Scope
The Intent Parser is the on-device AI translation layer (Phase 27). It converts unstructured natural language user utterances into typed, validated command parameters (`CommandAction`).

## Architecture & Responsibilities
- **Input:** Raw user text string (e.g., "Remind me to study DSA every evening after dinner").
- **Output:** Structured JSON adhering to `CommandPayload<A>`:
  ```json
  {
    "action": "CREATE_HABIT",
    "params": {
      "title": "Study DSA",
      "behavior": "Review DSA concepts and code problems",
      "minimumAction": "Open 1 problem on laptop",
      "normalTarget": "30 minutes of problem solving",
      "cueType": "after-habit",
      "cueTime": "20:00"
    }
  }
  ```
- **Execution Boundary:** The AI parser is strictly a translator. It possesses **zero execution authority**.
  - It CANNOT write to AsyncStorage or filesystem vaults.
  - It CANNOT schedule Android system notifications.
  - It CANNOT mutate widget state.
  - All parsed outputs are piped to `src/commands/commandValidator.ts` and `commandExecutor.ts` for deterministic validation before any system state changes.

## Privacy Boundary
- **Zero Cloud Egress:** All inference runs 100% on-device via local GGML weights (`llama.rn`).
- **Log Sanitation:** User input strings and parsed intent parameters must never appear in `logger.js` breadcrumb details.
- No network requests are initiated during or after parsing.
