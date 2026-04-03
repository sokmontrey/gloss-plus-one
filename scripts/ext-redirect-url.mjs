/**
 * Prints the URLs you need to register for local Google OAuth dev.
 * Run after loading the extension from dist/ in Chrome at least once.
 *
 *   npm run ext:redirect-url
 */

import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'

const manifest = JSON.parse(readFileSync(new URL('../dist/manifest.json', import.meta.url)))

if (!manifest.key) {
  console.error(
    'No key found in dist/manifest.json.\n' +
    'Steps to get a stable ID:\n' +
    '  1. Run: npm run dev\n' +
    '  2. Go to chrome://extensions → Load unpacked → select the dist/ folder\n' +
    '  3. Copy the Extension ID shown there, then run this script again,\n' +
    '     OR pin the ID by adding a key — see README for instructions.\n',
  )
  process.exit(1)
}

// Chrome derives the extension ID from the SHA-256 of the decoded public key,
// then maps hex digits → 'a'-'p' (i.e. hex digit N → char code 'a'+N).
const hash = createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest('hex')
const id = hash
  .slice(0, 32)
  .split('')
  .map((c) => String.fromCharCode('a'.charCodeAt(0) + parseInt(c, 16)))
  .join('')

console.log(`Extension ID:  ${id}`)
console.log()
console.log('1. supabase/config.toml  →  additional_redirect_urls')
console.log(`     https://${id}.chromiumapp.org/`)
console.log()
console.log('2. Google Cloud Console  →  OAuth 2.0 → Authorized redirect URIs')
console.log('     http://127.0.0.1:54321/auth/v1/callback')
console.log()
console.log('3. .env')
console.log('     SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=<your-client-id>')
console.log('     SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=<your-client-secret>')
