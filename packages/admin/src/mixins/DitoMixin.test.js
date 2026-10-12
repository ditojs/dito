import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import DitoContext from '../DitoContext.js'
import { mountForm, mountSchema, enterValue, settle } from '../test/mount.js'

// `appState.loadCache` lives for the session, so each test requests its own
// URLs, made unique by this counter.
let requestCount = 0
const getUniqueUrl = name => `${name}-${++requestCount}`

describe('DitoMixin', () => {
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
      const first = await schemaComponent.request({ url, cache: 'global' })
      const second = await schemaComponent.request({ url, cache: 'global' })
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
      const first = await schemaComponent.request({ url, cache: 'local' })
      const second = await schemaComponent.request({ url, cache: 'local' })
      expect(second).toBe(first)
      expect(request).toHaveBeenCalledOnce()
      // Leaving the view releases its cache with it:
      await admin.navigate('/')
      await admin.navigate('/test')
      const view = admin.getRouteComponent(component => component.isView)
      await view.$refs.schema.request({ url, cache: 'local' })
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
        schemaComponent.request({ url, cache: 'global' })
      ).rejects.toThrow('Network down')
      expect(
        await schemaComponent.request({ url, cache: 'global' })
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
        await schemaComponent.request({
          resource: { path: books },
          cache: 'global'
        })
      ).toEqual({ url: `/${books}` })
      expect(
        await schemaComponent.request({
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
        schemaComponent.request({ url: getUniqueUrl('books') })
      ).rejects.toMatchObject({ message: 'Not found', type: 'NotFound' })
    })
  })

  describe('events', () => {
    it('calls `on[A-Z]` handlers of native events', async () => {
      const onMouseenter = vi.fn()
      const onDblclick = vi.fn()
      const { findField } = await mountSchema({
        schema: {
          components: {
            title: {
              type: 'text',
              onMouseenter,
              events: { dblclick: onDblclick }
            }
          }
        }
      })
      const input = findField('title').find('input')
      await input.trigger('mouseenter')
      await input.trigger('dblclick')
      await flushPromises()
      expect(onMouseenter).toHaveBeenCalledOnce()
      expect(onDblclick).toHaveBeenCalledOnce()
    })

    it('calls the handlers with their context only', async () => {
      let receiver = null
      let context = null
      const { findField } = await mountSchema({
        schema: {
          components: {
            title: {
              type: 'text',
              events: {
                change(ctx) {
                  receiver = this
                  context = ctx
                }
              }
            }
          }
        }
      })
      await enterValue(findField('title').find('input'), 'Emma')
      expect(receiver).toBe(undefined)
      expect(context).toBeInstanceOf(DitoContext)
      expect(context.value).toBe('Emma')
    })

    it('passes changes of nested data with their data paths', async () => {
      const dataPaths = []
      const { findField, data, settle } = await mountSchema({
        schema: {
          components: {
            title: { type: 'text' },
            author: {
              type: 'object',
              inlined: true,
              form: {
                type: 'form',
                components: { name: { type: 'text' } }
              }
            },
            chapters: {
              type: 'list',
              inlined: true,
              form: {
                type: 'form',
                components: { heading: { type: 'text' } }
              }
            }
          },
          events: {
            change({ dataPath }) {
              dataPaths.push(dataPath)
            }
          }
        },
        data: {
          title: 'Emma',
          author: { name: 'Austen' },
          chapters: [{ heading: 'One' }]
        }
      })
      await enterValue(findField('author/name').find('input'), 'Jane Austen')
      await enterValue(findField('chapters/0/heading').find('input'), 'I')
      // Writes that aren't edits don't emit `change`:
      data.title = 'Persuasion'
      await settle()
      expect(dataPaths).toEqual(['author/name', 'chapters/0/heading'])
    })

    it('warns about event options other than `context` and `parent`', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const onError = vi.fn()
      const { getComponent } = await mountSchema({
        schema: { components: { title: { type: 'text', onError } } }
      })
      await getComponent('title').emitEvent('error', { error: 'Failed' })
      expect(warn).toHaveBeenCalledWith(
        `Unsupported options for event 'error': error. ` +
        'Pass them through `context`.'
      )
    })

    it('removes all listeners with `off()`', async () => {
      const onFocus = vi.fn()
      const { getComponent } = await mountSchema({
        schema: { components: { title: { type: 'text', onFocus } } }
      })
      const component = getComponent('title')
      expect(component.hasListeners('focus')).toBe(true)
      component.off()
      expect(component.hasListeners('focus')).toBe(false)
      await component.emitEvent('focus')
      expect(onFocus).not.toHaveBeenCalled()
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
      expect(schemaComponent.format(1234.5, { date: false, time: false }))
        .toBe('1.234,50')
      expect(
        schemaComponent.format(1234.5, {
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
      schemaComponent.download('books/export.csv')
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
      schemaComponent.download({
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
      schemaComponent.download({ url, filename: 'recipes.json' })
      expect(anchors).toMatchObject([{ href: url, download: 'recipes.json' }])
    })
  })

  describe('waitUntilDataModelSettled()', () => {
    it('tracks pending loads in the root loading tracker', async () => {
      let resolveLoad = null
      const { getComponent, settle } = await mountSchema({
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
      const component = getComponent('isbn')
      expect(component.data.cover).toBe('cover-old')
      component.dataModel.set(component.data, 'isbn', 'new')
      await flushPromises()
      expect(component.dataModel.hasPendingLoads).toBe(true)
      const tracker = component.admin.loadingTracker
      let isSettled = false
      const settled = component
        .waitUntilDataModelSettled()
        .then(() => (isSettled = true))
      await flushPromises()
      expect(tracker.isLoading).toBe(true)
      expect(isSettled).toBe(false)
      resolveLoad()
      await settled
      expect(tracker.isLoading).toBe(false)
      await settle()
      expect(component.data.cover).toBe('cover-new')
    })
  })
  describe('stores', () => {
    it('sets, reads and removes values of the store', async () => {
      const { getComponent } = await mountSchema({
        schema: { components: { title: { type: 'text' } } }
      })
      const component = getComponent('title')
      expect(component.setStore('page', 3)).toBe(3)
      expect(component.getStore('page')).toBe(3)
      component.removeStore('page')
      expect(component.getStore('page')).toBe(undefined)
      expect('page' in component.store).toBe(false)
    })

    it('creates the store of a child once', async () => {
      const { getComponent } = await mountSchema({
        schema: { components: { title: { type: 'text' } } }
      })
      const component = getComponent('title')
      const store = component.getChildStore('chapters')
      expect(store).toEqual({})
      expect(component.getChildStore('chapters')).toBe(store)
    })
  })

  describe('getQueryLink()', () => {
    it('keeps the hash of the current route', async () => {
      const { admin, schemaComponent } = await mountSchema({
        schema: { components: { title: { type: 'text' } } }
      })
      await admin.navigate('/test#details')
      expect(schemaComponent.getQueryLink({ page: 2 })).toEqual({
        query: { page: 2 },
        hash: '#details'
      })
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
    const form = admin.getRouteComponent(component => component.isForm)
    await settle(form)
    const comments = admin.getComponent(form, 'chapters/0/comments')
    expect(comments.rootData).toBe(form.rootData)
    expect(comments.context.item).toBe(form.data)
  })

  describe('getResourceUrl()', () => {
    it('returns null without a resource', async () => {
      const { schemaComponent } = await mountSchema({
        schema: { components: { title: { type: 'text' } } }
      })
      expect(schemaComponent.getResourceUrl(null)).toBe(null)
      expect(schemaComponent.getResourceUrl({ path: 'books', query: { a: 1 } }))
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
      const title = getComponent('title')
      expect(title.resource).toBe(null)
      expect(title.getResourceUrl({ path: 'books' })).toBe('/books')
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
      const { schemaComponent, getSessionRequestCount } = await mountWithUsers()
      expect(schemaComponent.admin.user.username).toBe('reader')
      const count = getSessionRequestCount()
      await schemaComponent.sendRequest({
        method: 'patch',
        resource: { type: 'member', path: 'users', id: '1' },
        data: { username: 'editor' }
      })
      // Once to ensure the user before the request, and once after it:
      expect(getSessionRequestCount()).toBe(count + 2)
      expect(schemaComponent.admin.user.username).toBe('editor')
    })

    it(`doesn't fetch the user again after patching others`, async () => {
      const { schemaComponent, getSessionRequestCount } = await mountWithUsers()
      const count = getSessionRequestCount()
      await schemaComponent.sendRequest({
        method: 'patch',
        resource: { type: 'member', path: 'users', id: '2' },
        data: { username: 'editor' }
      })
      expect(getSessionRequestCount()).toBe(count + 1)
      expect(schemaComponent.admin.user.username).toBe('reader')
    })

    it(`doesn't check the user for internal requests`, async () => {
      const { schemaComponent, request, getSessionRequestCount } =
        await mountWithUsers()
      const count = getSessionRequestCount()
      await schemaComponent.sendRequest({ url: '/books', internal: true })
      expect(getSessionRequestCount()).toBe(count)
      expect(request).toHaveBeenLastCalledWith(
        expect.objectContaining({ url: '/books' })
      )
    })
  })

  describe('invalid schema events', () => {
    it('logs errors for events that are no functions', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { getComponent } = await mountSchema({
        schema: {
          components: {
            title: { type: 'text', events: { dblclick: 'not a function' } }
          }
        }
      })
      expect(getComponent('title').hasListeners('dblclick')).toBe(false)
      expect(error).toHaveBeenCalledWith(
        'Invalid event definition: dblclick: not a function'
      )
    })
  })
})
