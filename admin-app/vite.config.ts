import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname,resolve } from "node:path";
const here=dirname(fileURLToPath(import.meta.url));
export default defineConfig({ plugins:[react()], root:here, base:"./", build:{outDir:resolve(here,"dist"),emptyOutDir:true} });