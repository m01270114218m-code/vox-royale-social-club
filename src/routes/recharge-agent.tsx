import { createFileRoute } from "@tanstack/react-router";
import { AgencyCenter } from "@/components/app/AgencyCenter";

export const Route = createFileRoute("/recharge-agent")({
  head: () => ({ meta: [{ title: "وكيل الشحن | صدى شات" }, { name: "description", content: "اشحن عملات للمستخدمين مباشرة من رصيد وكيل الشحن" }, { property: "og:title", content: "وكيل الشحن | صدى شات" }, { property: "og:description", content: "اشحن عملات للمستخدمين مباشرة من رصيد وكيل الشحن" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: RechargeAgent,
});

function RechargeAgent() { return <AgencyCenter mode="recharge"/>; }
