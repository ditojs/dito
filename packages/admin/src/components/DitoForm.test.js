import { vi } from 'vitest'
import { flushPromises, DOMWrapper } from '@vue/test-utils'
import {
  mountAdmin,
  mountForm,
  mountSchema,
  settle,
  enterValue,
  stubConfirm,
  isView,
  isForm
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
  // The form notifies through the admin context:
  const notify = vi.spyOn(result.admin.context, 'notify')
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
      expect(admin.getRouteComponent(isForm)).toBe(
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
    const form = admin.getRouteComponent(isForm)
    await settle(form)
    // The same form stays open and loads the other item:
    expect(form).toBe(routeComponent)
    expect(form.data).toMatchObject({ id: 2, title: 'Persuasion' })
    expect(findField('title').find('input').element.value).toBe('Persuasion')
  })

  describe('direct writes', () => {
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

    it(`don't make the form dirty`, async () => {
      // E.g. to apply what an action on the server already saved:
      const result = await mountPublishableForm(({ item }) => {
        item.status = 'published'
      })
      await clickPublish(result)
      expect(result.data.status).toBe('published')
      expect(result.findField('status').find('input').element.value).toBe(
        'published'
      )
      expect(result.routeComponent.ownRoute.isDirty).toBe(false)
    })

    it('make the form dirty with `context.markEdited()`', async () => {
      const result = await mountPublishableForm(({ item, markEdited }) => {
        item.status = 'published'
        markEdited()
      })
      await clickPublish(result)
      expect(result.data.status).toBe('published')
      expect(result.routeComponent.ownRoute.isDirty).toBe(true)
    })
  })

  describe('dirty state', () => {
    const titleSchema = { components: { title: { type: 'text' } } }

    it('stays dirty when an edit is reverted', async () => {
      const { wrapper, routeComponent, settle } = await mountForm({
        schema: titleSchema,
        data: { title: 'Emma' }
      })
      const input = wrapper.find('input[name="title"]')
      await enterValue(input, 'Persuasion')
      await enterValue(input, 'Emma')
      await settle()
      expect(routeComponent.ownRoute.isDirty).toBe(true)
    })

    it('is clean once the changes are saved', async () => {
      const { wrapper, routeComponent, settle, submit } = await mountForm({
        schema: {
          ...titleSchema,
          buttons: { submit: { closeForm: false } }
        },
        data: { title: 'Emma' },
        request: ({ data }) => ({ data: { id: 1, ...data } })
      })
      await enterValue(wrapper.find('input[name="title"]'), 'Persuasion')
      await settle()
      expect(routeComponent.ownRoute.isDirty).toBe(true)
      expect(await submit()).toEqual({ id: 1, title: 'Persuasion' })
      expect(routeComponent.ownRoute.isDirty).toBe(false)
    })

    it('is never dirty without a submit button', async () => {
      const confirm = stubConfirm(false)
      const { admin, wrapper, routeComponent, settle } = await mountForm({
        schema: { ...titleSchema, buttons: { submit: false } },
        data: { title: 'Emma' }
      })
      await enterValue(wrapper.find('input[name="title"]'), 'Persuasion')
      await settle()
      expect(routeComponent.ownRoute.isDirty).toBe(false)
      await admin.navigate('/items')
      expect(confirm).not.toHaveBeenCalled()
      expect(admin.router.currentRoute.value.path).toBe('/items')
    })

    it('is dirty with a submit button of another name', async () => {
      const { wrapper, routeComponent, settle } = await mountForm({
        schema: {
          ...titleSchema,
          buttons: { submit: false, save: { type: 'submit', label: 'Save' } }
        },
        data: { title: 'Emma' }
      })
      await enterValue(wrapper.find('input[name="title"]'), 'Persuasion')
      await settle()
      expect(routeComponent.ownRoute.isDirty).toBe(true)
    })

    it('stays clean when a component writes the value that it has', async () => {
      const form = await mountForm({
        schema: {
          components: {
            title: { type: 'text' },
            tags: { type: 'multiselect', options: ['novel', 'classic'] }
          },
          buttons: { submit: { closeForm: false } }
        },
        data: { title: 'Emma', tags: ['novel'] },
        request: ({ data }) => ({ data: { id: 1, ...data } })
      })
      // Components write their values through the data model:
      const write = (name, value) => form.dataModel.set(form.data, name, value)
      write('title', 'Emma')
      write('tags', ['novel'])
      await form.settle()
      expect(form.routeComponent.ownRoute.isDirty).toBe(false)
      write('title', 'Persuasion')
      await form.submit()
      // E.g. components that write their value again after the save:
      write('title', 'Persuasion')
      await form.settle()
      expect(form.routeComponent.ownRoute.isDirty).toBe(false)
    })

    it('keeps the edits of forms without a submit button when loading', async () => {
      const { wrapper, routeComponent, settle } = await mountForm({
        schema: { ...titleSchema, buttons: { submit: false } },
        data: { title: 'Emma' }
      })
      await enterValue(wrapper.find('input[name="title"]'), 'Persuasion')
      routeComponent.reloadData()
      await settle()
      expect(routeComponent.data.title).toBe('Persuasion')
    })

    describe('with lists that save their order through their resource', () => {
      async function mountChaptersForm() {
        const result = await mountForm({
          schema: {
            components: {
              title: { type: 'text' },
              chapters: {
                type: 'list',
                resource: { path: 'chapters' },
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
            buttons: { submit: { closeForm: false } }
          },
          data: { title: 'Emma' },
          request: ({ method = 'get', url, data }) =>
            method === 'get' && url === '/items/1/chapters'
              ? { data: [{ id: 1, title: 'One' }, { id: 2, title: 'Two' }] }
              : { data: { id: 1, ...data } }
        })
        const { findField, settle } = result
        await enterValue(findField('title').find('input'), 'Persuasion')
        await findField('chapters')
          .findAll('.dito-button--drag')[0]
          .trigger('keydown', { key: 'ArrowDown', altKey: true })
        await settle()
        return result
      }

      it('keep the edits of the form dirty once the list saved its order', async () => {
        const { wrapper, routeComponent, request, settle } =
          await mountChaptersForm()
        expect(routeComponent.ownRoute.isDirty).toBe(true)
        await wrapper.find('button[id$="saveOrder"]').trigger('click')
        await settle()
        expect(request).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'post',
            url: '/items/1/chapters/order'
          })
        )
        expect(routeComponent.ownRoute.isDirty).toBe(true)
      })

      it('stay dirty once the form is saved, until they save', async () => {
        const { wrapper, routeComponent, submit, settle } =
          await mountChaptersForm()
        // The form's save doesn't carry the order of the list:
        expect(await submit()).toMatchObject({ title: 'Persuasion' })
        expect(routeComponent.ownRoute.isDirty).toBe(true)
        await wrapper.find('button[id$="saveOrder"]').trigger('click')
        await settle()
        expect(routeComponent.ownRoute.isDirty).toBe(false)
      })
    })

    it('is dirty after items are added, moved or removed', async () => {
      stubConfirm(true)
      const { findField, routeComponent, data, settle } = await mountForm({
        schema: {
          components: {
            chapters: {
              type: 'list',
              inlined: true,
              creatable: true,
              draggable: true,
              deletable: true,
              form: { type: 'form', components: { title: { type: 'text' } } }
            }
          }
        },
        data: { chapters: [{ title: 'One' }, { title: 'Two' }] }
      })
      const { dataModel } = routeComponent
      const field = findField('chapters')
      const expectDirtyAfter = async (selector, event = 'click', options) => {
        expect(routeComponent.ownRoute.isDirty).toBe(false)
        await field.findAll(selector)[0].trigger(event, options)
        await settle()
        expect(routeComponent.ownRoute.isDirty).toBe(true)
        dataModel.markClean()
      }
      const getTitles = () => data.chapters.map(chapter => chapter.title)
      // The first create button inserts before the first item:
      await expectDirtyAfter('.dito-create-button button')
      expect(getTitles()).toEqual([null, 'One', 'Two'])
      await expectDirtyAfter('.dito-button--drag', 'keydown', {
        key: 'ArrowDown',
        altKey: true
      })
      expect(getTitles()).toEqual(['One', null, 'Two'])
      await expectDirtyAfter('.dito-button--remove')
      expect(data.chapters).toHaveLength(2)
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

  describe('saving', () => {
    // Mounts a book form with chapters edited in nested forms, and reviews
    // with their own resource. The server answers saves with `respond(data)`.
    function mountBookForm(respond = data => ({ id: 1, ...data })) {
      return mountForm({
        schema: {
          components: {
            title: { type: 'text' },
            chapters: {
              type: 'list',
              editable: true,
              itemLabel: 'title',
              form: {
                type: 'form',
                label: 'Chapter',
                components: { title: { type: 'text' } }
              }
            },
            reviews: {
              type: 'list',
              resource: { path: 'reviews' },
              columns: { text: {} }
            }
          },
          buttons: { submit: { closeForm: false } }
        },
        data: {
          title: 'Emma',
          chapters: [
            { id: 1, title: 'One' },
            { id: 2, title: 'Two' }
          ],
          reviews: [{ id: 1, text: 'Witty' }]
        },
        request: ({ method = 'get', url, data }) =>
          method === 'get'
            ? url.endsWith('/reviews')
              ? { data: [{ id: 1, text: 'Witty' }] }
              : null
            : { data: respond(data) }
      })
    }

    it('stays dirty with edits made while saving', async () => {
      const response = Promise.withResolvers()
      const { wrapper, routeComponent } = await mountForm({
        schema: {
          components: { title: { type: 'text' } },
          buttons: { submit: { closeForm: false } }
        },
        data: { title: 'Emma' },
        request: ({ method = 'get' }) =>
          method === 'patch' ? response.promise : null
      })
      await enterValue(wrapper.find('input[name="title"]'), 'Persuasion')
      await wrapper
        .find('.dito-buttons--main button[type="submit"]')
        .trigger('click')
      await flushPromises()
      const { dataModel, data } = routeComponent
      dataModel.set(data, 'title', 'Sanditon')
      // A response without data, which leaves the edit in place:
      response.resolve({})
      await settle(routeComponent)
      expect(data.title).toBe('Sanditon')
      expect(routeComponent.ownRoute.isDirty).toBe(true)
    })

    it('keeps the identity of the item and its lists and items', async () => {
      const { wrapper, routeComponent, submit } = await mountBookForm()
      const { data } = routeComponent
      const { chapters, reviews } = data
      const [first, second] = chapters
      await enterValue(wrapper.find('input[name="title"]'), 'Persuasion')
      await submit()
      expect(routeComponent.data).toBe(data)
      expect(data.chapters).toBe(chapters)
      expect(data.chapters[0]).toBe(first)
      expect(data.chapters[1]).toBe(second)
      // The response doesn't contain the reviews, which have their own
      // resource, so they're kept:
      expect(data.reviews).toBe(reviews)
      expect(data.reviews).toEqual([{ id: 1, text: 'Witty' }])
      expect(data.title).toBe('Persuasion')
      expect(routeComponent.ownRoute.isDirty).toBe(false)
    })

    it('gives new items their ids from the response in place', async () => {
      const { routeComponent, submit } = await mountBookForm(data => ({
        id: 1,
        ...data,
        chapters: data.chapters.map((chapter, index) => ({
          ...chapter,
          id: index + 1
        }))
      }))
      const { chapters } = routeComponent.data
      const chapter = { title: 'Three' }
      routeComponent.dataModel.insert(
        {
          schema: routeComponent.schema.components.chapters,
          list: chapters,
          dataPath: 'chapters'
        },
        2,
        chapter
      )
      await submit()
      expect(routeComponent.data.chapters[2]).toBe(chapters[2])
      expect(chapters[2]).toEqual({ id: 3, title: 'Three' })
    })

    it('removes the items that the server removed', async () => {
      const { routeComponent, submit } = await mountBookForm(data => ({
        id: 1,
        ...data,
        chapters: data.chapters.slice(1)
      }))
      const { chapters } = routeComponent.data
      const [, second] = chapters
      routeComponent.dataModel.set(routeComponent.data, 'title', 'Persuasion')
      await submit()
      expect(routeComponent.data.chapters).toBe(chapters)
      expect(chapters).toEqual([second])
    })

    it('keeps the edits of open nested forms of its items', async () => {
      const { admin, routeComponent } = await mountBookForm()
      const { data } = routeComponent
      await admin.navigate('/items/1/chapters/0')
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      await enterValue(
        new DOMWrapper(form.$el).find('input[name$="title"]'),
        'Opening'
      )
      // Save the book through its own submit button, outside the open form:
      const [submitButton] = [
        ...admin.element.querySelectorAll(
          '.dito-buttons--main button[type="submit"]'
        )
      ].filter(button => !form.$el.contains(button))
      submitButton.click()
      await settle(routeComponent)
      expect(form.data.title).toBe('Opening')
      expect(data.chapters[0].title).toBe('One')
    })

    it('merges the data of `setData()` and returns it', async () => {
      const { routeComponent } = await mountBookForm()
      const { data } = routeComponent
      const [first] = data.chapters
      const mergedData = routeComponent.ownContainer.replaceItem({
        ...data,
        title: 'Persuasion',
        chapters: [{ id: 1, title: 'First' }]
      })
      expect(mergedData).toBe(data)
      expect(routeComponent.data).toBe(data)
      expect(data.chapters).toEqual([first])
      expect(first.title).toBe('First')
      expect(data.title).toBe('Persuasion')
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
      const notify = vi.spyOn(result.admin.context, 'notify')
      return { ...result, notify }
    }

    async function openNestedForm(admin, path) {
      await admin.navigate(path)
      const form = admin.getRouteComponent(isForm)
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

    it('provides the processed draft and root item to its components', async () => {
      const { admin } = await mountBookForm({
        chapters: [{ title: 'Prologue' }]
      })
      const form = await openNestedForm(admin, '/items/1/chapters/0')
      form.data.title = 'Opening'
      const { context } = form.$refs.schema
      expect(context.processedItem).toEqual({ title: 'Opening' })
      // The root item is the one of the book form, with the draft in place of
      // the item, like `rootItem`:
      expect(context.processedRootItem).toMatchObject({
        title: 'Emma',
        chapters: [{ title: 'Opening' }]
      })
    })

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
      expect(routeComponent.ownRoute.isDirty).toBe(true)
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

    it('applies the response of buttons with resources to the draft', async () => {
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
      // Unlike the submit button, other buttons don't close the form, which
      // holds the response in its draft until it's applied:
      expect(admin.router.currentRoute.value.path).toBe('/items/1/chapters/0')
      expect(form.data).toEqual({ title: 'PROLOGUE' })
      expect(data.chapters).toEqual([{ title: 'prologue' }])
      expect(form.ownRoute.isDirty).toBe(true)
      await new DOMWrapper(form.$el)
        .find('.dito-buttons--main button[type="submit"]')
        .trigger('click')
      await settle(form)
      expect(data.chapters).toEqual([{ title: 'PROLOGUE' }])
    })

    it('adds created items to the list in the data of the form', async () => {
      const { admin, data, notify } = await mountBookForm({
        chapters: [{ title: 'Prologue' }]
      })
      const form = await openNestedForm(admin, '/items/1/chapters/create')
      expect(form.ownContainer.isCreating).toBe(true)
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
      expect(form.ownContainer.isCreating).toBe(true)
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
      expect(form.ownContainer.isCreating).toBe(false)
      expect(form.data).toEqual({ name: 'Jane' })
      await submitNestedForm(form, 'Jane Austen')
      expect(data.author).toEqual({ name: 'Jane Austen' })
    })
  })

  describe('applying nested forms', () => {
    // Mounts a book form whose chapters are edited in nested forms with the
    // `components`, and opens the form of the `chapter`.
    async function openChapterForm(components, chapter) {
      const submitted = []
      const result = await mountForm({
        schema: {
          label: 'Book',
          components: {
            title: { type: 'text' },
            chapters: {
              type: 'list',
              editable: true,
              itemLabel: 'title',
              columns: { title: {}, wordCount: {} },
              form: { type: 'form', label: 'Chapter', components }
            }
          }
        },
        data: { title: 'Emma', chapters: [chapter] },
        request: ({ data }) => {
          submitted.push(data)
          return { data: { id: 1, ...data } }
        }
      })
      await result.admin.navigate('/items/1/chapters/0')
      const form = result.admin.getRouteComponent(isForm)
      await settle(form)
      return { ...result, form, submitted }
    }

    // Enters the `title` into the nested `form`, and applies it.
    async function applyChapterForm(form, title) {
      const element = new DOMWrapper(form.$el)
      await enterValue(element.find('input[name$="title"]'), title)
      await settle(form)
      await element
        .find('.dito-buttons--main button[type="submit"]')
        .trigger('click')
      await settle(form)
    }

    it('keeps the values of the item that the form leaves out', async () => {
      const { form, data } = await openChapterForm(
        { title: { type: 'text' } },
        { id: 7, title: 'Prologue', wordCount: 1200 }
      )
      await applyChapterForm(form, 'Opening')
      expect(data.chapters).toEqual([
        { id: 7, title: 'Opening', wordCount: 1200 }
      ])
    })

    it('keeps the excluded values of the item', async () => {
      const { form, data } = await openChapterForm(
        {
          title: { type: 'text' },
          note: { type: 'text', exclude: true }
        },
        { id: 7, title: 'Prologue', note: 'Draft' }
      )
      await applyChapterForm(form, 'Opening')
      expect(data.chapters).toEqual([
        { id: 7, title: 'Opening', note: 'Draft' }
      ])
    })

    it('keeps the related objects of the item whole', async () => {
      const authors = [
        { id: 1, name: 'Jane' },
        { id: 2, name: 'Tom' }
      ]
      const { form, data } = await openChapterForm(
        {
          title: { type: 'text' },
          author: {
            type: 'select',
            relate: true,
            options: { data: authors, label: 'name' }
          }
        },
        { id: 7, title: 'Prologue', author: { id: 1, name: 'Jane' } }
      )
      await applyChapterForm(form, 'Opening')
      expect(data.chapters).toEqual([
        { id: 7, title: 'Opening', author: { id: 1, name: 'Jane' } }
      ])
    })

    it('calls `process()` only when the parent is saved', async () => {
      const { form, data, submit } = await openChapterForm(
        { title: { type: 'text', process: ({ value }) => `${value}!` } },
        { id: 7, title: 'Prologue' }
      )
      await applyChapterForm(form, 'Opening')
      expect(data.chapters).toEqual([{ id: 7, title: 'Opening' }])
      const submittedData = await submit()
      expect(submittedData.chapters).toEqual([{ id: 7, title: 'Opening!' }])
    })

    describe('with relations to items in their own data', () => {
      const chapterComponents = {
        title: { type: 'text' },
        sections: {
          type: 'list',
          inlined: true,
          creatable: true,
          form: { type: 'form', components: { name: { type: 'text' } } }
        },
        featured: {
          type: 'select',
          relate: true,
          options: { dataPath: '../sections', label: 'name' }
        }
      }

      const chapter = {
        id: 7,
        title: 'Prologue',
        sections: [{ name: 'Opening' }],
        featured: null
      }

      it('resolve the options of data paths in the data of the form', async () => {
        const { admin, form } = await openChapterForm(
          chapterComponents,
          chapter
        )
        const featured = admin.getComponent(form, `${form.dataPath}/featured`)
        const sections = admin.getComponent(form, `${form.dataPath}/sections`)
        sections.$el.querySelector('.dito-create-button button').click()
        await settle(form)
        form.data.sections[1].name = 'Ending'
        await settle(form)
        expect(featured.options).toHaveLength(2)
        expect(featured.options[0]).toBe(form.data.sections[0])
      })

      it(`don't change the data of the parent when cancelled`, async () => {
        const { admin, form, data } = await openChapterForm(
          chapterComponents,
          chapter
        )
        const featured = admin.getComponent(form, `${form.dataPath}/featured`)
        featured.selectedValue = featured.getValueForOption(featured.options[0])
        await settle(form)
        expect(form.data.featured).not.toBe(data.chapters[0].sections[0])
        form.ownRoute.close()
        await settle(form)
        expect(data.chapters[0].sections).toEqual([{ name: 'Opening' }])
      })

      it('send the related items with the ids of their references', async () => {
        const { admin, form, submit } = await openChapterForm(
          chapterComponents,
          chapter
        )
        const featured = admin.getComponent(form, `${form.dataPath}/featured`)
        featured.selectedValue = featured.getValueForOption(featured.options[0])
        await settle(form)
        await new DOMWrapper(form.$el)
          .find('.dito-buttons--main button[type="submit"]')
          .trigger('click')
        await settle(form)
        const [submittedChapter] = (await submit()).chapters
        expect(submittedChapter.featured['#ref']).toBeDefined()
        expect(submittedChapter.sections[0]['#id']).toBe(
          submittedChapter.featured['#ref']
        )
      })
    })
  })

  // Known bug: forms of resource lists in new items aren't transient
  it.skip('edits the items of resource lists in new items transiently', async () => {
    const admin = await mountAdmin({
      views: {
        books: {
          type: 'view',
          component: {
            type: 'list',
            resource: { path: 'books' },
            editable: true,
            creatable: true,
            form: {
              type: 'form',
              components: {
                title: { type: 'text' },
                chapters: {
                  type: 'list',
                  resource: { path: 'chapters' },
                  editable: true,
                  creatable: true,
                  form: {
                    type: 'form',
                    components: { title: { type: 'text' } }
                  }
                }
              }
            }
          }
        }
      },
      request: () => ({ data: [] })
    })
    await admin.navigate('/books/create')
    const bookForm = admin.getRouteComponent(isForm)
    await settle(bookForm)
    const chapters = admin.getComponent(bookForm, 'chapters')
    // Without the id of the book, the list can't load its chapters:
    expect(chapters.isTransient).toBe(true)
    bookForm.data.chapters = [{ title: 'Prologue' }]
    await settle(bookForm)
    await admin.navigate('/books/create/chapters/0')
    const chapterForm = admin.getRouteComponent(isForm)
    await settle(chapterForm)
    expect(chapterForm.isTransient).toBe(true)
    expect(chapterForm.data).toEqual({ title: 'Prologue' })
    expect(admin.request).not.toHaveBeenCalledWith(
      expect.objectContaining({ url: '/books/chapters/0' })
    )
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
      expect(routeComponent.ownContainer.isCreating).toBe(true)
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
      expect(admin.getRouteComponent(isForm)).toBe(
        routeComponent
      )
      expect(routeComponent.ownContainer.isCreating).toBe(false)
      expect(routeComponent.data).toEqual({ id: 7, title: 'Emma' })
      const itemRequests = request.mock.calls
        .map(([{ method = 'get', url }]) => [method, url])
        .filter(([, url]) => url.startsWith('/items'))
      expect(itemRequests).toEqual([['post', '/items']])
    })

    it('opens the created item by the id key of its list', async () => {
      const admin = await mountAdmin({
        views: {
          items: {
            type: 'view',
            component: {
              type: 'list',
              resource: { path: 'items' },
              idKey: 'code',
              form: {
                type: 'form',
                components: { title: { type: 'text' } },
                buttons: { submit: { closeForm: false } }
              }
            }
          }
        },
        request: ({ method = 'get', data }) =>
          method === 'post'
            ? { data: { code: 'emma', ...data } }
            : { data: [] }
      })
      await admin.navigate('/items/create')
      const form = admin.getRouteComponent(isForm)
      await enterValue(admin.wrapper.find('input[name="title"]'), 'Emma')
      await admin.wrapper
        .find('.dito-buttons--main button[type="submit"]')
        .trigger('click')
      await settle(form)
      expect(admin.router.currentRoute.value.path).toBe('/items/emma')
      expect(form.data).toEqual({ code: 'emma', title: 'Emma' })
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
    // without the path of the view.
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
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      expect(form.route.parent.isForm).toBe(false)
      expect(form.dataPath).toBe('recipes/0')
      await submitChanges(form, 'Waffles')
      expect(data.recipes).toEqual([{ name: 'Waffles' }])
    })

    // Without a resource in the view, the nested form has no resource to
    // continue, and its data path is relative to the data of the view.
    it('open in views without resources', async () => {
      const { admin, data } = await mountSchema({
        schema: { components: { recipes: recipesSchema } },
        data: { recipes: [{ name: 'Pancakes' }] }
      })
      await admin.navigate('/test/recipes/0')
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      expect(form.ownRoute.resource.resourceOwner).toBe(null)
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
      const view = admin.getRouteComponent(isView)
      view.ownContainer.replaceItem({ recipes: [{ name: 'Pancakes' }] })
      await settle(view)
      await admin.navigate('/cookbook/0')
      const form = admin.getRouteComponent(isForm)
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
        component => isView(component) && component.name === 'cookbook'
      )
      view.ownContainer.replaceItem({ recipes: [{ name: 'Pancakes' }] })
      await settle(view)
      await admin.navigate('/kitchen/cookbook/recipes/0')
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      expect(form.dataPath).toBe('recipes/0')
      await submitChanges(form, 'Waffles')
      expect(view.data.recipes).toEqual([{ name: 'Waffles' }])
    })

    // The data paths of the form's components are relative to the data of
    // the view, which is their root item with the form's draft in place of
    // its item, also when the view has no resource.
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

      function expectItemsOfComponents(admin, form, view) {
        const recipe = view.data.recipes[0]
        const name = admin.getComponent(form, 'recipes/0/name')
        const { rootData } = form.ownRoute
        expect(rootData.venue).toBe('Bakery')
        expect(rootData.recipes[0]).toBe(form.data)
        expect(name.context.rootItem).toBe(rootData)
        expect(name.context.parentItem).toBe(rootData)
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
        const form = admin.getRouteComponent(isForm)
        await settle(form)
        expectItemsOfComponents(admin, form, view)
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
        const view = admin.getRouteComponent(isView)
        view.ownContainer.replaceItem({
          venue: 'Bakery',
          recipes: [{ name: 'Pancakes' }]
        })
        await settle(view)
        await admin.navigate('/cookbook/0')
        const form = admin.getRouteComponent(isForm)
        await settle(form)
        expectItemsOfComponents(admin, form, view)
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
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      expect(form.data).toBe(data.chapters[0])
      // Mutating forms write through the data model of their parent:
      expect(form.dataModel).toBe(routeComponent.dataModel)
      await enterValue(new DOMWrapper(form.$el).find('input'), 'Opening')
      await settle(form)
      expect(data.chapters).toEqual([{ title: 'Opening' }])
      // The changes make the form that owns the data dirty:
      expect(form.ownRoute.isDirty).toBe(false)
      expect(routeComponent.ownRoute.isDirty).toBe(true)
      // Mutating forms don't have a submit button, only the cancel button:
      expect(
        new DOMWrapper(form.$el)
          .find('.dito-buttons--main button[type="submit"]')
          .exists()
      ).toBe(false)
    })

    it('clear the errors of their item only once submitted', async () => {
      const { admin, routeComponent, dataModel } = await mountForm({
        schema: {
          components: {
            title: { type: 'text' },
            chapters: {
              type: 'list',
              editable: true,
              mutate: true,
              form: {
                type: 'form',
                components: { title: { type: 'text' } },
                buttons: {
                  apply: {
                    type: 'submit',
                    events: { click: ({ submit }) => submit() }
                  }
                }
              }
            }
          }
        },
        data: { title: 'Emma', chapters: [{ title: 'Prologue' }] }
      })
      const errors = [{ message: 'is taken' }]
      dataModel.replaceErrors(
        { 'title': errors, 'chapters/0/title': errors },
        { server: true }
      )
      await admin.navigate('/items/1/chapters/0')
      const form = admin.getRouteComponent(isForm)
      expect(form).not.toBe(routeComponent)
      await new DOMWrapper(form.$el)
        .find('.dito-buttons--main button[type="submit"]')
        .trigger('click')
      await settle(form)
      expect(dataModel.getErrors('chapters/0/title')).toBe(null)
      expect(dataModel.getErrors('title')).toEqual(errors)
    })

    const chapterForm = {
      type: 'form',
      components: {
        title: { type: 'text' },
        slug: {
          type: 'text',
          compute: ({ item }) => item.title?.toLowerCase() ?? null
        }
      }
    }

    it('compute the values of the items that they create', async () => {
      const { admin, data } = await mountForm({
        schema: {
          components: {
            chapters: {
              type: 'list',
              creatable: true,
              mutate: true,
              form: chapterForm
            }
          }
        },
        data: { chapters: [] }
      })
      await admin.navigate('/items/1/chapters/create')
      const form = admin.getRouteComponent(
        component => component.ownContainer.isCreating
      )
      await settle(form)
      // The new item isn't in the data of the parent, so the form handles it
      // with its own model:
      expect(form.dataModel).not.toBe(form.route.parent.container.model)
      await enterValue(new DOMWrapper(form.$el).find('input'), 'Opening')
      await settle(form)
      expect(form.data).toMatchObject({ title: 'Opening', slug: 'opening' })
      expect(data.chapters).toEqual([])
    })

    it('compute the values of the items that they load', async () => {
      const admin = await mountAdmin({
        views: {
          chapters: {
            type: 'view',
            component: {
              type: 'list',
              resource: { path: 'chapters' },
              mutate: true,
              form: chapterForm
            }
          }
        },
        request: ({ url }) =>
          url === '/chapters'
            ? { data: [{ id: 1, title: 'Opening' }] }
            : { data: { id: 1, title: 'Opening' } }
      })
      await admin.navigate('/chapters/1')
      const form = admin.getRouteComponent(isForm)
      await settle(form)
      expect(form.data).toMatchObject({ title: 'Opening', slug: 'opening' })
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
    const form = admin.getRouteComponent(isForm)
    await settle(form)
    // The same form stays open and creates the new item:
    expect(form).toBe(routeComponent)
    expect(form.ownContainer.isCreating).toBe(true)
    expect(form.ownRoute.isDirty).toBe(false)
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
    expect(routeComponent.ownContainer.isCreating).toBe(true)
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
    expect(routeComponent.ownContainer.isCreating).toBe(true)
    await admin.navigate('/items/1')
    const form = admin.getRouteComponent(isForm)
    await settle(form)
    expect(form.ownContainer.isCreating).toBe(false)
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
    const form = admin.getRouteComponent(isForm)
    await settle(form)
    expect(form.data).toEqual({ type: 'image', url: null })
  })

  it('submits without validation with `validate: false`', async () => {
    const { wrapper, request, settle } = await mountForm({
      schema: {
        components: { title: { type: 'text', required: true } },
        buttons: { submit: { closeForm: false } }
      },
      data: { title: '' },
      request: ({ data }) => ({ data })
    })
    const { submit } = wrapper
      .findAllComponents({ name: 'DitoTypeButton' })
      .find(({ vm }) => vm.schema.type === 'submit').vm.context
    expect(await submit()).toBe(false)
    expect(await submit({ validate: false })).toBe(true)
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
