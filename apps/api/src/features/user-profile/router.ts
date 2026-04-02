import { Router } from "express";
import { ProfileNotFoundError } from "./repository.js";
import { MissingUserEmailError } from "./service.js";
import { updateProfileBodySchema } from "./schemas.js";
import type { UserProfileServiceForAccessToken } from "./service-factory.js";

export type UserProfileRouterDeps = {
    userProfileServiceForAccessToken: UserProfileServiceForAccessToken;
};

export function createUserProfileRouter({
    userProfileServiceForAccessToken,
}: UserProfileRouterDeps): Router {
    const router = Router();

    router.get("/", async (req, res, next) => {
        try {
            const user = req.user;
            const accessToken = req.authAccessToken;
            if (!user || !accessToken) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const userProfileService = userProfileServiceForAccessToken(accessToken);
            const profile = await userProfileService.getProfile(user.id);
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
            const accessToken = req.authAccessToken;
            if (!user || !accessToken) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const userProfileService = userProfileServiceForAccessToken(accessToken);
            const parsed = updateProfileBodySchema.safeParse(req.body ?? {});
            if (!parsed.success) {
                res.status(400).json({
                    error: "Invalid request body",
                    details: parsed.error.flatten(),
                });
                return;
            }

            const patch = parsed.data;

            try {
                const result = await userProfileService.putProfile(user, patch);
                if (result.outcome === "created") {
                    res.status(201).json(result.profile);
                    return;
                }
                res.json(result.profile);
            } catch (err) {
                if (err instanceof MissingUserEmailError) {
                    res.status(400).json({ error: err.message });
                    return;
                }
                if (err instanceof ProfileNotFoundError) {
                    res.status(404).json({ error: err.message });
                    return;
                }
                throw err;
            }
        } catch (err) {
            next(err);
        }
    });

    router.delete("/", async (req, res, next) => {
        try {
            const user = req.user;
            const accessToken = req.authAccessToken;
            if (!user || !accessToken) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            const userProfileService = userProfileServiceForAccessToken(accessToken);
            await userProfileService.deleteProfile(user.id);
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    });

    return router;
}
