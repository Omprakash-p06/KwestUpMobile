# Phase 2 Context: Google Tasks-style Task Management

This document records the architectural context and design decisions established during the research and development of **Phase 2: Google Tasks-style Task Management**.

---

## Architectural Decisions

### 1. Relational Lists Category Schema
* We decided to model lists using a unified `taskLists` array in the core `App.js` state.
* Each individual task holds a relational pointer (`listId`) linking it to its parent list category. If `listId` is omitted, it defaults to the seeded `"default_inbox"` list to avoid floating orphan records.
* This keeps data structures completely flat and guarantees 100% compatibility with KwestUp's upcoming Wi-Fi synchronization network.

### 2. Bidirectional Swipe Coordinator
* We decided to use React Native's native `<ScrollView horizontal pagingEnabled>` swiper instead of heavy, buggy JS-based swiper libraries.
* This utilizes native OS paging math to snap cleanly between sheets across Android, iOS, and Web.
* A top horizontal scrollable category tab bar updates based on scroll offsets, and taps on tabs smoothly trigger standard `.scrollTo()` offsets.

### 3. Deep Mutation Mitigation
* Direct mutations inside React nested states bypass change detection triggers.
* All task and checklist modifications leverage shallow copying `array.map()` hooks to guarantee immediate UI updates and re-renders on state commits.

### 4. Safety Deletion Policy
* Deleting a custom list triggers a visual warning dialog first.
* Upon confirmation, the app performs a cascading deletion: it cancels all scheduled due-date notifications for child tasks inside that category, deletes their records, and purges the parent list cleanly.
