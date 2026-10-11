import { vi } from 'vitest'
import { mountForm } from '../test/mount.js'

describe('ContextMixin', () => {
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
        // Data that the schema doesn't define, and processing removes:
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
    const title = getComponent('authors/0/books/1/title')
    const author = data.authors[0]
    expect(title.item).toBe(author.books[1])
    expect(title.item).toBe(title.data)
    // The parent item skips the arrays that hold the items:
    expect(title.parentItem).toBe(author)
    expect(title.parentData).toBe(author)
    expect(title.rootItem).toBe(data)
    // Matches the item and parent item of the component's context:
    expect(title.context.item).toBe(title.item)
    expect(title.context.parentItem).toBe(title.parentItem)
  })

  it('has no parent item at the root', async () => {
    const { getComponent, data } = await mountLibrary()
    const name = getComponent('name')
    expect(name.item).toBe(data)
    expect(name.parentItem).toBe(null)
    expect(name.parentData).toBe(null)
  })

  it('provides the processed item and root item of components', async () => {
    const { getComponent } = await mountLibrary()
    const title = getComponent('authors/0/books/1/title')
    expect(title.context.processedItem).toEqual({ id: 2, title: 'Persuasion' })
    // The processed root item is found through the parent schema components,
    // and contains only the data that the schemas define:
    expect(title.context.processedRootItem).toEqual({
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
    expect(getComponent('name').context.processedRootItem).toEqual(
      title.context.processedRootItem
    )
  })

  describe('the processed item in callbacks', () => {
    // Mounts the library with `callback` on the titles of the books, which
    // returns `value`, and returns the processed items that it received for
    // the title of the first book.
    async function getProcessedItems(callback, value) {
      const processedItems = []
      await mountLibrary({
        [callback]: ({ processedItem, dataPath }) => {
          if (dataPath === 'authors/0/books/0/title') {
            processedItems.push(processedItem)
          }
          return value
        }
      })
      return processedItems
    }

    it('is the processed item of the component in `if`', async () => {
      const processedItems = await getProcessedItems('if', true)
      expect(processedItems.length).toBeGreaterThan(0)
      for (const processedItem of processedItems) {
        expect(processedItem).toEqual({ id: 1, title: 'Emma' })
      }
    })

    it('is the processed item of the component in `compute()`', async () => {
      const processedItems = await getProcessedItems('compute', undefined)
      expect(processedItems.length).toBeGreaterThan(0)
      for (const processedItem of processedItems) {
        expect(processedItem).toEqual({ id: 1, title: 'Emma' })
      }
    })

    it('is processed once until the data changes', async () => {
      // Callbacks may read the processed items reactively, e.g. for prices, so
      // the processing must not run again on every read. It processes the
      // titles of both books each time:
      const process = vi.fn(({ value }) => value)
      const { getComponent, data } = await mountLibrary({ process })
      const { context } = getComponent('authors/0/books/1/title')
      expect(context.processedItem).toEqual({ id: 2, title: 'Persuasion' })
      expect(context.processedItem).toEqual({ id: 2, title: 'Persuasion' })
      expect(process).toHaveBeenCalledTimes(2)
      data.authors[0].books[1].title = 'Sanditon'
      expect(context.processedItem).toEqual({ id: 2, title: 'Sanditon' })
      expect(process).toHaveBeenCalledTimes(4)
    })

    it('is the data being processed in `process()`', async () => {
      const processed = []
      const { getComponent } = await mountLibrary({
        process: ({ value, processedItem, processedRootItem }) => {
          processed.push({ processedItem, processedRootItem })
          return value
        }
      })
      const processedRootItem = getComponent('name').context.processedRootItem
      expect(processed.map(({ processedItem }) => processedItem)).toEqual([
        { id: 1, title: 'Emma' },
        { id: 2, title: 'Persuasion' }
      ])
      for (const entry of processed) {
        expect(entry.processedRootItem).toBe(processedRootItem)
      }
    })
  })
})
