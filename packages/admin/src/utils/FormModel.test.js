import { vi } from 'vitest'
import { reactive, ref, toRaw, nextTick } from 'vue'
import { registerTypeComponent } from './schema/types.js'
import { FormModel } from './FormModel.js'

// Register minimal type options, as the actual type components can't be
// imported without a Vue SFC compiler:
registerTypeComponent('text', { defaultNested: true })
registerTypeComponent('select', { defaultNested: true })
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
registerTypeComponent('object', {
  defaultNested: true,
  getSourceType: () => 'object'
})

function createFormModel(schema, data, { getSourceSchema } = {}) {
  const dataRef = ref(reactive(data))
  const formModel = new FormModel({
    component: { dataPath: '', componentPath: '' },
    getSchema: () => schema,
    getData: () => dataRef.value,
    getSourceSchema
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
    await formModel.waitForPendingLoads()
    expect(data.length).toBe(5)
    data.title = 'Bye'
    await nextTick()
    expect(data.upper).toBe('BYE')
    expect(data.copy).toBe('Bye')
    await formModel.waitForPendingLoads()
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
    resolvers[0]()
    await formModel.waitForPendingLoads()
    expect(data.loaded).toBe('Second')
    formModel.stop()
  })

  describe('options', () => {
    // Like lineto's `getValidOrDefaultOption()`: Keeps valid values, and
    // selects the first option otherwise, once the options are loaded.
    const getValidOrFirstOption = ({ value, options }) =>
      options
        ? options.some(option => option.value === value)
          ? value
          : options[0]?.value ?? null
        : value

    const topicsByCategory = {
      news: [{ value: 'politics' }, { value: 'economy' }],
      sports: [{ value: 'football' }]
    }

    const createTopicSchema = loadTopics => ({
      type: 'form',
      components: {
        category: {
          type: 'select',
          options: {
            data: async () => [{ value: 'news' }, { value: 'sports' }]
          },
          compute: getValidOrFirstOption
        },
        topic: {
          type: 'select',
          options: {
            // The curried pattern: The outer function tracks the
            // dependencies, the returned one loads.
            data: ({ item }) => {
              const { category } = item
              return async () => loadTopics(category)
            }
          },
          compute: getValidOrFirstOption
        }
      }
    })

    it('reselects dependent options when options of other fields load', async () => {
      const loadTopics = vi.fn(category => topicsByCategory[category] ?? [])
      const schema = createTopicSchema(loadTopics)
      const { formModel, data } = createFormModel(schema, {})
      await formModel.waitForPendingLoads()
      expect(data).toEqual({ category: 'news', topic: 'politics' })
      data.category = 'sports'
      await nextTick()
      await formModel.waitForPendingLoads()
      expect(data.topic).toBe('football')
      expect(loadTopics.mock.calls).toEqual([[undefined], ['news'], ['sports']])
      formModel.stop()
    })

    it('shares the option objects with the components', async () => {
      const schema = {
        type: 'form',
        components: {
          size: {
            type: 'select',
            options: { data: async () => [{ id: 1 }, { id: 2 }] },
            compute: ({ value, options }) => value ?? options?.[0]
          }
        }
      }
      const { formModel, data } = createFormModel(schema, {})
      await formModel.waitForPendingLoads()
      const options = formModel.getOptions({
        schema: schema.components.size,
        data,
        name: 'size',
        dataPath: 'size',
        componentPath: 'size'
      })
      expect(options).toEqual([{ id: 1 }, { id: 2 }])
      expect(toRaw(data.size)).toBe(options[0])
      formModel.stop()
    })

    it("doesn't load options that aren't read", async () => {
      const data = vi.fn(async () => [{ value: 'news' }])
      const schema = {
        type: 'form',
        components: {
          category: { type: 'select', options: { data } }
        }
      }
      const { formModel } = createFormModel(schema, {})
      await formModel.waitForPendingLoads()
      expect(data).not.toHaveBeenCalled()
      formModel.stop()
    })
  })

  describe('dirty state', () => {
    const getSourceSchema = () => ({ type: 'list' })

    // Resolves once the snapshot to compare with is taken, see
    // `FormModel.takeProcessedDataSnapshotWhenSettled()`:
    async function waitForProcessedDataSnapshot(formModel) {
      await nextTick()
      await formModel.waitForPendingLoads()
      await nextTick()
    }

    it('compares the processed data with its snapshot', async () => {
      const schema = {
        type: 'form',
        components: { title: { type: 'text' }, slug }
      }
      const { formModel, data } = createFormModel(
        schema,
        { title: 'Hello' },
        { getSourceSchema }
      )
      await waitForProcessedDataSnapshot(formModel)
      expect(formModel.isDirty).toBe(false)
      data.title = 'Changed'
      expect(formModel.isDirty).toBe(true)
      data.title = 'Hello'
      expect(formModel.isDirty).toBe(false)
      formModel.stop()
    })

    it("isn't dirty until the snapshot is taken", async () => {
      const schema = {
        type: 'form',
        components: { title: { type: 'text' } }
      }
      const { formModel, data } = createFormModel(
        schema,
        { title: 'Hello' },
        { getSourceSchema }
      )
      data.title = 'Changed'
      expect(formModel.isDirty).toBe(false)
      formModel.stop()
    })

    it("doesn't count values derived after loads as changes", async () => {
      const schema = {
        type: 'form',
        components: {
          title: { type: 'text' },
          length: {
            type: 'computed',
            data: ({ item }) => {
              const { title } = item
              return async () => title.length
            }
          },
          size: {
            type: 'select',
            options: { data: async () => [{ id: 1 }, { id: 2 }] },
            compute: ({ value, options }) => value ?? options?.[0].id
          }
        }
      }
      const { formModel, data } = createFormModel(
        schema,
        { title: 'Hello' },
        { getSourceSchema }
      )
      await waitForProcessedDataSnapshot(formModel)
      expect(data).toEqual({ title: 'Hello', length: 5, size: 1 })
      expect(formModel.isDirty).toBe(false)
      data.size = 2
      expect(formModel.isDirty).toBe(true)
      formModel.stop()
    })

    it('takes a new snapshot when the data is replaced', async () => {
      const schema = {
        type: 'form',
        components: { title: { type: 'text' } }
      }
      const { formModel, dataRef, data } = createFormModel(
        schema,
        { title: 'Hello' },
        { getSourceSchema }
      )
      await waitForProcessedDataSnapshot(formModel)
      data.title = 'Changed'
      expect(formModel.isDirty).toBe(true)
      dataRef.value = reactive({ title: 'Saved' })
      await waitForProcessedDataSnapshot(formModel)
      expect(formModel.isDirty).toBe(false)
      formModel.stop()
    })

    it('detects in-place changes of nested values against the snapshot', async () => {
      const schema = {
        type: 'form',
        components: {
          chapters: {
            type: 'list',
            form: { type: 'form', components: { title: { type: 'text' } } }
          },
          settings: {
            type: 'object',
            form: { type: 'form', components: { color: { type: 'text' } } }
          }
        }
      }
      const { formModel, data } = createFormModel(
        schema,
        { chapters: [{ title: 'One' }], settings: { color: 'red' } },
        { getSourceSchema }
      )
      await waitForProcessedDataSnapshot(formModel)
      data.chapters[0].title = 'Changed'
      expect(formModel.isDirty).toBe(true)
      data.chapters[0].title = 'One'
      expect(formModel.isDirty).toBe(false)
      data.settings.color = 'blue'
      expect(formModel.isDirty).toBe(true)
      data.settings.color = 'red'
      expect(formModel.isDirty).toBe(false)
      formModel.stop()
    })

    it("doesn't count changes of excluded values", async () => {
      const schema = {
        type: 'form',
        components: { search: { type: 'text', exclude: true } }
      }
      const { formModel, data } = createFormModel(
        schema,
        { search: '' },
        { getSourceSchema }
      )
      await waitForProcessedDataSnapshot(formModel)
      data.search = 'Changed'
      expect(formModel.isDirty).toBe(false)
      formModel.stop()
    })

    it("isn't tracked without a source schema", async () => {
      const schema = {
        type: 'form',
        components: { title: { type: 'text' } }
      }
      const { formModel, data } = createFormModel(schema, { title: 'Hello' })
      await waitForProcessedDataSnapshot(formModel)
      data.title = 'Changed'
      expect(formModel.isDirty).toBe(false)
      formModel.stop()
    })
  })
})
