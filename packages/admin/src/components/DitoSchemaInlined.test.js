import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSchema } from '../test/mount.js'

function mountBooks(form = {}) {
  return mountSchema({
    schema: {
      fields: {
        books: {
          type: 'list',
          inlined: true,
          creatable: true,
          deletable: true,
          draggable: true,
          form: {
            type: 'form',
            label: 'Book',
            clipboard: true,
            fields: { title: { type: 'text' } },
            ...form
          }
        }
      }
    },
    data: { books: [{ title: 'Emma' }, { title: 'Dune' }] }
  })
}

// The buttons that items render only while they are hovered or focused:
function getItemButtons(item) {
  return [
    'a.dito-button--drag',
    'button.dito-create-button',
    'button.dito-button--copy',
    'button.dito-button--paste'
  ].filter(selector => item.find(selector).exists())
}

describe('DitoSchemaInlined', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the buttons of the header while hovered', async () => {
    const { findField } = await mountBooks()
    const item = findField('books').find('.dito-schema-inlined')
    // ...and keeps their space with placeholders otherwise:
    expect(getItemButtons(item)).toEqual([])
    expect(item.findAll('.dito-button--placeholder')).toHaveLength(4)
    expect(item.find('.dito-button--remove').exists()).toBe(true)
    await item.trigger('mouseenter')
    expect(getItemButtons(item)).toHaveLength(4)
    expect(item.find('.dito-button--placeholder').exists()).toBe(false)
    await item.trigger('mouseleave')
    expect(getItemButtons(item)).toEqual([])
  })

  it('renders the buttons of the header while focused', async () => {
    const { findField } = await mountBooks()
    const [item, otherItem] = findField('books').findAll('.dito-schema-inlined')
    const input = item.find('input')
    await input.trigger('focusin')
    expect(getItemButtons(item)).toHaveLength(4)
    expect(getItemButtons(otherItem)).toEqual([])
    // Moving the focus inside the item keeps them:
    await input.trigger('focusout', {
      relatedTarget: item.find('.dito-button--remove').element
    })
    expect(getItemButtons(item)).toHaveLength(4)
    await input.trigger('focusout', {
      relatedTarget: otherItem.find('input').element
    })
    expect(getItemButtons(item)).toEqual([])
  })

  it('renders the buttons of the header while a menu is open', async () => {
    const createForm = label => ({
      type: 'form',
      label,
      fields: { title: { type: 'text' } }
    })
    const { findField } = await mountSchema({
      schema: {
        fields: {
          books: {
            type: 'list',
            inlined: true,
            creatable: true,
            draggable: true,
            forms: { novel: createForm('Novel'), poem: createForm('Poem') }
          }
        }
      },
      data: {
        books: [
          { type: 'novel', title: 'Emma' },
          { type: 'poem', title: 'Odes' }
        ]
      }
    })
    const item = findField('books').find('.dito-schema-inlined')
    await item.trigger('mouseenter')
    await item.find('button.dito-create-button').trigger('click')
    await item.trigger('mouseleave')
    expect(item.findAll('[role="menuitem"]')).toHaveLength(2)
    expect(item.find('a.dito-button--drag').exists()).toBe(true)
    // ...through the focus of the menu button, until a click outside closes
    // the menu and takes the focus:
    document.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    document.activeElement.blur()
    await flushPromises()
    expect(item.find('[role="menuitem"]').exists()).toBe(false)
    expect(item.find('a.dito-button--drag').exists()).toBe(false)
  })

  it('renders the buttons of rows without header', async () => {
    const { findField } = await mountBooks({
      label: null,
      clipboard: false,
      compact: true
    })
    const item = findField('books').find('.dito-schema-inlined')
    expect(item.find('.dito-schema-header').exists()).toBe(false)
    expect(item.find('a.dito-button--drag').exists()).toBe(true)
    expect(item.find('button.dito-create-button').exists()).toBe(true)
  })

  it('renders the buttons of the header on devices without hover', async () => {
    // The pointer of the device can't be changed otherwise:
    const matchMedia = window.matchMedia.bind(window)
    vi.spyOn(window, 'matchMedia').mockImplementation(query =>
      query === '(hover: none)' ? { matches: true } : matchMedia(query)
    )
    const { findField } = await mountBooks()
    const item = findField('books').find('.dito-schema-inlined')
    expect(getItemButtons(item)).toHaveLength(4)
  })
})
