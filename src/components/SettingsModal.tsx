import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  CheckCircle2,
  Contrast,
  Download,
  Fingerprint,
  KeyRound,
  Lock,
  Moon,
  RotateCw,
  Shield,
  Smartphone,
  Star,
  Sun,
  Type,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import {
  AppSettings,
  LockScope,
  LoyaltyCard,
  ThemePreference,
} from '../types';
import { BiometricService } from '../services/BiometricService';
import { StorageService } from '../services/StorageService';
import { SecurityLockModal } from './SecurityLockModal';
import { BrandLogo } from './BrandLogo';

interface SettingsModalProps {
  settings: AppSettings;
  cards: LoyaltyCard[];
  onUpdateSettings: (next: AppSettings) => Promise<void>;
  onToggleWidgetPin: (card: LoyaltyCard) => Promise<void>;
  onSetMainWidgetCard: (cardId: string) => Promise<void>;
  onDataImported: () => Promise<void>;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  cards,
  onUpdateSettings,
  onToggleWidgetPin,
  onSetMainWidgetCard,
  onDataImported,
  onClose,
}) => {
  const [biometryInfo, setBiometryInfo] = useState('Vérification...');
  const [biometryAvailable, setBiometryAvailable] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    BiometricService.checkAvailability().then((info) => {
      setBiometryAvailable(info.available);
      setBiometryInfo(info.label);
    });
  }, []);

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3200);
  };

  const toggleSetting = async (key: keyof AppSettings, value: boolean) => {
    if (key === 'lockOnStartup' && value && !settings.pinHash && !biometryAvailable) {
      setShowPinSetup(true);
      return;
    }
    await onUpdateSettings({ ...settings, [key]: value });
  };

  const handleExport = async () => {
    try {
      const res = await StorageService.exportBackup();
      showToast(
        res.shared
          ? 'Sauvegarde prête à être partagée.'
          : `Sauvegarde téléchargée (${res.fileName}).`
      );
    } catch {
      showToast('Erreur lors de l’export de la sauvegarde.');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const result = await StorageService.importBackup(text);
      await onDataImported();
      showToast(`${result.cardsCount} carte(s) et ${result.foldersCount} dossier(s) importés.`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Fichier invalide.');
    } finally {
      e.target.value = '';
    }
  };

  const mainWidgetCardId =
    cards.find((c) => c.isMainWidgetCard)?.id ||
    cards.find((c) => c.isPinnedWidget)?.id ||
    cards.find((c) => c.isFavorite)?.id ||
    cards[0]?.id;

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
        <div className="px-5 pt-5 pb-3.5 bg-white dark:bg-[#16181F] border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Paramètres</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Apparence, sécurité, widgets et sauvegarde
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

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {feedback && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.75} />
              {feedback}
            </div>
          )}

          {/* Thème Clair / Sombre / Système */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 hc-muted px-1">
              Apparence &amp; Confort visuel
            </h3>
            <div className="p-4 rounded-2xl bg-white dark:bg-[#16181F] hc-surface border border-slate-200/80 dark:border-slate-800/80 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <Moon className="w-4 h-4 text-slate-500 hc-muted" strokeWidth={1.75} />
                Thème de l’application
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'light', label: 'Clair' },
                    { id: 'dark', label: 'Sombre' },
                    { id: 'auto', label: 'Système' },
                  ] as { id: ThemePreference; label: string }[]
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, theme: item.id })}
                    className={`py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                      settings.theme === item.id
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                        : 'bg-[#F7F8FA] dark:bg-[#0D0E12] text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-[#16181F] hc-surface border border-slate-200/80 dark:border-slate-800/80 divide-y divide-slate-200/70 dark:divide-slate-800/70">
              <label className="flex items-center justify-between p-4 cursor-pointer">
                <span className="flex items-center gap-3 pr-3">
                  <Type className="w-4 h-4 text-slate-500 hc-muted shrink-0" strokeWidth={1.75} />
                  <span>
                    <span className="block font-semibold text-sm text-slate-900 dark:text-white">
                      Texte agrandi (confort visuel)
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 hc-muted">
                      Grossit les textes, boutons et numéros de cartes
                    </span>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.largeText}
                  onChange={(e) => toggleSetting('largeText', e.target.checked)}
                  className="w-5 h-5 accent-blue-600 shrink-0"
                />
              </label>

              <label className="flex items-center justify-between p-4 cursor-pointer">
                <span className="flex items-center gap-3 pr-3">
                  <Contrast className="w-4 h-4 text-slate-500 hc-muted shrink-0" strokeWidth={1.75} />
                  <span>
                    <span className="block font-semibold text-sm text-slate-900 dark:text-white">
                      Contraste élevé
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 hc-muted">
                      Renforce les bordures et la lisibilité à l’écran
                    </span>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.highContrast}
                  onChange={(e) => toggleSetting('highContrast', e.target.checked)}
                  className="w-5 h-5 accent-blue-600 shrink-0"
                />
              </label>
            </div>
          </section>

          {/* Mode Caisse */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
              Mode Caisse
            </h3>
            <div className="rounded-2xl bg-white dark:bg-[#16181F] border border-slate-200/80 dark:border-slate-800/80 divide-y divide-slate-200/70 dark:divide-slate-800/70">
              <label className="flex items-center justify-between p-4 cursor-pointer">
                <span className="flex items-center gap-3 pr-3">
                  <Sun className="w-4 h-4 text-slate-500 shrink-0" strokeWidth={1.75} />
                  <span>
                    <span className="block font-semibold text-sm text-slate-900 dark:text-white">
                      Luminosité à 100 % automatique
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      Restaure le niveau d’origine à la fermeture
                    </span>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.autoMaxBrightness}
                  onChange={(e) => toggleSetting('autoMaxBrightness', e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
              </label>

              <label className="flex items-center justify-between p-4 cursor-pointer">
                <span className="flex items-center gap-3 pr-3">
                  <RotateCw className="w-4 h-4 text-slate-500 shrink-0" strokeWidth={1.75} />
                  <span>
                    <span className="block font-semibold text-sm text-slate-900 dark:text-white">
                      Basculer en Paysage à l’ouverture
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      Élargit le code-barres pour la douchette laser
                    </span>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.autoLandscape}
                  onChange={(e) => toggleSetting('autoLandscape', e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
              </label>

              <label className="flex items-center justify-between p-4 cursor-pointer">
                <span className="flex items-center gap-3 pr-3">
                  <Zap className="w-4 h-4 text-slate-500 shrink-0" strokeWidth={1.75} />
                  <span>
                    <span className="block font-semibold text-sm text-slate-900 dark:text-white">
                      Empêcher la mise en veille
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      Garde l’écran allumé pendant le passage en caisse
                    </span>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.keepAwake}
                  onChange={(e) => toggleSetting('keepAwake', e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
              </label>
            </div>
          </section>

          {/* Sécurité Biométrique & PIN */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
              Sécurité &amp; Biométrie
            </h3>

            <div className="rounded-2xl bg-white dark:bg-[#16181F] border border-slate-200/80 dark:border-slate-800/80 divide-y divide-slate-200/70 dark:divide-slate-800/70">
              <label className="flex items-center justify-between p-4 cursor-pointer">
                <span className="flex items-center gap-3 pr-3">
                  <Lock className="w-4 h-4 text-slate-500 shrink-0" strokeWidth={1.75} />
                  <span>
                    <span className="block font-semibold text-sm text-slate-900 dark:text-white">
                      Verrouillage activé
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      À l’ouverture et après 30 s en arrière-plan
                    </span>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.lockOnStartup}
                  onChange={(e) => toggleSetting('lockOnStartup', e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
              </label>

              <label className="flex items-center justify-between p-4 cursor-pointer">
                <span className="flex items-center gap-3 pr-3">
                  <Fingerprint className="w-4 h-4 text-slate-500 shrink-0" strokeWidth={1.75} />
                  <span>
                    <span className="block font-semibold text-sm text-slate-900 dark:text-white">
                      Biométrie Android ({biometryInfo})
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      Empreinte, visage ou code du téléphone
                    </span>
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={settings.biometricEnabled}
                  onChange={(e) => toggleSetting('biometricEnabled', e.target.checked)}
                  className="w-4 h-4 accent-blue-600"
                />
              </label>

              <div className="p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                  <Shield className="w-4 h-4 text-slate-500" strokeWidth={1.75} />
                  Portée du verrouillage
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'app', label: 'Toute l’application' },
                      { id: 'private_folders', label: 'Dossiers privés uniquement' },
                    ] as { id: LockScope; label: string }[]
                  ).map((scope) => (
                    <button
                      key={scope.id}
                      type="button"
                      onClick={() => onUpdateSettings({ ...settings, lockScope: scope.id })}
                      className={`py-2.5 px-2 rounded-xl text-xs font-semibold transition-colors ${
                        settings.lockScope === scope.id
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                          : 'bg-[#F7F8FA] dark:bg-[#0D0E12] text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-800'
                      }`}
                    >
                      {scope.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowPinSetup(true)}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  <KeyRound className="w-3.5 h-3.5" strokeWidth={1.75} />
                  {settings.pinHash ? 'Modifier le code PIN' : 'Définir un code PIN (4 ou 6 chiffres)'}
                </button>
                {settings.pinHash && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateSettings({
                        ...settings,
                        pinHash: null,
                        pinSalt: null,
                      })
                    }
                    className="py-2.5 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 text-xs font-semibold"
                  >
                    Retirer PIN
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* Widgets Écran d'Accueil Android (Motorola) */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
              Widgets Écran d’Accueil
            </h3>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#16181F] border border-slate-200/80 dark:border-slate-800/80 space-y-4">
              <div className="flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" strokeWidth={1.75} />
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Appuyez longuement sur un espace vide de l’écran d’accueil Motorola, choisissez{' '}
                  <strong className="text-slate-900 dark:text-white">Widgets</strong> puis{' '}
                  <strong className="text-slate-900 dark:text-white">Mes Cartes</strong> (Accès Rapide 3 Cartes ou Carte Favorite Directe).
                </p>
              </div>

              {cards.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Ajoutez d’abord une carte dans votre portefeuille pour la configurer sur les widgets.
                </p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Choisissez jusqu’à 3 cartes pour « Accès Rapide » et l’étoile pour « Carte Favorite Directe » :
                  </p>
                  {cards.map((card) => {
                    const isMain = card.id === mainWidgetCardId;
                    return (
                      <div
                        key={card.id}
                        className="p-2.5 rounded-xl bg-[#F7F8FA] dark:bg-[#0D0E12] flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <BrandLogo brandName={card.brandName} domain={card.domain} size="sm" />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {card.customName}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate">{card.brandName}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => onSetMainWidgetCard(card.id)}
                            title="Carte principale du Widget Code-barres"
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                              isMain
                                ? 'bg-amber-500 text-white'
                                : 'bg-white dark:bg-[#16181F] text-slate-500 border border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            <Star
                              strokeWidth={1.75}
                              className={`w-3 h-3 ${isMain ? 'fill-white' : ''}`}
                            />
                            Directe
                          </button>

                          <button
                            type="button"
                            onClick={() => onToggleWidgetPin(card)}
                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                              card.isPinnedWidget
                                ? 'bg-blue-600 text-white'
                                : 'bg-white dark:bg-[#16181F] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            {card.isPinnedWidget && <Check className="w-3 h-3" strokeWidth={2} />}
                            {card.isPinnedWidget ? '3 Cartes' : 'Épingler'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Sauvegarde & Transfert */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
              Sauvegarde &amp; Transfert
            </h3>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleExport}
                className="p-4 rounded-2xl bg-white dark:bg-[#16181F] border border-slate-200/80 dark:border-slate-800/80 text-left flex items-center gap-3 hover:border-blue-500 transition-colors"
              >
                <Download className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" strokeWidth={1.75} />
                <div>
                  <p className="font-semibold text-sm text-slate-900 dark:text-white">Exporter</p>
                  <p className="text-[11px] text-slate-500">Fichier .json</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-4 rounded-2xl bg-white dark:bg-[#16181F] border border-slate-200/80 dark:border-slate-800/80 text-left flex items-center gap-3 hover:border-blue-500 transition-colors"
              >
                <Upload className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" strokeWidth={1.75} />
                <div>
                  <p className="font-semibold text-sm text-slate-900 dark:text-white">Importer</p>
                  <p className="text-[11px] text-slate-500">Restaurer</p>
                </div>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportFile}
                className="hidden"
              />
            </div>
          </section>

          <p className="text-center text-xs font-medium text-slate-400 dark:text-slate-500 hc-muted pb-2">
            Mes Cartes · © Louis Martignon (@louismrtg)
          </p>
        </div>
      </motion.div>

      <AnimatePresence>
        {showPinSetup && (
          <SecurityLockModal
            mode="setup-pin"
            settings={settings}
            onCancel={() => setShowPinSetup(false)}
            onPinConfigured={async (hash, salt, length) => {
              await onUpdateSettings({
                ...settings,
                pinHash: hash,
                pinSalt: salt,
                pinLength: length,
                lockOnStartup: true,
              });
              showToast('Code PIN enregistré.');
            }}
            onUnlock={() => setShowPinSetup(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
