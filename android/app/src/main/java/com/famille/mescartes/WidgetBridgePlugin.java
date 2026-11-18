package com.famille.mescartes;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void refreshWidgets(PluginCall call) {
        Context context = getContext();
        AppWidgetManager manager = AppWidgetManager.getInstance(context);

        int[] quickIds = manager.getAppWidgetIds(
            new ComponentName(context, MesCartesQuickWidgetProvider.class)
        );
        for (int id : quickIds) {
            MesCartesQuickWidgetProvider.updateAppWidget(context, manager, id);
        }

        int[] barcodeIds = manager.getAppWidgetIds(
            new ComponentName(context, MesCartesBarcodeWidgetProvider.class)
        );
        for (int id : barcodeIds) {
            MesCartesBarcodeWidgetProvider.updateAppWidget(context, manager, id);
        }

        call.resolve();
    }
}
