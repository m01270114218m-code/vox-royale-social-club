import { createFileRoute } from "@tanstack/react-router";
import { AgencyCenter } from "@/components/app/AgencyCenter";

export const Route = createFileRoute("/agent")({
  head: () => ({ meta: [{ title: "مركز الوكيل | صدى شات" }, { name: "description", content: "إدارة مضيفي وكالتك ومتابعة دخلهم" }, { property: "og:title", content: "مركز الوكيل | صدى شات" }, { property: "og:description", content: "إدارة مضيفي وكالتك ومتابعة دخلهم" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Agent,
});

function Agent() { return <AgencyCenter mode="agent"/>; }
