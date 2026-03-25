import type { AuthContext } from "../contracts/auth.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      sid?: string;
    }
  }
}

export {};
