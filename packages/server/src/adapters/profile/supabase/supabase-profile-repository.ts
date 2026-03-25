import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { Profile, ProfileRepository } from '../../../core/contracts/index.js'
import type { RuntimeConfig } from '../../../core/config/config.js'

const TABLE = 'profiles'

type ProfileRow = {
  id: string
  auth_user_id: string
  email: string | null
  display_name?: string | null
  avatar_url?: string | null
  provider?: string | null
  updated_at?: string
  created_at?: string
}

function mapRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    email: row.email ?? '',
    updatedAt: row.updated_at,
    createdAt: row.created_at,
  }
}

export class SupabaseProfileRepository implements ProfileRepository {
  private readonly admin: SupabaseClient

  constructor(config: RuntimeConfig) {
    if (!config.supabase.serviceRoleKey) {
      throw new Error(
        'SUPABASE_SERVICE_ROLE_KEY is required for SupabaseProfileRepository (adapter can be swapped later)'
      )
    }

    this.admin = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }

  async findByAuthUserId(userId: string): Promise<Profile | null> {
    const { data, error } = await this.admin
      .from(TABLE)
      .select('id, auth_user_id, email, display_name, avatar_url, provider, created_at, updated_at')
      .eq('auth_user_id', userId)
      .maybeSingle<ProfileRow>()

    if (error) throw error
    if (!data) return null
    return mapRow(data)
  }

  async upsertFromAuthUser(params: { authUserId: string; email: string }): Promise<Profile> {
    const payload: ProfileRow = {
      id: params.authUserId,
      auth_user_id: params.authUserId,
      email: params.email,
    }

    const { data, error } = await this.admin
      .from(TABLE)
      .upsert(payload, { onConflict: 'auth_user_id' })
      .select('id, auth_user_id, email, display_name, avatar_url, provider, created_at, updated_at')
      .single<ProfileRow>()

    if (error) throw error
    return mapRow(data)
  }
}

