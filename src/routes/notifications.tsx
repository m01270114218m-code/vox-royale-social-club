import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

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
type N = { id: string; kind: string; title: string; body: string; is_read: boolean; created_at: string };

function Notifs() {
  const [items, setItems] = useState<N[]>([]);
  async function load() {
    const { data } = await supabase.from("notifications").select("id,kind,title,body,is_read,created_at").order("created_at", { ascending: false }).limit(100);
    setItems(data ?? []);
  }
  useEffect(() => {
    load().then(() => supabase.from("notifications").update({ is_read: true }).eq("is_read", false));
  }, []);
  async function clear() {
    const ids = items.map((i) => i.id);
    if (ids.length) await supabase.from("notifications").delete().in("id", ids);
    setItems([]);
  }
  return (
    <div>
      <PageHeader title="الإشعارات" back right={items.length > 0 && <Button size="sm" variant="outline" onClick={clear}>مسح الكل</Button>} />
      <div className="space-y-2 px-4">
        <div className="glass rounded-2xl p-3 text-sm">📢 <b>رسالة النظام</b> — شكراً لاختيارك VOX ROYALE! يُمنع المحتوى المسيء أو غير اللائق، وأي مخالفة تعرّض الحساب للحظر.</div>
        {items.length === 0 && <p className="py-8 text-center text-muted-foreground">لا توجد إشعارات</p>}
        {items.map((n) => (
          <div key={n.id} className={`glass flex gap-3 rounded-2xl p-3 ${n.is_read ? "" : "ring-1 ring-primary"}`}>
            <span className="text-2xl">{ICON[n.kind] ?? "🔔"}</span>
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
