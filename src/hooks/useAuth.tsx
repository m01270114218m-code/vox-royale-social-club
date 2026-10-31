import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// Shared across hook instances so pages under RequireAuth always see the user immediately.
let cachedUser: User | null = null;
let ready = false;

export function useAuth() {
  const [user, setUser] = useState<User | null>(cachedUser);
  const [loading, setLoading] = useState(!ready);
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      cachedUser = s?.user ?? null;
      ready = true;
      setUser(cachedUser);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      cachedUser = data.session?.user ?? null;
      ready = true;
      setUser(cachedUser);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return { user, loading };
}
