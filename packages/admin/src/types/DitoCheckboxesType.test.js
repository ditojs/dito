import { html } from '@ditojs/utils'
import {
  mountForm,
  mountSchema,
  mountAdminWithGenresView
} from '../test/mount.js'

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

describe('DitoCheckboxesType', () => {
  it('stores the values of the checked options as array', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        fields: { genres: { type: 'checkboxes', options: genres } }
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
        fields: { genres: { type: 'checkboxes', options: genres } }
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
        fields: {
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
        fields: {
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

  it('keeps values without option when checking others', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        fields: { genres: { type: 'checkboxes', options: genres } }
      },
      data: { genres: ['poetry', 'opera'] }
    })
    await findField('genres').findAll('input')[2].setValue(true)
    expect(data.genres).toEqual(['poetry', 'opera', 'drama'])
  })

  it('checks the checkboxes of the selected values', async () => {
    const { findField } = await mountSchema({
      schema: {
        fields: { ratings: { type: 'checkboxes', options: ratings } }
      },
      data: { ratings: [1, 2] }
    })
    expect(getCheckedStates(findField('ratings'))).toEqual([false, true, true])
  })

  it('keeps falsy option values like `0` selected', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        fields: { ratings: { type: 'checkboxes', options: ratings } }
      },
      data: { ratings: [0] }
    })
    const field = findField('ratings')
    expect(getCheckedStates(field)).toEqual([true, false, false])
    await field.findAll('input[type="checkbox"]')[2].setValue(true)
    expect(data.ratings).toEqual([0, 2])
  })

  it('keeps falsy plain option values like `0` selected', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        fields: { ratings: { type: 'checkboxes', options: [0, 1, 2] } }
      },
      data: { ratings: [0, 2] }
    })
    const field = findField('ratings')
    expect(getCheckedStates(field)).toEqual([true, false, true])
    await field.findAll('input[type="checkbox"]')[1].setValue(true)
    expect(data.ratings).toEqual([0, 2, 1])
  })

  it('focuses the first checkbox', async () => {
    const { focusField, findField } = await mountSchema({
      schema: {
        fields: { genres: { type: 'checkboxes', options: genres } }
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
        fields: {
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
        fields: {
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
        fields: {
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
      fields: {
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
        fields: {
          genres: {
            type: 'checkboxes',
            label: html`<b>Genres</b> &amp; forms`,
            options: genres
          }
        }
      }
    })
    expect(findField('genres').attributes('aria-label')).toBe('Genres & forms')
  })

  it('sends checked new rows of a list as `#ref`s to their `#id`s', async () => {
    // A license links shop items of its order: the options come from the
    // order's items, and new items have no ids yet.
    const changes = []
    const { findField, data, submit } = await mountForm({
      schema: {
        // An order form that sends the serialized order to price it on each
        // change:
        onChange: ({ dataPath, serializedRootItem }) => {
          if (dataPath.startsWith('licenses')) {
            changes.push(structuredClone(serializedRootItem))
          }
        },
        fields: {
          shopItems: {
            type: 'list',
            inlined: true,
            forms: {
              font: { type: 'form', fields: { name: { type: 'text' } } },
              charge: { type: 'form', fields: { name: { type: 'text' } } }
            }
          },
          licenses: {
            type: 'list',
            inlined: true,
            form: {
              type: 'form',
              fields: {
                name: { type: 'text' },
                shopItems: {
                  type: 'checkboxes',
                  relate: true,
                  options: {
                    data: ({ parentItem: order }) => order.shopItems,
                    dataPath: '/shopItems',
                    label: 'name'
                  }
                }
              }
            }
          }
        }
      },
      data: {
        shopItems: [
          { id: 1, type: 'font', name: 'Old' },
          { type: 'font', name: 'A' },
          { type: 'charge', name: 'B' }
        ],
        licenses: [{ name: 'L', shopItems: [] }]
      },
      request: ({ data }) => ({ data })
    })
    const checkboxes = findField('licenses/0/shopItems').findAll(
      'input[type="checkbox"]'
    )
    await checkboxes[2].setValue(true)
    expect(data.licenses[0].shopItems).toEqual([data.shopItems[2]])
    const payload = await submit()
    const reference = payload.shopItems[2]['#id']
    expect(reference).toEqual(expect.any(String))
    expect(payload.shopItems).toEqual([
      { id: 1, type: 'font', name: 'Old' },
      { type: 'font', name: 'A' },
      { '#id': reference, 'type': 'charge', 'name': 'B' }
    ])
    expect(payload.licenses[0].shopItems).toEqual([{ '#ref': reference }])
    const [change] = changes
    expect(change.shopItems[2]['#id']).toEqual(expect.any(String))
    expect(change.licenses[0].shopItems).toEqual([
      { '#ref': change.shopItems[2]['#id'] }
    ])
  })

  it('sends checked created rows as `#ref`s to their `#id`s', async () => {
    const changes = []
    const itemForm = { type: 'form', fields: { name: { type: 'text' } } }
    const { findField, getComponent, settle, submit } = await mountForm({
      schema: {
        onChange: ({ dataPath, serializedRootItem }) => {
          if (dataPath.startsWith('licenses')) {
            changes.push(structuredClone(serializedRootItem))
          }
        },
        fields: {
          shopItems: {
            type: 'list',
            inlined: true,
            forms: { font: itemForm }
          },
          licenses: {
            type: 'list',
            inlined: true,
            form: {
              type: 'form',
              fields: {
                shopItems: {
                  type: 'checkboxes',
                  relate: true,
                  options: {
                    data: ({ parentItem: order }) => order.shopItems,
                    dataPath: '/shopItems',
                    label: 'name'
                  }
                }
              }
            }
          }
        }
      },
      data: {
        shopItems: [{ id: 1, type: 'font', name: 'Old' }],
        licenses: [{ id: 1, shopItems: [{ id: 1 }] }]
      },
      request: ({ data }) => ({ data })
    })
    const list = getComponent('shopItems')
    list.sourceContext.createItem(itemForm, 'font')
    list.sourceContext.createItem(itemForm, 'font')
    await settle()
    const inputs = findField('shopItems').findAll('input[type="text"]')
    await inputs[1].setValue('A')
    await inputs[2].setValue('B')
    await settle()
    const checkboxes = findField('licenses/0/shopItems').findAll(
      'input[type="checkbox"]'
    )
    await checkboxes[2].setValue(true)
    await settle()
    const payload = await submit()
    const reference = payload.shopItems[2]['#id']
    expect(reference).toEqual(expect.any(String))
    expect(payload.shopItems[1]).not.toHaveProperty('#id')
    expect(payload.licenses[0].shopItems).toEqual([
      { id: 1 },
      { '#ref': reference }
    ])
    const change = changes.at(-1)
    expect(change.licenses[0].shopItems).toEqual([
      { id: 1 },
      { '#ref': change.shopItems[2]['#id'] }
    ])
  })
})
