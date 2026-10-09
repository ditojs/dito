import { vi } from 'vitest'
import { mountSchema, mountForm } from '../test/mount.js'

const genres = [
  { value: 'fiction', label: 'Fiction' },
  { value: 'poetry', label: 'Poetry' },
  { value: 'drama', label: 'Drama' }
]

function getOptions(field) {
  return field
    .findAll('option')
    .map(option => [option.attributes('value'), option.text()])
}

describe('DitoTypeSelect', () => {
  describe('options', () => {
    it('labelizes options that are plain values', async () => {
      const { findField, data } = await mountSchema({
        schema: {
          components: {
            format: { type: 'select', options: ['hardcover', 'e-book'] }
          }
        },
        data: { format: 'e-book' }
      })
      const field = findField('format')
      expect(getOptions(field)).toEqual([
        ['hardcover', 'Hardcover'],
        ['e-book', 'E Book']
      ])
      expect(field.find('select').element.value).toBe('e-book')
      await field.find('select').setValue('hardcover')
      expect(data.format).toBe('hardcover')
    })

    it('uses the `value` and `label` keys of option objects', async () => {
      const { findField, data } = await mountSchema({
        schema: {
          components: { genre: { type: 'select', options: genres } }
        }
      })
      const field = findField('genre')
      expect(getOptions(field)).toEqual([
        ['fiction', 'Fiction'],
        ['poetry', 'Poetry'],
        ['drama', 'Drama']
      ])
      await field.find('select').setValue('drama')
      expect(data.genre).toBe('drama')
    })

    it('uses the keys and label functions of `options`', async () => {
      const { findField, data } = await mountSchema({
        schema: {
          components: {
            authorId: {
              type: 'select',
              options: {
                data: [
                  { id: 1, first: 'Jane', last: 'Austen' },
                  { id: 2, first: 'Mary', last: 'Shelley' }
                ],
                value: 'id',
                label: ({ option }) => `${option.last}, ${option.first}`
              }
            }
          }
        }
      })
      const field = findField('authorId')
      expect(getOptions(field).map(([, label]) => label)).toEqual([
        'Austen, Jane',
        'Shelley, Mary'
      ])
      await field.find('select').setValue('2')
      // The values of the options are matched, not their strings:
      expect(data.authorId).toBe(2)
    })

    it('groups the options with `groupBy`', async () => {
      const { findField } = await mountSchema({
        schema: {
          components: {
            book: {
              type: 'select',
              groupBy: 'shelf',
              options: [
                { value: 'emma', label: 'Emma', shelf: 'Classics' },
                { value: 'dune', label: 'Dune', shelf: 'Sci-Fi' },
                { value: 'persuasion', label: 'Persuasion', shelf: 'Classics' }
              ]
            }
          }
        }
      })
      const groups = findField('book').findAll('optgroup')
      expect(groups.map(group => group.attributes('label'))).toEqual([
        'Classics',
        'Sci-Fi'
      ])
      expect(groups[0].findAll('option').map(option => option.text())).toEqual(
        ['Emma', 'Persuasion']
      )
    })

    it('loads options through `request()` once per form with `cache`', async () => {
      const request = vi.fn(({ url }) =>
        url === 'genres' ? { data: genres } : null
      )
      const { findField, data } = await mountForm({
        schema: {
          components: {
            genre: {
              type: 'select',
              options: {
                data: ({ request }) =>
                  request({ url: 'genres', cache: 'local' })
              }
            },
            subgenre: {
              type: 'select',
              options: {
                data: ({ request }) =>
                  request({ url: 'genres', cache: 'local' })
              }
            }
          }
        },
        data: { genre: 'poetry', subgenre: null },
        request
      })
      expect(request).toHaveBeenCalledOnce()
      expect(getOptions(findField('subgenre'))).toHaveLength(3)
      expect(data.genre).toBe('poetry')
    })

    it('reloads options when the data that they depend on changes', async () => {
      const loadCities = vi.fn(
        async country =>
          ({
            ch: [{ value: 'bsl', label: 'Basel' }],
            fr: [{ value: 'lyo', label: 'Lyon' }]
          })[country]
      )
      const { findField, data, settle } = await mountSchema({
        schema: {
          components: {
            country: { type: 'select', options: ['ch', 'fr'] },
            city: {
              type: 'select',
              options: {
                data: ({ item }) =>
                  item.country ? () => loadCities(item.country) : []
              }
            }
          }
        },
        data: { country: 'ch', city: 'bsl' }
      })
      expect(getOptions(findField('city'))).toEqual([['bsl', 'Basel']])
      await findField('country').find('select').setValue('fr')
      await settle()
      expect(getOptions(findField('city'))).toEqual([['lyo', 'Lyon']])
      // The city of the previous country isn't an option anymore:
      expect(data.city).toBe(null)
      expect(loadCities).toHaveBeenCalledTimes(2)
    })

    // Bug: Plain value options match any value, as `getOptionForValue()`
    // returns the value itself without `optionValue`, so values whose option
    // disappeared aren't replaced with `null`, unlike with option objects.
    test.fails(
      'replaces values whose plain value option disappeared with ' +
      '`null`',
      async () => {
        const { findField, data, settle } = await mountSchema({
          schema: {
            components: {
              country: { type: 'select', options: ['ch', 'fr'] },
              city: {
                type: 'select',
                options: {
                  data: ({ item }) =>
                    item.country === 'ch' ? ['Basel'] : ['Lyon']
                }
              }
            }
          },
          data: { country: 'ch', city: 'Basel' }
        })
        await findField('country').find('select').setValue('fr')
        await settle()
        expect(data.city).toBe(null)
      }
    )

    it('shows the errors of options that fail to load', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const { getErrors } = await mountForm({
        schema: {
          components: {
            genre: {
              type: 'select',
              options: {
                data: async () => {
                  throw new Error('Genres are unavailable')
                }
              }
            }
          }
        },
        data: { genre: null }
      })
      expect(getErrors('genre')).toEqual(['Genres are unavailable'])
    })

    // Bug: The error of each load is added to the errors of the previous
    // loads, as replacing the data loads the options again.
    test.fails(
      'shows the error of options that fail to load only once ' +
      'after the data is replaced',
      async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const { getErrors, routeComponent, settle } = await mountSchema({
          schema: {
            components: {
              genre: {
                type: 'select',
                options: {
                  data: async () => {
                    throw new Error('Genres are unavailable')
                  }
                }
              }
            }
          }
        })
        routeComponent.setData({ genre: null })
        await settle()
        expect(getErrors('genre')).toEqual(['Genres are unavailable'])
      }
    )
  })

  describe('values', () => {
    it(
      'replaces values without option with `null` once loaded, without ' +
      'making the form dirty',
      async () => {
        const { data, routeComponent } = await mountForm({
          schema: {
            components: {
              genre: {
                type: 'select',
                options: { data: async () => genres }
              }
            }
          },
          data: { genre: 'opera' }
        })
        expect(data.genre).toBe(null)
        expect(routeComponent.isDirty).toBe(false)
      }
    )

    it('computes a default option from the loaded options', async () => {
      const { data } = await mountSchema({
        schema: {
          components: {
            genre: {
              type: 'select',
              options: { data: async () => genres },
              compute: ({ value, options }) => value ?? options[0].value
            }
          }
        }
      })
      expect(data.genre).toBe('fiction')
    })

    it('clears the value with the clear button', async () => {
      const { findField, data } = await mountSchema({
        schema: {
          components: {
            genre: { type: 'select', options: genres, clearable: true }
          }
        },
        data: { genre: 'drama' }
      })
      await findField('genre').find('.dito-affixes__clear').trigger('click')
      expect(data.genre).toBe(null)
    })
  })

  describe('relate', () => {
    const teamSchema = {
      components: {
        members: {
          type: 'list',
          inlined: true,
          form: {
            type: 'form',
            components: { name: { type: 'text' } }
          }
        },
        captain: {
          type: 'select',
          relate: true,
          options: { dataPath: '../members', label: 'name' }
        }
      }
    }

    it('stores the related option objects as the value', async () => {
      const { findField, data } = await mountSchema({
        schema: teamSchema,
        data: {
          members: [
            { id: 1, name: 'Ada' },
            { id: 2, name: 'Grace' }
          ],
          captain: null
        }
      })
      const field = findField('captain')
      expect(getOptions(field)).toEqual([
        ['1', 'Ada'],
        ['2', 'Grace']
      ])
      await field.find('select').setValue('2')
      expect(data.captain).toBe(data.members[1])
    })

    it('replaces references with the related options', async () => {
      const { data } = await mountSchema({
        schema: teamSchema,
        data: {
          members: [
            { id: 1, name: 'Ada' },
            { id: 2, name: 'Grace' }
          ],
          captain: { id: 1 }
        }
      })
      expect(data.captain).toBe(data.members[0])
    })

    it('sends related objects as references with only their id', async () => {
      const { findField, submit } = await mountForm({
        schema: teamSchema,
        data: {
          members: [
            { id: 1, name: 'Ada' },
            { id: 2, name: 'Grace' }
          ],
          captain: null
        },
        request: ({ data }) => ({ data })
      })
      await findField('captain').find('select').setValue('2')
      const payload = await submit()
      expect(payload.captain).toEqual({ id: 2 })
      expect(payload.members).toEqual([
        { id: 1, name: 'Ada' },
        { id: 2, name: 'Grace' }
      ])
    })
  })
})

describe('DitoTypeRadio', () => {
  it('renders a radio button per option and selects the value', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        components: {
          genre: { type: 'radio', options: genres, layout: 'horizontal' }
        }
      },
      data: { genre: 'poetry' }
    })
    const field = findField('genre')
    expect(field.classes()).toContain('dito-layout--horizontal')
    const radios = field.findAll('input[type="radio"]')
    expect(field.findAll('label').map(label => label.text())).toEqual([
      'Fiction',
      'Poetry',
      'Drama'
    ])
    expect(radios.map(radio => radio.element.checked)).toEqual([
      false,
      true,
      false
    ])
    await radios[2].setValue(true)
    expect(data.genre).toBe('drama')
  })
})

describe('DitoTypeCheckboxes', () => {
  it('stores the values of the checked options as array', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        components: { genres: { type: 'checkboxes', options: genres } }
      }
    })
    expect(data.genres).toEqual([])
    const checkboxes = findField('genres').findAll('input[type="checkbox"]')
    await checkboxes[2].setValue(true)
    await checkboxes[0].setValue(true)
    expect(data.genres).toEqual(['drama', 'fiction'])
    await checkboxes[2].setValue(false)
    expect(data.genres).toEqual(['fiction'])
  })

  it(`doesn't check values without option once the options are loaded`, async () => {
    const { findField } = await mountSchema({
      schema: {
        components: {
          genres: {
            type: 'checkboxes',
            options: { data: async () => genres }
          }
        }
      },
      data: { genres: ['poetry', 'opera'] }
    })
    const checked = findField('genres')
      .findAll('input')
      .map(input => input.element.checked)
    expect(checked).toEqual([false, true, false])
  })
})
