export interface File { id: number; path: string; language: string; summary: string; size_bytes: number; line_count: number; }
export interface Directory { id: number; path: string; name: string; parent_path: string; file_count: number; total_size: number; }
export interface Sprint { id: number; name: string; goal: string | null; status: string; velocity_committed: number; velocity_completed: number; ticket_count: number; done_count: number; }
export interface Ticket { id: number; sprint_id: number; ticket_ref: string | null; title: string; status: string; priority: string; assigned_to: string | null; story_points: number | null; milestone_id: number | null; qa_verified: boolean; }
export interface Agent { role: string; name: string; description: string; model: string; mood_emoji: string; mood_label: string; mood: number; done_tickets: number; active_tickets: number; blocked_tickets: number; }
export interface RetroFinding { id: number; sprint_id: number; role: string | null; category: string; finding: string; }
export interface Milestone { id: number; name: string; description: string | null; status: string; target_date: string | null; progress: number; ticket_count: number; done_count: number; }
export interface Stats { files: number; exports: number; dependencies: number; lines: number; size: number; languages: Record<string, number>; }
