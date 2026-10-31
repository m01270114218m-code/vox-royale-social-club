import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/AppShell";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "الأصدقاء — VOX ROYALE" },
      { name: "description", content: "أصدقاؤك ومتابعوك ومن تتابعهم وزوار ملفك." },
      { property: "og:title", content: "الأصدقاء — VOX ROYALE" },
      { property: "og:description", content: "أصدقاؤك ومتابعوك." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { tab?: "friends" | "followers" | "following" | "visitors" } => {
    const t = s["tab"];
    return t === "followers" || t === "following" || t === "visitors" || t === "friends" ? { tab: t } : {};
  },
  component: () => (
    <AppShell>
      <Friends />
    </AppShell>
  ),
});

type P = { id: string; display_name: string; avatar_url: string | null; level: number };
const TABS = [
  { id: "friends", label: "أصدقاء" },
  { id: "followers", label: "المتابِعون" },
  { id: "following", label: "أتابعهم" },
  { id: "visitors", label: "الزوار" },
] as const;

function Friends() {
  const { user } = useAuth();
  const uid = user!.id;
  const search = Route.useSearch();
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>(search.tab ?? "friends");
  const [list, setList] = useState<P[]>([]);

  useEffect(() => {
    (async () => {
      let ids: string[] = [];
      if (tab === "visitors") {
        const { data } = await supabase.from("profile_visits").select("visitor_id").eq("profile_id", uid).order("visited_at", { ascending: false }).limit(100);
        ids = (data ?? []).map((d) => d.visitor_id);
      } else {
        const [{ data: ers }, { data: ing }] = await Promise.all([
          supabase.from("follows").select("follower_id").eq("following_id", uid),
          supabase.from("follows").select("following_id").eq("follower_id", uid),
        ]);
        const a = new Set((ers ?? []).map((x) => x.follower_id));
        const b = new Set((ing ?? []).map((x) => x.following_id));
        ids = tab === "followers" ? [...a] : tab === "following" ? [...b] : [...a].filter((x) => b.has(x));
      }
      if (!ids.length) return setList([]);
      const { data } = await supabase.from("profiles").select("id,display_name,avatar_url,level").in("id", ids);
      setList(data ?? []);
    })();
  }, [tab, uid]);

  return (
    <div>
      <PageHeader title="الأصدقاء" back />
      <div className="mb-3 flex gap-2 overflow-x-auto px-4">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`shrink-0 rounded-full px-4 py-1.5 text-sm ${tab === t.id ? "bg-gold font-bold" : "glass text-muted-foreground"}`}>{t.label}</button>
        ))}
      </div>
      {list.length === 0 && <p className="py-10 text-center text-muted-foreground">القائمة فارغة</p>}
      <div className="space-y-1 px-4">
        {list.map((p) => (
          <Link key={p.id} to="/u/$id" params={{ id: p.id }} className="flex items-center gap-3 rounded-2xl p-2 hover:bg-secondary/40">
            <UserAvatar src={p.avatar_url} name={p.display_name} size={48} />
            <div><div className="font-bold">{p.display_name}</div><div className="text-xs text-muted-foreground">Lv.{p.level}</div></div>
          </Link>
        ))}
      </div>
    </div>
  );
}
