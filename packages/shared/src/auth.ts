export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
};

export type AuthUserProfileUpdates = Partial<Pick<AuthUser, "displayName">>;

export interface IAuthService {
  getOAuthUrl(redirectTo: string): Promise<string>;
  exchangeCode(code: string): Promise<{ tokens: AuthTokens; user: AuthUser }>;
  refreshSession(refreshToken: string): Promise<AuthTokens>;
  verifyToken(accessToken: string): Promise<Pick<AuthUser, "id" | "email"> | null>;
  getUserProfile(userId: string): Promise<AuthUser | null>;
  updateUserProfile(
    userId: string,
    updates: AuthUserProfileUpdates
  ): Promise<AuthUser>;
}
