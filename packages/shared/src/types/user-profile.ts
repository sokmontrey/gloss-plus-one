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