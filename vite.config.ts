import { defineConfig } from "@tanstack/start/config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
    spa: { enabled: process.env["CAPACITOR"] === "1" },
  },
});
