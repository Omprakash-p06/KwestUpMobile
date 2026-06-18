package com.omprakashp06.kwestupmobile.widget;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.os.Bundle;

import com.reactnativeandroidwidget.RNWidgetProvider;

/**
 * DailyTasks widget provider.
 *
 * Overrides onUpdate to ensure non-zero fallback dimensions are seeded directly
 * into AppWidgetManager options BEFORE super.onUpdate() reads them.
 *
 * Root cause: On WIDGET_ADDED (and sometimes after reboot), Android hasn't
 * measured the widget yet, so AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH
 * returns 0. The library's RNWidgetUtil.getWidgetWidth() reads directly from
 * AppWidgetManager.getAppWidgetOptions() — NOT from SharedPreferences — so the
 * previous SharedPreferences fix had no effect.
 *
 * Fix: Before super.onUpdate() is called, we call
 * appWidgetManager.updateAppWidgetOptions() to inject the minimum dimensions
 * from widgetprovider_dailytasks.xml. Values are only written when the existing
 * options are 0 or absent, so real Android-measured sizes always take precedence.
 */
public class DailyTasks extends RNWidgetProvider {

    /** Minimum dimensions from widgetprovider_dailytasks.xml */
    private static final int MIN_WIDTH_DP  = 250;
    private static final int MIN_HEIGHT_DP = 100;

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int widgetId : appWidgetIds) {
            ensureFallbackSize(context, appWidgetManager, widgetId);
        }
        super.onUpdate(context, appWidgetManager, appWidgetIds);
    }

    /**
     * Seeds fallback dimensions directly into AppWidgetManager options so that
     * RNWidgetUtil.getWidgetWidth/Height() returns a non-zero value on first render.
     * Only writes when the stored value is 0 or absent (Android hasn't measured yet).
     */
    private void ensureFallbackSize(Context context, AppWidgetManager appWidgetManager, int widgetId) {
        Bundle options = appWidgetManager.getAppWidgetOptions(widgetId);

        int minWidth  = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,  0);
        int minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);

        if (minWidth <= 0 || minHeight <= 0) {
            Bundle newOptions = new Bundle();
            newOptions.putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,   MIN_WIDTH_DP);
            newOptions.putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH,   MIN_WIDTH_DP);
            newOptions.putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,  MIN_HEIGHT_DP);
            newOptions.putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT,  MIN_HEIGHT_DP);
            appWidgetManager.updateAppWidgetOptions(widgetId, newOptions);
        }
    }
}
