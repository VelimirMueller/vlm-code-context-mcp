import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
} from 'remotion';
import type { VisionProps } from './types.js';

const DARK_BG = '#0a0a0b';
const TEXT_WHITE = '#ffffff';
const ACCENT = '#10b981';

/* ─── Main Composition ──────────────────────────────────────────────────────── */

export const VisionVideo: React.FC<VisionProps> = ({ productName, vision, milestones, stats }) => (
  <AbsoluteFill style={{ backgroundColor: DARK_BG }}>
    <Sequence from={0} durationInFrames={90}>
      <TitleScene productName={productName} vision={vision} />
    </Sequence>
    <Sequence from={90} durationInFrames={90}>
      <MilestonesScene milestones={milestones} />
    </Sequence>
    <Sequence from={180} durationInFrames={90}>
      <StatsScene stats={stats} />
    </Sequence>
    <Sequence from={270} durationInFrames={30}>
      <ClosingScene />
    </Sequence>
  </AbsoluteFill>
);

/* ─── Scene 1: Title + typewriter vision ────────────────────────────────────── */

const TitleScene: React.FC<{ productName: string; vision: string }> = ({ productName, vision }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const titleScale = spring({ frame, fps, from: 0.8, to: 1, config: { damping: 20 } });

  const visionDelay = 30;
  const chars = Math.floor(interpolate(Math.max(0, frame - visionDelay), [0, 40], [0, vision.length], { extrapolateRight: 'clamp' }));

  return (
    <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 60 }}>
      <div style={{ opacity: titleOpacity, transform: `scale(${titleScale})`, fontSize: 64, fontWeight: 'bold', color: TEXT_WHITE, marginBottom: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>
        {productName}
      </div>
      <div style={{ fontSize: 28, color: ACCENT, maxWidth: 800, textAlign: 'center', fontFamily: 'sans-serif', lineHeight: 1.6, opacity: frame >= visionDelay ? 1 : 0 }}>
        {vision.slice(0, chars)}
        {chars < vision.length && <span style={{ opacity: Math.sin(frame * 0.5) * 0.5 + 0.5 }}>|</span>}
      </div>
    </AbsoluteFill>
  );
};

/* ─── Scene 2: Milestone cards fly in ───────────────────────────────────────── */

const MilestonesScene: React.FC<{ milestones: { name: string; status: string }[] }> = ({ milestones }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const show = milestones.slice(0, 6);

  return (
    <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ fontSize: 48, color: TEXT_WHITE, marginBottom: 50, fontFamily: 'sans-serif', fontWeight: 'bold' }}>Milestones</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%', maxWidth: 900 }}>
        {show.map((m, i) => {
          const delay = i * 7;
          const progress = spring({ frame: frame - delay, fps, config: { damping: 20 } });
          const tx = interpolate(progress, [0, 1], [-1200, 0]);
          const opacity = interpolate(frame, [delay, delay + 10], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

          return (
            <div key={i} style={{ transform: `translateX(${tx}px)`, opacity, backgroundColor: 'rgba(255,255,255,0.05)', padding: '24px 30px', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: `2px solid ${ACCENT}` }}>
              <span style={{ fontSize: 24, color: TEXT_WHITE, fontFamily: 'sans-serif', fontWeight: 500 }}>{m.name}</span>
              <span style={{ backgroundColor: ACCENT, color: DARK_BG, padding: '6px 18px', borderRadius: 6, fontSize: 16, fontWeight: 'bold', fontFamily: 'sans-serif' }}>
                {m.status === 'completed' ? 'SHIPPED' : m.status.toUpperCase()}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ─── Scene 3: Animated stat counters ───────────────────────────────────────── */

const StatsScene: React.FC<{ stats: VisionProps['stats'] }> = ({ stats }) => {
  const frame = useCurrentFrame();
  const dur = 50;
  const count = (target: number, delay: number) =>
    Math.floor(interpolate(frame, [delay, dur + delay], [0, target], { extrapolateRight: 'clamp' }));

  const items = [
    { label: 'Sprints', value: count(stats.sprints, 0), color: '#3b82f6' },
    { label: 'Tickets', value: count(stats.tickets, 5), color: '#8b5cf6' },
    { label: 'Story Points', value: count(stats.points, 10), color: '#ec4899' },
    { label: 'AI Agents', value: count(stats.agents, 15), color: ACCENT },
  ];

  return (
    <AbsoluteFill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div style={{ fontSize: 48, color: TEXT_WHITE, marginBottom: 70, fontFamily: 'sans-serif', fontWeight: 'bold' }}>Delivered</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 60, maxWidth: 1000 }}>
        {items.map((it) => (
          <div key={it.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 80, fontWeight: 'bold', color: it.color, fontFamily: 'monospace' }}>{it.value}</div>
            <div style={{ fontSize: 24, color: TEXT_WHITE, fontFamily: 'sans-serif', opacity: 0.8 }}>{it.label}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

/* ─── Scene 4: Closing ──────────────────────────────────────────────────────── */

const ClosingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = spring({ frame, fps, config: { damping: 20 } });

  return (
    <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 56, fontWeight: 'bold', color: TEXT_WHITE, textAlign: 'center', opacity, fontFamily: 'sans-serif' }}>
        Built by AI. <span style={{ color: ACCENT }}>Shipped by AI.</span>
      </div>
    </AbsoluteFill>
  );
};
