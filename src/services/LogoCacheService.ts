import { db } from './StorageService';

export interface OnlineBrandSuggestion {
  name: string;
  domain: string;
  logoUrl: string;
}

const MEMORY_CACHE = new Map<string, string>();
const INFLIGHT_CACHE = new Map<string, Promise<string | null>>();

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Conversion Base64 impossible'));
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Erreur lecture Blob'));
    reader.readAsDataURL(blob);
  });
}

class LogoCacheServiceImpl {
  getDirectLogoUrls(domain: string, preferredUrl?: string | null): string[] {
    const cleanDomain = domain.trim().toLowerCase();
    const urls: string[] = [];
    if (preferredUrl) urls.push(preferredUrl);
    if (cleanDomain) {
      urls.push(`https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=256`);
      urls.push(`https://icon.horse/icon/${cleanDomain}`);
    }
    return Array.from(new Set(urls));
  }

  async getCachedLogo(domain: string): Promise<string | null> {
    const key = domain.trim().toLowerCase();
    if (!key) return null;
    if (MEMORY_CACHE.has(key)) {
      return MEMORY_CACHE.get(key) || null;
    }
    try {
      const record = await db.logoCache.get(key);
      if (record?.dataUrl) {
        MEMORY_CACHE.set(key, record.dataUrl);
        return record.dataUrl;
      }
    } catch {
      // Ignore IndexedDB transient errors
    }
    return null;
  }

  async cacheLogo(domain: string, explicitUrl?: string | null): Promise<string | null> {
    const key = domain.trim().toLowerCase();
    if (!key) return null;

    const existing = await this.getCachedLogo(key);
    if (existing) return existing;

    if (INFLIGHT_CACHE.has(key)) {
      return INFLIGHT_CACHE.get(key) || null;
    }

    const task = (async () => {
      const corsCandidates = [
        explicitUrl,
        `https://icon.horse/icon/${key}`,
      ].filter((u): u is string => Boolean(u));

      for (const url of corsCandidates) {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 4000);
          const response = await fetch(url, { signal: controller.signal, mode: 'cors' });
          clearTimeout(timer);

          if (!response.ok) continue;
          const contentType = response.headers.get('content-type') || '';
          if (!contentType.startsWith('image/')) continue;

          const blob = await response.blob();
          if (blob.size < 64) continue;

          const dataUrl = await blobToDataUrl(blob);
          MEMORY_CACHE.set(key, dataUrl);
          await db.logoCache.put({
            domain: key,
            dataUrl,
            updatedAt: Date.now(),
          });
          return dataUrl;
        } catch {
          // Essaie le candidat suivant
        }
      }
      return null;
    })();

    INFLIGHT_CACHE.set(key, task);
    try {
      return await task;
    } finally {
      INFLIGHT_CACHE.delete(key);
    }
  }

  async searchBrandsOnline(query: string): Promise<OnlineBrandSuggestion[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);
      const response = await fetch(
        `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(trimmed)}`,
        { signal: controller.signal }
      );
      clearTimeout(timer);

      if (!response.ok) return [];
      const raw = (await response.json()) as Array<{
        name?: string;
        domain?: string;
        logo?: string | null;
      }>;

      if (!Array.isArray(raw)) return [];
      return raw
        .filter((item) => item.name && item.domain)
        .slice(0, 8)
        .map((item) => ({
          name: item.name!.trim(),
          domain: item.domain!.trim().toLowerCase(),
          logoUrl:
            item.logo ||
            `https://icon.horse/icon/${item.domain!.trim().toLowerCase()}`,
        }));
    } catch {
      return [];
    }
  }
}

export const LogoCacheService = new LogoCacheServiceImpl();
