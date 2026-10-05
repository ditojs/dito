import { vi } from 'vitest'
import { reactive, ref, nextTick } from 'vue'
import { registerTypeComponent } from './schema/types.js'
import { FormModel } from './FormModel.js'

// Register minimal type options, as the actual type components can't be
// imported without a Vue SFC compiler:
registerTypeComponent('text', { defaultNested: true })
registerTypeComponent('computed', {
  defaultNested: true,
  defaultValue: () => undefined,
  valueFromDataSchema: true
})
registerTypeComponent('section', { defaultNested: false })
registerTypeComponent('list', {
  defaultNested: true,
  defaultValue: () => [],
  getSourceType: () => 'list'
})

function createFormModel(schema, data) {
  const dataRef = ref(reactive(data))
  const formModel = new FormModel({
    component: { dataPath: '', componentPath: '' },
    getSchema: () => schema,
    getData: () => dataRef.value
  })
  return { formModel, dataRef, data: dataRef.value }
}

const slug = {
  type: 'computed',
  compute: ({ item }) => item.title?.toLowerCase().replaceAll(' ', '-')
}

describe('FormModel', () => {
  it('sets the defaults of missing values when the data is set up', () => {
    const schema = {
      type: 'form',
      components: {
        title: { type: 'text', default: 'Untitled' },
        tags: { type: 'list', form: { type: 'form', components: {} } }
      }
    }
    const { formModel, dataRef, data } = createFormModel(schema, {
      tags: null
    })
    expect(data).toEqual({ title: 'Untitled', tags: null })
    formModel.stop()
    dataRef.value = reactive({})
    expect(dataRef.value).toEqual({})
  })

  it('sets the defaults of replaced data', async () => {
    const schema = {
      type: 'form',
      components: { title: { type: 'text', default: 'Untitled' } }
    }
    const { formModel, dataRef } = createFormModel(schema, {})
    dataRef.value = reactive({})
    await nextTick()
    expect(dataRef.value).toEqual({ title: 'Untitled' })
    formModel.stop()
  })

  it('writes computed values and keeps them current', async () => {
    const schema = {
      type: 'form',
      components: { title: { type: 'text' }, slug }
    }
    const { formModel, data } = createFormModel(schema, {
      title: 'Hello World'
    })
    expect(data.slug).toBe('hello-world')
    data.title = 'Good Bye'
    await nextTick()
    expect(data.slug).toBe('good-bye')
    formModel.stop()
    data.title = 'Stopped'
    await nextTick()
    expect(data.slug).toBe('good-bye')
  })

  it('writes computed values of fields in tabs and unnested sections', () => {
    const schema = {
      type: 'form',
      components: { title: { type: 'text' } },
      tabs: {
        meta: {
          type: 'tab',
          components: {
            seo: { type: 'section', components: { slug } }
          }
        }
      }
    }
    const { formModel, data } = createFormModel(schema, { title: 'Hello' })
    expect(data.slug).toBe('hello')
    formModel.stop()
  })

  it('writes the computed value back when the value changes', async () => {
    const schema = {
      type: 'form',
      components: {
        tags: { type: 'text', compute: ({ value }) => value ?? [] }
      }
    }
    const { formModel, data } = createFormModel(schema, { tags: null })
    expect(data.tags).toEqual([])
    data.tags = null
    await nextTick()
    expect(data.tags).toEqual([])
    formModel.stop()
  })

  it('keeps values that `compute()` returns `undefined` for', async () => {
    const schema = {
      type: 'form',
      components: { title: { type: 'text', compute: () => undefined } }
    }
    const { formModel, data } = createFormModel(schema, { title: 'Hello' })
    data.title = 'Changed'
    await nextTick()
    expect(data.title).toBe('Changed')
    formModel.stop()
  })

  it('writes computed values that are new objects only once', async () => {
    const compute = vi.fn(({ value }) =>
      value.map(entry => ({ ...entry, upper: entry.name.toUpperCase() }))
    )
    const schema = {
      type: 'form',
      components: { entries: { type: 'text', compute } }
    }
    const { formModel, data } = createFormModel(schema, {
      entries: [{ name: 'One' }]
    })
    await nextTick()
    // Once initially, and once more after writing the new array, which is
    // equal and therefore not written again.
    expect(compute).toHaveBeenCalledTimes(2)
    expect(data.entries).toEqual([{ name: 'One', upper: 'ONE' }])
    formModel.stop()
  })

  it('skips components whose `if` evaluates to `false`', async () => {
    const schema = {
      type: 'form',
      components: {
        title: { type: 'text' },
        hasSlug: { type: 'text' },
        slug: { ...slug, if: ({ item }) => item.hasSlug }
      }
    }
    const { formModel, data } = createFormModel(schema, {
      title: 'Hello',
      hasSlug: false
    })
    expect(data.slug).toBe(undefined)
    data.hasSlug = true
    await nextTick()
    expect(data.slug).toBe('hello')
    data.hasSlug = false
    data.title = 'Changed'
    await nextTick()
    expect(data.slug).toBe('hello')
    formModel.stop()
  })

  it('writes computed values of list items, including added ones', async () => {
    const schema = {
      type: 'form',
      components: {
        chapters: {
          type: 'list',
          form: {
            type: 'form',
            components: { title: { type: 'text' }, slug }
          }
        }
      }
    }
    const { formModel, data } = createFormModel(schema, {
      chapters: [{ title: 'One' }]
    })
    expect(data.chapters[0].slug).toBe('one')
    data.chapters.push({ title: 'Two' })
    await nextTick()
    expect(data.chapters[1].slug).toBe('two')
    // Items that moved are computed with their new data path:
    data.chapters.reverse()
    data.chapters[0].title = 'Two Again'
    await nextTick()
    expect(data.chapters.map(chapter => chapter.slug)).toEqual([
      'two-again',
      'one'
    ])
    formModel.stop()
  })

  it('skips sources with their own resource', () => {
    const schema = {
      type: 'form',
      components: {
        chapters: {
          type: 'list',
          resource: 'chapters',
          form: { type: 'form', components: { title: { type: 'text' }, slug } }
        }
      }
    }
    const { formModel, data } = createFormModel(schema, {
      chapters: [{ title: 'One' }]
    })
    expect(data.chapters[0].slug).toBe(undefined)
    formModel.stop()
  })

  it('resolves values from data schemas', async () => {
    const schema = {
      type: 'form',
      components: {
        title: { type: 'text' },
        upper: {
          type: 'computed',
          data: ({ item }) => item.title.toUpperCase()
        },
        copy: { type: 'computed', dataPath: '../title' },
        length: {
          type: 'computed',
          data: ({ item }) => {
            const { title } = item
            return async () => title.length
          }
        }
      }
    }
    const { formModel, data } = createFormModel(schema, { title: 'Hello' })
    expect(data.upper).toBe('HELLO')
    expect(data.copy).toBe('Hello')
    await nextTick()
    expect(data.length).toBe(5)
    data.title = 'Bye'
    await nextTick()
    expect(data.upper).toBe('BYE')
    expect(data.copy).toBe('Bye')
    await nextTick()
    expect(data.length).toBe(3)
    formModel.stop()
  })

  it('ignores outdated values loaded by data schemas', async () => {
    const resolvers = []
    const schema = {
      type: 'form',
      components: {
        title: { type: 'text' },
        loaded: {
          type: 'computed',
          data: ({ item }) => {
            const { title } = item
            return new Promise(resolve => resolvers.push(() => resolve(title)))
          }
        }
      }
    }
    const { formModel, data } = createFormModel(schema, { title: 'First' })
    data.title = 'Second'
    await nextTick()
    expect(resolvers).toHaveLength(2)
    resolvers[1]()
    await nextTick()
    resolvers[0]()
    await nextTick()
    expect(data.loaded).toBe('Second')
    formModel.stop()
  })
})
