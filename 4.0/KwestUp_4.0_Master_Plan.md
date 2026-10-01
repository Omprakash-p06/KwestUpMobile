# KwestUp Mobile — Atomic Behavior Master Plan

**Status:** Implementation blueprint  
**Date:** 2026-09-29  
**Baseline:** KwestUp Mobile v3.5.0 / repository map dated 2026-09-28  
**Platform:** Android-first, local-first

## 1. Executive architecture

KwestUp is an **AI-assisted deterministic behavioral machine**, not an AI-controlled operating system.

The core principle: **The backend/application enforces the rulebook**. A ~400 MB quantized on-device Qwen model cannot and should not be expected to memorize, reason over, or reliably apply the entire *Atomic Habits* rulebook on every interaction. Instead, think of the model as a **planner operating inside a deterministic behavioral machine**.

### The Architectural Split:

```text
                 USER
                   │
                   ▼
          Small Qwen Model
                   │
          "What does user want?"
                   │
                   ▼
          Intent Extraction
                   │
                   ▼
        ┌─────────────────────┐
        │ KwestUp Rule Engine  │
        │                     │
        │ Atomic Habits rules │
        │ Safety rules        │
        │ Notification rules  │
        │ Reward rules        │
        │ User preferences    │
        └──────────┬──────────┘
                   │
             deterministic
               decision
                   │
                   ▼
          Command Generator
                   │
                   ▼
          KwestUp Executor
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
      Task       Widget    Notification
```

The AI does not decide:
> *"According to Law 3, I think I should make this habit easier."*

It provides the **facts and semantic context**:
```json
{
  "intent": "create_habit",
  "behavior": "study DSA",
  "frequency": "daily",
  "preferred_time": "evening"
}
```

Then KwestUp's deterministic rule engine applies the behavioral rules:
- Establishes the 2-minute minimum action
- Selects or prompts for a habit cue / anchor
- Sets up the "never miss twice" recovery policy
- Validates notification quotas and quiet hours

The app owns:
- capabilities and permissions
- persistent data (AsyncStorage, vaults)
- executable rulebook enforcement
- notification dispatch and quiet hours
- home-screen widgets
- tasks, habits, and factual rewards
- intervention limits and anti-spam gates

The AI owns:
- natural-language interpretation & intent extraction
- semantic friction identification
- user-facing plan explanation
- natural-language check-in & review generation

The AI must never directly write storage, schedule Android notifications, modify widgets, control arbitrary third-party apps, or invent capabilities.

## 2. Current baseline

The current repository already contains:
- `App.js` composition root
- `TaskContext`, `VaultContext`, `BillingContext`, `BirthdayContext`
- pure `taskMutations.js`
- centralized `dateUtils.js`
- notification utilities
- local filesystem vaults
- AsyncStorage persistence
- encrypted backups
- on-device Qwen inference through `llama.rn`
- Android widgets + headless widget handler
- Jest tests
- ESLint
- GitHub Actions lint/test CI
- Semgrep

The latest map reports Phase 19/19 complete. The remaining architectural problem is that cross-domain behavior is still distributed, with `App.js` retaining substantial orchestration and notifications split across feature/context code.

## 3. Product definition

KwestUp is a **behavioral execution system**, not merely a chatbot, task manager, streak counter, or reminder app.

Core loop:

```text
Intention
 -> identity / desired change
 -> behavior
 -> cue
 -> minimum action
 -> execution
 -> immediate acknowledgement/reward
 -> evidence/history
 -> review
 -> adaptation
```

The app must work even when the user does not voluntarily open it. Widgets, notifications and direct notification actions become behavioral surfaces.

## 4. Executable Rulebook Architecture

The rulebook is not merely static documentation. It is **executable software specification**:

- The **human layer** (Markdown) explains the psychological philosophy and rationale.
- The **machine layer** (JSON rule sets) enforces the behavioral constraints deterministically.

```text
rulebook/
├── README.md
├── manifest.json
├── CHANGELOG.md
│
├── human/                     # Philosophy, principles & policies (Markdown)
│   ├── atomic-habits/         # 24 core Atomic Habits specifications
│   │   ├── obvious.md
│   │   ├── attractive.md
│   │   ├── easy.md
│   │   ├── satisfying.md
│   │   ├── two-minute-rule.md
│   │   ├── habit-stacking.md
│   │   └── never-miss-twice.md
│   ├── ai/                    # AI interaction policies & prompt constraints
│   ├── rules/                 # Business rule specifications
│   └── examples/              # Domain workflow scenarios (DSA, exercise, etc.)
│
└── machine/                   # Deterministic executable rule sets (JSON)
    ├── rules.json             # Core system rules, invariants & validation gates
    ├── habitRules.json        # Habit creation, scaling & stacking rules
    ├── interventionRules.json # Notification quotas, quiet hours, widget policies
    ├── recoveryRules.json     # Never-miss-twice recovery transitions & friction response
    └── rewardRules.json       # Factual milestone rewards & progress calculations
```

### Rule IDs & Debuggable Execution Traces

Every machine-readable rule carries a unique **Rule ID**:
- `HABIT_CREATE_001`, `HABIT_CREATE_002` (Creation constraints & concurrent caps)
- `MINIMUM_ACTION_001` (Mandatory <120s 2-minute version)
- `CUE_STACK_001`, `CUE_STACK_002` (Implementation intention & habit stack attachment)
- `RECOVERY_001`, `RECOVERY_002` (Never-miss-twice state transition)
- `REMINDER_ANTI_SPAM_001` (Daily notification cap enforcement)
- `REWARD_IMPROVEMENT_001` (Factual behavior improvement reward)

When KwestUp processes any behavioral event or compiles an intent, it produces an **Execution Trace**:

```json
{
  "command": "CREATE_HABIT",
  "rulesApplied": [
    "HABIT_CREATE_001",
    "CUE_STACK_002",
    "MINIMUM_ACTION_001",
    "RECOVERY_001"
  ]
}
```

This guarantees **complete debuggability**:
```text
User request
    ↓
AI intent extraction
    ↓
Rules applied (Audit Trail)
    ↓
Generated Command
    ↓
Deterministic Execution
```

When an intervention fires or is suppressed, developers and users do not need to wonder:
> *"Why did the Qwen model decide to send or skip this notification?"*

Instead, the deterministic rule engine reports exact rules:
```text
Rule:        REMINDER_ANTI_SPAM_001
Condition:   behaviorNotificationsToday >= 3
Action:      BLOCK_BEHAVIOR_NOTIFICATION
Priority:    100
```

### Deterministic Condition-Action Format

All machine rules specify explicit triggers (`when`), outcomes (`then`), and priority arbitration:

```json
{
  "id": "MINIMUM_ACTION_001",
  "description": "Every habit must have an achievable minimum action (<120 seconds).",
  "when": {
    "entity": "habit",
    "minimumAction": null
  },
  "then": {
    "action": "REQUIRE_MINIMUM_ACTION"
  },
  "priority": 80
}
```

```json
{
  "id": "REMINDER_ANTI_SPAM_001",
  "description": "Enforce hard daily cap on behavioral notification touchpoints.",
  "when": {
    "behaviorNotificationsToday": ">=3"
  },
  "then": {
    "action": "BLOCK_BEHAVIOR_NOTIFICATION"
  },
  "priority": 100
}
```

```json
{
  "id": "RECOVERY_001",
  "description": "Never miss twice: first miss automatically scales next action to minimum version.",
  "when": {
    "habit.missedConsecutively": ">=1"
  },
  "then": {
    "action": "OFFER_MINIMUM_VERSION",
    "surface": "widget"
  },
  "priority": 90
}
```

## 5. Core domain model

### Identity
```text
id, statement, createdAt, updatedAt
```

### Habit
```text
id
identityId
title
behavior
frequency
status
minimumAction
normalTarget
createdAt
updatedAt
```

### Cue
```text
id
habitId
type
time
location
triggerEvent
conditions
```

Initial cue types:
- time
- after-habit
- task-completion
- manual
- morning
- evening

### Habit Stack
```text
anchorHabitId
targetHabitId
relationship
```

### Intervention
```text
id
habitId
type
surface
priority
scheduledFor
expiresAt
action
reason
status
```

### Behavior Event
```text
id
type
entityId
timestamp
metadata
source
```

Examples:
`TASK_COMPLETED`, `HABIT_COMPLETED`, `HABIT_MISSED`, `REMINDER_DISMISSED`, `REMINDER_IGNORED`, `WIDGET_ACTION`, `FOCUS_COMPLETED`, `CHECK_IN_COMPLETED`.

### Reward/improvement
Track factual improvements:
- first completion
- consistency improvement
- earlier start
- longer duration
- successful recovery
- increased difficulty
- reduced friction

Avoid making arbitrary XP the core reward.

## 6. Target source structure

```text
src/
├── ai/
│   ├── intentParser.ts
│   ├── planner.ts
│   ├── behaviorAdvisor.ts
│   ├── commandSchemas.ts
│   └── aiPolicy.ts
├── behavior/
│   ├── behaviorEngine.ts
│   ├── habitEngine.ts
│   ├── cueEngine.ts
│   ├── interventionEngine.ts
│   ├── improvementEngine.ts
│   ├── rewardEngine.ts
│   ├── recoveryEngine.ts
│   └── reviewEngine.ts
├── commands/
│   ├── commandRegistry.ts
│   ├── commandValidator.ts
│   └── commandExecutor.ts
├── domains/
│   ├── tasks/
│   ├── habits/
│   ├── notes/
│   ├── timer/
│   ├── birthdays/
│   └── billing/
├── services/
│   ├── notificationService.ts
│   ├── widgetService.ts
│   ├── storageService.ts
│   └── ...
├── context/
│   ├── TaskContext.tsx
│   ├── HabitContext.tsx
│   ├── BehaviorContext.tsx
│   ├── VaultContext.tsx
│   ├── BillingContext.tsx
│   └── BirthdayContext.tsx
├── screens/
├── components/
├── navigation/
└── theme/
```

TypeScript conversion is incremental. New architecture code is TypeScript first; existing screens migrate later.

## 7. Command Gateway & Behavior Compiler

A major vulnerability of LLM-based behavioral systems is expecting a small local model to generate deeply nested behavioral structures perfectly. In KwestUp, we introduce the **Behavior Compiler**.

```text
Natural Language
       ↓
Small AI (Specialist Intent Parser)
       ↓
Extracted Intent
       ↓
Command Gateway (Schema Validation, Capability Check, Permissions)
       ↓
Behavior Compiler (Applies Atomic Habits & Product Rules)
       ↓
Deterministic Behavior Engine (Cue, Minimum Action, Recovery, Rewards)
       ↓
Validated Habit Plan / Executable Commands
```

### The Behavior Compiler in Practice

Suppose the user says:
> *"I want to study DSA every evening after dinner."*

The ~400 MB Qwen model only needs to extract the bare facts:
```json
{
  "intent": "CREATE_HABIT",
  "behavior": "study DSA",
  "frequency": "daily",
  "anchor": "after dinner"
}
```

The model is **not** asked to generate the entire Atomic Habits schema, remember rule IDs, or compute recovery policies. That is error-prone for small models.

The **Behavior Compiler** deterministically expands that intent into a complete, verified habit plan:

```json
{
  "identity": "consistent learner",
  "behavior": {
    "target": "study DSA",
    "minimum": "solve one question",
    "normal": "30 minutes"
  },
  "cue": {
    "type": "habit_stack",
    "anchor": "dinner"
  },
  "intervention": {
    "surface": "widget",
    "action": "START_MINIMUM"
  },
  "recovery": {
    "enabled": true,
    "minimum_after_miss": true
  },
  "reward": {
    "type": "behavioral_improvement"
  }
}
```

### Why This Is More Reliable
1. **Model Simplicity:** The model's prompt is constrained to extracting intent, behavior, frequency, and cue anchors.
2. **Deterministic Correctness:** The compiler fills in missing pieces according to hard-coded rulebook logic (`rulebook/machine/*.json`).
3. **Safety & Capability Check:** The Command Gateway verifies that capabilities exist and permissions are granted before any execution occurs.
4. **Execution Isolation:** The LLM never directly calls AsyncStorage, notification APIs, widget APIs, filesystem APIs, or Android APIs.

## 8. Notification refactor

The current notification responsibilities are distributed. Consolidate mechanics first.

Target:

```text
src/behavior/interventionEngine.ts
src/services/notificationService.ts
src/services/widgetService.ts
```

`notificationService` knows Android/Expo mechanics only:
`requestPermission`, `createChannel`, `schedule`, `cancel`, `cancelGroup`, `getScheduled`.

`interventionEngine` knows why an intervention exists.

Tasks, birthdays, billing and habits emit domain events; they do not directly own notification mechanics.

### Notification policy

Hard-coded policy outside the LLM:

```text
maxBehaviorNotificationsPerDay
minimumGapBetweenBehaviorNotifications
quietHours
deduplicationWindow
maximumRepeatedReminderCount
priorityRules
userOptOut
```

AI can request an intervention. Policy can reject it.

Use separate Android channels, appropriate priorities, grouping and timeouts. Avoid exact alarms unless a user-facing feature genuinely requires precise timing.

## 9. Widget architecture

Widgets become behavioral surfaces.

Examples:

```text
TODAY
1. Drink water
2. Review priorities
3. Study — 2 min
```

```text
NEXT
Read one page
[START]
```

```text
DON'T MISS TWICE
You missed yesterday.
[2-MIN VERSION]
```

```text
STUDY
12 min today
↑ 2 min vs baseline
```

The headless widget handler must use shared domain/command functions rather than maintaining duplicate business logic.

## 10. Rewards

Reward categories:
- first action
- improvement
- consistency
- recovery
- difficulty progression
- friction reduction
- identity evidence

Examples:
- “First successful day.”
- “You started 3 minutes earlier.”
- “You came back after missing yesterday.”
- “You completed the harder version.”
- “Your average start delay dropped from 12 minutes to 7.”

The system should reinforce behavior, not make KwestUp itself the main source of stimulation.

## 11. Minimum-action system

Every habit supports:

```text
minimumAction
normalTarget
stretchTarget
```

Example:

```text
Study:
minimum = open notes + solve one question
normal = 30 minutes
stretch = 60 minutes
```

Repeated failure should normally lower activation cost before increasing reminder frequency.

## 12. Recovery system

```text
ACTIVE
  -> MISSED_ONCE
  -> RECOVERY_AVAILABLE
  -> RECOVERED

or

MISSED_TWICE
  -> FRICTION_REVIEW
  -> HABIT_REDESIGN
```

Friction categories:
- too difficult
- forgot
- too late
- low energy
- wrong cue
- wrong location
- unclear next action
- unexpected event
- too much setup
- low motivation

## 13. AI Responsibilities & Three-Layer Intelligence Model

### The Three-Layer Intelligence Model

KwestUp separates system intelligence into three distinct, decoupled layers:

```text
Layer 1 — LLM Intelligence:       "What does the human mean?"
Layer 2 — Rule Intelligence:      "What does KwestUp believe should happen?"
Layer 3 — Execution Intelligence: "What can KwestUp actually execute right now?"
```

This separation is the single most important architectural decision for the on-device AI system:
- **Model Agnostic:** Upgrading from a 400 MB quantized Qwen model to a 2–4 GB model later does not require rewriting application logic. A larger model simply gets better at interpreting messy natural language, diagnosing nuanced friction, and generating fluent text.
- **Deterministic Stability:** The behavioral rulebook and state machines remain rock-solid and testable regardless of model fluctuations or hallucination tendencies.

---

### Division of Labor: AI vs. Backend

| Responsibility | AI? | Backend / Rulebook? |
| :--- | :---: | :---: |
| Understand "I want to exercise" | **Yes** | No |
| Understand "after dinner" | **Yes** | No |
| Determine valid habit schema | No | **Yes** |
| Minimum action rules (<120s Two-Minute Rule) | No | **Yes** |
| Notification limits & rate-limiting | No | **Yes** |
| Quiet hours enforcement (22:00–08:00) | No | **Yes** |
| Recovery rules (Never Miss Twice) | No | **Yes** |
| Reward calculation (milestones & improvements) | No | **Yes** |
| Detect duplicate reminders & cues | No | **Yes** |
| Store habit & persist state | No | **Yes** |
| Update Android home-screen widget | No | **Yes** |
| Schedule Android notification | No | **Yes** |
| Decide whether a system capability exists | No | **Yes** |
| Diagnose why user keeps failing | Semantic extraction | Rule mapping + AI |
| Generate natural-language explanation | **Yes** | No |
| Weekly behavioral summary | **Yes** (text generation) | **Yes** (factual aggregation) |

---

### Use the AI as a Specialist, Not an Operating System

The small local model operates in three tightly defined specialist roles:

```text
Intent Parser
       │
       ├── CREATE_HABIT
       ├── MODIFY_HABIT
       ├── CREATE_TASK
       ├── COMPLETE_TASK
       ├── CHECK_IN
       └── REVIEW

Behavior Analyst
       │
       ├── explain failure
       ├── identify semantic friction
       └── suggest adaptation options

Language Generator
       │
       ├── explain compiled plan
       ├── generate check-in feedback
       └── compose weekly review summary
```

The deterministic application handles everything else.

---

### Semantic vs. Deterministic Boundary

Not everything can or should be encoded in pure static rules. The system maintains a strict boundary:
- **Semantic Interpretation:** When a user says: *"I've been struggling to study because I keep getting distracted by my phone,"* a pure regex or rule engine cannot reliably comprehend the nuance. The small model parses this into a structured semantic diagnosis:
  ```json
  {
    "friction": "phone_distraction",
    "domain": "study",
    "severity": "moderate"
  }
  ```
- **Deterministic Action:** The deterministic rule engine takes that semantic diagnosis and maps it to supported KwestUp interventions:
  ```text
  phone_distraction
         ↓
  available interventions
         ├── earlier cue (before evening relaxation)
         ├── smaller session (2-min version)
         ├── focus timer with lockout overlay
         └── KwestUp-native commitment checklist
  ```
The AI interprets. The rule engine decides what KwestUp is allowed to do.

---

### Optional Rulebook Retrieval (Rule Packet RAG)

For complex or edge-case interactions, the system can provide the local LLM with a **small relevant rule packet** (3–4 rules) rather than loading the entire 44-document rulebook:

```text
User:       "I keep failing my reading habit."
Retriever:  Selects relevant rule definitions:
            - MINIMUM_ACTION_001 (Two-minute rule)
            - FRICTION_001 (Activation energy)
            - RECOVERY_001 (Never miss twice)
            - CUE_STACK_001 (Habit stacking)
Prompt:     Qwen + 4 selected rules + user's recent completion facts
```

This rule packet provides targeted context without blowing up the context window or overwhelming the 400 MB model. The deterministic rule engine still enforces all hard constraints after the AI responds.

## 14. External-app boundary

Initial release must not attempt:
- blocking Instagram
- closing arbitrary apps
- altering Android settings
- scraping other apps
- unrestricted device automation
- always-listening voice control

KwestUp can instead remind, show widgets, offer recovery actions, track KwestUp-native behavior and provide recommendations.

## 15. Migration route

### M0 — Baseline
Run lint, unit tests, development/preview builds and manual smoke tests. Tag a baseline release.

### M1 — Repository governance
Create `docs/`, `rulebook/`, `src/behavior/`, `src/commands/`, `src/services/`, `src/domains/`. Add architecture, testing, AI policy and contribution rules.

### M2 — Technology upgrade
Upgrade Expo 53 → Expo 57. Resolve native dependencies. Validate widgets, llama.rn, notifications and builds before behavior work.

### M3 — Notification extraction
Move notification mechanics into `notificationService`. Keep behavior unchanged.

### M4 — Domain events
Introduce an internal event bus and event types:
`TASK_CREATED`, `TASK_COMPLETED`, `TASK_MISSED`, `HABIT_COMPLETED`, `REMINDER_DISMISSED`, `WIDGET_ACTION`, `FOCUS_COMPLETED`.

### M5 — Behavior engine
Add habit, cue, recovery, reward and improvement engines. Initially connect to Daily Tasks and Tasks only.

### M6 — Intervention engine
Move behavioral scheduling out of feature-specific modules. Surfaces: notification, widget, in-app.

### M7 — Habit domain
Add HabitContext, storage, mutations, history, stacking, minimum actions and recovery.

### M8 — Command layer
Add schema validation and a finite KwestUp command registry.

### M9 — Behavioral widgets
Keep existing widget technology; change content from task-only to intervention-aware.

### M10 — AI habit compiler
Natural-language habit creation using structured commands.

### M11 — AI adaptation
Use behavior history to modify cues, minimum actions, timing and interventions.

### M12 — Hardening
E2E flows, migrations, offline testing, performance testing, release smoke tests.

Every milestone must leave the app buildable and testable.

## 16. Technology target

Current baseline:
- Expo SDK 53
- React Native 0.79.5
- React 19.0
- Node 20

As of 2026-09-29, the latest stable Expo SDK is 57, which targets React Native 0.86 and React 19.2.3. SDK 57 requires Node 22.13.x. Use the Expo-supported combination rather than independently forcing React Native 0.87.

Target:
```text
Expo SDK 57
React Native 0.86
React 19.2.3
Node 22.13+
current SDK-compatible TypeScript
```

React Native 0.87 is active but should be treated as a later upgrade target unless the project intentionally leaves the stable Expo pairing.

## 17. TypeScript strategy

Do not rewrite the entire app first.

1. New behavior/command/AI code: TypeScript.
2. Convert shared engines.
3. Convert contexts.
4. Convert screens last.
5. Enable strict checking progressively.
6. Add `tsc --noEmit` to CI once typed modules are ready.

## 18. State strategy

Do not introduce Redux/Zustand automatically.

Keep domain contexts initially:

```text
Context = state boundary
Pure functions = deterministic domain logic
Services = platform integration
Events = cross-domain communication
```

Reconsider a global state library only after measured complexity/performance warrants it.

## 19. Storage strategy

Keep AsyncStorage for the first behavior release.

Move away from one continuously growing monolithic blob by adding domain-separated versioned keys:

```text
kwestup_tasks_v8
kwestup_habits_v1
kwestup_behavior_events_v1
kwestup_interventions_v1
kwestup_rewards_v1
```

Use explicit migrations.

Evaluate SQLite/Expo SQLite only when behavior history becomes large enough to justify it.

## 20. AI model strategy

Keep the current local Qwen model initially.

Do not simultaneously change model, inference runtime, storage, notifications and architecture.

First establish:

```text
AI → structured intent → validated command
```

Then benchmark model alternatives on:
- intent accuracy
- structured-output validity
- latency
- memory
- battery
- failure rate
- fallback rate

AI remains optional and offline.

## 21. Testing definitions

### Unit
One deterministic function.

### Domain
One domain engine/service.

### Integration
Two or more application layers together.

### Component
User-facing component behavior.

### E2E
Real Android user flow.

### Regression
Automated reproduction of every important fixed bug.

## 22. Test matrix

### Habit
Creation, editing, deletion, recurrence, minimum action, stacking, completion, skip, miss, recovery, reset, migration.

### Cue
Time, after-habit, task-completion, duplicates, invalid cues, quiet hours, disabled habits.

### Intervention
Scheduling, deduplication, priority, expiration, cancellation, daily limits, opt-out.

### Rewards
First completion, improvement, recovery, consistency, false-positive prevention.

### AI commands
Valid command, malformed JSON, unknown command, invalid parameters, unavailable capability, destructive command, ambiguity, hallucinated capability.

### Widgets
Render model, empty state, stale state, action dispatch, storage update, refresh, headless action.

## 23. Critical E2E flows

### Create habit
Natural language → AI interpretation → confirmation → habit → widget → reminder.

### Widget completion
Widget → START → minimum action → completion → reward → widget refresh.

### Notification action
Notification → COMPLETE → state update → reward → notification cleanup.

### Recovery
Miss → recovery intervention → minimum version → completion → recovery reward.

### Adaptation
Repeated misses → analysis → friction diagnosis → changed habit.

## 24. CI/CD

PR pipeline:

```text
Install
 → lint
 → typecheck
 → unit tests
 → integration tests
 → coverage
 → Semgrep
 → Android build verification
```

Main branch:

```text
PR gates
 → merge
 → preview EAS build
 → artifact
 → manual QA
```

Release:

```text
version bump
 → CI
 → production EAS build
 → smoke test
 → GitHub Release
```

Do not automatically publish production APKs on every main push.

### Initial quality gates

```text
lint errors: 0
type errors in typed code: 0
tests: 100% passing
critical E2E: 100% passing
high-severity security findings: 0 unresolved
overall coverage: ≥70%
behavior domain: ≥90%
command validation: ≥95%
notification policy: ≥95%
```

Coverage should be treated as a signal, not proof.

## 25. Dependency policy

Native-risk dependency updates are isolated from product feature work.

Every upgrade requires:
- compatibility check
- tests
- Android build
- widget verification
- AI/native verification
- notification verification
- release smoke test

The existing `llama.rn` postinstall patch must be explicitly verified after every native dependency upgrade.

## 26. Codebase rules

1. `App.js` is composition/bootstrap only.
2. Screens do not own business logic.
3. Contexts do not contain platform implementation.
4. Services do not render UI.
5. AI never directly mutates persistent state.
6. Widgets never invent business logic.
7. Notification mechanics live in one service.
8. Behavioral policy lives in the behavior engine/rulebook.
9. Cross-domain changes use domain events.
10. New functionality requires tests.
11. No raw `console.*` in product code; use the logger.
12. Never use UTC slicing for local calendar dates; use `dateUtils`.
13. No new direct AsyncStorage writes from screens.
14. New architecture code is TypeScript.
15. No external-app automation in the initial release.

## 27. Definition of Done

```text
[ ] Product behavior defined
[ ] Rulebook updated
[ ] Domain model defined
[ ] Command/API defined if AI-accessible
[ ] Deterministic implementation
[ ] UI
[ ] Notification/widget behavior if needed
[ ] Unit tests
[ ] Integration tests
[ ] E2E if user-critical
[ ] Migration considered
[ ] Offline behavior considered
[ ] Accessibility checked
[ ] Structured logging
[ ] CI green
[ ] Preview APK tested
```

## 28. Atomic Habits MVP

Implement first:

1. Identity
2. Habit
3. Cue
4. Habit stacking
5. Minimum action
6. Four-law strategy metadata
7. Habit completion
8. Miss detection
9. Never-miss-twice recovery
10. Small-improvement rewards
11. Widget intervention
12. Notification intervention
13. AI natural-language habit creation
14. AI habit adaptation
15. Weekly review

Later:
- environment automation
- temptation bundling
- commitment devices
- advanced accountability
- deliberate practice
- behavior experiments
- broader Android integrations

## 29. First user experience

User:

> I want to start studying DSA every evening.

KwestUp generates:

```text
Identity:
I am a consistent learner.

Habit:
Study DSA every evening.

Cue:
After dinner.

Minimum:
Open today's problem and solve one question.

Normal:
30 minutes.

KwestUp will place the next action on the widget
and remind the user around the established cue.
```

User confirms. KwestUp creates the behavioral system.

## 30. Final Architecture

```text
                         USER
                           │
                           ▼
                  ┌─────────────────┐
                  │ SMALL LOCAL LLM │
                  │ (~400MB Qwen)   │
                  │                 │
                  │ Intent          │
                  │ Extraction      │
                  │ Friction Diag.  │
                  │ Text Generation │
                  └────────┬────────┘
                           │
                     Structured Intent
                           │
                           ▼
                ┌──────────────────────┐
                │   COMMAND GATEWAY    │
                │                      │
                │ Schema Validation    │
                │ Capability Check     │
                │ Permission Check     │
                └──────────┬───────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │  BEHAVIOR COMPILER   │
                │                      │
                │ Atomic Habits Rules  │
                │ Product Rules        │
                │ User Preferences     │
                │ Safety Constraints   │
                └──────────┬───────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │  DETERMINISTIC       │
                │  BEHAVIOR ENGINE     │
                │                      │
                │ Cue & Habit Stacking │
                │ Minimum Action (<2m) │
                │ Never Miss Twice     │
                │ Factual Rewards      │
                │ Rulebook Engine (IDs)│
                └──────────┬───────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │ INTERVENTION ENGINE  │
                │                      │
                │ Anti-Spam Gate       │
                │ Quiet Hours Policy   │
                │ Surface Arbitration  │
                └──────────┬───────────┘
                           │
                           ▼
                ┌──────────────────────┐
                │   KwestUp COMMANDS   │
                └──────────┬───────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
           Tasks        Widget     Notification
          (Storage)   (Android)    (Android OS)
              │            │            │
              └────────────┼────────────┘
                           │
                           ▼
                         USER
                           │
                           ▼
                     DOMAIN EVENTS
                           │
                           ▼
                   BEHAVIOR HISTORY
                           │
                           ▼
                 ADAPTATION / REVIEW
                           │
                           └──────► AI Specialist (Analysis & Summarization)
```

### Architectural Invariants:
1. **KwestUp Owns Execution and Persistent Data:** The application layer alone controls database writes, file storage, and OS API calls.
2. **AI Is a Semantic Specialist:** Operates as Intent Parser, Behavior Analyst, and Language Generator. Never directly manipulates storage or Android APIs.
3. **Command Gateway Enforces Safety:** Validates schemas, system capabilities, permissions, and idempotency before dispatch.
4. **Behavior Compiler Constructs Habits:** Eliminates model hallucination by deterministically filling in identity, 2-minute minimum actions, cues, interventions, and recovery policies.
5. **Rule Engine Enforces Deterministic Policy:** Evaluates machine-readable rules (`rulebook/machine/*.json`) with explicit Rule IDs (`HABIT_CREATE_001`, `RECOVERY_001`, etc.) and outputs debuggable audit traces (`rulesApplied`).
6. **Rulebook Has Two Decoupled Layers:** Human layer (Markdown) for psychological philosophy; Machine layer (JSON) for deterministic runtime execution.
7. **Android Platform Owns Final Constraints:** Honor battery optimizations, notification quotas, and system permissions.

## 31. Source basis and technology references

The current architecture/structure/testing documents are the baseline for the migration. The latest codebase already has centralized task mutations, date handling, domain contexts, widgets and notification infrastructure; the plan restructures these rather than discarding them.

Current official technology references used for the upgrade decision:
- Expo SDK 57 is the current stable Expo SDK and targets React Native 0.86 / React 19.2.3 / Node 22.13.x.
- React Native 0.87 is active, but Expo SDK 57's supported pairing is RN 0.86.
- React Native 0.87 introduces stricter TypeScript APIs and higher native toolchain requirements, so it is intentionally not forced into the initial Expo-stable upgrade.
- Android recommends appropriate notification channels, priorities, grouping and timeouts.
- Android notification actions can let users act without opening the full application.
- Exact alarms should only be used where precise timing is genuinely required.

The implementation should therefore begin with the **M0 → M1 → M2 foundation work**, not with AI behavior features directly.
