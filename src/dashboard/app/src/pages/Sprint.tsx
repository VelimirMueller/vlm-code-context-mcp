import { useState } from 'react';
import { useSprints } from '@/hooks/useSprints';
import { useAgents } from '@/hooks/useAgents';
import { SubTabBar } from '@/components/molecules/SubTabBar';
import { SprintList } from '@/components/organisms/SprintList';
import { SprintDetail } from '@/components/organisms/SprintDetail';
import { TeamGrid } from '@/components/organisms/TeamGrid';
import { BentoGrid } from '@/components/organisms/BentoGrid';

const TABS = [
  { key: 'board', label: 'Board' },
  { key: 'team', label: 'Team' },
  { key: 'insights', label: 'Retro Insights' },
];

export function Sprint() {
  const [activeTab, setActiveTab] = useState('board');

  // Kick off data fetching
  useSprints();
  useAgents();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <SubTabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />

      {/* Board tab: sprint list (left) + sprint detail (right) */}
      {activeTab === 'board' && (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Sprint list sidebar */}
          <div
            style={{
              width: 260,
              flexShrink: 0,
              borderRight: '1px solid var(--border)',
              background: 'var(--surface)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text3)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                flexShrink: 0,
              }}
            >
              Sprints
            </div>
            <SprintList />
          </div>

          {/* Sprint detail panel */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <SprintDetail />
          </div>
        </div>
      )}

      {/* Team tab */}
      {activeTab === 'team' && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <TeamGrid />
        </div>
      )}

      {/* Insights tab */}
      {activeTab === 'insights' && (
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <BentoGrid />
        </div>
      )}
    </div>
  );
}
