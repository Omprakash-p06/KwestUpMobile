# Phase 5: Local On-Device AI Integration - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous mode — smart discuss)

---

## Phase Boundary

This phase integrates fully offline, on-device AI inference using `llama.rn` (the npm package wrapping `llama.cpp` for React Native). The implementation delivers:

- Native `llama.rn` bindings registered and configured for EAS Build on Android/iOS.
- A quantized `Qwen3-0.6B-Q4_K_M.gguf` model (small enough for mobile memory) downloadable via model manager.
- `src/utils/aiService.js` — Model context management, inference orchestration, progress callbacks.
- `src/components/AIAssistant.js` — Floating action button + bottom sheet overlay for AI interactions inside NotesScreen.
- Note summarization: condenses markdown note content into bullet-point summary.
- Task extraction: parses actionable sentences from note text, creates structured tasks in TaskListScreen DB.

---

## Implementation Decisions

### 1. Package Choice
- **Decision**: Use `llama.rn@0.12.4` (the de-facto React Native llama.cpp wrapper, MIT license).
- **Rationale**: Official package, 25.6MB, actively maintained, supports iOS Metal + Android OpenCL.

### 2. Model Selection
- **Decision**: Use Qwen3-0.6B GGUF Q4_K_M quantization from HuggingFace.
- **Rationale**: Fits within 512MB RAM on mid-range devices. Qwen3 excels at instruction-following for summarization and extraction tasks. Q4_K_M quantization balances quality and memory.
- **Download URL**: `https://huggingface.co/Qwen/Qwen3-0.6B-GGUF/resolve/main/qwen3-0.6b-q4_k_m.gguf`

### 3. Model Storage
- **Decision**: Download to `expo-file-system` Document directory (`${FileSystem.documentDirectory}models/`).
- **Rationale**: Persists across app restarts, accessible to llama.rn context loading.

### 4. Model Lifecycle
- **Decision**: Load/unload model context on-demand per user session (not preloaded at startup).
- **Rationale**: Avoids high RAM occupation during normal app usage. Model is loaded when user opens AI assistant, released on close.

### 5. UI Integration Point
- **Decision**: AI assistant accessible via a floating "✨ AI" button in NotesScreen when viewing a note (edit or preview mode).
- **Rationale**: Most natural context for summarize/extract since user is already viewing note content.

### 6. Progress/Download UI
- **Decision**: Show download progress modal on first use. Cache check on subsequent opens.
- **Rationale**: Users need to know the ~250MB model is downloading. Progress bar prevents confusion.

---

## Canonical References

**Downstream agents MUST read these before implementing.**

- `App.js` — State management and task creation patterns.
- `src/screens/NotesScreen.js` — Notes UI, current note state, edit/preview modes.
- `src/utils/fileStorage.js` — Filesystem patterns (Document directory, note CRUD).
- `src/utils/storage.js` — AsyncStorage helpers.
- `.planning/REQUIREMENTS.md` — LAI-01, LAI-02 requirements.

---

## Specific Ideas
- **Streaming text output**: Use `llama.rn`'s token streaming callbacks to show AI typing effect.
- **System prompt**: Use a minimal system prompt optimizing the 0.6B model for structured output.
- **Task extraction format**: Ask AI to return a JSON array of task strings, parsed client-side.

---

## Deferred Ideas
- **Background preloading**: Preload model on app startup (deferred to save RAM for normal usage).
- **Continuous chat interface**: Full back-and-forth AI chat (deferred — summarize/extract first).
- **Cloud model updates**: Remote model version checking (deferred to future milestone).
