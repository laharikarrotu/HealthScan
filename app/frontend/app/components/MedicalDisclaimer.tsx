'use client';

interface MedicalDisclaimerProps {
  variant?: 'default' | 'compact' | 'footer';
  className?: string;
}

export default function MedicalDisclaimer({ variant = 'default', className = '' }: MedicalDisclaimerProps) {
  if (variant === 'footer') {
    return (
      <footer className={`hs-card border-t border-slate-200 mt-10 pt-6 px-4 sm:px-5 pb-6 ${className}`}>
        <div className="flex items-start gap-3">
          <span className="text-sm font-bold text-amber-900 shrink-0 mt-0.5" aria-hidden>
            !
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-900 mb-2 text-sm sm:text-base">Medical disclaimer</h3>
            <p className="text-sm text-slate-700 mb-3 leading-relaxed">
              HealthScan is for informational support only.{' '}
              <strong className="text-slate-900">It is not a substitute for professional medical advice, diagnosis, or treatment.</strong>{' '}
              Always follow your physician or qualified health provider for medical decisions.
            </p>
            <div className="grid sm:grid-cols-2 gap-4 mt-4">
              <div>
                <p className="text-xs font-semibold text-slate-800 mb-1">Emergencies</p>
                <p className="text-xs text-slate-700">Call 911 or your local emergency number.</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800 mb-1">Privacy</p>
                <p className="text-xs text-slate-700">Do not share sensitive data you are not comfortable storing.</p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    );
  }

  if (variant === 'compact') {
    return (
      <div
        className={`rounded-xl border border-amber-300/90 bg-amber-50 px-3 py-2.5 ${className}`}
        role="note"
      >
        <p className="text-xs text-amber-950 leading-relaxed">
          <strong className="font-semibold">Not medical advice.</strong> Always consult your healthcare provider.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-amber-300/90 bg-amber-50 p-4 ${className}`} role="note">
      <div className="flex items-start gap-3">
        <span className="text-sm font-bold text-amber-900 shrink-0" aria-hidden>
          !
        </span>
        <div>
          <p className="text-sm font-semibold text-amber-950 mb-1">Medical disclaimer</p>
          <p className="text-xs text-amber-950/95 leading-relaxed">
            For information only—not a replacement for professional advice, diagnosis, or treatment. Consult your
            healthcare provider before changing medications or diet.
          </p>
        </div>
      </div>
    </div>
  );
}
