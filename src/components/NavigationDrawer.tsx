import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  Check,
  CreditCard,
  LayoutGrid,
  Lock,
  Pencil,
  Plus,
  Settings,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { CardFolder, DrawerFilter, FolderIconName } from '../types';
import { FOLDER_ICON_OPTIONS, FolderIcon } from './FolderIcon';

interface NavigationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  folders: CardFolder[];
  activeFilter: DrawerFilter;
  onSelectFilter: (filter: DrawerFilter) => void;
  totalCardsCount: number;
  favoritesCount: number;
  cardCountsByFolder: Record<string, number>;
  onSaveFolder: (folder: CardFolder) => Promise<void>;
  onReorderFolders: (ordered: CardFolder[]) => Promise<void>;
  onDeleteFolder: (folderId: string) => Promise<void>;
  onOpenSettings: () => void;
}

const FOLDER_COLORS = [
  '#2563EB',
  '#16A34A',
  '#0284C7',
  '#EA580C',
  '#DC2626',
  '#4F46E5',
  '#DB2777',
  '#0F766E',
  '#B45309',
  '#334155',
];

export const NavigationDrawer: React.FC<NavigationDrawerProps> = ({
  isOpen,
  onClose,
  folders,
  activeFilter,
  onSelectFilter,
  totalCardsCount,
  favoritesCount,
  cardCountsByFolder,
  onSaveFolder,
  onReorderFolders,
  onDeleteFolder,
  onOpenSettings,
}) => {
  const [editingFolder, setEditingFolder] = useState<Partial<CardFolder> | null>(null);
  const [isManageMode, setIsManageMode] = useState(false);

  const isSelected = (filter: DrawerFilter) => {
    if (typeof filter === 'string' && typeof activeFilter === 'string') {
      return filter === activeFilter;
    }
    if (
      typeof filter === 'object' &&
      typeof activeFilter === 'object' &&
      filter.type === 'folder' &&
      activeFilter.type === 'folder'
    ) {
      return filter.folderId === activeFilter.folderId;
    }
    return false;
  };

  const handleSelect = (filter: DrawerFilter) => {
    onSelectFilter(filter);
    onClose();
  };

  const startCreateFolder = () => {
    setEditingFolder({
      id: `folder-${Date.now()}`,
      name: '',
      color: FOLDER_COLORS[0],
      icon: 'folder',
      isPrivate: false,
      order: folders.length + 1,
      createdAt: Date.now(),
    });
  };

  const handleMoveFolder = async (index: number, direction: 'up' | 'down') => {
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= folders.length) return;
    const next = [...folders];
    const [moved] = next.splice(index, 1);
    next.splice(swapIdx, 0, moved);
    await onReorderFolders(next);
  };

  const handleSubmitFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFolder?.name?.trim()) return;

    const folderToSave: CardFolder = {
      id: editingFolder.id || `folder-${Date.now()}`,
      name: editingFolder.name.trim(),
      color: editingFolder.color || '#2563EB',
      icon: (editingFolder.icon as FolderIconName) || 'folder',
      isPrivate: Boolean(editingFolder.isPrivate),
      order: editingFolder.order ?? folders.length + 1,
      createdAt: editingFolder.createdAt ?? Date.now(),
    };

    await onSaveFolder(folderToSave);
    setEditingFolder(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          />

          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            drag="x"
            dragConstraints={{ left: -320, right: 0 }}
            dragElastic={0.06}
            onDragEnd={(_, info) => {
              if (info.offset.x < -80 || info.velocity.x < -300) {
                onClose();
              }
            }}
            className="relative z-10 w-[84%] max-w-[330px] h-full bg-white dark:bg-[#16181F] shadow-2xl flex flex-col border-r border-slate-200/80 dark:border-slate-800/80 safe-top safe-bottom"
          >
            {/* En-tête sobre */}
            <div className="px-5 pt-4 pb-4 border-b border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                    Mes Cartes
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Portefeuille personnel
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Fermer le menu"
              >
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
              <div className="space-y-1">
                <button
                  onClick={() => handleSelect('all')}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors ${
                    isSelected('all')
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <LayoutGrid className="w-4 h-4" strokeWidth={1.75} />
                    Toutes les cartes
                  </span>
                  <span className="text-xs font-semibold opacity-70">{totalCardsCount}</span>
                </button>

                <button
                  onClick={() => handleSelect('favorites')}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-colors ${
                    isSelected('favorites')
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Star className="w-4 h-4" strokeWidth={1.75} />
                    Favoris
                  </span>
                  <span className="text-xs font-semibold opacity-70">{favoritesCount}</span>
                </button>
              </div>

              {/* Dossiers personnalisés */}
              <div>
                <div className="px-2 mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Dossiers
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setIsManageMode((v) => !v)}
                      className={`text-xs font-semibold px-2 py-1 rounded-lg transition-colors ${
                        isManageMode
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {isManageMode ? 'Terminer' : 'Organiser'}
                    </button>
                    <button
                      onClick={startCreateFolder}
                      className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700"
                      aria-label="Nouveau dossier"
                    >
                      <Plus className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  {folders.map((folder, index) => {
                    const active = isSelected({ type: 'folder', folderId: folder.id });
                    const count = cardCountsByFolder[folder.id] || 0;
                    return (
                      <div key={folder.id} className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            isManageMode
                              ? setEditingFolder({ ...folder })
                              : handleSelect({ type: 'folder', folderId: folder.id })
                          }
                          className={`flex-1 flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm font-semibold transition-colors ${
                            active
                              ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                              : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                          }`}
                        >
                          <span className="flex items-center gap-3 min-w-0">
                            <span
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0"
                              style={{ backgroundColor: folder.color }}
                            >
                              <FolderIcon icon={folder.icon} className="w-4 h-4" />
                            </span>
                            <span className="truncate flex items-center gap-1.5">
                              {folder.name}
                              {folder.isPrivate && (
                                <Lock className="w-3.5 h-3.5 opacity-60 shrink-0" strokeWidth={1.75} />
                              )}
                            </span>
                          </span>
                          <span className="text-xs font-semibold opacity-65 ml-2">{count}</span>
                        </button>

                        {isManageMode && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleMoveFolder(index, 'up')}
                              className="w-7 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center disabled:opacity-30"
                              aria-label="Monter le dossier"
                            >
                              <ArrowUp className="w-3.5 h-3.5" strokeWidth={1.75} />
                            </button>
                            <button
                              type="button"
                              disabled={index === folders.length - 1}
                              onClick={() => handleMoveFolder(index, 'down')}
                              className="w-7 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center disabled:opacity-30"
                              aria-label="Descendre le dossier"
                            >
                              <ArrowDown className="w-3.5 h-3.5" strokeWidth={1.75} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingFolder({ ...folder })}
                              className="w-7 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center"
                              aria-label="Renommer"
                            >
                              <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
                            </button>
                            {folders.length > 1 && (
                              <button
                                type="button"
                                onClick={() => onDeleteFolder(folder.id)}
                                className="w-7 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center"
                                aria-label="Supprimer"
                              >
                                <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={startCreateFolder}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors mt-1"
                  >
                    <Plus className="w-4 h-4" strokeWidth={1.75} />
                    Nouveau dossier
                  </button>
                </div>
              </div>
            </div>

            {/* Pied du tiroir : Paramètres + Éditeur */}
            <div className="p-3 border-t border-slate-200/70 dark:border-slate-800/80 space-y-2">
              <button
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
                className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
              >
                <Settings className="w-4 h-4" strokeWidth={1.75} />
                Paramètres
              </button>

              <p className="text-center text-[11px] font-medium text-slate-400 dark:text-slate-500 pb-0.5">
                © Louis Martignon · @louismrtg
              </p>
            </div>

            {/* Sous-panneau édition / création d'un dossier */}
            <AnimatePresence>
              {editingFolder && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 16 }}
                  className="absolute inset-0 z-20 bg-white dark:bg-[#16181F] flex flex-col p-5 overflow-y-auto"
                >
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {folders.some((f) => f.id === editingFolder.id)
                        ? 'Modifier le dossier'
                        : 'Nouveau dossier'}
                    </h3>
                    <button
                      onClick={() => setEditingFolder(null)}
                      className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
                    >
                      <X className="w-4 h-4" strokeWidth={1.75} />
                    </button>
                  </div>

                  <form onSubmit={handleSubmitFolder} className="space-y-5 flex-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                        Nom du dossier
                      </label>
                      <input
                        type="text"
                        required
                        autoFocus
                        value={editingFolder.name || ''}
                        onChange={(e) =>
                          setEditingFolder((prev) => ({ ...prev, name: e.target.value }))
                        }
                        placeholder="Ex: Jardinage, Restaurants..."
                        className="w-full px-3.5 py-3 rounded-xl bg-[#F7F8FA] dark:bg-[#0D0E12] border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                        Couleur
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {FOLDER_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => setEditingFolder((prev) => ({ ...prev, color }))}
                            className="w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90"
                            style={{ backgroundColor: color }}
                          >
                            {editingFolder.color === color && (
                              <Check className="w-4 h-4 text-white" strokeWidth={2.25} />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                        Icône
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {FOLDER_ICON_OPTIONS.map((opt) => {
                          const selected = editingFolder.icon === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                setEditingFolder((prev) => ({ ...prev, icon: opt.id }))
                              }
                              className={`p-2 rounded-xl flex flex-col items-center gap-1 border text-[11px] font-semibold transition-colors ${
                                selected
                                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              <FolderIcon icon={opt.id} className="w-4 h-4" />
                              <span className="truncate w-full text-center">{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <label className="flex items-center justify-between p-3.5 rounded-xl bg-[#F7F8FA] dark:bg-[#0D0E12] border border-slate-200/80 dark:border-slate-800 cursor-pointer">
                      <span className="flex items-center gap-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                        <Lock className="w-4 h-4 text-slate-500" strokeWidth={1.75} />
                        Marquer comme dossier privé
                      </span>
                      <input
                        type="checkbox"
                        checked={Boolean(editingFolder.isPrivate)}
                        onChange={(e) =>
                          setEditingFolder((prev) => ({ ...prev, isPrivate: e.target.checked }))
                        }
                        className="w-4 h-4 accent-blue-600"
                      />
                    </label>

                    <div className="pt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingFolder(null)}
                        className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold"
                      >
                        Enregistrer
                      </button>
                    </div>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};
