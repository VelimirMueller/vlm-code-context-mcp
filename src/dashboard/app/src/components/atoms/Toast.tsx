import React, { useEffect } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export function Toast({ message, type, onClose }: ToastProps) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const borderColor = type === 'success' ? 'var(--green)' : 'var(--red)';
  const iconColor = type === 'success' ? 'var(--green)' : 'var(--red)';

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 1, y: 0, x: 0 } : { opacity: 0, y: 20, x: 20 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, x: 20 }}
      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 30 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px',
        borderRadius: 10,
        background: 'var(--surface)',
        border: `1px solid ${borderColor}`,
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        minWidth: 220,
        maxWidth: 360,
        cursor: 'pointer',
      }}
      onClick={onClose}
      role="alert"
      aria-live="assertive"
    >
      <span style={{ color: iconColor, fontSize: 16, lineHeight: 1 }}>
        {type === 'success' ? '✓' : '✕'}
      </span>
      <span style={{ fontSize: 13, color: 'var(--text)', flex: 1 }}>{message}</span>
    </motion.div>
  );
}
