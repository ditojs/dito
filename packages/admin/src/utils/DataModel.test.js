import { vi } from 'vitest'
import {
  computed,
  reactive,
  ref,
  toRaw,
  nextTick,
  watch
} from 'vue'
import { isPlainObject } from '@ditojs/utils'
import { defineType } from './schema/types.ts'
import { optionsTraits, sourceTraits } from '../types/traits.ts'
import { DataModel } from './DataModel.ts'
import { cloneWithUids } from './uid.js'

// `setupForm()` needs the admin's API, see `getFormSchemas()`:
vi.mock('./schema/setup.js', () => ({ setupForm: async form => form }))

// Define minimal types, as the actual type components can't be
// imported without a Vue SFC compiler:
defineType({ type: 'text' })
defineType({ ...optionsTraits, type: 'select' })
defineType({
  type: 'value',
  defaultValue: undefined,
  resolvesValue: true
})
defineType({ type: 'section', defaultNested: false })
defineType({ type: 'panel', defaultNested: false })
defineType({
  type: 'list',
  defaultValue: () => [],
  defaultExclude: sourceTraits.defaultExclude,
  sourceType: 'list'
})
defineType({ type: 'object', sourceType: 'object' })
defineType({ type: 'submit', submitsData: true })
// Like `DitoUploadType`, which leaves out files that aren't uploaded yet:
defineType({
  type: 'upload',
  serializeValue: ({ value }) => (value?.isUploaded ? value.name : null)
})

function createDataModel(schema, data, options) {
  const dataModel = new DataModel({
    schema: () => schema,
    data: reactive(data),
    // Most tests are about edits, which only count where they can be saved:
    canSave: () => true,
    ...options
  })
  // The entry of the list at `name` for the change API:
  const getListEntry = name => ({
    schema: schema.fields[name],
    list: dataModel.data[name],
    dataPath: name
  })
  return { dataModel, data: dataModel.data, getListEntry }
}

const slug = {
  type: 'value',
  computeValue: ({ item }) => item.title?.toLowerCase().replaceAll(' ', '-')
}

describe('DataModel', () => {
  it('sets the defaults of missing values when the data is set up', () => {
    const schema = {
      type: 'form',
      fields: {
        title: { type: 'text', default: 'Untitled' },
        tags: { type: 'list', form: { type: 'form', fields: {} } }
      }
    }
    const { dataModel, data } = createDataModel(schema, {
      tags: null
    })
    expect(data).toEqual({ title: 'Untitled', tags: null })
    dataModel.stop()
    dataModel.replace(reactive({}))
    expect(dataModel.data).toEqual({})
  })

  it('sets the defaults of values that go missing later', async () => {
    // E.g. items that code adds, in which the components edit the defaults.
    const schema = {
      type: 'form',
      fields: {
        chapters: {
          type: 'list',
          form: {
            type: 'form',
            fields: {
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

  it('replaces `null` with defaults only in loaded and added data', async () => {
    const schema = {
      type: 'form',
      properties: {
        count: { type: 'number', default: 5 },
        chapters: {
          type: 'array',
          items: {
            type: 'object',
            properties: { rank: { type: 'integer', default: 1 } }
          }
        }
      }
    }
    const { dataModel, data } = createDataModel(schema, {
      count: null,
      chapters: [{ rank: null }]
    })
    expect(data).toEqual({ count: 5, chapters: [{ rank: 1 }] })
    // Values that aren't `nullable` keep the `null` that is written later, e.g.
    // when the user clears them to type another value, as do lists:
    data.count = null
    data.chapters[0].rank = null
    data.chapters.push({})
    await nextTick()
    expect(data).toEqual({
      count: null,
      chapters: [{ rank: null }, { rank: 1 }]
    })
    data.chapters = null
    await nextTick()
    expect(data.chapters).toBe(null)
    dataModel.stop()
  })

  it('sets the defaults of replaced data', async () => {
    const schema = {
      type: 'form',
      fields: { title: { type: 'text', default: 'Untitled' } }
    }
    const { dataModel } = createDataModel(schema, {})
    dataModel.replace(reactive({}))
    await nextTick()
    expect(dataModel.data).toEqual({ title: 'Untitled' })
    dataModel.stop()
  })

  it('writes computed values and keeps them current', async () => {
    const schema = {
      type: 'form',
      fields: { title: { type: 'text' }, slug }
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

  it('writes the computed values of replaced data before edits', async () => {
    // A compute that keeps the first value it sees, like a price on order:
    const schema = {
      type: 'form',
      fields: {
        price: { type: 'text' },
        orderedPrice: {
          type: 'value',
          computeValue: ({ item }) => item.orderedPrice ?? item.price
        }
      }
    }
    const { dataModel } = createDataModel(schema, {})
    dataModel.replace(reactive({ price: 10 }))
    dataModel.data.price = 20
    await nextTick()
    expect(dataModel.data).toEqual({ price: 20, orderedPrice: 10 })
    dataModel.stop()
  })

  it('writes computed values of fields in tabs and unnested sections', () => {
    const schema = {
      type: 'form',
      fields: { title: { type: 'text' } },
      tabs: {
        meta: {
          type: 'tab',
          fields: {
            seo: { type: 'section', fields: { slug } }
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
      fields: {
        tags: { type: 'text', computeValue: ({ value }) => value ?? [] }
      }
    }
    const { dataModel, data } = createDataModel(schema, { tags: null })
    expect(data.tags).toEqual([])
    data.tags = null
    await nextTick()
    expect(data.tags).toEqual([])
    dataModel.stop()
  })

  it('keeps values that `computeValue()` returns `undefined` for', async () => {
    const schema = {
      type: 'form',
      fields: { title: { type: 'text', computeValue: () => undefined } }
    }
    const { dataModel, data } = createDataModel(schema, { title: 'Hello' })
    data.title = 'Changed'
    await nextTick()
    expect(data.title).toBe('Changed')
    dataModel.stop()
  })

  it('gives missing values that nothing computes their defaults', () => {
    const schema = {
      type: 'form',
      fields: {
        pricing: {
          type: 'text',
          default: 'auto',
          computeValue: ({ value, item }) => (
            value ?? (item.customFactor != null ? 'factor' : undefined)
          )
        }
      }
    }
    const { dataModel, data } = createDataModel(schema, {})
    expect(data).toEqual({ pricing: 'auto' })
    dataModel.stop()
  })

  it('writes the computed values of written properties', async () => {
    const schema = {
      type: 'form',
      properties: {
        title: { type: 'string' },
        slug: {
          type: 'string',
          computeValue: ({ item }) => item.title.toLowerCase()
        },
        rank: { type: 'integer', default: 1, computeValue: () => undefined }
      }
    }
    const { dataModel, data } = createDataModel(schema, { title: 'Hello' })
    expect(data).toEqual({ title: 'Hello', slug: 'hello', rank: 1 })
    data.title = 'World'
    await nextTick()
    expect(data.slug).toBe('world')
    dataModel.stop()
  })

  it('writes computed values that are new objects only once', async () => {
    const computeValue = vi.fn(({ value }) =>
      value.map(entry => ({ ...entry, upper: entry.name.toUpperCase() }))
    )
    const schema = {
      type: 'form',
      fields: { entries: { type: 'text', computeValue } }
    }
    const { dataModel, data } = createDataModel(schema, {
      entries: [{ name: 'One' }]
    })
    await nextTick()
    // Once initially, and once more after writing the new array, which is
    // equal and therefore not written again.
    expect(computeValue).toHaveBeenCalledTimes(2)
    expect(data.entries).toEqual([{ name: 'One', upper: 'ONE' }])
    dataModel.stop()
  })

  it('keeps computed values that are new but equal arrays', async () => {
    const computeValue = vi.fn(({ item }) =>
      item.authors.map(author => author.name.toUpperCase())
    )
    const schema = {
      type: 'form',
      fields: { names: { type: 'value', computeValue } }
    }
    const { dataModel, data } = createDataModel(schema, {
      authors: [{ name: 'Jane' }]
    })
    await nextTick()
    const { names } = data
    const onChange = vi.fn()
    watch(() => data.names, onChange, { deep: true, flush: 'sync' })
    data.authors[0].name = 'JANE'
    await nextTick()
    expect(computeValue).toHaveBeenCalledTimes(2)
    expect(data.names).toBe(names)
    expect(onChange).not.toHaveBeenCalled()
    expect(dataModel.isEdited).toBe(false)
    dataModel.stop()
  })

  it('converts stored values that are no objects to the objects of forms', () => {
    // E.g. sizes that are stored as numbers, and edited as value and unit.
    const schema = {
      type: 'form',
      fields: {
        padding: {
          type: 'object',
          computeValue: ({ value }) =>
            typeof value === 'number' ? { value, units: 'rem' } : value,
          form: {
            type: 'form',
            fields: {
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
    // The defaults of the computed items don't make `computeValue()` disagree
    // with them, which would replace them in an endless loop.
    const computeValue = ({ value, item }) =>
      item.sounds.map(name => ({
        name,
        steps: value?.find(track => track.name === name)?.steps ?? []
      }))
    const schema = {
      type: 'form',
      fields: {
        tracks: {
          type: 'list',
          computeValue,
          form: {
            type: 'form',
            fields: {
              name: { type: 'text' },
              volume: { type: 'text', default: 0 },
              // Buttons have no value, and don't get a key in the items:
              play: { type: 'value' }
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
      fields: {
        count: {
          type: 'text',
          computeValue: ({ item }) => (item.other ?? 0) + 1
        },
        other: {
          type: 'text',
          computeValue: ({ item }) => (item.count ?? 0) + 1
        }
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

  it("doesn't recompute values whose `computeValue()` doesn't read them", async () => {
    // E.g. access tokens, which are random for each call.
    let callCount = 0
    const schema = {
      type: 'form',
      fields: {
        title: { type: 'text' },
        token: {
          type: 'text',
          computeValue: ({ item }) => `${item.title}-${++callCount}`
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
      fields: {
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
      fields: {
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
      fields: {
        chapters: {
          type: 'list',
          form: {
            type: 'form',
            fields: { title: { type: 'text' }, slug }
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
      fields: {
        chapters: {
          type: 'list',
          resource: 'chapters',
          form: { type: 'form', fields: { title: { type: 'text' }, slug } }
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
      fields: {
        title: { type: 'text' },
        chapters: {
          type: 'list',
          resource: 'chapters',
          form: { type: 'form', fields: { title: { type: 'text' }, slug } },
          panels: {
            info: { type: 'panel', fields: { slug } }
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

  describe('components created by `fields()` callbacks', () => {
    // E.g. fields that depend on the selected template.
    const getSchema = createComponents => ({
      type: 'form',
      fields: {
        fields: { type: 'list', defaultValue: () => [] },
        values: {
          type: 'section',
          nested: true,
          fields: createComponents
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
        upper: {
          type: 'value',
          computeValue: () => item.title.toUpperCase()
        }
      }))
      schema.fields.title = { type: 'text' }
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
      schema.fields.title = { type: 'text' }
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
      fields: {
        title: { type: 'text' },
        upper: {
          type: 'value',
          data: ({ item }) => item.title.toUpperCase()
        },
        copy: { type: 'value', dataPath: 'title' },
        length: {
          type: 'value',
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
      fields: {
        title: { type: 'text' },
        loaded: {
          type: 'value',
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
    // Keeps valid values, and selects the first option otherwise.
    // `computeValue()` only runs once the options that it reads are loaded.
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
      fields: {
        category: {
          type: 'select',
          options: {
            data: async () => [{ value: 'news' }, { value: 'sports' }]
          },
          computeValue: getValidOrFirstOption
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
          computeValue: getValidOrFirstOption
        }
      }
    })

    it('keeps values until the options that `computeValue()` reads load', async () => {
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
        fields: {
          size: {
            type: 'select',
            options: { data: async () => [{ id: 1 }, { id: 2 }] },
            computeValue: ({ value, options }) => value ?? options?.[0]
          }
        }
      }
      const { dataModel, data } = createDataModel(schema, {})
      await dataModel.waitUntilSettled()
      const options = dataModel.getOptionsResolver({
        schema: schema.fields.size,
        data,
        name: 'size',
        dataPath: 'size',
        componentPath: 'size'
      }).value
      expect(options).toEqual([{ id: 1 }, { id: 2 }])
      expect(toRaw(data.size)).toBe(options[0])
      dataModel.stop()
    })

    it(`doesn't load options that aren't read`, async () => {
      const data = vi.fn(async () => [{ value: 'news' }])
      const schema = {
        type: 'form',
        fields: {
          category: { type: 'select', options: { data } }
        }
      }
      const { dataModel } = createDataModel(schema, {})
      await dataModel.waitUntilSettled()
      expect(data).not.toHaveBeenCalled()
      dataModel.stop()
    })

    // `computeValue()` sees options that fail to load as `undefined`:
    it('computes values when options fail to load', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const schema = {
        type: 'form',
        fields: {
          genre: {
            type: 'select',
            options: {
              data: async () => {
                throw new Error('Unavailable')
              }
            },
            computeValue: ({ value, options }) => (
              value ?? options?.[0] ?? 'none'
            )
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
        fields: {
          genre: {
            type: 'select',
            options: { dataPath: 'genres' },
            computeValue: ({ value, options }) => (
              value ?? options?.[0] ?? 'none'
            )
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
        fields: {
          genres: { type: 'text' },
          genre: {
            type: 'select',
            options: { dataPath: 'genres' },
            computeValue: ({ value, options }) =>
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
      fields: {
        title: { type: 'text' },
        slug,
        chapters: {
          type: 'list',
          orderKey: 'position',
          form: {
            type: 'form',
            fields: {
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
      dataModel.set({ data, name: 'title', dataPath: 'title' }, 'Persuasion')
      expect(data.title).toBe('Persuasion')
      expect(dataModel.isDirty).toBe(true)
      dataModel.set({ data, name: 'title', dataPath: 'title' }, 'Emma')
      expect(dataModel.isDirty).toBe(true)
      dataModel.stop()
    })

    it(`isn't dirty after \`set()\` of the value that it has`, () => {
      const { dataModel, data } = createBookModel()
      const { chapters } = data
      dataModel.set({ data, name: 'title', dataPath: 'title' }, 'Emma')
      dataModel.set(
        { data, name: 'chapters', dataPath: 'chapters' },
        chapters.map(chapter => ({
          ...chapter
        }))
      )
      expect(dataModel.isDirty).toBe(false)
      // Equal values aren't written, so the data keeps its objects:
      expect(data.chapters).toBe(chapters)
      dataModel.stop()
    })

    it(`is only dirty if the component can save, but edited anyway`, () => {
      const { dataModel, data } = createDataModel(
        schema,
        { title: 'Emma', chapters: [] },
        { canSave: () => false }
      )
      dataModel.set({ data, name: 'title', dataPath: 'title' }, 'Persuasion')
      expect(dataModel.isDirty).toBe(false)
      expect(dataModel.isEdited).toBe(true)
      dataModel.markClean()
      expect(dataModel.isEdited).toBe(false)
      dataModel.stop()
    })

    it('is only dirty with a submit button, by default', () => {
      const createModel = buttons =>
        new DataModel({
          schema: () => ({ ...schema, buttons }),
          data: reactive({ title: 'Emma', chapters: [] })
        })
      const [unsavable, savable] = [
        createModel({ apply: { type: 'button' } }),
        createModel({ save: { type: 'submit' } })
      ]
      for (const dataModel of [unsavable, savable]) {
        dataModel.set(
          { data: dataModel.data, name: 'title', dataPath: 'title' },
          'Persuasion'
        )
        expect(dataModel.isEdited).toBe(true)
        dataModel.stop()
      }
      expect(unsavable.isDirty).toBe(false)
      expect(savable.isDirty).toBe(true)
    })

    it('is dirty after `set()` of nested values', () => {
      const { dataModel, data } = createBookModel()
      dataModel.set(
        { data: data.chapters[1], name: 'title', dataPath: 'chapters/1/title' },
        'Second'
      )
      expect(data.chapters[1].title).toBe('Second')
      expect(dataModel.isDirty).toBe(true)
      dataModel.stop()
    })

    it('inserts items and numbers the list by its order key', async () => {
      const { dataModel, data, getListEntry } = createBookModel()
      dataModel.insert(getListEntry('chapters'), 1, { title: 'Prologue' })
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
      const { dataModel, data, getListEntry } = createBookModel()
      dataModel.remove(getListEntry('chapters'), 0)
      expect(getTitles(data.chapters)).toEqual(['Two', 'Three'])
      expect(getPositions(data.chapters)).toEqual([0, 1])
      expect(dataModel.isDirty).toBe(true)
      dataModel.stop()
    })

    it('moves items and numbers the list by its order key', () => {
      const { dataModel, data, getListEntry } = createBookModel()
      const list = data.chapters
      dataModel.move(getListEntry('chapters'), 0, 2)
      expect(data.chapters).toBe(list)
      expect(getTitles(list)).toEqual(['Two', 'Three', 'One'])
      expect(getPositions(list)).toEqual([0, 1, 2])
      expect(dataModel.isDirty).toBe(true)
      dataModel.stop()
    })

    it('replaces the children of lists in place', () => {
      const { dataModel, data, getListEntry } = createBookModel()
      const list = data.chapters
      dataModel.replaceItems(getListEntry('chapters'), [list[2], list[0]])
      expect(data.chapters).toBe(list)
      expect(getTitles(list)).toEqual(['Three', 'One'])
      expect(getPositions(list)).toEqual([0, 1])
      expect(dataModel.isDirty).toBe(true)
      dataModel.stop()
    })

    it('keeps the offset of the order of lists loaded from later pages', () => {
      // E.g. the second page of a list with its own resource, which the model
      // doesn't walk otherwise, see `useSourceData()`:
      const { dataModel, data, getListEntry } = createDataModel(
        {
          type: 'form',
          fields: {
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
      dataModel.move(getListEntry('books'), 1, 0)
      expect(data.books).toEqual([
        { title: 'Persuasion', position: 10 },
        { title: 'Emma', position: 11 }
      ])
      dataModel.stop()
    })

    it('marks the lists of sources with their own resource dirty per source', () => {
      const { dataModel, data, getListEntry } = createDataModel(
        {
          type: 'form',
          fields: {
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
      dataModel.set({ data, name: 'title', dataPath: 'title' }, 'Persuasion')
      dataModel.move(getListEntry('books'), 1, 0)
      // The source saves its list, which leaves the other changes dirty:
      dataModel.markClean({ dataPath: 'books' })
      expect(dataModel.isDirty).toBe(true)
      dataModel.move(getListEntry('books'), 1, 0)
      dataModel.markClean()
      expect(dataModel.isDirty).toBe(false)
      dataModel.move(getListEntry('books'), 1, 0)
      expect(dataModel.isDirty).toBe(true)
      dataModel.stop()
    })

    it(`marks the lists of sources that can't save edited only`, () => {
      // E.g. lists whose order the app saves in `onChange()`:
      const { dataModel, data, getListEntry } = createDataModel(
        {
          type: 'form',
          fields: {
            books: {
              type: 'list',
              resource: { path: 'books' },
              columns: { title: {} }
            }
          }
        },
        { books: [{ title: 'A' }, { title: 'B' }] }
      )
      dataModel.move(getListEntry('books'), 1, 0)
      expect(getTitles(data.books)).toEqual(['B', 'A'])
      expect(dataModel.isEdited).toBe(true)
      expect(dataModel.isDirty).toBe(false)
      dataModel.markClean({ dataPath: 'books' })
      expect(dataModel.isEdited).toBe(false)
      dataModel.stop()
    })

    it('marks changes inside sources with their own resource for them', () => {
      // E.g. the children of the items of a tree with a resource:
      const chapters = { type: 'list', form: { type: 'form', fields: {} } }
      const { dataModel, data } = createDataModel(
        {
          type: 'form',
          fields: {
            books: {
              type: 'list',
              resource: { path: 'books' },
              buttons: { submit: { type: 'submit' } },
              form: { type: 'form', fields: { chapters } }
            }
          }
        },
        { books: [{ chapters: [{ title: 'A' }, { title: 'B' }] }] }
      )
      const [book] = data.books
      dataModel.move(
        { schema: chapters, list: book.chapters, dataPath: 'books/0/chapters' },
        1,
        0
      )
      expect(dataModel.isDirty).toBe(true)
      dataModel.markClean({ dataPath: 'books' })
      expect(dataModel.isEdited).toBe(false)
      dataModel.stop()
    })

    describe('writes inside sources with their own resource', () => {
      const chapters = {
        type: 'list',
        form: { type: 'form', fields: { title: { type: 'text' } } }
      }

      // The container can't save, only the source with its own resource:
      function createLibraryModel() {
        return createDataModel(
          {
            type: 'form',
            fields: {
              books: {
                type: 'list',
                resource: { path: 'books' },
                buttons: { submit: { type: 'submit' } },
                form: { type: 'form', fields: { chapters } }
              }
            }
          },
          { books: [{ chapters: [{ title: 'A' }] }] },
          { canSave: () => false }
        )
      }

      it('marks values that `set()` writes for the source', () => {
        // E.g. a field edited inline in the source's list:
        const { dataModel, data } = createLibraryModel()
        dataModel.set(
          {
            data: data.books[0].chapters[0],
            name: 'title',
            dataPath: 'books/0/chapters/0/title'
          },
          'One'
        )
        expect(dataModel.isDirty).toBe(true)
        dataModel.markClean({ dataPath: 'books' })
        expect(dataModel.isEdited).toBe(false)
        dataModel.stop()
      })

      it('marks writes through editable data for the source', () => {
        // E.g. a handler that writes into the source's items:
        const { dataModel, data } = createLibraryModel()
        dataModel.toEditable(data, () => '').books[0].chapters[0].title = 'One'
        expect(data.books[0].chapters[0].title).toBe('One')
        expect(dataModel.isDirty).toBe(true)
        dataModel.markClean({ dataPath: 'books' })
        expect(dataModel.isEdited).toBe(false)
        dataModel.stop()
      })

      it('marks items that `merge()` applies for the source', () => {
        // E.g. a nested form of a child of a tree item that is applied:
        const { dataModel, data } = createLibraryModel()
        const draft = cloneWithUids(data.books[0].chapters[0])
        draft.title = 'One'
        dataModel.merge(
          {
            data: data.books[0].chapters,
            name: 0,
            dataPath: 'books/0/chapters/0'
          },
          draft,
          chapters
        )
        expect(data.books[0].chapters[0].title).toBe('One')
        expect(dataModel.isDirty).toBe(true)
        dataModel.markClean({ dataPath: 'books' })
        expect(dataModel.isEdited).toBe(false)
        dataModel.stop()
      })
    })

    it(`isn't dirty after direct writes until \`markEdited()\``, async () => {
      const { dataModel, data } = createBookModel()
      data.title = 'Persuasion'
      data.chapters.push({ title: 'Four' })
      await nextTick()
      expect(data.slug).toBe('persuasion')
      expect(dataModel.isDirty).toBe(false)
      dataModel.markEdited()
      expect(dataModel.isDirty).toBe(true)
      dataModel.stop()
    })

    describe('writes through editable data', () => {
      it('are edits, like the writes of handlers', () => {
        const { dataModel, data } = createBookModel()
        dataModel.toEditable(data, () => '').title = 'Persuasion'
        expect(data.title).toBe('Persuasion')
        expect(dataModel.isDirty).toBe(true)
        dataModel.stop()
      })

      it(`aren't edits if they keep the value`, () => {
        const { dataModel, data } = createBookModel()
        dataModel.toEditable(data, () => '').title = 'Emma'
        expect(dataModel.isDirty).toBe(false)
        dataModel.stop()
      })

      it('are edits in nested data and through array methods', () => {
        const { dataModel, data } = createBookModel()
        const item = dataModel.toEditable(data, () => '')
        item.chapters.find(({ title }) => title === 'Two').title = 'Deux'
        expect(data.chapters[1].title).toBe('Deux')
        expect(dataModel.isDirty).toBe(true)
        dataModel.markClean()
        item.chapters.pop()
        expect(getTitles(data.chapters)).toEqual(['One', 'Deux'])
        expect(dataModel.isDirty).toBe(true)
        dataModel.markClean()
        delete item.chapters[0].status
        expect('status' in data.chapters[0]).toBe(false)
        expect(dataModel.isDirty).toBe(true)
        dataModel.stop()
      })

      it('keep the identity of the data', () => {
        const { dataModel, data } = createBookModel()
        const item = dataModel.toEditable(data, () => '')
        expect(dataModel.toEditable(data, () => '')).toBe(item)
        expect(item.chapters[0]).toBe(item.chapters[0])
        expect(toRaw(item.chapters[0])).toBe(toRaw(data.chapters[0]))
        dataModel.stop()
      })

      it('write the data that editable data in values wraps', async () => {
        const { dataModel, data } = createBookModel()
        const item = dataModel.toEditable(data, () => '')
        const [one, two, three] = item.chapters
        item.chapters = [three, two, one]
        expect(getTitles(data.chapters)).toEqual(['Three', 'Two', 'One'])
        expect(toRaw(data.chapters)[0]).not.toBe(three)
        expect(toRaw(data.chapters)[0]).toBe(data.chapters[0])
        // So the model's own writes into the items aren't edits, e.g. defaults:
        dataModel.markClean()
        delete data.chapters[0].status
        await nextTick()
        expect(data.chapters[0].status).toBe('draft')
        expect(dataModel.isDirty).toBe(false)
        dataModel.stop()
      })
    })

    describe('writes of excluded data', () => {
      const chapterList = {
        type: 'list',
        form: {
          type: 'form',
          fields: {
            title: { type: 'text' },
            note: { type: 'text', exclude: true }
          }
        }
      }
      const schema = {
        type: 'form',
        fields: {
          title: { type: 'text' },
          note: { type: 'text', exclude: true },
          details: {
            type: 'section',
            nested: true,
            exclude: true,
            fields: { summary: { type: 'text' } }
          },
          author: {
            type: 'object',
            form: {
              type: 'form',
              fields: { name: { type: 'text' } }
            }
          },
          chapters: chapterList
        }
      }

      function createNotedModel() {
        return createDataModel(schema, {
          title: 'Emma',
          note: '',
          details: { summary: '' },
          author: { name: 'Jane Austen' },
          chapters: [{ title: 'One', note: '' }]
        })
      }

      it(`aren't edits for values without components`, () => {
        const { dataModel, data } = createNotedModel()
        const item = dataModel.toEditable(data, () => '')
        // E.g. helper values that handlers keep in the data:
        Object.assign(item, { isSelected: true })
        delete item.isSelected
        expect(dataModel.isEdited).toBe(false)
        dataModel.stop()
      })

      it(`aren't edits for values of items that their forms don't hold`, () => {
        const { dataModel, data } = createNotedModel()
        const item = dataModel.toEditable(data, () => '')
        // E.g. values that handlers derive for the items, which aren't sent:
        item.author.born = 1775
        item.chapters[0].isOpen = true
        expect(dataModel.isEdited).toBe(false)
        item.chapters[0] = { title: 'Uno' }
        expect(dataModel.isDirty).toBe(true)
        dataModel.stop()
      })

      it(`aren't edits for excluded values and the values in them`, () => {
        const { dataModel, data } = createNotedModel()
        // E.g. the input of the user into excluded fields:
        dataModel.set({ data, name: 'note', dataPath: 'note' }, 'Later')
        const item = dataModel.toEditable(data, () => '')
        item.chapters[0].note = 'Later'
        item.details.summary = 'Short'
        expect(dataModel.isEdited).toBe(false)
        dataModel.set({ data, name: 'title', dataPath: 'title' }, 'Persuasion')
        expect(dataModel.isDirty).toBe(true)
        dataModel.stop()
      })

      it('are edits for list items that are added', () => {
        const { dataModel, data } = createNotedModel()
        dataModel.toEditable(data, () => '').chapters.push({ title: 'Two' })
        expect(dataModel.isDirty).toBe(true)
        dataModel.stop()
      })

      it(`aren't edits for merged copies that only change them`, () => {
        const { dataModel, data } = createNotedModel()
        const draft = cloneWithUids(data.chapters[0])
        draft.note = 'Later'
        dataModel.merge(
          { data: data.chapters, name: 0, dataPath: 'chapters/0' },
          draft,
          chapterList
        )
        expect(data.chapters[0].note).toBe('Later')
        expect(dataModel.isEdited).toBe(false)
        dataModel.stop()
      })

      it(`are edits for sources with their own resource that aren't excluded`, () => {
        // E.g. the order of child items that the parent saves, without buttons
        // of the source:
        const { dataModel, data, getListEntry } = createDataModel(
          {
            type: 'form',
            fields: {
              books: {
                type: 'list',
                resource: { path: 'books' },
                exclude: false,
                columns: { title: {} }
              }
            }
          },
          { books: [{ title: 'A' }, { title: 'B' }] }
        )
        dataModel.move(getListEntry('books'), 1, 0)
        expect(getTitles(data.books)).toEqual(['B', 'A'])
        expect(dataModel.isDirty).toBe(true)
        dataModel.markClean({ dataPath: '' })
        expect(dataModel.isEdited).toBe(false)
        dataModel.stop()
      })

      it('are edits when `exclude()` fails', () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        const { dataModel, data } = createDataModel(
          {
            type: 'form',
            fields: {
              note: {
                type: 'text',
                exclude: () => {
                  throw new Error('Failed')
                }
              }
            }
          },
          { note: '' }
        )
        dataModel.set({ data, name: 'note', dataPath: 'note' }, 'Later')
        expect(data.note).toBe('Later')
        expect(dataModel.isDirty).toBe(true)
        expect(error).toHaveBeenCalled()
        error.mockRestore()
        dataModel.stop()
      })
    })

    it(`isn't dirty after \`markClean()\`, e.g. once saved`, () => {
      const { dataModel, data } = createBookModel()
      dataModel.set({ data, name: 'title', dataPath: 'title' }, 'Persuasion')
      dataModel.markClean()
      expect(dataModel.isDirty).toBe(false)
      dataModel.stop()
    })

    it(`isn't dirty once the data is replaced`, async () => {
      const { dataModel, data } = createBookModel()
      dataModel.set({ data, name: 'title', dataPath: 'title' }, 'Persuasion')
      dataModel.replace(reactive({ title: 'Saved', chapters: [] }))
      expect(dataModel.isDirty).toBe(false)
      await nextTick()
      expect(dataModel.data.slug).toBe('saved')
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
          fields: {
            title: { type: 'text' },
            size: {
              type: 'select',
              options: {
                data: () =>
                  new Promise(resolve => {
                    resolveOptions = resolve
                  })
              },
              computeValue: ({ value, options }) => value ?? options?.[0].id
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
      dataModel.set({ data, name: 'title', dataPath: 'title' }, 'Changed')
      expect(dataModel.isDirty).toBe(true)
      dataModel.stop()
    })
  })

  describe('mergeFromServer()', () => {
    const schema = {
      type: 'form',
      fields: {
        title: { type: 'text' },
        chapters: {
          type: 'list',
          form: { type: 'form', fields: { title: { type: 'text' } } }
        },
        reviews: {
          type: 'list',
          resource: { path: 'reviews' },
          form: { type: 'form', fields: { text: { type: 'text' } } }
        }
      }
    }

    it('merges the data in place and marks it clean', () => {
      const { dataModel, data } = createDataModel(schema, {
        title: 'Emma',
        chapters: [{ title: 'One' }],
        reviews: [{ id: 1, text: 'Witty' }]
      })
      const { chapters, reviews } = data
      const [chapter] = chapters
      dataModel.set({ data, name: 'title', dataPath: 'title' }, 'Persuasion')
      dataModel.setErrors('chapters/0/title', [{ message: 'is too short' }])
      expect(dataModel.isDirty).toBe(true)
      const mergedData = dataModel.mergeFromServer({
        id: 1,
        title: 'Persuasion',
        chapters: [{ id: 2, title: 'One' }]
      })
      expect(mergedData).toBe(data)
      expect(data.chapters).toBe(chapters)
      expect(data.chapters[0]).toBe(chapter)
      // The response doesn't contain the reviews, which have their own
      // resource:
      expect(data.reviews).toBe(reviews)
      expect(toRaw(data)).toEqual({
        id: 1,
        title: 'Persuasion',
        chapters: [{ id: 2, title: 'One' }],
        reviews: [{ id: 1, text: 'Witty' }]
      })
      expect(dataModel.isDirty).toBe(false)
      // The errors stay with the item, as long as its value is the same:
      expect(dataModel.getErrors('chapters/0/title')).toEqual([
        { message: 'is too short' }
      ])
    })

    it('computes the values of the merged data right away', () => {
      // Like widths that the server stores as numbers, which the form edits as
      // objects:
      const { dataModel, data } = createDataModel(
        {
          type: 'form',
          fields: {
            width: {
              type: 'section',
              nested: true,
              computeValue: ({ value }) =>
                isPlainObject(value) ? value : { value, units: 'rem' },
              fields: { value: { type: 'text' } }
            }
          }
        },
        { width: 5 }
      )
      expect(data.width).toEqual({ value: 5, units: 'rem' })
      dataModel.mergeFromServer({ width: 6 })
      expect(data.width).toEqual({ value: 6, units: 'rem' })
    })

    it('resolves the values from data schemas of the merged data right away', () => {
      const { dataModel, data } = createDataModel(
        {
          type: 'form',
          fields: {
            title: { type: 'text' },
            label: {
              type: 'value',
              data: ({ item }) => item.title.toUpperCase()
            }
          }
        },
        { title: 'Emma' }
      )
      expect(data.label).toBe('EMMA')
      // The server doesn't store `label`, which the merge removes:
      dataModel.mergeFromServer({ title: 'Persuasion' })
      expect(data.label).toBe('PERSUASION')
      dataModel.stop()
    })
  })

  describe('merge()', () => {
    const chapterList = {
      type: 'list',
      form: {
        type: 'form',
        fields: {
          title: { type: 'text' },
          notes: {
            type: 'list',
            form: { type: 'form', fields: { text: { type: 'text' } } }
          }
        }
      }
    }
    const schema = { type: 'form', fields: { chapters: chapterList } }

    it('merges copies into the item in place, matching their uids', () => {
      const { dataModel, data } = createDataModel(schema, {
        chapters: [{ title: 'One', notes: [{ text: 'A' }, { text: 'B' }] }]
      })
      const [chapter] = data.chapters
      const [first, second] = chapter.notes
      const draft = cloneWithUids(chapter)
      draft.title = 'First'
      draft.notes.reverse()
      draft.notes.push({ text: 'C' })
      dataModel.merge(
        { data: data.chapters, name: 0, dataPath: 'chapters/0' },
        draft,
        chapterList
      )
      expect(data.chapters[0]).toBe(chapter)
      expect(chapter.notes).toEqual([
        { text: 'B' },
        { text: 'A' },
        { text: 'C' }
      ])
      expect(chapter.notes[0]).toBe(second)
      expect(chapter.notes[1]).toBe(first)
      expect(dataModel.isDirty).toBe(true)
      dataModel.stop()
    })

    it('merges copies into the rows of lists stored in objects in place', () => {
      // Lists show the values of objects as rows, with their keys as indices:
      const { dataModel, data } = createDataModel(schema, {
        chapters: { one: { title: 'One', notes: [{ text: 'A' }] } }
      })
      const { one } = data.chapters
      const [note] = one.notes
      const draft = cloneWithUids(one)
      draft.title = 'First'
      dataModel.merge(
        { data: data.chapters, name: 'one', dataPath: 'chapters/one' },
        draft,
        chapterList
      )
      expect(data.chapters.one).toBe(one)
      expect(one.title).toBe('First')
      expect(one.notes[0]).toBe(note)
      dataModel.stop()
    })

    it('rewrites computed values that hold the merged copy', async () => {
      const chapterList = {
        type: 'list',
        form: {
          type: 'form',
          fields: {
            title: { type: 'text' },
            details: {
              type: 'section',
              nested: true,
              fields: {
                chapter: {
                  type: 'value',
                  computeValue: ({ parentItem }) => parentItem
                }
              }
            }
          }
        }
      }
      const { dataModel, data } = createDataModel(
        { type: 'form', fields: { chapters: chapterList } },
        { chapters: [{ title: 'One', details: {} }] }
      )
      await nextTick()
      // The draft's own model computes its reference to the draft:
      const { dataModel: draftModel, data: draft } = createDataModel(
        chapterList.form,
        cloneWithUids(data.chapters[0])
      )
      draft.title = 'First'
      await nextTick()
      expect(toRaw(draft.details.chapter)).toBe(toRaw(draft))
      dataModel.merge(
        { data: data.chapters, name: 0, dataPath: 'chapters/0' },
        draft,
        chapterList
      )
      const [chapter] = data.chapters
      expect(toRaw(chapter.details.chapter)).toBe(toRaw(chapter))
      dataModel.stop()
      draftModel.stop()
    })

    it(`doesn't mark the data dirty for unchanged copies`, () => {
      const { dataModel, data } = createDataModel(schema, {
        chapters: [{ title: 'One', notes: [] }]
      })
      dataModel.merge(
        { data: data.chapters, name: 0, dataPath: 'chapters/0' },
        cloneWithUids(data.chapters[0]),
        chapterList
      )
      expect(dataModel.isDirty).toBe(false)
      dataModel.stop()
    })
  })

  describe('errors', () => {
    const schema = {
      type: 'form',
      fields: {
        title: { type: 'text' },
        details: {
          type: 'section',
          nested: true,
          fields: { subtitle: { type: 'text' } }
        },
        chapters: {
          type: 'list',
          form: { type: 'form', fields: { title: { type: 'text' } } }
        },
        tags: {
          type: 'list',
          wrapPrimitives: 'name',
          form: { type: 'form', fields: { name: { type: 'text' } } }
        }
      }
    }
    const createBook = () =>
      createDataModel(schema, {
        title: 'Emma',
        details: { subtitle: '' },
        chapters: [{ title: 'One' }, { title: 'Two' }],
        tags: ['classic']
      })
    const tooShort = [{ message: 'is too short' }]

    it('copies the errors of the originals of copies', () => {
      const { dataModel } = createBook()
      dataModel.setErrors('chapters/1/title', tooShort)
      const draft = cloneWithUids(dataModel.data)
      draft.chapters.reverse()
      const { dataModel: draftModel } = createDataModel(schema, draft)
      draftModel.copyErrors(dataModel, draftModel.data)
      expect(draftModel.getErrors('chapters/0/title')).toEqual(tooShort)
      expect(draftModel.getErrors('chapters/1/title')).toBe(null)
      dataModel.stop()
      draftModel.stop()
    })

    it('keeps the errors of list items when they move', () => {
      const { dataModel, getListEntry } = createBook()
      dataModel.setErrors('chapters/1/title', tooShort)
      dataModel.insert(getListEntry('chapters'), 0, { title: 'Zero' })
      expect(dataModel.getErrors('chapters/1/title')).toBe(null)
      expect(dataModel.getErrors('chapters/2/title')).toEqual(tooShort)
      dataModel.move(getListEntry('chapters'), 2, 0)
      expect(dataModel.getErrors('chapters/0/title')).toEqual(tooShort)
      dataModel.stop()
    })

    it('hides only the errors of the field whose value changes', () => {
      const { dataModel, data } = createBook()
      dataModel.setErrors('title', tooShort)
      dataModel.setErrors('details/subtitle', tooShort)
      dataModel.setErrors('chapters/0/title', tooShort)
      dataModel.set(
        { data: data.chapters[0], name: 'title', dataPath: 'chapters/0/title' },
        'Prologue'
      )
      expect(dataModel.getErrors('chapters/0/title')).toBe(null)
      expect(dataModel.getErrors('title')).toEqual(tooShort)
      expect(dataModel.getErrors('details/subtitle')).toEqual(tooShort)
      dataModel.stop()
    })

    it('applies the errors only to the values that they were set for', () => {
      const { dataModel, data } = createBook()
      dataModel.setErrors('details/subtitle', tooShort)
      // E.g. `change` handlers write data directly:
      data.details.subtitle = 'Volume'
      expect(dataModel.getErrors('details/subtitle')).toBe(null)
      expect(dataModel.getErrorDataPaths()).toEqual([])
      dataModel.stop()
    })

    it('hides the errors of lists once they change in place', () => {
      const { dataModel, getListEntry } = createBook()
      dataModel.setErrors('chapters', tooShort)
      dataModel.insert(getListEntry('chapters'), 2, { title: 'Three' })
      expect(dataModel.getErrors('chapters')).toBe(null)
      dataModel.stop()
    })

    it('keeps the errors when the value is written unchanged', () => {
      // E.g. server errors of values that the user enters again:
      const { dataModel, data } = createBook()
      dataModel.setErrors('title', tooShort)
      dataModel.set({ data, name: 'title', dataPath: 'title' }, 'Emma')
      expect(dataModel.getErrors('title')).toEqual(tooShort)
      dataModel.stop()
    })

    it('keys the values of lists of primitives by their lists', () => {
      const { dataModel, data, getListEntry } = createBook()
      dataModel.insert(getListEntry('tags'), 1, 'novel')
      dataModel.setErrors('tags/0', tooShort)
      dataModel.setErrors('tags/1', tooShort)
      // Edits of the values write into their lists, see `useSourceData()`:
      dataModel.set({ data: data.tags, name: 1, dataPath: 'tags/1' }, 'romance')
      expect(dataModel.getErrors('tags/0')).toEqual(tooShort)
      expect(dataModel.getErrors('tags/1')).toBe(null)
      // Replaced lists don't hold the errors of their values anymore:
      dataModel.set({ data, name: 'tags', dataPath: 'tags' }, [
        'classic', 'novel'
      ])
      expect(dataModel.getErrors('tags/0')).toBe(null)
      dataModel.stop()
    })

    it('keeps the server errors when the value is validated again', () => {
      const { dataModel } = createBook()
      const taken = [{ message: 'is taken' }]
      dataModel.replaceErrors({ title: taken }, { server: true })
      dataModel.setErrors('title', tooShort)
      expect(dataModel.getErrors('title')).toEqual([...tooShort, ...taken])
      // E.g. `validate()` on blur, without validation errors:
      dataModel.setErrors('title', null)
      expect(dataModel.getErrors('title')).toEqual(taken)
      dataModel.stop()
    })

    it('clears the errors for good once the value changes', () => {
      const { dataModel, data } = createBook()
      const taken = [{ message: 'is taken' }]
      dataModel.replaceErrors(
        { 'title': taken, 'details/subtitle': taken },
        { server: true }
      )
      dataModel.set({ data, name: 'title', dataPath: 'title' }, 'Persuasion')
      dataModel.set({ data, name: 'title', dataPath: 'title' }, 'Emma')
      expect(dataModel.getErrors('title')).toBe(null)
      // Also when code writes the values directly:
      data.details.subtitle = 'Volume'
      data.details.subtitle = ''
      expect(dataModel.getErrors('details/subtitle')).toBe(null)
      expect(dataModel.hasErrorsWithin(data)).toBe(false)
      dataModel.stop()
    })

    it('stops watching the values of replaced data', () => {
      const { dataModel, data } = createBook()
      dataModel.replaceErrors(
        { title: [{ message: 'is taken' }] },
        { server: true }
      )
      dataModel.replace(reactive({ title: 'Persuasion' }))
      let evaluationCount = 0
      const errors = computed(() => {
        evaluationCount++
        return dataModel.getErrors('title')
      })
      expect(errors.value).toBe(null)
      // A change of the replaced data doesn't affect the model:
      data.title = 'Sanditon'
      expect(errors.value).toBe(null)
      expect(evaluationCount).toBe(1)
      dataModel.stop()
    })

    it('drops the errors of other values when the value is validated', () => {
      const { dataModel, data } = createBook()
      dataModel.replaceErrors(
        { title: [{ message: 'is taken' }] },
        { server: true }
      )
      dataModel.set({ data, name: 'title', dataPath: 'title' }, 'Persuasion')
      dataModel.setErrors('title', null)
      dataModel.set({ data, name: 'title', dataPath: 'title' }, 'Emma')
      expect(dataModel.getErrors('title')).toBe(null)
      dataModel.stop()
    })

    it('keeps the errors of fields while their values change', () => {
      const { dataModel, data } = createBook()
      dataModel.addError('title', 'Unable to load')
      dataModel.set({ data, name: 'title', dataPath: 'title' }, 'Persuasion')
      expect(dataModel.getFieldErrors('title')).toEqual(['Unable to load'])
      expect(dataModel.getErrors('title')).toBe(null)
      expect(dataModel.getErrorDataPaths()).toEqual(['title'])
      expect(dataModel.hasErrorsWithin(data)).toBe(true)
      // Their sources remove them, also while the value differs:
      dataModel.removeError('title', 'Unable to load')
      dataModel.set({ data, name: 'title', dataPath: 'title' }, 'Emma')
      expect(dataModel.getFieldErrors('title')).toBe(null)
      expect(dataModel.hasErrorsWithin(data)).toBe(false)
      dataModel.stop()
    })

    it('adds errors once, and removes them by message', () => {
      const { dataModel } = createBook()
      dataModel.addError('title', 'Unable to load')
      dataModel.addError('title', 'Unable to load')
      dataModel.addError('title', 'Offline')
      expect(dataModel.getFieldErrors('title')).toEqual([
        'Unable to load', 'Offline'
      ])
      dataModel.removeError('title', 'Unable to load')
      dataModel.removeError('title', 'Missing')
      expect(dataModel.getFieldErrors('title')).toEqual(['Offline'])
      dataModel.removeError('title', 'Offline')
      expect(dataModel.getFieldErrors('title')).toBe(null)
      dataModel.stop()
    })

    it('replaces the errors within a data path, returning their fields', () => {
      const { dataModel } = createBook()
      dataModel.setErrors('title', tooShort)
      dataModel.setErrors('chapters/0/title', tooShort)
      const fieldDataPaths = dataModel.replaceErrors(
        {
          'chapters/1/title': tooShort,
          'title': tooShort
        },
        { dataPath: 'chapters' }
      )
      expect(fieldDataPaths).toEqual({ 'chapters/1/title': 'chapters/1/title' })
      expect(dataModel.getErrors('chapters/0/title')).toBe(null)
      expect(dataModel.getErrors('chapters/1/title')).toEqual(tooShort)
      // Errors outside of the data path are kept:
      expect(dataModel.getErrors('title')).toEqual(tooShort)
      expect(dataModel.getErrorDataPaths()).toEqual([
        'title',
        'chapters/1/title'
      ])
      expect(dataModel.replaceErrors({ 'details/subtitle': tooShort })).toEqual(
        { 'details/subtitle': 'details/subtitle' }
      )
      expect(dataModel.getErrorDataPaths()).toEqual(['details/subtitle'])
      dataModel.stop()
    })

    it('gives the errors inside values to the deepest field', () => {
      // E.g. of objects that a code field edits as JSON:
      const { dataModel } = createBook()
      const isRequired = [{ message: 'is required' }]
      const fieldDataPaths = dataModel.replaceErrors(
        {
          'details/subtitle': tooShort,
          'details/author/name': isRequired,
          'chapters/1/isbn': isRequired,
          'publisher': isRequired
        },
        { server: true }
      )
      expect(fieldDataPaths).toEqual({
        'details/subtitle': 'details/subtitle',
        'details/author/name': 'details',
        'chapters/1/isbn': 'chapters'
      })
      expect(dataModel.getErrors('details/subtitle')).toEqual(tooShort)
      expect(dataModel.getErrors('details')).toEqual([
        { message: 'is required', path: 'author/name' }
      ])
      expect(dataModel.getErrors('chapters')).toEqual([
        { message: 'is required', path: '1/isbn' }
      ])
      expect(dataModel.getErrorDataPaths()).toEqual([
        'details',
        'details/subtitle',
        'chapters'
      ])
      dataModel.stop()
    })

    it('clears the errors of the values within a data path', () => {
      const { dataModel } = createBook()
      dataModel.setErrors('title', tooShort)
      dataModel.replaceErrors(
        { 'chapters/0/title': tooShort },
        { dataPath: 'chapters', server: true }
      )
      dataModel.addError('chapters/0/title', 'Unable to load')
      dataModel.clearErrors('chapters/0')
      expect(dataModel.getErrors('chapters/0/title')).toBe(null)
      expect(dataModel.getFieldErrors('chapters/0/title')).toEqual([
        'Unable to load'
      ])
      expect(dataModel.getErrors('title')).toEqual(tooShort)
      dataModel.clearErrors()
      expect(dataModel.getErrors('title')).toBe(null)
      dataModel.stop()
    })

    it('finds the errors within data', () => {
      const { dataModel, data } = createBook()
      dataModel.setErrors('chapters/1/title', tooShort)
      expect(dataModel.hasErrorsWithin(data)).toBe(true)
      expect(dataModel.hasErrorsWithin(data.chapters)).toBe(true)
      expect(dataModel.hasErrorsWithin(data.chapters[0])).toBe(false)
      expect(dataModel.hasErrorsWithin(data.details)).toBe(false)
      dataModel.set(
        { data: data.chapters[1], name: 'title', dataPath: 'chapters/1/title' },
        'Second'
      )
      expect(dataModel.hasErrorsWithin(data)).toBe(false)
      dataModel.stop()
    })

    it('skips the walk of data while there are no errors', () => {
      let readCount = 0
      const { dataModel, data } = createDataModel(schema, {
        title: 'Emma',
        chapters: [{ title: 'One' }],
        // Data outside the schema, which counts its reads:
        notes: {
          edits: 0,
          get text() {
            readCount++
            return ''
          }
        }
      })
      let evaluationCount = 0
      const hasErrors = computed(() => {
        evaluationCount++
        return dataModel.hasErrorsWithin(data)
      })
      readCount = 0
      expect(hasErrors.value).toBe(false)
      expect(readCount).toBe(0)
      // Changes deep inside the data don't re-evaluate it:
      data.notes.edits++
      expect(hasErrors.value).toBe(false)
      expect(evaluationCount).toBe(1)
      // The first error anywhere does:
      dataModel.setErrors('chapters/0/title', tooShort)
      expect(hasErrors.value).toBe(true)
      dataModel.setErrors('chapters/0/title', null)
      dataModel.addError('title', 'Unable to load')
      expect(hasErrors.value).toBe(true)
      dataModel.removeError('title', 'Unable to load')
      dataModel.replaceErrors({ title: tooShort }, { server: true })
      expect(hasErrors.value).toBe(true)
      dataModel.clearErrors()
      readCount = 0
      expect(hasErrors.value).toBe(false)
      expect(readCount).toBe(0)
      // Also after replaced data took its errors along:
      dataModel.setErrors('title', tooShort)
      dataModel.replace(reactive({ ...data, title: 'Persuasion' }))
      readCount = 0
      expect(dataModel.hasErrorsWithin(dataModel.data)).toBe(false)
      expect(readCount).toBe(0)
      const { componentRecords } = dataModel
      expect(componentRecords.size).toBe([...componentRecords.values()].length)
      dataModel.stop()
      expect(componentRecords.size).toBe(0)
    })

    it('finds and copies the errors within data that holds its ancestors', async () => {
      const schema = {
        type: 'form',
        fields: {
          title: { type: 'text' },
          details: {
            type: 'section',
            nested: true,
            fields: {
              book: {
                type: 'value',
                computeValue: ({ parentItem }) => parentItem
              }
            }
          }
        }
      }
      const { dataModel, data } = createDataModel(schema, {
        title: 'Emma',
        details: {}
      })
      await nextTick()
      expect(toRaw(data.details.book)).toBe(toRaw(data))
      expect(dataModel.hasErrorsWithin(data)).toBe(false)
      dataModel.setErrors('title', tooShort)
      expect(dataModel.hasErrorsWithin(data.details)).toBe(true)
      const { dataModel: draftModel } = createDataModel(
        schema,
        cloneWithUids(dataModel.data)
      )
      draftModel.copyErrors(dataModel, draftModel.data)
      expect(draftModel.getErrors('title')).toEqual(tooShort)
      dataModel.stop()
      draftModel.stop()
    })
  })

  describe('list items that move or are removed', () => {
    // Books whose genre is selected from options loaded per book, with a
    // compute that keeps valid genres and selects the first one otherwise:
    const createShelfSchema = ({ loadGenres, computeValue }) => ({
      type: 'form',
      fields: {
        books: {
          type: 'list',
          form: {
            type: 'form',
            fields: {
              title: { type: 'text' },
              genre: {
                type: 'select',
                options: {
                  data: ({ item }) => {
                    const { title } = item
                    return async () => loadGenres(title)
                  }
                },
                computeValue
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
        createShelfSchema({ loadGenres, computeValue: getValidOrFirstGenre })
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
        createShelfSchema({ loadGenres, computeValue: getValidOrFirstGenre })
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
      const computeValue = vi.fn(getValidOrFirstGenre)
      const { dataModel, data } = createShelf(
        createShelfSchema({ loadGenres: title => [title], computeValue })
      )
      await dataModel.waitUntilSettled()
      await nextTick()
      computeValue.mockClear()
      data.books.reverse()
      await nextTick()
      await dataModel.waitUntilSettled()
      expect(computeValue).toHaveBeenCalledTimes(0)
      dataModel.stop()
    })

    it('recomputes the values of items that moved if they read their position', async () => {
      const computeValue = vi.fn(({ itemIndex }) => itemIndex + 1)
      const { dataModel, data } = createDataModel(
        {
          type: 'form',
          fields: {
            books: {
              type: 'list',
              form: {
                type: 'form',
                fields: {
                  title: { type: 'text' },
                  position: { type: 'text', computeValue },
                  path: {
                    type: 'text',
                    computeValue: ({ dataPath }) => dataPath
                  }
                }
              }
            }
          }
        },
        { books: [{ title: 'One' }, { title: 'Two' }, { title: 'Three' }] }
      )
      await dataModel.waitUntilSettled()
      computeValue.mockClear()
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
      expect(computeValue).toHaveBeenCalledTimes(2)
      dataModel.stop()
    })

    it('forgets the options of removed items', async () => {
      const { dataModel, data } = createShelf(
        createShelfSchema({
          loadGenres: title => [title],
          computeValue: getValidOrFirstGenre
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
    it("doesn't modify the values that `computeValue()` returns", async () => {
      const emptyAddress = { street: '' }
      const schema = {
        type: 'form',
        fields: {
          address: {
            type: 'object',
            computeValue: ({ value }) => value ?? emptyAddress,
            form: {
              type: 'form',
              fields: {
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
        fields: {
          chapters: {
            type: 'list',
            computeValue: ({ value }) => value ?? chapters,
            form: {
              type: 'form',
              fields: {
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
        fields: {
          chapters: {
            type: 'list',
            computeValue: ({ value }) => value ?? [emptyChapter, emptyChapter],
            form: {
              type: 'form',
              fields: {
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
    it('waits for loads without a time limit', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      const schema = {
        type: 'form',
        fields: {
          preview: {
            type: 'value',
            data: () => () =>
              new Promise(resolve =>
                setTimeout(() => resolve('Loaded'), 60_000)
              )
          }
        }
      }
      const { dataModel, data } = createDataModel(schema, {})
      await nextTick()
      let isSettled = false
      const settled = dataModel.waitUntilSettled().then(() => {
        isSettled = true
      })
      await vi.advanceTimersByTimeAsync(59_000)
      expect(isSettled).toBe(false)
      await vi.advanceTimersByTimeAsync(1_000)
      await settled
      vi.useRealTimers()
      expect(data.preview).toBe('Loaded')
      dataModel.stop()
    })
  })

  describe('edge cases', () => {
    it('works for components without data and component paths', () => {
      const schema = {
        type: 'form',
        fields: { title: { type: 'text' }, slug }
      }
      const data = reactive({ title: 'Hello World' })
      const dataModel = new DataModel({
        schema: () => schema,
        data
      })
      expect(data.slug).toBe('hello-world')
      dataModel.stop()
    })

    it('handles missing data and empty schemas', async () => {
      const dataModel = new DataModel({
        schema: () => ({ type: 'form' })
      })
      await nextTick()
      expect(dataModel.isDirty).toBe(false)
      dataModel.replace(reactive({ items: [{ id: 1 }, { id: 2 }] }))
      const { items } = dataModel.data
      dataModel.move(
        { schema: { type: 'list' }, list: items, dataPath: 'items' },
        0,
        1
      )
      expect(dataModel.data.items).toEqual([{ id: 2 }, { id: 1 }])
      // Lists without components aren't edited:
      expect(dataModel.isEdited).toBe(false)
      dataModel.stop()
    })

    it('sets defaults that depend on the context of added items', async () => {
      // E.g. books that are added to an author inherit the author's language:
      const schema = {
        type: 'form',
        fields: {
          authors: {
            type: 'list',
            form: {
              type: 'form',
              fields: {
                language: { type: 'text' },
                books: {
                  type: 'list',
                  form: {
                    type: 'form',
                    fields: {
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
      const ignoresMissingValue = vi.fn(({ item }) => !!item.isDraft)
      defineType({ type: 'note', ignoresMissingValue })
      const schema = {
        type: 'form',
        fields: {
          chapters: {
            type: 'list',
            form: {
              type: 'form',
              fields: { note: { type: 'note', default: 'None' } }
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
      expect(ignoresMissingValue).toHaveBeenCalledWith(
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
          main: { type: 'tab', fields: { title } },
          preview: { type: 'tab', fields: { title } }
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
      const createSchema = computeValue => ({
        type: 'form',
        fields: {
          title: { type: 'text' },
          label: { type: 'text', computeValue }
        }
      })
      const schemaRef = ref(createSchema(lower))
      const data = reactive({ title: 'Emma' })
      const dataModel = new DataModel({
        schema: () => schemaRef.value,
        data
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
      const schema = { type: 'form', fields: { genre } }
      const { dataModel, data } = createDataModel(schema, {})
      const entry = {
        schema: genre,
        data,
        name: 'genre',
        dataPath: 'genre',
        componentPath: 'genre'
      }
      expect(dataModel.getOptionsResolver(entry).value).toBe(undefined)
      await dataModel.waitUntilSettled()
      expect(dataModel.getOptionsResolver(entry).value).toEqual([
        'novel',
        'poetry'
      ])
      expect(loadGenres).toHaveBeenCalledOnce()
      dataModel.stop()
    })

    it(`doesn't compute values of components that an earlier compute hid`, async () => {
      // Both computes depend on `title`, so their watchers run in the same
      // flush. The first one hides the second one, which then must not run.
      const summary = vi.fn(({ item }) => `About ${item.title}`)
      const schema = {
        type: 'form',
        fields: {
          title: { type: 'text' },
          isShort: {
            type: 'text',
            computeValue: ({ item }) => item.title.length < 5
          },
          summary: {
            type: 'text',
            if: ({ item }) => !item.isShort,
            computeValue: summary
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

    it('throws errors of `computeValue()` other than unloaded options', () => {
      // Unlike failing `if` conditions, failing computes aren't caught:
      const schema = {
        type: 'form',
        fields: {
          title: {
            type: 'text',
            computeValue: () => {
              throw new Error('Broken computeValue')
            }
          }
        }
      }
      expect(() => createDataModel(schema, { title: 'Emma' })).toThrow(
        'Broken computeValue'
      )
    })

    it('stays dirty after changes while it settles', async () => {
      const loads = []
      const schema = {
        type: 'form',
        fields: {
          books: {
            type: 'list',
            form: {
              type: 'form',
              fields: {
                title: { type: 'text' },
                slug,
                summary: {
                  type: 'value',
                  data: () => () => new Promise(resolve => loads.push(resolve))
                }
              }
            }
          }
        }
      }
      const { dataModel, data, getListEntry } = createDataModel(schema, {
        books: [{ title: 'One' }, { title: 'Two' }]
      })
      await nextTick()
      // The user removes the second book and adds a third one, while the
      // summaries are still loading:
      dataModel.remove(getListEntry('books'), 1)
      dataModel.insert(getListEntry('books'), 1, { title: 'Three' })
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
