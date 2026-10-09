import { flushPromises } from '@vue/test-utils'
import { mountSchema } from '../test/mount.js'

const blocksSchema = {
  components: {
    blocks: {
      type: 'list',
      inlined: true,
      creatable: true,
      forms: {
        heading: {
          type: 'form',
          label: 'Heading',
          components: { text: { type: 'text' } }
        },
        quote: {
          type: 'form',
          label: 'Quote',
          components: { text: { type: 'text' } }
        },
        image: {
          type: 'form',
          label: 'Image',
          components: { url: { type: 'url' } }
        }
      }
    }
  }
}

async function pressKey(wrapper, key) {
  await wrapper.trigger('keydown', { key })
  await flushPromises()
}

function findMenuButton(field) {
  return field.find('.dito-create-button button[aria-haspopup="menu"]')
}

describe('DitoCreateButton', () => {
  it('creates items of the type chosen in the menu', async () => {
    const { findField, data } = await mountSchema({
      schema: blocksSchema,
      data: { blocks: [] }
    })
    const field = findField('blocks')
    await findMenuButton(field).trigger('click')
    const items = field.findAll('[role="menuitem"]')
    expect(items.map(item => item.text())).toEqual([
      'Heading',
      'Quote',
      'Image'
    ])
    await items[1].trigger('click')
    await flushPromises()
    expect(data.blocks).toEqual([{ type: 'quote', text: null }])
  })

  it('opens the menu and creates items with the keyboard', async () => {
    const { findField, data } = await mountSchema({
      schema: blocksSchema,
      data: { blocks: [] }
    })
    const field = findField('blocks')
    const button = findMenuButton(field)
    expect(button.attributes('aria-expanded')).toBe('false')

    await pressKey(button, 'Enter')
    expect(button.attributes('aria-expanded')).toBe('true')
    const menu = field.find('[role="menu"]')
    const items = field.findAll('[role="menuitem"]')
    expect(document.activeElement).toBe(items[0].element)

    await pressKey(menu, 'ArrowDown')
    expect(document.activeElement).toBe(items[1].element)
    await pressKey(menu, 'End')
    expect(document.activeElement).toBe(items[2].element)
    await pressKey(menu, 'ArrowDown')
    expect(document.activeElement).toBe(items[0].element)
    await pressKey(menu, 'ArrowUp')
    expect(document.activeElement).toBe(items[2].element)

    await pressKey(menu, 'Enter')
    expect(data.blocks).toEqual([{ type: 'image', url: null }])
    expect(button.attributes('aria-expanded')).toBe('false')
  })

  it('closes the menu with Escape and focuses the button', async () => {
    const { findField, data } = await mountSchema({
      schema: blocksSchema,
      data: { blocks: [] }
    })
    const field = findField('blocks')
    const button = findMenuButton(field)
    await pressKey(button, 'ArrowDown')
    expect(button.attributes('aria-expanded')).toBe('true')
    await pressKey(field.find('[role="menu"]'), 'Escape')
    expect(button.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(button.element)
    expect(data.blocks).toEqual([])
  })

  it('leaves out forms that are hidden or not creatable', async () => {
    const { findField } = await mountSchema({
      schema: {
        components: {
          blocks: {
            ...blocksSchema.components.blocks,
            forms: {
              ...blocksSchema.components.blocks.forms,
              quote: {
                ...blocksSchema.components.blocks.forms.quote,
                creatable: false
              },
              image: {
                ...blocksSchema.components.blocks.forms.image,
                visible: false
              }
            }
          }
        }
      },
      data: { blocks: [] }
    })
    const field = findField('blocks')
    await findMenuButton(field).trigger('click')
    expect(field.findAll('[role="menuitem"]').map(item => item.text())).toEqual(
      ['Heading']
    )
  })

  it('renders a plain button for a single default form', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        components: {
          blocks: {
            type: 'list',
            inlined: true,
            creatable: true,
            form: {
              type: 'form',
              components: { text: { type: 'text' } }
            }
          }
        }
      },
      data: { blocks: [] }
    })
    const field = findField('blocks')
    expect(findMenuButton(field).exists()).toBe(false)
    await field.find('.dito-create-button button').trigger('click')
    await flushPromises()
    expect(data.blocks).toEqual([{ text: null }])
  })
})
