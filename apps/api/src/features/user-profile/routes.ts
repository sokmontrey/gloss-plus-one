import { Router } from "express";
import { z } from "zod";
import type { UserProfileRepository } from "@gloss-plus-one/shared/types/user-profile";
import { ProfileNotFoundError } from "../../repositories/user-profile.js";

export type UserProfileRoutesProps = {
    userProfileRepository: UserProfileRepository;
};

const nullableString = z.union([z.string(), z.null()]);

const updateUserProfileBodySchema = z
    .object({
        email: z.string().email().optional(),
        name: nullableString.optional(),
        avatarUrl: nullableString.optional(),
        targetLanguage: nullableString.optional(),
        proficiencyLevel: z.number().int().optional(),
        onboardingComplete: z.boolean().optional(),
    })
    .strict();

type UpdateUserProfileBody = z.infer<typeof updateUserProfileBodySchema>;

export function createUserProfileRoutes({
    userProfileRepository,
}: UserProfileRoutesProps): Router {
    const router = Router();

    router.get("/", async (req, res, next) => {
        try {
            const user = req.user;
            if (!user) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const profile = await userProfileRepository.getProfile(user.id);
            if (!profile) {
                res.status(404).json({ error: "Profile not found" });
                return;
            }

            res.json(profile);
        } catch (err) {
            next(err);
        }
    });

    router.put("/", async (req, res, next) => {
        try {
            const user = req.user;
            if (!user) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const parsed = updateUserProfileBodySchema.safeParse(req.body ?? {});
            if (!parsed.success) {
                res.status(400).json({
                    error: "Invalid request body",
                    details: parsed.error.flatten(),
                });
                return;
            }

            const patch: UpdateUserProfileBody = parsed.data;

            const existing = await userProfileRepository.getProfile(user.id);

            if (existing) {
                if (Object.keys(patch).length === 0) {
                    res.json(existing);
                    return;
                }

                try {
                    const updated = await userProfileRepository.updateProfile(
                        user.id,
                        patch,
                    );
                    res.json(updated);
                } catch (err) {
                    if (err instanceof ProfileNotFoundError) {
                        res.status(404).json({ error: err.message });
                        return;
                    }
                    throw err;
                }
                return;
            }

            if (!user.email) {
                res.status(400).json({ error: "Authenticated user has no email" });
                return;
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

            res.status(201).json(created);
        } catch (err) {
            next(err);
        }
    });

    router.delete("/", async (req, res, next) => {
        try {
            const user = req.user;
            if (!user) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            await userProfileRepository.deleteProfile(user.id);
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    });

    return router;
}
