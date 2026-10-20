'use client';
/**
 * Client-side API helper with an offline outbox.
 * When the device is offline, queueable writes (income/expense entries) are stored in IndexedDB
 * and replayed automatically when the connection returns. Each entry carries a clientId so
 * replays are idempotent on the server.
 */

export class ClientApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    credentials: 'same-origin',
  });
  if (res.status === 401 && typeof window !== 'undefined' && !url.includes('/api/auth/')) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
  }
  const ct = res.headers.get('content-type') ?? '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) throw new ClientApiError(res.status, (data as { error?: string })?.error ?? `Request failed (${res.status})`);
  return data as T;
}

// ---------- Offline outbox (IndexedDB) ----------
const DB_NAME = 'finwise';
const STORE = 'outbox';
export type OutboxItem = { clientId: string; url: string; body: Record<string, unknown>; createdAt: number; label: string };

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'clientId' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export const outbox = {
  all: () => tx<OutboxItem[]>('readonly', (s) => s.getAll() as IDBRequest<OutboxItem[]>).catch(() => [] as OutboxItem[]),
  add: (item: OutboxItem) => tx('readwrite', (s) => s.put(item)),
  remove: (id: string) => tx('readwrite', (s) => s.delete(id)),
  clear: () => tx('readwrite', (s) => s.clear()).catch(() => undefined),
};

export const OUTBOX_EVENT = 'finwise:outbox';
const notify = () => window.dispatchEvent(new Event(OUTBOX_EVENT));

export function newClientId() {
  return (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

/** POST that falls back to the offline outbox on network failure. Returns { queued: true } when stored offline. */
export async function postOrQueue<T>(url: string, body: Record<string, unknown>, label: string): Promise<{ queued: boolean; data?: T }> {
  const clientId = (body.clientId as string) ?? newClientId();
  const payload = { ...body, clientId };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    await outbox.add({ clientId, url, body: payload, createdAt: Date.now(), label });
    notify();
    return { queued: true };
  }
  try {
    return { queued: false, data: await api<T>(url, { method: 'POST', json: payload }) };
  } catch (e) {
    if (e instanceof ClientApiError) throw e; // server rejected it — don't queue
    await outbox.add({ clientId, url, body: payload, createdAt: Date.now(), label });
    notify();
    return { queued: true };
  }
}

let syncing = false;
/** Replays queued writes. Returns number synced. */
export async function syncOutbox(): Promise<number> {
  if (syncing || (typeof navigator !== 'undefined' && !navigator.onLine)) return 0;
  syncing = true;
  let n = 0;
  try {
    const items = (await outbox.all()).sort((a, b) => a.createdAt - b.createdAt);
    for (const it of items) {
      try {
        await api(it.url, { method: 'POST', json: it.body });
        await outbox.remove(it.clientId);
        n++;
      } catch (e) {
        if (e instanceof ClientApiError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 429) {
          await outbox.remove(it.clientId); // permanently invalid — drop it
        } else break; // network/server issue — retry later
      }
    }
  } finally {
    syncing = false;
    notify();
  }
  return n;
}

export function downloadUrl(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
