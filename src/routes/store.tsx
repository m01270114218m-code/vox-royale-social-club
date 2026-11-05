import { icons3d, avatarFrame, vipBadge } from "@/lib/assets3d";
import { UserAvatar } from "@/components/UserAvatar";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Crown, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { errMsg } from "@/lib/vox";

export const Route = createFileRoute("/store")({
  head: () => ({
    meta: [
      { title: "المتجر وVIP — VOX ROYALE" },
      { name: "description", content: "اشترِ عضوية VIP واشحن عملاتك في VOX ROYALE." },
      { property: "og:title", content: "المتجر وVIP — VOX ROYALE" },
      { property: "og:description", content: "عضويات VIP وباقات الشحن." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <StorePage />
    </AppShell>
  ),
});

const VIP = [
  { lv: 1, price: 1000, perks: "شارة VIP ولون اسم مميز" },
  { lv: 2, price: 3000, perks: "إطار صورة فضي" },
  { lv: 3, price: 8000, perks: "إطار ذهبي ودخول مميز للغرف" },
  { lv: 4, price: 20000, perks: "مركبة دخول وتأثير اسم" },
  { lv: 5, price: 50000, perks: "حماية من الطرد من الغرف العامة" },
  { lv: 6, price: 120000, perks: "تاج ملكي وأولوية الدعم" },
];
const PACKS = [
  { coins: 6000, price: "$0.99" },
  { coins: 32000, price: "$4.99" },
  { coins: 68000, price: "$9.99" },
  { coins: 350000, price: "$49.99" },
];

function StorePage() {
  const { user } = useAuth();
  const [coins, setCoins] = useState(0);
  const [vip, setVip] = useState(0);
  const [tiers, setTiers] = useState<{ level: number; name: string; price_coins: number; duration_days: number }[]>([]);
  useEffect(() => {
    (async () => {
      const [{ data: w }, { data: p }] = await Promise.all([
        supabase.from("wallet_balances").select("coins").eq("user_id", user!.id).maybeSingle(),
        supabase.from("profiles").select("vip_level").eq("id", user!.id).single(),
        supabase.from("vip_tiers").select("level,name,price_coins,duration_days").order("level"),
      ]);
      setCoins(Number(w?.coins ?? 0));
      setVip(p?.vip_level ?? 0);
      const { data: tierData } = await supabase.from("vip_tiers").select("level,name,price_coins,duration_days").order("level");
      setTiers(tierData ?? []);
    })();
  }, [user]);
  async function buy(lv: number) {
    const { data, error } = await supabase.rpc("buy_vip", { _level: lv });
    if (error) { toast.error(error.message.includes("insufficient") ? "رصيد العملات غير كافٍ" : errMsg(error)); return; }
    setCoins(Number(data));
    setVip(lv);
    toast.success(`مبروك! أصبحت VIP ${lv} 👑`);
  }
  return (
    <>
      <PageHeader title="المتجر وVIP" back />
      <div className="space-y-5 px-4">
        <div className="card-3d glass flex items-center justify-between rounded-3xl p-4">
          <div className="flex items-center gap-2"><img src={icons3d.coin} alt="" className="h-12 w-12 object-contain" /><b className="text-xl">{coins.toLocaleString()}</b> عملة</div>
          <span className="rounded-full bg-gold px-3 py-1 text-sm font-bold">VIP {vip}</span>
        </div>
        <section>
          <h2 className="mb-2 font-bold">عضويات VIP</h2>
          <div className="grid grid-cols-2 gap-3">
            {tiers.map((v) => (
              <div key={v.level} className={`card-3d glass rounded-3xl p-4 text-center ${vip >= v.level ? "ring-2 ring-primary" : ""}`}>
                <img src={vipBadge(v.level)} alt={`وسام VIP ${v.level}`} className="mx-auto h-24 w-24 object-contain" width={96} height={96} />
                <div className="mx-auto mb-2 w-fit"><UserAvatar size={76} vip={v.level} name={`إطار VIP ${v.level}`} /></div>
                <div className="font-display text-gold text-2xl">VIP {v.level}</div>
                <p className="min-h-10 text-xs text-muted-foreground">عضوية لمدة {v.duration_days} يوم</p>
                <Button size="sm" className="mt-2 w-full bg-gold" disabled={vip >= v.lv} onClick={() => buy(v.level)}>
                  {vip >= v.lv ? "مفعّل" : <><img src={icons3d.coin} alt="" className="h-5 w-5 object-contain" />{v.price_coins.toLocaleString()}</>}
                </Button>
              </div>
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-2 font-bold">شحن العملات</h2>
          <div className="grid grid-cols-2 gap-3">
            {PACKS.map((p) => (
              <div key={p.coins} className="card-3d glass rounded-3xl p-4 text-center">
                <img src={icons3d.chest} alt="" className="mx-auto h-20 w-20 object-contain" />
                <b>{p.coins.toLocaleString()}</b>
                <div className="text-sm text-muted-foreground">{p.price}</div>
                <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => toast("الدفع الإلكتروني غير مفعّل بعد — تواصل مع الإدارة للشحن")}>شحن</Button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">الدفع الإلكتروني لم يُربط بعد. حالياً يتم الشحن عبر الإدارة من لوحة التحكم.</p>
        </section>
      </div>
    </>
  );
}
