import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "@/components/app/toast";
import { SubHeader, Coin } from "@/components/app/AppShell";
import { gifts, icons, frames, entries, bubbles, storeItems } from "@/components/app/data";
import { LiveCatalog } from '@/components/app/LiveCatalog';
import { VipChip } from '@/components/app/ui';

export const Route = createFileRoute("/vip")({
  head: () => ({ meta: [{ title: "VIP | صدى شات" }, { name: "description", content: "مستويات VIP والامتيازات الحصرية في صدى شات" }, { property: "og:title", content: "VIP | صدى شات" }, { property: "og:description", content: "مستويات VIP والامتيازات الحصرية في صدى شات" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Vip,
});

const perks = [
  { l: "شارة VIP", i: icons.badge }, { l: "إطار حصري", i: frames.wings.img }, { l: "مركبة دخول", i: entries.lion.img }, { l: "فقاعة ذهبية", i: bubbles.gold.img },
  { l: "حماية الطرد", i: icons.level }, { l: "مقعد مميز", i: storeItems.find((s) => s.key === "seat:throne")!.img }, { l: "هدايا حصرية", i: gifts[6]!.img }, { l: "ID مميز", i: icons.id },
];

function Vip() {
  const [lv, setLv] = useState(1);
  return (
    <div className="min-h-screen bg-night text-night-foreground">
      <SubHeader title="VIP" dark />
      <div className="px-3.5 pb-6">
        <LiveCatalog kind="vip"/>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: 8 }, (_, i) => i + 1).map((n) => (
            <button key={n} onClick={() => setLv(n)} className={`press h-8 shrink-0 rounded-full px-3.5 text-[12.5px] font-black ${lv === n ? "gold-bg text-navy" : "night-glass"}`}>VIP{n}</button>
          ))}
        </div>
        <div className="vip-card relative mt-3 overflow-hidden rounded-3xl border border-gold/60 p-5 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="inline-block rounded-full bg-gold/20 px-2.5 py-0.5 text-[10.5px] font-black text-gold">عضوية ملكية</span>
              <p className="text-gold-grad mt-1.5 text-[34px] font-black leading-none">VIP {lv}</p>
              <p className="mt-1.5 text-[12px] opacity-85">{Math.min(lv + 1, 8)} من 8 امتيازات حصرية</p>
            </div>
            <span className="grid h-24 w-24 place-items-center"><span className="scale-[3]"><VipChip vip={lv}/></span></span>
          </div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-night/45">
            <div className="gold-bg h-full rounded-full transition-all duration-300" style={{ width: `${Math.round((Math.min(lv + 1, 8) / 8) * 100)}%` }} />
          </div>
        </div>
        <p className="mt-4 mb-2 text-[14px] font-extrabold">الامتيازات</p>
        <div className="grid grid-cols-4 gap-y-3">
          {perks.map((p, i) => (
            <div key={p.l} className={`flex flex-col items-center gap-1 text-center text-[11px] transition ${i <= lv ? "" : "opacity-30 grayscale"}`}>
              <span className="grid h-[52px] w-[52px] place-items-center rounded-2xl night-glass ring-1 ring-ice/40"><img src={p.i} alt="" className="h-9 w-9 object-contain" /></span>{p.l}
            </div>
          ))}
        </div>
        <button onClick={() => toast('اختر عضوية VIP المنشورة من الإدارة لتفعيلها على حسابك')} className="press mt-6 flex w-full items-center justify-center gap-2 rounded-full gold-bg py-3 text-[15px] font-black text-navy shadow-lg">فتح VIP{lv} <Coin n={lv * 30000} /></button>
      </div>
    </div>
  );
}
