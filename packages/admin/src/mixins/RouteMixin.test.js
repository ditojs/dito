import {
  mountAdmin,
  mountForm,
  settle,
  enterValue,
  stubConfirm
} from '../test/mount.js'
import { toRaw } from 'vue'
import { flushPromises } from '@vue/test-utils'
import appState from '../appState.js'

describe('RouteMixin', () => {
  describe('unsaved changes', () => {
    it('asks before replacing the item of a form with a longer id', async () => {
      const confirm = stubConfirm(false)
      const { admin, wrapper, routeComponent } = await mountForm({
        schema: { components: { title: { type: 'text' } } },
        data: { title: 'Dune' },
        request: ({ url }) =>
          url === '/items/12' ? { data: { id: 12, title: 'Emma' } } : null
      })
      await enterValue(wrapper.find('input[name="title"]'), 'Dune Messiah')
      await settle(routeComponent)
      expect(routeComponent.isDirty).toBe(true)
      await admin.navigate('/items/12')
      expect(confirm).toHaveBeenCalledOnce()
      expect(admin.router.currentRoute.value.path).toBe('/items/1')
      expect(routeComponent.data.title).toBe('Dune Messiah')
    })

    it('leaves the form once the user discards the changes', async () => {
      const confirm = stubConfirm(true)
      const { admin, wrapper, routeComponent } = await mountForm({
        schema: { components: { title: { type: 'text' } } },
        data: { title: 'Dune' }
      })
      await enterValue(wrapper.find('input[name="title"]'), 'Dune Messiah')
      await settle(routeComponent)
      await admin.navigate('/items')
      expect(confirm).toHaveBeenCalledWith(
        'You have unsaved changes. Do you really want to cancel?'
      )
      expect(admin.router.currentRoute.value.path).toBe('/items')
    })

    it('asks only once for navigations while the dialog is open', async () => {
      const { admin, wrapper, routeComponent } = await mountForm({
        schema: { components: { title: { type: 'text' } } },
        data: { title: 'Dune' }
      })
      await enterValue(wrapper.find('input[name="title"]'), 'Dune Messiah')
      await settle(routeComponent)
      const firstNavigation = admin.router.push('/items')
      await flushPromises()
      // E.g. the browser's back button, while the dialog is still open:
      const secondNavigation = admin.router.push('/')
      await flushPromises()
      const dialogs = document.querySelectorAll('.dito-dialog')
      expect(dialogs).toHaveLength(1)
      dialogs[0].querySelector('button[type="submit"]').click()
      await Promise.all([firstNavigation, secondNavigation])
      expect(admin.router.currentRoute.value.path).toBe('/')
    })

    it('asks before leaving a view for one that shares its prefix', async () => {
      const confirm = stubConfirm(false)
      const admin = await mountAdmin({
        views: {
          'books': {
            type: 'view',
            components: { title: { type: 'text' } }
          },
          'books-archive': {
            type: 'view',
            components: { title: { type: 'text' } }
          }
        }
      })
      await admin.navigate('/books')
      const view = admin.getRouteComponent(it => it.isView)
      await enterValue(admin.wrapper.find('input[name="title"]'), 'Emma')
      expect(view.isDirty).toBe(true)
      await admin.navigate('/books-archive')
      expect(confirm).toHaveBeenCalledOnce()
      expect(admin.router.currentRoute.value.path).toBe('/books')
    })

    it(`doesn't ask when leaving a view after deleting items`, async () => {
      const confirm = stubConfirm(true)
      let books = [
        { id: 1, title: 'Dune' },
        { id: 2, title: 'Emma' }
      ]
      const admin = await mountAdmin({
        views: {
          books: {
            type: 'view',
            component: {
              type: 'list',
              resource: { path: 'books' },
              deletable: true,
              columns: { title: {} }
            }
          },
          authors: {
            type: 'view',
            components: { name: { type: 'text' } }
          }
        },
        request: ({ method = 'get', url }) => {
          if (method === 'delete' && url === '/books/1') {
            books = books.filter(book => book.id !== 1)
            return { data: { id: 1 } }
          }
          if (method === 'get' && url === '/books') {
            return { data: books }
          }
          return null
        }
      })
      await admin.navigate('/books')
      await admin.wrapper.find('.dito-button--delete').trigger('click')
      await flushPromises()
      expect(confirm).toHaveBeenCalledOnce()
      expect(books).toHaveLength(1)
      const view = admin.getRouteComponent(it => it.isView)
      // The deletion is persisted, so the view has no changes to save:
      expect(view.isDirty).toBe(false)
      await admin.navigate('/authors')
      expect(confirm).toHaveBeenCalledOnce()
      expect(admin.router.currentRoute.value.path).toBe('/authors')
    })

    it(`doesn't ask when redirecting to the created item`, async () => {
      const confirm = stubConfirm(false)
      const { admin, wrapper, routeComponent, submit } = await mountForm({
        schema: {
          components: { title: { type: 'text' } },
          // Stay in the form, to be redirected to the created item:
          buttons: { submit: { closeForm: false } }
        },
        // An id that is longer than `create`:
        request: ({ method, data }) =>
          method === 'post' ? { data: { id: 1234567, ...data } } : null
      })
      await enterValue(wrapper.find('input[name="title"]'), 'Dune')
      await settle(routeComponent)
      expect(await submit()).toEqual({ title: 'Dune' })
      await settle(routeComponent)
      expect(confirm).not.toHaveBeenCalled()
      expect(admin.router.currentRoute.value.path).toBe('/items/1234567')
      expect(admin.getRouteComponent(it => it.isForm)).toBe(routeComponent)
    })

    it(`doesn't ask when opening nested forms`, async () => {
      const confirm = stubConfirm(false)
      const { admin, wrapper, routeComponent } = await mountForm({
        schema: {
          components: {
            title: { type: 'text' },
            chapters: {
              type: 'list',
              editable: true,
              form: {
                type: 'form',
                components: { title: { type: 'text' } }
              }
            }
          }
        },
        data: { title: 'Dune', chapters: [{ title: 'Prologue' }] }
      })
      await enterValue(wrapper.find('input[name="title"]'), 'Dune Messiah')
      await settle(routeComponent)
      expect(routeComponent.isDirty).toBe(true)
      await admin.navigate('/items/1/chapters/0')
      expect(confirm).not.toHaveBeenCalled()
      expect(admin.router.currentRoute.value.path).toBe('/items/1/chapters/0')
    })
  })

  describe('mutating nested forms', () => {
    const schema = {
      components: {
        chapters: {
          type: 'list',
          editable: true,
          mutate: true,
          form: {
            type: 'form',
            components: {
              title: { type: 'text' },
              details: {
                type: 'section',
                label: 'Details',
                collapsible: true,
                collapsed: true,
                components: { summary: { type: 'text', required: true } }
              }
            }
          }
        }
      }
    }

    it('validates unmounted fields once before closing', async () => {
      const { admin, settle: settleForm } = await mountForm({
        schema,
        data: { chapters: [{ title: 'Prologue', summary: '' }] }
      })
      await admin.navigate('/items/1/chapters/0')
      const chapterForm = admin.getRouteComponent(it => it.isForm)
      await settle(chapterForm)
      // Validate the mounted components as on blur, so that they're all
      // validated and valid, but not the field in the collapsed section:
      for (const component of chapterForm.mainSchemaComponent.components) {
        component.validate()
      }
      await settleForm()
      expect(chapterForm.isValidated).toBe(true)
      expect(chapterForm.isValid).toBe(true)
      await admin.navigate('/items/1')
      await settleForm()
      expect(admin.router.currentRoute.value.path).toBe('/items/1/chapters/0')
      expect(admin.wrapper.find('.dito-errors').text()).toBe(
        'The Summary field is required.'
      )
      // The user can still leave the form on the next attempt:
      await admin.navigate('/items/1')
      expect(admin.router.currentRoute.value.path).toBe('/items/1')
    })
  })

  it('keeps the route components of the new route by level', async () => {
    const { admin } = await mountForm({
      schema: { components: { title: { type: 'text' } } },
      data: { title: 'Dune' }
    })
    const view = admin.getRouteComponent(it => it.isView)
    const form = admin.getRouteComponent(it => it.isForm)
    expect(appState.routeComponents.map(toRaw)).toEqual([
      toRaw(view),
      toRaw(form)
    ])
    await admin.navigate('/items')
    expect(form.$.isUnmounted).toBe(true)
    expect(appState.routeComponents.map(toRaw)).toEqual([toRaw(view)])
    await admin.navigate('/items/1')
    const newForm = admin.getRouteComponent(it => it.isForm)
    expect(newForm).not.toBe(form)
    expect(appState.routeComponents.map(toRaw)).toEqual([
      toRaw(view),
      toRaw(newForm)
    ])
  })

  it('replaces stale route components at their level', async () => {
    const admin = await mountAdmin({
      views: {
        books: { type: 'view', components: { title: { type: 'text' } } },
        authors: { type: 'view', components: { name: { type: 'text' } } }
      }
    })
    await admin.navigate('/books')
    const view = admin.getRouteComponent(it => it.isView)
    // Replace the view with a component that is never unmounted, as happens
    // with hot-reloading:
    const staleView = { isView: true }
    appState.routeComponents[0] = staleView
    await admin.navigate('/authors')
    expect(view.$.isUnmounted).toBe(true)
    const authorsView = admin.getRouteComponent(it => it.isView)
    expect(authorsView.name).toBe('authors')
    expect(appState.routeComponents.map(toRaw)).toEqual([toRaw(authorsView)])
  })
})
