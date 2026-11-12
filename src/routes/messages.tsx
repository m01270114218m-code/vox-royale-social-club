import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, Heart, Users, Shield, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/AppShell";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/messages")({
  head: () => ({
    meta: [
      { title: "الدردشات — صدى شات" },
      { name: "description", content: "رسائلك الخاصة وإشعاراتك وأصدقاؤك." },
      { property: "og:title", content: "الدردشات — صدى شات" },
      { property: "og:description", content: "رسائلك الخاصة وإشعاراتك." },
    ],
  }),
  component: () => (
    <AppShell>
      <Messages />
    </AppShell>
  ),
});

type Conv = { id: string; user_a: string; user_b: string; last_message: string | null; last_at: string };
type P = { id: string; display_name: string; avatar_url: string | null };

function Messages() {
  const { user } = useAuth();
  const uid = user!.id;
  const [convs, setConvs] = useState<Conv[]>([]);
  const [people, setPeople] = useState<Record<string, P>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [notif, setNotif] = useState(0);
  const [q, setQ] = useState("");

  async function load() {
    const { data } = await supabase.from("conversations").select("*").order("last_at", { ascending: false }).limit(100);
    const list = (data ?? []) as Conv[];
    setConvs(list);
    const others = list.map((c) => (c.user_a === uid ? c.user_b : c.user_a));
    if (others.length) {
      const { data: ps } = await supabase.from("profiles").select("id,display_name,avatar_url").in("id", others);
      setPeople(Object.fromEntries((ps ?? []).map((p) => [p.id, p])));
      const { data: um } = await supabase.from("messages").select("conversation_id").in("conversation_id", list.map((c) => c.id)).neq("sender_id", uid).is("read_at", null);
      const counts: Record<string, number> = {};
      (um ?? []).forEach((m) => (counts[m.conversation_id] = (counts[m.conversation_id] ?? 0) + 1));
      setUnread(counts);
    }
    const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false);
    setNotif(count ?? 0);
  }
  useEffect(() => {
    load();
    const ch = supabase
      .channel(`convs-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shortcuts = [
    { to: "/notifications" as const, label: "رسالة النظام والإشعارات", sub: "الإعجابات، المتابعات، الهدايا", icon: Bell, color: "bg-accent", badge: notif },
    { to: "/friends" as const, label: "الأصدقاء", sub: "من تتابعهم ويتابعونك", icon: Heart, color: "bg-destructive", badge: 0 },
    { to: "/families" as const, label: "العائلة", sub: "عائلتك وطلبات الانضمام", icon: Users, color: "bg-secondary", badge: 0 },
    { to: "/help" as const, label: "مركز الدعم", sub: "بلاغاتك وتذاكرك", icon: Shield, color: "bg-gold", badge: 0 },
  ];
  const filtered = convs.filter((c) => {
    const o = people[c.user_a === uid ? c.user_b : c.user_a];
    return !q || o?.display_name.includes(q);
  });

  return (
    <div>
      <PageHeader title="الدردشات" />
      <div className="relative mx-4 mb-3">
        <Search className="absolute right-3 top-2.5 h-5 w-5 text-muted-foreground" />
        <Input className="pr-10" placeholder="ابحث في المحادثات" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="space-y-1 px-4">
        {shortcuts.map((s) => (
          <Link key={s.to} to={s.to} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-secondary/40">
            <div className={`relative flex h-14 w-14 items-center justify-center rounded-full ${s.color}`}>
              <s.icon className="h-7 w-7" />
              {s.badge > 0 && <span className="absolute -top-1 -left-1 rounded-full bg-destructive px-1.5 text-xs text-destructive-foreground">{s.badge}</span>}
            </div>
            <div><div className="font-bold">{s.label}</div><div className="text-xs text-muted-foreground">{s.sub}</div></div>
          </Link>
        ))}
      </div>
      <h2 className="mt-4 px-4 text-sm font-bold text-muted-foreground">المحادثات الخاصة</h2>
      {filtered.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">لا توجد محادثات. افتح ملف أي مستخدم واضغط «مراسلة».</p>}
      <div className="space-y-1 px-4 pt-2">
        {filtered.map((c) => {
          const oid = c.user_a === uid ? c.user_b : c.user_a;
          const o = people[oid];
          return (
            <Link key={c.id} to="/chat/$id" params={{ id: c.id }} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-secondary/40">
              <UserAvatar src={o?.avatar_url} name={o?.display_name} size={52} />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between"><span className="font-bold">{o?.display_name ?? "…"}</span><span className="text-xs text-muted-foreground">{new Date(c.last_at).toLocaleDateString("ar-EG")}</span></div>
                <div className="truncate text-sm text-muted-foreground">{c.last_message ?? "ابدأ المحادثة"}</div>
              </div>
              {!!unread[c.id] && <span className="rounded-full bg-destructive px-2 text-xs text-destructive-foreground">{unread[c.id]}</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
