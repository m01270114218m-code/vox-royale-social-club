import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, CreditCard, History, ShoppingCart, Gift } from "lucide-react";
import { icons3d } from "@/lib/assets3d";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/wallet")({
  component: () => <AppShell><WalletPage /></AppShell>,
});

type Tx = { id: string; currency: string; amount: number; reason: string; created_at: string };

const reasonLabel: Record<string,string> = {
  daily_bonus: "مكافأة يومية",
  gift_sent: "هدية مرسلة",
  gift_received: "هدية مستلمة",
  vip_purchase: "شراء VIP",
  item_purchase: "شراء عنصر",
  buy_item: "شراء من المتجر",
  diamond_to_coins: "تحويل ألماس إلى عملات",
  wallet_topup: "شحن رصيد",
};

function WalletPage() {
  const { user } = useAuth();
  const [coins, setCoins] = useState(0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      const [{ data: w }, { data: rows }] = await Promise.all([
        supabase.from("wallets").select("coins").eq("user_id", user.id).maybeSingle(),
        supabase.from("wallet_transactions").select("id,currency,amount,reason,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      ]);
      if (!alive) return;
      setCoins(Number(w?.coins ?? 0));
      setTxs((rows ?? []).map((x) => ({ ...x, amount: Number(x.amount) })) as Tx[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user]);

  const spent = txs.filter((t) => t.currency === "coins" && t.amount < 0).reduce((n,t) => n + Math.abs(t.amount), 0);
  const topups = txs.filter((t) => t.currency === "coins" && t.amount > 0).reduce((n,t) => n + t.amount, 0);

  return <div dir="rtl" className="px-4 pt-5 pb-8">
    <div className="mb-4 flex items-center justify-between">
      <Link to="/profile" className="glass rounded-full p-2"><ArrowRight className="h-5 w-5" /></Link>
      <h1 className="text-2xl font-black text-gold">المحفظة</h1><span />
    </div>
    <div className="card-3d glass overflow-hidden rounded-3xl border border-gold/30 p-5 shadow-gold">
      <div className="flex items-center gap-4">
        <img src={icons3d.wallet} alt="" className="h-16 w-16 object-contain drop-shadow-lg" />
        <div><div className="text-sm text-muted-foreground">رصيدي الحالي</div><div className="text-4xl font-black text-gold">{loading ? "…" : coins.toLocaleString()} <span className="text-base">عملة</span></div></div>
      </div>
    </div>
    <div className="mt-4 grid grid-cols-2 gap-3">
      <div className="glass rounded-2xl p-4"><ShoppingCart className="mb-2 h-6 w-6 text-primary" /><div className="text-xs text-muted-foreground">ما تم إنفاقه</div><div className="text-xl font-black">{spent.toLocaleString()}</div></div>
      <div className="glass rounded-2xl p-4"><CreditCard className="mb-2 h-6 w-6 text-gold" /><div className="text-xs text-muted-foreground">إجمالي الشحن/الإضافات</div><div className="text-xl font-black">{topups.toLocaleString()}</div></div>
    </div>
    <section className="glass mt-4 rounded-3xl p-4">
      <div className="mb-3 flex items-center gap-2 font-bold"><History className="h-5 w-5 text-gold" /> سجلات الشحن والحركة</div>
      {txs.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد سجلات بعد.</p> : txs.map((t) => <div key={t.id} className="flex items-center justify-between border-b border-border/50 py-3 last:border-0"><div><div className="font-semibold">{reasonLabel[t.reason] ?? t.reason}</div><div className="text-[11px] text-muted-foreground">{new Date(t.created_at).toLocaleString("ar-EG")}</div></div><div className={t.amount < 0 ? "font-bold text-destructive" : "font-bold text-primary"}>{t.amount > 0 ? "+" : ""}{t.amount.toLocaleString()} {t.currency === "coins" ? "🪙" : "💎"}</div></div>)}
    </section>
    <div className="mt-4 rounded-2xl border border-gold/20 bg-gold/5 p-4 text-sm text-muted-foreground"><Gift className="mb-1 h-5 w-5 text-gold" /> الشحن يتم من وسائل الشحن المعتمدة داخل التطبيق، ولا يتم إنشاء رصيد تجريبي.</div>
  </div>;
}
