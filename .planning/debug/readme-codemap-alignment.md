# Debug Session: README.md Alignment with Codebase Map

**Session Date:** 2026-10-12
**Status:** Resolved
**Domain:** Documentation & Architecture Alignment

## 1. Symptoms & Problem Statement
The root `README.md` file exhibited substantial drift and discrepancies when cross-referenced against the 7 codebase map documents in `.planning/codebase/` (`ARCHITECTURE.md`, `CONCERNS.md`, `CONVENTIONS.md`, `INTEGRATIONS.md`, `STACK.md`, `STRUCTURE.md`, `TESTING.md`):
1. **Outdated Framework & Runtime Versions:** `README.md` listed Expo 53, React Native 0.79, Node 18, and npm 9. The codebase map documents confirm Expo SDK 57 (`~57.0.0`), React Native `0.86.3`, React `19.2.3`, and Node `22 LTS` (`>=22.13`).
2. **Outdated AI Model & Binding Names:** `README.md` referenced `Qwen3-0.6B-GGUF` and `react-native-llama`. The codebase uses `llama.rn` (`0.12.4`) running `Qwen2.5-0.5B-Instruct-Q4_K_M.gguf` with chunked SHA-256 verification and an on-device deterministic pipeline (`intentParser`, `rulePacketRetriever`, `behaviorCompiler`, `frictionAnalyzer`, `weeklyReviewEngine`).
3. **Missing KwestUp 4.0 Behavioral & Atomic Habits Subsystem:** The entire 4.0 architecture was absent from `README.md`:
   - Finite, schema-validated, actor-tagged Command Gateway & AI Sandbox (`src/commands/`).
   - Pure habit math engines enforcing 4-Law habits, 2-minute minimum actions, cue stacks, identity evidence votes, and Never-Miss-Twice recovery (`src/behavior/`).
   - Domain Event Bus with frozen immutable events and in-memory ring buffer.
   - Weekly Behavioral Reflection system (`WeeklyReviewModal`).
4. **Incomplete Android Widgets Inventory:** `README.md` listed 4 widgets; the codebase has 5 widgets (missing `HabitWidget.tsx` with dynamic priority state arbitration: Recovery > Today Due > Next Action > Standby).
5. **Missing Quality Gates & Testing Guide:** `README.md` lacked documentation for Jest test execution, coverage, TypeScript typechecking, and ESLint quality gates (30 suites, 457 tests).
6. **Inaccurate Dev Environment Instructions:** Recommended Expo Go for running the app, which fails for native modules (`llama.rn`, widgets); requires Expo Dev Client / local development builds.

## 2. Root Cause Analysis
`README.md` was authored during the early KwestUp 3.0 / Expo 53 release cycle and was not maintained during the subsequent modernization milestones that upgraded to Expo SDK 57 / React Native 0.86 / React 19, implemented the 5th Android widget (`HabitWidget`), and introduced the full KwestUp 4.0 Atomic Habits engine and Command Gateway architecture.

## 3. Resolution & Code Changes
Updated `README.md` comprehensively:
1. **Badges & Header:**
   - Updated React Native badge to `0.86`, Expo badge to `57`, added React `19` badge, TypeScript badge (`5.8/6.0`), and updated Local AI badge to `llama.rn / Qwen2.5`.
2. **Core Differentiators & Features:**
   - Added KwestUp 4.0 Atomic Habits & Behavioral Engine subsection detailing 4-Law Habit design, Identity Evidence Voting, Never-Miss-Twice recovery, 3 keystone habit cap, and Weekly Behavioral Reflection.
   - Updated Local AI details to `llama.rn` 0.12.4 with Qwen2.5-0.5B-Instruct Q4_K_M GGUF, on-device pipeline, and sandboxed Command Gateway.
   - Expanded Native Android App Widgets list from 4 to 5 to include `Habit Touchpoint Widget (2x2)` with priority arbitration.
3. **Architecture & Tech Stack:**
   - Documented full stack matching `STACK.md` and `ARCHITECTURE.md`: Expo SDK 57, RN 0.86.3, React 19.2.3, React Navigation v7, Reanimated 4, worklets 0.10.1, Domain Event Bus, AsyncStorage v7.0 storage schema.
4. **Getting Started & Workflow:**
   - Updated prerequisites to Node `>= 22.13.0` (Node 22 LTS) and npm 10+.
   - Added explicit note that native modules require Expo Dev Client / development build (`npm run android` / `npx expo run:android`) rather than plain Expo Go.
5. **Testing & Quality Gates:**
   - Added full testing and quality gates documentation detailing `npm run typecheck`, `npm run lint`, and `npm test` (with CI/CD workflow reference).

## 4. Verification Evidence
- `npm run typecheck`: Passed with 0 errors (`tsc --noEmit`).
- `npm run lint`: Passed with 0 errors (478 pre-existing warnings, 0 blocking errors).
- `npm test`: Passed (30 test suites, 457 tests passing).
