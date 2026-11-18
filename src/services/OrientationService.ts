import { Capacitor } from '@capacitor/core';
import { ScreenOrientation } from '@capacitor/screen-orientation';

class OrientationServiceImpl {
  private currentLock: 'landscape' | 'portrait' | 'unlocked' = 'unlocked';

  async lockLandscape(): Promise<boolean> {
    if (this.currentLock === 'landscape') {
      return true;
    }

    if (Capacitor.isNativePlatform()) {
      try {
        await ScreenOrientation.lock({ orientation: 'landscape' });
        this.currentLock = 'landscape';
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
      }
    } catch {
      // Sur navigateur desktop ou sans plein écran, l'interface reste utilisable.
    }
    this.currentLock = 'landscape';
    return true;
  }

  async restorePortrait(keepLandscape = false): Promise<void> {
    if (keepLandscape) {
      await this.lockLandscape();
      return;
    }

    if (this.currentLock === 'unlocked') return;
    this.currentLock = 'unlocked';

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
