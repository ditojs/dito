import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import SchemaContext from '../SchemaContext.js'
import { mountSchema, isForm } from '../test/mount.js'

const blocksSchema = {
  fields: {
    blocks: {
      type: 'list',
      inlined: true,
      creatable: true,
      forms: {
        heading: {
          type: 'form',
          label: 'Heading',
          fields: { text: { type: 'text' } }
        },
        quote: {
          type: 'form',
          label: 'Quote',
          fields: { text: { type: 'text' } }
        },
        image: {
          type: 'form',
          label: 'Image',
          fields: { url: { type: 'url' } }
        }
      }
    }
  }
}

function findMenuButton(field) {
  return field.find('button.dito-create-button[aria-haspopup="menu"]')
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

  it('aligns the menu with the end of its button', async () => {
    const { findField } = await mountSchema({
      schema: blocksSchema,
      data: { blocks: [] }
    })
    const field = findField('blocks')
    await findMenuButton(field).trigger('click')
    await flushPromises()
    expect(field.find('[role="menu"]').attributes('data-align')).toBe('end')
  })

  it('offers the forms by their `creatable` only', async () => {
    const creatable = vi.fn(({ item, value }) => item.blocks === value)
    const { findField, data } = await mountSchema({
      schema: {
        fields: {
          // Not a single-component view, which would give the list as item:
          title: { type: 'text' },
          blocks: {
            ...blocksSchema.fields.blocks,
            forms: {
              heading: {
                ...blocksSchema.fields.blocks.forms.heading,
                if: false
              },
              quote: {
                ...blocksSchema.fields.blocks.forms.quote,
                creatable: false
              },
              image: {
                ...blocksSchema.fields.blocks.forms.image,
                visible: false,
                creatable
              }
            }
          }
        }
      },
      data: { title: null, blocks: [] }
    })
    const field = findField('blocks')
    await findMenuButton(field).trigger('click')
    expect(field.findAll('[role="menuitem"]').map(item => item.text())).toEqual(
      ['Heading', 'Image']
    )
    // The callback gets the button's context, of the list in its item:
    expect(creatable).toHaveBeenCalledWith(
      expect.objectContaining({ item: data, value: data.blocks })
    )
  })

  it('greys out the forms that are `disabled`', async () => {
    const { findField } = await mountSchema({
      schema: {
        fields: {
          blocks: {
            ...blocksSchema.fields.blocks,
            forms: {
              ...blocksSchema.fields.blocks.forms,
              quote: {
                ...blocksSchema.fields.blocks.forms.quote,
                disabled: true
              }
            }
          }
        }
      },
      data: { blocks: [] }
    })
    const field = findField('blocks')
    await findMenuButton(field).trigger('click')
    const items = field.findAll('[role="menuitem"]')
    expect(items.map(item => item.text())).toEqual([
      'Heading', 'Quote', 'Image'
    ])
    expect(items.map(item => item.attributes('aria-disabled'))).toEqual([
      undefined,
      'true',
      undefined
    ])
  })

  it('renders a plain button for a single default form', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        fields: {
          blocks: {
            type: 'list',
            inlined: true,
            creatable: true,
            form: {
              type: 'form',
              fields: { text: { type: 'text' } }
            }
          }
        }
      },
      data: { blocks: [] }
    })
    const field = findField('blocks')
    expect(findMenuButton(field).exists()).toBe(false)
    await field.find('button.dito-create-button').trigger('click')
    await flushPromises()
    expect(data.blocks).toEqual([{ text: null }])
  })

  it('navigates to the create form with the type and query', async () => {
    const query = vi.fn(({ user }) => ({ editor: user.username }))
    const { admin, findField } = await mountSchema({
      schema: {
        fields: {
          recipes: {
            type: 'list',
            resource: { path: 'recipes' },
            creatable: { query },
            forms: {
              soup: {
                type: 'form',
                label: 'Soup',
                fields: { name: { type: 'text' } }
              },
              cake: {
                type: 'form',
                label: 'Cake',
                fields: { name: { type: 'text' } }
              }
            }
          }
        }
      },
      request: ({ method = 'get', url }) => {
        if (method === 'get' && url === '/recipes') return { data: [] }
        throw new Error(`Unexpected request: ${method} ${url}`)
      }
    })
    const field = findField('recipes')
    await findMenuButton(field).trigger('click')
    await field.findAll('[role="menuitem"]')[1].trigger('click')
    await flushPromises()
    const route = admin.router.currentRoute.value
    expect(route.path).toBe('/test/recipes/create')
    expect(route.query).toEqual({ type: 'cake', editor: 'tester' })
    expect(query).toHaveBeenCalledWith(expect.any(SchemaContext))
    // The form creates an item of the type:
    const form = admin.getRouteComponent(isForm)
    expect(form.data.type).toBe('cake')
  })
})
