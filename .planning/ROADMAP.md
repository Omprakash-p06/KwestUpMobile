# Roadmap: KwestUp Mobile

## Overview

The roadmap for KwestUp Mobile transitions the application into a highly performant, local-first productivity workspace. The phases are ordered logically to establish core modules first (Notes, Tasks, Birthdays), implement the Wi-Fi synchronization network next, integrate offline local AI, and finally containerize developer environments.

---

## Phases

- [x] **Phase 1: Notion/Obsidian-style Notes** - Obsidian-style raw `.md` filesystem vault with Notion-style debounced auto-save, collapsible sidebar explorer, dual edit/preview markdown engine. ✅ COMPLETE
- [x] **Phase 2: Google Tasks-style Task Management** - Build Google Tasks-style Lists with drag-and-drop, due dates, checklist subtasks, and DB persistence. ✅ COMPLETE
- [x] **Phase 3: Birthday Reminder Module** - Build contact birthday dashboard with age and countdown calculations, plus Native push notifications. ✅ COMPLETE
- [x] **Phase 4: Local Network Sync via QR Scanner** - Integrate camera QR scanning to retrieve PC host IP, port, and security token, and execute two-way Wi-Fi synchronization with the Electron app. Implement the Python desktop sync reference server. ✅ COMPLETE
- [x] **Phase 5: Local On-Device AI Integration** - Link `react-native-llama` to compile native C++ bindings, download a quantized Qwen3-0.6B-GGUF model (https://huggingface.co/Qwen/Qwen3-0.6B-GGUF), and implement local note summarization and task extraction. ✅ COMPLETE
- [ ] **Phase 6: Docker Integration & System Polish** - Set up Docker compose for developer sync services, execute automated integration tests, and polish the user experience.

---

## Phase Details

### Phase 1: Notion/Obsidian-style Notes
**Goal**: Build a beautiful, nested-folder Markdown notes organizer mimicking Notion/Obsidian.
**Depends on**: Nothing.
**Requirements**: [NOTE-01, NOTE-02, NOTE-03]
**Success Criteria**:
  1. Users can create, organize, and delete markdown notes in folders.
  2. The preview mode cleanly renders markdown titles, bolding, lists, and checklists.
**Plans**:
- [x] 01-01-PLAN.md — Core persistence layer: notes state, filesystem init, factory reset wipe. ✅
- [x] 01-02-PLAN.md — Notes list UI, sidebar explorer, dual markdown editor/preview engine. ✅

---

### Phase 2: Google Tasks-style Task Management
**Goal**: Implement a slick, high-performance task management system resembling Google Tasks.
**Depends on**: Phase 1.
**Requirements**: [TASK-01, TASK-02, TASK-03]
**Success Criteria**:
  1. Users can slide between custom task categories/lists.
  2. Tasks display nested checklists with visual progress completion tracking.
**Plans**:
- [x] 02-01-PLAN.md — Build Task lists DB tables, core task CRUD logic, and category tabs UI. ✅
- [x] 02-02-PLAN.md — Build subtasks checklists UI and visual progress tracker. ✅

---

### Phase 3: Birthday Reminder Module
**Goal**: Add time-sensitive upcoming birthday indicators and native system alerts.
**Depends on**: Phase 2.
**Requirements**: [REMD-01, REMD-02]
**Success Criteria**:
  1. Birthday cards display age and days remaining with automated countdowns.
  2. Local system notifications fire correctly on the morning of scheduled birthdays.
**Plans**:
- [x] 03-01-PLAN.md — Create birthday list screen, age algorithms, and contact CRUD. ✅
- [x] 03-02-PLAN.md — Integrate Expo local notification manager and advance alert options. ✅

---

### Phase 4: Local Network Sync via QR Scanner
**Goal**: Synchronize database contents locally over Wi-Fi with KwestUp PC desktop app using a QR code camera scan.
**Depends on**: Phase 3.
**Requirements**: [SYNC-01, SYNC-02]
**Success Criteria**:
  1. The mobile camera scans PC-displayed QR codes to retrieve connection details.
  2. Two-way Wi-Fi synchronization successfully merges local data with PC app local JSON storage.
  3. A robust standalone Python synchronization server is created for PC testing.
**Plans**:
- [x] 04-01-PLAN.md — Integrate QR scanning module and parse credentials payload. ✅
- [x] 04-02-PLAN.md — Implement local HTTP sync client and data merge algorithms. ✅
- [x] 04-03-PLAN.md — Develop the companion Python synchronization server (`sync_server.py`) for desktop. ✅

---

### Phase 5: Local On-Device AI Integration
**Goal**: Host a fully offline 0.6B parameter LLM on-device (specifically Qwen3-0.6B-GGUF: https://huggingface.co/Qwen/Qwen3-0.6B-GGUF) for local summarization and task generation.
**Depends on**: Phase 1, Phase 4.
**Requirements**: [LAI-01, LAI-02]
**Success Criteria**:
  1. Native C++ llama.cpp compiles correctly inside React Native via native bindings.
  2. AI model runs entirely offline, successfully summarizing notes and extracting checklist items into the Tasks database.
**Plans**:
- [x] 05-01-PLAN.md — Integrate `react-native-llama` native library and set up GGUF model loader. ✅
- [x] 05-02-PLAN.md — Implement note summarization UI and automated task extraction pipeline. ✅

---

### Phase 6: Docker Integration & System Polish
**Goal**: Provide developer containerization and polish the overall user interface.
**Depends on**: Phase 5.
**Requirements**: [DOCKER-01]
**Success Criteria**:
  1. Docker-compose spins up local development servers and executes clean network tests.
  2. Visual elements are completely polished, fully responsive, and premium.
**Plans**:
- [ ] 06-01-PLAN.md — Write Dockerfiles, docker-compose, and automation testing scripts.
- [ ] 06-02-PLAN.md — Complete comprehensive visual audit, optimize startup latency, and freeze code.

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Notes | 2/2 | ✅ Complete | 2026-05-28 |
| 2. Tasks | 2/2 | ✅ Complete | 2026-05-28 |
| 3. Birthdays | 2/2 | ✅ Complete | 2026-05-28 |
| 4. QR Sync | 3/3 | ✅ Complete | 2026-05-29 |
| 5. On-Device AI | 2/2 | ✅ Complete | 2026-05-29 |
| 6. Docker & Polish | 0/2 | Not started | - |
