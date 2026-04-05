import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'GlossPlusOne',
  description: 'Immersive language learning overlay',
  version: '1.0.0',
  action: {
    default_popup: 'src/popup.html',
    default_title: 'Gloss+1',
  },
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  permissions: ['storage', 'identity', 'activeTab'],
  host_permissions: ['http://*/*', 'https://*/*'],
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['src/content.tsx'],
    },
  ],
})
