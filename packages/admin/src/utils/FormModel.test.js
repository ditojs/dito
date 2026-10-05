import { vi } from 'vitest'
import { reactive, ref, toRaw, nextTick } from 'vue'
import { registerTypeComponent } from './schema/types.js'
import { FormModel } from './FormModel.js'
import { updateOrder } from './schema/data.js'

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
// Like `DitoTypeUpload`, which leaves out files that aren't uploaded yet:
registerTypeComponent('upload', {
  defaultNested: true,
  processValue: ({ value }) => (value?.isUploaded ? value.name : null)
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

  it("doesn't recompute values whose `compute()` doesn't read them", async () => {
    // Like lineto's access tokens, which are random for each call.
    let callCount = 0
    const schema = {
      type: 'form',
      components: {
        title: { type: 'text' },
        token: {
          type: 'text',
          compute: ({ item }) => `${item.title}-${++callCount}`
        }
      }
    }
    const { formModel, data } = createFormModel(schema, { title: 'Hello' })
    expect(data.token).toBe('Hello-1')
    data.title = 'Changed'
    await nextTick()
    expect(data.token).toBe('Changed-2')
    await nextTick()
    expect(callCount).toBe(2)
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

    it("doesn't compare replaced data with the snapshot of its predecessor", async () => {
      const schema = {
        type: 'form',
        components: { title: { type: 'text' } }
      }
      const { formModel, dataRef } = createFormModel(
        schema,
        { title: 'Hello' },
        { getSourceSchema }
      )
      await waitForProcessedDataSnapshot(formModel)
      // Until its own snapshot is taken, the replaced data isn't dirty:
      dataRef.value = reactive({ title: 'Saved' })
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

    it("doesn't call `compute()` and `process()`", async () => {
      const compute = vi.fn(() => 'Computed')
      const process = vi.fn(({ value }) => value)
      const schema = {
        type: 'form',
        components: {
          title: { type: 'text', process },
          subtitle: { type: 'text', compute }
        }
      }
      const { formModel, data } = createFormModel(
        schema,
        { title: 'Hello' },
        { getSourceSchema }
      )
      await waitForProcessedDataSnapshot(formModel)
      const computeCallCount = compute.mock.calls.length
      data.title = 'Changed'
      expect(formModel.isDirty).toBe(true)
      expect(compute).toHaveBeenCalledTimes(computeCallCount)
      expect(process).not.toHaveBeenCalled()
      formModel.stop()
    })

    it('reads the dirty state of data that `process()` rejects', async () => {
      // Data that is edited isn't validated yet, see `processData()`.
      const schema = {
        type: 'form',
        components: {
          version: {
            type: 'text',
            process: ({ value }) => value.split('.').map(Number)
          }
        }
      }
      const { formModel, data } = createFormModel(
        schema,
        { version: '1.0' },
        { getSourceSchema }
      )
      await waitForProcessedDataSnapshot(formModel)
      data.version = null
      expect(formModel.isDirty).toBe(true)
      data.version = '1.0'
      expect(formModel.isDirty).toBe(false)
      formModel.stop()
    })

    it('counts changes of excluded values that `process()` stores', async () => {
      const schema = {
        type: 'form',
        components: {
          tagsText: {
            type: 'text',
            exclude: true,
            process: ({ value, processedItem }) => {
              processedItem.tags = value.split(',')
            }
          }
        }
      }
      const { formModel, data } = createFormModel(
        schema,
        { tagsText: 'a' },
        { getSourceSchema }
      )
      await waitForProcessedDataSnapshot(formModel)
      data.tagsText = 'a,b'
      expect(formModel.isDirty).toBe(true)
      data.tagsText = 'a'
      expect(formModel.isDirty).toBe(false)
      formModel.stop()
    })

    it('compares values as processed by their types', async () => {
      const schema = {
        type: 'form',
        components: { file: { type: 'upload' } }
      }
      const { formModel, data } = createFormModel(
        schema,
        { file: null },
        { getSourceSchema }
      )
      await waitForProcessedDataSnapshot(formModel)
      data.file = { name: 'font.zip', isUploaded: false }
      expect(formModel.isDirty).toBe(false)
      data.file.isUploaded = true
      expect(formModel.isDirty).toBe(true)
      formModel.stop()
    })

    it("doesn't count order keys numbered on setup as changes", async () => {
      const schema = {
        type: 'form',
        components: {
          items: {
            type: 'list',
            orderKey: 'order',
            form: { type: 'form', components: { name: { type: 'text' } } }
          }
        }
      }
      const { formModel, dataRef, data } = createFormModel(
        schema,
        {
          items: [
            { id: 1, name: 'A', order: 4 },
            { id: 2, name: 'B', order: 7 }
          ]
        },
        { getSourceSchema }
      )
      await waitForProcessedDataSnapshot(formModel)
      expect(data.items.map(item => item.order)).toEqual([0, 1])
      expect(formModel.isDirty).toBe(false)
      data.items.reverse()
      updateOrder(schema.components.items, data.items)
      expect(formModel.isDirty).toBe(true)
      // Replaced data is numbered too.
      dataRef.value = reactive({ items: [{ id: 3, name: 'C', order: 8 }] })
      await waitForProcessedDataSnapshot(formModel)
      expect(dataRef.value.items[0].order).toBe(0)
      expect(formModel.isDirty).toBe(false)
      formModel.stop()
    })

    describe('applyCleanChanges()', () => {
      const schema = {
        type: 'form',
        components: {
          title: { type: 'text' },
          chapters: {
            type: 'list',
            form: { type: 'form', components: { title: { type: 'text' } } }
          }
        }
      }

      it("doesn't count clean changes, but other changes", async () => {
        const { formModel, data } = createFormModel(
          schema,
          { title: 'Hello', chapters: [{ title: 'One' }] },
          { getSourceSchema }
        )
        await waitForProcessedDataSnapshot(formModel)
        data.title = 'Changed'
        await formModel.applyCleanChanges(() => {
          data.chapters[0].title = 'Saved'
          data.chapters.push({ title: 'Two' })
        })
        expect(formModel.isDirty).toBe(true)
        data.title = 'Hello'
        expect(formModel.isDirty).toBe(false)
        data.chapters[1].title = 'Changed'
        expect(formModel.isDirty).toBe(true)
        formModel.stop()
      })

      it('keeps values derived from clean changes clean', async () => {
        const { formModel, data } = createFormModel(
          { type: 'form', components: { title: { type: 'text' }, slug } },
          { title: 'Hello' },
          { getSourceSchema }
        )
        await waitForProcessedDataSnapshot(formModel)
        await formModel.applyCleanChanges(() => {
          data.title = 'Saved Title'
        })
        expect(data.slug).toBe('saved-title')
        expect(formModel.isDirty).toBe(false)
        formModel.stop()
      })

      it('takes over clean changes of nested values in place', async () => {
        // Values without forms are processed as they are, sharing their
        // nested values with the data.
        const { formModel, data } = createFormModel(
          { type: 'form', components: { settings: { type: 'text' } } },
          { settings: { color: 'red' } },
          { getSourceSchema }
        )
        await waitForProcessedDataSnapshot(formModel)
        await formModel.applyCleanChanges(() => {
          data.settings.color = 'blue'
        })
        expect(formModel.isDirty).toBe(false)
        formModel.stop()
      })

      it('includes clean changes in snapshots that are pending', async () => {
        const { formModel, data } = createFormModel(
          schema,
          { title: 'Hello', chapters: [] },
          { getSourceSchema }
        )
        await formModel.applyCleanChanges(() => {
          data.title = 'Saved'
        })
        await waitForProcessedDataSnapshot(formModel)
        expect(formModel.isDirty).toBe(false)
        formModel.stop()
      })
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
