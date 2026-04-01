import { envSchema, type Env } from "./schema.js"

export { envSchema, type Env } from "./schema.js"

/** Validate an env record (defaults to `process.env`). Use in tests with a partial override. */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
    return envSchema.parse(source)
}

/**
 * Validated process environment. Import only after `import "dotenv/config"` in the app entry
 * (ESM runs imports in order, so dotenv must be first).
 */
export const env: Env = parseEnv()
