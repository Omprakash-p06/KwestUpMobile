const fs = require('fs');
const path = require('path');

let hasErrors = false;

// 1. Patch llama.rn for Old Architecture JSI support
const targetFile = path.join(__dirname, 'node_modules/llama.rn/android/build.gradle');

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');

  const pattern1 = /if\s*\(\s*isNewArchitectureEnabled\(\)\s*\)\s*\{\s*apply\s+plugin:\s+["']com\.facebook\.react["']\s*\}/g;
  const pattern2 = /if\s*\(\s*isNewArchitectureEnabled\(\)\s*\)\s*\{\s*react\s*\{([\s\S]*?)\}\s*\}/g;

  // WR-02: per-pattern patchable detection. A global
  // `content.includes('if (isNewArchitectureEnabled())')` conflates unrelated
  // conditionals elsewhere in the file with the two conditional wrappers this
  // script owns, causing false-fails (hard exit 1) and false-skips. Only the
  // two regexes below count as "needs patch".
  // Note: patterns use /g, so reset lastIndex before each .test().
  pattern1.lastIndex = 0;
  const hasPatchable1 = pattern1.test(content);
  pattern1.lastIndex = 0;
  pattern2.lastIndex = 0;
  const hasPatchable2 = pattern2.test(content);
  pattern2.lastIndex = 0;
  const hasUnwrappedPlugin = content.includes('apply plugin: "com.facebook.react"');

  if (!hasPatchable1 && !hasPatchable2 && hasUnwrappedPlugin) {
    console.log('✅ llama.rn build.gradle is already patched for old architecture (idempotent skip).');
  } else {
    const before1 = content;
    content = content.replace(pattern1, 'apply plugin: "com.facebook.react"');
    const didPatch1 = content !== before1;

    const before2 = content;
    content = content.replace(pattern2, 'react {$1}');
    const didPatch2 = content !== before2;

    if (!didPatch1 && !didPatch2) {
      console.error('❌ Failed to patch llama.rn build.gradle: neither target pattern matched. The upstream file layout may have changed — update the patterns in patch-llama-gradle.js.');
      hasErrors = true;
    } else {
      // Post-patch verification asserts on the owned patterns (not a global
      // substring), so unrelated `isNewArchitectureEnabled()` blocks elsewhere
      // in the file do not fail the install.
      pattern1.lastIndex = 0;
      const stillPatchable1 = pattern1.test(content);
      pattern1.lastIndex = 0;
      pattern2.lastIndex = 0;
      const stillPatchable2 = pattern2.test(content);
      pattern2.lastIndex = 0;
      if (!content.includes('apply plugin: "com.facebook.react"') || stillPatchable1 || stillPatchable2) {
        console.error('❌ Failed to patch llama.rn build.gradle: verification assertion failed.');
        hasErrors = true;
      } else {
        fs.writeFileSync(targetFile, content, 'utf8');
        console.log('✅ Successfully patched llama.rn build.gradle for old architecture support.');
      }
    }
  }
} else {
  // WR-03: fail closed — a missing target means a required patch was not
  // applied; warn-and-continue would surface later as an obscure Gradle build
  // failure instead of a clear install error.
  console.error('❌ Target file not found, required patch not applied: ' + targetFile);
  hasErrors = true;
}

// 2. Patch react-native-android-widget with sizing fallbacks
const widgetUtilFile = path.join(__dirname, 'node_modules/react-native-android-widget/android/src/main/java/com/reactnativeandroidwidget/RNWidgetUtil.java');

if (fs.existsSync(widgetUtilFile)) {
  let content = fs.readFileSync(widgetUtilFile, 'utf8');

  const patternWidth = /public\s+static\s+int\s+getWidgetWidth\([\s\S]*?\}\s*\n\s*\n\s*public\s+static\s+int\s+getWidgetHeight\([\s\S]*?\}\s*\n/g;

  // WR-02: scope the idempotency guard to our injected patch (call signature)
  // rather than any `getFallbackSize` substring, so an upstream helper with
  // the same name but different semantics does not cause a silent skip.
  // Skip on our signature alone (not `&& !hasPatchableWidth`): our own
  // replacement re-contains a width+height pair the regex would otherwise
  // re-match, so requiring "no patchable remainder" would never skip and the
  // script would duplicate the patch on every install.
  // Note: pattern uses /g, so reset lastIndex before .test().
  const hasOurPatch = content.includes('getFallbackSize(context, widgetId');
  patternWidth.lastIndex = 0;
  const hasPatchableWidth = patternWidth.test(content);
  patternWidth.lastIndex = 0;

  if (hasOurPatch) {
    console.log('✅ react-native-android-widget RNWidgetUtil.java is already patched with sizing fallbacks (idempotent skip).');
  } else if (!hasPatchableWidth) {
    console.error('❌ Failed to patch react-native-android-widget RNWidgetUtil.java: target pattern did not match. The upstream file layout may have changed — update the pattern in patch-llama-gradle.js.');
    hasErrors = true;
  } else {
    const replacement = `public static int getWidgetWidth(Context context, int widgetId) {
        int width;
        boolean isPortrait = context.getResources().getConfiguration().orientation == ORIENTATION_PORTRAIT;
        if (isPortrait) {
            width = getWidgetSizeInDp(context, widgetId, AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH);
        } else {
            width = getWidgetSizeInDp(context, widgetId, AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH);
        }
        return width > 0 ? width : getFallbackSize(context, widgetId, false);
    }

    public static int getWidgetHeight(Context context, int widgetId) {
        int height;
        boolean isPortrait = context.getResources().getConfiguration().orientation == ORIENTATION_PORTRAIT;
        if (isPortrait) {
            height = getWidgetSizeInDp(context, widgetId, AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT);
        } else {
            height = getWidgetSizeInDp(context, widgetId, AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT);
        }
        return height > 0 ? height : getFallbackSize(context, widgetId, true);
    }

    private static int getFallbackSize(Context context, int widgetId, boolean isHeight) {
        try {
            AppWidgetProviderInfo info = AppWidgetManager.getInstance(context).getAppWidgetInfo(widgetId);
            if (info != null && info.provider != null) {
                String className = info.provider.getShortClassName();
                if (className.endsWith("TasksList")) {
                    return isHeight ? 180 : 250;
                } else if (className.endsWith("FocusTimer") || className.endsWith("DailyTasks") || className.endsWith("ImportantTasks")) {
                    return isHeight ? 100 : 250;
                }
            }
        } catch (Exception e) {
            // Safe fallback
        }
        return isHeight ? 100 : 250;
    }
`;
    const beforeWidth = content;
    content = content.replace(patternWidth, replacement);
    // WR-02: assert on what was actually transformed (replacement count), so
    // an upstream-restructured file the regex no longer matches fails with an
    // actionable message instead of a silently incomplete patch.
    const didPatchWidth = content !== beforeWidth;

    // Post-patch verification assertion
    if (!content.includes('getFallbackSize')) {
      console.error('❌ Failed to patch react-native-android-widget RNWidgetUtil.java: verification assertion failed.');
      hasErrors = true;
    } else if (!didPatchWidth && !hasOurPatch) {
      console.error('❌ Failed to patch react-native-android-widget RNWidgetUtil.java: target pattern did not match. The upstream file layout may have changed — update the pattern in patch-llama-gradle.js.');
      hasErrors = true;
    } else {
      fs.writeFileSync(widgetUtilFile, content, 'utf8');
      console.log('✅ Successfully patched react-native-android-widget RNWidgetUtil.java with sizing fallbacks.');
    }
  }
} else {
  // WR-03: fail closed — a missing target means a required patch was not
  // applied; warn-and-continue would surface later as an obscure Java build
  // failure instead of a clear install error.
  console.error('❌ RNWidgetUtil.java not found for patching, required patch not applied: ' + widgetUtilFile);
  hasErrors = true;
}

if (hasErrors) {
  process.exit(1);
}
