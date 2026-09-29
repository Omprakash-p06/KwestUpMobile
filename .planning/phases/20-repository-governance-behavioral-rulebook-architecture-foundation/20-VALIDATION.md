# Phase 20 Validation: Repository Governance, Behavioral Rulebook & Architecture Foundation

**Phase:** 20 of 28 (Milestone 3: KwestUp 4.0 Initial Foundation)  
**Status:** In Planning  
**Validation Suites:** `npm run typecheck`, `npm run lint`, `npm test`  

---

## 1. Automated Validation Gates

### Test Execution
```bash
npm run typecheck
npm run lint
npm test
```

### Gate Criteria
- TypeScript static check (`npm run typecheck`) compiles cleanly with 0 type errors across `src/` and `widgets/`.
- ESLint (`npm run lint`) reports 0 errors.
- Jest unit test suite (`npm test`) passes 100% (all 13 test suites, 179+ tests).
- All 44 rulebook markdown files exist in `rulebook/` and pass content/link validation.

---

## 2. Test Cases & Verification Matrix

| Test Case | Component / File | Expected Behavior |
|---|---|---|
| **TC-GOV-01** | `rulebook/` directory tree | All 44 rulebook documents exist across `atomic-habits/` (24), `ai/` (5), `rules/` (8), and `examples/` (7). |
| **TC-GOV-02** | `rulebook/README.md` | Provides index linking to all behavioral laws, rules, AI policies, and examples. |
| **TC-GOV-03** | `tsconfig.json` | Valid TypeScript configuration targeting ES2020, strict type-checking on typed modules, `allowJs: true`, and `noEmit: true`. |
| **TC-GOV-04** | `src/behavior/types.ts` | Strict TypeScript interface definitions for `Identity`, `Habit`, `Cue`, `HabitStack`, `Intervention`, `BehaviorEvent`, `Reward`, `FrictionDiagnosis`. |
| **TC-GOV-05** | `src/commands/types.ts` | Command action union, command payload interfaces, and execution result contracts. |
| **TC-GOV-06** | `src/services/types.ts` | Interface contracts for notification dispatch, channel descriptors, and behavioral policy parameters. |
| **TC-GOV-07** | `npm run typecheck` | Script executes `tsc --noEmit` and validates types with zero compilation errors. |
| **TC-GOV-08** | Codebase Map Alignment | Residual raw `console.*` calls in `src/utils/vaultImport.js`, `billingStorage.js`, and `notifications.js` replaced with structured `logger.js` calls. |
| **TC-GOV-09** | Full Test Regression | All existing Jest tests (13 test suites, 179+ tests) continue passing with zero regressions. |

---

## 3. Failure Mode & Boundary Considerations

1. **Incremental Typing Safety:** Adding `tsconfig.json` must not cause TypeScript to choke on untyped legacy screens (e.g. `NotesScreen.js`). The configuration uses `allowJs: true` and `checkJs: false` so that only `.ts` and `.tsx` files are strictly verified.
2. **Deterministic Governance:** The rulebook markdown documents are not passive notes; they serve as explicit behavioral specifications for upcoming code implementation in Phases 22–28.
3. **No Premature Runtime Execution:** Phase 20 establishes contracts and scaffolding; it does not replace the active task, billing, or vault storage models, avoiding any runtime disruption to the v3.5.0 baseline.
