import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Delete, Fingerprint, Lock, ShieldCheck, X } from 'lucide-react';
import { AppSettings } from '../types';
import { BiometricService } from '../services/BiometricService';
import { HapticService } from '../services/HapticService';

interface SecurityLockModalProps {
  mode: 'unlock-app' | 'unlock-private' | 'setup-pin';
  settings: AppSettings;
  onUnlock: () => void;
  onPinConfigured?: (hash: string, salt: string, length: 4 | 6) => Promise<void>;
  onCancel?: () => void;
}

export const SecurityLockModal: React.FC<SecurityLockModalProps> = ({
  mode,
  settings,
  onUnlock,
  onPinConfigured,
  onCancel,
}) => {
  const isSetup = mode === 'setup-pin';
  const [pinLength, setPinLength] = useState<4 | 6>(settings.pinLength || 4);
  const [enteredPin, setEnteredPin] = useState('');
  const [firstPinForSetup, setFirstPinForSetup] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [biometryAvailable, setBiometryAvailable] = useState(false);
  const [biometryLabel, setBiometryLabel] = useState('Empreinte / Code appareil');
  const [shake, setShake] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const biometricLaunchedRef = useRef(false);

  const triggerBiometricPrompt = useCallback(async () => {
    if (isSetup || !settings.biometricEnabled) return;
    const reason =
      mode === 'unlock-private'
        ? 'Accéder à votre dossier privé'
        : 'Déverrouiller votre portefeuille Mes Cartes';
    const ok = await BiometricService.authenticate(reason);
    if (ok) {
      await HapticService.success(settings.hapticIntensity);
      onUnlock();
    }
  }, [isSetup, mode, onUnlock, settings.biometricEnabled, settings.hapticIntensity]);

  useEffect(() => {
    let active = true;
    BiometricService.checkAvailability().then((info) => {
      if (!active) return;
      setBiometryAvailable(info.available);
      setBiometryLabel(info.label);
      if (
        info.available &&
        settings.biometricEnabled &&
        !isSetup &&
        !biometricLaunchedRef.current
      ) {
        biometricLaunchedRef.current = true;
        triggerBiometricPrompt();
      }
    });
    return () => {
      active = false;
    };
  }, [isSetup, settings.biometricEnabled, triggerBiometricPrompt]);

  const handleDigit = async (digit: string) => {
    if (verifying || enteredPin.length >= pinLength) return;
    HapticService.tap(settings.hapticIntensity);
    setErrorMsg(null);
    const next = enteredPin + digit;
    setEnteredPin(next);

    if (next.length !== pinLength) return;

    if (isSetup) {
      if (!firstPinForSetup) {
        setTimeout(() => {
          setFirstPinForSetup(next);
          setEnteredPin('');
        }, 160);
        return;
      }

      if (next === firstPinForSetup) {
        setVerifying(true);
        try {
          const { hash, salt } = await BiometricService.hashPin(next);
          await HapticService.success(settings.hapticIntensity);
          if (onPinConfigured) {
            await onPinConfigured(hash, salt, pinLength);
          }
          onUnlock();
        } finally {
          setVerifying(false);
        }
      } else {
        await HapticService.error(settings.hapticIntensity);
        setShake(true);
        setTimeout(() => setShake(false), 400);
        setErrorMsg('Les deux codes PIN ne correspondent pas.');
        setFirstPinForSetup(null);
        setEnteredPin('');
      }
      return;
    }

    setVerifying(true);
    try {
      const valid = await BiometricService.verifyPin(next, settings.pinHash, settings.pinSalt);
      if (valid) {
        await HapticService.success(settings.hapticIntensity);
        onUnlock();
      } else {
        await HapticService.error(settings.hapticIntensity);
        setShake(true);
        setTimeout(() => setShake(false), 400);
        setErrorMsg('Code PIN incorrect.');
        setEnteredPin('');
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleBackspace = () => {
    if (verifying || enteredPin.length === 0) return;
    HapticService.tap(settings.hapticIntensity);
    setEnteredPin((prev) => prev.slice(0, -1));
  };

  const title = isSetup
    ? firstPinForSetup
      ? 'Confirmer le code PIN'
      : 'Créer un code PIN'
    : mode === 'unlock-private'
      ? 'Dossier privé'
      : 'Mes Cartes';

  const subtitle = isSetup
    ? `Code personnel à ${pinLength} chiffres`
    : settings.pinHash
      ? 'Saisissez votre code PIN ou utilisez la biométrie'
      : 'Authentifiez-vous avec la sécurité de votre téléphone';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] bg-[#0D0E12] text-white flex flex-col justify-between p-6 safe-top safe-bottom"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" strokeWidth={1.75} />
          Coffre-fort local
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center"
            aria-label="Annuler"
          >
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        )}
      </div>

      <div className="flex flex-col items-center text-center max-w-sm w-full mx-auto">
        <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center mb-4">
          <Lock className="w-6 h-6 text-white" strokeWidth={1.75} />
        </div>

        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <p className="text-sm text-slate-400 mt-1">{subtitle}</p>

        {isSetup && !firstPinForSetup && (
          <div className="flex gap-1.5 mt-4 bg-white/10 p-1 rounded-xl">
            {([4, 6] as const).map((len) => (
              <button
                key={len}
                type="button"
                onClick={() => {
                  setPinLength(len);
                  setEnteredPin('');
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  pinLength === len ? 'bg-white text-slate-900' : 'text-slate-300'
                }`}
              >
                {len} chiffres
              </button>
            ))}
          </div>
        )}

        {(settings.pinHash || isSetup) && (
          <>
            <motion.div
              animate={shake ? { x: [-8, 8, -6, 6, 0] } : {}}
              transition={{ duration: 0.3 }}
              className="flex items-center justify-center gap-4 my-7"
            >
              {Array.from({ length: pinLength }).map((_, idx) => {
                const filled = idx < enteredPin.length;
                return (
                  <div
                    key={idx}
                    className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                      filled ? 'bg-white scale-110' : 'bg-white/20'
                    }`}
                  />
                );
              })}
            </motion.div>

            {errorMsg && (
              <p className="text-xs font-semibold text-rose-400 mb-4">{errorMsg}</p>
            )}

            <div className="grid grid-cols-3 gap-3.5 w-full max-w-[272px]">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleDigit(digit)}
                  className="h-16 rounded-full bg-white/10 hover:bg-white/15 active:bg-white/25 active:scale-95 text-2xl font-semibold transition-all flex items-center justify-center"
                >
                  {digit}
                </button>
              ))}

              {!isSetup && biometryAvailable && settings.biometricEnabled ? (
                <button
                  type="button"
                  onClick={triggerBiometricPrompt}
                  className="h-16 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-blue-300"
                  aria-label="Authentification biométrique"
                >
                  <Fingerprint className="w-7 h-7" strokeWidth={1.75} />
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                onClick={() => handleDigit('0')}
                className="h-16 rounded-full bg-white/10 hover:bg-white/15 active:bg-white/25 active:scale-95 text-2xl font-semibold transition-all flex items-center justify-center"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleBackspace}
                className="h-16 rounded-full bg-transparent hover:bg-white/10 active:scale-95 flex items-center justify-center text-slate-300"
                aria-label="Effacer"
              >
                <Delete className="w-6 h-6" strokeWidth={1.75} />
              </button>
            </div>
          </>
        )}

        {!isSetup && biometryAvailable && settings.biometricEnabled && (
          <button
            type="button"
            onClick={triggerBiometricPrompt}
            className="mt-7 inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-white text-slate-900 font-bold text-sm shadow-sm active:scale-95 transition-transform"
          >
            <Fingerprint className="w-5 h-5" strokeWidth={1.75} />
            Déverrouiller ({biometryLabel})
          </button>
        )}
      </div>

      <p className="text-center text-[11px] text-slate-500">
        © Louis Martignon · @louismrtg
      </p>
    </motion.div>
  );
};
