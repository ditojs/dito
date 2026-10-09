import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import appState from '../appState.js'
import {
  mountAdmin,
  mountForm,
  unmountAdmin,
  enterValue
} from '../test/mount.js'

// Dispatches `beforeunload` like the browser does when the page is reloaded or
// closed, and returns whether the page asks to stay.
function isUnloadPrevented() {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
}

describe('DitoRoot', () => {
  describe('beforeunload', () => {
    const schema = { components: { title: { type: 'text' } } }

    it(`doesn't prevent unloading without unsaved changes`, async () => {
      await mountForm({ schema, data: { title: 'Dune' } })
      expect(isUnloadPrevented()).toBe(false)
    })

    it('prevents unloading with unsaved changes', async () => {
      const { wrapper, settle } = await mountForm({
        schema,
        data: { title: 'Dune' }
      })
      await enterValue(wrapper.find('input[name="title"]'), 'Emma')
      await settle()
      expect(isUnloadPrevented()).toBe(true)
    })

    it(`doesn't prevent unloading after saving`, async () => {
      const { wrapper, admin, settle, submit } = await mountForm({
        schema,
        data: { title: 'Dune' },
        request: ({ data }) => ({ data })
      })
      await enterValue(wrapper.find('input[name="title"]'), 'Emma')
      await settle()
      expect(await submit()).toEqual({ id: 1, title: 'Emma' })
      await settle()
      expect(admin.router.currentRoute.value.path).toBe('/items')
      expect(isUnloadPrevented()).toBe(false)
    })

    it('stops listening once unmounted', async () => {
      const { wrapper, admin, settle } = await mountForm({
        schema,
        data: { title: 'Dune' }
      })
      await enterValue(wrapper.find('input[name="title"]'), 'Emma')
      await settle()
      unmountAdmin(admin)
      expect(isUnloadPrevented()).toBe(false)
    })
  })

  describe('focus', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it(`doesn't keep clicked labels in the app state`, async () => {
      const { wrapper } = await mountForm({
        schema: {
          components: {
            details: {
              type: 'section',
              label: 'Details',
              collapsible: true,
              components: { title: { type: 'text' } }
            }
          }
        },
        data: { title: 'Dune' }
      })
      const label = wrapper.find('button.dito-label')
      await label.trigger('click')
      await flushPromises()
      expect(label.classes()).not.toContain('dito-label--active')
      expect(appState).not.toHaveProperty('activeLabel')
    })

    it(`doesn't listen to clicks and keys on the document`, async () => {
      const addEventListener = vi.spyOn(document, 'addEventListener')
      await mountAdmin({ views: {} })
      const types = addEventListener.mock.calls.map(([type]) => type)
      expect(types).not.toContain('click')
      expect(types).not.toContain('keyup')
    })
  })

  describe('session', () => {
    it('registers the views again after logging out and in', async () => {
      const admin = await mountAdmin({
        views: {
          books: {
            type: 'view',
            label: 'Books',
            components: { title: { type: 'text' } }
          }
        },
        request: ({ method, url, data }) =>
          method === 'post' && url === '/logout'
            ? { data: { success: true } }
            : method === 'post' && url === '/login'
              ? { data: { user: { id: 1, username: data.username } } }
              : null
      })
      const { session, viewRegistry } = admin.root
      await admin.navigate('/books')
      await session.logout()
      await flushPromises()
      expect(viewRegistry.views).toEqual({})
      expect(admin.router.currentRoute.value.path).toBe('/')
      expect(admin.wrapper.find('.dito-view').exists()).toBe(false)

      await admin.wrapper.find('button.dito-login').trigger('click')
      await flushPromises()
      const dialog = admin.wrapper.find('.dito-dialog')
      await enterValue(dialog.find('input[name="username"]'), 'reader')
      await enterValue(dialog.find('input[name="password"]'), 'secret')
      await dialog.find('button[type="submit"]').trigger('click')
      await flushPromises()
      expect(session.user.username).toBe('reader')
      expect(Object.keys(viewRegistry.views)).toEqual(['books'])
      await admin.navigate('/books')
      expect(
        admin.wrapper.find('.dito-view input[name="title"]').exists()
      ).toBe(true)
    })
  })

  describe('showDialog()', () => {
    it('rejects when the components fail to set up', async () => {
      const admin = await mountAdmin({ views: {} })
      await expect(
        admin.root.showDialog({
          components: {
            books: {
              type: 'list',
              form: { type: 'form', components: {} }
            }
          }
        })
      ).rejects.toThrow('Dialogs do not support components that produce routes')
      expect(admin.root.dialogs).toEqual({})
    })
  })
})
