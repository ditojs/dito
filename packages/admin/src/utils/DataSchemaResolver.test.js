import { vi } from 'vitest'
import { reactive, nextTick } from 'vue'
import { DataSchemaResolver } from './DataSchemaResolver.js'

function createResolver(dataSchema, context = {}) {
  const pendingLoads = []
  const resolver = new DataSchemaResolver(dataSchema, {
    createContext: () => context,
    onLoadStart: promise => pendingLoads.push(promise)
  })
  const waitForPendingLoads = () => Promise.all(pendingLoads)
  return { resolver, pendingLoads, waitForPendingLoads }
}

describe('DataSchemaResolver', () => {
  it('resolves data schemas that are values', () => {
    const options = ['Small', 'Large']
    const { resolver } = createResolver(options)
    expect(resolver.value).toBe(options)
    expect(resolver.isLoading).toBe(false)
  })

  it('resolves `data` values and functions', () => {
    const item = reactive({ title: 'Hello' })
    const { resolver } = createResolver(
      { data: ({ item }) => item.title.toUpperCase() },
      { item }
    )
    expect(resolver.value).toBe('HELLO')
    item.title = 'Bye'
    expect(resolver.value).toBe('BYE')
    expect(createResolver({ data: 'Static' }).resolver.value).toBe('Static')
  })

  it('resolves `dataPath` relative to the data path of the context', () => {
    const rootItem = reactive({ sizes: ['S', 'M'], item: {} })
    const { resolver } = createResolver(
      { dataPath: '../../sizes' },
      { rootItem, dataPath: 'item/size' }
    )
    expect(resolver.value).toBe(rootItem.sizes)
  })

  it('evaluates and loads nothing before it is read', async () => {
    const data = vi.fn(() => async () => ['A'])
    const { resolver, pendingLoads } = createResolver({ data })
    await nextTick()
    expect(data).not.toHaveBeenCalled()
    expect(pendingLoads).toHaveLength(0)
    expect(resolver.value).toBe(undefined)
    expect(data).toHaveBeenCalledTimes(1)
    expect(pendingLoads).toHaveLength(1)
  })

  it('loads values asynchronously, keeping their object identity', async () => {
    const options = [{ id: 1 }]
    const { resolver, waitForPendingLoads } = createResolver({
      data: async () => options
    })
    expect(resolver.value).toBe(undefined)
    expect(resolver.isLoading).toBe(true)
    await waitForPendingLoads()
    expect(resolver.value).toBe(options)
    expect(resolver.isLoading).toBe(false)
  })

  it('loads again only when the dependencies of `data()` change', async () => {
    const item = reactive({ category: 'news', title: 'Hello' })
    const load = vi.fn(async category => [`${category}-1`])
    const { resolver, waitForPendingLoads } = createResolver(
      {
        data: ({ item }) => {
          const { category } = item
          return async () => load(category)
        }
      },
      { item }
    )
    resolver.value
    await waitForPendingLoads()
    expect(resolver.value).toEqual(['news-1'])
    item.title = 'Changed'
    expect(resolver.value).toEqual(['news-1'])
    item.category = 'sports'
    expect(resolver.value).toBe(undefined)
    await waitForPendingLoads()
    expect(resolver.value).toEqual(['sports-1'])
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('discards the values of outdated loads', async () => {
    const item = reactive({ category: 'news' })
    const resolvers = {}
    const { resolver, waitForPendingLoads } = createResolver(
      {
        data: ({ item }) => {
          const { category } = item
          return () =>
            new Promise(resolve => {
              resolvers[category] = () => resolve(category)
            })
        }
      },
      { item }
    )
    resolver.value
    item.category = 'sports'
    resolver.value
    await nextTick()
    resolvers.sports()
    resolvers.news()
    await waitForPendingLoads()
    expect(resolver.value).toBe('sports')
  })

  it('keeps the error of the last load in `lastLoadError`', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('Failed')
    const { resolver, waitForPendingLoads } = createResolver({
      data: async () => {
        throw error
      }
    })
    resolver.value
    await waitForPendingLoads()
    expect(resolver.value).toBe(undefined)
    expect(resolver.isLoading).toBe(false)
    expect(resolver.lastLoadError).toBe(error)
    expect(console.error).toHaveBeenCalledWith(error)
    vi.restoreAllMocks()
  })
})
