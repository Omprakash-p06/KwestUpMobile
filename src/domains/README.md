# Domain Boundaries

This directory contains per-domain module contexts for KwestUp 4.0.
Each subdomain isolates its state, mutations, and service calls behind a clean interface.

## Planned domains (Phase 22-28)
- `src/domains/habits/` — Habit Engine (Phase 22)
- `src/domains/identity/` — Identity context (Phase 23)
- `src/domains/events/` — BehaviorEvent store (Phase 24)
- `src/domains/interventions/` — Intervention planner (Phase 25)
- `src/domains/ai/` — AI command sandbox (Phase 26-27)

## Rules
- Domains are isolated: cross-domain calls go through events, never direct imports.
- All domain types are defined in `src/behavior/types.ts` and `src/commands/types.ts`.
- No domain may import from another domain's internal modules.
