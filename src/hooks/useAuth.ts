import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabase'

type AuthState = { session: Session | null; user: User | null; loading: boolean }

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ session: null, user: null, loading: true })

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) {
      setState({ session: null, user: null, loading: false })
      return
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({ session, user: session?.user ?? null, loading: false })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, user: session?.user ?? null, loading: false })
    })

    return () => subscription.unsubscribe()
  }, [])

  return state
}
