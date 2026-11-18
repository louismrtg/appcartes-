import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { APP_VERSION, GITHUB_REPO } from '../types';

export interface AvailableUpdate {
  version: string;
  tagName: string;
  notes: string;
  apkUrl: string;
  releaseUrl: string;
}

export type UpdateCheckResult =
  | { status: 'available'; update: AvailableUpdate }
  | { status: 'up-to-date'; latestVersion: string }
  | { status: 'offline' }
  | { status: 'unavailable'; releaseUrl: string };

interface ApkUpdaterPluginInterface {
  downloadAndInstall(options: { url: string }): Promise<{ started: boolean }>;
  addListener(
    eventName: 'downloadProgress',
    listenerFunc: (data: { percent: number }) => void
  ): Promise<PluginListenerHandle>;
}

const ApkUpdater = registerPlugin<ApkUpdaterPluginInterface>('ApkUpdater');

const DISMISSED_KEY = 'mescartes_dismissed_update_v1';

export function compareVersions(remote: string, current: string): number {
  const clean = (v: string) =>
    v
      .trim()
      .replace(/^v/i, '')
      .split('-')[0]
      .split('.')
      .map((n) => Number.parseInt(n, 10) || 0);

  const a = clean(remote);
  const b = clean(current);
  const len = Math.max(a.length, b.length, 3);
  for (let i = 0; i < len; i++) {
    const va = a[i] || 0;
    const vb = b[i] || 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

class UpdateServiceImpl {
  async checkForUpdate(): Promise<UpdateCheckResult> {
    const fallbackReleaseUrl = `https://github.com/${GITHUB_REPO}/releases`;

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return { status: 'offline' };
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 4000);

    try {
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
        {
          headers: { Accept: 'application/vnd.github+json' },
          signal: controller.signal,
          cache: 'no-store',
        }
      );

      if (!response.ok) {
        return { status: 'unavailable', releaseUrl: fallbackReleaseUrl };
      }

      const data = (await response.json()) as {
        tag_name?: string;
        body?: string;
        html_url?: string;
        assets?: Array<{ name: string; browser_download_url: string }>;
      };

      const rawTag = (data.tag_name || '').trim();
      const remoteVersion = rawTag.replace(/^v/i, '');
      const releaseUrl = data.html_url || fallbackReleaseUrl;
      const apkAsset = data.assets?.find((a) => a.name.toLowerCase().endsWith('.apk'));

      if (remoteVersion && compareVersions(remoteVersion, APP_VERSION) > 0 && apkAsset?.browser_download_url) {
        return {
          status: 'available',
          update: {
            version: remoteVersion,
            tagName: rawTag,
            notes: (data.body || '').trim(),
            apkUrl: apkAsset.browser_download_url,
            releaseUrl,
          },
        };
      }

      return { status: 'up-to-date', latestVersion: remoteVersion || APP_VERSION };
    } catch {
      return { status: 'unavailable', releaseUrl: fallbackReleaseUrl };
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  isDismissedForSession(version: string): boolean {
    try {
      return sessionStorage.getItem(DISMISSED_KEY) === version;
    } catch {
      return false;
    }
  }

  dismissForSession(version: string): void {
    try {
      sessionStorage.setItem(DISMISSED_KEY, version);
    } catch {
      // Non bloquant
    }
  }

  async installUpdate(
    apkUrl: string,
    onProgress?: (percent: number) => void
  ): Promise<'native-installer' | 'browser'> {
    if (Capacitor.isNativePlatform()) {
      let handle: PluginListenerHandle | null = null;
      try {
        handle = await ApkUpdater.addListener('downloadProgress', ({ percent }) => {
          onProgress?.(percent);
        });
        await ApkUpdater.downloadAndInstall({ url: apkUrl });
        return 'native-installer';
      } catch {
        // Fallback navigateur si le téléchargement natif échoue
      } finally {
        if (handle) {
          handle.remove().catch(() => {});
        }
      }
    }

    window.open(apkUrl, '_blank', 'noopener,noreferrer');
    return 'browser';
  }
}

export const UpdateService = new UpdateServiceImpl();
