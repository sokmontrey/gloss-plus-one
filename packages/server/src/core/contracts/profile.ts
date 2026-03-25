export interface Profile {
  id: string
  authUserId: string
  email: string
  createdAt?: string
  updatedAt?: string
}

export interface ProfileRepository {
  upsertFromAuthUser(params: { authUserId: string; email: string }): Promise<Profile>
  findByAuthUserId(authUserId: string): Promise<Profile | null>
}

