'use client';

import { useEffect, useCallback } from 'react';
import { useUIStore, type PageType } from '@/stores/uiStore';
import { useFileStore } from '@/stores/fileStore';
import { useSprintStore } from '@/stores/sprintStore';

// Page mapping: legacy pages -> new PageType
const pageMapping: Record<string, PageType> = {
  explorer: 'code',
  planning: 'planning',
  sprint: 'dashboard',
};

interface ParsedHash {
  page: string;
  tab: string;
  resourceId: number | null;
}

function parseHash(hash: string): ParsedHash {
  const clean = hash.replace(/^#/, '');
  const parts = clean.split('/');

  // Handle new page names: dashboard, code, planning, team, retro
  const newPages = ['dashboard', 'code', 'planning', 'team', 'retro'];
  const page = parts[0] || 'dashboard';

  // If using new page names, map to legacy structure
  let legacyPage = page;
  if (page === 'dashboard') legacyPage = 'sprint';
  else if (page === 'code') legacyPage = 'explorer';

  const tab = parts[1] || (legacyPage === 'explorer' ? 'files' : legacyPage === 'sprint' ? 'board' : 'roadmap');
  const id = parts[2];

  return {
    page: legacyPage,
    tab,
    resourceId: id ? parseInt(id, 10) : null,
  };
}

function buildHash(page: string, tab: string, resourceId?: number | null): string {
  const base = `#${page}/${tab}`;
  return resourceId != null ? `${base}/${resourceId}` : base;
}

export function useHashRouter() {
  const activePage = useUIStore((s) => s.activePage);
  const activeTab = useUIStore((s) => s.activeTab);
  const setPage = useUIStore((s) => s.setPage);
  const setTab = useUIStore((s) => s.setTab);
  const selectedFileId = useFileStore((s) => s.selectedFileId);
  const selectFile = useFileStore((s) => s.selectFile);
  const selectedSprintId = useSprintStore((s) => s.selectedSprintId);
  const selectSprint = useSprintStore((s) => s.selectSprint);

  // Hash -> state: read hash on mount and popstate
  const syncFromHash = useCallback(() => {
    const { page, tab, resourceId } = parseHash(window.location.hash);

    // Map legacy page names to new PageType
    const normalizedPage: PageType = pageMapping[page] || page as PageType;

    if (normalizedPage !== useUIStore.getState().activePage) {
      setPage(normalizedPage);
    }
    if (tab !== useUIStore.getState().activeTab) {
      setTab(tab);
    }

    if (resourceId !== null) {
      if (page === 'explorer' && resourceId !== useFileStore.getState().selectedFileId) {
        selectFile(resourceId);
      }
      if ((page === 'sprint' || normalizedPage === 'dashboard') && resourceId !== useSprintStore.getState().selectedSprintId) {
        selectSprint(resourceId);
      }
    }
  }, [setPage, setTab, selectFile, selectSprint]);

  useEffect(() => {
    syncFromHash();
    window.addEventListener('popstate', syncFromHash);
    return () => window.removeEventListener('popstate', syncFromHash);
  }, [syncFromHash]);

  // State -> hash: write hash when state changes
  useEffect(() => {
    let resourceId: number | null = null;
    if (activePage === 'explorer') resourceId = selectedFileId;
    if (activePage === 'sprint') resourceId = selectedSprintId;

    const newHash = buildHash(activePage, activeTab, resourceId);
    if (window.location.hash !== newHash) {
      window.history.pushState(null, '', newHash);
    }
  }, [activePage, activeTab, selectedFileId, selectedSprintId]);
}
