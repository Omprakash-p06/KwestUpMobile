# Codebase Structure

**Analysis Date:** 2025-05-17

## Directory Layout

```
KwestUpMobile/
├── assets/             # Static assets (icons, splash screens)
├── AppIcons(1)/        # Raw app icon assets for Android and iOS
├── test-app/           # Default Expo template (unused/reference)
├── App.js              # Monolithic main application entry and implementation
├── app.json            # Expo configuration
├── babel.config.js     # Babel configuration
├── index.js            # Expo entry point
├── metro.config.js     # Metro bundler configuration
├── package.json        # Project dependencies and scripts
└── README.md           # Project documentation
```

## Directory Purposes

**Root (`/`):**
- Purpose: Contains all source code and configuration.
- Contains: Configuration files, entry points, and the main application logic.
- Key files: `App.js`, `index.js`, `app.json`, `package.json`.

**assets/:**
- Purpose: Stores static images and icons used by Expo and the app.
- Contains: PNG and ICO files for icons and splash screens.
- Key files: `icon.png`, `splash-icon.png`.

**AppIcons(1)/:**
- Purpose: Source assets for mobile app icons.
- Contains: Android mipmap structures and iOS xcassets.

**test-app/:**
- Purpose: Appears to be a boilerplate Expo app, possibly used for testing or as a scratchpad.
- Contains: A minimal Expo project structure.

## Key File Locations

**Entry Points:**
- `index.js`: The root entry point that registers the main component using Expo's `registerRootComponent`.
- `App.js`: The primary entry point for the application logic and UI.

**Configuration:**
- `app.json`: Expo-specific configuration (name, slug, version, orientation, icons, etc.).
- `package.json`: Manages dependencies (React Native, Expo, React Navigation, etc.) and scripts.
- `metro.config.js`: Configuration for the Metro bundler.
- `babel.config.js`: Babel presets configuration.

**Core Logic:**
- `App.js`: Contains all business logic, state management, components, and screen routes.

**Testing:**
- Not detected (no dedicated test directory or files like `*.test.js` found in the main project).

## Naming Conventions

**Files:**
- CamelCase or kebab-case for configuration files (e.g., `babel.config.js`, `package-lock.json`).
- PascalCase for the main component file (`App.js`).

**Directories:**
- kebab-case or simple lowercase (e.g., `test-app`, `assets`).

## Where to Add New Code

**New Feature:**
- Currently, new features are added directly into `App.js`. However, it is highly recommended to create a `src/` directory and modularize the components.

**New Component/Module:**
- Components should ideally be moved to `src/components/`.
- Screen routes should be moved to `src/screens/`.

**Utilities:**
- Helper functions (like notification scheduling or data persistence) should be moved to `src/utils/`.

## Special Directories

**assets/:**
- Purpose: Managed by Expo for bundling static resources.
- Generated: No
- Committed: Yes

---

*Structure analysis: 2025-05-17*
