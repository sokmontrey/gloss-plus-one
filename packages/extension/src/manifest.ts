import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "GlossPlusOne",
  description: "Popup entrypoint for account access and language learning controls.",
  version: "0.1.0",
  action: {
    default_title: "GlossPlusOne",
    default_popup: "index.html",
  },
  permissions: ["storage", "tabs"],
  host_permissions: ["http://localhost:8787/*", "http://127.0.0.1:8787/*"],
});
