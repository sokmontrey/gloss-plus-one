import type { NextFunction, Request, Response } from "express";
import { supabaseAdmin } from "../config/supabase.js";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const raw = req.headers.authorization;
  if (!raw?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = raw.slice(7);
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user?.email) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = data.user.id;
  req.userEmail = data.user.email;
  req.accessToken = token;
  next();
}
