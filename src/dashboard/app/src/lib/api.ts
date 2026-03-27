const inflight = new Map<string, Promise<unknown>>();

const TIMEOUT_MS = 10_000;
const RETRY_DELAY_MS = 1_000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchWithTimeout(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(path, { ...init, signal: controller.signal })
    .catch((err) => {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new Error(`API request timed out after ${TIMEOUT_MS}ms: ${path}`);
      }
      throw err;
    })
    .finally(() => clearTimeout(timer));
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const key = `${options?.method || 'GET'}:${path}`;
  const isGet = !options?.method || options.method === 'GET';
  if (isGet) {
    const existing = inflight.get(key);
    if (existing) return existing as Promise<T>;
  }
  const init: RequestInit = { headers: { 'Content-Type': 'application/json' }, ...options };
  const promise = (async () => {
    try {
      const r = await fetchWithTimeout(path, init);
      if (!r.ok) throw new Error(`API ${r.status}: ${r.statusText}`);
      return (await r.json()) as T;
    } catch (err) {
      // Retry once on network error for GET requests only
      if (isGet && err instanceof TypeError) {
        await delay(RETRY_DELAY_MS);
        const r = await fetchWithTimeout(path, init);
        if (!r.ok) throw new Error(`API ${r.status}: ${r.statusText}`);
        return (await r.json()) as T;
      }
      throw err;
    }
  })().finally(() => inflight.delete(key));
  if (isGet) inflight.set(key, promise);
  return promise;
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, body: unknown) => api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export const put = <T>(path: string, body: unknown) => api<T>(path, { method: 'PUT', body: JSON.stringify(body) });
export const patch = <T>(path: string, body: unknown) => api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' });
