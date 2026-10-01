# KwestUp Behavioral Rulebook & Governance Contracts

Welcome to the authoritative behavioral rulebook of **KwestUp Mobile**.

This repository section establishes the philosophical and operational foundation for KwestUp 4.0 (The Atomic Behavior Engine). It translates James Clear's *Atomic Habits* framework into explicit, deterministic constraints, guiding both on-device AI intent translation and the deterministic TypeScript state machines that enforce user habits.

---

## 1. Architectural Invariants

All software architecture, engine design, and AI prompts in KwestUp must strictly preserve five invariants:

1. **KwestUp Owns Execution and Persistent Data:**
   KwestUp is the sole system of record for habits, identities, completion logs, notes, vaults, and financial data. The application layer alone controls database writes, file storage, and operating system API calls.
2. **AI Owns Natural-Language Interpretation and Behavioral Planning:**
   The on-device Large Language Model (Qwen 2.5 0.5B via `llama.rn`) interprets unstructured natural language and proposes structured behavioral routines. The AI is an advisor and compiler, **never an executor**. It cannot directly mutate storage, schedule notifications, or bypass verification gates.
3. **Behavior Engine Owns Behavioral Policy:**
   Deterministic state machines (`habitEngine.ts`, `recoveryEngine.ts`, `cueEngine.ts`, `interventionEngine.ts`) evaluate and enforce habits, streaks, quiet hours, rate limits, and recovery interventions. The AI cannot relax or override these policies.
4. **Rulebook Defines the Behavioral Philosophy:**
   This `rulebook/` directory serves as the immutable specification contract. Every engine logic path, check-in question, and notification prompt traces back to an explicit markdown specification in this directory.
5. **Android Platform Owns Final Device and Notification Constraints:**
   The operating system determines whether background tasks run, notifications appear, alarms fire, and widgets refresh. The app must honor Android battery optimizations, Do Not Disturb, permission states, and platform-specific notification channel policies.

---

## 2. Policy Precedence

When constraints or desires conflict, decisions resolve in strict hierarchical order:

1. **Android Platform Constraints (Highest):** Battery optimization, system permissions, Do Not Disturb mode, alarm manager quotas.
2. **Safety & Privacy Constraints:** Zero cloud data transmission, zero telemetry on user habit/cue/note content, PII redaction in logging.
3. **Deterministic Behavior Policy (This Rulebook):** Daily notification caps (max 3/day), quiet hours (22:00–08:00), minimum reminder intervals (90 min), anti-burnout overload triggers.
4. **AI Behavioral Proposals:** Structured plans and habit configurations compiled from user prompts.
5. **UI Preference (Lowest):** User aesthetic toggles, view layouts, sorting filters.

---

## 3. Policy Enforcement Timeline & Grandfathering

> [!IMPORTANT]
> **Enforcement Gates & Grandfathering Protocol:**
> These rulebook policies become enforced at **Phase 22 (Notification Service)** and **Phase 24 (Habit Engine)**.
> Existing notification schedulers (`src/context/TaskContext.js`, `src/screens/DailyTasksScreen.js`, `src/utils/notifications.js`) remain grandfathered under v3.5.0 behavior until Phase 22 consolidation replaces them with the `BehavioralNotificationPolicy` contract defined in `src/services/types.ts`.

---

## 4. Rule Change Protocol

To prevent architectural drift or accidental dilution of behavioral contracts:

1. **Increment `review_date`:** Update the target document's `review_date` entry in `rulebook/manifest.json`.
2. **Document in `rulebook/CHANGELOG.md`:** Provide a detailed description of the philosophical or operational change, rationale, and author.
3. **Audit Engine Implementations:** Audit and update all TypeScript engines, command validators, and unit tests referencing the changed rule.
4. **CI Verification:** Ensure full Jest unit test suite, TypeScript compiler (`npm run typecheck`), and ESLint pass 100% cleanly.

---

## 5. Compliance Verification Matrix

Every business policy document in `rulebook/rules/` maps directly to an executable test suite responsible for asserting its invariants:

| Rulebook Specification | Target Test Suite | Key Asserted Invariants |
| :--- | :--- | :--- |
| [`rulebook/rules/habit-creation.md`](rulebook/rules/habit-creation.md) | `__tests__/unit/habitEngine.test.ts` (Phase 24) | Maximum 3 active concurrent habits; mandatory 2-minute minimum action; mandatory cue definition. |
| [`rulebook/rules/habit-modification.md`](rulebook/rules/habit-modification.md) | `__tests__/unit/habitEngine.test.ts` (Phase 24) | Requires ≥80% consistency across 14 days before difficulty upgrade can be proposed. |
| [`rulebook/rules/missed-habit.md`](rulebook/rules/missed-habit.md) | `__tests__/unit/recoveryEngine.test.ts` (Phase 24) | Single miss transitions habit to recovery state; next scheduled action automatically scaled down to 2-minute version. |
| [`rulebook/rules/rewards.md`](rulebook/rules/rewards.md) | `__tests__/unit/rewardEngine.test.ts` (Phase 24) | Rejection of arbitrary gamified XP/points; factual milestone rewards only (first completion, consistency milestones). |
| [`rulebook/rules/reminders.md`](rulebook/rules/reminders.md) | `__tests__/unit/notificationPolicy.test.ts` (Phase 22) | Quiet hours enforced (22:00–08:00 wall-clock); daily reminder cap (≤3/day); minimum gap between reminders (≥90 min). |
| [`rulebook/rules/widgets.md`](rulebook/rules/widgets.md) | `__tests__/unit/widgetEngine.test.ts` (Phase 25) | Priority hierarchy: Today Habit -> Next Action -> Don't Miss Twice Recovery action. |
| [`rulebook/rules/overload.md`](rulebook/rules/overload.md) | `__tests__/unit/overloadEngine.test.ts` (Phase 24) | Overload alert tripped if active-or-recovery load ≥3 AND 7-day miss rate >40% persisting for ≥3 consecutive days. Proposes pausing lowest-streak habit. |
| [`rulebook/rules/privacy.md`](rulebook/rules/privacy.md) | `__tests__/unit/logger.test.js` & `__tests__/unit/privacyGuard.test.ts` | Zero network telemetry; habit titles, reminder times, cue text, and vault paths strictly excluded from logger details and forensic ring-buffer. |

---

## 6. Table of Contents & Document Index

The rulebook consists of 44 authoritative markdown specifications indexed in [`rulebook/manifest.json`](rulebook/manifest.json):

### Part I: Atomic Habits Principle Specifications (`rulebook/atomic-habits/`)
- [`identity.md`](rulebook/atomic-habits/identity.md) — Identity-based habit loops and voting with actions
- [`habit-loop.md`](rulebook/atomic-habits/habit-loop.md) — The 4-stage neurological feedback loop (Cue, Craving, Response, Reward)
- [`law-1-obvious.md`](rulebook/atomic-habits/law-1-obvious.md) — 1st Law: Make it Obvious (Implementation intentions & cue saliency)
- [`law-2-attractive.md`](rulebook/atomic-habits/law-2-attractive.md) — 2nd Law: Make it Attractive (Dopamine anticipation & temptation bundling)
- [`law-3-easy.md`](rulebook/atomic-habits/law-3-easy.md) — 3rd Law: Make it Easy (Law of least effort & activation energy)
- [`law-4-satisfying.md`](rulebook/atomic-habits/law-4-satisfying.md) — 4th Law: Make it Satisfying (Immediate reinforcement & identity confirmation)
- [`inversion-invisible.md`](rulebook/atomic-habits/inversion-invisible.md) — 1st Inversion: Make it Invisible (Cue elimination)
- [`inversion-unattractive.md`](rulebook/atomic-habits/inversion-unattractive.md) — 2nd Inversion: Make it Unattractive (Downside reframing)
- [`inversion-difficult.md`](rulebook/atomic-habits/inversion-difficult.md) — 3rd Inversion: Make it Difficult (Friction addition & commitment devices)
- [`inversion-unsatisfying.md`](rulebook/atomic-habits/inversion-unsatisfying.md) — 4th Inversion: Make it Unsatisfying (Accountability & immediate cost)
- [`implementation-intentions.md`](rulebook/atomic-habits/implementation-intentions.md) — Formula: "I will [BEHAVIOR] at [TIME] in [LOCATION]"
- [`habit-stacking.md`](rulebook/atomic-habits/habit-stacking.md) — Formula: "After [CURRENT HABIT], I will [NEW HABIT]"
- [`environment-design.md`](rulebook/atomic-habits/environment-design.md) — Priming digital environments & widgets
- [`temptation-bundling.md`](rulebook/atomic-habits/temptation-bundling.md) — Pairing obligations with desires
- [`two-minute-rule.md`](rulebook/atomic-habits/two-minute-rule.md) — Scaling down to 2-minute gateway actions
- [`friction.md`](rulebook/atomic-habits/friction.md) — Friction taxonomy (effort, time, setup, mental, emotional, location)
- [`habit-tracking.md`](rulebook/atomic-habits/habit-tracking.md) — Visual evidence accumulation and tracking mechanics
- [`never-miss-twice.md`](rulebook/atomic-habits/never-miss-twice.md) — The fundamental recovery rule and state transition
- [`accountability.md`](rulebook/atomic-habits/accountability.md) — Self-consistency vs peer sync boundaries
- [`commitment-devices.md`](rulebook/atomic-habits/commitment-devices.md) — Locking in future choices today
- [`plateau.md`](rulebook/atomic-habits/plateau.md) — Plateau of Latent Potential & enduring the lag phase
- [`goldilocks-zone.md`](rulebook/atomic-habits/goldilocks-zone.md) — The 4% challenge rule and maintaining flow
- [`deliberate-practice.md`](rulebook/atomic-habits/deliberate-practice.md) — Habits + Deliberate Practice = Mastery
- [`review-system.md`](rulebook/atomic-habits/review-system.md) — Weekly review and self-reflection protocols

### Part II: AI Behavioral Interaction Policies (`rulebook/ai/`)
- [`intent-parser.md`](rulebook/ai/intent-parser.md) — Natural language intent parameter extraction
- [`habit-compiler.md`](rulebook/ai/habit-compiler.md) — Compiling intent into identity, habit, cue, minimum action, and target
- [`intervention-planner.md`](rulebook/ai/intervention-planner.md) — Touchpoint surface arbitration without nagware
- [`check-in-engine.md`](rulebook/ai/check-in-engine.md) — Finite 5-question structured check-in bank
- [`adaptation-engine.md`](rulebook/ai/adaptation-engine.md) — Evidence-based habit tuning and activation energy reduction

### Part III: Deterministic Business Rules (`rulebook/rules/`)
- [`habit-creation.md`](rulebook/rules/habit-creation.md) — Creation bounds, concurrent limits, mandatory 2-minute action
- [`habit-modification.md`](rulebook/rules/habit-modification.md) — 80% consistency over 14 days qualification rule
- [`missed-habit.md`](rulebook/rules/missed-habit.md) — Instant trigger of Never Miss Twice recovery mode
- [`rewards.md`](rulebook/rules/rewards.md) — Real-world factual rewards vs gamified XP points
- [`reminders.md`](rulebook/rules/reminders.md) — Quiet hours (22:00–08:00), daily cap (3/day), min gap (90 min)
- [`widgets.md`](rulebook/rules/widgets.md) — Home-screen widget surface display prioritization
- [`overload.md`](rulebook/rules/overload.md) — Concrete anti-burnout overload trigger criteria
- [`privacy.md`](rulebook/rules/privacy.md) — Zero telemetry & forensic redaction guarantees

### Part IV: Domain Workflow Examples (`rulebook/examples/`)
- [`study.md`](rulebook/examples/study.md) — Study DSA every evening
- [`exercise.md`](rulebook/examples/exercise.md) — Daily physical workout
- [`reading.md`](rulebook/examples/reading.md) — Consistent book reading
- [`sleep.md`](rulebook/examples/sleep.md) — Healthy sleep schedule & wind-down routine
- [`phone-use.md`](rulebook/examples/phone-use.md) — Reducing mindless evening smartphone scrolling
- [`work.md`](rulebook/examples/work.md) — Deep work and deliberate focus
- [`personal-projects.md`](rulebook/examples/personal-projects.md) — Side project building and momentum maintenance
