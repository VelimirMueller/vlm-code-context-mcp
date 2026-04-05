import { useEffect } from 'react';
import { usePlanningStore } from '@/stores/planningStore';

export function usePlanning() {
  const store = usePlanningStore();

  useEffect(() => {
    store.fetchMilestones();
    store.fetchVision();
    store.fetchGantt();
  }, []);

  return store;
}
