import { createServer } from './core/http/server.js'
import { loadConfig } from './core/config/config.js'

async function main() {
  const config = loadConfig()
  const { app } = createServer(config)

  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] listening on http://127.0.0.1:${config.port}`)
  })
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[server] fatal', err)
  process.exit(1)
})

