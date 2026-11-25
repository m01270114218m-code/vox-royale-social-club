import { useEffect, useSyncExternalStore } from "react";
import { supabase } from '@/integrations/supabase/client';

/* ---------- local sign-in (device only until real accounts are enabled) ---------- */
export type Auth = { method: "google" | "facebook" | "phone" | "lovable"; phone?: string; at: string; userId?: string } | null;
const AKEY = "frost-auth-v1";
let auth: Auth = null;
let authLoaded = false;
const aSubs = new Set<() => void>();
function readAuth(): Auth | undefined {
  return authLoaded ? auth : undefined;
}
export function signIn(a: NonNullable<Auth>) {
  auth = a;
  try { localStorage.setItem(AKEY, JSON.stringify(a)); } catch { /* ignore */ }
  aSubs.forEach((s) => s());
}
export function signOut() {
  void supabase.auth.signOut();
  auth = null;
  try { localStorage.removeItem(AKEY); } catch { /* ignore */ }
  aSubs.forEach((s) => s());
}
/** `undefined` while rendering on the server / before hydration. */
export function useAuth(): Auth | undefined {
  return useSyncExternalStore((cb) => { aSubs.add(cb); return () => aSubs.delete(cb); }, readAuth, () => undefined);
}
export function AuthBridge() {
  useEffect(() => {
    const update = (userId: string | undefined) => {
      authLoaded = true;
      auth = userId ? { method: 'google', at: new Date().toISOString(), userId } : null;
      aSubs.forEach(s=>s());
    };
    void supabase.auth.getSession().then(({data})=>update(data.session?.user.id));
    const {data} = supabase.auth.onAuthStateChange((event,session)=>{
      if(event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='USER_UPDATED') update(session?.user.id);
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
