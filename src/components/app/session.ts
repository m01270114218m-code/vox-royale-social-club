import { useEffect, useSyncExternalStore } from "react";
import { supabase } from '@/integrations/supabase/client';

/* ---------- Supabase session ---------- */
export type Auth = { method: "google" | "phone" | "email"; phone?: string; at: string; userId?: string } | null;
let auth: Auth = null;
let authLoaded = false;
const aSubs = new Set<() => void>();
function readAuth(): Auth | undefined { return authLoaded ? auth : undefined; }
export function signIn(a: NonNullable<Auth>) {
  // Supabase is the single source of truth. This helper only updates the
  // in-memory compatibility state for existing UI callers.
  auth = a;
  authLoaded = true;
  aSubs.forEach(s => s());
}
export function signOut() {
  void supabase.auth.signOut();
}
/** `undefined` while rendering on the server / before hydration. */
export function useAuth(): Auth | undefined {
  return useSyncExternalStore((cb) => { aSubs.add(cb); return () => aSubs.delete(cb); }, readAuth, () => undefined);
}
export function AuthBridge() {
  useEffect(() => {
    const update = (session: import("@supabase/supabase-js").Session | null) => {
      authLoaded = true;
      const user = session?.user;
      if (!user) {
        auth = null;
      } else {
        const provider = String(user.app_metadata?.provider ?? user.identities?.[0]?.provider ?? "email");
        const method: Auth["method"] = provider === "google" ? "google" : provider === "phone" ? "phone" : "email";
        auth = { method, at: new Date().toISOString(), userId: user.id, phone: user.phone ?? undefined };
      }
      aSubs.forEach(s=>s());
    };
    void supabase.auth.getSession().then(({data})=>update(data.session));
    const {data} = supabase.auth.onAuthStateChange((event,session)=>{
      if(event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='USER_UPDATED'||event==='TOKEN_REFRESHED') update(session);
    });
    return ()=>data.subscription.unsubscribe();
  },[]);
  return null;
}

/* ---------- active (possibly minimized) room ---------- */
let roomId: string | null = null;
const rSubs = new Set<() => void>();
export function setActiveRoom(id: string | null) {
  if (roomId === id) return;
  roomId = id;
  rSubs.forEach((s) => s());
}
export function useActiveRoom(): string | null {
  return useSyncExternalStore((cb) => { rSubs.add(cb); return () => rSubs.delete(cb); }, () => roomId, () => null);
}
