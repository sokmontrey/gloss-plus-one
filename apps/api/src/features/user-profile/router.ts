import { Router } from "express";
import { ProfileNotFoundError } from "../../repositories/profile.js";
import {
    type UserProfileService,
    MissingUserEmailError,
} from "./service.js";
import { updateProfileBodySchema } from "./schemas.js";

export type UserProfileRouterDeps = {
    userProfileService: UserProfileService;
};

export function createUserProfileRouter({
    userProfileService,
}: UserProfileRouterDeps): Router {
    const router = Router();

    router.get("/", async (req, res, next) => {
        try {
            const user = req.user;
            if (!user) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

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
            if (!user) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

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
            if (!user) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }

            await userProfileService.deleteProfile(user.id);
            res.status(204).send();
        } catch (err) {
            next(err);
        }
    });

    return router;
}
