import { vi } from 'vitest'
import { h, nextTick } from 'vue'
import { DOMWrapper, flushPromises } from '@vue/test-utils'
import { mountAdmin, enterValue, stubConfirm, isForm } from '../test/mount.js'
import { useDitoForm, DitoSchemaForm } from '../index.js'

const nameForm = {
  type: 'form',
  label: 'Item',
  fields: { name: { type: 'text', label: 'Name' } }
}

const nameList = {
  type: 'list',
  itemLabel: 'name',
  editable: true,
  form: nameForm
}

const createSets = () => [
  { name: 'Sans', cuts: [{ name: 'Regular' }, { name: 'Bold' }] },
  { name: 'Serif', cuts: [] }
]

const generator = {
  id: 1,
  title: 'Generator',
  sets: [{ name: 'Mono', cuts: [{ name: 'Light' }] }],
  notes: [],
  groups: []
}

// The forms of the pages, set up by `createPage()`:
const forms = {}

// A page whose form edits a tree of sets and their cuts, a list of notes, and
// the items of inlined groups, all in routed forms:
function createPage(name, { resource = null, mutate = false } = {}) {
  return {
    setup() {
      forms[name] = useDitoForm({
        ...(resource && { resource, id: 1 }),
        fields: {
          title: { type: 'text', label: 'Title' },
          sets: {
            type: 'tree-list',
            label: 'Sets',
            itemLabel: 'name',
            editable: true,
            collapsed: false,
            mutate,
            ...(!resource && { default: createSets }),
            form: nameForm,
            children: { ...nameList, name: 'cuts', mutate }
          },
          notes: {
            ...nameList,
            label: 'Notes',
            ...(!resource && { default: () => [{ name: 'First' }] })
          },
          groups: {
            type: 'list',
            label: 'Groups',
            inlined: true,
            ...(!resource && { default: () => [{ items: [{ name: 'A' }] }] }),
            form: { type: 'form', fields: { items: nameList } }
          }
        }
      })
      return () => h('div', { class: `page-${name}` }, [h(DitoSchemaForm)])
    }
  }
}

async function settleAll() {
  for (let i = 0; i < 3; i++) {
    await flushPromises()
    await new Promise(resolve => setTimeout(resolve))
  }
  await flushPromises()
}

async function mountPages({ path = '/' } = {}) {
  const admin = await mountAdmin({
    path,
    views: {
      books: { type: 'view', label: 'Books', fields: {} },
      upload: {
        type: 'page',
        label: 'Upload',
        path: 'upload',
        component: createPage('upload')
      },
      mutating: {
        type: 'page',
        label: 'Mutating',
        path: 'mutating',
        component: createPage('mutating', { mutate: true })
      },
      generator: {
        type: 'page',
        label: 'Generator',
        path: 'generator',
        component: createPage('generator', { resource: 'generators' })
      }
    },
    request: ({ method = 'get', url }) => {
      if (method === 'get' && url === '/generators/1') {
        return { data: structuredClone(generator) }
      }
      throw new Error(`Unexpected request: ${method} ${url}`)
    }
  })
  await settleAll()
  return admin
}

async function navigate(admin, path) {
  await admin.navigate(path)
  await settleAll()
}

const getPath = admin => admin.router.currentRoute.value.path
const findPage = (admin, name) => admin.wrapper.find(`.page-${name}`)

const findFormInput = admin =>
  new DOMWrapper(admin.getRouteComponent(isForm).$el).find('input')

async function clickEdit(admin, selector, index = 0) {
  const buttons = findPage(admin, 'upload').findAll(
    `${selector} .dito-button--edit`
  )
  await buttons[index].trigger('click')
  await settleAll()
}

async function applyForm(admin, value) {
  await enterValue(findFormInput(admin), value)
  await new DOMWrapper(admin.getRouteComponent(isForm).$el)
    .find('.dito-buttons--main button[type="submit"]')
    .trigger('click')
  await settleAll()
}

describe('useDitoForm() with routed forms in pages', () => {
  it('edits tree items in their forms inside the page, and applies them to the page form', async () => {
    const admin = await mountPages({ path: '/upload' })
    // Sans, Regular, Bold, Serif:
    await clickEdit(admin, '.dito-tree-list', 2)
    expect(getPath(admin)).toBe('/upload/sets/0/cuts/1')
    expect(admin.getRouteComponent(isForm).isEmbeddedRoute).toBe(true)
    expect(findPage(admin, 'upload').isVisible()).toBe(true)
    expect(findPage(admin, 'upload').find('.dito-form').isVisible()).toBe(true)
    expect(findFormInput(admin).element.value).toBe('Bold')
    await applyForm(admin, 'Black')
    expect(getPath(admin)).toBe('/upload')
    expect(forms.upload.item.sets[0].cuts[1].name).toBe('Black')
    expect(forms.upload.isDirty).toBe(true)
  })

  it('edits tree items in place with `mutate`', async () => {
    const admin = await mountPages({ path: '/mutating/sets/0/cuts/1' })
    await enterValue(findFormInput(admin), 'Heavy')
    expect(forms.mutating.item.sets[0].cuts[1].name).toBe('Heavy')
    expect(forms.mutating.isDirty).toBe(true)
  })

  it('edits list items in their forms, keeping the page hidden meanwhile', async () => {
    const admin = await mountPages({ path: '/upload' })
    await clickEdit(admin, '.dito-list')
    expect(getPath(admin)).toBe('/upload/notes/0')
    expect(findPage(admin, 'upload').isVisible()).toBe(false)
    await applyForm(admin, 'Second')
    expect(getPath(admin)).toBe('/upload')
    expect(findPage(admin, 'upload').isVisible()).toBe(true)
    expect(forms.upload.item.notes[0].name).toBe('Second')
  })

  it('routes the forms of lists in inlined sources', async () => {
    const admin = await mountPages({ path: '/upload' })
    await clickEdit(admin, '#groups .dito-list')
    expect(getPath(admin)).toBe('/upload/groups/0/items/0')
    expect(findFormInput(admin).element.value).toBe('A')
  })

  it('opens deep links into the forms of tree and list items', async () => {
    let admin = await mountPages({ path: '/upload/sets/0/cuts/1' })
    expect(getPath(admin)).toBe('/upload/sets/0/cuts/1')
    expect(findFormInput(admin).element.value).toBe('Bold')
    expect(findPage(admin, 'upload').isVisible()).toBe(true)
    admin = await mountPages({ path: '/upload/notes/0' })
    expect(findFormInput(admin).element.value).toBe('First')
  })

  it('opens deep links into the forms of a page form with a resource', async () => {
    const admin = await mountPages({ path: '/generator/sets/0/cuts/0' })
    expect(getPath(admin)).toBe('/generator/sets/0/cuts/0')
    expect(findFormInput(admin).element.value).toBe('Light')
  })

  it('shows the page and the item in the trail', async () => {
    const admin = await mountPages({ path: '/upload/notes/0' })
    expect(
      admin.wrapper.findAll('.dito-trail__text').map(item => item.text())
    ).toEqual(['Upload', 'Edit Item'])
  })

  it('asks before leaving unsaved changes of nested forms and the page form', async () => {
    const confirm = stubConfirm(false)
    const admin = await mountPages({ path: '/upload/notes/0' })
    // Resolving the deep link again doesn't ask:
    expect(confirm).not.toHaveBeenCalled()
    await enterValue(findFormInput(admin), 'Changed')
    await navigate(admin, '/books')
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(getPath(admin)).toBe('/upload/notes/0')
    confirm.mockReturnValue(true)
    await navigate(admin, '/upload')
    expect(getPath(admin)).toBe('/upload')
    confirm.mockClear()
    confirm.mockReturnValue(false)
    await enterValue(
      findPage(admin, 'upload').find('input[name="title"]'),
      'Fonts'
    )
    await navigate(admin, '/books')
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(getPath(admin)).toBe('/upload')
  })

  it('opens the forms of the page again after leaving it', async () => {
    const admin = await mountPages()
    await navigate(admin, '/upload')
    await navigate(admin, '/books')
    await navigate(admin, '/upload/sets/1')
    expect(findFormInput(admin).element.value).toBe('Serif')
  })

  it('lets users leave pages while their forms are set up', async () => {
    const admin = await mountPages()
    await admin.router.push('/upload')
    await nextTick()
    expect(findPage(admin, 'upload').exists()).toBe(true)
    await navigate(admin, '/books')
    expect(getPath(admin)).toBe('/books')
  })

  it('keeps the forms of pages with the same forms apart', async () => {
    const admin = await mountPages({ path: '/generator/sets/0/cuts/0' })
    await navigate(admin, '/upload/sets/0/cuts/0')
    expect(findFormInput(admin).element.value).toBe('Regular')
  })

  it('rejects lists with routed forms in dialogs and forms', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const ListComponent = {
      setup() {
        useDitoForm({ fields: { items: nameList } })
        return () => h(DitoSchemaForm)
      }
    }
    const admin = await mountAdmin({
      views: {
        books: {
          type: 'view',
          label: 'Books',
          field: {
            type: 'list',
            default: () => [{}],
            editable: true,
            form: { type: 'form', fields: {}, component: ListComponent }
          }
        }
      }
    })
    const message = (
      'Forms of `useDitoForm()` only support components that produce routes ' +
      'in pages'
    )
    admin.context.showDialog({
      fields: { list: { type: 'component', component: ListComponent } }
    })
    await settleAll()
    expect(error).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledWith(expect.objectContaining({ message }))
    await navigate(admin, '/books/0')
    expect(admin.getRouteComponent(isForm)).not.toBe(null)
    expect(error).toHaveBeenCalledTimes(2)
    expect(error).toHaveBeenLastCalledWith(
      expect.objectContaining({ message })
    )
  })

  it(`doesn't load the items of rejected forms`, async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const request = vi.fn(() => ({ data: { id: 1, items: [] } }))
    const admin = await mountAdmin({
      views: { books: { type: 'view', label: 'Books', fields: {} } },
      request
    })
    admin.context.showDialog({
      fields: {
        list: {
          type: 'component',
          component: {
            setup() {
              useDitoForm({
                resource: { path: 'books' },
                id: 1,
                fields: { items: nameList }
              })
              return () => h(DitoSchemaForm)
            }
          }
        }
      }
    })
    await settleAll()
    expect(error).toHaveBeenCalledTimes(1)
    expect(request).not.toHaveBeenCalled()
  })
})
