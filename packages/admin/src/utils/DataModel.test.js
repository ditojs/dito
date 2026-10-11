import { vi } from 'vitest'
import { reactive, ref, toRaw, nextTick } from 'vue'
import { registerTypeComponent } from './schema/types.js'
import { DataModel } from './DataModel.js'

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

function createDataModel(schema, data, options) {
  const dataRef = ref(reactive(data))
  const dataModel = new DataModel({
    component: { dataPath: '', componentPath: '' },
    getSchema: () => schema,
    getData: () => dataRef.value,
    ...options
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
    const schema = {
      type: 'form',
      components: {
        title: { type: 'text' },
        slug,
        chapters: {
          type: 'list',
          orderKey: 'position',
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

    function createBookModel() {
      return createDataModel(schema, {
        title: 'Emma',
        chapters: [{ title: 'One' }, { title: 'Two' }, { title: 'Three' }]
      })
    }

    const getTitles = list => list.map(({ title }) => title)
    const getPositions = list => list.map(({ position }) => position)

    it(`isn't dirty after the data is set up`, async () => {
      const { dataModel, data } = createBookModel()
      await nextTick()
      // Defaults, computed values and order keys are the model's own writes:
      expect(data.slug).toBe('emma')
      expect(data.chapters[0].status).toBe('draft')
      expect(getPositions(data.chapters)).toEqual([0, 1, 2])
      expect(dataModel.isDirty).toBe(false)
      dataModel.stop()
    })

    it('is dirty after `set()`, also when reverted', async () => {
      const { dataModel, data } = createBookModel()
      dataModel.set(data, 'title', 'Persuasion')
      expect(data.title).toBe('Persuasion')
      expect(dataModel.isDirty).toBe(true)
      dataModel.set(data, 'title', 'Emma')
      expect(dataModel.isDirty).toBe(true)
      dataModel.stop()
    })

    it(`isn't dirty after \`set()\` of the value that it has`, () => {
      const { dataModel, data } = createBookModel()
      dataModel.set(data, 'title', 'Emma')
      dataModel.set(
        data,
        'chapters',
        data.chapters.map(chapter => ({
          ...chapter
        }))
      )
      expect(dataModel.isDirty).toBe(false)
      dataModel.stop()
    })

    it(`is only dirty if the component can save, but edited anyway`, () => {
      const { dataModel, data } = createDataModel(
        schema,
        { title: 'Emma', chapters: [] },
        { canSave: () => false }
      )
      dataModel.set(data, 'title', 'Persuasion')
      expect(dataModel.isDirty).toBe(false)
      expect(dataModel.isEdited).toBe(true)
      dataModel.markClean()
      expect(dataModel.isEdited).toBe(false)
      dataModel.stop()
    })

    it('is dirty after `set()` of nested values', () => {
      const { dataModel, data } = createBookModel()
      dataModel.set(data.chapters[1], 'title', 'Second')
      expect(data.chapters[1].title).toBe('Second')
      expect(dataModel.isDirty).toBe(true)
      dataModel.stop()
    })

    it('inserts items and numbers the list by its order key', async () => {
      const { dataModel, data } = createBookModel()
      dataModel.insert(data.chapters, 1, { title: 'Prologue' })
      expect(getTitles(data.chapters)).toEqual([
        'One',
        'Prologue',
        'Two',
        'Three'
      ])
      expect(getPositions(data.chapters)).toEqual([0, 1, 2, 3])
      expect(dataModel.isDirty).toBe(true)
      await nextTick()
      // Inserted items get their defaults:
      expect(data.chapters[1].status).toBe('draft')
      dataModel.stop()
    })

    it('removes items and numbers the list by its order key', () => {
      const { dataModel, data } = createBookModel()
      dataModel.remove(data.chapters, 0)
      expect(getTitles(data.chapters)).toEqual(['Two', 'Three'])
      expect(getPositions(data.chapters)).toEqual([0, 1])
      expect(dataModel.isDirty).toBe(true)
      dataModel.stop()
    })

    it('moves items and numbers the list by its order key', () => {
      const { dataModel, data } = createBookModel()
      const list = data.chapters
      dataModel.move(list, 0, 2)
      expect(data.chapters).toBe(list)
      expect(getTitles(list)).toEqual(['Two', 'Three', 'One'])
      expect(getPositions(list)).toEqual([0, 1, 2])
      expect(dataModel.isDirty).toBe(true)
      dataModel.stop()
    })

    it('replaces the children of lists in place', () => {
      const { dataModel, data } = createBookModel()
      const list = data.chapters
      dataModel.replaceChildren(list, [list[2], list[0]])
      expect(data.chapters).toBe(list)
      expect(getTitles(list)).toEqual(['Three', 'One'])
      expect(getPositions(list)).toEqual([0, 1])
      expect(dataModel.isDirty).toBe(true)
      dataModel.stop()
    })

    it('keeps the offset of the order of lists loaded from later pages', () => {
      // E.g. the second page of a list with its own resource, which the model
      // doesn't walk otherwise, see `SourceMixin.setLoadedListItems()`:
      const { dataModel, data } = createDataModel(
        {
          type: 'form',
          components: {
            books: {
              type: 'list',
              resource: { path: 'books' },
              orderKey: 'position',
              columns: { title: {} }
            }
          }
        },
        {
          books: [
            { title: 'Emma', position: 10 },
            { title: 'Persuasion', position: 11 }
          ]
        }
      )
      dataModel.move(data.books, 1, 0)
      expect(data.books).toEqual([
        { title: 'Persuasion', position: 10 },
        { title: 'Emma', position: 11 }
      ])
      dataModel.stop()
    })

    it('marks the lists of sources with their own resource dirty per source', () => {
      const { dataModel, data } = createDataModel(
        {
          type: 'form',
          components: {
            title: { type: 'text' },
            books: {
              type: 'list',
              resource: { path: 'books' },
              columns: { title: {} },
              // The source can save, by a submit button of any name:
              buttons: { saveOrder: { type: 'submit' } }
            }
          }
        },
        { title: 'Emma', books: [{ title: 'A' }, { title: 'B' }] }
      )
      dataModel.set(data, 'title', 'Persuasion')
      dataModel.move(data.books, 1, 0)
      // The source saves its list, which leaves the other changes dirty:
      dataModel.markClean(data, 'books')
      expect(dataModel.isDirty).toBe(true)
      dataModel.move(data.books, 1, 0)
      dataModel.markClean()
      expect(dataModel.isDirty).toBe(false)
      dataModel.move(data.books, 1, 0)
      expect(dataModel.isDirty).toBe(true)
      dataModel.stop()
    })

    it(`leaves the lists of sources that can't save clean`, () => {
      // E.g. lists whose order the app saves in `onChange()`:
      const { dataModel, data } = createDataModel(
        {
          type: 'form',
          components: {
            books: {
              type: 'list',
              resource: { path: 'books' },
              columns: { title: {} }
            }
          }
        },
        { books: [{ title: 'A' }, { title: 'B' }] }
      )
      dataModel.move(data.books, 1, 0)
      expect(getTitles(data.books)).toEqual(['B', 'A'])
      expect(dataModel.isEdited).toBe(false)
      dataModel.stop()
    })

    it('marks changes inside sources with their own resource for them', () => {
      // E.g. the children of the items of a tree with a resource:
      const { dataModel, data } = createDataModel(
        {
          type: 'form',
          components: {
            books: {
              type: 'list',
              resource: { path: 'books' },
              buttons: { submit: { type: 'submit' } },
              form: {
                type: 'form',
                components: {
                  chapters: {
                    type: 'list',
                    form: { type: 'form', components: {} }
                  }
                }
              }
            }
          }
        },
        { books: [{ chapters: [{ title: 'A' }, { title: 'B' }] }] }
      )
      dataModel.move(data.books[0].chapters, 1, 0)
      expect(dataModel.isDirty).toBe(true)
      dataModel.markClean(data, 'books')
      expect(dataModel.isEdited).toBe(false)
      dataModel.stop()
    })

    it(`isn't dirty after direct writes until \`markDirty()\``, async () => {
      const { dataModel, data } = createBookModel()
      data.title = 'Persuasion'
      data.chapters.push({ title: 'Four' })
      await nextTick()
      expect(data.slug).toBe('persuasion')
      expect(dataModel.isDirty).toBe(false)
      dataModel.markDirty()
      expect(dataModel.isDirty).toBe(true)
      dataModel.stop()
    })

    it(`isn't dirty after \`markClean()\`, e.g. once saved`, () => {
      const { dataModel, data } = createBookModel()
      dataModel.set(data, 'title', 'Persuasion')
      dataModel.markClean()
      expect(dataModel.isDirty).toBe(false)
      dataModel.stop()
    })

    it(`isn't dirty once the data is replaced`, async () => {
      const { dataModel, dataRef, data } = createBookModel()
      dataModel.set(data, 'title', 'Persuasion')
      dataRef.value = reactive({ title: 'Saved', chapters: [] })
      expect(dataModel.isDirty).toBe(false)
      await nextTick()
      expect(dataRef.value.slug).toBe('saved')
      expect(dataModel.isDirty).toBe(false)
      dataModel.stop()
    })

    it('stays clean while it writes values derived after loads', async () => {
      // `size` selects its first option once the options are loaded, which is
      // the model's own write, while the edit of `title` marks it dirty.
      let resolveOptions
      const { dataModel, data } = createDataModel(
        {
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
        },
        { title: 'Hello' }
      )
      await nextTick()
      resolveOptions([{ id: 1 }, { id: 2 }])
      await dataModel.waitUntilSettled()
      await nextTick()
      expect(data.size).toBe(1)
      expect(dataModel.isDirty).toBe(false)
      dataModel.set(data, 'title', 'Changed')
      expect(dataModel.isDirty).toBe(true)
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

    const countOptionsResolvers = dataModel =>
      [...dataModel.componentRecords.values()].filter(
        record => record.optionsResolver
      ).length

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

    it(`doesn't load the options of items that moved again`, async () => {
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
    })

    it(`doesn't recompute the values of items that moved`, async () => {
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

    it('recomputes the values of items that moved if they read their position', async () => {
      const compute = vi.fn(({ itemIndex }) => itemIndex + 1)
      const { dataModel, data } = createDataModel(
        {
          type: 'form',
          components: {
            books: {
              type: 'list',
              form: {
                type: 'form',
                components: {
                  title: { type: 'text' },
                  position: { type: 'text', compute },
                  path: { type: 'text', compute: ({ dataPath }) => dataPath }
                }
              }
            }
          }
        },
        { books: [{ title: 'One' }, { title: 'Two' }, { title: 'Three' }] }
      )
      await dataModel.waitUntilSettled()
      compute.mockClear()
      data.books.reverse()
      await nextTick()
      await dataModel.waitUntilSettled()
      expect(
        data.books.map(({ title, position, path }) => [title, position, path])
      ).toEqual([
        ['Three', 1, 'books/0/path'],
        ['Two', 2, 'books/1/path'],
        ['One', 3, 'books/2/path']
      ])
      // 'Two' stays in its place, so only the other two are computed again.
      expect(compute).toHaveBeenCalledTimes(2)
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
      expect(countOptionsResolvers(dataModel)).toBe(3)
      data.books.splice(1, 2)
      await nextTick()
      await dataModel.waitUntilSettled()
      expect(countOptionsResolvers(dataModel)).toBe(1)
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

    it(`waits for loads that can't time out beyond the timeout`, async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { dataModel } = createDataModel({ type: 'form' }, {})
      // E.g. uploads, which take as long as their files need:
      let isUploaded = false
      dataModel.trackPendingLoad(
        new Promise(resolve =>
          setTimeout(() => {
            isUploaded = true
            resolve()
          }, 30)
        ),
        { canTimeOut: false }
      )
      await dataModel.waitUntilSettled({ timeout: 10 })
      expect(isUploaded).toBe(true)
      expect(dataModel.hasPendingLoads).toBe(false)
      expect(warn).not.toHaveBeenCalled()
      warn.mockRestore()
      dataModel.stop()
    })
  })

  describe('edge cases', () => {
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
      dataModel.stop()
    })

    it('handles missing data and empty schemas', async () => {
      const dataRef = ref(null)
      const dataModel = new DataModel({
        component: {},
        getSchema: () => ({ type: 'form' }),
        getData: () => dataRef.value
      })
      await nextTick()
      expect(dataModel.isDirty).toBe(false)
      dataRef.value = reactive({ items: [{ id: 1 }, { id: 2 }] })
      dataModel.move(dataRef.value.items, 0, 1)
      expect(dataRef.value.items).toEqual([{ id: 2 }, { id: 1 }])
      expect(dataModel.isDirty).toBe(true)
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
  })

  describe('rare paths', () => {
    it(`asks the type with the item's context whether values are missing`, async () => {
      // Like types whose values may be left out, decided per item:
      const ignoreMissingValue = vi.fn(({ item }) => !!item.isDraft)
      registerTypeComponent('note', {
        defaultNested: true,
        ignoreMissingValue
      })
      const schema = {
        type: 'form',
        components: {
          chapters: {
            type: 'list',
            form: {
              type: 'form',
              components: { note: { type: 'note', default: 'None' } }
            }
          }
        }
      }
      const { dataModel, data } = createDataModel(schema, { chapters: [] })
      data.chapters.push({ isDraft: true }, { isDraft: false })
      await nextTick()
      expect(data.chapters).toEqual([
        { isDraft: true },
        { isDraft: false, note: 'None' }
      ])
      expect(ignoreMissingValue).toHaveBeenCalledWith(
        expect.objectContaining({ dataPath: 'chapters/0/note' })
      )
      dataModel.stop()
    })

    it('sets defaults only once for components shown in several tabs', async () => {
      const getDefault = vi.fn(() => 'Untitled')
      const title = { type: 'text', default: getDefault }
      const schema = {
        type: 'form',
        tabs: {
          main: { type: 'tab', components: { title } },
          preview: { type: 'tab', components: { title } }
        }
      }
      const { dataModel, data } = createDataModel(schema, { title: 'Emma' })
      expect(getDefault).not.toHaveBeenCalled()
      delete data.title
      await nextTick()
      expect(data.title).toBe('Untitled')
      expect(getDefault).toHaveBeenCalledOnce()
      dataModel.stop()
    })

    it('replaces the computes of components whose schema changed', async () => {
      const lower = vi.fn(({ item }) => item.title.toLowerCase())
      const upper = vi.fn(({ item }) => item.title.toUpperCase())
      const createSchema = compute => ({
        type: 'form',
        components: {
          title: { type: 'text' },
          label: { type: 'text', compute }
        }
      })
      const schemaRef = ref(createSchema(lower))
      const data = reactive({ title: 'Emma' })
      const dataModel = new DataModel({
        component: {},
        getSchema: () => schemaRef.value,
        getData: () => data
      })
      expect(data.label).toBe('emma')
      schemaRef.value = createSchema(upper)
      await nextTick()
      expect(data.label).toBe('EMMA')
      lower.mockClear()
      data.title = 'Persuasion'
      await nextTick()
      expect(data.label).toBe('PERSUASION')
      expect(lower).not.toHaveBeenCalled()
      dataModel.stop()
    })

    it('resolves the options of components that it does not visit', async () => {
      // E.g. components that read their options before the walk visits them:
      const loadGenres = vi.fn(async () => ['novel', 'poetry'])
      const genre = {
        type: 'select',
        if: false,
        options: { data: loadGenres }
      }
      const schema = { type: 'form', components: { genre } }
      const { dataModel, data } = createDataModel(schema, {})
      const entry = {
        schema: genre,
        data,
        name: 'genre',
        dataPath: 'genre',
        componentPath: 'genre'
      }
      expect(dataModel.getOptions(entry)).toBe(undefined)
      await dataModel.waitUntilSettled()
      expect(dataModel.getOptions(entry)).toEqual(['novel', 'poetry'])
      expect(loadGenres).toHaveBeenCalledOnce()
      dataModel.stop()
    })

    it(`doesn't compute values of components that an earlier compute hid`, async () => {
      // Both computes depend on `title`, so their watchers run in the same
      // flush. The first one hides the second one, which then must not run.
      const summary = vi.fn(({ item }) => `About ${item.title}`)
      const schema = {
        type: 'form',
        components: {
          title: { type: 'text' },
          isShort: {
            type: 'text',
            compute: ({ item }) => item.title.length < 5
          },
          summary: {
            type: 'text',
            if: ({ item }) => !item.isShort,
            compute: summary
          }
        }
      }
      const { dataModel, data } = createDataModel(schema, {
        title: 'Persuasion'
      })
      expect(data.summary).toBe('About Persuasion')
      summary.mockClear()
      data.title = 'Emma'
      await nextTick()
      expect(data.isShort).toBe(true)
      expect(data.summary).toBe('About Persuasion')
      expect(summary).not.toHaveBeenCalled()
      dataModel.stop()
    })

    it('throws errors of `compute()` other than unloaded options', () => {
      // Unlike failing `if` conditions, failing computes aren't caught:
      const schema = {
        type: 'form',
        components: {
          title: {
            type: 'text',
            compute: () => {
              throw new Error('Broken compute')
            }
          }
        }
      }
      expect(() => createDataModel(schema, { title: 'Emma' })).toThrow(
        'Broken compute'
      )
    })

    it('stays dirty after changes while it settles', async () => {
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
                slug,
                summary: {
                  type: 'computed',
                  data: () => () => new Promise(resolve => loads.push(resolve))
                }
              }
            }
          }
        }
      }
      const { dataModel, data } = createDataModel(schema, {
        books: [{ title: 'One' }, { title: 'Two' }]
      })
      await nextTick()
      // The user removes the second book and adds a third one, while the
      // summaries are still loading:
      dataModel.remove(data.books, 1)
      dataModel.insert(data.books, 1, { title: 'Three' })
      await nextTick()
      while (loads.length > 0) {
        loads.shift()('Summary')
        await nextTick()
      }
      await dataModel.waitUntilSettled()
      await nextTick()
      expect(data.books).toMatchObject([
        { title: 'One', slug: 'one', summary: 'Summary' },
        { title: 'Three', slug: 'three', summary: 'Summary' }
      ])
      expect(dataModel.isDirty).toBe(true)
      dataModel.stop()
    })
  })
})
