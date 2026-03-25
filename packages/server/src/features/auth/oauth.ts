import { createHash, randomBytes } from 'node:crypto'

function base64url(input: Buffer): string {
  return input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

export function createState(size = 32): string {
  return base64url(randomBytes(size))
}

export function createCodeVerifier(size = 64): string {
  return base64url(randomBytes(size))
}

export function createCodeChallenge(codeVerifier: string): string {
  const digest = createHash('sha256').update(codeVerifier).digest()
  return base64url(digest)
}

