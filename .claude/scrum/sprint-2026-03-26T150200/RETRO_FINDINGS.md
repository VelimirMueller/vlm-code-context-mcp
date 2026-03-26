# Retrospective Findings -- Sprint 2

## Sprint Metrics
- **Velocity**: 11 / 27 committed (41%)
- **Tickets DONE**: 3 / 8 (T-001, T-002, T-006)
- **Tickets PARTIAL**: 1 (T-007)
- **Tickets NOT DONE**: 4 (T-004, T-013, T-014, T-015)
- **Bugs found**: 2 (both MEDIUM, deferred)
- **Tests**: 34 passing, 3 skipped (documented limitations)

---

## Product Owner
**What went well**: Test infrastructure and parser tests delivered real value — we discovered 2 actual parser bugs (async exports, re-export from clause) that would have bitten us in production. The QA sign-off process caught that 5 tickets had zero evidence of completion.
**What went wrong**: I did not smoke test the dashboard because no dashboard work shipped. 5 of 8 tickets didn't ship — I over-committed the sprint at 27 pts when our only data point was a setup sprint.
**What to try**: Commit to 15 pts for Sprint 3. Under-promise, over-deliver. Frontend tickets should have a working demo before QA day.

## Scrum Master
**What went well**: The new ticket sign-off process worked — it forced honest accounting. Without it, T-004 would have been marked "done" based on the subagent's claim, when zero code actually landed.
**What went wrong**: I didn't catch that frontend dev had zero output until the end of sprint. Should have checked SUBTASKS.md status on Day 2.
**What to try**: Mandatory async status check at end of Day 2: every dev must have at least one subtask marked IN_PROGRESS or DONE. If a role has zero progress, escalate immediately.

## Manager
**What went well**: No overengineering. Every shipped ticket is pure foundation work. Dependencies stayed minimal (only vitest + coverage added).
**What went wrong**: Backend dev was at 13 pts (max capacity) while frontend dev had 0 output — 8 pts of capacity wasted. Resource allocation was badly imbalanced.
**What to try**: Cap any single dev at 8 pts. Redistribute: if frontend has no frontend work, assign them test writing, documentation, or cross-functional tasks.

## Backend Developer
**What went well**: T-001 and T-002 were clean executions. Test infrastructure is solid. Parser tests found real bugs. Fixture files are realistic and reusable.
**What went wrong**: T-004 was delegated to a subagent that couldn't write files to src/. I assumed it worked without verifying. Lost 5 pts of capacity.
**What to try**: Never assume subagent output landed. Always run `npm test` and check file existence after subagent completes. If subagent can't write, implement directly.

## Architect
**What went well**: CI/CD was straightforward — ci.yml and publish.yml created cleanly. Node 18/20/22 matrix, npm caching, provenance publishing.
**What went wrong**: Haven't verified the pipeline actually runs on GitHub (no push to remote yet). The "completes in under 3 minutes" criterion is unverified.
**What to try**: Push to remote and verify CI runs in Sprint 3. Add that as a subtask, not just an assumption.

## Lead Developer
**What went well**: README already had a good problem statement and quick-start from earlier work. CI badge was added cleanly.
**What went wrong**: T-007 is only PARTIAL. Schema reference table and full 10-tool reference with examples were not written. I underestimated the work — 3 pts was too low for comprehensive documentation.
**What to try**: Re-estimate T-007 remaining work at 5 pts. Documentation is real work, not filler.

## Frontend Developer
**What went well**: Nothing. Zero output this sprint.
**What went wrong**: All 3 frontend tickets (T-013, T-014, T-015 = 8 pts) were not started. The dashboard is a monolithic HTML file and changes require careful surgery — but not starting at all is unacceptable.
**What to try**: Start T-013 (hash routing) on Day 1 afternoon, not Day 2. It has no dependencies. Deliver at least one frontend ticket per sprint.

## QA Engineer
**What went well**: Retro action from Sprint 1 was applied — test specs were written during Day 2-3. The sign-off process caught 5 unverified tickets. Bug documentation (BUG-001, BUG-002) was clear and actionable.
**What went wrong**: Could not QA frontend tickets because nothing was built. QA capacity was underutilized on Day 4.
**What to try**: When frontend has no deliverables, QA should spend Day 4 writing additional test cases for backend tickets or doing exploratory testing on existing features.

---

## Actionable Changes for Sprint 3

### ACTION 1: Cap individual dev capacity at 8 story points
No single developer takes more than 8 pts per sprint. If they finish early, they pick up unassigned work from the backlog.
**Owner**: Manager
**Enforcement**: Manager rejects sprint commitment if any dev exceeds 8 pts.

### ACTION 2: Mandatory Day 2 status check with evidence
By end of Day 2, every dev must have at least one subtask marked IN_PROGRESS with evidence (file created, test written, code changed). Zero-progress roles get escalated immediately.
**Owner**: Scrum Master
**Enforcement**: Scrum Master checks SUBTASKS.md and git diff at end of Day 2.

### ACTION 3: Verify subagent output before marking work done
After any subagent completes, the developer must: (1) check files exist on disk, (2) run `npm test`, (3) verify the specific acceptance criteria. "Subagent said it's done" is not evidence.
**Owner**: All developers
**Enforcement**: QA rejects tickets where the only evidence is subagent output.

### ACTION 4: Re-estimate T-007 documentation at 5 pts
Documentation for senior engineers is a real deliverable requiring schema diagrams, 10 tool examples, and copy-pasteable code. 3 pts was an underestimate.
**Owner**: PO (re-estimate), Lead Dev (implement)
