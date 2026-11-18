import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';

class OrientationServiceImpl {
  private isLockedLandscape = false;

  async lockLandscape(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        await ScreenOrientation.lock({ orientation: 'landscape' });
        this.isLockedLandscape = true;
        return true;
      } catch (err) {
        console.warn('[OrientationService] Échec du verrouillage paysage natif:', err);
        return false;
      }
    }

    try {
      const orientationApi = window.screen?.orientation as ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
      };
      if (orientationApi && typeof orientationApi.lock === 'function') {
        await orientationApi.lock('landscape');
        this.isLockedLandscape = true;
        return true;
      }
    } catch {
      // Sur navigateur desktop ou sans plein écran, la rotation visuelle CSS prend le relais.
    }
    this.isLockedLandscape = true;
    return false;
  }

  async restorePortrait(): Promise<void> {
    if (!this.isLockedLandscape) return;
    this.isLockedLandscape = false;

    if (Capacitor.isNativePlatform()) {
      try {
        await ScreenOrientation.lock({ orientation: 'portrait' });
        await ScreenOrientation.unlock();
      } catch (err) {
        console.warn('[OrientationService] Erreur lors du retour portrait natif:', err);
      }
      return;
    }

    try {
      const orientationApi = window.screen?.orientation as ScreenOrientation & {
        unlock?: () => void;
      };
      if (orientationApi && typeof orientationApi.unlock === 'function') {
        orientationApi.unlock();
      }
    } catch {
      // Ignoré sur navigateur
    }
  }
}

export const OrientationService = new OrientationServiceImpl();
