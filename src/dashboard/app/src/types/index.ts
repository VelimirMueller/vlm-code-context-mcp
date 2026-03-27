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
