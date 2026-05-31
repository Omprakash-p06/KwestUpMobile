/**
 * Phase 9 (Android Home-Screen Widgets) Structural Validation Script
 *
 * This script statically checks imports, parameters, exports, and integrations
 * to verify that the widgets system behaves exactly as designed.
 */

const fs = require('fs');
const path = require('path');

let failures = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failures++;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

console.log("=== RUNNING PHASE 9 STRUCTURAL VALIDATION ===\n");

// 1. Validate FocusTimerWidget.tsx
const focusTimerPath = path.resolve(__dirname, '../widgets/FocusTimerWidget.tsx');
assert(fs.existsSync(focusTimerPath), 'widgets/FocusTimerWidget.tsx exists');

if (fs.existsSync(focusTimerPath)) {
  const content = fs.readFileSync(focusTimerPath, 'utf8');
  assert(content.includes("'use no memo'"), "FocusTimerWidget has 'use no memo' compiler opt-out");
  assert(content.includes("export function FocusTimerWidget"), "FocusTimerWidget exports FocusTimerWidget");
  assert(content.includes("FlexWidget") && content.includes("TextWidget"), "FocusTimerWidget uses Widget layout primitives");
  assert(!content.includes("from 'react-native'"), "FocusTimerWidget does NOT import from react-native (Android Widget purity)");
}

// 2. Validate DailyTasksWidget.tsx
const dailyTasksPath = path.resolve(__dirname, '../widgets/DailyTasksWidget.tsx');
assert(fs.existsSync(dailyTasksPath), 'widgets/DailyTasksWidget.tsx exists');

if (fs.existsSync(dailyTasksPath)) {
  const content = fs.readFileSync(dailyTasksPath, 'utf8');
  assert(content.includes("'use no memo'"), "DailyTasksWidget has 'use no memo' compiler opt-out");
  assert(content.includes("export function DailyTasksWidget"), "DailyTasksWidget exports DailyTasksWidget");
  assert(content.includes("FlexWidget") && content.includes("TextWidget"), "DailyTasksWidget uses Widget layout primitives");
  assert(!content.includes("from 'react-native'"), "DailyTasksWidget does NOT import from react-native (Android Widget purity)");
}

// 3. Validate widget-task-handler.tsx
const handlerPath = path.resolve(__dirname, '../widgets/widget-task-handler.tsx');
assert(fs.existsSync(handlerPath), 'widgets/widget-task-handler.tsx exists');

if (fs.existsSync(handlerPath)) {
  const content = fs.readFileSync(handlerPath, 'utf8');
  assert(content.includes("export async function widgetTaskHandler"), "widget-task-handler exports widgetTaskHandler");
  assert(content.includes("@react-native-async-storage/async-storage"), "widget-task-handler imports AsyncStorage");
  assert(content.includes("STORAGE_VERSION"), "widget-task-handler imports dynamic STORAGE_VERSION");
  assert(content.includes("kwestup_data_${STORAGE_VERSION}"), "widget-task-handler uses dynamic kwestup_data_${STORAGE_VERSION} storage key");
  assert(content.includes("FocusTimerWidget") && content.includes("DailyTasksWidget"), "widget-task-handler references FocusTimerWidget and DailyTasksWidget");
}

// 4. Validate app.json Configuration
const appJsonPath = path.resolve(__dirname, '../app.json');
assert(fs.existsSync(appJsonPath), 'app.json exists');

if (fs.existsSync(appJsonPath)) {
  const content = fs.readFileSync(appJsonPath, 'utf8');
  assert(content.includes("react-native-android-widget"), "app.json includes react-native-android-widget config plugin");
  assert(content.includes("FocusTimer") && content.includes("DailyTasks"), "app.json defines FocusTimer and DailyTasks widgets");
  assert(content.includes("./assets/widget-preview/focus-timer-preview.png"), "app.json defines FocusTimer preview path");
  assert(content.includes("./assets/widget-preview/daily-tasks-preview.png"), "app.json defines DailyTasks preview path");
}

// 5. Validate index.js Integration
const indexPath = path.resolve(__dirname, '../index.js');
assert(fs.existsSync(indexPath), 'index.js exists');

if (fs.existsSync(indexPath)) {
  const content = fs.readFileSync(indexPath, 'utf8');
  assert(content.includes("registerWidgetTaskHandler"), "index.js imports or calls registerWidgetTaskHandler");
  assert(content.includes("widgetTaskHandler"), "index.js imports or references widgetTaskHandler");

  // Assert order: registerRootComponent before registerWidgetTaskHandler
  const rootIdx = content.indexOf('registerRootComponent(App)');
  const widgetIdx = content.indexOf('registerWidgetTaskHandler(widgetTaskHandler)');
  assert(rootIdx < widgetIdx, "index.js calls registerRootComponent before registerWidgetTaskHandler");
}

// 6. Validate App.js Integration
const appPath = path.resolve(__dirname, '../App.js');
assert(fs.existsSync(appPath), 'App.js exists');

if (fs.existsSync(appPath)) {
  const content = fs.readFileSync(appPath, 'utf8');
  assert(content.includes("requestWidgetUpdate"), "App.js imports or references requestWidgetUpdate");
  assert(content.includes("FocusTimerWidget") && content.includes("DailyTasksWidget"), "App.js imports FocusTimerWidget and DailyTasksWidget");
  assert(content.includes("Platform.OS === 'android'"), "App.js limits widget updating to Platform.OS === 'android'");
  assert(content.includes("debounceTimer"), "App.js includes a debounce timer for updating widgets");
  assert(content.includes("clearTimeout(debounceTimer)"), "App.js clears the debounce timer on effect cleanup");
}

// 7. Validate Widget Previews on Disk
const focusPreviewPath = path.resolve(__dirname, '../assets/widget-preview/focus-timer-preview.png');
const tasksPreviewPath = path.resolve(__dirname, '../assets/widget-preview/daily-tasks-preview.png');
assert(fs.existsSync(focusPreviewPath), 'assets/widget-preview/focus-timer-preview.png exists');
assert(fs.existsSync(tasksPreviewPath), 'assets/widget-preview/daily-tasks-preview.png exists');

console.log("\n=== VALIDATION SUMMARY ===");
if (failures > 0) {
  console.error(`❌ Structural validation failed with ${failures} error(s).`);
  process.exit(1);
} else {
  console.log("💚 All structural validation checks passed successfully!");
  process.exit(0);
}
