import { useEffect, useSyncExternalStore } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";

interface NativeGoogleAuthPlugin {
  signIn(options: { webClientId: string }): Promise<{ idToken: string; nonce: string }>;
}

const NativeGoogleAuth = registerPlugin<NativeGoogleAuthPlugin>("NativeGoogleAuth");
import { supabase } from '@/integrations/supabase/client';

/* ---------- Supabase-backed authentication ---------- */
export type Auth = { method: "google" | "facebook" | "phone" | "lovable"; phone?: string; at: string; userId?: string } | null;
const AKEY = "frost-auth-v1";
let auth: Auth = null;
let authLoaded = false;
const aSubs = new Set<() => void>();
// Serialize logout before the next Google exchange so a delayed SIGNED_OUT
// cannot immediately erase a newly selected Google account session.
let pendingSignOut: Promise<void> = Promise.resolve();
function readAuth(): Auth | undefined {
  return authLoaded ? auth : undefined;
}
export async function signIn(a: NonNullable<Auth>) {
  if (a.method === "facebook") {
    const redirectTo = Capacitor.isNativePlatform() || Capacitor.getPlatform() === "android"
      ? "com.sadachat.app://login-callback"
      : window.location.origin;
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data.url) throw new Error("Facebook OAuth URL was not returned");
    if (Capacitor.isNativePlatform() || Capacitor.getPlatform() === "android") {
      await Browser.open({ url: data.url });
      return;
    }
    window.location.assign(data.url);
    return;
  }

  if (a.method === "google") {
    try {
      const nativePlatform = Capacitor.isNativePlatform() || Capacitor.getPlatform() === "android";
      const androidDevice = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);

      // Android must never fall back to browser OAuth: the installed APK uses
      // Google Play Services to pick an on-device account and exchange its ID
      // token directly with Supabase. A browser on Android is not the native app.
      if (androidDevice && !nativePlatform) {
        throw new Error("افتح تطبيق صدى شات المثبّت على الهاتف لتسجيل الدخول بحساب Google مباشرة.");
      }

      if (nativePlatform) {
        // Finish a previous logout before exchanging the next selected account.
        await pendingSignOut;

        // Native Android account picker -> Google ID token -> Supabase Auth.
        const webClientId = String(import.meta.env["VITE_GOOGLE_WEB_CLIENT_ID"] ?? "").trim();
        if (!webClientId) throw new Error("Missing VITE_GOOGLE_WEB_CLIENT_ID");

        const result = await NativeGoogleAuth.signIn({ webClientId });
        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: result.idToken,
          nonce: result.nonce,
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
export function signOut(): Promise<void> {
  // Clear this app session only (not the user's other devices). Keep the promise
  // so a fast re-login cannot race a still-running SIGNED_OUT event.
  auth = null;
  authLoaded = true;
  try { localStorage.removeItem(AKEY); } catch { /* ignore */ }
  aSubs.forEach((s) => s());

  pendingSignOut = supabase.auth.signOut({ scope: "local" }).then(({ error }) => {
    if (error) {
      console.error("[Auth] Supabase sign-out failed", error);
      throw error;
    }
  }).then(async () => {
    // Clear Credential Manager state so the next Google login starts from
    // the account chooser instead of reusing a provider session.
    if (Capacitor.isNativePlatform() || Capacitor.getPlatform() === "android") {
      try {
        const native = NativeGoogleAuth as NativeGoogleAuthPlugin & {
          clearCredentialState?: () => Promise<void>;
        };
        await native.clearCredentialState?.();
      } catch (error) {
        console.warn("[Auth] Native Google credential state clear failed", error);
      }
    }
  }).catch((error) => {
    console.error("[Auth] Supabase sign-out failed", error);
  });
  return pendingSignOut;
}
/** `undefined` while rendering on the server / before hydration. */
export function useAuth(): Auth | undefined {
  return useSyncExternalStore((cb) => { aSubs.add(cb); return () => aSubs.delete(cb); }, readAuth, () => undefined);
}
export function AuthBridge() {
  useEffect(() => {
    let revision = 0;
    let urlListener: { remove: () => Promise<void> } | undefined;

    const handleOAuthCallback = async (url: string) => {
      if (!url.startsWith("com.sadachat.app://login-callback")) return;
      await Browser.close().catch(() => undefined);
      const parsed = new URL(url);
      const code = parsed.searchParams.get("code");
      if (!code) return;
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) console.error("[auth] Facebook callback exchange failed", error);
      return;
    };

    const publishSession = (userId: string | undefined) => {
      authLoaded = true;
      auth = userId ? { method: "google", at: new Date().toISOString(), userId } : null;
      aSubs.forEach((s) => s());

      // Supabase's on_auth_user_created trigger creates the profile and wallet
      // atomically. Do not perform a client upsert here: it can violate generated
      // column types and must never overwrite existing account data.
    };

    if (Capacitor.isNativePlatform() || Capacitor.getPlatform() === "android") {
      void App.getLaunchUrl().then((launch) => {
        if (launch?.url) return handleOAuthCallback(launch.url);
      }).catch((error) => console.warn("[auth] launch URL unavailable", error));
      void App.addListener("appUrlOpen", ({ url }) => handleOAuthCallback(url)).then((listener) => {
        urlListener = listener;
      });
    }

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

    return () => {
      data.subscription.unsubscribe();
      void urlListener?.remove();
    };
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
