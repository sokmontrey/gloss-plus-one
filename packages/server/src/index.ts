import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { generalRateLimiter } from "./middleware/rate-limit.js";
import { authRouter } from "./routes/auth.js";

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
app.use(generalRateLimiter);
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});
app.use("/api/auth", authRouter);
app.listen(env.port, () => {
  console.log(`Listening on ${env.port}`);
});
