import { vi } from 'vitest'
import { createAuthenticator } from '../utils/authenticator.ts'

// happy-dom has no WebAuthn, so `vi.mock()` replaces `@simplewebauthn/browser`
// with a software authenticator, which answers the prompts like a browser with
// a passkey on the admin's origin:
export function createWebAuthnMock() {
  let authenticator = null
  const getAuthenticator = () =>
    (authenticator ??= createAuthenticator({
      origin: location.origin,
      rpId: 'localhost'
    }))
  return {
    startRegistration: vi.fn(async ({ optionsJSON }) =>
      getAuthenticator().register(optionsJSON)
    ),
    startAuthentication: vi.fn(async ({ optionsJSON }) =>
      getAuthenticator().authenticate(optionsJSON)
    )
  }
}
