import { IdentityBadges } from "@/components/IdentityBadges";
import { icons3d } from "@/lib/assets3d";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { deleteMedia, getAdminAssetUrl, uploadImage } from "@/lib/media";
import { UserAvatar } from "@/components/UserAvatar";
import { AdminAssetMedia } from "@/components/AdminAssetMedia";
import { useAdminAsset } from "@/lib/media";
import { useEffect, useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { COUNTRIES, errMsg, flagOf } from "@/lib/vox";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "ملفي الشخصي — صدى شات" },
      { name: "description", content: "ملفك الشخصي ومستواك ومحفظتك في صدى شات." },
      { property: "og:title", content: "ملفي الشخصي — صدى شات" },
      { property: "og:description", content: "ملفك الشخصي ومستواك ومحفظتك." },
    ],
  }),
  component: () => (
    <AppShell>
      <ProfilePage />
    </AppShell>
  ),
});

type P = { id: string; display_no: number; display_name: string; avatar_url: string | null; bio: string | null; country: string | null; level: number; xp: number; vip_level: number; id_color?: string; name_color?: string; name_effect?: string; name_effect_speed?: number; equipped_frame?: string | null; equipped_entry?: string | null; chat_bubble_color?: string | null; profile_card_asset_key?: string | null };
type Badge = { id: string; badge_key: string; badge_name: string; badge_asset_key: string | null; badge_color: string; is_equipped: boolean };
function BadgeTile({ badge }: { badge: Badge }) {
  const src = useAdminAsset(badge.badge_asset_key);
  return <div className="flex min-w-20 flex-col items-center gap-1">
    <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-secondary/60">
      {src ? <AdminAssetMedia src={src} alt={badge.badge_name} className="h-full w-full object-contain" /> : <span className="text-xl text-gold">✦</span>}
    </div>
    <span className="max-w-24 truncate text-[11px] font-bold">{badge.badge_name}</span>
  </div>;
}

function ProfilePage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [p, setP] = useState<P | null>(null);
  const profileCardUrl = useAdminAsset(p?.profile_card_asset_key);
  const [draft, setDraft] = useState<P | null>(null);
  const [editing, setEditing] = useState(false);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [stats, setStats] = useState({ followers: 0, friends: 0, posts: 0, likes: 0, visitors: 0 });
  const [linkEmail, setLinkEmail] = useState("");
  const isGuest = !!user?.is_anonymous;
  async function daily() {
    const { error } = await supabase.rpc("claim_daily_bonus");
    if (error) { toast.error(errMsg(error)); return; }
    toast.success("+100 عملة 🎉");
  }
  async function link() {
    const { error } = await supabase.auth.updateUser({ email: linkEmail });
    if (error) { toast.error(error.message); return; }
    toast.success("أرسلنا رابط تأكيد إلى بريدك لربط الحساب");
  }

  useEffect(() => {
    if (!user) return;
    let alive = true;
    const channel = supabase.channel(`profile-live-${user.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` }, (payload) => {
        if (!alive) return;
        setP((current) => current ? ({ ...current, ...(payload.new as P) }) : (payload.new as P));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_badges", filter: `user_id=eq.${user.id}` }, async () => { const { data: rows } = await supabase.from("user_badges").select("id,badge_key,badge_name,badge_asset_key,badge_color,is_equipped").eq("user_id", user.id); setBadges((rows ?? []) as Badge[]); })
      .subscribe();
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      if (data) setP(data as P);
      const { data: badgeRows, error: badgeError } = await supabase.from("user_badges").select("id,badge_key,badge_name,badge_asset_key,badge_color,is_equipped").eq("user_id", user!.id);
      if (alive && !badgeError) setBadges((badgeRows ?? []) as Badge[]);
      })();
    return () => { alive = false; void supabase.removeChannel(channel); };
  }, [user]);


  async function changeAvatar(f?: File) {
    if (!f || !p) return;
    try {
      const path = await uploadImage(f, p.id, "profile");
      const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", p.id);
      if (error) throw error;
      setP({ ...p, avatar_url: path });
      if (draft) setDraft({ ...draft, avatar_url: path });
      toast.success("تم تحديث الصورة");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الرفع");
    }
  }

  async function removeAvatar() {
    if (!p?.avatar_url) return;
    try {
      const previous = p.avatar_url;
      const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", p.id);
      if (error) throw error;
      setP({ ...p, avatar_url: null });
      if (draft) setDraft({ ...draft, avatar_url: null });
      await deleteMedia(previous).catch(() => undefined);
      toast.success("تم حذف صورة الحساب");
    } catch (e) { toast.error(e instanceof Error ? e.message : "فشل حذف الصورة"); }
  }

  async function save() {
    if (!draft) return;
    const { error } = await supabase.from("profiles").update({ display_name: draft.display_name.trim().slice(0, 30), bio: (draft.bio ?? "").slice(0, 200), country: draft.country, avatar_url: draft.avatar_url || null }).eq("id", draft.id);
    if (error) { toast.error(error.message); return; }
    setP(draft);
    setEditing(false);
    toast.success("تم الحفظ");
  }

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data: follows }, { data: posts }, visitAgg] = await Promise.all([
        supabase.from("follows").select("follower_id,following_id").or(`follower_id.eq.${user.id},following_id.eq.${user.id}`),
        supabase.from("posts").select("id").eq("user_id", user.id),
        supabase.from("profile_visits").select("visitor_id", { count: "exact", head: true }).eq("profile_id", user.id),
      ]);
      const rows = follows ?? [];
      const followerIds = new Set(rows.filter((r) => r.following_id === user.id).map((r) => r.follower_id));
      const followingIds = new Set(rows.filter((r) => r.follower_id === user.id).map((r) => r.following_id));
      const friends = [...followerIds].filter((id) => followingIds.has(id)).length;
      const postIds = (posts ?? []).map((r) => r.id);
      let likes = 0;
      if (postIds.length) {
        const { count } = await supabase.from("post_likes").select("id", { count: "exact", head: true }).in("post_id", postIds);
        likes = count ?? 0;
      }
      if (!cancelled) setStats({ followers: followerIds.size, friends, posts: postIds.length, likes, visitors: visitAgg.count ?? 0 });
    })();
    return () => { cancelled = true; };
  }, [user]);
  if (!p) return null;
  const shown = editing && draft ? draft : p;
  return (
    <div className="px-4 pt-6">
      <div className="relative overflow-hidden rounded-[30px] border border-amber-300/35 bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 p-6 text-center text-white shadow-[0_20px_60px_rgba(0,0,0,.4)] ring-1 ring-amber-200/10">{profileCardUrl && <AdminAssetMedia src={profileCardUrl} className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25" />}<div className="relative">

        <label className="relative mx-auto block w-fit cursor-pointer">
          <UserAvatar src={shown.avatar_url} name={shown.display_name} size={112} ring vip={p.vip_level} frameKey={p.equipped_frame} />
          <span className="absolute bottom-0 left-0 rounded-full bg-gold p-1.5"><Camera className="h-4 w-4" /></span>
          {shown.avatar_url && <button type="button" onClick={(e) => { e.preventDefault(); void removeAvatar(); }} className="absolute right-0 bottom-0 rounded-full bg-destructive px-2 py-1 text-[10px] text-white">حذف</button>}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { void changeAvatar(e.target.files?.[0]); e.currentTarget.value = ""; }} />
        </label>
        <h2 className={`mt-3 text-2xl font-bold ${shown.name_effect && shown.name_effect !== "none" ? `name-effect-${shown.name_effect}` : ""}`} style={{ color: shown.name_color || undefined, animationDuration: `${shown.name_effect_speed || 1800}ms` }}>{flagOf(shown.country)} {shown.display_name}</h2>
        <div className="text-sm font-bold" style={{ color: shown.id_color || "#D4AF37" }}>ID: {p.display_no}</div>
        <IdentityBadges level={p.level} vip={p.vip_level} badges={badges.filter((b) => b.is_equipped)} /><p className="mt-2 text-sm">{shown.bio || "لا توجد نبذة"}</p>
        {editing && <div className="mt-2 text-xs text-primary">معاينة — لم يتم الحفظ بعد</div>}
        <div className="mt-4 grid grid-cols-5 gap-1 rounded-2xl border border-white/10 bg-black/25 p-3 text-center text-white backdrop-blur">
          <div><div className="text-xl font-black tabular-nums">{stats.followers}</div><div className="text-[10px] text-white/65">المتابعون</div></div>
          <div><div className="text-xl font-black tabular-nums">{stats.friends}</div><div className="text-[10px] text-white/65">الأصدقاء</div></div>
          <div><div className="text-xl font-black tabular-nums">{stats.posts}</div><div className="text-[10px] text-white/65">المنشورات</div></div>
          <div><div className="text-xl font-black tabular-nums">{stats.likes}</div><div className="text-[10px] text-white/65">الإعجابات</div></div>
          <div><div className="text-xl font-black tabular-nums">{stats.visitors}</div><div className="text-[10px] text-white/65">الزوار</div></div>
        </div>
      </div></div>



      <section className="glass mt-4 rounded-2xl p-4 text-right">
        <div className="mb-3 font-bold">شاراتي</div>
        <div className="flex flex-wrap gap-2">{badges.length === 0 ? <span className="text-xs text-muted-foreground">لا توجد شارات بعد</span> : badges.map((b) => <button key={b.id} type="button" onClick={async () => { const { error } = await supabase.rpc("equip_badge", { _badge: b.id, _equip: !b.is_equipped }); if (error) toast.error(errMsg(error)); else { setBadges((xs) => xs.map((x) => x.id === b.id ? { ...x, is_equipped: !b.is_equipped } : x)); toast.success(!b.is_equipped ? "تم تعيين الشارة" : "تمت إزالة الشارة"); } }} className="rounded-2xl border p-2 text-center text-xs" style={{ borderColor: b.badge_color }}><BadgeTile badge={b} />{b.is_equipped && <div className="text-[10px] text-primary">مجهزة على الحساب</div>}</button>)}</div>
      </section>

      {editing && draft ? (
        <div className="glass mt-4 space-y-3 rounded-3xl p-4">
          <Input value={draft.display_name} maxLength={30} onChange={(e) => setDraft({ ...draft, display_name: e.target.value })} placeholder="الاسم" />
          <Textarea value={draft.bio ?? ""} maxLength={200} onChange={(e) => setDraft({ ...draft, bio: e.target.value })} placeholder="نبذة" />
          <select className="w-full rounded-md border border-input bg-input px-3 py-2 text-sm" value={draft.country ?? "EG"} onChange={(e) => setDraft({ ...draft, country: e.target.value })}>
            {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
          </select>
          <div className="flex gap-2">
            <Button onClick={save} className="flex-1 bg-gold">حفظ</Button>
            <Button variant="outline" onClick={() => setEditing(false)}>إلغاء</Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 grid gap-2">
          <div className="grid grid-cols-4 gap-2">
            {([
              ["/store", "المتجر", icons3d.store],
              ["/bag", "حقيبتي", icons3d.chest],
              ["/vip", "VIP", icons3d.vip],
              ["/wallet", "المحفظة", icons3d.wallet],
              ["/diamonds", "الألماس", icons3d.diamond],
              ["/families", "العائلة", icons3d.family],
              ["/friends", "الأصدقاء", icons3d.friends],
              ["/notifications", "الإشعارات", icons3d.bell],
              ["/help", "الدعم", icons3d.support],
              ["/admin", "لوحة التحكم", icons3d.gear],
            ] as const).map(([to, label, icon], i) => (
              <Link key={i} to={to} className="card-3d glass flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border border-primary/20 p-3 text-xs font-bold shadow-lg">
                <img src={icon} alt="" className="h-11 w-11 object-contain drop-shadow-lg" />{label}
              </Link>
            ))}
          </div>
          <Button variant="outline" onClick={() => { setDraft(p); setEditing(true); }}><img src={icons3d.gear} alt="" className="h-6 w-6 object-contain" /> تعديل الملف</Button>
          <Button onClick={daily} className="bg-gold font-bold"><img src={icons3d.giftbox} alt="" className="h-7 w-7 object-contain" /> مكافأة يومية +200</Button>
          {isGuest && (
            <div className="glass space-y-2 rounded-2xl p-3 text-sm">
              <p className="text-primary">أنت تستخدم حساب الجهاز السريع. اربط بريدك حتى لا تفقد حسابك.</p>
              <div className="flex gap-2"><Input type="email" dir="ltr" value={linkEmail} onChange={(e) => setLinkEmail(e.target.value)} placeholder="email@example.com" /><Button onClick={link} variant="outline">ربط</Button></div>
            </div>
          )}
          <Button variant="outline" onClick={async () => {
            if (isGuest) {
              // Supabase revokes the anonymous refresh token on signOut.
              // Pause the app session instead, so quick login reopens this exact account.
              const { data: cur, error } = await supabase.auth.getSession();
              if (error || !cur.session?.user?.is_anonymous) {
                toast.error("تعذر حفظ جلسة الحساب السريع. حاول مرة أخرى.");
                return;
              }
              localStorage.setItem("vox_guest_refresh", cur.session.refresh_token);
              localStorage.setItem("vox_guest_account_created", "1");
              localStorage.setItem("vox_guest_logged_out", "1");
              window.dispatchEvent(new Event("vox-auth-visibility-change"));
            } else {
              await supabase.auth.signOut();
            }
            nav({ to: "/auth" });
          }}><img src={icons3d.logout} alt="" className="h-6 w-6 object-contain" /> تسجيل الخروج</Button>
        </div>
      )}
    </div>
  );
}
