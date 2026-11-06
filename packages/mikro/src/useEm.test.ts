import { createApi } from '@ditojs/server'
import { useEm } from './index.ts'

describe('useEm()', () => {
  it('throws outside of a request', () => {
    expect(() => useEm()).toThrow('Unable to use `em` outside of a request.')
  })

  it('returns the entity manager of the running request', async () => {
    const em = { name: 'request' }
    const trx = { name: 'transaction' }
    const seen: unknown[] = []
    const check = async () => {
      await Promise.resolve()
      seen.push(useEm())
    }
    const api = createApi({
      adapter: {
        connect: () => em,
        transact: async (c, fn) => {
          c.set('em', trx)
          try {
            return await fn()
          } finally {
            c.set('em', em)
          }
        }
      },
      controllers: [
        {
          path: 'books',
          actions: {
            get: { authorize: true, handler: check },
            post: { authorize: true, handler: check }
          }
        }
      ],
      users: { getUser: () => ({ id: 1, roles: [] }) }
    })
    await api.request('/books')
    await api.request('/books', { method: 'POST' })
    expect(seen).toEqual([em, trx])
  })
})
