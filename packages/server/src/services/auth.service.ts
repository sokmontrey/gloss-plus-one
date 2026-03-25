import type {
  AuthTokens,
  AuthUser,
  AuthUserProfileUpdates,
  IAuthService,
} from "@gpo/shared";
import { supabaseAdmin } from "../config/supabase.js";

function sessionToTokens(session: {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
}): AuthTokens {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresIn: session.expires_in ?? 3600,
  };
}

function rowToUser(row: { id: string; email: string; display_name: string | null }): AuthUser {
  return { id: row.id, email: row.email, displayName: row.display_name };
}

export class AuthService implements IAuthService {
  async getOAuthUrl(redirectTo: string): Promise<string> {
    const { data, error } = await supabaseAdmin.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data.url) throw new Error(error?.message ?? "OAuth URL unavailable");
    return data.url;
  }

  async exchangeCode(code: string) {
    const { data, error } = await supabaseAdmin.auth.exchangeCodeForSession(code);
    if (error || !data.session) throw new Error(error?.message ?? "Exchange failed");
    const tokens = sessionToTokens(data.session);
    const user = await this.getUserProfile(data.session.user.id);
    if (!user) throw new Error("User profile missing");
    return { tokens, user };
  }

  async refreshSession(refreshToken: string): Promise<AuthTokens> {
    const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) throw new Error(error?.message ?? "Refresh failed");
    return sessionToTokens(data.session);
  }

  async verifyToken(accessToken: string) {
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !data.user?.email) return null;
    return { id: data.user.id, email: data.user.email };
  }

  async getUserProfile(userId: string): Promise<AuthUser | null> {
    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, email, display_name")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) return null;
    return rowToUser(data as { id: string; email: string; display_name: string | null });
  }

  async updateUserProfile(userId: string, updates: AuthUserProfileUpdates): Promise<AuthUser> {
    const row: { display_name?: string | null } = {};
    if (updates.displayName !== undefined) row.display_name = updates.displayName;
    if (Object.keys(row).length === 0) {
      const existing = await this.getUserProfile(userId);
      if (!existing) throw new Error("User not found");
      return existing;
    }
    const { data, error } = await supabaseAdmin
      .from("users")
      .update(row)
      .eq("id", userId)
      .select("id, email, display_name")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Update failed");
    return rowToUser(data as { id: string; email: string; display_name: string | null });
  }

  async revokeAllSessions(accessToken: string): Promise<void> {
    const { error } = await supabaseAdmin.auth.admin.signOut(accessToken, "global");
    if (error) throw new Error(error.message);
  }
}

export const authService = new AuthService();
