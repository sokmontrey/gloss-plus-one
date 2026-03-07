// vite.config.ts
import { defineConfig } from "file:///home/montrey/projects/gloss-plus-one/node_modules/vite/dist/node/index.js";
import path from "node:path";
import react from "file:///home/montrey/projects/gloss-plus-one/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "file:///home/montrey/projects/gloss-plus-one/node_modules/@tailwindcss/vite/dist/index.mjs";
import { crx } from "file:///home/montrey/projects/gloss-plus-one/node_modules/@crxjs/vite-plugin/dist/index.mjs";

// manifest.json
var manifest_default = {
  manifest_version: 3,
  name: "GlossPlusOne",
  description: "Minimal Chrome extension skeleton.",
  version: "0.0.1",
  icons: {
    "128": "icon-128.png"
  },
  action: {
    default_title: "GlossPlusOne",
    default_popup: "src/popup/index.html",
    default_icon: {
      "128": "icon-128.png"
    }
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module"
  },
  permissions: ["storage"],
  host_permissions: ["https://generativelanguage.googleapis.com/*"],
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/index.ts"],
      run_at: "document_idle"
    }
  ]
};

// vite.config.ts
var __vite_injected_original_dirname = "/home/montrey/projects/gloss-plus-one";
var vite_config_default = defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest: manifest_default })],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAibWFuaWZlc3QuanNvbiJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiY29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2Rpcm5hbWUgPSBcIi9ob21lL21vbnRyZXkvcHJvamVjdHMvZ2xvc3MtcGx1cy1vbmVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9ob21lL21vbnRyZXkvcHJvamVjdHMvZ2xvc3MtcGx1cy1vbmUvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2hvbWUvbW9udHJleS9wcm9qZWN0cy9nbG9zcy1wbHVzLW9uZS92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XG5pbXBvcnQgcGF0aCBmcm9tIFwibm9kZTpwYXRoXCI7XG5pbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCI7XG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSBcIkB0YWlsd2luZGNzcy92aXRlXCI7XG5pbXBvcnQgeyBjcnggfSBmcm9tIFwiQGNyeGpzL3ZpdGUtcGx1Z2luXCI7XG5pbXBvcnQgbWFuaWZlc3QgZnJvbSBcIi4vbWFuaWZlc3QuanNvblwiO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKSwgdGFpbHdpbmRjc3MoKSwgY3J4KHsgbWFuaWZlc3QgfSldLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxuICAgIH0sXG4gIH0sXG59KTtcbiIsICJ7XG4gIFwibWFuaWZlc3RfdmVyc2lvblwiOiAzLFxuICBcIm5hbWVcIjogXCJHbG9zc1BsdXNPbmVcIixcbiAgXCJkZXNjcmlwdGlvblwiOiBcIk1pbmltYWwgQ2hyb21lIGV4dGVuc2lvbiBza2VsZXRvbi5cIixcbiAgXCJ2ZXJzaW9uXCI6IFwiMC4wLjFcIixcbiAgXCJpY29uc1wiOiB7XG4gICAgXCIxMjhcIjogXCJpY29uLTEyOC5wbmdcIlxuICB9LFxuICBcImFjdGlvblwiOiB7XG4gICAgXCJkZWZhdWx0X3RpdGxlXCI6IFwiR2xvc3NQbHVzT25lXCIsXG4gICAgXCJkZWZhdWx0X3BvcHVwXCI6IFwic3JjL3BvcHVwL2luZGV4Lmh0bWxcIixcbiAgICBcImRlZmF1bHRfaWNvblwiOiB7XG4gICAgICBcIjEyOFwiOiBcImljb24tMTI4LnBuZ1wiXG4gICAgfVxuICB9LFxuICBcImJhY2tncm91bmRcIjoge1xuICAgIFwic2VydmljZV93b3JrZXJcIjogXCJzcmMvYmFja2dyb3VuZC9pbmRleC50c1wiLFxuICAgIFwidHlwZVwiOiBcIm1vZHVsZVwiXG4gIH0sXG4gIFwicGVybWlzc2lvbnNcIjogW1wic3RvcmFnZVwiXSxcbiAgXCJob3N0X3Blcm1pc3Npb25zXCI6IFtcImh0dHBzOi8vZ2VuZXJhdGl2ZWxhbmd1YWdlLmdvb2dsZWFwaXMuY29tLypcIl0sXG4gIFwiY29udGVudF9zY3JpcHRzXCI6IFtcbiAgICB7XG4gICAgICBcIm1hdGNoZXNcIjogW1wiPGFsbF91cmxzPlwiXSxcbiAgICAgIFwianNcIjogW1wic3JjL2NvbnRlbnQvaW5kZXgudHNcIl0sXG4gICAgICBcInJ1bl9hdFwiOiBcImRvY3VtZW50X2lkbGVcIlxuICAgIH1cbiAgXVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFpUyxTQUFTLG9CQUFvQjtBQUM5VCxPQUFPLFVBQVU7QUFDakIsT0FBTyxXQUFXO0FBQ2xCLE9BQU8saUJBQWlCO0FBQ3hCLFNBQVMsV0FBVzs7O0FDSnBCO0FBQUEsRUFDRSxrQkFBb0I7QUFBQSxFQUNwQixNQUFRO0FBQUEsRUFDUixhQUFlO0FBQUEsRUFDZixTQUFXO0FBQUEsRUFDWCxPQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsRUFDVDtBQUFBLEVBQ0EsUUFBVTtBQUFBLElBQ1IsZUFBaUI7QUFBQSxJQUNqQixlQUFpQjtBQUFBLElBQ2pCLGNBQWdCO0FBQUEsTUFDZCxPQUFPO0FBQUEsSUFDVDtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFlBQWM7QUFBQSxJQUNaLGdCQUFrQjtBQUFBLElBQ2xCLE1BQVE7QUFBQSxFQUNWO0FBQUEsRUFDQSxhQUFlLENBQUMsU0FBUztBQUFBLEVBQ3pCLGtCQUFvQixDQUFDLDZDQUE2QztBQUFBLEVBQ2xFLGlCQUFtQjtBQUFBLElBQ2pCO0FBQUEsTUFDRSxTQUFXLENBQUMsWUFBWTtBQUFBLE1BQ3hCLElBQU0sQ0FBQyxzQkFBc0I7QUFBQSxNQUM3QixRQUFVO0FBQUEsSUFDWjtBQUFBLEVBQ0Y7QUFDRjs7O0FENUJBLElBQU0sbUNBQW1DO0FBT3pDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLEdBQUcsWUFBWSxHQUFHLElBQUksRUFBRSwyQkFBUyxDQUFDLENBQUM7QUFBQSxFQUNuRCxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLEtBQUssUUFBUSxrQ0FBVyxPQUFPO0FBQUEsSUFDdEM7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
