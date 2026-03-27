import { AnimatePresence, motion } from 'framer-motion';
import type { LinearIssue } from '@/types';
import { LinearIssueCard } from '@/components/molecules/LinearIssueCard';
import { listVariants, listItemVariants } from '@/lib/motion';

interface LinearIssueGroupProps {
  status: string;
  statusColor: string;
  issues: LinearIssue[];
  collapsed: boolean;
  onToggle: () => void;
}

export function LinearIssueGroup({
  status,
  statusColor,
  issues,
  collapsed,
  onToggle,
}: LinearIssueGroupProps) {
  const sortedIssues = [...issues].sort((a, b) => {
    const pa = a.priority === 0 ? 999 : a.priority;
    const pb = b.priority === 0 ? 999 : b.priority;
    return pa - pb;
  });

  return (
    <div>
      <div
        onClick={onToggle}
        style={{
          padding: '8px 0',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style={{
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
          }}
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: statusColor,
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
          {status}
        </span>
        <span
          style={{
            fontSize: 10,
            padding: '1px 6px',
            borderRadius: 10,
            background: 'var(--surface2)',
            color: 'var(--text3)',
          }}
        >
          {issues.length}
        </span>
      </div>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            style={{ overflow: 'hidden' }}
          >
            <motion.div variants={listVariants} initial="initial" animate="animate">
              {sortedIssues.map(issue => (
                <motion.div key={issue.id} variants={listItemVariants}>
                  <LinearIssueCard issue={issue} />
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
