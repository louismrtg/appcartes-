import React, { useEffect, useMemo, useState } from 'react';
import { LogoCacheService } from '../services/LogoCacheService';

interface BrandLogoProps {
  brandName: string;
  domain?: string;
  preferredUrl?: string;
  cacheLocally?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES = {
  sm: 'w-9 h-9 rounded-xl',
  md: 'w-11 h-11 rounded-xl',
  lg: 'w-14 h-14 rounded-2xl',
};

export const BrandLogo: React.FC<BrandLogoProps> = ({
  brandName,
  domain = '',
  preferredUrl,
  cacheLocally = false,
  size = 'md',
  className = '',
}) => {
  const cleanDomain = domain.trim().toLowerCase();
  const candidates = useMemo(
    () => LogoCacheService.getDirectLogoUrls(cleanDomain, preferredUrl),
    [cleanDomain, preferredUrl]
  );

  const [cachedDataUrl, setCachedDataUrl] = useState<string | null>(null);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setCachedDataUrl(null);
    setCandidateIndex(0);
    setAllFailed(false);

    if (!cleanDomain) {
      setAllFailed(true);
      return () => {
        active = false;
      };
    }

    LogoCacheService.getCachedLogo(cleanDomain).then((cached) => {
      if (!active) return;
      if (cached) {
        setCachedDataUrl(cached);
        return;
      }
      if (cacheLocally) {
        LogoCacheService.cacheLogo(cleanDomain, preferredUrl).then((stored) => {
          if (active && stored) {
            setCachedDataUrl(stored);
          }
        });
      }
    });

    return () => {
      active = false;
    };
  }, [cleanDomain, preferredUrl, cacheLocally]);

  const activeSrc = cachedDataUrl || (!allFailed ? candidates[candidateIndex] : null);
  const initials = useMemo(() => {
    const words = brandName.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return 'MC';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }, [brandName]);

  return (
    <div
      className={`${SIZE_CLASSES[size]} shrink-0 bg-white dark:bg-white border border-slate-200/80 shadow-sm flex items-center justify-center overflow-hidden p-1.5 ${className}`}
    >
      {activeSrc ? (
        <img
          src={activeSrc}
          alt={brandName}
          loading="lazy"
          decoding="async"
          onError={() => {
            if (cachedDataUrl) {
              setCachedDataUrl(null);
            } else if (candidateIndex + 1 < candidates.length) {
              setCandidateIndex((i) => i + 1);
            } else {
              setAllFailed(true);
            }
          }}
          className="w-full h-full object-contain select-none"
        />
      ) : (
        <span className="text-xs font-extrabold tracking-tight text-slate-700 select-none">
          {initials}
        </span>
      )}
    </div>
  );
};
