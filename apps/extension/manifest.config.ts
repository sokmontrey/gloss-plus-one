import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
    manifest_version: 3,
    name: "Gloss Plus One",
    version: "1.0.0",
    action: {
        default_title: "Gloss Plus One",
        default_popup: "src/popup/index.html",
    },
    background: {
        service_worker: "src/background.ts",
        type: "module",
    },
    // Do not list broad globs here: Chrome MV3 rejects patterns like `**/*` and bare `*`, and
    // @crxjs/vite-plugin merges its own `web_accessible_resources` — duplicating broad rules
    // yields two identical blocks and load errors. Add explicit paths only when you need a
    // page script to load extension files, e.g. `resources: ["assets/injected.js"]`.
});
