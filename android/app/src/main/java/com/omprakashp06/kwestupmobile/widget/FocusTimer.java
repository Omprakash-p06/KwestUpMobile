package com.omprakashp06.kwestupmobile.widget;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.os.Bundle;

import com.reactnativeandroidwidget.RNWidgetProvider;

/**
 * FocusTimer widget provider.
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
 * from widgetprovider_focustimer.xml. Values are only written when the existing
 * options are 0 or absent, so real Android-measured sizes always take precedence.
 */
public class FocusTimer extends RNWidgetProvider {

    /** Minimum dimensions from widgetprovider_focustimer.xml */
    private static final int MIN_WIDTH_DP  = 250;
    private static final int MIN_HEIGHT_DP = 100;

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int widgetId : appWidgetIds) {
            ensureFallbackSize(context, appWidgetManager, widgetId);
        }
        super.onUpdate(context, appWidgetManager, appWidgetIds);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager appWidgetManager, int appWidgetId, Bundle newOptions) {
        ensureFallbackSize(context, appWidgetManager, appWidgetId);
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions);
    }

    /**
     * Seeds fallback dimensions directly into AppWidgetManager options so that
     * RNWidgetUtil.getWidgetWidth/Height() returns a non-zero value on first render.
     * Only writes when the stored value is 0 or absent (Android hasn't measured yet).
     */
    private void ensureFallbackSize(Context context, AppWidgetManager appWidgetManager, int widgetId) {
        Bundle options = appWidgetManager.getAppWidgetOptions(widgetId);

        int minWidth  = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,  0);
        int maxWidth  = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH,  0);
        int minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
        int maxHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 0);

        if (minWidth <= 0 || maxWidth <= 0 || minHeight <= 0 || maxHeight <= 0) {
            Bundle newOptions = new Bundle();
            newOptions.putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH,   minWidth > 0 ? minWidth : MIN_WIDTH_DP);
            newOptions.putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH,   maxWidth > 0 ? maxWidth : MIN_WIDTH_DP);
            newOptions.putInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT,  minHeight > 0 ? minHeight : MIN_HEIGHT_DP);
            newOptions.putInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT,  maxHeight > 0 ? maxHeight : MIN_HEIGHT_DP);
            appWidgetManager.updateAppWidgetOptions(widgetId, newOptions);
        }
    }
}
