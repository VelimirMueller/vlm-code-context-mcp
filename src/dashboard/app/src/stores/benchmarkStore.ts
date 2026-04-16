import { create } from 'zustand';
import { get } from '@/lib/api';

export interface BenchmarkTask {
  id: string;
  label: string;
  category: string;
  points: number;
  mcp: { tokens: number; calls: number; files: number };
  vanilla: { tokens: number; calls: number; files: number };
  tokenSavingsPct: number;
  callSavingsPct: number;
}

export interface BenchmarkMeta {
  fixture: string;
  fileCount: number;
  tsFileCount: number;
  exportCount: number;
  depCount: number;
  generatedAt: string;
  methodology: string;
  tokenEstimation: string;
}

export interface BenchmarkSummary {
  totalMcpTokens: number;
  totalVanillaTokens: number;
  totalSavingsPct: number;
  totalMcpCalls: number;
  totalVanillaCalls: number;
  callSavingsPct: number;
  totalPoints: number;
  taskCount: number;
  categories: Record<string, { mcpTokens: number; vanillaTokens: number; savingsPct: number }>;
}

export interface BenchmarkData {
  meta: BenchmarkMeta;
  tasks: BenchmarkTask[];
  summary: BenchmarkSummary;
}

export interface StochasticReport {
  config: {
    trials: number;
    seed: number;
    poissonLambda: number;
    bootstrapResamples: number;
    fixtureFiles: number;
    tsFiles: number;
  };
  results: {
    mcpWins: number;
    vanillaWins: number;
    ties: number;
    mcpWinRate: number;
  };
  tokens: {
    mcpMean: number;
    vanillaMean: number;
    savingsMean: number;
    savingsPct: number;
    ci95: { lower: number; upper: number };
  };
  calls: { mcpMean: number; vanillaMean: number };
  statistics: {
    wilcoxon: { W: number; z: number; p: number; n: number };
    effectSize: number;
    effectLabel: string;
    significant: boolean;
  };
  byTemplate: Record<string, { count: number; mcpMean: number; vanillaMean: number; savingsPct: number }>;
}

interface BenchmarkStore {
  data: BenchmarkData | null;
  stochastic: StochasticReport | null;
  loading: boolean;
  error: string | null;
  fetchBenchmark: () => Promise<void>;
}

export const useBenchmarkStore = create<BenchmarkStore>((set) => ({
  data: null,
  stochastic: null,
  loading: false,
  error: null,

  fetchBenchmark: async () => {
    set({ loading: true, error: null });
    try {
      const [data, stochastic] = await Promise.all([
        get<BenchmarkData>('/api/benchmark').catch(() => null),
        get<StochasticReport>('/api/benchmark-stochastic').catch(() => null),
      ]);
      set({ data: data ?? null, stochastic: stochastic ?? null });
    } catch (e) {
      set({ error: (e as Error).message });
    } finally {
      set({ loading: false });
    }
  },
}));
