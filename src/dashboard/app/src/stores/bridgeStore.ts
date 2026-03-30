import { create } from 'zustand';
import { get, post } from '@/lib/api';

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

export interface BridgeStore {
  status: BridgeStatus | null;
  actions: PendingAction[];
  loading: boolean;

  fetchStatus: () => Promise<void>;
  fetchActions: (status?: string) => Promise<void>;
  queueAction: (action: string, entityType?: string, entityId?: number, payload?: Record<string, unknown>) => Promise<void>;
}

export const useBridgeStore = create<BridgeStore>((set, getState) => ({
  status: null,
  actions: [],
  loading: false,

  fetchStatus: async () => {
    try {
      const status = await get<BridgeStatus>('/api/bridge/status');
      set({ status: status ?? null });
    } catch {}
  },

  fetchActions: async (status = 'pending') => {
    try {
      const actions = await get<PendingAction[]>(`/api/bridge/actions?status=${status}`);
      set({ actions: Array.isArray(actions) ? actions : [] });
    } catch {}
  },

  queueAction: async (action, entityType, entityId, payload) => {
    set({ loading: true });
    try {
      await post('/api/bridge/actions', {
        action,
        entity_type: entityType,
        entity_id: entityId,
        payload,
      });
      const state = getState();
      await state.fetchStatus();
    } finally {
      set({ loading: false });
    }
  },
}));
