import { Capacitor } from '@capacitor/core';
import { ScreenBrightness } from '@capacitor-community/screen-brightness';
import { KeepAwake } from '@capacitor-community/keep-awake';

class BrightnessServiceImpl {
  private savedBrightness: number | null = null;
  private isBoosted = false;
  private isWakeLocked = false;

  /**
   * Passe la luminosité matérielle à 100 % (1.0) et garde l'écran allumé
   * pour faciliter la lecture par les douchettes laser en caisse.
   */
  async boostToMax(options: { maxBrightness: boolean; keepAwake: boolean }): Promise<{
    brightnessBoosted: boolean;
    wakeLocked: boolean;
  }> {
    let brightnessBoosted = false;
    let wakeLocked = false;

    if (options.maxBrightness) {
      if (Capacitor.isNativePlatform()) {
        try {
          if (this.savedBrightness === null) {
            const current = await ScreenBrightness.getBrightness();
            this.savedBrightness = current.brightness;
          }
          await ScreenBrightness.setBrightness({ brightness: 1.0 });
          this.isBoosted = true;
          brightnessBoosted = true;
        } catch (err) {
          console.warn('[BrightnessService] Impossible de modifier la luminosité matérielle:', err);
        }
      } else {
        this.isBoosted = true;
        brightnessBoosted = true;
      }
    }

    if (options.keepAwake) {
      if (Capacitor.isNativePlatform()) {
        try {
          await KeepAwake.keepAwake();
          this.isWakeLocked = true;
          wakeLocked = true;
        } catch (err) {
          console.warn('[BrightnessService] Impossible d’activer KeepAwake:', err);
        }
      } else {
        this.isWakeLocked = true;
        wakeLocked = true;
      }
    }

    return { brightnessBoosted, wakeLocked };
  }

  /**
   * Restaure le niveau de luminosité d'origine et autorise à nouveau la mise en veille.
   */
  async restore(): Promise<void> {
    if (this.isBoosted) {
      if (Capacitor.isNativePlatform()) {
        try {
          const target = this.savedBrightness !== null ? this.savedBrightness : -1;
          await ScreenBrightness.setBrightness({ brightness: target });
        } catch (err) {
          console.warn('[BrightnessService] Erreur lors de la restauration de luminosité:', err);
        }
      }
      this.savedBrightness = null;
      this.isBoosted = false;
    }

    if (this.isWakeLocked) {
      if (Capacitor.isNativePlatform()) {
        try {
          await KeepAwake.allowSleep();
        } catch (err) {
          console.warn('[BrightnessService] Erreur lors de la désactivation de KeepAwake:', err);
        }
      }
      this.isWakeLocked = false;
    }
  }

  getState(): { isBoosted: boolean; isWakeLocked: boolean } {
    return { isBoosted: this.isBoosted, isWakeLocked: this.isWakeLocked };
  }
}

export const BrightnessService = new BrightnessServiceImpl();
