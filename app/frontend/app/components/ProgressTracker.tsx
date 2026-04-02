'use client';

import { useHealthScan } from '../context/HealthScanContext';

export default function ProgressTracker() {
  const { currentStep, prescriptionData, interactionResult, dietData } = useHealthScan();

  const steps = [
    { id: 'scan', label: 'Scan', short: 'Scan', completed: !!prescriptionData },
    { id: 'interactions', label: 'Interactions', short: 'Rx check', completed: !!interactionResult },
    { id: 'diet', label: 'Diet', short: 'Diet', completed: !!dietData?.condition },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="hs-card panel-static mb-8 p-5 sm:p-6">
      <h3 className="mb-5 text-xs font-bold uppercase tracking-wider text-slate-500">Workflow</h3>
      <div className="flex items-center justify-between gap-1 sm:gap-3">
        {steps.map((step, index) => {
          const isActive = currentStep === step.id;
          const isCompleted = step.completed;
          const isPast = index < currentStepIndex;

          return (
            <div key={step.id} className="flex min-w-0 flex-1 items-center">
              <div className="flex min-w-0 flex-1 flex-col items-center">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all sm:h-12 sm:w-12 ${
                    isActive
                      ? 'bg-sky-600 text-white shadow-md ring-4 ring-sky-200'
                      : isCompleted || isPast
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-200 text-slate-700'
                  }`}
                  aria-current={isActive ? 'step' : undefined}
                >
                  {isCompleted ? '✓' : index + 1}
                </div>
                <span
                  className={`mt-3 max-w-[5.5rem] text-center text-[10px] font-semibold leading-tight sm:max-w-none sm:text-xs ${
                    isActive ? 'text-sky-800' : isCompleted ? 'text-emerald-800' : 'text-slate-500'
                  }`}
                >
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{step.short}</span>
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`mx-1 h-1 min-w-[10px] flex-1 rounded-full sm:mx-2 ${
                    index < currentStepIndex ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
