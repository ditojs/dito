import { h } from 'vue'
import { useRoute } from 'vue-router'
import { flushPromises } from '@vue/test-utils'
import { clone } from '@ditojs/utils'
import { mountAdmin } from '../test/mount.js'
import { useDitoForm, DitoSchemaForm } from '../index.js'

// The form and the properties of the items of lists and objects:
const itemForm = { type: 'form', fields: { name: { type: 'text' } } }
const itemProperties = { name: { type: 'string', nullable: true } }

// Equivalent definitions of a value as a field and as a property, and the
// values that are written into the item while editing:
const cases = [
  {
    title: 'text',
    field: { type: 'text' },
    property: { type: 'string', nullable: true },
    values: [null, '', 'a']
  },
  {
    title: 'text with `nullable: false`',
    field: { type: 'text', nullable: false },
    property: { type: 'string' },
    values: [null, '', 'a']
  },
  {
    title: 'text with a default',
    field: { type: 'text', default: 'x' },
    property: { type: 'string', nullable: true, default: 'x' },
    values: [null, '', 'a']
  },
  {
    title: 'text with `nullable: false` and a default',
    field: { type: 'text', nullable: false, default: 'x' },
    property: { type: 'string', default: 'x' },
    values: [null, '', 'a']
  },
  {
    title: 'required text',
    field: { type: 'text', required: true },
    property: { type: 'string', nullable: true, required: true },
    values: [null, '', 'a']
  },
  {
    title: 'text with `minLength`',
    field: { type: 'text', nullable: false, minLength: 2 },
    property: { type: 'string', minLength: 2 },
    values: [null, '', 'a', 'ab']
  },
  {
    title: 'required text with `minLength`',
    field: { type: 'text', required: true, minLength: 2 },
    property: { type: 'string', nullable: true, required: true, minLength: 2 },
    values: ['', 'a']
  },
  {
    title: 'textarea with `maxLength`',
    field: { type: 'textarea', nullable: false, maxLength: 2 },
    property: { type: 'string', maxLength: 2 },
    values: [null, 'abc']
  },
  {
    title: 'email',
    field: { type: 'email' },
    property: { type: 'string', nullable: true, format: 'email' },
    values: ['', 'a', 'a@b.co']
  },
  {
    title: 'trimmed text',
    field: { type: 'text', trim: true },
    property: { type: 'string', nullable: true, trim: true },
    values: [' a ', '  ']
  },
  {
    title: 'excluded text',
    field: { type: 'text', exclude: true },
    property: { type: 'string', nullable: true, exclude: true },
    values: [null, 'a']
  },
  {
    title: 'number',
    field: { type: 'number' },
    property: { type: 'number', nullable: true },
    values: [null, 0, 1.5]
  },
  {
    title: 'number with a default',
    field: { type: 'number', default: 5 },
    property: { type: 'number', nullable: true, default: 5 },
    values: [null, 0]
  },
  {
    title: 'required integer with a minimum',
    field: { type: 'integer', required: true, minimum: 1 },
    property: { type: 'integer', nullable: true, required: true, minimum: 1 },
    values: [null, 0, 1.5, 2]
  },
  {
    title: 'switch',
    field: { type: 'switch' },
    property: { type: 'boolean' },
    values: [null, true, false]
  },
  {
    title: 'switch with a default',
    field: { type: 'switch', default: true },
    property: { type: 'boolean', default: true },
    values: [null, false]
  },
  {
    title: 'required switch',
    field: { type: 'switch', required: true },
    property: { type: 'boolean', required: true },
    values: [null, false]
  },
  {
    title: 'required checkbox',
    field: { type: 'checkbox', required: true },
    property: { type: 'boolean', nullable: true, required: true },
    values: [null, false, true]
  },
  {
    title: 'required checkbox with `nullable: false`',
    field: { type: 'checkbox', nullable: false, required: true },
    property: { type: 'boolean', required: true },
    values: [null, false, true]
  },
  {
    title: 'list',
    field: { type: 'list', form: itemForm },
    property: {
      type: 'array',
      items: { type: 'object', properties: itemProperties }
    },
    values: [null, [], [{ name: 'a' }]]
  },
  {
    title: 'list with `minItems`',
    field: { type: 'list', minItems: 1, form: itemForm },
    property: {
      type: 'array',
      minItems: 1,
      items: { type: 'object', properties: itemProperties }
    },
    values: [null, [], [{ name: 'a' }]]
  },
  {
    title: 'list with a default',
    field: { type: 'list', default: () => [{ name: 'a' }], form: itemForm },
    property: {
      type: 'array',
      default: () => [{ name: 'a' }],
      items: { type: 'object', properties: itemProperties }
    },
    values: [null]
  },
  {
    title: 'object',
    field: { type: 'object', form: itemForm },
    property: { type: 'object', nullable: true, properties: itemProperties },
    values: [null, { name: 'a' }]
  },
  {
    title: 'object with a default',
    field: { type: 'object', default: () => ({ name: 'a' }), form: itemForm },
    property: {
      type: 'object',
      nullable: true,
      default: () => ({ name: 'a' }),
      properties: itemProperties
    },
    values: [null]
  },
  {
    title: 'select',
    field: { type: 'select', options: ['a', 'b'] },
    property: { type: 'string', nullable: true, enum: ['a', 'b'] },
    values: [null, 'a']
  },
  {
    title: 'select with a default',
    field: { type: 'select', options: ['a', 'b'], default: 'a' },
    property: {
      type: 'string',
      nullable: true,
      enum: ['a', 'b'],
      default: 'a'
    },
    values: [null, 'b']
  },
  {
    title: 'select with an empty option',
    field: { type: 'select', options: ['', 'a'] },
    property: { type: 'string', nullable: true, enum: ['', 'a'] },
    values: [null, '', 'a']
  },
  {
    title: 'select with option objects',
    field: {
      type: 'select',
      options: [
        { value: '', label: 'None' },
        { value: 'a', label: 'A' }
      ]
    },
    property: { type: 'string', nullable: true, enum: ['', 'a'] },
    values: [null, '', 'a']
  },
  {
    title: 'multiselect',
    field: { type: 'multiselect', options: ['a', 'b'], multiple: true },
    property: { type: 'array', items: { type: 'string', enum: ['a', 'b'] } },
    values: [null, [], ['a']]
  }
]

// The form of the page, set up by `createPage()`:
let form = null

// A page whose form loads the item of its route's id, or creates one without:
const createPage = schema => ({
  setup() {
    const route = useRoute()
    form = useDitoForm({
      resource: 'items',
      id: () => route.params.id || null,
      ...schema
    })
    return () => h(DitoSchemaForm)
  }
})

async function settleForm() {
  await flushPromises()
  await new Promise(resolve => setTimeout(resolve))
  await flushPromises()
}

// Creates, loads, edits, validates and saves the item of a form with `schema`,
// and returns what the form holds and sends at each step:
async function getResults(schema, values) {
  // The item misses the value at `/items/1`, and holds `null` at `/items/2`:
  const items = { 1: { id: 1 }, 2: { id: 2, value: null } }
  const sent = []
  const admin = await mountAdmin({
    views: {
      items: {
        type: 'page',
        path: 'items/:id?',
        component: createPage(schema)
      }
    },
    request({ method = 'get', url, data }) {
      if (method === 'get') {
        return { data: clone(items[url.split('/').pop()]) }
      } else {
        sent.push(data)
        return { data: clone(data) }
      }
    }
  })
  const navigate = async path => {
    await admin.navigate(path)
    await settleForm()
    return clone(form.item)
  }
  const results = {
    created: await navigate('/items'),
    loadedMissing: await navigate('/items/1'),
    loadedNull: await navigate('/items/2'),
    written: []
  }
  for (const value of values) {
    form.item.value = clone(value)
    await settleForm()
    const edited = clone(form.item.value)
    form.validate()
    const errors = form.getErrors()
    await form.submit({ validate: false })
    results.written.push({ value, edited, errors, saved: sent.pop() })
  }
  return results
}

describe('fields and properties', () => {
  afterEach(() => {
    form = null
  })

  it.each(cases)(
    'handle the values of $title alike',
    async ({ field, property, values }) => {
      expect(
        await getResults({ properties: { value: property } }, values)
      ).toEqual(await getResults({ fields: { value: field } }, values))
    }
  )
})
