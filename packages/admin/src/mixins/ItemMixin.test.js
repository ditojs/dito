import { flushPromises } from '@vue/test-utils'
import { mountSchema, mountForm } from '../test/mount.js'

const bookForm = {
  type: 'form',
  label: 'Book',
  components: { title: { type: 'text' } }
}

const maliciousTitle = '<img src="x" onerror="alert(1)">'

describe('ItemMixin', () => {
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

    it('extends escaped values with the form label', async () => {
      const { schemaComponent } = await mountSchema({
        schema: { components: { title: { type: 'text' } } }
      })
      const label = schemaComponent.getItemLabel(
        { type: 'list', itemLabel: 'title', form: bookForm },
        { title: 'Tom & Jerry' },
        { extended: true }
      )
      expect(label).toBe(`Book 'Tom &amp; Jerry'`)
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
})
