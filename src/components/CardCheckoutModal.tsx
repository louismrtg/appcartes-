import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Pencil,
  RotateCw,
  Star,
  Sun,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { AppSettings, CardFolder, LoyaltyCard } from '../types';
import { BrightnessService } from '../services/BrightnessService';
import { OrientationService } from '../services/OrientationService';
import { HapticService } from '../services/HapticService';
import { BrandLogo } from './BrandLogo';
import { BarcodeRenderer } from './BarcodeRenderer';

interface CardCheckoutModalProps {
  card: LoyaltyCard;
  folders: CardFolder[];
  settings: AppSettings;
  onClose: () => void;
  onEdit: (card: LoyaltyCard) => void;
  onDelete: (cardId: string) => Promise<void>;
  onToggleFavorite: (card: LoyaltyCard) => Promise<void>;
}

export const CardCheckoutModal: React.FC<CardCheckoutModalProps> = ({
  card,
  folders,
  settings,
  onClose,
  onEdit,
  onDelete,
  onToggleFavorite,
}) => {
  const [brightnessActive, setBrightnessActive] = useState(false);
  const [wakeLocked, setWakeLocked] = useState(false);
  const [isLandscape, setIsLandscape] = useState(settings.autoLandscape);
  const [copied, setCopied] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleClose = useCallback(async () => {
    await BrightnessService.restore();
    await OrientationService.restorePortrait();
    onClose();
  }, [onClose]);

  useEffect(() => {
    let mounted = true;

    const activateCheckoutHardware = async () => {
      const result = await BrightnessService.boostToMax({
        maxBrightness: settings.autoMaxBrightness,
        keepAwake: settings.keepAwake,
      });

      if (mounted) {
        setBrightnessActive(result.brightnessBoosted);
        setWakeLocked(result.wakeLocked);
      }

      if (settings.autoLandscape) {
        await OrientationService.lockLandscape();
      }
    };

    activateCheckoutHardware();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    let backListenerPromise: Promise<{ remove: () => Promise<void> }> | null = null;
    if (Capacitor.isNativePlatform()) {
      backListenerPromise = CapacitorApp.addListener('backButton', () => {
        handleClose();
      });
    }

    return () => {
      mounted = false;
      window.removeEventListener('keydown', onKeyDown);
      if (backListenerPromise) {
        backListenerPromise.then((h) => h.remove()).catch(() => {});
      }
      BrightnessService.restore();
      OrientationService.restorePortrait();
    };
  }, [settings.autoLandscape, settings.autoMaxBrightness, settings.keepAwake, handleClose]);

  const handleToggleOrientation = async () => {
    await HapticService.tap(settings.hapticFeedback);
    if (isLandscape) {
      await OrientationService.restorePortrait();
      setIsLandscape(false);
    } else {
      await OrientationService.lockLandscape();
      setIsLandscape(true);
    }
  };

  const handleCopyNumber = async () => {
    await HapticService.tap(settings.hapticFeedback);
    try {
      await navigator.clipboard.writeText(card.barcodeValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Non bloquant
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col justify-between overflow-y-auto safe-top safe-bottom"
      style={{
        background: `linear-gradient(155deg, ${card.primaryColor} 0%, ${card.secondaryColor} 100%)`,
      }}
    >
      {/* En-tête sobre : Logo officiel + Nom + Bouton fermer */}
      <header className="px-5 pt-3 pb-2 flex items-center justify-between gap-3 text-white">
        <div className="flex items-center gap-3 min-w-0">
          <BrandLogo brandName={card.brandName} domain={card.domain} size="md" />
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight truncate leading-tight">
              {card.customName || card.brandName}
            </h2>
            <p className="text-xs font-medium opacity-85 truncate">
              {card.brandName}
              {folders.length > 0 ? ` · ${folders.map((f) => f.name).join(' · ')}` : ''}
            </p>
          </div>
        </div>

        <button
          onClick={handleClose}
          className="w-11 h-11 rounded-full bg-black/20 hover:bg-black/35 text-white flex items-center justify-center backdrop-blur-md transition-colors shrink-0"
          aria-label="Fermer la carte"
        >
          <X className="w-5 h-5" strokeWidth={1.75} />
        </button>
      </header>

      {/* Indicateurs discrets d'état matériel */}
      <div className="px-5 flex flex-wrap items-center justify-center gap-2 text-[11px] font-semibold text-white/90">
        {brightnessActive && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/20 backdrop-blur-sm">
            <Sun className="w-3.5 h-3.5" strokeWidth={1.75} />
            Luminosité 100 %
          </span>
        )}
        {wakeLocked && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/20 backdrop-blur-sm">
            <Zap className="w-3.5 h-3.5" strokeWidth={1.75} />
            Écran actif
          </span>
        )}
        <button
          type="button"
          onClick={handleToggleOrientation}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/20 hover:bg-black/30 backdrop-blur-sm transition-colors"
        >
          <RotateCw className="w-3.5 h-3.5" strokeWidth={1.75} />
          {isLandscape ? 'Paysage' : 'Portrait'}
        </button>
      </div>

      {/* Zone centrale : Code-barres blanc pur haute définition */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-4 max-w-2xl w-full mx-auto">
        <motion.div
          layoutId={`wallet-card-${card.id}`}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
          className="w-full"
        >
          <BarcodeRenderer value={card.barcodeValue} format={card.barcodeFormat} size="checkout" />
        </motion.div>

        {card.notes && card.notes.trim().length > 0 && (
          <div className="mt-3 w-full rounded-2xl bg-black/25 backdrop-blur-md p-3.5 text-white">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/80">
                Note personnelle
              </span>
              <button
                type="button"
                onClick={() => setShowNote((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25"
              >
                {showNote ? (
                  <EyeOff className="w-3.5 h-3.5" strokeWidth={1.75} />
                ) : (
                  <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
                )}
                {showNote ? 'Masquer' : 'Afficher'}
              </button>
            </div>
            <p className="mt-1.5 text-sm font-medium leading-relaxed">
              {showNote ? card.notes : 'Contenu masqué'}
            </p>
          </div>
        )}
      </main>

      {/* Actions rapides en bas */}
      <footer className="px-4 pb-4 pt-2 max-w-2xl w-full mx-auto">
        <div className="grid grid-cols-4 gap-2">
          <button
            type="button"
            onClick={handleCopyNumber}
            className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-2xl bg-black/20 hover:bg-black/30 text-white text-xs font-semibold backdrop-blur-sm"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-300" strokeWidth={1.75} />
            ) : (
              <Copy className="w-4 h-4" strokeWidth={1.75} />
            )}
            <span>{copied ? 'Copié' : 'Copier'}</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleFavorite(card)}
            className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-2xl bg-black/20 hover:bg-black/30 text-white text-xs font-semibold backdrop-blur-sm"
          >
            <Star
              strokeWidth={1.75}
              className={`w-4 h-4 ${card.isFavorite ? 'fill-amber-300 text-amber-300' : ''}`}
            />
            <span>Favori</span>
          </button>

          <button
            type="button"
            onClick={() => {
              BrightnessService.restore();
              OrientationService.restorePortrait();
              onEdit(card);
            }}
            className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-2xl bg-black/20 hover:bg-black/30 text-white text-xs font-semibold backdrop-blur-sm"
          >
            <Pencil className="w-4 h-4" strokeWidth={1.75} />
            <span>Modifier</span>
          </button>

          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-2xl bg-black/20 hover:bg-rose-600/80 text-white text-xs font-semibold backdrop-blur-sm transition-colors"
            >
              <Trash2 className="w-4 h-4" strokeWidth={1.75} />
              <span>Supprimer</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={async () => {
                await BrightnessService.restore();
                await OrientationService.restorePortrait();
                await onDelete(card.id);
              }}
              className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-2xl bg-rose-600 text-white text-xs font-bold"
            >
              <Check className="w-4 h-4" strokeWidth={1.75} />
              <span>Confirmer</span>
            </button>
          )}
        </div>
      </footer>
    </motion.div>
  );
};
