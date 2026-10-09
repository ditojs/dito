import { mountForm } from '../test/mount.js'

describe('ContextMixin', () => {
  const mountLibrary = () =>
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
                    components: { title: { type: 'text' } }
                  }
                }
              }
            }
          }
        }
      },
      data: {
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
})
