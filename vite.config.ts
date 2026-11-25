import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    tanstackStart({
      server: { entry: "./server" },
    }),
    tailwindcss(),
    viteReact(),
  ],
  define: {
    "process.env.CAPACITOR": JSON.stringify(process.env.CAPACITOR ?? ""),
  },
});
