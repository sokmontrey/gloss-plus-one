import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
    include: ["src/**/*.test.ts"],
    env: {
      SUPABASE_URL: "http://127.0.0.1:54321",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
      SUPABASE_SECRET_KEY: "sb_secret_test",
      SUPABASE_JWT_SECRET: "super-secret-jwt-token-with-at-least-32-characters-long",
      PORT: "4000",
      CORS_ORIGINS: "http://localhost:5173,http://localhost:3000",
      NODE_ENV: "test",
    },
  },
});
