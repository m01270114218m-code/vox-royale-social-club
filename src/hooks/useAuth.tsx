import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const DEVICE_STORAGE_KEY = "vox_royale_device_id";
const QUICK_LOGIN_PAUSED_KEY = "vox_guest_logged_out";

function isQuickLoginPaused(): boolean {
  try { return localStorage.getItem(QUICK_LOGIN_PAUSED_KEY) === "1"; }
  catch { return false; }
}

export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (existing && existing.length >= 16) return existing;
    // Migrate the legacy quick-login key to the single canonical device key.
    const legacy = localStorage.getItem("vox_device_id");
    if (legacy && legacy.length >= 16) {
      localStorage.setItem(DEVICE_STORAGE_KEY, legacy);
      return legacy;
    }
    const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_STORAGE_KEY, id);
    return id;
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

// Keep one coherent auth snapshot across route-level hook instances.
let cachedUser: User | null = null;

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => isQuickLoginPaused() ? null : cachedUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let authEventVersion = 0;

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      authEventVersion += 1;
      cachedUser = session?.user ?? null;
      if (session?.user?.is_anonymous && session.refresh_token) {
        try { localStorage.setItem("vox_guest_refresh", session.refresh_token); localStorage.setItem("vox_guest_account_created", "1"); }
        catch (error) { console.warn("[Auth] Could not persist quick-login recovery token:", error); }
      }
      if (mounted) {
        setUser(isQuickLoginPaused() ? null : cachedUser);
        setLoading(false);
      }
    });

    const onQuickLoginVisibilityChange = () => {
      if (isQuickLoginPaused()) {
        if (mounted) setUser(null);
        return;
      }
      void supabase.auth.getSession().then(({ data }) => {
        if (!mounted) return;
        cachedUser = data.session?.user ?? null;
        setUser(cachedUser);
        setLoading(false);
      }).catch((error: unknown) => console.warn("[Auth] Could not refresh visible session:", error));
    };
    window.addEventListener("vox-auth-visibility-change", onQuickLoginVisibilityChange);

    // getSession may resolve after a SIGNED_IN / SIGNED_OUT event.
    // Do not let that older snapshot overwrite the newer auth event.
    const initialVersion = authEventVersion;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted || authEventVersion !== initialVersion) return;
      if (error) console.error("[Auth] Unable to restore session:", error.message);
      cachedUser = data.session?.user ?? null;
      if (data.session?.user?.is_anonymous && data.session.refresh_token) {
        try { localStorage.setItem("vox_guest_refresh", data.session.refresh_token); localStorage.setItem("vox_guest_account_created", "1"); }
        catch (persistError) { console.warn("[Auth] Could not persist quick-login recovery token:", persistError); }
      }
      setUser(isQuickLoginPaused() ? null : cachedUser);
      setLoading(false);
    }).catch((error: unknown) => {
      if (!mounted || authEventVersion !== initialVersion) return;
      console.error("[Auth] Session restore failed:", error);
      cachedUser = null;
      setUser(null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
      window.removeEventListener("vox-auth-visibility-change", onQuickLoginVisibilityChange);
    };
  }, []);

  return { user, loading };
}
