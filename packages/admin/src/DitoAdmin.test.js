import { vi } from 'vitest'
import DitoAdmin from './DitoAdmin.js'
import appState from './appState.js'
import { mountAdmin } from './test/mount.js'

describe('DitoAdmin', () => {
  const createdAdmins = []

  afterEach(() => {
    for (const admin of createdAdmins.splice(0)) {
      admin.app.unmount()
      admin.app._container?.remove()
    }
    delete window.dito
    appState.user = null
  })

  function createAdmin(options) {
    const element = document.createElement('div')
    document.body.appendChild(element)
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

  it('works without the `dito` object', () => {
    delete window.dito
    const admin = createAdmin()
    expect(admin.api.base).toBe('/')
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

  it('provides an object as the default `$views`', () => {
    const admin = createAdmin()
    expect(admin.app._instance.provides.$views()).toEqual({})
  })

  it('declares the page class in the app state', async () => {
    expect(appState).toHaveProperty('pageClass', null)
    const admin = await mountAdmin({ views: {} })
    appState.pageClass = 'dito-page--wide'
    await admin.navigate('/')
    expect(admin.wrapper.find('.dito-page--wide').exists()).toBe(true)
    appState.pageClass = null
  })
})
