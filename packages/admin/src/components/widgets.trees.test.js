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
  volumes: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string', required: true },
        chapters: titleList,
        // Without a `DitoTreeLevel`, the sections aren't a level of the tree:
        sections: titleList
      }
    }
  }
}

const item = {
  id: 1,
  volumes: [
    {
      name: 'Poetry',
      chapters: [{ title: 'Preface' }, { title: 'Body' }],
      sections: [{ title: 'Interlude' }]
    },
    { name: 'Prose', chapters: [], sections: [] }
  ]
}

// The contexts that the form slots of the levels received last:
const contexts = {}

let form = null

// A page that edits a tree of volumes and their chapters, a level each, with
// the props of the levels:
const createBookPage = ({
  volumeForm = context => {
    contexts.volumes = context
    return h(DitoTextField, { name: 'name', label: 'Set' })
  },
  levels = () =>
    h(
      DitoTreeLevel,
      { name: 'chapters', itemLabel: 'title', draggable: true },
      {
        form: context => {
          contexts.chapters = context
          return h(DitoTextField, { name: 'title', label: 'Chapter' })
        }
      }
    )
} = {}) => ({
  setup() {
    form = useDitoForm({ resource: 'books', id: 1, properties })
    return () =>
      h(DitoSchemaForm, null, {
        default: () =>
          h(
            DitoTreeListField,
            { name: 'volumes', itemLabel: 'name', collapsed: false },
            { form: volumeForm, default: levels }
          )
      })
  }
})

async function mountBookPage(path = '/book', component = createBookPage()) {
  const request = vi.fn(({ method = 'get', url }) => {
    if (method === 'get' && url === '/books/1') {
      return { data: structuredClone(item) }
    } else {
      throw new Error(`Unexpected request: ${method} ${url}`)
    }
  })
  const admin = await mountAdmin({
    path,
    views: {
      book: {
        type: 'page',
        label: 'Font',
        path: 'book',
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
    const { wrapper } = await mountBookPage()
    // The levels label their items by their own `itemLabel`:
    expect(getLabels(wrapper)).toEqual(['Poetry', 'Preface', 'Body', 'Prose'])
    expect(getFormInput(wrapper).exists()).toBe(false)
    // Only the chapters are draggable, not the volumes:
    const getHandles = selector =>
      wrapper.findAll(
        `${selector} > .dito-tree-item__header .dito-button--drag`
      )
    const volumes = '.dito-tree-item[role="tree"] > div > .dito-tree-item'
    expect(getHandles(volumes)).toHaveLength(0)
    expect(getHandles(`${volumes} .dito-tree-item`)).toHaveLength(2)
  })

  it('reads the levels and their props from templates', async () => {
    const { wrapper } = await mountBookPage(
      '/book/volumes/0/chapters/1',
      TreeListPage
    )
    expect(getLabels(wrapper)).toEqual(['Poetry', 'Preface', 'Body', 'Prose'])
    expect(wrapper.findAll('.dito-button--drag')).toHaveLength(2)
    const label = wrapper.find('.dito-tree-list__form-container label')
    expect(label.text()).toBe('Chapter 2')
  })

  it('reads hyphenated props of levels', async () => {
    const { wrapper } = await mountBookPage(
      '/book',
      createBookPage({
        levels: () =>
          h(DitoTreeLevel, { 'name': 'chapters', 'item-label': 'title' })
      })
    )
    expect(getLabels(wrapper)).toEqual(['Poetry', 'Preface', 'Body', 'Prose'])
  })

  it('edits only the items of levels with a form', async () => {
    const { wrapper } = await mountBookPage(
      '/book',
      createBookPage({ volumeForm: null })
    )
    // Preface, Body:
    const buttons = wrapper.findAll('.dito-tree-item .dito-button--edit')
    expect(buttons).toHaveLength(2)
  })

  it('opens the form of the selected item in its route', async () => {
    const { admin, wrapper } = await mountBookPage()
    // Poetry, Preface, Body, Prose:
    await clickEdit(wrapper, 2)
    expect(getPath(admin)).toBe('/book/volumes/0/chapters/1')
    const label = wrapper.find('.dito-tree-list__form-container label')
    expect(label.text()).toBe('Chapter')
    expect(getFormInput(wrapper).element.value).toBe('Body')
    expect(contexts.chapters.item).toBe(form.item.volumes[0].chapters[1])
    expect(contexts.chapters.itemIndex).toBe(1)
    expect(contexts.chapters.parentItem).toBe(form.item.volumes[0])
    await clickEdit(wrapper, 3)
    expect(getPath(admin)).toBe('/book/volumes/1')
    expect(getFormInput(wrapper).element.value).toBe('Prose')
    expect(contexts.volumes.item).toBe(form.item.volumes[1])
    admin.router.back()
    await settle()
    expect(getPath(admin)).toBe('/book/volumes/0/chapters/1')
    expect(getFormInput(wrapper).element.value).toBe('Body')
  })

  it('opens the form of the item of a deep link', async () => {
    const { wrapper } = await mountBookPage('/book/volumes/0/chapters/1')
    expect(getFormInput(wrapper).element.value).toBe('Body')
    expect(
      wrapper.find('.dito-tree-item--active .dito-tree-item__label').text()
    ).toBe('Body')
  })

  it('edits the item in place', async () => {
    const { wrapper } = await mountBookPage('/book/volumes/0')
    await enterValue(getFormInput(wrapper), 'Drama')
    expect(form.item.volumes[0].name).toBe('Drama')
    expect(form.isDirty).toBe(true)
    expect(getLabels(wrapper)[0]).toBe('Drama')
  })

  it('opens the form of the item that holds errors', async () => {
    const { admin, wrapper } = await mountBookPage()
    form.item.volumes[0].chapters[1].title = ''
    expect(form.validate()).toBe(false)
    await settle()
    expect(getPath(admin)).toBe('/book/volumes/0/chapters/1')
    expect(wrapper.find('.dito-tree-list__form-container .dito-errors').text())
      .toBe('The Chapter field is required.')
  })

  it('shows the levels that are rendered', async () => {
    const hasChapters = ref(false)
    const { admin, wrapper } = await mountBookPage(
      '/book/volumes/0',
      createBookPage({
        levels: () =>
          hasChapters.value
            ? h(DitoTreeLevel, { name: 'chapters', itemLabel: 'title' })
            : null
      })
    )
    expect(getLabels(wrapper)).toEqual(['Poetry', 'Prose'])
    hasChapters.value = true
    await settle()
    expect(getLabels(wrapper)).toEqual(['Poetry', 'Preface', 'Body', 'Prose'])
    // The form of the selected item stays open:
    expect(getPath(admin)).toBe('/book/volumes/0')
    expect(getFormInput(wrapper).element.value).toBe('Poetry')
    hasChapters.value = false
    await settle()
    expect(getLabels(wrapper)).toEqual(['Poetry', 'Prose'])
    expect(getFormInput(wrapper).element.value).toBe('Poetry')
  })

  it('opens the form of the parent item when its level goes', async () => {
    const hasChapters = ref(true)
    const { admin, wrapper } = await mountBookPage(
      '/book/volumes/0/chapters/1',
      createBookPage({
        levels: () =>
          hasChapters.value
            ? h(
                DitoTreeLevel,
                { name: 'chapters', itemLabel: 'title' },
                { form: () => h(DitoTextField, { name: 'title' }) }
              )
            : null
      })
    )
    expect(getFormInput(wrapper).element.value).toBe('Body')
    hasChapters.value = false
    await settle()
    expect(getPath(admin)).toBe('/book/volumes/0')
    expect(getFormInput(wrapper).element.value).toBe('Poetry')
  })

  it('lays out the forms with the current slots of the levels', async () => {
    const suffixes = ref(['1'])
    // A page that renders the tree in a loop, whose variable the slots read:
    const page = {
      setup() {
        useDitoForm({ resource: 'books', id: 1, properties })
        return () =>
          h(DitoSchemaForm, null, {
            default: () =>
              suffixes.value.map(suffix =>
                h(
                  DitoTreeListField,
                  { key: 'volumes', name: 'volumes', itemLabel: 'name' },
                  {
                    default: () =>
                      h(
                        DitoTreeLevel,
                        { name: 'chapters', itemLabel: 'title' },
                        {
                          form: () =>
                            h(DitoTextField, {
                              name: 'title',
                              label: `Chapter ${suffix}`
                            })
                        }
                      )
                  }
                )
              )
          })
      }
    }
    const { wrapper } = await mountBookPage('/book/volumes/0/chapters/1', page)
    const getLabel = () =>
      wrapper.find('.dito-tree-list__form-container label').text()
    expect(getLabel()).toBe('Chapter 1')
    suffixes.value = ['2']
    await settle()
    expect(getLabel()).toBe('Chapter 2')
  })

  it('throws for levels with several child levels', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await mountBookPage(
      '/book',
      createBookPage({
        levels: () => [
          h(DitoTreeLevel, { name: 'chapters' }),
          h(DitoTreeLevel, { name: 'sections' })
        ]
      })
    )
    expect([...error.mock.calls, ...warn.mock.calls].flat()).toContainEqual(
      expect.objectContaining({
        message: `Unsupported tree level with several child levels: 'chapters', 'sections'.`
      })
    )
    error.mockRestore()
    warn.mockRestore()
  })
})
