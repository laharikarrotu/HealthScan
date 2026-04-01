'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { InteractionCheckResponse, InteractionWarning, PrescriptionDetail } from '../lib/types';
import ProgressTracker from './ProgressTracker';
import { useHealthScan } from '../context/HealthScanContext';
import { API_BASE_URL, fetchAllergyProfile, saveAllergyProfile } from '../lib/api';
import { safeStorage } from '../lib/storage';
import MedicalDisclaimer from './MedicalDisclaimer';

export default function InteractionChecker() {
  const router = useRouter();
  const {
    prescriptionData,
    setInteractionResult,
    setCurrentStep,
    errors,
    setError,
    clearErrors,
    navigateToDiet,
  } = useHealthScan();
  
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [allergies, setAllergies] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<InteractionCheckResponse | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const allergySaveSkippedFirst = useRef(true);

  // Set current step on mount
  useEffect(() => {
    setCurrentStep('interactions');
  }, [setCurrentStep]);

  // Load structured allergy profile (patient-safety record on server)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { allergens } = await fetchAllergyProfile();
        if (!cancelled && allergens.length > 0) {
          setAllergies(allergens.join(', '));
        }
      } catch {
        /* offline or API down — field still works locally */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist allergy list for allergy-aware interaction checks (debounced)
  useEffect(() => {
    if (allergySaveSkippedFirst.current) {
      allergySaveSkippedFirst.current = false;
      return;
    }
    const parts = allergies
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const t = setTimeout(() => {
      void saveAllergyProfile(parts);
    }, 1200);
    return () => clearTimeout(t);
  }, [allergies]);
  
  // Show info if prescription data is available from Scanner
  useEffect(() => {
    if (prescriptionData && prescriptionData.medications.length > 0 && images.length === 0) {
      // Data available from previous step
    }
  }, [prescriptionData, images.length]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setImages(files);
      const previews = files.map(file => {
        const reader = new FileReader();
        return new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      });
      Promise.all(previews).then(setImagePreviews);
      setLocalError(null);
      setResult(null);
      clearErrors();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (images.length === 0) {
      setLocalError('Please select at least one prescription image');
      setError('interactions', 'Please select at least one prescription image');
      return;
    }

    setLoading(true);
    setLocalError(null);
    setResult(null);
    clearErrors();

    try {
      const formData = new FormData();
      // FastAPI accepts List[UploadFile] - append all files with key 'files'
      images.forEach((file) => {
        formData.append('files', file);
      });
      if (allergies.trim()) {
        formData.append('allergies', allergies);
      }

      const response = await fetch(`${API_BASE_URL}/check-prescription-interactions`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Failed to check interactions';
        try {
        const error = await response.json();
          errorMessage = error.detail || error.message || errorMessage;
        } catch (e) {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Validate response structure
      if (data.status === 'error') {
        throw new Error(data.message || 'An error occurred while checking interactions');
      }
      
      // Ensure we have the expected fields - backend provides both 'warnings' and 'interactions'
      const warnings = data.warnings || data.interactions || { major: [], moderate: [], minor: [] };
      const prescriptionDetails = data.prescription_details || data.prescriptions || [];
      
      if (!warnings || (!prescriptionDetails.length && data.medications_found === 0)) {
        throw new Error('Invalid response format from server');
      }
      
      setResult(data);
      
      // Store in context
      setInteractionResult({
        warnings: warnings,
        prescription_details: prescriptionDetails,
      });
      
      clearErrors();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Something went wrong';
      setLocalError(errorMsg);
      
      // Error recovery: Retry suggestion
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
        setError('interactions', 'Network error. Please check your connection and try again.');
      } else {
        setError('interactions', errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setImages([]);
    setImagePreviews([]);
    setAllergies('');
    setResult(null);
    setLocalError(null);
    clearErrors();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="h-full w-full text-slate-800 overflow-y-auto bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <header className="mb-8">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Safety check</p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">Drug interactions</h1>
          <p className="text-sm text-slate-600 mt-2 max-w-xl leading-relaxed">
            Upload one or more prescription images. Add known allergies so we can flag drug–allergy conflicts—not a substitute for your pharmacist or doctor.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5" aria-label="Drug interaction checker form">
          {/* Multi-Image Upload */}
          <div className="medical-card panel-static p-4 sm:p-5 rounded-xl">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">1. Prescription images</h2>
            
            {imagePreviews.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {imagePreviews.map((preview, idx) => (
                    <div key={idx} className="relative rounded-xl overflow-hidden border border-slate-200 bg-white">
                      <img
                        src={preview}
                        alt={`Prescription ${idx + 1}`}
                        className="w-full h-auto"
                      />
                      <span className="absolute top-2 left-2 bg-slate-900/85 text-white px-2 py-0.5 rounded text-[11px] font-medium">
                        {idx + 1}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                  aria-label="Change prescription images"
                >
                  Change images
                </button>
              </div>
            ) : (
              <label className="cursor-pointer block">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  aria-label="Upload prescription images"
                />
                <div className="border border-dashed border-slate-300 rounded-xl p-10 md:p-12 text-center hover:border-slate-400 hover:bg-slate-50/80 transition-colors">
                  <p className="text-slate-800 font-medium text-sm">Upload images</p>
                  <p className="text-xs text-slate-500 mt-1">Multiple files supported</p>
                </div>
              </label>
            )}
          </div>

          {/* Allergies Input */}
          <div className="medical-card panel-static p-4 sm:p-5 rounded-xl">
            <h2 className="text-sm font-semibold text-slate-900 mb-3">2. Allergies (optional)</h2>
            <input
              type="text"
              value={allergies}
              onChange={(e) => setAllergies(e.target.value)}
              placeholder="Comma-separated, e.g. Penicillin, Aspirin"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/25 focus:border-slate-400 bg-white"
              aria-label="Enter known allergies"
            />
            <p className="text-xs text-slate-500 mt-2">Synced to your session for repeat visits</p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || images.length === 0}
            className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
            aria-label={loading ? "Checking interactions" : `Check ${images.length} prescription${images.length > 1 ? 's' : ''}`}
          >
            {loading ? (
              <>
                <div className="spinner w-5 h-5 border-2 border-white border-t-transparent"></div>
                <span>Checking…</span>
              </>
            ) : (
              <span>Run interaction check</span>
            )}
          </button>

          {(localError || errors.interactions) && (
            <div className="rounded-xl border border-red-200 bg-red-50/80 p-4">
              <div className="flex items-start gap-3">
                <span className="text-red-600 text-sm font-semibold shrink-0">!</span>
                <div className="flex-1">
                  <p className="text-red-800 font-semibold mb-1">Error</p>
                  <p className="text-red-700 text-sm">{localError || errors.interactions}</p>
              {localError?.includes('Network') && (
                <button
                  onClick={handleSubmit}
                      className="mt-3 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                      aria-label="Retry checking interactions"
                >
                  Retry
                </button>
              )}
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Results */}
        {result && (
          <div className="mt-8 medical-card panel-static p-5 sm:p-6 rounded-xl animate-in">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
              <h2 className="text-lg font-semibold text-slate-900">Results</h2>
              {!result.has_interactions && (
                <span className="text-xs font-medium text-emerald-800 bg-emerald-100 border border-emerald-200/80 px-2.5 py-1 rounded-full">
                  No flags from this check
                </span>
              )}
            </div>
            
            <div className="space-y-4">
              <div className="medical-card bg-blue-50 border-blue-200 p-4 rounded-xl">
                <p className="text-sm text-slate-600 mb-2 font-medium">Medications Found:</p>
                <p className="text-blue-700 font-bold text-lg">{result.medications_found}</p>
              </div>

              {result.has_interactions ? (
                <div className="space-y-4">
                  {result.interactions.major.length > 0 && (
                    <div className="medical-card bg-red-50 border-2 border-red-300 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-2xl">🚨</span>
                        <h3 className="text-red-700 font-bold text-lg">Major Interactions ({result.interactions.major.length})</h3>
                      </div>
                      <div className="bg-white/80 rounded-lg p-3 mb-3 border border-red-200">
                        <p className="text-xs text-red-600 font-semibold uppercase tracking-wide mb-2">⚠️ URGENT: Consult Your Doctor Immediately</p>
                        <p className="text-sm text-slate-600">These interactions require immediate medical attention before taking these medications together.</p>
                      </div>
                      {result.interactions.major.map((interaction: InteractionWarning, idx: number) => (
                        <div key={idx} className="mb-4 p-4 bg-white rounded-lg border-l-4 border-red-500 shadow-sm">
                          <p className="font-bold text-slate-800 mb-2">{interaction.medication1} + {interaction.medication2}</p>
                          <p className="text-sm text-slate-700 mb-2">{interaction.description}</p>
                          <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
                            <p className="text-sm text-blue-800 font-medium">💡 Recommendation: {interaction.recommendation}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {result.interactions.moderate.length > 0 && (
                    <div className="medical-card bg-yellow-50 border-2 border-yellow-300 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-2xl">⚡</span>
                        <h3 className="text-yellow-700 font-bold text-lg">Moderate Interactions ({result.interactions.moderate.length})</h3>
                      </div>
                      <p className="text-sm text-slate-600 mb-3">Monitor closely and discuss with your healthcare provider.</p>
                      {result.interactions.moderate.map((interaction: InteractionWarning, idx: number) => (
                        <div key={idx} className="mb-4 p-4 bg-white rounded-lg border-l-4 border-yellow-500 shadow-sm">
                          <p className="font-bold text-slate-800 mb-2">{interaction.medication1} + {interaction.medication2}</p>
                          <p className="text-sm text-slate-700 mb-2">{interaction.description}</p>
                          <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
                            <p className="text-sm text-blue-800 font-medium">💡 Recommendation: {interaction.recommendation}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {result.interactions.minor.length > 0 && (
                    <div className="medical-card bg-blue-50 border-2 border-blue-300 rounded-xl p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-2xl">ℹ️</span>
                        <h3 className="text-blue-700 font-bold text-lg">Minor Interactions ({result.interactions.minor.length})</h3>
                      </div>
                      <p className="text-sm text-slate-600 mb-3">Generally safe, but monitor for any unusual symptoms.</p>
                      {result.interactions.minor.map((interaction: InteractionWarning, idx: number) => (
                        <div key={idx} className="mb-3 p-4 bg-white rounded-lg border-l-4 border-blue-500 shadow-sm">
                          <p className="font-semibold text-slate-800 mb-1">{interaction.medication1} + {interaction.medication2}</p>
                          <p className="text-sm text-slate-700">{interaction.description}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="medical-card bg-emerald-50 border-2 border-emerald-300 rounded-xl p-6 text-center">
                  <div className="text-5xl mb-4">✅</div>
                  <p className="text-emerald-700 font-bold text-lg mb-2">No interactions detected!</p>
                  <p className="text-sm text-slate-600">Your medications appear safe to take together. However, always consult your doctor or pharmacist for final medical advice.</p>
                </div>
              )}

              {/* Medical Disclaimer */}
              <div className="rounded-xl border border-amber-200/90 bg-amber-50/60 p-4 mt-6">
                <div className="flex items-start gap-3">
                  <span className="text-amber-800 text-xs font-bold shrink-0 mt-0.5">Note</span>
                  <div>
                    <p className="text-sm font-semibold text-amber-800 mb-1">Important Medical Disclaimer</p>
                    <p className="text-xs text-amber-700">This tool is for informational purposes only and is not a replacement for professional medical advice. Always consult your healthcare provider before making any changes to your medications.</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleReset}
                  className="flex-1 medical-card bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 px-4 rounded-xl transition-colors border border-slate-300"
                  aria-label="Check another set of prescriptions"
                >
                  Check Another Set
                </button>
                {result && result.warnings && (
                  <button
                    onClick={() => {
                      const medNames = result.prescription_details?.map((p: PrescriptionDetail) => p.medication_name).filter(Boolean).join(', ') || '';
                      if (medNames) {
                        safeStorage.setItem('current_medications', medNames);
                      }
                      navigateToDiet();
                    }}
                    className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-4 rounded-xl transition-colors text-sm"
                    aria-label="Get diet advice based on medications"
                  >
                    Diet recommendations
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer Medical Disclaimer */}
        <MedicalDisclaimer variant="footer" className="mt-12" />
      </div>
    </div>
  );
}

