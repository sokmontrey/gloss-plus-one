import { useEffect, useState } from 'react'
import { Badge } from '@/components/badge'
import { Button } from '@/components/ui/button'
import { getSupabase } from './lib/supabase'

type AppProps = { variant?: 'popup' | 'content' }

export default function App({ variant = 'popup' }: AppProps) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const sb = getSupabase()
    setReady(Boolean(sb))
  }, [])

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
        <Badge variant="secondary" size="sm">
          Beta
        </Badge>
      </div>

      {variant === 'content' ? (
        <p className="text-muted-foreground text-xs leading-relaxed">
          Content script mount (dev placeholder)
        </p>
      ) : null}

      <p className="text-sm">
        <span className="text-muted-foreground">Supabase: </span>
        {ready ? (
          <Badge variant="green" className="align-middle">
            client configured
          </Badge>
        ) : (
          <Badge variant="amber" className="align-middle">
            set env keys
          </Badge>
        )}
      </p>

      {variant === 'popup' ? (
        <Button type="button" variant="outline" size="sm" className="w-full">
          Open settings (soon)
        </Button>
      ) : null}
    </div>
  )
}
