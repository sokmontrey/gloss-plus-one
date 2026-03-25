import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
dotenv.config({ path: path.join(repoRoot, ".env") });

function required(name: string): string {
  const v = process.env[name];
  if (v === undefined || v === "") throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

const corsOriginsRaw = required("CORS_ORIGINS");
const portRaw = required("PORT");
const port = Number(portRaw);
if (!Number.isInteger(port) || port < 1) throw new Error("PORT must be a positive integer");

export const env = {
  supabaseUrl: required("SUPABASE_URL"),
  supabasePublishableKey: required("SUPABASE_PUBLISHABLE_KEY"),
  supabaseSecretKey: required("SUPABASE_SECRET_KEY"),
  supabaseJwtSecret: required("SUPABASE_JWT_SECRET"),
  port,
  corsOrigins: corsOriginsRaw.split(",").map((s) => s.trim()).filter(Boolean),
  nodeEnv: process.env.NODE_ENV ?? "development",
} as const;
