import { createFileRoute } from "@tanstack/react-router";

// The room itself is rendered by AppShell so it can stay alive while minimized.
export const Route = createFileRoute("/room/$id")({
  head: () => ({ meta: [{ title: "غرفة صوتية | صدى شات" }, { name: "description", content: "انضم للغرفة الصوتية وتحدث وأرسل الهدايا لأصدقائك" }, { property: "og:title", content: "غرفة صوتية | صدى شات" }, { property: "og:description", content: "انضم للغرفة الصوتية وتحدث وأرسل الهدايا لأصدقائك" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: () => null,
});
