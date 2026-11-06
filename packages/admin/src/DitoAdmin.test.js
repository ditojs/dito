import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import DitoAdmin from './DitoAdmin.js'
import { mountAdmin, stubRequests } from './test/mount.js'
import { getResourcePath } from './utils/resource.js'

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
    stubRequests()
    const admin = new DitoAdmin(element, {
      views: {},
      api: {
        // Respond to the request for the logged-in user without one:
        requestStub: vi.fn(async () => ({ data: null }))
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
        new Response(JSON.stringify({ id: 1, username: 'ada' }), {
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
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'https://library.example/api/features',
      'https://library.example/api/self'
    ])
    expect(fetch.mock.calls[1][1]).toMatchObject({
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })
  })

  it('requests the features and the user at once', async () => {
    // Answer only once both requests are sent, the user first:
    const responses = {}
    const requestStub = vi.fn(
      ({ url }) => new Promise(resolve => (responses[url] = resolve))
    )
    const admin = createAdmin({ api: { url: '/', requestStub } })
    await vi.waitFor(() => {
      expect(Object.keys(responses)).toEqual(['/features', '/self'])
    })
    responses['/self']({ data: { id: 1, username: 'ada' } })
    await flushPromises()
    responses['/features']({ data: { hasPasswordChange: true } })
    // The account menu offers what the features enable:
    const button = await vi.waitFor(() => {
      const button = admin.el.querySelector(
        '.dito-account button[aria-haspopup="menu"]'
      )
      expect(button).not.toBe(null)
      return button
    })
    button.click()
    await vi.waitFor(() => {
      const items = admin.el.querySelectorAll('.dito-account [role="menuitem"]')
      expect([...items].map(item => item.textContent.trim())).toEqual([
        'Security',
        'Sign Out'
      ])
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

  it('derives the resources of the users routes from `users.path`', () => {
    const { users } = createAdmin({
      api: {
        users: { path: 'admins' },
        requestStub: async () => ({ data: null })
      }
    }).api
    expect(getResourcePath(users.login)).toBe('admins/login')
    expect(users.login.method).toBe('post')
    expect(getResourcePath(users.self)).toBe('admins/self')
    expect(getResourcePath(users.passkeyLogin)).toBe('admins/passkey-login')
  })
})
