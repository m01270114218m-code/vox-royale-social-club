import { createFileRoute, useRouter } from "@tanstack/react-router";
import { ChevronRight, Search as S, X } from "lucide-react";
import { useState } from "react";
import { RoomCard } from "@/components/app/AppShell";
import { liveRooms } from "@/components/app/data";
import { useCloud } from "@/components/app/cloud";

export const Route = createFileRoute("/search")({
  head: () => ({ meta: [{ title: "بحث | صدى شات" }, { name: "description", content: "ابحث عن الغرف الصوتية بالاسم أو ID" }, { property: "og:title", content: "بحث | صدى شات" }, { property: "og:description", content: "ابحث عن الغرف الصوتية بالاسم أو ID" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Search,
});

const popularTerms = ["سهرة", "عسل", "الملوك", "قهوة"];

function Search() {
  const r = useRouter();
  const [q, setQ] = useState("");
  useCloud();
  const res = liveRooms().filter((x) => x.name.includes(q) || x.id === q);
  return (
    <div className="px-3.5 pb-6">
      <div className="sticky top-0 z-30 -mx-3.5 flex h-14 items-center gap-1.5 bg-background/90 px-2 backdrop-blur">
        <button onClick={() => (r.history.canGoBack() ? r.history.back() : void r.navigate({ to: "/", replace: true }))} aria-label="رجوع" className="grid h-9 w-9 place-items-center text-navy"><ChevronRight className="h-6 w-6" /></button>
        <div className="flex h-9 flex-1 items-center gap-2 rounded-full border bg-secondary px-3">
          <S className="h-4 w-4 text-muted-foreground" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث باسم الغرفة أو ID" className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none" />
          {q && <button onClick={() => setQ("")} aria-label="مسح"><X className="h-4 w-4 text-muted-foreground" /></button>}
        </div>
      </div>
      {!q && <div className="mb-3"><p className="mb-2 text-[13px] font-extrabold text-navy">عمليات بحث شائعة</p><div className="flex flex-wrap gap-2">{popularTerms.map((h) => <button key={h} onClick={() => setQ(h)} className="chip press">{h}</button>)}</div></div>}
      <div className="space-y-2.5">{res.map((x) => <RoomCard key={x.id} r={x} />)}</div>
      {!res.length && <p className="py-10 text-center text-[13px] text-muted-foreground">لا توجد نتائج</p>}
    </div>
  );
}
