'use client';

import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useMeStore } from '@/stores/meStore';
import { MeSection } from '@/components/molecules/MeSection';
import { LinearIssueGroup } from '@/components/organisms/LinearIssueGroup';
import { LinearCycleCard } from '@/components/molecules/LinearCycleCard';
import { LinearProjectCard } from '@/components/molecules/LinearProjectCard';
import { LinearActivityItem } from '@/components/molecules/LinearActivityItem';
import { pageVariants, pageTransition } from '@/lib/motion';

const STATUS_ORDER = ['In Progress', 'Todo', 'Done', 'Cancelled'];

export function Me() {
  const configured = useMeStore((s) => s.configured);
  const synced = useMeStore((s) => s.synced);
  const syncedAt = useMeStore((s) => s.syncedAt);
  const issues = useMeStore((s) => s.issues);
  const cycles = useMeStore((s) => s.cycles);
  const projects = useMeStore((s) => s.projects);
  const loading = useMeStore((s) => s.loading);
  const error = useMeStore((s) => s.error);
  const collapsedGroups = useMeStore((s) => s.collapsedGroups);
  const fetchAll = useMeStore((s) => s.fetchAll);
  const fetchConfigured = useMeStore((s) => s.fetchConfigured);
  const toggleGroup = useMeStore((s) => s.toggleGroup);

  useEffect(() => {
    fetchConfigured().then(() => fetchAll());
  }, [fetchConfigured, fetchAll]);

  // Group issues by status
  const issueGroups = useMemo(() => {
    const groups = new Map<string, typeof issues>();
    for (const issue of issues) {
      const list = groups.get(issue.status) ?? [];
      list.push(issue);
      groups.set(issue.status, list);
    }
    // Sort by STATUS_ORDER, unknown statuses at end
    return [...groups.entries()].sort(([a], [b]) => {
      const ia = STATUS_ORDER.indexOf(a);
      const ib = STATUS_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
  }, [issues]);

  // Recent activity: last 20 issues sorted by updatedAt
  const recentActivity = useMemo(() => {
    return [...issues]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 20);
  }, [issues]);

  // Not configured state
  if (!configured && !loading.issues) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: 40,
        }}
      >
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '32px 40px',
            maxWidth: 480,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'rgba(99,102,241,.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-2h2v2h-2zm0-4V7h2v6h-2z" fill="#6366f1"/>
            </svg>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
            Linear MCP Not Configured
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.5, marginBottom: 16 }}>
            Add a Linear MCP server to your <code style={{ fontFamily: 'var(--mono)', background: 'var(--surface2)', padding: '1px 4px', borderRadius: 3 }}>.mcp.json</code> to see your assigned issues, cycles, and projects here.
          </p>
          <pre
            style={{
              textAlign: 'left',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              padding: 12,
              fontSize: 11,
              fontFamily: 'var(--mono)',
              color: 'var(--text2)',
              lineHeight: 1.6,
              overflow: 'auto',
            }}
          >
{`"linear": {
  "command": "npx",
  "args": ["-y", "@anthropic/linear-mcp-server"]
}`}
          </pre>
        </div>
      </div>
    );
  }

  // Configured but no data synced yet
  if (configured && !synced && !loading.issues) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: 40,
        }}
      >
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '32px 40px',
            maxWidth: 480,
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'rgba(16,185,129,.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z" fill="var(--accent)"/>
            </svg>
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
            Sync Linear Data
          </h3>
          <p style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.5 }}>
            Linear MCP is configured. Ask Claude to <code style={{ fontFamily: 'var(--mono)', background: 'var(--surface2)', padding: '1px 4px', borderRadius: 3 }}>sync linear</code> to fetch your issues, cycles, and projects.
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      transition={pageTransition}
      style={{
        padding: '20px 24px',
        overflow: 'auto',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {/* Sync status header */}
      {syncedAt && (
        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
          Synced {new Date(syncedAt + 'Z').toLocaleString()}
        </div>
      )}

      {/* Section 1: My Issues */}
      <MeSection
        title="My Issues"
        count={issues.length}
        loading={loading.issues}
        error={error.issues}
        emptyMessage="No issues assigned to you"
        onRetry={fetchAll}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {issueGroups.map(([status, groupIssues]) => (
            <LinearIssueGroup
              key={status}
              status={status}
              statusColor={groupIssues[0]?.statusColor ?? '#6b7280'}
              issues={groupIssues}
              collapsed={collapsedGroups.has(status)}
              onToggle={() => toggleGroup(status)}
            />
          ))}
        </div>
      </MeSection>

      {/* Section 2: My Cycles */}
      <MeSection
        title="My Cycles"
        count={cycles.length}
        loading={loading.cycles}
        error={error.cycles}
        emptyMessage="No active cycles"
        onRetry={fetchAll}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 10,
          }}
        >
          {cycles.map((cycle) => (
            <LinearCycleCard key={cycle.id} cycle={cycle} />
          ))}
        </div>
      </MeSection>

      {/* Section 3: My Projects */}
      <MeSection
        title="My Projects"
        count={projects.length}
        loading={loading.projects}
        error={error.projects}
        emptyMessage="No projects found"
        onRetry={fetchAll}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: 10,
          }}
        >
          {projects.map((project) => (
            <LinearProjectCard key={project.id} project={project} />
          ))}
        </div>
      </MeSection>

      {/* Section 4: Recent Activity */}
      <MeSection
        title="Recent Activity"
        count={recentActivity.length}
        loading={loading.issues}
        error={error.issues}
        emptyMessage="No recent activity"
        onRetry={fetchAll}
      >
        <div
          style={{
            borderLeft: '2px solid var(--border)',
            marginLeft: 4,
            paddingLeft: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {recentActivity.map((issue) => (
            <LinearActivityItem key={issue.id} issue={issue} />
          ))}
        </div>
      </MeSection>
    </motion.div>
  );
}
