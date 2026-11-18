package com.famille.mescartes;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

public class MesCartesQuickWidgetProvider extends AppWidgetProvider {

    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String WIDGET_PAYLOAD_KEY = "mescartes_widget_payload";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_quick_cards);

        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        views.setOnClickPendingIntent(
            R.id.quick_open_wallet,
            createPendingIntent(context, 1000 + appWidgetId, openAppIntent)
        );

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String rawJson = prefs.getString(WIDGET_PAYLOAD_KEY, "[]");

        int[] slotIds = { R.id.quick_slot_1, R.id.quick_slot_2, R.id.quick_slot_3 };
        int[] titleIds = { R.id.quick_slot_1_title, R.id.quick_slot_2_title, R.id.quick_slot_3_title };
        int[] subIds = { R.id.quick_slot_1_sub, R.id.quick_slot_2_sub, R.id.quick_slot_3_sub };

        try {
            JSONArray cards = new JSONArray(rawJson);
            for (int i = 0; i < 3; i++) {
                if (i < cards.length()) {
                    JSONObject card = cards.getJSONObject(i);
                    String cardId = card.optString("id", "");
                    String brandName = card.optString("brandName", "Carte");
                    String customName = card.optString("customName", brandName);
                    String colorHex = card.optString("primaryColor", "#2563EB");

                    views.setViewVisibility(slotIds[i], View.VISIBLE);
                    views.setTextViewText(titleIds[i], customName);
                    views.setTextViewText(subIds[i], brandName);
                    try {
                        views.setInt(slotIds[i], "setBackgroundColor", Color.parseColor(colorHex));
                    } catch (IllegalArgumentException ignored) {
                        views.setInt(slotIds[i], "setBackgroundColor", Color.parseColor("#2563EB"));
                    }

                    Intent cardIntent = new Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse("mescartes://card/" + Uri.encode(cardId)),
                        context,
                        MainActivity.class
                    );
                    cardIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    views.setOnClickPendingIntent(
                        slotIds[i],
                        createPendingIntent(context, 2000 + (appWidgetId * 10) + i, cardIntent)
                    );
                } else if (cards.length() == 0 && i == 0) {
                    views.setViewVisibility(slotIds[i], View.VISIBLE);
                    views.setTextViewText(titleIds[i], "Ajouter une carte");
                    views.setTextViewText(subIds[i], "Ouvrir");
                    views.setInt(slotIds[i], "setBackgroundColor", Color.parseColor("#2563EB"));
                    views.setOnClickPendingIntent(
                        slotIds[i],
                        createPendingIntent(context, 3000 + appWidgetId, openAppIntent)
                    );
                } else {
                    views.setViewVisibility(slotIds[i], View.GONE);
                }
            }
        } catch (Exception e) {
            views.setViewVisibility(slotIds[0], View.VISIBLE);
            views.setTextViewText(titleIds[0], "Mes Cartes");
            views.setTextViewText(subIds[0], "Ouvrir");
            views.setOnClickPendingIntent(
                slotIds[0],
                createPendingIntent(context, 4000 + appWidgetId, openAppIntent)
            );
            views.setViewVisibility(slotIds[1], View.GONE);
            views.setViewVisibility(slotIds[2], View.GONE);
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static PendingIntent createPendingIntent(Context context, int requestCode, Intent intent) {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(context, requestCode, intent, flags);
    }
}
