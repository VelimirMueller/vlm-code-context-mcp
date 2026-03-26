const inflight = new Map<string, Promise<unknown>>();

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const key = `${options?.method || 'GET'}:${path}`;
  if (!options?.method || options.method === 'GET') {
    const existing = inflight.get(key);
    if (existing) return existing as Promise<T>;
  }
  const promise = fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options })
    .then(r => { if (!r.ok) throw new Error(`API ${r.status}: ${r.statusText}`); return r.json() as T; })
    .finally(() => inflight.delete(key));
  if (!options?.method || options.method === 'GET') inflight.set(key, promise);
  return promise;
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const put = <T>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body: JSON.stringify(body) });
