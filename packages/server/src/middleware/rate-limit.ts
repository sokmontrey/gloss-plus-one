import type { Request, Response } from "express";
import rateLimit from "express-rate-limit";

const json429 = (_req: Request, res: Response) => {
  res.status(429).json({ error: "Too many requests" });
};

export const generalRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429,
});

export const authStrictRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: json429,
});
