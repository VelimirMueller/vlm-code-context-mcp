import { useEffect } from 'react';
import { useAgentStore } from '@/stores/agentStore';

export function useAgents() {
  const store = useAgentStore();

  useEffect(() => {
    store.fetchAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return store;
}
