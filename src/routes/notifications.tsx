import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "الإشعارات — VOX ROYALE" },
      { name: "description", content: "إشعارات الإعجابات والمتابعات والهدايا والعائلة." },
      { property: "og:title", content: "الإشعارات — VOX ROYALE" },
      { property: "og:description", content: "كل إشعاراتك في مكان واحد." },
    ],
  }),
  component: () => (
    <AppShell>
      <Notifs />
    </AppShell>
  ),
});

const ICON: Record<string, string> = { like: "❤️", comment: "💬", follow: "➕", gift: "🎁", family: "🛡️", system: "📢" };
type N = { id: string; title: string; body: string; read_at: string | null; created_at: string };

function Notifs() {
  const { user } = useAuth();
  const [items, setItems] = useState<N[]>([]);
  async function load() {
    if (!user) return;
    const { data, error } = await supabase.from("user_notifications").select("id,title,body,read_at,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
    if (error) { console.error(error); return; }
    setItems(data ?? []);
  }
  useEffect(() => {
    void load();
  }, [user]);
  async function clear() {
    if (!user) return;
    const ids = items.filter((i) => !i.read_at).map((i) => i.id);
    if (ids.length) { const { error } = await supabase.from("user_notifications").update({ read_at: new Date().toISOString() }).in("id", ids).eq("user_id", user.id); if (error) { console.error(error); return; } }
    setItems((old) => old.map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })));
  }
  return (
    <div>
      <PageHeader title="الإشعارات" back right={items.some((i) => !i.read_at) && <Button size="sm" variant="outline" onClick={clear}>تعليم الكل كمقروء</Button>} />
      <div className="space-y-2 px-4">
        <div className="glass rounded-2xl p-3 text-sm">📢 <b>رسالة النظام</b> — شكراً لاختيارك VOX ROYALE! يُمنع المحتوى المسيء أو غير اللائق، وأي مخالفة تعرّض الحساب للحظر.</div>
        {items.length === 0 && <p className="py-8 text-center text-muted-foreground">لا توجد إشعارات</p>}
        {items.map((n) => (
          <div key={n.id} className={`glass flex gap-3 rounded-2xl p-3 ${n.read_at ? "" : "ring-1 ring-primary"}`}>
            <span className="text-2xl">{ "🔔" }</span>
            <div className="flex-1">
              <div className="font-bold">{n.title}</div>
              {n.body && <div className="text-sm text-muted-foreground">{n.body}</div>}
              <div className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString("ar-EG")}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
