import { useEffect, useState } from 'react'
import { getSupabase } from './lib/supabase'

type AppProps = { variant?: 'popup' | 'content' }

export default function App({ variant = 'popup' }: AppProps) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const sb = getSupabase()
    setReady(Boolean(sb))
  }, [])

  return (
    <div className={`app app--${variant}`}>
      <h1>Gloss+1</h1>
      {variant === 'content' ? (
        <p className="hint">Content script mount (dev placeholder)</p>
      ) : null}
      <p className="status">
        Supabase:{' '}
        {ready ? (
          <span className="ok">client configured</span>
        ) : (
          <span className="warn">set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY</span>
        )}
      </p>
    </div>
  )
}
