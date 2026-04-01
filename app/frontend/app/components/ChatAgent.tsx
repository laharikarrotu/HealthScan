'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useHealthScan } from '../context/HealthScanContext';
import { API_BASE_URL } from '../lib/api';
import type { PrescriptionInfo } from '../lib/types';
import MedicalDisclaimer from './MedicalDisclaimer';
import PrescriptionCard from './PrescriptionCard';
import StreamingProgress from './StreamingProgress';
import { IconScan, IconPill, IconWellness, IconUpload } from './ui/icons';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  image?: string; // Base64 preview
  timestamp: Date;
  prescriptionData?: PrescriptionInfo; // For prescription cards
}

export default function ChatAgent() {
  const router = useRouter();
  const {
    prescriptionData,
    setPrescriptionData,
    interactionResult,
    setInteractionResult,
    dietData,
    setDietData,
  } = useHealthScan();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `**Welcome to HealthScan**

Upload a prescription photo or ask a question. Use the shortcuts below to open dedicated tools when you prefer a step-by-step flow.`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [streamingProgress, setStreamingProgress] = useState<{step: string; progress: number; message: string} | null>(null);
  const [errorState, setErrorState] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]); // Track timeouts for cleanup

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach(timeout => clearTimeout(timeout));
      timeoutRefs.current = [];
    };
  }, []);

  // Auto-check interactions if multiple images uploaded (after processing)
  // This will be triggered after prescription extraction completes

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setImages(prev => [...prev, ...files]);
      const newPreviews = files.map(file => {
        const reader = new FileReader();
        return new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
      });
      Promise.all(newPreviews).then(newPrevs => {
        setImagePreviews(prev => [...prev, ...newPrevs]);
      });
    }
  };

  const checkInteractionsAuto = async () => {
    if (images.length < 2) return;

    setLoading(true);

    try {
      const formData = new FormData();
      images.forEach((file) => {
        formData.append('files', file);
      });

      const response = await fetch(`${API_BASE_URL}/check-prescription-interactions`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Failed to check interactions';
        try {
          const error = await response.json();
          errorMessage = error.detail || error.message || (error.status === 'error' ? error.message : errorMessage);
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
      
      // Use warnings or interactions (backend provides both)
      const warnings = data.warnings || data.interactions || { major: [], moderate: [], minor: [] };
      const prescriptionDetails = data.prescription_details || data.prescriptions || [];
      
      setInteractionResult({
        warnings: warnings,
        prescription_details: prescriptionDetails,
      });

      const hasInteractions = data.has_interactions;
      const majorCount = (warnings.major?.length || 0);
      const moderateCount = (warnings.moderate?.length || 0);
      const minorCount = (warnings.minor?.length || 0);

      let message = `💊 **Drug Interaction Analysis Complete**\n\n`;
      
      if (hasInteractions) {
        message += `⚠️ **Interactions Found:**\n`;
        message += `- Major: ${majorCount}\n`;
        message += `- Moderate: ${moderateCount}\n`;
        message += `- Minor: ${minorCount}\n\n`;
        message += `**Important**: Please review these interactions carefully. For major interactions, consult your doctor immediately.\n\n`;
      } else {
        message += `✅ **No Drug Interactions Detected**\n\n`;
        message += `Your medications appear to be safe to take together. However, always consult your healthcare provider for final confirmation.\n\n`;
      }
      
      message += `💡 **Next Steps:**\n`;
      message += `1️⃣ Ask me to explain specific interactions in detail\n`;
      message += `2️⃣ Get diet recommendations based on your medications\n`;
      message += `3️⃣ Ask questions about your prescriptions\n\n`;
      message += `What would you like to know?`;

      addMessage('assistant', message);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to check interactions';
      addMessage('assistant', `❌ **Error:** ${errorMsg}\n\nPlease check your connection and try again.`);
      setErrorState(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const addMessage = (role: 'user' | 'assistant' | 'system', content: string, image?: string, prescriptionData?: PrescriptionInfo) => {
    // Generate unique ID using timestamp + random to avoid duplicates
    const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newMessage: Message = {
      id: uniqueId,
      role,
      content,
      image,
      prescriptionData,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && images.length === 0) return;

    const userMessage = input.trim();
    if (userMessage) {
      addMessage('user', userMessage);
      setInput('');
    }

    if (images.length > 0) {
      // Show uploaded images in chat
      images.forEach((img, idx) => {
        if (imagePreviews[idx]) {
          addMessage('user', `📷 Uploaded image ${idx + 1}`, imagePreviews[idx]);
        }
      });
    }

    setLoading(true);

    try {
      // If images uploaded, process them
      if (images.length > 0) {
        // Process first image for prescription extraction
        const firstImage = images[0];
        addMessage('assistant', '🔍 Analyzing your image...');

        const formData = new FormData();
        formData.append('file', firstImage);
        formData.append('stream', 'true');

        const response = await fetch(`${API_BASE_URL}/extract-prescription`, {
          method: 'POST',
          body: formData,
        });

        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('text/event-stream')) {
            // Handle streaming
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            if (reader) {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    try {
                      const data = JSON.parse(line.slice(6));
                      
                      // Update streaming progress
                      if (data.step && data.progress !== undefined) {
                        setStreamingProgress({
                          step: data.step,
                          progress: data.progress,
                          message: data.message || ''
                        });
                      }
                      
                      if (data.step === 'complete' && data.prescription_info) {
                        setStreamingProgress(null); // Clear progress when complete
                        setLoading(false);
                        const info = data.prescription_info;
                        setPrescriptionData({
                          medications: [{
                            medication_name: info.medication_name || '',
                            dosage: info.dosage,
                            frequency: info.frequency,
                            quantity: info.quantity,
                            refills: info.refills,
                            instructions: info.instructions,
                          }],
                          prescriber: info.prescriber,
                          date: info.date,
                        });

                        // Check for errors in the response
                        if (info.medication_name === 'Unknown' && info.instructions?.includes('Error extracting')) {
                          const errorMsg = `**Prescription Extraction Failed**\n\n${info.instructions}\n\nPlease try:\n- Using a clearer, well-lit image\n- Ensuring the prescription text is visible\n- Uploading a different image format (JPG, PNG)\n\nIf the problem persists, please contact support or consult your healthcare provider.`;
                          addMessage('assistant', errorMsg);
                          setLoading(false);
                          return;
                        }

                        // Generate healthcare-focused explanation with prescription card
                        let explanation = `📋 **Prescription Extracted Successfully**\n\n`;
                        
                        // Auto-check interactions if multiple images
                        if (images.length > 1) {
                          explanation += `🔍 **Multiple Prescriptions Detected**\n`;
                          explanation += `I see you uploaded ${images.length} prescription images. Let me automatically check for drug interactions...\n\n`;
                          addMessage('assistant', explanation, undefined, info);
                          // Trigger auto-check after message is added
                          const timeout = setTimeout(() => checkInteractionsAuto(), 500);
                          timeoutRefs.current.push(timeout);
                        } else {
                          explanation += `💡 **Next Steps in HealthScan Workflow:**\n\n`;
                          explanation += `1️⃣ **Check Drug Interactions** - Upload additional prescriptions to check for interactions\n`;
                          explanation += `2️⃣ **Get Diet Recommendations** - I can provide personalized diet advice based on this medication\n`;
                          explanation += `3️⃣ **Ask Questions** - Ask me anything about this medication, side effects, or dietary considerations\n\n`;
                          explanation += `What would you like to do next?`;
                          addMessage('assistant', explanation, undefined, info);
                        }
                        setStreamingProgress(null);
                        setLoading(false);
                        return;
                      }
                      
                      // Handle error step
                      if (data.step === 'error') {
                        setStreamingProgress(null);
                        setErrorState(data.message || 'Extraction failed');
                        setLoading(false);
                        return;
                      }
                    } catch (e) {
                      // Ignore parse errors
                    }
                  }
                }
              }
            }
          } else {
            const result = await response.json();
            if (result.prescription_info) {
              const info = result.prescription_info;
              setPrescriptionData({
                medications: [{
                  medication_name: info.medication_name || '',
                  dosage: info.dosage,
                  frequency: info.frequency,
                  quantity: info.quantity,
                  refills: info.refills,
                  instructions: info.instructions,
                }],
                prescriber: info.prescriber,
                date: info.date,
              });

              let explanation = `📋 **Prescription Extracted Successfully**\n\n`;
              
              // Auto-check interactions if multiple images
              if (images.length > 1) {
                explanation += `🔍 **Multiple Prescriptions Detected**\n`;
                explanation += `I see you uploaded ${images.length} prescription images. Let me automatically check for drug interactions...\n\n`;
                addMessage('assistant', explanation, undefined, info);
                // Trigger auto-check after message is added
                setTimeout(() => checkInteractionsAuto(), 500);
              } else {
                explanation += `💡 **Next Steps in HealthScan Workflow:**\n\n`;
                explanation += `1️⃣ **Check Drug Interactions** - Upload additional prescriptions\n`;
                explanation += `2️⃣ **Get Diet Recommendations** - Personalized diet advice\n`;
                explanation += `3️⃣ **Ask Questions** - About this medication or health concerns\n\n`;
                explanation += `What would you like to do next?`;
                addMessage('assistant', explanation, undefined, info);
              }
            }
          }
        }
      }

      // Handle text questions
      if (userMessage) {
        // Send to conversational endpoint
        let chatResponse: Response;
        try {
          chatResponse = await fetch(`${API_BASE_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: userMessage,
              context: {
                prescription_data: prescriptionData,
                interaction_result: interactionResult,
                diet_data: dietData,
              },
            }),
          });
        } catch (fetchError) {
          // Network error - backend not reachable
          const isLocalhost = API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1');
          if (isLocalhost) {
            throw new Error(`Cannot connect to backend server at ${API_BASE_URL}. Make sure the backend is running: cd backend && uvicorn api.main:app --reload`);
          } else {
            throw new Error(`Cannot connect to backend server at ${API_BASE_URL}. The server may be down or unreachable.`);
          }
        }

        if (!chatResponse.ok) {
          let errorMessage = 'Failed to get a response from the AI';
          try {
            const error = await chatResponse.json();
            errorMessage = error.detail || error.message || errorMessage;
          } catch (e) {
            errorMessage = chatResponse.statusText || errorMessage;
          }
          throw new Error(errorMessage);
        }

        const data = await chatResponse.json();
        if (data.status === 'error') {
          throw new Error(data.message || 'An error occurred');
        }
        
        const responseText = data.response || data.message || 'I understand your question. Let me help you with that.';
        addMessage('assistant', responseText);
      }

      // Clear images after processing
      setImages([]);
      setImagePreviews([]);
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      setErrorState(errorMessage);
      setStreamingProgress(null);
      
      // Also add error message to chat for context
      let userFriendlyMessage = '❌ **I encountered an error processing your request.**\n\n';
      
      if (errorMessage.includes('Cannot connect to backend') || errorMessage.includes('backend server')) {
        userFriendlyMessage += `**Connection Error:** ${errorMessage}\n\n`;
        userFriendlyMessage += '**To fix this:**\n';
        userFriendlyMessage += '1. Make sure the backend server is running\n';
        userFriendlyMessage += '2. Check that the API URL is correct\n';
        userFriendlyMessage += '3. Verify your network connection';
      } else if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network')) {
        userFriendlyMessage += '**Network Error:** Please check your internet connection and try again.\n\n';
        userFriendlyMessage += 'If the problem persists, this may be a temporary server issue. Please try again in a few moments.';
      } else if (errorMessage.includes('timeout')) {
        userFriendlyMessage += '**Request Timeout:** The request took too long to process.\n\n';
        userFriendlyMessage += 'Please try again with a smaller image or check your connection speed.';
      } else {
        userFriendlyMessage += '**What to do:**\n';
        userFriendlyMessage += '1. Try uploading the image again\n';
        userFriendlyMessage += '2. Ensure the image is clear and readable\n';
        userFriendlyMessage += '3. If the problem continues, contact support\n\n';
        userFriendlyMessage += '**For urgent medical questions, please consult your healthcare provider directly.**';
      }
      
      addMessage('assistant', userFriendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full text-slate-900" role="main" aria-label="HealthScan Chat Assistant">
      {/* Main Content Container - Properly Contained */}
      <div className="hs-page flex-1 min-h-0">
        <div className="hs-inner">
          <header className="mb-6 sm:mb-8 pb-5 border-b border-slate-200">
            <p className="hs-eyebrow">Home</p>
            <h1 className="hs-title">Assistant</h1>
            <p className="hs-lede">
              Upload prescription photos or type a question. Layout matches the rest of HealthScan on phones, tablets, and desktops.
            </p>
          </header>
          {/* Quick Actions Grid - Contained in Card */}
          {messages.length === 1 && messages[0].role === 'assistant' && !loading && (
            <div className="hs-card panel-static p-5 mb-6">
              <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide mb-3">Shortcuts</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-left hover:bg-slate-50 hover:border-slate-300 transition-colors"
                >
                  <IconUpload className="w-5 h-5 text-slate-600 mb-2" />
                  <h3 className="text-sm font-semibold text-slate-900">Upload here</h3>
                  <p className="text-xs text-slate-600 mt-0.5 leading-snug">Add images to this chat</p>
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/scan')}
                  className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-left hover:bg-slate-50 hover:border-slate-300 transition-colors"
                >
                  <IconScan className="w-5 h-5 text-slate-600 mb-2" />
                  <h3 className="text-sm font-semibold text-slate-900">Scan workflow</h3>
                  <p className="text-xs text-slate-600 mt-0.5 leading-snug">Guided extraction &amp; forms</p>
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/interactions')}
                  className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-left hover:bg-slate-50 hover:border-slate-300 transition-colors"
                >
                  <IconPill className="w-5 h-5 text-slate-600 mb-2" />
                  <h3 className="text-sm font-semibold text-slate-900">Interactions</h3>
                  <p className="text-xs text-slate-600 mt-0.5 leading-snug">Multiple prescriptions</p>
                </button>
                <button
                  type="button"
                  onClick={() => router.push('/diet')}
                  className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 text-left hover:bg-slate-50 hover:border-slate-300 transition-colors"
                >
                  <IconWellness className="w-5 h-5 text-slate-600 mb-2" />
                  <h3 className="text-sm font-semibold text-slate-900">Diet</h3>
                  <p className="text-xs text-slate-600 mt-0.5 leading-snug">Condition-aware tips</p>
                </button>
              </div>
            </div>
          )}

          {/* Chat Messages - Contained */}
          <div className="space-y-4" role="log" aria-live="polite" aria-label="Chat messages">
            {messages.map((msg, idx) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[80%] rounded-xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-slate-800 text-white'
                      : 'bg-white border border-slate-200/90 text-slate-800 shadow-sm'
                  }`}
                >
                  {msg.image && (
                    <div className="mb-3 rounded-lg overflow-hidden">
                      <img src={msg.image} alt="Uploaded prescription" className="max-w-xs w-full h-auto" />
                    </div>
                  )}
                  {msg.prescriptionData && (
                    <div className="mb-3">
                      <PrescriptionCard prescription={msg.prescriptionData} />
                    </div>
                  )}
                  <div className="whitespace-pre-wrap leading-relaxed text-sm [&_strong]:font-semibold">
                    {msg.content}
                  </div>
                  <div className={`text-[11px] mt-2 tabular-nums ${msg.role === 'user' ? 'text-slate-300' : 'text-slate-600'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Status Messages - Contained, Not Overlaying */}
          {streamingProgress && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-100/80 p-4">
              <StreamingProgress 
                step={streamingProgress.step}
                progress={streamingProgress.progress}
                message={streamingProgress.message}
              />
            </div>
          )}
          
          {loading && !streamingProgress && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-100/80 p-4 flex items-center gap-3">
              <div className="spinner w-5 h-5 border-2 border-slate-700 border-t-transparent"></div>
              <span className="text-sm text-slate-900 font-medium">Analyzing your prescription…</span>
            </div>
          )}
          
          {errorState && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50/90 p-4">
              <div className="flex items-start gap-3">
                <span className="text-red-900 text-sm font-bold shrink-0" aria-hidden>!</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-red-950 mb-1">Error</p>
                  <p className="text-sm text-red-900 mb-3">{errorState}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setErrorState(null);
                      setStreamingProgress(null);
                    }}
                    className="px-4 py-2 bg-red-800 hover:bg-red-900 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Image Preview - Contained Section */}
      {images.length > 0 && (
        <div className="border-t border-slate-200/90 bg-white px-4 sm:px-6 py-3">
          <div className="mx-auto w-full max-w-3xl">
            <p className="text-sm font-medium text-slate-800 mb-3">Prescription images</p>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {imagePreviews.map((preview, idx) => (
                <div key={idx} className="relative flex-shrink-0">
                  <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden border-2 border-slate-200">
                    <img src={preview} alt={`Prescription ${idx + 1}`} className="w-full h-full object-cover" />
                  </div>
                  <button
                    onClick={() => {
                      setImages(prev => prev.filter((_, i) => i !== idx));
                      setImagePreviews(prev => prev.filter((_, i) => i !== idx));
                    }}
                    className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 rounded-full w-6 h-6 flex items-center justify-center text-white text-xs font-bold shadow-md transition-colors"
                    aria-label="Remove image"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input Area - Contained Section */}
      <div className="border-t border-slate-200/90 bg-white px-4 sm:px-6 py-3 sm:py-4">
        <div className="mx-auto w-full max-w-3xl">
          <form onSubmit={handleSend} className="flex gap-2 sm:gap-3 items-stretch">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              id="file-input"
            />
            <label
              htmlFor="file-input"
              className="shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl cursor-pointer inline-flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors touch-manipulation"
              title="Upload prescription images"
            >
              <IconUpload className="w-5 h-5" />
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about medications, interactions, diet..."
              className="flex-1 rounded-xl px-3.5 py-2.5 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400/30 focus:border-slate-400 border border-slate-200 bg-white min-w-0 text-sm"
              disabled={loading}
              aria-label="Type your health question or message"
            />
            <button
              type="submit"
              disabled={loading || (!input.trim() && images.length === 0)}
              className="shrink-0 px-4 sm:px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium text-sm transition-colors touch-manipulation"
            >
              {loading ? (
                <>
                  <div className="spinner w-4 h-4 border-2 border-white border-t-transparent inline-block mr-2"></div>
                  <span className="hidden sm:inline">Sending...</span>
                </>
              ) : (
                'Send'
              )}
            </button>
          </form>
          
          {/* Medical Disclaimer */}
          <div className="mt-3">
            <MedicalDisclaimer variant="compact" />
          </div>
        </div>
      </div>
    </div>
  );
}

