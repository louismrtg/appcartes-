export type BarcodeFormat =
  | 'EAN_13'
  | 'EAN_8'
  | 'CODE_128'
  | 'CODE_39'
  | 'QR_CODE'
  | 'DATA_MATRIX'
  | 'ITF'
  | 'UPC_A';

export type FolderIconName =
  | 'shopping-cart'
  | 'hammer'
  | 'dumbbell'
  | 'car'
  | 'sparkles'
  | 'heart'
  | 'laptop'
  | 'lock'
  | 'folder'
  | 'star'
  | 'gift'
  | 'coffee';

export type DrawerFilter =
  | 'all'
  | 'favorites'
  | { type: 'folder'; folderId: string };

export interface CardFolder {
  id: string;
  name: string;
  color: string;
  icon: FolderIconName;
  isPrivate?: boolean;
  order: number;
  createdAt: number;
}

export interface LoyaltyCard {
  id: string;
  brandId: string;
  brandName: string;
  domain: string;
  customName: string;
  barcodeValue: string;
  barcodeFormat: BarcodeFormat;
  folderId: string;
  folderIds?: string[];
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  notes?: string;
  isFavorite: boolean;
  isPinnedWidget: boolean;
  widgetOrder: number;
  isMainWidgetCard?: boolean;
  usageCount: number;
  lastUsedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export function getCardFolderIds(card: Pick<LoyaltyCard, 'folderId' | 'folderIds'>): string[] {
  if (card.folderIds && card.folderIds.length > 0) {
    return Array.from(new Set(card.folderIds));
  }
  return card.folderId ? [card.folderId] : [];
}

export interface FrenchBrand {
  id: string;
  name: string;
  domain: string;
  category: string;
  defaultFolderId: string;
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  defaultFormat: BarcodeFormat;
  keywords: string[];
}

export interface CachedBrandLogo {
  domain: string;
  dataUrl: string;
  updatedAt: number;
}

export type ThemePreference = 'auto' | 'light' | 'dark';
export type LockScope = 'app' | 'private_folders';

export interface AppSettings {
  theme: ThemePreference;
  largeText: boolean;
  highContrast: boolean;
  autoLandscape: boolean;
  autoMaxBrightness: boolean;
  keepAwake: boolean;
  hapticFeedback: boolean;
  lockOnStartup: boolean;
  lockScope: LockScope;
  biometricEnabled: boolean;
  pinLength: 4 | 6;
  pinHash: string | null;
  pinSalt: string | null;
}

export interface WidgetCardPayload {
  id: string;
  brandName: string;
  customName: string;
  primaryColor: string;
  barcodeValue: string;
  barcodeFormat: BarcodeFormat;
  isMainWidgetCard?: boolean;
}

export interface BackupPayload {
  version: number;
  exportedAt: string;
  app: string;
  folders: CardFolder[];
  cards: LoyaltyCard[];
}
