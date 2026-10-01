# Rulebook Changelog

All notable changes to the KwestUp behavioral rulebook governance contracts are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to Semantic Versioning.

## [1.1.0] — 2026-10-01 (Two-Layer Executable Rulebook & Behavior Compiler Architecture)

### Added
- Established machine-executable rule layer (`rulebook/machine/`) containing `rules.json`, `habitRules.json`, `interventionRules.json`, `recoveryRules.json`, and `rewardRules.json`.
- Introduced unique Rule IDs (`HABIT_CONCURRENT_CAP_001`, `MINIMUM_ACTION_001`, `CUE_STACK_002`, `RECOVERY_001`, `REMINDER_ANTI_SPAM_001`, `REWARD_FIRST_ACTION_001`) with deterministic condition-action schemas.
- Introduced Execution Trace logging (`rulesApplied: [...]`) on commands and behavioral transitions for complete auditability.
- Introduced the **Behavior Compiler** separating lightweight semantic intent extraction (from the ~400 MB on-device Qwen model) from deterministic habit plan construction.
- Formally defined the **Three-Layer Intelligence Model** (LLM interpretation, Rule policy, Execution runtime) ensuring future model upgrades do not require application rewrites.
- Updated `rulebook/manifest.json` and `rulebook/README.md` to register and index both human and machine layers.

## [1.0.0] — 2026-10-01 (Phase 20 Initial Authorship)

### Added
- Complete behavioral governance rulebook directory tree (`rulebook/`).
- Established 5 core architectural invariants in `rulebook/README.md`.
- Authored 24 Atomic Habits principle specification documents translating James Clear's four laws, inversions, identity framework, 2-minute rule, habit stacking, and recovery models to KwestUp Mobile.
- Authored 5 AI behavioral interaction policy documents (`rulebook/ai/`) constraining natural language interpretation, habit compilation, surface arbitration, structured check-ins, and evidence-based adaptation.
- Authored 8 deterministic business policy documents (`rulebook/rules/`) enforcing habit creation, modification, missed habit recovery, factual rewards, reminder schedules, widget prioritization, anti-burnout overload thresholds, and absolute local-first privacy.
- Authored 7 domain workflow scenarios (`rulebook/examples/`) illustrating end-to-end compilation, quiet-hours enforcement, and recovery protocols.
- Machine-readable manifest registry (`rulebook/manifest.json`) tracking all 44 specification documents with source tags and review timestamps.
- Compliance Verification matrix and Policy Enforcement Timeline specifying Phase 22 (Notification Service) and Phase 24 (Habit Engine) as hard enforcement gates while grandfathering v3.5.0 schedulers.
