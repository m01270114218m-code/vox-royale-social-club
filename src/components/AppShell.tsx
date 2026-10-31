import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Home, User, Crown, Sparkles, MessageCircle, Mic } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => {
    if (!loading && !user) nav({ to: "/auth" });
  }, [loading, user, nav]);
  if (loading || !user)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Crown className="h-12 w-12 animate-pulse text-primary" />
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
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false),
        supabase.from("conversations").select("id"),
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
  const item = "flex flex-1 flex-col items-center gap-0.5 text-[11px] text-muted-foreground";
  const active = { className: "text-primary" };

  async function myRoom() {
    const { data } = await supabase.from("rooms").select("id").eq("owner_id", user!.id).order("created_at").limit(1).maybeSingle();
    if (data) nav({ to: "/room/$id", params: { id: data.id } });
    else {
      toast("أنشئ غرفتك الأولى");
      nav({ to: "/", search: { create: 1 } });
    }
  }

  return (
    <>
      <div className="mx-auto min-h-screen max-w-2xl pb-28">{children}</div>
      <nav className="glass fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md items-end justify-around rounded-full px-2 py-2.5">
        <Link to="/" className={item} activeProps={active} activeOptions={{ exact: true }}>
          <Home className="h-6 w-6" />
          الغرف
        </Link>
        <Link to="/moments" className={item} activeProps={active}>
          <Sparkles className="h-6 w-6" />
          اللحظات
        </Link>
        <button onClick={myRoom} aria-label="غرفتي" className="-mt-8 flex h-16 w-16 items-center justify-center rounded-full bg-gold shadow-gold">
          <Mic className="h-8 w-8" />
        </button>
        <Link to="/messages" className={`${item} relative`} activeProps={active}>
          <MessageCircle className="h-6 w-6" />
          {unread > 0 && <span className="absolute -top-1 right-3 min-w-5 rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">{unread > 99 ? "99+" : unread}</span>}
          الرسائل
        </Link>
        <Link to="/profile" className={item} activeProps={active}>
          <User className="h-6 w-6" />
          أنا
        </Link>
      </nav>
    </>
  );
}

export function PageHeader({ title, back, right }: { title: string; back?: boolean; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 bg-background/70 px-4 py-4 backdrop-blur">
      {back && (
        <button onClick={() => (history.length > 1 ? history.back() : nav({ to: "/profile" }))} aria-label="رجوع" className="text-xl">
          →
        </button>
      )}
      <h1 className="font-display text-gold flex-1 text-2xl">{title}</h1>
      {right}
    </header>
  );
}
