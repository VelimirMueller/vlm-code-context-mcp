'use client';

import { motion } from 'framer-motion';

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

const stagger = {
  animate: { transition: { staggerChildren: 0.08 } },
};

const features = [
  {
    emoji: '\u{1F4CA}',
    title: 'Dashboard',
    description: 'Sprint tracking, ticket management, kanban boards, and milestone progress at a glance.',
    color: 'var(--blue)',
  },
  {
    emoji: '\u{1F5FA}\uFE0F',
    title: 'Planning',
    description: 'Discovery sprints, backlog management, coverage tracking, and roadmap visualization.',
    color: 'var(--purple)',
  },
  {
    emoji: '\u{1F4C2}',
    title: 'Code Explorer',
    description: 'Codebase navigation with metadata annotations, file descriptions, and symbol search.',
    color: 'var(--accent)',
  },
  {
    emoji: '\u{1F465}',
    title: 'Team',
    description: 'Workload management, mood tracking, agent assignments, and capacity planning.',
    color: 'var(--orange)',
  },
  {
    emoji: '\u{1F50D}',
    title: 'Retro',
    description: 'Sprint retrospectives, findings history, action items, and pattern analysis.',
    color: 'var(--pink)',
  },
  {
    emoji: '\u{1F50C}',
    title: 'Integrations',
    description: 'GitHub sync, real-time SSE updates, bridge status monitoring — extensible via MCP.',
    color: 'var(--blue)',
  },
];

const steps = [
  {
    num: '1',
    title: 'Install the MCP server',
    description: 'Add code-context to your project with npm. One command, zero config.',
    code: 'npm install code-context',
  },
  {
    num: '2',
    title: 'Connect to Claude Code',
    description: 'Register as an MCP server in your Claude Code config. The tools appear automatically.',
    code: 'claude mcp add code-context',
  },
  {
    num: '3',
    title: 'Manage your project',
    description: 'Create sprints, assign tickets, run retros, and explore your codebase — all through natural language.',
    code: '"Create a sprint with 5 tickets for the auth feature"',
  },
];

export function Marketing() {
  return (
    <div style={{ height: '100%', overflow: 'auto' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 24px 64px' }}>

        {/* ── Hero ──────────────────────────────────────────────── */}
        <motion.section
          initial="initial"
          animate="animate"
          variants={stagger}
          style={{ textAlign: 'center', marginBottom: 64 }}
        >
          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 16px',
              background: 'var(--accent-glow)',
              border: '1px solid var(--accent)',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--accent)',
              marginBottom: 20,
              fontFamily: 'var(--mono)',
            }}
          >
            MCP-NATIVE PROJECT MANAGEMENT
          </motion.div>

          <motion.h1
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            style={{
              fontSize: 'clamp(28px, 5vw, 44px)',
              fontWeight: 800,
              color: 'var(--text)',
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              marginBottom: 16,
            }}
          >
            Your AI-powered{' '}
            <span style={{ color: 'var(--accent)' }}>project management</span>{' '}
            brain
          </motion.h1>

          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            style={{
              fontSize: 'clamp(15px, 2vw, 18px)',
              color: 'var(--text2)',
              maxWidth: 600,
              margin: '0 auto 32px',
              lineHeight: 1.6,
            }}
          >
            Sprint planning, ticket management, retrospectives, and codebase exploration —
            all through natural language in Claude Code.
          </motion.p>

          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.5 }}
            style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}
          >
            <a
              href="#get-started"
              onClick={(e) => {
                e.preventDefault();
                document.getElementById('get-started')?.scrollIntoView({ behavior: 'smooth' });
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 28px',
                background: 'var(--accent)',
                color: '#000',
                fontSize: 14,
                fontWeight: 700,
                borderRadius: 10,
                textDecoration: 'none',
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
            >
              Get Started
            </a>
            <a
              href="https://github.com/VelimirMueller/mcp-server"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 28px',
                background: 'var(--surface2)',
                border: '1px solid var(--border2)',
                color: 'var(--text)',
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 10,
                textDecoration: 'none',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              View on GitHub
            </a>
          </motion.div>
        </motion.section>

        {/* ── Features Grid ────────────────────────────────────── */}
        <motion.section
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
          style={{ marginBottom: 64 }}
        >
          <motion.h2
            variants={fadeUp}
            transition={{ duration: 0.4 }}
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--accent)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 8,
              fontFamily: 'var(--mono)',
            }}
          >
            Features
          </motion.h2>
          <motion.h3
            variants={fadeUp}
            transition={{ duration: 0.4 }}
            style={{
              fontSize: 'clamp(20px, 3vw, 28px)',
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '-0.02em',
              marginBottom: 32,
            }}
          >
            Everything you need to manage your project
          </motion.h3>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            {features.map((f) => (
              <motion.div
                key={f.title}
                variants={fadeUp}
                transition={{ duration: 0.4 }}
                style={{
                  padding: '20px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  transition: 'border-color 0.2s',
                }}
                whileHover={{ borderColor: f.color, y: -2 }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'var(--surface3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                  }}
                >
                  {f.emoji}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{f.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{f.description}</div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── How It Works ─────────────────────────────────────── */}
        <motion.section
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
          style={{ marginBottom: 64 }}
        >
          <motion.h2
            variants={fadeUp}
            transition={{ duration: 0.4 }}
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--accent)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: 8,
              fontFamily: 'var(--mono)',
            }}
          >
            How It Works
          </motion.h2>
          <motion.h3
            variants={fadeUp}
            transition={{ duration: 0.4 }}
            style={{
              fontSize: 'clamp(20px, 3vw, 28px)',
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '-0.02em',
              marginBottom: 32,
            }}
          >
            Up and running in three steps
          </motion.h3>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 16,
            }}
          >
            {steps.map((s) => (
              <motion.div
                key={s.num}
                variants={fadeUp}
                transition={{ duration: 0.4 }}
                style={{
                  padding: '24px 20px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'var(--accent)',
                    color: '#000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    fontWeight: 800,
                    flexShrink: 0,
                  }}
                >
                  {s.num}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{s.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>{s.description}</div>
                <div
                  style={{
                    marginTop: 'auto',
                    padding: '10px 14px',
                    background: 'var(--bg)',
                    borderRadius: 8,
                    fontFamily: 'var(--mono)',
                    fontSize: 12,
                    color: 'var(--accent2)',
                    border: '1px solid var(--border)',
                    wordBreak: 'break-all',
                  }}
                >
                  {s.code}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        {/* ── CTA / Get Started ────────────────────────────────── */}
        <motion.section
          id="get-started"
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
          style={{
            padding: '40px 32px',
            background: 'linear-gradient(135deg, rgba(16,185,129,0.06), rgba(59,130,246,0.06))',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            textAlign: 'center',
          }}
        >
          <motion.h2
            variants={fadeUp}
            transition={{ duration: 0.4 }}
            style={{
              fontSize: 'clamp(20px, 3vw, 28px)',
              fontWeight: 700,
              color: 'var(--text)',
              letterSpacing: '-0.02em',
              marginBottom: 12,
            }}
          >
            Ready to get started?
          </motion.h2>
          <motion.p
            variants={fadeUp}
            transition={{ duration: 0.4 }}
            style={{
              fontSize: 14,
              color: 'var(--text2)',
              maxWidth: 520,
              margin: '0 auto 24px',
              lineHeight: 1.6,
            }}
          >
            Install the MCP server and connect it to Claude Code.
            Your entire project management workflow lives inside your AI assistant.
          </motion.p>

          <motion.div
            variants={fadeUp}
            transition={{ duration: 0.4 }}
            style={{
              display: 'inline-block',
              padding: '14px 24px',
              background: 'var(--surface)',
              border: '1px solid var(--border2)',
              borderRadius: 10,
              fontFamily: 'var(--mono)',
              fontSize: 14,
              color: 'var(--accent2)',
              userSelect: 'all',
              cursor: 'text',
            }}
          >
            npm install code-context
          </motion.div>
        </motion.section>

      </div>
    </div>
  );
}
