import { useState, useEffect } from 'react';

export interface WizardFormState {
  // Step 1: Campaign & Script Context
  topic: string;
  brandName: string;
  description: string;
  targetAudience: string;
  callToAction: string;
  duration: number; // 15, 30, 60, 90
  aspectRatio: '9:16' | '16:9' | '1:1';
  language: string;
  voiceName: string;

  // Step 2: Media Assets & Studio Project
  ownerName: string;
  ownerId: string | null;
  projectId: string | null;
  uploadedFiles: File[];
  ingestedFiles: string[];

  // Step 3: Generation & Task
  taskId: string | null;
  taskProgress: number;
  taskState: number;
  generatedVideoUrl: string | null;
  generationError: string | null;

  // Step 4: Publish & Platform
  selectedPlatforms: string[];
  publishSuccess: boolean;
  publishResults: Record<string, any>;
}

const STORAGE_KEY = 'chronus_wizard_draft';

const initialDraftState: WizardFormState = {
  topic: '',
  brandName: '',
  description: '',
  targetAudience: '',
  callToAction: '',
  duration: 30,
  aspectRatio: '9:16',
  language: 'en',
  voiceName: 'en-US-AriaNeural-Female',
  ownerName: 'Chronus Creator',
  ownerId: null,
  projectId: null,
  uploadedFiles: [],
  ingestedFiles: [],
  taskId: null,
  taskProgress: 0,
  taskState: 0,
  generatedVideoUrl: null,
  generationError: null,
  selectedPlatforms: ['tiktok', 'instagram'],
  publishSuccess: false,
  publishResults: {},
};

export const useProjectWizard = () => {
  const [state, setState] = useState<WizardFormState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...initialDraftState,
          ...parsed,
          uploadedFiles: [], // Files cannot be serialized
        };
      }
    } catch (e) {
      console.warn('Failed to parse wizard draft from storage:', e);
    }
    return initialDraftState;
  });

  useEffect(() => {
    try {
      const { uploadedFiles, ...persistable } = state;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
    } catch (e) {
      console.warn('Failed to persist wizard state:', e);
    }
  }, [state]);

  const updateState = (updates: Partial<WizardFormState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  };

  const resetWizard = () => {
    localStorage.removeItem(STORAGE_KEY);
    setState(initialDraftState);
  };

  // Helper to compile the enriched prompt from all Step 1 fields
  const getEnrichedSubject = (): string => {
    const parts: string[] = [];
    if (state.brandName.trim()) {
      parts.push(`[Brand: ${state.brandName.trim()}]`);
    }
    parts.push(`Topic: ${state.topic.trim()}`);
    if (state.description.trim()) {
      parts.push(`Details: ${state.description.trim()}`);
    }
    if (state.targetAudience.trim()) {
      parts.push(`Target Audience: ${state.targetAudience.trim()}`);
    }
    if (state.callToAction.trim()) {
      parts.push(`Call to Action: ${state.callToAction.trim()}`);
    }
    parts.push(`Target Duration: ~${state.duration} seconds`);
    return parts.join(' | ');
  };

  return {
    state,
    updateState,
    resetWizard,
    getEnrichedSubject,
  };
};
