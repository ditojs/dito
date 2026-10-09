import { AsyncLocalStorage } from 'async_hooks'
import { setupRequestStorage } from './setupRequestStorage.js'

describe('setupRequestStorage()', () => {
  it('exposes the current transaction and logger of the request', async () => {
    const requestStorage = new AsyncLocalStorage()
    const ctx = { transaction: null, logger: 'first logger' }
    const seen = []
    await setupRequestStorage(requestStorage)(ctx, async () => {
      const store = requestStorage.getStore()
      seen.push([store.transaction, store.logger])
      // The store reflects later changes of the context.
      ctx.transaction = 'trx'
      ctx.logger = 'second logger'
      seen.push([store.transaction, store.logger])
    })
    expect(seen).toEqual([
      [null, 'first logger'],
      ['trx', 'second logger']
    ])
    expect(requestStorage.getStore()).toBeUndefined()
  })
})
