import React, { useEffect, useId, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Flashlight, ScanLine, X } from 'lucide-react';
import { BarcodeFormat } from '../types';
import { BarcodeService, ScanBarcodeResult } from '../services/BarcodeService';

interface CameraScannerModalProps {
  onResult: (result: ScanBarcodeResult) => void;
  onClose: () => void;
}

const FORMAT_NAME_MAP: Record<string, BarcodeFormat> = {
  EAN_13: 'EAN_13',
  EAN_8: 'EAN_8',
  CODE_128: 'CODE_128',
  CODE_39: 'CODE_39',
  QR_CODE: 'QR_CODE',
  DATA_MATRIX: 'DATA_MATRIX',
  ITF: 'ITF',
  UPC_A: 'UPC_A',
};

export const CameraScannerModal: React.FC<CameraScannerModalProps> = ({
  onResult,
  onClose,
}) => {
  const scannerElementId = useId().replace(/:/g, '');
  const html5QrRef = useRef<Html5Qrcode | null>(null);
  const [statusMessage, setStatusMessage] = useState('Initialisation de la caméra...');
  const [errorText, setErrorText] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [canTorch, setCanTorch] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const startScanner = async () => {
      if (Capacitor.isNativePlatform()) {
        try {
          setStatusMessage('Ouverture du scanner MLKit...');
          const nativeResult = await BarcodeService.scanNative();
          if (!cancelled && nativeResult) {
            onResult(nativeResult);
            return;
          }
          if (!cancelled) {
            onClose();
            return;
          }
        } catch (err) {
          if (!cancelled) {
            setErrorText(
              err instanceof Error
                ? err.message
                : 'Scanner natif indisponible. Ouverture de la caméra.'
            );
          }
        }
      }

      // Fallback html5-qrcode caméra arrière
      try {
        const scanner = new Html5Qrcode(scannerElementId, {
          verbose: false,
          useBarCodeDetectorIfSupported: true,
        });
        html5QrRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 12,
            qrbox: { width: 260, height: 170 },
          },
          (decodedText, decodedResult) => {
            if (cancelled) return;
            const value = decodedText.trim();
            if (!value) return;
            cancelled = true;
            const formatName = decodedResult?.result?.format?.formatName;
            const format =
              (formatName && FORMAT_NAME_MAP[formatName]) ||
              BarcodeService.detectFormat(value);

            scanner
              .stop()
              .catch(() => {})
              .finally(() => {
                onResult({ value, format, source: 'web-camera' });
              });
          },
          () => {
            // Erreur frame ignorée
          }
        );

        if (!cancelled) {
          setStatusMessage('Placez le code-barres dans le cadre');
          try {
            const caps = scanner.getRunningTrackCameraCapabilities();
            if (caps.torchFeature().isSupported()) {
              setCanTorch(true);
            }
          } catch {
            // Non supporté
          }
        }
      } catch {
        if (!cancelled) {
          setErrorText(
            'Impossible d’accéder à l’appareil photo. Vous pouvez importer une photo ou saisir le numéro.'
          );
          setStatusMessage('Caméra indisponible');
        }
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      const instance = html5QrRef.current;
      if (instance && instance.isScanning) {
        instance
          .stop()
          .then(() => instance.clear())
          .catch(() => {});
      }
    };
  }, [onResult, onClose, scannerElementId]);

  const toggleTorch = async () => {
    const instance = html5QrRef.current;
    if (!instance) return;
    try {
      const next = !torchOn;
      await instance.getRunningTrackCameraCapabilities().torchFeature().apply(next);
      setTorchOn(next);
    } catch {
      // Non supporté
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-[#0D0E12] text-white flex flex-col justify-between p-5 safe-top safe-bottom"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <Camera className="w-5 h-5 text-white" strokeWidth={1.75} />
          </div>
          <div>
            <h3 className="font-bold text-base">Scanner une carte</h3>
            <p className="text-xs text-slate-400">{statusMessage}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canTorch && (
            <button
              type="button"
              onClick={toggleTorch}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                torchOn ? 'bg-amber-400 text-slate-950' : 'bg-white/10 text-white'
              }`}
              aria-label="Lampe torche"
            >
              <Flashlight className="w-5 h-5" strokeWidth={1.75} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center"
            aria-label="Fermer le scanner"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center my-4">
        <div className="relative w-full max-w-md rounded-3xl overflow-hidden bg-black border border-white/15 min-h-[280px] flex items-center justify-center">
          <div id={scannerElementId} className="w-full" />
          {errorText && (
            <div className="absolute inset-0 bg-[#16181F] flex flex-col items-center justify-center p-6 text-center">
              <ScanLine className="w-10 h-10 text-slate-400 mb-3" strokeWidth={1.75} />
              <p className="text-sm font-medium text-slate-200 max-w-xs">{errorText}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-5 px-5 py-2.5 rounded-xl bg-white text-slate-900 font-semibold text-sm"
              >
                Revenir au choix
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-slate-500">
        Compatible EAN-13, Code 128, QR Code et DataMatrix
      </p>
    </motion.div>
  );
};
