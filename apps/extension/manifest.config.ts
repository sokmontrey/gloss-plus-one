import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
    manifest_version: 3,
    name: "Gloss Plus One",
    version: "1.0.0",
    action: {
        default_title: "Gloss Plus One",
        default_popup: "src/popup/index.html",
    },
});
