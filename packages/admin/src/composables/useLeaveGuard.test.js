import { vi } from 'vitest'
import {
  mountAdmin,
  mountForm,
  settle,
  enterValue,
  stubConfirm,
  isView,
  isForm
} from '../test/mount.js'
import { flushPromises } from '@vue/test-utils'

describe('useLeaveGuard()', () => {
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
      expect(routeComponent.routeContext.isDirty).toBe(true)
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
            components: { title: { type: 'text' } },
            buttons: { save: { type: 'submit' } }
          },
          'books-archive': {
            type: 'view',
            components: { title: { type: 'text' } }
          }
        }
      })
      await admin.navigate('/books')
      const view = admin.getRouteComponent(isView)
      await enterValue(admin.wrapper.find('input[name="title"]'), 'Emma')
      expect(view.routeContext.isDirty).toBe(true)
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
      const view = admin.getRouteComponent(isView)
      // The deletion is persisted, so the view has no changes to save:
      expect(view.routeContext.isDirty).toBe(false)
      await admin.navigate('/authors')
      expect(confirm).toHaveBeenCalledOnce()
      expect(admin.router.currentRoute.value.path).toBe('/authors')
    })

    it(`doesn't ask when leaving a view after submitting its changes`, async () => {
      const confirm = stubConfirm(true)
      const books = [
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
              draggable: true,
              orderKey: 'position',
              columns: { title: {} },
              buttons: {
                saveOrder: {
                  type: 'submit',
                  label: 'Save Order',
                  resource: { path: 'order', method: 'post' }
                }
              }
            }
          },
          authors: {
            type: 'view',
            components: { name: { type: 'text' } }
          }
        },
        request: ({ method = 'get', url, data }) =>
          method === 'get' && url === '/books'
            ? { data: books }
            : { data }
      })
      await admin.navigate('/books')
      const view = admin.getRouteComponent(isView)
      await admin.wrapper
        .findAll('.dito-button--drag')[0]
        .trigger('keydown', { key: 'ArrowDown', altKey: true })
      await settle(view)
      expect(view.routeContext.isDirty).toBe(true)
      await admin.wrapper.find('button[id$="saveOrder"]').trigger('click')
      await settle(view)
      expect(admin.request).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'post', url: '/books/order' })
      )
      expect(view.routeContext.isDirty).toBe(false)
      await admin.navigate('/authors')
      expect(confirm).not.toHaveBeenCalled()
      expect(admin.router.currentRoute.value.path).toBe('/authors')
    })

    it(`doesn't ask when leaving a view whose list can't save its order`, async () => {
      const confirm = stubConfirm(true)
      const onChange = vi.fn()
      const admin = await mountAdmin({
        views: {
          books: {
            type: 'view',
            component: {
              type: 'list',
              resource: { path: 'books' },
              draggable: true,
              orderKey: 'position',
              columns: { title: {} },
              // E.g. to save the order through an action of the app:
              onChange
            }
          },
          authors: {
            type: 'view',
            components: { name: { type: 'text' } }
          }
        },
        request: () => ({
          data: [
            { id: 1, title: 'Dune' },
            { id: 2, title: 'Emma' }
          ]
        })
      })
      await admin.navigate('/books')
      const view = admin.getRouteComponent(isView)
      await admin.wrapper
        .findAll('.dito-button--drag')[0]
        .trigger('keydown', { key: 'ArrowDown', altKey: true })
      await settle(view)
      expect(onChange).toHaveBeenCalledOnce()
      expect(view.routeContext.isDirty).toBe(false)
      await admin.navigate('/authors')
      expect(confirm).not.toHaveBeenCalled()
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
      expect(admin.getRouteComponent(isForm)).toBe(routeComponent)
    })

    describe('leaving while submitting', () => {
      // Mounts a create form whose submit request resolves or rejects once the
      // test settles it through the returned `response`:
      const mountSubmittingForm = async () => {
        const response = Promise.withResolvers()
        const result = await mountForm({
          schema: {
            components: { title: { type: 'text' } },
            // Stay in the form, to be redirected to the created item:
            buttons: { submit: { closeForm: false } }
          },
          request: ({ method = 'get', url }) =>
            method === 'post'
              ? response.promise
              : url === '/items/5'
                ? { data: { id: 5, title: 'Emma' } }
                : null
        })
        const { wrapper, routeComponent } = result
        await enterValue(wrapper.find('input[name="title"]'), 'Dune')
        await settle(routeComponent)
        await wrapper
          .find('.dito-buttons--main button[type="submit"]')
          .trigger('click')
        await flushPromises()
        expect(routeComponent.routeContext.isDirty).toBe(true)
        return { ...result, response }
      }

      it(`leaves without asking once the submit succeeded`, async () => {
        const confirm = stubConfirm(false)
        const { admin, response } = await mountSubmittingForm()
        const navigation = admin.router.push('/items')
        await flushPromises()
        expect(admin.router.currentRoute.value.path).toBe('/items/create')
        response.resolve({ data: { id: 1, title: 'Dune' } })
        await navigation
        await flushPromises()
        expect(confirm).not.toHaveBeenCalled()
        expect(admin.router.currentRoute.value.path).toBe('/items')
      })

      it('asks once the submit failed', async () => {
        const confirm = stubConfirm(false)
        const { admin, routeComponent, response } = await mountSubmittingForm()
        const navigation = admin.router.push('/items')
        await flushPromises()
        expect(confirm).not.toHaveBeenCalled()
        response.reject(new Error('Server unavailable'))
        await navigation
        await flushPromises()
        expect(confirm).toHaveBeenCalledOnce()
        expect(admin.router.currentRoute.value.path).toBe('/items/create')
        expect(routeComponent.routeContext.isDirty).toBe(true)
      })

      it('opens the created item when the navigation is aborted', async () => {
        const { admin, routeComponent, response } = await mountSubmittingForm()
        admin.router.beforeEach(to => to.path !== '/items')
        const navigation = admin.router.push('/items')
        await flushPromises()
        response.resolve({ data: { id: 1, title: 'Dune' } })
        await navigation
        await flushPromises()
        expect(admin.router.currentRoute.value.path).toBe('/items/1')
        expect(routeComponent.dataContext.isCreating).toBe(false)
      })

      it('opens the created item when the navigation is superseded', async () => {
        const { admin, routeComponent, response } = await mountSubmittingForm()
        const navigation = admin.router.push('/items')
        await flushPromises()
        // A navigation that stays in the form, e.g. to a tab:
        await admin.router.push('/items/create#details')
        response.resolve({ data: { id: 1, title: 'Dune' } })
        await navigation
        await flushPromises()
        expect(admin.router.currentRoute.value.fullPath).toBe(
          '/items/1#details'
        )
        expect(routeComponent.dataContext.isCreating).toBe(false)
      })

      it('opens the created item when the navigation is redirected', async () => {
        const { admin, response } = await mountSubmittingForm()
        // Redirect to a location that stays in the form, e.g. a tab:
        admin.router.beforeEach(to =>
          to.path === '/items'
            ? { path: '/items/create', hash: '#notes' }
            : true
        )
        const navigation = admin.router.push('/items')
        await flushPromises()
        response.resolve({ data: { id: 1, title: 'Dune' } })
        await navigation
        await flushPromises()
        expect(admin.router.currentRoute.value.fullPath).toBe('/items/1#notes')
      })

      // A hanging save mustn't block leaving: after a while, the guard asks.
      it('asks once the submit takes too long', async () => {
        const confirm = stubConfirm(false)
        const { admin, response } = await mountSubmittingForm()
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        const navigation = admin.router.push('/items')
        await flushPromises()
        expect(confirm).not.toHaveBeenCalled()
        await vi.advanceTimersByTimeAsync(30_000)
        vi.useRealTimers()
        await navigation
        await flushPromises()
        expect(confirm).toHaveBeenCalledOnce()
        expect(admin.router.currentRoute.value.path).toBe('/items/create')
        response.reject(new Error('Server unavailable'))
      })

      it('waits for the last navigation that waits for the submit', async () => {
        const confirm = stubConfirm(false)
        const { admin, response } = await mountSubmittingForm()
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        const first = admin.router.push('/items')
        await flushPromises()
        await vi.advanceTimersByTimeAsync(20_000)
        // A second navigation, e.g. a click on the link again, waits too:
        const second = admin.router.push('/items')
        await flushPromises()
        // The first one gives up waiting, while the second still waits:
        await vi.advanceTimersByTimeAsync(10_000)
        vi.useRealTimers()
        await first
        expect(confirm).toHaveBeenCalledOnce()
        response.resolve({ data: { id: 1, title: 'Dune' } })
        await second
        await flushPromises()
        expect(admin.router.currentRoute.value.path).toBe('/items')
      })

      it(`doesn't open the created item after opening another one`, async () => {
        const { admin, routeComponent, response } = await mountSubmittingForm()
        const navigation = admin.router.push('/items/5')
        await flushPromises()
        response.resolve({ data: { id: 1, title: 'Dune' } })
        await navigation
        await flushPromises()
        expect(admin.router.currentRoute.value.path).toBe('/items/5')
        expect(routeComponent.data.title).toBe('Emma')
      })

      it(`doesn't close the form after opening another item`, async () => {
        const response = Promise.withResolvers()
        const { admin, wrapper, routeComponent } = await mountForm({
          schema: { components: { title: { type: 'text' } } },
          data: { title: 'Dune' },
          request: ({ method = 'get', url }) =>
            method === 'patch'
              ? response.promise
              : url === '/items/2'
                ? { data: { id: 2, title: 'Emma' } }
                : null
        })
        await enterValue(wrapper.find('input[name="title"]'), 'Dune Messiah')
        // Save & close:
        await wrapper
          .find('.dito-buttons--main button[type="submit"]')
          .trigger('click')
        await flushPromises()
        const navigation = admin.router.push('/items/2')
        await flushPromises()
        response.resolve({ data: { id: 1, title: 'Dune Messiah' } })
        await navigation
        await settle(routeComponent)
        expect(admin.router.currentRoute.value.path).toBe('/items/2')
        expect(routeComponent.data.title).toBe('Emma')
      })

      it(`doesn't merge a late response into another item`, async () => {
        stubConfirm(true)
        const { admin, routeComponent, response } = await mountSubmittingForm()
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        const navigation = admin.router.push('/items/5')
        await flushPromises()
        // Give up waiting for the submit, and discard it:
        await vi.advanceTimersByTimeAsync(30_000)
        vi.useRealTimers()
        await navigation
        await settle(routeComponent)
        expect(routeComponent.data.title).toBe('Emma')
        response.resolve({ data: { id: 1, title: 'Dune' } })
        await settle(routeComponent)
        expect(admin.router.currentRoute.value.path).toBe('/items/5')
        expect(routeComponent.data).toEqual({ id: 5, title: 'Emma' })
      })

      it(`doesn't clean up another item after a late response`, async () => {
        stubConfirm(true)
        const { admin, wrapper, routeComponent, response } =
          await mountSubmittingForm()
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        const navigation = admin.router.push('/items/5')
        await flushPromises()
        await vi.advanceTimersByTimeAsync(30_000)
        vi.useRealTimers()
        await navigation
        await settle(routeComponent)
        await enterValue(wrapper.find('input[name="title"]'), 'Emma Woodhouse')
        const dataContext = routeComponent.dataContext
        await dataContext.showValidationErrors({
          title: [{ message: 'is taken' }]
        })
        response.resolve({ data: { id: 1, title: 'Dune' } })
        await settle(routeComponent)
        expect(dataContext.model.getErrors('title')).toEqual([
          { message: 'is taken' }
        ])
        expect(routeComponent.routeContext.isDirty).toBe(true)
      })

      it('opens the created item after a guard threw', async () => {
        const { admin, routeComponent, response } = await mountSubmittingForm()
        admin.router.beforeEach(to => {
          if (to.path === '/items') {
            throw new Error('Unable to leave')
          }
        })
        const navigation = admin.router.push('/items').catch(error => error)
        await flushPromises()
        response.resolve({ data: { id: 1, title: 'Dune' } })
        expect(await navigation).toEqual(new Error('Unable to leave'))
        // The next navigation that stays in the form opens the created item:
        await admin.navigate('/items/create#notes')
        expect(admin.router.currentRoute.value.fullPath).toBe('/items/1#notes')
        expect(routeComponent.dataContext.isCreating).toBe(false)
      })

      it('opens the created item after endless redirects', async () => {
        const { admin, routeComponent, response } = await mountSubmittingForm()
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        admin.router.beforeEach(to => (to.path === '/items' ? '/items' : true))
        const navigation = admin.router.push('/items').catch(error => error)
        await flushPromises()
        response.resolve({ data: { id: 1, title: 'Dune' } })
        expect(await navigation).toEqual(
          new Error('Infinite redirect in navigation guard')
        )
        await admin.navigate('/items/create#notes')
        expect(admin.router.currentRoute.value.fullPath).toBe('/items/1#notes')
        expect(routeComponent.dataContext.isCreating).toBe(false)
      })
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
      expect(routeComponent.routeContext.isDirty).toBe(true)
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
      const chapterForm = admin.getRouteComponent(isForm)
      await settle(chapterForm)
      // The mounted fields are valid when they're left, unlike the field in
      // the collapsed section:
      for (const input of chapterForm.$el.querySelectorAll('input')) {
        input.dispatchEvent(new Event('blur'))
      }
      await settle(chapterForm)
      expect(chapterForm.$el.querySelector('.dito-errors li')).toBe(null)
      await settleForm()
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
})
