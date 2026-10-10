import { vi } from 'vitest'
import { flushPromises, DOMWrapper } from '@vue/test-utils'
import {
  mountAdmin,
  mountForm,
  mountSchema,
  settle,
  enterValue
} from '../test/mount.js'

const maliciousName = '<img src="x" onerror="alert(1)">'
const escapedName = '&lt;img src=&quot;x&quot; onerror=&quot;alert(1)&quot;&gt;'

async function mountBookForm(request) {
  const result = await mountForm({
    schema: {
      label: 'Book',
      components: { name: { type: 'text' } }
    },
    data: { name: maliciousName },
    request
  })
  // The form notifies through the root component, see `DitoMixin.notify()`:
  const notify = vi.spyOn(result.admin.root, 'notify')
  return { ...result, notify }
}

describe('DitoForm', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('labels the form with the text of its item label', async () => {
    const { wrapper } = await mountForm({
      schema: {
        label: 'Show',
        components: { name: { type: 'text' } }
      },
      data: { name: 'Tom & Jerry' }
    })
    expect(wrapper.find('form.dito-scroll-parent').attributes('aria-label'))
      .toBe(`Show 'Tom & Jerry'`)
  })

  describe('submit()', () => {
    it('notifies the success with the escaped item label', async () => {
      const { submit, notify } = await mountBookForm(({ data }) => ({ data }))
      await submit()
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          html: `Book '${escapedName}' was saved.`
        })
      )
    })

    it('renders the item label in the notification', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {})
      const { submit } = await mountBookForm(({ data }) => ({ data }))
      await submit()
      await flushPromises()
      const notification = document.querySelector('.dito-notification')
      expect(notification.querySelector('img')).toBe(null)
      expect(notification.querySelector('p').textContent).toBe(
        `Book '${maliciousName}' was saved.`
      )
    })

    it('notifies errors with the escaped item label and message', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const { submit, notify } = await mountBookForm(() => {
        throw new Error('<b>Invalid</b>')
      })
      await submit()
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          html: [
            `Unable to save Book '${escapedName}':`,
            '&lt;b&gt;Invalid&lt;/b&gt;'
          ]
        })
      )
    })
  })

  describe('cancel button', () => {
    it('closes the form and returns to the list', async () => {
      const { admin, wrapper, request } = await mountForm({
        schema: { label: 'Book', components: { title: { type: 'text' } } },
        data: { title: 'Emma' }
      })
      expect(admin.router.currentRoute.value.path).toBe('/items/1')
      await wrapper
        .find('.dito-buttons--main button[aria-label="Cancel"]')
        .trigger('click')
      await flushPromises()
      expect(admin.router.currentRoute.value.path).toBe('/items')
      expect(admin.getRouteComponent(component => component.isForm)).toBe(
        null
      )
      // Cancelling doesn't send anything:
      expect(
        request.mock.calls.filter(([{ method = 'get' }]) => method !== 'get')
      ).toEqual([])
    })
  })

  it('reloads the data when navigating to another item', async () => {
    const books = {
      1: { id: 1, title: 'Emma' },
      2: { id: 2, title: 'Persuasion' }
    }
    const { admin, routeComponent, findField } = await mountForm({
      schema: { components: { title: { type: 'text' } } },
      data: books[1],
      request: ({ method = 'get', url }) => {
        const id = url.match(/^\/items\/(\d+)$/)?.[1]
        if (method === 'get' && books[id]) return { data: books[id] }
        throw new Error(`Unexpected request: ${method} ${url}`)
      }
    })
    expect(findField('title').find('input').element.value).toBe('Emma')
    await admin.navigate('/items/2')
    const form = admin.getRouteComponent(component => component.isForm)
    await settle(form)
    // The same form stays open and loads the other item:
    expect(form).toBe(routeComponent)
    expect(form.data).toMatchObject({ id: 2, title: 'Persuasion' })
    expect(findField('title').find('input').element.value).toBe('Persuasion')
  })

  describe('applyCleanChanges()', () => {
    async function mountPublishableForm(publish) {
      return mountForm({
        schema: {
          components: {
            title: { type: 'text' },
            status: { type: 'text' }
          },
          buttons: {
            publish: {
              type: 'button',
              label: 'Publish',
              events: { click: publish }
            }
          }
        },
        data: { title: 'Emma', status: 'draft' }
      })
    }

    const clickPublish = async ({ findField, settle }) => {
      await findField('publish').trigger('click')
      await settle()
    }

    it('applies changes that keep the form clean', async () => {
      const result = await mountPublishableForm(
        ({ formComponent, item }) =>
          formComponent.applyCleanChanges(() => {
            item.status = 'published'
          })
      )
      await clickPublish(result)
      expect(result.data.status).toBe('published')
      expect(result.findField('status').find('input').element.value).toBe(
        'published'
      )
      expect(result.routeComponent.isDirty).toBe(false)
    })

    it('makes the form dirty with plain changes', async () => {
      const result = await mountPublishableForm(({ item }) => {
        item.status = 'published'
      })
      await clickPublish(result)
      expect(result.data.status).toBe('published')
      expect(result.routeComponent.isDirty).toBe(true)
    })
  })

  describe('submit() of items of lists in forms', () => {
    const createNestedListSchema = label => ({
      type: 'list',
      resource: { path: label.toLowerCase() },
      editable: true,
      itemLabel: 'name',
      columns: { name: {} },
      form: {
        type: 'form',
        label,
        components: { name: { type: 'text' } }
      }
    })

    it('reloads the list of the saved item', async () => {
      const { admin, findField, settle } = await mountForm({
        schema: {
          components: {
            notes: createNestedListSchema('Note'),
            tags: createNestedListSchema('Tag')
          }
        },
        data: { title: 'Emma' },
        request: ({ method = 'get', url, data }) => {
          if (method === 'get' && url.endsWith('/1')) {
            return { data: { id: 1, name: 'Draft' } }
          }
          return { data: method === 'get' ? [{ id: 1, name: 'Draft' }] : data }
        }
      })
      await findField('tags').find('.dito-button--edit').trigger('click')
      await settle()
      expect(admin.router.currentRoute.value.path).toBe('/items/1/tags/1')
      const getListLoads = () =>
        admin.request.mock.calls
          .map(([{ method = 'get', url }]) => `${method} ${url}`)
          .filter(call => /^get .*\/(note|tag)$/.test(call))
      const loads = getListLoads()
      await admin.wrapper
        .find('.dito-buttons--main button[type="submit"]')
        .trigger('click')
      await settle()
      expect(admin.router.currentRoute.value.path).toBe('/items/1')
      expect(getListLoads().slice(loads.length)).toEqual([
        'get /items/1/tag'
      ])
    })
  })

  describe('nested forms of items in the form data', () => {
    const chapterForm = {
      type: 'form',
      label: 'Chapter',
      components: { title: { type: 'text' } }
    }

    // Mounts a book form whose chapters and author are edited in nested forms,
    // which apply their changes to the data of the book form.
    async function mountBookForm({ chapters = [], author = null } = {}) {
      const result = await mountForm({
        schema: {
          label: 'Book',
          components: {
            title: { type: 'text' },
            chapters: {
              type: 'list',
              editable: true,
              creatable: true,
              itemLabel: 'title',
              form: chapterForm
            },
            author: {
              type: 'object',
              editable: true,
              creatable: true,
              form: {
                type: 'form',
                label: 'Author',
                components: { name: { type: 'text' } }
              }
            }
          }
        },
        data: { title: 'Emma', chapters, author }
      })
      const notify = vi.spyOn(result.admin.root, 'notify')
      return { ...result, notify }
    }

    async function openNestedForm(admin, path) {
      await admin.navigate(path)
      const form = admin.getRouteComponent(component => component.isForm)
      await settle(form)
      return form
    }

    // Enters `value` into the only input of the nested `form`, and submits the
    // form with its own submit button.
    async function submitNestedForm(form, value) {
      const element = new DOMWrapper(form.$el)
      await enterValue(element.find('input'), value)
      await settle(form)
      await element
        .find('.dito-buttons--main button[type="submit"]')
        .trigger('click')
      await settle(form)
    }

    it('applies the changes of an item to the data of the form', async () => {
      const { admin, data, notify, routeComponent } = await mountBookForm({
        chapters: [{ title: 'Prologue' }]
      })
      const form = await openNestedForm(admin, '/items/1/chapters/0')
      expect(form.isTransient).toBe(true)
      expect(form.data).toEqual({ title: 'Prologue' })
      await submitNestedForm(form, 'Opening')
      expect(data.chapters).toEqual([{ title: 'Opening' }])
      expect(admin.router.currentRoute.value.path).toBe('/items/1')
      // The applied changes make the book form dirty, not saved:
      expect(routeComponent.isDirty).toBe(true)
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          title: 'Change Applied',
          html: [
            `Changes to Chapter 'Opening' were applied.`,
            expect.stringContaining('<b>Note</b>')
          ]
        })
      )
    })

    it('applies the response of buttons with resources', async () => {
      const { admin, data } = await mountForm({
        schema: {
          components: {
            chapters: {
              type: 'list',
              editable: true,
              itemLabel: 'title',
              form: {
                ...chapterForm,
                buttons: {
                  proofread: {
                    type: 'submit',
                    text: 'Proofread',
                    resource: { path: '/proofread', method: 'post' }
                  }
                }
              }
            }
          }
        },
        data: { chapters: [{ title: 'prologue' }] },
        request: ({ method, url, data }) =>
          method === 'post' && url === '/proofread'
            ? { data: { title: data.title.toUpperCase() } }
            : null
      })
      const form = await openNestedForm(admin, '/items/1/chapters/0')
      await new DOMWrapper(form.$el)
        .find('button[id$="proofread"]')
        .trigger('click')
      await settle(form)
      expect(data.chapters).toEqual([{ title: 'PROLOGUE' }])
      // Unlike the submit button, other buttons don't close the form:
      expect(admin.router.currentRoute.value.path).toBe('/items/1/chapters/0')
      expect(form.data).toEqual({ title: 'PROLOGUE' })
    })

    it('adds created items to the list in the data of the form', async () => {
      const { admin, data, notify } = await mountBookForm({
        chapters: [{ title: 'Prologue' }]
      })
      const form = await openNestedForm(admin, '/items/1/chapters/create')
      expect(form.isCreating).toBe(true)
      await submitNestedForm(form, 'Epilogue')
      expect(data.chapters).toEqual([
        { title: 'Prologue' },
        { title: 'Epilogue' }
      ])
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          title: 'Item Added',
          html: [`Chapter 'Epilogue' was added.`, expect.any(String)]
        })
      )
    })

    it(`notifies the error when the list to add to is missing`, async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const { admin, data, notify } = await mountBookForm({ chapters: null })
      const form = await openNestedForm(admin, '/items/1/chapters/create')
      await submitNestedForm(form, 'Epilogue')
      expect(data.chapters).toBe(null)
      // The form stays open with the entered data:
      expect(admin.router.currentRoute.value.path).toBe(
        '/items/1/chapters/create'
      )
      expect(form.data).toEqual({ title: 'Epilogue' })
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          error: 'Could not submit transient item',
          html: `Unable to add Chapter 'Epilogue'.`
        })
      )
    })

    it('redirects missing objects to their create route', async () => {
      const { admin, data } = await mountBookForm({ author: null })
      const form = await openNestedForm(admin, '/items/1/author')
      expect(admin.router.currentRoute.value.path).toBe(
        '/items/1/author/create'
      )
      expect(form.isCreating).toBe(true)
      expect(form.data).toEqual({ name: null })
      await submitNestedForm(form, 'Jane Austen')
      expect(data.author).toEqual({ name: 'Jane Austen' })
      expect(admin.router.currentRoute.value.path).toBe('/items/1')
    })

    it('edits existing objects at their own route', async () => {
      const { admin, data } = await mountBookForm({
        author: { name: 'Jane' }
      })
      const form = await openNestedForm(admin, '/items/1/author')
      expect(form.isCreating).toBe(false)
      expect(form.data).toEqual({ name: 'Jane' })
      await submitNestedForm(form, 'Jane Austen')
      expect(data.author).toEqual({ name: 'Jane Austen' })
    })
  })

  describe('submit() of new items', () => {
    it('opens the created item unless the form closes', async () => {
      const { admin, submit, routeComponent } = await mountForm({
        schema: {
          components: { title: { type: 'text' } },
          buttons: { submit: { closeForm: false } }
        },
        request: ({ method, data }) =>
          method === 'post' ? { data: { id: 7, ...data } } : null
      })
      expect(routeComponent.isCreating).toBe(true)
      await enterValue(admin.wrapper.find('input[name="title"]'), 'Emma')
      expect(await submit()).toEqual({ title: 'Emma' })
      await flushPromises()
      expect(admin.router.currentRoute.value.path).toBe('/items/7')
    })

    // `setData()` already put the created item in place, see the `$route`
    // watcher, so opening it doesn't load it again:
    it('opens the created item without loading it', async () => {
      const { admin, submit, routeComponent, request } = await mountForm({
        schema: {
          components: { title: { type: 'text' } },
          buttons: { submit: { closeForm: false } }
        },
        request: ({ method, data }) =>
          method === 'post' ? { data: { id: 7, ...data } } : null
      })
      await enterValue(admin.wrapper.find('input[name="title"]'), 'Emma')
      await submit()
      await settle(routeComponent)
      expect(admin.router.currentRoute.value.path).toBe('/items/7')
      expect(admin.getRouteComponent(component => component.isForm)).toBe(
        routeComponent
      )
      expect(routeComponent.isCreating).toBe(false)
      expect(routeComponent.data).toEqual({ id: 7, title: 'Emma' })
      const itemRequests = request.mock.calls
        .map(([{ method = 'get', url }]) => [method, url])
        .filter(([, url]) => url.startsWith('/items'))
      expect(itemRequests).toEqual([['post', '/items']])
    })
  })

  describe('selectedTab', () => {
    it('is the tab selected in the main schema', async () => {
      const { routeComponent, schemaComponent } = await mountForm({
        schema: {
          tabs: {
            details: { type: 'tab', components: { title: { type: 'text' } } },
            reviews: { type: 'tab', components: { rating: { type: 'number' } } }
          }
        },
        data: { title: 'Emma', rating: 5 }
      })
      expect(routeComponent.selectedTab).toBe('details')
      schemaComponent.selectTab('reviews')
      expect(routeComponent.selectedTab).toBe('reviews')
    })

    it('is null without tabs', async () => {
      const { routeComponent } = await mountForm({
        schema: { components: { title: { type: 'text' } } },
        data: { title: 'Emma' }
      })
      expect(routeComponent.selectedTab).toBe(null)
    })
  })

  describe('nested forms of items in views', () => {
    const recipesSchema = {
      type: 'list',
      editable: true,
      itemLabel: 'name',
      form: {
        type: 'form',
        label: 'Recipe',
        components: { name: { type: 'text' } }
      }
    }

    async function submitChanges(form, name) {
      const element = new DOMWrapper(form.$el)
      await enterValue(element.find('input'), name)
      await element
        .find('.dito-buttons--main button[type="submit"]')
        .trigger('click')
      await settle(form)
    }

    // The data path of the nested form is relative to the data of the view,
    // without the path of the view, see `getDataPathFrom()`.
    it('apply their changes to the data of the view', async () => {
      const { admin, data } = await mountSchema({
        schema: {
          components: {
            recipes: recipesSchema,
            // Views with resources provide the data of their nested forms:
            cooks: {
              type: 'list',
              resource: { path: 'cooks' },
              columns: { name: {} }
            }
          }
        },
        data: { recipes: [{ name: 'Pancakes' }] },
        request: () => ({ data: [] })
      })
      await admin.navigate('/test/recipes/0')
      const form = admin.getRouteComponent(component => component.isForm)
      await settle(form)
      expect(form.parentRouteComponent.isView).toBe(true)
      expect(form.dataPath).toBe('recipes/0')
      await submitChanges(form, 'Waffles')
      expect(data.recipes).toEqual([{ name: 'Waffles' }])
    })

    // Without a resource in the view, the nested form has no data component,
    // and its data path is relative to the data of the view.
    it('open in views without resources', async () => {
      const { admin, data } = await mountSchema({
        schema: { components: { recipes: recipesSchema } },
        data: { recipes: [{ name: 'Pancakes' }] }
      })
      await admin.navigate('/test/recipes/0')
      const form = admin.getRouteComponent(component => component.isForm)
      await settle(form)
      expect(form.dataComponent).toBe(null)
      expect(form.dataPath).toBe('recipes/0')
      expect(new DOMWrapper(form.$el).find('input').element.value).toBe(
        'Pancakes'
      )
      await submitChanges(form, 'Waffles')
      expect(data.recipes).toEqual([{ name: 'Waffles' }])
    })

    // Single-component views store the data of their component under the
    // view's name, also when the view's path differs from it.
    it('find their item in single-component views by name', async () => {
      const admin = await mountAdmin({
        views: {
          recipes: {
            type: 'view',
            path: 'cookbook',
            component: recipesSchema
          }
        }
      })
      await admin.navigate('/cookbook')
      const view = admin.getRouteComponent(component => component.isView)
      view.setData({ recipes: [{ name: 'Pancakes' }] })
      await settle(view)
      await admin.navigate('/cookbook/0')
      const form = admin.getRouteComponent(component => component.isForm)
      await settle(form)
      expect(form.dataPath).toBe('recipes/0')
      await submitChanges(form, 'Waffles')
      expect(view.data.recipes).toEqual([{ name: 'Waffles' }])
    })

    // Views in menus are nested in the route components of the menus, but
    // the data paths of their forms are relative to the view's data.
    it('find their item in views in menus', async () => {
      const admin = await mountAdmin({
        views: {
          kitchen: {
            type: 'menu',
            label: 'Kitchen',
            items: {
              cookbook: {
                type: 'view',
                components: { recipes: recipesSchema }
              }
            }
          }
        }
      })
      await admin.navigate('/kitchen/cookbook')
      const view = admin.getRouteComponent(
        component => component.isView && component.name === 'cookbook'
      )
      view.setData({ recipes: [{ name: 'Pancakes' }] })
      await settle(view)
      await admin.navigate('/kitchen/cookbook/recipes/0')
      const form = admin.getRouteComponent(component => component.isForm)
      await settle(form)
      expect(form.dataPath).toBe('recipes/0')
      await submitChanges(form, 'Waffles')
      expect(view.data.recipes).toEqual([{ name: 'Waffles' }])
    })

    // The data paths of the form's components are relative to the data of
    // the view, which is their root item also when the view has no resource.
    describe('without resources', () => {
      const recipesWithKitchenSchema = {
        ...recipesSchema,
        form: {
          ...recipesSchema.form,
          components: {
            ...recipesSchema.form.components,
            kitchen: {
              type: 'text',
              compute: ({ rootItem }) => rootItem?.venue ?? null
            }
          }
        }
      }

      function expectItemsOfComponents(form, view) {
        const recipe = view.data.recipes[0]
        const name =
          form.mainSchemaComponent.getComponentByDataPath(
            'recipes/0/name'
          )
        expect(form.rootData).toBe(view.data)
        expect(name.rootItem).toBe(view.data)
        expect(name.context.rootItem).toBe(view.data)
        expect(name.context.parentItem).toBe(view.data)
        expect(name.context.item).toBe(form.data)
        expect(form.data).toEqual({ ...recipe, kitchen: 'Bakery' })
      }

      it('provide the root item in multi-component views', async () => {
        const { admin, routeComponent: view } = await mountSchema({
          schema: {
            components: {
              venue: { type: 'text' },
              recipes: recipesWithKitchenSchema
            }
          },
          data: { venue: 'Bakery', recipes: [{ name: 'Pancakes' }] }
        })
        await admin.navigate('/test/recipes/0')
        const form = admin.getRouteComponent(component => component.isForm)
        await settle(form)
        expectItemsOfComponents(form, view)
      })

      it('provide the root item in single-component views', async () => {
        const admin = await mountAdmin({
          views: {
            recipes: {
              type: 'view',
              path: 'cookbook',
              component: recipesWithKitchenSchema
            }
          }
        })
        await admin.navigate('/cookbook')
        const view = admin.getRouteComponent(component => component.isView)
        view.setData({ venue: 'Bakery', recipes: [{ name: 'Pancakes' }] })
        await settle(view)
        await admin.navigate('/cookbook/0')
        const form = admin.getRouteComponent(component => component.isForm)
        await settle(form)
        expectItemsOfComponents(form, view)
      })
    })
  })

  describe('nested forms with `mutate`', () => {
    it('edit the item in the data of the parent form directly', async () => {
      const { admin, data, routeComponent } = await mountForm({
        schema: {
          components: {
            chapters: {
              type: 'list',
              editable: true,
              itemLabel: 'title',
              mutate: true,
              form: {
                type: 'form',
                components: { title: { type: 'text' } }
              }
            }
          }
        },
        data: { chapters: [{ title: 'Prologue' }] }
      })
      await admin.navigate('/items/1/chapters/0')
      const form = admin.getRouteComponent(component => component.isForm)
      await settle(form)
      expect(form.isMutating).toBe(true)
      expect(form.data).toBe(data.chapters[0])
      await enterValue(new DOMWrapper(form.$el).find('input'), 'Opening')
      await settle(form)
      expect(data.chapters).toEqual([{ title: 'Opening' }])
      // The changes make the form that owns the data dirty:
      expect(form.isDirty).toBe(false)
      expect(routeComponent.isDirty).toBe(true)
      // Mutating forms don't have a submit button, only the cancel button:
      expect(
        new DOMWrapper(form.$el)
          .find('.dito-buttons--main button[type="submit"]')
          .exists()
      ).toBe(false)
    })
  })

  // Navigating from an item to the create route in the same form doesn't load
  // the collection resource, see the `$route` watcher, but sets up a new item.
  it('sets up a new item when navigating to its create route', async () => {
    const { admin, routeComponent } = await mountForm({
      schema: { components: { title: { type: 'text' } } },
      data: { title: 'Emma' }
    })
    await admin.navigate('/items/create')
    const form = admin.getRouteComponent(component => component.isForm)
    await settle(form)
    // The same form stays open and creates the new item:
    expect(form).toBe(routeComponent)
    expect(form.isCreating).toBe(true)
    expect(form.loadedData).toBe(null)
    expect(form.isDirty).toBe(false)
    expect(form.data).toEqual({ title: null })
  })

  // The load of the item that the form left is still pending, and mustn't
  // replace the new item when it completes, which would then be submitted:
  it('drops the pending load of an item when creating one', async () => {
    const pendingLoad = Promise.withResolvers()
    const { admin, routeComponent } = await mountForm({
      schema: { components: { title: { type: 'text' } } },
      data: { title: 'Emma' },
      request: ({ method = 'get', url }) => {
        if (method === 'get' && url === '/items/2') return pendingLoad.promise
        throw new Error(`Unexpected request: ${method} ${url}`)
      }
    })
    await admin.navigate('/items/2')
    await admin.navigate('/items/create')
    pendingLoad.resolve({ data: { id: 2, title: 'Persuasion' } })
    await settle(routeComponent)
    expect(routeComponent.isCreating).toBe(true)
    expect(routeComponent.loadedData).toBe(null)
    expect(routeComponent.data).toEqual({ title: null })
  })

  it('loads the item when navigating to it from the create route', async () => {
    const { admin, routeComponent } = await mountForm({
      schema: { components: { title: { type: 'text' } } },
      request: ({ method = 'get', url }) => {
        if (method === 'get' && url === '/items/1') {
          return { data: { id: 1, title: 'Emma' } }
        }
        throw new Error(`Unexpected request: ${method} ${url}`)
      }
    })
    expect(routeComponent.isCreating).toBe(true)
    await admin.navigate('/items/1')
    const form = admin.getRouteComponent(component => component.isForm)
    await settle(form)
    expect(form.isCreating).toBe(false)
    expect(form.data).toEqual({ id: 1, title: 'Emma' })
  })

  it('creates the item of the type given by the route query', async () => {
    const admin = await mountAdmin({
      views: {
        blocks: {
          type: 'view',
          component: {
            type: 'list',
            resource: { path: 'blocks' },
            forms: {
              heading: {
                type: 'form',
                components: { text: { type: 'text' } }
              },
              image: {
                type: 'form',
                components: { url: { type: 'url' } }
              }
            }
          }
        }
      },
      request: () => ({ data: [] })
    })
    await admin.navigate('/blocks/create?type=image')
    const form = admin.getRouteComponent(component => component.isForm)
    await settle(form)
    expect(form.creationType).toBe('image')
    expect(form.data).toEqual({ type: 'image', url: null })
  })

  it('submits without validation with `validate: false`', async () => {
    const { wrapper, routeComponent, request, settle } = await mountForm({
      schema: {
        components: { title: { type: 'text', required: true } },
        buttons: { submit: { closeForm: false } }
      },
      data: { title: '' },
      request: ({ data }) => ({ data })
    })
    const button = wrapper
      .findAllComponents({ name: 'DitoTypeButton' })
      .find(({ vm }) => vm.schema.type === 'submit').vm
    expect(await routeComponent.submit(button)).toBe(false)
    expect(await routeComponent.submit(button, { validate: false })).toBe(
      true
    )
    await settle()
    expect(
      request.mock.calls.filter(([{ method }]) => method === 'patch')
    ).toHaveLength(1)
  })

  // Errors of responses without a message, e.g. `{ type: 'ServerError' }`,
  // aren't shown as their object's string, "[object Object]":
  it('notifies errors without a message without the object', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { submit, notify } = await mountBookForm(() => {
      throw Object.assign(new Error('Request failed'), {
        response: { status: 500, data: { type: 'ServerError' } }
      })
    })
    await submit()
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'error',
        html: `Unable to save Book '${escapedName}'.`
      })
    )
  })
})
