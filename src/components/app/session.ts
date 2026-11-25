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
    const update = async (userId: string | undefined) => {
      authLoaded = true;
      auth = userId ? { method: 'google', at: new Date().toISOString(), userId } : null;
      aSubs.forEach(s=>s());

      // Make sure every authenticated provider (Google/email/phone) has a real
      // profile row in Supabase and is marked online before the app shell loads.
      if (userId) {
        try {
          const { data: userData } = await supabase.auth.getUser();
          const u = userData.user;
          const metadata = (u?.user_metadata ?? {}) as Record<string, unknown>;
          const displayName = String(metadata.full_name ?? metadata.name ?? u?.email?.split("@")[0] ?? "مستخدم جديد").trim();
          const avatarUrl = typeof metadata.avatar_url === "string" ? metadata.avatar_url : null;
          const { error } = await supabase.from("profiles").upsert({
            id: userId,
            display_name: displayName,
            name: displayName,
            avatar_url: avatarUrl,
            avatar: avatarUrl,
            is_online: true,
            account_status: "active",
          }, { onConflict: "id" });
          if (error) console.warn("[auth] profile sync failed:", error.message);
        } catch (error) {
          console.warn("[auth] profile sync unavailable:", error);
        }
      }
    };

    // Google may return to the web origin with a hash session (especially in
    // local/preview builds). Consume it here so the app never gets stuck on
    // http://localhost:3000/#access_token=... .
    const consumeOAuthCallback = async () => {
      if (typeof window === 'undefined') return;

      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const accessToken = hash.get('access_token');
      const refreshToken = hash.get('refresh_token');
      const code = new URLSearchParams(window.location.search).get('code');

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) throw error;
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    void consumeOAuthCallback()
      .catch(error => console.error('[Auth] OAuth callback failed', error))
      .finally(() => {
        void supabase.auth.getSession().then(({data})=>update(data.session?.user.id));
      });

    const {data} = supabase.auth.onAuthStateChange((event,session)=>{
      if(event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='USER_UPDATED'||event==='INITIAL_SESSION') {
        void update(session?.user.id);
      }
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
