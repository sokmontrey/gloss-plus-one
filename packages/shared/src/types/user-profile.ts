export interface UserProfile {
    userId: string
    email: string
    name?: string
    avatarUrl?: string
    targetLanguage?: string
    proficiencyLevel: number
    onboardingComplete: boolean
    createdAt: string
    updatedAt: string
}

export interface CreateUserProfile {
    /** Auth subject id (e.g. Supabase `auth.users.id`) */
    userId: string
    email: string
    name?: string
    avatarUrl?: string
    targetLanguage?: string
    proficiencyLevel: number
    onboardingComplete: boolean
}

export interface UpdateUserProfile {
    email?: string
    name?: string | null
    avatarUrl?: string | null
    targetLanguage?: string | null
    proficiencyLevel?: number
    onboardingComplete?: boolean
}

export interface UserProfileRepository {
    getProfile(userId: string): Promise<UserProfile | null>
    createProfile(profile: CreateUserProfile): Promise<UserProfile>
    updateProfile(userId: string, patch: UpdateUserProfile): Promise<UserProfile>
    deleteProfile(userId: string): Promise<void>
}