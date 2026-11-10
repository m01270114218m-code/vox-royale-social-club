import { IdentityBadges } from "@/components/IdentityBadges";
import { AdminAssetMedia } from "@/components/AdminAssetMedia";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MessageCircle, Flag, Ban, UserPlus, UserCheck, Sparkles, DoorOpen } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/AppShell";
import { UserAvatar } from "@/components/UserAvatar";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { errMsg, flagOf } from "@/lib/vox";
import { getAdminAssetUrl } from "@/lib/media";

export const Route = createFileRoute("/u/$id")({
  head: () => ({
    meta: [
      { title: "ملف مستخدم — صدى شات" },
      { name: "description", content: "الملف الشخصي للمستخدم في صدى شات." },
      { property: "og:title", content: "ملف مستخدم — صدى شات" },
      { property: "og:description", content: "الملف الشخصي للمستخدم." },
    ],
  }),
  component: () => (
    <AppShell>
      <UserPage />
    </AppShell>
  ),
});

type P = { id: string; display_no: number; display_name: string; avatar_url: string | null; bio: string | null; country: string | null; level: number; vip_level: number; support_xp?: number; total_gifts_received?: number; total_gifts_value?: number; profile_card_asset_key?: string | null; chat_bubble_asset_key?: string | null; sound_wave_asset_key?: string | null; id_color?: string | null; name_color?: string | null; name_effect?: string | null; name_effect_speed?: number | null; equipped_frame?: string | null; equipped_entry?: string | null };
type Badge = { badge_key: string; badge_name: string; badge_asset_key: string | null; badge_color: string; is_equipped: boolean };

function UserPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const uid = user!.id;
  const nav = useNavigate();
  const [p, setP] = useState<P | null>(null);
  const [stats, setStats] = useState({ followers: 0, friends: 0, posts: 0, likes: 0, support: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [currentRoom, setCurrentRoom] = useState<{ id: string; name: string; room_no: number } | null>(null);
  const [profileCardUrl, setProfileCardUrl] = useState<string | null>(null);

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
      const { data } = await supabase.from("profiles").select("id,display_no,display_name,avatar_url,bio,country,level,vip_level,support_xp,total_gifts_received,total_gifts_value,profile_card_asset_key,chat_bubble_asset_key,sound_wave_asset_key,id_color,name_color,name_effect,name_effect_speed,equipped_frame,equipped_entry").eq("id", id).maybeSingle();
      setP(data);
      if (data?.profile_card_asset_key) setProfileCardUrl(await getAdminAssetUrl(data.profile_card_asset_key));
      const [a, b, c, f, bl, badgeRows, graph, userPosts, roomResult] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", id),
        supabase.from("posts").select("id", { count: "exact" }).eq("user_id", id),
        supabase.from("follows").select("follower_id").eq("follower_id", uid).eq("following_id", id),
        supabase.from("user_blocks").select("blocked_id").eq("blocker_id", uid).eq("blocked_id", id),
        supabase.from("user_badges").select("badge_key,badge_name,badge_asset_key,badge_color,is_equipped").eq("user_id", id).eq("is_equipped", true),
        supabase.from("follows").select("follower_id,following_id").or(`follower_id.eq.${id},following_id.eq.${id}`),
        supabase.from("posts").select("id").eq("user_id", id),
        supabase.from("room_members").select("room_id,rooms(id,name,room_no)").eq("user_id", id).maybeSingle(),
      ]);
      const followerIds = new Set((graph.data ?? []).filter((r) => r.following_id === id).map((r) => r.follower_id));
      const followingIds = new Set((graph.data ?? []).filter((r) => r.follower_id === id).map((r) => r.following_id));
      const friendCount = [...followerIds].filter((userId) => followingIds.has(userId)).length;
      let likeCount = 0;
      const postIds = (userPosts.data ?? []).map((r) => r.id);
      if (postIds.length) {
        const { count } = await supabase.from("post_likes").select("id", { count: "exact", head: true }).in("post_id", postIds);
        likeCount = count ?? 0;
      }
      setStats({ followers: a.count ?? 0, friends: friendCount, posts: c.count ?? 0, likes: likeCount, support: Number(data?.support_xp ?? 0) });
      setIsFollowing(!!f.data?.length);
      setBlocked(!!bl.data?.length);
      setBadges((badgeRows.data ?? []) as Badge[]);
      const rr = roomResult.data as { rooms?: { id: string; name: string; room_no: number } | null } | null;
      setCurrentRoom(rr?.rooms ?? null);
      supabase.rpc("visit_profile", { _profile: id });
    })();
    return () => { void supabase.removeChannel(live); };
  }, [id, uid, nav]);

  async function toggleFollow() {
    const { error } = isFollowing
      ? await supabase.from("follows").delete().eq("follower_id", uid).eq("following_id", id)
      : await supabase.from("follows").upsert(
          { follower_id: uid, following_id: id },
          { onConflict: "follower_id,following_id", ignoreDuplicates: true },
        );
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
    <div>
      <PageHeader title="الملف الشخصي الكامل" back />
      <div className="relative mx-4 overflow-hidden rounded-[30px] border border-amber-300/35 bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 p-5 text-center text-white shadow-[0_20px_60px_rgba(0,0,0,.4)] ring-1 ring-amber-200/10">{profileCardUrl && <AdminAssetMedia src={profileCardUrl} className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30" />}<div className="relative">
        <div className="mx-auto w-fit"><UserAvatar src={p.avatar_url} name={p.display_name} size={112} ring vip={p.vip_level} frameKey={p.equipped_frame} /></div>
        <h2 className={`mt-3 text-2xl font-bold ${p.name_effect && p.name_effect !== "none" ? `name-effect-${p.name_effect}` : ""}`} style={{ color: p.name_color || undefined, animationDuration: `${p.name_effect_speed || 1800}ms` }}>{flagOf(p.country)} {p.display_name}</h2>
        <div className="text-sm font-bold" style={{ color: p.id_color || "#D4AF37" }}>ID: {p.display_no}</div><div className="mt-2 flex items-center justify-center gap-2"><span className="rounded-full bg-primary/15 px-3 py-1 text-xs font-black">Lv.{p.level}</span>{p.vip_level > 0 && <span className="rounded-full bg-gold/15 px-3 py-1 text-xs font-black text-gold">VIP {p.vip_level}</span>}</div>
        <div className="mt-1"><IdentityBadges level={p.level} vip={p.vip_level} badges={badges.filter((b) => b.is_equipped)} /></div><p className="mt-2 text-sm">{p.bio || "لا توجد نبذة"}</p>
        <div className="mt-4 grid grid-cols-4 gap-2 rounded-2xl border border-white/10 bg-black/25 p-3 text-center backdrop-blur">
          <div><div className="text-xl font-black tabular-nums">{stats.followers}</div><div className="text-[10px] text-white/65">المتابِعون</div></div>
          <div><div className="text-xl font-black tabular-nums">{stats.friends}</div><div className="text-[10px] text-white/65">الأصدقاء</div></div>
          <div><div className="text-xl font-black tabular-nums">{stats.posts}</div><div className="text-[10px] text-white/65">المنشورات</div></div>
          <div><div className="text-xl font-black tabular-nums">{stats.likes}</div><div className="text-[10px] text-white/65">الإعجابات</div></div>
        </div>
      </div>
      </div>
      <div className="mx-4 mt-4 rounded-2xl border border-primary/15 bg-background/60 p-3 text-center"><Sparkles className="mx-auto h-5 w-5 text-primary"/><b className="mt-1 block">{stats.support.toLocaleString()}</b><span className="text-[10px] text-muted-foreground">دعم / XP</span></div>
      <div className="mx-4 mt-4 grid grid-cols-2 gap-2">
        <Button onClick={toggleFollow} className={isFollowing ? "" : "bg-gold font-bold"} variant={isFollowing ? "outline" : "default"}>
          {isFollowing ? <><UserCheck className="h-4 w-4" /> متابَع</> : <><UserPlus className="h-4 w-4" /> متابعة</>}
        </Button>
        <Button onClick={message} variant="outline"><MessageCircle className="h-4 w-4" /> مراسلة</Button>{currentRoom && <Button onClick={() => nav({ to: "/room/$id", params: { id: currentRoom.id } })} variant="outline"><DoorOpen className="h-4 w-4" /> دخول الغرفة #{currentRoom.room_no}</Button>}
        <Button onClick={toggleBlock} variant="outline"><Ban className="h-4 w-4" /> {blocked ? "إلغاء الحظر" : "حظر"}</Button>
        <Button onClick={report} variant="outline"><Flag className="h-4 w-4" /> إبلاغ</Button>
      </div>
    </div>
  );
}
