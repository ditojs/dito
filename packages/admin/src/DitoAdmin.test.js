import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
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
    vi.restoreAllMocks()
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

  it('joins resource paths without a trailing slash', () => {
    const admin = createAdmin()
    const { resources } = admin.api
    const parent = { type: 'collection', path: 'books' }
    expect(resources.any({ path: '', parent })).toBe('books')
    expect(resources.any({ path: 'covers', parent })).toBe('books/covers')
    expect(resources.any({ type: 'member', path: '', id: 1, parent })).toBe(
      'books/1'
    )
  })

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

  it('shows confirmations, prompts and alerts through its context', async () => {
    const { context, wrapper } = await mountAdmin({ views: {} })
    // Removed dialogs stay until their transitions end, so use the last one:
    const clickButton = async (promise, selector) => {
      await flushPromises()
      const dialog = wrapper.findAll('.dito-dialog').at(-1)
      await dialog.find(`.dito-dialog__buttons ${selector}`).trigger('click')
      return promise
    }
    const submit = '[type="submit"]'
    expect(await clickButton(context.confirm('Sell Dune?'), submit)).toBe(true)
    expect(
      await clickButton(context.prompt('Title:', { value: 'Dune' }), submit)
    ).toBe('Dune')
    expect(await clickButton(context.alert('Sold.'), 'button')).toBe(undefined)
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

  it('warns about each unknown option', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    createAdmin({
      spinner: null,
      account: { settings: { type: 'form', fields: {} } },
      catalog: 'books',
      shelves: 3
    })
    expect(warn.mock.calls).toEqual([
      [`Unknown DitoAdmin option: 'catalog'.`],
      [`Unknown DitoAdmin option: 'shelves'.`]
    ])
  })

  describe('login.additionalFields', () => {
    const additionalFields = {
      remember: { type: 'checkbox', label: 'Stay logged in' }
    }

    // The admin asks for the credentials, since the session has no user:
    async function getLoginDialogLabels(login) {
      const admin = createAdmin({ login })
      await vi.waitFor(() => {
        expect(admin.el.querySelector('.dito-dialog')).not.toBe(null)
      })
      return [...admin.el.querySelectorAll('.dito-dialog .dito-label')].map(
        label => label.textContent.trim()
      )
    }

    it('adds the fields to the login dialog', async () => {
      expect(await getLoginDialogLabels({ additionalFields })).toEqual([
        'Username',
        'Password',
        'Stay logged in'
      ])
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
