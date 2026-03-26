# Sprint 10: Eye Candy & Documentation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **MCP Integration:** All ticket status updates must go through MCP tools. Before starting a task: update_ticket status=IN_PROGRESS. After completing: update_ticket status=DONE, qa_verified=true. Sprint ID: 178.

**Goal:** Add enterprise-grade Framer Motion transitions, animated hero text per tab, polished micro-interactions, and update all documentation.

**Architecture:** Framer Motion (~30KB) added to existing React app from Sprint 9. AnimatePresence for page transitions, motion.div for micro-interactions, staggerChildren for hero text reveals.

**Tech Stack:** Framer Motion, React 18, TypeScript, Zustand (from Sprint 9)

**Prerequisite:** Sprint 9 must be complete (full React app functional)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `package.json` | Add framer-motion dependency |
| Create | `src/dashboard/app/lib/motion.ts` | Shared motion variants, reduced-motion hook, animation constants |
| Modify | `src/dashboard/app/App.tsx` | AnimatePresence wrapper around page router |
| Create | `src/dashboard/app/components/atoms/AnimatedNumber.tsx` | Count-up stat animation component |
| Create | `src/dashboard/app/components/atoms/Toast.tsx` | Toast notification component |
| Create | `src/dashboard/app/components/atoms/ShimmerSkeleton.tsx` | Shimmer skeleton replacing static pulse |
| Create | `src/dashboard/app/components/molecules/HeroText.tsx` | Base hero text component with variants per page |
| Create | `src/dashboard/app/components/molecules/ToastContainer.tsx` | Toast stack manager |
| Modify | `src/dashboard/app/components/molecules/TabBar.tsx` | Animated underline indicator |
| Modify | `src/dashboard/app/components/molecules/SubTabBar.tsx` | Cross-fade sub-tab transitions |
| Modify | `src/dashboard/app/components/molecules/TicketCard.tsx` | Hover lift + shadow spring |
| Modify | `src/dashboard/app/components/molecules/AgentCard.tsx` | Hover lift + shadow spring |
| Modify | `src/dashboard/app/components/molecules/SprintCard.tsx` | Hover lift + shadow spring |
| Modify | `src/dashboard/app/components/molecules/BentoCard.tsx` | Hover lift + shadow spring |
| Modify | `src/dashboard/app/components/molecules/FileItem.tsx` | Hover highlight spring |
| Modify | `src/dashboard/app/components/molecules/FolderItem.tsx` | Expand/collapse height spring |
| Modify | `src/dashboard/app/components/atoms/Button.tsx` | Press scale(0.97) spring |
| Modify | `src/dashboard/app/components/atoms/Skeleton.tsx` | Shimmer effect upgrade |
| Modify | `src/dashboard/app/components/atoms/Stat.tsx` | Count-up animation on mount |
| Modify | `src/dashboard/app/components/organisms/FileTree.tsx` | Height spring on expand/collapse |
| Modify | `src/dashboard/app/components/organisms/KanbanBoard.tsx` | Physical card interactions |
| Modify | `src/dashboard/app/components/organisms/Topbar.tsx` | Stat count-up animations |
| Modify | `src/dashboard/app/pages/CodeExplorer.tsx` | Hero text + page transition |
| Modify | `src/dashboard/app/pages/Sprint.tsx` | Hero text + page transition |
| Modify | `src/dashboard/app/pages/ProjectManagement.tsx` | Hero text + page transition |
| Create | `src/dashboard/app/components/organisms/LandingAnimation.tsx` | Framer Motion landing sequence |
| Modify | `src/dashboard/app/stores/uiStore.ts` | Toast state slice |
| Modify | `README.md` | Architecture section update |
| Create | `docs/ARCHITECTURE.md` | Full architecture documentation |
| Modify | `.claude/scrum/COMPONENT_TREE.md` | Final component structure |

---

### Task 1: Page Transitions with Framer Motion (T-061) — 5pt

**Files:**
- Modify: `package.json`
- Create: `src/dashboard/app/lib/motion.ts`
- Modify: `src/dashboard/app/App.tsx`
- Modify: `src/dashboard/app/components/molecules/SubTabBar.tsx`
- Modify: `src/dashboard/app/components/organisms/KanbanBoard.tsx`
- Modify: `src/dashboard/app/stores/uiStore.ts`

**Commit message:** `feat(dashboard): add Framer Motion page transitions with AnimatePresence`

- [ ] **Step 1: Install framer-motion**

```bash
cd src/dashboard/app && npm install framer-motion@^11
```

Verify in `package.json`:
```json
{
  "dependencies": {
    "framer-motion": "^11.0.0"
  }
}
```

- [ ] **Step 2: Create shared motion utilities — `src/dashboard/app/lib/motion.ts`**

This file contains all reusable motion variants, the reduced-motion hook, and animation constants. Every component imports from here — no inline variant objects elsewhere.

```typescript
// src/dashboard/app/lib/motion.ts
import { Variants, Transition, useReducedMotion } from 'framer-motion';

// ── Reduced Motion ──────────────────────────────────────────────────
export { useReducedMotion };

/**
 * Returns instant (duration: 0) variants when reduced motion is preferred.
 * Usage: const v = useAccessibleVariants(pageVariants);
 */
export function withReducedMotion(variants: Variants, reduced: boolean | null): Variants {
  if (!reduced) return variants;
  const instant: Variants = {};
  for (const key of Object.keys(variants)) {
    const target = variants[key];
    if (typeof target === 'object' && target !== null) {
      instant[key] = { ...(target as Record<string, unknown>), transition: { duration: 0 } };
    } else {
      instant[key] = target;
    }
  }
  return instant;
}

// ── Spring Presets ──────────────────────────────────────────────────
export const spring: Record<string, Transition> = {
  /** Default spring — snappy, minimal overshoot */
  default: { type: 'spring', stiffness: 300, damping: 30 },
  /** Bouncy spring — for cards, icons popping in */
  bouncy: { type: 'spring', stiffness: 400, damping: 20 },
  /** Gentle spring — for layout shifts, sidebar */
  gentle: { type: 'spring', stiffness: 200, damping: 28 },
  /** Stiff spring — for micro-interactions (hover, press) */
  stiff: { type: 'spring', stiffness: 500, damping: 35 },
};

// ── Page Transition Variants ────────────────────────────────────────
export const pageVariants: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { ...spring.default, duration: 0.25 } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.15 } },
};

// ── Sub-Tab Cross-Fade Variants ─────────────────────────────────────
export const subTabVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: spring.default },
  exit: { opacity: 0, y: -8, transition: { duration: 0.12 } },
};

// ── Sidebar Collapse Variants ───────────────────────────────────────
export const sidebarVariants: Variants = {
  expanded: { width: 300, opacity: 1, transition: spring.gentle },
  collapsed: { width: 0, opacity: 0, transition: spring.gentle },
};

// ── Card Hover Variants ─────────────────────────────────────────────
export const cardHover: Variants = {
  rest: { y: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.12)' },
  hover: {
    y: -2,
    boxShadow: '0 8px 24px rgba(0,0,0,0.24)',
    transition: spring.stiff,
  },
};

// ── Button Press Variant ────────────────────────────────────────────
export const buttonPress = {
  whileTap: { scale: 0.97, transition: spring.stiff },
};

// ── Stagger Container ───────────────────────────────────────────────
export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: spring.default },
};

// ── Expand/Collapse (Tree) ──────────────────────────────────────────
export const expandVariants: Variants = {
  collapsed: { height: 0, opacity: 0, overflow: 'hidden' },
  expanded: { height: 'auto', opacity: 1, overflow: 'visible', transition: spring.gentle },
};

// ── Kanban Card Drag ────────────────────────────────────────────────
export const kanbanCardDrag = {
  whileDrag: {
    scale: 1.04,
    boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
    rotate: 1.5,
    transition: spring.bouncy,
  },
};
```

- [ ] **Step 3: Wrap page router with AnimatePresence — `src/dashboard/app/App.tsx`**

Add `AnimatePresence` around the page rendering switch. Each page is wrapped in `motion.div` with `pageVariants`. The sidebar uses `motion.aside` with `sidebarVariants`.

```typescript
// In App.tsx — add these imports
import { AnimatePresence, motion } from 'framer-motion';
import { pageVariants, sidebarVariants, withReducedMotion, useReducedMotion } from './lib/motion';

// Inside the App component:
function App() {
  const { activePage, sidebarCollapsed } = useUIStore();
  const reduced = useReducedMotion();
  const pv = withReducedMotion(pageVariants, reduced);
  const sv = withReducedMotion(sidebarVariants, reduced);

  // ... existing SSE wiring, hash router, etc.

  return (
    <div className="app-shell">
      <Topbar />
      <div className="app-body">
        {/* Animated sidebar */}
        <motion.aside
          className="sidebar"
          variants={sv}
          animate={sidebarCollapsed ? 'collapsed' : 'expanded'}
          initial={false}
        >
          {/* sidebar content */}
        </motion.aside>

        {/* Page transitions */}
        <main className="main-content">
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              variants={pv}
              initial="initial"
              animate="animate"
              exit="exit"
              className="page-wrapper"
            >
              {activePage === 'explorer' && <CodeExplorer />}
              {activePage === 'sprint' && <Sprint />}
              {activePage === 'planning' && <ProjectManagement />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Sub-tab cross-fade transitions**

In each page that has sub-tabs (Sprint, ProjectManagement), wrap the sub-tab content panel with `AnimatePresence` and `motion.div` using `subTabVariants`:

```typescript
// Example in Sprint.tsx sub-tab content area:
import { AnimatePresence, motion } from 'framer-motion';
import { subTabVariants, withReducedMotion, useReducedMotion } from '../lib/motion';

// Inside the component:
const reduced = useReducedMotion();
const sv = withReducedMotion(subTabVariants, reduced);

<AnimatePresence mode="wait">
  <motion.div
    key={activeSubTab}
    variants={sv}
    initial="initial"
    animate="animate"
    exit="exit"
  >
    {activeSubTab === 'board' && <KanbanBoard />}
    {activeSubTab === 'team' && <TeamGrid />}
    {activeSubTab === 'insights' && <BentoGrid />}
  </motion.div>
</AnimatePresence>
```

- [ ] **Step 5: Kanban card physical interactions**

In `KanbanBoard.tsx`, wrap each `TicketCard` with `motion.div` using `kanbanCardDrag` from `lib/motion.ts`:

```typescript
import { motion } from 'framer-motion';
import { kanbanCardDrag, cardHover, useReducedMotion } from '../../lib/motion';

// Inside column rendering:
{column.tickets.map((ticket) => (
  <motion.div
    key={ticket.id}
    layout
    variants={cardHover}
    initial="rest"
    whileHover="hover"
    {...(reduced ? {} : kanbanCardDrag)}
    drag={!reduced}
    dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
    dragElastic={0.1}
  >
    <TicketCard ticket={ticket} />
  </motion.div>
))}
```

- [ ] **Step 6: Verify reduced-motion behavior**

Test that `prefers-reduced-motion: reduce` disables all animations:

```bash
# In Chrome DevTools > Rendering > Emulate CSS media feature
# Set prefers-reduced-motion to "reduce"
# Verify: pages switch instantly, no slide/fade, no card drag physics
```

- [ ] **Step 7: Build verification**

```bash
npm run build && npm test
```

---

### Task 2: Tab Hero Animations (T-062) — 5pt

**Files:**
- Create: `src/dashboard/app/components/molecules/HeroText.tsx`
- Create: `src/dashboard/app/components/atoms/AnimatedNumber.tsx`
- Modify: `src/dashboard/app/pages/CodeExplorer.tsx`
- Modify: `src/dashboard/app/pages/Sprint.tsx`
- Modify: `src/dashboard/app/pages/ProjectManagement.tsx`

**Commit message:** `feat(dashboard): add animated hero text blocks with dynamic store data per page`

- [ ] **Step 1: Create AnimatedNumber atom — `src/dashboard/app/components/atoms/AnimatedNumber.tsx`**

A spring-driven count-up from 0 to target value. Used by hero text and stat cards.

```typescript
// src/dashboard/app/components/atoms/AnimatedNumber.tsx
import { useEffect, useRef } from 'react';
import { useSpring, useMotionValue, useTransform, motion, useReducedMotion } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  className?: string;
  suffix?: string;
  prefix?: string;
}

export function AnimatedNumber({
  value,
  duration = 0.8,
  className,
  suffix = '',
  prefix = '',
}: AnimatedNumberProps) {
  const reduced = useReducedMotion();
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (v) => Math.round(v));
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduced) {
      // Instant display for reduced motion
      if (ref.current) ref.current.textContent = `${prefix}${value}${suffix}`;
      return;
    }

    const controls = useSpring(motionValue, {
      stiffness: 100,
      damping: 30,
      duration,
    });
    motionValue.set(0);

    // Small delay for mount stagger
    const timer = setTimeout(() => motionValue.set(value), 50);
    return () => clearTimeout(timer);
  }, [value, reduced]);

  if (reduced) {
    return <span ref={ref} className={className}>{prefix}{value}{suffix}</span>;
  }

  return (
    <span className={className}>
      {prefix}
      <motion.span>{rounded}</motion.span>
      {suffix}
    </span>
  );
}
```

- [ ] **Step 2: Create HeroText molecule — `src/dashboard/app/components/molecules/HeroText.tsx`**

Base hero component with variant rendering per page. Max 80px height, Geist Sans, dark theme.

```typescript
// src/dashboard/app/components/molecules/HeroText.tsx
import { motion, useReducedMotion } from 'framer-motion';
import { spring, staggerContainer, staggerItem, withReducedMotion } from '../../lib/motion';
import { AnimatedNumber } from '../atoms/AnimatedNumber';

interface HeroTextProps {
  variant: 'explorer' | 'sprint' | 'retro' | 'planning' | 'team';
  data: Record<string, unknown>;
}

// ── Staggered Word Reveal ──────────────────────────────────────────
function StaggeredWords({ text, className }: { text: string; className?: string }) {
  const reduced = useReducedMotion();
  const words = text.split(' ');
  const sv = withReducedMotion(staggerContainer, reduced);
  const iv = withReducedMotion(staggerItem, reduced);

  return (
    <motion.span
      className={className}
      variants={sv}
      initial="initial"
      animate="animate"
    >
      {words.map((word, i) => (
        <motion.span
          key={i}
          variants={iv}
          style={{ display: 'inline-block', marginRight: '0.3em' }}
        >
          {word}
        </motion.span>
      ))}
    </motion.span>
  );
}

// ── Typewriter Effect ──────────────────────────────────────────────
function Typewriter({ text, className }: { text: string; className?: string }) {
  const reduced = useReducedMotion();

  if (reduced) return <span className={className}>{text}</span>;

  return (
    <motion.span
      className={className}
      initial={{ width: 0 }}
      animate={{ width: 'auto' }}
      transition={{ duration: 1.2, ease: 'easeOut' }}
      style={{ display: 'inline-block', overflow: 'hidden', whiteSpace: 'nowrap' }}
    >
      {text}
    </motion.span>
  );
}

// ── Progress Ring ──────────────────────────────────────────────────
function ProgressRing({ progress, size = 48 }: { progress: number; size?: number }) {
  const reduced = useReducedMotion();
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 12 }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--surface2)"
        strokeWidth={4}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: reduced ? offset : circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={reduced ? { duration: 0 } : { ...spring.default, duration: 1 }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

// ── Hero Variants ──────────────────────────────────────────────────
export function HeroText({ variant, data }: HeroTextProps) {
  return (
    <div className="hero-text" style={{
      maxHeight: 80,
      padding: '16px 0',
      fontFamily: 'var(--font)',
      overflow: 'hidden',
    }}>
      {variant === 'explorer' && <ExplorerHero data={data} />}
      {variant === 'sprint' && <SprintHero data={data} />}
      {variant === 'retro' && <RetroHero data={data} />}
      {variant === 'planning' && <PlanningHero data={data} />}
      {variant === 'team' && <TeamHero data={data} />}
    </div>
  );
}

function ExplorerHero({ data }: { data: Record<string, unknown> }) {
  const files = (data.totalFiles as number) || 0;
  const dirs = (data.totalDirectories as number) || 0;
  const exports = (data.totalExports as number) || 0;

  return (
    <div style={{ fontSize: 20, color: 'var(--text)', fontWeight: 600 }}>
      Tracking{' '}
      <AnimatedNumber value={files} className="hero-num" />{' '}
      files across{' '}
      <AnimatedNumber value={dirs} className="hero-num" />{' '}
      directories
      {exports > 0 && (
        <>
          {' '}&mdash;{' '}
          <AnimatedNumber value={exports} className="hero-num" />{' '}
          <span style={{ color: 'var(--text2)' }}>exports indexed</span>
        </>
      )}
    </div>
  );
}

function SprintHero({ data }: { data: Record<string, unknown> }) {
  const name = (data.name as string) || 'Sprint';
  const done = (data.completedCount as number) || 0;
  const total = (data.ticketCount as number) || 0;
  const velocity = (data.velocity as number) || 0;

  return (
    <StaggeredWords
      text={`Sprint ${name} — ${done}/${total} tickets shipped, ${velocity}pt velocity`}
      className="hero-stagger"
    />
  );
}

function RetroHero({ data }: { data: Record<string, unknown> }) {
  const findings = (data.totalFindings as number) || 0;
  const sprints = (data.totalSprints as number) || 0;

  return (
    <div style={{ fontSize: 20, color: 'var(--text)', fontWeight: 600 }}>
      <Typewriter
        text={`${findings} findings across ${sprints} sprints — here's what we learned`}
      />
    </div>
  );
}

function PlanningHero({ data }: { data: Record<string, unknown> }) {
  const name = (data.milestoneName as string) || 'Milestone';
  const progress = (data.progress as number) || 0;
  const days = (data.daysRemaining as number) || 0;

  return (
    <div style={{ fontSize: 20, color: 'var(--text)', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
      <ProgressRing progress={progress} />
      Milestone {name} &mdash;{' '}
      <AnimatedNumber value={progress} suffix="%" className="hero-num" />{' '}
      complete, {days} days remaining
    </div>
  );
}

function TeamHero({ data }: { data: Record<string, unknown> }) {
  const count = (data.agentCount as number) || 0;
  const mood = (data.averageMood as string) || 'neutral';
  const active = (data.activeCount as number) || 0;

  return (
    <div style={{ fontSize: 20, color: 'var(--text)', fontWeight: 600 }}>
      <AnimatedNumber value={count} className="hero-num" />{' '}
      agents, {mood} mood &mdash;{' '}
      <AnimatedNumber value={active} className="hero-num" />{' '}
      <span style={{ color: 'var(--text2)' }}>active now</span>
    </div>
  );
}
```

- [ ] **Step 3: Wire hero into CodeExplorer page**

In `src/dashboard/app/pages/CodeExplorer.tsx`, add the hero at the top of the page using data from `fileStore.stats`:

```typescript
import { HeroText } from '../components/molecules/HeroText';
import { useFileStore } from '../stores/fileStore';

// Inside CodeExplorer component, above the tabs:
const stats = useFileStore((s) => s.stats);

<HeroText
  variant="explorer"
  data={{
    totalFiles: stats?.totalFiles ?? 0,
    totalDirectories: stats?.totalDirectories ?? 0,
    totalExports: stats?.languageBreakdown
      ? Object.values(stats.languageBreakdown).reduce((a, b) => a + b, 0)
      : 0,
  }}
/>
```

- [ ] **Step 4: Wire hero into Sprint page (Board and Team sub-tabs)**

In `src/dashboard/app/pages/Sprint.tsx`:

```typescript
import { HeroText } from '../components/molecules/HeroText';
import { useSprintStore } from '../stores/sprintStore';
import { useAgentStore } from '../stores/agentStore';

// Board sub-tab hero:
const detail = useSprintStore((s) => s.sprintDetail);
{activeSubTab === 'board' && detail && (
  <HeroText
    variant="sprint"
    data={{
      name: detail.name,
      completedCount: detail.completedCount,
      ticketCount: detail.ticketCount,
      velocity: detail.velocity ?? 0,
    }}
  />
)}

// Team sub-tab hero:
const agents = useAgentStore((s) => s.agents);
{activeSubTab === 'team' && (
  <HeroText
    variant="team"
    data={{
      agentCount: agents.length,
      averageMood: 'focused', // computed from agents
      activeCount: agents.filter((a) => a.status === 'active').length,
    }}
  />
)}

// Retro Insights sub-tab hero:
const retroFindings = useSprintStore((s) => s.retroFindings);
const sprints = useSprintStore((s) => s.sprints);
{activeSubTab === 'insights' && (
  <HeroText
    variant="retro"
    data={{
      totalFindings: retroFindings.length,
      totalSprints: sprints.length,
    }}
  />
)}
```

- [ ] **Step 5: Wire hero into ProjectManagement page**

In `src/dashboard/app/pages/ProjectManagement.tsx`:

```typescript
import { HeroText } from '../components/molecules/HeroText';
import { usePlanningStore } from '../stores/planningStore';

const milestones = usePlanningStore((s) => s.milestones);
const activeMilestone = milestones.find((m) => m.status === 'in_progress') ?? milestones[0];
const progress = activeMilestone
  ? Math.round((activeMilestone.completedCount / Math.max(activeMilestone.ticketCount, 1)) * 100)
  : 0;
const daysRemaining = activeMilestone?.targetDate
  ? Math.max(0, Math.ceil((new Date(activeMilestone.targetDate).getTime() - Date.now()) / 86400000))
  : 0;

<HeroText
  variant="planning"
  data={{
    milestoneName: activeMilestone?.title ?? 'None',
    progress,
    daysRemaining,
  }}
/>
```

- [ ] **Step 6: Add CSS for hero-text**

In `src/dashboard/app/index.css`:

```css
.hero-text {
  max-height: 80px;
  padding: 16px 0;
  overflow: hidden;
}
.hero-num {
  color: var(--accent);
  font-family: var(--mono);
  font-weight: 700;
}
.hero-stagger {
  font-size: 20px;
  color: var(--text);
  font-weight: 600;
  line-height: 1.4;
}
```

- [ ] **Step 7: Build verification**

```bash
npm run build && npm test
```

---

### Task 3: Micro-Interactions (T-063) — 3pt

**Files:**
- Modify: `src/dashboard/app/components/molecules/TicketCard.tsx`
- Modify: `src/dashboard/app/components/molecules/AgentCard.tsx`
- Modify: `src/dashboard/app/components/molecules/SprintCard.tsx`
- Modify: `src/dashboard/app/components/molecules/BentoCard.tsx`
- Modify: `src/dashboard/app/components/molecules/FileItem.tsx`
- Modify: `src/dashboard/app/components/molecules/FolderItem.tsx`
- Modify: `src/dashboard/app/components/molecules/TabBar.tsx`
- Modify: `src/dashboard/app/components/atoms/Button.tsx`
- Modify: `src/dashboard/app/components/atoms/Skeleton.tsx`
- Modify: `src/dashboard/app/components/atoms/Stat.tsx`
- Create: `src/dashboard/app/components/atoms/Toast.tsx`
- Create: `src/dashboard/app/components/molecules/ToastContainer.tsx`
- Modify: `src/dashboard/app/stores/uiStore.ts`

**Commit message:** `feat(dashboard): add micro-interactions — hover lift, count-up, shimmer, toast, tab slide`

- [ ] **Step 1: Card hover — lift + shadow spring**

Apply `cardHover` variants from `lib/motion.ts` to all card molecules. Each card's root element becomes `motion.div`:

```typescript
// Pattern applied to TicketCard, AgentCard, SprintCard, BentoCard:
import { motion, useReducedMotion } from 'framer-motion';
import { cardHover, withReducedMotion } from '../../lib/motion';

export function TicketCard({ ticket }: TicketCardProps) {
  const reduced = useReducedMotion();
  const hv = withReducedMotion(cardHover, reduced);

  return (
    <motion.div
      className="ticket-card"
      variants={hv}
      initial="rest"
      whileHover="hover"
    >
      {/* existing card content unchanged */}
    </motion.div>
  );
}
```

- [ ] **Step 2: Stat count-up animation**

Modify `src/dashboard/app/components/atoms/Stat.tsx` to use `AnimatedNumber`:

```typescript
import { AnimatedNumber } from './AnimatedNumber';

export function Stat({ value, label, ...rest }: StatProps) {
  return (
    <div className="stat" {...rest}>
      <AnimatedNumber value={typeof value === 'number' ? value : 0} className="stat-value" />
      <span className="stat-label">{label}</span>
    </div>
  );
}
```

- [ ] **Step 3: Skeleton shimmer effect**

Replace static pulse with CSS shimmer in `src/dashboard/app/components/atoms/Skeleton.tsx`:

```typescript
import { motion, useReducedMotion } from 'framer-motion';

export function Skeleton({ width, height, className }: SkeletonProps) {
  const reduced = useReducedMotion();

  return (
    <div
      className={`skeleton ${className ?? ''}`}
      style={{ width, height, position: 'relative', overflow: 'hidden' }}
    >
      {!reduced && (
        <motion.div
          className="skeleton-shimmer"
          initial={{ x: '-100%' }}
          animate={{ x: '100%' }}
          transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)',
          }}
        />
      )}
    </div>
  );
}
```

Add CSS in `index.css`:
```css
.skeleton {
  background: var(--surface2);
  border-radius: 6px;
}
.skeleton-shimmer {
  pointer-events: none;
}
```

- [ ] **Step 4: Button press scale**

Modify `src/dashboard/app/components/atoms/Button.tsx`:

```typescript
import { motion, useReducedMotion } from 'framer-motion';
import { buttonPress } from '../../lib/motion';

export function Button({ children, variant = 'primary', ...props }: ButtonProps) {
  const reduced = useReducedMotion();

  return (
    <motion.button
      className={`btn btn-${variant}`}
      {...(reduced ? {} : buttonPress)}
      {...props}
    >
      {children}
    </motion.button>
  );
}
```

- [ ] **Step 5: Toast notifications — slide-in from bottom-right**

Create `src/dashboard/app/components/atoms/Toast.tsx`:

```typescript
import { motion } from 'framer-motion';
import { spring } from '../../lib/motion';

export interface ToastData {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export function Toast({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: string) => void }) {
  const colors = {
    success: 'var(--accent)',
    error: '#ef4444',
    info: 'var(--text2)',
  };

  return (
    <motion.div
      layout
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1, transition: spring.bouncy }}
      exit={{ x: 100, opacity: 0, transition: { duration: 0.2 } }}
      onClick={() => onDismiss(toast.id)}
      style={{
        padding: '12px 20px',
        borderRadius: 10,
        background: 'var(--surface)',
        border: `1px solid ${colors[toast.type]}`,
        color: 'var(--text)',
        fontSize: 13,
        cursor: 'pointer',
        marginTop: 8,
        boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
      }}
    >
      {toast.message}
    </motion.div>
  );
}
```

Create `src/dashboard/app/components/molecules/ToastContainer.tsx`:

```typescript
import { AnimatePresence } from 'framer-motion';
import { Toast } from '../atoms/Toast';
import { useUIStore } from '../../stores/uiStore';

export function ToastContainer() {
  const { toasts, dismissToast } = useUIStore();

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column-reverse',
    }}>
      <AnimatePresence>
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onDismiss={dismissToast} />
        ))}
      </AnimatePresence>
    </div>
  );
}
```

Add toast state to `uiStore.ts`:

```typescript
// Add to UIStore interface:
toasts: ToastData[];
addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
dismissToast: (id: string) => void;

// Add to store implementation:
toasts: [],
addToast: (message, type = 'success') => {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
  // Auto-dismiss after 4 seconds
  setTimeout(() => get().dismissToast(id), 4000);
},
dismissToast: (id) =>
  set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
```

Render `<ToastContainer />` in `App.tsx` at the root level.

- [ ] **Step 6: Tab underline animated slide**

Modify `src/dashboard/app/components/molecules/TabBar.tsx`:

```typescript
import { motion, useReducedMotion } from 'framer-motion';
import { spring } from '../../lib/motion';

export function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  const reduced = useReducedMotion();

  return (
    <div className="tab-bar" style={{ position: 'relative' }}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
          {activeTab === tab.id && (
            <motion.div
              className="tab-indicator"
              layoutId="tab-indicator"
              transition={reduced ? { duration: 0 } : spring.stiff}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 2,
                background: 'var(--accent)',
                borderRadius: 1,
              }}
            />
          )}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: Tree expand/collapse height spring**

Modify `src/dashboard/app/components/molecules/FolderItem.tsx` to wrap children in `motion.div` with `expandVariants`:

```typescript
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { expandVariants, withReducedMotion } from '../../lib/motion';

export function FolderItem({ folder, expanded, children, onToggle }: FolderItemProps) {
  const reduced = useReducedMotion();
  const ev = withReducedMotion(expandVariants, reduced);

  return (
    <div className="folder-item">
      <div className="folder-row" onClick={onToggle}>
        <motion.span
          className="chevron"
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 25 }}
        >
          &#9654;
        </motion.span>
        <span className="folder-name">{folder.name}</span>
        <span className="folder-count">{folder.fileCount}</span>
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            variants={ev}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 8: Build verification**

```bash
npm run build && npm test
```

---

### Task 4: Landing Page Animation Rewrite (T-064) — 3pt

**Files:**
- Create: `src/dashboard/app/components/organisms/LandingAnimation.tsx`
- Modify: `src/dashboard/app/App.tsx`

**Commit message:** `feat(dashboard): replace CSS landing animation with Framer Motion orchestrated sequence`

- [ ] **Step 1: Create LandingAnimation component — `src/dashboard/app/components/organisms/LandingAnimation.tsx`**

Replaces the CSS `@keyframes`-based landing from `dashboard.html` with a Framer Motion orchestrated 5-phase sequence. Plays once per session (sessionStorage), has a skip button.

```typescript
// src/dashboard/app/components/organisms/LandingAnimation.tsx
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { spring } from '../../lib/motion';

const SESSION_KEY = 'mcp-landing-played';

export function LandingAnimation({ onComplete }: { onComplete: () => void }) {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(() => {
    // Only show once per session
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SESSION_KEY)) {
      return false;
    }
    return true;
  });

  const dismiss = useCallback(() => {
    setVisible(false);
    sessionStorage.setItem(SESSION_KEY, '1');
    onComplete();
  }, [onComplete]);

  // Auto-dismiss after animation completes (~4s)
  useEffect(() => {
    if (!visible) {
      onComplete();
      return;
    }
    if (reduced) {
      dismiss();
      return;
    }
    const timer = setTimeout(dismiss, 4500);
    return () => clearTimeout(timer);
  }, [visible, reduced, dismiss]);

  if (!visible) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="landing"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05, transition: { duration: 0.5 } }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: '#0c0c10', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0, ...spring.bouncy }}
            style={{ fontSize: 48, fontWeight: 800, color: 'var(--text)', letterSpacing: -2, marginBottom: 8 }}
          >
            code<span style={{ color: 'var(--accent)' }}>context</span>
          </motion.div>

          {/* Subtitle */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            style={{
              fontSize: 16, color: 'var(--text2)', marginBottom: 48,
              textAlign: 'center', maxWidth: 500, lineHeight: 1.6,
            }}
          >
            AI-native codebase intelligence.
          </motion.div>

          {/* Animation Canvas — 5 Phases */}
          <div style={{ width: 620, height: 340, position: 'relative', marginBottom: 48 }}>

            {/* Phase 1: Grid lines draw in (0.0s - 0.6s) */}
            {[0, 1, 2, 3, 4].map((i) => (
              <motion.div
                key={`hline-${i}`}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.1 * i, duration: 0.4, ease: 'easeOut' }}
                style={{
                  position: 'absolute', top: 68 * i, left: 0, right: 0,
                  height: 1, background: 'var(--border)', transformOrigin: 'left',
                }}
              />
            ))}
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <motion.div
                key={`vline-${i}`}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: 0.1 * i + 0.05, duration: 0.4, ease: 'easeOut' }}
                style={{
                  position: 'absolute', left: 124 * i, top: 0, bottom: 0,
                  width: 1, background: 'var(--border)', transformOrigin: 'top',
                }}
              />
            ))}

            {/* Phase 2: File nodes scale in (0.6s - 1.4s) */}
            {[
              { x: 40, y: 40, label: 'src/', color: '#3b82f6' },
              { x: 170, y: 100, label: 'tools.ts', color: '#10b981' },
              { x: 300, y: 60, label: 'schema.ts', color: '#f59e0b' },
              { x: 430, y: 120, label: 'test/', color: '#8b5cf6' },
              { x: 100, y: 180, label: 'hooks/', color: '#ec4899' },
              { x: 350, y: 200, label: 'stores/', color: '#06b6d4' },
            ].map((node, i) => (
              <motion.div
                key={`node-${i}`}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.6 + 0.12 * i, ...spring.bouncy }}
                style={{
                  position: 'absolute', left: node.x, top: node.y,
                  padding: '4px 10px', borderRadius: 6, fontSize: 11,
                  background: `${node.color}22`, color: node.color,
                  border: `1px solid ${node.color}44`, fontFamily: 'var(--mono)',
                }}
              >
                {node.label}
              </motion.div>
            ))}

            {/* Phase 3: Sprint board slides in (1.4s - 2.2s) */}
            <motion.div
              initial={{ x: 200, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 1.4, ...spring.default }}
              style={{
                position: 'absolute', right: 0, top: 60, width: 160, height: 180,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 10, padding: 12, fontSize: 10, color: 'var(--text2)',
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 8, fontSize: 11 }}>Sprint Board</div>
              {['TODO', 'IN PROGRESS', 'DONE'].map((col, i) => (
                <motion.div
                  key={col}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.6 + 0.15 * i, ...spring.default }}
                  style={{ marginBottom: 4, padding: '3px 6px', background: 'var(--surface2)', borderRadius: 4 }}
                >
                  {col}
                </motion.div>
              ))}
            </motion.div>

            {/* Phase 4: Agent circles pop in (2.2s - 3.0s) */}
            {[
              { x: 80, y: 260, emoji: '🏗️' },
              { x: 180, y: 280, emoji: '🧪' },
              { x: 280, y: 260, emoji: '🔐' },
              { x: 380, y: 280, emoji: '📋' },
            ].map((agent, i) => (
              <motion.div
                key={`agent-${i}`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 2.2 + 0.15 * i, ...spring.bouncy }}
                style={{
                  position: 'absolute', left: agent.x, top: agent.y,
                  width: 32, height: 32, borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', fontSize: 16,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                }}
              >
                {agent.emoji}
              </motion.div>
            ))}

            {/* Phase 5: Labels typewriter in (3.0s - 3.8s) */}
            {[
              { x: 40, y: 310, text: '27 MCP tools' },
              { x: 200, y: 310, text: '58 tests' },
              { x: 360, y: 310, text: '9 agents' },
            ].map((label, i) => (
              <motion.div
                key={`label-${i}`}
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 'auto', opacity: 1 }}
                transition={{ delay: 3.0 + 0.2 * i, duration: 0.4, ease: 'easeOut' }}
                style={{
                  position: 'absolute', left: label.x, top: label.y,
                  overflow: 'hidden', whiteSpace: 'nowrap', fontSize: 11,
                  color: 'var(--accent)', fontFamily: 'var(--mono)', fontWeight: 600,
                }}
              >
                {label.text}
              </motion.div>
            ))}
          </div>

          {/* Skip / Enter button */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            onClick={dismiss}
            style={{
              padding: '16px 48px', fontSize: 16, fontWeight: 600,
              background: 'var(--accent)', color: 'white', border: 'none',
              borderRadius: 12, cursor: 'pointer', fontFamily: 'var(--font)',
            }}
          >
            Enter Dashboard
          </motion.button>

          <div style={{
            position: 'absolute', bottom: 24, fontSize: 11,
            color: 'var(--text3)', fontFamily: 'var(--mono)',
          }}>
            Press Enter or click to skip
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Wire LandingAnimation into App.tsx**

```typescript
import { LandingAnimation } from './components/organisms/LandingAnimation';

function App() {
  const [landingDone, setLandingDone] = useState(false);

  return (
    <>
      {!landingDone && <LandingAnimation onComplete={() => setLandingDone(true)} />}
      <div className="app-shell" style={{ opacity: landingDone ? 1 : 0 }}>
        {/* existing app content */}
      </div>
    </>
  );
}
```

- [ ] **Step 3: Add keyboard skip handler**

```typescript
// In LandingAnimation, add useEffect for Enter/Escape key:
useEffect(() => {
  if (!visible) return;
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Escape') dismiss();
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, [visible, dismiss]);
```

- [ ] **Step 4: Remove old CSS @keyframes from `dashboard.html`**

Note: Since Sprint 9 replaces `dashboard.html` with the React app, the old CSS animations in `dashboard.html` are no longer served. No changes needed to the old file — it is superseded by the React build output.

- [ ] **Step 5: Build verification**

```bash
npm run build && npm test
```

---

### Task 5: Documentation Update (T-065) — 3pt

**Files:**
- Modify: `README.md`
- Create: `docs/ARCHITECTURE.md`
- Modify: `.claude/scrum/COMPONENT_TREE.md`

**Commit message:** `docs: update README, create ARCHITECTURE.md, update component tree with Sprint 10 additions`

- [ ] **Step 1: Update README.md architecture section**

Add a new `## Architecture` section after the existing intro. Cover the React + Vite + Zustand stack:

```markdown
## Architecture

The dashboard is a React 18 + TypeScript single-page application built with Vite and served by the MCP server.

### Stack
| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | React 18 | Component-based UI |
| Build | Vite | Sub-3s builds, HMR, proxy |
| State | Zustand | 5 stores (file, sprint, agent, planning, UI) |
| Animation | Framer Motion | Page transitions, micro-interactions, hero text |
| Styling | CSS variables + Tailwind | Dark theme, design tokens |
| Types | TypeScript strict | End-to-end type safety |

### Data Flow
```
Browser → React App → Zustand Stores → API Client → MCP Server (SQLite)
                              ↑
                    SSE (useEventSource) — live updates
```

### Build
```bash
npm run dashboard:build   # Vite builds to dist/dashboard/
npm run dashboard:dev     # Vite dev server with API proxy
npm run build             # Full build: MCP server + dashboard
```
```

- [ ] **Step 2: Create `docs/ARCHITECTURE.md`**

Full architecture document covering all 4 layers:

```markdown
# Architecture

## Overview

The MCP Server is a TypeScript application that provides AI-native codebase intelligence through the Model Context Protocol. It consists of two runtime components: an MCP server (stdio transport) and an HTTP dashboard server (serves the React SPA + REST API + SSE).

## Component Hierarchy (Atomic Design)

```
src/dashboard/app/
├── atoms/          8 components — Badge, Button, Dot, Icon, Input, Skeleton, Stat, Tooltip
│                   + AnimatedNumber, Toast, ShimmerSkeleton (Sprint 10)
├── molecules/     11 components — FileItem, FolderItem, TicketCard, AgentCard, SprintCard,
│                   BentoCard, StatGroup, SearchBar, TabBar, SubTabBar, MarkdownRenderer
│                   + HeroText, ToastContainer (Sprint 10)
├── organisms/     12 components — FileTree, KanbanBoard, BentoGrid, TeamGrid, SprintList,
│                   SprintDetail, DependencyGraph, GanttChart, MilestoneList, VisionEditor,
│                   SprintPlanner, Topbar
│                   + LandingAnimation (Sprint 10)
├── templates/      3 layouts — ExplorerLayout, SprintLayout, PlanningLayout
└── pages/          3 pages — CodeExplorer, Sprint, ProjectManagement
```

## State Management (Zustand)

5 stores with clear separation of concerns:

| Store | Type | Responsibilities |
|-------|------|-----------------|
| `fileStore` | Server state | Files, directories, file detail, changes, graph, stats |
| `sprintStore` | Server state | Sprints, tickets, retro findings |
| `agentStore` | Server state | Agent registry with status |
| `planningStore` | Server state | Milestones, vision, Gantt, backlog |
| `uiStore` | UI state | Page, tab, sidebar, search, folders, toasts |

### Patterns
- **Request deduplication** via inflight Map in API client
- **Optimistic updates** for milestone/vision mutations
- **SSE-driven refresh** via useEventSource hook
- **URL hash sync** via useHashRouter hook
- **localStorage persistence** for sidebar/folder state

## API Layer

Typed fetch wrapper (`lib/api.ts`) with:
- Generic `get<T>`, `post<T>`, `put<T>`, `patch<T>`, `delete<T>` methods
- Inflight request deduplication (concurrent identical GETs share one promise)
- Automatic error extraction from response body

## Animation Layer (Sprint 10)

Framer Motion provides 4 categories of animation:
1. **Page transitions** — AnimatePresence + pageVariants (fade/slide, 250ms)
2. **Hero text** — Per-page animated text with count-up, stagger, typewriter
3. **Micro-interactions** — Card hover lift, button press, tab slide, tree expand
4. **Landing sequence** — 5-phase orchestrated intro (3-4s, once per session)

All animations respect `prefers-reduced-motion` via Framer Motion's `useReducedMotion()`.

Shared variants live in `lib/motion.ts` — no inline variant objects in components.

## Build Pipeline

```
src/dashboard/app/main.tsx
        ↓ Vite (esbuild)
dist/dashboard/index.html + assets/
        ↓ served by
src/dashboard/dashboard.ts (Express-like HTTP server)
```

- `npm run dashboard:dev` — Vite dev server on :5173, proxies /api/* to :3000
- `npm run dashboard:build` — Production build to dist/dashboard/
- `npm run build` — Full: tsc (MCP server) + Vite (dashboard)

## MCP Tools (27 total)

### Code Context (read)
`get_file_context`, `search_files`, `find_symbol`, `get_changes`, `set_description`, `set_directory_description`, `set_change_reason`, `index_directory`, `query`, `execute`

### Scrum (read/write)
`create_sprint`, `update_sprint`, `get_sprint`, `list_sprints`, `create_ticket`, `update_ticket`, `get_ticket`, `list_tickets`, `create_blocker`, `resolve_blocker`, `add_retro_finding`, `list_retro_findings`, `export_sprint_report`, `search_scrum`, `sync_scrum_data`, `get_sprint_instructions`, `log_bug`
```

- [ ] **Step 3: Update MCP tool reference with Sprint 8 tools**

In the `docs/ARCHITECTURE.md` MCP Tools section, add Sprint 8 tools:

```markdown
### Planning (Sprint 8)
`create_milestone`, `update_milestone`, `link_ticket_to_milestone`, `update_vision`, `plan_sprint`, `get_backlog`
```

Also update the total count from 27 to 33 (or current actual count).

- [ ] **Step 4: Update `.claude/scrum/COMPONENT_TREE.md` with Sprint 10 additions**

Add the new components introduced in Sprint 10 to the directory structure:

```markdown
## Sprint 10 Additions

### New Components
| Component | Type | Purpose |
|-----------|------|---------|
| `AnimatedNumber` | Atom | Spring-driven count-up from 0 to target |
| `Toast` | Atom | Single toast notification |
| `ShimmerSkeleton` | Atom | Shimmer loading placeholder |
| `HeroText` | Molecule | Per-page animated hero text (5 variants) |
| `ToastContainer` | Molecule | Toast stack manager |
| `LandingAnimation` | Organism | 5-phase Framer Motion intro sequence |

### New Utilities
| File | Purpose |
|------|---------|
| `lib/motion.ts` | Shared motion variants, springs, reduced-motion helper |

### Modified Components (animation added)
All card molecules (TicketCard, AgentCard, SprintCard, BentoCard) — hover lift spring
Button — press scale(0.97)
Skeleton — shimmer effect
Stat — count-up on mount
TabBar — animated sliding underline
FolderItem — height spring expand/collapse
KanbanBoard — physical card drag interactions
All pages — AnimatePresence page transitions + hero text
App.tsx — AnimatePresence router wrapper + landing animation
```

Update the total component count:
```markdown
**Total: 53 components** — 11 atoms, 13 molecules, 13 organisms, 3 templates, 3 pages, 8 hooks, 5 stores, 4 lib files, 1 types file
```

- [ ] **Step 5: Verify documentation accuracy**

Cross-check all documentation against actual file structure:

```bash
# Verify component files exist
ls src/dashboard/app/components/atoms/
ls src/dashboard/app/components/molecules/
ls src/dashboard/app/components/organisms/
ls src/dashboard/app/lib/

# Verify MCP tools count
grep -c "server.setRequestHandler.*CallToolRequest" src/scrum/tools.ts || \
grep -c "name:" src/scrum/tools.ts

# Build passes
npm run build && npm test
```

- [ ] **Step 6: Final build verification**

```bash
npm run build && npm test
```
