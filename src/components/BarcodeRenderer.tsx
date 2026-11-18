import React, { useEffect, useMemo, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import bwipjs from 'bwip-js/browser';
import { QRCodeSVG } from 'qrcode.react';
import { BarcodeFormat } from '../types';
import { BarcodeService } from '../services/BarcodeService';

interface BarcodeRendererProps {
  value: string;
  format: BarcodeFormat;
  size?: 'preview' | 'checkout';
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
  showText = true,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [bwipSvg, setBwipSvg] = useState<string | null>(null);
  const [fallbackNote, setFallbackNote] = useState<string | null>(null);

  const cleanValue = value.trim();

  const bwipRendered = useMemo(() => {
    if (format !== 'DATA_MATRIX' || !cleanValue) return null;
    try {
      return bwipjs.toSVG({
        bcid: 'datamatrix',
        text: cleanValue,
        scale: size === 'checkout' ? 5 : 3,
        barcolor: '000000',
        backgroundcolor: 'FFFFFF',
        paddingwidth: 4,
        paddingheight: 4,
      });
    } catch {
      return null;
    }
  }, [cleanValue, format, size]);

  useEffect(() => {
    setBwipSvg(bwipRendered);
  }, [bwipRendered]);

  useEffect(() => {
    if (format === 'QR_CODE' || format === 'DATA_MATRIX') {
      setFallbackNote(null);
      return;
    }

    const svgEl = svgRef.current;
    if (!svgEl || !cleanValue) return;

    const targetJsFormat = JSBARCODE_FORMAT_MAP[format] || 'CODE128';
    const barHeight = size === 'checkout' ? 132 : 64;
    const barWidth = size === 'checkout' ? 2.7 : 1.7;

    try {
      setFallbackNote(null);
      JsBarcode(svgEl, cleanValue, {
        format: targetJsFormat,
        lineColor: '#000000',
        background: '#FFFFFF',
        width: barWidth,
        height: barHeight,
        displayValue: false,
        margin: 14,
      });
      setBwipSvg(null);
    } catch {
      try {
        JsBarcode(svgEl, cleanValue, {
          format: 'CODE128',
          lineColor: '#000000',
          background: '#FFFFFF',
          width: barWidth,
          height: barHeight,
          displayValue: false,
          margin: 14,
        });
        setFallbackNote('Encodé en Code 128');
        setBwipSvg(null);
      } catch {
        try {
          const svgMarkup = bwipjs.toSVG({
            bcid: 'code128',
            text: cleanValue,
            scale: 3,
            height: 18,
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
      }
    }
  }, [cleanValue, format, size]);

  if (!cleanValue) {
    return null;
  }

  const formattedNumber = BarcodeService.formatDisplayNumber(cleanValue, format);
  const isCheckout = size === 'checkout';

  return (
    <div
      className={`w-full bg-white text-black rounded-2xl flex flex-col items-center justify-center border border-slate-200/80 ${
        isCheckout ? 'px-6 py-5 sm:px-10 sm:py-6 shadow-card' : 'px-4 py-3'
      }`}
      style={{ backgroundColor: '#FFFFFF' }}
    >
      <div className="w-full flex items-center justify-center bg-white px-3 py-2 rounded-xl overflow-hidden">
        {format === 'QR_CODE' ? (
          <QRCodeSVG
            value={cleanValue}
            size={isCheckout ? 210 : 120}
            bgColor="#FFFFFF"
            fgColor="#000000"
            level="M"
            includeMargin={true}
          />
        ) : bwipSvg ? (
          <div
            className="flex items-center justify-center [&>svg]:max-w-full [&>svg]:h-auto"
            style={{ maxHeight: isCheckout ? 200 : 120 }}
            dangerouslySetInnerHTML={{ __html: bwipSvg }}
          />
        ) : (
          <svg
            ref={svgRef}
            className="w-full max-w-[520px] h-auto select-none"
            aria-label={`Code-barres ${cleanValue}`}
          />
        )}
      </div>

      {showText && (
        <p
          className={`font-mono font-bold tracking-[0.18em] text-black text-center break-all select-all ${
            isCheckout ? 'text-xl sm:text-2xl mt-3' : 'text-sm mt-1.5'
          }`}
        >
          {formattedNumber}
        </p>
      )}

      {fallbackNote && (
        <span className="mt-1.5 text-[11px] font-medium text-slate-500">
          {fallbackNote}
        </span>
      )}
    </div>
  );
};
