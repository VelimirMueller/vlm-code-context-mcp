import { create } from 'zustand';
import { get } from '@/lib/api';

export interface VelocitySprint {
  sprint_id: number;
  sprint_name: string;
  status: string;
  committed: number;
  completed: number;
  completion_rate: number;
  tickets_done: number;
  tickets_total: number;
  bugs_found: number;
  bugs_fixed: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface VelocitySummary {
  total_sprints: number;
  completed_sprints: number;
  avg_committed: number;
  avg_completed: number;
  avg_completion_rate: number;
  total_bugs_found: number;
  total_bugs_fixed: number;
}

export interface VelocityData {
  sprints: VelocitySprint[];
  summary: VelocitySummary | null;
}

interface VelocityStore {
  data: VelocityData | null;
  loading: boolean;
  error: string | null;
  fetchVelocity: () => Promise<void>;
}

export const useVelocityStore = create<VelocityStore>((set) => ({
  data: null,
  loading: false,
  error: null,

  fetchVelocity: async () => {
    set({ loading: true, error: null });
    try {
      const data = await get<VelocityData>('/api/velocity');
      set({ data: data ?? null });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ loading: false });
    }
  },
}));
