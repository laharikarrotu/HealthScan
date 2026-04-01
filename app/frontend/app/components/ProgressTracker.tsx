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
    <div className="hs-card panel-static p-4 sm:p-5 mb-6">
      <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-4">Workflow</h3>
      <div className="flex items-center justify-between gap-1 sm:gap-2">
        {steps.map((step, index) => {
          const isActive = currentStep === step.id;
          const isCompleted = step.completed;
          const isPast = currentStepIndex > index;

          return (
            <div key={step.id} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-1 min-w-0">
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors shrink-0 ${
                    isActive
                      ? 'bg-slate-900 text-white ring-2 ring-slate-900 ring-offset-2'
                      : isCompleted || isPast
                        ? 'bg-emerald-700 text-white'
                        : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {isCompleted && !isActive ? '✓' : index + 1}
                </div>
                <span
                  className={`text-[10px] sm:text-xs mt-2 text-center font-medium leading-tight px-0.5 ${
                    isActive ? 'text-slate-900' : isCompleted ? 'text-emerald-800' : 'text-slate-600'
                  }`}
                >
                  <span className="hidden sm:inline">{step.label}</span>
                  <span className="sm:hidden">{step.short}</span>
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-1 sm:mx-2 rounded-full min-w-[8px] ${
                    isPast || isCompleted ? 'bg-emerald-600' : 'bg-slate-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
