import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
import { IceHeader, PartyTabs } from "@/components/app/AppShell";
import { LiveCatalog } from '@/components/app/LiveCatalog';

export const Route = createFileRoute("/events")({
  head: () => ({ meta: [{ title: "الفعاليات | صدى شات" }, { name: "description", content: "أحدث فعاليات وعروض صدى شات" }, { property: "og:title", content: "الفعاليات | صدى شات" }, { property: "og:description", content: "أحدث فعاليات وعروض صدى شات" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Events,
});

function Events() {
  return (
    <div>
      <IceHeader><PartyTabs active="events" /></IceHeader>
      <div className="space-y-3 px-3.5 pb-3 pt-2">
        <LiveCatalog kind="event" empty={<div className="flex flex-col items-center gap-2 pt-20 text-center"><span className="grid h-16 w-16 place-items-center rounded-full bg-primary/10 text-primary"><CalendarDays className="h-7 w-7" /></span><p className="text-[14px] font-black text-navy">لا توجد فعاليات الآن</p><p className="text-[12px] text-muted-foreground">ستظهر هنا الفعاليات الجديدة فور نشرها</p></div>} />
      </div>
    </div>
  );
}
