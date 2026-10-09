import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import {
  mountSchema,
  mountForm,
  enterValue,
  stubConfirm
} from '../test/mount.js'

const ingredientForm = {
  type: 'form',
  label: 'Ingredient',
  components: {
    name: { type: 'text', required: true },
    amount: { type: 'number', default: 1 }
  }
}

function createRecipeSchema(ingredients = {}) {
  return {
    components: {
      ingredients: {
        type: 'list',
        inlined: true,
        form: ingredientForm,
        ...ingredients
      }
    }
  }
}

function getItemNames(field) {
  return field
    .findAll('input[name$="/name"]')
    .map(input => input.element.value)
}

describe('DitoTypeList', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('inlined items', () => {
    it('renders the form of each item and edits its values', async () => {
      const { findField, data } = await mountSchema({
        schema: createRecipeSchema(),
        data: {
          ingredients: [
            { name: 'Flour', amount: 500 },
            { name: 'Salt', amount: 5 }
          ]
        }
      })
      const field = findField('ingredients')
      expect(getItemNames(field)).toEqual(['Flour', 'Salt'])
      await field.find('input[name="ingredients/1/amount"]').setValue('8')
      expect(data.ingredients[1].amount).toBe(8)
    })

    it('defaults to an empty list', async () => {
      const { data } = await mountSchema({ schema: createRecipeSchema() })
      expect(data.ingredients).toEqual([])
    })

    it('creates items with the defaults of their form', async () => {
      const onChange = vi.fn()
      const { findField, data } = await mountSchema({
        schema: createRecipeSchema({ creatable: true, onChange }),
        data: { ingredients: [] }
      })
      const button = findField('ingredients').find('.dito-create-button button')
      // Items of lists without resource are added to the data:
      expect(button.text()).toBe('Add Ingredient')
      await button.trigger('click')
      await flushPromises()
      expect(data.ingredients).toEqual([{ name: null, amount: 1 }])
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce())
    })

    it('labels the create button with `creatable.label`', async () => {
      const { findField } = await mountSchema({
        schema: createRecipeSchema({ creatable: { label: 'New Ingredient' } })
      })
      expect(
        findField('ingredients').find('.dito-create-button button').text()
      ).toBe('New Ingredient')
    })

    it('deletes items after confirmation', async () => {
      const confirm = stubConfirm(false)
      const { findField, data } = await mountSchema({
        schema: createRecipeSchema({ deletable: true }),
        data: {
          ingredients: [{ name: 'Flour' }, { name: 'Salt' }]
        }
      })
      const getDeleteButton = () =>
        findField('ingredients').findAll('.dito-button--remove')[0]
      await getDeleteButton().trigger('click')
      expect(data.ingredients).toHaveLength(2)
      confirm.mockReturnValue(true)
      await getDeleteButton().trigger('click')
      await flushPromises()
      expect(confirm).toHaveBeenLastCalledWith(
        `Do you really want to remove Ingredient 'Flour'?`
      )
      expect(data.ingredients.map(({ name }) => name)).toEqual(['Salt'])
      expect(getItemNames(findField('ingredients'))).toEqual(['Salt'])
    })

    it('displays item labels returned by `itemLabel()`', async () => {
      const { findField } = await mountSchema({
        schema: createRecipeSchema({
          itemLabel: ({ item, index }) => ({
            text: `${index + 1}. ${item.name}`,
            suffix: `${item.amount} g`
          })
        }),
        data: { ingredients: [{ name: 'Flour', amount: 500 }] }
      })
      const label = findField('ingredients').find('.dito-label')
      expect(label.text()).toContain('1. Flour')
      expect(label.text()).toContain('500 g')
    })

    it('collapses the items with `collapsed` and opens them on click', async () => {
      const { findField } = await mountSchema({
        schema: createRecipeSchema({ collapsible: true, collapsed: true }),
        data: { ingredients: [{ name: 'Flour' }] }
      })
      const field = findField('ingredients')
      expect(getItemNames(field)).toEqual([])
      await field.find('.dito-label').trigger('click')
      await flushPromises()
      expect(getItemNames(findField('ingredients'))).toEqual(['Flour'])
    })

    it('numbers the items by `orderKey` and keeps numbering them', async () => {
      const { findField, data, getComponent, settle } = await mountSchema({
        schema: createRecipeSchema({
          creatable: true,
          draggable: true,
          orderKey: 'position'
        }),
        data: {
          ingredients: [{ name: 'Flour' }, { name: 'Salt' }]
        }
      })
      expect(data.ingredients).toMatchObject([
        { name: 'Flour', position: 0 },
        { name: 'Salt', position: 1 }
      ])
      // Reorder the items like dragging does:
      const list = getComponent('ingredients')
      list.listData = [...list.listData].reverse()
      await settle()
      expect(data.ingredients).toMatchObject([
        { name: 'Salt', position: 0 },
        { name: 'Flour', position: 1 }
      ])
      expect(getItemNames(findField('ingredients'))).toEqual([
        'Salt',
        'Flour'
      ])
    })
  })

  describe('multiple forms', () => {
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
            image: {
              type: 'form',
              label: 'Image',
              components: { url: { type: 'url' } }
            }
          }
        }
      }
    }

    it('renders the form of the type of each item', async () => {
      const { findField } = await mountSchema({
        schema: blocksSchema,
        data: {
          blocks: [
            { type: 'image', url: 'https://example.com/a.png' },
            { type: 'heading', text: 'Intro' }
          ]
        }
      })
      const inputs = findField('blocks').findAll('input')
      expect(inputs.map(input => input.attributes('name'))).toEqual([
        'blocks/0/url',
        'blocks/1/text'
      ])
    })

    it('creates items of the type chosen in the pulldown', async () => {
      const { findField, data } = await mountSchema({
        schema: blocksSchema,
        data: { blocks: [] }
      })
      const field = findField('blocks')
      const items = field.findAll('.dito-pulldown__item')
      expect(items.map(item => item.text())).toEqual(['Heading', 'Image'])
      await field.find('.dito-create-button button').trigger('mousedown')
      await items[1].trigger('mousedown')
      await items[1].trigger('mouseup')
      await flushPromises()
      expect(data.blocks).toEqual([{ type: 'image', url: null }])
    })
  })

  describe('primitive values', () => {
    it('edits primitive values through `wrapPrimitives`', async () => {
      const { findField, data } = await mountSchema({
        schema: {
          components: {
            tags: {
              type: 'list',
              inlined: true,
              creatable: true,
              wrapPrimitives: 'tag',
              form: {
                type: 'form',
                components: { tag: { type: 'text' } }
              }
            }
          }
        },
        data: { tags: ['classic', 'novel'] }
      })
      const inputs = findField('tags').findAll('input')
      expect(inputs.map(input => input.element.value)).toEqual([
        'classic',
        'novel'
      ])
      await enterValue(inputs[1], 'romance')
      expect(data.tags).toEqual(['classic', 'romance'])
    })
  })

  describe('nested forms', () => {
    const chaptersSchema = {
      components: {
        chapters: {
          type: 'list',
          editable: true,
          creatable: true,
          itemLabel: 'title',
          form: {
            type: 'form',
            label: 'Chapter',
            components: { title: { type: 'text' } }
          }
        }
      }
    }

    it('edits items in nested forms and applies the changes', async () => {
      const { admin, findField, data, settle } = await mountForm({
        schema: chaptersSchema,
        data: { chapters: [{ title: 'Prologue' }, { title: 'Arrival' }] }
      })
      const field = findField('chapters')
      expect(field.findAll('tbody tr').map(row => row.text())).toEqual([
        'Prologue',
        'Arrival'
      ])
      await field.findAll('a.dito-button--edit')[1].trigger('click')
      await settle()
      expect(admin.router.currentRoute.value.path).toBe('/items/1/chapters/1')
      const chapterForm = admin.getRouteComponent(it => it.isForm)
      expect(chapterForm.isTransient).toBe(true)
      const input = admin.wrapper.find('input[name="chapters/1/title"]')
      await enterValue(input, 'Departure')
      // Nested forms edit a copy of the item until the changes are applied:
      expect(data.chapters[1].title).toBe('Arrival')
      await admin.wrapper
        .find('.dito-buttons--main button[type="submit"]')
        .trigger('click')
      await settle()
      expect(data.chapters[1].title).toBe('Departure')
      expect(admin.router.currentRoute.value.path).toBe('/items/1')
    })
  })

  describe('columns', () => {
    it('renders the cells of the columns with `render()`', async () => {
      const { findField } = await mountSchema({
        schema: {
          components: {
            books: {
              type: 'list',
              columns: {
                title: {},
                pages: {
                  label: 'Length',
                  render: ({ value }) => `${value} pages`
                }
              }
            }
          }
        },
        data: {
          books: [
            { title: 'Emma', pages: 474 },
            { title: 'Dune', pages: 412 }
          ]
        }
      })
      const field = findField('books')
      expect(field.findAll('th').map(th => th.text())).toEqual([
        'Title',
        'Length'
      ])
      expect(
        field
          .findAll('tbody tr')
          .map(row => row.findAll('td').map(cell => cell.text()))
      ).toEqual([
        ['Emma', '474 pages'],
        ['Dune', '412 pages']
      ])
    })
  })

  describe('processing', () => {
    it('sends empty lists as `null` with `process()`', async () => {
      const { findField, submit } = await mountForm({
        schema: createRecipeSchema({
          deletable: true,
          compute: ({ value }) => value ?? [],
          process: ({ value }) => (value?.length > 0 ? value : null)
        }),
        data: { ingredients: [{ name: 'Flour', amount: 1 }] },
        request: ({ data }) => ({ data })
      })
      stubConfirm(true)
      await findField('ingredients')
        .find('.dito-button--remove')
        .trigger('click')
      expect(await submit()).toMatchObject({ ingredients: null })
    })

    it('fills in `null` lists through `compute()`', async () => {
      const { data } = await mountForm({
        schema: createRecipeSchema({ compute: ({ value }) => value ?? [] }),
        data: { ingredients: null }
      })
      expect(data.ingredients).toEqual([])
    })
  })

  describe('validation', () => {
    it(`shows the errors of the items' values when submitting`, async () => {
      const request = vi.fn(({ data }) => ({ data }))
      const { submit, getErrors } = await mountForm({
        schema: createRecipeSchema(),
        data: {
          ingredients: [{ name: 'Flour' }, { name: '' }]
        },
        request
      })
      expect(await submit()).toBe(null)
      expect(getErrors('ingredients/1/name')).toEqual([
        'The Name field is required.'
      ])
      expect(getErrors('ingredients/0/name')).toEqual([])
    })

    it('reveals collapsed items with errors', async () => {
      const { findField, submit, getErrors } = await mountForm({
        schema: createRecipeSchema({ collapsible: true, collapsed: true }),
        data: { ingredients: [{ name: '' }] },
        request: ({ data }) => ({ data })
      })
      expect(getItemNames(findField('ingredients'))).toEqual([])
      expect(await submit()).toBe(null)
      expect(getItemNames(findField('ingredients'))).toEqual([''])
      expect(getErrors('ingredients/0/name')).toHaveLength(1)
    })
  })
})
