export interface SessionData {
  userId: string
  email: string

  provider: 'supabase'
  providerSessionId?: string

  accessToken: string
  refreshToken: string
  expiresAt: number // unix seconds

  createdAt: number // unix seconds
  updatedAt: number // unix seconds
}

export interface SessionStore {
  create(data: SessionData): Promise<string>
  get(sid: string): Promise<SessionData | null>
  update(sid: string, patch: Partial<SessionData>): Promise<void>
  delete(sid: string): Promise<void>
}

