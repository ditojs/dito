import { mountSchema } from '../test/mount.js'

describe('DitoTableHead', () => {
  it('sets `aria-sort` on the header cells of sortable columns', async () => {
    const { findField } = await mountSchema({
      schema: {
        components: {
          books: {
            type: 'list',
            columns: {
              title: { sortable: true },
              pages: {}
            }
          }
        }
      },
      data: { books: [{ title: 'Emma', pages: 474 }] }
    })
    const [title, pages] = findField('books').findAll('thead th')
    expect(title.attributes('aria-sort')).toBe('none')
    expect(pages.attributes('aria-sort')).toBeUndefined()
    expect(title.find('button').attributes('aria-sort')).toBeUndefined()
  })
})
