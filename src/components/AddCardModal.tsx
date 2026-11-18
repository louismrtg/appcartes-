import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Camera,
  Check,
  Globe,
  Image as ImageIcon,
  Keyboard,
  Loader2,
  Plus,
  Search,
  Smartphone,
  Star,
  X,
} from 'lucide-react';
import { FRENCH_BRANDS, findBrandById } from '../data/frenchBrands';
import {
  BarcodeFormat,
  CardFolder,
  FrenchBrand,
  LoyaltyCard,
  getCardFolderIds,
} from '../types';
import { BARCODE_FORMAT_LABELS, BarcodeService } from '../services/BarcodeService';
import { LogoCacheService, OnlineBrandSuggestion } from '../services/LogoCacheService';
import { BrandLogo } from './BrandLogo';
import { BarcodeRenderer } from './BarcodeRenderer';
import { CameraScannerModal } from './CameraScannerModal';
import { FolderIcon } from './FolderIcon';

interface AddCardModalProps {
  folders: CardFolder[];
  editingCard?: LoyaltyCard | null;
  defaultFolderId?: string;
  onSave: (card: LoyaltyCard) => Promise<void>;
  onCreateFolder: (folder: CardFolder) => Promise<void>;
  onClose: () => void;
}

const NEW_CATEGORY_COLORS = [
  '#2563EB',
  '#16A34A',
  '#0284C7',
  '#EA580C',
  '#DC2626',
  '#6D28D9',
  '#DB2777',
  '#0F766E',
];

const CUSTOM_PALETTES = [
  { primary: '#1E293B', secondary: '#0F172A' },
  { primary: '#0055A4', secondary: '#00356B' },
  { primary: '#15803D', secondary: '#064E3B' },
  { primary: '#B91C1C', secondary: '#7F1D1D' },
  { primary: '#6D28D9', secondary: '#3B0764' },
  { primary: '#C2410C', secondary: '#7C2D12' },
];

export const AddCardModal: React.FC<AddCardModalProps> = ({
  folders,
  editingCard,
  defaultFolderId,
  onSave,
  onCreateFolder,
  onClose,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(editingCard ? 3 : 1);
  const [brandQuery, setBrandQuery] = useState('');
  const [onlineResults, setOnlineResults] = useState<OnlineBrandSuggestion[]>([]);
  const [searchingOnline, setSearchingOnline] = useState(false);

  const [brandId, setBrandId] = useState(editingCard?.brandId || 'custom');
  const [brandName, setBrandName] = useState(editingCard?.brandName || '');
  const [domain, setDomain] = useState(editingCard?.domain || '');
  const [customName, setCustomName] = useState(editingCard?.customName || '');
  const [barcodeValue, setBarcodeValue] = useState(editingCard?.barcodeValue || '');
  const [barcodeFormat, setBarcodeFormat] = useState<BarcodeFormat>(
    editingCard?.barcodeFormat || 'EAN_13'
  );
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>(() => {
    if (editingCard) {
      const existing = getCardFolderIds(editingCard);
      return existing.length > 0 ? existing : folders[0]?.id ? [folders[0].id] : [];
    }
    if (defaultFolderId) return [defaultFolderId];
    return folders[0]?.id ? [folders[0].id] : [];
  });
  const [showNewCategoryBox, setShowNewCategoryBox] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(NEW_CATEGORY_COLORS[0]);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [notes, setNotes] = useState(editingCard?.notes || '');
  const [balance, setBalance] = useState(editingCard?.balance || '');
  const [expiryDate, setExpiryDate] = useState(editingCard?.expiryDate || '');
  const [isFavorite, setIsFavorite] = useState(editingCard?.isFavorite || false);
  const [isPinnedWidget, setIsPinnedWidget] = useState(editingCard?.isPinnedWidget || false);
  const [primaryColor, setPrimaryColor] = useState(editingCard?.primaryColor || '#1E293B');
  const [secondaryColor, setSecondaryColor] = useState(
    editingCard?.secondaryColor || '#0F172A'
  );
  const [textColor] = useState(editingCard?.textColor || '#FFFFFF');

  const [scannerOpen, setScannerOpen] = useState(false);
  const [showManualBox, setShowManualBox] = useState(Boolean(editingCard));
  const [imageDecoding, setImageDecoding] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const manualInputRef = useRef<HTMLInputElement | null>(null);

  const filteredLocalBrands = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    if (!q) return FRENCH_BRANDS;
    return FRENCH_BRANDS.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q) ||
        b.keywords.some((kw) => kw.includes(q))
    );
  }, [brandQuery]);

  // Recherche dynamique en ligne via Clearbit Autocomplete si peu ou pas de correspondance locale
  useEffect(() => {
    const q = brandQuery.trim();
    if (q.length < 2) {
      setOnlineResults([]);
      setSearchingOnline(false);
      return;
    }

    let cancelled = false;
    setSearchingOnline(true);

    const timer = setTimeout(async () => {
      const suggestions = await LogoCacheService.searchBrandsOnline(q);
      if (cancelled) return;

      const existingDomains = new Set(
        filteredLocalBrands.map((b) => b.domain.toLowerCase())
      );
      setOnlineResults(
        suggestions.filter((s) => !existingDomains.has(s.domain.toLowerCase()))
      );
      setSearchingOnline(false);
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [brandQuery, filteredLocalBrands]);

  const handleSelectLocalBrand = (brand: FrenchBrand) => {
    setBrandId(brand.id);
    setBrandName(brand.name);
    setDomain(brand.domain);
    setCustomName(brand.name);
    setBarcodeFormat(brand.defaultFormat);
    setPrimaryColor(brand.primaryColor);
    setSecondaryColor(brand.secondaryColor);
    LogoCacheService.cacheLogo(brand.domain);

    const matchingFolder = folders.find((f) => f.id === brand.defaultFolderId);
    if (!defaultFolderId && matchingFolder) {
      setSelectedFolderIds([matchingFolder.id]);
    }
    setCaptureError(null);
    setStep(2);
  };

  const toggleFolderSelection = (id: string) => {
    setSelectedFolderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCreateInlineCategory = async () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed || creatingCategory) return;

    setCreatingCategory(true);
    try {
      const folder: CardFolder = {
        id: `folder-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: trimmed,
        color: newCategoryColor,
        icon: 'folder',
        isPrivate: false,
        order: folders.length + 1,
        createdAt: Date.now(),
      };
      await onCreateFolder(folder);
      setSelectedFolderIds((prev) => [...prev, folder.id]);
      setNewCategoryName('');
      setShowNewCategoryBox(false);
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleSelectOnlineBrand = (suggestion: OnlineBrandSuggestion) => {
    setBrandId(`online-${suggestion.domain}`);
    setBrandName(suggestion.name);
    setDomain(suggestion.domain);
    setCustomName(suggestion.name);
    setBarcodeFormat('EAN_13');
    setPrimaryColor('#1E293B');
    setSecondaryColor('#0F172A');
    LogoCacheService.cacheLogo(suggestion.domain, suggestion.logoUrl);
    setCaptureError(null);
    setStep(2);
  };

  const handleCreateCustomBrand = () => {
    const label = brandQuery.trim() || 'Autre enseigne';
    setBrandId('custom');
    setBrandName(label);
    setDomain('');
    setCustomName(label);
    setBarcodeFormat('CODE_128');
    setPrimaryColor('#1E293B');
    setSecondaryColor('#0F172A');
    setCaptureError(null);
    setStep(2);
  };

  const handleGalleryFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setImageDecoding(true);
    setCaptureError(null);
    try {
      const result = await BarcodeService.scanFromImageFile(file);
      setBarcodeValue(result.value);
      setBarcodeFormat(result.format);
      setStep(3);
    } catch (err) {
      setCaptureError(
        err instanceof Error
          ? err.message
          : 'Aucun code-barres détecté sur cette image, vous pouvez saisir le numéro manuellement.'
      );
      setShowManualBox(true);
      setTimeout(() => manualInputRef.current?.focus(), 120);
    } finally {
      setImageDecoding(false);
    }
  };

  const handleManualNext = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = barcodeValue.trim();
    if (!cleaned) return;
    setBarcodeValue(cleaned);
    setBarcodeFormat(BarcodeService.detectFormat(cleaned));
    setStep(3);
  };

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = barcodeValue.trim();
    if (!cleanCode) return;

    setSaving(true);
    try {
      const now = Date.now();
      const resolvedBrandName = brandName.trim() || 'Carte de fidélité';
      const knownBrand = findBrandById(brandId);
      const resolvedDomain = domain || knownBrand?.domain || '';

      if (resolvedDomain) {
        await LogoCacheService.cacheLogo(resolvedDomain).catch(() => {});
      }

      const normalizedFolderIds =
        selectedFolderIds.length > 0
          ? selectedFolderIds
          : folders[0]?.id
            ? [folders[0].id]
            : ['folder-supermarches'];

      const card: LoyaltyCard = {
        id: editingCard?.id || `card-${now}-${Math.random().toString(36).slice(2, 7)}`,
        brandId,
        brandName: resolvedBrandName,
        domain: resolvedDomain,
        customName: customName.trim() || resolvedBrandName,
        barcodeValue: cleanCode,
        barcodeFormat,
        folderId: normalizedFolderIds[0],
        folderIds: normalizedFolderIds,
        primaryColor,
        secondaryColor,
        textColor,
        notes: notes.trim() || undefined,
        balance: balance.trim() || undefined,
        expiryDate: expiryDate.trim() || undefined,
        isFavorite,
        isPinnedWidget,
        widgetOrder: editingCard?.widgetOrder ?? (isPinnedWidget ? 10 : 99),
        isMainWidgetCard: editingCard?.isMainWidgetCard,
        usageCount: editingCard?.usageCount ?? 0,
        lastUsedAt: editingCard?.lastUsedAt,
        createdAt: editingCard?.createdAt ?? now,
        updatedAt: now,
      };

      await onSave(card);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const stepTitles = {
    1: 'Choisir une enseigne',
    2: 'Capturer le numéro',
    3: editingCard ? 'Modifier la carte' : 'Validation rapide',
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
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        className="w-full sm:max-w-xl h-[92dvh] sm:h-auto sm:max-h-[90dvh] bg-[#F7F8FA] dark:bg-[#0D0E12] rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden safe-bottom"
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3.5 bg-white dark:bg-[#16181F] border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {step > 1 && !editingCard && (
              <button
                type="button"
                onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
                className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 shrink-0"
                aria-label="Retour"
              >
                <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
              </button>
            )}
            <div className="min-w-0">
              {!editingCard && (
                <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Étape {step} sur 3
                </p>
              )}
              <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                {stepTitles[step]}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* ÉTAPE 1 : Catalogue 126 enseignes + recherche en ligne */}
        {step === 1 && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-4 bg-white dark:bg-[#16181F] border-b border-slate-200/70 dark:border-slate-800/80">
              <div className="relative">
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
                  strokeWidth={1.75}
                />
                <input
                  type="search"
                  autoFocus
                  value={brandQuery}
                  onChange={(e) => setBrandQuery(e.target.value)}
                  placeholder="Rechercher parmi 120+ enseignes ou en ligne..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#F7F8FA] dark:bg-[#0D0E12] border border-slate-200 dark:border-slate-800 text-sm font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {filteredLocalBrands.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {filteredLocalBrands.map((brand) => (
                    <button
                      key={brand.id}
                      type="button"
                      onClick={() => handleSelectLocalBrand(brand)}
                      className="p-3 rounded-2xl bg-white dark:bg-[#16181F] border border-slate-200/80 dark:border-slate-800/80 hover:border-blue-500 flex items-center gap-3 text-left transition-all active:scale-[0.98]"
                    >
                      <BrandLogo brandName={brand.name} domain={brand.domain} size="sm" />
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                          {brand.name}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {brand.category}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Résultats dynamiques en ligne */}
              {(searchingOnline || onlineResults.length > 0) && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {searchingOnline ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} />
                    ) : (
                      <Globe className="w-3.5 h-3.5" strokeWidth={1.75} />
                    )}
                    <span>Résultats en ligne</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {onlineResults.map((item) => (
                      <button
                        key={item.domain}
                        type="button"
                        onClick={() => handleSelectOnlineBrand(item)}
                        className="p-3 rounded-2xl bg-white dark:bg-[#16181F] border border-slate-200/80 dark:border-slate-800/80 hover:border-blue-500 flex items-center gap-3 text-left transition-all"
                      >
                        <BrandLogo
                          brandName={item.name}
                          domain={item.domain}
                          preferredUrl={item.logoUrl}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                            {item.name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {item.domain}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Option autre enseigne */}
              <button
                type="button"
                onClick={handleCreateCustomBrand}
                className="w-full p-4 rounded-2xl bg-white dark:bg-[#16181F] border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 flex items-center justify-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors"
              >
                <Plus className="w-4 h-4" strokeWidth={1.75} />
                {brandQuery.trim()
                  ? `Ajouter "${brandQuery.trim()}" manuellement`
                  : 'Autre enseigne personnalisée'}
              </button>
            </div>
          </div>
        )}

        {/* ÉTAPE 2 : Capturer le numéro (3 méthodes fiables) */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#16181F] border border-slate-200/80 dark:border-slate-800/80 flex items-center gap-3">
              <BrandLogo brandName={brandName} domain={domain} size="md" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Enseigne sélectionnée
                </p>
                <p className="text-base font-bold text-slate-900 dark:text-white truncate">
                  {brandName}
                </p>
              </div>
            </div>

            {captureError && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200 text-sm font-medium">
                {captureError}
              </div>
            )}

            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setCaptureError(null);
                  setScannerOpen(true);
                }}
                className="w-full p-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold text-left flex items-center gap-4 shadow-sm active:scale-[0.99] transition-transform"
              >
                <div className="w-11 h-11 rounded-xl bg-white/15 dark:bg-slate-900/10 flex items-center justify-center shrink-0">
                  <Camera className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="font-bold text-base">Scanner avec l’appareil photo</p>
                  <p className="text-xs opacity-75">
                    Lecture instantanée du code-barres physique
                  </p>
                </div>
              </button>

              <button
                type="button"
                disabled={imageDecoding}
                onClick={() => {
                  setCaptureError(null);
                  galleryInputRef.current?.click();
                }}
                className="w-full p-4 rounded-2xl bg-white dark:bg-[#16181F] border border-slate-200/80 dark:border-slate-800/80 text-slate-900 dark:text-white font-semibold text-left flex items-center gap-4 active:scale-[0.99] transition-transform disabled:opacity-60"
              >
                <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  {imageDecoding ? (
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" strokeWidth={1.75} />
                  ) : (
                    <ImageIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" strokeWidth={1.75} />
                  )}
                </div>
                <div>
                  <p className="font-bold text-base">
                    {imageDecoding
                      ? 'Analyse de l’image en cours...'
                      : 'Importer depuis la galerie / une image'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Photo ou capture d’écran contenant un code-barres
                  </p>
                </div>
              </button>

              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                onChange={handleGalleryFileChange}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => {
                  setShowManualBox(true);
                  setTimeout(() => manualInputRef.current?.focus(), 80);
                }}
                className="w-full p-4 rounded-2xl bg-white dark:bg-[#16181F] border border-slate-200/80 dark:border-slate-800/80 text-slate-900 dark:text-white font-semibold text-left flex items-center gap-4 active:scale-[0.99] transition-transform"
              >
                <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  <Keyboard className="w-5 h-5 text-slate-700 dark:text-slate-300" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="font-bold text-base">Saisir manuellement</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Taper le numéro inscrit sous le code-barres
                  </p>
                </div>
              </button>
            </div>

            {showManualBox && (
              <form
                onSubmit={handleManualNext}
                className="p-4 rounded-2xl bg-white dark:bg-[#16181F] border border-slate-200/80 dark:border-slate-800/80 space-y-3"
              >
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Numéro de la carte
                </label>
                <input
                  ref={manualInputRef}
                  type="text"
                  required
                  value={barcodeValue}
                  onChange={(e) => {
                    setBarcodeValue(e.target.value);
                    if (e.target.value.trim().length >= 6) {
                      setBarcodeFormat(BarcodeService.detectFormat(e.target.value));
                    }
                  }}
                  placeholder="Ex: 3560070472857"
                  className="w-full px-4 py-3.5 rounded-xl bg-[#F7F8FA] dark:bg-[#0D0E12] border border-slate-200 dark:border-slate-800 font-mono text-base font-bold tracking-wider text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {barcodeValue.trim().length > 0 && (
                  <BarcodeRenderer value={barcodeValue} format={barcodeFormat} size="preview" />
                )}
                <button
                  type="submit"
                  disabled={!barcodeValue.trim()}
                  className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-bold text-sm transition-colors"
                >
                  Continuer
                </button>
              </form>
            )}
          </div>
        )}

        {/* ÉTAPE 3 : Validation rapide */}
        {step === 3 && (
          <form onSubmit={handleSaveCard} className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Aperçu carte */}
            <div
              className="rounded-2xl p-4 flex items-center justify-between gap-3 text-white shadow-card"
              style={{
                background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <BrandLogo brandName={brandName || 'Carte'} domain={domain} size="md" />
                <div className="min-w-0">
                  <p className="text-base font-bold truncate">
                    {customName || brandName || 'Ma carte'}
                  </p>
                  <p className="text-xs opacity-80 truncate">
                    {BarcodeService.formatDisplayNumber(barcodeValue, barcodeFormat)}
                  </p>
                </div>
              </div>

              {brandId === 'custom' && (
                <div className="flex gap-1.5 shrink-0">
                  {CUSTOM_PALETTES.slice(0, 4).map((p) => (
                    <button
                      key={p.primary}
                      type="button"
                      onClick={() => {
                        setPrimaryColor(p.primary);
                        setSecondaryColor(p.secondary);
                      }}
                      className="w-6 h-6 rounded-full border-2 border-white/70"
                      style={{ backgroundColor: p.primary }}
                      aria-label="Couleur de carte"
                    />
                  ))}
                </div>
              )}
            </div>

            {editingCard && (
              <div className="p-4 rounded-2xl bg-white dark:bg-[#16181F] border border-slate-200/80 dark:border-slate-800/80 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Numéro &amp; Format
                  </label>
                  <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400"
                  >
                    <Camera className="w-3.5 h-3.5" strokeWidth={1.75} />
                    Rescanner
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={barcodeValue}
                  onChange={(e) => setBarcodeValue(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F8FA] dark:bg-[#0D0E12] border border-slate-200 dark:border-slate-800 font-mono text-sm font-bold"
                />
                <select
                  value={barcodeFormat}
                  onChange={(e) => setBarcodeFormat(e.target.value as BarcodeFormat)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F8FA] dark:bg-[#0D0E12] border border-slate-200 dark:border-slate-800 text-sm font-medium"
                >
                  {(Object.keys(BARCODE_FORMAT_LABELS) as BarcodeFormat[]).map((fmt) => (
                    <option key={fmt} value={fmt}>
                      {BARCODE_FORMAT_LABELS[fmt]}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-white dark:bg-[#16181F] border border-slate-200/80 dark:border-slate-800/80 space-y-3">
              {brandId === 'custom' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Nom de l’enseigne
                  </label>
                  <input
                    type="text"
                    required
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F8FA] dark:bg-[#0D0E12] border border-slate-200 dark:border-slate-800 text-sm font-semibold"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Nom de la carte
                </label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder={brandName || 'Ex: Leclerc'}
                  className="w-full px-3.5 py-3 rounded-xl bg-[#F7F8FA] dark:bg-[#0D0E12] border border-slate-200 dark:border-slate-800 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Catégories (un ou plusieurs choix)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNewCategoryBox((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                    Nouvelle catégorie
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {folders.map((folder) => {
                    const selected = selectedFolderIds.includes(folder.id);
                    return (
                      <button
                        key={folder.id}
                        type="button"
                        onClick={() => toggleFolderSelection(folder.id)}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                          selected
                            ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-sm'
                            : 'bg-[#F7F8FA] dark:bg-[#0D0E12] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <span
                          className="w-5 h-5 rounded-md flex items-center justify-center text-white shrink-0"
                          style={{ backgroundColor: folder.color }}
                        >
                          <FolderIcon icon={folder.icon} className="w-3 h-3" />
                        </span>
                        <span>{folder.name}</span>
                        {selected && <Check className="w-3.5 h-3.5" strokeWidth={2.25} />}
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence>
                  {showNewCategoryBox && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 p-3 rounded-xl bg-[#F7F8FA] dark:bg-[#0D0E12] border border-slate-200 dark:border-slate-800 space-y-2.5">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCreateInlineCategory();
                              }
                            }}
                            placeholder="Nom de la nouvelle catégorie..."
                            className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <button
                            type="button"
                            disabled={!newCategoryName.trim() || creatingCategory}
                            onClick={handleCreateInlineCategory}
                            className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold shrink-0"
                          >
                            {creatingCategory ? 'Ajout...' : 'Créer'}
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {NEW_CATEGORY_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setNewCategoryColor(color)}
                              className="w-6 h-6 rounded-full flex items-center justify-center transition-transform active:scale-90"
                              style={{ backgroundColor: color }}
                              aria-label={`Couleur ${color}`}
                            >
                              {newCategoryColor === color && (
                                <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Note personnelle (optionnel)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex: Code PIN ou information utile"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#F7F8FA] dark:bg-[#0D0E12] border border-slate-200 dark:border-slate-800 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Solde / Avoir (optionnel)
                  </label>
                  <input
                    type="text"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    placeholder="Ex: 45,00 €"
                    className="w-full px-3 py-2.5 rounded-xl bg-[#F7F8FA] dark:bg-[#0D0E12] border border-slate-200 dark:border-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Expiration (optionnel)
                  </label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#F7F8FA] dark:bg-[#0D0E12] border border-slate-200 dark:border-slate-800 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsFavorite((v) => !v)}
                className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-semibold transition-colors ${
                  isFavorite
                    ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300'
                    : 'bg-white dark:bg-[#16181F] border-slate-200/80 dark:border-slate-800/80 text-slate-600 dark:text-slate-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Star
                    strokeWidth={1.75}
                    className={`w-4 h-4 ${isFavorite ? 'fill-amber-400 text-amber-400' : ''}`}
                  />
                  Favori
                </span>
                {isFavorite && <Check className="w-4 h-4" strokeWidth={1.75} />}
              </button>

              <button
                type="button"
                onClick={() => setIsPinnedWidget((v) => !v)}
                className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-semibold transition-colors ${
                  isPinnedWidget
                    ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                    : 'bg-white dark:bg-[#16181F] border-slate-200/80 dark:border-slate-800/80 text-slate-600 dark:text-slate-300'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4" strokeWidth={1.75} />
                  Widget accueil
                </span>
                {isPinnedWidget && <Check className="w-4 h-4" strokeWidth={1.75} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={saving || !barcodeValue.trim()}
              className="w-full py-4 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold text-base shadow-sm disabled:opacity-50 transition-opacity"
            >
              {saving
                ? 'Enregistrement...'
                : editingCard
                  ? 'Enregistrer les modifications'
                  : 'Enregistrer la carte'}
            </button>
          </form>
        )}
      </motion.div>

      <AnimatePresence>
        {scannerOpen && (
          <CameraScannerModal
            onClose={() => setScannerOpen(false)}
            onResult={(result) => {
              setBarcodeValue(result.value);
              setBarcodeFormat(result.format);
              setScannerOpen(false);
              setStep(3);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
