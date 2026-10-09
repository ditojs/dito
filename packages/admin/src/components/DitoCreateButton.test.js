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

describe('DitoCreateButton', () => {
  it('opens the pulldown and creates items with the keyboard', async () => {
    const { findField, data } = await mountSchema({
      schema: blocksSchema,
      data: { blocks: [] }
    })
    const field = findField('blocks')
    const trigger = field.find('.dito-create-button button')
    const menu = field.find('.dito-pulldown')
    const items = field.findAll('.dito-pulldown__item')
    expect(trigger.attributes('aria-expanded')).toBe('false')

    await pressKey(trigger, 'Enter')
    expect(trigger.attributes('aria-expanded')).toBe('true')
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
    expect(trigger.attributes('aria-expanded')).toBe('false')
  })

  it('closes the pulldown with Escape and focuses the button', async () => {
    const { findField, data } = await mountSchema({
      schema: blocksSchema,
      data: { blocks: [] }
    })
    const field = findField('blocks')
    const trigger = field.find('.dito-create-button button')
    await pressKey(trigger, 'ArrowDown')
    expect(trigger.attributes('aria-expanded')).toBe('true')
    await pressKey(field.find('.dito-pulldown'), 'Escape')
    expect(trigger.attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger.element)
    expect(data.blocks).toEqual([])
  })
})
