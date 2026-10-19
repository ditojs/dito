import {
  h,
  ref,
  reactive,
  inject,
  computed,
  nextTick,
  onBeforeUnmount
} from 'vue'
import { flushPromises } from '@vue/test-utils'
import { getValueAtDataPath, parseDataPath } from '@ditojs/utils'
import { mountAdmin, enterValue } from '../test/mount.js'
import { useContainer } from '../composables/useContainer.ts'
import { DataModel } from './DataModel.ts'
import { fieldRegistryKey } from './keys.ts'
import { sendRequest } from './services.ts'
import { hasNestedData } from './schema/structure.js'
import DitoContainer from '../components/DitoContainer.vue'

// A minimal field that registers `schema` at `path`, and renders it once it is
// part of the container's schema, as field components will:
const TestField = {
  props: {
    path: { type: String, required: true },
    schema: { type: Object, required: true }
  },

  setup(props) {
    const registry = inject(fieldRegistryKey)
    const field = registry.register(props.path, () => props.schema)
    onBeforeUnmount(() => field.unregister())
    const path = parseDataPath(field.dataPath)
    const name = path.at(-1)
    const parentPath = path.slice(0, -1)
    const store = reactive({})
    const isKnown = computed(
      () => getComponent(registry.schema, path) === field.schema
    )
    return () => {
      const data = getValueAtDataPath(
        state.container.model.data,
        parentPath,
        () => null
      )
      return isKnown.value && data
        ? h(DitoContainer, {
            schema: { ...field.schema, name },
            dataPath: hasNestedData(field.schema)
              ? field.dataPath
              : parentPath.join('/'),
            data,
            itemDataPath: parentPath.join('/'),
            store,
            disabled: false,
            generateLabels: true
          })
        : null
    }
  }
}

function getComponent(schema, path) {
  return path.reduce(
    (schema, key) => schema?.components?.[key],
    schema
  )
}

// A custom component, for a type whose `setupSchema()` is async:
const RatingStars = {
  emits: ['update:modelValue', 'change'],
  props: {
    schema: { type: Object, required: true },
    context: { type: Object, required: true },
    modelValue: { type: Number, default: null }
  },
  render() {
    return h('span', { class: 'rating' }, '*'.repeat(this.modelValue ?? 0))
  }
}

const state = {}

async function mountPage({
  item = {
    id: 1,
    title: 'Emma',
    price: 12,
    published: '1815-12-23',
    genre: 'novel',
    rating: 3,
    address: { city: 'Chawton', zip: 'GU34', country: 'UK' },
    notes: 'internal'
  },
  showTitle = true,
  showDate = true,
  showRating = false,
  showAddress = false,
  minPrice = 0,
  api = {},
  // Like the network, the response shares no objects with the request:
  onPatch = ({ data }) => ({ data: JSON.parse(JSON.stringify(data)) })
} = {}) {
  Object.assign(state, {
    container: null,
    showTitle: ref(showTitle),
    showDate: ref(showDate),
    showRating: ref(showRating),
    showAddress: ref(showAddress),
    minPrice: ref(minPrice),
    renders: 0
  })
  const Page = {
    emits: ['update:modelValue', 'change'],
    props: {
      schema: { type: Object, required: true },
      context: { type: Object, required: true },
      modelValue: { default: null }
    },
    setup() {
      state.container = useContainer({
        schema: () => ({ type: 'form' }),
        // Like a form of a list, which identifies its item when saving:
        sourceSchema: () => ({ type: 'list', orderKey: 'position' }),
        canSave: () => true,
        hasFieldRegistry: true
      })
      const { services, model } = state.container
      sendRequest(services, { method: 'get', resource: { path: 'books/1' } })
        .then(({ data }) => model.replaceFromServer(data))
      return () => {
        state.renders++
        const field = (path, schema) =>
          h(TestField, { key: path, path, schema })
        return h('div', { class: 'page' }, [
          state.showTitle.value &&
          field('title', {
            type: 'text',
            required: true,
            // Not idempotent, to see how often it runs. New on each render:
            deserializeValue: ({ value }) => value && `${value}.`
          }),
          field('price', { type: 'number', min: state.minPrice.value }),
          state.showDate.value && field('published', { type: 'date' }),
          field('slug', {
            type: 'text',
            computeValue: ({ item }) => item.title?.toLowerCase() ?? null
          }),
          field('inStock', { type: 'checkbox', default: true }),
          field('genre', {
            type: 'select',
            options: [
              { label: 'Novel', value: 'novel' },
              { label: 'Poetry', value: 'poetry' }
            ]
          }),
          state.showAddress.value && [
            field('address.city', { type: 'text', required: true }),
            field('address.zip', {
              type: 'text',
              deserializeValue: ({ value }) => value && `${value}!`
            })
          ],
          state.showRating.value &&
          field('rating', {
            type: 'component',
            // Lazy, so the type's `setupSchema()` resolves it async:
            component: () => Promise.resolve({ default: RatingStars })
          })
        ])
      }
    }
  }
  const requests = []
  const admin = await mountAdmin({
    api,
    views: {
      page: {
        type: 'view',
        label: 'Page',
        components: { page: { type: 'component', component: Page } }
      }
    },
    request(options) {
      requests.push(options)
      const { method = 'get', url } = options
      if (method === 'get' && url === '/books/1') {
        return { data: structuredClone(item) }
      }
      if (method === 'patch' && url === '/books/1') {
        return onPatch(options)
      }
      throw new Error(`Unexpected request: ${method} ${url}`)
    }
  })
  await admin.navigate('/page')
  await settle()
  const { wrapper } = admin
  const { model, dataContext: context, services } = state.container
  const save = async () => {
    await model.waitUntilSettled()
    if (!context.validate()) {
      return false
    }
    try {
      const { data } = await sendRequest(services, {
        method: 'patch',
        resource: { path: 'books/1' },
        data: model.serializedData.value
      })
      model.mergeFromServer(data)
      return true
    } catch (error) {
      const errors = (
        error.response?.status === 400 &&
        error.response.data.errors
      )
      if (errors) {
        await context.showValidationErrors(errors)
        return false
      }
      throw error
    }
  }
  return {
    wrapper,
    requests,
    model,
    context,
    registry: model.fieldRegistry,
    get components() {
      return model.fieldRegistry.schema.components
    },
    getPatch: () => requests.findLast(({ method }) => method === 'patch')?.data,
    getInput: name => wrapper.find(`.page input[id$="${name}"]`),
    getErrors: name => (
      wrapper
        .findAll('.page .dito-container')
        .find(container => container.find(`[id$="${name}"]`).exists())
        ?.findAll('.dito-errors li')
        .map(item => item.text()) ?? []
    ),
    save,
    settle
  }
}

async function settle() {
  await flushPromises()
  await state.container?.model.waitUntilSettled()
  await flushPromises()
  await nextTick()
}

describe('FieldRegistry', () => {
  it('builds the schema from the fields and loads their data', async () => {
    const { model, context, registry, components, getInput } = await mountPage()
    expect(registry.schema.type).toBe('form')
    expect(Object.keys(components)).toEqual([
      'title',
      'price',
      'published',
      'slug',
      'inStock',
      'genre'
    ])
    // Deserialized like schema views, defaults of missing values set:
    expect(model.data.published).toBeInstanceOf(Date)
    expect(model.data.inStock).toBe(true)
    expect(model.data.slug).toBe('emma.')
    expect(getInput('title').element.value).toBe('Emma.')
    // Neither the registration nor the load are edits:
    expect(model.isDirty).toBe(false)
    expect(context.isDirty).toBe(false)
  })

  it('saves the serialized values of the fields', async () => {
    const { model, getInput, getPatch, save, settle } = await mountPage()
    await enterValue(getInput('title'), 'Persuasion')
    expect(model.isDirty).toBe(true)
    expect(await save()).toBe(true)
    await settle()
    expect(getPatch()).toEqual({
      id: 1,
      title: 'Persuasion',
      price: 12,
      published: '1815-12-23',
      slug: 'persuasion',
      inStock: true,
      genre: 'novel'
    })
    expect(model.data.published).toBeInstanceOf(Date)
    expect(model.isDirty).toBe(false)
  })

  it('validates the fields before saving', async () => {
    const { model, context, getInput, getErrors, requests, save, settle } =
      await mountPage()
    await enterValue(getInput('title'), '')
    model.data.price = -5
    expect(context.verify()).toBe(false)
    expect(await save()).toBe(false)
    await settle()
    expect(requests.some(({ method }) => method === 'patch')).toBe(false)
    expect(getErrors('title')).toEqual(['The Title field is required.'])
    expect(getErrors('price')).toEqual(['The Price field must be 0 or more.'])
  })

  it('shows the validation errors of the server on the fields', async () => {
    const { getInput, getErrors, save, settle } = await mountPage({
      onPatch: () => {
        const error = new Error('Validation failed')
        error.response = {
          status: 400,
          data: { errors: { title: [{ message: 'is taken' }] } }
        }
        throw error
      }
    })
    await enterValue(getInput('title'), 'Emma 2')
    expect(await save()).toBe(false)
    await settle()
    expect(getErrors('title')).toEqual(['The Title field is taken.'])
  })

  it('reads the options of fields live, without registering again', async () => {
    const { model, context, components, settle } = await mountPage()
    const { title, price, genre } = components
    const { options } = genre
    const { renders } = state
    expect(context.verify()).toBe(true)
    state.minPrice.value = 20
    await settle()
    expect(state.renders).toBeGreaterThan(renders)
    // Inline callbacks and options are new on each render too:
    expect(model.fieldRegistry.schema.components).toBe(components)
    expect(components.price).toBe(price)
    expect(components.title).toBe(title)
    expect(genre.options).toBe(options)
    expect(price.min).toBe(20)
    expect(context.verify()).toBe(false)
    expect(model.isDirty).toBe(false)
  })

  it('applies the defaults of the API without changing the source', async () => {
    const source = reactive({ type: 'textarea' })
    const { registry, settle } = await mountPage({
      api: { defaults: { textarea: { rows: 7 } } }
    })
    const field = registry.register('notes', () => source)
    await settle()
    expect(field.schema.rows).toBe(7)
    expect(source).toEqual({ type: 'textarea' })
    source.rows = 3
    expect(field.schema.rows).toBe(3)
    delete source.rows
    expect(field.schema.rows).toBe(7)
  })

  it('passes the schema of a path on to the next mounted field', async () => {
    const { registry, settle } = await mountPage()
    const first = registry.register('notes', () => ({ type: 'textarea' }))
    const second = registry.register('notes', () => ({ type: 'textarea' }))
    await settle()
    expect(registry.schema.components.notes).toBe(first.schema)
    first.unregister()
    await settle()
    expect(registry.schema.components.notes).toBe(second.schema)
    // Unmounted fields without a successor stay known:
    second.unregister()
    await settle()
    expect(registry.schema.components.notes).toBe(second.schema)
  })

  it('deserializes the values of fields that register after the load', async () => {
    const { model, settle } = await mountPage({ showDate: false })
    // The unregistered value stays as the server sent it:
    expect(model.data.published).toBe('1815-12-23')
    state.showDate.value = true
    await settle()
    expect(model.data.published).toBeInstanceOf(Date)
    expect(model.isDirty).toBe(false)
  })

  it('deserializes the values of loaded data only once', async () => {
    const { model, settle } = await mountPage()
    expect(model.data.title).toBe('Emma.')
    state.showTitle.value = false
    await settle()
    state.showTitle.value = true
    await settle()
    state.minPrice.value = 5
    await settle()
    expect(model.data.title).toBe('Emma.')
  })

  it('keeps and saves the values of fields that unmount, unvalidated', async () => {
    const { model, context, components, getInput, getPatch, save, settle } =
      await mountPage()
    const { title } = components
    await enterValue(getInput('title'), '')
    expect(context.verify()).toBe(false)
    state.showTitle.value = false
    state.showDate.value = false
    await settle()
    // Still known, so serialized by its schema, but not validated:
    expect(model.fieldRegistry.schema.components.title).toBe(title)
    expect(model.data.title).toBe('')
    expect(model.isDirty).toBe(true)
    expect(context.verify()).toBe(true)
    expect(await save()).toBe(true)
    expect(getPatch()).toMatchObject({ title: null, published: '1815-12-23' })
  })

  it('forgets the fields that unmounted when the data is replaced', async () => {
    const { model, registry, settle } = await mountPage()
    state.showTitle.value = false
    await settle()
    expect(registry.schema.components.title).toBeDefined()
    model.replaceFromServer({ id: 2, title: 'Emma' })
    await settle()
    expect(registry.schema.components.title).toBeUndefined()
    expect(registry.schema.components.price).toBeDefined()
  })

  it('never validates fields that never render', async () => {
    const { context, registry } = await mountPage({
      showTitle: false,
      item: { id: 1, title: '' }
    })
    expect(registry.schema.components.title).toBeUndefined()
    expect(context.verify()).toBe(true)
  })

  it('registers dotted paths in groups', async () => {
    const { model, context, components, getInput, getPatch, save } =
      await mountPage({ showAddress: true })
    expect(components.address).toMatchObject({
      type: 'section',
      nested: true,
      components: { city: { type: 'text' }, zip: { type: 'text' } }
    })
    expect(model.data.address.zip).toBe('GU34!')
    await enterValue(getInput('city'), '')
    expect(context.verify()).toBe(false)
    await enterValue(getInput('city'), 'Steventon')
    expect(await save()).toBe(true)
    expect(getPatch().address).toEqual({ city: 'Steventon', zip: 'GU34!' })
  })

  it('deserializes the values of fields that register in loaded groups', async () => {
    const { model, registry, settle } = await mountPage({ showAddress: true })
    registry.register('address.country', () => ({
      type: 'text',
      deserializeValue: ({ value }) => value.toLowerCase()
    }))
    await settle()
    expect(model.data.address).toEqual({
      city: 'Chawton',
      zip: 'GU34!',
      country: 'uk'
    })
  })

  it('validates only the mounted fields of groups', async () => {
    const { model, context, getInput, settle } = await mountPage({
      showAddress: true
    })
    await enterValue(getInput('city'), '')
    expect(context.verify()).toBe(false)
    state.showAddress.value = false
    await settle()
    expect(model.fieldRegistry.schema.components.address).toBeDefined()
    expect(context.verify()).toBe(true)
  })

  it('rejects fields in fields', async () => {
    const { registry } = await mountPage()
    expect(() =>
      registry.register('price.amount', () => ({ type: 'number' }))
    ).toThrow(
      `Invalid field path 'price/amount': The field at 'price' overlaps it.`
    )
  })

  it('rejects indices of array items in field paths', async () => {
    const { registry } = await mountPage()
    for (const path of ['items.3.title', 'items/3/title', 'items[3].title']) {
      expect(() => registry.register(path, () => ({ type: 'text' }))).toThrow(
        `Invalid field path 'items/3/title': Use list fields for array items.`
      )
    }
  })

  it('requires services', () => {
    expect(
      () => new DataModel({ schema: () => null, hasFieldRegistry: true })
    ).toThrow('Unable to register fields without services.')
  })

  it('saves no values without a field, but the ones of unmounted fields', async () => {
    const { getInput, getPatch, save, settle } = await mountPage({
      item: {
        id: 1,
        position: 2,
        title: 'Emma',
        author: { id: 7, name: 'Jane Austen' },
        reviews: [{ id: 1, text: 'Witty' }],
        notes: 'internal'
      }
    })
    await enterValue(getInput('title'), 'Persuasion')
    state.showTitle.value = false
    await settle()
    expect(await save()).toBe(true)
    // The server leaves the values that aren't sent unchanged:
    expect(getPatch()).toEqual({
      id: 1,
      position: 2,
      title: 'Persuasion',
      price: null,
      published: null,
      slug: 'persuasion',
      inStock: true,
      genre: null
    })
  })

  it('waits for fields with async setup before saving', async () => {
    const { registry, getPatch, save, settle } = await mountPage()
    state.showRating.value = true
    await nextTick()
    // Rendered, but its setup is pending, so it isn't part of the model yet:
    expect(registry.schema.components.rating).toBeUndefined()
    expect(await save()).toBe(true)
    await settle()
    expect(registry.schema.components.rating).toBeDefined()
    expect(getPatch().rating).toBe(3)
  })

  it('creates new data with the defaults of the fields', async () => {
    const { model, settle } = await mountPage()
    model.replaceWithNewData({})
    await settle()
    expect(model.data).toMatchObject({ title: null, inStock: true })
    expect(model.isDirty).toBe(false)
  })
})
