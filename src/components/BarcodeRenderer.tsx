import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { QRCodeSVG } from 'qrcode.react';
import { BarcodeFormat } from '../types';
import { BarcodeService } from '../services/BarcodeService';

interface BarcodeRendererProps {
  value: string;
  format: BarcodeFormat;
  size?: 'preview' | 'checkout';
  fullScreen?: boolean;
  showText?: boolean;
}

const JSBARCODE_FORMAT_MAP: Partial<Record<BarcodeFormat, string>> = {
  EAN_13: 'EAN13',
  EAN_8: 'EAN8',
  CODE_128: 'CODE128',
  CODE_39: 'CODE39',
  ITF: 'ITF',
  UPC_A: 'UPC',
};

export const BarcodeRenderer: React.FC<BarcodeRendererProps> = ({
  value,
  format,
  size = 'checkout',
  fullScreen = false,
  showText = true,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [bwipSvg, setBwipSvg] = useState<string | null>(null);
  const [fallbackNote, setFallbackNote] = useState<string | null>(null);

  const cleanValue = value.trim();

  useEffect(() => {
    let cancelled = false;

    if (!cleanValue) return;

    if (format === 'QR_CODE') {
      setBwipSvg(null);
      setFallbackNote(null);
      return;
    }

    if (format === 'DATA_MATRIX') {
      setFallbackNote(null);
      import('bwip-js/browser')
        .then((mod) => {
          if (cancelled) return;
          const bwipjs = mod.default || mod;
          const svg = bwipjs.toSVG({
            bcid: 'datamatrix',
            text: cleanValue,
            scale: size === 'checkout' ? 6 : 3,
            barcolor: '000000',
            backgroundcolor: 'FFFFFF',
            paddingwidth: 4,
            paddingheight: 4,
          });
          setBwipSvg(svg);
        })
        .catch(() => {
          if (!cancelled) setBwipSvg(null);
        });
      return () => {
        cancelled = true;
      };
    }

    const svgEl = svgRef.current;
    if (!svgEl) return;

    const targetJsFormat = JSBARCODE_FORMAT_MAP[format] || 'CODE128';
    const barHeight = size === 'checkout' ? (fullScreen ? 170 : 148) : 64;
    const barWidth = size === 'checkout' ? 3.2 : 1.7;

    try {
      setFallbackNote(null);
      setBwipSvg(null);
      JsBarcode(svgEl, cleanValue, {
        format: targetJsFormat,
        lineColor: '#000000',
        background: '#FFFFFF',
        width: barWidth,
        height: barHeight,
        displayValue: false,
        margin: 16,
      });
    } catch {
      try {
        JsBarcode(svgEl, cleanValue, {
          format: 'CODE128',
          lineColor: '#000000',
          background: '#FFFFFF',
          width: barWidth,
          height: barHeight,
          displayValue: false,
          margin: 16,
        });
        setFallbackNote('Encodé en Code 128');
        setBwipSvg(null);
      } catch {
        import('bwip-js/browser')
          .then((mod) => {
            if (cancelled) return;
            try {
              const bwipjs = mod.default || mod;
              const svgMarkup = bwipjs.toSVG({
                bcid: 'code128',
                text: cleanValue,
                scale: 4,
                height: 22,
                barcolor: '000000',
                backgroundcolor: 'FFFFFF',
                paddingwidth: 6,
                paddingheight: 4,
              });
              setBwipSvg(svgMarkup);
              setFallbackNote('Encodé en Code 128');
            } catch {
              setFallbackNote('Format incompatible avec ce numéro');
            }
          })
          .catch(() => {
            if (!cancelled) setFallbackNote('Format incompatible avec ce numéro');
          });
      }
    }

    return () => {
      cancelled = true;
    };
  }, [cleanValue, format, size, fullScreen]);

  if (!cleanValue) {
    return null;
  }

  const formattedNumber = BarcodeService.formatDisplayNumber(cleanValue, format);
  const isCheckout = size === 'checkout';

  return (
    <div
      className={`w-full bg-white text-black rounded-2xl flex flex-col items-center justify-center border border-slate-200/80 ${
        isCheckout
          ? fullScreen
            ? 'h-full px-4 py-3 sm:px-8 sm:py-4 shadow-card'
            : 'px-4 py-4 sm:px-8 sm:py-6 shadow-card'
          : 'px-4 py-3'
      }`}
      style={{ backgroundColor: '#FFFFFF' }}
    >
      <div
        className={`w-full flex items-center justify-center bg-white rounded-xl overflow-hidden ${
          fullScreen ? 'flex-1 min-h-0 px-2 py-1' : 'px-2 py-1.5'
        }`}
      >
        {format === 'QR_CODE' ? (
          <QRCodeSVG
            value={cleanValue}
            size={isCheckout ? (fullScreen ? 230 : 210) : 120}
            bgColor="#FFFFFF"
            fgColor="#000000"
            level="M"
            includeMargin={true}
            className="max-h-full w-auto"
          />
        ) : bwipSvg ? (
          <div
            className="w-full h-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:h-auto"
            style={{ maxHeight: isCheckout ? (fullScreen ? '52vh' : 210) : 120 }}
            dangerouslySetInnerHTML={{ __html: bwipSvg }}
          />
        ) : (
          <svg
            ref={svgRef}
            shapeRendering="crispEdges"
            className={`w-full select-none ${
              isCheckout
                ? fullScreen
                  ? 'h-full max-h-[54vh]'
                  : 'h-auto max-h-[42vh]'
                : 'max-w-[340px] h-auto'
            }`}
            aria-label={`Code-barres ${cleanValue}`}
          />
        )}
      </div>

      {showText && (
        <p
          className={`font-mono font-bold tracking-[0.2em] text-black text-center break-all select-all shrink-0 ${
            isCheckout
              ? fullScreen
                ? 'text-xl sm:text-3xl mt-1.5'
                : 'text-xl sm:text-2xl mt-2.5'
              : 'text-sm mt-1.5'
          }`}
        >
          {formattedNumber}
        </p>
      )}

      {fallbackNote && (
        <span className="mt-1 text-[11px] font-medium text-slate-500 shrink-0">
          {fallbackNote}
        </span>
      )}
    </div>
  );
};
