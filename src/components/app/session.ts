import { useEffect, useSyncExternalStore } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";

interface NativeGoogleAuthPlugin {
  signIn(options: { webClientId: string }): Promise<{ idToken: string; nonce: string }>;
}

const NativeGoogleAuth = registerPlugin<NativeGoogleAuthPlugin>("NativeGoogleAuth");
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
export async function signIn(a: NonNullable<Auth>) {
  // Android uses Google's native Credential Manager. No browser, WebView,
  // localhost callback, Vercel callback, or custom-scheme OAuth is involved.
  if (a.method === "google" && Capacitor.isNativePlatform()) {
    try {
      const webClientId = String(import.meta.env["VITE_GOOGLE_WEB_CLIENT_ID"] ?? "").trim();
      if (!webClientId) throw new Error("Missing VITE_GOOGLE_WEB_CLIENT_ID");

      const result = await NativeGoogleAuth.signIn({ webClientId });
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: result.idToken,
        nonce: result.nonce,
      });
      if (error) throw error;

      const userId = data.user?.id;
      if (!userId) throw new Error("Supabase did not return a Google user");
      auth = { method: "google", at: new Date().toISOString(), userId };
      aSubs.forEach((s) => s());
      return;
    } catch (error) {
      console.error("[Auth] Native Google sign-in failed", error);
      return;
    }
  }

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
          const displayName = String(metadata["full_name"] ?? metadata["name"] ?? u?.email?.split("@")[0] ?? "مستخدم جديد").trim();
          const avatarUrl = typeof metadata["avatar_url"] === "string" ? String(metadata["avatar_url"]) : null;
          const { error } = await (supabase as any).from("profiles").upsert({
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

    void supabase.auth.getSession().then(({ data }) => update(data.session?.user.id));

    const {data} = supabase.auth.onAuthStateChange((event,session)=>{
      if(event==='SIGNED_IN'||event==='SIGNED_OUT'||event==='USER_UPDATED'||event==='INITIAL_SESSION') {
        void update(session?.user.id);
      }
    });
    return () => {
      data.subscription.unsubscribe();
    };
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
