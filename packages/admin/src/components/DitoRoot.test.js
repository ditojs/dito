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
