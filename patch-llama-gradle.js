const fs = require('fs');
const path = require('path');

/**
 * Postinstall native patch.
 *
 * 2026-10-12 (debug session: expo57-native-compat): the llama.rn build.gradle patch that used to
 * live here was REMOVED. It force-unwrapped llama.rn's `if (isNewArchitectureEnabled())` guards so
 * that codegen ran while `newArchEnabled=false` was set. android/gradle.properties now sets
 * `newArchEnabled=true`, which satisfies llama.rn's own gate natively (its android/build.gradle:12
 * reads the Gradle property `newArchEnabled`, :84 applies the React plugin and :239 runs the
 * codegen block on that basis) — so the workaround is redundant and was removed rather than kept
 * as a speculative native patch.
 *
 * The react-native-android-widget sizing patch below is unrelated to the New Architecture: it
 * supplies a fallback when the launcher reports a zero widget size.
 */

let hasErrors = false;

// Patch react-native-android-widget with sizing fallbacks
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
