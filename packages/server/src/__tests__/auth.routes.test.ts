import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import type { MockSupabaseAdmin } from "./helpers.js";
import {
  createSupertestAgent,
  createTableChain,
  createTestApp,
  getMockSupabaseAdmin,
  resetSupabaseMocks,
} from "./helpers.js";

describe("auth routes", () => {
  let sb: MockSupabaseAdmin;

  beforeEach(() => {
    resetSupabaseMocks();
    sb = getMockSupabaseAdmin();
  });

  it("GET /api/auth/google returns 302 redirect to a Google OAuth URL", async () => {
    const googleUrl = "https://accounts.google.com/o/oauth2/v2/auth?client_id=x";
    sb.auth.signInWithOAuth.mockResolvedValue({
      data: { url: googleUrl, provider: "google" },
      error: null,
    });

    await createSupertestAgent()
      .get("/api/auth/google")
      .expect(302)
      .expect("Location", googleUrl);
  });

  it("GET /api/auth/callback with valid code sets HTTP-only refresh cookie and puts access_token in redirect URL hash", async () => {
    sb.auth.exchangeCodeForSession.mockResolvedValue({
      data: {
        session: {
          access_token: "access-token-1",
          refresh_token: "refresh-token-1",
          expires_in: 3600,
          user: { id: "user-1", email: "u@example.com" },
        },
      },
      error: null,
    });

    sb.from.mockImplementation(() => {
      const chain = createTableChain();
      chain.maybeSingle.mockResolvedValue({
        data: { id: "user-1", email: "u@example.com", display_name: "U" },
        error: null,
      });
      return chain;
    });

    const res = await createSupertestAgent()
      .get("/api/auth/callback")
      .query({ code: "valid", redirect_to: "http://localhost:5173" })
      .expect(302);

    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    expect(cookies!.some((c) => /gpo_refresh=/.test(c) && /HttpOnly/i.test(c))).toBe(true);

    const loc = res.headers.location!;
    const hash = new URL(loc).hash.slice(1);
    const params = new URLSearchParams(hash);
    expect(params.get("access_token")).toBe("access-token-1");
    expect(params.get("expires_in")).toBe("3600");
  });

  it("GET /api/auth/callback with no code returns 400", async () => {
    await createSupertestAgent()
      .get("/api/auth/callback")
      .query({ redirect_to: "http://localhost:5173" })
      .expect(400)
      .expect((res) => {
        expect(res.body).toEqual({ error: "Invalid request" });
      });
  });

  it("POST /api/auth/refresh with valid cookie returns new access token and sets new cookie", async () => {
    sb.auth.refreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: "access-token-2",
          refresh_token: "refresh-token-2",
          expires_in: 7200,
        },
      },
      error: null,
    });

    const res = await createSupertestAgent()
      .post("/api/auth/refresh")
      .set("Cookie", "gpo_refresh=refresh-token-old")
      .expect(200);

    expect(res.body).toEqual({ accessToken: "access-token-2", expiresIn: 7200 });
    const cookies = res.headers["set-cookie"];
    expect(cookies!.some((c) => /gpo_refresh=refresh-token-2/.test(c))).toBe(true);
  });

  it("POST /api/auth/refresh with no cookie returns 401", async () => {
    await createSupertestAgent().post("/api/auth/refresh").expect(401).expect({ error: "No refresh session" });
  });

  it("GET /api/auth/me with valid token returns user profile", async () => {
    sb.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "u@example.com" } },
      error: null,
    });

    sb.from.mockImplementation(() => {
      const chain = createTableChain();
      chain.maybeSingle.mockResolvedValue({
        data: { id: "user-1", email: "u@example.com", display_name: "U" },
        error: null,
      });
      return chain;
    });

    await createSupertestAgent()
      .get("/api/auth/me")
      .set("Authorization", "Bearer valid.jwt")
      .expect(200)
      .expect({ id: "user-1", email: "u@example.com", displayName: "U" });
  });

  it("GET /api/auth/me with no token returns 401", async () => {
    await createSupertestAgent().get("/api/auth/me").expect(401).expect({ error: "Unauthorized" });
  });

  it("GET /api/auth/me with invalid token returns 401", async () => {
    sb.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid JWT" },
    });

    await createSupertestAgent()
      .get("/api/auth/me")
      .set("Authorization", "Bearer bad")
      .expect(401)
      .expect({ error: "Unauthorized" });
  });

  it("POST /api/auth/logout clears the cookie", async () => {
    sb.auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1", email: "u@example.com" } },
      error: null,
    });
    sb.auth.admin.signOut.mockResolvedValue({ error: null });

    const res = await createSupertestAgent()
      .post("/api/auth/logout")
      .set("Authorization", "Bearer valid.jwt")
      .expect(204);

    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    expect(cookies!.some((c) => /gpo_refresh=/.test(c))).toBe(true);
  });

  it("rate limiter returns 429 after 10 rapid auth requests", async () => {
    const googleUrl = "https://accounts.google.com/o/oauth2/v2/auth?x=1";
    sb.auth.signInWithOAuth.mockResolvedValue({
      data: { url: googleUrl, provider: "google" },
      error: null,
    });

    const app = createTestApp();
    for (let i = 0; i < 10; i++) {
      await request(app).get("/api/auth/google").expect(302);
    }
    await request(app).get("/api/auth/google").expect(429).expect((res) => {
      expect(res.body).toEqual({ error: "Too many requests" });
    });
  });
});
