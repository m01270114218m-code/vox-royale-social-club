// TanStack Start configuration shared with the project's Vite preset.
// Android/Capacitor needs a real static HTML shell, so enable SPA mode and
// emit the shell as the root index.html inside .output/public.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    spa: {
      enabled: true,
      prerender: {
        outputPath: "/index.html",
        crawlLinks: false,
        retryCount: 2,
      },
    },
    server: {
      entry: "server",
    },
  },
});
