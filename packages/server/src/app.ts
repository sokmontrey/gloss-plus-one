import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { createGeneralRateLimiter } from "./middleware/rate-limit.js";
import { createAuthRouter } from "./routes/auth.js";

export function buildApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(express.json());
  app.use(createGeneralRateLimiter());
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });
  app.use("/api/auth", createAuthRouter());
  return app;
}
