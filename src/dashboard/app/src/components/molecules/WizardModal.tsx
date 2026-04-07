import React, { useState, useEffect, useRef } from 'react';
import { patch } from '@/lib/api';

export interface WizardField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number';
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

export interface WizardStep {
  actionId: number;
  step: string;
  title: string;
  description: string;
  fields: WizardField[];
  hints?: string[];
}

interface WizardModalProps {
  steps: WizardStep[];
  onComplete: () => void;
  onDismiss: () => void;
}

const STEP_ICONS: Record<string, string> = {
  vision: '◈',
  discovery: '?',
  milestone: '▶',
  epics: '≡',
  tickets: '#',
  sprint_launch: '⚡',
  retro: '◁',
};

const STEP_COLORS: Record<string, string> = {
  vision: '#8b5cf6',
  discovery: '#3b82f6',
  milestone: '#10b981',
  epics: '#f59e0b',
  tickets: '#ec4899',
  sprint_launch: '#06b6d4',
  retro: '#ef4444',
};

const inputStyle: React.CSSProperties = {
  background: 'var(--surface2)',
  border: '1px solid var(--border2)',
  borderRadius: 8,
  color: 'var(--text)',
  fontSize: 13,
  padding: '10px 14px',
  fontFamily: 'var(--font)',
  width: '100%',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s',
};

export function WizardModal({ steps, onComplete, onDismiss }: WizardModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [values, setValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  const current = steps[currentIndex];
  const isLast = currentIndex === steps.length - 1;
  const accentColor = STEP_COLORS[current?.step] ?? '#3b82f6';
  const icon = STEP_ICONS[current?.step] ?? '◈';

  // Reset values when step changes
  useEffect(() => {
    if (!current) return;
    const initial: Record<string, string> = {};
    for (const f of current.fields) initial[f.name] = '';
    setValues(initial);
    setError(null);
    // Focus first input after render
    setTimeout(() => firstInputRef.current?.focus(), 50);
  }, [currentIndex, current]);

  // Escape to dismiss
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onDismiss]);

  if (!current) return null;

  const setValue = (name: string, value: string) => {
    setValues(prev => ({ ...prev, [name]: value }));
  };

  const validate = (): boolean => {
    for (const f of current.fields) {
      if (f.required !== false && !values[f.name]?.trim()) {
        setError(`"${f.label}" is required`);
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setError(null);
    try {
      await patch(`/api/bridge/actions/${current.actionId}/respond`, { result: values });
      if (isLast) {
        onComplete();
      } else {
        setCurrentIndex(i => i + 1);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const progress = ((currentIndex + 1) / steps.length) * 100;

  return (
    <div
      onClick={onDismiss}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          maxWidth: 520,
          width: '92vw',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Progress bar */}
        <div style={{ height: 3, background: 'var(--border)' }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: accentColor,
            transition: 'width 0.3s ease',
          }} />
        </div>

        {/* Header */}
        <div style={{
          padding: '24px 28px 0',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `${accentColor}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            color: accentColor,
            flexShrink: 0,
          }}>
            {icon}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>
              {current.title}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
              Step {currentIndex + 1} of {steps.length}
            </div>
          </div>
        </div>

        {/* Description */}
        <div style={{
          padding: '12px 28px 0',
          fontSize: 13,
          color: 'var(--text2)',
          lineHeight: 1.6,
        }}>
          {current.description}
        </div>

        {/* Hints */}
        {current.hints && current.hints.length > 0 && (
          <div style={{
            padding: '10px 28px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}>
            {current.hints.map((hint, i) => (
              <div key={i} style={{
                fontSize: 12,
                color: 'var(--text3)',
                display: 'flex',
                gap: 8,
                alignItems: 'baseline',
              }}>
                <span style={{ color: accentColor }}>▸</span>
                {hint}
              </div>
            ))}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '16px 28px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {current.fields.map((field, idx) => (
            <div key={field.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>
                {field.label}
                {field.required !== false && <span style={{ color: accentColor, marginLeft: 2 }}>*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  ref={idx === 0 ? firstInputRef as React.RefObject<HTMLTextAreaElement> : undefined}
                  style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
                  placeholder={field.placeholder}
                  value={values[field.name] ?? ''}
                  onChange={e => setValue(field.name, e.target.value)}
                  disabled={submitting}
                />
              ) : field.type === 'select' ? (
                <select
                  ref={idx === 0 ? firstInputRef as React.RefObject<HTMLSelectElement> : undefined}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                  value={values[field.name] ?? ''}
                  onChange={e => setValue(field.name, e.target.value)}
                  disabled={submitting}
                >
                  <option value="">Select...</option>
                  {field.options?.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  ref={idx === 0 ? firstInputRef as React.RefObject<HTMLInputElement> : undefined}
                  type={field.type}
                  style={inputStyle}
                  placeholder={field.placeholder}
                  value={values[field.name] ?? ''}
                  onChange={e => setValue(field.name, e.target.value)}
                  disabled={submitting}
                />
              )}
            </div>
          ))}

          {error && (
            <div style={{ fontSize: 12, color: '#ef4444', padding: '4px 0' }}>
              {error}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button
              type="button"
              onClick={onDismiss}
              style={{
                background: 'none',
                border: '1px solid var(--border2)',
                borderRadius: 8,
                padding: '8px 18px',
                fontSize: 13,
                color: 'var(--text2)',
                cursor: 'pointer',
                fontFamily: 'var(--font)',
                fontWeight: 500,
              }}
            >
              Dismiss
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{
                background: accentColor,
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 22px',
                fontSize: 13,
                fontWeight: 600,
                cursor: submitting ? 'wait' : 'pointer',
                fontFamily: 'var(--font)',
                opacity: submitting ? 0.7 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {submitting ? 'Sending...' : isLast ? 'Finish' : 'Next →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
