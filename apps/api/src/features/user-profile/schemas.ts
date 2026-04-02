import { z } from "zod";

const nullableString = z.union([z.string(), z.null()]);

/** HTTP layer: validates JSON body; parsed output matches domain `UpdateUserProfile` shape. */
export const updateProfileBodySchema = z
    .object({
        email: z.string().email().optional(),
        name: nullableString.optional(),
        avatarUrl: nullableString.optional(),
        targetLanguage: nullableString.optional(),
        proficiencyLevel: z.number().int().optional(),
        onboardingComplete: z.boolean().optional(),
    })
    .strict();

export type UpdateProfileBodyDto = z.infer<typeof updateProfileBodySchema>;
