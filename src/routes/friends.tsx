import { IdentityBadges } from "@/components/IdentityBadges";
import { Search, Users, UserRound, Eye, UserPlus } from "lucide-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/AppShell";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "الأصدقاء — صدى شات" },
      { name: "description", content: "أصدقاؤك ومتابعوك ومن تتابعهم وزوار ملفك." },
      { property: "og:title", content: "الأصدقاء — صدى شات" },
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

type P = { id: string; display_name: string; avatar_url: string | null; level: number; vip_level: number };
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
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        let ids: string[] = [];
        if (tab === "visitors") {
          const { data } = await supabase.from("profile_visits").select("visitor_id").eq("profile_id", uid).order("visited_at", { ascending: false }).limit(100);
          ids = (data ?? []).map((d) => d.visitor_id);
        } else {
          const [{ data: ers }, { data: ing }] = await Promise.all([
            supabase.from("follows").select("follower_id").eq("following_id", uid),
            supabase.from("follows").select("following_id").eq("follower_id", uid),
          ]);
          const followers = new Set((ers ?? []).map((x) => x.follower_id));
          const following = new Set((ing ?? []).map((x) => x.following_id));
          ids = tab === "followers" ? [...followers] : tab === "following" ? [...following] : [...followers].filter((id) => following.has(id));
        }
        const uniqueIds = [...new Set(ids)].filter((id) => id !== uid);
        if (!uniqueIds.length) {
          if (active) setList([]);
          return;
        }
        const { data } = await supabase.from("profiles").select("id,display_name,avatar_url,level,vip_level").in("id", uniqueIds);
        if (active) {
          const byId = new Map((data ?? []).map((profile) => [profile.id, profile]));
          setList(uniqueIds.map((id) => byId.get(id)).filter((profile): profile is P => !!profile));
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    const channel = supabase.channel(`friends-list-live-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "follows", filter: `following_id=eq.${uid}` }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "follows", filter: `follower_id=eq.${uid}` }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "profile_visits", filter: `profile_id=eq.${uid}` }, () => { void load(); })
      .subscribe();
    void load();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [tab, uid]);

  const filteredList = list.filter((profile) => profile.display_name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const activeTab = TABS.find((item) => item.id === tab) ?? TABS[0];
  const ActiveIcon = tab === "visitors" ? Eye : tab === "friends" ? Users : tab === "following" ? UserPlus : UserRound;

  return (
    <div className="social-list-reference friends-list-reference" dir="rtl">
      <PageHeader title="الأصدقاء" back />
      <div className="social-list-toolbar mx-4 mb-3">
        <div className="flex items-center gap-3">
          <span className="social-list-feature-icon"><ActiveIcon className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="social-list-kicker">VOX ROYALE · SOCIAL</div>
            <div className="social-list-title">{activeTab.label}</div>
            <p className="text-xs text-muted-foreground">تابع مجتمعك وتواصل مع أصدقائك</p>
          </div>
          <span className="social-list-count">{filteredList.length}</span>
        </div>
        <div className="social-list-search"><Search className="h-4 w-4" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث بالاسم..." aria-label="ابحث بالاسم" /></div>
      </div>
      <div className="social-tab-rail mx-4 mb-4">
        {TABS.map((t) => (
          <button key={t.id} type="button" aria-pressed={tab === t.id} onClick={() => setTab(t.id)} className="social-tab-button">{t.label}</button>
        ))}
      </div>
      {loading ? <p className="px-4 py-10 text-center text-sm text-muted-foreground">جارٍ تحميل القائمة...</p> : filteredList.length === 0 ? <p className="social-empty mx-4 py-10 text-center text-sm text-muted-foreground">{query.trim() ? "لا توجد نتائج مطابقة للبحث" : "القائمة فارغة حاليًا"}</p> : null}
      <div className="space-y-2 px-4">
        {filteredList.map((p) => (
          <Link key={p.id} to="/u/$id" params={{ id: p.id }} className="social-person-row glass card-3d flex items-center gap-3 rounded-2xl p-3">
            <UserAvatar src={p.avatar_url} name={p.display_name} size={56} vip={p.vip_level} />
            <div className="min-w-0 flex-1"><div className="truncate font-bold">{p.display_name}</div><IdentityBadges level={p.level} vip={p.vip_level} /></div>
            <span className="social-person-arrow">‹</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
