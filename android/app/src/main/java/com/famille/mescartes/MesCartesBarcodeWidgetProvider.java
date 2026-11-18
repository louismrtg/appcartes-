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
import android.graphics.Paint;
import android.net.Uri;
import android.os.Build;
import android.view.View;
import android.widget.RemoteViews;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.common.BitMatrix;
import org.json.JSONArray;
import org.json.JSONObject;

public class MesCartesBarcodeWidgetProvider extends AppWidgetProvider {

    private static final String PREFS_NAME = "CapacitorStorage";
    private static final String WIDGET_PAYLOAD_KEY = "mescartes_widget_payload";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_barcode_direct);

        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String rawJson = prefs.getString(WIDGET_PAYLOAD_KEY, "[]");

        try {
            JSONArray cards = new JSONArray(rawJson);
            JSONObject selected = null;
            for (int i = 0; i < cards.length(); i++) {
                JSONObject candidate = cards.getJSONObject(i);
                if (candidate.optBoolean("isMainWidgetCard", false)) {
                    selected = candidate;
                    break;
                }
            }
            if (selected == null && cards.length() > 0) {
                selected = cards.getJSONObject(0);
            }

            if (selected != null) {
                String cardId = selected.optString("id", "");
                String brandName = selected.optString("brandName", "Mes Cartes");
                String customName = selected.optString("customName", brandName);
                String colorHex = selected.optString("primaryColor", "#2563EB");
                String barcodeValue = selected.optString("barcodeValue", "");
                String formatStr = selected.optString("barcodeFormat", "CODE_128");

                views.setTextViewText(R.id.barcode_widget_title, customName);
                views.setTextViewText(R.id.barcode_widget_brand, brandName);
                views.setTextViewText(R.id.barcode_widget_number, barcodeValue);
                views.setImageViewBitmap(R.id.barcode_widget_accent, drawDotBitmap(colorHex));

                Bitmap bmp = renderBarcodeBitmap(barcodeValue, formatStr);
                if (bmp != null) {
                    views.setViewVisibility(R.id.barcode_widget_image, View.VISIBLE);
                    views.setImageViewBitmap(R.id.barcode_widget_image, bmp);
                } else {
                    views.setViewVisibility(R.id.barcode_widget_image, View.GONE);
                }

                Intent cardIntent = new Intent(
                    Intent.ACTION_VIEW,
                    Uri.parse("mescartes://card/" + Uri.encode(cardId)),
                    context,
                    MainActivity.class
                );
                cardIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                views.setOnClickPendingIntent(
                    R.id.barcode_widget_root,
                    createPendingIntent(context, 5000 + appWidgetId, cardIntent)
                );
            } else {
                views.setTextViewText(R.id.barcode_widget_title, "Carte Favorite Directe");
                views.setTextViewText(R.id.barcode_widget_brand, "Mes Cartes");
                views.setTextViewText(R.id.barcode_widget_number, "Epinglez une carte dans Parametres");
                views.setImageViewBitmap(R.id.barcode_widget_accent, drawDotBitmap("#2563EB"));
                views.setViewVisibility(R.id.barcode_widget_image, View.GONE);
                views.setOnClickPendingIntent(
                    R.id.barcode_widget_root,
                    createPendingIntent(context, 5500 + appWidgetId, openAppIntent)
                );
            }
        } catch (Exception e) {
            views.setTextViewText(R.id.barcode_widget_title, "Mes Cartes");
            views.setTextViewText(R.id.barcode_widget_number, "Appuyez pour ouvrir");
            views.setImageViewBitmap(R.id.barcode_widget_accent, drawDotBitmap("#2563EB"));
            views.setViewVisibility(R.id.barcode_widget_image, View.GONE);
            views.setOnClickPendingIntent(
                R.id.barcode_widget_root,
                createPendingIntent(context, 5800 + appWidgetId, openAppIntent)
            );
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static Bitmap drawDotBitmap(String hex) {
        int color;
        try {
            color = Color.parseColor(hex);
        } catch (IllegalArgumentException e) {
            color = Color.parseColor("#2563EB");
        }
        Bitmap bmp = Bitmap.createBitmap(42, 42, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bmp);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(color);
        canvas.drawCircle(21f, 21f, 18f, p);
        p.setStyle(Paint.Style.STROKE);
        p.setStrokeWidth(3f);
        p.setColor(Color.argb(140, 255, 255, 255));
        canvas.drawCircle(21f, 21f, 18f, p);
        return bmp;
    }

    private static Bitmap renderBarcodeBitmap(String value, String formatStr) {
        if (value == null || value.trim().isEmpty()) return null;
        BarcodeFormat format = mapFormat(formatStr);
        boolean is2d = format == BarcodeFormat.QR_CODE || format == BarcodeFormat.DATA_MATRIX;
        int width = is2d ? 360 : 800;
        int height = is2d ? 360 : 200;

        MultiFormatWriter writer = new MultiFormatWriter();
        BitMatrix matrix;
        try {
            matrix = writer.encode(value, format, width, height);
        } catch (Exception firstError) {
            try {
                matrix = writer.encode(value, BarcodeFormat.CODE_128, 800, 200);
            } catch (Exception secondError) {
                return null;
            }
        }

        int w = matrix.getWidth();
        int h = matrix.getHeight();
        int[] pixels = new int[w * h];
        for (int y = 0; y < h; y++) {
            int offset = y * w;
            for (int x = 0; x < w; x++) {
                pixels[offset + x] = matrix.get(x, y) ? Color.BLACK : Color.WHITE;
            }
        }
        Bitmap bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        bitmap.setPixels(pixels, 0, w, 0, 0, w, h);
        return bitmap;
    }

    private static BarcodeFormat mapFormat(String formatStr) {
        if (formatStr == null) return BarcodeFormat.CODE_128;
        switch (formatStr) {
            case "EAN_13":
                return BarcodeFormat.EAN_13;
            case "EAN_8":
                return BarcodeFormat.EAN_8;
            case "CODE_39":
                return BarcodeFormat.CODE_39;
            case "QR_CODE":
                return BarcodeFormat.QR_CODE;
            case "DATA_MATRIX":
                return BarcodeFormat.DATA_MATRIX;
            case "ITF":
                return BarcodeFormat.ITF;
            case "UPC_A":
                return BarcodeFormat.UPC_A;
            default:
                return BarcodeFormat.CODE_128;
        }
    }

    private static PendingIntent createPendingIntent(Context context, int requestCode, Intent intent) {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(context, requestCode, intent, flags);
    }
}
