import type { SupabaseClient } from "@supabase/supabase-js";
import type {
    CreateUserProfile,
    UpdateUserProfile,
    UserProfile,
    UserProfileRepository,
} from "@gloss-plus-one/shared/types/user-profile";
import type { Database } from "../../database.types.js";

type UserProfileRow = Database["public"]["Tables"]["user_profiles"]["Row"];

function mapRow(row: UserProfileRow): UserProfile {
    return {
        userId: row.user_id,
        email: row.email,
        name: row.name ?? undefined,
        avatarUrl: row.avatar_url ?? undefined,
        targetLanguage: row.target_language ?? undefined,
        proficiencyLevel: row.proficiency_level,
        onboardingComplete: row.onboarding_complete,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

export class ProfileNotFoundError extends Error {
    override readonly name = "ProfileNotFoundError";

    constructor(cause?: unknown) {
        super("Profile not found", { cause });
    }
}

export type ProfileRepositoryDeps = {
    supabaseClient: SupabaseClient<Database>;
};

export function createUserProfileRepository({
    supabaseClient,
}: ProfileRepositoryDeps): UserProfileRepository {
    return {
        async getProfile(userId: string): Promise<UserProfile | null> {
            const { data, error } = await supabaseClient
                .from("user_profiles")
                .select("*")
                .eq("user_id", userId)
                .maybeSingle();

            if (error) {
                throw new Error("Failed to load user profile", { cause: error });
            }

            if (!data) return null;
            return mapRow(data);
        },

        async createProfile(profile: CreateUserProfile): Promise<UserProfile> {
            const row: Database["public"]["Tables"]["user_profiles"]["Insert"] = {
                user_id: profile.userId,
                email: profile.email,
                name: profile.name ?? null,
                avatar_url: profile.avatarUrl ?? null,
                target_language: profile.targetLanguage ?? null,
                proficiency_level: profile.proficiencyLevel,
                onboarding_complete: profile.onboardingComplete,
            };

            const { data, error } = await supabaseClient
                .from("user_profiles")
                .insert(row)
                .select("*")
                .single();

            if (error) {
                throw new Error("Failed to create user profile", { cause: error });
            }

            return mapRow(data);
        },

        async updateProfile(userId: string, patch: UpdateUserProfile): Promise<UserProfile> {
            const row: Database["public"]["Tables"]["user_profiles"]["Update"] = {
                updated_at: new Date().toISOString(),
            };

            if (patch.email !== undefined) {
                row.email = patch.email;
            }
            if (patch.name !== undefined) {
                row.name = patch.name;
            }
            if (patch.avatarUrl !== undefined) {
                row.avatar_url = patch.avatarUrl;
            }
            if (patch.targetLanguage !== undefined) {
                row.target_language = patch.targetLanguage;
            }
            if (patch.proficiencyLevel !== undefined) {
                row.proficiency_level = patch.proficiencyLevel;
            }
            if (patch.onboardingComplete !== undefined) {
                row.onboarding_complete = patch.onboardingComplete;
            }

            const { data, error } = await supabaseClient
                .from("user_profiles")
                .update(row)
                .eq("user_id", userId)
                .select("*")
                .single();

            if (error) {
                if (error.code === "PGRST116") {
                    throw new ProfileNotFoundError(error);
                }
                throw new Error("Failed to update user profile", { cause: error });
            }

            return mapRow(data);
        },

        async deleteProfile(userId: string): Promise<void> {
            const { error } = await supabaseClient
                .from("user_profiles")
                .delete()
                .eq("user_id", userId);

            if (error) {
                throw new Error("Failed to delete user profile", { cause: error });
            }
        },
    };
}
