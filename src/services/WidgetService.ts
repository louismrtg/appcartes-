import { Capacitor, registerPlugin } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { LoyaltyCard, WidgetCardPayload } from '../types';

const WIDGET_PAYLOAD_KEY = 'mescartes_widget_payload';

interface WidgetBridgePlugin {
  refreshWidgets(): Promise<void>;
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');

class WidgetServiceImpl {
  async syncPinnedCards(cards: LoyaltyCard[]): Promise<WidgetCardPayload[]> {
    const pinned = cards
      .filter((c) => c.isPinnedWidget)
      .sort((a, b) => a.widgetOrder - b.widgetOrder || b.usageCount - a.usageCount)
      .slice(0, 6);

    // Carte principale pour le Widget "Carte Favorite Directe"
    const mainCard =
      cards.find((c) => c.isMainWidgetCard) ||
      pinned[0] ||
      cards.find((c) => c.isFavorite) ||
      cards[0];

    const payload: WidgetCardPayload[] = pinned.map((c) => ({
      id: c.id,
      brandName: c.brandName,
      customName: c.customName,
      primaryColor: c.primaryColor,
      barcodeValue: c.barcodeValue,
      barcodeFormat: c.barcodeFormat,
      isMainWidgetCard: mainCard ? c.id === mainCard.id : false,
    }));

    // Si aucune carte n'est épinglée dans "Accès Rapide", on inclut quand même la carte principale si existante
    if (payload.length === 0 && mainCard) {
      payload.push({
        id: mainCard.id,
        brandName: mainCard.brandName,
        customName: mainCard.customName,
        primaryColor: mainCard.primaryColor,
        barcodeValue: mainCard.barcodeValue,
        barcodeFormat: mainCard.barcodeFormat,
        isMainWidgetCard: true,
      });
    } else if (mainCard && !payload.some((p) => p.id === mainCard.id)) {
      payload.push({
        id: mainCard.id,
        brandName: mainCard.brandName,
        customName: mainCard.customName,
        primaryColor: mainCard.primaryColor,
        barcodeValue: mainCard.barcodeValue,
        barcodeFormat: mainCard.barcodeFormat,
        isMainWidgetCard: true,
      });
    }

    try {
      await Preferences.set({
        key: WIDGET_PAYLOAD_KEY,
        value: JSON.stringify(payload),
      });

      if (Capacitor.isNativePlatform()) {
        await WidgetBridge.refreshWidgets().catch(() => {});
      }
    } catch (err) {
      console.warn('[WidgetService] Synchronisation widget impossible:', err);
    }

    return payload;
  }

  /**
   * Écoute les liens profonds mescartes://card/<id> ou mescartes://card?id=<id>
   * envoyés par les Widgets Android Motorola.
   */
  subscribeDeepLinks(onOpenCardId: (cardId: string) => void): () => void {
    const parseUrlAndDispatch = (url: string) => {
      try {
        if (!url) return;
        // Format mescartes://card/<id>
        const pathMatch = url.match(/^mescartes:\/\/card\/([^/?#]+)/i);
        if (pathMatch?.[1]) {
          onOpenCardId(decodeURIComponent(pathMatch[1]));
          return;
        }
        // Format mescartes://card?id=<id>
        const parsed = new URL(url);
        const queryId = parsed.searchParams.get('id') || parsed.searchParams.get('cardId');
        if (queryId) {
          onOpenCardId(queryId);
        }
      } catch {
        const match = url.match(/mescartes:\/\/card\/([^/?#]+)|[?&]id=([^&]+)/i);
        const found = match?.[1] || match?.[2];
        if (found) {
          onOpenCardId(decodeURIComponent(found));
        }
      }
    };

    if (typeof window !== 'undefined' && window.location.search) {
      const params = new URLSearchParams(window.location.search);
      const cardId = params.get('card') || params.get('id');
      if (cardId) {
        setTimeout(() => onOpenCardId(cardId), 120);
      }
    }

    if (!Capacitor.isNativePlatform()) {
      return () => {};
    }

    let removed = false;
    const handlePromise = CapacitorApp.addListener('appUrlOpen', (event) => {
      if (!removed && event.url) {
        parseUrlAndDispatch(event.url);
      }
    });

    CapacitorApp.getLaunchUrl()
      .then((launch) => {
        if (!removed && launch?.url) {
          parseUrlAndDispatch(launch.url);
        }
      })
      .catch(() => {});

    return () => {
      removed = true;
      handlePromise.then((handle) => handle.remove()).catch(() => {});
    };
  }
}

export const WidgetService = new WidgetServiceImpl();
