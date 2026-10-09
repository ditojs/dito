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

    // `compute()` sees options that fail to load as `undefined`:
    it('computes values when options fail to load', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const schema = {
        type: 'form',
        components: {
          genre: {
            type: 'select',
            options: {
              data: async () => {
                throw new Error('Unavailable')
              }
            },
            compute: ({ value, options }) => value ?? options?.[0] ?? 'none'
          }
        }
      }
      const { dataModel, data } = createDataModel(schema, {})
      await dataModel.waitUntilSettled()
      await nextTick()
      expect(data.genre).toBe('none')
      error.mockRestore()
      dataModel.stop()
    })

    it('computes values when options point to missing data', async () => {
      const schema = {
        type: 'form',
        components: {
          genre: {
            type: 'select',
            options: { dataPath: '../genres' },
            compute: ({ value, options }) => value ?? options?.[0] ?? 'none'
          }
        }
      }
      const { dataModel, data } = createDataModel(schema, {})
      await dataModel.waitUntilSettled()
      await nextTick()
      expect(data.genre).toBe('none')
      dataModel.stop()
    })

    it('computes values from options at data paths', async () => {
      // E.g. selecting from the values that another list of the form holds:
      const schema = {
        type: 'form',
        components: {
          genres: { type: 'text' },
          genre: {
            type: 'select',
            options: { dataPath: '../genres' },
            compute: ({ value, options }) =>
              options.includes(value) ? value : options[0]
          }
        }
      }
      const { dataModel, data } = createDataModel(schema, {
        genres: ['crime', 'poetry'],
        genre: 'drama'
      })
      await nextTick()
      expect(data.genre).toBe('crime')
      data.genres = ['poetry']
      await nextTick()
      expect(data.genre).toBe('poetry')
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
      it('keeps changes made while clean changes settle dirty', async () => {
        // The clean change starts a load, e.g. of a value derived from it,
        // and the user edits another value before the load finished.
        const loads = []
        const schema = {
          type: 'form',
          components: {
            title: { type: 'text' },
            notes: { type: 'text' },
            preview: {
              type: 'computed',
              data: ({ item }) => {
                const { title } = item
                return () =>
                  new Promise(resolve => loads.push(() => resolve(title)))
              }
            }
          }
        }
        const { dataModel, data } = createDataModel(
          schema,
          { title: 'Hello', notes: 'Old' },
          { getSourceSchema }
        )
        await nextTick()
        loads.shift()()
        await waitForProcessedDataSnapshot(dataModel)
        const applying = dataModel.applyCleanChanges(() => {
          data.title = 'Saved'
        })
        await nextTick()
        await nextTick()
        expect(dataModel.hasPendingLoads).toBe(true)
        data.notes = 'Edited by the user'
        loads.shift()()
        await applying
        expect(data.preview).toBe('Saved')
        expect(dataModel.isDirty).toBe(true)
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

  describe('list items that move or are removed', () => {
    // Books whose genre is selected from options loaded per book, with a
    // compute that keeps valid genres and selects the first one otherwise:
    const createShelfSchema = ({ loadGenres, compute }) => ({
      type: 'form',
      components: {
        books: {
          type: 'list',
          form: {
            type: 'form',
            components: {
              title: { type: 'text' },
              genre: {
                type: 'select',
                options: {
                  data: ({ item }) => {
                    const { title } = item
                    return async () => loadGenres(title)
                  }
                },
                compute
              }
            }
          }
        }
      }
    })
    const getValidOrFirstGenre = ({ value, options }) =>
      options.includes(value) ? value : options[0]

    const createShelf = schema =>
      createDataModel(schema, {
        books: [{ title: 'One' }, { title: 'Two' }, { title: 'Three' }]
      })

    it('keeps computing the values of items that moved', async () => {
      const loadGenres = vi.fn(title => [`${title} genre`])
      const { dataModel, data } = createShelf(
        createShelfSchema({ loadGenres, compute: getValidOrFirstGenre })
      )
      await dataModel.waitUntilSettled()
      data.books.reverse()
      data.books.unshift({ title: 'Zero' })
      await nextTick()
      await dataModel.waitUntilSettled()
      expect(data.books.map(book => book.genre)).toEqual([
        'Zero genre',
        'Three genre',
        'Two genre',
        'One genre'
      ])
      dataModel.stop()
    })

    // Bug: The options are recorded by index-based component paths, so the
    // options of all items that moved are loaded again. To be fixed by keying
    // the records by data identity, see `DataModel.pruneOptionsRecords()`.
    test.fails(
      `doesn't load the options of items that moved again`,
      async () => {
        const loadGenres = vi.fn(title => [`${title} genre`])
        const { dataModel, data } = createShelf(
          createShelfSchema({ loadGenres, compute: getValidOrFirstGenre })
        )
        await dataModel.waitUntilSettled()
        expect(loadGenres).toHaveBeenCalledTimes(3)
        data.books.unshift({ title: 'Zero' })
        await nextTick()
        await dataModel.waitUntilSettled()
        expect(loadGenres).toHaveBeenCalledTimes(4)
        dataModel.stop()
      }
    )

    // Bug: The computed value scopes are recorded by index-based component
    // paths, so the values of all items that moved are computed again. To be
    // fixed by keying the records by data identity, like the options.
    test.fails(`doesn't recompute the values of items that moved`, async () => {
      const compute = vi.fn(getValidOrFirstGenre)
      const { dataModel, data } = createShelf(
        createShelfSchema({ loadGenres: title => [title], compute })
      )
      await dataModel.waitUntilSettled()
      await nextTick()
      compute.mockClear()
      data.books.reverse()
      await nextTick()
      await dataModel.waitUntilSettled()
      expect(compute).toHaveBeenCalledTimes(0)
      dataModel.stop()
    })

    it('forgets the options of removed items', async () => {
      const { dataModel, data } = createShelf(
        createShelfSchema({
          loadGenres: title => [title],
          compute: getValidOrFirstGenre
        })
      )
      await dataModel.waitUntilSettled()
      expect(dataModel.optionsRecords.size).toBe(3)
      data.books.splice(1, 2)
      await nextTick()
      await dataModel.waitUntilSettled()
      expect(dataModel.optionsRecords.size).toBe(1)
      dataModel.stop()
    })
  })

  describe('computed values with nested defaults', () => {
    it("doesn't modify the values that `compute()` returns", async () => {
      const emptyAddress = { street: '' }
      const schema = {
        type: 'form',
        components: {
          address: {
            type: 'object',
            compute: ({ value }) => value ?? emptyAddress,
            form: {
              type: 'form',
              components: {
                street: { type: 'text' },
                country: { type: 'text', default: 'Nowhere' }
              }
            }
          }
        }
      }
      const { dataModel, data } = createDataModel(schema, { address: null })
      await nextTick()
      expect(data.address).toEqual({ street: '', country: 'Nowhere' })
      expect(emptyAddress).toEqual({ street: '' })
      dataModel.stop()
    })

    it('only copies the items that miss defaults', async () => {
      const firstChapter = Object.freeze({ title: 'One', status: 'draft' })
      const secondChapter = Object.freeze({ title: 'Two' })
      const chapters = Object.freeze([firstChapter, secondChapter])
      const schema = {
        type: 'form',
        components: {
          chapters: {
            type: 'list',
            compute: ({ value }) => value ?? chapters,
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
      const { dataModel, data } = createDataModel(schema, { chapters: null })
      await nextTick()
      expect(data.chapters).toEqual([
        { title: 'One', status: 'draft' },
        { title: 'Two', status: 'draft' }
      ])
      expect(toRaw(data.chapters[0])).toBe(firstChapter)
      expect(secondChapter).toEqual({ title: 'Two' })
      dataModel.stop()
    })

    it(`doesn't modify items that occur more than once`, async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const emptyChapter = Object.freeze({ title: '' })
      const schema = {
        type: 'form',
        components: {
          chapters: {
            type: 'list',
            compute: ({ value }) => value ?? [emptyChapter, emptyChapter],
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
      const { dataModel, data } = createDataModel(schema, { chapters: null })
      await nextTick()
      expect(data.chapters).toEqual([
        { title: '', status: 'draft' },
        { title: '', status: 'draft' }
      ])
      // Each occurrence is copied, so editing one doesn't change the other:
      expect(toRaw(data.chapters[0])).not.toBe(toRaw(data.chapters[1]))
      expect(emptyChapter).toEqual({ title: '' })
      expect(error).not.toHaveBeenCalled()
      error.mockRestore()
      dataModel.stop()
    })
  })

  describe('waitUntilSettled()', () => {
    it('stops waiting for loads that never finish', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const schema = {
        type: 'form',
        components: {
          preview: {
            type: 'computed',
            data: () => () => new Promise(() => {})
          }
        }
      }
      const { dataModel } = createDataModel(schema, {})
      await nextTick()
      expect(dataModel.hasPendingLoads).toBe(true)
      await dataModel.waitUntilSettled({ timeout: 10 })
      expect(warn).toHaveBeenCalledTimes(1)
      expect(dataModel.hasPendingLoads).toBe(true)
      warn.mockRestore()
      dataModel.stop()
    })

    it('waits for loads that finish in time', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const schema = {
        type: 'form',
        components: {
          preview: {
            type: 'computed',
            data: () => () =>
              new Promise(resolve => setTimeout(() => resolve('Loaded'), 10))
          }
        }
      }
      const { dataModel, data } = createDataModel(schema, {})
      await nextTick()
      await dataModel.waitUntilSettled({ timeout: 1000 })
      expect(data.preview).toBe('Loaded')
      expect(warn).not.toHaveBeenCalled()
      warn.mockRestore()
      dataModel.stop()
    })
  })

  describe('edge cases', () => {
    const getSourceSchema = () => ({ type: 'list' })

    it('works for components without data and component paths', () => {
      const schema = {
        type: 'form',
        components: { title: { type: 'text' }, slug }
      }
      const data = reactive({ title: 'Hello World' })
      const dataModel = new DataModel({
        component: {},
        getSchema: () => schema,
        getData: () => data
      })
      expect(data.slug).toBe('hello-world')
      expect(dataModel.hasComputedValueEntry('slug')).toBe(true)
      dataModel.stop()
    })

    it('handles missing data and empty schemas', async () => {
      const schema = {
        type: 'form',
        components: { title: { type: 'text', default: 'Untitled' } }
      }
      const dataRef = ref(null)
      const dataModel = new DataModel({
        component: {},
        getSchema: () => schema,
        getData: () => dataRef.value,
        getSourceSchema
      })
      await nextTick()
      expect(dataModel.isDirty).toBe(false)
      expect(dataModel.getProcessedDataForDirtyCheck()).toBe(null)
      dataModel.stop()
    })

    it('sets defaults that depend on the context of added items', async () => {
      // E.g. books that are added to an author inherit the author's language:
      const schema = {
        type: 'form',
        components: {
          authors: {
            type: 'list',
            form: {
              type: 'form',
              components: {
                language: { type: 'text' },
                books: {
                  type: 'list',
                  form: {
                    type: 'form',
                    components: {
                      title: { type: 'text' },
                      language: {
                        type: 'text',
                        default: ({ parentItem }) => parentItem.language
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
      const { dataModel, data } = createDataModel(schema, {
        authors: [{ language: 'fr', books: [] }]
      })
      data.authors[0].books.push({ title: 'Premier' })
      await nextTick()
      expect(data.authors[0].books[0].language).toBe('fr')
      dataModel.stop()
    })

    it(`doesn't take snapshots once the model is stopped`, async () => {
      let resolveLoad
      const schema = {
        type: 'form',
        components: {
          preview: {
            type: 'computed',
            data: () => () => new Promise(resolve => (resolveLoad = resolve))
          }
        }
      }
      const { dataModel } = createDataModel(
        schema,
        {},
        { getSourceSchema }
      )
      await nextTick()
      expect(dataModel.hasPendingLoads).toBe(true)
      const snapshot = dataModel.processedDataSnapshot.value
      dataModel.stop()
      resolveLoad('Loaded')
      await nextTick()
      await nextTick()
      expect(dataModel.processedDataSnapshot.value).toBe(snapshot)
    })

    it('takes the snapshot of data replaced while settling', async () => {
      const loads = []
      const schema = {
        type: 'form',
        components: {
          title: { type: 'text' },
          preview: {
            type: 'computed',
            data: ({ item }) => {
              const { title } = item
              return () =>
                new Promise(resolve => loads.push(() => resolve(title)))
            }
          }
        }
      }
      const { dataModel, dataRef } = createDataModel(
        schema,
        { title: 'First' },
        { getSourceSchema }
      )
      await nextTick()
      dataRef.value = reactive({ title: 'Second' })
      await nextTick()
      for (const load of loads) load()
      await dataModel.waitUntilSettled()
      await nextTick()
      expect(dataRef.value.preview).toBe('Second')
      expect(dataModel.isDirty).toBe(false)
      dataRef.value.title = 'Changed'
      expect(dataModel.isDirty).toBe(true)
      dataModel.stop()
    })

    it('counts items removed or added while settling as changes', async () => {
      const loads = []
      const schema = {
        type: 'form',
        components: {
          books: {
            type: 'list',
            form: {
              type: 'form',
              components: {
                title: { type: 'text' },
                summary: {
                  type: 'computed',
                  data: ({ item }) => {
                    const { title } = item
                    return () =>
                      new Promise(resolve =>
                        loads.push(() => resolve(`About ${title}`))
                      )
                  }
                }
              }
            }
          }
        }
      }
      const { dataModel, data } = createDataModel(
        schema,
        { books: [{ title: 'One' }, { title: 'Two' }] },
        { getSourceSchema }
      )
      await nextTick()
      // The user removes the second book, and adds a third one:
      data.books.splice(1, 1)
      data.books.push({ title: 'Three' })
      await nextTick()
      while (loads.length > 0) {
        loads.shift()()
        await nextTick()
      }
      await dataModel.waitUntilSettled()
      await nextTick()
      expect(data.books.map(book => book.summary)).toEqual([
        'About One',
        'About Three'
      ])
      expect(dataModel.isDirty).toBe(true)
      dataModel.stop()
    })

    describe('applyCleanChanges()', () => {
      const schema = {
        type: 'form',
        components: {
          settings: { type: 'text' },
          chapters: {
            type: 'list',
            form: { type: 'form', components: { title: { type: 'text' } } }
          }
        }
      }

      it('only makes the changes without dirty tracking', async () => {
        const { dataModel, data } = createDataModel(schema, { chapters: [] })
        await dataModel.applyCleanChanges(() => {
          data.settings = { color: 'red' }
        })
        expect(data.settings).toEqual({ color: 'red' })
        expect(dataModel.isDirty).toBe(false)
        dataModel.stop()
      })

      it('takes over clean changes of array entries only', async () => {
        const { dataModel, data } = createDataModel(
          schema,
          { chapters: [{ title: 'One' }, { title: 'Two' }] },
          { getSourceSchema }
        )
        await nextTick()
        await dataModel.waitUntilSettled()
        await nextTick()
        data.chapters[1].title = 'Edited'
        await dataModel.applyCleanChanges(() => {
          data.chapters[0].title = 'Saved'
        })
        expect(dataModel.isDirty).toBe(true)
        data.chapters[1].title = 'Two'
        expect(dataModel.isDirty).toBe(false)
        dataModel.stop()
      })

      it('keeps the defaults of items added by clean changes clean', async () => {
        const { dataModel, data } = createDataModel(
          {
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
          },
          { chapters: [] },
          { getSourceSchema }
        )
        await nextTick()
        await dataModel.waitUntilSettled()
        await nextTick()
        await dataModel.applyCleanChanges(() => {
          data.chapters.push({ title: 'One' })
        })
        expect(data.chapters[0].status).toBe('draft')
        expect(dataModel.isDirty).toBe(false)
        dataModel.stop()
      })

      it('takes over clean removals of nested values', async () => {
        const { dataModel, data } = createDataModel(
          schema,
          { settings: { color: 'red', size: 2 }, chapters: [] },
          { getSourceSchema }
        )
        await nextTick()
        await dataModel.waitUntilSettled()
        await nextTick()
        await dataModel.applyCleanChanges(() => {
          delete data.settings.size
        })
        expect(dataModel.isDirty).toBe(false)
        dataModel.stop()
      })

      it(`doesn't apply to data replaced in the meantime`, async () => {
        const { dataModel, dataRef, data } = createDataModel(
          schema,
          { settings: null, chapters: [] },
          { getSourceSchema }
        )
        await nextTick()
        await dataModel.waitUntilSettled()
        await nextTick()
        const applying = dataModel.applyCleanChanges(() => {
          data.settings = 'saved'
        })
        dataRef.value = reactive({ settings: 'other', chapters: [] })
        await applying
        await nextTick()
        await dataModel.waitUntilSettled()
        await nextTick()
        expect(dataModel.isDirty).toBe(false)
        dataRef.value.settings = 'saved'
        expect(dataModel.isDirty).toBe(true)
        dataModel.stop()
      })
    })
  })
})
