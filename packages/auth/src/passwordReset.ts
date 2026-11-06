import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Context } from 'hono'
import { parseDuration } from '@ditojs/utils'
import {
  getUserIdentifier,
  type User,
  type UserSource
} from './users.ts'

// Stateless password reset links, signed with HMAC-SHA256.

export interface CreatePasswordResetOptions {
  secrets: string[]
  // In milliseconds or as a duration such as `'24h'`, one hour by default.
  expiresAfter?: number | string
  // The time before a user gets another link, as `expiresAfter`, one minute by
  // default. Requests in between respond the same way, but send nothing.
  resendAfter?: number | string
  // The link, with a `{token}` placeholder.
  confirmUrl: string
  // Sends the email. The response doesn't wait for it, so its failures don't
  // change the response, and go to `onError`.
  send(context: { c: Context; user: any; url: string }): unknown
  onError?(context: { error: unknown; c: Context }): void
}

export type PasswordReset = ReturnType<typeof createPasswordReset>

export function createPasswordReset({
  secrets,
  confirmUrl,
  send,
  onError,
  ...options
}: CreatePasswordResetOptions) {
  const expiresAfter = parseDuration(options.expiresAfter ?? '1h')
  const resendAfter = parseDuration(options.resendAfter ?? '1m')
  if (!confirmUrl.includes('{token}')) {
    throw new Error(`Invalid password reset, 'confirmUrl' needs '{token}'.`)
  }
  if (secrets.length === 0) {
    throw new Error('Unable to sign tokens without secrets.')
  }
  // The time of the last link by user, per process.
  const sentAtByUser = new Map<string, number>()

  const sign = (data: string, secret: string) =>
    createHmac('sha256', secret).update(data).digest('base64url')

  // The token holds the user's id and its creation time. The first secret
  // signs, and all of them verify, so secrets can rotate.
  function createToken(source: UserSource<any>, user: User, time: number) {
    const id = Buffer.from(`${user.id}`).toString('base64url')
    const signature = sign(getSignedValues(source, user, time), secrets[0])
    return `${id}.${time.toString(36)}.${signature}`
  }

  return {
    sendLink(c: Context, source: UserSource<any>, user: User) {
      const now = Date.now()
      const identifier = getUserIdentifier(source, user)
      // Forget the users whose `resendAfter` ended, so the map stays small:
      for (const [key, time] of sentAtByUser) {
        if (now - time >= resendAfter) sentAtByUser.delete(key)
      }
      if (!sentAtByUser.has(identifier)) {
        sentAtByUser.set(identifier, now)
        const token = createToken(source, user, now)
        const url = confirmUrl.replace('{token}', token)
        Promise.try(() => send({ c, user, url })).catch(error =>
          onError?.({ error, c })
        )
      }
    },

    // Resolve to null for tokens that expired or that no secret signed.
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
      const values = getSignedValues(source, user, time)
      const isSigned = secrets.some(secret =>
        isTimingSafeEqual(signature, sign(values, secret))
      )
      return isSigned ? user : null
    }
  }
}

// Sign the user's hash, last login and username too, so that a login, a
// password change or a username change ends the link, including the change
// that the link itself makes. Dates count as ISO strings.
function getSignedValues(source: UserSource<any>, user: User, time: number) {
  return JSON.stringify([
    getUserIdentifier(source, user),
    time,
    user.hash ?? null,
    user.lastLogin ?? null,
    user.username ?? null
  ])
}

function isTimingSafeEqual(a: string, b: string) {
  const bufferA = Buffer.from(a)
  const bufferB = Buffer.from(b)
  return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB)
}
