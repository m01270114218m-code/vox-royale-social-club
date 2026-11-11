import { icons3d } from "@/lib/assets3d";
import { UserAvatar } from "@/components/UserAvatar";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, PageHeader } from "@/components/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { errMsg } from "@/lib/vox";
import { getAdminAssetUrl } from "@/lib/media";
import { AdminAssetMedia } from "@/components/AdminAssetMedia";

export const Route = createFileRoute("/store")({
  head: () => ({
    meta: [
      { title: "المتجر — صدى شات" },
      { name: "description", content: "شراء الإطارات والدخوليات وشحن العملات في صدى شات." },
      { property: "og:title", content: "المتجر — صدى شات" },
      { property: "og:description", content: "الإطارات والدخوليات وباقات الشحن." },
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

const PACKS = [
  { coins: 6000, price: "$0.99" },
  { coins: 32000, price: "$4.99" },
  { coins: 68000, price: "$9.99" },
  { coins: 350000, price: "$49.99" },
];

type StoreItem = { id: string; kind: string; name: string; description: string | null; price: number; asset_key: string; is_direct_grant?: boolean; asset_url?: string | null };

function StorePage() {
  const { user } = useAuth();
  const [items, setItems] = useState<StoreItem[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [equippedFrame, setEquippedFrame] = useState<string | null>(null);
  const [equippedEntry, setEquippedEntry] = useState<string | null>(null);
  const [equippedBubble, setEquippedBubble] = useState<string | null>(null);
  const [equippedWave, setEquippedWave] = useState<string | null>(null);
  const [equippedCard, setEquippedCard] = useState<string | null>(null);
  useEffect(() => {
    if (!user) return;
    const live = supabase.channel(`store-live-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "user_items", filter: `user_id=eq.${user.id}` }, async () => {
        const { data: ui } = await supabase.from("user_items").select("item_id").eq("user_id", user.id);
        setOwned(new Set((ui ?? []).map((r) => r.item_id)));
      })
      .subscribe();
    (async () => {
      const [{ data: p }, { data: si }, { data: ui }] = await Promise.all([
        supabase.from("profiles").select("equipped_frame, equipped_entry, chat_bubble_asset_key, sound_wave_asset_key, profile_card_asset_key").eq("id", user!.id).single(),
        supabase.from("store_items").select("id, kind, name, description, price, asset_key, is_direct_grant").eq("is_direct_grant", false).order("sort_order"),
        supabase.from("user_items").select("item_id").eq("user_id", user!.id),
      ]);
      setEquippedFrame(p?.equipped_frame ?? null);
      setEquippedEntry(p?.equipped_entry ?? null);
      setEquippedBubble(p?.chat_bubble_asset_key ?? null); setEquippedWave(p?.sound_wave_asset_key ?? null); setEquippedCard(p?.profile_card_asset_key ?? null);
      const enrichedItems = await Promise.all((si ?? []).map(async (item) => ({ ...item, asset_url: await getAdminAssetUrl(item.asset_key) })));
      setItems(enrichedItems);
      setOwned(new Set((ui ?? []).map((r) => r.item_id)));
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
    if (item.kind === "bubble") setEquippedBubble(on ? item.asset_key : null);
    if (item.kind === "sound_wave") setEquippedWave(on ? item.asset_key : null);
    if (item.kind === "profile_card") setEquippedCard(on ? item.asset_key : null);
    toast.success(on ? `تم تجهيز ${item.name}` : "تمت الإزالة");
  }
  return (
    <>
      <PageHeader title="المتجر" back />
      <div className="space-y-5 px-4">
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
                    {item.asset_url ? <AdminAssetMedia src={item.asset_url} alt={item.name} className="absolute inset-0 h-full w-full object-contain" /> : <span className="absolute inset-0 grid place-items-center text-[10px] text-muted-foreground">الصورة غير متاحة</span>}
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
                  {item.asset_url ? <AdminAssetMedia src={item.asset_url} alt={item.name} className="mx-auto mb-2 h-20 w-20 object-contain" /> : <div className="mx-auto mb-2 grid h-20 w-20 place-items-center rounded-xl bg-secondary text-xs text-muted-foreground">الصورة غير متاحة</div>}
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
        {(["bubble","sound_wave","profile_card"] as const).map((kind) => {
          const title = kind === "bubble" ? "فقاعات الكتابة" : kind === "sound_wave" ? "موجات الصوت" : "بطاقات التعريف";
          const equipped = kind === "bubble" ? equippedBubble : kind === "sound_wave" ? equippedWave : equippedCard;
          return <section key={kind}><h2 className="mb-2 font-bold">{title}</h2><div className="grid grid-cols-2 gap-3">{items.filter(i => i.kind === kind).map(item => {
            const isOwned = owned.has(item.id); const isEquipped = equipped === item.asset_key;
            return <div key={item.id} className={`card-3d glass rounded-3xl p-4 text-center ${isEquipped ? "ring-2 ring-primary" : ""}`}>
              <div className="mx-auto mb-2 h-20 w-20 overflow-hidden rounded-2xl bg-secondary">{item.asset_url ? <AdminAssetMedia src={item.asset_url} alt={item.name} className="h-full w-full object-contain"/> : null}</div>
              <b className="text-sm">{item.name}</b><p className="min-h-8 text-xs text-muted-foreground">{item.description}</p>
              {isOwned ? <Button size="sm" variant={isEquipped ? "outline" : "default"} className="mt-2 w-full" onClick={() => equip(item,!isEquipped)}>{isEquipped ? "إزالة" : "تجهيز"}</Button> : <Button size="sm" className="mt-2 w-full bg-gold" onClick={() => buyItem(item)}><img src={icons3d.coin} alt="" className="h-5 w-5 object-contain"/>{item.price.toLocaleString()}</Button>}
            </div>;
          })}</div></section>;
        })}
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
