import { mountSchema, mountForm } from '../test/mount.js'

describe('DitoTypeCheckbox', () => {
  it('checks the checkbox for `true` and writes the checked state', async () => {
    const { findField, data } = await mountSchema({
      schema: { components: { isRead: { type: 'checkbox' } } },
      data: { isRead: true }
    })
    const checkbox = findField('isRead').find('input[type="checkbox"]')
    expect(checkbox.element.checked).toBe(true)
    await checkbox.setValue(false)
    expect(data.isRead).toBe(false)
  })

  it('disables readonly checkboxes, as only text fields support readonly', async () => {
    const { findField } = await mountSchema({
      schema: {
        components: { isRead: { type: 'checkbox', readonly: true } }
      }
    })
    const checkbox = findField('isRead').find('input')
    expect(checkbox.attributes('disabled')).toBeDefined()
  })
})

describe('DitoTypeSwitch', () => {
  it('defaults to `false` and toggles the value', async () => {
    const { findField, data } = await mountSchema({
      schema: { components: { isPublic: { type: 'switch' } } }
    })
    expect(data.isPublic).toBe(false)
    await findField('isPublic').find('input').setValue(true)
    expect(data.isPublic).toBe(true)
  })

  it('displays the labels of the checked state', async () => {
    const { findField, data, settle } = await mountSchema({
      schema: {
        components: {
          isPublic: {
            type: 'switch',
            labels: { checked: 'Public', unchecked: 'Private' }
          }
        }
      },
      data: { isPublic: true }
    })
    const label = () => findField('isPublic').find('.dito-switch__label')
    expect(label().text()).toBe('Public')
    data.isPublic = false
    await settle()
    expect(label().text()).toBe('Private')
  })

  it('sends the switched value', async () => {
    const { findField, submit } = await mountForm({
      schema: { components: { isPublic: { type: 'switch' } } },
      data: { isPublic: false },
      request: ({ data }) => ({ data })
    })
    await findField('isPublic').find('input').setValue(true)
    expect(await submit()).toMatchObject({ isPublic: true })
  })
})
