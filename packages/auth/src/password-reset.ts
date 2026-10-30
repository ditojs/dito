import { createKeygrip } from './cookies.ts'
import { getUserIdentifier } from './identifiers.ts'
import type { AnyContext, UserSource } from './types.ts'

// Stateless password reset links, as Dito 6 signs them: the token holds the
// user's id and its creation time, with a Keygrip signature over these and the
// user's hash, last login and username. A login, a password change or a
// username change ends the link. The keys are the app's cookie keys, signed
// with SHA-256, and rotate as the cookies do.

export interface PasswordResetOptions {
  keys: string[]
  // In milliseconds, one hour by default.
  expiresAfter?: number
  // The link, with a `{token}` placeholder.
  confirmUrl: string
  // Sends the email. It runs after the answer, so its failures don't change
  // the answer, and go to `onError`.
  send(c: AnyContext, user: any, url: string): unknown
  onError?(c: AnyContext, error: unknown): void
}

export type PasswordReset = ReturnType<typeof passwordReset>

export function passwordReset({
  keys,
  expiresAfter = 60 * 60 * 1000,
  confirmUrl,
  send,
  onError
}: PasswordResetOptions) {
  if (!confirmUrl.includes('{token}')) {
    throw new Error(`Invalid password reset, 'confirmUrl' needs '{token}'.`)
  }
  const keygrip = createKeygrip(keys, 'sha256')

  function createToken(source: UserSource, user: unknown, time = Date.now()) {
    const id = Buffer.from(`${source.describe(user).id}`).toString('base64url')
    const signature = keygrip.sign(getData(source, user, time))
    return `${id}.${time.toString(36)}.${signature}`
  }

  return {
    createToken,

    // Sends the link without waiting for it.
    request(c: AnyContext, source: UserSource, user: unknown) {
      const url = confirmUrl.replace('{token}', createToken(source, user))
      Promise.try(() => send(c, user, url)).catch(error => onError?.(c, error))
    },

    // The user of a token that hasn't expired and is signed with one of the
    // keys, or null.
    async findUser<U>(
      c: AnyContext,
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
      return user && keygrip.verify(getData(source, user, time), signature)
        ? user
        : null
    }
  }
}

// Dates count as ISO strings, missing values as null.
function getData(source: UserSource, user: unknown, time: number) {
  const { hash, lastLogin, username } = source.describe(user)
  return JSON.stringify([
    getUserIdentifier(source, user),
    time,
    hash ?? null,
    lastLogin ?? null,
    username ?? null
  ])
}
