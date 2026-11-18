import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

class HapticServiceImpl {
  /**
   * Retour tactile doux optionnel (désactivé par défaut).
   * Utilise selectionChanged() sur Android pour un clic très discret sans vrombissement.
   */
  async tap(enabled = false): Promise<void> {
    if (!enabled) return;
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.selectionChanged();
      } catch {
        // Ignore
      }
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(5);
    }
  }

  async success(enabled = false): Promise<void> {
    if (!enabled) return;
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.selectionChanged();
      } catch {
        // Ignore
      }
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(8);
    }
  }

  async error(enabled = false): Promise<void> {
    if (!enabled) return;
    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch {
        // Ignore
      }
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(15);
    }
  }
}

export const HapticService = new HapticServiceImpl();
