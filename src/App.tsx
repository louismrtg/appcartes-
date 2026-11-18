import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import {
  ArrowUpDown,
  Check,
  Clock,
  CreditCard,
  FolderPlus,
  Menu,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  AppSettings,
  CardFolder,
  DrawerFilter,
  LoyaltyCard,
  SortMode,
  getCardFolderIds,
} from './types';
import { DEFAULT_SETTINGS, StorageService } from './services/StorageService';
import { WidgetService } from './services/WidgetService';
import { HapticService } from './services/HapticService';
import { BiometricService } from './services/BiometricService';
import { OrientationService } from './services/OrientationService';
import { AvailableUpdate, UpdateService } from './services/UpdateService';
import { LoyaltyCardItem } from './components/LoyaltyCardItem';
import { BrandLogo } from './components/BrandLogo';

const NavigationDrawer = lazy(() =>
  import('./components/NavigationDrawer').then((m) => ({ default: m.NavigationDrawer }))
);
const CardCheckoutModal = lazy(() =>
  import('./components/CardCheckoutModal').then((m) => ({ default: m.CardCheckoutModal }))
);
const AddCardModal = lazy(() =>
  import('./components/AddCardModal').then((m) => ({ default: m.AddCardModal }))
);
const SettingsModal = lazy(() =>
  import('./components/SettingsModal').then((m) => ({ default: m.SettingsModal }))
);
const BulkCategoryModal = lazy(() =>
  import('./components/BulkCategoryModal').then((m) => ({ default: m.BulkCategoryModal }))
);
const SecurityLockModal = lazy(() =>
  import('./components/SecurityLockModal').then((m) => ({ default: m.SecurityLockModal }))
);
const UpdatePromptModal = lazy(() =>
  import('./components/UpdatePromptModal').then((m) => ({ default: m.UpdatePromptModal }))
);

const SORT_LABELS: Record<SortMode, string> = {
  default: 'Favoris',
  recent: 'Récentes',
  most_used: 'Fréquentes',
  alpha: 'A – Z',
};

const SORT_ORDER: SortMode[] = ['default', 'recent', 'most_used', 'alpha'];

function getTimeGreeting(): { title: string; subtitle: string } {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return {
      title: 'Bonjour',
      subtitle: 'Bonne journée, vos cartes sont prêtes',
    };
  }
  if (hour >= 12 && hour < 18) {
    return {
      title: 'Bon après-midi',
      subtitle: 'Vos cartes à portée de main',
    };
  }
  if (hour >= 18 && hour < 22) {
    return {
      title: 'Bonsoir',
      subtitle: 'Vos cartes prêtes pour vos courses',
    };
  }
  return {
    title: 'Bonsoir',
    subtitle: 'Votre portefeuille personnel',
  };
}

export function App() {
  const [loading, setLoading] = useState(true);
  const [cards, setCards] = useState<LoyaltyCard[]>([]);
  const [folders, setFolders] = useState<CardFolder[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  const [activeFilter, setActiveFilter] = useState<DrawerFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [checkoutCard, setCheckoutCard] = useState<LoyaltyCard | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<LoyaltyCard | null>(null);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Sélection multiple (appui long)
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const [appLocked, setAppLocked] = useState(false);
  const [unlockedPrivateFolders, setUnlockedPrivateFolders] = useState<Record<string, boolean>>({});
  const [pendingPrivateFolderId, setPendingPrivateFolderId] = useState<string | null>(null);
  const [availableUpdate, setAvailableUpdate] = useState<AvailableUpdate | null>(null);

  const edgeSwipeStartX = useRef<number | null>(null);
  const backgroundTimestampRef = useRef<number | null>(null);

  const selectionMode = selectedCardIds.length > 0;

  const reloadDatabase = useCallback(async () => {
    const data = await StorageService.initialize();
    setCards(data.cards);
    setFolders(data.folders);
    setSettings(data.settings);
    await WidgetService.syncPinnedCards(data.cards);
    return data;
  }, []);

  const canLockDevice = useCallback(async (cfg: AppSettings): Promise<boolean> => {
    if (cfg.pinHash) return true;
    if (cfg.biometricEnabled) {
      const bio = await BiometricService.checkAvailability();
      return bio.available;
    }
    return false;
  }, []);

  useEffect(() => {
    let mounted = true;
    reloadDatabase().then(async (data) => {
      if (!mounted) return;
      if (data.settings.lockOnStartup && data.settings.lockScope === 'app') {
        const hasSecurity = await canLockDevice(data.settings);
        if (mounted && hasSecurity) {
          setAppLocked(true);
        }
      }
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [reloadDatabase, canLockDevice]);

  // Verrouillage global en Paysage si activé dans les paramètres
  useEffect(() => {
    if (loading || checkoutCard) return;
    if (settings.lockAppLandscape) {
      OrientationService.lockLandscape();
    } else {
      OrientationService.restorePortrait(false);
    }
  }, [loading, settings.lockAppLandscape, checkoutCard]);

  // Verrouillage automatique après 30 secondes en arrière-plan
  useEffect(() => {
    const handleBackground = () => {
      backgroundTimestampRef.current = Date.now();
    };

    const handleForeground = async () => {
      const leftAt = backgroundTimestampRef.current;
      backgroundTimestampRef.current = null;
      if (!leftAt) return;
      if (Date.now() - leftAt >= 30_000) {
        setUnlockedPrivateFolders({});
        if (settings.lockOnStartup && settings.lockScope === 'app') {
          const hasSecurity = await canLockDevice(settings);
          if (hasSecurity) {
            setAppLocked(true);
          }
        }
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        handleBackground();
      } else if (document.visibilityState === 'visible') {
        handleForeground();
      }
    };

    document.addEventListener('visibilitychange', onVisibility);

    let appStateHandle: Promise<{ remove: () => Promise<void> }> | null = null;
    if (Capacitor.isNativePlatform()) {
      appStateHandle = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          handleBackground();
        } else {
          handleForeground();
        }
      });
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (appStateHandle) {
        appStateHandle.then((h) => h.remove()).catch(() => {});
      }
    };
  }, [settings, canLockDevice]);

  // Touche Retour Android : quitte le mode sélection s'il est actif
  useEffect(() => {
    if (!selectionMode || !Capacitor.isNativePlatform()) return;
    const handle = CapacitorApp.addListener('backButton', () => {
      setSelectedCardIds([]);
      setConfirmBulkDelete(false);
    });
    return () => {
      handle.then((h) => h.remove()).catch(() => {});
    };
  }, [selectionMode]);

  // Thème Clair / Sombre / Système + Options d'accessibilité
  useEffect(() => {
    const applyAppearance = () => {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldDark =
        settings.theme === 'dark' || (settings.theme === 'auto' && prefersDark);
      document.documentElement.classList.toggle('dark', shouldDark);
      document.documentElement.classList.toggle('accessibility-large', Boolean(settings.largeText));
      document.documentElement.classList.toggle(
        'accessibility-high-contrast',
        Boolean(settings.highContrast)
      );
    };
    applyAppearance();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', applyAppearance);
    return () => media.removeEventListener('change', applyAppearance);
  }, [settings.theme, settings.largeText, settings.highContrast]);

  // Deep-links depuis les Widgets Android (mescartes://card/<id>)
  useEffect(() => {
    if (loading) return;
    return WidgetService.subscribeDeepLinks((cardId) => {
      const target = cards.find((c) => c.id === cardId);
      if (target) {
        setCheckoutCard(target);
      }
    });
  }, [loading, cards]);

  useEffect(() => {
    if (!loading) {
      WidgetService.syncPinnedCards(cards);
    }
  }, [cards, loading]);

  // Vérification silencieuse en arrière-plan d'une mise à jour GitHub au lancement
  useEffect(() => {
    if (loading || appLocked) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const result = await UpdateService.checkForUpdate();
      if (cancelled) return;
      if (
        result.status === 'available' &&
        !UpdateService.isDismissedForSession(result.update.version)
      ) {
        setAvailableUpdate(result.update);
      }
    }, 1500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [loading, appLocked]);

  const folderMap = useMemo(() => {
    const map: Record<string, CardFolder> = {};
    folders.forEach((f) => {
      map[f.id] = f;
    });
    return map;
  }, [folders]);

  const cardCountsByFolder = useMemo(() => {
    const counts: Record<string, number> = {};
    cards.forEach((c) => {
      getCardFolderIds(c).forEach((fid) => {
        counts[fid] = (counts[fid] || 0) + 1;
      });
    });
    return counts;
  }, [cards]);

  const favoritesCount = useMemo(
    () => cards.filter((c) => c.isFavorite).length,
    [cards]
  );

  const handleSelectFilter = useCallback(
    async (filter: DrawerFilter) => {
      await HapticService.tap(settings.hapticFeedback);
      if (typeof filter === 'object' && filter.type === 'folder') {
        const targetFolder = folderMap[filter.folderId];
        if (
          targetFolder?.isPrivate &&
          !unlockedPrivateFolders[targetFolder.id] &&
          settings.lockOnStartup
        ) {
          const hasSecurity = await canLockDevice(settings);
          if (hasSecurity) {
            setPendingPrivateFolderId(filter.folderId);
            return;
          }
        }
      }
      setActiveFilter(filter);
      setSelectedCardIds([]);
      setConfirmBulkDelete(false);
    },
    [folderMap, settings, unlockedPrivateFolders, canLockDevice]
  );

  const visibleCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const filtered = cards.filter((card) => {
      const assignedIds = getCardFolderIds(card);
      const assignedFolders = assignedIds
        .map((id) => folderMap[id])
        .filter((f): f is CardFolder => Boolean(f));

      const hasLockedPrivateFolder = assignedFolders.some(
        (f) => f.isPrivate && !unlockedPrivateFolders[f.id]
      );

      if (activeFilter === 'all' && hasLockedPrivateFolder && !q) {
        return false;
      }

      if (activeFilter === 'favorites' && !card.isFavorite) return false;
      if (typeof activeFilter === 'object' && activeFilter.type === 'folder') {
        if (!assignedIds.includes(activeFilter.folderId)) return false;
      }

      if (q) {
        return (
          card.brandName.toLowerCase().includes(q) ||
          card.customName.toLowerCase().includes(q) ||
          card.barcodeValue.toLowerCase().includes(q) ||
          assignedFolders.some((f) => f.name.toLowerCase().includes(q))
        );
      }
      return true;
    });

    const mode = settings.sortMode || 'default';
    if (mode === 'default') return filtered;

    return [...filtered].sort((a, b) => {
      if (mode === 'recent') {
        return (b.lastUsedAt || 0) - (a.lastUsedAt || 0);
      }
      if (mode === 'most_used') {
        return (b.usageCount || 0) - (a.usageCount || 0);
      }
      return (a.customName || a.brandName).localeCompare(b.customName || b.brandName, 'fr');
    });
  }, [cards, folderMap, activeFilter, searchQuery, unlockedPrivateFolders, settings.sortMode]);

  const recentCards = useMemo(() => {
    if (activeFilter !== 'all' || searchQuery.trim() || selectionMode) return [];
    return visibleCards
      .filter((c) => typeof c.lastUsedAt === 'number' && c.lastUsedAt > 0)
      .sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0))
      .slice(0, 3);
  }, [visibleCards, activeFilter, searchQuery, selectionMode]);

  const greeting = useMemo(() => {
    if (selectionMode) {
      return {
        title: `${selectedCardIds.length} sélectionnée${selectedCardIds.length > 1 ? 's' : ''}`,
        subtitle: 'Appuyez sur des cartes pour les cocher ou décocher',
      };
    }
    if (activeFilter === 'all') {
      return getTimeGreeting();
    }
    const count = visibleCards.length;
    const countText =
      count === 0
        ? 'Aucune carte dans cette section'
        : `${count} ${count > 1 ? 'cartes enregistrées' : 'carte enregistrée'}`;
    if (activeFilter === 'favorites') {
      return { title: 'Favoris', subtitle: countText };
    }
    return {
      title: folderMap[activeFilter.folderId]?.name || 'Catégorie',
      subtitle: countText,
    };
  }, [activeFilter, folderMap, visibleCards.length, selectionMode, selectedCardIds.length]);

  const handleOpenCardCheckout = useCallback(
    async (card: LoyaltyCard) => {
      await HapticService.tap(settings.hapticFeedback);
      const updated = await StorageService.incrementCardUsage(card.id);
      if (updated) {
        setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setCheckoutCard(updated);
      } else {
        setCheckoutCard(card);
      }
    },
    [settings.hapticFeedback]
  );

  const handleCloseCheckout = useCallback(() => {
    setCheckoutCard(null);
  }, []);

  const handleLongPressCard = useCallback(
    async (card: LoyaltyCard) => {
      await HapticService.tap(settings.hapticFeedback);
      setConfirmBulkDelete(false);
      setSelectedCardIds((prev) => (prev.includes(card.id) ? prev : [...prev, card.id]));
    },
    [settings.hapticFeedback]
  );

  const handleToggleCardSelection = useCallback((card: LoyaltyCard) => {
    setConfirmBulkDelete(false);
    setSelectedCardIds((prev) =>
      prev.includes(card.id) ? prev.filter((id) => id !== card.id) : [...prev, card.id]
    );
  }, []);

  const handleSelectAllVisible = () => {
    setConfirmBulkDelete(false);
    const visibleIds = visibleCards.map((c) => c.id);
    const allSelected = visibleIds.every((id) => selectedCardIds.includes(id));
    setSelectedCardIds(allSelected ? [] : visibleIds);
  };

  const handleBulkDelete = async () => {
    if (!confirmBulkDelete) {
      setConfirmBulkDelete(true);
      return;
    }
    await StorageService.bulkDeleteCards(selectedCardIds);
    await HapticService.tap(settings.hapticFeedback);
    const refreshed = await StorageService.getCards();
    setCards(refreshed);
    setSelectedCardIds([]);
    setConfirmBulkDelete(false);
  };

  const handleBulkApplyFolders = async (addIds: string[], removeIds: string[]) => {
    await StorageService.bulkUpdateCardsFolders(selectedCardIds, addIds, removeIds);
    await HapticService.success(settings.hapticFeedback);
    const refreshed = await StorageService.getCards();
    setCards(refreshed);
    setSelectedCardIds([]);
  };

  const handleSaveCard = async (card: LoyaltyCard) => {
    await StorageService.saveCard(card);
    await HapticService.success(settings.hapticFeedback);
    const refreshed = await StorageService.getCards();
    setCards(refreshed);
    if (checkoutCard?.id === card.id) {
      setCheckoutCard(card);
    }
  };

  const handleDeleteCard = useCallback(
    async (cardId: string) => {
      await StorageService.deleteCard(cardId);
      await HapticService.tap(settings.hapticFeedback);
      setCards((prev) => prev.filter((c) => c.id !== cardId));
      setCheckoutCard(null);
    },
    [settings.hapticFeedback]
  );

  const handleToggleFavorite = useCallback(
    async (card: LoyaltyCard, e?: React.MouseEvent) => {
      e?.stopPropagation();
      await HapticService.tap(settings.hapticFeedback);
      const updated: LoyaltyCard = {
        ...card,
        isFavorite: !card.isFavorite,
        updatedAt: Date.now(),
      };
      await StorageService.saveCard(updated);
      setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setCheckoutCard((cur) => (cur?.id === updated.id ? updated : cur));
    },
    [settings.hapticFeedback]
  );

  const handleToggleWidgetPin = async (card: LoyaltyCard) => {
    await HapticService.tap(settings.hapticFeedback);
    const nextPin = !card.isPinnedWidget;
    const pinnedCount = cards.filter((c) => c.isPinnedWidget).length;
    const updated: LoyaltyCard = {
      ...card,
      isPinnedWidget: nextPin,
      widgetOrder: nextPin ? pinnedCount + 1 : 99,
      updatedAt: Date.now(),
    };
    await StorageService.saveCard(updated);
    setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  };

  const handleSetMainWidgetCard = async (cardId: string) => {
    await HapticService.tap(settings.hapticFeedback);
    const nextCards = cards.map((c) => ({
      ...c,
      isMainWidgetCard: c.id === cardId,
    }));
    for (const c of nextCards) {
      await StorageService.saveCard(c);
    }
    setCards(nextCards);
  };

  const handleSaveFolder = async (folder: CardFolder) => {
    await StorageService.saveFolder(folder);
    setFolders(await StorageService.getFolders());
  };

  const handleReorderFolders = async (ordered: CardFolder[]) => {
    await StorageService.reorderFolders(ordered);
    setFolders(await StorageService.getFolders());
  };

  const handleDeleteFolder = async (folderId: string) => {
    await StorageService.deleteFolder(folderId);
    if (
      typeof activeFilter === 'object' &&
      activeFilter.type === 'folder' &&
      activeFilter.folderId === folderId
    ) {
      setActiveFilter('all');
    }
    const [nextFolders, nextCards] = await Promise.all([
      StorageService.getFolders(),
      StorageService.getCards(),
    ]);
    setFolders(nextFolders);
    setCards(nextCards);
  };

  const handleUpdateSettings = async (next: AppSettings) => {
    setSettings(next);
    await StorageService.saveSettings(next);
  };

  const handleCycleSortMode = async () => {
    const current = settings.sortMode || 'default';
    const nextIdx = (SORT_ORDER.indexOf(current) + 1) % SORT_ORDER.length;
    await handleUpdateSettings({ ...settings, sortMode: SORT_ORDER[nextIdx] });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8FA] dark:bg-[#0D0E12] text-slate-900 dark:text-white flex items-center justify-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center animate-pulse">
          <CreditCard className="w-6 h-6" strokeWidth={1.75} />
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative min-h-screen bg-[#F7F8FA] dark:bg-[#0D0E12] text-slate-900 dark:text-slate-50 flex flex-col transition-colors duration-200"
      onPointerDown={(e) => {
        edgeSwipeStartX.current = e.clientX <= 28 && !drawerOpen && !selectionMode ? e.clientX : null;
      }}
      onPointerMove={(e) => {
        if (edgeSwipeStartX.current !== null && e.clientX - edgeSwipeStartX.current > 45) {
          edgeSwipeStartX.current = null;
          setDrawerOpen(true);
        }
      }}
      onPointerUp={() => {
        edgeSwipeStartX.current = null;
      }}
    >
      {/* Halo ambiant discret */}
      {!settings.highContrast && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-0 h-52 bg-gradient-to-b from-blue-500/[0.06] via-indigo-500/[0.02] to-transparent dark:from-blue-500/[0.09] dark:via-indigo-500/[0.03]"
        />
      )}

      {/* En-tête épuré */}
      <header className="relative z-10 max-w-3xl w-full mx-auto px-5 pt-4 pb-3 safe-top">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight truncate">
              {greeting.title}
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 hc-muted mt-0.5">
              {greeting.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 pt-1">
            {selectionMode ? (
              <button
                type="button"
                onClick={handleSelectAllVisible}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 text-white text-xs font-bold shadow-sm active:scale-95 transition-transform"
              >
                <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                Tout cocher
              </button>
            ) : (
              <>
                {activeFilter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => handleSelectFilter('all')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white dark:bg-[#16181F] hc-surface border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm active:scale-95 transition-transform"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={2} />
                    Toutes
                  </button>
                )}
                <span className="px-3 py-1.5 rounded-full bg-white/90 dark:bg-[#16181F]/90 hc-surface border border-slate-200/80 dark:border-slate-800/80 text-xs font-bold text-slate-700 dark:text-slate-200 shadow-sm">
                  {visibleCards.length} {visibleCards.length > 1 ? 'cartes' : 'carte'}
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Portefeuille */}
      <main className="relative z-10 flex-1 max-w-3xl w-full mx-auto px-5 pt-2 pb-28 space-y-5">
        {/* Section Récemment ouvertes */}
        <AnimatePresence>
          {recentCards.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              <div className="flex items-center gap-2 px-0.5">
                <Clock className="w-3.5 h-3.5 text-slate-400 hc-muted" strokeWidth={2} />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 hc-muted">
                  Récemment ouvertes
                </h2>
              </div>

              <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
                {recentCards.map((card) => (
                  <button
                    key={`recent-${card.id}`}
                    type="button"
                    onClick={() => handleOpenCardCheckout(card)}
                    className="flex-1 min-w-[120px] p-3 rounded-2xl bg-white dark:bg-[#16181F] hc-surface border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-2.5 text-left transition-transform duration-150 active:scale-[0.97]"
                  >
                    <BrandLogo brandName={card.brandName} domain={card.domain} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                        {card.customName || card.brandName}
                      </p>
                      <span
                        className="inline-block mt-1 w-6 h-1 rounded-full"
                        style={{ backgroundColor: card.primaryColor }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Liste / Grille principale */}
        {visibleCards.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="mt-6 p-8 rounded-3xl bg-white dark:bg-[#16181F] hc-surface border border-slate-200/80 dark:border-slate-800/80 text-center shadow-sm"
          >
            <div className="relative w-24 h-16 mx-auto mb-5" aria-hidden="true">
              <div className="absolute inset-x-3 top-0 h-11 rounded-xl bg-blue-500/15 dark:bg-blue-400/20 -rotate-6 border border-blue-500/20" />
              <div className="absolute inset-x-1 top-2 h-12 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md flex items-center justify-center">
                <CreditCard className="w-6 h-6" strokeWidth={1.75} />
              </div>
            </div>

            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {searchQuery ? 'Aucun résultat' : 'Votre portefeuille est vide'}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 hc-muted mt-1.5 max-w-xs mx-auto leading-relaxed">
              {searchQuery
                ? 'Aucune carte ne correspond à votre recherche.'
                : 'Ajoutez votre première carte de fidélité pour l’avoir toujours sous la main en caisse.'}
            </p>
            {!searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setEditingCard(null);
                  setAddModalOpen(true);
                }}
                className="mt-6 inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm shadow-sm active:scale-95 transition-transform"
              >
                <Plus className="w-4 h-4" strokeWidth={2.2} />
                Ajouter une carte
              </button>
            )}
          </motion.div>
        ) : (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2 px-0.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 hc-muted">
                {recentCards.length > 0 ? 'Toutes vos cartes' : 'Vos cartes'}
                {!selectionMode && (
                  <span className="ml-2 font-medium normal-case opacity-75">
                    · Appui long pour sélectionner
                  </span>
                )}
              </h2>

              {visibleCards.length >= 2 && !selectionMode && (
                <button
                  type="button"
                  onClick={handleCycleSortMode}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-[#16181F] hc-surface border border-slate-200/80 dark:border-slate-800/80 text-[11px] font-semibold text-slate-600 dark:text-slate-300 active:scale-95 transition-transform"
                >
                  <ArrowUpDown className="w-3 h-3" strokeWidth={2} />
                  Tri : {SORT_LABELS[settings.sortMode || 'default']}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {visibleCards.map((card, index) => {
                const folderNames = getCardFolderIds(card)
                  .map((id) => folderMap[id]?.name)
                  .filter((n): n is string => Boolean(n));
                return (
                  <LoyaltyCardItem
                    key={card.id}
                    card={card}
                    folderNames={folderNames}
                    index={index}
                    highContrast={settings.highContrast}
                    largeText={settings.largeText}
                    selectionMode={selectionMode}
                    isSelected={selectedCardIds.includes(card.id)}
                    onOpen={handleOpenCardCheckout}
                    onLongPress={handleLongPressCard}
                    onToggleSelect={handleToggleCardSelection}
                    onToggleFavorite={handleToggleFavorite}
                  />
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* Barre inférieure pleine largeur : bascule entre Navigation et Actions Sélection Multi-Cartes */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-[#12141A]/95 hc-surface backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 shadow-sheet safe-bottom">
        {selectionMode ? (
          <div className="max-w-3xl mx-auto px-3.5 pt-2.5 pb-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSelectedCardIds([]);
                setConfirmBulkDelete(false);
              }}
              className="h-12 px-3.5 rounded-2xl bg-[#F7F8FA] dark:bg-[#1B1E27] border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5 shrink-0 active:scale-95 transition-transform"
            >
              <X className="w-4 h-4" strokeWidth={2} />
              Annuler
            </button>

            <button
              type="button"
              onClick={() => setBulkCategoryOpen(true)}
              className="flex-1 h-12 px-3 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
            >
              <FolderPlus className="w-4 h-4" strokeWidth={2} />
              Catégories
            </button>

            <button
              type="button"
              onClick={handleBulkDelete}
              className={`h-12 px-4 rounded-2xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shrink-0 active:scale-95 transition-colors ${
                confirmBulkDelete
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
              }`}
            >
              <Trash2 className="w-4 h-4" strokeWidth={2} />
              {confirmBulkDelete
                ? `Confirmer (${selectedCardIds.length})`
                : `Supprimer (${selectedCardIds.length})`}
            </button>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-3.5 pt-2.5 pb-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                HapticService.tap(settings.hapticFeedback);
                setDrawerOpen(true);
              }}
              className="w-12 h-12 rounded-2xl bg-[#F7F8FA] dark:bg-[#1B1E27] border border-slate-200/80 dark:border-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-100 shrink-0 active:scale-95 transition-transform"
              aria-label="Ouvrir le menu et les catégories"
            >
              <Menu className="w-5 h-5" strokeWidth={1.9} />
            </button>

            <div className="relative flex-1 min-w-0">
              <Search
                className="w-4 h-4 text-slate-400 hc-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                strokeWidth={1.9}
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher..."
                className="w-full h-12 pl-10 pr-9 rounded-2xl bg-[#F7F8FA] dark:bg-[#1B1E27] border border-slate-200/80 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="w-7 h-7 rounded-full bg-slate-200/80 dark:bg-slate-700 flex items-center justify-center absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-200"
                  aria-label="Effacer la recherche"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                HapticService.tap(settings.hapticFeedback);
                setEditingCard(null);
                setAddModalOpen(true);
              }}
              className="h-12 px-4 sm:px-5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm shadow-sm flex items-center justify-center gap-1.5 shrink-0 active:scale-95 transition-transform"
            >
              <Plus className="w-4 h-4" strokeWidth={2.25} />
              <span>Ajouter</span>
            </button>
          </div>
        )}
      </div>

      {/* Tiroir de navigation gauche */}
      <Suspense fallback={null}>
        <NavigationDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          folders={folders}
          activeFilter={activeFilter}
          onSelectFilter={handleSelectFilter}
          totalCardsCount={cards.length}
          favoritesCount={favoritesCount}
          cardCountsByFolder={cardCountsByFolder}
          onSaveFolder={handleSaveFolder}
          onReorderFolders={handleReorderFolders}
          onDeleteFolder={handleDeleteFolder}
          onOpenSettings={() => setSettingsModalOpen(true)}
        />
      </Suspense>

      {/* Mode Caisse */}
      <Suspense fallback={null}>
        <AnimatePresence>
          {checkoutCard && (
            <CardCheckoutModal
              card={checkoutCard}
              folders={getCardFolderIds(checkoutCard)
                .map((id) => folderMap[id])
                .filter((f): f is CardFolder => Boolean(f))}
              settings={settings}
              onClose={handleCloseCheckout}
              onEdit={(card) => {
                setCheckoutCard(null);
                setEditingCard(card);
                setAddModalOpen(true);
              }}
              onDelete={handleDeleteCard}
              onToggleFavorite={(card) => handleToggleFavorite(card)}
            />
          )}
        </AnimatePresence>
      </Suspense>

      {/* Ajout / Édition de carte */}
      <Suspense fallback={null}>
        <AnimatePresence>
          {addModalOpen && (
            <AddCardModal
              folders={folders}
              editingCard={editingCard}
              defaultFolderId={
                typeof activeFilter === 'object' && activeFilter.type === 'folder'
                  ? activeFilter.folderId
                  : undefined
              }
              onSave={handleSaveCard}
              onCreateFolder={handleSaveFolder}
              onClose={() => {
                setAddModalOpen(false);
                setEditingCard(null);
              }}
            />
          )}
        </AnimatePresence>
      </Suspense>

      {/* Catégories en lot (Mode Sélection) */}
      <Suspense fallback={null}>
        <AnimatePresence>
          {bulkCategoryOpen && selectionMode && (
            <BulkCategoryModal
              selectedCards={cards.filter((c) => selectedCardIds.includes(c.id))}
              folders={folders}
              onApply={handleBulkApplyFolders}
              onCreateFolder={handleSaveFolder}
              onClose={() => setBulkCategoryOpen(false)}
            />
          )}
        </AnimatePresence>
      </Suspense>

      {/* Paramètres */}
      <Suspense fallback={null}>
        <AnimatePresence>
          {settingsModalOpen && (
            <SettingsModal
              settings={settings}
              cards={cards}
              onUpdateSettings={handleUpdateSettings}
              onToggleWidgetPin={handleToggleWidgetPin}
              onSetMainWidgetCard={handleSetMainWidgetCard}
              onUpdateFound={(upd) => {
                setSettingsModalOpen(false);
                setAvailableUpdate(upd);
              }}
              onDataImported={async () => {
                await reloadDatabase();
              }}
              onClose={() => setSettingsModalOpen(false)}
            />
          )}
        </AnimatePresence>
      </Suspense>

      {/* Écran de verrouillage global */}
      <Suspense fallback={null}>
        <AnimatePresence>
          {appLocked && (
            <SecurityLockModal
              mode="unlock-app"
              settings={settings}
              onUnlock={() => setAppLocked(false)}
            />
          )}
        </AnimatePresence>
      </Suspense>

      {/* Verrouillage dossier privé */}
      <Suspense fallback={null}>
        <AnimatePresence>
          {pendingPrivateFolderId && (
            <SecurityLockModal
              mode="unlock-private"
              settings={settings}
              onCancel={() => setPendingPrivateFolderId(null)}
              onUnlock={() => {
                setUnlockedPrivateFolders((prev) => ({
                  ...prev,
                  [pendingPrivateFolderId]: true,
                }));
                setActiveFilter({ type: 'folder', folderId: pendingPrivateFolderId });
                setPendingPrivateFolderId(null);
              }}
            />
          )}
        </AnimatePresence>
      </Suspense>
      {/* Pop-up de mise à jour GitHub détectée */}
      <Suspense fallback={null}>
        <AnimatePresence>
          {availableUpdate && (
            <UpdatePromptModal
              update={availableUpdate}
              onDismiss={() => {
                UpdateService.dismissForSession(availableUpdate.version);
                setAvailableUpdate(null);
              }}
            />
          )}
        </AnimatePresence>
      </Suspense>
    </div>
  );
}

export default App;
