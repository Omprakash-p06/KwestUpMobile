# Phase 1 Technical Research: Notion/Obsidian Markdown Notes

This document provides technical ecosystem research and patterns for implementing **Phase 1: Notion/Obsidian-style Notes** on KwestUp Mobile.

---

## Standard Stack

* **State & Core Storage**: `AsyncStorage` (from `@react-native-async-storage/async-storage`) is the established, highly robust storage layer in KwestUp. Storing notes as a unified JSON array within the core storage key guarantees immediate compatibility with the PC sync framework (which exchanges raw JSON documents).
* **Navigation**: `@react-navigation/drawer` (Drawer Navigator) and `@react-navigation/native` (already integrated in `AppNavigator.js`).
* **Visuals & Overlay Dialogues**: `react-native-modal` (pre-installed) provides fluid, hardware-accelerated popup dialogs for folder creation.
* **Icons**: `@expo/vector-icons` (MaterialCommunityIcons) for standard Obsidian/Notion-like folder, tag, notebook, edit, save, and trash icons.

---

## Architecture Patterns

* **Flat-File JSON Schema**:
  To ensure sync integrity, notes are represented as a flat array of self-contained JSON objects:
  ```typescript
  interface Note {
    id: string;
    title: string;
    content: string;
    folder: string; // Defaults to "Uncategorized"
    tags: string;   // Comma-separated list (e.g. "work, coding")
    createdAt: string;
    updatedAt: string;
  }
  ```
* **Dynamic Tag/Folder Extraction**:
  Folders and tags lists should be extracted dynamically from the `notes` list at runtime using memoized `useMemo` hooks. This prevents desynchronization between a separate folders table and the notes themselves, keeping data transfers lightweight.
* **Edit/Preview Master-Detail View**:
  A dual-mode container manages the layout. Swapping between `edit` and `preview` tabs hides/shows the inputs or the rich-text flow.

---

## Don't Hand-Roll

* **Popup Modal Overlays**: Avoid custom-designed absolute overlays or complex pointer-events blockers. Use `react-native-modal` which handles backdrop clicks, hardware back button intercepts, and slide animations out of the box.
* **Camera / Scan Utilities (For Future SYNC Phase)**: Do not try to write custom camera drivers. Use `expo-camera` or `react-native-vision-camera` when implementing QR scans.

---

## Common Pitfalls

* **JSX Unescaped Entities**: Typing raw double quotes (`"`) or single quotes (`'`) inside JSX text blocks causes instant React compilation failures (`react/no-unescaped-entities`).
  * *Fix*: Always wrap strings containing quotes inside curly braces: `{'Click "Edit" to begin'}`.
* **Nested Scroll Pitfalls**: Placing a `<FlatList>` inside a `<ScrollView>` breaks layout calculations and causes severe scrolling lag or memory leaks on low-end phones.
  * *Fix*: Use a horizontal row layout `<View style={{ flexDirection: 'row' }}>` where the Sidebar folder pane is a narrow vertical `<ScrollView>` and the main notes panel is a separate `<FlatList>` containing the note cards.

---

## Code Examples

### Custom Markdown Regex Parser
To render Markdown beautifully without bloating bundle size or introducing buggy third-party markdown packages that break under Expo updates, a custom rendering pattern translates lines using regular expressions:

```javascript
const parseInlineMarkdown = (text) => {
  const parts = [];
  let currentIdx = 0;
  
  // Matches bold (**) and italics (*)
  const regex = /(\*\*|__)(.*?)\1|(\*)(.*?)\3/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const matchIdx = match.index;
    if (matchIdx > currentIdx) {
      parts.push(text.substring(currentIdx, matchIdx));
    }
    if (match[1]) {
      parts.push(<Text key={matchIdx} style={{ fontWeight: 'bold' }}>{match[2]}</Text>);
    } else if (match[3]) {
      parts.push(<Text key={matchIdx} style={{ fontStyle: 'italic' }}>{match[4]}</Text>);
    }
    currentIdx = regex.lastIndex;
  }

  if (currentIdx < text.length) {
    parts.push(text.substring(currentIdx));
  }
  return parts.length > 0 ? parts : text;
};
```
