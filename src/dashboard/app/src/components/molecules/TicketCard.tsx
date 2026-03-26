import { motion } from 'framer-motion';
import { cardHover } from '@/lib/motion';
import type { Ticket } from '@/types';

interface TicketCardProps {
  ticket: Ticket;
}

const priorityColor: Record<string, string> = {
  P0: 'var(--red)',
  P1: 'var(--orange)',
  P2: 'var(--blue)',
  P3: '#6b7280',
};

export function TicketCard({ ticket }: TicketCardProps) {
  const pColor = priorityColor[ticket.priority] ?? '#6b7280';

  return (
    <motion.div
      whileHover={cardHover}
      layout
      style={{
        padding: '10px 12px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        marginBottom: 6,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--text3)',
            fontFamily: 'var(--mono)',
          }}
        >
          {ticket.ticket_ref ?? `#${ticket.id}`}
        </span>
        <span
          style={{
            padding: '1px 5px',
            borderRadius: 3,
            fontSize: 9,
            fontWeight: 700,
            background: pColor,
            color: 'white',
          }}
        >
          {ticket.priority}
        </span>
      </div>

      <div
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text)',
          marginBottom: 6,
          lineHeight: 1.4,
        }}
      >
        {ticket.title}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 11,
          color: 'var(--text3)',
        }}
      >
        <span>{ticket.assigned_to ?? '—'}</span>
        <span style={{ fontFamily: 'var(--mono)' }}>
          {ticket.story_points ?? 0}sp
        </span>
      </div>
    </motion.div>
  );
}
