import { vi } from 'vitest'
import {
  Controller,
  CredentialModel,
  PasskeyService,
  SessionModel,
  TotpService,
  UserModel,
  UsersController
} from '@ditojs/server'
import { TOTP } from 'otpauth'
import { createTestApp, getAppUrl } from '../utils/app.js'
import { createAuthenticator } from '../utils/authenticator.js'
import { createClient } from '../utils/client.js'
import { createTestDatabase } from '../utils/database.js'

class Session extends SessionModel {}

class Credential extends CredentialModel {
  declare type: string
  declare data: Record<string, any>
}

class Member extends UserModel {
  declare id: number
}

// Users of another model, with their own confirmed access:
class Guest extends UserModel {
  declare id: number
}

class Guests extends UsersController {
  override modelClass = Guest
}

class Members extends UsersController {
  override modelClass = Member
  override member: any = {
    allow: ['patch', 'put']
  }
}

// Members that admins patch, also other members than themselves:
class Admins extends UsersController {
  override modelClass = Member
  override member: any = {
    allow: ['patch', 'put'],
    authorize: { patch: true, put: true }
  }
}

// Opens all its collection actions, which keeps the confirmation of the
// security changes:
class OpenMembers extends UsersController {
  override modelClass = Member
  override collection: any = { authorize: true }
}

// Log in another user without 'post login', as apps do to impersonate users:
class Impersonations extends Controller {
  override actions: any = {
    async 'post .'(ctx: any) {
      const { username } = ctx.request.body
      await ctx.login(await Member.query().findOne('username', username))
      return { success: true }
    }
  }
}

type Client = ReturnType<typeof createClient>

describe('Confirmed access', () => {
  const app = createTestApp({
    config: {
      app: {
        name: 'Example',
        normalizePaths: true,
        helmet: false,
        keys: ['test-secret'],
        session: { modelClass: 'Session' },
        authentication: {
          credentials: { modelClass: 'Credential' },
          reconfirmAccessAfter: '5m'
        }
      },
      services: {
        passkeys: { domain: 'example.com', origins: ['https://example.com'] },
        totp: { secret: 'totp-secret' }
      }
    },
    services: { passkeys: PasskeyService, totp: TotpService },
    models: { Session, Credential, Member, Guest },
    controllers: { Members, Guests, Admins, OpenMembers, Impersonations }
  })

  let url: string

  const post = (request: Client, path: string, body?: any) =>
    request(`/members/${path}`, { method: 'POST', body })

  const loginWithPassword = async (username = 'ada') => {
    const request = createClient(url)
    const login = await post(request, 'login', {
      username,
      password: 'secret'
    })
    return { request, login }
  }

  const createPasskeyAuthenticator = () =>
    createAuthenticator({ origin: 'https://example.com', rpId: 'example.com' })

  const registerPasskey = async (request: Client) => {
    const authenticator = createPasskeyAuthenticator()
    const options = await post(request, 'passkey-options')
    const passkey = await post(
      request,
      'passkeys',
      authenticator.register(options.data)
    )
    expect(passkey.status).toBe(200)
    return { authenticator, passkey: passkey.data }
  }

  // Set up TOTP for ada, and return the TOTP of her authenticator app:
  const setupTotp = async (request: Client) => {
    const setup = await post(request, 'totp')
    const totp = new TOTP({ secret: setup.data.secret })
    const confirm = await post(request, 'totp-confirm', {
      code: totp.generate()
    })
    expect(confirm.status).toBe(200)
    return { totp, backupCodes: confirm.data.backupCodes }
  }

  // The setup used the current code, so we use the next one, which is accepted
  // for clocks that drift:
  const getNextCode = (totp: TOTP) =>
    totp.generate({ timestamp: Date.now() + totp.period * 1000 })

  // Move the clock past the confirmed access, which only fakes `Date`, also
  // for the app:
  const expireAccess = () => {
    vi.setSystemTime(Date.now() + 5 * 60 * 1000 + 1)
  }

  // Request each security change, which all answer 200 within the confirmed
  // access, except for the empty registration and the wrong code:
  const requestChanges = async (request: Client, passkeyId = 0) => [
    await post(request, 'passkey-options'),
    await post(request, 'passkeys', {}),
    await request(`/members/passkeys/${passkeyId}`, { method: 'DELETE' }),
    await post(request, 'totp'),
    await post(request, 'totp-confirm', { code: 'wrong' }),
    await request('/members/totp', { method: 'DELETE' }),
    await post(request, 'password', { password: 'secret' }),
    await request('/members/self', {
      method: 'PATCH',
      body: { password: 'secret' }
    })
  ]

  const expectConfirmedAccess = async (request: Client) => {
    expect((await post(request, 'passkey-options')).status).toBe(200)
  }

  beforeAll(async () => {
    await createTestDatabase(app, Session, Member, Guest, Credential)
    for (const name of ['Member', 'Guest']) {
      await app.knex.schema.alterTable(name, table => {
        table.dropColumn('password')
      })
    }
    await app.start()
    url = getAppUrl(app)
    await Member.query().insert({
      username: 'ada',
      password: 'secret'
    } as any)
    await Guest.query().insert({
      username: 'gil',
      password: 'secret'
    } as any)
  })

  afterAll(async () => {
    await app.stop()
    await app.knex.destroy()
  })

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
  })

  afterEach(async () => {
    vi.useRealTimers()
    await app.knex('Session').del()
    await app.knex('Credential').del()
  })

  it('allows security changes right after logging in', async () => {
    const { request } = await loginWithPassword()
    const { passkey } = await registerPasskey(request)
    const responses = await requestChanges(request, passkey.id)
    expect(responses.map(({ status }) => status)).toEqual([
      200, 400, 200, 200, 401, 200, 200, 200
    ])
  })

  it('asks to confirm the access for security changes later', async () => {
    const { request } = await loginWithPassword()
    const { passkey } = await registerPasskey(request)
    expireAccess()
    for (const response of await requestChanges(request, passkey.id)) {
      expect(response.status).toBe(403)
      expect(response.data).toEqual({
        message: 'Confirmation required',
        confirmationRequired: true
      })
    }
    // Reading the passkeys and the TOTP needs no confirmation:
    expect((await request('/members/passkeys')).status).toBe(200)
    expect((await request('/members/totp')).status).toBe(200)
    expect(await Credential.query().where('type', 'passkey')).toHaveLength(1)
  })

  it('denies security changes without a login', async () => {
    const request = createClient(url)
    for (const response of [
      ...(await requestChanges(request)),
      await post(request, 'confirm-access', { password: 'secret' })
    ]) {
      expect(response.status).toBe(401)
    }
  })

  it('checks the login also with an open `authorize`', async () => {
    const request = createClient(url)
    for (const response of [
      await request('/open-members/confirm-access', {
        method: 'POST',
        body: { password: 'secret' }
      }),
      await request('/open-members/passkeys'),
      await request('/open-members/totp')
    ]) {
      expect(response.status).toBe(401)
    }
  })

  it('checks the confirmed access also with an open `authorize`', async () => {
    const requestOpenChanges = async (request: Client) => {
      const statuses = []
      for (const [method, path] of [
        ['POST', 'password'],
        ['POST', 'passkey-options'],
        ['POST', 'passkeys'],
        ['DELETE', 'passkeys/0'],
        ['POST', 'totp'],
        ['POST', 'totp-confirm'],
        ['DELETE', 'totp']
      ]) {
        const response = await request(`/open-members/${path}`, {
          method,
          body: { password: 'changed', code: 'wrong' }
        })
        statuses.push(response.status)
      }
      return statuses
    }
    expect(await requestOpenChanges(createClient(url))).toEqual(
      Array(7).fill(401)
    )
    const { request } = await loginWithPassword()
    expireAccess()
    expect(await requestOpenChanges(request)).toEqual(Array(7).fill(403))
    expect(await Member.query().findOne('username', 'ada')).toBeDefined()
  })

  it('denies security changes to users of other models', async () => {
    const request = createClient(url)
    await request('/guests/login', {
      method: 'POST',
      body: { username: 'gil', password: 'secret' }
    })
    // The guest's own access is confirmed:
    const options = await request('/guests/passkey-options', { method: 'POST' })
    expect(options.status).toBe(200)
    const { id } = (await Member.query().findOne('username', 'ada'))!
    for (const response of [
      ...(await requestChanges(request)),
      await request(`/admins/${id}`, {
        method: 'PATCH',
        body: { password: 'changed' }
      }),
      await request(`/admins/${id}`, {
        method: 'PUT',
        body: { username: 'ada', password: 'changed' }
      })
    ]) {
      expect(response.status).toBe(401)
    }
  })

  it('confirms the access with the password', async () => {
    const { request } = await loginWithPassword()
    expireAccess()
    const confirm = await post(request, 'confirm-access', {
      password: 'secret'
    })
    expect(confirm.status).toBe(200)
    expect(confirm.data).toEqual({ success: true })
    await expectConfirmedAccess(request)
    // ...until it expires again:
    expireAccess()
    expect((await post(request, 'passkey-options')).status).toBe(403)
  })

  it('rejects wrong or missing passwords', async () => {
    const { request } = await loginWithPassword()
    expireAccess()
    for (const body of [{ password: 'wrong' }, {}]) {
      const confirm = await post(request, 'confirm-access', body)
      expect(confirm.status).toBe(401)
      expect(confirm.data).toEqual({ message: 'Password is incorrect' })
    }
    expect((await post(request, 'passkey-options')).status).toBe(403)
  })

  describe('with TOTP', () => {
    const loginWithTotp = async () => {
      const { request } = await loginWithPassword()
      const { totp, backupCodes } = await setupTotp(request)
      expireAccess()
      return { request, totp, backupCodes }
    }

    const getFailures = async () => (
      (await Credential.query().findOne({ type: 'totp' }))!.data.failures ?? 0
    )

    it('asks for the code after the password', async () => {
      const { request, totp } = await loginWithTotp()
      const password = await post(request, 'confirm-access', {
        password: 'secret'
      })
      expect(password.status).toBe(200)
      expect(password.data).toEqual({ success: false, codeRequired: true })
      expect((await post(request, 'passkey-options')).status).toBe(403)
      const code = await post(request, 'confirm-access', {
        password: 'secret',
        code: getNextCode(totp)
      })
      expect(code.data).toEqual({ success: true })
      await expectConfirmedAccess(request)
    })

    it('confirms the access with a backup code', async () => {
      const { request, backupCodes } = await loginWithTotp()
      const confirm = await post(request, 'confirm-access', {
        password: 'secret',
        code: backupCodes[0]
      })
      expect(confirm.data).toEqual({ success: true })
      await expectConfirmedAccess(request)
    })

    it('counts wrong codes, but not wrong passwords', async () => {
      const { request, totp } = await loginWithTotp()
      const wrongPassword = await post(request, 'confirm-access', {
        password: 'wrong',
        code: 'wrong'
      })
      expect(wrongPassword.data.message).toBe('Password is incorrect')
      expect(await getFailures()).toBe(0)
      const confirm = (code: string) =>
        post(request, 'confirm-access', { password: 'secret', code })
      for (let i = 1; i < 10; i++) {
        const wrong = await confirm('wrong')
        expect(wrong.status).toBe(401)
        expect(wrong.data.message).toBe('Code is incorrect')
      }
      expect(await getFailures()).toBe(9)
      const last = await confirm('wrong')
      expect(last.status).toBe(400)
      expect(last.data.message).toBe('Too many attempts')
      const right = await confirm(getNextCode(totp))
      expect(right.data.message).toBe('Too many attempts')
      expect((await post(request, 'passkey-options')).status).toBe(403)
    })

    it(`doesn't let sessions guess codes by turning off TOTP`, async () => {
      const { request, totp } = await loginWithTotp()
      for (let i = 0; i < 10; i++) {
        const remove = await request('/members/totp', {
          method: 'DELETE',
          body: { code: 'wrong' }
        })
        expect(remove.status).toBe(403)
      }
      expect(await getFailures()).toBe(0)
      expect(await Credential.query().where('type', 'totp')).toHaveLength(1)
      const confirm = await post(request, 'confirm-access', {
        password: 'secret',
        code: getNextCode(totp)
      })
      expect(confirm.data).toEqual({ success: true })
    })

    it('confirms the access with logins with the code', async () => {
      const { totp } = await loginWithTotp()
      const { request, login } = await loginWithPassword()
      expect(login.data.codeRequired).toBe(true)
      const code = await post(request, 'login-code', {
        code: getNextCode(totp)
      })
      expect(code.data.success).toBe(true)
      await expectConfirmedAccess(request)
    })
  })

  describe('with passkeys', () => {
    const confirmWithPasskey = async (
      request: Client,
      authenticator: ReturnType<typeof createAuthenticator>
    ) => {
      const options = await post(request, 'passkey-login-options')
      return post(request, 'confirm-access', {
        passkey: authenticator.authenticate(options.data)
      })
    }

    it('confirms the access with a passkey, also of users with TOTP', async () => {
      const { request } = await loginWithPassword()
      const { authenticator } = await registerPasskey(request)
      await setupTotp(request)
      expireAccess()
      const confirm = await confirmWithPasskey(request, authenticator)
      expect(confirm.status).toBe(200)
      expect(confirm.data).toEqual({ success: true })
      await expectConfirmedAccess(request)
    })

    it('rejects the passkeys of other users and unknown ones', async () => {
      const other = await Member.query().insert({
        username: 'bo',
        password: 'secret'
      } as any)
      try {
        const { request: otherRequest } = await loginWithPassword('bo')
        const { authenticator } = await registerPasskey(otherRequest)
        const { request } = await loginWithPassword()
        expireAccess()
        for (const passkeyAuthenticator of [
          authenticator,
          createPasskeyAuthenticator()
        ]) {
          const confirm = await confirmWithPasskey(
            request,
            passkeyAuthenticator
          )
          expect(confirm.status).toBe(401)
          expect(confirm.data).toEqual({ message: 'Passkey is incorrect' })
        }
        expect((await post(request, 'passkey-options')).status).toBe(403)
      } finally {
        await Member.query().deleteById(other.id)
      }
    })

    it('keeps pending registrations when confirming the access', async () => {
      const { request } = await loginWithPassword()
      const { authenticator } = await registerPasskey(request)
      const other = createPasskeyAuthenticator()
      const options = await post(request, 'passkey-options')
      expect((await confirmWithPasskey(request, authenticator)).status).toBe(
        200
      )
      const passkey = await post(
        request,
        'passkeys',
        other.register(options.data)
      )
      expect(passkey.status).toBe(200)
    })

    it('confirms the access with passkey logins', async () => {
      const { request } = await loginWithPassword()
      const { authenticator } = await registerPasskey(request)
      expireAccess()
      const client = createClient(url)
      const options = await post(client, 'passkey-login-options')
      const login = await post(
        client,
        'passkey-login',
        authenticator.authenticate(options.data)
      )
      expect(login.data.success).toBe(true)
      await expectConfirmedAccess(client)
    })
  })

  describe('username changes', () => {
    const patchSelf = (request: Client, body: Record<string, unknown>) =>
      request('/members/self', { method: 'PATCH', body })

    afterEach(async () => {
      await Member.query().where('username', 'eve').patch({ username: 'ada' })
    })

    it('need confirmed access', async () => {
      const { request } = await loginWithPassword()
      expireAccess()
      for (const response of [
        await patchSelf(request, { username: 'eve' }),
        await request('/members/self', {
          method: 'PUT',
          body: { username: 'eve' }
        })
      ]) {
        expect(response.status).toBe(403)
        expect(response.data.confirmationRequired).toBe(true)
      }
      expect(await Member.query().findOne('username', 'ada')).toBeDefined()
      await post(request, 'confirm-access', { password: 'secret' })
      const patch = await patchSelf(request, { username: 'eve' })
      expect(patch.status).toBe(200)
      expect(patch.data.username).toBe('eve')
    })

    it(`don't include unchanged usernames`, async () => {
      const { request } = await loginWithPassword()
      expireAccess()
      expect((await patchSelf(request, { username: 'ada' })).status).toBe(200)
    })
  })

  describe('password changes', () => {
    const isPassword = async (username: string, password: string) =>
      (await Member.query().findOne('username', username))!.$verifyPassword(
        password
      )

    afterEach(async () => {
      await Member.query().patch({ password: 'secret' } as any)
    })

    it('need confirmed access', async () => {
      const { request } = await loginWithPassword()
      expireAccess()
      for (const method of ['PATCH', 'PUT']) {
        const response = await request('/members/self', {
          method,
          body: { username: 'ada', password: 'changed' }
        })
        expect(response.status).toBe(403)
        expect(response.data.confirmationRequired).toBe(true)
      }
      expect(await isPassword('ada', 'secret')).toBe(true)
      await post(request, 'confirm-access', { password: 'secret' })
      const patch = await request('/members/self', {
        method: 'PATCH',
        body: { password: 'changed' }
      })
      expect(patch.status).toBe(200)
      expect(await isPassword('ada', 'changed')).toBe(true)
      // The session of the request stays logged in:
      expect((await post(request, 'passkey-options')).status).toBe(200)
    })

    it('let admins set the passwords of other users', async () => {
      const other = await Member.query().insert({
        username: 'bo',
        password: 'secret'
      } as any)
      try {
        const { request } = await loginWithPassword()
        expireAccess()
        const patch = () =>
          request(`/admins/${other.id}`, {
            method: 'PATCH',
            body: { password: 'changed' }
          })
        expect((await patch()).status).toBe(403)
        expect(await isPassword('bo', 'secret')).toBe(true)
        await post(request, 'confirm-access', { password: 'secret' })
        expect((await patch()).status).toBe(200)
        expect(await isPassword('bo', 'changed')).toBe(true)
        expect(await isPassword('ada', 'secret')).toBe(true)
        expect((await request('/members/session')).data.authenticated).toBe(
          true
        )
      } finally {
        await Member.query().deleteById(other.id)
      }
    })
  })

  it('confirms the access with logins again', async () => {
    const { request } = await loginWithPassword()
    expireAccess()
    expect((await post(request, 'passkey-options')).status).toBe(403)
    const login = await post(request, 'login', {
      username: 'ada',
      password: 'secret'
    })
    expect(login.data.success).toBe(true)
    await expectConfirmedAccess(request)
  })

  it('confirms the access only for the user who confirmed it', async () => {
    const other = await Member.query().insert({
      username: 'bo',
      password: 'secret'
    } as any)
    try {
      const { request } = await loginWithPassword()
      await request('/impersonations', {
        method: 'POST',
        body: { username: 'bo' }
      })
      expect((await request('/members/session')).data.user.id).toBe(other.id)
      expect((await post(request, 'passkey-options')).status).toBe(403)
    } finally {
      await Member.query().deleteById(other.id)
    }
  })
})
