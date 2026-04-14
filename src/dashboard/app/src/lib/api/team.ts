/**
 * Team domain API client.
 * Typed wrappers for agents, skills, mood.
 */
import { get, post, put, del } from '../api';
import type { Agent } from '@/types';

export const TeamAPI = {
  agents: () => get<Agent[]>('/api/agents'),
  createAgent: (body: Partial<Agent>) => post<Agent>('/api/agents', body),
  updateAgent: (role: string, body: Partial<Agent>) => put<Agent>(`/api/agents/${role}`, body),
  deleteAgent: (role: string) => del(`/api/agents/${role}`),
  skills: () => get<any[]>('/api/skills'),
  health: () => get<any>('/api/agents/health'),
};
