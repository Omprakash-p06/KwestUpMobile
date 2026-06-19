# Workspace Global Standards

These standards apply to all agents (main and subagents) operating in this workspace.

## Global Processing Standards

### 1. Map Before Act
- **Requirement:** Agents MUST understand and map the codebase before proceeding to make changes in each phase or debug session.
- **Goal:** Ensure all changes are informed by the existing architecture and minimize unintended side effects.
- **Tooling:** Use `glob`, `grep_search`, and `read_file` to build a mental map of the relevant modules and their interactions.

### 2. Test Before Commit
- **Requirement:** Agents MUST run code quality tests and lint tests before committing changes.
- **Goal:** Ensure all changes meet project quality standards and do not introduce regressions.
- **Verification:** All tests and lint checks MUST pass before the agent considers a task or fix "verified".

### 3. Branching & Deployment Strategy
- **Requirement:** Agents MUST commit and push all intermediate work (including debug sessions, individual phase completions, and task executions) to the `development` branch.
- **Production Guardrails:** The `production` branch is reserved strictly for major updates, milestones, and fully validated release builds. Only push to `production` once the code compiles cleanly and passes all validation checks.

