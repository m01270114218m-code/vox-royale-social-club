import { createFileRoute } from "@tanstack/react-router";
import { AgencyCenter } from "@/components/app/AgencyCenter";

export const Route = createFileRoute("/host")({
  head: () => ({ meta: [{ title: "مركز المضيف | صدى شات" }, { name: "description", content: "وقت نشاطك في التطبيق ووقت المايك وقيمة الهدايا المستلمة" }, { property: "og:title", content: "مركز المضيف | صدى شات" }, { property: "og:description", content: "وقت نشاطك في التطبيق ووقت المايك وقيمة الهدايا المستلمة" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Host,
});

function Host() { return <AgencyCenter mode="host"/>; }
