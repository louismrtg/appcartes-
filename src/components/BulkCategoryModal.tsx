import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Minus, Plus, X } from 'lucide-react';
import { CardFolder, LoyaltyCard, getCardFolderIds } from '../types';
import { FolderIcon } from './FolderIcon';

interface BulkCategoryModalProps {
  selectedCards: LoyaltyCard[];
  folders: CardFolder[];
  onApply: (addFolderIds: string[], removeFolderIds: string[]) => Promise<void>;
  onCreateFolder: (folder: CardFolder) => Promise<void>;
  onClose: () => void;
}

const NEW_COLORS = [
  '#2563EB',
  '#16A34A',
  '#0284C7',
  '#EA580C',
  '#DC2626',
  '#6D28D9',
  '#DB2777',
  '#0F766E',
];

export const BulkCategoryModal: React.FC<BulkCategoryModalProps> = ({
  selectedCards,
  folders,
  onApply,
  onCreateFolder,
  onClose,
}) => {
  const initialStates = useMemo(() => {
    const map: Record<string, 'all' | 'some' | 'none'> = {};
    folders.forEach((f) => {
      const count = selectedCards.filter((c) => getCardFolderIds(c).includes(f.id)).length;
      if (count === 0) map[f.id] = 'none';
      else if (count === selectedCards.length) map[f.id] = 'all';
      else map[f.id] = 'some';
    });
    return map;
  }, [folders, selectedCards]);

  const [folderStates, setFolderStates] = useState<Record<string, 'all' | 'some' | 'none'>>(
    initialStates
  );
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(NEW_COLORS[0]);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);

  const toggleFolder = (folderId: string) => {
    setFolderStates((prev) => {
      const cur = prev[folderId] || 'none';
      return {
        ...prev,
        [folderId]: cur === 'all' ? 'none' : 'all',
      };
    });
  };

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const created: CardFolder = {
      id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      color: newColor,
      icon: 'folder',
      isPrivate: false,
      order: folders.length + 1,
      createdAt: Date.now(),
    };
    await onCreateFolder(created);
    setFolderStates((prev) => ({ ...prev, [created.id]: 'all' }));
    setNewName('');
    setShowNew(false);
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const addIds: string[] = [];
      const removeIds: string[] = [];
      Object.entries(folderStates).forEach(([folderId, state]) => {
        if (state === 'all' && initialStates[folderId] !== 'all') {
          addIds.push(folderId);
        } else if (state === 'none' && initialStates[folderId] !== 'none') {
          removeIds.push(folderId);
        }
      });
      await onApply(addIds, removeIds);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center"
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 340 }}
        className="w-full sm:max-w-md max-h-[85dvh] bg-[#F7F8FA] dark:bg-[#0D0E12] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden safe-bottom"
      >
        <div className="px-5 pt-5 pb-3.5 bg-white dark:bg-[#16181F] border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Gérer les catégories
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {selectedCards.length} {selectedCards.length > 1 ? 'cartes sélectionnées' : 'carte sélectionnée'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {folders.map((folder) => {
            const state = folderStates[folder.id] || 'none';
            return (
              <button
                key={folder.id}
                type="button"
                onClick={() => toggleFolder(folder.id)}
                className="w-full p-3.5 rounded-2xl bg-white dark:bg-[#16181F] hc-surface border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-3 text-left active:scale-[0.99] transition-transform"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: folder.color }}
                  >
                    <FolderIcon icon={folder.icon} className="w-4 h-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                      {folder.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {state === 'all'
                        ? 'Associée à toutes les cartes'
                        : state === 'some'
                          ? 'Associée à certaines cartes'
                          : 'Non associée'}
                    </p>
                  </div>
                </div>

                <span
                  className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                    state === 'all'
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : state === 'some'
                        ? 'bg-blue-100 dark:bg-blue-950/60 border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {state === 'all' && <Check className="w-4 h-4" strokeWidth={2.5} />}
                  {state === 'some' && <Minus className="w-4 h-4" strokeWidth={2.5} />}
                </span>
              </button>
            );
          })}

          {!showNew ? (
            <button
              type="button"
              onClick={() => setShowNew(true)}
              className="w-full p-3.5 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-sm font-semibold text-blue-600 dark:text-blue-400 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" strokeWidth={2} />
              Nouvelle catégorie
            </button>
          ) : (
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex gap-2">
                <input
                  type="text"
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreate();
                    }
                  }}
                  placeholder="Nom de la catégorie..."
                  className="flex-1 px-3 py-2 rounded-xl bg-[#F7F8FA] dark:bg-[#0D0E12] border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  disabled={!newName.trim()}
                  onClick={handleCreate}
                  className="px-3.5 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-40"
                >
                  Créer
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                {NEW_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewColor(color)}
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: color }}
                  >
                    {newColor === color && <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-white dark:bg-[#16181F] border-t border-slate-200/80 dark:border-slate-800/80 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleConfirm}
            className="flex-1 py-3.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold disabled:opacity-50"
          >
            {saving ? 'Application...' : 'Appliquer'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};
