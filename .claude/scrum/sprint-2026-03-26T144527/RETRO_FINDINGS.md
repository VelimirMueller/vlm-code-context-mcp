# Retrospective Findings -- Sprint 1 (Setup Sprint)

## What Went Well (keep doing)
- **PO**: Product vision and milestones were created in one pass with clear success criteria. Linking every ticket to a milestone kept focus sharp.
- **Manager**: Rejecting zero tickets was the right call -- Sprint 1 was pure foundation work. The overengineering checklist was useful even when nothing got rejected.
- **Scrum Master**: 5-day process structure worked well on paper. File ownership matrix prevented confusion about who updates what.
- **Architect**: Codebase audit revealed clear gaps (no tests, regex parsing, no CI). Having a concrete list beats guessing.
- **Lead Dev**: Keeping the lead out of day-to-day decisions during a setup sprint was correct. No conflicts to resolve.
- **Frontend Dev**: DESIGN.md captured what senior engineers would notice immediately. Zero-dependency dashboard constraint is the right call for an npm tool.
- **Backend Dev**: Gap analysis identified 10 concrete weaknesses. Prioritizing by "what would a senior engineer hit first" was effective.

## What Went Wrong (stop doing)
- **All**: Sprint 1 PLANNING.md had analysis tickets (T-001 to T-006) while TICKETS.md had implementation tickets (T-001 to T-012). Two numbering schemes caused confusion. **Fix: single ticket namespace across the sprint.**
- **Scrum Master**: No blocker monitoring was needed in a setup sprint, but the process wasn't tested under real implementation pressure. Sprint 2 will be the real test.
- **QA**: QA had nothing to do in Sprint 1 since there was no code to test. Wasted capacity.

## What to Try Next Sprint (experiments)

### ACTION 1: Unified ticket IDs across all sprint files
Starting Sprint 2, PLANNING.md references the same ticket IDs as TICKETS.md. No separate numbering. Owner: Scrum Master.

### ACTION 2: QA writes acceptance test specs during implementation days (Day 2-3) instead of waiting for Day 4
QA uses Day 2-3 to prepare test plans and fixture data so Day 4 QA is pure execution, not planning. Owner: QA.
