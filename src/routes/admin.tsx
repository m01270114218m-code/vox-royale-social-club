import { createFileRoute } from "@tanstack/react-router";
import { ControlPanel } from '@/components/app/ControlPanel';

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "لوحة التحكم | صدى شات" }, { name: "description", content: "إدارة صدى شات: الأصول والمتجر والمستخدمون وطلبات الشحن والرسائل" }, { name: "robots", content: "noindex" }, { property: "og:title", content: "لوحة التحكم | صدى شات" }, { property: "og:description", content: "إدارة صدى شات: الأصول والمتجر والمستخدمون وطلبات الشحن والرسائل" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  component: ControlPanel,
});
