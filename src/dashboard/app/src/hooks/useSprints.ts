import { useEffect } from 'react';
import { useSprintStore } from '@/stores/sprintStore';

export function useSprints() {
  const store = useSprintStore();

  useEffect(() => {
    store.fetchSprints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return store;
}
