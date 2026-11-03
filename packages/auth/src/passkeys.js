import { Service } from './Service.js'
import { AuthenticationError } from '../errors/index.js'
import {
  authenticationTimeout,
  insertCredential
} from '../utils/authentication.js'
import { importPeer } from '../utils/module.js'

export class PasskeyService extends Service {
  #webAuthn
  #aaguids

  // @override
  async initialize() {
    if (!this.app.config.app.name) {
      throw new Error(`Invalid passkeys, missing 'app.name'.`)
    }
    const [webAuthn, aaguids] = await Promise.all([
      importPeer(this, '@simplewebauthn/server'),
      importPeer(this, 'aaguids')
    ])
    this.#webAuthn = webAuthn
    this.#aaguids = aaguids.default
  }

  async createAuthenticationOptions(ctx) {
    // Passkeys are discoverable, so the browser offers them without a
    // username:
    const options = await this.#webAuthn.generateAuthenticationOptions({
      rpID: this.#getDomain(ctx),
      userVerification: 'required'
    })
    storeChallenge(ctx, 'authentication', options)
    return options
  }

  // Verify the response of `startAuthentication()` against the challenge in
  // the session, and update the `credential` of its passkey:
  async verifyAuthentication(ctx, credential, response) {
    const challenge = consumeChallenge(ctx, 'authentication')
    const { verified, authenticationInfo } = credential
      ? await Promise.try(() =>
          this.#webAuthn.verifyAuthenticationResponse({
            response,
            expectedChallenge: challenge,
            ...this.#getExpectations(ctx, response),
            credential: {
              id: credential.key,
              publicKey: Buffer.from(credential.data.publicKey, 'base64url'),
              counter: credential.data.counter,
              transports: credential.data.transports
            }
          })
        ).catch(err => {
          // Don't tell clients why, but keep the reason for the logs:
          throw new AuthenticationError({
            message: 'Passkey is incorrect',
            cause: err
          })
        })
      : { verified: false }
    if (verified) {
      await credential.$patch(
        {
          data: {
            ...credential.data,
            counter: authenticationInfo.newCounter
          },
          lastUsedAt: new Date()
        },
        ctx.transaction
      )
    } else {
      throw new AuthenticationError('Passkey is incorrect')
    }
  }

  async createRegistrationOptions(ctx, user, credentials) {
    const { usernameProperty } = user.constructor.definition.options
    const options = await this.#webAuthn.generateRegistrationOptions({
      rpName: this.app.config.app.name,
      rpID: this.#getDomain(ctx),
      userName: user[usernameProperty],
      // Don't register the same authenticator twice:
      excludeCredentials: credentials.map(({ key, data }) => ({
        id: key,
        transports: data.transports
      })),
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required'
      }
    })
    storeChallenge(ctx, 'registration', options)
    return options
  }

  // Verify the response of `startRegistration()` against the challenge in the
  // session, and store its passkey as a credential of the user:
  async verifyRegistration(ctx, user, response) {
    const challenge = consumeChallenge(ctx, 'registration')
    const { verified, registrationInfo } = await Promise.try(() =>
      this.#webAuthn.verifyRegistrationResponse({
        response,
        expectedChallenge: challenge,
        ...this.#getExpectations(ctx, response)
      })
    ).catch(err => {
      // Failed verifications are bad requests, not server errors:
      throw new AuthenticationError({ message: err.message, status: 400 })
    })
    if (verified) {
      const { credential, aaguid } = registrationInfo
      return insertCredential(
        user,
        'passkey',
        {
          key: credential.id,
          // Name passkeys after their providers, e.g. '1Password'. Anonymous
          // providers send an all-zero AAGUID, which isn't listed:
          name: this.#aaguids[aaguid] ?? 'Passkey',
          data: {
            publicKey: Buffer.from(credential.publicKey).toString('base64url'),
            counter: credential.counter,
            transports: credential.transports
          }
        },
        ctx.transaction
      )
    } else {
      throw new AuthenticationError({
        message: 'Passkey is incorrect',
        status: 400
      })
    }
  }

  // Passkeys belong to `domain`, by default the one of the request:
  #getDomain(ctx) {
    return this.config.domain ?? ctx.hostname
  }

  #getExpectations(ctx, response) {
    const domain = this.#getDomain(ctx)
    return {
      expectedRPID: domain,
      expectedOrigin: this.config.origins ?? getDomainOrigin(response, domain)
    }
  }
}

// Without `origins`, the pages of the domain and its subdomains may use its
// passkeys, like WebAuthn allows, over https or on localhost. Other origins
// fail the verification, which names the domain:
function getDomainOrigin(response, domain) {
  const { origin } = JSON.parse(
    Buffer.from(response.response.clientDataJSON, 'base64url')
  )
  const { protocol, hostname } = new URL(origin)
  const isAllowed = (
    (protocol === 'https:' || hostname === 'localhost') &&
    (hostname === domain || hostname.endsWith(`.${domain}`))
  )
  return isAllowed ? origin : `https://${domain}`
}

// Registrations and authentications keep their challenges apart: confirming
// the access with a passkey doesn't end a pending registration:
function storeChallenge(ctx, type, { challenge }) {
  ctx.session[`${type}Challenge`] = {
    challenge,
    expires: Date.now() + authenticationTimeout
  }
}

// Each challenge can only be answered once, before it expires:
function consumeChallenge(ctx, type) {
  const key = `${type}Challenge`
  const { challenge, expires } = ctx.session[key] ?? {}
  delete ctx.session[key]
  if (challenge && expires > Date.now()) {
    return challenge
  } else {
    throw new AuthenticationError({
      message: 'Missing or expired passkey challenge',
      status: 400
    })
  }
}
