# Coding Conventions

**Analysis Date:** 2026-05-17

## Naming Patterns

**Files:**
- PascalCase for main entry files (`App.js`).
- kebab-case for configuration and utility files (`metro.config.js`, `babel.config.js`).

**Functions:**
- camelCase for functional components and helper functions (e.g., `requestNotificationPermissions`, `clearAllCaches`).
- PascalCase for React component definitions (e.g., `App`, `DrawerNavigator`).

**Variables:**
- UPPER_SNAKE_CASE for global constants (e.g., `BUILD_TIMESTAMP`, `APP_VERSION`, `DEBUG_MODE`).
- camelCase for local variables and state (e.g., `allKeys`, `kwestupKeys`).

**Types:**
- Not applicable (Plain JavaScript project, no TypeScript).

## Code Style

**Formatting:**
- No automated formatter (Prettier) detected in repository.
- Consistent use of double quotes for strings.
- Semicolons are generally omitted at the end of lines, but used occasionally.

**Linting:**
- No linting setup (ESLint or Biome) detected in the project (`package.json` does not include linting dependencies).

## Import Organization

**Order:**
1. React native core imports (`react`, `react-native`).
2. Third-party UI libraries (`react-native-paper`, `react-native-modal`).
3. Navigation and system libraries (`@react-navigation/...`, `expo-notifications`).
4. Other utility libraries (`AsyncStorage`, `color`).

**Path Aliases:**
- Path aliases are not used; all imports are from `node_modules`. Module decomposition is currently minimal.

## Error Handling

**Patterns:**
- `try/catch` blocks are used for asynchronous operations, primarily when reading/writing from `AsyncStorage` or executing network requests.
- Errors are logged directly to the console using `console.error("❌ ...", error)`.
- Fallback returns are provided on failure (e.g., `return false`).

## Logging

**Framework:** `console`

**Patterns:**
- Extensive use of emojis in console logs to indicate the type of action or status (e.g., `console.log("🧹 STARTING...")`, `console.log("✅ Cleared...")`, `console.error("❌ FAILED:")`).
- Debug logs are gated via a `DEBUG_MODE` constant at the top of the file, though some core startup logs bypass this.

## Comments

**When to Comment:**
- Section headers are heavily used with comments and dashes (e.g., `// --- THEME DEFINITIONS ---`).
- Inline comments explain the "why" or intent of specific configurations (e.g., `// Keep PaperProvider for theme context, but replace components`).
- Commented-out code and "TODO-like" notes are left in place (e.g., `// Optionally reset state when modal closes`).

**JSDoc/TSDoc:**
- Not used. Standard `//` comments are used for all documentation.

## Function Design

**Size:**
- The codebase follows a monolithic pattern. The main `App` component and its internal helper functions are extremely large, contained within a single `App.js` file exceeding 3,000 lines.

**Parameters:**
- Destructuring is used for React component props.

**Return Values:**
- Standard React component returns or primitive booleans for helper functions.

## Module Design

**Exports:**
- `export default` is used at the end of files (e.g., `export default App`).

**Barrel Files:**
- Not used due to the single-file structure of the core app logic.

---

*Convention analysis: 2026-05-17*