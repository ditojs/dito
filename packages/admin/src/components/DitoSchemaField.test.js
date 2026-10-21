import { vi } from 'vitest'
import { h } from 'vue'
import {
  mountAdmin,
  mountSchema,
  mountForm,
  enterValue
} from '../test/mount.js'
import DitoSchemaField from './DitoSchemaField.vue'

// A layout component that places the fields of `names` with `DitoSchemaField`:
function createLayout(...names) {
  return {
    props: {
      schema: { type: Object, required: true },
      context: { type: Object, required: true }
    },

    render() {
      return h(
        'div',
        { class: 'layout' },
        names.map(name => h(DitoSchemaField, { name }))
      )
    }
  }
}

// A custom component that renders the content of its slot next to its track:
const Slider = {
  emits: ['update:modelValue', 'change'],

  props: {
    schema: { type: Object, required: true },
    context: { type: Object, required: true },
    modelValue: { type: Number, default: null }
  },

  render() {
    return h('div', { class: 'slider' }, [
      h('span', { class: 'slider__track' }),
      this.$slots.default?.()
    ])
  }
}

describe('DitoSchemaField', () => {
  it('places the components of layout sections with labels', async () => {
    const { findContainer, wrapper } = await mountSchema({
      schema: {
        fields: {
          details: {
            type: 'section',
            label: 'Details',
            component: createLayout('subtitle', 'title'),
            fields: {
              title: { type: 'text', label: 'Title' },
              subtitle: { type: 'text', label: 'Subtitle' }
            }
          }
        }
      },
      data: { title: 'Emma', subtitle: 'A Novel' }
    })
    const layout = wrapper.find('.dito-section .layout')
    expect(
      layout
        .findAll(':scope > .dito-container > .dito-label')
        .map(label => label.text())
    ).toEqual(['Subtitle', 'Title'])
    expect(
      layout.findAll('input').map(({ element }) => element.value)
    ).toEqual(['A Novel', 'Emma'])
    // The section's label shows above the layout, like the label of a field:
    const container = findContainer('details')
    expect(container.find(':scope > .dito-label').text()).toBe('Details')
    expect(container.find('.dito-schema-header').exists()).toBe(false)
  })

  it('shows the errors of the components after validation', async () => {
    const { wrapper, submit } = await mountForm({
      schema: {
        fields: {
          details: {
            type: 'section',
            component: createLayout('title'),
            fields: { title: { type: 'text', required: true } }
          }
        }
      },
      data: { title: '' },
      request: ({ data }) => ({ data })
    })
    const getErrors = () =>
      wrapper.findAll('.layout .dito-errors li').map(item => item.text())
    expect(getErrors()).toEqual([])
    expect(await submit()).toBe(null)
    expect(getErrors()).toEqual(['The Title field is required.'])
  })

  it('edits and submits the data like the pane', async () => {
    const { wrapper, routeComponent, data, submit } = await mountForm({
      schema: {
        fields: {
          dimensions: {
            type: 'section',
            nested: true,
            component: createLayout('width'),
            fields: { width: { type: 'number' } }
          }
        }
      },
      data: { dimensions: { width: 10 } },
      request: ({ data }) => ({ data })
    })
    expect(routeComponent.routeContext.isDirty).toBe(false)
    await enterValue(wrapper.find('.layout input'), '12')
    expect(data.dimensions).toEqual({ width: 12 })
    expect(routeComponent.routeContext.isDirty).toBe(true)
    expect(await submit()).toMatchObject({ dimensions: { width: 12 } })
  })

  it('validates the components that the layout leaves out', async () => {
    const { submit, findField } = await mountForm({
      schema: {
        fields: {
          details: {
            type: 'section',
            component: createLayout('title'),
            fields: {
              title: { type: 'text' },
              subtitle: { type: 'text', required: true }
            }
          }
        }
      },
      data: { title: 'Emma', subtitle: '' },
      request: ({ data }) => ({ data })
    })
    expect(findField('subtitle').exists()).toBe(false)
    expect(await submit()).toBe(null)
  })

  it('disables the components with the section and their schema', async () => {
    const { wrapper, data, settle } = await mountSchema({
      schema: {
        fields: {
          isLocked: { type: 'checkbox' },
          details: {
            type: 'section',
            disabled: ({ item }) => item.isLocked,
            component: createLayout('title', 'subtitle'),
            fields: {
              title: { type: 'text' },
              subtitle: { type: 'text', disabled: true }
            }
          }
        }
      },
      data: { isLocked: true }
    })
    const getDisabled = () =>
      wrapper
        .findAll('.layout input')
        .map(({ element }) => [element.name, element.disabled])
    expect(getDisabled()).toEqual([
      ['title', true],
      ['subtitle', true]
    ])
    data.isLocked = false
    await settle()
    expect(getDisabled()).toEqual([
      ['title', false],
      ['subtitle', true]
    ])
  })

  it('renders the components conditionally with `if`', async () => {
    const { wrapper, data, settle } = await mountSchema({
      schema: {
        fields: {
          details: {
            type: 'section',
            component: createLayout('hasSubtitle', 'subtitle'),
            fields: {
              hasSubtitle: { type: 'checkbox' },
              subtitle: { type: 'text', if: ({ item }) => item.hasSubtitle }
            }
          }
        }
      },
      data: { hasSubtitle: false }
    })
    const hasSubtitle = () =>
      wrapper.find('.layout input[name="subtitle"]').exists()
    expect(hasSubtitle()).toBe(false)
    data.hasSubtitle = true
    await settle()
    expect(hasSubtitle()).toBe(true)
  })

  it('fires the handlers of the section for its components', async () => {
    const onChange = vi.fn()
    const { wrapper } = await mountForm({
      schema: {
        fields: {
          details: {
            type: 'section',
            onChange,
            component: createLayout('title'),
            fields: { title: { type: 'text' } }
          }
        }
      },
      data: { title: 'Emma' }
    })
    await enterValue(wrapper.find('.layout input'), 'Persuasion')
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange.mock.calls[0][0].dataPath).toBe('title')
  })

  it('passes its slot on to custom components', async () => {
    const Row = {
      props: { schema: Object, context: Object },
      render: () =>
        h(DitoSchemaField, { name: 'values' }, () =>
          h(DitoSchemaField, { name: 'isStatic' })
        )
    }
    const { findField, data } = await mountSchema({
      schema: {
        fields: {
          axis: {
            type: 'section',
            component: Row,
            fields: {
              values: { type: 'component', component: Slider, default: 0 },
              isStatic: { type: 'switch', label: 'Static' }
            }
          }
        }
      },
      data: { values: 4, isStatic: false }
    })
    const slider = findField('values')
    const input = slider.find('.slider__track + .dito-container input')
    // The field's path doesn't include the field whose slot holds it:
    expect(input.attributes('id')).toBe('axis/isStatic')
    await input.setValue(true)
    expect(data.isStatic).toBe(true)
  })

  it('focuses invalid components in the slots of other fields', async () => {
    const Row = {
      props: { schema: Object, context: Object },
      render: () =>
        h(DitoSchemaField, { name: 'values' }, () =>
          h(DitoSchemaField, { name: 'note' })
        )
    }
    const { findField, submit } = await mountForm({
      schema: {
        fields: {
          axis: {
            type: 'section',
            component: Row,
            fields: {
              values: { type: 'component', component: Slider, default: 0 },
              note: { type: 'text', required: true }
            }
          }
        }
      },
      data: { values: 4, note: '' },
      request: ({ data }) => ({ data })
    })
    expect(await submit()).toBe(null)
    expect(document.activeElement).toBe(findField('note').find('input').element)
  })

  it.each([
    [
      'unknown components',
      {
        type: 'section',
        component: createLayout('subtitle'),
        fields: { heading: { type: 'text' } }
      },
      `Unknown component: 'subtitle'.`
    ],
    [
      'components outside of layout sections',
      { type: 'component', component: createLayout('title') },
      `Unable to place 'title' outside of sections with 'component'.`
    ]
  ])('throws for %s', async (_, details, message) => {
    const admin = await mountAdmin({
      views: {
        test: {
          type: 'view',
          fields: { title: { type: 'text' }, details }
        }
      }
    })
    const errorHandler = vi.fn()
    admin.app.config.errorHandler = errorHandler
    await admin.navigate('/test')
    expect(errorHandler).toHaveBeenCalledWith(
      new Error(message),
      expect.anything(),
      expect.anything()
    )
  })
})
