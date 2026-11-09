import { IdentityBadges } from "@/components/IdentityBadges";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageCircle, Flag, Ban, UserPlus, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/AppShell";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { errMsg, flagOf } from "@/lib/vox";

export const Route = createFileRoute("/u/$id")({
  head: () => ({
    meta: [
      { title: "ملف مستخدم — VOX ROYALE" },
      { name: "description", content: "الملف الشخصي للمستخدم في VOX ROYALE." },
      { property: "og:title", content: "ملف مستخدم — VOX ROYALE" },
      { property: "og:description", content: "الملف الشخصي للمستخدم." },
    ],
  }),
  component: () => (
    <AppShell>
      <UserPage />
    </AppShell>
  ),
});

type P = { id: string; display_no: number; display_name: string; avatar_url: string | null; bio: string | null; country: string | null; level: number; vip_level: number; id_color?: string | null; name_color?: string | null; name_effect?: string | null; name_effect_speed?: number | null; equipped_frame?: string | null; equipped_entry?: string | null };
type Badge = { badge_key: string; badge_name: string; badge_asset_key: string | null; badge_color: string; is_equipped: boolean };

function UserPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const uid = user!.id;
  const nav = useNavigate();
  const [p, setP] = useState<P | null>(null);
  const [stats, setStats] = useState({ followers: 0, following: 0, friends: 0, posts: 0, supportCoins: 0, supportDiamonds: 0, supporters: 0 });
  const [support, setSupport] = useState<{ sender_id: string; total_price: number; quantity: number; created_at: string; gift_name: string; sender_name: string; sender_avatar: string | null }[]>([]);
  const [posts, setPosts] = useState<{ id: string; body: string; image_url: string | null; like_count: number; comment_count: number; created_at: string }[]>([]);
  const [isFollowing, setIsFollowing] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    if (id === uid) {
      nav({ to: "/profile" });
      return;
    }
    const live = supabase.channel(`public-profile-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${id}` }, (payload) => {
        setP((current) => current ? ({ ...current, ...(payload.new as P) }) : (payload.new as P));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_badges", filter: `user_id=eq.${id}` }, async () => {
        const { data: rows } = await supabase.from("user_badges").select("badge_key,badge_name,badge_asset_key,badge_color,is_equipped").eq("user_id", id).eq("is_equipped", true);
        setBadges((rows ?? []) as Badge[]);
      })
      .subscribe();
    (async () => {
      const { data } = await supabase.from("profiles").select("id,display_no,display_name,avatar_url,bio,country,level,vip_level,id_color,name_color,name_effect,name_effect_speed,equipped_frame,equipped_entry").eq("id", id).maybeSingle();
      setP(data);
      const [a, b, c, f, bl, badgeRows, publicStats, giftRows] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", id),
        supabase.from("posts").select("*", { count: "exact", head: true }).eq("user_id", id),
        supabase.from("follows").select("follower_id").eq("follower_id", uid).eq("following_id", id),
        supabase.from("user_blocks").select("blocked_id").eq("blocker_id", uid).eq("blocked_id", id),
        supabase.from("user_badges").select("badge_key,badge_name,badge_asset_key,badge_color,is_equipped").eq("user_id", id).eq("is_equipped", true),
        supabase.rpc("get_public_profile_stats", { _profile: id }),
        supabase.from("gift_transactions").select("sender_id,total_price,quantity,created_at,gifts(name),profiles!gift_transactions_sender_id_fkey(display_name,avatar_url)").eq("receiver_id", id).order("created_at", { ascending: false }).limit(30),
      ]);
      setStats({ followers: a.count ?? 0, following: b.count ?? 0, friends: Number(publicStats.data?.[0]?.friends ?? 0), posts: c.count ?? 0, supportCoins: Number(publicStats.data?.[0]?.support_coins ?? 0), supportDiamonds: Number(publicStats.data?.[0]?.support_diamonds ?? 0), supporters: Number(publicStats.data?.[0]?.supporters ?? 0) });
      setSupport((giftRows.data ?? []).map((g: any) => ({ sender_id: g.sender_id, total_price: Number(g.total_price), quantity: g.quantity, created_at: g.created_at, gift_name: g.gifts?.name ?? "هدية", sender_name: g.profiles?.display_name ?? "مستخدم", sender_avatar: g.profiles?.avatar_url ?? null })));
      const { data: postRows } = await supabase.from("posts").select("id,body,image_url,like_count,comment_count,created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(50);
      setPosts((postRows ?? []) as typeof posts);
      setIsFollowing(!!f.data?.length);
      setBlocked(!!bl.data?.length);
      setBadges((badgeRows.data ?? []) as Badge[]);
      supabase.rpc("visit_profile", { _profile: id });
    })();
    return () => { void supabase.removeChannel(live); };
  }, [id, uid, nav]);

  async function toggleFollow() {
    const { error } = isFollowing
      ? await supabase.from("follows").delete().eq("follower_id", uid).eq("following_id", id)
      : await supabase.from("follows").insert({ follower_id: uid, following_id: id });
    if (error) { toast.error(error.message); return; }
    setIsFollowing(!isFollowing);
    setStats((s) => ({ ...s, followers: s.followers + (isFollowing ? -1 : 1) }));
  }
  async function message() {
    const { data, error } = await supabase.rpc("get_or_create_conversation", { _other: id });
    if (error) { toast.error(errMsg(error)); return; }
    nav({ to: "/chat/$id", params: { id: data as string } });
  }
  async function toggleBlock() {
    const { error } = blocked
      ? await supabase.from("user_blocks").delete().eq("blocker_id", uid).eq("blocked_id", id)
      : await supabase.from("user_blocks").insert({ blocker_id: uid, blocked_id: id });
    if (error) { toast.error(error.message); return; }
    setBlocked(!blocked);
    toast.success(blocked ? "تم إلغاء الحظر" : "تم حظر المستخدم من مراسلتك");
  }
  async function report() {
    const reason = prompt("سبب البلاغ (إساءة، احتيال، انتحال شخصية...)");
    if (!reason) return;
    const { error } = await supabase.rpc("submit_report", { _type: "user", _target: id, _category: "مستخدم", _details: reason });
    if (error) toast.error(errMsg(error));
    else toast.success("تم إرسال البلاغ للإدارة");
  }

  if (!p) return <PageHeader title="…" back />;
  return (
    <div className="-mx-4 -mt-4 min-h-screen bg-background pb-8" dir="rtl">
      <section className="relative overflow-hidden bg-[#111c2b] px-4 pb-8 pt-4 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(55,116,173,.32),transparent_55%)]" />
        <div className="relative z-10 flex items-center justify-between">
          <PageHeader title="" back />
          <div className="flex items-center gap-3 text-white/80">
            <button type="button" aria-label="إبلاغ" onClick={report}><Flag className="h-5 w-5" /></button>
            <button type="button" aria-label="حظر" onClick={toggleBlock}><Ban className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="relative z-10 mx-auto mt-5 flex max-w-md flex-col items-center text-center">
          <div className="relative">
            <UserAvatar src={p.avatar_url} name={p.display_name} size={148} ring vip={p.vip_level} frameKey={p.equipped_frame} />
            {p.vip_level > 0 && <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-amber-300/70 bg-gradient-to-r from-amber-500 to-yellow-300 px-3 py-1 text-[11px] font-black text-[#38220a] shadow-lg">VIP {p.vip_level}</div>}
          </div>
          <h2 className={`mt-5 text-2xl font-black ${p.name_effect && p.name_effect !== "none" ? `name-effect-${p.name_effect}` : ""}`} style={{ color: p.name_color || "#ffffff", animationDuration: `${p.name_effect_speed || 1800}ms` }}>{p.display_name}</h2>
          <div className="mt-1 flex items-center justify-center gap-2 text-sm text-white/80">
            <span>{flagOf(p.country)}</span>
            <span className="rounded-full bg-sky-500/90 px-3 py-0.5 text-xs font-bold">♂</span>
            <span className="font-bold tracking-wide">ID: {p.display_no}</span>
          </div>
          <div className="mt-3"><IdentityBadges level={p.level} vip={p.vip_level} badge={badges[0] ?? null} /></div>
          <div className="mt-5 flex w-full flex-wrap items-center justify-center gap-2">
            {badges.map((b) => <span key={b.badge_key} className="rounded-full border px-3 py-1 text-xs font-bold" style={{ borderColor: b.badge_color, color: b.badge_color }}>{b.badge_name}</span>)}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-4 gap-1 bg-white px-2 py-5 text-center text-slate-900">
        {[
          [stats.posts, "المنشورات"],
          [stats.friends, "الأصدقاء"],
          [stats.following, "المتابَعون"],
          [stats.followers, "المتابعون"],
        ].map(([value, label]) => <div key={String(label)} className="min-w-0">
          <div className="text-xl font-black tabular-nums">{Number(value).toLocaleString("en-US")}</div>
          <div className="mt-1 text-xs text-slate-500">{label}</div>
        </div>)}
      </section>

      <div className="space-y-4 px-4 py-5">
        <section className="rounded-2xl bg-card p-4 shadow-sm">
          <p className="whitespace-pre-wrap text-right text-[15px] leading-7 text-foreground">{p.bio || "لا توجد نبذة شخصية حتى الآن."}</p>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
            <span className="text-muted-foreground">الدعم الذي استلمه</span>
            <span className="font-bold">🪙 {stats.supportCoins.toLocaleString("en-US")} عملة</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">الألماس المكتسب · 15%</span>
            <span className="font-bold text-sky-600">💎 {stats.supportDiamonds.toLocaleString("en-US")}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">عدد الداعمين</span>
            <span className="font-bold">{stats.supporters.toLocaleString("en-US")}</span>
          </div>
        </section>

        <section className="rounded-2xl bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-black">مساحة CP</h3>
            <span className="text-xs text-muted-foreground">CP</span>
          </div>
          <div className="flex items-center justify-center gap-4 rounded-xl bg-gradient-to-l from-pink-50 via-rose-100 to-pink-50 p-4 dark:from-pink-950/30 dark:via-rose-950/30 dark:to-pink-950/30">
            <UserAvatar src={p.avatar_url} name={p.display_name} size={54} />
            <span className="text-2xl text-pink-500">♥</span>
            <div className="grid h-[54px] w-[54px] place-items-center rounded-full border-2 border-white bg-white/80 text-2xl text-slate-300 shadow">＋</div>
          </div>
        </section>

        <section className="rounded-2xl bg-card p-4 shadow-sm">
          <h3 className="mb-3 font-black">منشورات المستخدم</h3>
          {posts.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد منشورات</p> : <div className="space-y-3">{posts.map((post) => <article key={post.id} className="rounded-xl bg-secondary/40 p-3"><p className="whitespace-pre-wrap text-sm">{post.body}</p>{post.image_url && <img src={post.image_url} alt="منشور" loading="lazy" className="mt-2 max-h-72 w-full rounded-xl object-cover" />}<div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>♥ {post.like_count} إعجاب · {post.comment_count} تعليق</span><span>{new Date(post.created_at).toLocaleDateString("ar-EG")}</span></div></article>)}</div>}
        </section>

        <section className="rounded-2xl bg-card p-4 shadow-sm">
          <h3 className="mb-3 font-black">الهدايا والدعم الذي استلمه</h3>
          {support.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد هدايا مستلمة بعد</p> : <div className="space-y-2">{support.map((g, i) => <div key={`${g.sender_id}-${g.created_at}-${i}`} className="flex items-center justify-between gap-2 rounded-xl bg-secondary/40 p-2"><div className="min-w-0"><div className="truncate text-sm font-bold">{g.gift_name} · {g.quantity}x</div><div className="truncate text-xs text-muted-foreground">من {g.sender_name}</div></div><div className="shrink-0 text-left text-xs"><div>🪙 {g.total_price}</div><div className="text-sky-600">💎 {Math.floor(g.total_price * 0.15)}</div></div></div>)}</div>}
        </section>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <Button onClick={toggleFollow} className={isFollowing ? "rounded-full" : "rounded-full bg-emerald-500 font-bold text-white hover:bg-emerald-600"} variant={isFollowing ? "outline" : "default"}>
            {isFollowing ? <><UserCheck className="h-4 w-4" /> متابَع</> : <><UserPlus className="h-4 w-4" /> متابعة</>}
          </Button>
          <Button onClick={message} className="rounded-full bg-emerald-600 font-bold text-white hover:bg-emerald-700"><MessageCircle className="h-4 w-4" /> مراسلة</Button>
          <Button onClick={message} className="rounded-full bg-amber-400 font-bold text-slate-900 hover:bg-amber-500">قل مرحباً</Button>
        </div>
        <Button onClick={toggleBlock} variant="outline" className="w-full">{blocked ? "إلغاء الحظر" : "حظر المستخدم"}</Button>
      </div>
    </div>
  );
}
