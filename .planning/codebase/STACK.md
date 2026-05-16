# Technology Stack

**Analysis Date:** 2025-05-17

## Languages

**Primary:**
- JavaScript (ES6+) - Used for the entire application logic, UI components, and state management in `App.js` and `index.js`.

**Secondary:**
- None detected. No TypeScript (`tsconfig.json`) or other languages found.

## Runtime

**Environment:**
- Node.js (Managed via npm)
- Expo SDK 53.0.0 (Managed via `expo` package and `app.json`)
- React Native 0.79.5

**Package Manager:**
- npm (Version not specified, but `package-lock.json` is present)
- Lockfile: `package-lock.json` present

## Frameworks

**Core:**
- React Native 0.79.5 - Cross-platform mobile framework.
- Expo ~53.0.20 - Development platform and SDK for React Native.
- React Navigation (Drawer/Native) - Routing and navigation handling.

**Testing:**
- Not detected. No test runner (Jest/Vitest) or test files found in the root directory.

**Build/Dev:**
- EAS (Expo Application Services) - Used for building and distribution (`eas.json`).
- Babel - Transpiler for JavaScript (`babel.config.js`).
- Metro - Bundler for React Native (`metro.config.js`).

## Key Dependencies

**Critical:**
- `react-native-reanimated` (~3.17.4) - Used for high-performance animations throughout `App.js`.
- `react-native-gesture-handler` (~2.24.0) - Handles complex touch gestures.
- `@react-navigation/drawer` (^6.6.6) - Implements the side panel navigation.
- `@react-native-async-storage/async-storage` (2.1.2) - Used for all persistent local storage.
- `expo-notifications` (~0.31.4) - Handles push and local notification scheduling.

**Infrastructure:**
- `react-native-paper` (^5.10.5) - Used for theming and some UI components.
- `react-native-safe-area-context` (5.4.0) - Manages UI layout around device notches and status bars.
- `expo-haptics` (~14.1.4) - Provides tactile feedback.

## Configuration

**Environment:**
- Static configuration in `App.js` (e.g., `DEBUG_MODE`, `APP_VERSION`).
- No `.env` files detected in the root (though they may be ignored).

**Build:**
- `app.json`: Expo application configuration (name, slug, version, icons).
- `eas.json`: EAS build profiles for development, preview, and production.
- `babel.config.js`: Babel presets and plugins (Reanimated).

## Platform Requirements

**Development:**
- Expo Go or EAS Development Client.
- Node.js environment.

**Production:**
- Android: APK/AAB (defined in `eas.json`).
- iOS: IPA.

---

*Stack analysis: 2025-05-17*
