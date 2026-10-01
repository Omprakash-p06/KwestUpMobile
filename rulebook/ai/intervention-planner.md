---
id: intervention-planner
title: AI Intervention Planner Policy
section: ai
source: product-decision
review_date: 2026-10-01
---

# AI Intervention Planner Policy

## Purpose & Scope
The Intervention Planner governs when and how the system interacts with the user across mobile touchpoints. It prevents the application from degrading into irritating nagware while ensuring timely, actionable behavioral support.

## Touchpoint Surface Arbitration
Interventions are routed across three distinct surfaces (`src/behavior/types.ts:InterventionSurface`):
1. **`widget` (Ambient / Pull Surface):**
   - The default and most respectful touchpoint.
   - Shows active today habits, next actions, and Never-Miss-Twice prompts directly on the home screen.
2. **`notification` (Active / Push Surface):**
   - Strictly reserved for high-salience cues and recovery alerts.
   - Governed by hard deterministic policies: max 3 notifications per day, quiet hours (22:00–08:00), minimum 90-minute gap between notifications (`rulebook/rules/reminders.md`).
3. **`in-app` (Focused / Modal Surface):**
   - Triggered only when the user voluntarily opens KwestUp.
   - Used for weekly reviews, friction diagnosis, and celebratory milestone acknowledgements.

## Anti-Nagware Policy
- The AI Intervention Planner cannot increase notification frequency when an alert is ignored.
- If a reminder notification is ignored twice in a row, the planner suppresses further push notifications for that habit and delegates prompts exclusively to the ambient home-screen widget.

## Privacy Boundary
- Behavioral intervention contexts (including scheduled alert times and habit titles) are processed locally.
- Intervention payloads must never contain raw user notes, sensitive financial data from `BillingContext`, or private vault paths.
