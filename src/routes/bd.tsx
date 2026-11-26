import { createFileRoute } from "@tanstack/react-router";
import { AgencyCenter } from "@/components/app/AgencyCenter";

export const Route = createFileRoute("/bd")({
  head: () => ({ meta: [{ title: "مركز BD | صدى شات" }, { name: "description", content: "افتح وكالات المضيفين وتابعها من مركز BD" }, { property: "og:title", content: "مركز BD | صدى شات" }, { property: "og:description", content: "افتح وكالات المضيفين وتابعها من مركز BD" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Bd,
});

function Bd() { return <AgencyCenter mode="bd"/>; }
