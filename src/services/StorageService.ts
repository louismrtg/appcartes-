import Dexie, { type Table } from 'dexie';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import {
  AppSettings,
  BackupPayload,
  CachedBrandLogo,
  CardFolder,
  LoyaltyCard,
  getCardFolderIds,
} from '../types';

const SETTINGS_KEY = 'mescartes_settings_v2';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'auto',
  largeText: false,
  highContrast: false,
  autoLandscape: true,
  autoMaxBrightness: true,
  keepAwake: true,
  hapticFeedback: true,
  lockOnStartup: true,
  lockScope: 'app',
  biometricEnabled: true,
  pinLength: 4,
  pinHash: null,
  pinSalt: null,
};

export const DEFAULT_FOLDERS: CardFolder[] = [
  {
    id: 'folder-supermarches',
    name: 'Supermarchés',
    color: '#2563EB',
    icon: 'shopping-cart',
    order: 1,
    createdAt: 1700000000000,
  },
  {
    id: 'folder-bricolage',
    name: 'Bricolage & Maison',
    color: '#16A34A',
    icon: 'hammer',
    order: 2,
    createdAt: 1700000000001,
  },
  {
    id: 'folder-sport',
    name: 'Sport & Loisirs',
    color: '#0284C7',
    icon: 'dumbbell',
    order: 3,
    createdAt: 1700000000002,
  },
  {
    id: 'folder-mode',
    name: 'Mode & Beauté',
    color: '#DB2777',
    icon: 'sparkles',
    order: 4,
    createdAt: 1700000000003,
  },
  {
    id: 'folder-auto',
    name: 'Auto & Services',
    color: '#EA580C',
    icon: 'car',
    order: 5,
    createdAt: 1700000000004,
  },
  {
    id: 'folder-prive',
    name: 'Dossier Privé',
    color: '#4F46E5',
    icon: 'lock',
    isPrivate: true,
    order: 6,
    createdAt: 1700000000005,
  },
];

class MesCartesDatabase extends Dexie {
  cards!: Table<LoyaltyCard, string>;
  folders!: Table<CardFolder, string>;
  logoCache!: Table<CachedBrandLogo, string>;

  constructor() {
    super('MesCartesWalletDB');
    this.version(1).stores({
      cards: 'id, brandId, folderId, isFavorite, isPinnedWidget, updatedAt',
      folders: 'id, order, isPrivate',
      logoCache: 'domain, updatedAt',
    });
  }
}

export const db = new MesCartesDatabase();

class StorageServiceImpl {
  async initialize(): Promise<{
    cards: LoyaltyCard[];
    folders: CardFolder[];
    settings: AppSettings;
  }> {
    const settings = await this.loadSettings();

    const folderCount = await db.folders.count();
    if (folderCount === 0) {
      await db.folders.bulkPut(DEFAULT_FOLDERS);
    }

    const [cards, folders] = await Promise.all([this.getCards(), this.getFolders()]);
    return { cards, folders, settings };
  }

  async loadSettings(): Promise<AppSettings> {
    try {
      const { value } = await Preferences.get({ key: SETTINGS_KEY });
      if (!value) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(value) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    await Preferences.set({
      key: SETTINGS_KEY,
      value: JSON.stringify(settings),
    });
  }

  async getCards(): Promise<LoyaltyCard[]> {
    const list = await db.cards.toArray();
    return list.sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
  }

  async saveCard(card: LoyaltyCard): Promise<void> {
    await db.cards.put(card);
  }

  async deleteCard(cardId: string): Promise<void> {
    await db.cards.delete(cardId);
  }

  async incrementCardUsage(cardId: string): Promise<LoyaltyCard | undefined> {
    const card = await db.cards.get(cardId);
    if (!card) return undefined;
    const updated: LoyaltyCard = {
      ...card,
      usageCount: (card.usageCount || 0) + 1,
      lastUsedAt: Date.now(),
    };
    await db.cards.put(updated);
    return updated;
  }

  async getFolders(): Promise<CardFolder[]> {
    const list = await db.folders.toArray();
    return list.sort((a, b) => a.order - b.order);
  }

  async saveFolder(folder: CardFolder): Promise<void> {
    await db.folders.put(folder);
  }

  async reorderFolders(orderedFolders: CardFolder[]): Promise<void> {
    const updated = orderedFolders.map((folder, index) => ({
      ...folder,
      order: index + 1,
    }));
    await db.folders.bulkPut(updated);
  }

  async deleteFolder(folderId: string): Promise<void> {
    const remaining = (await this.getFolders()).filter((f) => f.id !== folderId);
    const fallbackFolderId = remaining[0]?.id || 'folder-supermarches';
    const allCards = await db.cards.toArray();
    const affected = allCards.filter((c) => getCardFolderIds(c).includes(folderId));
    if (affected.length > 0) {
      await db.cards.bulkPut(
        affected.map((c) => {
          const nextIds = getCardFolderIds(c).filter((id) => id !== folderId);
          const resolvedIds = nextIds.length > 0 ? nextIds : [fallbackFolderId];
          return {
            ...c,
            folderId: resolvedIds[0],
            folderIds: resolvedIds,
            updatedAt: Date.now(),
          };
        })
      );
    }
    await db.folders.delete(folderId);
  }

  async exportBackup(): Promise<{ fileName: string; shared: boolean }> {
    const [cards, folders] = await Promise.all([this.getCards(), this.getFolders()]);

    const payload: BackupPayload = {
      version: 2,
      exportedAt: new Date().toISOString(),
      app: 'Mes Cartes — © Louis Martignon (@louismrtg)',
      folders,
      cards,
    };

    const json = JSON.stringify(payload, null, 2);
    const dateStamp = new Date().toISOString().slice(0, 10);
    const fileName = `mes-cartes-sauvegarde-${dateStamp}.json`;

    if (Capacitor.isNativePlatform()) {
      const writeResult = await Filesystem.writeFile({
        path: fileName,
        data: json,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });

      await Share.share({
        title: 'Sauvegarde Mes Cartes',
        text: `Sauvegarde de ${cards.length} carte(s) (${dateStamp})`,
        url: writeResult.uri,
        dialogTitle: 'Exporter la sauvegarde Mes Cartes',
      });
      return { fileName, shared: true };
    }

    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    return { fileName, shared: false };
  }

  async importBackup(jsonContent: string): Promise<{ cardsCount: number; foldersCount: number }> {
    const parsed = JSON.parse(jsonContent) as Partial<BackupPayload>;
    if (!parsed || !Array.isArray(parsed.cards) || !Array.isArray(parsed.folders)) {
      throw new Error('Fichier de sauvegarde invalide ou incompatible.');
    }

    await db.transaction('rw', db.folders, db.cards, async () => {
      if (parsed.folders && parsed.folders.length > 0) {
        await db.folders.bulkPut(parsed.folders);
      }
      if (parsed.cards && parsed.cards.length > 0) {
        await db.cards.bulkPut(parsed.cards);
      }
    });

    return {
      cardsCount: parsed.cards.length,
      foldersCount: parsed.folders.length,
    };
  }
}

export const StorageService = new StorageServiceImpl();
