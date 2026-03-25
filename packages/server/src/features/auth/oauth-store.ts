import { createCodeChallenge, createCodeVerifier, createState } from './oauth.js'

export type OAuthTransaction = {
  state: string
  codeVerifier: string
  codeChallenge: string
  returnTo?: string
  createdAt: number
}

export class OAuthTransactionStore {
  private readonly store = new Map<string, OAuthTransaction>()

  constructor(private readonly ttlSeconds: number) {}

  create(returnTo?: string): OAuthTransaction {
    const tx: OAuthTransaction = {
      state: createState(),
      codeVerifier: createCodeVerifier(),
      codeChallenge: '',
      returnTo,
      createdAt: Math.floor(Date.now() / 1000),
    }
    tx.codeChallenge = createCodeChallenge(tx.codeVerifier)
    this.store.set(tx.state, tx)
    return tx
  }

  consume(state: string): OAuthTransaction | null {
    const tx = this.store.get(state)
    if (!tx) return null

    this.store.delete(state)
    const now = Math.floor(Date.now() / 1000)
    if (now - tx.createdAt > this.ttlSeconds) return null
    return tx
  }
}
