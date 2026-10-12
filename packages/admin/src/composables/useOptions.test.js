import { vi } from 'vitest'
import { toRaw } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountAdmin, mountForm, mountSchema } from '../test/mount.js'

describe('useOptions()', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('options', () => {
    it('shows errors of failed loads without message as they are', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const { getErrors } = await mountSchema({
        schema: {
          components: {
            genre: {
              type: 'select',
              options: { data: () => Promise.reject('Genres are offline') }
            }
          }
        },
        data: { genre: null }
      })
      expect(getErrors('genre')).toEqual(['Genres are offline'])
    })

    it('refuses options data that is not an array', async () => {
      const admin = await mountAdmin({
        views: {
          test: {
            type: 'view',
            components: { genre: { type: 'select', options: 'Fiction' } }
          }
        }
      })
      const errorHandler = vi.fn()
      admin.app.config.errorHandler = errorHandler
      await admin.navigate('/test')
      expect(errorHandler).toHaveBeenCalledWith(
        new Error('Invalid options data, should be array: Fiction'),
        expect.anything(),
        expect.anything()
      )
    })

    it('replaces the error of a failed load with the next load', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const { getErrors, dataModel, data, settle } = await mountSchema({
        schema: {
          components: {
            category: { type: 'text' },
            genre: {
              type: 'select',
              options: {
                data:
                  ({ item: { category } }) =>
                  async () => {
                    if (category === 'lost') {
                      throw new Error(`The ${category} genres are unavailable`)
                    }
                    return ['Fiction']
                  }
              }
            }
          }
        },
        data: { category: 'lost', genre: null }
      })
      expect(getErrors('genre')).toEqual(['The lost genres are unavailable'])
      dataModel.set(data, 'category', 'books')
      await settle()
      expect(getErrors('genre')).toEqual([])
    })

    it('supports functions that return the values of options', async () => {
      const { findField } = await mountSchema({
        schema: {
          components: {
            genre: {
              type: 'select',
              options: {
                data: [
                  { code: 'fic', name: 'Fiction' },
                  { code: 'bio', name: 'Biography' }
                ],
                label: 'name',
                value: ({ option }) => option.code
              }
            }
          }
        },
        data: { genre: 'bio' }
      })
      const select = findField('genre').find('select').element
      expect(select.value).toBe('bio')
      expect(select.selectedOptions[0].text).toBe('Biography')
    })

    it.each(['select', 'multiselect', 'checkboxes', 'radio'])(
      'gives the options to the callbacks of %s fields',
      async type => {
        const options = { readonly: [], formatValue: [] }
        const record = key => context => {
          options[key].push(toRaw(context.options))
          return key === 'formatValue' ? context.value : false
        }
        await mountSchema({
          schema: {
            components: {
              genre: {
                type,
                options: ['Fiction', 'Biography'],
                readonly: record('readonly'),
                formatValue: record('formatValue')
              }
            }
          },
          data: { genre: null }
        })
        // The container formats the value too, in its own context:
        expect(options.readonly).toContainEqual(['Fiction', 'Biography'])
        expect(options.formatValue).toContainEqual(['Fiction', 'Biography'])
      }
    )
  })

  describe('search', () => {
    const mountWithSearch = search =>
      mountSchema({
        schema: {
          components: {
            genres: {
              type: 'multiselect',
              searchable: true,
              options: ['Fiction', 'Biography'],
              search
            }
          }
        },
        data: { genres: [] }
      })

    async function search(field, searchTerm) {
      await field.find('.multiselect').trigger('focus')
      await field.find('.multiselect__input').setValue(searchTerm)
      await flushPromises()
    }

    it('calls the filter with the search term and the options', async () => {
      const filter = vi.fn(({ searchTerm, options }) =>
        options.filter(option => option.startsWith(searchTerm))
      )
      const { findField } = await mountWithSearch(filter)
      const field = findField('genres')
      await search(field, 'Bio')
      expect(filter).toHaveBeenCalledOnce()
      expect(
        field.findAll('.multiselect__option').map(option => option.text())
      ).toContain('Biography')
      expect(field.text()).not.toContain('Fiction')
    })

    it('debounces the filter of search objects if asked to', async () => {
      const filter = vi.fn(({ searchTerm }) => [searchTerm])
      const { findField } = await mountWithSearch({ filter, debounce: 100 })
      const field = findField('genres')
      // Control the time, so that busy machines don't outlast the debounce:
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      await search(field, 'B')
      await search(field, 'Bio')
      expect(filter).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(100)
      vi.useRealTimers()
      expect(filter).toHaveBeenCalledOnce()
      expect(filter.mock.calls[0][0].searchTerm).toBe('Bio')
    })
  })

  describe('replaced values', () => {
    const genres = [
      { value: 'fiction', label: 'Fiction' },
      { value: 'poetry', label: 'Poetry' }
    ]

    it('keeps values that no option has, without editing', async () => {
      const { data, routeComponent } = await mountForm({
        schema: {
          components: { genre: { type: 'select', options: genres } }
        },
        data: { genre: 'drama' }
      })
      expect(data.genre).toBe('drama')
      expect(routeComponent.routeContext.isDirty).toBe(false)
    })

    it('keeps the values of taggable multiselects without options', async () => {
      const { data } = await mountForm({
        schema: {
          components: {
            genre: { type: 'multiselect', taggable: true, options: genres }
          }
        },
        data: { genre: 'gothic' }
      })
      expect(data.genre).toBe('gothic')
    })
  })

  describe('serializeValue()', () => {
    const authors = [
      { id: 1, name: 'Mary Shelley' },
      { id: 2, name: 'Bram Stoker' }
    ]

    it('reduces related options to their ids', async () => {
      const { schemaComponent } = await mountForm({
        schema: {
          components: {
            mainAuthor: {
              type: 'select',
              relate: true,
              options: { data: authors, label: 'name' }
            },
            coAuthors: {
              type: 'multiselect',
              multiple: true,
              relate: true,
              options: { data: authors, label: 'name' }
            }
          }
        },
        data: { mainAuthor: authors[1], coAuthors: authors }
      })
      const { serializedItem } = schemaComponent.context
      expect(serializedItem).toMatchObject({
        mainAuthor: { id: 2 },
        coAuthors: [{ id: 1 }, { id: 2 }]
      })
      expect(serializedItem.mainAuthor).not.toHaveProperty('name')
    })

    it('relates new options from the data at `options.dataPath`', async () => {
      const { schemaComponent, getComponent, data, settle } = await mountForm({
        schema: {
          components: {
            authors: {
              type: 'list',
              inlined: true,
              form: {
                type: 'form',
                components: { name: { type: 'text' } }
              }
            },
            mainAuthor: {
              type: 'select',
              relate: true,
              options: { dataPath: '../authors', label: 'name' }
            }
          }
        },
        data: { authors: [authors[0], { name: 'Ann Radcliffe' }] }
      })
      const mainAuthor = getComponent('mainAuthor')
      const newAuthor = data.authors[1]
      // Options without ids are their own values, see `getValueForOption()`:
      expect(mainAuthor.getValueForOption(newAuthor)).toBe(toRaw(newAuthor))
      // Select the option, as the select's `v-model` does:
      mainAuthor.selectedValue = toRaw(newAuthor)
      await settle()
      // New options get temporary ids to be referenced by:
      expect(newAuthor.id).toMatch(/^@\d+$/)
      expect(mainAuthor.selectedOption).toBe(newAuthor)
      const { serializedItem } = schemaComponent.context
      // The relation references the new author by the id of the reference:
      const reference = serializedItem.mainAuthor['#ref']
      expect(serializedItem.mainAuthor).toEqual({ '#ref': expect.any(String) })
      expect(serializedItem.authors[1]).toEqual({
        '#id': reference,
        'name': 'Ann Radcliffe'
      })
    })
  })
})
