import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/** Subscribe to committed Postgres changes and refresh the current admin view. */
export function useAdminRealtime(tables: readonly string[], onChange: () => void) {
  const callback = useRef(onChange);
  const tableKey = [...new Set(tables)].sort().join(",");

  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!tableKey) return;
    const channel = supabase.channel("admin-live:" + tableKey);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        callback.current();
      }, 180);
    };
    tableKey.split(",").forEach((table) => {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, schedule);
    });
    channel.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [tableKey]);
}
