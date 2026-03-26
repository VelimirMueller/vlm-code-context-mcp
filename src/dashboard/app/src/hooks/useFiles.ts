import { useEffect } from 'react';
import { useFileStore } from '@/stores/fileStore';

export function useFiles() {
  const store = useFileStore();

  useEffect(() => {
    store.fetchFiles();
    store.fetchDirectories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return store;
}
