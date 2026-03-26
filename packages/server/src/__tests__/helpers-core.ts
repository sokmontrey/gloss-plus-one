import { vi } from "vitest";

export type MockTableChain = {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
};

export type MockSupabaseAdmin = {
  auth: {
    getUser: ReturnType<typeof vi.fn>;
    signInWithOAuth: ReturnType<typeof vi.fn>;
    exchangeCodeForSession: ReturnType<typeof vi.fn>;
    refreshSession: ReturnType<typeof vi.fn>;
    admin: { signOut: ReturnType<typeof vi.fn> };
  };
  from: ReturnType<typeof vi.fn>;
};

export function createTableChain(): MockTableChain {
  const chain: MockTableChain = {
    select: vi.fn(),
    update: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    single: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.maybeSingle.mockResolvedValue({ data: null, error: null });
  chain.single.mockResolvedValue({ data: null, error: null });
  return chain;
}

export function createMockSupabaseAdmin(): MockSupabaseAdmin {
  return {
    auth: {
      getUser: vi.fn(),
      signInWithOAuth: vi.fn(),
      exchangeCodeForSession: vi.fn(),
      refreshSession: vi.fn(),
      admin: { signOut: vi.fn() },
    },
    from: vi.fn(() => createTableChain()),
  };
}

const MOCK_KEY = "__gpoSupabaseAdminMock__" as const;

export function setSupabaseAdminMock(m: MockSupabaseAdmin) {
  (globalThis as Record<string, MockSupabaseAdmin | undefined>)[MOCK_KEY] = m;
}

export function getMockSupabaseAdmin(): MockSupabaseAdmin {
  const m = (globalThis as Record<string, MockSupabaseAdmin | undefined>)[MOCK_KEY];
  if (!m) throw new Error("Supabase admin mock not initialized (load setup.ts first)");
  return m;
}
