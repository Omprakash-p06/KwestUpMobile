# Phase 1: Architectural Foundation - Research

**Researched:** 2026-05-17
**Domain:** React Native / Expo Architecture & Performance
**Confidence:** HIGH

## Summary

This research establishes the technical foundation for KwestUp Mobile, prioritizing high performance and low memory footprint for budget Android devices (Android 10+). The core recommendation is to leverage **Expo SDK 55** (current stable as of research) which mandates the **Hermes engine** and enables the **New Architecture (Bridgeless Mode)** by default. 

**Primary recommendation:** Use **Expo Router** for navigation, **Zustand** for state management, and a hybrid storage approach combining **expo-sqlite** for relational data and **react-native-mmkv** for high-speed key-value persistence.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `expo` | 55.0.24 | Framework | Modern React Native foundation with New Architecture and Hermes by default. |
| `expo-router` | 55.0.14 | Navigation | Native-first, file-based routing built on React Navigation 7; optimized for Expo. |
| `zustand` | 5.0.13 | State Management | Ultra-lightweight (~1KB), selector-based, minimal re-render overhead. |
| `expo-sqlite` | 55.0.16 | Primary Storage | JSI-based SQLite for relational data; essential for complex entities (Tasks, Finances). |
| `react-native-mmkv` | 4.3.1 | KV Storage | Synchronous JSI storage; 10x+ faster than AsyncStorage for hot data. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|--------------|
| `@shopify/flash-list` | 2.3.1 | List UI | Use instead of `FlatList` for all lists to prevent jank on low-end Android. |
| `react-native-reanimated`| 4.3.1 | Animations | UI-thread animations that don't block the JS thread. |
| `expo-file-system` | 55.x | File Operations | Needed for database backups and file management. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `zustand` | `Redux Toolkit` | RTK is more robust but ~30x larger in bundle size and has higher runtime memory overhead. |
| `expo-sqlite` | `Realm` | Realm is powerful but adds significant binary size and can be overkill for a lightweight app. |
| `expo-router` | `React Navigation` | Expo Router uses React Navigation under the hood; direct usage offers more control but loses file-based modularity. |

**Installation:**
```bash
npx expo install expo-router zustand expo-sqlite react-native-mmkv @shopify/flash-list react-native-reanimated
```

## Architecture Patterns

### Recommended Project Structure
```
app/                 # Expo Router (File-based navigation)
├── (auth)/          # Authentication routes
├── (tabs)/          # Main feature tabs (Tasks, Finance, Goals)
│   ├── tasks/
│   ├── finance/
│   └── goals/
└── _layout.tsx      # Root layout / Providers
src/
├── components/      # Shared UI components
├── store/           # Zustand stores (modularized)
├── db/              # SQLite schema and repositories
├── hooks/           # Custom hooks
└── utils/           # Helpers and constants
```

### Pattern 1: Modular Zustand Stores
**What:** Separate state into logical modules (e.g., `useTaskStore`, `useFinanceStore`) rather than a single monolithic store.
**When to use:** Multi-module apps to keep memory footprint low and logic isolated.
**Example:**
```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '../utils/storage';

export const useTaskStore = create()(
  persist(
    (set) => ({
      tasks: [],
      addTask: (task) => set((state) => ({ tasks: [...state.tasks, task] })),
    }),
    {
      name: 'task-storage',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
```

### Pattern 2: Relational Data with SQLite Repositories
**What:** Use the "Repository Pattern" to abstract SQLite queries.
**When to use:** Whenever interacting with `Tasks`, `Expenses`, or `Birthdays`.
**Example:**
```typescript
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('kwestup.db');

export const TaskRepository = {
  getAll: () => db.getAllSync('SELECT * FROM tasks'),
  add: (title: string) => db.runSync('INSERT INTO tasks (title) VALUES (?)', title),
};
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| List Rendering | Custom scroll views | `FlashList` | Virtualization is hard; recycling views is even harder to get right for performance. |
| Storage Sync | Manual file writes | `Zustand Persist` | Handling JSON serialization and race conditions manually is error-prone. |
| Deep Linking | Manual URL parsing | `Expo Router` | Framework-level handling is more robust and zero-config. |

## Common Pitfalls

### Pitfall 1: FlatList on Low-End Android
**What goes wrong:** "Blank cells" and heavy scroll jank.
**Why it happens:** Constant mount/unmount cycle of components exceeds CPU capacity.
**How to avoid:** Always use `FlashList` with a correct `estimatedItemSize`.

### Pitfall 2: Blocking the UI Thread with MMKV
**What goes wrong:** Micro-stutters during heavy storage writes.
**Why it happens:** MMKV is synchronous; while fast, large writes can still hold up the JS thread.
**How to avoid:** Use `InteractionManager.runAfterInteractions` or ensure writes are triggered by background events.

### Pitfall 3: Large JS Bundle Startup
**What goes wrong:** App takes 5-10 seconds to start on budget devices.
**Why it happens:** Large dependency trees and lack of tree-shaking.
**How to avoid:** Use Expo SDK 55's experimental tree shaking and avoid "kitchen sink" UI libraries.

## Code Examples

### Zustand + MMKV Persistence Adapter
```typescript
// src/utils/storage.ts
import { MMKV } from 'react-native-mmkv';
import { StateStorage } from 'zustand/middleware';

const storage = new MMKV();

export const mmkvStorage: StateStorage = {
  setItem: (name, value) => storage.set(name, value),
  getItem: (name) => storage.getString(name) ?? null,
  removeItem: (name) => storage.delete(name),
};
```

### High-Performance FlashList Usage
```tsx
import { FlashList } from "@shopify/flash-list";

const MyList = ({ data }) => {
  return (
    <FlashList
      data={data}
      renderItem={({ item }) => <TaskItem task={item} />}
      estimatedItemSize={70} // Critical for low-end Android performance
      keyExtractor={(item) => item.id}
    />
  );
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Bridge Architecture | Bridgeless Mode | Expo SDK 52+ | Near-zero overhead for Native-to-JS calls (JSI). |
| AsyncStorage | MMKV / SQLite Next | 2023-2024 | Massive performance gain in read/write speed. |
| FlatList | FlashList | 2022+ | Smooth scrolling on budget hardware via recycling. |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest + React Native Testing Library |
| Config file | `jest.config.js` |
| Quick run command | `npm test` |
| Full suite command | `npm test -- --coverage` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-01 | Smooth navigation & Startup | E2E (Maestro) | `maestro test .maestro/startup.yaml` | ❌ Wave 0 |
| PERF-02 | Fast SQLite access | Integration | `npm test src/db/__tests__/sqlite.test.ts` | ❌ Wave 0 |

## Sources

### Primary (HIGH confidence)
- [Expo Documentation] - SDK 55 Release Notes & New Architecture Guide.
- [Shopify FlashList Docs] - Performance tuning and recycling patterns.
- [Zustand Docs] - Middleware and persistence patterns.

### Secondary (MEDIUM confidence)
- [React Native Performance Blog] - Benchmarks for low-end Android (2024).
- [MMKV GitHub] - JSI implementation details.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Current versions verified via npm.
- Architecture: HIGH - Industry standard for modern Expo apps.
- Pitfalls: HIGH - Well-documented performance bottlenecks in RN ecosystem.

**Research date:** 2026-05-17
**Valid until:** 2026-08-17 (fast-moving ecosystem)
