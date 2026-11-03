import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse
} from '@simplewebauthn/server'
import aaguids from 'aaguids'
import type { Context } from 'hono'
import { authError, authenticationTimeout } from './authentication.ts'
import type { Credential, Credentials } from './credentials.ts'
import { getSession } from './sessions.ts'
import type { User, UserSource } from './types.ts'

// Passkeys are discoverable WebAuthn credentials of type `passkey`, with the
// credential id as `key`, named after their provider. The challenges are kept
// in the session of the request, and each can be used once.

export interface PasskeysOptions {
  // The name that the browser shows, such as the app's name.
  rpName: string
  // The domain that the passkeys belong to. By default, the request's host.
  domain?: string
  // The origins of the pages that may use the passkeys. By default, the
  // request's origin, so an admin on another host sets them.
  origins?: string[]
}

export function passkeys({ rpName, domain, origins }: PasskeysOptions) {
  const getDomain = (c: Context) => domain ?? new URL(c.req.url).hostname

  const getExpectations = (c: Context) => ({
    expectedRPID: getDomain(c),
    expectedOrigin: origins ?? new URL(c.req.url).origin
  })

  return {
    async createAuthenticationOptions(c: Context) {
      // Passkeys are discoverable, so the browser offers them without a
      // username.
      const options = await generateAuthenticationOptions({
        rpID: getDomain(c),
        userVerification: 'required'
      })
      storeChallenge(c, 'authentication', options)
      return options
    },

    // Verifies the response of `startAuthentication()` against the challenge
    // in the session, and updates the counter of the passkey. The challenge
    // is consumed also without a credential.
    async verifyAuthentication(
      c: Context,
      credentials: Credentials,
      credential: Credential | null,
      response: any
    ) {
      const challenge = consumeChallenge(c, 'authentication')
      if (!credential) throw authError('Passkey is incorrect')
      const { verified, authenticationInfo } = await Promise.try(() =>
        verifyAuthenticationResponse({
          response,
          expectedChallenge: challenge,
          ...getExpectations(c),
          credential: {
            id: credential.key!,
            publicKey: Buffer.from(credential.data.publicKey, 'base64url'),
            counter: credential.data.counter,
            transports: credential.data.transports
          }
        })
      ).catch(() => ({ verified: false, authenticationInfo: null }))
      if (!verified) throw authError('Passkey is incorrect')
      await credentials.update(credential.id, {
        data: { ...credential.data, counter: authenticationInfo!.newCounter },
        lastUsedAt: new Date()
      })
    },

    async createRegistrationOptions(
      c: Context,
      username: string,
      existing: Credential[]
    ) {
      const options = await generateRegistrationOptions({
        rpName,
        rpID: getDomain(c),
        userName: username,
        // The same authenticator isn't registered twice.
        excludeCredentials: existing.map(({ key, data }) => ({
          id: key!,
          transports: data.transports
        })),
        authenticatorSelection: {
          residentKey: 'required',
          userVerification: 'required'
        }
      })
      storeChallenge(c, 'registration', options)
      return options
    },

    // Verifies the response of `startRegistration()` against the challenge in
    // the session, and stores its passkey as a credential of the user.
    async verifyRegistration(
      c: Context,
      credentials: Credentials,
      source: UserSource<any>,
      user: User,
      response: any
    ) {
      const challenge = consumeChallenge(c, 'registration')
      const { verified, registrationInfo } = await Promise.try(() =>
        verifyRegistrationResponse({
          response,
          expectedChallenge: challenge,
          ...getExpectations(c)
        })
      ).catch(error => {
        // Failed verifications are bad requests, not server errors.
        throw authError(error.message, 400)
      })
      if (!verified || !registrationInfo) {
        throw authError('Passkey is incorrect', 400)
      }
      const { credential, aaguid } = registrationInfo
      return credentials.insert(source, user, 'passkey', {
        key: credential.id,
        // Anonymous providers send an all-zero AAGUID, which isn't listed.
        name: aaguids[aaguid] ?? 'Passkey',
        data: {
          publicKey: Buffer.from(credential.publicKey).toString('base64url'),
          counter: credential.counter,
          transports: credential.transports
        }
      })
    }
  }
}

// Registrations and authentications keep their challenges apart, so
// confirming the access with a passkey doesn't end a pending registration.
function storeChallenge(
  c: Context,
  type: string,
  { challenge }: { challenge: string }
) {
  getSession(c).value[`${type}Challenge`] = {
    challenge,
    expires: Date.now() + authenticationTimeout
  }
}

function consumeChallenge(c: Context, type: string) {
  const session = getSession(c).value
  const key = `${type}Challenge`
  const { challenge, expires } = session[key] ?? {}
  delete session[key]
  if (challenge && expires > Date.now()) return challenge as string
  throw authError('Missing or expired passkey challenge', 400)
}
