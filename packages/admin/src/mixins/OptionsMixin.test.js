import { vi } from 'vitest'
import { toRaw } from 'vue'
import OptionsMixin from './OptionsMixin.js'
import { mountForm, mountSchema } from '../test/mount.js'

describe('OptionsMixin', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('options', () => {
    it('refuses options data that is not an array', () => {
      const { options } = OptionsMixin.computed
      expect(() =>
        options.call({ optionsResolver: { value: 'Fiction' }, groupBy: null })
      ).toThrow('Invalid options data, should be array: Fiction')
    })

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
  })

  describe('optionValue', () => {
    it('supports functions that return the values of options', async () => {
      const { getComponent } = await mountSchema({
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
      const genre = getComponent('genre')
      expect(genre.selectedOption).toEqual({ code: 'bio', name: 'Biography' })
      expect(genre.getLabelForOption(genre.selectedOption)).toBe('Biography')
    })
  })

  describe('searchFilter', () => {
    const mountWithSearch = search =>
      mountSchema({
        schema: {
          components: {
            genres: {
              type: 'multiselect',
              options: ['Fiction', 'Biography'],
              search
            }
          }
        },
        data: { genres: [] }
      })

    it('uses search functions as the filter', async () => {
      const filter = ({ query }) => [query]
      const { getComponent } = await mountWithSearch(filter)
      expect(getComponent('genres').searchFilter).toBe(filter)
    })

    it('uses the filter of search objects, debounced if asked to', async () => {
      const filter = vi.fn(({ query }) => [query])
      const { getComponent } = await mountWithSearch({ filter, debounce: 1 })
      const { searchFilter } = getComponent('genres')
      expect(searchFilter).not.toBe(filter)
      expect(await searchFilter({ query: 'Bio' })).toEqual(['Bio'])
      expect(filter).toHaveBeenCalledOnce()
    })
  })

  describe('processValue()', () => {
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
      expect(schemaComponent.processedData).toMatchObject({
        mainAuthor: { id: 2 },
        coAuthors: [{ id: 1 }, { id: 2 }]
      })
      expect(schemaComponent.processedData.mainAuthor).not.toHaveProperty(
        'name'
      )
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
      mainAuthor.selectedValue = toRaw(newAuthor)
      await settle()
      // New options get temporary ids to be referenced by:
      expect(newAuthor.id).toMatch(/^@\d+$/)
      expect(mainAuthor.selectedOption).toBe(newAuthor)
      const { processedData } = schemaComponent
      // The relation references the new author by the id of the reference:
      const reference = processedData.mainAuthor['#ref']
      expect(processedData.mainAuthor).toEqual({ '#ref': expect.any(String) })
      expect(processedData.authors[1]).toEqual({
        '#id': reference,
        'name': 'Ann Radcliffe'
      })
    })
  })
})
