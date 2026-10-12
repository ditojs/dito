import { flushPromises } from '@vue/test-utils'
import { mountSchema, mountForm } from '../test/mount.js'

const bookForm = {
  type: 'form',
  label: 'Book',
  components: { title: { type: 'text' } }
}

const maliciousTitle = '<img src="x" onerror="alert(1)">'

describe('useSourceItems()', () => {
  describe('getItemLabel()', () => {
    it('escapes the values of items in list labels', async () => {
      const { findField } = await mountSchema({
        schema: {
          components: {
            books: { type: 'list', itemLabel: 'title', form: bookForm }
          }
        },
        data: { books: [{ title: maliciousTitle }] }
      })
      const field = findField('books')
      expect(field.find('img').exists()).toBe(false)
      expect(field.text()).toContain(maliciousTitle)
    })

    it('escapes the values of items in inlined labels', async () => {
      const { findField } = await mountSchema({
        schema: {
          components: {
            books: {
              type: 'list',
              itemLabel: 'title',
              inlined: true,
              collapsible: true,
              collapsed: true,
              form: bookForm
            }
          }
        },
        data: { books: [{ title: maliciousTitle }] }
      })
      const label = findField('books').find('.dito-label')
      expect(label.find('img').exists()).toBe(false)
      expect(label.text()).toContain(maliciousTitle)
    })

    it('escapes the values of objects in their labels', async () => {
      const { findField } = await mountSchema({
        schema: {
          components: {
            book: { type: 'object', itemLabel: 'title', form: bookForm }
          }
        },
        data: { book: { title: maliciousTitle } }
      })
      const field = findField('book')
      expect(field.find('img').exists()).toBe(false)
      expect(field.text()).toContain(maliciousTitle)
    })

    it('escapes the values of tree items in their labels', async () => {
      const { findField } = await mountForm({
        schema: {
          components: {
            chapters: {
              type: 'tree-list',
              path: 'chapters',
              itemLabel: 'title',
              form: bookForm,
              children: {
                name: 'sections',
                path: 'sections',
                itemLabel: 'title',
                form: bookForm
              }
            }
          }
        },
        data: {
          chapters: [{ title: maliciousTitle, sections: [{ title: 'Intro' }] }]
        }
      })
      await flushPromises()
      const field = findField('chapters')
      expect(field.find('img').exists()).toBe(false)
      expect(field.find('.dito-tree-label').text()).toBe(maliciousTitle)
      expect(field.find('[aria-label]').attributes('aria-label')).toBe(
        maliciousTitle
      )
    })

    it('keeps the HTML that `itemLabel()` returns', async () => {
      const { findField } = await mountSchema({
        schema: {
          components: {
            books: {
              type: 'list',
              itemLabel: ({ item }) => `<b>${item.title}</b>`,
              form: bookForm
            }
          }
        },
        data: { books: [{ title: 'Emma' }] }
      })
      expect(findField('books').find('b').text()).toBe('Emma')
    })
  })
  describe('itemLabel()', () => {
    it('receives the data path and form label of the item', async () => {
      const contexts = []
      const { admin } = await mountForm({
        schema: {
          components: {
            chapters: {
              type: 'list',
              editable: true,
              itemLabel: ({ item, dataPath, formLabel }) => {
                contexts.push({ dataPath, formLabel })
                return item.title
              },
              form: {
                type: 'form',
                label: 'Chapter',
                components: { title: { type: 'text' } }
              }
            }
          }
        },
        data: { chapters: [{ title: 'Prologue' }] }
      })
      expect(contexts).toContainEqual({
        dataPath: 'chapters/0',
        formLabel: 'Chapter'
      })
      // The form of the item labels it with the data path of its item too:
      contexts.length = 0
      await admin.navigate('/items/1/chapters/0')
      expect(contexts).toContainEqual({
        dataPath: 'chapters/0',
        formLabel: 'Chapter'
      })
      expect(contexts.map(({ dataPath }) => dataPath)).not.toContain(
        'chapters/0/chapters'
      )
    })
  })

  describe('contexts of items', () => {
    it('receive the root and parent items in `itemLabel()` and `render()`', async () => {
      const contexts = []
      const getLabel = context => {
        contexts.push(context)
        return context.item.title
      }
      const chapter = {
        type: 'form',
        components: { title: { type: 'text' } }
      }
      const { data } = await mountForm({
        schema: {
          components: {
            title: { type: 'text' },
            chapters: { type: 'list', itemLabel: getLabel, form: chapter },
            notes: { type: 'list', render: getLabel, form: chapter }
          }
        },
        data: {
          title: 'Emma',
          chapters: [{ title: 'One' }],
          notes: [{ title: 'Two' }]
        }
      })
      expect(contexts.map(({ item }) => item.title)).toEqual(
        expect.arrayContaining(['One', 'Two'])
      )
      for (const { rootItem, parentItem } of contexts) {
        expect(rootItem.title).toBe('Emma')
        expect(parentItem).toBe(data)
      }
    })

    it('receive the schema and name of their list', async () => {
      const contexts = []
      const getLabel = ({ schema, name, item }) => {
        contexts.push({ schema, name })
        return item.title
      }
      const chapter = {
        type: 'form',
        components: { title: { type: 'text' } }
      }
      const chapters = { type: 'list', itemLabel: getLabel, form: chapter }
      const notes = { type: 'list', render: getLabel, form: chapter }
      await mountSchema({
        schema: { components: { chapters, notes } },
        data: { chapters: [{ title: 'One' }], notes: [{ title: 'Two' }] }
      })
      expect(contexts).toContainEqual({ schema: chapters, name: 'chapters' })
      expect(contexts).toContainEqual({ schema: notes, name: 'notes' })
    })
  })

  describe('getItemDataPath()', () => {
    it('appends the index, and the name of other source schemas', async () => {
      const { getComponent } = await mountSchema({
        schema: {
          components: {
            books: { type: 'list', itemLabel: 'title', form: bookForm }
          }
        },
        data: { books: [{ title: 'Emma' }] }
      })
      const books = getComponent('books')
      expect(books.getItemDataPath(books.schema, 0)).toBe('books/0')
      expect(books.getItemDataPath(books.schema)).toBe('books')
      // Nested sources, e.g. the children of tree lists, by their name:
      expect(books.getItemDataPath({ name: 'chapters' }, 2)).toBe(
        'books/chapters/2'
      )
    })
  })
})
