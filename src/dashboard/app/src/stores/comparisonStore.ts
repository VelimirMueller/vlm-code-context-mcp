import { create } from 'zustand';
import { get } from '@/lib/api';

export interface PerCallAvg {
  tool: string;
  old_tokens: number;
  new_tokens: number;
  saved: number;
  saved_pct: number;
  samples: number;
  change: string;
}

export interface TaskProjection {
  id: string;
  label: string;
  description: string;
  points: number;
  target_tokens: number;
  total_calls: number;
  reasoning: string;
  old: { total_tokens: number; total_chars: number };
  new: { total_tokens: number; total_chars: number };
  saved_tokens: number;
  saved_pct: number;
  call_distribution: Record<string, number>;
}

export interface ComparisonData {
  meta: {
    project: string;
    sprint: string;
    created_at: string;
    updated_at: string;
    measurement_note: string;
  };
  benchmark: {
    description: string;
    audit_notes: Record<string, string>;
    per_call_averages: PerCallAvg[];
  };
  tasks: TaskProjection[];
  grand_total: {
    total_calls: number;
    old_tokens: number;
    new_tokens: number;
    saved_tokens: number;
    saved_pct: number;
    quality: string;
  };
}

interface ComparisonStore {
  data: ComparisonData | null;
  loading: boolean;
  error: string | null;
  fetchComparison: () => Promise<void>;
}

export const useComparisonStore = create<ComparisonStore>((set) => ({
  data: null,
  loading: false,
  error: null,

  fetchComparison: async () => {
    set({ loading: true, error: null });
    try {
      const data = await get<ComparisonData>('/api/comparison');
      set({ data: data ?? null });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ loading: false });
    }
  },
}));
