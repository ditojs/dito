import { vi } from 'vitest'
import { h } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountAdmin, enterValue } from '../test/mount.js'
import {
  useDitoForm,
  DitoSchemaForm,
  DitoTextField,
  DitoTreeListField
} from '../index.js'

const nameList = {
  type: 'array',
  items: {
    type: 'object',
    properties: { name: { type: 'string', required: true } }
  }
}

const properties = {
  shopSets: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string', required: true },
        cuts: nameList,
        // Without a slot, the styles aren't a level of the tree:
        styles: nameList
      }
    }
  }
}

const item = {
  id: 1,
  shopSets: [
    {
      name: 'Sans',
      cuts: [{ name: 'Regular' }, { name: 'Bold' }],
      styles: [{ name: 'Italic' }]
    },
    { name: 'Serif', cuts: [], styles: [] }
  ]
}

// The contexts that the slots of the levels received last:
const contexts = {}

let form = null

// A page that edits a tree of shop sets and their cuts, one slot per level:
const createFontPage = (slots = {}) => ({
  setup() {
    form = useDitoForm({ resource: 'fonts', id: 1, properties })
    return () =>
      h(DitoSchemaForm, null, {
        default: () =>
          h(
            DitoTreeListField,
            { name: 'shopSets', itemLabel: 'name', collapsed: false },
            {
              shopSets: context => {
                contexts.shopSets = context
                return h(DitoTextField, { name: 'name', label: 'Set' })
              },
              cuts: context => {
                contexts.cuts = context
                return h(DitoTextField, { name: 'name', label: 'Cut' })
              },
              ...slots
            }
          )
      })
  }
})

async function mountFontPage(path = '/font', component = createFontPage()) {
  const request = vi.fn(({ method = 'get', url }) => {
    if (method === 'get' && url === '/fonts/1') {
      return { data: structuredClone(item) }
    } else {
      throw new Error(`Unexpected request: ${method} ${url}`)
    }
  })
  const admin = await mountAdmin({
    path,
    views: {
      font: { type: 'page', label: 'Font', path: 'font', component }
    },
    request
  })
  const notify = vi.spyOn(admin.context, 'notify')
  await settle()
  return { admin, notify, wrapper: admin.wrapper }
}

async function settle() {
  for (let i = 0; i < 3; i++) {
    await flushPromises()
    await new Promise(resolve => setTimeout(resolve))
  }
  await flushPromises()
}

const getPath = admin => admin.router.currentRoute.value.path

const getLabels = wrapper =>
  wrapper
    .findAll('.dito-tree-item__header .dito-tree-item__label')
    .map(label => label.text())

const getFormInput = wrapper =>
  wrapper.find('.dito-tree-list__form-container input')

const clickEdit = async (wrapper, index) => {
  const buttons = wrapper.findAll('.dito-tree-item .dito-button--edit')
  await buttons[index].trigger('click')
  await settle()
}

describe('DitoTreeListField', () => {
  afterEach(() => {
    form = null
  })

  it('shows the levels of its lists that have slots', async () => {
    const { wrapper } = await mountFontPage()
    expect(getLabels(wrapper)).toEqual(['Sans', 'Regular', 'Bold', 'Serif'])
    expect(getFormInput(wrapper).exists()).toBe(false)
  })

  it('edits only the items of levels with a slot', async () => {
    const { wrapper } = await mountFontPage(
      '/font',
      createFontPage({ shopSets: undefined })
    )
    expect(getLabels(wrapper)).toEqual(['Sans', 'Regular', 'Bold', 'Serif'])
    // Regular, Bold:
    const buttons = wrapper.findAll('.dito-tree-item .dito-button--edit')
    expect(buttons).toHaveLength(2)
  })

  it('opens the form of the selected item in its route', async () => {
    const { admin, wrapper } = await mountFontPage()
    // Sans, Regular, Bold, Serif:
    await clickEdit(wrapper, 2)
    expect(getPath(admin)).toBe('/font/shopSets/0/cuts/1')
    const label = wrapper.find('.dito-tree-list__form-container label')
    expect(label.text()).toBe('Cut')
    expect(getFormInput(wrapper).element.value).toBe('Bold')
    expect(contexts.cuts.item).toBe(form.item.shopSets[0].cuts[1])
    expect(contexts.cuts.itemIndex).toBe(1)
    expect(contexts.cuts.parentItem).toBe(form.item.shopSets[0])
    await clickEdit(wrapper, 3)
    expect(getPath(admin)).toBe('/font/shopSets/1')
    expect(getFormInput(wrapper).element.value).toBe('Serif')
    admin.router.back()
    await settle()
    expect(getPath(admin)).toBe('/font/shopSets/0/cuts/1')
    expect(getFormInput(wrapper).element.value).toBe('Bold')
  })

  it('opens the form of the item of a deep link', async () => {
    const { wrapper } = await mountFontPage('/font/shopSets/0/cuts/1')
    expect(getFormInput(wrapper).element.value).toBe('Bold')
    expect(
      wrapper.find('.dito-tree-item--active .dito-tree-item__label').text()
    ).toBe('Bold')
  })

  it('edits the item in place', async () => {
    const { wrapper } = await mountFontPage('/font/shopSets/0')
    await enterValue(getFormInput(wrapper), 'Mono')
    expect(form.item.shopSets[0].name).toBe('Mono')
    expect(form.isDirty).toBe(true)
    expect(getLabels(wrapper)[0]).toBe('Mono')
  })

  it('opens the form of the item that holds errors', async () => {
    const { admin, wrapper } = await mountFontPage()
    form.item.shopSets[0].cuts[1].name = ''
    expect(form.validate()).toBe(false)
    await settle()
    expect(getPath(admin)).toBe('/font/shopSets/0/cuts/1')
    expect(wrapper.find('.dito-tree-list__form-container .dito-errors').text())
      .toBe('The Cut field is required.')
  })

  it('throws for levels with several lists with slots', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await mountFontPage('/font', createFontPage({ styles: () => null }))
    expect([...error.mock.calls, ...warn.mock.calls].flat()).toContainEqual(
      expect.objectContaining({
        message: `Unsupported tree level with several child lists: 'cuts', 'styles'.`
      })
    )
    error.mockRestore()
    warn.mockRestore()
  })
})
