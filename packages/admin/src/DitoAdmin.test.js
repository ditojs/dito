import { vi } from 'vitest'
import DitoAdmin from './DitoAdmin.js'
import { mountAdmin } from './test/mount.js'

describe('DitoAdmin', () => {
  const createdAdmins = []

  afterEach(() => {
    for (const admin of createdAdmins.splice(0)) {
      admin.app.unmount()
      admin.app._container?.remove()
    }
    delete window.dito
  })

  function createAdmin({ el, ...options } = {}) {
    let element = el
    if (!element) {
      element = document.createElement('div')
      document.body.appendChild(element)
    }
    const admin = new DitoAdmin(element, {
      views: {},
      api: {
        // Answer the session request without a user:
        request: vi.fn(async () => ({ data: { user: null } }))
      },
      ...options
    })
    createdAdmins.push(admin)
    return admin
  }

  it('mounts into the element of a selector', () => {
    const element = document.createElement('div')
    element.id = 'library-admin'
    document.body.appendChild(element)
    const admin = createAdmin({ el: '#library-admin' })
    expect(admin.app._container).toBe(element)
    expect(admin.el).toBe(element)
    expect(element.classList.contains('dito-app')).toBe(true)
  })

  it('works without the `dito` object', () => {
    delete window.dito
    const admin = createAdmin()
    expect(admin.api.locale).toBe('en-US')
    expect(admin.app._container.classList.contains('dito-app')).toBe(true)
  })

  it('uses the global `dito` object by default', () => {
    window.dito = {
      base: '/',
      api: { locale: 'de-CH' },
      settings: { rootClass: 'library' }
    }
    const admin = createAdmin()
    expect(admin.api.locale).toBe('de-CH')
    expect(
      admin.app._container.querySelector('.dito-root.library')
    ).not.toBe(null)
  })

  it('provides the settings of the `dito` object to its context', () => {
    window.dito = { settings: { rootClass: 'global' } }
    const settings = { rootClass: 'library', forceDragFallback: true }
    expect(createAdmin({ dito: { settings } }).context.settings).toBe(settings)
    expect(createAdmin({ dito: {} }).context.settings).toEqual({})
  })

  it('provides an object as the views until they are resolved', () => {
    const admin = createAdmin()
    expect(admin.context.views).toEqual({})
  })

  it('renders the page class of the admin context', async () => {
    const admin = await mountAdmin({ views: {} })
    expect(admin.context.pageClass).toBe(null)
    admin.context.pageClass = 'dito-page--wide'
    await admin.navigate('/')
    expect(admin.wrapper.find('.dito-page--wide').exists()).toBe(true)
  })

  it('requests the API with `fetch()` by default', async () => {
    const fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ user: { id: 1, username: 'ada' } }), {
          headers: { 'Content-Type': 'application/json' }
        })
    )
    vi.stubGlobal('fetch', fetch)
    const element = document.createElement('div')
    document.body.appendChild(element)
    const admin = new DitoAdmin(element, {
      dito: { base: '/', settings: {} },
      api: { url: 'https://library.example/api/' },
      views: {}
    })
    createdAdmins.push(admin)
    await vi.waitFor(() => {
      expect(element.querySelector('.dito-account')?.textContent).toBe('ada')
    })
    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe('https://library.example/api/session')
    expect(options).toMatchObject({
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
  })

  it('normalizes the paths with `normalizePaths`', () => {
    const { api } = createAdmin({
      api: {
        normalizePaths: true,
        request: async () => ({ data: { user: null } })
      }
    })
    expect(api.normalizePath('bookAuthors')).toBe('book-authors')
    expect(api.denormalizePath('book-authors')).toBe('bookAuthors')
  })

  it('keeps the paths without `normalizePaths`', () => {
    const { api } = createAdmin()
    expect(api.normalizePath('bookAuthors')).toBe('bookAuthors')
    expect(api.denormalizePath('book-authors')).toBe('book-authors')
  })
})
