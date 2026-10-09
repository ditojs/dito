import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSchema, mountForm, mountAdmin, settle } from '../test/mount.js'

const genres = [
  { value: 'fiction', label: 'Fiction' },
  { value: 'poetry', label: 'Poetry' },
  { value: 'drama', label: 'Drama' }
]

// Opens the multiselect, like clicking it does, so that its options render.
async function open(field) {
  await field.find('.multiselect').trigger('focus')
  await flushPromises()
}

async function selectOption(field, label) {
  await open(field)
  const option = field
    .findAll('.multiselect__element .multiselect__option')
    .find(option => option.text() === label)
  await option.trigger('click')
  await flushPromises()
}

async function search(field, searchTerm) {
  await open(field)
  await field.find('.multiselect__input').setValue(searchTerm)
  await flushPromises()
}

function getOptionLabels(field) {
  return field
    .findAll('.multiselect__element .multiselect__option')
    .map(option => option.text())
}

function getTagLabels(field) {
  return field.findAll('.multiselect__tag').map(tag => tag.text())
}

describe('DitoTypeMultiselect', () => {
  describe('single values', () => {
    it('displays the label of the selected option', async () => {
      const { findField } = await mountSchema({
        schema: {
          components: { genre: { type: 'multiselect', options: genres } }
        },
        data: { genre: 'poetry' }
      })
      expect(findField('genre').find('.multiselect__single').text()).toBe(
        'Poetry'
      )
    })

    it('only renders the options once opened', async () => {
      const { findField } = await mountSchema({
        schema: {
          components: { genre: { type: 'multiselect', options: genres } }
        }
      })
      const field = findField('genre')
      expect(getOptionLabels(field)).toEqual([])
      await open(field)
      expect(getOptionLabels(field)).toEqual(['Fiction', 'Poetry', 'Drama'])
    })

    it('sets the value of the selected option and emits change', async () => {
      const onChange = vi.fn()
      const { findField, data } = await mountSchema({
        schema: {
          components: {
            genre: { type: 'multiselect', options: genres, onChange }
          }
        }
      })
      await selectOption(findField('genre'), 'Drama')
      expect(data.genre).toBe('drama')
      await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce())
      expect(onChange.mock.calls[0][0].value).toBe('drama')
    })

    it('matches values with `options.equals()`', async () => {
      const { findField } = await mountSchema({
        schema: {
          components: {
            genre: {
              type: 'multiselect',
              options: {
                data: genres,
                equals: ({ value, option }) => (
                  value?.toLowerCase() === option.value
                )
              }
            }
          }
        },
        data: { genre: 'POETRY' }
      })
      expect(findField('genre').find('.multiselect__single').text()).toBe(
        'Poetry'
      )
    })

    it('clears the value with the clear button', async () => {
      const { findField, data } = await mountSchema({
        schema: {
          components: {
            genre: { type: 'multiselect', options: genres, clearable: true }
          }
        },
        data: { genre: 'poetry' }
      })
      await findField('genre').find('.dito-affixes__clear').trigger('click')
      expect(data.genre).toBe(null)
    })
    it('links the selected option to its form in `view` when `editable`', async () => {
      const admin = await mountAdmin({
        views: {
          genres: {
            type: 'view',
            component: {
              type: 'list',
              resource: { path: 'genres' },
              form: { type: 'form', components: { name: { type: 'text' } } }
            }
          },
          test: {
            type: 'view',
            label: 'Test',
            components: {
              genre: {
                type: 'multiselect',
                editable: true,
                view: 'genres',
                options: genres
              }
            }
          }
        }
      })
      await admin.navigate('/test')
      const view = admin.getRouteComponent(component => component.isView)
      view.setData({ genre: 'poetry' })
      await settle(view)
      const link = admin.wrapper.find('.dito-options-edit-buttons a')
      expect(link.attributes('href')).toBe('/genres/poetry')
    })

    it(`doesn't render edit buttons unless \`editable\``, async () => {
      const { findField } = await mountSchema({
        schema: {
          components: {
            genre: { type: 'multiselect', options: genres, view: 'genres' }
          }
        },
        data: { genre: 'poetry' }
      })
      expect(
        findField('genre').find('.dito-options-edit-buttons').exists()
      ).toBe(false)
    })
  })

  describe('multiple values', () => {
    it('adds and removes the values of the selected options', async () => {
      const { findField, data } = await mountSchema({
        schema: {
          components: {
            genres: {
              type: 'multiselect',
              multiple: true,
              default: [],
              options: genres
            }
          }
        },
        data: { genres: ['drama'] }
      })
      const field = findField('genres')
      expect(getTagLabels(field)).toEqual(['Drama'])
      await selectOption(field, 'Fiction')
      expect(data.genres).toEqual(['drama', 'fiction'])
      expect(getTagLabels(field)).toEqual(['Drama', 'Fiction'])
      await field.find('.multiselect__tag-icon').trigger('mousedown')
      expect(data.genres).toEqual(['fiction'])
    })

    it('marks values without option as unavailable and keeps them', async () => {
      const { findField, data } = await mountSchema({
        schema: {
          components: {
            genres: {
              type: 'multiselect',
              multiple: true,
              options: { data: async () => genres }
            }
          }
        },
        data: { genres: ['opera', 'poetry'] }
      })
      const field = findField('genres')
      expect(getTagLabels(field)).toEqual(['opera', 'Poetry'])
      expect(
        field
          .findAll('.multiselect__tag')
          .map(tag => tag.classes('dito-multiselect__tag--unavailable'))
      ).toEqual([true, false])
      await selectOption(field, 'Drama')
      expect(data.genres).toEqual(['opera', 'poetry', 'drama'])
    })

    it('adds new values as options with `taggable`', async () => {
      const { findField, data } = await mountSchema({
        schema: {
          components: {
            keywords: {
              type: 'multiselect',
              label: 'Keyword',
              multiple: true,
              searchable: true,
              taggable: true,
              options: ['classic']
            }
          }
        },
        data: { keywords: ['classic'] }
      })
      const field = findField('keywords')
      expect(field.find('.multiselect__input').attributes('placeholder')).toBe(
        'Search or add a Keyword'
      )
      await search(field, 'gothic')
      await field.find('.multiselect__input').trigger('keydown.enter')
      await flushPromises()
      expect(data.keywords).toEqual(['classic', 'gothic'])
      expect(getTagLabels(field)).toEqual(['Classic', 'Gothic'])
    })

    it('emits change for added tags and keeps the options', async () => {
      const onChange = vi.fn()
      const keywords = ['classic']
      const { findField, data, getComponent } = await mountSchema({
        schema: {
          components: {
            keywords: {
              type: 'multiselect',
              multiple: true,
              searchable: true,
              taggable: true,
              options: { data: () => keywords },
              onChange
            }
          }
        }
      })
      const field = findField('keywords')
      await search(field, 'gothic')
      // `setValue()` triggers `change` on the search input, ignore it:
      onChange.mockClear()
      await field.find('.multiselect__input').trigger('keydown.enter')
      await flushPromises()
      expect(data.keywords).toEqual(['gothic'])
      expect(onChange).toHaveBeenCalledOnce()
      // The options of the data model aren't modified:
      expect(keywords).toEqual(['classic'])
      expect(getComponent('keywords').options).toEqual(['classic', 'gothic'])
      expect(
        field
          .findAll('.multiselect__tag')
          .map(tag => tag.classes('dito-multiselect__tag--unavailable'))
      ).toEqual([false])
    })

    it('displays and keeps the tags of taggable multiselects without options', async () => {
      const { findField, data } = await mountSchema({
        schema: {
          components: {
            keywords: {
              type: 'multiselect',
              multiple: true,
              searchable: true,
              taggable: true
            }
          }
        },
        data: { keywords: ['classic', 'gothic'] }
      })
      const field = findField('keywords')
      expect(getTagLabels(field)).toEqual(['Classic', 'Gothic'])
      await search(field, 'modern')
      await field.find('.multiselect__input').trigger('keydown.enter')
      await flushPromises()
      expect(data.keywords).toEqual(['classic', 'gothic', 'modern'])
    })

    it('adds tags as single values with `taggable`', async () => {
      const onChange = vi.fn()
      const { findField, data } = await mountSchema({
        schema: {
          components: {
            language: {
              type: 'multiselect',
              searchable: true,
              taggable: true,
              options: ['English', 'German'],
              onChange
            }
          }
        },
        data: { language: 'English' }
      })
      const field = findField('language')
      await search(field, 'Romansh')
      onChange.mockClear()
      await field.find('.multiselect__input').trigger('keydown.enter')
      await flushPromises()
      expect(data.language).toBe('Romansh')
      expect(onChange).toHaveBeenCalledOnce()
      expect(field.find('.multiselect__single').text()).toBe('Romansh')
    })

    it('makes the tag remove icons focusable in document order', async () => {
      const { findField } = await mountSchema({
        schema: {
          components: {
            genres: { type: 'multiselect', multiple: true, options: genres }
          }
        },
        data: { genres: ['drama'] }
      })
      expect(
        findField('genres')
          .find('.multiselect__tag-icon')
          .attributes('tabindex')
      ).toBe('0')
    })

    it('sends the values processed by `process()`', async () => {
      const { findField, submit } = await mountForm({
        schema: {
          components: {
            genres: {
              type: 'multiselect',
              multiple: true,
              options: genres,
              // Empty lists are sent as `null`:
              process: ({ value }) => (value?.length > 0 ? value : null)
            }
          }
        },
        data: { genres: ['drama'] },
        request: ({ data }) => ({ data })
      })
      await findField('genres')
        .find('.multiselect__tag-icon')
        .trigger('mousedown')
      expect(await submit()).toMatchObject({ genres: null })
    })
  })

  it(
    "doesn't put `null` into the placeholders of searchable " +
    'multiselects without label',
    async () => {
      const { findField } = await mountForm({
        schema: {
          components: {
            genre: {
              type: 'multiselect',
              label: false,
              searchable: true,
              options: genres
            }
          }
        },
        data: { genre: null }
      })
      const placeholder = findField('genre')
        .find('.multiselect__input')
        .attributes('placeholder')
      expect(placeholder).not.toContain('null')
    }
  )

  it('shows the default placeholder or none with boolean `placeholder`', async () => {
    const { findField } = await mountForm({
      schema: {
        components: {
          genre: {
            type: 'multiselect',
            searchable: true,
            placeholder: true,
            options: genres
          },
          mood: {
            type: 'multiselect',
            searchable: true,
            placeholder: false,
            options: genres
          }
        }
      },
      data: { genre: null, mood: null }
    })
    const getPlaceholder = dataPath =>
      findField(dataPath).find('.multiselect__input').attributes('placeholder')
    expect(getPlaceholder('genre')).toBe('Select or search Genre')
    expect(getPlaceholder('mood')).toBe(undefined)
  })

  describe('search', () => {
    const authors = [
      { id: 1, name: 'Jane Austen' },
      { id: 2, name: 'Mary Shelley' },
      { id: 3, name: 'Bram Stoker' }
    ]

    function createAuthorSchema(filter) {
      return {
        components: {
          author: {
            type: 'multiselect',
            label: 'Author',
            searchable: true,
            relate: true,
            // Single values are only displayed when they're among the options:
            options: {
              data: ({ item }) => (item.author ? [item.author] : []),
              label: 'name'
            },
            search: { filter }
          }
        }
      }
    }

    it('displays the options that the search filter returns', async () => {
      const filter = vi.fn(async ({ searchTerm }) =>
        authors.filter(author => author.name.includes(searchTerm))
      )
      const { findField, data } = await mountSchema({
        schema: createAuthorSchema(filter)
      })
      const field = findField('author')
      expect(field.find('.multiselect__input').attributes('placeholder')).toBe(
        'Select or search Author'
      )
      await search(field, 'Sh')
      expect(filter).toHaveBeenCalledOnce()
      expect(getOptionLabels(field)).toEqual(['Mary Shelley'])
      await field
        .find('.multiselect__element .multiselect__option')
        .trigger('click')
      await flushPromises()
      expect(data.author).toEqual({ id: 2, name: 'Mary Shelley' })
    })

    it('keeps related values that the search results lack', async () => {
      const { findField } = await mountSchema({
        schema: createAuthorSchema(async () => [authors[2]]),
        data: { author: { id: 1, name: 'Jane Austen' } }
      })
      const field = findField('author')
      expect(field.find('.multiselect__single').text()).toBe('Jane Austen')
      await search(field, 'Stoker')
      expect(getOptionLabels(field)).toEqual(['Bram Stoker'])
    })

    it('ignores the results of outdated searches', async () => {
      const resolvers = new Map()
      const filter = ({ searchTerm }) =>
        new Promise(resolve => {
          resolvers.set(searchTerm, resolve)
        })
      const { findField } = await mountSchema({
        schema: createAuthorSchema(filter)
      })
      const field = findField('author')
      await search(field, 'Au')
      await search(field, 'Aus')
      resolvers.get('Aus')([authors[0]])
      await flushPromises()
      resolvers.get('Au')([authors[1]])
      await flushPromises()
      expect(getOptionLabels(field)).toEqual(['Jane Austen'])
    })

    it('shows the errors of failed searches', async () => {
      const { findField, getErrors } = await mountSchema({
        schema: createAuthorSchema(async () => {
          throw new Error('Search is unavailable')
        })
      })
      await search(findField('author'), 'Au')
      expect(getErrors('author')).toEqual(['Search is unavailable'])
    })
  })
})
