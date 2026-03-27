import { motion } from 'framer-motion';
import { cardHover } from '@/lib/motion';
import type { Ticket } from '@/types';

interface TicketCardProps {
  ticket: Ticket;
  onClick?: () => void;
}

const priorityColor: Record<string, string> = {
  P0: 'var(--red)',
  P1: 'var(--orange)',
  P2: 'var(--blue)',
  P3: '#6b7280',
};

export function TicketCard({ ticket, onClick }: TicketCardProps) {
  const pColor = priorityColor[ticket.priority] ?? '#6b7280';

  return (
    <motion.div
      whileHover={cardHover}
      layout
      onClick={onClick}
      style={{
        padding: '10px 12px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        marginBottom: 6,
        cursor: onClick ? 'pointer' : 'default',
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
          alignItems: 'center',
          fontSize: 11,
          color: 'var(--text3)',
        }}
      >
        <span>{ticket.assigned_to ?? '—'}</span>
        <span style={{ fontFamily: 'var(--mono)' }}>
          {ticket.story_points ?? 0}sp
        </span>
      </div>

      {ticket.epic_name && (
        <span
          style={{
            display: 'inline-block',
            marginTop: 4,
            fontSize: 10,
            padding: '1px 6px',
            borderRadius: 4,
            background: 'rgba(168, 85, 247, 0.15)',
            color: 'rgb(168, 85, 247)',
          }}
        >
          {ticket.epic_name}
        </span>
      )}
    </motion.div>
  );
}
