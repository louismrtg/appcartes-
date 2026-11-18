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
    '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />',
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

function writeAdaptiveIconFiles() {
  const drawableDir = path.join(ANDROID_MAIN, 'res', 'drawable');
  const anydpiDir = path.join(ANDROID_MAIN, 'res', 'mipmap-anydpi-v26');
  ensureDir(drawableDir);
  ensureDir(anydpiDir);

  fs.writeFileSync(
    path.join(drawableDir, 'ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <gradient
        android:angle="315"
        android:startColor="#0B1120"
        android:centerColor="#172554"
        android:endColor="#1D4ED8"
        android:type="linear" />
</shape>
`,
    'utf8'
  );

  const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher.xml'), adaptiveXml, 'utf8');
  fs.writeFileSync(path.join(anydpiDir, 'ic_launcher_round.xml'), adaptiveXml, 'utf8');
  console.log('Icone adaptative Android mise a jour.');
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

  // Drawables modernes Material You / Wallet
  fs.writeFileSync(
    path.join(drawableDir, 'widget_bg.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <gradient
        android:angle="315"
        android:startColor="#0F172A"
        android:endColor="#1E293B"
        android:type="linear" />
    <corners android:radius="28dp" />
    <stroke android:width="1dp" android:color="#334155" />
</shape>
`,
    'utf8'
  );

  fs.writeFileSync(
    path.join(drawableDir, 'widget_pill_btn.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#26FFFFFF" />
    <corners android:radius="50dp" />
</shape>
`,
    'utf8'
  );

  fs.writeFileSync(
    path.join(drawableDir, 'widget_card_pill.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <gradient
        android:angle="315"
        android:startColor="#2563EB"
        android:endColor="#1E3A8A"
        android:type="linear" />
    <corners android:radius="18dp" />
</shape>
`,
    'utf8'
  );

  fs.writeFileSync(
    path.join(drawableDir, 'widget_white_box.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <solid android:color="#FFFFFF" />
    <corners android:radius="20dp" />
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
    android:minHeight="120dp"
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

  // Layout XML Widget 1 : Cartes arrondies avec degrade rendu par Bitmap (aucun rectangle coupe)
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
            android:background="@drawable/widget_pill_btn"
            android:paddingLeft="10dp"
            android:paddingRight="10dp"
            android:paddingTop="4dp"
            android:paddingBottom="4dp"
            android:text="Portefeuille"
            android:textColor="#E2E8F0"
            android:textSize="11sp"
            android:textStyle="bold" />
    </LinearLayout>

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1"
        android:gravity="center"
        android:orientation="horizontal">

        <FrameLayout
            android:id="@+id/quick_slot_1"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_marginEnd="8dp"
            android:layout_weight="1">

            <ImageView
                android:id="@+id/quick_slot_1_bg"
                android:layout_width="match_parent"
                android:layout_height="match_parent"
                android:contentDescription="Fond carte 1"
                android:scaleType="fitXY" />

            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="match_parent"
                android:gravity="bottom|start"
                android:orientation="vertical"
                android:padding="10dp">

                <TextView
                    android:id="@+id/quick_slot_1_title"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:ellipsize="end"
                    android:maxLines="1"
                    android:text="Carte 1"
                    android:textColor="#FFFFFF"
                    android:textSize="13sp"
                    android:textStyle="bold" />

                <TextView
                    android:id="@+id/quick_slot_1_sub"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:ellipsize="end"
                    android:maxLines="1"
                    android:text="Ouvrir"
                    android:textColor="#D9FFFFFF"
                    android:textSize="10sp" />
            </LinearLayout>
        </FrameLayout>

        <FrameLayout
            android:id="@+id/quick_slot_2"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_marginEnd="8dp"
            android:layout_weight="1">

            <ImageView
                android:id="@+id/quick_slot_2_bg"
                android:layout_width="match_parent"
                android:layout_height="match_parent"
                android:contentDescription="Fond carte 2"
                android:scaleType="fitXY" />

            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="match_parent"
                android:gravity="bottom|start"
                android:orientation="vertical"
                android:padding="10dp">

                <TextView
                    android:id="@+id/quick_slot_2_title"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:ellipsize="end"
                    android:maxLines="1"
                    android:text="Carte 2"
                    android:textColor="#FFFFFF"
                    android:textSize="13sp"
                    android:textStyle="bold" />

                <TextView
                    android:id="@+id/quick_slot_2_sub"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:ellipsize="end"
                    android:maxLines="1"
                    android:text="Ouvrir"
                    android:textColor="#D9FFFFFF"
                    android:textSize="10sp" />
            </LinearLayout>
        </FrameLayout>

        <FrameLayout
            android:id="@+id/quick_slot_3"
            android:layout_width="0dp"
            android:layout_height="match_parent"
            android:layout_weight="1">

            <ImageView
                android:id="@+id/quick_slot_3_bg"
                android:layout_width="match_parent"
                android:layout_height="match_parent"
                android:contentDescription="Fond carte 3"
                android:scaleType="fitXY" />

            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="match_parent"
                android:gravity="bottom|start"
                android:orientation="vertical"
                android:padding="10dp">

                <TextView
                    android:id="@+id/quick_slot_3_title"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:ellipsize="end"
                    android:maxLines="1"
                    android:text="Carte 3"
                    android:textColor="#FFFFFF"
                    android:textSize="13sp"
                    android:textStyle="bold" />

                <TextView
                    android:id="@+id/quick_slot_3_sub"
                    android:layout_width="match_parent"
                    android:layout_height="wrap_content"
                    android:ellipsize="end"
                    android:maxLines="1"
                    android:text="Ouvrir"
                    android:textColor="#D9FFFFFF"
                    android:textSize="10sp" />
            </LinearLayout>
        </FrameLayout>
    </LinearLayout>
</LinearLayout>
`,
    'utf8'
  );

  // Layout XML Widget 2 (Carte Favorite Directe avec badge couleur + code-barres plein cadre)
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
        android:paddingBottom="8dp">

        <ImageView
            android:id="@+id/barcode_widget_accent"
            android:layout_width="14dp"
            android:layout_height="14dp"
            android:layout_marginEnd="8dp"
            android:contentDescription="Couleur carte" />

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
            android:background="@drawable/widget_pill_btn"
            android:paddingLeft="9dp"
            android:paddingRight="9dp"
            android:paddingTop="3dp"
            android:paddingBottom="3dp"
            android:text="Mes Cartes"
            android:textColor="#E2E8F0"
            android:textSize="10sp"
            android:textStyle="bold" />
    </LinearLayout>

    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1"
        android:background="@drawable/widget_white_box"
        android:gravity="center"
        android:orientation="vertical"
        android:paddingLeft="12dp"
        android:paddingRight="12dp"
        android:paddingTop="8dp"
        android:paddingBottom="8dp">

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
            android:layout_marginTop="3dp"
            android:ellipsize="end"
            android:maxLines="1"
            android:text="Appuyez pour ouvrir"
            android:textColor="#0F172A"
            android:textSize="12sp"
            android:textStyle="bold"
            android:typeface="monospace" />
    </LinearLayout>
</LinearLayout>
`,
    'utf8'
  );

  // Java Provider 1 : MesCartesQuickWidgetProvider avec rendu Bitmap arrondi degrade
  fs.writeFileSync(
    path.join(javaDir, 'MesCartesQuickWidgetProvider.java'),
    `package com.famille.mescartes;

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
`,
    'utf8'
  );

  // Java Provider 2 : MesCartesBarcodeWidgetProvider avec pastille couleur + code-barres haute resolution
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

  // Plugin Capacitor natif pour telecharger et installer l'APK de mise a jour
  fs.writeFileSync(
    path.join(javaDir, 'ApkUpdaterPlugin.java'),
    `package com.famille.mescartes;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        final String rawUrl = call.getString("url", "");
        if (rawUrl == null || !rawUrl.startsWith("https://")) {
            call.reject("URL APK invalide.");
            return;
        }

        new Thread(() -> {
            HttpURLConnection conn = null;
            try {
                String currentUrl = rawUrl;
                for (int hops = 0; hops < 5; hops++) {
                    URL url = new URL(currentUrl);
                    conn = (HttpURLConnection) url.openConnection();
                    conn.setInstanceFollowRedirects(true);
                    conn.setConnectTimeout(10000);
                    conn.setReadTimeout(20000);
                    conn.setRequestProperty("User-Agent", "MesCartes-Android-Updater");
                    int status = conn.getResponseCode();
                    if (status == HttpURLConnection.HTTP_MOVED_TEMP
                        || status == HttpURLConnection.HTTP_MOVED_PERM
                        || status == 307
                        || status == 308) {
                        String next = conn.getHeaderField("Location");
                        conn.disconnect();
                        if (next == null || !next.startsWith("https://")) {
                            throw new RuntimeException("Redirection invalide");
                        }
                        currentUrl = next;
                        continue;
                    }
                    break;
                }

                if (conn == null || conn.getResponseCode() < 200 || conn.getResponseCode() >= 300) {
                    throw new RuntimeException("Echec HTTP lors du telechargement");
                }

                int totalLength = conn.getContentLength();
                Context context = getContext();
                File apkFile = new File(context.getCacheDir(), "mescartes-update.apk");

                try (
                    InputStream input = new BufferedInputStream(conn.getInputStream());
                    FileOutputStream output = new FileOutputStream(apkFile)
                ) {
                    byte[] buffer = new byte[16384];
                    long downloaded = 0;
                    int lastPercent = -1;
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        downloaded += count;
                        output.write(buffer, 0, count);
                        if (totalLength > 0) {
                            int percent = (int) ((downloaded * 100L) / totalLength);
                            if (percent != lastPercent) {
                                lastPercent = percent;
                                JSObject evt = new JSObject();
                                evt.put("percent", Math.min(100, percent));
                                notifyListeners("downloadProgress", evt);
                            }
                        }
                    }
                    output.flush();
                }

                JSObject doneEvt = new JSObject();
                doneEvt.put("percent", 100);
                notifyListeners("downloadProgress", doneEvt);

                Uri apkUri = FileProvider.getUriForFile(
                    context,
                    context.getPackageName() + ".fileprovider",
                    apkFile
                );
                Intent installIntent = new Intent(Intent.ACTION_VIEW);
                installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(installIntent);

                JSObject res = new JSObject();
                res.put("started", true);
                call.resolve(res);
            } catch (Exception err) {
                call.reject("Erreur telechargement APK: " + err.getMessage());
            } finally {
                if (conn != null) {
                    conn.disconnect();
                }
            }
        }).start();
    }
}
`,
    'utf8'
  );

  // MainActivity enregistre WidgetBridgePlugin et ApkUpdaterPlugin
  fs.writeFileSync(
    path.join(javaDir, 'MainActivity.java'),
    `package com.famille.mescartes;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class);
        registerPlugin(ApkUpdaterPlugin.class);
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
writeAdaptiveIconFiles();
writeWidgetAndBridgeFiles();
patchGradleMinSdkIfNeeded();
console.log('Configuration Android terminee avec succes.');
