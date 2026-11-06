import { IdentityBadges } from "@/components/IdentityBadges";
import { icons3d } from "@/lib/assets3d";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { uploadImage } from "@/lib/media";
import { UserAvatar } from "@/components/UserAvatar";
import { useEffect, useState } from "react";
import { Coins, Gem, LogOut, Pencil, Crown, Store, Users, Shield, LifeBuoy, Bell, Heart, Camera } from "lucide-react";
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
      { title: "ملفي الشخصي — VOX ROYALE" },
      { name: "description", content: "ملفك الشخصي ومستواك ومحفظتك في VOX ROYALE." },
      { property: "og:title", content: "ملفي الشخصي — VOX ROYALE" },
      { property: "og:description", content: "ملفك الشخصي ومستواك ومحفظتك." },
    ],
  }),
  component: () => (
    <AppShell>
      <ProfilePage />
    </AppShell>
  ),
});

type P = { id: string; display_no: number; display_name: string; avatar_url: string | null; bio: string | null; country: string | null; level: number; xp: number; vip_level: number; id_color?: string; equipped_frame?: string | null };

function ProfilePage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [p, setP] = useState<P | null>(null);
  const [draft, setDraft] = useState<P | null>(null);
  const [wallet, setWallet] = useState({ coins: 0, diamonds: 0 });
  const [editing, setEditing] = useState(false);
  const [txs, setTxs] = useState<{ id: string; currency: string; amount: number; reason: string; created_at: string }[]>([]);
  const [linkEmail, setLinkEmail] = useState("");
  const isGuest = !!user?.is_anonymous;
  async function loadTx() {
    const { data } = await supabase.from("wallet_transactions").select("id,currency,amount,reason,created_at").order("created_at", { ascending: false }).limit(20);
    if (data) setTxs(data.map((d) => ({ ...d, amount: Number(d.amount) })));
  }
  async function daily() {
    const { error } = await supabase.rpc("claim_daily_bonus");
    if (error) { toast.error(errMsg(error)); return; }
    setWallet((w) => ({ ...w, coins: w.coins + 200 }));
    toast.success("+200 عملة 🎉");
    loadTx();
  }
  async function link() {
    const { error } = await supabase.auth.updateUser({ email: linkEmail });
    if (error) { toast.error(error.message); return; }
    toast.success("أرسلنا رابط تأكيد إلى بريدك لربط الحساب");
  }

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      if (data) setP(data as P);
      const { data: w } = await supabase.from("wallets").select("coins,diamonds").eq("user_id", user!.id).maybeSingle();
      loadTx();
      if (w) setWallet({ coins: Number(w.coins), diamonds: Number(w.diamonds) });
    })();
  }, [user]);

  async function changeAvatar(f?: File) {
    if (!f || !p) return;
    try {
      const path = await uploadImage(f, p.id);
      const { error } = await supabase.from("profiles").update({ avatar_url: path }).eq("id", p.id);
      if (error) throw error;
      setP({ ...p, avatar_url: path });
      if (draft) setDraft({ ...draft, avatar_url: path });
      toast.success("تم تحديث الصورة");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل الرفع");
    }
  }

  async function save() {
    if (!draft) return;
    const { error } = await supabase.from("profiles").update({ display_name: draft.display_name.trim().slice(0, 30), bio: (draft.bio ?? "").slice(0, 200), country: draft.country, avatar_url: draft.avatar_url || null }).eq("id", draft.id);
    if (error) { toast.error(error.message); return; }
    setP(draft);
    setEditing(false);
    toast.success("تم الحفظ");
  }

  if (!p) return null;
  const shown = editing && draft ? draft : p;
  return (
    <div className="px-4 pt-6">
      <div className="glass relative overflow-hidden rounded-3xl p-6 text-center">
        <div className="absolute inset-x-0 top-0 h-24 bg-royal" />
        <label className="relative mx-auto block w-fit cursor-pointer">
          <UserAvatar src={shown.avatar_url} name={shown.display_name} size={112} ring vip={p.vip_level} frameKey={p.equipped_frame} />
          <span className="absolute bottom-0 left-0 rounded-full bg-gold p-1.5"><Camera className="h-4 w-4" /></span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => changeAvatar(e.target.files?.[0])} />
        </label>
        <h2 className="mt-3 text-2xl font-bold">{flagOf(shown.country)} {shown.display_name}</h2>
        <div className="text-sm font-bold" style={{ color: p.id_color || undefined }}>ID: {p.display_no}</div>
        <IdentityBadges level={p.level} vip={p.vip_level} /><p className="mt-2 text-sm">{shown.bio || "لا توجد نبذة"}</p>
        {editing && <div className="mt-2 text-xs text-primary">معاينة — لم يتم الحفظ بعد</div>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="glass flex items-center gap-3 rounded-2xl p-4"><img src={icons3d.coin} alt="" className="h-12 w-12 object-contain" /><div><div className="text-xl font-bold">{wallet.coins}</div><div className="text-xs text-muted-foreground">عملات ذهبية</div></div></div>
        <div className="glass flex items-center gap-3 rounded-2xl p-4"><img src={icons3d.diamond} alt="" className="h-12 w-12 object-contain" /><div><div className="text-xl font-bold">{wallet.diamonds}</div><div className="text-xs text-muted-foreground">ماسات</div></div></div>
      </div>

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
              ["/store", "VIP", icons3d.vip],
              ["/families", "العائلة", icons3d.family],
              ["/friends", "الأصدقاء", icons3d.friends],
              ["/notifications", "الإشعارات", icons3d.bell],
              ["/help", "الدعم", icons3d.support],
              ["/admin", "لوحة التحكم", icons3d.gear],
            ] as const).map(([to, label, icon], i) => (
              <Link key={i} to={to} className="card-3d glass flex flex-col items-center gap-1 rounded-2xl p-3 text-xs">
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
              // Keep the guest session valid so "quick login" on this device restores the same account.
              const { data: cur } = await supabase.auth.getSession();
              if (cur.session) localStorage.setItem("vox_guest_refresh", cur.session.refresh_token);
              await supabase.auth.signOut({ scope: "local" });
            } else {
              await supabase.auth.signOut();
            }
            nav({ to: "/auth" });
          }}><img src={icons3d.logout} alt="" className="h-6 w-6 object-contain" /> تسجيل الخروج</Button>
        </div>
      )}
      {!editing && (
        <div className="glass mt-4 rounded-3xl p-4">
          <h3 className="mb-2 font-bold">سجل المحفظة</h3>
          {txs.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد معاملات بعد</p> : txs.map((t) => (
            <div key={t.id} className="flex justify-between border-b border-border py-2 text-sm last:border-0">
              <span>{({ gift_sent: "هدية مرسلة", gift_received: "هدية مستلمة", daily_bonus: "مكافأة يومية", vip_purchase: "شراء VIP" } as Record<string, string>)[t.reason] ?? t.reason}</span>
              <span className={t.amount < 0 ? "text-destructive" : "text-primary"}>{t.amount > 0 ? "+" : ""}{t.amount} {t.currency === "coins" ? "🪙" : "💎"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
