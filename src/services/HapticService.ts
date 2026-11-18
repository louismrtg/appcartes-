import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { HapticIntensity } from '../types';

function resolveIntensity(levelOrBool: HapticIntensity | boolean | undefined): HapticIntensity {
  if (typeof levelOrBool === 'string') return levelOrBool;
  if (levelOrBool === true) return 'subtle';
  return 'off';
}

class HapticServiceImpl {
  async tap(levelOrBool: HapticIntensity | boolean = 'off'): Promise<void> {
    const level = resolveIntensity(levelOrBool);
    if (level === 'off') return;

    if (Capacitor.isNativePlatform()) {
      try {
        if (level === 'subtle') {
          await Haptics.selectionChanged();
        } else if (level === 'light') {
          await Haptics.vibrate({ duration: 10 });
        } else {
          await Haptics.impact({ style: ImpactStyle.Medium });
        }
      } catch {
        // Ignore
      }
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      const ms = level === 'subtle' ? 4 : level === 'light' ? 10 : 22;
      navigator.vibrate(ms);
    }
  }

  async success(levelOrBool: HapticIntensity | boolean = 'off'): Promise<void> {
    await this.tap(levelOrBool);
  }

  async error(levelOrBool: HapticIntensity | boolean = 'off'): Promise<void> {
    const level = resolveIntensity(levelOrBool);
    if (level === 'off') return;

    if (Capacitor.isNativePlatform()) {
      try {
        await Haptics.impact({
          style: level === 'medium' ? ImpactStyle.Heavy : ImpactStyle.Light,
        });
      } catch {
        // Ignore
      }
    } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(level === 'medium' ? 28 : 14);
    }
  }

  async test(level: HapticIntensity): Promise<void> {
    await this.tap(level);
  }
}

export const HapticService = new HapticServiceImpl();
