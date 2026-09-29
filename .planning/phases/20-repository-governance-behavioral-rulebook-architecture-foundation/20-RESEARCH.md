# Phase 20 Research: Repository Governance, Behavioral Rulebook & Architecture Foundation

**Phase:** 20 of 28 (Milestone 3: KwestUp 4.0 Initial Foundation)  
**Requirements Addressed:** `GOV-01`, `GOV-02`  
**Domain:** Behavioral Architecture, Atomic Habits Governance, TypeScript Incremental Foundation, Codebase Map Alignment  
**Date:** 2026-09-29  

---

## 1. Executive Summary

Phase 20 establishes the foundational behavioral governance, architectural contracts, directory hierarchy, and developer tooling for **KwestUp 4.0: The Atomic Behavior Engine**.

The core objective is to translate the high-level specifications in [4.0/KwestUp_4.0_Master_Plan.md](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/4.0/KwestUp_4.0_Master_Plan.md) into concrete, deterministic code and markdown contracts while respecting the realities of our active codebase map in [.planning/codebase/](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/.planning/codebase/).

This phase focuses on two non-negotiable requirements:
1. **`GOV-01` (Behavioral Rulebook):** Establish the complete `rulebook/` directory tree specifying the behavioral philosophy of *Atomic Habits* (4 laws, inversions, identity-based habits, two-minute minimum action, habit stacking, never miss twice, review cycles), AI interaction policies, behavioral decision rules, and domain examples.
2. **`GOV-02` (Architecture Foundation & TypeScript Scaffolding):** Scaffold the target directory structure (`src/behavior/`, `src/commands/`, `src/services/`, `src/domains/`), configure incremental TypeScript compilation (`tsconfig.json`, `npm run typecheck`), establish authoritative TypeScript domain models (`src/behavior/types.ts`), and resolve residual codebase concerns (migrating leftover raw `console.*` calls to `logger.js`).

---

## 2. Master Plan 4.0 vs Current Codebase Map: Comprehensive Gap Analysis

| Architectural Dimension | Current Codebase Map (v3.5.0) | Master Plan 4.0 Requirement | Phase 20 Resolution Strategy |
|---|---|---|---|
| **Composition Root** | `App.js` (~1067 lines) bootstraps theme, fonts, providers, timer, telemetry, updates, and sync. | `App.js` is bootstrap only; business logic and behavioral scheduling are moved to domain engines. | Prepare modular scaffolding in `src/behavior/` and `src/services/` so subsequent phases can cleanly decouple `App.js`. |
| **Domain State & Persistence** | Providers (`TaskContext`, `VaultContext`, `BillingContext`, `BirthdayContext`) wrap AsyncStorage blobs (`kwestup_*_v7.0`). | Dedicated domain stores with versioned keys (`kwestup_habits_v1`, `kwestup_behavior_events_v1`). | Define strict type schemas for habits and events in `src/behavior/types.ts`. Existing task/vault/billing keys remain untouched. |
| **Task Mutations** | Pure, framework-agnostic `src/utils/taskMutations.js` shared between app and headless widgets. | Behavioral habit mutations, minimum actions, and recovery states layered on top of task execution. | Maintain `taskMutations.js` intact; build `src/behavior/habitEngine.ts` and types to interface with tasks via domain events. |
| **Date & Calendar Logic** | Centralized `src/utils/dateUtils.js` enforces device-local calendar dates and strict parsing. | Rule #12: "Never use UTC slicing for local calendar dates; use `dateUtils`." | Enforce `dateUtils.js` as the sole date calculation dependency for all new behavior engines. |
| **Notifications** | Distributed across `notifications.js` (tasks, birthdays) and `billingNotifications.js` (bills); raw console calls exist. | Consolidated `src/services/notificationService.ts` with explicit Android channels, priorities, and hard policy gates. | Scaffold `src/services/types.ts` defining notification interfaces and behavioral policy limits in Phase 20. |
| **Observability & Logging** | `src/utils/logger.js` with PII redaction and 50-entry circular ring buffer; `ErrorBoundary.js` at root. | Rule #11: "No raw `console.*` in product code; use the logger." Residual raw calls noted in `CONCERNS.md`. | Migrate residual raw `console.*` calls in `src/utils/vaultImport.js`, `billingStorage.js`, and `notifications.js` to `logger.js`. |
| **Type System** | JavaScript (`.js`) throughout `src/`; TypeScript (`.tsx`) isolated to `widgets/`. No root `tsconfig.json`. | Section 17: "New behavior/command/AI code is TypeScript first. Progressive `tsc --noEmit` in CI." | Create root `tsconfig.json` configured for incremental typing (`allowJs: true`, `strict: true` for new folders), add `"typecheck": "tsc --noEmit"`. |
| **AI Integration** | `src/utils/aiService.js` runs on-device Qwen2.5-0.5B GGUF via `llama.rn` with heuristic fallbacks. | AI acts solely as interpreter and compiler; never writes storage or calls OS APIs directly. | Define command interfaces in `src/commands/types.ts` enforcing sandbox boundaries before wiring AI compiler. |

---

## 3. Behavioral Rulebook Architecture (`rulebook/`)

The rulebook defines the behavioral policy and psychological principles governing KwestUp. As specified in Section 4 of the Master Plan, it is structured into four distinct directories:

```text
rulebook/
├── README.md
├── atomic-habits/
│   ├── identity.md
│   ├── habit-loop.md
│   ├── law-1-obvious.md
│   ├── law-2-attractive.md
│   ├── law-3-easy.md
│   ├── law-4-satisfying.md
│   ├── inversion-invisible.md
│   ├── inversion-unattractive.md
│   ├── inversion-difficult.md
│   ├── inversion-unsatisfying.md
│   ├── implementation-intentions.md
│   ├── habit-stacking.md
│   ├── environment-design.md
│   ├── temptation-bundling.md
│   ├── two-minute-rule.md
│   ├── friction.md
│   ├── habit-tracking.md
│   ├── never-miss-twice.md
│   ├── accountability.md
│   ├── commitment-devices.md
│   ├── plateau.md
│   ├── goldilocks-zone.md
│   ├── deliberate-practice.md
│   └── review-system.md
├── ai/
│   ├── intent-parser.md
│   ├── habit-compiler.md
│   ├── intervention-planner.md
│   ├── check-in-engine.md
│   └── adaptation-engine.md
├── rules/
│   ├── habit-creation.md
│   ├── habit-modification.md
│   ├── missed-habit.md
│   ├── rewards.md
│   ├── reminders.md
│   ├── widgets.md
│   ├── overload.md
│   └── privacy.md
└── examples/
    ├── study.md
    ├── exercise.md
    ├── reading.md
    ├── sleep.md
    ├── phone-use.md
    ├── work.md
    └── personal-projects.md
```

### Purpose of Each Section:
- **`atomic-habits/`**: Direct translation of behavioral science principles into actionable product criteria. Defines minimum viable action, cue construction, habit stacking formulas, friction taxonomy, and the "never miss twice" recovery mechanism.
- **`ai/`**: Concrete behavioral prompting guidelines and operational constraints for the on-device LLM. Dictates what the AI can suggest, how it extracts intents, and how it must honor user agency.
- **`rules/`**: Deterministic business rules enforced by code (e.g. max 3 new habits per month, notification quiet hours, cooling-off periods, zero dark patterns, strict local privacy).
- **`examples/`**: Canonical real-world user workflows mapping intentions to identities, cues, minimum actions, normal targets, and recovery strategies.

---

## 4. TypeScript Foundation Strategy

To support gradual adoption without breaking existing legacy JavaScript screens:
1. **`tsconfig.json` Configuration**:
   - `target`: `"es2020"`
   - `module`: `"commonjs"` / `"esnext"`
   - `jsx`: `"react-native"`
   - `allowJs`: `true` (allows existing JS files to co-exist without type check failures)
   - `checkJs`: `false` (does not attempt to type-check legacy JS screens that lack types)
   - `strict`: `true` (enforces strict null checks, no implicit any, and strict property initialization on all `.ts` and `.tsx` files)
   - `noEmit`: `true` (Babel handles bundling; TypeScript handles static validation)
   - `include`: `["src/**/*", "widgets/**/*"]`
   - `exclude`: `["node_modules", "babel.config.js", "metro.config.js", "jest.config.js"]`

2. **Package Script**:
   - Add `"typecheck": "tsc --noEmit"` to `package.json`.
   - Update CI pipeline (`.github/workflows/ci.yml`) in subsequent step to include `npm run typecheck`.

---

## 5. Domain Models & Core Interfaces (`src/behavior/types.ts`)

The TypeScript interfaces directly encode the entities specified in Master Plan Section 5:
- **`Identity`**: Core user aspiration (`id`, `statement`, `createdAt`, `updatedAt`).
- **`Habit`**: Behavioral unit (`id`, `identityId`, `title`, `behavior`, `frequency`, `status`, `minimumAction`, `normalTarget`, `stretchTarget`, `streakCount`, `bestStreak`, `createdAt`, `updatedAt`).
- **`Cue`**: Trigger mechanism (`id`, `habitId`, `type`, `time`, `location`, `triggerEvent`, `anchorHabitId`, `conditions`).
- **`HabitStack`**: Relational pairing (`anchorHabitId`, `targetHabitId`, `relationship`).
- **`Intervention`**: Scheduled touchpoint (`id`, `habitId`, `type`, `surface`, `priority`, `scheduledFor`, `expiresAt`, `action`, `reason`, `status`).
- **`BehaviorEvent`**: Immutable event record (`id`, `type`, `entityId`, `timestamp`, `metadata`, `source`).
- **`FrictionDiagnosis`**: Identified barrier (`category`, `observedDelayMinutes`, `recommendedAction`).

---

## 6. Codebase Map Alignment & Technical Debt Resolution

In [.planning/codebase/CONCERNS.md](file:///c:/Users/OM%20Prakash/Documents/KwestUpMobile/.planning/codebase/CONCERNS.md), Tech Debt item #3 identified raw `console.*` statements bypassing `logger.js`:
- `src/utils/vaultImport.js`: 6 raw calls logging filenames and paths.
- `src/utils/billingStorage.js`: 2 raw `console.error` calls.
- `src/utils/notifications.js`: 6 raw `console.error` calls.

Phase 20 will migrate these calls to `logger.error` and `logger.warn` with appropriate PII-safe detail objects. This fulfills the codebase map contract and completes the logging cleanup before new behavioral code is introduced.
