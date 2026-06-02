---
phase: 10
slug: industrial-ui
status: pending
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-02
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — visual UI redesign requires visual validation on simulator/emulator |
| **Config file** | N/A |
| **Quick run command** | `npx expo start` (requires hot reload to view layout transformations) |
| **Full suite command** | `npx eslint src/components/LiquidGlassBackground.js src/components/LiquidGlassCard.js src/screens/NotesScreen.js src/components/CustomButton.js src/components/AIAssistant.js src/components/TaskCard.js` |
| **Estimated runtime** | ~5 seconds (ESLint checks) |

---

## Sampling Rate

- **After every task commit:** Run `npx eslint` to verify syntax sanity and zero compilation warnings or errors.
- **After every plan wave:** Refresh the Metro bundler, toggle Light/Dark/AMOLED modes, and visually verify sharp corners and textures.
- **Before final sign-off:** Verify all screen elements successfully render Hanken Grotesk / JetBrains Mono fonts and checked checkboxes show "X" marks.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | UI-02 | N/A | N/A | config | `grep -q "hanken-grotesk" package.json` | ⬜ pending | ⬜ pending |
| 10-01-02 | 01 | 1 | UI-02 | N/A | N/A | config | `grep -q "HankenGrotesk-ExtraBold" App.js` | ⬜ pending | ⬜ pending |
| 10-01-03 | 01 | 1 | UI-02 | N/A | N/A | build | `grep -q "HankenGrotesk-ExtraBold" src/theme/styles.js` | ⬜ pending | ⬜ pending |
| 10-01-04 | 01 | 1 | UI-02 | N/A | N/A | build | `grep -q "LinearGradient" src/components/LiquidGlassBackground.js` | ⬜ pending | ⬜ pending |
| 10-01-05 | 01 | 1 | UI-02 | N/A | N/A | build | `grep -q "borderRadius: 0" src/components/LiquidGlassCard.js` | ⬜ pending | ⬜ pending |
| 10-02-01 | 02 | 2 | UI-03 | N/A | N/A | build | `grep -q "Pressable" src/components/CustomButton.js` | ⬜ pending | ⬜ pending |
| 10-02-02 | 02 | 2 | UI-03 | N/A | N/A | build | `grep -q "close" src/screens/NotesScreen.js` | ⬜ pending | ⬜ pending |
| 10-02-03 | 02 | 2 | UI-03 | N/A | N/A | build | `grep -q "close" src/components/TaskCard.js` | ⬜ pending | ⬜ pending |
| 10-02-04 | 02 | 2 | UI-03 | N/A | N/A | build | `grep -q "scanAnim" src/components/AIAssistant.js` | ⬜ pending | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Buttons display sharp corners and mechanical color inversion on press | UI-03 | Press active UI states | 1. Press and hold any button in the app. 2. Verify background and text colors invert instantly. 3. Confirm lightweight haptic pulse is triggered. |
| Checked checklists and tasks display square outline and bold "X" | UI-03 | Visual presentation | 1. Toggle checklist in Notes Preview tab, or complete a Task in Tasks list. 2. Verify checked items show an "X" mark inside a perfect square instead of a checkmark. |
| AI banner displays a moving horizontal laser scanning line | UI-03 | CSS animation loop | 1. Open the offline AI Assistant. 2. Verify a 1px white horizontal laser scanning line loops smoothly top-to-bottom every 3 seconds. |
| All custom typography uses Hanken Grotesk & JetBrains Mono | UI-02 | Typography loading | 1. Check screen headers, titles, and body texts. 2. Confirm display headings use extra-bold geometric sans and logs/technical labels use monospace JetBrains Mono. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] No watch-mode flags
- [x] Feedback latency < 900s
- [x] `nyquist_compliant: true` set in frontmatter
