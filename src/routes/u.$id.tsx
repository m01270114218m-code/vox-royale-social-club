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
  const [stats, setStats] = useState({ followers: 0, following: 0, posts: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [badges, setBadges] = useState<Badge[]>([]);

  useEffect(() => {
    if (id === uid) {
      nav({ to: "/profile" });
      return;
    }
    (async () => {
      const { data } = await supabase.from("profiles").select("id,display_no,display_name,avatar_url,bio,country,level,vip_level,id_color,name_color,name_effect,name_effect_speed,equipped_frame,equipped_entry").eq("id", id).maybeSingle();
      setP(data);
      const [a, b, c, f, bl, badgeRows] = await Promise.all([
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", id),
        supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", id),
        supabase.from("posts").select("*", { count: "exact", head: true }).eq("user_id", id),
        supabase.from("follows").select("follower_id").eq("follower_id", uid).eq("following_id", id),
        supabase.from("user_blocks").select("blocked_id").eq("blocker_id", uid).eq("blocked_id", id),
        supabase.from("user_badges").select("badge_key,badge_name,badge_asset_key,badge_color,is_equipped").eq("user_id", id).eq("is_equipped", true),
      ]);
      setStats({ followers: a.count ?? 0, following: b.count ?? 0, posts: c.count ?? 0 });
      setIsFollowing(!!f.data?.length);
      setBlocked(!!bl.data?.length);
      setBadges((badgeRows.data ?? []) as Badge[]);
      supabase.rpc("visit_profile", { _profile: id });
    })();
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
    <div>
      <PageHeader title="الملف الشخصي" back />
      <div className="glass mx-4 rounded-3xl p-6 text-center">
        <div className="mx-auto w-fit"><UserAvatar src={p.avatar_url} name={p.display_name} size={112} ring vip={p.vip_level} frameKey={p.equipped_frame} /></div>
        <h2 className={`mt-3 text-2xl font-bold ${p.name_effect && p.name_effect !== "none" ? `name-effect-${p.name_effect}` : ""}`} style={{ color: p.name_color || undefined, animationDuration: `${p.name_effect_speed || 1800}ms` }}>{flagOf(p.country)} {p.display_name}</h2>
        <div className="text-sm font-bold" style={{ color: p.id_color || "#D4AF37" }}>ID: {p.display_no}</div>
        <IdentityBadges level={p.level} vip={p.vip_level} badge={badges[0] ?? null} /><p className="mt-2 text-sm">{p.bio || "لا توجد نبذة"}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div><div className="text-xl font-bold">{stats.followers}</div><div className="text-xs text-muted-foreground">المتابِعون</div></div>
          <div><div className="text-xl font-bold">{stats.following}</div><div className="text-xs text-muted-foreground">يتابع</div></div>
          <div><div className="text-xl font-bold">{stats.posts}</div><div className="text-xs text-muted-foreground">منشورات</div></div>
        </div>
      </div>
      <div className="mx-4 mt-4 grid grid-cols-2 gap-2">
        <Button onClick={toggleFollow} className={isFollowing ? "" : "bg-gold font-bold"} variant={isFollowing ? "outline" : "default"}>
          {isFollowing ? <><UserCheck className="h-4 w-4" /> متابَع</> : <><UserPlus className="h-4 w-4" /> متابعة</>}
        </Button>
        <Button onClick={message} variant="outline"><MessageCircle className="h-4 w-4" /> مراسلة</Button>
        <Button onClick={toggleBlock} variant="outline"><Ban className="h-4 w-4" /> {blocked ? "إلغاء الحظر" : "حظر"}</Button>
        <Button onClick={report} variant="outline"><Flag className="h-4 w-4" /> إبلاغ</Button>
      </div>
    </div>
  );
}
