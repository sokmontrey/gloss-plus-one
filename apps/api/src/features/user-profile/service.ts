import type { AuthUser } from "@gloss-plus-one/shared/adapters/auth";
import type {
    CreateUserProfile,
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

export type UserProfileServiceDeps = {
    userProfileRepository: UserProfileRepository;
};

function createPayloadFromAuthUser(user: AuthUser): CreateUserProfile {
    return {
        userId: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        targetLanguage: undefined,
        proficiencyLevel: 0,
        onboardingComplete: false,
    };
}

export function createUserProfileService({
    userProfileRepository,
}: UserProfileServiceDeps) {
    return {
        async getProfile(userId: string): Promise<UserProfile | null> {
            return userProfileRepository.getProfile(userId);
        },

        /**
         * Idempotent: creates a row after OAuth if missing. Safe on every login.
         */
        async ensureProfileAfterSignIn(user: AuthUser): Promise<UserProfile> {
            const existing = await userProfileRepository.getProfile(user.id);
            if (existing) return existing;

            if (!user.email?.trim()) {
                throw new MissingUserEmailError();
            }

            try {
                return await userProfileRepository.createProfile(createPayloadFromAuthUser(user));
            } catch (err) {
                const retry = await userProfileRepository.getProfile(user.id);
                if (retry) return retry;
                throw err;
            }
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

            if (!user.email?.trim()) {
                throw new MissingUserEmailError();
            }

            const base = createPayloadFromAuthUser(user);
            const created = await userProfileRepository.createProfile({
                ...base,
                email: patch.email ?? base.email,
                name: "name" in patch ? patch.name ?? undefined : base.name,
                avatarUrl:
                    "avatarUrl" in patch ? patch.avatarUrl ?? undefined : base.avatarUrl,
                targetLanguage:
                    "targetLanguage" in patch
                        ? patch.targetLanguage ?? undefined
                        : base.targetLanguage,
                proficiencyLevel: patch.proficiencyLevel ?? base.proficiencyLevel,
                onboardingComplete: patch.onboardingComplete ?? base.onboardingComplete,
            });

            return { outcome: "created", profile: created };
        },

        async deleteProfile(userId: string): Promise<void> {
            await userProfileRepository.deleteProfile(userId);
        },
    };
}

export type UserProfileService = ReturnType<typeof createUserProfileService>;
