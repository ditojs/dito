import { h } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSchema, mountForm, stubConfirm } from '../test/mount.js'

const addressForm = {
  type: 'form',
  label: 'Address',
  components: {
    street: { type: 'text' },
    city: { type: 'text', default: 'Basel' }
  }
}

describe('DitoTypeObject', () => {
  it('renders the inlined form of the object and edits it', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        components: {
          address: { type: 'object', inlined: true, form: addressForm }
        }
      },
      data: { address: { street: 'Main St', city: 'Bern' } }
    })
    const field = findField('address')
    const street = field.find('input[name="address/street"]')
    expect(street.element.value).toBe('Main St')
    await street.setValue('Side St')
    expect(data.address.street).toBe('Side St')
  })

  it('creates the object with the defaults of its form', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        components: {
          address: {
            type: 'object',
            inlined: true,
            creatable: true,
            form: addressForm
          }
        }
      },
      data: { address: null }
    })
    const field = findField('address')
    expect(field.find('input').exists()).toBe(false)
    await field.find('.dito-create-button button').trigger('click')
    await flushPromises()
    expect(data.address).toEqual({ street: null, city: 'Basel' })
    expect(findField('address').find('.dito-create-button').exists()).toBe(
      false
    )
  })

  it('removes the object after confirmation', async () => {
    stubConfirm(true)
    const { findField, data } = await mountSchema({
      schema: {
        components: {
          address: {
            type: 'object',
            inlined: true,
            deletable: true,
            form: addressForm
          }
        }
      },
      data: { address: { street: 'Main St', city: 'Bern' } }
    })
    await findField('address').find('.dito-button--remove').trigger('click')
    await flushPromises()
    expect(data.address).toBe(null)
  })

  it("renders objects that aren't inlined with `render()`", async () => {
    const { findField } = await mountSchema({
      schema: {
        components: {
          address: {
            type: 'object',
            form: addressForm,
            render: ({ item }) => `${item.street}, ${item.city}`
          }
        }
      },
      data: { address: { street: 'Main St', city: 'Bern' } }
    })
    expect(findField('address').text()).toContain('Main St, Bern')
  })

  it("renders objects that aren't inlined with their `component`", async () => {
    const { findField } = await mountSchema({
      schema: {
        components: {
          address: {
            type: 'object',
            form: addressForm,
            component: {
              render() {
                return h('em', { class: 'city' }, this.data.city)
              }
            }
          }
        }
      },
      data: { address: { street: 'Main St', city: 'Bern' } }
    })
    expect(findField('address').find('em.city').text()).toBe('Bern')
  })

  it(`renders objects that aren't inlined with their label`, async () => {
    const { findField } = await mountSchema({
      schema: {
        components: {
          address: { type: 'object', form: addressForm, itemLabel: 'city' }
        }
      },
      data: { address: { street: 'Main St', city: 'Bern' } }
    })
    expect(findField('address').find('.dito-object-content').text()).toBe(
      'Bern'
    )
  })

  it('labels inlined objects only when they are collapsible', async () => {
    const { findField } = await mountSchema({
      schema: {
        components: {
          home: {
            type: 'object',
            inlined: true,
            form: addressForm,
            itemLabel: 'city'
          },
          work: {
            type: 'object',
            inlined: true,
            collapsible: true,
            form: addressForm,
            itemLabel: 'city'
          }
        }
      },
      data: {
        home: { street: 'Main St', city: 'Bern' },
        work: { street: 'Side St', city: 'Basel' }
      }
    })
    const findSchemaLabel = dataPath =>
      findField(dataPath).find('.dito-schema-header .dito-label')
    expect(findSchemaLabel('home').exists()).toBe(false)
    expect(findSchemaLabel('work').text()).toContain('Basel')
  })

  it("doesn't pass a `path` attribute to its buttons", async () => {
    const { findField } = await mountSchema({
      schema: {
        components: {
          address: { type: 'object', editable: true, form: addressForm }
        }
      },
      data: { address: { street: 'Main St', city: 'Bern' } }
    })
    const buttons = findField('address').find('.dito-edit-buttons')
    expect(buttons.exists()).toBe(true)
    expect(buttons.attributes('path')).toBeUndefined()
  })

  it('sends the values of the object', async () => {
    const { findField, submit } = await mountForm({
      schema: {
        components: {
          address: { type: 'object', inlined: true, form: addressForm }
        }
      },
      data: { address: { street: 'Main St', city: 'Bern' } },
      request: ({ data }) => ({ data })
    })
    await findField('address')
      .find('input[name="address/city"]')
      .setValue('Zurich')
    expect(await submit()).toMatchObject({
      address: { street: 'Main St', city: 'Zurich' }
    })
  })
})
