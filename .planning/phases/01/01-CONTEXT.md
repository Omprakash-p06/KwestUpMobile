# Phase 1: Notion/Obsidian-style Notes - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning
**Source:** Interactive Discussion Gate (/gsd-discuss-phase)

---

## Phase Boundary

This phase implements an offline-first, Notion/Obsidian-style Markdown notes panel inside KwestUp Mobile. It delivers:
- Collapsible folder side navigation explorer.
- Dynamic list filters based on selected folder, search query, and hashtag.
- Dual-mode note editor supporting Edit Mode and Preview Mode.
- AsyncStorage persistence integrated inside the core KwestUp data payload.

---

## Implementation Decisions

### 1. Navigation & Collapsibility
- **Decision**: **Collapsible Sidebar**.
- **Description**: The left sidebar folder explorer is collapsible. When a note is opened for writing or viewing, the sidebar automatically collapses to maximize screen estate, providing a clean full-screen note canvas. A dedicated back/toggle button is present in the editor header to return to folder navigation.

### 2. Note Saving Behavior
- **Decision**: **Auto-save**.
- **Description**: Notes will be saved automatically on every keystroke and when navigating away from the note editor. This ensures zero data loss and absolute local integrity without requiring a manual save gate.

### 3. Markdown Rendering Scope
- **Decision**: **Custom Regex Parser**.
- **Description**: We will use a lightweight, high-performance regex parser built directly into the screen component to render core Markdown features (H1-H3 headers, bulleted lists, todo checkboxes, bolding, and italics). This keeps the app dependency-free, performant, and completely free of compilation or native linking issues.

### 4. Tag Indexing & Scanning
- **Decision**: **Dynamic Hashtag Scanning**.
- **Description**: Instead of requiring a separate metadata input, the app will automatically scan the note body text at runtime for terms prefixed with `#` (e.g., `#work`, `#personal`, `#todo`) and register them dynamically as active categories for filtering.

---

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `App.js` — Core state and AsyncStorage persistence sync.
- `src/navigation/CustomDrawerContent.js` — Main sliding drawer navigation items.
- `src/navigation/AppNavigator.js` — App navigation stack and screen routes.
- `.planning/PROJECT.md` — Product value and overall constraints.
- `.planning/REQUIREMENTS.md` — Scoped notes requirements (NOTE-01, NOTE-02, NOTE-03).

---

## Specific Ideas
- Provide an assistive **Markdown Toolbar** above the keyboard in Edit Mode (with buttons for `#`, `##`, `**`, `*`, `- [ ]`, and `-`) to quickly inject markdown formatting syntax at the cursor position.
- Styled todo checkboxes inside Preview Mode should render using interactive Expo checkmark icons (MaterialCommunityIcons), allowing users to check them off directly inside preview flow.

---

## Deferred Ideas
- **Bi-directional Note Linking** (Obsidian `[[Double Bracket]]` style) is deferred to a future phase or backlogged.
- **External Markdown extensions** (such as tables, blockquotes, math, and syntax-highlighted codeblocks) are out of scope for Phase 1.
