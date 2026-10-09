import { vi } from 'vitest'
import { h } from 'vue'
import { flushPromises } from '@vue/test-utils'
import Sortable from 'sortablejs'
import { RequestError } from '../utils/request.js'
import {
  mountSchema,
  mountForm,
  mountAdmin,
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

    it('keeps the state of each item when inserting items', async () => {
      const { findField, getComponent, settle } = await mountSchema({
        schema: createRecipeSchema({ collapsible: true, collapsed: true }),
        data: {
          ingredients: [{ name: 'Flour' }, { name: 'Salt' }, { name: 'Yeast' }]
        }
      })
      await findField('ingredients').findAll('.dito-label')[1].trigger('click')
      await settle()
      expect(getItemNames(findField('ingredients'))).toEqual(['Salt'])
      const list = getComponent('ingredients')
      list.createItem(ingredientForm, null, 1)
      await settle()
      // The inserted item is opened, see `createItem()`, and the others keep
      // their state:
      const getOpenedNames = () =>
        list.schemaComponents
          .filter(schemaComponent => schemaComponent.opened)
          .map(schemaComponent => schemaComponent.data.name)
          .sort()
      expect(getOpenedNames()).toEqual(['Salt', null])
      expect(getItemNames(findField('ingredients'))).toEqual(['', 'Salt'])
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

  describe('dragging', () => {
    it('reports changes only for items dropped at new positions', async () => {
      const onChange = vi.fn()
      const { findField, getComponent, settle } = await mountSchema({
        schema: createRecipeSchema({ draggable: true, onChange }),
        data: { ingredients: [{ name: 'Flour' }, { name: 'Salt' }] }
      })
      const sortable = Sortable.get(
        findField('ingredients').find('tbody').element
      )
      // Dropping an item where it was picked up changes nothing:
      sortable.option('onStart')({ oldIndex: 0 })
      sortable.option('onEnd')({ oldIndex: 0, newIndex: 0 })
      await settle()
      expect(onChange).not.toHaveBeenCalled()
      // Sortable moves the item and then ends the drag:
      sortable.option('onStart')({ oldIndex: 0 })
      const list = getComponent('ingredients')
      list.listData = [...list.listData].reverse()
      sortable.option('onEnd')({ oldIndex: 0, newIndex: 1 })
      await settle()
      expect(onChange).toHaveBeenCalledOnce()
      expect(getItemNames(findField('ingredients'))).toEqual(['Salt', 'Flour'])
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

    it('creates items of the type chosen in the menu', async () => {
      const { findField, data } = await mountSchema({
        schema: blocksSchema,
        data: { blocks: [] }
      })
      const field = findField('blocks')
      await field.find('.dito-create-button button').trigger('click')
      const items = field.findAll('[role="menuitem"]')
      expect(items.map(item => item.text())).toEqual(['Heading', 'Image'])
      await items[1].trigger('click')
      await flushPromises()
      expect(data.blocks).toEqual([{ type: 'image', url: null }])
    })

    it('inserts items of all forms through the buttons of an item', async () => {
      const { findField, data } = await mountSchema({
        schema: {
          components: {
            blocks: { ...blocksSchema.components.blocks, draggable: true }
          }
        },
        data: {
          blocks: [
            { type: 'heading', text: 'Intro' },
            { type: 'heading', text: 'Outro' }
          ]
        }
      })
      const field = findField('blocks')
      await field
        .findAll('.dito-schema-inlined .dito-create-button button')[1]
        .trigger('click')
      const items = field.findAll('[role="menuitem"]')
      expect(items.map(item => item.text())).toEqual(['Heading', 'Image'])
      await items[1].trigger('click')
      await flushPromises()
      expect(data.blocks.map(({ type }) => type)).toEqual([
        'heading',
        'image',
        'heading'
      ])
    })

    it('disables the buttons of items whose form disables them', async () => {
      const { findField } = await mountSchema({
        schema: {
          components: {
            blocks: {
              ...blocksSchema.components.blocks,
              deletable: true,
              forms: {
                ...blocksSchema.components.blocks.forms,
                image: {
                  ...blocksSchema.components.blocks.forms.image,
                  deletable: false
                }
              }
            }
          }
        },
        data: {
          blocks: [
            { type: 'heading', text: 'Intro' },
            { type: 'image', url: 'https://example.com/a.png' }
          ]
        }
      })
      const buttons = findField('blocks').findAll('.dito-button--remove')
      expect(buttons.map(button => button.element.disabled)).toEqual([
        false,
        true
      ])
    })
  })

  describe(`items that aren't inlined`, () => {
    async function getItemTexts(ingredients) {
      const { findField } = await mountSchema({
        schema: {
          components: {
            ingredients: { type: 'list', form: ingredientForm, ...ingredients }
          }
        },
        data: {
          ingredients: [
            { name: 'Flour', amount: 500 },
            { name: 'Salt', amount: 5 }
          ]
        }
      })
      return findField('ingredients')
        .findAll('tbody td')
        .map(cell => cell.text())
    }

    it('renders the items with their `component`', async () => {
      const texts = await getItemTexts({
        component: {
          render() {
            return h('em', `${this.data.amount} g`)
          }
        }
      })
      expect(texts).toEqual(['500 g', '5 g'])
    })

    it('renders the items with `render()`', async () => {
      const texts = await getItemTexts({
        render: ({ item, index }) => `${index + 1}: ${item.name}`
      })
      expect(texts).toEqual(['1: Flour', '2: Salt'])
    })

    it('renders the items with their label', async () => {
      const texts = await getItemTexts({})
      expect(texts).toEqual(['Flour', 'Salt'])
    })
  })

  describe('list buttons', () => {
    const importButton = { type: 'button', label: 'Import' }

    it('disables the custom buttons while the list is disabled', async () => {
      const { findField } = await mountSchema({
        schema: createRecipeSchema({
          disabled: true,
          buttons: { import: importButton }
        }),
        data: { ingredients: [] }
      })
      const container = findField('ingredients').find(
        '.dito-buttons__container'
      )
      expect(container.classes()).toContain('dito-container--disabled')
    })

    it('passes the list data to the buttons in single views', async () => {
      const contextItems = []
      const button = {
        ...importButton,
        disabled: ({ item }) => {
          contextItems.push(item)
          return false
        }
      }
      const items = [{ id: 1, name: 'Flour' }]
      const admin = await mountAdmin({
        views: {
          ingredients: {
            type: 'view',
            component: {
              type: 'list',
              resource: { path: 'ingredients' },
              buttons: { import: button }
            }
          }
        },
        request: () => ({ data: items })
      })
      await admin.navigate('/ingredients')
      expect(contextItems.length).toBeGreaterThan(0)
      // Buttons of single views act on the list data, e.g. to store its order:
      expect(contextItems.at(-1)).toEqual(items)
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

    it('renders wrapped primitive values of loaded data with stores', async () => {
      // Rendering the items without their stores throws, which Vue only logs:
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { findField } = await mountForm({
        schema: {
          components: {
            tags: {
              type: 'list',
              inlined: true,
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
      const stores = findField('tags')
        .findAllComponents({ name: 'DitoSchemaInlined' })
        .map(schema => schema.props('store'))
      expect(stores).toHaveLength(2)
      expect(stores).not.toContain(null)
      expect(error).not.toHaveBeenCalled()
      expect(warn).not.toHaveBeenCalled()
      error.mockRestore()
      warn.mockRestore()
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

  describe('item uids', () => {
    it('keeps the uids of items that nested forms apply', async () => {
      const { admin, findField, data, getComponent, settle } = await mountForm({
        schema: {
          components: {
            chapters: {
              type: 'list',
              editable: true,
              itemLabel: 'title',
              form: {
                type: 'form',
                components: { title: { type: 'text' } }
              }
            }
          }
        },
        data: { chapters: [{ title: 'Prologue' }] }
      })
      const list = getComponent('chapters')
      const uid = list.getItemUid(list.schema, data.chapters[0])
      const store = list.getItemStore(data.chapters[0])
      await findField('chapters').find('a.dito-button--edit').trigger('click')
      await settle()
      await admin.wrapper
        .find('.dito-buttons--main button[type="submit"]')
        .trigger('click')
      await settle()
      const [chapter] = data.chapters
      expect(list.getItemUid(list.schema, chapter)).toBe(uid)
      expect(list.getItemStore(chapter)).toBe(store)
    })

    it('keeps the uids of nested items that nested forms remove', async () => {
      const { admin, findField, data, getComponent, settle } = await mountForm({
        schema: {
          components: {
            chapters: {
              type: 'list',
              editable: true,
              itemLabel: 'title',
              form: {
                type: 'form',
                components: {
                  sections: {
                    type: 'list',
                    deletable: true,
                    itemLabel: 'title',
                    form: ingredientForm
                  }
                }
              }
            }
          }
        },
        data: {
          chapters: [
            { title: 'Prologue', sections: [{ name: 'One' }, { name: 'Two' }] }
          ]
        }
      })
      const list = getComponent('chapters')
      const [, secondSection] = data.chapters[0].sections
      const uid = list.getItemUid(list.schema, secondSection)
      await findField('chapters').find('a.dito-button--edit').trigger('click')
      await settle()
      stubConfirm(true)
      await admin.wrapper.find('.dito-button--remove').trigger('click')
      await settle()
      await admin.wrapper
        .find('.dito-buttons--main button[type="submit"]')
        .trigger('click')
      await settle()
      const [section] = data.chapters[0].sections
      expect(section.name).toBe('Two')
      expect(list.getItemUid(list.schema, section)).toBe(uid)
    })

    it('keeps the uids of new items when saving them', async () => {
      let lastId = 1
      const addIds = item => ({
        ...item,
        ingredients: item.ingredients.map(ingredient => ({
          id: ++lastId,
          ...ingredient
        }))
      })
      const result = await mountForm({
        schema: createRecipeSchema(),
        data: { ingredients: [{ name: 'Flour' }] },
        request: ({ data }) => ({ data: addIds(data) })
      })
      const list = result.getComponent('ingredients')
      const uid = list.getItemUid(list.schema, result.data.ingredients[0])
      await result.submit()
      // The saved data replaces the form's data:
      const [ingredient] = result.data.ingredients
      expect(ingredient.id).toBe(2)
      expect(list.getItemUid(list.schema, ingredient)).toBe(uid)
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
    it('passes the data path of the value to `render()`', async () => {
      const { findField } = await mountSchema({
        schema: {
          components: {
            books: {
              type: 'list',
              columns: { title: { render: ({ dataPath }) => dataPath } }
            }
          }
        },
        data: { books: [{ title: 'Emma' }] }
      })
      expect(findField('books').find('tbody td').text()).toBe(
        'books/0/title'
      )
    })
  })

  it('spans the list buttons across the columns and edit buttons', async () => {
    const { findField } = await mountSchema({
      schema: {
        components: {
          books: {
            type: 'list',
            creatable: true,
            columns: { title: {}, pages: {} },
            form: { type: 'form', components: { title: { type: 'text' } } }
          },
          authors: {
            type: 'list',
            creatable: true,
            deletable: true,
            columns: { name: {}, born: {} },
            form: { type: 'form', components: { name: { type: 'text' } } }
          }
        }
      },
      data: {
        books: [{ title: 'Emma', pages: 474 }],
        authors: [{ name: 'Jane Austen', born: 1775 }]
      }
    })
    const getColspan = dataPath =>
      findField(dataPath).find('tfoot td.dito-table__buttons').attributes(
        'colspan'
      )
    expect(getColspan('books')).toBe('2')
    expect(getColspan('authors')).toBe('3')
  })

  describe('keyboard reordering', () => {
    it('moves items with their drag handles within the list', async () => {
      const { findField, data, settle } = await mountSchema({
        schema: {
          components: {
            books: {
              type: 'list',
              draggable: true,
              orderKey: 'position',
              columns: { title: {} }
            }
          }
        },
        data: {
          books: [{ title: 'Emma' }, { title: 'Dune' }, { title: 'Ulysses' }]
        }
      })
      const moveBook = async (index, key) => {
        await findField('books')
          .findAll('.dito-button--drag')
          [index].trigger('keydown', { key, altKey: true })
        await settle()
      }
      await moveBook(0, 'ArrowDown')
      expect(data.books).toEqual([
        { title: 'Dune', position: 0 },
        { title: 'Emma', position: 1 },
        { title: 'Ulysses', position: 2 }
      ])
      // Items can't move beyond the ends of the list:
      await moveBook(2, 'ArrowDown')
      await moveBook(0, 'ArrowUp')
      expect(data.books.map(book => book.title)).toEqual([
        'Dune',
        'Emma',
        'Ulysses'
      ])
    })

    it('moves inlined items with their drag handles', async () => {
      const { findField, data, settle } = await mountSchema({
        schema: {
          components: {
            books: {
              type: 'list',
              inlined: true,
              draggable: true,
              form: { type: 'form', components: { title: { type: 'text' } } }
            }
          }
        },
        data: { books: [{ title: 'Emma' }, { title: 'Dune' }] }
      })
      await findField('books')
        .findAll('.dito-button--drag')[0]
        .trigger('keydown', { key: 'ArrowDown', altKey: true })
      await settle()
      expect(data.books.map(book => book.title)).toEqual(['Dune', 'Emma'])
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
      // The confirmation dialog resolves asynchronously, see `stubConfirm()`:
      await flushPromises()
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

  describe('query', () => {
    async function mountBooksView() {
      const admin = await mountAdmin({
        views: {
          books: {
            type: 'view',
            component: {
              type: 'list',
              resource: { path: 'books' },
              paginate: 2,
              scopes: { all: {}, drafts: {} },
              columns: { title: { sortable: true } }
            }
          }
        },
        request: () => ({
          data: { results: [{ id: 1, title: 'Emma' }], total: 5 }
        })
      })
      await admin.navigate('/books?page=2')
      const getLoadQueries = () =>
        admin.request.mock.calls
          .map(([options]) => options)
          .filter(({ url }) => url === '/books')
          .map(({ query }) => query)
      return { admin, getLoadQueries }
    }

    it('adds the defaults to the route query and loads once', async () => {
      const { admin, getLoadQueries } = await mountBooksView()
      expect(admin.router.currentRoute.value.query).toEqual({
        scope: 'all',
        page: '2'
      })
      expect(getLoadQueries()).toEqual([{ scope: 'all', range: '4,5' }])
    })

    it('changes the scope through the route and resets the page', async () => {
      const { admin, getLoadQueries } = await mountBooksView()
      const scopeButton = admin.wrapper.findAll('.dito-scopes button')[1]
      await scopeButton.trigger('click')
      await flushPromises()
      expect(admin.router.currentRoute.value.query).toEqual({
        scope: 'drafts',
        page: '0'
      })
      expect(getLoadQueries().at(-1)).toEqual({
        scope: 'drafts',
        range: '0,1'
      })
      expect(scopeButton.attributes('aria-pressed')).toBe('true')
    })

    it('sorts by columns through the route and resets the page', async () => {
      const { admin, getLoadQueries } = await mountBooksView()
      await admin.wrapper.find('.dito-table-head button').trigger('click')
      await flushPromises()
      expect(admin.router.currentRoute.value.query).toEqual({
        scope: 'all',
        page: '0',
        order: 'title asc'
      })
      expect(getLoadQueries().at(-1)).toEqual({
        scope: 'all',
        order: 'title asc',
        range: '0,1'
      })
    })
  })

  describe('filters', () => {
    async function mountFilteredRecipes(request) {
      return mountSchema({
        schema: {
          components: {
            recipes: {
              type: 'list',
              resource: { path: 'recipes' },
              paginate: 2,
              filters: { title: { filter: 'text' } },
              form: { type: 'form', components: { title: { type: 'text' } } }
            }
          }
        },
        request
      })
    }

    it('loads the list with the query of the filters panel', async () => {
      const request = vi.fn(() => ({
        data: { results: [{ id: 1, title: 'Soup' }], total: 1 }
      }))
      const { wrapper, getComponent } = await mountFilteredRecipes(request)
      const recipes = getComponent('recipes')
      recipes.listQuery.update({ page: 1 })
      await flushPromises()
      expect(recipes.query.page).toBe('1')
      const panel = wrapper.find('.dito-panel')
      await enterValue(panel.find('input[type="text"]'), 'Soup')
      await panel.find('button[type="submit"]').trigger('click')
      await flushPromises()
      // Filtering resets the page, as the filtered list has other pages:
      expect(recipes.query).toMatchObject({
        filter: ['title:"Soup"'],
        page: '0'
      })
      expect(JSON.stringify(request.mock.lastCall[0].query)).toContain(
        'title:\\"Soup\\"'
      )
    })

    it('notifies filter errors of lists without filters panel', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      await mountSchema({
        schema: {
          components: {
            recipes: {
              type: 'list',
              resource: { path: 'recipes' },
              form: { type: 'form', components: { title: { type: 'text' } } }
            }
          }
        },
        request() {
          throw new RequestError({
            status: 400,
            statusText: 'Error',
            data: {
              type: 'FilterValidation',
              message: 'The query filter is not valid',
              errors: { 'title/text': [{ message: 'must be shorter' }] }
            }
          })
        }
      })
      const texts = [...document.querySelectorAll('.dito-notification')].map(
        notification => notification.textContent
      )
      expect(texts.join()).toContain('The query filter is not valid')
    })

    it('shows filter errors on the filters panel', async () => {
      const { wrapper } = await mountSchema({
        schema: {
          components: {
            recipes: {
              type: 'list',
              resource: { path: 'recipes' },
              filters: { title: { filter: 'text' } },
              form: { type: 'form', components: { title: { type: 'text' } } }
            }
          }
        },
        request() {
          throw new RequestError({
            status: 400,
            statusText: 'Error',
            data: {
              type: 'FilterValidation',
              message: 'The query filter is not valid',
              errors: { 'title/text': [{ message: 'must be shorter' }] }
            }
          })
        }
      })
      const errors = wrapper
        .find('.dito-panel')
        .findAll('.dito-errors li')
        .map(item => item.text())
      expect(errors).toEqual(['The Text field must be shorter.'])
      // The errors are highlighted instead of notifying the request error:
      const texts = [...document.querySelectorAll('.dito-notification')].map(
        notification => notification.textContent
      )
      expect(texts.join()).toContain('Please correct the highlighted errors.')
      expect(texts.join()).not.toContain('The query filter is not valid')
    })
  })
})
