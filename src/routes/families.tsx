import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Crown, Users, Plus, Check, X, LogOut, Search, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/AppShell";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/families")({
  head: () => ({
    meta: [
      { title: "العائلات — صدى شات" },
      { name: "description", content: "أنشئ عائلتك أو انضم إلى عائلة وتنافس على النقاط." },
      { property: "og:title", content: "العائلات — صدى شات" },
      { property: "og:description", content: "عائلات صدى شات وترتيبها." },
    ],
  }),
  component: () => (
    <AppShell>
      <Families />
    </AppShell>
  ),
});

type F = { id: string; name: string; emblem: string; description: string | null; member_count: number; points: number; owner_id: string };
type M = { user_id: string; role: string; status: string; family_id: string };
type P = { id: string; display_name: string; avatar_url: string | null };

function Families() {
  const { user } = useAuth();
  const uid = user!.id;
  const [list, setList] = useState<F[]>([]);
  const [mine, setMine] = useState<M | null>(null);
  const [members, setMembers] = useState<(M & { p?: P | undefined })[]>([]);
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [emblem, setEmblem] = useState("👑");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [{ data: fs }, { data: m }] = await Promise.all([
        supabase.from("families").select("*").order("points", { ascending: false }).limit(50),
        supabase.from("family_members").select("*").eq("user_id", uid).maybeSingle(),
      ]);
      setList((fs as F[]) ?? []);
      setMine((m as M) ?? null);
      if (m && m.status === "active") {
        const { data: ms } = await supabase.from("family_members").select("*").eq("family_id", m.family_id);
        const ids = (ms ?? []).map((x) => x.user_id);
        const { data: ps } = ids.length ? await supabase.from("profiles").select("id,display_name,avatar_url").in("id", ids) : { data: [] };
        setMembers((ms ?? []).map((x) => ({ ...(x as M), p: (ps as P[]).find((p) => p.id === x.user_id) })));
      } else setMembers([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(p: PromiseLike<{ error: { message: string } | null }>, ok: string) {
    const { error } = await p;
    if (error) toast.error(error.message);
    else {
      toast.success(ok);
      load();
    }
  }

  const myFam = mine && list.find((f) => f.id === mine.family_id);
  const filteredList = list.filter((family) => {
    const term = query.trim().toLocaleLowerCase();
    return !term || family.name.toLocaleLowerCase().includes(term) || (family.description ?? "").toLocaleLowerCase().includes(term);
  });
  const isLeader = myFam && (myFam.owner_id === uid || mine?.role === "owner" || mine?.role === "admin");

  return (
    <div className="social-list-reference family-list-reference" dir="rtl">
      <PageHeader title="العائلات" back right={!mine && <Button size="sm" onClick={() => setShow(!show)}><Plus className="h-4 w-4" /> إنشاء</Button>} />
      <div className="social-list-toolbar mx-4 mb-4">
        <div><div className="social-list-kicker">VOX ROYALE · COMMUNITY</div><div className="social-list-title">عائلات تجمعنا</div><p className="text-xs text-muted-foreground">اكتشف العائلات وتابع ترتيبها ونقاطها</p></div>
        <div className="social-list-search"><Search className="h-4 w-4" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث عن عائلة..." aria-label="ابحث عن عائلة" /></div>
      </div>
      {show && !mine && (
        <div className="glass card-3d mx-4 mb-4 space-y-2 rounded-3xl p-4">
          <div className="flex gap-2">
            <Input className="w-16 text-center text-2xl" value={emblem} maxLength={2} onChange={(e) => setEmblem(e.target.value)} />
            <Input placeholder="اسم العائلة" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />
          </div>
          <Input placeholder="وصف قصير" value={desc} maxLength={120} onChange={(e) => setDesc(e.target.value)} />
          <Button className="w-full" disabled={name.trim().length < 2} onClick={() => run(supabase.rpc("create_family", { _name: name.trim(), _description: desc, _emblem: emblem || "👑" }), "تم إنشاء العائلة")}>إنشاء العائلة</Button>
        </div>
      )}

      {myFam && (
        <div className="social-feature-card glass card-3d mx-4 mb-4 rounded-3xl p-4">
          <div className="flex items-center gap-3">
            <div className="bg-gold flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-gold">{myFam.emblem}</div>
            <div className="flex-1">
              <div className="font-display text-gold text-xl">{myFam.name}</div>
              <div className="text-xs text-muted-foreground">{myFam.member_count} عضو · {myFam.points} نقطة</div>
              {mine?.status !== "active" && <div className="text-xs text-primary">طلبك قيد المراجعة</div>}
            </div>
            <Button size="sm" variant="outline" onClick={() => run(supabase.rpc("leave_family"), "غادرت العائلة")}><LogOut className="h-4 w-4" /></Button>
          </div>
          {myFam.description && <p className="mt-2 text-sm text-muted-foreground">{myFam.description}</p>}
          <div className="mt-3 space-y-2">
            {members.map((m) => (
              <div key={m.user_id} className="flex items-center gap-2">
                <UserAvatar src={m.p?.avatar_url} name={m.p?.display_name} size={36} />
                <span className="flex-1 text-sm">{m.p?.display_name ?? "…"} {m.role === "owner" && <Crown className="inline h-4 w-4 text-primary" />}</span>
                {m.status === "pending" && isLeader ? (
                  <>
                    <Button size="icon" variant="ghost" onClick={() => run(supabase.rpc("family_decide", { _family: myFam.id, _user: m.user_id, _accept: true }), "تم القبول")}><Check className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => run(supabase.rpc("family_decide", { _family: myFam.id, _user: m.user_id, _accept: false }), "تم الرفض")}><X className="h-4 w-4" /></Button>
                  </>
                ) : m.status === "pending" ? <span className="text-xs text-muted-foreground">بانتظار</span> : null}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between px-4"><h2 className="text-sm font-black text-amber-100">ترتيب العائلات</h2><span className="text-[11px] text-muted-foreground">{filteredList.length} عائلة</span></div>
      {loading ? <p className="px-4 py-8 text-center text-sm text-muted-foreground">جارٍ تحميل العائلات...</p> : filteredList.length === 0 ? <p className="social-empty mx-4 py-8 text-center text-sm text-muted-foreground">{query.trim() ? "لا توجد نتائج مطابقة للبحث" : "لا توجد عائلات بعد. كن أول من ينشئ عائلة."}</p> : null}
      <div className="space-y-2 px-4">
        {filteredList.map((f) => (
          <div key={f.id} className="social-family-row glass card-3d flex items-center gap-3 rounded-2xl p-3">
            <span className="social-family-rank"><Trophy className="h-3.5 w-3.5" />{list.findIndex((item) => item.id === f.id) + 1}</span>

            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-2xl">{f.emblem}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{f.name}</div>
              <div className="text-xs text-muted-foreground"><Users className="inline h-3 w-3" /> {f.member_count} · {f.points} نقطة</div>
            </div>
            {!mine && <Button size="sm" onClick={() => run(supabase.rpc("request_join_family", { _family: f.id }), "أُرسل طلب الانضمام")}>انضمام</Button>}
          </div>
        ))}
      </div>
    </div>
  );
}
