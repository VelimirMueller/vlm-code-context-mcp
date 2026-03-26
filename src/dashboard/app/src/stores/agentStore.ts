import { create } from 'zustand';
import { get } from '@/lib/api';
import type { Agent } from '@/types';

export interface AgentStore {
  agents: Agent[];
  loading: boolean;

  fetchAgents: () => Promise<void>;
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: [],
  loading: false,

  fetchAgents: async () => {
    set({ loading: true });
    try {
      const agents = await get<Agent[]>('/api/agents');
      set({ agents });
    } finally {
      set({ loading: false });
    }
  },
}));
