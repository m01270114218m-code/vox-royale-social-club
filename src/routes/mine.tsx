import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Settings2, DoorOpen } from "lucide-react";
import { IceHeader, PartyTabs, RoomCard } from "@/components/app/AppShell";
import { rooms, images } from "@/components/app/data";
import { useCloud } from "@/components/app/cloud";
import { RoomForm } from "@/components/app/RoomForm";

export const Route = createFileRoute("/mine")({
  head: () => ({ meta: [{ title: "غرفتي | صدى شات" }, { name: "description", content: "أنشئ غرفتك الخاصة برقم حسابك وتابع الغرف التي زرتها" }, { property: "og:title", content: "غرفتي | صدى شات" }, { property: "og:description", content: "أنشئ غرفتك الخاصة برقم حسابك وتابع الغرف التي زرتها" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Mine,
});

function Mine() {
  const { data } = useCloud();
  const nav = useNavigate();
  const [t, setT] = useState(0);
  const [form, setForm] = useState(false);
  const my = data?.myRoom ?? null;
  const uid = String(data?.profile?.uid ?? "");
  const others = (data?.roomList ?? []).filter((r) => r.id !== my?.id);
  const lists = [rooms.slice(0, 3), rooms.slice(3), others];
  const empty = ["لم تزر أي غرفة بعد", "لا تتابع أي غرفة بعد", "لا توجد غرف أعضاء بعد"];
  return (
    <div>
      <IceHeader><PartyTabs active="mine" /></IceHeader>
      <div className="space-y-3 px-3.5 pt-2">
        {my ? (
          <div className="vip-card relative overflow-hidden rounded-2xl p-3 text-night-foreground shadow-lg">
            <img src={images.room} alt="" className="absolute inset-0 h-full w-full object-cover opacity-35" />
            <div className="relative flex items-center gap-3">
              <img src={my.img} alt="" className="h-14 w-14 rounded-xl border-2 border-gold object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-extrabold">{my.name}</p>
                <p className="text-[11px] opacity-80" dir="ltr">ID {my.id}</p>
              </div>
              <Link to="/room/$id" params={{ id: my.id }} className="press rounded-full gold-bg px-4 py-1.5 text-[13px] font-black text-navy">دخول</Link>
            </div>
            {my.notice && <p className="relative mt-2 line-clamp-2 text-[11.5px] opacity-85">{my.notice}</p>}
            <button type="button" onClick={() => setForm(true)} className="press relative mt-3 flex w-full items-center justify-center gap-1 rounded-lg night-glass py-1.5 text-[12px] font-bold"><Settings2 className="h-3.5 w-3.5" /> تعديل الاسم والصورة والإعلان</button>
          </div>
        ) : data?.profile ? (
          <button type="button" onClick={() => setForm(true)} className="room-card-pro press flex w-full items-center gap-3.5 p-2.5 text-start">
            <span className="vip-card relative grid h-[76px] w-[76px] shrink-0 place-items-center overflow-hidden rounded-2xl shadow-sm">
              <img src={images.room} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40" />
              <span className="relative grid h-10 w-10 place-items-center rounded-full gold-bg text-navy shadow-md"><Plus className="h-6 w-6" strokeWidth={3} /></span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col justify-between gap-2.5 py-0.5">
              <span className="truncate text-[15.5px] font-black leading-tight text-navy">إنشاء غرفة</span>
              <span className="flex items-center justify-between gap-2">
                <span className="id-glass inline-flex h-[20px] items-center gap-1 rounded-full pe-2 ps-0.5 text-[11px] font-black" dir="ltr"><span className="id-glass-tag">ID</span>{uid}</span>
                <span className="inline-flex items-center gap-1 rounded-full gold-bg px-3 py-0.5 text-[12.5px] font-black text-navy"><DoorOpen className="h-3.5 w-3.5" />ابدأ الآن</span>
              </span>
            </span>
          </button>
        ) : null}
        <div className="flex gap-2">
          {["مؤخراً", "المتابعة", "غرف الأعضاء"].map((l, i) => (
            <button key={l} onClick={() => setT(i)} className={`chip press ${t === i ? "chip-active" : ""}`}>{l}</button>
          ))}
        </div>
        <div className="space-y-2.5 pb-3">
          {lists[t]!.map((r) => <RoomCard key={r.id + t} r={r} />)}
          {!lists[t]!.length && <p className="py-10 text-center text-[13px] text-muted-foreground">{empty[t]}</p>}
        </div>
      </div>
      {form && <RoomForm uid={uid} initial={my ? { name: my.name, notice: my.notice, cover: my.img } : undefined} onClose={() => setForm(false)} onDone={() => { setForm(false); if (!my && uid) void nav({ to: "/room/$id", params: { id: uid } }); }} />}
    </div>
  );
}
