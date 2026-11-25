import { useEffect, useSyncExternalStore } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";

interface NativeGoogleAuthPlugin {
  signIn(options: { webClientId: string }): Promise<{ idToken: string }>;
}

const NativeGoogleAuth = registerPlugin<NativeGoogleAuthPlugin>("NativeGoogleAuth");
import { supabase } from '@/integrations/supabase/client';

/* ---------- Supabase-backed authentication ---------- */
export type Auth = { method: "google" | "facebook" | "phone" | "lovable"; phone?: string; at: string; userId?: string } | null;
const AKEY = "frost-auth-v1";
let auth: Auth = null;
let authLoaded = false;
const aSubs = new Set<() => void>();
function readAuth(): Auth | undefined {
  return authLoaded ? auth : undefined;
}
export async function signIn(a: NonNullable<Auth>) {
  if (a.method === "google") {
    try {
      if (Capacitor.isNativePlatform()) {
        // Android account picker -> Google ID token -> Supabase Auth.
        const webClientId = String(import.meta.env["VITE_GOOGLE_WEB_CLIENT_ID"] ?? "").trim();
        if (!webClientId) throw new Error("Missing VITE_GOOGLE_WEB_CLIENT_ID");

        const result = await NativeGoogleAuth.signIn({ webClientId });
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: result.idToken,
        });
        if (error) throw error;
        if (!data.user?.id) throw new Error("Supabase did not return a Google user");

        authLoaded = true;
        auth = { method: "google", at: new Date().toISOString(), userId: data.user.id };
        aSubs.forEach((s) => s());
        return;
      }

      // Browser sign-in also uses the real Supabase Google provider (never a local mock).
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
      return;
    } catch (error) {
      console.error("[Auth] Google sign-in failed", error);
      throw error;
    }
  }

  // Preserve existing non-Google flows.
  auth = a;
  authLoaded = true;
  try { localStorage.setItem(AKEY, JSON.stringify(a)); } catch { /* ignore */ }
  aSubs.forEach((s) => s());
}
export function signOut() {
  // Supabase clears its persisted refresh-token session; the same Google identity
  // can sign in again and resolves to the same auth.users.id.
  void supabase.auth.signOut().then(({ error }) => {
    if (error) console.error("[Auth] Supabase sign-out failed", error);
  });
  auth = null;
  authLoaded = true;
  try { localStorage.removeItem(AKEY); } catch { /* ignore */ }
  aSubs.forEach((s) => s());
}
/** `undefined` while rendering on the server / before hydration. */
export function useAuth(): Auth | undefined {
  return useSyncExternalStore((cb) => { aSubs.add(cb); return () => aSubs.delete(cb); }, readAuth, () => undefined);
}
export function AuthBridge() {
  useEffect(() => {
    let revision = 0;

    const publishSession = (userId: string | undefined) => {
      authLoaded = true;
      auth = userId ? { method: "google", at: new Date().toISOString(), userId } : null;
      aSubs.forEach((s) => s());

      if (userId) {
        // The database trigger provisions profiles + wallets on first Auth signup.
        // This idempotent upsert only marks the profile online. It never replaces
        // a chosen display name, avatar, VIP, level, role, or wallet balance.
        void supabase.from("profiles").upsert(
          { id: userId, is_online: true },
          { onConflict: "id", ignoreDuplicates: false },
        ).then(({ error }) => {
          if (error) console.warn("[auth] profile presence sync failed:", error.message);
        }).catch((error) => {
          console.warn("[auth] profile presence sync unavailable:", error);
        });
      }
    };

    // Subscribe before reading storage so a fresh sign-in cannot be overwritten
    // by a slower initial getSession() response.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" ||
          event === "USER_UPDATED" || event === "INITIAL_SESSION" ||
          event === "TOKEN_REFRESHED") {
        revision += 1;
        publishSession(session?.user.id);
      }
    });

    const initialRevision = revision;
    void supabase.auth.getSession().then(({ data: sessionData, error }) => {
      if (error) console.warn("[auth] session restore failed:", error.message);
      if (revision === initialRevision) {
        publishSession(sessionData.session?.user.id);
      }
    }).catch((error) => {
      console.warn("[auth] session restore unavailable:", error);
      if (revision === initialRevision) publishSession(undefined);
    });

    return () => data.subscription.unsubscribe();
  }, []);
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
