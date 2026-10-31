import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Coins, Gem, LogOut, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { COUNTRIES, flagOf } from "@/lib/vox";

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

type P = { id: string; display_no: number; display_name: string; avatar_url: string | null; bio: string | null; country: string | null; level: number; xp: number; vip_level: number };

function ProfilePage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [p, setP] = useState<P | null>(null);
  const [draft, setDraft] = useState<P | null>(null);
  const [wallet, setWallet] = useState({ coins: 0, diamonds: 0 });
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      if (data) setP(data as P);
      const { data: w } = await supabase.from("wallets").select("coins,diamonds").eq("user_id", user!.id).maybeSingle();
      if (w) setWallet({ coins: Number(w.coins), diamonds: Number(w.diamonds) });
    })();
  }, [user]);

  async function save() {
    if (!draft) return;
    const { error } = await supabase.from("profiles").update({ display_name: draft.display_name.trim().slice(0, 30), bio: (draft.bio ?? "").slice(0, 200), country: draft.country, avatar_url: draft.avatar_url || null }).eq("id", draft.id);
    if (error) return toast.error(error.message);
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
        <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-gold shadow-gold">
          {shown.avatar_url ? <img src={shown.avatar_url} alt="" className="h-[88px] w-[88px] rounded-full object-cover" /> : <span className="text-4xl font-bold">{shown.display_name.slice(0, 1)}</span>}
        </div>
        <h2 className="mt-3 text-2xl font-bold">{flagOf(shown.country)} {shown.display_name}</h2>
        <div className="text-sm text-muted-foreground">ID: {p.display_no} · مستوى {p.level}{p.vip_level ? ` · VIP ${p.vip_level}` : ""}</div>
        <p className="mt-2 text-sm">{shown.bio || "لا توجد نبذة"}</p>
        {editing && <div className="mt-2 text-xs text-primary">معاينة — لم يتم الحفظ بعد</div>}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="glass flex items-center gap-3 rounded-2xl p-4"><Coins className="text-primary" /><div><div className="text-xl font-bold">{wallet.coins}</div><div className="text-xs text-muted-foreground">عملات ذهبية</div></div></div>
        <div className="glass flex items-center gap-3 rounded-2xl p-4"><Gem className="text-accent" /><div><div className="text-xl font-bold">{wallet.diamonds}</div><div className="text-xs text-muted-foreground">ماسات</div></div></div>
      </div>

      {editing && draft ? (
        <div className="glass mt-4 space-y-3 rounded-3xl p-4">
          <Input value={draft.display_name} maxLength={30} onChange={(e) => setDraft({ ...draft, display_name: e.target.value })} placeholder="الاسم" />
          <Input value={draft.avatar_url ?? ""} onChange={(e) => setDraft({ ...draft, avatar_url: e.target.value })} placeholder="رابط الصورة الشخصية" dir="ltr" />
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
          <Button variant="outline" onClick={() => { setDraft(p); setEditing(true); }}><Pencil className="h-4 w-4" /> تعديل الملف</Button>
          <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); nav({ to: "/auth" }); }}><LogOut className="h-4 w-4" /> تسجيل الخروج</Button>
        </div>
      )}
    </div>
  );
}
