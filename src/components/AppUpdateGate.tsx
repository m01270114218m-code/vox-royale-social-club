import { useCallback, useEffect, useState } from "react";
import { ArrowUp, CheckCircle2, Download, Gem, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) || "2.0.1";

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [accessReady, setAccessReady] = useState(false);
  const [policyReady, setPolicyReady] = useState(false);

  const loadPolicy = useCallback(async () => {
    const { data, error } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "app_update_policy")
      .maybeSingle();
    if (!error) setPolicy((data?.value ?? null) as UpdatePolicy | null);
    setPolicyReady(true);
  }, []);

  useEffect(() => {
    let alive = true;

    const refreshAdminAccess = async (userId?: string) => {
      if (!userId) {
        if (alive) {
          setHasSession(false);
          setIsAdmin(false);
          setAccessReady(true);
        }
        return;
      }
      if (alive) setHasSession(true);
      const { data, error } = await supabase.rpc("is_admin", { _uid: userId });
      if (alive) {
        setIsAdmin(!error && !!data);
        setAccessReady(true);
      }
    };

    void Promise.all([
      supabase.auth.getUser().then(({ data }) => refreshAdminAccess(data.user?.id)),
      loadPolicy(),
    ]);

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      void refreshAdminAccess(session?.user?.id);
    });

    const channel = supabase
      .channel("public-app-update-policy")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_settings", filter: "key=eq.app_update_policy" }, (payload) => {
        if (!alive) return;
        if (payload.eventType === "DELETE") setPolicy(null);
        else if (payload.new && "value" in payload.new) {
          setPolicy((payload.new as { value: UpdatePolicy }).value);
          setPolicyReady(true);
        }
      })
      .subscribe();

    return () => {
      alive = false;
      authListener.subscription.unsubscribe();
      void supabase.removeChannel(channel);
    };
  }, [loadPolicy]);

  // Users may sign in on an old build so administrators can be identified.
  // Once signed in, regular accounts are blocked; administrators remain exempt.
  if (!accessReady || !policyReady || !hasSession || !policy?.enabled || isAdmin) return null;

  const blocked = (policy.blocked_versions ?? []).map(String).includes(APP_VERSION);
  const belowMinimum = !!policy.min_version && compareVersions(APP_VERSION, policy.min_version) < 0;
  if (!blocked && !belowMinimum) return null;

  let downloadUrl = "";
  try {
    const parsed = policy.download_url ? new URL(policy.download_url) : null;
    if (parsed && parsed.protocol === "https:") downloadUrl = parsed.toString();
  } catch {
    downloadUrl = "";
  }

  return (
    <div dir="rtl" className="fixed inset-0 z-[99999] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-[#090511]/95 p-4 backdrop-blur-xl">
      <style>{`
        @keyframes updateFloat { 0%,100% { transform: translateY(0) rotate(-3deg); } 50% { transform: translateY(-9px) rotate(3deg); } }
        @keyframes updateOrbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes updateGlow { 0%,100% { opacity:.45; transform:scale(.92); } 50% { opacity:.9; transform:scale(1.08); } }
        .update-float { animation:updateFloat 4s ease-in-out infinite; }
        .update-orbit { animation:updateOrbit 12s linear infinite; }
        .update-glow { animation:updateGlow 3s ease-in-out infinite; }
      `}</style>

      <div className="relative w-full max-w-[410px]">
        <div className="update-glow pointer-events-none absolute -inset-5 rounded-[3rem] bg-fuchsia-500/20 blur-3xl" />
        <section className="relative overflow-hidden rounded-[2rem] border border-amber-200/25 bg-gradient-to-b from-[#342044] via-[#1c122b] to-[#100b1a] p-6 text-center shadow-[0_30px_100px_rgba(0,0,0,.7),inset_0_1px_0_rgba(255,255,255,.12)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-fuchsia-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-amber-400/10 blur-3xl" />

          <div className="relative mx-auto mb-6 grid h-36 w-36 place-items-center">
            <div className="absolute inset-1 rounded-full border border-amber-200/20 shadow-[0_0_35px_rgba(251,191,36,.12)]" />
            <div className="update-orbit absolute inset-0 rounded-full border border-dashed border-amber-200/35">
              <span className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-amber-200 shadow-[0_0_14px_5px_rgba(251,191,36,.55)]" />
            </div>
            <div className="update-float relative grid h-24 w-24 place-items-center rounded-[2rem] border border-amber-100/40 bg-gradient-to-br from-[#ffe7a1] via-[#d69b36] to-[#78451b] shadow-[0_14px_0_#593316,0_24px_38px_rgba(0,0,0,.55),inset_0_3px_8px_rgba(255,255,255,.65)]">
              <div className="absolute inset-2 rounded-[1.45rem] border border-white/30" />
              <ArrowUp className="relative h-12 w-12 stroke-[3.2] text-[#3b210d] drop-shadow-[0_2px_1px_rgba(255,255,255,.35)]" />
            </div>
            <Sparkles className="absolute right-1 top-5 h-6 w-6 text-amber-200 drop-shadow-[0_0_10px_rgba(251,191,36,.8)]" />
            <Gem className="absolute bottom-4 left-1 h-5 w-5 text-fuchsia-200 drop-shadow-[0_0_10px_rgba(232,121,249,.8)]" />
          </div>

          <div className="relative">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-200/25 bg-amber-100/10 px-4 py-1.5 text-xs font-bold tracking-wide text-amber-100 shadow-inner">
              <Sparkles className="h-3.5 w-3.5" />
              تحديث إلزامي لصدى شات
            </div>
            <h1 className="font-display text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-l from-[#fff1bd] via-[#e8bd65] to-[#fff8df] drop-shadow-[0_3px_12px_rgba(245,190,85,.25)]">
              حان وقت التحديث!
            </h1>
            <p className="mx-auto mt-4 max-w-sm text-sm leading-8 text-white/80">
              {policy.message || "يتوفر إصدار جديد من صدى شات. حدّث التطبيق الآن لمتابعة استخدام حسابك والاستمتاع بأحدث التحسينات."}
            </p>

            <div className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3">
                <span className="block text-[10px] text-white/45">إصدارك الحالي</span>
                <strong className="mt-1 block text-sm text-white/90">{APP_VERSION}</strong>
              </div>
              <div className="rounded-2xl border border-amber-200/20 bg-amber-200/[0.08] px-3 py-3">
                <span className="block text-[10px] text-amber-100/60">الإصدار الجديد</span>
                <strong className="mt-1 block text-sm text-amber-100">{policy.latest_version || policy.min_version || "الأحدث"}</strong>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-center gap-2 text-[11px] text-emerald-200/90">
              <ShieldCheck className="h-4 w-4" />
              تحديث رسمي وآمن من إدارة صدى شات
            </div>

            {downloadUrl ? (
              <Button className="mt-6 h-14 w-full rounded-2xl border border-amber-100/50 bg-gradient-to-b from-[#ffe6a0] via-[#e6b64f] to-[#b97925] text-base font-extrabold text-[#281707] shadow-[0_7px_0_#704316,0_14px_25px_rgba(0,0,0,.35),inset_0_2px_5px_rgba(255,255,255,.65)] transition hover:brightness-110 active:translate-y-1 active:shadow-[0_3px_0_#704316] " onClick={() => { window.location.assign(downloadUrl); }}>
                <Download className="ml-2 h-5 w-5" />
                تحميل النسخة الجديدة
              </Button>
            ) : (
              <div className="mt-6 rounded-2xl border border-amber-200/20 bg-amber-100/10 p-4 text-sm leading-7 text-amber-100">
                رابط التحديث قيد التجهيز. يرجى المحاولة بعد قليل.
              </div>
            )}

            <div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-white/40">
              <CheckCircle2 className="h-3.5 w-3.5" />
              يلزم تثبيت التحديث للمتابعة
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
