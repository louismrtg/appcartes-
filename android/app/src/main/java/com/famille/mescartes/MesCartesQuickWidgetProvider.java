package com.famille.mescartes;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
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
        int[] bgIds = { R.id.quick_slot_1_bg, R.id.quick_slot_2_bg, R.id.quick_slot_3_bg };
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
                    views.setImageViewBitmap(bgIds[i], drawRoundedCardBitmap(colorHex));

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
                    views.setTextViewText(subIds[i], "Ouvrir le portefeuille");
                    views.setImageViewBitmap(bgIds[i], drawRoundedCardBitmap("#2563EB"));
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
            views.setImageViewBitmap(bgIds[0], drawRoundedCardBitmap("#2563EB"));
            views.setOnClickPendingIntent(
                slotIds[0],
                createPendingIntent(context, 4000 + appWidgetId, openAppIntent)
            );
            views.setViewVisibility(slotIds[1], View.GONE);
            views.setViewVisibility(slotIds[2], View.GONE);
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static Bitmap drawRoundedCardBitmap(String hex) {
        int baseColor;
        try {
            baseColor = Color.parseColor(hex);
        } catch (IllegalArgumentException e) {
            baseColor = Color.parseColor("#2563EB");
        }
        int darkerColor = Color.rgb(
            Math.max(0, (int) (Color.red(baseColor) * 0.58)),
            Math.max(0, (int) (Color.green(baseColor) * 0.58)),
            Math.max(0, (int) (Color.blue(baseColor) * 0.58))
        );

        int w = 360;
        int h = 220;
        float radius = 38f;
        Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bmp);

        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setShader(new LinearGradient(0, 0, w, h, baseColor, darkerColor, Shader.TileMode.CLAMP));
        RectF rect = new RectF(2f, 2f, w - 2f, h - 2f);
        canvas.drawRoundRect(rect, radius, radius, paint);

        // Reflet subtil en haut a droite
        Paint gloss = new Paint(Paint.ANTI_ALIAS_FLAG);
        gloss.setColor(Color.argb(34, 255, 255, 255));
        canvas.drawCircle(w * 0.85f, h * 0.12f, w * 0.34f, gloss);

        // Bordure legere
        Paint stroke = new Paint(Paint.ANTI_ALIAS_FLAG);
        stroke.setStyle(Paint.Style.STROKE);
        stroke.setStrokeWidth(2.5f);
        stroke.setColor(Color.argb(72, 255, 255, 255));
        canvas.drawRoundRect(rect, radius, radius, stroke);

        return bmp;
    }

    private static PendingIntent createPendingIntent(Context context, int requestCode, Intent intent) {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(context, requestCode, intent, flags);
    }
}
