# KwestUp Mobile

## What This Is

KwestUp Mobile is a unified personal organizer application built with React Native and Expo. It aims to streamline productivity by combining task management, birthday reminders, financial tracking with AI/OCR, and goal setting into a single, lightweight, and performant mobile experience.

## Core Value

A unified, lightweight, and performant personal organizer that simplifies daily productivity through intelligent automation and clear goal tracking.

## Requirements

### Validated

- âœ“ Basic React Native / Expo foundation established.
- âœ“ Initial app structure and asset management.

### Active

- [ ] **Task Manager**: Google Tasks-style interface for managing personal tasks.
- [ ] **Birthday Reminder**: System for tracking and alerting on upcoming birthdays.
- [ ] **Billing/Money Manager**: Lightweight OCR/AI-powered expense tracking.
- [ ] **Daily Goals**: Dedicated tab for recurring daily habits and tasks.
- [ ] **Goals Tab**: Date/time specific objectives.
- [ ] **Study Timer**: Focus tool for dedicated study sessions.
- [ ] **Android Widgets**: Support for Android 10+ home screen widgets.
- [ ] **Performance Optimizations**: Ensure smooth operation across all devices.

### Out of Scope

- **Cloud Sync (V1)**: Focus on local-first storage for initial phase.
- **Social Features**: No sharing or community features planned for MVP.

## Context

The project is an existing React Native / Expo application being refactored and expanded to include a suite of productivity tools. The codebase currently contains basic structure but requires a cohesive architectural overhaul to support the new feature set.

## Constraints

- **Tech Stack**: React Native (Expo) â€” Must maintain compatibility with existing project.
- **Performance**: Must run smoothly on low-end devices.
- **On-device AI**: OCR/AI for money management must be lightweight enough for mobile execution.
- **Android Version**: Widgets must support Android 10+.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| React Native/Expo | Existing codebase foundation | âœ“ Good |
| Local-first Storage | Simplicity and offline availability for MVP | âœ“ Good |

---
*Last updated: 2026-05-17 after project initialization*
