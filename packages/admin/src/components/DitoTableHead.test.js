import { mountSchema } from '../test/mount.js'
import { flushPromises } from '@vue/test-utils'

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

  it('sorts by the clicked column and toggles its order', async () => {
    const { admin, findField, request } = await mountSchema({
      schema: {
        components: {
          books: {
            type: 'list',
            resource: { path: 'books' },
            columns: {
              title: { sortable: true },
              year: { sortable: true }
            }
          }
        }
      },
      request: () => ({ data: [{ id: 1, title: 'Emma', year: 1815 }] })
    })
    const findHeader = index => findField('books').findAll('thead th')[index]
    const clickHeader = async index => {
      await findHeader(index).find('button').trigger('click')
      await flushPromises()
    }
    const getLastQuery = () => request.mock.calls.at(-1)[0].query
    await clickHeader(0)
    expect(admin.router.currentRoute.value.query.order).toBe('title asc')
    expect(getLastQuery()).toMatchObject({ order: 'title asc' })
    expect(findHeader(0).attributes('aria-sort')).toBe('ascending')
    expect(findHeader(0).find('button').classes()).toEqual(
      expect.arrayContaining([
        'dito-button--selected', 'dito-button--order-asc'
      ])
    )
    expect(findHeader(1).attributes('aria-sort')).toBe('none')
    await clickHeader(0)
    expect(admin.router.currentRoute.value.query.order).toBe('title desc')
    expect(findHeader(0).attributes('aria-sort')).toBe('descending')
    await clickHeader(1)
    expect(admin.router.currentRoute.value.query.order).toBe('year asc')
    expect(findHeader(0).attributes('aria-sort')).toBe('none')
    expect(findHeader(0).find('button').classes()).not.toContain(
      'dito-button--selected'
    )
  })
})
