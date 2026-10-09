import { vi } from 'vitest'
import { handleUser } from './handleUser.js'

function createUser(events) {
  return {
    id: 7,
    async $emit(event, options) {
      events.push(`${event} ${JSON.stringify(options)}`)
    }
  }
}

function createContext(events, user = null) {
  return {
    logger: {
      child: bindings => ({ bindings })
    },
    state: { user },
    session: { visits: 1 },
    async login(user, options) {
      events.push(`login ${user.id} ${JSON.stringify(options)}`)
    },
    async logout(options) {
      events.push(`logout ${JSON.stringify(options)}`)
    }
  }
}

describe('handleUser()', () => {
  it('binds the user to the logger of the context', async () => {
    const user = createUser([])
    const ctx = createContext([], user)
    const next = vi.fn(() => 'next')
    expect(await handleUser()(ctx, next)).toBe('next')
    expect(ctx.logger).toEqual({ bindings: { user } })
  })

  it('sets no logger without a logger on the context', async () => {
    const ctx = createContext([])
    delete ctx.logger
    await handleUser()(ctx, () => {})
    expect(ctx.logger).toBeNull()
  })

  it('emits login events on the user around `ctx.login()`', async () => {
    const events = []
    const ctx = createContext(events)
    await handleUser()(ctx, () => {})
    expect(ctx.logIn).toBe(ctx.login)
    await ctx.login(createUser(events))
    expect(events).toEqual([
      'before:login {}',
      'login 7 {}',
      'after:login {}'
    ])
  })

  it('emits logout events and clears the session on `ctx.logout()`', async () => {
    const events = []
    const ctx = createContext(events, createUser(events))
    await handleUser()(ctx, () => {})
    expect(ctx.logOut).toBe(ctx.logout)
    await ctx.logout({ keepSessionInfo: true })
    expect(events).toEqual([
      'before:logout {"keepSessionInfo":true}',
      'logout {"keepSessionInfo":true}',
      'after:logout {"keepSessionInfo":true}'
    ])
    expect(ctx.session).toBeNull()
  })

  it('logs out without a user', async () => {
    const events = []
    const ctx = createContext(events)
    await handleUser()(ctx, () => {})
    await ctx.logout()
    expect(events).toEqual(['logout {}'])
    expect(ctx.session).toBeNull()
  })
})
