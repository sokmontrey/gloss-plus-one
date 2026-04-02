import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import { defineConfig } from "vite";
import manifest from "./manifest.config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    plugins: [tailwindcss(), react(), crx({ manifest })],
    resolve: {
        alias: { "@": path.resolve(__dirname, "src") },
    },
});
