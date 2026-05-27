---
status: investigating
trigger: "User wants Notes architecture to run on raw README/Markdown files (Obsidian-style) but with instant synchronization (Notion-style)"
created: 2026-05-28T00:49:37+05:30
updated: 2026-05-28T00:49:37+05:30
---

## Current Focus

hypothesis: Storing notes as individual `.md` files inside the local filesystem using `expo-file-system` will provide a true Obsidian-style file architecture, while keeping a light metadata cache in AsyncStorage for Notion-style instant syncing.
test: Install `expo-file-system` and re-write the notes database and UI layer to utilize real directories and markdown files.
expecting: Notes are written, read, and deleted as real `.md` files, while folder structures match actual subdirectories.
next_action: install expo-file-system and implement local file repository

## Symptoms

expected: Notes are standard Markdown files stored in folders on the phone's local storage (Obsidian-style) and synchronized in the background (Notion-style).
actual: Notes are currently stored as simple JSON objects inside a single AsyncStorage block.
errors: AsyncStorage blocks local file access, preventing users from opening notes with external Markdown editors.
reproduction: Inspect the notes storage code in App.js.
timeline: Requested during the Phase 1 planning gate.

## Eliminated

- AsyncStorage-only JSON array: Eliminated because it doesn't represent real local markdown files.

## Evidence

- timestamp: 2026-05-28T00:50:00+05:30
  checked: package.json and project setup
  found: The project is a standard Expo React Native app. We need to install `expo-file-system` to gain full access to the device's document directory and manage real files/folders.
  implication: We must install `expo-file-system` and create a `Notes` directory as our vault.
