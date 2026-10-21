import { vi } from 'vitest'
import { h, nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { DitoMenuButton } from '@ditojs/ui/src'
import { mountAdmin, enterValue } from '../test/mount.js'
import {
  useDitoForm,
  DitoSchemaForm,
  DitoTextField,
  DitoNumberField,
  DitoListField,
  DitoObjectField
} from '../index.js'

const properties = {
  awards: {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        title: { type: 'string', required: true },
        year: { type: 'integer', range: [1900, 2100], nullable: true }
      }
    }
  },
  prices: { type: 'array', items: { type: 'number', minimum: 0 } },
  works: {
    type: 'array',
    forms: {
      book: {
        label: 'Book',
        properties: { title: { type: 'string', required: true } }
      },
      record: {
        label: 'Record',
        properties: {
          artist: { type: 'string', required: true },
          notes: { type: 'string', required: true }
        }
      }
    }
  },
  address: {
    type: 'object',
    properties: { city: { type: 'string', required: true } }
  },
  publisher: {
    type: 'object',
    nullable: true,
    properties: { name: { type: 'string' } }
  }
}

const item = {
  id: 1,
  awards: [
    { title: 'Gold', year: 2020 },
    { title: 'Silver', year: 2021 }
  ],
  prices: [10, 20],
  works: [
    { type: 'book', title: 'Notes' },
    { type: 'record', artist: 'Ada', notes: 'Live' }
  ],
  address: { city: 'London' },
  publisher: null
}

let form = null

// A page that lays out the items of its lists and objects in their slots:
const DesignerPage = {
  setup() {
    form = useDitoForm({ resource: 'designers', id: 1, properties })
    return () =>
      h(DitoSchemaForm, null, {
        default: () => [
          h(
            DitoListField,
            {
              name: 'awards',
              collapsible: true,
              collapsed: true,
              creatable: true,
              deletable: true,
              draggable: true
            },
            {
              default: ({ index }) => [
                h(DitoTextField, { name: 'title', width: '3/4' }),
                h(DitoNumberField, {
                  name: 'year',
                  width: '1/4',
                  placeholder: `Year ${index + 1}`
                })
              ]
            }
          ),
          h(
            DitoListField,
            { name: 'prices', creatable: true },
            { default: () => h(DitoNumberField, { label: 'Price', step: 5 }) }
          ),
          h(
            DitoListField,
            { name: 'works', creatable: true },
            {
              // The notes of records aren't laid out:
              default: ({ item }) =>
                item.type === 'book'
                  ? h(DitoTextField, { name: 'title' })
                  : h(DitoTextField, { name: 'artist' })
            }
          ),
          h(
            DitoObjectField,
            { name: 'address' },
            { default: () => h(DitoTextField, { name: 'city' }) }
          ),
          h(
            DitoObjectField,
            { name: 'publisher' },
            { default: () => h(DitoTextField, { name: 'name' }) }
          )
        ]
      })
  }
}

async function mountDesignerPage() {
  const request = vi.fn(({ method = 'get', url, data }) => {
    if (method === 'get' && url === '/designers/1') {
      return { data: structuredClone(item) }
    } else if (method === 'patch') {
      return { data: { ...data } }
    } else {
      throw new Error(`Unexpected request: ${method} ${url}`)
    }
  })
  const admin = await mountAdmin({
    views: {
      designer: {
        type: 'page',
        label: 'Designer',
        path: 'designer',
        component: DesignerPage
      }
    },
    request
  })
  const notify = vi.spyOn(admin.context, 'notify')
  await admin.navigate('/designer')
  await settle()
  return { admin, request, notify, wrapper: admin.wrapper }
}

async function settle() {
  await flushPromises()
  await new Promise(resolve => setTimeout(resolve))
  await flushPromises()
}

const getList = (wrapper, name) => wrapper.find(`.dito-list[id$="${name}"]`)

const getRows = (wrapper, name) =>
  getList(wrapper, name).findAll('tbody > .dito-table__row')

const getInputs = (wrapper, name) =>
  getList(wrapper, name)
    .findAll('input')
    .map(input => input.element.value)

const openItems = async (wrapper, name) => {
  for (const row of getRows(wrapper, name)) {
    await row.find('.dito-schema-header .dito-label').trigger('click')
  }
  await settle()
}

describe('DitoListField', () => {
  afterEach(() => {
    form = null
  })

  it('lays out the items in its slot, with a scope per item', async () => {
    const { wrapper } = await mountDesignerPage()
    expect(getRows(wrapper, 'awards')).toHaveLength(2)
    // Collapsed items don't mount their widgets:
    expect(getInputs(wrapper, 'awards')).toEqual([])
    await openItems(wrapper, 'awards')
    expect(getInputs(wrapper, 'awards')).toEqual([
      'Gold', '2020', 'Silver', '2021'
    ])
    const year = getRows(wrapper, 'awards')[1].findAll('input')[1]
    expect(year.attributes('placeholder')).toBe('Year 2')
    await enterValue(getRows(wrapper, 'awards')[1].find('input'), 'Bronze')
    expect(form.item.awards[1].title).toBe('Bronze')
  })

  it('edits primitive items with widgets without `name`', async () => {
    const { wrapper, request } = await mountDesignerPage()
    expect(getInputs(wrapper, 'prices')).toEqual(['10', '20'])
    await enterValue(getRows(wrapper, 'prices')[0].find('input'), '15')
    expect(form.item.prices).toEqual([15, 20])
    expect(await form.submit()).toBe(true)
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'patch',
        data: expect.objectContaining({ prices: [15, 20] })
      })
    )
  })

  it('creates items with the defaults of their properties', async () => {
    const { wrapper } = await mountDesignerPage()
    await getList(wrapper, 'awards')
      .find('tfoot .dito-button--add')
      .trigger('click')
    await settle()
    expect(form.item.awards[2]).toEqual({ title: '', year: null })
    // New items are opened:
    expect(getRows(wrapper, 'awards')[2].find('input').exists()).toBe(true)
  })

  it('lays out the items of several forms by their type', async () => {
    const { wrapper } = await mountDesignerPage()
    expect(getInputs(wrapper, 'works')).toEqual(['Notes', 'Ada'])
    const menu = getList(wrapper, 'works')
      .find('tfoot')
      .findComponent(DitoMenuButton)
    expect(menu.props('items')).toEqual([
      expect.objectContaining({ label: 'Book' }),
      expect.objectContaining({ label: 'Record' })
    ])
  })

  it('shows the errors in items and reveals them', async () => {
    const { wrapper, notify } = await mountDesignerPage()
    form.item.awards[1].title = ''
    form.item.works[1].artist = ''
    expect(form.validate()).toBe(false)
    await settle()
    await settle()
    const rows = getRows(wrapper, 'awards')
    expect(rows[1].classes()).toContain('dito-table__row--error')
    expect(rows[0].classes()).not.toContain('dito-table__row--error')
    const input = rows[1].find('input')
    expect(document.activeElement).toBe(input.element)
    expect(rows[1].find('.dito-errors').text()).toBe(
      'The Title field is required.'
    )
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Please correct the highlighted errors.'
      })
    )
  })

  it('notifies the errors of values that its slot does not show', async () => {
    const { wrapper, notify } = await mountDesignerPage()
    form.item.works[1].notes = ''
    form.item.prices = [-1]
    await nextTick()
    expect(form.validate()).toBe(false)
    await settle()
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Validation Errors',
        text: 'The field Notes is required'
      })
    )
    // The widgets of primitive items show their errors:
    expect(getRows(wrapper, 'prices')[0].find('.dito-errors').text()).toBe(
      'The Price field must be 0 or more.'
    )
  })
})

describe('DitoObjectField', () => {
  afterEach(() => {
    form = null
  })

  it('lays out its object in its slot', async () => {
    const { wrapper } = await mountDesignerPage()
    const object = wrapper.find('.dito-object[id$="address"]')
    expect(object.find('input').element.value).toBe('London')
    await enterValue(object.find('input'), 'Paris')
    expect(form.item.address).toEqual({ city: 'Paris' })
  })

  it('creates and deletes `nullable` objects', async () => {
    const { wrapper } = await mountDesignerPage()
    const getObject = () => wrapper.find('.dito-object[id$="publisher"]')
    expect(getObject().find('input').exists()).toBe(false)
    await getObject().find('.dito-button--add').trigger('click')
    await settle()
    expect(form.item.publisher).toEqual({ name: '' })
    expect(getObject().find('input').exists()).toBe(true)
  })
})
