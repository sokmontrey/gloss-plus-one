import { Badge } from '@/components/badge'
import { ExtractionToggle } from '@/components/ExtractionToggle'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/spinner'
import { GoogleSignInButton } from '@/components/GoogleSignInButton'
import { useAuth } from '@/hooks/useAuth'
import { signOut } from '@/lib/auth'
import { getSupabase } from '@/lib/supabase'

type AppProps = { variant?: 'popup' | 'content' }

export default function App({ variant = 'popup' }: AppProps) {
  const { user, profile, loading, profileError } = useAuth()
  const configured = Boolean(getSupabase())
  const displayName =
    profile?.name?.trim()
    || (typeof user?.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : null)
    || (typeof user?.user_metadata?.name === 'string' ? user.user_metadata.name : null)
    || user?.email

  return (
    <div
      className={
        variant === 'content'
          ? 'w-[220px] rounded-xl border border-border bg-card p-4 text-card-foreground shadow-md'
          : 'min-w-[280px] space-y-3 p-4'
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="font-heading text-base font-semibold tracking-tight">Gloss+1</h1>
        <Badge variant="secondary" size="sm">Beta</Badge>
      </div>

      {!configured ? (
        <p className="text-xs text-muted-foreground">
          Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to continue.
        </p>
      ) : loading ? (
        <div className="flex justify-center py-1">
          <Spinner size="sm" className="text-muted-foreground" />
        </div>
      ) : variant === 'popup' && (
        user ? (
          <div className="space-y-3">
            <div className="space-y-0.5">
              {displayName && (
                <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
              )}
              <p className="truncate text-xs text-muted-foreground">{profile?.email ?? user.email}</p>
            </div>
            {profileError && (
              <p className="text-xs text-destructive">{profileError}</p>
            )}
            <ExtractionToggle />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => signOut()}
            >
              Sign out
            </Button>
          </div>
        ) : (
          <GoogleSignInButton />
        )
      )}
    </div>
  )
}
