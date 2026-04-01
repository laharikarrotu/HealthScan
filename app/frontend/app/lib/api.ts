/**
 * API client for SCANX backend
 */

import type { AnalyzeResponse, ExtractPrescriptionResponse, StreamingProgress, StreamingCallback } from './types';

// Centralized API configuration
// In production, NEXT_PUBLIC_API_URL must be set in Vercel environment variables
const getApiBaseUrl = (): string => {
  const url = process.env.NEXT_PUBLIC_API_URL;
  // Don't throw during build - only warn. Error will be caught at runtime.
  if (!url && typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
    console.warn('NEXT_PUBLIC_API_URL is not set in production! Please set it in Vercel environment variables.');
  }
  const apiUrl = url || 'http://localhost:8000';
  
  // Log the API URL in browser console for debugging (only in browser, not during SSR)
  if (typeof window !== 'undefined') {
    console.log('[HealthScan] API Base URL:', apiUrl);
  }
  
  return apiUrl;
};

export const API_BASE_URL = getApiBaseUrl();

const CLIENT_SESSION_KEY = 'healthscan_client_session_id';
const SESSION_HEADER = 'X-Client-Session-Id';

/** Stable id for patient-safety APIs (allergy profile); not authentication by itself. */
export function getOrCreateClientSessionId(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    let id = window.localStorage.getItem(CLIENT_SESSION_KEY);
    if (!id || id.length < 8) {
      id =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `hs_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
      window.localStorage.setItem(CLIENT_SESSION_KEY, id);
    }
    return id;
  } catch {
    return `hs_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  }
}

export async function fetchAllergyProfile(): Promise<{ allergens: string[]; updated_at: string | null }> {
  const sessionId = getOrCreateClientSessionId();
  if (!sessionId) {
    return { allergens: [], updated_at: null };
  }
  const response = await fetch(`${API_BASE_URL}/patient-safety/allergy-profile`, {
    method: 'GET',
    headers: { [SESSION_HEADER]: sessionId },
  });
  if (!response.ok) {
    return { allergens: [], updated_at: null };
  }
  return response.json();
}

export async function saveAllergyProfile(allergens: string[]): Promise<boolean> {
  const sessionId = getOrCreateClientSessionId();
  if (!sessionId) {
    return false;
  }
  const response = await fetch(`${API_BASE_URL}/patient-safety/allergy-profile`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      [SESSION_HEADER]: sessionId,
    },
    body: JSON.stringify({ allergens }),
  });
  return response.ok;
}

// Re-export types for convenience
export type { AnalyzeResponse, ExtractPrescriptionResponse, StreamingProgress, StreamingCallback };

export async function analyzeAndExecute(
  imageFile: File,
  intent: string,
  context?: Record<string, unknown>,
  verifyOnly: boolean = false  // HITL: Request verification step
): Promise<AnalyzeResponse> {
  const formData = new FormData();
  formData.append('file', imageFile);
  formData.append('intent', intent);
  formData.append('verify_only', verifyOnly.toString());
  if (context) {
    formData.append('context', JSON.stringify(context));
  }

  const response = await fetch(`${API_BASE_URL}/analyze-and-execute`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorMessage = 'Failed to analyze and execute';
    try {
      const error = await response.json();
      errorMessage = error.detail || error.message || errorMessage;
    } catch (e) {
      // If response is not JSON, use status text
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const result = await response.json();
  
  // Check if result has error status
  if (result.status === 'error') {
    throw new Error(result.message || 'An error occurred while processing');
  }
  
  return result;
}

export async function executeVerifiedPlan(
  verifiedPlan: Record<string, unknown>,
  verifiedData: Record<string, unknown>,
  uiSchema: Record<string, unknown>,
  startUrl: string
): Promise<AnalyzeResponse> {
  const formData = new FormData();
  formData.append('verified_plan', JSON.stringify(verifiedPlan));
  formData.append('verified_data', JSON.stringify(verifiedData));
  formData.append('ui_schema', JSON.stringify(uiSchema));
  formData.append('start_url', startUrl);

  const response = await fetch(`${API_BASE_URL}/execute-verified-plan`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorMessage = 'Failed to execute verified plan';
    try {
      const error = await response.json();
      errorMessage = error.detail || error.message || errorMessage;
    } catch (e) {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const result = await response.json();
  
  if (result.status === 'error') {
    throw new Error(result.message || 'An error occurred during execution');
  }
  
  return result;
}

// Fast direct prescription extraction (like ChatGPT)
// Types moved to types.ts - re-exported above

export async function extractPrescription(
  imageFile: File,
  onProgress?: StreamingCallback
): Promise<ExtractPrescriptionResponse> {
  const formData = new FormData();
  formData.append('file', imageFile);
  formData.append('stream', 'true'); // Enable streaming

  const response = await fetch(`${API_BASE_URL}/extract-prescription`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    let errorMessage = 'Failed to extract prescription';
    try {
      const error = await response.json();
      errorMessage = error.detail || error.message || errorMessage;
    } catch (e) {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  // Check if response is streaming (text/event-stream)
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('text/event-stream') && onProgress) {
    return new Promise<ExtractPrescriptionResponse>((resolve, reject) => {
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) {
        reject(new Error('Streaming not supported'));
        return;
      }

      const processStream = async () => {
        try {
          let hasCompleted = false;
          const timeout = setTimeout(() => {
            if (!hasCompleted) {
              reader.cancel();
              reject(new Error('Request timeout. The extraction is taking too long. Please try again.'));
            }
          }, 120000); // 2 minute timeout
          
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              clearTimeout(timeout);
              if (!hasCompleted) {
                // Stream ended without completion - might be a network issue
                reject(new Error('Connection closed unexpectedly. Please check your network and try again.'));
              }
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            for (const line of lines) {
              if (line.trim() === '') continue; // Skip empty lines
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  
                  // Call progress callback
                  onProgress({
                    step: data.step,
                    progress: data.progress,
                    message: data.message,
                    prescription_info: data.prescription_info || data.data
                  });

                  // If complete, resolve with final data
                  if (data.step === 'complete' && (data.prescription_info || data.data)) {
                    hasCompleted = true;
                    clearTimeout(timeout);
                    const prescriptionInfo = data.prescription_info || data.data;
                    resolve({
                      status: 'success',
                      prescription_info: prescriptionInfo,
                      message: data.message || 'Prescription extracted successfully'
                    });
                    return;
                  }

                  // If error, reject
                  if (data.step === 'error') {
                    hasCompleted = true;
                    clearTimeout(timeout);
                    reject(new Error(data.message || 'Extraction failed'));
                    return;
                  }
                } catch (e) {
                  // Ignore JSON parse errors for malformed lines
                  // Malformed SSE lines are common and non-critical - fail silently
                  // In production, these are expected edge cases in SSE parsing
                }
              }
            }
          }
        } catch (error) {
          reject(error);
        }
      };

      processStream();
    });
  }

  // Non-streaming fallback
  const result = await response.json();
  if (result.status === 'error') {
    throw new Error(result.message || 'An error occurred during prescription extraction');
  }
  return result;
}

