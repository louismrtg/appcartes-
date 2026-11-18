import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Clock, CreditCard, Menu, Plus, Search, X } from 'lucide-react';
import {
  AppSettings,
  CardFolder,
  DrawerFilter,
  LoyaltyCard,
  getCardFolderIds,
} from './types';
import { DEFAULT_SETTINGS, StorageService } from './services/StorageService';
import { WidgetService } from './services/WidgetService';
import { HapticService } from './services/HapticService';
import { BiometricService } from './services/BiometricService';
import { NavigationDrawer } from './components/NavigationDrawer';
import { LoyaltyCardItem } from './components/LoyaltyCardItem';
import { BrandLogo } from './components/BrandLogo';
import { CardCheckoutModal } from './components/CardCheckoutModal';
import { AddCardModal } from './components/AddCardModal';
import { SettingsModal } from './components/SettingsModal';
import { SecurityLockModal } from './components/SecurityLockModal';

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

  const [appLocked, setAppLocked] = useState(false);
  const [unlockedPrivateFolders, setUnlockedPrivateFolders] = useState<Record<string, boolean>>({});
  const [pendingPrivateFolderId, setPendingPrivateFolderId] = useState<string | null>(null);

  const edgeSwipeStartX = useRef<number | null>(null);
  const backgroundTimestampRef = useRef<number | null>(null);

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
    },
    [folderMap, settings, unlockedPrivateFolders, canLockDevice]
  );

  const visibleCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return cards.filter((card) => {
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
  }, [cards, folderMap, activeFilter, searchQuery, unlockedPrivateFolders]);

  const recentCards = useMemo(() => {
    if (activeFilter !== 'all' || searchQuery.trim()) return [];
    return visibleCards
      .filter((c) => typeof c.lastUsedAt === 'number' && c.lastUsedAt > 0)
      .sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0))
      .slice(0, 3);
  }, [visibleCards, activeFilter, searchQuery]);

  const greeting = useMemo(() => {
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
  }, [activeFilter, folderMap, visibleCards.length]);

  const handleOpenCardCheckout = async (card: LoyaltyCard) => {
    await HapticService.tap(settings.hapticFeedback);
    const updated = await StorageService.incrementCardUsage(card.id);
    if (updated) {
      setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setCheckoutCard(updated);
    } else {
      setCheckoutCard(card);
    }
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

  const handleDeleteCard = async (cardId: string) => {
    await StorageService.deleteCard(cardId);
    await HapticService.tap(settings.hapticFeedback);
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    setCheckoutCard(null);
  };

  const handleToggleFavorite = async (card: LoyaltyCard, e?: React.MouseEvent) => {
    e?.stopPropagation();
    await HapticService.tap(settings.hapticFeedback);
    const updated: LoyaltyCard = {
      ...card,
      isFavorite: !card.isFavorite,
      updatedAt: Date.now(),
    };
    await StorageService.saveCard(updated);
    setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    if (checkoutCard?.id === updated.id) {
      setCheckoutCard(updated);
    }
  };

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
        edgeSwipeStartX.current = e.clientX <= 28 && !drawerOpen ? e.clientX : null;
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
      {/* Halo ambiant discret en haut pour habiller l'écran */}
      {!settings.highContrast && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-0 h-56 bg-gradient-to-b from-blue-500/[0.06] via-indigo-500/[0.02] to-transparent dark:from-blue-500/[0.09] dark:via-indigo-500/[0.03]"
        />
      )}

      {/* En-tête épuré : Salutation chaleureuse + compteur discret */}
      <header className="relative z-10 max-w-3xl w-full mx-auto px-5 pt-4 pb-3 safe-top">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="flex items-start justify-between gap-3"
        >
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight truncate">
              {greeting.title}
            </h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 hc-muted mt-0.5">
              {greeting.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 pt-1">
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
          </div>
        </motion.div>
      </header>

      {/* Portefeuille */}
      <main className="relative z-10 flex-1 max-w-3xl w-full mx-auto px-5 pt-2 pb-28 space-y-6">
        {/* Section Récemment ouvertes */}
        <AnimatePresence>
          {recentCards.length > 0 && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-2.5"
            >
              <div className="flex items-center gap-2 px-0.5">
                <Clock
                  className="w-3.5 h-3.5 text-slate-400 hc-muted"
                  strokeWidth={2}
                />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 hc-muted">
                  Récemment ouvertes
                </h2>
              </div>

              <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1">
                {recentCards.map((card, idx) => (
                  <motion.button
                    key={`recent-${card.id}`}
                    type="button"
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.04, type: 'spring', stiffness: 360, damping: 26 }}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleOpenCardCheckout(card)}
                    className="flex-1 min-w-[125px] p-3 rounded-2xl bg-white dark:bg-[#16181F] hc-surface border border-slate-200/80 dark:border-slate-800/80 shadow-sm flex items-center gap-2.5 text-left transition-shadow hover:shadow-md"
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
                  </motion.button>
                ))}
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Liste / Grille principale */}
        {visibleCards.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="mt-6 p-8 rounded-3xl bg-white dark:bg-[#16181F] hc-surface border border-slate-200/80 dark:border-slate-800/80 text-center shadow-sm"
          >
            {/* Illustration vectorielle épurée de pile de cartes */}
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
              <motion.button
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={() => {
                  setEditingCard(null);
                  setAddModalOpen(true);
                }}
                className="mt-6 inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm shadow-sm"
              >
                <Plus className="w-4 h-4" strokeWidth={2.2} />
                Ajouter une carte
              </motion.button>
            )}
          </motion.div>
        ) : (
          <section className="space-y-3">
            {recentCards.length > 0 && (
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 hc-muted px-0.5">
                Toutes vos cartes
              </h2>
            )}
            <LayoutGroup>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <AnimatePresence mode="popLayout">
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
                        onOpen={handleOpenCardCheckout}
                        onToggleFavorite={handleToggleFavorite}
                      />
                    );
                  })}
                </AnimatePresence>
              </div>
            </LayoutGroup>
          </section>
        )}
      </main>

      {/* Barre inférieure ergonomique pleine largeur (Menu + Recherche + Ajouter) */}
      <div className="fixed bottom-0 inset-x-0 z-30 bg-white/92 dark:bg-[#12141A]/92 hc-surface backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 shadow-sheet safe-bottom">
        <div className="max-w-3xl mx-auto px-3.5 pt-2.5 pb-1 flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.92 }}
            type="button"
            onClick={() => {
              HapticService.tap(settings.hapticFeedback);
              setDrawerOpen(true);
            }}
            className="w-12 h-12 rounded-2xl bg-[#F7F8FA] dark:bg-[#1B1E27] border border-slate-200/80 dark:border-slate-800 flex items-center justify-center text-slate-800 dark:text-slate-100 shrink-0"
            aria-label="Ouvrir le menu et les catégories"
          >
            <Menu className="w-5 h-5" strokeWidth={1.9} />
          </motion.button>

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

          <motion.button
            whileTap={{ scale: 0.94 }}
            type="button"
            onClick={() => {
              HapticService.tap(settings.hapticFeedback);
              setEditingCard(null);
              setAddModalOpen(true);
            }}
            className="h-12 px-4 sm:px-5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-sm shadow-sm flex items-center justify-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" strokeWidth={2.25} />
            <span>Ajouter</span>
          </motion.button>
        </div>
      </div>

      {/* Tiroir de navigation gauche */}
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

      {/* Mode Caisse */}
      <AnimatePresence>
        {checkoutCard && (
          <CardCheckoutModal
            card={checkoutCard}
            folders={getCardFolderIds(checkoutCard)
              .map((id) => folderMap[id])
              .filter((f): f is CardFolder => Boolean(f))}
            settings={settings}
            onClose={() => setCheckoutCard(null)}
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

      {/* Ajout / Édition de carte */}
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

      {/* Paramètres (Thème, Accessibilité, Sécurité, Widgets, Sauvegarde) */}
      <AnimatePresence>
        {settingsModalOpen && (
          <SettingsModal
            settings={settings}
            cards={cards}
            onUpdateSettings={handleUpdateSettings}
            onToggleWidgetPin={handleToggleWidgetPin}
            onSetMainWidgetCard={handleSetMainWidgetCard}
            onDataImported={async () => {
              await reloadDatabase();
            }}
            onClose={() => setSettingsModalOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Écran de verrouillage global */}
      <AnimatePresence>
        {appLocked && (
          <SecurityLockModal
            mode="unlock-app"
            settings={settings}
            onUnlock={() => setAppLocked(false)}
          />
        )}
      </AnimatePresence>

      {/* Verrouillage dossier privé */}
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
    </div>
  );
}

export default App;
