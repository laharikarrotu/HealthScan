'use client';

import { useState, useEffect } from 'react';
import type { DietRecommendation, FoodCompatibility, MealPlan, MealPlanDay } from '../lib/types';
import ProgressTracker from './ProgressTracker';
import { useHealthScan } from '../context/HealthScanContext';
import { API_BASE_URL } from '../lib/api';
import { safeStorage } from '../lib/storage';
import MedicalDisclaimer from './MedicalDisclaimer';
import PageShell from './PageShell';

export default function DietPortal() {
  const {
    prescriptionData,
    dietData,
    setDietData,
    setCurrentStep,
    errors,
    setError,
    clearErrors,
    validateStep,
  } = useHealthScan();
  
  const [condition, setCondition] = useState(dietData?.condition || '');
  const [medications, setMedications] = useState(dietData?.medications || '');
  const [dietaryRestrictions, setDietaryRestrictions] = useState(dietData?.dietary_restrictions || '');
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<DietRecommendation | null>(null);
  const [foodCheckResult, setFoodCheckResult] = useState<FoodCompatibility | null>(null);
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [mealPlanDays, setMealPlanDays] = useState(7);
  const [foodItem, setFoodItem] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'recommendations' | 'food-check' | 'meal-plan' | 'chat'>('recommendations');
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'assistant', content: string}>>([]);
  const [chatLoading, setChatLoading] = useState(false);
  
  // Set current step on mount
  useEffect(() => {
    setCurrentStep('diet');
  }, [setCurrentStep]);
  
  // Auto-populate from context
  useEffect(() => {
    if (prescriptionData && prescriptionData.medications.length > 0 && !medications) {
      const medNames = prescriptionData.medications.map(m => m.medication_name).join(', ');
      setMedications(medNames);
      setDietData({
        condition: condition || '',
        medications: medNames,
        dietary_restrictions: dietaryRestrictions || '',
      });
    }
  }, [prescriptionData, medications, condition, dietaryRestrictions, setDietData]);
  
  // Update context when form changes
  useEffect(() => {
    setDietData({
      condition,
      medications,
      dietary_restrictions: dietaryRestrictions,
    });
  }, [condition, medications, dietaryRestrictions, setDietData]);

  const handleGetRecommendations = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate step
    const validation = validateStep('diet');
    if (!validation.valid) {
      setLocalError(validation.message || 'Please enter a medical condition');
      setError('diet', validation.message || 'Please enter a medical condition');
      return;
    }

    setLoading(true);
    setLocalError(null);
    clearErrors();

    try {
      const formData = new FormData();
      formData.append('condition', condition);
      if (medications.trim()) formData.append('medications', medications);
      if (dietaryRestrictions.trim()) formData.append('dietary_restrictions', dietaryRestrictions);

      const response = await fetch(`${API_BASE_URL}/get-diet-recommendations`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Failed to get recommendations';
        try {
        const error = await response.json();
          errorMessage = error.detail || error.message || errorMessage;
        } catch (e) {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.status === 'error') {
        throw new Error(data.message || 'An error occurred while getting recommendations');
      }
      
      if (!data.recommendations) {
        throw new Error('Invalid response format from server');
      }
      
      setRecommendations(data.recommendations);
      clearErrors();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Something went wrong';
      setLocalError(errorMsg);
      setError('diet', errorMsg);
      
      // Error recovery
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
        setError('diet', 'Network error. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCheckFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!foodItem.trim()) {
      setLocalError('Please enter a food item');
      setError('diet', 'Please enter a food item');
      return;
    }

    setLoading(true);
    setLocalError(null);
    clearErrors();

    try {
      const formData = new FormData();
      formData.append('food_item', foodItem);
      if (condition.trim()) formData.append('condition', condition);
      if (medications.trim()) formData.append('medications', medications);

      const response = await fetch(`${API_BASE_URL}/check-food-compatibility`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Failed to check food';
        try {
        const error = await response.json();
          errorMessage = error.detail || error.message || errorMessage;
        } catch (e) {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.status === 'error') {
        throw new Error(data.message || 'An error occurred while checking food compatibility');
      }
      
      if (!data.compatibility) {
        throw new Error('Invalid response format from server');
      }
      
      setFoodCheckResult(data.compatibility);
      clearErrors();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Something went wrong';
      setLocalError(errorMsg);
      setError('diet', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMealPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!condition.trim()) {
      setLocalError('Please enter a medical condition');
      setError('diet', 'Please enter a medical condition');
      return;
    }

    setLoading(true);
    setLocalError(null);
    clearErrors();

    try {
      const formData = new FormData();
      formData.append('condition', condition);
      formData.append('days', mealPlanDays.toString());
      if (dietaryRestrictions.trim()) formData.append('dietary_restrictions', dietaryRestrictions);

      const response = await fetch(`${API_BASE_URL}/generate-meal-plan`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = 'Failed to generate meal plan';
        try {
        const error = await response.json();
          errorMessage = error.detail || error.message || errorMessage;
        } catch (e) {
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      if (data.status === 'error') {
        throw new Error(data.message || 'An error occurred while generating meal plan');
      }
      
      if (!data.meal_plan) {
        throw new Error('Invalid response format from server');
      }
      
      setMealPlan(data.meal_plan);
      clearErrors();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Something went wrong';
      setLocalError(errorMsg);
      setError('diet', errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <div className="hs-page flex flex-1 min-h-0 flex-col">
      <div className="hs-inner">
        <header className="mb-8">
          <p className="hs-eyebrow">Diet</p>
          <h1 className="hs-title">Nutrition &amp; meals</h1>
          <p className="hs-lede">
            Condition-aware ideas only—not a meal plan from a doctor or dietitian. Confirm changes with your clinician.
          </p>
        </header>

        <div className="hs-tabs mb-6" role="tablist" aria-label="Diet sections">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'recommendations'}
            onClick={() => setActiveTab('recommendations')}
            className={`hs-tab ${activeTab === 'recommendations' ? 'hs-tab-active' : 'hs-tab-idle'}`}
          >
            Recommendations
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'food-check'}
            onClick={() => setActiveTab('food-check')}
            className={`hs-tab ${activeTab === 'food-check' ? 'hs-tab-active' : 'hs-tab-idle'}`}
          >
            Food check
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'meal-plan'}
            onClick={() => setActiveTab('meal-plan')}
            className={`hs-tab ${activeTab === 'meal-plan' ? 'hs-tab-active' : 'hs-tab-idle'}`}
          >
            Meal plan
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'chat'}
            onClick={() => setActiveTab('chat')}
            className={`hs-tab ${activeTab === 'chat' ? 'hs-tab-active' : 'hs-tab-idle'}`}
          >
            Ask
          </button>
        </div>

        {/* Recommendations Tab */}
        {activeTab === 'recommendations' && (
          <div className="space-y-6">
            <form onSubmit={handleGetRecommendations} className="hs-card panel-static p-4 sm:p-5" aria-label="Diet recommendations form">
              <h2 className="text-lg sm:text-xl font-semibold mb-4 text-slate-900">Get diet recommendations</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="hs-label">Medical Condition/Diagnosis *</label>
                  <input
                    type="text"
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    placeholder="e.g., Type 2 Diabetes, Hypertension, Kidney Disease"
                    className="hs-field"
                    required
                    aria-label="Enter medical condition or diagnosis"
                  />
                </div>
                
                <div>
                  <label className="hs-label">Current Medications (optional, comma-separated)</label>
                  <input
                    type="text"
                    value={medications}
                    onChange={(e) => setMedications(e.target.value)}
                    placeholder="e.g., Metformin, Warfarin, Lisinopril"
                    className="hs-field"
                    aria-label="Enter current medications"
                  />
                </div>
                
                <div>
                  <label className="hs-label">Dietary Restrictions (optional, comma-separated)</label>
                  <input
                    type="text"
                    value={dietaryRestrictions}
                    onChange={(e) => setDietaryRestrictions(e.target.value)}
                    placeholder="e.g., Vegetarian, Gluten-free, Dairy-free"
                    className="hs-field"
                    aria-label="Enter dietary restrictions"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="hs-btn"
                  aria-label={loading ? "Getting recommendations" : "Get diet recommendations"}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="spinner w-4 h-4 border-2 border-white border-t-transparent"></div>
                      Getting Recommendations...
                    </span>
                  ) : (
                    'Get Recommendations'
                  )}
                </button>
              </div>
            </form>

            {recommendations && (
              <div className="hs-card panel-static p-4 sm:p-5 space-y-4 animate-in fade-in">
                <h2 className="text-lg sm:text-xl font-semibold text-slate-900 mb-2">Suggestions for {recommendations.condition}</h2>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 sm:p-5">
                    <h3 className="font-semibold text-sky-950 text-base mb-3">Foods to emphasize</h3>
                    <ul className="list-disc list-inside space-y-2 text-sm text-slate-800">
                      {recommendations.foods_to_eat.map((food: string, idx: number) => (
                        <li key={idx} className="pl-1">{food}</li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="rounded-xl border border-red-200 bg-red-50/80 p-4 sm:p-5">
                    <h3 className="font-semibold text-red-950 text-base mb-3">Foods to limit or avoid</h3>
                    <ul className="list-disc list-inside space-y-2 text-sm text-slate-800">
                      {recommendations.foods_to_avoid.map((food: string, idx: number) => (
                        <li key={idx} className="pl-1">{food}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                  <h3 className="font-semibold text-slate-900 text-base mb-2">Nutritional focus</h3>
                  <p className="text-sm text-slate-800 leading-relaxed">{recommendations.nutritional_focus}</p>
                </div>
                
                {recommendations.warnings && recommendations.warnings.length > 0 && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 sm:p-5">
                    <h3 className="font-semibold text-amber-950 text-base mb-3">Warnings</h3>
                    <ul className="list-disc list-inside space-y-2 text-sm text-slate-900">
                      {recommendations.warnings.map((warning: string, idx: number) => (
                        <li key={idx} className="pl-1">{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Food Check Tab */}
        {activeTab === 'food-check' && (
          <div className="space-y-6">
            <form onSubmit={handleCheckFood} className="hs-card panel-static p-4 sm:p-5" aria-label="Food compatibility check form">
              <h2 className="text-xl font-semibold mb-4 text-slate-900">Check food compatibility</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="hs-label">Food Item *</label>
                  <input
                    type="text"
                    value={foodItem}
                    onChange={(e) => setFoodItem(e.target.value)}
                    placeholder="e.g., Grapefruit, Spinach, Aged Cheese"
                    className="hs-field"
                    required
                    aria-label="Enter food item to check"
                  />
                </div>
                
                <div>
                  <label className="hs-label">Medical Condition (optional)</label>
                  <input
                    type="text"
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    placeholder="e.g., Diabetes, Hypertension"
                    className="hs-field"
                    aria-label="Enter medical condition"
                  />
                </div>
                
                <div>
                  <label className="hs-label">Medications (optional, comma-separated)</label>
                  <input
                    type="text"
                    value={medications}
                    onChange={(e) => setMedications(e.target.value)}
                    placeholder="e.g., Warfarin, Metformin"
                    className="hs-field"
                    aria-label="Enter medications"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="hs-btn"
                  aria-label={loading ? "Checking food compatibility" : "Check food compatibility"}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="spinner w-4 h-4 border-2 border-white border-t-transparent"></div>
                      Checking...
                    </span>
                  ) : (
                    'Check Food'
                  )}
                </button>
              </div>
            </form>

            {foodCheckResult && (
              <div className="hs-card panel-static p-4 sm:p-5 animate-in fade-in">
                <h2 className="text-lg sm:text-xl font-semibold mb-4 text-slate-900">Check: {foodCheckResult.food}</h2>
                
                {foodCheckResult.safe ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-4 mb-4">
                    <p className="text-emerald-950 font-semibold text-base">Generally safe (informational only)</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-red-200 bg-red-50/90 p-4 mb-4">
                    <p className="text-red-950 font-semibold text-base">Potential issues — confirm with your clinician</p>
                  </div>
                )}
                
                {foodCheckResult.warnings.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {foodCheckResult.warnings.map((warning: string, idx: number) => (
                      <div key={idx} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                        <p className="text-sm text-slate-900">{warning}</p>
                      </div>
                    ))}
                  </div>
                )}
                
                {foodCheckResult.recommendations.length > 0 && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-semibold text-slate-900 mb-2">Notes</h3>
                    {foodCheckResult.recommendations.map((rec: string, idx: number) => (
                      <p key={idx} className="text-sm text-slate-800 mb-2">{rec}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Meal Plan Tab */}
        {activeTab === 'meal-plan' && (
          <div className="space-y-6">
            <form onSubmit={handleGenerateMealPlan} className="hs-card panel-static p-4 sm:p-5">
              <h2 className="text-lg sm:text-xl font-semibold mb-4 text-slate-900">Generate meal plan</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="hs-label">Medical Condition *</label>
                  <input
                    type="text"
                    value={condition}
                    onChange={(e) => setCondition(e.target.value)}
                    placeholder="e.g., Type 2 Diabetes, Hypertension"
                    className="hs-field"
                    required
                  />
                </div>
                
                <div>
                  <label className="hs-label">Number of Days</label>
                  <input
                    type="number"
                    value={mealPlanDays}
                    onChange={(e) => setMealPlanDays(parseInt(e.target.value))}
                    min="1"
                    max="14"
                    className="hs-field"
                  />
                </div>
                
                <div>
                  <label className="hs-label">Dietary Restrictions (optional)</label>
                  <input
                    type="text"
                    value={dietaryRestrictions}
                    onChange={(e) => setDietaryRestrictions(e.target.value)}
                    placeholder="e.g., Vegetarian, Gluten-free"
                    className="hs-field"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={loading}
                  className="hs-btn"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="spinner w-4 h-4 border-2 border-white border-t-transparent"></div>
                      Generating Meal Plan...
                    </span>
                  ) : (
                    'Generate Meal Plan'
                  )}
                </button>
              </div>
            </form>

            {mealPlan && !mealPlan.error && (
              <div className="hs-card panel-static p-4 sm:p-5 space-y-4">
                <h2 className="text-lg sm:text-xl font-semibold text-slate-900">{mealPlanDays}-day outline for {condition}</h2>
                
                {mealPlan.meal_plan && mealPlan.meal_plan.map((day: MealPlanDay, idx: number) => (
                  <div key={idx} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <h3 className="font-semibold mb-2 text-slate-900">Day {day.day}</h3>
                    <div className="space-y-2 text-sm text-slate-800">
                      <p><strong className="text-slate-900">Breakfast:</strong> {day.breakfast?.meal}</p>
                      <p><strong className="text-slate-900">Lunch:</strong> {day.lunch?.meal}</p>
                      <p><strong className="text-slate-900">Dinner:</strong> {day.dinner?.meal}</p>
                      <p><strong className="text-slate-900">Snacks:</strong> {day.snacks?.join(', ')}</p>
                    </div>
                  </div>
                ))}
                
                {mealPlan.shopping_list && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <h3 className="font-semibold text-slate-900 mb-2">Shopping list</h3>
                    <ul className="list-disc list-inside space-y-1 text-sm text-slate-800">
                      {mealPlan.shopping_list.map((item: string, idx: number) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="space-y-6">
            <div className="hs-card panel-static p-4 sm:p-5">
              <h2 className="text-lg sm:text-xl font-semibold mb-2 text-slate-900">Diet questions</h2>
              <p className="text-slate-700 mb-4 text-sm leading-relaxed">
                General answers only—not personalized medical nutrition therapy.
                {condition && ` Condition noted: ${condition}.`}
                {medications && ` Medications noted: ${medications}.`}
              </p>

              {/* Chat Messages */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 mb-4 min-h-[16rem] max-h-80 overflow-y-auto space-y-3">
                {chatMessages.length === 0 && (
                  <div className="text-slate-700 text-sm text-center py-8 px-2">
                    Ask me anything! For example:
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>"What foods should I avoid with my medications?"</li>
                      <li>"Can I eat grapefruit with my current medications?"</li>
                      <li>"What's a good breakfast for my condition?"</li>
                    </ul>
                  </div>
                )}
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2.5 ${
                        msg.role === 'user'
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-900 border border-slate-200 shadow-sm'
                      }`}
                    >
                      <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-slate-200 rounded-xl px-3 py-2">
                      <div className="flex gap-1 text-slate-600">
                        <span className="animate-bounce">●</span>
                        <span className="animate-bounce delay-75">●</span>
                        <span className="animate-bounce delay-150">●</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!chatInput.trim() || chatLoading) return;

                  const userMessage = chatInput.trim();
                  setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
                  setChatInput('');
                  setChatLoading(true);

                  try {
                    const response = await fetch(`${API_BASE_URL}/chat`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        message: userMessage,
                        context: {
                          prescription_data: prescriptionData,
                          interaction_result: null,
                          diet_data: {
                            condition,
                            medications,
                            dietary_restrictions: dietaryRestrictions,
                          },
                        },
                      }),
                    });

                    if (!response.ok) {
                      let errorMessage = 'Failed to get a response from the AI';
                      try {
                        const error = await response.json();
                        errorMessage = error.detail || error.message || errorMessage;
                      } catch (e) {
                        errorMessage = response.statusText || errorMessage;
                      }
                      throw new Error(errorMessage);
                    }

                      const data = await response.json();
                    if (data.status === 'error') {
                      throw new Error(data.message || 'An error occurred');
                    }
                    
                    const responseText = data.response || data.message || 'I understand your question. Let me help you with that.';
                      setChatMessages(prev => [
                        ...prev,
                      { role: 'assistant', content: responseText }
                    ]);
                  } catch (err: unknown) {
                    const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred';
                    let errorMessage = `Sorry, I encountered an error: ${errorMsg}.`;
                    if (errorMsg.includes('Failed to fetch') || errorMsg.includes('Network')) {
                      errorMessage = 'Network error. Please check your connection and try again.';
                    }
                    setChatMessages(prev => [
                      ...prev,
                      { role: 'assistant', content: errorMessage }
                    ]);
                  } finally {
                    setChatLoading(false);
                  }
                }}
                className="flex gap-2 items-stretch"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask me anything about your diet..."
                  className="hs-field flex-1 min-w-0"
                  disabled={chatLoading}
                />
                <button
                  type="submit"
                  disabled={chatLoading || !chatInput.trim()}
                  className="shrink-0 px-5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium text-sm min-h-[44px] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        )}

        {(localError || errors.diet) && (
          <div className="rounded-xl border border-red-200 bg-red-50/90 p-4 mt-6">
            <div className="flex items-start gap-3">
              <span className="text-red-800 text-sm font-bold shrink-0" aria-hidden>!</span>
              <div className="flex-1 min-w-0">
                <p className="text-red-950 font-semibold mb-1 text-sm">Error</p>
                <p className="text-red-900 text-sm">{localError || errors.diet}</p>
            {(localError || errors.diet)?.includes('Network') && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  if (activeTab === 'recommendations') handleGetRecommendations(e);
                }}
                    className="mt-3 px-4 py-2 bg-red-800 hover:bg-red-900 text-white rounded-lg text-sm font-medium transition-colors"
                    aria-label="Retry request"
              >
                Retry
              </button>
            )}
              </div>
            </div>
          </div>
        )}

        <MedicalDisclaimer variant="footer" className="mt-10" />
      </div>
      </div>
    </PageShell>
  );
}
