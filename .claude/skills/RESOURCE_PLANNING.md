# Resource Planning

## Team Capacity Per Sprint

### Story Point Budget

A 5-day sprint with 8 roles has a theoretical maximum capacity. In practice, overhead (planning, QA, retro) consumes Day 1, Day 4, and Day 5 for most roles. Pure implementation happens on Day 2-3.

| Role | Implementation Days | Points/Sprint | Notes |
|------|-------------------|---------------|-------|
| Frontend Developer | 2.5 | 8-13 | Day 4 afternoon for polish |
| Backend Developer | 2.5 | 8-13 | Day 4 afternoon for edge cases |
| Architect | 1.5 | 3-5 | Reviews + infrastructure tasks only |
| Lead Developer | 1.0 | 2-3 | Mostly review/conflict resolution, occasional coding |
| Security Specialist | 0.5 (Day 4) | N/A | Security review alongside QA -- does not take story points |
| QA Engineer | 1.0 (Day 4) | N/A | QA does not take story points -- they verify |
| PO | 0 | N/A | Vision, tickets, milestones -- not implementation |
| Scrum Master | 0 | N/A | Process, blockers -- not implementation |
| Manager | 0 | N/A | Review, cost control -- not implementation |

**Team Sprint Capacity: 21-34 story points**

Planning target: **19 story points** (rolling average from S1-S4: 21, 11, 19, 24).

### Velocity Tracking

After each sprint, record actual completed points. After 3 sprints, use the rolling average as the planning target instead of the default 25.

| Sprint | Committed | Completed | Velocity |
|--------|-----------|-----------|----------|
| Sprint 1 (setup) | 21 | 21 | 21 |
| Sprint 2 | 27 | 11 | 11 |

---

## Role Allocation Rules

### Who Works on What

| Work Type | Primary | Support | Approval |
|-----------|---------|---------|----------|
| UI components, dashboard pages | Frontend Dev | -- | Lead Dev (review) |
| API endpoints, services | Backend Dev | -- | Lead Dev (review) |
| Database schema changes | Backend Dev | Architect | Architect (approval required) |
| CI/CD, deployment config | Architect | -- | Manager (cost review) |
| System design decisions | Architect | Lead Dev | Manager (cost review) |
| Cross-cutting refactors | Lead Dev | Frontend + Backend | Architect (impact review) |
| New dependency addition | Requesting dev | -- | Manager (approval required) |
| Bug fixes | Original dev | QA (verify) | QA (sign-off) |

### Escalation Path

```
Dev stuck --> Scrum Master (facilitates)
Technical conflict --> Lead Dev (decides)
Architecture decision --> Architect (proposes) --> Manager (cost check) --> Lead Dev (final call)
Scope question --> PO (decides)
Cost concern --> Manager (decides)
```

---

## Cost Efficiency Guidelines

### The Manager's Three Questions

Before approving any significant work:

1. **Do we need this now?** If the answer is "it would be nice" or "we might need it later" -- the answer is no. Build it when there is a concrete, current requirement.

2. **What is the simplest thing that works?** Not the most elegant. Not the most extensible. The simplest thing that solves the actual problem for actual users today.

3. **What does this cost us in 6 months?** Every dependency, every service, every infrastructure choice has a maintenance cost. If we cannot maintain it with this team size, we cannot afford it.

### Cost Rules

- **Managed services over self-hosted.** We are a small team. We do not run our own databases, queues, or caches unless there is no managed alternative.
- **Built-in over third-party.** Node.js built-in modules before npm packages. TypeScript standard library before utility libraries.
- **One way to do things.** No competing libraries for the same purpose. If we use X for HTTP, we use X everywhere.
- **No premature optimization.** Profile first. Optimize the measured bottleneck, not the imagined one.
- **70% solution today beats 100% solution in 3 weeks.** Ship the useful thing now. Iterate based on real feedback.

---

## When to Scale Up / Down

### Scale Up (add capacity) When:
- Sprint velocity is consistently below 60% of committed points for 2+ sprints
- Critical path work is blocked because a single role is overloaded
- QA Day consistently overflows (too many bugs to process in one day)
- A new milestone requires expertise the current team does not have

### Scale Down (reduce scope) When:
- Team is consistently completing work by Day 3 with nothing left to do
- Sprint commitments are being padded with low-value tickets to fill capacity
- A role has had no assigned work for 2+ sprints

### Never Scale:
- In the middle of a sprint
- To "get ahead" on future milestones
- Because one sprint was unusually slow or fast (wait for a pattern)

---

## Technology Decision Framework

### The Boring Technology Principle

Every technology choice carries a maintenance cost. We have a limited "innovation budget" -- we spend it only where it creates clear, measurable value.

**Decision Matrix:**

| Factor | Preferred | Acceptable | Avoid |
|--------|-----------|------------|-------|
| Maturity | 3+ years in production use | 1-3 years, growing adoption | < 1 year, experimental |
| Community | Large, active, well-documented | Medium, stable | Small, single-maintainer |
| Hosting | Fully managed (Vercel, managed DB) | Semi-managed (containers) | Self-hosted infrastructure |
| Complexity | Single purpose, small API surface | Moderate API, good docs | Kitchen-sink frameworks |
| Lock-in | Standard protocols, easy to swap | Some lock-in with clear migration path | Deep vendor lock-in, proprietary formats |

**Current Technology Choices (locked unless compelling reason to change):**

- Language: TypeScript (strict mode)
- Runtime: Node.js
- Protocol: MCP (Model Context Protocol)
- Hosting: TBD per milestone
- Package manager: npm (or whatever is already in the project)

---

## Dependency Review Checklist

**Every new npm package requires Manager approval.** The requesting dev must answer:

### Before Adding a Dependency

- [ ] **What problem does this solve?** (one sentence)
- [ ] **Can we solve it without a dependency?** (built-in Node.js, simple utility function, existing dependency)
- [ ] **Package stats check:**
  - Weekly downloads: > 50,000
  - Last publish: within 12 months
  - Open issues: reasonable ratio to usage
  - Maintainers: > 1 active maintainer
  - License: MIT, Apache 2.0, or BSD (no GPL in production dependencies)
- [ ] **Bundle size impact:** What does this add to the build?
- [ ] **Transitive dependencies:** How many sub-dependencies does this pull in?
- [ ] **Is there a lighter alternative?** (e.g., `date-fns` over `moment`, `zod` over `joi` + `@types/joi`)

### Automatic Rejection Criteria

- Package with 0 updates in 24+ months (abandoned)
- Package that duplicates functionality of an existing dependency
- Package with known critical CVEs and no fix timeline
- Package that requires native compilation (unless absolutely necessary)
- "Convenience" packages that save < 20 lines of code

### Approved Dependencies (pre-approved, no review needed)

Maintain this list as the project evolves:
- TypeScript, ts-node, tsx (language tooling)
- @modelcontextprotocol/sdk (core protocol -- this is the product)
- vitest, playwright (testing)
- eslint, prettier (code quality)

---

## Sprint Cost Tracking

After each sprint, the Manager records:

| Metric | Value |
|--------|-------|
| Story points committed | -- |
| Story points completed | -- |
| New dependencies added | -- |
| Infrastructure changes | -- |
| Estimated monthly cost delta | -- |

This data feeds into quarterly reviews and scaling decisions.
