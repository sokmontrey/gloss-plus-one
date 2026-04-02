import type { UserProfileService } from "./service.js";

/** Builds an RLS-scoped profile service for one Supabase access JWT. */
export type UserProfileServiceForAccessToken = (accessToken: string) => UserProfileService;
