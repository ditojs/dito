import { mountSchema, mountAdminWithGenresView } from '../test/mount.js'

const genres = [
  { value: 'fiction', label: 'Fiction' },
  { value: 'poetry', label: 'Poetry' },
  { value: 'drama', label: 'Drama' }
]

const books = [
  { value: 'emma', label: 'Emma', shelf: 'Classics' },
  { value: 'dune', label: 'Dune', shelf: 'Sci-Fi' },
  { value: 'persuasion', label: 'Persuasion', shelf: 'Classics' }
]

function getRadioButtons(field) {
  return field.findAll('input[type="radio"]')
}

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
    const radios = getRadioButtons(field)
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

  it('focuses the first radio button', async () => {
    const { getComponent, findField } = await mountSchema({
      schema: { components: { genre: { type: 'radio', options: genres } } }
    })
    getComponent('genre').focusElement()
    expect(document.activeElement).toBe(
      getRadioButtons(findField('genre'))[0].element
    )
  })

  it('lists the options of each group in a fieldset with `groupBy`', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        components: {
          book: { type: 'radio', groupBy: 'shelf', options: books }
        }
      },
      data: { book: null }
    })
    const field = findField('book')
    const fieldsets = field.findAll('fieldset')
    expect(
      fieldsets.map(fieldset => fieldset.find('legend').text())
    ).toEqual(['Classics', 'Sci-Fi'])
    expect(
      fieldsets.map(fieldset =>
        fieldset.findAll('label').map(label => label.text())
      )
    ).toEqual([['Emma', 'Persuasion'], ['Dune']])
    await getRadioButtons(field)[1].setValue(true)
    expect(data.book).toBe('persuasion')
  })

  it('links each option to its form in `view` when `editable`', async () => {
    const { admin } = await mountAdminWithGenresView({
      components: {
        genre: {
          type: 'radio',
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
      data: { genre: null }
    })
    const links = admin.wrapper
      .find('.dito-radio-buttons')
      .findAll('.dito-options-edit-buttons a')
    expect(links.map(link => link.attributes('href'))).toEqual([
      '/genres/1',
      '/genres/2'
    ])
  })
})
