import { icons3d } from "@/lib/assets3d";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Home, User, Crown, Sparkles, MessageCircle, Mic, Shield } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useAppUiConfig } from "@/hooks/useAppUiConfig";
import { App as CapacitorApp } from "@capacitor/app";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [loading, user, nav]);
  if (loading || !user)
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

function PersistentRoomVoice() {
  const { user } = useAuth();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [members, setMembers] = useState<string[]>([]);
  const [micEnabled, setMicEnabled] = useState(false);

  useEffect(() => {
    const resolve = () => {
      const pathMatch = window.location.pathname.match(/^\\/room\\/([^/]+)/);
      const minimized = sessionStorage.getItem("vox_minimized_room_id");
      setRoomId(pathMatch?.[1] || minimized || null);
    };
    resolve();
    const onMinimized = () => resolve();
    const onPop = () => window.setTimeout(resolve, 0);
    window.addEventListener("vox-room-minimized", onMinimized);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("vox-room-minimized", onMinimized);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  useEffect(() => {
    if (!roomId || !user?.id) {
      setMembers([]);
      setMicEnabled(false);
      return;
    }
    let alive = true;
    const load = async () => {
      const [{ data: memberRows }, { data: seatRow }] = await Promise.all([
        supabase.from("room_members").select("user_id").eq("room_id", roomId),
        supabase.from("room_seats").select("user_id,is_muted").eq("room_id", roomId).eq("user_id", user.id).maybeSingle(),
      ]);
      if (!alive) return;
      setMembers((memberRows || []).map((row) => row.user_id));
      setMicEnabled(!!seatRow && !seatRow.is_muted && sessionStorage.getItem("vox_mic_permission") === "1");
    };
    void load();
    const ch = supabase.channel(`persistent-room-voice-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_seats", filter: `room_id=eq.${roomId}` }, load)
      .subscribe();
    const onMicPermission = () => void load();
    window.addEventListener("vox-mic-permission", onMicPermission);
    return () => {
      alive = false;
      window.removeEventListener("vox-mic-permission", onMicPermission);
      supabase.removeChannel(ch);
    };
  }, [roomId, user?.id]);

  if (!roomId || !user?.id) return null;
  return <RoomVoice roomId={roomId} uid={user.id} members={members} micEnabled={micEnabled} onSpeakingUsers={(users) => window.dispatchEvent(new CustomEvent("vox-speaking-users", { detail: users }))} />;
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
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let active = true;
    if (!user?.id) { setIsAdmin(false); return; }
    supabase.rpc("is_admin", { _uid: user.id }).then(({ data, error }) => {
      if (active) setIsAdmin(!error && !!data);
    });
    return () => { active = false; };
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
      <PersistentRoomVoice />
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
        {isAdmin && (
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
