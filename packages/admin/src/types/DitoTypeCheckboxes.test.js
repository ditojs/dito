import { mountSchema } from '../test/mount.js'

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
})
