package com.omprakashp06.kwestupmobile.widget;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.SharedPreferences;

import com.reactnativeandroidwidget.RNWidgetProvider;

/**
 * TasksList widget provider.
 *
 * Overrides onUpdate to ensure a non-zero fallback dimension is always stored
 * in SharedPreferences before the background render task is enqueued.
 *
 * Root cause: On WIDGET_ADDED (and sometimes after reboot), Android hasn't
 * measured the widget yet, so AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH
 * returns 0. The library's WidgetFactory then creates a 0×0 Bitmap, which
 * renders as a completely transparent / invisible widget.
 *
 * Fix: Before super.onUpdate() is called (which reads the stored sizes), we
 * write the minimum widget dimensions into the same SharedPreferences store
 * the library uses, but only when the stored value is 0 or absent. This
 * ensures the Bitmap is always at least minWidth × minHeight in size.
 */
public class TasksList extends RNWidgetProvider {

    /** Minimum dimensions from widgetprovider_taskslist.xml */
    private static final int MIN_WIDTH_DP  = 250;
    private static final int MIN_HEIGHT_DP = 180;

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int widgetId : appWidgetIds) {
            ensureFallbackSize(context, widgetId);
        }
        super.onUpdate(context, appWidgetManager, appWidgetIds);
    }

    /**
     * Writes fallback dimensions into the library's SharedPreferences store
     * (package.WIDGET_SIZES) only when the existing stored value is 0 or -1
     * (i.e. the widget hasn't been measured by Android yet).
     */
    private void ensureFallbackSize(Context context, int widgetId) {
        String prefName = context.getPackageName() + ".WIDGET_SIZES";
        SharedPreferences prefs = context.getSharedPreferences(prefName, Context.MODE_PRIVATE);

        int storedWidth  = prefs.getInt(widgetId + "-width",  0);
        int storedHeight = prefs.getInt(widgetId + "-height", 0);

        if (storedWidth <= 0 || storedHeight <= 0) {
            prefs.edit()
                .putInt(widgetId + "-width",  MIN_WIDTH_DP)
                .putInt(widgetId + "-height", MIN_HEIGHT_DP)
                .apply();
        }
    }
}
