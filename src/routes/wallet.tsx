import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SubHeader, Coin } from "@/components/app/AppShell";
import { ui } from "@/components/app/data";
import { useCloud, useCloudActions } from '@/components/app/cloud';

export const Route = createFileRoute("/wallet")({
  head: () => ({ meta: [{ title: "المحفظة | صدى شات" }, { name: "description", content: "رصيد العملات وطلبات الشحن وسجل المعاملات" }, { property: "og:title", content: "المحفظة | صدى شات" }, { property: "og:description", content: "رصيد العملات وطلبات الشحن وسجل المعاملات" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: WalletPage,
});

const packs = [{ c: 8000, p: "$1" }, { c: 42000, p: "$5", b: "+5%" }, { c: 88000, p: "$10", b: "+10%" }, { c: 450000, p: "$50", b: "+12%" }, { c: 920000, p: "$100", b: "+15%" }, { c: 1900000, p: "$200", b: "+20%" }];
const ledgerLabel: Record<string, string> = { gift: "هدية", lucky: "ربح هدية الحظ", daily: "مكافأة الدخول اليومي", recharge: "شحن عملات", credit: "شحن من الإدارة", transfer: "تحويل من وكيل شحن" };
const statusLabel: Record<string, string> = { pending: "قيد المراجعة", approved: "تم القبول", rejected: "مرفوض" };
const when = (s: string) => new Date(s).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" });

function WalletPage() {
  const { data } = useCloud();
  const act = useCloudActions();
  const me = data?.profile?.id;
  const coins = data?.profile?.coins ?? 0;
  const [sel, setSel] = useState(1);
  const [tab, setTab] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const mine = (data?.recharges ?? []).filter((r) => r.user_id === me);
  const pending = mine.filter((r) => r.status === "pending").length;
  const pack = packs[sel]!;
  const request = async () => {
    setBusy(true);
    if (await act("recharge_request", { coins: pack.c, price: pack.p, note: note.trim() }, "تم إرسال طلب الشحن للإدارة")) { setNote(""); setTab(1); }
    setBusy(false);
  };
  return (
    <div>
      <SubHeader title="المحفظة" />
      <div className="space-y-3 px-3.5 pb-6">
        <div className="vip-card relative overflow-hidden rounded-2xl p-4 text-primary-foreground shadow-lg">
          <img src={ui.coin} alt="" className="absolute -left-4 -top-3 h-28 w-28 opacity-25" />
          <p className="text-[12px] opacity-80">رصيد العملات</p>
          <p className="text-gold-grad mt-0.5 flex items-center gap-1.5 text-[30px] font-black leading-tight"><img src={ui.coin} alt="" className="h-7 w-7" />{coins.toLocaleString("en")}</p>
          <div className="mt-2 flex items-center justify-between text-[12px]"><Coin n={data?.profile?.diamonds ?? 0} gem /></div>
        </div>
        <div className="flex gap-2">{["شحن العملات", `طلباتي${pending ? ` (${pending})` : ""}`, "سجل المعاملات"].map((l, i) => <button key={l} onClick={() => setTab(i)} className={`chip press ${tab === i ? "chip-active" : ""}`}>{l}</button>)}</div>
        {tab === 0 && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {packs.map((p, i) => (
                <button key={p.c} onClick={() => setSel(i)} className={`press relative flex flex-col items-center gap-0.5 rounded-xl border-2 bg-secondary py-2.5 ${sel === i ? "border-primary shadow-md" : "border-transparent"}`}>
                  {p.b && <span className="absolute -top-1.5 left-1 rounded-full bg-badge px-1.5 text-[9px] font-bold text-primary-foreground">{p.b}</span>}
                  <img src={ui.coin} alt="" className="h-9 w-9" />
                  <span className="text-[13px] font-black text-navy">{p.c.toLocaleString("en")}</span>
                  <span className="text-[11.5px] font-bold text-muted-foreground">{p.p}</span>
                </button>
              ))}
            </div>
            <label className="block text-[12px] font-bold text-muted-foreground">ملاحظة للإدارة (اختياري)
              <textarea value={note} maxLength={300} rows={2} onChange={(e) => setNote(e.target.value)} placeholder="مثال: رقم عملية التحويل أو وسيلة الدفع" className="mt-1 w-full resize-none rounded-xl bg-secondary px-3 py-2 text-[13px] text-navy outline-none ring-1 ring-border focus:ring-primary" />
            </label>
            <button disabled={busy || !me} onClick={() => void request()} className="press w-full rounded-full gold-bg py-3 text-[15px] font-black text-navy shadow-md disabled:opacity-60">{busy ? "جارٍ الإرسال…" : `طلب شحن ${pack.c.toLocaleString("en")} · ${pack.p}`}</button>
            <p className="text-center text-[11px] text-muted-foreground">يصل طلبك للإدارة، وتصلك رسالة في «رسمي» عند القبول أو الرفض.</p>
          </>
        )}
        {tab === 1 && (
          <div className="space-y-2">
            {mine.map((r) => (
              <div key={r.id} className="surface space-y-1 p-3">
                <div className="flex items-center justify-between"><Coin n={r.coins} className="text-[14px] text-navy" /><span className={`rounded-full px-2 text-[10.5px] font-black leading-5 ${r.status === "approved" ? "bg-primary/10 text-primary" : r.status === "rejected" ? "bg-destructive/10 text-destructive" : "bg-gold/25 text-navy"}`}>{statusLabel[r.status] ?? r.status}</span></div>
                <p className="text-[10.5px] text-muted-foreground"><span dir="ltr">{r.price}</span> · {when(r.created_at)}</p>
                {r.admin_note && <p className="rounded-lg bg-muted px-2.5 py-1.5 text-[11.5px] text-navy">رد الإدارة: {r.admin_note}</p>}
              </div>
            ))}
            {!mine.length && <p className="py-10 text-center text-[13px] text-muted-foreground">لا توجد طلبات شحن بعد</p>}
          </div>
        )}
        {tab === 2 && (
          <div className="surface divide-y">
            {data?.ledger.filter((t) => t.sender_id === me || t.recipient_id === me).map((t) => { const out = t.sender_id === me && t.recipient_id !== me; return <div key={t.id} className="flex items-center justify-between px-3 py-2.5 text-[12px]"><span className="text-navy">{ledgerLabel[t.kind] ?? "عملات"}<span className="block text-[10px] text-muted-foreground">{when(t.created_at)}</span></span><span className={`flex items-center gap-0.5 font-bold ${out ? "text-destructive" : "text-primary"}`} dir="ltr">{out ? "−" : "+"}<Coin n={t.amount} /></span></div>; })}
            {!data?.ledger.some((t) => t.sender_id === me || t.recipient_id === me) && <p className="py-10 text-center text-[13px] text-muted-foreground">لا توجد معاملات بعد</p>}
          </div>
        )}
      </div>
    </div>
  );
}
