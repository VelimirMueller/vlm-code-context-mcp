export interface File {
  id: number;
  path: string;
  language: string;
  extension: string;
  size_bytes: number;
  line_count: number;
  summary: string;
  external_imports: string | null;
  created_at: string;
  modified_at: string;
  indexed_at: string;
  export_count: number;
  imports_count: number;
  imported_by_count: number;
}

export interface Directory {
  id: number;
  path: string;
  name: string;
  parent_path: string | null;
  depth: number;
  file_count: number;
  total_size_bytes: number;
  total_lines: number;
  language_breakdown: string;
  description: string | null;
  indexed_at: string;
}

export interface Sprint {
  id: number;
  name: string;
  goal: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  milestone_id?: number;
  velocity_committed: number;
  velocity_completed: number;
  created_at: string;
  updated_at: string;
  ticket_count: number;
  done_count: number;
  qa_count: number;
  retro_count: number;
  open_blockers: number;
}

export interface Ticket {
  id: number;
  ticket_ref: string | null;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  assigned_to: string | null;
  story_points: number | null;
  milestone: string | null;
  milestone_id?: number;
  milestone_name?: string;
  epic_id?: number;
  epic_name?: string;
  qa_verified: number;
  verified_by: string | null;
  acceptance_criteria: string | null;
  notes: string | null;
}

export interface Agent {
  role: string;
  name: string;
  description: string;
  model: string;
  done_tickets: number;
  active_tickets: number;
  blocked_tickets: number;
  active_points: number;
  mood: number;
  mood_emoji: string;
  mood_label: string;
}

export interface Epic {
  id: number;
  name: string;
  description: string | null;
  status: string;
  milestone_id: number | null;
  color: string;
  priority: number;
  ticket_count: number;
  done_count: number;
  created_at: string;
}

export interface RetroFinding {
  id: number;
  role: string | null;
  category: string;
  finding: string;
  action_owner: string | null;
  action_applied: number;
}

export interface MilestoneSprint {
  id: number;
  name: string;
  status: string;
  velocity_committed: number;
  velocity_completed: number;
  ticket_count: number;
  done_count: number;
}

export interface Milestone {
  id: number;
  name: string;
  description: string | null;
  status: string;
  target_date: string | null;
  progress: number;
  ticket_count: number;
  done_count: number;
  sprints?: MilestoneSprint[];
}

export interface MilestoneSprintGroup {
  milestone: Milestone | null;
  sprints: Sprint[];
}

export interface Stats {
  files: number;
  exports: number;
  deps: number;
  totalLines: number;
  totalSize: number;
  languages: Array<{ language: string; c: number }>;
  extensions: Array<{ extension: string; c: number }>;
}

export interface LinearUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

export interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  priority: number;
  priorityLabel: string;
  status: string;
  statusColor: string;
  labels: string[];
  projectName: string | null;
  assigneeId: string;
  createdAt: string;
  updatedAt: string;
  url: string | null;
}

export interface LinearCycle {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  completedIssueCount: number;
  totalIssueCount: number;
  status: string;
}

export interface LinearProject {
  id: string;
  name: string;
  status: string;
  progress: number;
  leadName: string | null;
  targetDate: string | null;
}

// ─── Normalized Linear types (v2 — from /api/linear/* endpoints) ──────────

export interface LinearState {
  id: string;
  name: string;
  type: 'backlog' | 'unstarted' | 'started' | 'completed' | 'cancelled';
  color: string | null;
  position: number;
  kanbanColumn: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'NOT_DONE';
}

export interface NormalizedLinearIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  state_id: string | null;
  priority: number;
  priority_label: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  project_name: string | null;
  cycle_name: string | null;
  labels: string[];
  url: string | null;
  created_at: string | null;
  updated_at: string | null;
  state_name: string | null;
  state_type: string | null;
  state_color: string | null;
  kanbanColumn: 'TODO' | 'IN_PROGRESS' | 'DONE' | 'NOT_DONE';
}

export type KanbanColumn = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'NOT_DONE';

export interface LinearSyncStatus {
  synced: boolean;
  issueCount: number;
  stateCount: number;
  syncedAt: string | null;
}

// ─── GitHub types ───────────────────────────────────────────────────────────

export interface GithubRepo {
  id: number;
  owner: string;
  name: string;
  full_name: string;
  description: string | null;
  stars: number;
  forks: number;
  language: string | null;
  default_branch: string;
  html_url: string;
  updated_at: string;
}

export interface GithubIssue {
  id: number;
  repo_id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  author: string;
  labels: string[];
  assignees: string[];
  milestone: string | null;
  html_url: string;
  created_at: string;
  updated_at: string;
}

export interface GithubPullRequest {
  id: number;
  repo_id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  author: string;
  head_branch: string;
  base_branch: string;
  mergeable: boolean | null;
  review_status: string | null;
  ci_status: string | null;
  draft: boolean;
  html_url: string;
  created_at: string;
  updated_at: string;
}

export interface GithubCommit {
  sha: string;
  repo_id: number;
  message: string;
  author: string;
  date: string;
}

export interface GithubSyncStatus {
  synced: boolean;
  repoCount: number;
  issueCount: number;
  prCount: number;
  commitCount: number;
  syncedAt: string | null;
}

export interface Discovery {
  id: number;
  discovery_sprint_id: number;
  finding: string;
  category: string;
  status: 'discovered' | 'planned' | 'implemented' | 'dropped';
  priority: string;
  resolution_plan: string | null;
  implementation_ticket_id: number | null;
  drop_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  sprint_name: string;
  ticket_title: string | null;
  ticket_status: string | null;
}

export interface BurndownMetric {
  date: string;
  remaining_points: number;
  completed_points: number;
  added_points: number;
  removed_points: number;
}

export interface BurndownData {
  sprint_name: string;
  committed: number;
  start_date: string | null;
  end_date: string | null;
  current: { remaining: number; completed: number; total: number };
  metrics: BurndownMetric[];
}

export interface Blocker {
  id: number;
  sprint_id: number;
  ticket_id: number | null;
  description: string;
  reported_by: string | null;
  escalated_to: string | null;
  status: 'open' | 'resolved';
  resolved_at: string | null;
  created_at: string;
  ticket_title?: string | null;
}

export interface Bug {
  id: number;
  sprint_id: number;
  ticket_id: number | null;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  steps_to_reproduce: string | null;
  expected: string | null;
  actual: string | null;
  status: 'open' | 'fixed' | 'deferred';
  created_at: string;
  ticket_title?: string | null;
}

export interface DiscoveryCoverage {
  total: number;
  discovered: number;
  planned: number;
  implemented: number;
  dropped: number;
}

export interface DiscoverySprint {
  id: number;
  name: string;
}
