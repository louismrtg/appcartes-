#!/usr/bin/env node
/**
 * Script idempotent de configuration Android pour Mes Cartes
 * - Injecte les permissions CAMERA, USE_BIOMETRIC, USE_FINGERPRINT, WAKE_LOCK, VIBRATE
 * - Ajoute les métadonnées ML Kit Barcode Scanner
 * - Configure le deep-link mescartes://card/<id>
 * - Ajoute ZXing core dans app/build.gradle pour le rendu natif de codes-barres en Widget
 * - Génère WidgetBridgePlugin + MainActivity + 2 Widgets natifs compatibles Motorola Launcher :
 *   1) MesCartesQuickWidgetProvider ("Accès Rapide — 3 Cartes")
 *   2) MesCartesBarcodeWidgetProvider ("Carte Favorite Directe" avec code-barres scannable)
 *
 * © Louis Martignon (@louismrtg)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const ANDROID_MAIN = path.join(ROOT_DIR, 'android', 'app', 'src', 'main');
const MANIFEST_PATH = path.join(ANDROID_MAIN, 'AndroidManifest.xml');
const APP_BUILD_GRADLE = path.join(ROOT_DIR, 'android', 'app', 'build.gradle');

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('AndroidManifest.xml introuvable. Executez d abord "npx cap add android".');
  process.exit(1);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function removeIfExists(filePath) {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function patchAppBuildGradle() {
  if (!fs.existsSync(APP_BUILD_GRADLE)) return;
  let gradle = fs.readFileSync(APP_BUILD_GRADLE, 'utf8');
  if (!gradle.includes('com.google.zxing:core')) {
    gradle = gradle.replace(
      "implementation project(':capacitor-android')",
      "implementation project(':capacitor-android')\n    implementation 'com.google.zxing:core:3.5.3'"
    );
    fs.writeFileSync(APP_BUILD_GRADLE, gradle, 'utf8');
    console.log('android/app/build.gradle mis a jour avec ZXing core 3.5.3.');
  }
}

function patchManifest() {
  let manifest = fs.readFileSync(MANIFEST_PATH, 'utf8');

  // Nettoyer l'ancien receiver v1 si présent
  manifest = manifest.replace(
    /\s*<receiver[\s\S]*?MesCartesWidgetProvider[\s\S]*?<\/receiver>/g,
    ''
  );

  const permissions = [
    '<uses-permission android:name="android.permission.CAMERA" />',
    '<uses-permission android:name="android.permission.USE_BIOMETRIC" />',
    '<uses-permission android:name="android.permission.USE_FINGERPRINT" />',
    '<uses-permission android:name="android.permission.WAKE_LOCK" />',
    '<uses-permission android:name="android.permission.VIBRATE" />',
    '<uses-feature android:name="android.hardware.camera" android:required="false" />',
    '<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />',
  ];

  const missingPermissions = permissions.filter((perm) => {
    const match = perm.match(/android:name="([^"]+)"/);
    return match && !manifest.includes(match[1]);
  });

  if (missingPermissions.length > 0) {
    manifest = manifest.replace(
      '</manifest>',
      `    <!-- Permissions injectees par scripts/configure-android.js -->\n    ${missingPermissions.join('\n    ')}\n</manifest>`
    );
  }

  if (!manifest.includes('com.google.mlkit.vision.DEPENDENCIES')) {
    manifest = manifest.replace(
      '</application>',
      `        <meta-data\n            android:name="com.google.mlkit.vision.DEPENDENCIES"\n            android:value="barcode_ui" />\n    </application>`
    );
  }

  if (!manifest.includes('android:scheme="mescartes"')) {
    const deepLinkFilter = `
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="mescartes" android:host="card" />
            </intent-filter>`;

    manifest = manifest.replace('</activity>', `${deepLinkFilter}\n        </activity>`);
  }

  if (!manifest.includes('MesCartesQuickWidgetProvider')) {
    const receiversBlock = `
        <receiver
            android:name=".MesCartesQuickWidgetProvider"
            android:exported="true"
            android:label="@string/widget_quick_name">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/mes_cartes_quick_widget_info" />
        </receiver>

        <receiver
            android:name=".MesCartesBarcodeWidgetProvider"
            android:exported="true"
            android:label="@string/widget_barcode_name">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/mes_cartes_barcode_widget_info" />
        </receiver>`;

    manifest = manifest.replace('</application>', `${receiversBlock}\n    </application>`);
  }

  fs.writeFileSync(MANIFEST_PATH, manifest, 'utf8');
  console.log('AndroidManifest.xml mis a jour avec permissions, MLKit, deep-link et 2 Widgets.');
}

function patchStringsXml() {
  const stringsPath = path.join(ANDROID_MAIN, 'res', 'values', 'strings.xml');
  if (!fs.existsSync(stringsPath)) return;

  let stringsXml = fs.readFileSync(stringsPath, 'utf8');
  // Supprime d'eventuelles anciennes cles v1
  stringsXml = stringsXml.replace(/\s*<string name="widget_name">[\s\S]*?<\/string>/g, '');
  stringsXml = stringsXml.replace(/\s*<string name="widget_description">[\s\S]*?<\/string>/g, '');

  if (!stringsXml.includes('widget_quick_name')) {
    stringsXml = stringsXml.replace(
      '</resources>',
      `    <string name="widget_quick_name">Mes Cartes — Acces Rapide (3 Cartes)</string>
    <string name="widget_quick_description">Acces direct en un appui vers vos 3 cartes favorites.</string>
    <string name="widget_barcode_name">Mes Cartes — Carte Favorite Directe</string>
    <string name="widget_barcode_description">Affiche directement le code-barres de votre carte principale.</string>
</resources>`
    );
  }
  fs.writeFileSync(stringsPath, stringsXml, 'utf8');
  console.log('res/values/strings.xml mis a jour.');
}

function writeWidgetAndBridgeFiles() {
  const drawableDir = path.join(ANDROID_MAIN, 'res', 'drawable');
  const layoutDir = path.join(ANDROID_MAIN, 'res', 'layout');
  const xmlDir = path.join(ANDROID_MAIN, 'res', 'xml');
  const javaDir = path.join(ANDROID_MAIN, 'java', 'com', 'famille', 'mescartes');

  ensureDir(drawableDir);
  ensureDir(layoutDir);
  ensureDir(xmlDir);
  ensureDir(javaDir);

  // Nettoyage des fichiers v1 s'ils existent
  removeIfExists(path.join(javaDir, 'MesCartesWidgetProvider.java'));
  removeIfExists(path.join(layoutDir, 'widget_mes_cartes.xml'));
  removeIfExists(path.join(xmlDir, 'mes_cartes_widget_info.xml'));

  // Drawables propres (compatibles Motorola Launcher & Material You)
  fs.writeFileSync(
    path.join(drawableDir, 'widget_bg.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#16181F" />
    <corners android:radius="24dp" />
    <stroke android:width="1dp" android:color="#2A2E3A" />
</shape>
`,
    'utf8'
  );

  fs.writeFileSync(
    path.join(drawableDir, 'widget_card_pill.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#2563EB" />
    <corners android:radius="16dp" />
</shape>
`,
    'utf8'
  );

  fs.writeFileSync(
    path.join(drawableDir, 'widget_white_box.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#FFFFFF" />
    <corners android:radius="14dp" />
</shape>
`,
    'utf8'
  );

  // Info XML Widget 1 (Acces Rapide 3 Cartes)
  fs.writeFileSync(
    path.join(xmlDir, 'mes_cartes_quick_widget_info.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="110dp"
    android:targetCellWidth="4"
    android:targetCellHeight="2"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/widget_quick_cards"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:description="@string/widget_quick_description" />
`,
    'utf8'
  );

  // Info XML Widget 2 (Carte Favorite Directe)
  fs.writeFileSync(
    path.join(xmlDir, 'mes_cartes_barcode_widget_info.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="250dp"
    android:minHeight="110dp"
    android:targetCellWidth="4"
    android:targetCellHeight="2"
    android:updatePeriodMillis="1800000"
    android:initialLayout="@layout/widget_barcode_direct"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen"
    android:description="@string/widget_barcode_description" />
`,
    'utf8'
  );

  // Layout XML Widget 1 (Acces Rapide 3 Cartes)
  fs.writeFileSync(
    path.join(layoutDir, 'widget_quick_cards.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/quick_widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/widget_bg"
    android:orientation="vertical"
    android:padding="14dp">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:gravity="center_vertical"
        android:orientation="horizontal"
        android:paddingBottom="10dp">

        <TextView
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:text="Mes Cartes"
            android:textColor="#F8FAFC"
            android:textSize="14sp"
            android:textStyle="bold" />

        <TextView
            android:id="@+id/quick_open_wallet"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="Ouvrir"
            android:textColor="#93C5FD"
            android:textSize="12sp"
            android:textStyle="bold" />
    </LinearLayout>

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1"
        android:gravity="center"
        android:orientation="horizontal">

        <LinearLayout
            android:id="@+id/quick_slot_1"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_marginEnd="6dp"
            android:layout_weight="1"
            android:background="@drawable/widget_card_pill"
            android:gravity="center"
            android:orientation="vertical"
            android:padding="8dp">

            <TextView
                android:id="@+id/quick_slot_1_title"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:ellipsize="end"
                android:maxLines="1"
                android:text="Carte 1"
                android:textColor="#FFFFFF"
                android:textSize="13sp"
                android:textStyle="bold" />

            <TextView
                android:id="@+id/quick_slot_1_sub"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:ellipsize="end"
                android:maxLines="1"
                android:text="Afficher"
                android:textColor="#E2E8F0"
                android:textSize="11sp" />
        </LinearLayout>

        <LinearLayout
            android:id="@+id/quick_slot_2"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_marginEnd="6dp"
            android:layout_weight="1"
            android:background="@drawable/widget_card_pill"
            android:gravity="center"
            android:orientation="vertical"
            android:padding="8dp">

            <TextView
                android:id="@+id/quick_slot_2_title"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:ellipsize="end"
                android:maxLines="1"
                android:text="Carte 2"
                android:textColor="#FFFFFF"
                android:textSize="13sp"
                android:textStyle="bold" />

            <TextView
                android:id="@+id/quick_slot_2_sub"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:ellipsize="end"
                android:maxLines="1"
                android:text="Afficher"
                android:textColor="#E2E8F0"
                android:textSize="11sp" />
        </LinearLayout>

        <LinearLayout
            android:id="@+id/quick_slot_3"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1"
            android:background="@drawable/widget_card_pill"
            android:gravity="center"
            android:orientation="vertical"
            android:padding="8dp">

            <TextView
                android:id="@+id/quick_slot_3_title"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:ellipsize="end"
                android:maxLines="1"
                android:text="Carte 3"
                android:textColor="#FFFFFF"
                android:textSize="13sp"
                android:textStyle="bold" />

            <TextView
                android:id="@+id/quick_slot_3_sub"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:ellipsize="end"
                android:maxLines="1"
                android:text="Afficher"
                android:textColor="#E2E8F0"
                android:textSize="11sp" />
        </LinearLayout>
    </LinearLayout>
</LinearLayout>
`,
    'utf8'
  );

  // Layout XML Widget 2 (Carte Favorite Directe avec code-barres)
  fs.writeFileSync(
    path.join(layoutDir, 'widget_barcode_direct.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/barcode_widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/widget_bg"
    android:orientation="vertical"
    android:padding="12dp">

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:gravity="center_vertical"
        android:orientation="horizontal"
        android:paddingBottom="6dp">

        <TextView
            android:id="@+id/barcode_widget_title"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:ellipsize="end"
            android:maxLines="1"
            android:text="Carte principale"
            android:textColor="#F8FAFC"
            android:textSize="14sp"
            android:textStyle="bold" />

        <TextView
            android:id="@+id/barcode_widget_brand"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:text="Mes Cartes"
            android:textColor="#94A3B8"
            android:textSize="11sp" />
    </LinearLayout>

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1"
        android:background="@drawable/widget_white_box"
        android:gravity="center"
        android:orientation="vertical"
        android:paddingHorizontal="10dp"
        android:paddingVertical="6dp">

        <ImageView
            android:id="@+id/barcode_widget_image"
            android:layout_width="match_parent"
            android:layout_height="0dp"
            android:layout_weight="1"
            android:contentDescription="Code-barres de la carte"
            android:scaleType="fitCenter" />

        <TextView
            android:id="@+id/barcode_widget_number"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="2dp"
            android:ellipsize="end"
            android:maxLines="1"
            android:text="Selectionnez une carte"
            android:textColor="#0F172A"
            android:textSize="11sp"
            android:textStyle="bold" />
    </LinearLayout>
</LinearLayout>
`,
    'utf8'
  );

  // Java Provider 1 : MesCartesQuickWidgetProvider
  fs.writeFileSync(
    path.join(javaDir, 'MesCartesQuickWidgetProvider.java'),
    `package com.famille.mescartes;

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
`,
    'utf8'
  );

  // Java Provider 2 : MesCartesBarcodeWidgetProvider (avec generation Bitmap ZXing)
  fs.writeFileSync(
    path.join(javaDir, 'MesCartesBarcodeWidgetProvider.java'),
    `package com.famille.mescartes;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Color;
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
                String barcodeValue = selected.optString("barcodeValue", "");
                String formatStr = selected.optString("barcodeFormat", "CODE_128");

                views.setTextViewText(R.id.barcode_widget_title, customName);
                views.setTextViewText(R.id.barcode_widget_brand, brandName);
                views.setTextViewText(R.id.barcode_widget_number, barcodeValue);

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
                views.setViewVisibility(R.id.barcode_widget_image, View.GONE);
                views.setOnClickPendingIntent(
                    R.id.barcode_widget_root,
                    createPendingIntent(context, 5500 + appWidgetId, openAppIntent)
                );
            }
        } catch (Exception e) {
            views.setTextViewText(R.id.barcode_widget_title, "Mes Cartes");
            views.setTextViewText(R.id.barcode_widget_number, "Appuyez pour ouvrir");
            views.setViewVisibility(R.id.barcode_widget_image, View.GONE);
            views.setOnClickPendingIntent(
                R.id.barcode_widget_root,
                createPendingIntent(context, 5800 + appWidgetId, openAppIntent)
            );
        }

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }

    private static Bitmap renderBarcodeBitmap(String value, String formatStr) {
        if (value == null || value.trim().isEmpty()) return null;
        BarcodeFormat format = mapFormat(formatStr);
        boolean is2d = format == BarcodeFormat.QR_CODE || format == BarcodeFormat.DATA_MATRIX;
        int width = is2d ? 280 : 600;
        int height = is2d ? 280 : 140;

        MultiFormatWriter writer = new MultiFormatWriter();
        BitMatrix matrix;
        try {
            matrix = writer.encode(value, format, width, height);
        } catch (Exception firstError) {
            try {
                matrix = writer.encode(value, BarcodeFormat.CODE_128, 600, 140);
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
`,
    'utf8'
  );

  // Plugin Capacitor natif pour rafraichir instantanement les widgets depuis le code JS
  fs.writeFileSync(
    path.join(javaDir, 'WidgetBridgePlugin.java'),
    `package com.famille.mescartes;

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
`,
    'utf8'
  );

  // MainActivity enregistre WidgetBridgePlugin
  fs.writeFileSync(
    path.join(javaDir, 'MainActivity.java'),
    `package com.famille.mescartes;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`,
    'utf8'
  );

  console.log('Widgets Android Motorola (Acces Rapide + Carte Favorite Directe) et WidgetBridgePlugin generes.');
}

function patchGradleMinSdkIfNeeded() {
  const variablesGradlePath = path.join(ROOT_DIR, 'android', 'variables.gradle');
  if (!fs.existsSync(variablesGradlePath)) return;

  let content = fs.readFileSync(variablesGradlePath, 'utf8');
  content = content.replace(/minSdkVersion\s*=\s*\d+/, 'minSdkVersion = 24');
  fs.writeFileSync(variablesGradlePath, content, 'utf8');
  console.log('android/variables.gradle configure (minSdkVersion = 24).');
}

patchAppBuildGradle();
patchManifest();
patchStringsXml();
writeWidgetAndBridgeFiles();
patchGradleMinSdkIfNeeded();
console.log('Configuration Android terminee avec succes.');
