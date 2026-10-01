---
status: testing
phase: 20-repository-governance-behavioral-rulebook-architecture-foundation
source: [20-01-SUMMARY.md, 20-02-SUMMARY.md]
started: 2026-10-01T13:50:28Z
updated: 2026-10-01T13:50:28Z
---

## Current Test

number: 1
name: Rulebook tree completeness (44 documents)
expected: |
  The rulebook/ directory contains 24 documents in atomic-habits/, 5 in ai/, 8 in rules/, 7 in examples/ (44 total), plus README.md, manifest.json, and CHANGELOG.md at the rulebook root.
awaiting: user response

## Tests

### 1. Rulebook tree completeness (44 documents)
expected: rulebook/ has 24 atomic-habits docs, 5 ai docs, 8 rules docs, 7 examples docs (44 total), plus README.md, manifest.json, CHANGELOG.md at root.
result: [pending]

### 2. Rulebook README governance contract
expected: rulebook/README.md defines the 5 architectural invariants, policy precedence hierarchy, compliance verification matrix, and names Phase 22 as the enforcement gate for existing schedulers.
result: [pending]

### 3. Manifest registry and changelog
expected: rulebook/manifest.json indexes all 44 documents (IDs, paths, sections, source tags, review dates) and rulebook/CHANGELOG.md tracks governance versioning.
result: [pending]

### 4. Deterministic policy spot-check
expected: overload rule states concrete anti-burnout triggers, check-in engine uses a finite 5-question bank (no open-ended prompting), and reminders rule states quiet hours 22:00-08:00 with max 3 notifications/day and 90-min gap.
result: [pending]

### 5. TypeScript foundation gate
expected: tsconfig.json preserves extends expo/tsconfig.base with strict true and noEmit true, package.json has a typecheck script, and `npm run typecheck` exits with 0 errors.
result: [pending]

### 6. CI runs the typecheck gate
expected: .github/workflows/ci.yml runs the TypeScript check between lint and test so PRs are protected, not just local runs.
result: [pending]

### 7. Domain type contracts and boundaries
expected: src/behavior/types.ts (Identity, Habit, Cue, HabitStack, Intervention, BehaviorEvent, FactualReward), src/commands/types.ts (CommandAction + concrete payloads), src/services/types.ts (notification policy + defaults), and src/domains/README.md (isolation boundaries) all exist.
result: [pending]

### 8. Logger migration and suite green
expected: src/utils/vaultImport.js, billingStorage.js, and notifications.js use logger instead of raw console (vault paths logged as file counts, no PII), `npm run lint` exits with 0 errors, and `npm test` passes all suites.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps

[none yet]
