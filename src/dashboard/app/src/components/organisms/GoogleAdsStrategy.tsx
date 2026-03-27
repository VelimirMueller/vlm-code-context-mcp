import { AnimatedNumber } from '@/components/atoms/AnimatedNumber';
import { BentoCard } from '@/components/molecules/BentoCard';

// ─── Performance Max Campaign Card ──────────────────────────────────────────

function PerformanceMaxCard() {
  const assetGroups = [
    { name: 'Developer Tools', headlines: ['AI-Powered Code Context', 'Ship Faster with MCP', 'Your AI IT Department'], descriptions: ['Autonomous scrum agents manage your project end-to-end.'] },
    { name: 'DevOps & Platform', headlines: ['MCP Server for Claude', 'Zero-Config Project Management', 'npm install → Full IT Team'], descriptions: ['27+ MCP tools. Dashboard included. One command setup.'] },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Performance Max Campaign</div>
      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 8 }}>
        Google's AI-driven campaign type. Runs across Search, Display, YouTube, Gmail, and Discover with a single campaign.
        Ideal for developer tools — broad reach, automated optimization.
      </div>
      {assetGroups.map((group) => (
        <div key={group.name} style={{ padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', marginBottom: 8 }}>Asset Group: {group.name}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {group.headlines.map((h, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--blue)' }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginRight: 6 }}>H{i + 1}</span>
                {h}
              </div>
            ))}
            {group.descriptions.map((d, i) => (
              <div key={i} style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text3)', marginRight: 6 }}>D{i + 1}</span>
                {d}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Smart Bidding Strategies ────────────────────────────────────────────────

function SmartBiddingPanel() {
  const strategies = [
    { name: 'Target CPA', desc: 'Set a cost-per-acquisition target. Google optimizes bids to get conversions at your target cost.', recommended: true, estCpa: '$2.50–5.00', bestFor: 'npm install conversions' },
    { name: 'Maximize Conversions', desc: 'Spend full budget to get as many conversions as possible. Best when starting out.', recommended: false, estCpa: '$3.00–8.00', bestFor: 'Early campaigns' },
    { name: 'Target ROAS', desc: 'Optimize for return on ad spend. Best when you have revenue data (e.g., paid tier).', recommended: false, estCpa: 'Variable', bestFor: 'Paid tier upsell' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Smart Bidding Strategies</div>
      {strategies.map((s) => (
        <div key={s.name} style={{ padding: '12px 16px', background: 'var(--surface)', border: `1px solid ${s.recommended ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, position: 'relative' }}>
          {s.recommended && (
            <span style={{ position: 'absolute', top: -8, right: 12, fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'var(--accent)', color: '#000', textTransform: 'uppercase' }}>
              Recommended
            </span>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{s.name}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)' }}>{s.estCpa}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5 }}>{s.desc}</div>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Best for: {s.bestFor}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Keyword Strategy ────────────────────────────────────────────────────────

function KeywordStrategy() {
  const keywords = [
    { keyword: 'MCP server npm', volume: '1.2K', competition: 'Low', bid: '$0.80–1.50', intent: 'High' },
    { keyword: 'AI code context tool', volume: '880', competition: 'Low', bid: '$1.00–2.00', intent: 'High' },
    { keyword: 'Claude MCP integration', volume: '2.4K', competition: 'Medium', bid: '$1.50–3.00', intent: 'High' },
    { keyword: 'AI project management tool', volume: '12K', competition: 'High', bid: '$4.00–8.00', intent: 'Medium' },
    { keyword: 'automated scrum tool', volume: '3.6K', competition: 'Medium', bid: '$2.00–4.00', intent: 'High' },
    { keyword: 'npm AI developer tools', volume: '1.8K', competition: 'Low', bid: '$0.60–1.20', intent: 'Medium' },
    { keyword: 'code explorer MCP', volume: '480', competition: 'Low', bid: '$0.40–0.80', intent: 'Very High' },
    { keyword: 'AI virtual IT department', volume: '320', competition: 'Low', bid: '$0.50–1.00', intent: 'Very High' },
  ];

  const competitionColor: Record<string, string> = { Low: 'var(--accent)', Medium: 'var(--orange)', High: 'var(--red)' };
  const intentColor: Record<string, string> = { 'Very High': 'var(--accent)', High: 'var(--blue)', Medium: 'var(--text3)' };

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Long-Tail Keyword Strategy</div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 70px 90px 60px', gap: 8, padding: '8px 16px', borderBottom: '1px solid var(--border)', fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase' }}>
          <span>Keyword</span><span>Volume</span><span>Comp.</span><span>Est. Bid</span><span>Intent</span>
        </div>
        {/* Rows */}
        {keywords.map((kw) => (
          <div key={kw.keyword} style={{ display: 'grid', gridTemplateColumns: '1fr 60px 70px 90px 60px', gap: 8, padding: '8px 16px', borderBottom: '1px solid var(--border)', fontSize: 12, alignItems: 'center' }}>
            <span style={{ fontWeight: 500, color: 'var(--text)' }}>{kw.keyword}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>{kw.volume}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: competitionColor[kw.competition] ?? 'var(--text3)' }}>{kw.competition}</span>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text2)' }}>{kw.bid}</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: intentColor[kw.intent] ?? 'var(--text3)' }}>{kw.intent}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Budget Calculator ───────────────────────────────────────────────────────

function BudgetCalculator() {
  const tiers = [
    { name: 'Micro', daily: 5, monthly: 150, impressions: '3K–8K', clicks: '50–120', installs: '5–15', color: 'var(--text3)' },
    { name: 'Starter', daily: 15, monthly: 450, impressions: '10K–25K', clicks: '150–400', installs: '15–50', color: 'var(--blue)' },
    { name: 'Growth', daily: 50, monthly: 1500, impressions: '35K–80K', clicks: '500–1200', installs: '50–150', color: 'var(--accent)' },
  ];

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Campaign Budget Tiers</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {tiers.map((t) => (
          <div key={t.name} style={{ padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: t.color, letterSpacing: '0.05em', marginBottom: 8 }}>{t.name}</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 28, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
              ${t.daily}<span style={{ fontSize: 14, color: 'var(--text3)' }}>/day</span>
            </div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>${t.monthly}/mo</div>
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text3)' }}>Impressions</span><span style={{ color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{t.impressions}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text3)' }}>Clicks</span><span style={{ color: 'var(--text2)', fontFamily: 'var(--mono)' }}>{t.clicks}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text3)' }}>Est. Installs</span><span style={{ color: t.color, fontWeight: 600, fontFamily: 'var(--mono)' }}>{t.installs}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Ad Copy Generator ───────────────────────────────────────────────────────

function AdCopyGenerator() {
  const ads = [
    {
      headlines: ['AI-Powered MCP Server', 'Ship 10x Faster', 'npm install → Full IT Team'],
      descriptions: ['9 AI agents run your scrum: planning, QA, security, retros. Zero human bottleneck. Try it free.', 'One npm package gives you project management, code explorer, Gantt charts, and 27+ MCP tools.'],
      sitelinks: ['Documentation', 'GitHub', 'Dashboard Demo', 'Pricing'],
    },
    {
      headlines: ['Claude MCP Integration', 'Your Code Manages Itself', 'AI Virtual IT Department'],
      descriptions: ['Connect your codebase to Claude via MCP. Get instant context, sprint management, and AI code reviews.', 'From zero to autonomous project management in 60 seconds. Built by AI, for AI-native teams.'],
      sitelinks: ['Quick Start', 'Feature Tour', 'API Reference', 'Blog'],
    },
  ];

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>Responsive Search Ads</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {ads.map((ad, i) => (
          <div key={i} style={{ padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 10 }}>Ad Variant {i + 1}</div>
            {/* Headlines */}
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--blue)', lineHeight: 1.4, marginBottom: 8 }}>
              {ad.headlines.join(' | ')}
            </div>
            {/* Descriptions */}
            {ad.descriptions.map((d, j) => (
              <div key={j} style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 4 }}>{d}</div>
            ))}
            {/* Sitelinks */}
            <div style={{ display: 'flex', gap: 12, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              {ad.sitelinks.map((sl) => (
                <span key={sl} style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 500 }}>{sl}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export function GoogleAdsStrategy() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, padding: '0 20px 20px' }}>
      {/* Hero */}
      <div style={{ padding: '20px 24px', background: 'linear-gradient(135deg, rgba(66,133,244,.08), rgba(52,168,83,.08), rgba(251,188,4,.08), rgba(234,67,53,.08))', border: '1px solid var(--border)', borderRadius: 12 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Google Ads AI Strategy
        </div>
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
          Cheap, effective ad strategies for an MCP server npm package. Target developers, DevOps engineers,
          and AI builders with long-tail keywords and Performance Max campaigns. Budget: $5–50/day.
        </div>
      </div>

      {/* 2-column layout for campaigns + bidding */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <PerformanceMaxCard />
        <SmartBiddingPanel />
      </div>

      {/* Keywords full width */}
      <KeywordStrategy />

      {/* Budget + Ad Copy side by side */}
      <BudgetCalculator />
      <AdCopyGenerator />
    </div>
  );
}
