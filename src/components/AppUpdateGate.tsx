import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) || "1.0.0";

type UpdatePolicy = {
  enabled?: boolean;
  min_version?: string;
  blocked_versions?: string[];
  latest_version?: string;
  download_url?: string;
  message?: string;
};

function compareVersions(a: string, b: string) {
  const aa = a.split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0);
  const bb = b.split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(aa.length, bb.length); i += 1) {
    const av = aa[i] ?? 0;
    const bv = bb[i] ?? 0;
    if (av !== bv) return av > bv ? 1 : -1;
  }
  return 0;
}

export function AppUpdateGate() {
  const [policy, setPolicy] = useState<UpdatePolicy | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase.from("admin_settings").select("value").eq("key", "app_update_policy").maybeSingle();
      if (alive) setPolicy((data?.value ?? null) as UpdatePolicy | null);
    };
    void load();
    const channel = supabase
      .channel("public-app-update-policy")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_settings", filter: "key=eq.app_update_policy" }, (payload) => {
        if (alive && payload.new && "value" in payload.new) setPolicy((payload.new as { value: UpdatePolicy }).value);
      })
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(channel);
    };
  }, []);

  if (!policy?.enabled) return null;

  const blocked = (policy.blocked_versions ?? []).map(String).includes(APP_VERSION);
  const belowMinimum = !!policy.min_version && compareVersions(APP_VERSION, policy.min_version) < 0;
  if (!blocked && !belowMinimum) return null;

  let url = "";
  try {
    const parsed = policy.download_url ? new URL(policy.download_url) : null;
    if (parsed && (parsed.protocol === "https:" || parsed.protocol === "http:")) url = parsed.toString();
  } catch {
    url = "";
  }

  return (
    <div className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center bg-[#100719]/98 p-5" dir="rtl">
      <div className="w-full max-w-md rounded-[2rem] border border-primary/30 bg-card p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-3xl bg-primary/10 text-4xl">⬆️</div>
        <h1 className="font-display text-2xl text-gold">تحديث مطلوب</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          {policy.message || "هذا الإصدار لم يعد مدعوماً. حدّث تطبيق صدي شات للمتابعة."}
        </p>
        <div className="mt-3 text-xs text-muted-foreground">الإصدار الحالي: {APP_VERSION}{policy.latest_version ? \` · المتاح: \${policy.latest_version}\` : ""}</div>
        {url ? (
          <Button className="mt-6 w-full bg-gold font-bold text-black" onClick={() => { window.location.href = url; }}>
            تحديث التطبيق
          </Button>
        ) : (
          <div className="mt-6 rounded-xl bg-secondary p-3 text-xs text-muted-foreground">لم يتم وضع رابط التحديث بعد. تواصل مع الإدارة.</div>
        )}
      </div>
    </div>
  );
}
