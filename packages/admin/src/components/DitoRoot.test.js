import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import appState from '../appState.js'
import DitoAdmin from '../DitoAdmin.js'
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

    const editViewTitle = async buttons => {
      const admin = await mountAdmin({
        views: {
          books: {
            type: 'view',
            components: { title: { type: 'text' } },
            buttons
          }
        }
      })
      await admin.navigate('/books')
      await enterValue(admin.wrapper.find('input[name="title"]'), 'Emma')
      await flushPromises()
    }

    it('prevents unloading with unsaved changes in a view', async () => {
      await editViewTitle({ save: { type: 'submit' } })
      expect(isUnloadPrevented()).toBe(true)
    })

    it(`doesn't prevent unloading with edits that a view can't save`, async () => {
      await editViewTitle({ apply: { type: 'button' } })
      expect(isUnloadPrevented()).toBe(false)
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
      const { session } = admin.context
      await admin.navigate('/books')
      await session.logout()
      await flushPromises()
      expect(admin.context.views).toEqual({})
      expect(admin.router.currentRoute.value.path).toBe('/')
      expect(admin.wrapper.find('.dito-view').exists()).toBe(false)

      await admin.wrapper.find('button.dito-login').trigger('click')
      await flushPromises()
      const dialog = admin.wrapper.find('.dito-dialog')
      await enterValue(dialog.find('input[name="username"]'), 'reader')
      await enterValue(dialog.find('input[name="password"]'), 'secret')
      await dialog.find('button[type="submit"]').trigger('click')
      await flushPromises()
      expect(admin.context.user.username).toBe('reader')
      expect(Object.keys(admin.context.views)).toEqual(['books'])
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
        admin.context.showDialog({
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

    it('rejects the keys of 3.x in buttons', async () => {
      const admin = await mountAdmin({ views: {} })
      await expect(
        admin.context.showDialog({
          components: {},
          buttons: { confirm: { type: 'submit', data: {} } }
        })
      ).rejects.toThrow(`Unsupported schema key 'data' in 'confirm'`)
      expect(admin.root.dialogs).toEqual({})
    })
  })

  describe('session start', () => {
    it('logs the errors of setting up the views', async () => {
      const logError = vi.spyOn(console, 'error').mockImplementation(() => {})
      const element = document.createElement('div')
      document.body.appendChild(element)
      const admin = new DitoAdmin(element, {
        dito: { base: '/', settings: {} },
        api: {
          url: '/',
          request: async () => ({ data: { user: { id: 1, username: 'ada' } } })
        },
        // Views need to be of type 'view':
        views: { books: { type: 'form', components: {} } }
      })
      try {
        await vi.waitFor(() => {
          expect(logError).toHaveBeenCalledWith(
            expect.objectContaining({
              message: expect.stringMatching(/^Invalid view schema: /)
            })
          )
        })
        await flushPromises()
        expect(element.querySelector('.dito-account').textContent).toBe('ada')
      } finally {
        admin.app.unmount()
        element.remove()
        vi.restoreAllMocks()
      }
    })
  })

  describe('header', () => {
    const mountLoadingAdmin = async options => {
      const admin = await mountAdmin({
        views: {
          books: {
            type: 'view',
            component: {
              type: 'list',
              resource: { path: 'books' },
              columns: { title: {} }
            }
          }
        },
        // Keep loading the list:
        request: () => new Promise(() => {}),
        options
      })
      admin.navigate('/books')
      await flushPromises()
      return admin.wrapper.find('.dito-header')
    }

    it('shows a spinner while loading', async () => {
      const header = await mountLoadingAdmin()
      expect(header.attributes('aria-busy')).toBe('true')
      expect(header.find('.dito-spinner').exists()).toBe(true)
    })

    it(`doesn't show the spinner with \`spinner: null\``, async () => {
      const header = await mountLoadingAdmin({ spinner: null })
      expect(header.attributes('aria-busy')).toBe('true')
      expect(header.find('.dito-spinner').exists()).toBe(false)
    })
  })

  describe('info tooltips', () => {
    it('shows the info of labels in a tooltip in their pane', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      try {
        const admin = await mountAdmin({
          views: {
            books: {
              type: 'view',
              components: {
                title: { type: 'text', info: 'The title on the cover' }
              }
            }
          }
        })
        await admin.navigate('/books')
        const info = admin.element.querySelector('.dito-info')
        expect(info.dataset.info).toBe('The title on the cover')
        info.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
        info.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
        await vi.advanceTimersByTimeAsync(500)
        const tooltip = document.querySelector('[data-tippy-root]')
        expect(tooltip.textContent).toBe('The title on the cover')
        expect(tooltip.parentElement.closest('.dito-pane')).not.toBe(null)
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
