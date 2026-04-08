import { create } from 'zustand';
import { get, post, patch } from '@/lib/api';
import type { WizardStep } from '@/components/molecules/WizardModal';

export interface PendingAction {
  id: number;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  payload: string | null;
  status: string;
  source: string;
  created_at: string;
  claimed_at: string | null;
  completed_at: string | null;
  result: string | null;
  error: string | null;
}

export interface BridgeStatus {
  pending: number;
  claimed: number;
  completed: number;
  failed: number;
}

export interface StepProgress {
  step: string;
  title: string;
  description: string;
  current: number;
  total: number;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  error?: string;
}

export interface BridgeStore {
  status: BridgeStatus | null;
  actions: PendingAction[];
  wizardSteps: WizardStep[];
  wizardOpen: boolean;
  stepProgress: StepProgress | null;
  loading: boolean;
  error: string | null;

  fetchStatus: () => Promise<void>;
  fetchActions: (status?: string) => Promise<void>;
  queueAction: (action: string, entityType?: string, entityId?: number, payload?: Record<string, unknown>) => Promise<void>;
  handleInputRequested: (action: PendingAction) => void;
  handleStepProgress: (progress: StepProgress) => void;
  dismissWizard: () => void;
  completeWizard: () => void;
  clearError: () => void;
}

export const useBridgeStore = create<BridgeStore>((set, getState) => ({
  status: null,
  actions: [],
  wizardSteps: [],
  wizardOpen: false,
  stepProgress: null,
  loading: false,
  error: null,

  fetchStatus: async () => {
    try {
      const status = await get<BridgeStatus>('/api/bridge/status');
      set({ status: status ?? null });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  fetchActions: async (status = 'pending') => {
    try {
      const actions = await get<PendingAction[]>(`/api/bridge/actions?status=${status}`);
      set({ actions: Array.isArray(actions) ? actions : [] });
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  queueAction: async (action, entityType, entityId, payload) => {
    set({ loading: true, error: null });
    try {
      await post('/api/bridge/actions', {
        action,
        entity_type: entityType,
        entity_id: entityId,
        payload,
      });
      const state = getState();
      await state.fetchStatus();
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ loading: false });
    }
  },

  handleInputRequested: (action: PendingAction) => {
    try {
      const payload = action.payload ? JSON.parse(action.payload) : null;
      if (!payload) return;
      const step: WizardStep = {
        actionId: action.id,
        step: payload.step ?? 'unknown',
        title: payload.title ?? 'Input Required',
        description: payload.description ?? '',
        fields: payload.fields ?? [],
        hints: payload.hints,
      };
      set(state => ({
        wizardSteps: [...state.wizardSteps, step],
        wizardOpen: true,
      }));
    } catch { /* ignore parse errors */ }
  },

  handleStepProgress: (progress: StepProgress) => {
    set({ stepProgress: progress });
  },

  dismissWizard: () => set({ wizardOpen: false, wizardSteps: [], stepProgress: null }),

  completeWizard: () => set({ wizardOpen: false, wizardSteps: [], stepProgress: null }),

  clearError: () => set({ error: null }),
}));
