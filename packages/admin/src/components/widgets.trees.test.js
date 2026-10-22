import { vi } from 'vitest'
import { h, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountAdmin, enterValue } from '../test/mount.js'
import TreeListPage from '../test/TreeListPage.vue'
import {
  useDitoForm,
  DitoSchemaForm,
  DitoTextField,
  DitoTreeListField,
  DitoTreeLevel
} from '../index.js'

const titleList = {
  type: 'array',
  items: {
    type: 'object',
    properties: { title: { type: 'string', required: true } }
  }
}

const properties = {
  shopSets: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string', required: true },
        cuts: titleList,
        // Without a `DitoTreeLevel`, the styles aren't a level of the tree:
        styles: titleList
      }
    }
  }
}

const item = {
  id: 1,
  shopSets: [
    {
      name: 'Sans',
      cuts: [{ title: 'Regular' }, { title: 'Bold' }],
      styles: [{ title: 'Italic' }]
    },
    { name: 'Serif', cuts: [], styles: [] }
  ]
}

// The contexts that the form slots of the levels received last:
const contexts = {}

let form = null

// A page that edits a tree of shop sets and their cuts, a level each, with the
// props of the levels:
const createFontPage = ({
  shopSetForm = context => {
    contexts.shopSets = context
    return h(DitoTextField, { name: 'name', label: 'Set' })
  },
  levels = () =>
    h(
      DitoTreeLevel,
      { name: 'cuts', itemLabel: 'title', draggable: true },
      {
        form: context => {
          contexts.cuts = context
          return h(DitoTextField, { name: 'title', label: 'Cut' })
        }
      }
    )
} = {}) => ({
  setup() {
    form = useDitoForm({ resource: 'fonts', id: 1, properties })
    return () =>
      h(DitoSchemaForm, null, {
        default: () =>
          h(
            DitoTreeListField,
            { name: 'shopSets', itemLabel: 'name', collapsed: false },
            { form: shopSetForm, default: levels }
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
      font: {
        type: 'page',
        label: 'Font',
        path: 'font',
        component
      }
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

  it('shows the levels that it declares, each with its own props', async () => {
    const { wrapper } = await mountFontPage()
    // The levels label their items by their own `itemLabel`:
    expect(getLabels(wrapper)).toEqual(['Sans', 'Regular', 'Bold', 'Serif'])
    expect(getFormInput(wrapper).exists()).toBe(false)
    // Only the cuts are draggable, not the shop sets:
    const getHandles = selector =>
      wrapper.findAll(
        `${selector} > .dito-tree-item__header .dito-button--drag`
      )
    const shopSets = '.dito-tree-item[role="tree"] > div > .dito-tree-item'
    expect(getHandles(shopSets)).toHaveLength(0)
    expect(getHandles(`${shopSets} .dito-tree-item`)).toHaveLength(2)
  })

  it('reads the levels and their props from templates', async () => {
    const { wrapper } = await mountFontPage(
      '/font/shopSets/0/cuts/1',
      TreeListPage
    )
    expect(getLabels(wrapper)).toEqual(['Sans', 'Regular', 'Bold', 'Serif'])
    expect(wrapper.findAll('.dito-button--drag')).toHaveLength(2)
    const label = wrapper.find('.dito-tree-list__form-container label')
    expect(label.text()).toBe('Cut 2')
  })

  it('reads hyphenated props of levels', async () => {
    const { wrapper } = await mountFontPage(
      '/font',
      createFontPage({
        levels: () =>
          h(DitoTreeLevel, { 'name': 'cuts', 'item-label': 'title' })
      })
    )
    expect(getLabels(wrapper)).toEqual(['Sans', 'Regular', 'Bold', 'Serif'])
  })

  it('edits only the items of levels with a form', async () => {
    const { wrapper } = await mountFontPage(
      '/font',
      createFontPage({ shopSetForm: null })
    )
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
    expect(contexts.shopSets.item).toBe(form.item.shopSets[1])
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
    form.item.shopSets[0].cuts[1].title = ''
    expect(form.validate()).toBe(false)
    await settle()
    expect(getPath(admin)).toBe('/font/shopSets/0/cuts/1')
    expect(wrapper.find('.dito-tree-list__form-container .dito-errors').text())
      .toBe('The Cut field is required.')
  })

  it('shows the levels that are rendered', async () => {
    const hasCuts = ref(false)
    const { admin, wrapper } = await mountFontPage(
      '/font/shopSets/0',
      createFontPage({
        levels: () =>
          hasCuts.value
            ? h(DitoTreeLevel, { name: 'cuts', itemLabel: 'title' })
            : null
      })
    )
    expect(getLabels(wrapper)).toEqual(['Sans', 'Serif'])
    hasCuts.value = true
    await settle()
    expect(getLabels(wrapper)).toEqual(['Sans', 'Regular', 'Bold', 'Serif'])
    // The form of the selected item stays open:
    expect(getPath(admin)).toBe('/font/shopSets/0')
    expect(getFormInput(wrapper).element.value).toBe('Sans')
    hasCuts.value = false
    await settle()
    expect(getLabels(wrapper)).toEqual(['Sans', 'Serif'])
    expect(getFormInput(wrapper).element.value).toBe('Sans')
  })

  it('opens the form of the parent item when its level goes', async () => {
    const hasCuts = ref(true)
    const { admin, wrapper } = await mountFontPage(
      '/font/shopSets/0/cuts/1',
      createFontPage({
        levels: () =>
          hasCuts.value
            ? h(
                DitoTreeLevel,
                { name: 'cuts', itemLabel: 'title' },
                { form: () => h(DitoTextField, { name: 'title' }) }
              )
            : null
      })
    )
    expect(getFormInput(wrapper).element.value).toBe('Bold')
    hasCuts.value = false
    await settle()
    expect(getPath(admin)).toBe('/font/shopSets/0')
    expect(getFormInput(wrapper).element.value).toBe('Sans')
  })

  it('lays out the forms with the current slots of the levels', async () => {
    const suffixes = ref(['1'])
    // A page that renders the tree in a loop, whose variable the slots read:
    const page = {
      setup() {
        useDitoForm({ resource: 'fonts', id: 1, properties })
        return () =>
          h(DitoSchemaForm, null, {
            default: () =>
              suffixes.value.map(suffix =>
                h(
                  DitoTreeListField,
                  { key: 'shopSets', name: 'shopSets', itemLabel: 'name' },
                  {
                    default: () =>
                      h(
                        DitoTreeLevel,
                        { name: 'cuts', itemLabel: 'title' },
                        {
                          form: () =>
                            h(DitoTextField, {
                              name: 'title',
                              label: `Cut ${suffix}`
                            })
                        }
                      )
                  }
                )
              )
          })
      }
    }
    const { wrapper } = await mountFontPage('/font/shopSets/0/cuts/1', page)
    const getLabel = () =>
      wrapper.find('.dito-tree-list__form-container label').text()
    expect(getLabel()).toBe('Cut 1')
    suffixes.value = ['2']
    await settle()
    expect(getLabel()).toBe('Cut 2')
  })

  it('throws for levels with several child levels', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await mountFontPage(
      '/font',
      createFontPage({
        levels: () => [
          h(DitoTreeLevel, { name: 'cuts' }),
          h(DitoTreeLevel, { name: 'styles' })
        ]
      })
    )
    expect([...error.mock.calls, ...warn.mock.calls].flat()).toContainEqual(
      expect.objectContaining({
        message: `Unsupported tree level with several child levels: 'cuts', 'styles'.`
      })
    )
    error.mockRestore()
    warn.mockRestore()
  })
})
