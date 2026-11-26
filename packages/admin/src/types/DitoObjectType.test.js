import { h } from 'vue'
import { copyClipboardData } from '../utils/clipboard.js'
import { flushPromises } from '@vue/test-utils'
import {
  mountSchema,
  mountForm,
  enterValue,
  stubConfirm
} from '../test/mount.js'
import DitoSchemaField from '../components/DitoSchemaField.vue'

const addressForm = {
  type: 'form',
  label: 'Address',
  fields: {
    street: { type: 'text' },
    city: { type: 'text', default: 'Basel' }
  }
}

describe('DitoObjectType', () => {
  it('renders the inlined form of the object and edits it', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        fields: {
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
        fields: {
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
    expect(data.address).toBe(null)
    const field = findField('address')
    expect(field.find('input').exists()).toBe(false)
    await field.find('button.dito-create-button').trigger('click')
    await flushPromises()
    expect(data.address).toEqual({ street: null, city: 'Basel' })
    expect(findField('address').find('.dito-create-button').exists()).toBe(
      false
    )
  })

  it(`doesn't draw the frame of inlined objects without data or buttons`, async () => {
    const { findField } = await mountSchema({
      schema: {
        fields: {
          home: { type: 'object', inlined: true, form: addressForm },
          work: {
            type: 'object',
            inlined: true,
            creatable: true,
            form: addressForm
          },
          // Objects that aren't inlined keep their frame:
          office: { type: 'object', deletable: true, form: addressForm }
        }
      },
      data: { home: null, work: null, office: null }
    })
    expect(findField('home').classes()).toContain('dito-object--empty')
    expect(findField('office').classes()).not.toContain('dito-object--empty')
    expect(findField('work').classes()).not.toContain('dito-object--empty')
    expect(findField('work').find('.dito-create-button').exists()).toBe(true)
  })

  it('removes the object after confirmation', async () => {
    stubConfirm(true)
    const { findField, data } = await mountSchema({
      schema: {
        fields: {
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

  it('lays out the inlined form of the object with its component', async () => {
    const { wrapper, data, submit } = await mountForm({
      schema: {
        fields: {
          address: {
            type: 'object',
            inlined: true,
            form: {
              ...addressForm,
              component: {
                props: ['schema', 'context'],
                render: () =>
                  h('div', { class: 'layout' }, [
                    h(DitoSchemaField, { name: 'city' }),
                    h(DitoSchemaField, { name: 'street' })
                  ])
              }
            }
          }
        }
      },
      data: { address: { street: 'Main St', city: 'Bern' } },
      request: ({ data }) => ({ data })
    })
    const inputs = wrapper.findAll('.dito-object .layout input')
    expect(inputs.map(({ element }) => element.value)).toEqual([
      'Bern',
      'Main St'
    ])
    await enterValue(inputs[1], 'Side St')
    expect(data.address.street).toBe('Side St')
    expect(await submit()).toMatchObject({
      address: { street: 'Side St', city: 'Bern' }
    })
  })

  it("renders objects that aren't inlined with `render()`", async () => {
    const { findField } = await mountSchema({
      schema: {
        fields: {
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
        fields: {
          address: {
            type: 'object',
            form: addressForm,
            component: {
              props: { modelValue: { type: Object, required: true } },

              render() {
                return h('em', { class: 'city' }, this.modelValue.city)
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
        fields: {
          address: { type: 'object', form: addressForm, itemLabel: 'city' }
        }
      },
      data: { address: { street: 'Main St', city: 'Bern' } }
    })
    expect(findField('address').find('.dito-object__content').text()).toBe(
      'Bern'
    )
  })

  it('labels inlined objects only when they are collapsible', async () => {
    const { findField } = await mountSchema({
      schema: {
        fields: {
          home: {
            type: 'object',
            inlined: true,
            form: addressForm,
            itemLabel: 'city'
          },
          work: {
            type: 'object',
            label: false,
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

  describe('collapsible', () => {
    const review = {
      type: 'object',
      label: 'Review',
      inlined: true,
      collapsible: true,
      deletable: true,
      clipboard: true,
      form: addressForm
    }
    const data = { review: { street: 'Main St', city: 'Bern' } }

    it('toggles the object with the label of its field', async () => {
      const { findField, findContainer } = await mountSchema({
        schema: { fields: { review: { ...review, collapsed: true } } },
        data
      })
      const container = findContainer('review')
      const label = container.find(':scope > .dito-label')
      expect(container.findAll('.dito-chevron').length).toBe(1)
      expect(label.find('.dito-chevron--double').exists()).toBe(false)
      expect(findField('review').find('.dito-schema-header').exists()).toBe(
        false
      )
      const toggle = label.find('button.dito-label__content')
      expect(toggle.attributes('aria-expanded')).toBe('false')
      expect(findField('review').find('input').exists()).toBe(false)
      expect(findField('review').classes()).toContain('dito-object--empty')
      await toggle.trigger('click')
      await flushPromises()
      expect(toggle.attributes('aria-expanded')).toBe('true')
      expect(findField('review').find('input').exists()).toBe(true)
      expect(findField('review').classes()).not.toContain(
        'dito-object--empty'
      )
      await toggle.trigger('click')
      await flushPromises()
      expect(toggle.attributes('aria-expanded')).toBe('false')
      expect(findField('review').classes()).toContain('dito-object--empty')
    })

    it('opens to reveal the components with errors', async () => {
      const { findField, findContainer, submit } = await mountForm({
        schema: {
          fields: {
            review: {
              ...review,
              collapsed: true,
              form: {
                ...addressForm,
                fields: {
                  ...addressForm.fields,
                  street: { type: 'text', required: true }
                }
              }
            }
          }
        },
        data: { review: { street: '', city: 'Bern' } },
        request: ({ data }) => ({ data })
      })
      expect(findField('review').find('input').exists()).toBe(false)
      expect(await submit()).toBe(null)
      expect(findField('review').find('input').exists()).toBe(true)
      expect(
        findContainer('review')
          .find(':scope > .dito-label button.dito-label__content')
          .attributes('aria-expanded')
      ).toBe('true')
    })

    it('shows its clipboard and remove button in its label', async () => {
      const { findField, findContainer } = await mountSchema({
        schema: { fields: { review: { ...review, collapsed: true } } },
        data
      })
      const buttons = findContainer('review').find(
        ':scope > .dito-label .dito-label__buttons'
      )
      expect(buttons.find('.dito-clipboard').exists()).toBe(true)
      expect(buttons.find('.dito-button--remove').exists()).toBe(true)
      const field = findField('review')
      expect(field.classes()).toContain('dito-object--empty')
      expect(field.find('.dito-edit-buttons').exists()).toBe(false)
    })

    it('shows its create button in its label once removed', async () => {
      stubConfirm(true)
      const { findField, findContainer, data } = await mountSchema({
        schema: { fields: { review: { ...review, creatable: true } } },
        data: { review: { street: 'Main St', city: 'Bern' } }
      })
      const label = () => findContainer('review').find(':scope > .dito-label')
      await label().find('.dito-button--remove').trigger('click')
      await flushPromises()
      expect(data.review).toBe(null)
      // Without data, there's nothing to toggle, and no frame:
      expect(label().find('.dito-chevron').exists()).toBe(false)
      expect(findField('review').classes()).toContain('dito-object--empty')
      expect(findField('review').find('.dito-create-button').exists()).toBe(
        false
      )
      await label().find('.dito-create-button').trigger('click')
      await flushPromises()
      expect(data.review).toEqual({ street: null, city: 'Basel' })
      // The created object opens:
      expect(findField('review').classes()).not.toContain('dito-object--empty')
      expect(findField('review').find('input').exists()).toBe(true)
      expect(
        label().find('button.dito-label__content').attributes('aria-expanded')
      ).toBe('true')
      expect(label().find('.dito-create-button').exists()).toBe(false)
      expect(label().find('.dito-button--remove').exists()).toBe(true)
    })

    it('keeps its own header without a label', async () => {
      const { findField, findContainer } = await mountSchema({
        schema: { fields: { review: { ...review, label: false } } },
        data
      })
      expect(
        findContainer('review').find(':scope > .dito-label').exists()
      ).toBe(false)
      const header = findField('review').find('.dito-schema-header')
      expect(header.find('button.dito-label .dito-chevron').exists()).toBe(
        true
      )
      expect(header.find('.dito-button--remove').exists()).toBe(true)
    })
  })

  describe('clipboard', () => {
    const address = {
      type: 'object',
      label: 'Address',
      inlined: true,
      deletable: true,
      clipboard: true,
      form: addressForm
    }
    const data = { address: { street: 'Main St', city: 'Bern' } }

    afterEach(() => copyClipboardData('reset', null))

    it('pastes copies into empty objects, which creates them', async () => {
      stubConfirm(true)
      const { findField, findContainer, data } = await mountSchema({
        schema: { fields: { address } },
        data: { address: { street: 'Main St', city: 'Bern' } }
      })
      const label = findContainer('address').find(':scope > .dito-label')
      const findButton = verb => label.find(`.dito-button--${verb}`)
      await findButton('copy').trigger('click')
      await flushPromises()
      await findButton('remove').trigger('click')
      await flushPromises()
      expect(data.address).toBe(null)
      expect(findField('address').classes()).toContain('dito-object--empty')
      // Empty objects have nothing to copy, but take pastes:
      expect(findButton('copy').attributes('disabled')).toBeDefined()
      expect(findButton('paste').attributes('disabled')).toBeUndefined()
      await findButton('paste').trigger('click')
      await flushPromises()
      expect(data.address).toEqual({ street: 'Main St', city: 'Bern' })
      expect(findField('address').classes()).not.toContain('dito-object--empty')
      expect(findField('address').find('input').element.value).toBe('Main St')
    })

    it('shows its clipboard in its frame without a label or data', async () => {
      await copyClipboardData('address', { street: 'Side St', city: 'Basel' })
      const { findField, data } = await mountSchema({
        schema: { fields: { address: { ...address, label: false } } },
        data: { address: null }
      })
      const buttons = () =>
        findField('address').find(':scope > .dito-label-buttons')
      expect(findField('address').classes()).not.toContain('dito-object--empty')
      expect(buttons().find('.dito-create-button').exists()).toBe(false)
      await buttons().find('.dito-button--paste').trigger('click')
      await flushPromises()
      expect(data.address).toEqual({ street: 'Side St', city: 'Basel' })
      // With data, the clipboard returns next to the remove button:
      expect(buttons().exists()).toBe(false)
      expect(
        findField('address')
          .find(
            '.dito-schema-content + .dito-schema__buttons' +
            ' > .dito-label-buttons:has(.dito-clipboard) + .dito-edit-buttons'
          )
          .exists()
      ).toBe(true)
    })

    it('shows the clipboard in the row of its label', async () => {
      const { findField, findContainer } = await mountSchema({
        schema: { fields: { address } },
        data
      })
      const label = findContainer('address').find(':scope > .dito-label')
      expect(
        label.find('.dito-label__buttons .dito-clipboard').exists()
      ).toBe(true)
      const field = findField('address')
      expect(field.find('.dito-schema-header').exists()).toBe(false)
      expect(field.find('.dito-clipboard').exists()).toBe(false)
      // The remove button joins it, and only collapsible objects toggle:
      expect(label.find('.dito-label__buttons .dito-button--remove').exists())
        .toBe(true)
      expect(field.find('.dito-edit-buttons').exists()).toBe(false)
      expect(label.find('.dito-chevron').exists()).toBe(false)
    })

    it('keeps only the row of its label once removed', async () => {
      stubConfirm(true)
      const { findField, findContainer, data } = await mountSchema({
        schema: { fields: { address } },
        data: { address: { street: 'Main St', city: 'Bern' } }
      })
      const label = findContainer('address').find(':scope > .dito-label')
      await label.find('.dito-button--remove').trigger('click')
      await flushPromises()
      expect(data.address).toBe(null)
      expect(findField('address').classes()).toContain('dito-object--empty')
      expect(
        findContainer('address').find('.dito-edit-buttons').exists()
      ).toBe(false)
    })

    it('shows the clipboard next to its buttons without a label', async () => {
      const { findField, findContainer } = await mountSchema({
        schema: { fields: { address: { ...address, label: false } } },
        data
      })
      expect(
        findContainer('address').find(':scope > .dito-label').exists()
      ).toBe(false)
      const field = findField('address')
      expect(field.find('.dito-schema-header').exists()).toBe(false)
      expect(
        field
          .find(
            '.dito-schema-content + .dito-schema__buttons' +
            ' > .dito-label-buttons:has(.dito-clipboard) + .dito-edit-buttons'
          )
          .exists()
      ).toBe(true)
    })
  })

  it("doesn't pass a `path` attribute to its buttons", async () => {
    const { findField } = await mountSchema({
      schema: {
        fields: {
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
        fields: {
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
