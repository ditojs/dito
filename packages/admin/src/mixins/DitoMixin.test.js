import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSchema } from '../test/mount.js'
import { getSchemaEventEntries } from './DitoMixin.js'

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
      await view.mainSchemaComponent.request({ url, cache: 'local' })
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

  describe('schema members', () => {
    it('warns when schema methods override members', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { getComponent } = await mountSchema({
        schema: {
          components: {
            title: {
              type: 'text',
              methods: {
                focus() {},
                shuffle() {}
              }
            }
          }
        }
      })
      expect(getComponent('title').shuffle).toBeTypeOf('function')
      const messages = warn.mock.calls.map(([message]) => message)
      expect(messages).toContain(
        `The schema method 'focus' overrides a member of the component.`
      )
      expect(messages.join()).not.toContain(`'shuffle'`)
    })

    it('warns when schema computed properties override members', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { getComponent } = await mountSchema({
        schema: {
          components: {
            title: {
              type: 'text',
              computed: {
                disabled: () => true,
                shout: () => 'ORLANDO'
              }
            }
          }
        },
        data: { title: 'Orlando' }
      })
      expect(getComponent('title').shout).toBe('ORLANDO')
      const messages = warn.mock.calls.map(([message]) => message)
      expect(messages).toContain(
        `The schema computed property 'disabled' overrides a member of the ` +
        `component.`
      )
      expect(messages.join()).not.toContain(`'shout'`)
    })
  })

  describe('events', () => {
    it('normalizes both forms of event definitions', () => {
      const click = () => {}
      const onMouseenter = () => {}
      const onPointerDown = () => {}
      expect(
        getSchemaEventEntries({
          events: { click },
          onMouseenter,
          onPointerDown,
          type: 'text'
        })
      ).toEqual([
        { key: 'click', event: 'click', callback: click },
        { key: 'onMouseenter', event: 'mouseenter', callback: onMouseenter },
        { key: 'onPointerDown', event: 'pointer-down', callback: onPointerDown }
      ])
    })

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
          download: 'null',
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

  describe('schema `watch`', () => {
    it('watches the data of components by their names', async () => {
      const changes = []
      const { getComponent, settle } = await mountSchema({
        schema: {
          components: {
            title: {
              type: 'text',
              watch: {
                // `subtitle` is a component declared after `title`, the
                // handlers are installed once all components exist:
                subtitle(value, oldValue) {
                  changes.push(['subtitle', value, oldValue, this.name])
                },
                // Other keys are watched as expressions of the component:
                value(value) {
                  changes.push(['value', value])
                }
              }
            },
            subtitle: { type: 'text' }
          }
        },
        data: { title: 'Emma', subtitle: 'A Novel' }
      })
      // Setting the view's data after mounting already triggered them:
      expect(changes).toEqual([
        ['value', 'Emma'],
        ['subtitle', 'A Novel', null, 'title']
      ])
      changes.length = 0
      getComponent('subtitle').value = 'A Comedy'
      getComponent('title').value = 'Persuasion'
      await settle()
      expect(changes).toEqual([
        ['subtitle', 'A Comedy', 'A Novel', 'title'],
        ['value', 'Persuasion']
      ])
    })

    it('supports a function returning the handlers', async () => {
      const onChange = vi.fn()
      const watch = vi.fn(function () {
        return { [`${this.name}Count`]: onChange }
      })
      const { getComponent, settle } = await mountSchema({
        schema: {
          components: {
            ingredients: { type: 'text', watch },
            ingredientsCount: { type: 'number' }
          }
        },
        data: { ingredients: 'Flour', ingredientsCount: 1 }
      })
      expect(watch).toHaveBeenCalledOnce()
      onChange.mockClear()
      getComponent('ingredientsCount').value = 2
      await settle()
      expect(onChange).toHaveBeenCalledOnce()
      expect(onChange.mock.calls[0].slice(0, 2)).toEqual([2, 1])
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
      component.value = 'new'
      await flushPromises()
      expect(component.dataModel.hasPendingLoads).toBe(true)
      const tracker = component.$loadingTracker().root
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
})
