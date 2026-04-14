/**
 * Sprint domain API client.
 * Typed wrappers around the base API for sprint-related endpoints.
 */
import { get, post, put } from '../api';
import type { Sprint, Ticket } from '@/types';

export const SprintAPI = {
  list: () => get<Sprint[]>('/api/sprints'),
  detail: (id: number) => get<Sprint>(`/api/sprints/${id}`),
  tickets: (id: number) => get<Ticket[]>(`/api/sprints/${id}/tickets`),
  retro: (id: number) => get<any>(`/api/sprints/${id}/retro`),
  burndown: (id: number) => get<any>(`/api/sprints/${id}/burndown`),
  blockers: (id: number) => get<any[]>(`/api/sprints/${id}/blockers`),
  bugs: (id: number) => get<any[]>(`/api/sprints/${id}/bugs`),
  advance: (id: number) => post<any>(`/api/sprints/${id}/advance`, {}),
  moveTicket: (ticketId: number, status: string) =>
    put<any>(`/api/tickets/${ticketId}`, { status }),
};
