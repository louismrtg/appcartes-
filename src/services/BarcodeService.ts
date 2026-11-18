import { Capacitor } from '@capacitor/core';
import {
  BarcodeScanner,
  BarcodeFormat as MlkitFormat,
} from '@capacitor-mlkit/barcode-scanning';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Html5Qrcode } from 'html5-qrcode';
import { BarcodeFormat } from '../types';

export interface ScanBarcodeResult {
  value: string;
  format: BarcodeFormat;
  source: 'native-mlkit' | 'web-camera' | 'image-file' | 'manual';
}

const MLKIT_TO_APP_FORMAT: Record<string, BarcodeFormat> = {
  [MlkitFormat.Ean13]: 'EAN_13',
  [MlkitFormat.Ean8]: 'EAN_8',
  [MlkitFormat.Code128]: 'CODE_128',
  [MlkitFormat.Code39]: 'CODE_39',
  [MlkitFormat.QrCode]: 'QR_CODE',
  [MlkitFormat.DataMatrix]: 'DATA_MATRIX',
  [MlkitFormat.Itf]: 'ITF',
  [MlkitFormat.UpcA]: 'UPC_A',
};

const APP_TO_MLKIT_FORMATS: MlkitFormat[] = [
  MlkitFormat.Ean13,
  MlkitFormat.Ean8,
  MlkitFormat.Code128,
  MlkitFormat.Code39,
  MlkitFormat.QrCode,
  MlkitFormat.DataMatrix,
  MlkitFormat.Itf,
  MlkitFormat.UpcA,
];

const TEXT_FORMAT_MAP: Record<string, BarcodeFormat> = {
  ean_13: 'EAN_13',
  EAN_13: 'EAN_13',
  ean_8: 'EAN_8',
  EAN_8: 'EAN_8',
  code_128: 'CODE_128',
  CODE_128: 'CODE_128',
  code_39: 'CODE_39',
  CODE_39: 'CODE_39',
  qr_code: 'QR_CODE',
  QR_CODE: 'QR_CODE',
  data_matrix: 'DATA_MATRIX',
  DATA_MATRIX: 'DATA_MATRIX',
  itf: 'ITF',
  ITF: 'ITF',
  upc_a: 'UPC_A',
  UPC_A: 'UPC_A',
};

export const BARCODE_FORMAT_LABELS: Record<BarcodeFormat, string> = {
  EAN_13: 'EAN-13 (Standard magasin)',
  EAN_8: 'EAN-8 (Court)',
  CODE_128: 'Code 128 (Polyvalent)',
  CODE_39: 'Code 39',
  QR_CODE: 'QR Code (2D)',
  DATA_MATRIX: 'DataMatrix (2D)',
  ITF: 'ITF-14 / Entrelacé',
  UPC_A: 'UPC-A (12 chiffres)',
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Erreur lecture fichier'));
    reader.readAsDataURL(file);
  });
}

class BarcodeServiceImpl {
  async scanNative(): Promise<ScanBarcodeResult | null> {
    if (!Capacitor.isNativePlatform()) {
      return null;
    }

    const permissionStatus = await BarcodeScanner.checkPermissions();
    if (permissionStatus.camera !== 'granted') {
      const requested = await BarcodeScanner.requestPermissions();
      if (requested.camera !== 'granted') {
        throw new Error('Permission caméra refusée. Autorisez la caméra dans les paramètres Android.');
      }
    }

    try {
      const moduleCheck = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
      if (!moduleCheck.available) {
        await BarcodeScanner.installGoogleBarcodeScannerModule();
      }
    } catch {
      // Poursuit avec la tentative de scan
    }

    const { barcodes } = await BarcodeScanner.scan({
      formats: APP_TO_MLKIT_FORMATS,
    });

    if (!barcodes || barcodes.length === 0) {
      return null;
    }

    const first = barcodes[0];
    const value = (first.rawValue || first.displayValue || '').trim();
    if (!value) return null;

    const format = MLKIT_TO_APP_FORMAT[first.format] ?? this.detectFormat(value);
    return {
      value,
      format,
      source: 'native-mlkit',
    };
  }

  /**
   * Décode un code-barres depuis une photo ou capture d'écran de la galerie :
   * 1. MLKit readBarcodesFromImage sur Android natif
   * 2. BarcodeDetector natif Chromium / WebView
   * 3. Html5Qrcode.scanFileV2 (ZXing JS)
   */
  async scanFromImageFile(file: File): Promise<ScanBarcodeResult> {
    // 1. Android natif via MLKit readBarcodesFromImage
    if (Capacitor.isNativePlatform()) {
      const tempName = `scan-import-${Date.now()}.jpg`;
      try {
        const base64Data = await fileToBase64(file);
        const written = await Filesystem.writeFile({
          path: tempName,
          data: base64Data,
          directory: Directory.Cache,
        });
        const mlResult = await BarcodeScanner.readBarcodesFromImage({
          path: written.uri,
          formats: APP_TO_MLKIT_FORMATS,
        });
        await Filesystem.deleteFile({ path: tempName, directory: Directory.Cache }).catch(() => {});

        if (mlResult.barcodes && mlResult.barcodes.length > 0) {
          const first = mlResult.barcodes[0];
          const value = (first.rawValue || first.displayValue || '').trim();
          if (value) {
            return {
              value,
              format: MLKIT_TO_APP_FORMAT[first.format] ?? this.detectFormat(value),
              source: 'image-file',
            };
          }
        }
      } catch {
        await Filesystem.deleteFile({ path: tempName, directory: Directory.Cache }).catch(() => {});
      }
    }

    // 2. Native browser / Android WebView BarcodeDetector
    try {
      const DetectorCtor = (
        window as unknown as {
          BarcodeDetector?: new (opts?: { formats?: string[] }) => {
            detect: (img: ImageBitmap) => Promise<Array<{ rawValue?: string; format?: string }>>;
          };
        }
      ).BarcodeDetector;

      if (DetectorCtor && typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(file);
        const detector = new DetectorCtor({
          formats: [
            'ean_13',
            'ean_8',
            'code_128',
            'code_39',
            'qr_code',
            'data_matrix',
            'itf',
            'upc_a',
          ],
        });
        const found = await detector.detect(bitmap);
        bitmap.close();
        if (found.length > 0 && found[0].rawValue) {
          const val = found[0].rawValue.trim();
          const fmt =
            (found[0].format && TEXT_FORMAT_MAP[found[0].format]) ||
            this.detectFormat(val);
          return {
            value: val,
            format: fmt,
            source: 'image-file',
          };
        }
      }
    } catch {
      // Fallback vers Html5Qrcode
    }

    // 3. Html5Qrcode scanFileV2
    const tempElId = `html5qr-file-reader-${Date.now()}`;
    const container = document.createElement('div');
    container.id = tempElId;
    container.style.display = 'none';
    document.body.appendChild(container);

    try {
      const scanner = new Html5Qrcode(tempElId, false);
      const res = await scanner.scanFileV2(file, false);
      scanner.clear();
      const val = (res.decodedText || '').trim();
      if (val) {
        const formatName = res.result?.format?.formatName;
        const fmt = (formatName && TEXT_FORMAT_MAP[formatName]) || this.detectFormat(val);
        return {
          value: val,
          format: fmt,
          source: 'image-file',
        };
      }
    } catch {
      // Aucun code détecté
    } finally {
      container.remove();
    }

    throw new Error(
      'Aucun code-barres détecté sur cette image, vous pouvez saisir le numéro manuellement.'
    );
  }

  detectFormat(rawValue: string): BarcodeFormat {
    const clean = rawValue.trim();
    if (!clean) return 'CODE_128';

    if (
      clean.startsWith('http://') ||
      clean.startsWith('https://') ||
      clean.includes('\n') ||
      clean.length > 36
    ) {
      return 'QR_CODE';
    }

    if (/^\d{13}$/.test(clean) && this.isValidEan13(clean)) {
      return 'EAN_13';
    }

    if (/^\d{8}$/.test(clean) && this.isValidEan8(clean)) {
      return 'EAN_8';
    }

    if (/^\d{12}$/.test(clean)) {
      return 'UPC_A';
    }

    if (/^\d{14,}$/.test(clean) && clean.length % 2 === 0) {
      return 'ITF';
    }

    return 'CODE_128';
  }

  isValidEan13(code: string): boolean {
    if (!/^\d{13}$/.test(code)) return false;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = Number(code[i]);
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    const check = (10 - (sum % 10)) % 10;
    return check === Number(code[12]);
  }

  isValidEan8(code: string): boolean {
    if (!/^\d{8}$/.test(code)) return false;
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const digit = Number(code[i]);
      sum += i % 2 === 0 ? digit * 3 : digit;
    }
    const check = (10 - (sum % 10)) % 10;
    return check === Number(code[7]);
  }

  is2DFormat(format: BarcodeFormat): boolean {
    return format === 'QR_CODE' || format === 'DATA_MATRIX';
  }

  formatDisplayNumber(value: string, format: BarcodeFormat): string {
    const trimmed = value.trim();
    if (this.is2DFormat(format) && trimmed.length > 26) {
      return `${trimmed.slice(0, 24)}...`;
    }
    if (/^\d{13}$/.test(trimmed)) {
      return `${trimmed[0]} ${trimmed.slice(1, 7)} ${trimmed.slice(7, 13)}`;
    }
    if (/^\d{8}$/.test(trimmed)) {
      return `${trimmed.slice(0, 4)} ${trimmed.slice(4, 8)}`;
    }
    if (/^\d+$/.test(trimmed) && trimmed.length >= 6) {
      return trimmed.replace(/(.{4})/g, '$1 ').trim();
    }
    return trimmed;
  }
}

export const BarcodeService = new BarcodeServiceImpl();
