import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Share } from '@capacitor/share';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  Pencil,
  RotateCw,
  Share2,
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
  const initialOrientation = settings.lockAppLandscape
    ? 'landscape'
    : settings.defaultCheckoutOrientation || 'landscape';

  const [brightnessActive, setBrightnessActive] = useState(false);
  const [wakeLocked, setWakeLocked] = useState(false);
  const [isLandscape, setIsLandscape] = useState(initialOrientation === 'landscape');
  const [immersive, setImmersive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Refs stables pour éviter qu'un clic sur Favori/Copier ne redéclenche l'effet matériel
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const keepAppLandscapeRef = useRef(settings.lockAppLandscape);
  keepAppLandscapeRef.current = settings.lockAppLandscape;

  const handleClose = useCallback(async () => {
    await BrightnessService.restore();
    await OrientationService.restorePortrait(keepAppLandscapeRef.current);
    onCloseRef.current();
  }, []);

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

      if (initialOrientation === 'landscape') {
        await OrientationService.lockLandscape();
      } else {
        await OrientationService.lockPortrait();
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
      OrientationService.restorePortrait(keepAppLandscapeRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleOrientation = async () => {
    await HapticService.tap(settings.hapticIntensity);
    if (isLandscape) {
      await OrientationService.lockPortrait();
      setIsLandscape(false);
    } else {
      await OrientationService.lockLandscape();
      setIsLandscape(true);
    }
  };

  const handleCopyNumber = async () => {
    await HapticService.tap(settings.hapticIntensity);
    try {
      await navigator.clipboard.writeText(card.barcodeValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Non bloquant
    }
  };

  const handleShareCard = async () => {
    await HapticService.tap(settings.hapticIntensity);
    const title = card.customName || card.brandName;
    const text = `Carte ${title} (${card.brandName}) : ${card.barcodeValue}`;

    if (Capacitor.isNativePlatform()) {
      try {
        await Share.share({
          title,
          text,
          dialogTitle: `Partager ${title}`,
        });
        return;
      } catch {
        // Fallback clipboard
      }
    }

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text });
        return;
      } catch {
        // Fallback clipboard
      }
    }

    await handleCopyNumber();
  };

  const formattedExpiry = card.expiryDate
    ? new Date(`${card.expiryDate}T12:00:00`).toLocaleDateString('fr-FR')
    : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      className="fixed inset-0 z-50 flex flex-col justify-between overflow-hidden safe-top safe-bottom"
      style={{
        background: immersive
          ? '#FFFFFF'
          : `linear-gradient(155deg, ${card.primaryColor} 0%, ${card.secondaryColor} 100%)`,
      }}
    >
      {/* En-tête compact pleine largeur */}
      {!immersive && (
        <header className="px-4 sm:px-6 pt-2 pb-1.5 flex items-center justify-between gap-2 text-white shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandLogo brandName={card.brandName} domain={card.domain} size="sm" />
            <div className="min-w-0">
              <h2 className="text-base sm:text-xl font-bold tracking-tight truncate leading-tight">
                {card.customName || card.brandName}
              </h2>
              <p className="text-[11px] sm:text-xs font-medium opacity-85 truncate">
                {card.brandName}
                {folders.length > 0 ? ` · ${folders.map((f) => f.name).join(' · ')}` : ''}
                {card.balance ? ` · ${card.balance}` : ''}
                {formattedExpiry ? ` · Valide jusqu'au ${formattedExpiry}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className="hidden md:flex items-center gap-1.5 text-[11px] font-semibold text-white/90 mr-1">
              {brightnessActive && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/25">
                  <Sun className="w-3 h-3" strokeWidth={1.75} />
                  100 %
                </span>
              )}
              {wakeLocked && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/25">
                  <Zap className="w-3 h-3" strokeWidth={1.75} />
                  Actif
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleToggleOrientation}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-black/25 hover:bg-black/35 text-xs font-semibold text-white transition-colors active:scale-95"
              aria-label="Basculer entre Paysage et Portrait"
            >
              <RotateCw className="w-3.5 h-3.5" strokeWidth={2} />
              <span>{isLandscape ? 'Paysage' : 'Portrait'}</span>
            </button>

            <button
              type="button"
              onClick={() => setImmersive(true)}
              className="w-10 h-10 rounded-full bg-black/25 hover:bg-black/35 text-white flex items-center justify-center transition-colors shrink-0 active:scale-95"
              aria-label="Afficher le code-barres en plein écran pur"
              title="Plein écran pur"
            >
              <Maximize2 className="w-4 h-4" strokeWidth={2} />
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="w-10 h-10 rounded-full bg-black/25 hover:bg-black/40 text-white flex items-center justify-center transition-colors shrink-0 active:scale-95"
              aria-label="Fermer la carte"
            >
              <X className="w-5 h-5" strokeWidth={2} />
            </button>
          </div>
        </header>
      )}

      {/* Bouton discret pour quitter le plein écran pur */}
      {immersive && (
        <button
          type="button"
          onClick={() => setImmersive(false)}
          className="absolute top-3 right-3 z-20 px-3 py-2 rounded-full bg-slate-900/10 hover:bg-slate-900/20 text-slate-800 text-xs font-bold inline-flex items-center gap-1.5"
        >
          <Minimize2 className="w-3.5 h-3.5" strokeWidth={2} />
          Réduire
        </button>
      )}

      {/* Zone centrale pleine largeur */}
      <main
        onClick={() => {
          if (immersive) setImmersive(false);
        }}
        className={`flex-1 min-h-0 w-full flex flex-col justify-center ${
          immersive ? 'p-2 sm:p-4' : 'px-3 sm:px-6 py-1.5'
        }`}
      >
        <div
          onClick={(e) => {
            if (!immersive) {
              e.stopPropagation();
              setImmersive(true);
            }
          }}
          className="w-full flex-1 min-h-0 flex items-center justify-center cursor-pointer"
        >
          <BarcodeRenderer
            value={card.barcodeValue}
            format={card.barcodeFormat}
            size="checkout"
            fullScreen={true}
          />
        </div>

        {!immersive && card.notes && card.notes.trim().length > 0 && (
          <div className="mt-2 w-full rounded-xl bg-black/25 px-3.5 py-2 text-white flex items-center justify-between gap-3 shrink-0">
            <p className="text-xs sm:text-sm font-medium truncate">
              {showNote ? card.notes : 'Note personnelle masquée'}
            </p>
            <button
              type="button"
              onClick={() => setShowNote((v) => !v)}
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 shrink-0"
            >
              {showNote ? (
                <EyeOff className="w-3.5 h-3.5" strokeWidth={1.75} />
              ) : (
                <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
              )}
              {showNote ? 'Masquer' : 'Voir'}
            </button>
          </div>
        )}
      </main>

      {/* Actions rapides en bas */}
      {!immersive && (
        <footer className="px-3 sm:px-6 pb-2 pt-1 w-full shrink-0">
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={handleCopyNumber}
              className="flex flex-col sm:flex-row items-center justify-center gap-1 py-2.5 px-1.5 rounded-xl bg-black/25 hover:bg-black/35 text-white text-[11px] sm:text-xs font-semibold transition-colors"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-300" strokeWidth={2} />
              ) : (
                <Copy className="w-4 h-4" strokeWidth={1.75} />
              )}
              <span>{copied ? 'Copié' : 'Copier'}</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleFavorite(card)}
              className="flex flex-col sm:flex-row items-center justify-center gap-1 py-2.5 px-1.5 rounded-xl bg-black/25 hover:bg-black/35 text-white text-[11px] sm:text-xs font-semibold transition-colors"
            >
              <Star
                strokeWidth={1.75}
                className={`w-4 h-4 ${card.isFavorite ? 'fill-amber-300 text-amber-300' : ''}`}
              />
              <span>Favori</span>
            </button>

            <button
              type="button"
              onClick={handleShareCard}
              className="flex flex-col sm:flex-row items-center justify-center gap-1 py-2.5 px-1.5 rounded-xl bg-black/25 hover:bg-black/35 text-white text-[11px] sm:text-xs font-semibold transition-colors"
            >
              <Share2 className="w-4 h-4" strokeWidth={1.75} />
              <span>Partager</span>
            </button>

            <button
              type="button"
              onClick={() => {
                BrightnessService.restore();
                OrientationService.restorePortrait(keepAppLandscapeRef.current);
                onEdit(card);
              }}
              className="flex flex-col sm:flex-row items-center justify-center gap-1 py-2.5 px-1.5 rounded-xl bg-black/25 hover:bg-black/35 text-white text-[11px] sm:text-xs font-semibold transition-colors"
            >
              <Pencil className="w-4 h-4" strokeWidth={1.75} />
              <span>Modifier</span>
            </button>

            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex flex-col sm:flex-row items-center justify-center gap-1 py-2.5 px-1.5 rounded-xl bg-black/25 hover:bg-rose-600/80 text-white text-[11px] sm:text-xs font-semibold transition-colors"
              >
                <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                <span>Suppr.</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  await BrightnessService.restore();
                  await OrientationService.restorePortrait(keepAppLandscapeRef.current);
                  await onDelete(card.id);
                }}
                className="flex flex-col sm:flex-row items-center justify-center gap-1 py-2.5 px-1.5 rounded-xl bg-rose-600 text-white text-[11px] sm:text-xs font-bold"
              >
                <Check className="w-4 h-4" strokeWidth={2} />
                <span>Valider</span>
              </button>
            )}
          </div>
        </footer>
      )}
    </motion.div>
  );
};
