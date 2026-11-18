import { html } from '@ditojs/utils'
import { flushPromises } from '@vue/test-utils'
import { mountSchema, unmountAdmin } from '../test/mount.js'

const books = [
  { title: 'Emma', author: 'Jane Austen', year: 1815 },
  { title: 'Dracula', author: 'Bram Stoker', year: 1897 }
]

const mountBooks = (list, data = books) =>
  mountSchema({
    schema: { fields: { books: { type: 'list', ...list } } },
    data: { books: data }
  })

const getTexts = wrappers => wrappers.map(wrapper => wrapper.text())

describe('useListTable()', () => {
  afterEach(() => localStorage.clear())

  it('opens previews of items below their rows', async () => {
    const { findField } = await mountBooks({
      columns: ['title'],
      preview: ({ item }) => html`<b>${item.author}</b>`
    })
    const field = findField('books')
    const buttons = field.findAll('.dito-table__expand button')
    expect(field.find('.dito-table__preview').exists()).toBe(false)
    await buttons[1].trigger('click')
    const preview = field.find('.dito-table__preview')
    expect(preview.find('b').text()).toBe('Bram Stoker')
    expect(preview.element.previousElementSibling.textContent).toContain(
      'Dracula'
    )
    expect(buttons[1].attributes('aria-expanded')).toBe('true')
  })

  it('hides columns through the columns menu', async () => {
    const { findField } = await mountBooks({
      columns: {
        title: {},
        author: { hideable: true },
        year: { hidden: true }
      }
    })
    const field = findField('books')
    const getHeaders = () => getTexts(field.findAll('thead th'))
    expect(getHeaders()).toEqual(['Title', 'Author'])
    await field.find('.dito-list__columns button').trigger('click')
    const items = field.findAll('[role="menuitemcheckbox"]')
    expect(getTexts(items)).toEqual(['Author', 'Year'])
    expect(items[0].attributes('data-state')).toBe('checked')
    await items[1].trigger('click')
    await flushPromises()
    expect(getHeaders()).toEqual(['Title', 'Author', 'Year'])
  })

  it('remembers the columns that viewers change', async () => {
    const list = { columns: { title: {}, author: { hideable: true } } }
    const openMenu = async field => {
      await field.find('.dito-list__columns button').trigger('click')
      return field.findAll('.dito-menu-button__item')
    }
    const first = await mountBooks(list)
    const [author] = await openMenu(first.findField('books'))
    await author.trigger('click')
    unmountAdmin(first.admin)
    const second = await mountBooks(list)
    const field = second.findField('books')
    expect(getTexts(field.findAll('thead th'))).toEqual(['Title'])
    const items = await openMenu(field)
    expect(items.at(-1).text()).toBe('Reset Columns')
    await items.at(-1).trigger('click')
    await flushPromises()
    expect(getTexts(field.findAll('thead th'))).toEqual(['Title', 'Author'])
  })

  it('moves draggable columns dropped onto others', async () => {
    const { findField } = await mountBooks({
      columns: {
        title: {},
        author: { draggable: true },
        year: { draggable: true }
      }
    })
    const field = findField('books')
    const [, author, year] = field.findAll('thead th')
    const dataTransfer = { setData() {} }
    await year.trigger('dragstart', { dataTransfer })
    await author.trigger('dragover', { dataTransfer })
    await author.trigger('drop', { dataTransfer })
    expect(getTexts(field.findAll('thead th'))).toEqual([
      'Title',
      'Year',
      'Author'
    ])
    expect(getTexts(field.findAll('tbody tr:first-child td'))).toEqual([
      'Emma',
      '1815',
      'Jane Austen'
    ])
  })

  it('sizes columns with `width` and pins them', async () => {
    const { findField } = await mountBooks({
      columns: {
        title: { width: 200, pinned: 'start' },
        author: {}
      }
    })
    const field = findField('books')
    const [title, author] = field.findAll('tbody tr:first-child td')
    expect(field.find('table').classes()).toContain('dito-table--sized')
    expect(title.attributes('style')).toContain('width: 200px')
    expect(title.attributes('style')).toContain('position: sticky')
    expect(author.attributes('style')).toBeUndefined()
  })
})
