import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, History, ArrowLeftRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { icons3d } from "@/lib/assets3d";

export const Route = createFileRoute("/diamonds")({
  component: () => <AppShell><DiamondsPage /></AppShell>,
});

type Tx = { id: string; currency: string; amount: number; reason: string; created_at: string };

function DiamondsPage() {
  const { user } = useAuth();
  const [diamonds, setDiamonds] = useState(0);
  const [coins, setCoins] = useState(0);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!user) return;
    const [{ data: w }, { data: rows }] = await Promise.all([
      supabase.from("wallets").select("coins,diamonds").eq("user_id", user.id).maybeSingle(),
      supabase.from("wallet_transactions").select("id,currency,amount,reason,created_at").eq("user_id", user.id).eq("currency", "diamonds").order("created_at", { ascending: false }).limit(50),
    ]);
    setDiamonds(Number(w?.diamonds ?? 0)); setCoins(Number(w?.coins ?? 0));
    setTxs((rows ?? []).map(x=>({...x,amount:Number(x.amount)})) as Tx[]);
  }
  useEffect(() => { void load(); }, [user]);

  async function convert() {
    if (diamonds < 4000) { toast.error("تحتاج إلى 4000 ألماس على الأقل"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc("convert_diamonds_to_coins", { _diamonds: 4000 });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم تحويل 4000 ألماس إلى 450 عملة");
    await load();
    return data;
  }

  return <div dir="rtl" className="px-4 pt-5 pb-8">
    <div className="mb-4 flex items-center justify-between"><Link to="/profile" className="glass rounded-full p-2"><ArrowRight className="h-5 w-5"/></Link><h1 className="text-2xl font-black text-gold">الألماس</h1><span/></div>
    <div className="card-3d glass rounded-3xl border border-primary/30 p-6 text-center">
      <img src={icons3d.diamond} alt="" className="mx-auto mb-2 h-16 w-16 object-contain drop-shadow-lg" /><div className="text-sm text-muted-foreground">ألماسك الحالي</div><div className="text-4xl font-black">{diamonds.toLocaleString()}</div>
      <div className="mt-4 rounded-2xl bg-background/50 p-4"><div className="text-sm text-muted-foreground">سعر التحويل الثابت</div><div className="mt-1 text-2xl font-black text-gold">4000 💎 = 450 🪙</div><div className="mt-1 text-xs text-muted-foreground">يتم التحويل على دفعات 4000 ألماس فقط.</div></div>
      <button disabled={busy || diamonds < 4000} onClick={()=>void convert()} className="mt-4 w-full rounded-2xl bg-gold px-5 py-3 font-black text-black disabled:cursor-not-allowed disabled:opacity-40"><ArrowLeftRight className="mr-2 inline h-5 w-5"/>{busy ? "جارٍ التحويل…" : "تحويل 4000 → 450 الآن"}</button>
      <div className="mt-3 text-xs text-muted-foreground">رصيد العملات بعد التحويل: {coins.toLocaleString()} 🪙</div>
    </div>
    <section className="glass mt-4 rounded-3xl p-4"><div className="mb-3 flex items-center gap-2 font-bold"><History className="h-5 w-5 text-gold"/> سجل تحويلات الألماس</div>{txs.length===0?<p className="text-sm text-muted-foreground">لا توجد تحويلات بعد.</p>:txs.map(t=><div key={t.id} className="flex justify-between border-b border-border/50 py-3 last:border-0"><div><div>{t.reason === "diamond_to_coins" ? "تحويل إلى عملات" : t.reason}</div><div className="text-[11px] text-muted-foreground">{new Date(t.created_at).toLocaleString("ar-EG")}</div></div><div className="font-bold text-cyan-300">{t.amount.toLocaleString()} 💎</div></div>)}</section>
  </div>;
}
