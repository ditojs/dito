import { vi } from 'vitest'
import { reactive, ref, toRaw, nextTick } from 'vue'
import { registerTypeComponent } from './schema/types.js'
import { DataModel } from './DataModel.js'
import { updateOrder } from './schema/data.js'

// `setupForm()` needs the admin's API, see `getFormSchemas()`:
vi.mock('./schema/setup.js', () => ({ setupForm: async form => form }))

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
registerTypeComponent('panel', { defaultNested: false })
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

function createDataModel(schema, data, { getSourceSchema } = {}) {
  const dataRef = ref(reactive(data))
  const dataModel = new DataModel({
    component: { dataPath: '', componentPath: '' },
    getSchema: () => schema,
    getData: () => dataRef.value,
    getSourceSchema
  })
  return { dataModel, dataRef, data: dataRef.value }
}

const slug = {
  type: 'computed',
  compute: ({ item }) => item.title?.toLowerCase().replaceAll(' ', '-')
}

describe('DataModel', () => {
  it('sets the defaults of missing values when the data is set up', () => {
    const schema = {
      type: 'form',
      components: {
        title: { type: 'text', default: 'Untitled' },
        tags: { type: 'list', form: { type: 'form', components: {} } }
      }
    }
    const { dataModel, dataRef, data } = createDataModel(schema, {
      tags: null
    })
    expect(data).toEqual({ title: 'Untitled', tags: null })
    dataModel.stop()
    dataRef.value = reactive({})
    expect(dataRef.value).toEqual({})
  })

  it('sets the defaults of values that go missing later', async () => {
    // E.g. items that code adds, in which the components edit the defaults.
    const schema = {
      type: 'form',
      components: {
        chapters: {
          type: 'list',
          form: {
            type: 'form',
            components: {
              title: { type: 'text' },
              status: { type: 'text', default: 'draft' }
            }
          }
        }
      }
    }
    const { dataModel, data } = createDataModel(schema, { chapters: [] })
    data.chapters.push({ title: 'One' })
    await nextTick()
    expect(data.chapters).toEqual([{ title: 'One', status: 'draft' }])
    delete data.chapters[0].status
    await nextTick()
    expect(data.chapters[0].status).toBe('draft')
    dataModel.stop()
  })

  it('sets the defaults of replaced data', async () => {
    const schema = {
      type: 'form',
      components: { title: { type: 'text', default: 'Untitled' } }
    }
    const { dataModel, dataRef } = createDataModel(schema, {})
    dataRef.value = reactive({})
    await nextTick()
    expect(dataRef.value).toEqual({ title: 'Untitled' })
    dataModel.stop()
  })

  it('writes computed values and keeps them current', async () => {
    const schema = {
      type: 'form',
      components: { title: { type: 'text' }, slug }
    }
    const { dataModel, data } = createDataModel(schema, {
      title: 'Hello World'
    })
    expect(data.slug).toBe('hello-world')
    data.title = 'Good Bye'
    await nextTick()
    expect(data.slug).toBe('good-bye')
    dataModel.stop()
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
    const { dataModel, data } = createDataModel(schema, { title: 'Hello' })
    expect(data.slug).toBe('hello')
    dataModel.stop()
  })

  it('writes the computed value back when the value changes', async () => {
    const schema = {
      type: 'form',
      components: {
        tags: { type: 'text', compute: ({ value }) => value ?? [] }
      }
    }
    const { dataModel, data } = createDataModel(schema, { tags: null })
    expect(data.tags).toEqual([])
    data.tags = null
    await nextTick()
    expect(data.tags).toEqual([])
    dataModel.stop()
  })

  it('keeps values that `compute()` returns `undefined` for', async () => {
    const schema = {
      type: 'form',
      components: { title: { type: 'text', compute: () => undefined } }
    }
    const { dataModel, data } = createDataModel(schema, { title: 'Hello' })
    data.title = 'Changed'
    await nextTick()
    expect(data.title).toBe('Changed')
    dataModel.stop()
  })

  it('writes computed values that are new objects only once', async () => {
    const compute = vi.fn(({ value }) =>
      value.map(entry => ({ ...entry, upper: entry.name.toUpperCase() }))
    )
    const schema = {
      type: 'form',
      components: { entries: { type: 'text', compute } }
    }
    const { dataModel, data } = createDataModel(schema, {
      entries: [{ name: 'One' }]
    })
    await nextTick()
    // Once initially, and once more after writing the new array, which is
    // equal and therefore not written again.
    expect(compute).toHaveBeenCalledTimes(2)
    expect(data.entries).toEqual([{ name: 'One', upper: 'ONE' }])
    dataModel.stop()
  })

  it('converts stored values that are no objects to the objects of forms', () => {
    // E.g. sizes that are stored as numbers, and edited as value and unit.
    const schema = {
      type: 'form',
      components: {
        padding: {
          type: 'object',
          compute: ({ value }) =>
            typeof value === 'number' ? { value, units: 'rem' } : value,
          form: {
            type: 'form',
            components: {
              value: { type: 'text' },
              units: { type: 'text' }
            }
          }
        }
      }
    }
    const { dataModel, data } = createDataModel(schema, { padding: 5 })
    expect(data.padding).toEqual({ value: 5, units: 'rem' })
    dataModel.stop()
  })

  it('writes computed items with the defaults of their forms', async () => {
    // The defaults of the computed items don't make `compute()` disagree with
    // them, which would replace them in an endless loop.
    const compute = ({ value, item }) =>
      item.sounds.map(name => ({
        name,
        steps: value?.find(track => track.name === name)?.steps ?? []
      }))
    const schema = {
      type: 'form',
      components: {
        tracks: {
          type: 'list',
          compute,
          form: {
            type: 'form',
            components: {
              name: { type: 'text' },
              volume: { type: 'text', default: 0 },
              // Buttons have no value, and don't get a key in the items:
              play: { type: 'computed' }
            }
          }
        }
      }
    }
    const { dataModel, data } = createDataModel(schema, {
      sounds: ['Kick'],
      tracks: []
    })
    await nextTick()
    expect(data.tracks).toEqual([{ name: 'Kick', steps: [], volume: 0 }])
    dataModel.stop()
  })

  it('stops writing computed values whose sources disagree', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const schema = {
      type: 'form',
      components: {
        count: { type: 'text', compute: ({ item }) => (item.other ?? 0) + 1 },
        other: { type: 'text', compute: ({ item }) => (item.count ?? 0) + 1 }
      }
    }
    const { dataModel } = createDataModel(schema, {})
    await nextTick()
    await nextTick()
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(
          `The computed value at 'count' keeps changing`
        )
      })
    )
    error.mockRestore()
    dataModel.stop()
  })

  it("doesn't recompute values whose `compute()` doesn't read them", async () => {
    // E.g. access tokens, which are random for each call.
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
    const { dataModel, data } = createDataModel(schema, { title: 'Hello' })
    expect(data.token).toBe('Hello-1')
    data.title = 'Changed'
    await nextTick()
    expect(data.token).toBe('Changed-2')
    await nextTick()
    expect(callCount).toBe(2)
    dataModel.stop()
  })

  it('keeps computing values when an `if` fails', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const schema = {
      type: 'form',
      components: {
        broken: {
          type: 'text',
          if: () => {
            throw new Error('Broken')
          }
        },
        slug
      }
    }
    const { dataModel, data } = createDataModel(schema, { title: 'A B' })
    expect(data.slug).toBe('a-b')
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Broken' })
    )
    error.mockRestore()
    dataModel.stop()
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
    const { dataModel, data } = createDataModel(schema, {
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
    dataModel.stop()
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
    const { dataModel, data } = createDataModel(schema, {
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
    dataModel.stop()
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
    const { dataModel, data } = createDataModel(schema, {
      chapters: [{ title: 'One' }]
    })
    expect(data.chapters[0].slug).toBe(undefined)
    dataModel.stop()
  })

  it('computes the values of the panels of sources with resource', () => {
    // The panels display the data that contains the sources.
    const schema = {
      type: 'form',
      components: {
        title: { type: 'text' },
        chapters: {
          type: 'list',
          resource: 'chapters',
          form: { type: 'form', components: { title: { type: 'text' }, slug } },
          panels: {
            info: { type: 'panel', components: { slug } }
          }
        }
      }
    }
    const { dataModel, data } = createDataModel(schema, {
      title: 'Book One',
      chapters: [{ title: 'One' }]
    })
    expect(data.slug).toBe('book-one')
    expect(data.chapters[0].slug).toBe(undefined)
    dataModel.stop()
  })

  describe('components created by `components()` callbacks', () => {
    // E.g. fields that depend on the selected template.
    const getSchema = createComponents => ({
      type: 'form',
      components: {
        fields: { type: 'list', defaultValue: () => [] },
        values: {
          type: 'section',
          nested: true,
          components: createComponents
        }
      }
    })
    const createFieldComponents = ({ item }) =>
      Object.fromEntries(
        item.fields.map(name => [
          name,
          { type: 'text', default: `Default ${name}` }
        ])
      )

    it('sets their defaults, also once they are created later', async () => {
      const { dataModel, data } = createDataModel(
        getSchema(createFieldComponents),
        { fields: ['name'], values: {} }
      )
      await nextTick()
      expect(data.values).toEqual({ name: 'Default name' })
      data.fields.push('city')
      await nextTick()
      expect(data.values).toEqual({
        name: 'Default name',
        city: 'Default city'
      })
      dataModel.stop()
    })

    it('writes their computed values', async () => {
      const schema = getSchema(({ item }) => ({
        upper: { type: 'computed', compute: () => item.title.toUpperCase() }
      }))
      schema.components.title = { type: 'text' }
      const { dataModel, data } = createDataModel(schema, {
        title: 'Book',
        fields: [],
        values: {}
      })
      await nextTick()
      expect(data.values.upper).toBe('BOOK')
      data.title = 'Story'
      await nextTick()
      expect(data.values.upper).toBe('STORY')
      dataModel.stop()
    })

    it('creates them only when the data that they read changes', async () => {
      const createComponents = vi.fn(createFieldComponents)
      const schema = getSchema(createComponents)
      schema.components.title = { type: 'text' }
      const { dataModel, data } = createDataModel(schema, {
        title: 'Book',
        fields: ['name'],
        values: {}
      })
      await nextTick()
      expect(createComponents).toHaveBeenCalledTimes(1)
      data.title = 'Story'
      await nextTick()
      expect(createComponents).toHaveBeenCalledTimes(1)
      data.fields.push('city')
      await nextTick()
      expect(createComponents).toHaveBeenCalledTimes(2)
      dataModel.stop()
    })
  })

  it('tells which components it computes the values of', () => {
    const schema = {
      type: 'form',
      components: { title: { type: 'text' }, slug },
      panels: {
        // Panels with their own data aren't part of the model's data.
        search: {
          type: 'panel',
          data: () => ({}),
          components: { query: { type: 'text', compute: () => 'Query' } }
        }
      }
    }
    const { dataModel } = createDataModel(schema, { title: 'Book' })
    expect(dataModel.hasComputedValueEntry('slug')).toBe(true)
    expect(dataModel.hasComputedValueEntry('search/query')).toBe(false)
    dataModel.stop()
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
    const { dataModel, data } = createDataModel(schema, { title: 'Hello' })
    expect(data.upper).toBe('HELLO')
    expect(data.copy).toBe('Hello')
    await dataModel.waitUntilSettled()
    expect(data.length).toBe(5)
    data.title = 'Bye'
    await nextTick()
    expect(data.upper).toBe('BYE')
    expect(data.copy).toBe('Bye')
    await dataModel.waitUntilSettled()
    expect(data.length).toBe(3)
    dataModel.stop()
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
    const { dataModel, data } = createDataModel(schema, { title: 'First' })
    data.title = 'Second'
    await nextTick()
    expect(resolvers).toHaveLength(2)
    resolvers[1]()
    resolvers[0]()
    await dataModel.waitUntilSettled()
    expect(data.loaded).toBe('Second')
    dataModel.stop()
  })

  describe('options', () => {
    // Keeps valid values, and selects the first option otherwise. `compute()`
    // only runs once the options that it reads are loaded.
    const getValidOrFirstOption = ({ value, options }) =>
      options.some(option => option.value === value)
        ? value
        : options[0]?.value ?? null

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

    it('keeps values until the options that `compute()` reads load', async () => {
      const schema = createTopicSchema(category => topicsByCategory[category])
      const { dataModel, data } = createDataModel(schema, {
        category: 'archive',
        topic: 'football'
      })
      await nextTick()
      expect(data).toEqual({ category: 'archive', topic: 'football' })
      await dataModel.waitUntilSettled()
      expect(data).toEqual({ category: 'news', topic: 'politics' })
      dataModel.stop()
    })

    it('reselects dependent options when options of other fields load', async () => {
      const loadTopics = vi.fn(category => topicsByCategory[category] ?? [])
      const schema = createTopicSchema(loadTopics)
      const { dataModel, data } = createDataModel(schema, {})
      await dataModel.waitUntilSettled()
      expect(data).toEqual({ category: 'news', topic: 'politics' })
      data.category = 'sports'
      await nextTick()
      await dataModel.waitUntilSettled()
      expect(data.topic).toBe('football')
      expect(loadTopics.mock.calls).toEqual([[undefined], ['news'], ['sports']])
      dataModel.stop()
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
      const { dataModel, data } = createDataModel(schema, {})
      await dataModel.waitUntilSettled()
      const options = dataModel.getOptions({
        schema: schema.components.size,
        data,
        name: 'size',
        dataPath: 'size',
        componentPath: 'size'
      })
      expect(options).toEqual([{ id: 1 }, { id: 2 }])
      expect(toRaw(data.size)).toBe(options[0])
      dataModel.stop()
    })

    it(`doesn't load options that aren't read`, async () => {
      const data = vi.fn(async () => [{ value: 'news' }])
      const schema = {
        type: 'form',
        components: {
          category: { type: 'select', options: { data } }
        }
      }
      const { dataModel } = createDataModel(schema, {})
      await dataModel.waitUntilSettled()
      expect(data).not.toHaveBeenCalled()
      dataModel.stop()
    })
  })

  describe('dirty state', () => {
    const getSourceSchema = () => ({ type: 'list' })

    // Resolves once the model settled after the snapshot was taken, see
    // `DataModel.takeProcessedDataSnapshot()`:
    async function waitForProcessedDataSnapshot(dataModel) {
      await nextTick()
      await dataModel.waitUntilSettled()
      await nextTick()
    }

    it('compares the processed data with its snapshot', async () => {
      const schema = {
        type: 'form',
        components: { title: { type: 'text' }, slug }
      }
      const { dataModel, data } = createDataModel(
        schema,
        { title: 'Hello' },
        { getSourceSchema }
      )
      await waitForProcessedDataSnapshot(dataModel)
      expect(dataModel.isDirty).toBe(false)
      data.title = 'Changed'
      expect(dataModel.isDirty).toBe(true)
      data.title = 'Hello'
      expect(dataModel.isDirty).toBe(false)
      dataModel.stop()
    })

    it('records the values derived while the model settles once', async () => {
      let resolveLength
      const schema = {
        type: 'form',
        components: {
          title: { type: 'text' },
          slug,
          length: {
            type: 'computed',
            data: () =>
              new Promise(resolve => {
                resolveLength = resolve
              })
          }
        }
      }
      const { dataModel, data } = createDataModel(
        schema,
        { title: 'Hello' },
        { getSourceSchema }
      )
      await nextTick()
      // `slug` is written for each title while `length` still loads:
      data.title = 'One'
      await nextTick()
      data.title = 'Two'
      await nextTick()
      expect([...dataModel.derivedValueDataPaths]).toEqual(['slug'])
      resolveLength(3)
      await waitForProcessedDataSnapshot(dataModel)
      dataModel.stop()
    })

    it('counts changes made while the model settles', async () => {
      // `size` selects its first option once the options are loaded, which is
      // derived and doesn't count, while the edit of `title` does.
      let resolveOptions
      const schema = {
        type: 'form',
        components: {
          title: { type: 'text' },
          size: {
            type: 'select',
            options: {
              data: () =>
                new Promise(resolve => {
                  resolveOptions = resolve
                })
            },
            compute: ({ value, options }) => value ?? options?.[0].id
          }
        }
      }
      const { dataModel, data } = createDataModel(
        schema,
        { title: 'Hello' },
        { getSourceSchema }
      )
      await nextTick()
      data.title = 'Changed'
      expect(dataModel.isDirty).toBe(true)
      resolveOptions([{ id: 1 }, { id: 2 }])
      await waitForProcessedDataSnapshot(dataModel)
      expect(data.size).toBe(1)
      expect(dataModel.isDirty).toBe(true)
      data.title = 'Hello'
      expect(dataModel.isDirty).toBe(false)
      dataModel.stop()
    })

    it(`doesn't count values derived after loads as changes`, async () => {
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
      const { dataModel, data } = createDataModel(
        schema,
        { title: 'Hello' },
        { getSourceSchema }
      )
      await waitForProcessedDataSnapshot(dataModel)
      expect(data).toEqual({ title: 'Hello', length: 5, size: 1 })
      expect(dataModel.isDirty).toBe(false)
      data.size = 2
      expect(dataModel.isDirty).toBe(true)
      dataModel.stop()
    })

    it('takes a new snapshot when the data is replaced', async () => {
      const schema = {
        type: 'form',
        components: { title: { type: 'text' } }
      }
      const { dataModel, dataRef, data } = createDataModel(
        schema,
        { title: 'Hello' },
        { getSourceSchema }
      )
      await waitForProcessedDataSnapshot(dataModel)
      data.title = 'Changed'
      expect(dataModel.isDirty).toBe(true)
      dataRef.value = reactive({ title: 'Saved' })
      await waitForProcessedDataSnapshot(dataModel)
      expect(dataModel.isDirty).toBe(false)
      dataModel.stop()
    })

    it(`doesn't compare replaced data with the snapshot of its predecessor`, async () => {
      const schema = {
        type: 'form',
        components: { title: { type: 'text' } }
      }
      const { dataModel, dataRef } = createDataModel(
        schema,
        { title: 'Hello' },
        { getSourceSchema }
      )
      await waitForProcessedDataSnapshot(dataModel)
      // Until its own snapshot is taken, the replaced data isn't dirty:
      dataRef.value = reactive({ title: 'Saved' })
      expect(dataModel.isDirty).toBe(false)
      dataModel.stop()
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
      const { dataModel, data } = createDataModel(
        schema,
        { chapters: [{ title: 'One' }], settings: { color: 'red' } },
        { getSourceSchema }
      )
      await waitForProcessedDataSnapshot(dataModel)
      data.chapters[0].title = 'Changed'
      expect(dataModel.isDirty).toBe(true)
      data.chapters[0].title = 'One'
      expect(dataModel.isDirty).toBe(false)
      data.settings.color = 'blue'
      expect(dataModel.isDirty).toBe(true)
      data.settings.color = 'red'
      expect(dataModel.isDirty).toBe(false)
      dataModel.stop()
    })

    it(`doesn't count changes of excluded values`, async () => {
      const schema = {
        type: 'form',
        components: { search: { type: 'text', exclude: true } }
      }
      const { dataModel, data } = createDataModel(
        schema,
        { search: '' },
        { getSourceSchema }
      )
      await waitForProcessedDataSnapshot(dataModel)
      data.search = 'Changed'
      expect(dataModel.isDirty).toBe(false)
      dataModel.stop()
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
      const { dataModel, data } = createDataModel(
        schema,
        { title: 'Hello' },
        { getSourceSchema }
      )
      await waitForProcessedDataSnapshot(dataModel)
      const computeCallCount = compute.mock.calls.length
      data.title = 'Changed'
      expect(dataModel.isDirty).toBe(true)
      expect(compute).toHaveBeenCalledTimes(computeCallCount)
      expect(process).not.toHaveBeenCalled()
      dataModel.stop()
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
      const { dataModel, data } = createDataModel(
        schema,
        { version: '1.0' },
        { getSourceSchema }
      )
      await waitForProcessedDataSnapshot(dataModel)
      data.version = null
      expect(dataModel.isDirty).toBe(true)
      data.version = '1.0'
      expect(dataModel.isDirty).toBe(false)
      dataModel.stop()
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
      const { dataModel, data } = createDataModel(
        schema,
        { tagsText: 'a' },
        { getSourceSchema }
      )
      await waitForProcessedDataSnapshot(dataModel)
      data.tagsText = 'a,b'
      expect(dataModel.isDirty).toBe(true)
      data.tagsText = 'a'
      expect(dataModel.isDirty).toBe(false)
      dataModel.stop()
    })

    it('compares values as processed by their types', async () => {
      const schema = {
        type: 'form',
        components: { file: { type: 'upload' } }
      }
      const { dataModel, data } = createDataModel(
        schema,
        { file: null },
        { getSourceSchema }
      )
      await waitForProcessedDataSnapshot(dataModel)
      data.file = { name: 'font.zip', isUploaded: false }
      expect(dataModel.isDirty).toBe(false)
      data.file.isUploaded = true
      expect(dataModel.isDirty).toBe(true)
      dataModel.stop()
    })

    it(`doesn't count order keys numbered on setup as changes`, async () => {
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
      const { dataModel, dataRef, data } = createDataModel(
        schema,
        {
          items: [
            { id: 1, name: 'A', order: 4 },
            { id: 2, name: 'B', order: 7 }
          ]
        },
        { getSourceSchema }
      )
      await waitForProcessedDataSnapshot(dataModel)
      expect(data.items.map(item => item.order)).toEqual([0, 1])
      expect(dataModel.isDirty).toBe(false)
      data.items.reverse()
      updateOrder(schema.components.items, data.items)
      expect(dataModel.isDirty).toBe(true)
      // Replaced data is numbered too.
      dataRef.value = reactive({ items: [{ id: 3, name: 'C', order: 8 }] })
      await waitForProcessedDataSnapshot(dataModel)
      expect(dataRef.value.items[0].order).toBe(0)
      expect(dataModel.isDirty).toBe(false)
      dataModel.stop()
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

      it(`doesn't count clean changes, but other changes`, async () => {
        const { dataModel, data } = createDataModel(
          schema,
          { title: 'Hello', chapters: [{ title: 'One' }] },
          { getSourceSchema }
        )
        await waitForProcessedDataSnapshot(dataModel)
        data.title = 'Changed'
        await dataModel.applyCleanChanges(() => {
          data.chapters[0].title = 'Saved'
          data.chapters.push({ title: 'Two' })
        })
        expect(dataModel.isDirty).toBe(true)
        data.title = 'Hello'
        expect(dataModel.isDirty).toBe(false)
        data.chapters[1].title = 'Changed'
        expect(dataModel.isDirty).toBe(true)
        dataModel.stop()
      })

      it('keeps values derived from clean changes clean', async () => {
        const { dataModel, data } = createDataModel(
          { type: 'form', components: { title: { type: 'text' }, slug } },
          { title: 'Hello' },
          { getSourceSchema }
        )
        await waitForProcessedDataSnapshot(dataModel)
        await dataModel.applyCleanChanges(() => {
          data.title = 'Saved Title'
        })
        expect(data.slug).toBe('saved-title')
        expect(dataModel.isDirty).toBe(false)
        dataModel.stop()
      })

      it('takes over clean changes of nested values in place', async () => {
        // Values without forms are processed as they are, sharing their
        // nested values with the data.
        const { dataModel, data } = createDataModel(
          { type: 'form', components: { settings: { type: 'text' } } },
          { settings: { color: 'red' } },
          { getSourceSchema }
        )
        await waitForProcessedDataSnapshot(dataModel)
        await dataModel.applyCleanChanges(() => {
          data.settings.color = 'blue'
        })
        expect(dataModel.isDirty).toBe(false)
        dataModel.stop()
      })

      it('includes clean changes in snapshots that are pending', async () => {
        const { dataModel, data } = createDataModel(
          schema,
          { title: 'Hello', chapters: [] },
          { getSourceSchema }
        )
        await dataModel.applyCleanChanges(() => {
          data.title = 'Saved'
        })
        await waitForProcessedDataSnapshot(dataModel)
        expect(dataModel.isDirty).toBe(false)
        dataModel.stop()
      })
    })

    it(`isn't tracked without a source schema`, async () => {
      const schema = {
        type: 'form',
        components: { title: { type: 'text' } }
      }
      const { dataModel, data } = createDataModel(schema, { title: 'Hello' })
      await waitForProcessedDataSnapshot(dataModel)
      data.title = 'Changed'
      expect(dataModel.isDirty).toBe(false)
      dataModel.stop()
    })
  })
})
