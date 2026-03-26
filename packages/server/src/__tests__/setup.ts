import type { MockSupabaseAdmin } from "./helpers-core.js";
import { setSupabaseAdminMock } from "./helpers-core.js";
import { vi } from "vitest";

const mockSupabaseAdmin = vi.hoisted((): MockSupabaseAdmin => {
  const createTableChain = () => {
    const chain = {
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
  };

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
});

vi.mock("../config/supabase.js", () => ({
  supabaseAdmin: mockSupabaseAdmin,
  createUserClient: vi.fn(),
}));

setSupabaseAdminMock(mockSupabaseAdmin);
