# KwestUp Mobile — Atomic Behavior Master Plan

**Status:** Implementation blueprint  
**Date:** 2026-09-29  
**Baseline:** KwestUp Mobile v3.5.0 / repository map dated 2026-09-28  
**Platform:** Android-first, local-first

## 1. Executive architecture

KwestUp will become an **AI-driven behavioral layer inside KwestUp**, not an AI-controlled operating system.

The app owns:
- capabilities
- persistent data
- business rules
- permissions
- execution
- notifications
- widgets
- tasks/habits
- rewards
- intervention limits

The AI owns:
- natural-language interpretation
- intent extraction
- planning
- selecting among KwestUp capabilities
- behavioral reasoning
- adaptation from observed results

The AI must never directly write storage, schedule Android notifications, modify widgets, control arbitrary third-party apps, or invent capabilities.

```text
User intent
  -> AI interpretation
  -> structured command/plan
  -> validation
  -> KwestUp domain services
  -> domain events
  -> Behavior Engine
  -> Intervention Engine
  -> Notification / Widget / In-app
  -> user action
  -> behavior history
  -> AI adaptation
```

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

## 4. Rulebook

Create:

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

The rulebook defines behavioral policy, not implementation. Code enforces hard capabilities. The AI applies the rules.

A supplied PDF of *Atomic Habits* should later be used to make this rulebook exhaustive and source-faithful without reproducing the book.

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

## 7. Command architecture

Example:

```json
{
  "action": "CREATE_HABIT",
  "parameters": {
    "title": "Study DSA",
    "frequency": "daily",
    "minimumAction": "Open today's problem",
    "cue": {
      "type": "after-habit",
      "habit": "Dinner"
    }
  }
}
```

Pipeline:

```text
LLM
 -> structured intent
 -> schema validation
 -> capability validation
 -> command executor
 -> domain service
```

The LLM never directly calls AsyncStorage, notification APIs, widget APIs, filesystem APIs or Android APIs.

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

## 13. AI responsibilities

### Interpreter
Natural language → structured intent.

### Habit compiler
Intent → identity, behavior, cue, minimum action, routine, reward, recovery.

### Intervention planner
Decides whether/when/why/where to intervene.

### Behavioral analyst
Uses completion, misses, start delay, duration, cues, friction and intervention response.

### Adaptive planner
Changes the system based on evidence.

The LLM is never the source of truth; deterministic KwestUp engines remain authoritative.

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

## 30. Final architecture

```text
                         USER
                           |
                           v
                  +-----------------+
                  |   KwestUp AI    |
                  | Interpreter /   |
                  | Planner         |
                  +--------+--------+
                           |
                    structured intent
                           |
                           v
                  +-----------------+
                  | COMMAND LAYER   |
                  | validate/allow  |
                  +--------+--------+
                           |
                           v
                  +-----------------+
                  | DOMAIN LAYER    |
                  | Tasks / Habits  |
                  | Notes / Timer   |
                  | Billing / Birth |
                  +--------+--------+
                           |
                       domain events
                           |
                           v
                  +-----------------+
                  | BEHAVIOR ENGINE |
                  | Cues / Stacking |
                  | Friction /      |
                  | Recovery /      |
                  | Rewards /       |
                  | Review          |
                  +--------+--------+
                           |
                           v
                +---------------------+
                | INTERVENTION ENGINE |
                +----------+----------+
                           |
              +------------+------------+
              |            |            |
              v            v            v
          Notification   Widget      In-App
              |            |            |
              +------------+------------+
                           |
                           v
                         USER
                           |
                           v
                       BEHAVIOR
                           |
                           v
                         HISTORY
                           |
                           +------> AI

Architectural invariant:
KwestUp owns execution.
AI owns interpretation and planning.
Behavior Engine owns behavioral policy.
Rulebook defines behavioral philosophy.
Android owns final device/notification constraints.
```

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
