import { useEffect, useState } from 'react'
import type { Session, SupabaseClient, User } from '@supabase/supabase-js'
import { clearLocalAuthSession } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'
import { isOrphanAuthProfileError, loadUserProfileWithEnsure, type UserProfile } from '@/lib/user-profile'

export type AuthState = {
  session: Session | null
  user: User | null
  profile: UserProfile | null
  loading: boolean
  profileError: string | null
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    session: null,
    user: null,
    profile: null,
    loading: true,
    profileError: null,
  })

  useEffect(() => {
    const client = getSupabase()
    if (!client) {
      setState({
        session: null,
        user: null,
        profile: null,
        loading: false,
        profileError: null,
      })
      return
    }

    let cancelled = false

    async function applySession(supa: SupabaseClient, session: Session | null) {
      if (!session?.user) {
        if (!cancelled) {
          setState({
            session: null,
            user: null,
            profile: null,
            loading: false,
            profileError: null,
          })
        }
        return
      }

      if (!cancelled) {
        setState((s) => ({
          ...s,
          session,
          user: session.user,
          loading: true,
          profileError: null,
        }))
      }

      try {
        const profile = await loadUserProfileWithEnsure(supa, session)
        if (!cancelled) {
          setState({
            session,
            user: session.user,
            profile,
            loading: false,
            profileError: null,
          })
        }
      } catch (err) {
        if (isOrphanAuthProfileError(err)) {
          console.warn('[gloss+1] profile ensure failed — auth user missing; clearing stale session')
          await clearLocalAuthSession()
          if (!cancelled) {
            setState({
              session: null,
              user: null,
              profile: null,
              loading: false,
              profileError: null,
            })
          }
          return
        }

        console.error('[gloss+1] user_profiles load failed:', err)
        const message = err instanceof Error ? err.message : 'Could not load profile'
        if (!cancelled) {
          setState({
            session,
            user: session.user,
            profile: null,
            loading: false,
            profileError: message,
          })
        }
      }
    }

    void client.auth.getSession().then(({ data: { session } }) => applySession(client, session))

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      void applySession(client, session)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return state
}
