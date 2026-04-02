import type { AuthUser } from "@gloss-plus-one/shared/adapters/auth";
import type {
    UpdateUserProfile,
    UserProfile,
    UserProfileRepository,
} from "@gloss-plus-one/shared/types/user-profile";

export class MissingUserEmailError extends Error {
    override readonly name = "MissingUserEmailError";

    constructor() {
        super("Authenticated user has no email");
    }
}

export type PutUserProfileResult =
    | { outcome: "created"; profile: UserProfile }
    | { outcome: "updated"; profile: UserProfile }
    | { outcome: "unchanged"; profile: UserProfile };

export type UserProfileServiceProps = {
    userProfileRepository: UserProfileRepository;
};

export function createUserProfileService({
    userProfileRepository,
}: UserProfileServiceProps) {
    return {
        async getProfile(userId: string): Promise<UserProfile | null> {
            return userProfileRepository.getProfile(userId);
        },

        async putProfile(
            user: AuthUser,
            patch: UpdateUserProfile,
        ): Promise<PutUserProfileResult> {
            const existing = await userProfileRepository.getProfile(user.id);

            if (existing) {
                if (Object.keys(patch).length === 0) {
                    return { outcome: "unchanged", profile: existing };
                }

                const updated = await userProfileRepository.updateProfile(
                    user.id,
                    patch,
                );
                return { outcome: "updated", profile: updated };
            }

            if (!user.email) {
                throw new MissingUserEmailError();
            }

            const created = await userProfileRepository.createProfile({
                userId: user.id,
                email: patch.email ?? user.email,
                name: "name" in patch ? patch.name ?? undefined : user.name,
                avatarUrl:
                    "avatarUrl" in patch ? patch.avatarUrl ?? undefined : user.avatarUrl,
                targetLanguage:
                    "targetLanguage" in patch
                        ? patch.targetLanguage ?? undefined
                        : undefined,
                proficiencyLevel: patch.proficiencyLevel ?? 0,
                onboardingComplete: patch.onboardingComplete ?? false,
            });

            return { outcome: "created", profile: created };
        },

        async deleteProfile(userId: string): Promise<void> {
            await userProfileRepository.deleteProfile(userId);
        },
    };
}

export type UserProfileService = ReturnType<typeof createUserProfileService>;
