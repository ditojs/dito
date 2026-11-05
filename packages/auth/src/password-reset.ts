import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Context } from 'hono'
import {
  getUserIdentifier,
  type User,
  type UserSource
} from './users.ts'

// Stateless password reset links: the token holds the user's id and its
// creation time, with an HMAC-SHA256 signature over these and the user's hash,
// last login and username. So a login, a password change or a username change
// ends the link, including the change that the link itself makes. The first
// secret signs, and all of them verify, so secrets can rotate.

export interface CreatePasswordResetOptions {
  secrets: string[]
  // In milliseconds, one hour by default.
  expiresAfter?: number
  // The time in milliseconds before a user gets another link, one minute by
  // default. Requests in between respond the same way, but send nothing.
  resendAfter?: number
  // The link, with a `{token}` placeholder.
  confirmUrl: string
  // Sends the email. The response doesn't wait for it, so its failures don't
  // change the response, and go to `onError`.
  send(c: Context, user: any, url: string): unknown
  onError?(c: Context, error: unknown): void
}

export type PasswordReset = ReturnType<typeof createPasswordReset>

export function createPasswordReset({
  secrets,
  expiresAfter = 60 * 60 * 1000,
  resendAfter = 60 * 1000,
  confirmUrl,
  send,
  onError
}: CreatePasswordResetOptions) {
  if (!confirmUrl.includes('{token}')) {
    throw new Error(`Invalid password reset, 'confirmUrl' needs '{token}'.`)
  }
  if (secrets.length === 0) {
    throw new Error('Unable to sign tokens without secrets.')
  }
  // The time of the last link by user, per process.
  const sentAt = new Map<string, number>()

  const sign = (data: string, secret: string) =>
    createHmac('sha256', secret).update(data).digest('base64url')

  function createToken(source: UserSource<any>, user: User, time: number) {
    const id = Buffer.from(`${user.id}`).toString('base64url')
    const signature = sign(getData(source, user, time), secrets[0])
    return `${id}.${time.toString(36)}.${signature}`
  }

  // Forgets the users whose `resendAfter` ended, so the map stays small.
  function isThrottled(identifier: string, now: number) {
    for (const [key, time] of sentAt) {
      if (now - time >= resendAfter) sentAt.delete(key)
    }
    if (sentAt.has(identifier)) return true
    sentAt.set(identifier, now)
    return false
  }

  return {
    // Sends the link without waiting for it.
    sendLink(c: Context, source: UserSource<any>, user: User) {
      const now = Date.now()
      if (isThrottled(getUserIdentifier(source, user), now)) return
      const url = confirmUrl.replace('{token}', createToken(source, user, now))
      Promise.try(() => send(c, user, url)).catch(error => onError?.(c, error))
    },

    // The user of a token that hasn't expired and is signed with one of the
    // secrets, or null.
    async findUser<U extends User>(
      c: Context,
      source: UserSource<U>,
      token: unknown
    ): Promise<U | null> {
      const match = String(token).match(/^([\w-]*)\.([\da-z]+)\.([\w-]+)$/)
      if (!match) return null
      const [, encodedId, encodedTime, signature] = match
      const time = parseInt(encodedTime, 36)
      if (!(Date.now() - time < expiresAfter)) return null
      const id = Buffer.from(encodedId, 'base64url').toString()
      const user = id ? await source.findById(c, id) : null
      if (!user) return null
      const data = getData(source, user, time)
      return secrets.some(secret => isEqual(signature, sign(data, secret)))
        ? user
        : null
    }
  }
}

// Dates count as ISO strings, missing values as null.
function getData(source: UserSource<any>, user: User, time: number) {
  return JSON.stringify([
    getUserIdentifier(source, user),
    time,
    user.hash ?? null,
    user.lastLogin ?? null,
    user.username ?? null
  ])
}

function isEqual(a: string, b: string) {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB)
}
