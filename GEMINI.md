# Workspace Global Standards

These standards apply to all agents (main and subagents) operating in this workspace.

## Global Processing Standards

### 1. Mandatory Codebase Map Ingestion Before Planning (Hard Prerequisite)
- **Requirement:** Before authoring, researching, or structuring any phase plan (`PLAN.md`, `RESEARCH.md`, or `VALIDATION.md`), the AI agent (and any subagents spawned for research, planning, or checking) MUST read and cross-reference all 7 codebase map documents located in `.planning/codebase/`:
  1. `.planning/codebase/ARCHITECTURE.md` - System modules, data flow, context tree, state management, storage keys, navigation.
  2. `.planning/codebase/CONCERNS.md` - Technical debt, fragile call sites, edge cases, privacy hazards, known bugs, and performance pitfalls.
  3. `.planning/codebase/CONVENTIONS.md` - Code conventions, styling, import rules, error handling, state mutation patterns.
  4. `.planning/codebase/INTEGRATIONS.md` - Native modules, third-party libraries, hardware bindings, offline contracts.
  5. `.planning/codebase/STACK.md` - Framework versions (Expo SDK 57, RN 0.86, React 19), build toolchains, Gradle, Metro, Jest, TypeScript.
  6. `.planning/codebase/STRUCTURE.md` - Directory layout, file ownership, service boundaries, component organization.
  7. `.planning/codebase/TESTING.md` - Test runner configs, mock patterns (`jest.setup.js`), unit/integration test locations, quality gates.

- **Enforcement in Plan Structure:**
  Every generated phase plan (`{phase}-XX-PLAN.md`) MUST include a dedicated `## Codebase Map Alignment` section explicitly documenting:
  - Architecture & Boundaries: How the plan adheres to boundaries in `ARCHITECTURE.md` and `STRUCTURE.md`.
  - Concerns & Mitigations: Exact section/line citations from `CONCERNS.md` of known issues, edge cases, or fragile call sites being resolved or protected.
  - Conventions & Stack: Verification that libraries, types, and styles match `CONVENTIONS.md` and `STACK.md`.
  - Testing & Mock Strategy: Verification that mocks and test coverage match patterns in `TESTING.md`.
  Any plan produced without this audit and citation is incomplete and strictly forbidden from execution.

### 2. Map Before Act (Implementation & Debugging)
- **Requirement:** Agents MUST understand and map the codebase before proceeding to make changes in each phase or debug session.
- **Goal:** Ensure all changes are informed by the existing architecture and minimize unintended side effects.
- **Tooling:** Use `glob`, `grep_search`, and `view_file` to build a mental map of the relevant modules and their interactions.

### 3. Test Before Commit
- **Requirement:** Agents MUST run code quality tests and lint tests before committing changes.
- **Goal:** Ensure all changes meet project quality standards and do not introduce regressions.
- **Verification:** All tests and lint checks MUST pass (`npm run typecheck`, `npm run lint`, `npm test`) before the agent considers a task or fix "verified".

### 4. Branching & Deployment Strategy
- **Requirement:** Agents MUST commit and push all intermediate work (including debug sessions, bug fixes, individual phase completions, and task executions) to the `development` branch. The `development` branch must always remain ahead of the `main` (and/or `production`) branch until a proper build has been confirmed and approved by the user.
- **Production Guardrails:** The `production` branch is reserved strictly for major updates, milestones, and fully validated release builds. Only push to `production` once the code compiles cleanly and passes all validation checks.


