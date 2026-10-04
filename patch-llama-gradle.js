const fs = require('fs');
const path = require('path');

let hasErrors = false;

// 1. Patch llama.rn for Old Architecture JSI support
const targetFile = path.join(__dirname, 'node_modules/llama.rn/android/build.gradle');

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');

  // Check if already patched (idempotency guard)
  const isAlreadyPatched = content.includes('apply plugin: "com.facebook.react"') &&
    !content.includes('if (isNewArchitectureEnabled())');

  if (isAlreadyPatched) {
    console.log('✅ llama.rn build.gradle is already patched for old architecture (idempotent skip).');
  } else {
    const pattern1 = /if\s*\(\s*isNewArchitectureEnabled\(\)\s*\)\s*\{\s*apply\s+plugin:\s+["']com\.facebook\.react["']\s*\}/g;
    content = content.replace(pattern1, 'apply plugin: "com.facebook.react"');

    const pattern2 = /if\s*\(\s*isNewArchitectureEnabled\(\)\s*\)\s*\{\s*react\s*\{([\s\S]*?)\}\s*\}/g;
    content = content.replace(pattern2, 'react {$1}');

    // Post-patch verification assertion
    if (!content.includes('apply plugin: "com.facebook.react"') || content.includes('if (isNewArchitectureEnabled())')) {
      console.error('❌ Failed to patch llama.rn build.gradle: verification assertion failed.');
      hasErrors = true;
    } else {
      fs.writeFileSync(targetFile, content, 'utf8');
      console.log('✅ Successfully patched llama.rn build.gradle for old architecture support.');
    }
  }
} else {
  console.warn('⚠️ Target file not found: ' + targetFile);
}

// 2. Patch react-native-android-widget with sizing fallbacks
const widgetUtilFile = path.join(__dirname, 'node_modules/react-native-android-widget/android/src/main/java/com/reactnativeandroidwidget/RNWidgetUtil.java');

if (fs.existsSync(widgetUtilFile)) {
  let content = fs.readFileSync(widgetUtilFile, 'utf8');

  if (content.includes('getFallbackSize')) {
    console.log('✅ react-native-android-widget RNWidgetUtil.java is already patched with sizing fallbacks (idempotent skip).');
  } else {
    const patternWidth = /public\s+static\s+int\s+getWidgetWidth\([\s\S]*?\}\s*\n\s*\n\s*public\s+static\s+int\s+getWidgetHeight\([\s\S]*?\}\s*\n/g;

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
    content = content.replace(patternWidth, replacement);

    // Post-patch verification assertion
    if (!content.includes('getFallbackSize')) {
      console.error('❌ Failed to patch react-native-android-widget RNWidgetUtil.java: verification assertion failed.');
      hasErrors = true;
    } else {
      fs.writeFileSync(widgetUtilFile, content, 'utf8');
      console.log('✅ Successfully patched react-native-android-widget RNWidgetUtil.java with sizing fallbacks.');
    }
  }
} else {
  console.warn('⚠️ RNWidgetUtil.java not found for patching: ' + widgetUtilFile);
}

if (hasErrors) {
  process.exit(1);
}
