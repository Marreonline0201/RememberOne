// Offline write queue. Every non-AI person mutation goes through queuedFetch():
//   1. apply the change optimistically to the local store (instant UI),
//   2. online  → replay to the real API now (and reconcile from the response),
//      offline → enqueue it; the outbox flushes (FIFO) when back online.
//
// Reads come from the local store, so the optimistic update is what the UI shows
// until the server confirms.

import type {
  PersonFull,
  FamilyMemberFull,
} from "@/types/app";
import type {
  PersonAttribute,
  FamilyMember,
  FamilyMemberAttribute,
} from "@/types/database";
import {
  getCachedPerson,
  cachePerson,
  removeCachedPerson,
  enqueue,
  getOutbox,
  removeFromOutbox,
  outboxCount,
  notifyOfflineChange,
} from "@/lib/offline-cache";

const nowIso = () => new Date().toISOString();

export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

interface Body {
  name?: string;
  notes?: string | null;
  relation?: string;
  attributes?: { key: string; value: string }[];
  key?: string;
  value?: string;
  id?: string;
}

function pathOf(url: string): string {
  return url.replace(/^https?:\/\/[^/]+/, "").split("?")[0];
}

// Map a request to a local-store change (the single source of optimistic truth).
export async function applyMutationToCache(
  method: string,
  url: string,
  body: Body | undefined
): Promise<void> {
  const m = method.toUpperCase();
  const path = pathOf(url);

  // /api/people/{id}
  let match = path.match(/^\/api\/people\/([^/]+)$/);
  if (match) {
    const id = match[1];
    if (m === "DELETE") {
      await removeCachedPerson(id);
      return;
    }
    if (m === "PUT") {
      const p = await getCachedPerson(id);
      if (!p) return;
      const updated: PersonFull = { ...p, updated_at: nowIso() };
      if (body?.name !== undefined) updated.name = body.name;
      if (body?.notes !== undefined) updated.notes = body.notes;
      if (Array.isArray(body?.attributes)) {
        updated.attributes = body.attributes.map(
          (a): PersonAttribute => ({
            id: newId(),
            person_id: id,
            key: a.key,
            value: a.value,
            created_at: nowIso(),
            updated_at: nowIso(),
          })
        );
      }
      await cachePerson(updated);
      return;
    }
  }

  // /api/people/{id}/family
  match = path.match(/^\/api\/people\/([^/]+)\/family$/);
  if (match && m === "POST") {
    const id = match[1];
    const p = await getCachedPerson(id);
    if (!p) return;
    const fm: FamilyMemberFull = {
      id: body?.id ?? newId(),
      person_id: id,
      name: body?.name ?? "",
      relation: body?.relation ?? "",
      notes: body?.notes ?? null,
      created_at: nowIso(),
      updated_at: nowIso(),
      attributes: [],
    } as FamilyMemberFull;
    await cachePerson({
      ...p,
      family_members: [...p.family_members, fm],
      updated_at: nowIso(),
    });
    return;
  }

  // /api/people/{id}/family/{fmId}
  match = path.match(/^\/api\/people\/([^/]+)\/family\/([^/]+)$/);
  if (match) {
    const [, id, fmId] = match;
    const p = await getCachedPerson(id);
    if (!p) return;
    if (m === "DELETE") {
      await cachePerson({
        ...p,
        family_members: p.family_members.filter((f) => f.id !== fmId),
        updated_at: nowIso(),
      });
      return;
    }
    if (m === "PATCH") {
      await cachePerson({
        ...p,
        family_members: p.family_members.map((f) =>
          f.id === fmId
            ? {
                ...f,
                ...(body?.name !== undefined ? { name: body.name } : {}),
                ...(body?.relation !== undefined ? { relation: body.relation } : {}),
                ...(body?.notes !== undefined ? { notes: body.notes } : {}),
                updated_at: nowIso(),
              }
            : f
        ),
        updated_at: nowIso(),
      });
      return;
    }
  }

  // /api/people/{id}/family/{fmId}/attributes
  match = path.match(/^\/api\/people\/([^/]+)\/family\/([^/]+)\/attributes$/);
  if (match) {
    const [, id, fmId] = match;
    const p = await getCachedPerson(id);
    if (!p || !body?.key) return;
    const updateFm = (f: FamilyMemberFull): FamilyMemberFull => {
      if (f.id !== fmId) return f;
      const withoutKey = f.attributes.filter((a) => a.key !== body.key);
      if (m === "DELETE") return { ...f, attributes: withoutKey };
      // POST = upsert
      const attr: FamilyMemberAttribute = {
        id: newId(),
        family_member_id: fmId,
        key: body.key!,
        value: body.value ?? "",
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      return { ...f, attributes: [...withoutKey, attr] };
    };
    await cachePerson({
      ...p,
      family_members: p.family_members.map(updateFm),
      updated_at: nowIso(),
    });
    return;
  }
}

function queuedResponse(): Response {
  return new Response(JSON.stringify({ data: null, error: null, queued: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// Reconcile the local store from an authoritative full-person API response.
async function reconcileFromResponse(res: Response): Promise<void> {
  try {
    const j = await res.clone().json();
    const data = (j?.data ?? j?.person) as PersonFull | undefined;
    if (
      data &&
      data.id &&
      Array.isArray((data as PersonFull).family_members) &&
      Array.isArray((data as PersonFull).meetings)
    ) {
      await cachePerson(data);
    }
  } catch {
    /* non-JSON or partial response — optimistic update stands */
  }
}

// Drop-in replacement for fetch() on person mutations.
export async function queuedFetch(
  url: string,
  options: { method?: string; headers?: HeadersInit; body?: string } = {}
): Promise<Response> {
  const method = (options.method ?? "GET").toUpperCase();
  let body: Body | undefined;
  if (options.body) {
    try {
      body = JSON.parse(options.body) as Body;
    } catch {
      body = undefined;
    }
  }

  // 1. Optimistic local update (instant UI, online + offline).
  await applyMutationToCache(method, url, body);

  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  if (online) {
    try {
      const res = await fetch(url, options as RequestInit);
      if (res.ok) await reconcileFromResponse(res);
      return res;
    } catch {
      await enqueue({ method, url, body, createdAt: Date.now() });
      return queuedResponse();
    }
  }
  await enqueue({ method, url, body, createdAt: Date.now() });
  return queuedResponse();
}

// Replay queued writes in order when back online.
let flushing = false;
export async function flushOutbox(): Promise<void> {
  if (flushing) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  flushing = true;
  try {
    const items = await getOutbox();
    for (const item of items) {
      try {
        const res = await fetch(item.url, {
          method: item.method,
          headers: item.body !== undefined ? { "Content-Type": "application/json" } : undefined,
          body: item.body !== undefined ? JSON.stringify(item.body) : undefined,
        });
        if (
          res.ok ||
          (res.status >= 400 &&
            res.status < 500 &&
            res.status !== 401 &&
            res.status !== 403)
        ) {
          // success, or a permanent client error (400/404/409/422…) → drop it
          if (item.seq !== undefined) await removeFromOutbox(item.seq);
          if (!res.ok) {
            console.warn("[offline] dropped rejected write", item.method, item.url, res.status);
          }
        } else {
          // 401/403 (session may just need a refresh) or 5xx/transient → keep
          // it and retry on the next online flush, so edits aren't lost when the
          // token expired during a long offline period.
          break;
        }
      } catch {
        break; // network died mid-flush → retry on next online
      }
    }
  } finally {
    flushing = false;
    notifyOfflineChange();
  }
}

// Pull a fresh full person from the server (only when nothing is pending, so we
// never clobber un-synced edits).
export async function refreshPerson(id: string): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  if ((await outboxCount()) > 0) return;
  try {
    const res = await fetch(`/api/people/${id}`);
    if (res.ok) {
      const { data } = await res.json();
      if (data?.id) await cachePerson(data);
    }
  } catch {
    /* ignore */
  }
}
