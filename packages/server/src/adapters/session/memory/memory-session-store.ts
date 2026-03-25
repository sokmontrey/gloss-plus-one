import crypto from 'node:crypto'

import type { SessionData, SessionStore } from '../../../core/contracts/index.js'

export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, SessionData>()

  async create(data: SessionData): Promise<string> {
    const sid = crypto.randomUUID()
    this.sessions.set(sid, data)
    return sid
  }

  async get(sid: string): Promise<SessionData | null> {
    return this.sessions.get(sid) ?? null
  }

  async update(sid: string, patch: Partial<SessionData>): Promise<void> {
    const current = this.sessions.get(sid)
    if (!current) return
    this.sessions.set(sid, { ...current, ...patch, updatedAt: Math.floor(Date.now() / 1000) })
  }

  async delete(sid: string): Promise<void> {
    this.sessions.delete(sid)
  }
}
