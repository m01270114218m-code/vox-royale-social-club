import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    tanstackStart({
      server: { entry: "./server" },
    }),
    viteReact(),
  ],
  define: {
    "process.env.CAPACITOR": JSON.stringify(process.env.CAPACITOR ?? ""),
  },
});
