import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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
