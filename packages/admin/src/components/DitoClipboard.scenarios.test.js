import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { copyClipboardData } from '../utils/clipboard.js'
import { mountForm, unmountAdmin, enterValue } from '../test/mount.js'

function getNotificationTexts() {
  return [...document.querySelectorAll('.dito-notification')].map(
    notification => notification.textContent
  )
}

// The data that the last copy wrote to the system clipboard, without the
// marks that the clipboard adds, which start with `$`:
function getCopiedData() {
  const [json] = navigator.clipboard.writeText.mock.lastCall
  return Object.fromEntries(
    Object.entries(JSON.parse(json)).filter(([key]) => !key.startsWith('$'))
  )
}

// Clicks a button of the clipboard of the form, in its header:
async function clickFormButton({ wrapper }, button) {
  await wrapper
    .find(`.dito-schema-header .dito-clipboard .dito-button--${button}`)
    .trigger('click')
  await flushPromises()
}

// Returns the inlined schema of the item at `index` of the list at `dataPath`,
// not of the items of its nested lists:
function findItem({ findField }, dataPath, index) {
  const list = findField(dataPath)
  return list
    .findAll('.dito-table__row')
    .filter(row => row.element.closest('.dito-list') === list.element)
    [index].find('.dito-schema-inlined')
}

// Inlined items only show their clipboard while hovered:
async function clickItemButton(item, button) {
  await item.trigger('mouseenter')
  await flushPromises()
  await item
    .find(`.dito-schema-header .dito-clipboard .dito-button--${button}`)
    .trigger('click')
  await flushPromises()
}

const respondWithData = ({ data }) => ({ data })

describe('DitoClipboard in real-world forms', () => {
  beforeEach(() => {
    vi.spyOn(navigator.clipboard, 'writeText')
    // Notifications are logged too:
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(async () => {
    await copyClipboardData('reset', null)
    vi.restoreAllMocks()
  })

  describe('records whose copy leaves out values', () => {
    const schema = {
      name: 'recipe',
      clipboard: {
        // Leave out the version of the copied record and whether it is
        // published, so they don't carry over to the records pasted into:
        copy: ({ clipboardItem }) => ({
          ...clipboardItem,
          expectedUpdatedAt: undefined,
          published: undefined
        })
      },
      fields: {
        expectedUpdatedAt: { type: 'value' },
        title: { type: 'text' },
        published: { type: 'switch' },
        servings: { type: 'number' }
      }
    }

    const soup = {
      title: 'Soup',
      published: true,
      servings: 2,
      expectedUpdatedAt: 5
    }

    const stew = {
      id: 2,
      title: 'Stew',
      published: false,
      servings: 6,
      expectedUpdatedAt: 9
    }

    const mountRecipe = data =>
      mountForm({ schema, data, request: respondWithData })

    const copyRecipe = async data => {
      const form = await mountRecipe(data)
      await clickFormButton(form, 'copy')
      unmountAdmin(form.admin)
    }

    for (const isSystemClipboard of [true, false]) {
      describe(
        isSystemClipboard
          ? 'through the system clipboard'
          : 'without reading the system clipboard',
        () => {
          beforeEach(() => {
            if (!isSystemClipboard) {
              // Browsers other than Chrome ask for permission, which the user
              // may deny. Pasting falls back to the data copied in the admin:
              vi.spyOn(navigator.clipboard, 'readText').mockRejectedValue(
                new Error('Read permission denied')
              )
            }
          })

          it('copies the values without the left-out ones', async () => {
            await copyRecipe(soup)
            expect(getCopiedData()).toEqual({ title: 'Soup', servings: 2 })
          })

          it(`doesn't change the record by pasting into it`, async () => {
            const form = await mountRecipe(soup)
            await clickFormButton(form, 'copy')
            await clickFormButton(form, 'paste')
            expect(form.data).toMatchObject(soup)
            expect(form.dataModel.isDirty).toBe(false)
          })

          it('keeps the left-out values of other records', async () => {
            await copyRecipe(soup)
            const form = await mountRecipe(stew)
            await clickFormButton(form, 'paste')
            expect(form.dataModel.isDirty).toBe(true)
            expect(await form.submit()).toEqual({
              id: 2,
              title: 'Soup',
              published: false,
              servings: 2,
              expectedUpdatedAt: 9
            })
          })

          it('gives new records their defaults of left-out values', async () => {
            await copyRecipe(soup)
            const form = await mountRecipe(null)
            await clickFormButton(form, 'paste')
            expect(await form.submit()).toEqual({
              title: 'Soup',
              published: false,
              servings: 2
            })
          })
        }
      )
    }
  })

  describe('values converted for editing', () => {
    // The prices are stored by region on the product, and edited as a list:
    const regions = ['europe', 'asia', 'america']
    const priceForm = { type: 'form', fields: { price: { type: 'number' } } }
    const schema = {
      name: 'product',
      clipboard: true,
      fields: {
        title: { type: 'text' },
        prices: {
          type: 'list',
          inlined: true,
          creatable: true,
          deletable: true,
          forms: Object.fromEntries(regions.map(region => [region, priceForm])),
          computeValue: ({ item, value }) => (
            value ??
            regions
              .filter(region => item[region])
              .map(region => ({ type: region, ...item[region] }))
          ),
          serializeValue: ({ value, serializedItem }) => {
            for (const { type, ...price } of value) {
              serializedItem[type] = price
            }
          }
        }
      }
    }

    const lamp = { title: 'Lamp', europe: { price: 3 } }
    const chair = {
      id: 2,
      title: 'Chair',
      asia: { price: 5 },
      america: { price: 7 }
    }

    const mountProduct = data =>
      mountForm({ schema, data, request: respondWithData })

    const copyProduct = async data => {
      const form = await mountProduct(data)
      await clickFormButton(form, 'copy')
      unmountAdmin(form.admin)
    }

    it('copies the values as they are stored', async () => {
      await copyProduct(lamp)
      expect(getCopiedData()).toEqual(lamp)
    })

    it(`doesn't change the record by pasting into it`, async () => {
      const form = await mountProduct(lamp)
      await clickFormButton(form, 'copy')
      await clickFormButton(form, 'paste')
      expect(form.dataModel.isDirty).toBe(false)
    })

    it('replaces the converted values of other records', async () => {
      await copyProduct(lamp)
      const form = await mountProduct(chair)
      await clickFormButton(form, 'paste')
      expect(form.data.prices).toEqual([{ type: 'europe', price: 3 }])
      await enterValue(form.findField('prices/0/price').find('input'), '4')
      expect(await form.submit()).toEqual({
        id: 2,
        title: 'Lamp',
        europe: { price: 4 }
      })
    })

    it('pastes the converted values into new records', async () => {
      await copyProduct(lamp)
      const form = await mountProduct(null)
      await clickFormButton(form, 'paste')
      expect(await form.submit()).toEqual(lamp)
    })
  })

  describe('lists with forms by type', () => {
    const textForms = {
      heading: {
        type: 'form',
        clipboard: true,
        fields: { text: { type: 'text' }, level: { type: 'number' } }
      },
      quote: {
        type: 'form',
        clipboard: true,
        fields: { text: { type: 'text' }, source: { type: 'text' } }
      }
    }

    const createBlocks = forms => ({
      type: 'list',
      inlined: true,
      creatable: true,
      clipboard: true,
      forms
    })

    const mountArticle = () =>
      mountForm({
        schema: {
          fields: {
            blocks: createBlocks({
              ...textForms,
              group: {
                type: 'form',
                clipboard: true,
                fields: {
                  title: { type: 'text' },
                  blocks: createBlocks(textForms)
                }
              }
            })
          }
        },
        data: {
          blocks: [
            { type: 'heading', text: 'One', level: 1 },
            { type: 'heading', text: 'Two', level: 2 },
            { type: 'quote', text: 'Three', source: 'Austen' },
            {
              type: 'group',
              title: 'Four',
              blocks: [{ type: 'heading', text: 'Five', level: 3 }]
            }
          ]
        },
        request: respondWithData
      })

    it('pastes items into items of the same type', async () => {
      const form = await mountArticle()
      await clickItemButton(findItem(form, 'blocks', 0), 'copy')
      expect(getCopiedData()).toEqual({
        type: 'heading',
        text: 'One',
        level: 1
      })
      await clickItemButton(findItem(form, 'blocks', 0), 'paste')
      expect(form.dataModel.isDirty).toBe(false)
      await clickItemButton(findItem(form, 'blocks', 1), 'paste')
      expect(form.data.blocks[1]).toEqual({
        type: 'heading',
        text: 'One',
        level: 1
      })
      expect(form.dataModel.isDirty).toBe(true)
    })

    it('pastes items into items of other types, which keep their type and take the values of the same fields', async () => {
      const form = await mountArticle()
      await clickItemButton(findItem(form, 'blocks', 0), 'copy')
      await clickItemButton(findItem(form, 'blocks', 2), 'paste')
      expect((await form.submit()).blocks[2]).toEqual({
        type: 'quote',
        text: 'One',
        source: 'Austen'
      })
    })

    it('pastes items of nested lists into the outer list, and back', async () => {
      const form = await mountArticle()
      await clickItemButton(findItem(form, 'blocks/3/blocks', 0), 'copy')
      await clickItemButton(findItem(form, 'blocks', 1), 'paste')
      await clickItemButton(findItem(form, 'blocks', 0), 'copy')
      await clickItemButton(findItem(form, 'blocks/3/blocks', 0), 'paste')
      expect((await form.submit()).blocks).toEqual([
        { type: 'heading', text: 'One', level: 1 },
        { type: 'heading', text: 'Five', level: 3 },
        { type: 'quote', text: 'Three', source: 'Austen' },
        {
          type: 'group',
          title: 'Four',
          blocks: [{ type: 'heading', text: 'One', level: 1 }]
        }
      ])
    })

    it(`doesn't change items with nested lists by pasting into them`, async () => {
      const form = await mountArticle()
      await clickItemButton(findItem(form, 'blocks', 3), 'copy')
      expect(getCopiedData()).toEqual({
        type: 'group',
        title: 'Four',
        blocks: [{ type: 'heading', text: 'Five', level: 3 }]
      })
      await clickItemButton(findItem(form, 'blocks', 3), 'paste')
      expect(form.dataModel.isDirty).toBe(false)
    })

    it('pastes copied lists as new items, without the types that the list lacks', async () => {
      const form = await mountArticle()
      const clickListButton = async (dataPath, button) => {
        await form
          .findContainer(dataPath)
          .find(`.dito-label .dito-button--${button}`)
          .trigger('click')
        await flushPromises()
      }
      await clickListButton('blocks', 'copy')
      await clickListButton('blocks/3/blocks', 'paste')
      expect((await form.submit()).blocks[3].blocks).toEqual([
        { type: 'heading', text: 'Five', level: 3 },
        { type: 'heading', text: 'One', level: 1 },
        { type: 'heading', text: 'Two', level: 2 },
        { type: 'quote', text: 'Three', source: 'Austen' }
      ])
    })
  })

  describe('relations referenced by label', () => {
    const records = {
      authors: [
        { id: 1, name: 'Jane Austen' },
        { id: 2, name: 'Mary Shelley' }
      ],
      genres: [
        { id: 10, name: 'Gothic' },
        { id: 11, name: 'Romance' }
      ]
    }

    // The options are cached, as apps do for records that many fields list:
    const relateRecords = (url, settings = {}) => ({
      type: 'select',
      relate: true,
      options: {
        data: ({ request }) => request({ url, cache: 'global' }),
        label: 'name'
      },
      ...settings
    })

    const schema = {
      name: 'book',
      clipboard: true,
      fields: {
        title: { type: 'text' },
        author: relateRecords('authors'),
        genres: relateRecords('genres', {
          type: 'multiselect',
          multiple: true
        }),
        chapters: {
          type: 'list',
          inlined: true,
          form: {
            type: 'form',
            fields: {
              title: { type: 'text' },
              narrator: relateRecords('authors')
            }
          }
        }
      }
    }

    const emma = {
      title: 'Emma',
      author: { id: 1 },
      genres: [{ id: 10 }, { id: 11 }],
      chapters: [{ title: 'One', narrator: { id: 2 } }]
    }

    const persuasion = {
      id: 2,
      title: 'Persuasion',
      author: null,
      genres: [],
      chapters: []
    }

    const mountBook = (data, recordsByUrl = records) =>
      mountForm({
        schema,
        data,
        request: ({ method = 'get', url, data }) => ({
          data: method === 'get' ? recordsByUrl[url] : data
        })
      })

    const copyBook = async data => {
      const form = await mountBook(data)
      await clickFormButton(form, 'copy')
      unmountAdmin(form.admin)
    }

    // The records of another admin, with other ids, and `filter()` to leave
    // out or add records:
    const getOtherRecords = (filter = records => records) =>
      Object.fromEntries(
        Object.entries(records).map(([url, items]) => [
          url,
          filter(items.map(({ id, name }) => ({ id: id + 100, name })))
        ])
      )

    it('copies relations as the labels of their records', async () => {
      await copyBook(emma)
      expect(getCopiedData()).toEqual({
        title: 'Emma',
        author: { $label: 'Jane Austen' },
        genres: [{ $label: 'Gothic' }, { $label: 'Romance' }],
        chapters: [{ title: 'One', narrator: { $label: 'Mary Shelley' } }]
      })
    })

    it(`doesn't change the record by pasting into it`, async () => {
      const form = await mountBook(emma)
      await clickFormButton(form, 'copy')
      await clickFormButton(form, 'paste')
      expect(form.dataModel.isDirty).toBe(false)
      expect(getNotificationTexts()).toEqual([])
    })

    it('resolves the labels to the records of other admins', async () => {
      await copyBook(emma)
      const form = await mountBook(persuasion, getOtherRecords())
      await clickFormButton(form, 'paste')
      expect(getNotificationTexts()).toEqual([])
      expect(await form.submit()).toEqual({
        id: 2,
        title: 'Emma',
        author: { id: 101 },
        genres: [{ id: 110 }, { id: 111 }],
        chapters: [{ title: 'One', narrator: { id: 102 } }]
      })
    })

    it('loads the cached options only once when pasting', async () => {
      await copyBook(emma)
      const form = await mountBook(persuasion, getOtherRecords())
      await clickFormButton(form, 'paste')
      const loadsByUrl = Object.groupBy(
        form.request.mock.calls.map(([options]) => options),
        ({ url }) => url
      )
      expect(loadsByUrl.authors).toHaveLength(1)
      expect(loadsByUrl.genres).toHaveLength(1)
    })

    it('pastes the other values when labels are not found, and notifies', async () => {
      await copyBook(emma)
      const form = await mountBook(
        persuasion,
        getOtherRecords(records =>
          records.filter(
            ({ name }) => !['Mary Shelley', 'Romance'].includes(name)
          )
        )
      )
      await clickFormButton(form, 'paste')
      expect(getNotificationTexts().join()).toContain(
        `Not found when pasting: Genres 'Romance', Narrator 'Mary Shelley'`
      )
      expect(await form.submit()).toEqual({
        id: 2,
        title: 'Emma',
        author: { id: 101 },
        genres: [{ id: 110 }],
        chapters: [{ title: 'One', narrator: null }]
      })
    })

    it('leaves labels that match several records unresolved, and notifies', async () => {
      await copyBook(emma)
      const form = await mountBook(
        persuasion,
        getOtherRecords(records => [
          ...records,
          { id: 200, name: 'Jane Austen' }
        ])
      )
      await clickFormButton(form, 'paste')
      expect(getNotificationTexts().join()).toContain(
        `Not found when pasting: Author 'Jane Austen'`
      )
      expect((await form.submit()).author).toBe(null)
    })
  })

  describe('relations within the copied data', () => {
    const schema = {
      name: 'recipe',
      clipboard: true,
      fields: {
        title: { type: 'text' },
        ingredients: {
          type: 'list',
          inlined: true,
          form: { type: 'form', fields: { name: { type: 'text' } } }
        },
        steps: {
          type: 'list',
          inlined: true,
          form: {
            type: 'form',
            fields: {
              text: { type: 'text' },
              ingredient: {
                type: 'select',
                relate: true,
                options: { dataPath: '/ingredients', label: 'name' }
              }
            }
          }
        }
      }
    }

    const bread = {
      title: 'Bread',
      ingredients: [
        { id: 1, name: 'Flour' },
        { id: 2, name: 'Water' }
      ],
      steps: [
        { id: 5, text: 'Pour', ingredient: { id: 2 } },
        { id: 6, text: 'Knead', ingredient: { id: 1 } }
      ]
    }

    const mountRecipe = data =>
      mountForm({ schema, data, request: respondWithData })

    const copyRecipe = async data => {
      const form = await mountRecipe(data)
      await clickFormButton(form, 'copy')
      unmountAdmin(form.admin)
    }

    // The server links the new items through pairs of '#id' and '#ref':
    const expectLinkedRecipe = (recipe, id) => {
      const [flour, water] = recipe.ingredients
      expect(recipe).toEqual({
        id,
        title: 'Bread',
        ingredients: [
          { '#id': expect.any(String), 'name': 'Flour' },
          { '#id': expect.any(String), 'name': 'Water' }
        ],
        steps: [
          { text: 'Pour', ingredient: { '#ref': water['#id'] } },
          { text: 'Knead', ingredient: { '#ref': flour['#id'] } }
        ]
      })
      expect(flour['#id']).not.toBe(water['#id'])
    }

    it('copies them with temporary ids instead of labels', async () => {
      await copyRecipe(bread)
      const copiedData = getCopiedData()
      const [flour, water] = copiedData.ingredients
      expect(copiedData).toEqual({
        title: 'Bread',
        ingredients: [
          { id: expect.stringMatching(/^@\d+$/), name: 'Flour' },
          { id: expect.stringMatching(/^@\d+$/), name: 'Water' }
        ],
        steps: [
          { text: 'Pour', ingredient: { id: water.id } },
          { text: 'Knead', ingredient: { id: flour.id } }
        ]
      })
    })

    it('links the pasted items of other records to each other', async () => {
      await copyRecipe(bread)
      const form = await mountRecipe({
        id: 2,
        title: 'Soup',
        ingredients: [{ id: 20, name: 'Salt' }],
        steps: [{ id: 21, text: 'Boil', ingredient: { id: 20 } }]
      })
      await clickFormButton(form, 'paste')
      expect(getNotificationTexts()).toEqual([])
      expectLinkedRecipe(await form.submit(), 2)
    })

    it('links the pasted items of new records to each other', async () => {
      await copyRecipe(bread)
      const form = await mountRecipe(null)
      await clickFormButton(form, 'paste')
      expectLinkedRecipe(await form.submit())
    })
  })

  describe('fields shown only for some values', () => {
    const isFading = ({ item }) => item.mode === 'fade'
    const schema = {
      name: 'slideshow',
      clipboard: true,
      fields: {
        mode: { type: 'select', options: ['scroll', 'fade'] },
        fadeStyle: { type: 'select', options: ['cross', 'in'], if: isFading },
        // Stored only while it is shown:
        fadeDuration: {
          type: 'number',
          if: isFading,
          serializeValue: ({ item, value }) =>
            isFading({ item }) ? value : null
        },
        speed: { type: 'number' }
      }
    }

    const scrolling = { mode: 'scroll', fadeStyle: 'in', speed: 1 }
    const fading = {
      id: 2,
      mode: 'fade',
      fadeStyle: 'cross',
      fadeDuration: 5,
      speed: 3
    }

    const mountSlideshow = data =>
      mountForm({ schema, data, request: respondWithData })

    const copySlideshow = async data => {
      const form = await mountSlideshow(data)
      await clickFormButton(form, 'copy')
      unmountAdmin(form.admin)
    }

    it('copies only the values of the shown fields', async () => {
      await copySlideshow(scrolling)
      expect(getCopiedData()).toEqual({ mode: 'scroll', speed: 1 })
      await copySlideshow(fading)
      expect(getCopiedData()).toEqual({
        mode: 'fade',
        fadeStyle: 'cross',
        fadeDuration: 5,
        speed: 3
      })
    })

    it(`doesn't change the record by pasting into it`, async () => {
      const form = await mountSlideshow(scrolling)
      await clickFormButton(form, 'copy')
      await clickFormButton(form, 'paste')
      expect(form.dataModel.isDirty).toBe(false)
    })

    it('keeps the values of the fields that the copy hides', async () => {
      await copySlideshow(scrolling)
      const form = await mountSlideshow(fading)
      await clickFormButton(form, 'paste')
      expect(form.findField('fadeStyle').exists()).toBe(false)
      await form.findField('mode').find('select').setValue('fade')
      await flushPromises()
      expect(await form.submit()).toEqual({ ...fading, speed: 1 })
    })
  })

  describe('uploads in items', () => {
    const createFile = name => ({
      name,
      key: name,
      size: 1,
      type: 'image/png',
      url: `/${name}`
    })
    const red = createFile('red.png')
    const blue = createFile('blue.png')

    const mountProduct = () =>
      mountForm({
        schema: {
          fields: {
            variants: {
              type: 'list',
              inlined: true,
              form: {
                type: 'form',
                clipboard: true,
                fields: {
                  name: { type: 'text' },
                  images: { type: 'upload', multiple: true, clipboard: true }
                }
              }
            }
          }
        },
        data: {
          variants: [
            { id: 1, name: 'Red', images: [red] },
            { id: 2, name: 'Blue', images: [blue] }
          ]
        },
        request: respondWithData
      })

    it('pastes the files of items with the items', async () => {
      const form = await mountProduct()
      await clickItemButton(findItem(form, 'variants', 0), 'copy')
      expect(getCopiedData()).toEqual({ name: 'Red', images: [red] })
      await clickItemButton(findItem(form, 'variants', 0), 'paste')
      expect(form.dataModel.isDirty).toBe(false)
      await clickItemButton(findItem(form, 'variants', 1), 'paste')
      expect((await form.submit()).variants).toEqual([
        { id: 1, name: 'Red', images: [red] },
        { id: 2, name: 'Red', images: [red] }
      ])
    })

    it('adds the files of an upload to the upload of another item', async () => {
      const form = await mountProduct()
      const clickUploadButton = async (index, button) => {
        await findItem(form, 'variants', index).trigger('mouseenter')
        await flushPromises()
        await form
          .findField(`variants/${index}/images`)
          .find(`.dito-clipboard .dito-button--${button}`)
          .trigger('click')
        await flushPromises()
      }
      await clickUploadButton(0, 'copy')
      await clickUploadButton(1, 'paste')
      expect((await form.submit()).variants).toEqual([
        { id: 1, name: 'Red', images: [red] },
        { id: 2, name: 'Blue', images: [blue, red] }
      ])
    })
  })
})
