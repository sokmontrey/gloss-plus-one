import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'GlossPlusOne',
  description: 'Immersive language learning overlay',
  version: '1.0.0',
  key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAs5csSbWJQFF0HZkqP2ybQu9TrfHZz5f/8rvd9YiZL+5JQc0suFeeomQL63jPAWsMqu/UcTeGIglaN3F7l9IJS2c7AGSEeBs5rHTYn91MSpDVgPhpd1uiruM5n8r6IpnKxba1IaO2V33edII7aHt51mSx3Ue31vN4g9yC8uY2WTeB9/6jw3k1HNOII1L31XdNh0fDTmmMyWCDRugv/MsvEqPTyIKwZfDyIhi1Yj1dfm19ANAMDXJRqB4lDC6i5o7PvwRMkxNfxj1Wr/dXUUO0iTbGCTX12i+25k7rREFLRqJvIo30q3oGnm5q0vVczqPTxzDhM3g2GrWvBU2bcvpBMwIDAQAB',

  action: {
    default_popup: 'src/popup.html',
    default_title: 'Gloss+1',
  },
  background: {
    service_worker: 'src/background.ts',
    type: 'module',
  },
  permissions: ['storage', 'identity', 'activeTab', 'scripting'],
  host_permissions: ['http://*/*', 'https://*/*'],
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['src/content.tsx'],
    },
  ],
})
