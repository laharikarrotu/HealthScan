'use client';

import { useEffect, useState, useCallback } from 'react';
import QRCode from 'react-qr-code';

/**
 * QR opens the scan flow on a phone (mobile browser /scan, or Expo/deep link via env).
 * Set NEXT_PUBLIC_MOBILE_SCAN_URL when you publish the native app or Expo Go link.
 */
export default function MobileScanQrPanel() {
  const [target, setTarget] = useState('');
  const [showQr, setShowQr] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const explicit = process.env.NEXT_PUBLIC_MOBILE_SCAN_URL?.trim();
    if (explicit) {
      if (
        explicit.startsWith('http://') ||
        explicit.startsWith('https://') ||
        explicit.startsWith('exp://')
      ) {
        setTarget(explicit);
      } else if (explicit.startsWith('/')) {
        setTarget(`${window.location.origin}${explicit}`);
      } else {
        setTarget(explicit);
      }
    } else {
      setTarget(`${window.location.origin}/scan`);
    }

    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => setShowQr(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  const copy = useCallback(async () => {
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [target]);

  if (!showQr) {
    return (
      <div className="mt-4 pt-4 border-t border-slate-200/90">
        <p className="text-xs text-slate-500 leading-relaxed">
          On this phone, use <span className="font-medium text-slate-700">Use camera</span> above to capture a prescription.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 pt-4 border-t border-slate-200/90">
      <p className="text-xs font-semibold text-slate-800 mb-3">Continue on your phone</p>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
        <div className="shrink-0 rounded-xl bg-white p-3 border border-slate-200 shadow-sm self-center sm:self-start">
          {target ? (
            <QRCode
              value={target}
              size={132}
              style={{ height: 'auto', maxWidth: '100%', width: '132px' }}
              viewBox="0 0 256 256"
            />
          ) : (
            <div className="w-[132px] h-[132px] bg-slate-100 rounded-lg animate-pulse" aria-hidden />
          )}
        </div>
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-xs text-slate-800 leading-relaxed">
            Scan with your phone camera to open HealthScan scan. Then use <span className="font-medium">Use camera</span> on that page to photograph the document.
          </p>
          {target && (
            <div className="flex flex-wrap items-center gap-2">
              <code className="text-[11px] text-slate-800 truncate max-w-full sm:max-w-[240px] block bg-slate-100 px-2 py-1 rounded border border-slate-200">
                {target}
              </code>
              <button
                type="button"
                onClick={copy}
                className="text-xs font-medium text-slate-700 hover:text-slate-900 underline underline-offset-2"
              >
                {copied ? 'Copied' : 'Copy link'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
