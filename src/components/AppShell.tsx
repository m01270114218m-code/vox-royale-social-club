import { icons3d } from "@/lib/assets3d";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Home, User, Crown, Sparkles, MessageCircle, Mic, Shield } from "lucide-react";
import { toast } from "sonner";
import { getDeviceId, useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAppUiConfig } from "@/hooks/useAppUiConfig";
import { App as CapacitorApp } from "@capacitor/app";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const [deviceAllowed, setDeviceAllowed] = useState(false);
  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [loading, user, nav]);
  useEffect(() => {
    let active = true;
    if (loading || !user?.id) {
      setDeviceAllowed(false);
      return () => { active = false; };
    }
    setDeviceAllowed(false);
    let checking = false;
    let deviceId = getDeviceId();
    const registrationKey = `vox_device_registered:${user.id}`;
    const checkDeviceAccess = async (retry = false) => {
      if (checking || !active) return;
      checking = true;
      try {
        // Refresh an expired access token before checking device permissions.
        let { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          const refreshed = await supabase.auth.refreshSession();
          if (refreshed.error) throw refreshed.error;
          sessionData = { session: refreshed.data.session };
        }
        if (!sessionData.session) throw new Error("not_authenticated");

        const { data: allowed, error } = await supabase.rpc("check_device_access", { _device: deviceId });
        if (error) throw error;
        if (allowed !== true) throw new Error("device_access_denied");

        // Anonymous quick accounts are already registered once during creation.
        if (!user.is_anonymous && localStorage.getItem(registrationKey) !== "1") {
          const { error: registerError } = await supabase.rpc("register_device", { _device: deviceId });
          if (registerError) throw registerError;
          localStorage.setItem(registrationKey, "1");
        }
        if (active) setDeviceAllowed(true);
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : String(error);
        const banned = message.includes("account_banned") || message.includes("device_banned");
        const linked = message.includes("device_already_linked");
        const invalidDevice = message.includes("invalid_device_id");
        const denied = message.includes("device_access_denied");
        if (invalidDevice && !retry) {
          localStorage.removeItem("vox_royale_device_id");
          localStorage.removeItem("vox_device_id");
          deviceId = getDeviceId();
          checking = false;
          await checkDeviceAccess(true);
          return;
        }
        if (banned) {
          toast.error(message.includes("account_banned") ? "هذا الحساب محظور من استخدام التطبيق" : "هذا الجهاز محظور من استخدام التطبيق");
          await supabase.auth.signOut({ scope: "local" });
          if (active) setDeviceAllowed(false);
        } else if (linked || denied) {
          toast.error(linked ? "هذا الجهاز مرتبط بحساب آخر بالفعل" : "تم رفض صلاحية هذا الجهاز");
          if (active) setDeviceAllowed(false);
        } else {
          // A temporary network/Auth API outage must not strand an already
          // authenticated user behind a permanent spinner. Bans remain enforced
          // whenever the server responds; retry the check on the next resume.
          console.warn("[Device access] temporary verification failure:", message);
          if (active) setDeviceAllowed(true);
          toast.error("تعذر الاتصال بخدمة التحقق مؤقتًا؛ سنعيد المحاولة تلقائيًا عند عودة الاتصال");
        }
      } finally {
        checking = false;
      }
    };
    void checkDeviceAccess();
    // Re-check when the app returns to the foreground so a newly applied ban
    // is enforced on the next app resume, not only after a fresh login.
    const onVisibility = () => { if (document.visibilityState === "visible") void checkDeviceAccess(); };
    const nativeStateListener = CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void checkDeviceAccess();
    });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibility);
      void nativeStateListener.then((listener) => listener.remove()).catch(() => undefined);
    };
  }, [loading, user?.id]);
  if (loading || !user || !deviceAllowed)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <img src={icons3d.micHost} alt="صدى شات" className="h-14 w-14 object-contain animate-pulse" />
      </div>
    );
  return <>{children}</>;
}

function useUnread(uid?: string) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!uid) return;
    const load = async () => {
      const [{ count: a }, { data: convs }] = await Promise.all([
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("is_read", false),
        supabase.from("conversations").select("id").or(`user_a.eq.${uid},user_b.eq.${uid}`),
      ]);
      let b = 0;
      if (convs?.length) {
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .in("conversation_id", convs.map((c) => c.id))
          .neq("sender_id", uid)
          .is("read_at", null);
        b = count ?? 0;
      }
      setN((a ?? 0) + b);
    };
    load();
    const ch = supabase
      .channel(`unread-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${uid}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [uid]);
  return n;
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <ShellInner>{children}</ShellInner>
    </RequireAuth>
  );
}

function ShellInner({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const unread = useUnread(user?.id);
  useEffect(() => {
    const onPop = () => {
      if (window.history.length <= 1) return;
    };
    window.addEventListener("popstate", onPop);
    let listener: { remove: () => Promise<void> } | null = null;
    void CapacitorApp.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack || window.history.length > 1) {
        window.history.back();
      } else {
        nav({ to: "/" });
      }
    }).then((h) => { listener = h; });
    return () => {
      window.removeEventListener("popstate", onPop);
      void listener?.remove();
    };
  }, [nav]);
  const ui = useAppUiConfig();
  const [canSeeAdmin, setCanSeeAdmin] = useState(false);
  useEffect(() => {
    let active = true;
    if (!user?.id) { setCanSeeAdmin(false); return; }
    const refresh = async () => {
      const { data, error } = await supabase.rpc("can_access_admin_dashboard");
      if (active) setCanSeeAdmin(!error && data === true);
    };
    void refresh();
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user?.id]);
  const item = "flex flex-1 flex-col items-center gap-0.5 text-[11px] text-muted-foreground";
  const active = { className: "text-primary" };

  async function myRoom() {
    const { data } = await supabase.from("rooms").select("id").eq("owner_id", user!.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (data) nav({ to: "/room/$id", params: { id: data.id } });
    else {
      toast("أنشئ غرفتك الأولى");
      nav({ to: "/", search: { create: 1 } });
    }
  }

  return (
    <>
      <div className="app-shell-content min-h-dvh w-full pb-24">{children}</div>
      <nav className="app-bottom-nav glass fixed inset-x-3 bottom-[max(0.5rem,env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-end justify-around gap-1 rounded-full px-2 py-2">
        <Link to="/" className={item} activeProps={active} activeOptions={{ exact: true }}>
          <img src={ui.bottom_nav.home_icon || icons3d.home} alt="" className="h-7 w-7 drop-shadow-lg" />
          {ui.bottom_nav.home_label || "الغرف"}
        </Link>
        <Link to="/moments" className={item} activeProps={active}>
          <img src={ui.bottom_nav.explore_icon || icons3d.explore} alt="" className="h-8 w-8 drop-shadow-lg" />
          {ui.bottom_nav.explore_label || "اللحظات"}
        </Link>
        <Button onClick={myRoom} aria-label="غرفتي" title="غرفتي" className="-mt-8 h-16 w-16 rounded-full bg-gold p-1 shadow-gold">
          <img src={ui.bottom_nav.room_icon || ui.mic.host_asset_url || icons3d.micHost} alt="" className="h-14 w-14 object-contain" />
        </Button>
        <Link to="/messages" className={`${item} relative`} activeProps={active}>
          <img src={ui.bottom_nav.messages_icon || icons3d.messages} alt="" className="h-8 w-8 drop-shadow-lg" />
          {unread > 0 && <span className="absolute -top-1 right-3 min-w-5 rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">{unread > 99 ? "99+" : unread}</span>}
          {ui.bottom_nav.messages_label || "الرسائل"}
        </Link>
        <Link to="/profile" className={item} activeProps={active}>
          <img src={ui.bottom_nav.profile_icon || icons3d.profile} alt="" className="h-8 w-8 drop-shadow-lg" />
          {ui.bottom_nav.profile_label || "أنا"}
        </Link>
        {canSeeAdmin && (
          <Link to="/admin" className={item} activeProps={active}>
            <Shield className="h-7 w-7" />
            الإدارة
          </Link>
        )}
      </nav>
    </>
  );
}

export function PageHeader({ title, back, right }: { title: string; back?: boolean; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 bg-background/70 px-4 py-4 backdrop-blur">
      {back && (
        <Button variant="ghost" size="icon" onClick={() => (history.length > 1 ? history.back() : nav({ to: "/profile" }))} aria-label="رجوع" title="رجوع"><img src={icons3d.back} alt="" className="h-7 w-7 rotate-180 object-contain" /></Button>
      )}
      <h1 className="font-display text-gold flex-1 text-2xl">{title}</h1>
      {right}
    </header>
  );
}
