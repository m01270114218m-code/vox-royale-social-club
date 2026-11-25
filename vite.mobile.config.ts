import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "node:url";

const mobileRoot = fileURLToPath(new URL("./mobile", import.meta.url));

export default defineConfig({
  root: mobileRoot,
  base: "./",
  plugins: [
    tsconfigPaths({
      projects: [fileURLToPath(new URL("./tsconfig.json", import.meta.url))],
    }),
    tailwindcss(),
    react(),
  ],
  define: {
    "process.env.CAPACITOR": JSON.stringify("1"),
  },
  build: {
    outDir: "../dist/mobile",
    emptyOutDir: true,
  },
});
