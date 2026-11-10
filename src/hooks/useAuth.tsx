import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const DEVICE_STORAGE_KEY = "vox_royale_device_id";

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

async function registerCurrentDevice(): Promise<boolean> {
  const deviceId = getDeviceId();
  const { error } = await supabase.rpc("register_device", { _device: deviceId });
  if (!error) return true;
  const message = String(error.message || "");
  if (message.includes("account_banned") || message.includes("device_banned") || message.includes("device_already_linked")) {
    await supabase.auth.signOut();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("vox-account-blocked", { detail: { message } }));
    }
    return false;
  }
  // A device-registration failure must not silently lock users out during a
  // temporary network/API outage; the server-side RPC still enforces bans.
  console.error("[Auth] Device registration failed:", message);
  return true;
}

// Keep one coherent auth snapshot across route-level hook instances.
let cachedUser: User | null = null;

export function useAuth() {
  const [user, setUser] = useState<User | null>(cachedUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let authEventVersion = 0;

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      authEventVersion += 1;
      cachedUser = session?.user ?? null;
      if (mounted) {
        setUser(cachedUser);
        setLoading(false);
      }
      if (session?.user) void registerCurrentDevice();
    });

    // getSession may resolve after a SIGNED_IN / SIGNED_OUT event.
    // Do not let that older snapshot overwrite the newer auth event.
    const initialVersion = authEventVersion;
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted || authEventVersion !== initialVersion) return;
      if (error) console.error("[Auth] Unable to restore session:", error.message);
      cachedUser = data.session?.user ?? null;
      setUser(cachedUser);
      setLoading(false);
      if (data.session?.user) void registerCurrentDevice();
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
    };
  }, []);

  return { user, loading };
}
