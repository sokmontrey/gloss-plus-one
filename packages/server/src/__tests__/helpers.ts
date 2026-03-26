import type { Express } from "express";
import request from "supertest";
import { buildApp } from "../app.js";
import {
  createTableChain,
  type MockSupabaseAdmin,
  getMockSupabaseAdmin,
} from "./helpers-core.js";

export type { MockSupabaseAdmin, MockTableChain } from "./helpers-core.js";
export { createMockSupabaseAdmin, createTableChain, getMockSupabaseAdmin } from "./helpers-core.js";

export function resetSupabaseMocks() {
  const m = getMockSupabaseAdmin();
  m.auth.getUser.mockReset();
  m.auth.signInWithOAuth.mockReset();
  m.auth.exchangeCodeForSession.mockReset();
  m.auth.refreshSession.mockReset();
  m.auth.admin.signOut.mockReset();
  m.from.mockReset();
  m.from.mockImplementation(() => createTableChain());
}

export function createTestApp(): Express {
  return buildApp();
}

export function createSupertestAgent() {
  return request(createTestApp());
}
