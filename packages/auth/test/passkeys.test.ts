import type { Kysely } from 'kysely'
import * as webAuthn from '@simplewebauthn/server'
import { passkeys } from '../src/index.ts'
import {
  createClient,
  createDatabase,
  createSource,
  createUser,
  setup,
  type TestUser
} from './helpers.ts'

// A real authenticator can't answer in tests, so the verifications are mocked
// at the boundary of `@simplewebauthn/server`. The options are real.
vi.mock('@simplewebauthn/server', async original => ({
  ...(await original<typeof import('@simplewebauthn/server')>()),
  verifyRegistrationResponse: vi.fn(),
  verifyAuthenticationResponse: vi.fn()
}))

const verifyRegistration = vi.mocked(webAuthn.verifyRegistrationResponse)
const verifyAuthentication = vi.mocked(webAuthn.verifyAuthenticationResponse)

// 1Password's AAGUID, which `aaguids` names.
const aaguid = 'bada5566-a7aa-401f-bd96-45619a55120d'

let db: Kysely<any>
let ada: TestUser
let bob: TestUser
let client: ReturnType<typeof createClient>

const clientData = (origin: string) =>
  Buffer.from(JSON.stringify({ origin })).toString('base64url')

const answer = (id: string, origin = 'https://example.com') => ({
  id,
  rawId: id,
  type: 'public-key',
  response: { clientDataJSON: clientData(origin) }
})

beforeEach(async () => {
  verifyRegistration.mockReset()
  verifyAuthentication.mockReset()
  db = await createDatabase()
  ada = await createUser(1, 'ada', 'secret')
  bob = await createUser(2, 'bob', 'secret')
  const { app } = setup({
    db,
    source: createSource('Admin', [ada, bob]),
    features: { passkeys: passkeys({ rpName: 'Dito' }) }
  })
  client = createClient(app)
})

async function register(id: string) {
  const options = (await client.post('/admins/passkey-options')).data
  verifyRegistration.mockResolvedValueOnce({
    verified: true,
    registrationInfo: {
      aaguid,
      credential: {
        id,
        publicKey: new Uint8Array([1, 2, 3]),
        counter: 0,
        transports: ['internal']
      }
    }
  } as any)
  const response = await client.post('/admins/passkeys', answer(id))
  return { options, response }
}

describe('passkeys()', () => {
  it('registers passkeys', async () => {
    await client.post('/admins/login', { username: 'ada', password: 'secret' })
    const { options, response } = await register('key-1')
    expect(options).toMatchObject({
      rp: { name: 'Dito', id: 'example.com' },
      user: { name: 'ada' },
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required'
      }
    })
    expect(verifyRegistration).toHaveBeenCalledWith({
      response: answer('key-1'),
      expectedChallenge: options.challenge,
      expectedRPID: 'example.com',
      expectedOrigin: 'https://example.com'
    })
    expect(response).toMatchObject({
      status: 200,
      data: { id: 1, name: '1Password', lastUsedAt: null }
    })
    // The challenge is answered once:
    expect(
      await client.post('/admins/passkeys', answer('key-1'))
    ).toMatchObject({
      status: 400,
      data: { message: 'Missing or expired passkey challenge' }
    })
    // The same authenticator isn't registered twice:
    const second = (await client.post('/admins/passkey-options')).data
    expect(second.excludeCredentials).toEqual([
      { id: 'key-1', type: 'public-key', transports: ['internal'] }
    ])
    const list = (await client.get('/admins/passkeys')).data
    expect(list).toEqual([
      {
        id: 1,
        name: '1Password',
        createdAt: expect.any(String),
        lastUsedAt: null
      }
    ])
    expect((await client.delete('/admins/passkeys/2')).status).toBe(404)
    expect((await client.delete('/admins/passkeys/1')).data).toEqual({
      success: true
    })
    expect((await client.get('/admins/passkeys')).data).toEqual([])
  })

  it('answers failed registrations with 400', async () => {
    await client.post('/admins/login', { username: 'ada', password: 'secret' })
    await client.post('/admins/passkey-options')
    verifyRegistration.mockRejectedValueOnce(new Error('Unexpected origin'))
    expect(
      await client.post('/admins/passkeys', answer('key-1', 'https://evil.com'))
    ).toMatchObject({ status: 400, data: { message: 'Unexpected origin' } })
    expect(verifyRegistration.mock.calls[0][0].expectedOrigin).toBe(
      'https://example.com'
    )
  })

  it('logs in with a passkey', async () => {
    await client.post('/admins/login', { username: 'ada', password: 'secret' })
    await register('key-1')
    await client.post('/admins/logout')
    const options = (await client.post('/admins/passkey-login-options')).data
    expect(options).toMatchObject({
      rpId: 'example.com',
      userVerification: 'required'
    })
    verifyAuthentication.mockResolvedValueOnce({
      verified: true,
      authenticationInfo: { newCounter: 5 }
    } as any)
    const response = await client.post('/admins/passkey-login', answer('key-1'))
    expect(response.data).toMatchObject({ success: true, user: { id: 1 } })
    expect(verifyAuthentication.mock.calls[0][0]).toMatchObject({
      expectedChallenge: options.challenge,
      credential: { id: 'key-1', counter: 0, transports: ['internal'] }
    })
    const row = await db
      .selectFrom('credential')
      .selectAll()
      .executeTakeFirstOrThrow()
    expect(JSON.parse(row.data).counter).toBe(5)
    expect(row.last_used_at).not.toBe(null)
  })

  it('rejects unknown and failing passkeys', async () => {
    await client.post('/admins/login', { username: 'ada', password: 'secret' })
    await register('key-1')
    await client.post('/admins/logout')
    await client.post('/admins/passkey-login-options')
    expect(
      await client.post('/admins/passkey-login', answer('unknown'))
    ).toMatchObject({
      status: 401,
      data: { success: false, error: 'Passkey is incorrect' }
    })
    // The unknown passkey used up the challenge:
    expect(
      (await client.post('/admins/passkey-login', answer('key-1'))).status
    ).toBe(400)
    await client.post('/admins/passkey-login-options')
    verifyAuthentication.mockRejectedValueOnce(new Error('Bad signature'))
    expect(
      await client.post('/admins/passkey-login', answer('key-1'))
    ).toMatchObject({ status: 401, data: { error: 'Passkey is incorrect' } })
    expect((await client.get('/admins/session')).data.authenticated).toBe(
      false
    )
  })

  it('confirms the access only with the own passkey', async () => {
    await client.post('/admins/login', { username: 'bob', password: 'secret' })
    await register('key-bob')
    await client.post('/admins/logout')
    await client.post('/admins/login', { username: 'ada', password: 'secret' })
    await client.post('/admins/passkey-login-options')
    verifyAuthentication.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 1 }
    } as any)
    expect(
      await client.post('/admins/confirm-access', {
        passkey: answer('key-bob')
      })
    ).toMatchObject({ status: 401, data: { message: 'Passkey is incorrect' } })
    await client.post('/admins/logout')
    await client.post('/admins/login', { username: 'bob', password: 'secret' })
    await client.post('/admins/passkey-login-options')
    expect(
      (
        await client.post('/admins/confirm-access', {
          passkey: answer('key-bob')
        })
      ).data
    ).toEqual({ success: true })
  })

  it('needs a login and confirmed access', async () => {
    expect((await client.get('/admins/passkeys')).status).toBe(401)
    expect((await client.post('/admins/passkey-options')).status).toBe(401)
  })
})
