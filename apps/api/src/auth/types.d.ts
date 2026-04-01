import type { AuthUser } from "@gloss/shared/adapters/auth"

declare global {
    namespace Express {
        interface Request {
            authUser?: AuthUser
        }
    }
}

export {}
