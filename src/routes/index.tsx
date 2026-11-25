import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { IceHeader, PartyTabs, RoomCard } from "@/components/app/AppShell";
import { rooms, ui, users } from "@/components/app/data";
import { LiveCatalog } from "@/components/app/LiveCatalog";
import { useCloud } from "@/components/app/cloud";
import { meAsUser, useProfile } from "@/components/app/profile";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "الحفلات | صدى شات" }, { name: "description", content: "اكتشف أقوى غرف الدردشة الصوتية العربية" }, { property: "og:title", content: "الحفلات | صدى شات" }, { property: "og:description", content: "اكتشف أقوى غرف الدردشة الصوتية العربية" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Home,
});

const countries = [{ k: "all", l: "شائع", f: "❄️" }, { k: "🇪🇬", l: "مصر", f: "🇪🇬" }, { k: "🇸🇦", l: "السعودية", f: "🇸🇦" }, { k: "🇦🇪", l: "الإمارات", f: "🇦🇪" }, { k: "🇯🇴", l: "الأردن", f: "🇯🇴" }, { k: "🇲🇦", l: "المغرب", f: "🇲🇦" }];

function Home() {
  const profile = useProfile();
  const { data } = useCloud();
  const liveList = data?.roomList ?? [];
  const [c, setC] = useState("all");
  const allUsers = [meAsUser(profile), ...users];
  const topWealth = [...allUsers].sort((a, b) => b.wealth - a.wealth).slice(0, 2).map((u) => u.avatar);
  const topRooms = [...liveList, ...rooms].sort((a, b) => b.online - a.online).slice(0, 2).map((r) => profile.roomMedia[r.id]?.cover || r.img);
  const topCharm = [...allUsers].sort((a, b) => b.charm - a.charm).slice(0, 2).map((u) => u.avatar);
  const ranks = [
    { k: "wealth" as const, l: "الثروة", i: ui.wealth, gold: true, imgs: topWealth },
    { k: "room" as const, l: "الغرفة", i: ui.room, gold: false, imgs: topRooms },
    { k: "charm" as const, l: "الكاريزما", i: ui.charm, gold: false, imgs: topCharm },
  ];
  const list = c === "all" ? [...liveList, ...rooms.slice().sort((a, b) => b.online - a.online)] : rooms.filter((r) => r.flag === c).sort((a, b) => b.online - a.online);
  return (
    <div>
      <IceHeader><PartyTabs active="party" /></IceHeader>
      <div className="space-y-3 px-3.5 pt-2">
        <LiveCatalog home />

        <div className="grid grid-cols-3 gap-2">
          {ranks.map((r) => (
            <Link
              key={r.k}
              to="/rankings"
              search={{ tab: r.k }}
              className={`press relative flex flex-col items-center overflow-hidden rounded-2xl px-2 py-2.5 text-center ${r.gold ? "gold-bg shadow-md" : "glass-card"}`}
            >
              <div className="flex items-center gap-1">
                <img src={r.i} alt="" className="h-5 w-5 shrink-0 drop-shadow" />
                <span className="text-[12.5px] font-black text-navy">{r.l}</span>
              </div>
              <div className="mt-2 flex -space-x-2 space-x-reverse">
                {r.imgs.map((src, idx) => (
                  <img key={idx} src={src} alt="" className="h-7 w-7 rounded-full border-2 border-secondary object-cover shadow-sm" />
                ))}
              </div>
            </Link>
          ))}
        </div>

        <div className="no-scrollbar -mx-3.5 flex gap-2 overflow-x-auto px-3.5">
          {countries.map((x) => <button key={x.k} onClick={() => setC(x.k)} className={`chip press ${c === x.k ? "chip-active" : ""}`}><span className="text-sm">{x.f}</span>{x.l}</button>)}
        </div>

        <div className="space-y-2.5 pb-3">
          {list.map((r) => <RoomCard key={r.id} r={r} />)}
          {!list.length && <p className="py-10 text-center text-muted-foreground">لا توجد غرف في هذه الدولة الآن</p>}
        </div>
      </div>
    </div>
  );
}
