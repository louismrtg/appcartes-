import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Check, Star } from 'lucide-react';
import { LoyaltyCard } from '../types';
import { BrandLogo } from './BrandLogo';
import { BarcodeService } from '../services/BarcodeService';

interface LoyaltyCardItemProps {
  card: LoyaltyCard;
  folderNames: string[];
  index: number;
  highContrast?: boolean;
  largeText?: boolean;
  selectionMode?: boolean;
  isSelected?: boolean;
  onOpen: (card: LoyaltyCard) => void;
  onLongPress?: (card: LoyaltyCard) => void;
  onToggleSelect?: (card: LoyaltyCard) => void;
  onToggleFavorite: (card: LoyaltyCard, e: React.MouseEvent) => void;
}

export const LoyaltyCardItem = React.forwardRef<HTMLDivElement, LoyaltyCardItemProps>(
  (
    {
      card,
      folderNames,
      index,
      highContrast = false,
      largeText = false,
      selectionMode = false,
      isSelected = false,
      onOpen,
      onLongPress,
      onToggleSelect,
      onToggleFavorite,
    },
    ref
  ) => {
    const longPressTimerRef = useRef<number | null>(null);
    const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
    const longPressTriggeredRef = useRef(false);

    const showBrandSubtitle =
      card.customName.trim().toLowerCase() !== card.brandName.trim().toLowerCase();

    const displayedFolders = folderNames.slice(0, 2);
    const extraFoldersCount = Math.max(0, folderNames.length - 2);

    const cancelLongPress = () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      pointerStartRef.current = null;
    };

    const handlePointerDown = (e: React.PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      longPressTriggeredRef.current = false;
      pointerStartRef.current = { x: e.clientX, y: e.clientY };

      if (!selectionMode && onLongPress) {
        longPressTimerRef.current = window.setTimeout(() => {
          longPressTriggeredRef.current = true;
          longPressTimerRef.current = null;
          onLongPress(card);
        }, 420);
      }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
      if (!pointerStartRef.current || longPressTimerRef.current === null) return;
      const dx = Math.abs(e.clientX - pointerStartRef.current.x);
      const dy = Math.abs(e.clientY - pointerStartRef.current.y);
      if (dx > 8 || dy > 8) {
        cancelLongPress();
      }
    };

    const handleClick = () => {
      if (longPressTriggeredRef.current) {
        longPressTriggeredRef.current = false;
        return;
      }
      if (selectionMode && onToggleSelect) {
        onToggleSelect(card);
        return;
      }
      onOpen(card);
    };

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.14 } }}
        transition={{
          duration: 0.18,
          delay: Math.min(index * 0.025, 0.12),
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onPointerLeave={cancelLongPress}
        onContextMenu={(e) => e.preventDefault()}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        style={{
          background: highContrast
            ? `linear-gradient(135deg, ${card.secondaryColor} 0%, #090D16 100%)`
            : `linear-gradient(135deg, ${card.primaryColor} 0%, ${card.secondaryColor} 100%)`,
          color: '#FFFFFF',
        }}
        className={`group relative aspect-[1.586/1] w-full rounded-2xl p-5 flex flex-col justify-between overflow-hidden cursor-pointer select-none shadow-card transition-transform duration-150 active:scale-[0.98] ${
          isSelected
            ? 'ring-4 ring-blue-500 ring-offset-2 dark:ring-offset-[#0D0E12] scale-[0.98]'
            : selectionMode
              ? 'opacity-85 border-2 border-white/40'
              : highContrast
                ? 'border-2 border-white/80'
                : 'border border-white/15'
        }`}
      >
        {/* Reflet tactile discret */}
        {!highContrast && (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -right-20 w-56 h-56 rounded-full bg-white/15 blur-2xl"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-20"
              style={{
                backgroundImage:
                  'linear-gradient(125deg, rgba(255,255,255,0.32) 0%, transparent 42%)',
              }}
            />
          </>
        )}

        {/* Ligne supérieure : Logo officiel + Nom + Favori / Checkbox sélection */}
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo
              brandName={card.brandName}
              domain={card.domain}
              cacheLocally={true}
              size={largeText ? 'lg' : 'md'}
            />
            <div className="min-w-0">
              <h3
                className={`font-bold tracking-tight leading-snug truncate ${
                  largeText ? 'text-xl' : 'text-lg'
                }`}
              >
                {card.customName || card.brandName}
              </h3>
              {showBrandSubtitle && (
                <p className="text-xs font-semibold opacity-85 truncate">{card.brandName}</p>
              )}
            </div>
          </div>

          {selectionMode ? (
            <span
              className={`w-8 h-8 -mr-0.5 -mt-0.5 rounded-full flex items-center justify-center border-2 transition-colors shrink-0 ${
                isSelected
                  ? 'bg-blue-500 border-white text-white shadow-md'
                  : 'bg-black/30 border-white/75 text-transparent'
              }`}
              aria-hidden="true"
            >
              <Check className="w-4 h-4" strokeWidth={3} />
            </span>
          ) : (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => onToggleFavorite(card, e)}
              aria-label={card.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              className={`w-10 h-10 -mr-1.5 -mt-1.5 rounded-full flex items-center justify-center transition-colors shrink-0 active:scale-90 ${
                highContrast
                  ? 'bg-black/60 border border-white/60'
                  : 'bg-black/20 hover:bg-black/30'
              }`}
            >
              <Star
                strokeWidth={1.75}
                className={`w-4 h-4 transition-transform ${
                  card.isFavorite ? 'fill-amber-300 text-amber-300 scale-110' : 'text-white/90'
                }`}
              />
            </button>
          )}
        </div>

        {/* Ligne inférieure : Numéro discret + Catégories */}
        <div
          className={`relative z-10 flex items-end justify-between gap-2 pt-2.5 border-t ${
            highContrast ? 'border-white/40' : 'border-white/15'
          }`}
        >
          <p
            className={`font-mono font-semibold tracking-widest truncate ${
              largeText ? 'text-sm sm:text-base' : 'text-xs sm:text-sm opacity-95'
            }`}
          >
            {BarcodeService.formatDisplayNumber(card.barcodeValue, card.barcodeFormat)}
          </p>

          {displayedFolders.length > 0 && (
            <div className="flex items-center gap-1 shrink-0 max-w-[55%]">
              {displayedFolders.map((name) => (
                <span
                  key={name}
                  className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full truncate max-w-[110px] ${
                    highContrast
                      ? 'bg-black/70 border border-white/60 text-white'
                      : 'bg-black/25'
                  }`}
                >
                  {name}
                </span>
              ))}
              {extraFoldersCount > 0 && (
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    highContrast
                      ? 'bg-black/70 border border-white/60 text-white'
                      : 'bg-black/25'
                  }`}
                >
                  +{extraFoldersCount}
                </span>
              )}
            </div>
          )}
        </div>
      </motion.div>
    );
  }
);
LoyaltyCardItem.displayName = 'LoyaltyCardItem';
