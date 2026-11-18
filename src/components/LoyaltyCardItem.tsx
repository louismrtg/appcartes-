import React from 'react';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { LoyaltyCard } from '../types';
import { BrandLogo } from './BrandLogo';
import { BarcodeService } from '../services/BarcodeService';

interface LoyaltyCardItemProps {
  card: LoyaltyCard;
  folderNames: string[];
  index: number;
  highContrast?: boolean;
  largeText?: boolean;
  onOpen: (card: LoyaltyCard) => void;
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
      onOpen,
      onToggleFavorite,
    },
    ref
  ) => {
    const showBrandSubtitle =
      card.customName.trim().toLowerCase() !== card.brandName.trim().toLowerCase();

    const displayedFolders = folderNames.slice(0, 2);
    const extraFoldersCount = Math.max(0, folderNames.length - 2);

    return (
      <motion.div
        ref={ref}
        layout
        layoutId={`wallet-card-${card.id}`}
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.16 } }}
      transition={{
        type: 'spring',
        stiffness: 340,
        damping: 26,
        delay: Math.min(index * 0.035, 0.2),
      }}
      whileHover={{ y: -3, transition: { duration: 0.18 } }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onOpen(card)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(card);
        }
      }}
      style={{
        background: highContrast
          ? `linear-gradient(135deg, ${card.secondaryColor} 0%, #090D16 100%)`
          : `linear-gradient(135deg, ${card.primaryColor} 0%, ${card.secondaryColor} 100%)`,
        color: '#FFFFFF',
      }}
      className={`group relative aspect-[1.586/1] w-full rounded-2xl p-5 flex flex-col justify-between overflow-hidden cursor-pointer select-none shadow-card ${
        highContrast ? 'border-2 border-white/80' : 'border border-white/15'
      }`}
    >
      {/* Reflet tactile et profondeur */}
      {!highContrast && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-20 w-56 h-56 rounded-full bg-white/15 blur-2xl transition-transform duration-500 group-hover:scale-115"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-16 w-48 h-48 rounded-full bg-black/20 blur-2xl"
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

      {/* Ligne supérieure : Logo officiel + Nom + Favori */}
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

        <motion.button
          whileTap={{ scale: 0.85 }}
          type="button"
          onClick={(e) => onToggleFavorite(card, e)}
          aria-label={card.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          className={`w-9 h-9 -mr-1 -mt-1 rounded-full flex items-center justify-center backdrop-blur-sm transition-colors shrink-0 ${
            highContrast ? 'bg-black/60 border border-white/60' : 'bg-black/20 hover:bg-black/30'
          }`}
        >
          <Star
            strokeWidth={1.75}
            className={`w-4 h-4 transition-transform ${
              card.isFavorite ? 'fill-amber-300 text-amber-300 scale-110' : 'text-white/90'
            }`}
          />
        </motion.button>
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
                className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full backdrop-blur-sm truncate max-w-[110px] ${
                  highContrast ? 'bg-black/70 border border-white/60 text-white' : 'bg-black/25'
                }`}
              >
                {name}
              </span>
            ))}
            {extraFoldersCount > 0 && (
              <span
                className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  highContrast ? 'bg-black/70 border border-white/60 text-white' : 'bg-black/25'
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
