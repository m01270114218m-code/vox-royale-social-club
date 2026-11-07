import { icons3d, avatarFrame, vipBadge, frameByKey, entryEffects } from "@/lib/assets3d";
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
import { getAdminAssetUrl } from "@/lib/media";

export const Route = createFileRoute("/store")({
  head: () => ({
    meta: [
      { title: "المتجر وVIP — صدى شات" },
      { name: "description", content: "اشترِ عضوية VIP واشحن عملاتك في صدى شات." },
      { property: "og:title", content: "المتجر وVIP — صدى شات" },
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

type StoreItem = { id: string; kind: string; name: string; description: string | null; price: number; asset_key: string; asset_url?: string | null };

function StorePage() {
  const { user } = useAuth();
  const [coins, setCoins] = useState(0);
  const [vip, setVip] = useState(0);
  const [items, setItems] = useState<StoreItem[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [equippedFrame, setEquippedFrame] = useState<string | null>(null);
  const [equippedEntry, setEquippedEntry] = useState<string | null>(null);
  const [txs, setTxs] = useState<{id:string;amount:number;currency:string;reason:string;created_at:string}[]>([]);
  const [topupCoins, setTopupCoins] = useState("6000");
  useEffect(() => {
    if (!user) return;
    const live = supabase.channel(`store-live-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` }, (payload) => {
        const row = payload.new as { coins?: number };
        if (row && row.coins !== undefined) setCoins(Number(row.coins));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "wallet_transactions", filter: `user_id=eq.${user.id}` }, async () => {
        const { data: tx } = await supabase.from("wallet_transactions").select("id,amount,currency,reason,created_at").eq("user_id", user.id).order("created_at",{ascending:false}).limit(30);
        setTxs((tx ?? []).map((x)=>({...x,amount:Number(x.amount)})));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "user_items", filter: `user_id=eq.${user.id}` }, async () => {
        const { data: ui } = await supabase.from("user_items").select("item_id").eq("user_id", user.id);
        setOwned(new Set((ui ?? []).map((r) => r.item_id)));
      })
      .subscribe();
    (async () => {
      const [{ data: w }, { data: p }, { data: si }, { data: ui }] = await Promise.all([
        supabase.from("wallets").select("coins").eq("user_id", user!.id).maybeSingle(),
        supabase.from("profiles").select("vip_level, equipped_frame, equipped_entry").eq("id", user!.id).single(),
        supabase.from("store_items").select("id, kind, name, description, price, asset_key").order("sort_order"),
        supabase.from("user_items").select("item_id").eq("user_id", user!.id),
      ]);
      setCoins(Number(w?.coins ?? 0));
      setVip(p?.vip_level ?? 0);
      setEquippedFrame(p?.equipped_frame ?? null);
      setEquippedEntry(p?.equipped_entry ?? null);
      const enrichedItems = await Promise.all((si ?? []).map(async (item) => ({ ...item, asset_url: await getAdminAssetUrl(item.asset_key) })));
      setItems(enrichedItems);
      setOwned(new Set((ui ?? []).map((r) => r.item_id)));
      const { data: tx } = await supabase.from("wallet_transactions").select("id,amount,currency,reason,created_at").eq("user_id", user!.id).order("created_at",{ascending:false}).limit(30);
      setTxs((tx ?? []).map((x)=>({...x,amount:Number(x.amount)})));
    })();
    return () => { void supabase.removeChannel(live); };
  }, [user]);
  async function buyItem(item: StoreItem) {
    const { data, error } = await supabase.rpc("buy_item", { _item_id: item.id });
    if (error) { toast.error(error.message.includes("insufficient") ? "رصيد العملات غير كافٍ" : error.message.includes("already") ? "تملكه بالفعل" : errMsg(error)); return; }
    setCoins(Number(data));
    setOwned((s) => new Set(s).add(item.id));
    toast.success(`اشتريت ${item.name}! 🎉`);
  }
  async function equip(item: StoreItem, on: boolean) {
    const { error } = await supabase.rpc("equip_item", { _item_id: item.id, _equip: on });
    if (error) { toast.error(errMsg(error)); return; }
    if (item.kind === "frame") setEquippedFrame(on ? item.asset_key : null);
    if (item.kind === "entry") setEquippedEntry(on ? item.asset_key : null);
    toast.success(on ? `تم تجهيز ${item.name}` : "تمت الإزالة");
  }
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
          <h2 className="mb-2 font-bold">قسم VIP</h2>
          {vip <= 0 ? (
            <div className="card-3d glass rounded-3xl p-5 text-center">
              <img src={vipBadge(1)} alt="" className="mx-auto h-24 w-24 object-contain" />
              <div className="mt-2 font-display text-2xl text-gold">قسم VIP</div>
              <p className="mt-1 text-sm text-muted-foreground">هذا القسم مخصص لأعضاء VIP فقط.</p>
              <p className="mt-2 text-xs text-muted-foreground">يمكن تفعيل VIP من خلال الإدارة أو نظام الترقية المعتمد في الحساب.</p>
            </div>
          ) : (
          <div className="grid grid-cols-2 gap-3">
            {VIP.map((v) => (
              <div key={v.lv} className={`card-3d glass rounded-3xl p-4 text-center ${vip >= v.lv ? "ring-2 ring-primary" : ""}`}>
                <img src={vipBadge(v.lv)} alt={`وسام VIP ${v.lv}`} className="mx-auto h-24 w-24 object-contain" width={96} height={96} />
                <div className="mx-auto mb-2 w-fit"><UserAvatar size={76} vip={v.lv} name={`إطار VIP ${v.lv}`} /></div>
                <div className="font-display text-gold text-2xl">VIP {v.lv}</div>
                <p className="min-h-10 text-xs text-muted-foreground">{v.perks}</p>
                <Button size="sm" className="mt-2 w-full bg-gold" disabled={vip >= v.lv} onClick={() => buy(v.lv)}>
                  {vip >= v.lv ? "مفعّل" : <><img src={icons3d.coin} alt="" className="h-5 w-5 object-contain" />{v.price.toLocaleString()}</>}
                </Button>
              </div>
            ))}
          </div>
          )}
        </section>
        <section>
          <h2 className="mb-2 font-bold">إطارات الصورة</h2>
          <div className="grid grid-cols-2 gap-3">
            {items.filter((i) => i.kind === "frame").map((item) => {
              const isOwned = owned.has(item.id);
              const isEquipped = equippedFrame === item.asset_key;
              return (
                <div key={item.id} className={`card-3d glass rounded-3xl p-4 text-center ${isEquipped ? "ring-2 ring-primary" : ""}`}>
                  <div className="relative mx-auto mb-2 h-24 w-24">
                    <div className="absolute inset-[18%] overflow-hidden rounded-full bg-secondary" />
                    <img src={item.asset_url || frameByKey(item.asset_key)} alt={item.name} className="absolute inset-0 h-full w-full object-contain" />
                  </div>
                  <b className="text-sm">{item.name}</b>
                  <p className="min-h-8 text-xs text-muted-foreground">{item.description}</p>
                  {isOwned ? (
                    <Button size="sm" variant={isEquipped ? "outline" : "default"} className="mt-2 w-full" onClick={() => equip(item, !isEquipped)}>
                      {isEquipped ? "إزالة" : "تجهيز"}
                    </Button>
                  ) : (
                    <Button size="sm" className="mt-2 w-full bg-gold" onClick={() => buyItem(item)}>
                      <img src={icons3d.coin} alt="" className="h-5 w-5 object-contain" />{item.price.toLocaleString()}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
        <section>
          <h2 className="mb-2 font-bold">دخوليات الغرف</h2>
          <div className="grid grid-cols-2 gap-3">
            {items.filter((i) => i.kind === "entry").map((item) => {
              const isOwned = owned.has(item.id);
              const isEquipped = equippedEntry === item.asset_key;
              return (
                <div key={item.id} className={`card-3d glass rounded-3xl p-4 text-center ${isEquipped ? "ring-2 ring-primary" : ""}`}>
                  <img src={item.asset_url || entryEffects[item.asset_key]?.image || icons3d.giftbox} alt={item.name} className="mx-auto mb-2 h-20 w-20 object-contain" />
                  <b className="text-sm">{item.name}</b>
                  <p className="min-h-8 text-xs text-muted-foreground">{item.description}</p>
                  {isOwned ? (
                    <Button size="sm" variant={isEquipped ? "outline" : "default"} className="mt-2 w-full" onClick={() => equip(item, !isEquipped)}>
                      {isEquipped ? "إزالة" : "تجهيز"}
                    </Button>
                  ) : (
                    <Button size="sm" className="mt-2 w-full bg-gold" onClick={() => buyItem(item)}>
                      <img src={icons3d.coin} alt="" className="h-5 w-5 object-contain" />{item.price.toLocaleString()}
                    </Button>
                  )}
                </div>
              );
            })}
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
                <Button size="sm" variant="outline" className="mt-2 w-full" onClick={async () => { const { error } = await supabase.rpc("request_wallet_topup", { _coins: p.coins, _payment_method: "manual" }); if(error) toast.error(errMsg(error)); else toast.success("تم إرسال طلب الشحن للإدارة"); }}>طلب شحن</Button>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">الدفع الإلكتروني لم يُربط بعد. حالياً يتم الشحن عبر الإدارة من لوحة التحكم.</p>
        </section>
      </div>
    </>
  );
}
