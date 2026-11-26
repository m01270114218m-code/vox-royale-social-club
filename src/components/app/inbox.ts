import { useSyncExternalStore } from "react";

export type InboxKind = "notification" | "official" | "reward";
export const INBOX_KINDS: readonly InboxKind[] = ["notification", "official", "reward"];
export const inboxLabel: Record<InboxKind, string> = { notification: "إشعار", official: "رسمي", reward: "مكافأة" };
/** Which inbox tab a message from the administration belongs to. */
export const inboxKind = (kind: string): InboxKind => (kind === "reward" ? "reward" : kind === "notification" ? "notification" : "official");
type Note = { user_id: string | null; kind: string; created_at: string };
/** Messages addressed to this user: sent to them directly or broadcast to everyone. */
export const mine = <T extends Note>(list: readonly T[], userId: string | undefined) => list.filter((n) => n.user_id === null || n.user_id === userId);

type Read = Record<InboxKind, number>;
const KEY = "sada-inbox-read-v1";
const zero: Read = { notification: 0, official: 0, reward: 0 };
let read: Read = zero;
let loaded = false;
const subs = new Set<() => void>();
function get(): Read {
  if (!loaded && typeof window !== "undefined") {
    loaded = true;
    try { read = { ...zero, ...(JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as Partial<Read>) }; } catch { /* ignore */ }
  }
  return read;
}
export function markRead(kind: InboxKind) {
  read = { ...get(), [kind]: Date.now() };
  try { window.localStorage.setItem(KEY, JSON.stringify(read)); } catch { /* ignore */ }
  subs.forEach((s) => s());
}
export function useInboxRead(): Read {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, get, () => zero);
}
export function unreadByKind(list: readonly Note[], userId: string | undefined, seen: Read): Read {
  const out = { ...zero };
  for (const n of mine(list, userId)) { const k = inboxKind(n.kind); if (Date.parse(n.created_at) > seen[k]) out[k]++; }
  return out;
}
