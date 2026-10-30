import type { Credential, Credentials } from './credentials.ts'
import { authError } from './errors.ts'
import { authenticationTimeout } from './identifiers.ts'
import { lazyPeer } from './peers.ts'
import type { AnyContext, SessionValue, UserSource } from './types.ts'

// Passkeys as Dito 6's `PasskeyService` keeps them: discoverable WebAuthn
// credentials of type `passkey`, with the credential id as `key`, named after
// their provider. The challenges are kept in the session and answered once.

export interface PasskeysOptions {
  // The name that the browser shows, such as the app's name.
  rpName: string
  // The domain that the passkeys belong to. By default, the request's host.
  domain?: string
  // The origins that may use the passkeys. By default, the domain and its
  // subdomains over https, and localhost.
  origins?: string[]
}

export type Passkeys = ReturnType<typeof passkeys>

type WebAuthn = typeof import('@simplewebauthn/server')

export function passkeys({ rpName, domain, origins }: PasskeysOptions) {
  const webAuthn = lazyPeer<WebAuthn>('@simplewebauthn/server', 'passkeys')
  const aaguids = lazyPeer<{ default: Record<string, string> }>(
    'aaguids',
    'passkeys'
  )

  const getDomain = (c: AnyContext) => domain ?? new URL(c.req.url).hostname

  const getExpectations = (c: AnyContext, response: any) => {
    const expectedRPID = getDomain(c)
    return {
      expectedRPID,
      expectedOrigin: origins ?? getDomainOrigin(response, expectedRPID)
    }
  }

  return {
    async createAuthenticationOptions(c: AnyContext, session: SessionValue) {
      // Passkeys are discoverable, so the browser offers them without a
      // username.
      const options = await (
        await webAuthn()
      ).generateAuthenticationOptions({
        rpID: getDomain(c),
        userVerification: 'required'
      })
      storeChallenge(session, 'authentication', options)
      return options
    },

    // Verifies the response of `startAuthentication()` against the challenge
    // in the session, and updates the counter of the passkey. The challenge
    // is consumed also without a credential.
    async verifyAuthentication(
      c: AnyContext,
      session: SessionValue,
      credentials: Credentials,
      credential: Credential | null,
      response: any
    ) {
      const challenge = consumeChallenge(session, 'authentication')
      if (!credential) throw authError('Passkey is incorrect')
      const { verifyAuthenticationResponse } = await webAuthn()
      const { verified, authenticationInfo } = await Promise.try(() =>
        verifyAuthenticationResponse({
          response,
          expectedChallenge: challenge,
          ...getExpectations(c, response),
          credential: {
            id: credential.key!,
            publicKey: Buffer.from(credential.data.publicKey, 'base64url'),
            counter: credential.data.counter,
            transports: credential.data.transports
          }
        })
      ).catch(() => ({ verified: false, authenticationInfo: null }))
      if (!verified) throw authError('Passkey is incorrect')
      await credentials.update(c, credential.id, {
        data: { ...credential.data, counter: authenticationInfo!.newCounter },
        lastUsedAt: new Date()
      })
    },

    async createRegistrationOptions(
      c: AnyContext,
      session: SessionValue,
      username: string,
      existing: Credential[]
    ) {
      const options = await (
        await webAuthn()
      ).generateRegistrationOptions({
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
      storeChallenge(session, 'registration', options)
      return options
    },

    // Verifies the response of `startRegistration()` against the challenge in
    // the session, and stores its passkey as a credential of the user.
    async verifyRegistration(
      c: AnyContext,
      session: SessionValue,
      credentials: Credentials,
      source: UserSource,
      user: unknown,
      response: any
    ) {
      const challenge = consumeChallenge(session, 'registration')
      const { verifyRegistrationResponse } = await webAuthn()
      const { verified, registrationInfo } = await Promise.try(() =>
        verifyRegistrationResponse({
          response,
          expectedChallenge: challenge,
          ...getExpectations(c, response)
        })
      ).catch(error => {
        // Failed verifications are bad requests, not server errors.
        throw authError(error.message, 400)
      })
      if (!verified || !registrationInfo) {
        throw authError('Passkey is incorrect', 400)
      }
      const { credential, aaguid } = registrationInfo
      const names = (await aaguids()).default
      return credentials.insert(c, source, user, 'passkey', {
        key: credential.id,
        // Anonymous providers send an all-zero AAGUID, which isn't listed.
        name: names[aaguid] ?? 'Passkey',
        data: {
          publicKey: Buffer.from(credential.publicKey).toString('base64url'),
          counter: credential.counter,
          transports: credential.transports
        }
      })
    }
  }
}

// Without `origins`, the pages of the domain and its subdomains may use its
// passkeys, as WebAuthn allows, over https or on localhost. Other origins fail
// the verification, which names the domain.
function getDomainOrigin(response: any, domain: string) {
  try {
    const { origin } = JSON.parse(
      Buffer.from(response.response.clientDataJSON, 'base64url').toString()
    )
    const { protocol, hostname } = new URL(origin)
    const isAllowed = (
      (protocol === 'https:' || hostname === 'localhost') &&
      (hostname === domain || hostname.endsWith(`.${domain}`))
    )
    if (isAllowed) return origin as string
  } catch {
    // Malformed responses fail the verification.
  }
  return `https://${domain}`
}

// Registrations and authentications keep their challenges apart, so
// confirming the access with a passkey doesn't end a pending registration.
function storeChallenge(
  session: SessionValue,
  type: string,
  { challenge }: { challenge: string }
) {
  session[`${type}Challenge`] = {
    challenge,
    expires: Date.now() + authenticationTimeout
  }
}

function consumeChallenge(session: SessionValue, type: string) {
  const key = `${type}Challenge`
  const { challenge, expires } = session[key] ?? {}
  delete session[key]
  if (challenge && expires > Date.now()) return challenge as string
  throw authError('Missing or expired passkey challenge', 400)
}
