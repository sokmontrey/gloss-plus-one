export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export type Database = {
    public: {
        Tables: {
            user_profiles: {
                Row: {
                    user_id: string;
                    email: string;
                    name: string | null;
                    avatar_url: string | null;
                    target_language: string | null;
                    proficiency_level: number;
                    onboarding_complete: boolean;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    user_id: string;
                    email: string;
                    name?: string | null;
                    avatar_url?: string | null;
                    target_language?: string | null;
                    proficiency_level: number;
                    onboarding_complete: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    email?: string;
                    name?: string | null;
                    avatar_url?: string | null;
                    target_language?: string | null;
                    proficiency_level?: number;
                    onboarding_complete?: boolean;
                    created_at?: string;
                    updated_at?: string;
                };
                Relationships: [];
            };
        };
        Views: Record<string, never>;
        Functions: Record<string, never>;
        Enums: Record<string, never>;
        CompositeTypes: Record<string, never>;
    };
};
