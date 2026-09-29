---
phase: 20
reviewers: [antigravity, codex]
reviewed_at: 2026-09-30T01:07:53+05:30
plans_reviewed:
  - 20-01-PLAN.md
  - 20-02-PLAN.md
---

# Cross-AI Plan Review — Phase 20

## Antigravity Review

> **Source access:** Full — reviewed directly against the active codebase.

### Summary

Phase 20 is well-scoped with two cleanly separated plans. Plan 20-01 (rulebook) is non-risky but critically important. Plan 20-02 (architecture foundation) has one critical issue: **the repo already has a root `tsconfig.json`** (`{"compilerOptions": {}, "extends": "expo/tsconfig.base"}`) — the plan must UPDATE it, not create it. The console-to-logger migration call counts are confirmed accurate. Type schemas are comprehensive and aligned with the 4.0 Master Plan.

---

## Plan 20-01 — Rulebook Creation & Behavioral Governance Contracts

### Strengths

- Rulebook positioned as authoritative contract for Phases 22–28 — the right architectural decision.
- 44 documents (24 Atomic Habits + 5 AI + 8 rules + 7 examples) is comprehensive coverage.
- Business rules are deterministic: quiet hours 22:00–08:00, max 3/day, min 90-min gap.
- Privacy rule explicitly: "zero telemetry on habit content, zero cloud transmission."
- Wave ordering is correct (20-01 before 20-02).

### Concerns

- **[MEDIUM] No validation mechanism**: No process defined for verifying that Phase 22–28 engine implementations satisfy the rulebook constraints.
- **[MEDIUM] `overload.md` lacks concrete thresholds**: "Anti-burnout detection" with no numeric trigger criteria — implementation will invent the policy itself.
- **[LOW] `check-in-engine.md` boundary ambiguity**: Free-text AI vs finite question bank not specified.
- **[LOW] No versioning strategy**: No change-log protocol for rule updates.

### Suggestions

- Add "Compliance Verification" section to `rulebook/README.md` mapping each rule to its test assertion.
- For `overload.md`: "≥4 active habits AND 7-day miss rate >40%."
- Define `check-in-engine.md` as ≤5 structured questions, not open-ended LLM prompting.
- Add `rulebook/CHANGELOG.md`.

### Risk Assessment: LOW

---

## Plan 20-02 — Architectural Scaffolding, TypeScript Foundation & Codebase Map Alignment

### Strengths

- Console call counts confirmed: vaultImport.js(6), billingStorage.js(2), notifications.js(6). ✅
- `typescript: "~5.8.3"` already in devDependencies — no install needed. ✅
- `allowJs: true` + `checkJs: false` + `strict: true` is the correct incremental pattern.
- `skipLibCheck: true` is essential for expo/react-native declaration compatibility.
- Domain type schema (Identity, Habit, Cue, Intervention, BehaviorEvent, etc.) is comprehensive.

### Concerns

- **[HIGH] Root `tsconfig.json` already exists**: `{"compilerOptions": {}, "extends": "expo/tsconfig.base"}` — must UPDATE, not create. Overwriting blindly breaks the expo extension.
- **[HIGH] Widget TypeScript errors block verification**: `widgets/TasksListWidget.tsx` has pre-existing type errors on `flex` style properties. Plan must fix them or temporarily exclude `widgets/` with a TODO before asserting "0 errors."
- **[HIGH] `npm run typecheck` NOT in CI**: `.github/workflows/ci.yml` only runs lint and Jest. A local-only script provides no PR protection.
- **[MEDIUM] ESLint only covers `**/*.{js,jsx}`**: New `.ts` files in `src/behavior/`, `src/commands/`, `src/services/` are not linted.
- **[MEDIUM] PII risk in vault path logging**: `logger.js` SENSITIVE_KEYS regex does not include `path`. `vaultImport.js:62` logs `{ path: destPath }` — vault path (user data) lands verbatim in forensic buffer. Use `{ fileCount }` instead.
- **[MEDIUM] `src/domains/` gets no content**: Add a `src/domains/README.md` stub.
- **[LOW] `CommandPayload<A>` needs concrete conditional types** for CREATE_HABIT, UPDATE_HABIT, LOG_HABIT.

### Suggestions

- Update (not overwrite) existing `tsconfig.json` — keep `extends: "expo/tsconfig.base"` and merge new compilerOptions.
- Run `npx tsc --noEmit` as pre-flight to capture pre-existing errors; exclude widgets/ if needed.
- Add `npm run typecheck` to `ci.yml` between lint and test.
- Use `{ fileCount: mdFiles.length }` instead of `{ path: destPath }` in vaultImport migration.
- Add `src/domains/README.md`.
- Define concrete CommandPayload mappings for the first 3 command actions.

### Risk Assessment: MEDIUM-HIGH

---

## Codex Review (gpt-5.6-terra)

> **Source access:** Full — ran against live repo with ESLint, directory inspection, and CI workflow reads.

### Plan 20-01

**Summary:** The plan establishes a useful policy layer but is documentation-heavy without an executable validation mechanism or a clear reconciliation path to current app behavior. Existing task and notification flows already make direct behavioral decisions in code.

**Strengths:**
- Separating behavioral policy from execution is well-motivated: `TaskContext` currently schedules notifications directly (TaskContext.js:193, :222). A rulebook gives later phases a single policy source.
- The rule taxonomy covers existing behavior surfaces: daily-task creation accepts arbitrary reminder times (DailyTasksScreen.js:45), notification scheduling has no quiet-hours or cap (notifications.js:40).

**Concerns:**
- **HIGH — No executable governance contract.** 44 prose docs with no schema, manifest, or automated checks. Subsequent engines have no machine-verifiable authority.
- **HIGH — Planned policies conflict with existing runtime behavior.** "Max 3 reminders/day" and quiet hours cannot be enforced by documentation alone. TaskContext.js:222 schedules immediate completion notifications; DailyTasksScreen.js:45 accepts any time. No migration/grandfathering rule specified.
- **MEDIUM — "Source-faithful" is not operationally defined.** "80% consistency over 14 days" — is this an Atomic Habits citation or a product decision?
- **MEDIUM — Privacy rules need a concrete threat boundary.** logger.js:37 redacts sensitive keys; the rulebook should preserve, not weaken, that boundary.

**Suggestions:**
- Add `rulebook/manifest.json` with document IDs, owners, normative terms, and supersession links.
- Define precedence: Android → safety/privacy → behavior policy → AI proposal → UI preference.
- Mark every numeric threshold as "product decision" or "Atomic Habits-derived" with citation and review date.
- Add counterexamples: quiet-hours crossing midnight, DST, multiple habits sharing a reminder window.

**Risk Assessment: MEDIUM-HIGH**

---

### Plan 20-02

**Summary:** Architecture and logging cleanup are directionally sound, but verification claims are inaccurate: TypeScript already exists and fails on widgets, lint has 489 warnings (not zero), and CI never runs typecheck.

**Strengths:**
- TypeScript already installed (package.json:66), expo config already extended (tsconfig.json:2), Jest already resolves .ts/.tsx.
- Logging debt is precisely scoped and confirmed: vaultImport.js(6), billingStorage.js(2), notifications.js(6).
- Routing through logger.js:125 preserves structured buffering and redaction.

**Concerns:**
- **HIGH — "`npm run typecheck` passes with 0 errors" is not achievable.** `widgets/**/*` is in `include`; `widgets/TasksListWidget.tsx:182` and :245 fail on unsupported flex style properties. Plan neither fixes nor excludes them.
- **HIGH — Adding a script does not add a CI quality gate.** ci.yml:26 never runs typecheck.
- **MEDIUM — New .ts files not linted.** eslint.config.js:11 only matches `**/*.{js,jsx}`.
- **MEDIUM — "PII-safe `{ path, error }`" is incomplete.** logger.js:37 redacts by key name not value. `{ path: destPath }` passes vault paths through to the forensic buffer (vaultImport.js:62).
- **MEDIUM — No tests prove migration preserves redaction.** logger.test.js exists but no tests added for migrated modules.
- **LOW — Wave dependency is unnecessarily serial.** 20-02 has no code dependency on 20-01.
- **LOW — "Lint passes 100%" is misleading.** 0 errors but 489 warnings.

**Suggestions:**
- Fix widget type errors or narrow `include` to new .ts files initially.
- Add `npm run typecheck` to ci.yml before Jest.
- Add TypeScript-aware ESLint configuration.
- Do not log raw vault paths or filenames — use `{ fileCount }` or safe identifiers.
- Add Jest tests for migrated modules asserting PII redaction.
- Change "lint 100%" to "lint exits with zero errors."

**Risk Assessment: HIGH**

---

## Consensus Summary

### Agreed Strengths

- Behavioral governance split is well-designed. Both reviewers agree the rulebook architecture and taxonomy are sound.
- Logging debt migration is precisely scoped with confirmed call counts. `logger.js` is the correct abstraction.
- TypeScript incremental adoption strategy (`allowJs: true` + `checkJs: false` + `strict: true`) is correct for a mixed-language RN codebase.

### Agreed Concerns

1. **[HIGH — BLOCKING] Pre-existing `tsconfig.json`**: Must UPDATE `{"compilerOptions": {}, "extends": "expo/tsconfig.base"}`, not overwrite it. (Both reviewers.)
2. **[HIGH — BLOCKING] Widget TypeScript errors block `typecheck` verification**: Fix or temporarily exclude `widgets/` before claiming "0 errors." (Both reviewers.)
3. **[HIGH] `npm run typecheck` must be wired into CI**: `ci.yml` must be updated — local-only gate provides no PR protection. (Both reviewers.)
4. **[MEDIUM] Rulebook needs an executable validation hook**: Prose alone cannot guarantee engine compliance. (Both reviewers.)
5. **[MEDIUM] Vault path PII risk in logger migration**: `{ path: destPath }` passes user data through the redaction boundary. Use `{ fileCount }` instead. (Both reviewers.)

### Divergent Views

- **Runtime policy conflict** (Codex only): Codex raised that existing notification schedulers conflict with the rulebook policies. Antigravity treats this as a Phase 22 enforcement point (not Phase 20 scope). Recommend adding a note in `rulebook/README.md`: "Phase 22 is the enforcement point for these policies; existing schedulers are grandfathered until Phase 22 consolidation."
- **Wave serialization** (Codex LOW): Plan 20-02 has no hard code dependency on 20-01. Antigravity considers the conceptual dependency (type names from rulebook concepts) sufficient justification. Acceptable either way.

---

> **Next step:** `/gsd-plan-phase 20 --reviews` to incorporate the 3 HIGH-blocking findings into revised plans before execution.
