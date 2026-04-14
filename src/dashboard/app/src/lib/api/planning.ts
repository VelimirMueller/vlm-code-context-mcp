/**
 * Planning domain API client.
 * Typed wrappers for milestones, epics, vision, discoveries.
 */
import { get } from '../api';
import type { Milestone, Epic, Discovery } from '@/types';

export const PlanningAPI = {
  milestones: () => get<Milestone[]>('/api/milestones'),
  epics: () => get<Epic[]>('/api/epics'),
  vision: () => get<{ vision: string }>('/api/vision'),
  discoveries: () => get<Discovery[]>('/api/discoveries'),
  backlog: () => get<any[]>('/api/backlog'),
  gantt: () => get<any>('/api/gantt'),
};
