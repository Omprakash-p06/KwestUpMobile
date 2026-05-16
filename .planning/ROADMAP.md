# Roadmap: KwestUp Mobile

## Overview

The roadmap for KwestUp Mobile focuses on transforming the existing codebase into a high-performance productivity suite. We begin with architectural foundational work, followed by sequential implementation of core modules: Task Management, Birthday/Reminders, AI Financial Tracking, Goals/Habits, and finally Utility tools like the study timer and Android widgets.

## Phases

- [ ] **Phase 1: Architectural Foundation** - Establish core navigation, state management, and optimized storage.
- [ ] **Phase 2: Task Management Module** - Implement Google Tasks-style interface and logic.
- [ ] **Phase 3: Reminders & Birthday Tracker** - Build the notification-driven reminder system.
- [ ] **Phase 4: Financial Manager (AI/OCR)** - Integrate lightweight OCR and expense categorization.
- [ ] **Phase 5: Goals & Habit Tracking** - Implement daily and long-term goal management.
- [ ] **Phase 6: Productivity Utilities** - Add study timer and focus modes.
- [ ] **Phase 7: Android Widget Integration** - Develop home screen widgets for Android 10+.

## Phase Details

### Phase 1: Architectural Foundation
**Goal**: Establish a robust and performant foundation for the app.
**Depends on**: Nothing
**Requirements**: [PERF-01, PERF-02]
**Success Criteria**:
  1. App navigation structure is clear and performant.
  2. Local storage (SQLite/MMKV) is integrated and tested for speed.
  3. Global state management is set up to support multi-module data.
**Plans**: 2 plans

Plans:
- [ ] 01-01-PLAN.md — Setup Navigation and State Management.
- [ ] 01-02-PLAN.md — Integrate and optimize Local Storage.

### Phase 2: Task Management Module
**Goal**: Implement the core task management experience.
**Depends on**: Phase 1
**Requirements**: [TASK-01, TASK-02, TASK-03, TASK-04]
**Success Criteria**:
  1. User can create, edit, and group tasks.
  2. Subtasks/checklist items are functional.
  3. Tasks persist across app restarts.
**Plans**: 2 plans

Plans:
- [ ] 02-01: Implement Task List UI and Grouping.
- [ ] 02-02: Implement Task Editing and Subtask logic.

### Phase 3: Reminders & Birthday Tracker
**Goal**: Add time-sensitive reminders and birthday tracking.
**Depends on**: Phase 2
**Requirements**: [REMD-01, REMD-02, REMD-03]
**Success Criteria**:
  1. Local notifications trigger correctly for upcoming birthdays.
  2. User can set recurring reminders for arbitrary events.
**Plans**: 2 plans

Plans:
- [ ] 03-01: Implement Birthday Tracker and Notification system.
- [ ] 03-02: Implement recurring reminders.

### Phase 4: Financial Manager (AI/OCR)
**Goal**: Integrate AI-powered financial tracking.
**Depends on**: Phase 1
**Requirements**: [FIN-01, FIN-02, FIN-03, FIN-04]
**Success Criteria**:
  1. App can extract expense data from a photo (OCR).
  2. Expenses are automatically categorized using lightweight logic.
  3. Financial dashboard displays spending summaries.
**Plans**: 3 plans

Plans:
- [ ] 04-01: Integrate on-device OCR library.
- [ ] 04-02: Implement AI categorization and manual entry.
- [ ] 04-03: Build Financial Dashboard UI.

### Phase 5: Goals & Habit Tracking
**Goal**: Add daily habit and long-term goal tracking.
**Depends on**: Phase 2
**Requirements**: [GOAL-01, GOAL-02, GOAL-03]
**Success Criteria**:
  1. Daily goals tab tracks streaks and completion.
  2. Long-term goals tab supports date-specific milestones.
**Plans**: 2 plans

Plans:
- [ ] 05-01: Implement Daily Habits and Streaks.
- [ ] 05-02: Implement Long-term Goals and Milestones.

### Phase 6: Productivity Utilities
**Goal**: Add focus-enhancing tools.
**Depends on**: Phase 1
**Requirements**: [UTIL-01]
**Success Criteria**:
  1. Functional study timer with configurable intervals.
**Plans**: 1 plan

Plans:
- [ ] 06-01: Implement Study Timer.

### Phase 7: Android Widget Integration
**Goal**: Extend the app experience to the home screen.
**Depends on**: Phase 2, Phase 5
**Requirements**: [UTIL-02]
**Success Criteria**:
  1. Functional Android widgets for tasks and daily goals.
**Plans**: 2 plans

Plans:
- [ ] 07-01: Setup Android Widget infrastructure.
- [ ] 07-02: Implement Task and Goal widgets.

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/2 | Not started | - |
| 2. Tasks | 0/2 | Not started | - |
| 3. Reminders | 0/2 | Not started | - |
| 4. Finance | 0/3 | Not started | - |
| 5. Goals | 0/2 | Not started | - |
| 6. Utilities | 0/1 | Not started | - |
| 7. Widgets | 0/2 | Not started | - |
