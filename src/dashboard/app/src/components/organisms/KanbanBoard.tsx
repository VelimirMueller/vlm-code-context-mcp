import { useState, useEffect } from 'react';
import type { Ticket } from '@/types';
import { TicketCard } from '@/components/molecules/TicketCard';
import { TicketDetailModal } from './TicketDetailModal';
import { usePlanningStore } from '@/stores/planningStore';
import { patch } from '@/lib/api';

interface KanbanBoardProps {
  tickets: Ticket[];
}

interface ColConfig {
  label: string;
  color: string;
}

const COLUMNS: Record<string, ColConfig> = {
  TODO: { label: 'To Do', color: '#6b7280' },
  IN_PROGRESS: { label: 'In Progress', color: 'var(--blue)' },
  DONE: { label: 'Done', color: 'var(--accent)' },
  BLOCKED: { label: 'Blocked', color: 'var(--red)' },
};

export function KanbanBoard({ tickets }: KanbanBoardProps) {
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const milestones = usePlanningStore((s) => s.milestones);
  const fetchMilestones = usePlanningStore((s) => s.fetchMilestones);

  useEffect(() => {
    if (milestones.length === 0) fetchMilestones();
  }, [milestones.length, fetchMilestones]);

  const handleMilestoneChange = async (ticketId: number, milestoneId: number | null) => {
    try {
      await patch(`/api/ticket/${ticketId}/milestone`, { milestone_id: milestoneId });
      if (selectedTicket && selectedTicket.id === ticketId) {
        const milestone = milestones.find(m => m.id === milestoneId);
        setSelectedTicket({ ...selectedTicket, milestone: milestone?.name ?? null });
      }
    } catch (e) {
      console.error('Failed to link milestone:', e);
    }
  };

  return (
    <>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
          padding: '12px 0',
        }}
      >
        {Object.entries(COLUMNS).map(([status, cfg]) => {
          const colTickets = tickets.filter((t) => t.status === status);
          const pts = colTickets.reduce((sum, t) => sum + (t.story_points ?? 0), 0);

          return (
            <div
              key={status}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                display: 'flex',
                flexDirection: 'column',
                minHeight: 200,
              }}
            >
              {/* Column header */}
              <div
                style={{
                  padding: '10px 12px',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: cfg.color,
                    }}
                  />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                    {cfg.label}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--text3)',
                    fontFamily: 'var(--mono)',
                  }}
                >
                  {colTickets.length} · {pts}sp
                </span>
              </div>

              {/* Cards */}
              <div style={{ padding: 8, overflowY: 'auto', flex: 1 }}>
                {colTickets.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} onClick={() => setSelectedTicket(ticket)} />
                ))}
                {colTickets.length === 0 && (
                  <div
                    style={{
                      padding: '20px 8px',
                      textAlign: 'center',
                      fontSize: 11,
                      color: 'var(--text3)',
                    }}
                  >
                    Empty
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <TicketDetailModal
        ticket={selectedTicket}
        milestones={milestones}
        onClose={() => setSelectedTicket(null)}
        onMilestoneChange={handleMilestoneChange}
      />
    </>
  );
}
