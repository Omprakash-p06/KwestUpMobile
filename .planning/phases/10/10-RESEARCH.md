# Phase 10: Tactile Industrial UI Redesign - Research

**Researched:** 2026-06-02  
**Domain:** Tactile Skeuomorphic UI / High-Contrast Industrial Theme / Typography & Layout  
**Confidence:** HIGH

---

## Summary

This phase implements a complete visual rebuild of the KwestUp Mobile application, moving from soft glassmorphism into a **Tactile, Industrial, High-Contrast Monochromatic UI**. The design mimics physical industrial consoles and high-performance productivity terminals as specified in `/UI Design plan`.

### Key Design Pillars

1. **Perfect Square Rectangles**: Strict `borderRadius: 0` roundedness philosophy across all buttons, inputs, cards, and modal dialogs.
2. **Monochromatic Industrial Palette**:
   - Primary: White (`#FFFFFF`) for active state and headers.
   - Secondary: Deep pitch-black (`#000000`) and Obsidian (`#131313`) for backgrounds.
   - Tertiary: Grays (`#20201F`, `#2A2A2A`, `#353535`) as surface materials (brushed metal, fabric, recycled paper).
3. **Advanced Typography**: Integrate `Hanken Grotesk` (HankenGrotesk_800ExtraBold for headings) and `JetBrains Mono` (JetBrainsMono_500Medium for monospaced metadata and AI logs).
4. **Outward/Raised Material Bevels**:
   - 1px top-left white/translucent border highlight, and 2px bottom-right dark shadow stroke to simulate machined physical buttons.
5. **Checked Checkboxes**: Square outline with an "X" mark inside when checked, instead of a traditional checkmark, matching the edgy digital-terminal style.
6. **AI Scanning Effect**: Animated glassmorphic cards with a moving horizontal laser scanning line.

---

## Technical Feasibility & Font Loading

Expo supports loading custom Google fonts dynamically via `useFonts`. We will install:
- `@expo-google-fonts/hanken-grotesk`
- `@expo-google-fonts/jetbrains-mono`

### Package Installation Command
```bash
npx expo install @expo-google-fonts/hanken-grotesk @expo-google-fonts/jetbrains-mono
```

### Loading Fonts in App.js
```javascript
import { useFonts } from "expo-font";
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold
} from "@expo-google-fonts/hanken-grotesk";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold
} from "@expo-google-fonts/jetbrains-mono";

// Inside App component:
const [fontsLoaded] = useFonts({
  "HankenGrotesk-Regular": HankenGrotesk_400Regular,
  "HankenGrotesk-Medium": HankenGrotesk_500Medium,
  "HankenGrotesk-Bold": HankenGrotesk_700Bold,
  "HankenGrotesk-ExtraBold": HankenGrotesk_800ExtraBold,
  "JetBrainsMono-Regular": JetBrainsMono_400Regular,
  "JetBrainsMono-Medium": JetBrainsMono_500Medium,
  "JetBrainsMono-Bold": JetBrainsMono_700Bold,
});
```

---

## Font Family Injector Refactor

We will update the `injectFontFamily` helper inside `src/theme/styles.js` to map fonts as follows:
- **Headings** (fontWeight >= 700): `HankenGrotesk-ExtraBold` or `HankenGrotesk-Bold`
- **Body & Secondary text**: `HankenGrotesk-Regular` or `HankenGrotesk-Medium`
- **Technical labels / Mono / Code**: `JetBrainsMono-Medium` or `JetBrainsMono-Regular`

---

## Components Redesign Blueprint

### 1. LiquidGlassBackground.js (Brushed Steel & Stardust Grain)
- Uses `LinearGradient` from `expo-linear-gradient` to create a dynamic brushed metal texture in Dark Mode:
  - Gradient: `['#131313', '#20201f', '#2a2a2a', '#20201f', '#131313']` (representing cold horizontal reflections).
- Light Mode: Uses a recycled warm "Paper" grain texture overlay.
- AMOLED Mode: Absolute pitch black `#000000`.
- All modes overlay a subtle stardust noise png.

### 2. LiquidGlassCard.js (Beveled Industrial Console plates)
- Perfect `borderRadius: 0` sharp angles.
- Heavy `borderWidth: 2`, `borderColor: '#8e9192'`.
- Raised bevel styling using double layers or precise border outlines.
- Top-left 1px white border overlay, bottom-right 2px black border offset.

### 3. Checkboxes & Checklists (X Marks)
- Replaces blank outline checkbox with:
  - Checked: Custom box containing a bold **X** (using `close` Material icon in white on black background).
  - Unchecked: Empty square container with `borderWidth: 2`, `borderColor: '#8e9192'`.

### 4. CustomButton.js (Mechanical Switch Buttons)
- Rebuild buttons as full high-contrast blocks.
- Primary: Solid White background with black text.
- Secondary: Solid Black background with a white 2px border.
- On active/press state: Trigger an color inversion effect (e.g. White becomes Black, Black becomes White) instantly with a haptic light bump to simulate physical contact click.

### 5. AI Laser Scan Animation
- Rebuild `AIAssistant.js` featured card to render a custom absolute `<Animated.View style={[styles.laser, animatedLaserStyle]} />` that loops top-to-bottom every 3 seconds to represent active neural scanning.
