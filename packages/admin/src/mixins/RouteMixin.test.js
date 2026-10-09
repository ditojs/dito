import {
  mountAdmin,
  mountForm,
  settle,
  enterValue,
  stubConfirm
} from '../test/mount.js'
import { toRaw } from 'vue'
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

  it('removes only itself from the route components when unmounted', async () => {
    const admin = await mountAdmin({
      views: {
        books: { type: 'view', components: { title: { type: 'text' } } },
        authors: { type: 'view', components: { name: { type: 'text' } } }
      }
    })
    await admin.navigate('/books')
    const view = admin.getRouteComponent(it => it.isView)
    const other = { isView: false }
    // Remove the view from the stack, as `DitoRoot` does on hot-reloading:
    appState.routeComponents = [other]
    await admin.navigate('/authors')
    expect(view.$.isUnmounted).toBe(true)
    const authorsView = admin.getRouteComponent(it => it.isView)
    expect(authorsView.name).toBe('authors')
    expect(appState.routeComponents.map(toRaw)).toEqual([
      other,
      toRaw(authorsView)
    ])
  })
})
