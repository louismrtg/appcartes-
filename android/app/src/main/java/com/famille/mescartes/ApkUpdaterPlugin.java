package com.famille.mescartes;

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
