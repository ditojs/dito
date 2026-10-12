import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import {
  getResourceUrl,
  sendRequest,
  waitUntilDataModelSettled
} from './services.ts'
import {
  mountForm,
  mountSchema,
  settle,
  isView,
  isForm
} from '../test/mount.js'

// `appState.loadCache` lives for the session, so each test requests its own
// URLs, made unique by this counter.
let requestCount = 0
const getUniqueUrl = name => `${name}-${++requestCount}`

describe('services', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('request()', () => {
    it('caches responses globally', async () => {
      const request = vi.fn(() => ({ data: { title: 'Orlando' } }))
      const { schemaComponent } = await mountSchema({
        schema: { components: { title: { type: 'text' } } },
        request
      })
      const url = getUniqueUrl('books')
      const first = await schemaComponent.context.request({
        url,
        cache: 'global'
      })
      const second = await schemaComponent.context.request({
        url,
        cache: 'global'
      })
      expect(first).toEqual({ title: 'Orlando' })
      expect(second).toBe(first)
      expect(request).toHaveBeenCalledOnce()
    })

    it('caches responses locally within the route component', async () => {
      const request = vi.fn(() => ({ data: { title: 'Orlando' } }))
      const { admin, schemaComponent } = await mountSchema({
        schema: { components: { title: { type: 'text' } } },
        request
      })
      const url = getUniqueUrl('books')
      const first = await schemaComponent.context.request({
        url,
        cache: 'local'
      })
      const second = await schemaComponent.context.request({
        url,
        cache: 'local'
      })
      expect(second).toBe(first)
      expect(request).toHaveBeenCalledOnce()
      // Leaving the view releases its cache with it:
      await admin.navigate('/')
      await admin.navigate('/test')
      const view = admin.getRouteComponent(isView)
      await admin
        .getSchemaComponent(view)
        .context.request({ url, cache: 'local' })
      expect(request).toHaveBeenCalledTimes(2)
    })

    it(`doesn't cache failed requests`, async () => {
      const request = vi
        .fn()
        .mockRejectedValueOnce(new Error('Network down'))
        .mockResolvedValueOnce({ data: { title: 'Orlando' } })
      const { schemaComponent } = await mountSchema({
        schema: { components: { title: { type: 'text' } } },
        request
      })
      const url = getUniqueUrl('books')
      await expect(
        schemaComponent.context.request({ url, cache: 'global' })
      ).rejects.toThrow('Network down')
      expect(
        await schemaComponent.context.request({ url, cache: 'global' })
      ).toEqual({ title: 'Orlando' })
      expect(request).toHaveBeenCalledTimes(2)
    })

    it('caches the requests of different resources separately', async () => {
      const request = vi.fn(({ url }) => ({ data: { url } }))
      const { schemaComponent } = await mountSchema({
        schema: { components: { title: { type: 'text' } } },
        request
      })
      const books = getUniqueUrl('books')
      const authors = getUniqueUrl('authors')
      expect(
        await schemaComponent.context.request({
          resource: { path: books },
          cache: 'global'
        })
      ).toEqual({ url: `/${books}` })
      expect(
        await schemaComponent.context.request({
          resource: { path: authors },
          cache: 'global'
        })
      ).toEqual({ url: `/${authors}` })
      expect(request).toHaveBeenCalledTimes(2)
    })

    it('converts errors of responses with data', async () => {
      const error = new Error('Request failed')
      error.response = { data: { message: 'Not found', type: 'NotFound' } }
      const { schemaComponent } = await mountSchema({
        schema: { components: { title: { type: 'text' } } },
        request: () => Promise.reject(error)
      })
      await expect(
        schemaComponent.context.request({ url: getUniqueUrl('books') })
      ).rejects.toMatchObject({ message: 'Not found', type: 'NotFound' })
    })
  })

  describe('format()', () => {
    it('formats with the locale and formats of the API by default', async () => {
      const { schemaComponent } = await mountSchema({
        schema: { components: { title: { type: 'text' } } },
        api: {
          locale: 'de-DE',
          formats: { number: { minimumFractionDigits: 2 } }
        }
      })
      expect(
        schemaComponent.context.format(1234.5, { date: false, time: false })
      )
        .toBe('1.234,50')
      expect(
        schemaComponent.context.format(1234.5, {
          locale: 'en-US',
          number: { minimumFractionDigits: 1 }
        })
      ).toBe('1,234.5')
    })
  })

  describe('download()', () => {
    const mountAndCaptureClicks = async () => {
      const { schemaComponent } = await mountSchema({
        schema: { components: { title: { type: 'text' } } }
      })
      const anchors = []
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
        function () {
          anchors.push({
            href: this.getAttribute('href'),
            download: this.getAttribute('download'),
            isConnected: this.isConnected
          })
        }
      )
      return { schemaComponent, anchors }
    }

    it('downloads a URL given as a string through the API', async () => {
      const { schemaComponent, anchors } = await mountAndCaptureClicks()
      schemaComponent.context.download('books/export.csv')
      expect(anchors).toEqual([
        {
          href: '/books/export.csv',
          download: '',
          isConnected: true
        }
      ])
      // The anchor is only in the document while it's being clicked:
      expect(document.querySelector('a[href="/books/export.csv"]'))
        .toBe(null)
    })

    it('downloads API URLs with query and filename', async () => {
      const { schemaComponent, anchors } = await mountAndCaptureClicks()
      schemaComponent.context.download({
        url: 'authors/report',
        query: { year: 2024 },
        filename: 'authors-2024.pdf'
      })
      expect(anchors).toMatchObject([
        {
          href: '/authors/report?year=2024',
          download: 'authors-2024.pdf'
        }
      ])
    })

    it('downloads blob URLs as they are', async () => {
      const { schemaComponent, anchors } = await mountAndCaptureClicks()
      const url = 'blob:http://localhost/7c2b6f1e'
      schemaComponent.context.download({ url, filename: 'recipes.json' })
      expect(anchors).toMatchObject([{ href: url, download: 'recipes.json' }])
    })
  })

  describe('waitUntilDataModelSettled()', () => {
    it('tracks pending loads in the root loading tracker', async () => {
      let resolveLoad = null
      const { admin, routeComponent, data, settle } = await mountSchema({
        schema: {
          components: {
            isbn: { type: 'text' },
            cover: {
              type: 'computed',
              data: ({ item }) => {
                const { isbn } = item
                return () =>
                  isbn === 'new'
                    ? new Promise(resolve => {
                        resolveLoad = () => resolve(`cover-${isbn}`)
                      })
                    : `cover-${isbn}`
              }
            }
          }
        },
        data: { isbn: 'old' }
      })
      const { dataModel, ownDataContext: dataContext } = routeComponent
      expect(data.cover).toBe('cover-old')
      dataModel.set(data, 'isbn', 'new')
      await flushPromises()
      expect(dataModel.hasPendingLoads).toBe(true)
      const tracker = admin.context.loadingTracker
      let isSettled = false
      const settled = waitUntilDataModelSettled({
        adminContext: admin.context,
        dataContext
      }).then(() => (isSettled = true))
      await flushPromises()
      expect(tracker.isLoading).toBe(true)
      expect(isSettled).toBe(false)
      resolveLoad()
      await settled
      expect(tracker.isLoading).toBe(false)
      await settle()
      expect(data.cover).toBe('cover-new')
    })
  })

  // Data paths are relative to the root data of the route, also within sources
  // that load their data through their own resource.
  it('reads the root data of the route in sources with resources', async () => {
    const { admin } = await mountForm({
      schema: {
        components: {
          chapters: {
            type: 'list',
            form: {
              type: 'form',
              components: {
                comments: {
                  type: 'list',
                  resource: { path: 'comments' },
                  columns: { text: {} }
                }
              }
            }
          }
        }
      },
      data: { chapters: [{ title: 'Arrakis' }] },
      request: () => ({ data: [] })
    })
    await admin.navigate('/items/1/chapters/0')
    const form = admin.getRouteComponent(isForm)
    await settle(form)
    const comments = admin.getComponent(form, 'chapters/0/comments')
    expect(comments.context.rootItem).toBe(form.ownRouteContext.rootData)
    expect(comments.context.item).toBe(form.data)
  })

  describe('getResourceUrl()', () => {
    it('returns null without a resource', async () => {
      const { admin } = await mountSchema({
        schema: { components: { title: { type: 'text' } } }
      })
      const services = { adminContext: admin.context, resourceContext: null }
      expect(getResourceUrl(services, null)).toBe(null)
      expect(getResourceUrl(services, { path: 'books', query: { a: 1 } }))
        .toBe('/books?a=1')
    })

    it('resolves resources in views with resources', async () => {
      const { getComponent } = await mountSchema({
        schema: {
          components: {
            authors: {
              type: 'list',
              resource: { path: 'authors' },
              columns: { name: {} }
            },
            title: { type: 'text' }
          }
        },
        request: () => ({ data: [] })
      })
      // The view has no resource to inherit:
      const { context } = getComponent('title')
      expect(context.getResourceUrl({ path: 'books' })).toBe('/books')
    })
  })

  describe('sendRequest()', () => {
    const mountWithUsers = async () => {
      let username = 'reader'
      const request = vi.fn(({ method = 'get', url, data }) => {
        if (url === '/users/session') {
          return { data: { user: { id: 1, username } } }
        }
        if (method === 'patch') {
          username = data.username
        }
        return { data }
      })
      const result = await mountSchema({
        schema: { components: { title: { type: 'text' } } },
        api: { users: { path: 'users' } },
        request
      })
      const getSessionRequestCount = () =>
        request.mock.calls.filter(([{ url }]) => url === '/users/session')
          .length
      return { ...result, request, getSessionRequestCount }
    }

    it('fetches the own user again after patching it', async () => {
      const { admin, getSessionRequestCount } = await mountWithUsers()
      expect(admin.context.user.username).toBe('reader')
      const count = getSessionRequestCount()
      await sendRequest(
        { adminContext: admin.context },
        {
          method: 'patch',
          resource: { type: 'member', path: 'users', id: '1' },
          data: { username: 'editor' }
        }
      )
      // Once to ensure the user before the request, and once after it:
      expect(getSessionRequestCount()).toBe(count + 2)
      expect(admin.context.user.username).toBe('editor')
    })

    it(`doesn't fetch the user again after patching others`, async () => {
      const { admin, getSessionRequestCount } = await mountWithUsers()
      const count = getSessionRequestCount()
      await sendRequest(
        { adminContext: admin.context },
        {
          method: 'patch',
          resource: { type: 'member', path: 'users', id: '2' },
          data: { username: 'editor' }
        }
      )
      expect(getSessionRequestCount()).toBe(count + 1)
      expect(admin.context.user.username).toBe('reader')
    })

    it(`doesn't check the user for internal requests`, async () => {
      const { admin, request, getSessionRequestCount } = await mountWithUsers()
      const count = getSessionRequestCount()
      await sendRequest(
        { adminContext: admin.context },
        { url: '/books', internal: true }
      )
      expect(getSessionRequestCount()).toBe(count)
      expect(request).toHaveBeenLastCalledWith(
        expect.objectContaining({ url: '/books' })
      )
    })
  })
})
