import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SubHeader, Coin } from "@/components/app/AppShell";
import { storeCats, type StoreKind } from "@/components/app/data";
import { LiveCatalog } from '@/components/app/LiveCatalog';
import { useCloud } from '@/components/app/cloud';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute("/store")({
  head: () => ({ meta: [{ title: "المتجر | صدى شات" }, { name: "description", content: "إطارات ودخوليات وفقاعات دردشة وأرقام ID مميزة ملونة" }, { property: "og:title", content: "المتجر | صدى شات" }, { property: "og:description", content: "إطارات ودخوليات وفقاعات دردشة وأرقام ID مميزة ملونة" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Store,
});

function Store() {
  const {data}=useCloud();
  const [k, setK] = useState<StoreKind | "all">("all");
  return (
    <div>
      <SubHeader title="المتجر" right={<span className="ms-auto pe-2 text-[12px] text-navy"><Coin n={data?.profile?.coins ?? 0} /></span>} />
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-3.5">
        {storeCats.map((x) => <Button variant="ghost" key={x.k} onClick={() => setK(x.k)} className={`chip press shrink-0 ${k === x.k ? "chip-active" : ""}`}>{x.n}</Button>)}
      </div>
      <div className="px-3.5 pb-6 pt-3">
        {k==='all'?<LiveCatalog/>:<LiveCatalog kind={k}/>}
      </div>
    </div>
  );
}
