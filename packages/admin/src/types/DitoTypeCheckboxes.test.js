import { mountSchema, mountAdminWithGenresView } from '../test/mount.js'

const genres = [
  { value: 'fiction', label: 'Fiction' },
  { value: 'poetry', label: 'Poetry' },
  { value: 'drama', label: 'Drama' }
]

const ratings = [
  { value: 0, label: 'None' },
  { value: 1, label: 'One' },
  { value: 2, label: 'Two' }
]

function getCheckedStates(field) {
  return field
    .findAll('input[type="checkbox"]')
    .map(checkbox => checkbox.element.checked)
}

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

  it('loads `null` values as empty arrays', async () => {
    const { findField, data, dataModel } = await mountSchema({
      schema: {
        components: { genres: { type: 'checkboxes', options: genres } }
      },
      data: { genres: null }
    })
    expect(data.genres).toEqual([])
    expect(dataModel.isEdited).toBe(false)
    const field = findField('genres')
    expect(getCheckedStates(field)).toEqual([false, false, false])
    await field.findAll('input[type="checkbox"]')[1].setValue(true)
    expect(data.genres).toEqual(['poetry'])
  })

  it('loads `null` values as the `default`', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        components: {
          genres: { type: 'checkboxes', options: genres, default: ['drama'] }
        }
      },
      data: { genres: null }
    })
    expect(data.genres).toEqual(['drama'])
    expect(getCheckedStates(findField('genres'))).toEqual([false, false, true])
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

  it('checks the checkboxes of the selected values', async () => {
    const { findField } = await mountSchema({
      schema: {
        components: { ratings: { type: 'checkboxes', options: ratings } }
      },
      data: { ratings: [1, 2] }
    })
    expect(getCheckedStates(findField('ratings'))).toEqual([false, true, true])
  })

  it('keeps falsy option values like `0` selected', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        components: { ratings: { type: 'checkboxes', options: ratings } }
      },
      data: { ratings: [0] }
    })
    const field = findField('ratings')
    expect(getCheckedStates(field)).toEqual([true, false, false])
    await field.findAll('input[type="checkbox"]')[2].setValue(true)
    expect(data.ratings).toEqual([0, 2])
  })

  it('focuses the first checkbox', async () => {
    const { focusField, findField } = await mountSchema({
      schema: {
        components: { genres: { type: 'checkboxes', options: genres } }
      }
    })
    await focusField('genres')
    expect(document.activeElement).toBe(
      findField('genres').find('input[type="checkbox"]').element
    )
  })

  it('lists the options of each group in a fieldset with `options.group`', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        components: {
          books: {
            type: 'checkboxes',
            options: {
              data: [
                { value: 'emma', label: 'Emma', shelf: 'Classics' },
                { value: 'dune', label: 'Dune', shelf: 'Sci-Fi' },
                { value: 'persuasion', label: 'Persuasion', shelf: 'Classics' }
              ],
              group: 'shelf'
            }
          }
        }
      },
      data: { books: ['dune'] }
    })
    const field = findField('books')
    const fieldsets = field.findAll('fieldset')
    expect(
      fieldsets.map(fieldset => fieldset.find('legend').text())
    ).toEqual(['Classics', 'Sci-Fi'])
    expect(
      fieldsets.map(fieldset =>
        fieldset.findAll('label').map(label => label.text())
      )
    ).toEqual([['Emma', 'Persuasion'], ['Dune']])
    expect(getCheckedStates(field)).toEqual([false, false, true])
    await field.findAll('input[type="checkbox"]')[1].setValue(true)
    expect(data.books).toEqual(['dune', 'persuasion'])
  })

  it('groups the options by the result of an `options.group` callback', async () => {
    const { findField } = await mountSchema({
      schema: {
        components: {
          books: {
            type: 'checkboxes',
            options: {
              data: [
                { value: 'emma', label: 'Emma', year: 1815 },
                { value: 'dune', label: 'Dune', year: 1965 },
                { value: 'persuasion', label: 'Persuasion', year: 1817 }
              ],
              group: ({ option }) => (option.year < 1900 ? 'Classic' : 'Modern')
            }
          }
        }
      }
    })
    const fieldsets = findField('books').findAll('fieldset')
    expect(
      fieldsets.map(fieldset => [
        fieldset.find('legend').text(),
        fieldset.findAll('label').map(label => label.text())
      ])
    ).toEqual([
      ['Classic', ['Emma', 'Persuasion']],
      ['Modern', ['Dune']]
    ])
  })

  it('selects a single value with `multiple: false`', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        components: {
          rating: { type: 'checkboxes', multiple: false, options: ratings }
        }
      },
      data: { rating: 1 }
    })
    const field = findField('rating')
    const checkboxes = field.findAll('input[type="checkbox"]')
    expect(getCheckedStates(field)).toEqual([false, true, false])
    // Checking another checkbox unchecks the checked one:
    await checkboxes[2].setValue(true)
    expect(data.rating).toBe(2)
    expect(getCheckedStates(field)).toEqual([false, false, true])
    await checkboxes[2].setValue(false)
    expect(data.rating).toBe(null)
  })

  it('links each option to its form in `view` when `editable`', async () => {
    const { admin } = await mountAdminWithGenresView({
      components: {
        genres: {
          type: 'checkboxes',
          editable: true,
          view: 'genres',
          options: {
            data: [
              { id: 1, name: 'Fiction' },
              { id: 2, name: 'Poetry' }
            ],
            value: 'id',
            label: 'name'
          }
        }
      },
      data: { genres: [] }
    })
    const links = admin.wrapper
      .find('.dito-checkboxes')
      .findAll('.dito-options-edit-buttons a')
    expect(links.map(link => link.attributes('href'))).toEqual([
      '/genres/1',
      '/genres/2'
    ])
  })

  it('labels the group with the text of its label', async () => {
    const { findField } = await mountSchema({
      schema: {
        components: {
          genres: {
            type: 'checkboxes',
            label: { html: '<b>Genres</b> &amp; forms' },
            options: genres
          }
        }
      }
    })
    expect(findField('genres').attributes('aria-label')).toBe('Genres & forms')
  })
})
