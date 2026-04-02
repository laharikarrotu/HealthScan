'use client';

interface MedicalDisclaimerProps {
  variant?: 'default' | 'compact' | 'footer';
  className?: string;
}

export default function MedicalDisclaimer({ variant = 'default', className = '' }: MedicalDisclaimerProps) {
  if (variant === 'footer') {
    return (
      <details
        className={`group mt-10 border-t border-slate-200 pt-4 ${className}`}
      >
        <summary className="cursor-pointer list-none text-xs font-medium text-slate-500 transition-colors hover:text-slate-700 [&::-webkit-details-marker]:hidden flex items-center gap-1.5">
          <span className="text-slate-400" aria-hidden>
            ⓘ
          </span>
          Medical disclaimer
          <span className="ml-auto text-[10px] font-normal text-slate-400 group-open:hidden">Show</span>
          <span className="ml-auto hidden text-[10px] font-normal text-slate-400 group-open:inline">Hide</span>
        </summary>
        <div className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600">
          <p>
            HealthScan is for informational support only.{' '}
            <strong className="font-medium text-slate-800">Not a substitute for professional medical advice, diagnosis, or treatment.</strong>{' '}
            Follow your physician or qualified provider for medical decisions.
          </p>
          <p className="text-slate-500">
            <span className="font-medium text-slate-600">Emergencies:</span> call 911 or your local emergency number.
          </p>
        </div>
      </details>
    );
  }

  if (variant === 'compact') {
    return (
      <p
        className={`text-[11px] leading-snug text-slate-500 ${className}`}
        role="note"
      >
        <span className="font-medium text-slate-600">Not medical advice.</span> Consult your healthcare provider.
      </p>
    );
  }

  return (
    <div className={`rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 ${className}`} role="note">
      <p className="text-xs leading-relaxed text-slate-600">
        <span className="font-medium text-slate-800">Information only</span> — not a replacement for professional advice. Consult your provider before changing medications or diet.
      </p>
    </div>
  );
}
