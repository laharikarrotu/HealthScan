'use client';

import { useEffect, useState, useCallback } from 'react';
import QRCode from 'react-qr-code';

/**
 * Secondary path: open scan on another device. Collapsed by default so it does not compete with upload.
 */
export default function MobileScanQrPanel() {
  const [target, setTarget] = useState('');
  const [copied, setCopied] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

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
    const apply = () => setIsDesktop(mq.matches);
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

  if (!isDesktop) {
    return (
      <p className="mt-4 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
        On this phone, use <span className="font-medium text-slate-700">Use camera</span> above to capture a prescription.
      </p>
    );
  }

  return (
    <details className="group mt-4 rounded-xl border border-slate-200 bg-white">
      <summary className="cursor-pointer list-none px-3 py-2.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800 [&::-webkit-details-marker]:hidden flex items-center justify-between gap-2">
        <span>Use phone instead</span>
        <span className="text-[10px] font-normal text-slate-400 group-open:hidden">Show QR</span>
        <span className="hidden text-[10px] font-normal text-slate-400 group-open:inline">Hide</span>
      </summary>
      <div className="border-t border-slate-100 px-3 pb-4 pt-3">
        <p className="mb-3 text-xs leading-relaxed text-slate-600">
          Scan the QR with your phone to open this scan page, then use the camera there—useful if your prescription is
          physical and this laptop has no camera.
        </p>
        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start">
          <div className="shrink-0 self-center rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:self-start">
            {target ? (
              <QRCode
                value={target}
                size={120}
                style={{ height: 'auto', maxWidth: '100%', width: '120px' }}
                viewBox="0 0 256 256"
              />
            ) : (
              <div className="h-[120px] w-[120px] animate-pulse rounded-lg bg-slate-100" aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            {target && (
              <div className="flex flex-wrap items-center gap-2">
                <code className="block max-w-full truncate rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-800 sm:max-w-[240px]">
                  {target}
                </code>
                <button
                  type="button"
                  onClick={copy}
                  className="text-xs font-medium text-sky-700 underline underline-offset-2 hover:text-sky-900"
                >
                  {copied ? 'Copied' : 'Copy link'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </details>
  );
}
