'use client';

interface StreamingProgressProps {
  message: string;
  progress: number;
  step: string;
}

export default function StreamingProgress({ message, progress, step }: StreamingProgressProps) {
  return (
    <div className="w-full">
      <div className="bg-transparent rounded-lg p-0">
        {/* Progress Bar */}
        <div className="w-full bg-slate-200 rounded-full h-2 mb-3">
          <div
            className="bg-slate-900 h-2 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        
        {/* Progress Text */}
        <div className="flex items-center justify-between text-sm gap-2">
          <span className="text-slate-900 font-medium">{message}</span>
          <span className="text-slate-900 font-semibold tabular-nums shrink-0">{progress}%</span>
        </div>
        
        {/* Step Indicator */}
        <div className="mt-2 text-xs text-slate-600">
          {step}
        </div>
      </div>
    </div>
  );
}

