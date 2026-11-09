import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CreditCard, History, ShoppingCart, Gift, Crown, Package, Users, Sparkles } from "lucide-react";
import { icons3d } from "@/lib/assets3d";
import { AppShell } from "@/components/AppShell";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/wallet")({ component: () => <AppShell><WalletPage /></AppShell> });

type Tx = { id: string; currency: string; amount: number; reason?: string | null; kind?: string | null; note?: string | null; created_at: string };

const reasonLabel: Record<string,string> = {
  daily_bonus: "مكافأة يومية", gift_sent: "هدايا مرسلة", gift_received: "هدية مستلمة",
  vip_purchase: "شراء VIP", item_purchase: "شراء عنصر", buy_item: "شراء من المتجر",
  wallet_topup: "شحن رصيد", diamond_to_coins: "تحويل ألماس إلى عملات", family_created: "إنشاء عائلة",
  admin_adjustment: "تعديل إداري", admin: "تعديل إداري",
};

function labelOf(t: Tx) {
  return t.note || reasonLabel[t.reason ?? ""] || reasonLabel[t.kind ?? ""] || t.reason || t.kind || "حركة مالية";
}

function isRealSpend(t: Tx) {
  if (t.currency !== "coins" || t.amount >= 0) return false;
  const key = t.reason || t.kind || "";
  return !["admin_adjustment", "admin", "correction", "refund", "wallet_correction"].includes(key);
}

function WalletPage() {
  const { user } = useAuth();
  const [coins, setCoins] = useState(0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const [{ data: w }, { data: rows }] = await Promise.all([
      supabase.from("wallets").select("coins").eq("user_id", user.id).maybeSingle(),
      supabase.from("wallet_transactions").select("id,currency,amount,reason,kind,note,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200),
    ]);
    setCoins(Number(w?.coins ?? 0));
    setTxs((rows ?? []).map((x) => ({ ...x, amount: Number(x.amount) })) as Tx[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    void load();
    const channel = supabase.channel(`wallet-live-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "wallet_transactions", filter: `user_id=eq.${user.id}` }, () => void load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "wallets", filter: `user_id=eq.${user.id}` }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user]);

  const spending = useMemo(() => txs.filter(isRealSpend), [txs]);
  const spent = spending.reduce((n,t) => n + Math.abs(t.amount), 0);
  const topups = txs.filter((t) => t.currency === "coins" && t.amount > 0 && !["gift_received"].includes(t.reason ?? "")).reduce((n,t) => n + t.amount, 0);
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    spending.forEach((t) => {
      const key = t.reason === "gift_sent" ? "الهدايا" : t.reason === "vip_purchase" ? "VIP" : t.reason === "family_created" ? "العائلة" : (t.kind === "purchase" || t.reason === "item_purchase" || t.reason === "buy_item") ? "المتجر" : "أخرى";
      map.set(key, (map.get(key) ?? 0) + Math.abs(t.amount));
    });
    return [...map.entries()].sort((a,b) => b[1]-a[1]);
  }, [spending]);

  return <div dir="rtl" className="min-h-full px-4 pt-5 pb-10">
    <div className="mb-4 flex items-center justify-between">
      <Link to="/profile" className="glass rounded-full p-2"><ArrowRight className="h-5 w-5" /></Link>
      <div className="text-center"><div className="text-[10px] font-bold tracking-[.28em] text-muted-foreground">VOX ROYALE</div><h1 className="text-2xl font-black text-gold">المحفظة</h1></div><span className="w-9" />
    </div>

    <div className="card-3d relative overflow-hidden rounded-[28px] border border-gold/30 p-5 shadow-gold">
      <div className="absolute -left-16 -top-16 h-44 w-44 rounded-full bg-gold/15 blur-3xl" />
      <div className="relative flex items-center gap-4">
        <img src={icons3d.wallet} alt="" className="h-20 w-20 object-contain drop-shadow-2xl" />
        <div><div className="text-xs text-muted-foreground">رصيدك الحالي الحقيقي</div><div className="text-4xl font-black text-gold">{loading ? "…" : coins.toLocaleString()} <span className="text-sm">عملة</span></div><div className="mt-1 text-[11px] text-muted-foreground">متزامن مباشرة مع سجل المحفظة</div></div>
      </div>
    </div>

    <div className="mt-4 grid grid-cols-2 gap-3">
      <div className="glass rounded-2xl border border-primary/15 p-4"><ShoppingCart className="mb-2 h-6 w-6 text-primary" /><div className="text-xs text-muted-foreground">إجمالي الإنفاق الفعلي</div><div className="mt-1 text-2xl font-black">{spent.toLocaleString()}</div><div className="text-[10px] text-muted-foreground">من العمليات المسجلة فقط</div></div>
      <div className="glass rounded-2xl border border-gold/15 p-4"><CreditCard className="mb-2 h-6 w-6 text-gold" /><div className="text-xs text-muted-foreground">الإضافات والشحن</div><div className="mt-1 text-2xl font-black">{topups.toLocaleString()}</div><div className="text-[10px] text-muted-foreground">إيداعات العملات المسجلة</div></div>
    </div>

    {categories.length > 0 && <section className="glass mt-4 rounded-3xl p-4">
      <div className="mb-3 flex items-center gap-2 font-bold"><Sparkles className="h-5 w-5 text-gold" /> أين تم الإنفاق؟</div>
      <div className="grid grid-cols-2 gap-2">
        {categories.map(([name,value]) => <div key={name} className="rounded-2xl border border-border/50 bg-black/10 p-3"><div className="text-xs text-muted-foreground">{name}</div><div className="mt-1 text-lg font-black">{value.toLocaleString()} 🪙</div></div>)}
      </div>
    </section>}

    <section className="glass mt-4 rounded-3xl p-4">
      <div className="mb-3 flex items-center gap-2 font-bold"><History className="h-5 w-5 text-gold" /> سجل المحفظة الحقيقي</div>
      {txs.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد سجلات بعد.</p> : txs.map((t) => <div key={t.id} className="flex items-center justify-between gap-3 border-b border-border/50 py-3 last:border-0">
        <div className="min-w-0"><div className="truncate font-semibold">{labelOf(t)}</div><div className="text-[11px] text-muted-foreground">{new Date(t.created_at).toLocaleString("ar-EG")}</div></div>
        <div className={t.amount < 0 ? "shrink-0 font-bold text-destructive" : "shrink-0 font-bold text-primary"}>{t.amount > 0 ? "+" : ""}{t.amount.toLocaleString()} {t.currency === "coins" ? "🪙" : "💎"}</div>
      </div>)}
    </section>

    <div className="mt-4 grid grid-cols-3 gap-2">
      <div className="glass rounded-2xl p-3 text-center"><img src={icons3d.coin} alt="" className="mx-auto h-9 w-9 object-contain" /><div className="mt-1 text-[10px] text-muted-foreground">العملات</div></div>
      <div className="glass rounded-2xl p-3 text-center"><img src={icons3d.diamond} alt="" className="mx-auto h-9 w-9 object-contain" /><div className="mt-1 text-[10px] text-muted-foreground">الألماس</div></div>
      <div className="glass rounded-2xl p-3 text-center"><img src={icons3d.giftbox} alt="" className="mx-auto h-9 w-9 object-contain" /><div className="mt-1 text-[10px] text-muted-foreground">الهدايا</div></div>
    </div>
  </div>;
}
