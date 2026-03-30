import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { usePlanningStore } from '@/stores/planningStore';
import { DiscoveryCoverageBar } from '@/components/atoms/DiscoveryCoverageBar';
import { DiscoveryRow } from '@/components/molecules/DiscoveryRow';
import { Skeleton } from '@/components/atoms/Skeleton';
import type { Discovery } from '@/types';

const STATUS_OPTIONS = ['all', 'discovered', 'planned', 'implemented', 'dropped'] as const;
const CATEGORY_OPTIONS = ['all', 'architecture', 'ux', 'performance', 'testing', 'integration', 'general'] as const;

interface Props {
  onClickTicket?: (ticketId: number) => void;
}

export function DiscoveryList({ onClickTicket }: Props) {
  const discoveries = usePlanningStore((s) => s.discoveries);
  const coverage = usePlanningStore((s) => s.discoveryCoverage);
  const discoverySprints = usePlanningStore((s) => s.discoverySprints);
  const filters = usePlanningStore((s) => s.discoveryFilters);
  const setFilter = usePlanningStore((s) => s.setDiscoveryFilter);
  const fetchDiscoveries = usePlanningStore((s) => s.fetchDiscoveries);
  const fetchCoverage = usePlanningStore((s) => s.fetchDiscoveryCoverage);
  const fetchSprints = usePlanningStore((s) => s.fetchDiscoverySprints);
  const [collapsedSprints, setCollapsedSprints] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchDiscoveries();
    fetchCoverage();
    fetchSprints();
  }, []);

  // Group discoveries by sprint
  const grouped = discoveries.reduce<Map<number, { name: string; items: Discovery[] }>>((acc, d) => {
    if (!acc.has(d.discovery_sprint_id)) acc.set(d.discovery_sprint_id, { name: d.sprint_name, items: [] });
    acc.get(d.discovery_sprint_id)!.items.push(d);
    return acc;
  }, new Map());

  const toggleSprint = (id: number) => {
    setCollapsedSprints((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectStyle = { background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 12, color: 'var(--text-1)' } as const;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      {/* Coverage bar skeleton */}
      {!coverage && discoveries.length === 0 && (
        <div style={{ padding: '0 4px' }}>
          <Skeleton width={200} height={14} />
          <Skeleton width="100%" height={20} />
        </div>
      )}

      {/* Coverage bar */}
      {coverage && coverage.total > 0 && (
        <div style={{ padding: '0 4px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 8 }}>
            {coverage.total} discoveries across {discoverySprints.length} sprints
          </div>
          <DiscoveryCoverageBar coverage={coverage} />
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '0 4px' }}>
        <select
          value={filters.sprintId || ''}
          onChange={(e) => setFilter({ sprintId: e.target.value ? Number(e.target.value) : undefined })}
          style={selectStyle}
        >
          <option value="">All sprints</option>
          {discoverySprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select
          value={filters.status || 'all'}
          onChange={(e) => setFilter({ status: e.target.value === 'all' ? undefined : e.target.value })}
          style={selectStyle}
        >
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>)}
        </select>
        <select
          value={filters.category || 'all'}
          onChange={(e) => setFilter({ category: e.target.value === 'all' ? undefined : e.target.value })}
          style={selectStyle}
        >
          {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
        </select>
      </div>

      {/* Grouped list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {discoveries.length === 0 && coverage === null ? (
          /* Skeleton loading state while data is being fetched */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 4px' }}>
            {[1, 2, 3].map((g) => (
              <div key={g}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'var(--surface-2)', borderRadius: 6 }}>
                  <Skeleton width={12} height={12} />
                  <Skeleton width={120} height={14} />
                  <div style={{ marginLeft: 'auto' }}><Skeleton width={60} height={12} /></div>
                </div>
                <div style={{ padding: '4px 14px' }}>
                  <Skeleton width="100%" height={44} count={2} />
                </div>
              </div>
            ))}
          </div>
        ) : discoveries.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            No discoveries found. Use the <code>create_discovery</code> MCP tool to log findings from discovery sprints.
          </div>
        ) : (
          [...grouped.entries()].map(([sprintId, group]) => (
            <div key={sprintId} style={{ marginBottom: 8 }}>
              <div
                onClick={() => toggleSprint(sprintId)}
                style={{ padding: '8px 14px', background: 'var(--surface-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderRadius: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}
              >
                <span style={{ transform: collapsedSprints.has(sprintId) ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-block' }}>
                  &#9660;
                </span>
                {group.name}
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-3)', marginLeft: 'auto' }}>
                  {group.items.length} findings
                </span>
              </div>
              {!collapsedSprints.has(sprintId) && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {group.items.map((d) => (
                    <DiscoveryRow
                      key={d.id}
                      discovery={d}
                      onClickTicket={onClickTicket}
                    />
                  ))}
                </motion.div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
