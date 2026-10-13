import { vi } from 'vitest'
import { toRaw } from 'vue'
import { DOMWrapper, flushPromises } from '@vue/test-utils'
import {
  mountAdmin,
  mountForm,
  mountSchema,
  enterValue,
  stubConfirm,
  isForm
} from '../test/mount.js'

describe('useSchemaContext()', () => {
  const mountLibrary = (titleSchema = {}) =>
    // Forms provide the root data, as they load it through their resource:
    mountForm({
      schema: {
        components: {
          name: { type: 'text' },
          authors: {
            type: 'list',
            inlined: true,
            form: {
              type: 'form',
              components: {
                name: { type: 'text' },
                books: {
                  type: 'list',
                  inlined: true,
                  form: {
                    type: 'form',
                    components: { title: { type: 'text', ...titleSchema } }
                  }
                }
              }
            }
          }
        }
      },
      data: {
        name: 'City Library',
        // Data that the schema doesn't define, and serializing removes:
        notes: 'Closed on Sundays',
        authors: [
          {
            id: 1,
            name: 'Jane Austen',
            books: [
              { id: 1, title: 'Emma' },
              { id: 2, title: 'Persuasion' }
            ]
          }
        ]
      }
    })

  it('provides the item and parent item of components', async () => {
    const { getComponent, data } = await mountLibrary()
    const { context } = getComponent('authors/0/books/1/title')
    const author = data.authors[0]
    expect(toRaw(context.item)).toBe(toRaw(author.books[1]))
    // The parent item skips the arrays that hold the items:
    expect(toRaw(context.parentItem)).toBe(toRaw(author))
    expect(toRaw(context.rootItem)).toBe(toRaw(data))
    expect(context.name).toBe('title')
    expect(context.value).toBe('Persuasion')
  })

  it('has no parent item at the root', async () => {
    const { getComponent, data } = await mountLibrary()
    const { context } = getComponent('name')
    expect(toRaw(context.item)).toBe(toRaw(data))
    expect(context.parentItem).toBe(null)
  })

  it('provides the serialized item and root item of components', async () => {
    const { getComponent } = await mountLibrary()
    const title = getComponent('authors/0/books/1/title')
    expect(title.context.serializedItem).toEqual({ id: 2, title: 'Persuasion' })
    // The serialized root item is found through the parent schema components,
    // and contains only the data that the schemas define:
    expect(title.context.serializedRootItem).toEqual({
      id: 1,
      name: 'City Library',
      authors: [
        {
          id: 1,
          name: 'Jane Austen',
          books: [
            { id: 1, title: 'Emma' },
            { id: 2, title: 'Persuasion' }
          ]
        }
      ]
    })
    expect(getComponent('name').context.serializedRootItem).toEqual(
      title.context.serializedRootItem
    )
  })

  describe('the serialized item in callbacks', () => {
    // Mounts the library with `callback` on the titles of the books, which
    // returns `value`, and returns the serialized items that it received for
    // the title of the first book.
    async function getSerializedItems(callback, value) {
      const serializedItems = []
      await mountLibrary({
        [callback]: ({ serializedItem, dataPath }) => {
          if (dataPath === 'authors/0/books/0/title') {
            serializedItems.push(serializedItem)
          }
          return value
        }
      })
      return serializedItems
    }

    it('is the serialized item of the component in `if`', async () => {
      const serializedItems = await getSerializedItems('if', true)
      expect(serializedItems.length).toBeGreaterThan(0)
      for (const serializedItem of serializedItems) {
        expect(serializedItem).toEqual({ id: 1, title: 'Emma' })
      }
    })

    it('is the serialized item of the component in `computeValue()`', async () => {
      const serializedItems = await getSerializedItems(
        'computeValue',
        undefined
      )
      expect(serializedItems.length).toBeGreaterThan(0)
      for (const serializedItem of serializedItems) {
        expect(serializedItem).toEqual({ id: 1, title: 'Emma' })
      }
    })

    it('is serialized once until the data changes', async () => {
      // Callbacks may read the serialized items reactively, e.g. for prices, so
      // the serializing must not run again on every read. It serializes the
      // titles of both books each time:
      const serializeValue = vi.fn(({ value }) => value)
      const { getComponent, data } = await mountLibrary({ serializeValue })
      const { context } = getComponent('authors/0/books/1/title')
      expect(context.serializedItem).toEqual({ id: 2, title: 'Persuasion' })
      expect(context.serializedItem).toEqual({ id: 2, title: 'Persuasion' })
      expect(serializeValue).toHaveBeenCalledTimes(2)
      data.authors[0].books[1].title = 'Sanditon'
      expect(context.serializedItem).toEqual({ id: 2, title: 'Sanditon' })
      expect(serializeValue).toHaveBeenCalledTimes(4)
    })

    it('is the data being serialized in `serializeValue()`', async () => {
      const serialized = []
      const { getComponent } = await mountLibrary({
        serializeValue: ({ value, serializedItem, serializedRootItem }) => {
          serialized.push({ serializedItem, serializedRootItem })
          return value
        }
      })
      const serializedRootItem = getComponent('name').context.serializedRootItem
      expect(serialized.map(({ serializedItem }) => serializedItem)).toEqual([
        { id: 1, title: 'Emma' },
        { id: 2, title: 'Persuasion' }
      ])
      for (const entry of serialized) {
        expect(entry.serializedRootItem).toBe(serializedRootItem)
      }
    })
  })

  describe('members of forms and views', () => {
    const titleSchema = {
      components: { title: { type: 'text', required: true } }
    }

    const chaptersSchema = {
      components: {
        chapters: {
          type: 'list',
          creatable: true,
          form: {
            type: 'form',
            components: { title: { type: 'text' } }
          }
        }
      }
    }

    it('tell whether the form is dirty', async () => {
      const { wrapper, getComponent } = await mountForm({
        schema: titleSchema,
        data: { title: 'Emma' }
      })
      const { context } = getComponent('title')
      expect(context.isDirty).toBe(false)
      expect(context.isCreating).toBe(false)
      await enterValue(wrapper.find('input[name="title"]'), 'Persuasion')
      expect(context.isDirty).toBe(true)
    })

    it('tell the selected tab of the form', async () => {
      const { getComponent, schemaComponent } = await mountForm({
        schema: {
          tabs: {
            details: { type: 'tab', components: { title: { type: 'text' } } },
            reviews: { type: 'tab', components: { rating: { type: 'number' } } }
          }
        },
        data: { title: 'Emma', rating: 5 }
      })
      const { context } = getComponent('title')
      expect(context.selectedTab).toBe('details')
      schemaComponent.selectTab('reviews')
      expect(context.selectedTab).toBe('reviews')
    })

    it('have no selected tab without tabs', async () => {
      const { getComponent } = await mountForm({
        schema: titleSchema,
        data: { title: 'Emma' }
      })
      expect(getComponent('title').context.selectedTab).toBe(null)
    })

    it('tell whether the form creates its item', async () => {
      const { getComponent } = await mountForm({ schema: titleSchema })
      expect(getComponent('title').context.isCreating).toBe(true)
    })

    it('tell whether the view is dirty, if it can save', async () => {
      const editTitle = async buttons => {
        const { wrapper, getComponent } = await mountSchema({
          schema: { ...titleSchema, buttons },
          data: { title: 'Emma' }
        })
        const { context } = getComponent('title')
        expect(context.isDirty).toBe(false)
        expect(context.isCreating).toBe(false)
        await enterValue(wrapper.find('input[name="title"]'), 'Persuasion')
        return context
      }
      expect((await editTitle({ save: { type: 'submit' } })).isDirty).toBe(true)
      expect((await editTitle({ apply: { type: 'button' } })).isDirty).toBe(
        false
      )
    })

    it('belong to nested forms in their components', async () => {
      const { admin, getComponent } = await mountForm({
        schema: chaptersSchema,
        data: { chapters: [{ title: 'Arrakis' }] }
      })
      const openChapterForm = async path => {
        await admin.navigate(path)
        return admin.getRouteComponent(isForm)
      }
      const getTitleContext = form =>
        admin.getComponent(form, `${form.dataPath}/title`).context
      const newForm = await openChapterForm('/items/1/chapters/create')
      expect(getTitleContext(newForm).isCreating).toBe(true)
      const form = await openChapterForm('/items/1/chapters/0')
      const context = getTitleContext(form)
      expect(context.isCreating).toBe(false)
      await enterValue(new DOMWrapper(form.$el).find('input'), 'Caladan')
      expect(context.isDirty).toBe(true)
      // The draft of the nested form doesn't make its parent dirty:
      expect(getComponent('chapters').context.isDirty).toBe(false)
    })

    it('validate the data and show its errors', async () => {
      const { wrapper, getComponent, getErrors } = await mountForm({
        schema: titleSchema,
        data: { title: '' }
      })
      const { context } = getComponent('title')
      expect(context.validate()).toBe(false)
      await flushPromises()
      expect(getErrors('title')).toEqual(['The Title field is required.'])
      await enterValue(wrapper.find('input[name="title"]'), 'Emma')
      expect(context.validate()).toBe(true)
    })

    it('validate or check only the values that match', async () => {
      const { getComponent, getErrors } = await mountForm({
        schema: {
          components: {
            title: { type: 'text', required: true },
            author: { type: 'text', required: true }
          }
        },
        data: { title: 'Emma', author: '' }
      })
      const { context } = getComponent('title')
      expect(context.isValid(/^title/)).toBe(true)
      expect(context.isValid(/^author/)).toBe(false)
      await flushPromises()
      // Checking doesn't show the errors, validating does:
      expect(getErrors('author')).toEqual([])
      expect(context.validate('author')).toBe(false)
      await flushPromises()
      expect(getErrors('author')).toEqual(['The Author field is required.'])
    })

    it('match data paths relative to their item', async () => {
      const itemSchema = {
        type: 'form',
        components: {
          title: { type: 'text', required: true },
          check: { type: 'button' }
        }
      }
      const { admin, getComponent, dataModel } = await mountForm({
        schema: {
          components: {
            ...itemSchema.components,
            chapters: { type: 'list', inlined: true, form: itemSchema },
            notes: { type: 'list', form: itemSchema }
          }
        },
        data: {
          title: 'Emma',
          chapters: [{ title: '' }],
          notes: [{ title: '' }]
        }
      })
      const { context } = getComponent('check')
      const chapterContext = getComponent('chapters/0/check').context
      expect(context.validate('title')).toBe(true)
      expect(chapterContext.validate('title')).toBe(false)
      expect(chapterContext.isValid('/title')).toBe(true)
      expect(chapterContext.isValid('../*/title')).toBe(false)
      await flushPromises()
      expect(dataModel.getErrorDataPaths()).toEqual(['chapters/0/title'])
      chapterContext.clearErrors('title')
      expect(dataModel.getErrorDataPaths()).toEqual([])
      expect(() => context.isValid('../title')).toThrow(
        `Invalid data path: '../title' leads above the root from ''.`
      )
      await admin.navigate('/items/1/notes/0')
      const form = admin.getRouteComponent(isForm)
      const noteContext = admin.getComponent(
        form,
        `${form.dataPath}/check`
      ).context
      expect(noteContext.validate('title')).toBe(false)
      expect(noteContext.isValid(['/title', '../0/title'])).toBe(false)
    })

    it('reset the item with data merged into it', async () => {
      const { getComponent, data } = await mountForm({
        schema: titleSchema,
        data: { title: 'Emma' }
      })
      const { context } = getComponent('title')
      context.markDirty()
      expect(context.isDirty).toBe(true)
      expect(context.resetItem({ id: 1, title: 'Persuasion' })).toBe(data)
      expect(data.title).toBe('Persuasion')
      expect(context.isDirty).toBe(false)
    })

    it('reset the item to the defaults without data', async () => {
      const { getComponent, data } = await mountForm({
        schema: {
          components: { title: { type: 'text', default: 'Untitled' } }
        },
        data: { id: 1, title: 'Emma' }
      })
      const { context } = getComponent('title')
      expect(context.resetItem()).toBe(data)
      expect(data).toEqual({ id: 1, title: 'Untitled' })
    })

    it('close the form', async () => {
      const { admin, getComponent } = await mountForm({
        schema: titleSchema,
        data: { title: 'Emma' }
      })
      expect(await getComponent('title').context.closeForm()).toBe(true)
      expect(admin.router.currentRoute.value.path).toBe('/items')
    })

    it('keep the form open when the user stays', async () => {
      const confirm = stubConfirm(false)
      const { admin, getComponent } = await mountForm({
        schema: titleSchema,
        data: { title: 'Emma' }
      })
      const { context } = getComponent('title')
      context.markDirty()
      expect(await context.closeForm()).toBe(false)
      expect(confirm).toHaveBeenCalledOnce()
      expect(admin.router.currentRoute.value.path).toBe('/items/1')
    })

    it('navigate', async () => {
      const { admin, getComponent } = await mountForm({
        schema: titleSchema,
        data: { title: 'Emma' }
      })
      expect(await getComponent('title').context.navigate('/items')).toBe(true)
      expect(admin.router.currentRoute.value.path).toBe('/items')
    })

    it('stay when the user cancels the navigation', async () => {
      const confirm = stubConfirm(false)
      const { admin, getComponent } = await mountForm({
        schema: titleSchema,
        data: { title: 'Emma' }
      })
      const { context } = getComponent('title')
      context.markDirty()
      expect(await context.navigate('/items')).toBe(false)
      expect(confirm).toHaveBeenCalledOnce()
      expect(admin.router.currentRoute.value.path).toBe('/items/1')
    })

    it('fail to close forms and dialogs outside of them', async () => {
      const { getComponent } = await mountSchema({
        schema: titleSchema,
        data: { title: 'Emma' }
      })
      const { context } = getComponent('title')
      expect(() => context.closeForm()).toThrow(
        'Unable to close the form: There is no form.'
      )
      expect(() => context.closeDialog()).toThrow(
        'Unable to close the dialog: There is no dialog.'
      )
    })

    // E.g. in the `if` of views, which the menu evaluates:
    it('fail to act on data outside of views, forms, dialogs and panels', async () => {
      let menuContext = null
      await mountAdmin({
        views: {
          books: {
            type: 'view',
            if: context => {
              menuContext ??= context
              return true
            },
            components: { title: { type: 'text' } }
          }
        }
      })
      expect(menuContext.isDirty).toBe(false)
      expect(() => menuContext.validate()).toThrow(
        'Unable to validate: There is no data.'
      )
      expect(() => menuContext.isValid()).toThrow(
        'Unable to verify: There is no data.'
      )
      expect(() => menuContext.markDirty()).toThrow(
        'Unable to mark the data dirty: There is no data.'
      )
      expect(() => menuContext.resetItem({})).toThrow(
        'Unable to reset the item: There is no data.'
      )
    })

    it('resolve routes and read the route query', async () => {
      const { admin, getComponent } = await mountForm({
        schema: titleSchema,
        data: { title: 'Emma' }
      })
      await admin.navigate('/items/1?source=mail')
      const { context } = getComponent('title')
      expect(context.routeQuery).toEqual({ source: 'mail' })
      expect(context.getRouteUrl({ path: '/items', query: { page: 2 } })).toBe(
        '/items?page=2'
      )
    })

    it('return the URL of the nearest resource', async () => {
      const { getComponent } = await mountForm({
        schema: {
          components: {
            title: { type: 'text' },
            chapters: {
              type: 'list',
              resource: { path: 'chapters' },
              paginate: 10,
              columns: { title: {} }
            }
          }
        },
        data: { title: 'Emma' },
        request: () => ({ data: { results: [], total: 0 } })
      })
      const { getResourceUrl } = getComponent('title').context
      expect(getResourceUrl()).toBe('/items/1')
      expect(getResourceUrl({ path: 'activity' })).toBe('/items/1/activity')
      // Lists with their own resource load their items from it:
      const chapters = getComponent('chapters')
      expect(chapters.context.getResourceUrl()).toBe('/items/1/chapters')
      // The list's query, unlike the form's:
      chapters.listQuery.update({ page: 1 })
      await flushPromises()
      expect(chapters.context.sourceQuery).toMatchObject({ page: '1' })
      expect(getComponent('title').context.sourceQuery).toBe(null)
    })

    it('return the URL of the form in lists without a resource', async () => {
      const { getComponent } = await mountForm({
        schema: {
          components: {
            notes: {
              type: 'list',
              inlined: true,
              form: { type: 'form', components: { text: { type: 'text' } } }
            }
          }
        },
        data: { notes: [{ text: 'Reread' }] }
      })
      expect(getComponent('notes').context.getResourceUrl()).toBe('/items/1')
      expect(getComponent('notes/0/text').context.getResourceUrl()).toBe(
        '/items/1'
      )
    })

    it('return the URL of the collection in creating forms', async () => {
      const { getComponent } = await mountForm({ schema: titleSchema })
      expect(getComponent('title').context.getResourceUrl()).toBe('/items')
    })

    it('fail to return the URL of the nearest resource without one', async () => {
      const { getComponent } = await mountSchema({
        schema: titleSchema,
        data: { title: 'Emma' }
      })
      const { getResourceUrl } = getComponent('title').context
      expect(() => getResourceUrl()).toThrow(
        'Unable to get the resource URL: There is no form or list with a ' +
        'resource.'
      )
      expect(getResourceUrl({ path: 'activity' })).toBe('/activity')
    })

    it('show dialogs that resolve with their result', async () => {
      const { admin, getComponent } = await mountForm({
        schema: titleSchema,
        data: { title: 'Emma' }
      })
      const result = getComponent('title').context.showDialog({
        components: { note: { type: 'text' } },
        buttons: { cancel: {}, apply: { type: 'submit' } },
        data: { note: 'Read again' }
      })
      await flushPromises()
      await admin.wrapper.find('.dito-dialog form').trigger('submit')
      expect(await result).toEqual({ note: 'Read again' })
    })
  })
})
