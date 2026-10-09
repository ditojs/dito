import { vi } from 'vitest'
import { ListQuery } from './ListQuery.js'

function createListQuery({
  routeQuery = {},
  storedQuery,
  defaultQuery = { scope: 'all', order: 'title asc' }
} = {}) {
  const route = { path: '/books', query: routeQuery, hash: '#main' }
  const store = { query: storedQuery }
  const router = {
    push: vi.fn(async ({ query }) => {
      route.query = query
    }),
    replace: vi.fn(async ({ query }) => {
      route.query = query
    })
  }
  const listQuery = new ListQuery({
    router,
    getRoute: () => route,
    getSourceStore: () => store,
    getDefaultQuery: () => defaultQuery
  })
  return { listQuery, router, route, store }
}

describe('ListQuery', () => {
  describe('query', () => {
    it('applies the defaults to the stored query', () => {
      const { listQuery } = createListQuery({
        storedQuery: { scope: 'drafts', page: '2' }
      })
      expect(listQuery.query).toEqual({
        scope: 'drafts',
        order: 'title asc',
        page: '2'
      })
    })
  })

  describe('update()', () => {
    it('navigates to the changed query and keeps the hash', async () => {
      const { listQuery, router } = createListQuery({
        storedQuery: { scope: 'all', order: 'title asc' }
      })
      await listQuery.update({ order: 'title desc' })
      expect(router.push).toHaveBeenCalledWith({
        query: { scope: 'all', order: 'title desc' },
        hash: '#main'
      })
    })

    it(`doesn't navigate if the query doesn't change`, async () => {
      const { listQuery, router } = createListQuery({
        storedQuery: { scope: 'all', order: 'title asc', page: '1' }
      })
      // Route queries hold strings, see `isSameQuery()`:
      await listQuery.update({ page: 1 }, { resetPage: true })
      expect(router.push).not.toHaveBeenCalled()
    })

    it('resets a set page with `resetPage` when the query changes', async () => {
      const { listQuery, router } = createListQuery({
        storedQuery: { page: '3' }
      })
      await listQuery.update({ scope: 'drafts' }, { resetPage: true })
      expect(router.push.mock.calls[0][0].query).toEqual({
        scope: 'drafts',
        order: 'title asc',
        page: 0
      })
    })

    it('removes values that are changed to `undefined`', async () => {
      const { listQuery, router } = createListQuery({
        storedQuery: { filter: ['title:"Emma"'] }
      })
      await listQuery.update({ filter: undefined })
      expect(router.push.mock.calls[0][0].query).toEqual({
        scope: 'all',
        order: 'title asc'
      })
    })
  })

  describe('whenNavigated()', () => {
    it(`returns null if no navigation is pending`, () => {
      const { listQuery } = createListQuery()
      expect(listQuery.whenNavigated()).toBe(null)
    })

    it('resolves to whether the route holds the query', async () => {
      const { listQuery, route, router } = createListQuery()
      router.push.mockImplementation(async ({ query }) => {
        await Promise.resolve()
        route.query = query
      })
      const navigated = listQuery.update({ page: 2 })
      const hasNavigated = listQuery.whenNavigated()
      expect(hasNavigated).toBeInstanceOf(Promise)
      await navigated
      expect(await hasNavigated).toBe(true)
      expect(listQuery.whenNavigated()).toBe(null)
    })

    it('resolves to `false` if the navigation fails', async () => {
      const { listQuery, router } = createListQuery()
      router.push.mockImplementation(async () => {
        throw new Error('Navigation aborted')
      })
      const navigated = listQuery.update({ page: 2 })
      const hasNavigated = listQuery.whenNavigated()
      await expect(navigated).rejects.toThrow('Navigation aborted')
      expect(await hasNavigated).toBe(false)
    })

    it('keeps the later navigation pending when an earlier one settles', async () => {
      const { listQuery, router } = createListQuery()
      let resolveFirst
      router.push
        .mockImplementationOnce(
          () => new Promise(resolve => (resolveFirst = resolve))
        )
        .mockImplementationOnce(() => new Promise(() => {}))
      const first = listQuery.update({ page: 2 })
      listQuery.update({ page: 3 })
      resolveFirst()
      await first
      // The route doesn't hold the query of the later navigation yet:
      expect(listQuery.pendingNavigation.query.page).toBe(3)
      expect(listQuery.whenNavigated()).toBeInstanceOf(Promise)
    })

    it('returns null once the route holds the query', async () => {
      const { listQuery, route, router } = createListQuery()
      router.push.mockImplementation(() => new Promise(() => {}))
      listQuery.update({ page: 2 })
      expect(listQuery.whenNavigated()).not.toBe(null)
      route.query = { scope: 'all', order: 'title asc', page: '2' }
      expect(listQuery.whenNavigated()).toBe(null)
    })
  })

  describe('syncWithRoute()', () => {
    it('merges the stored query and the route query', () => {
      const { listQuery, router, store } = createListQuery({
        routeQuery: { page: '2' },
        storedQuery: { scope: 'drafts', page: '1' }
      })
      listQuery.syncWithRoute()
      const query = { scope: 'drafts', order: 'title asc', page: '2' }
      expect(store.query).toEqual(query)
      expect(router.replace).toHaveBeenCalledWith({ query, hash: '#main' })
    })

    it(`doesn't replace the route if it holds the query`, () => {
      const { listQuery, router } = createListQuery({
        routeQuery: { order: 'title asc', scope: 'all' }
      })
      listQuery.syncWithRoute()
      expect(router.replace).not.toHaveBeenCalled()
    })
  })

  describe('setFromRoute()', () => {
    it('stores the route query and returns whether it changed', () => {
      const { listQuery, store } = createListQuery({
        storedQuery: { scope: 'all', order: 'title asc', page: '2' }
      })
      expect(listQuery.setFromRoute({ page: '2' })).toBe(false)
      expect(listQuery.setFromRoute({ page: '3' })).toBe(true)
      expect(store.query).toEqual({
        scope: 'all',
        order: 'title asc',
        page: '3'
      })
    })

    it('removes the values that the route query lacks', () => {
      const { listQuery, store } = createListQuery({
        storedQuery: { filter: ['title:"Emma"'] }
      })
      expect(listQuery.setFromRoute({})).toBe(true)
      expect(store.query).toEqual({ scope: 'all', order: 'title asc' })
    })
  })
})
