import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpCircle, Download, ExternalLink, Loader2, X } from 'lucide-react';
import { APP_VERSION } from '../types';
import { AvailableUpdate, UpdateService } from '../services/UpdateService';

interface UpdatePromptModalProps {
  update: AvailableUpdate;
  onDismiss: () => void;
}

export const UpdatePromptModal: React.FC<UpdatePromptModalProps> = ({
  update,
  onDismiss,
}) => {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleInstall = async () => {
    setDownloading(true);
    setProgress(0);
    setStatusMessage('Téléchargement de la mise à jour...');
    try {
      const mode = await UpdateService.installUpdate(update.apkUrl, (pct) => {
        setProgress(pct);
        if (pct >= 100) {
          setStatusMessage('Ouverture de l’installateur Android...');
        }
      });
      if (mode === 'browser') {
        setStatusMessage('Téléchargement ouvert dans votre navigateur.');
      }
    } finally {
      setDownloading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
    >
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0, scale: 0.97 }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
        className="w-full max-w-md rounded-3xl bg-white dark:bg-[#16181F] hc-surface border border-slate-200/80 dark:border-slate-800/80 shadow-2xl overflow-hidden safe-bottom"
      >
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0">
                <ArrowUpCircle className="w-6 h-6" strokeWidth={1.9} />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Nouvelle mise à jour disponible
                </h2>
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  v{APP_VERSION} vers v{update.version}
                </p>
              </div>
            </div>

            {!downloading && (
              <button
                type="button"
                onClick={onDismiss}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            )}
          </div>

          <p className="text-sm text-slate-600 dark:text-slate-300 hc-muted leading-relaxed">
            Une nouvelle version de Mes Cartes est prête sur GitHub. Vos cartes et catégories enregistrées seront conservées.
          </p>

          {update.notes && (
            <div className="p-3 rounded-2xl bg-[#F7F8FA] dark:bg-[#0D0E12] border border-slate-200/70 dark:border-slate-800 max-h-28 overflow-y-auto">
              <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line">
                {update.notes}
              </p>
            </div>
          )}

          {downloading && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-600 dark:text-slate-300">
                <span>{statusMessage || 'Téléchargement...'}</span>
                <span>{progress} %</span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-200 rounded-full"
                  style={{ width: `${Math.max(4, progress)}%` }}
                />
              </div>
            </div>
          )}

          {!downloading && statusMessage && (
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {statusMessage}
            </p>
          )}

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              disabled={downloading}
              onClick={onDismiss}
              className="flex-1 py-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold disabled:opacity-50"
            >
              Plus tard
            </button>
            <button
              type="button"
              disabled={downloading}
              onClick={handleInstall}
              className="flex-1 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold flex items-center justify-center gap-2 shadow-sm disabled:opacity-70"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                  <span>En cours...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" strokeWidth={2} />
                  <span>Mettre à jour</span>
                </>
              )}
            </button>
          </div>

          <a
            href={update.releaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center w-full gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <ExternalLink className="w-3 h-3" strokeWidth={1.75} />
            Voir la page de version sur GitHub
          </a>
        </div>
      </motion.div>
    </motion.div>
  );
};
