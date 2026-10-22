import { vi } from 'vitest'
import { h, nextTick, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountAdmin, enterValue } from '../test/mount.js'
import {
  useDitoForm,
  DitoSchemaForm,
  DitoTextField,
  DitoNumberField,
  DitoSwitchField,
  DitoSection
} from '../index.js'

const properties = {
  name: { type: 'string', required: true, maxLength: 40 },
  email: { type: 'string', format: 'email', nullable: true },
  isFeatured: { type: 'boolean', default: false },
  rank: { type: 'integer', minimum: 1, if: ({ item }) => item.isFeatured },
  award: { type: 'string', if: ({ item }) => item.isFeatured },
  importName: { type: 'string', exclude: true },
  address: {
    type: 'object',
    properties: { city: { type: 'string', required: true } }
  }
}

// A component of the page that lays out widgets of the form:
const RankFields = {
  setup: () => () => h('div', [h(DitoNumberField, { name: 'rank', step: 1 })])
}

// The form of the page, and whether its template shows the name and email:
let form = null
const showsName = ref(true)
const showsEmail = ref(true)

// A designer-like page, which lays out its properties with widgets:
const DesignerPage = {
  setup() {
    form = useDitoForm({ resource: 'designers', id: 7, properties })
    return () =>
      h(DitoSchemaForm, null, {
        default: () => [
          showsName.value
            ? h(DitoTextField, { name: 'name', width: '1/2' })
            : null,
          showsEmail.value
            ? h(DitoTextField, { name: 'email', type: 'email', width: '1/2' })
            : null,
          h(DitoSection, null, {
            default: () =>
              h(DitoSwitchField, { name: 'isFeatured', label: 'Featured' })
          }),
          h(
            DitoSection,
            { label: 'Award' },
            { default: () => h(DitoTextField, { name: 'award' }) }
          ),
          h(
            DitoSection,
            { label: 'Ranking', collapsible: true, collapsed: true },
            {
              default: () => [
                h(RankFields),
                h(
                  DitoSection,
                  { label: 'More', collapsible: true, collapsed: true },
                  {
                    default: () =>
                      h(DitoTextField, { name: 'name', label: 'Display Name' })
                  }
                )
              ]
            }
          ),
          h(
            DitoSection,
            { name: 'address', label: 'Address' },
            { default: () => [h(DitoTextField, { name: 'city' })] }
          )
        ]
      })
  }
}

async function mountDesignerPage(page = DesignerPage) {
  const request = vi.fn(({ method = 'get', url, data }) => {
    if (method === 'get' && url === '/designers/7') {
      return {
        data: {
          id: 7,
          name: 'Ada',
          email: null,
          isFeatured: true,
          rank: 3,
          award: 'Gold',
          importName: 'ada',
          address: { city: 'London' }
        }
      }
    } else if (method === 'patch') {
      return { data: { ...data } }
    } else {
      throw new Error(`Unexpected request: ${method} ${url}`)
    }
  })
  const admin = await mountAdmin({
    views: {
      designer: {
        type: 'page',
        label: 'Designer',
        path: 'designer',
        component: page
      }
    },
    request
  })
  const notify = vi.spyOn(admin.context, 'notify')
  await admin.navigate('/designer')
  await settle()
  return { admin, notify, request, wrapper: admin.wrapper }
}

async function settle() {
  await flushPromises()
  await new Promise(resolve => setTimeout(resolve))
  await flushPromises()
}

const getContainer = (wrapper, label) =>
  wrapper
    .findAll('.dito-container')
    .find(container => {
      const containerLabel = container.find('.dito-label')
      return containerLabel.exists() && containerLabel.text() === label
    })

describe('widgets', () => {
  afterEach(() => {
    form = null
    showsName.value = true
    showsEmail.value = true
  })

  it('render the values of their properties with their props', async () => {
    const { wrapper } = await mountDesignerPage()
    const name = getContainer(wrapper, 'Name')
    expect(name.attributes('style')).toContain('--basis: 50%')
    expect(name.find('input').element.value).toBe('Ada')
    // The hints of the property, but no data keywords of the widget:
    expect(name.find('.dito-label--required').exists()).toBe(true)
    expect(name.find('input').attributes('maxlength')).toBe('40')
    expect(getContainer(wrapper, 'Email').find('input').attributes('type'))
      .toBe('email')
    expect(
      getContainer(wrapper, 'Email').find('.dito-label--required').exists()
    ).toBe(false)
    expect(getContainer(wrapper, 'Featured').find('.dito-switch').exists())
      .toBe(true)
    expect(getContainer(wrapper, 'City').find('input').element.value)
      .toBe('London')
  })

  it('edit the values of their properties', async () => {
    const { wrapper, request } = await mountDesignerPage()
    await enterValue(getContainer(wrapper, 'Name').find('input'), 'Grace')
    await enterValue(getContainer(wrapper, 'City').find('input'), 'Paris')
    expect(form.item).toMatchObject({
      name: 'Grace',
      address: { city: 'Paris' }
    })
    expect(await form.submit()).toBe(true)
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        method: 'patch',
        data: {
          id: 7,
          name: 'Grace',
          email: null,
          isFeatured: true,
          rank: 3,
          award: 'Gold',
          address: { city: 'Paris' }
        }
      })
    )
  })

  it('validate their properties when they are blurred', async () => {
    const { wrapper } = await mountDesignerPage()
    const name = getContainer(wrapper, 'Name')
    const input = name.find('input')
    await input.trigger('focus')
    await enterValue(input, '')
    await input.trigger('blur')
    expect(form.getErrors()).toEqual({ name: [{ message: 'is required' }] })
    expect(name.find('.dito-errors').text()).toBe(
      'The Name field is required.'
    )
  })

  it('show the errors of submits, also widgets of the same name', async () => {
    const { wrapper, notify } = await mountDesignerPage()
    form.item.name = ''
    expect(await form.submit()).toBe(false)
    // Each collapsed section is opened after its transition:
    await settle()
    await settle()
    expect(getContainer(wrapper, 'Name').find('.dito-errors').text()).toBe(
      'The Name field is required.'
    )
    // The nested sections with the other widget of `name` are revealed:
    const displayName = getContainer(wrapper, 'Display Name')
    expect(
      displayName.element.closest('.dito-schema:not(.dito-schema--open)')
    ).toBe(null)
    expect(displayName.find('.dito-errors').text()).toBe(
      'The Display Name field is required.'
    )
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Validation Errors',
        text: 'Please correct the highlighted errors.'
      })
    )
    // Each widget has an id of its own, and the first one is focused:
    const input = getContainer(wrapper, 'Name').find('input').element
    const otherInput = getContainer(wrapper, 'Display Name').find('input')
    expect(otherInput.element.id).not.toBe(input.id)
    expect(wrapper.findAll(`[id="${input.id}"]`)).toHaveLength(1)
    expect(document.activeElement).toBe(input)
  })

  it('label sections only with their label', async () => {
    const { wrapper } = await mountDesignerPage()
    const sections = wrapper.findAll('.dito-section')
    expect(sections.map(section => section.attributes('aria-label'))).toEqual(
      [undefined, 'Award', 'Ranking', 'Address']
    )
  })

  it('reveal errors in collapsed sections, which show them', async () => {
    const { wrapper, notify } = await mountDesignerPage()
    const section = getContainer(wrapper, 'Ranking')
    const content = () => section.find('.dito-schema-content')
    expect(content().exists()).toBe(false)
    form.item.rank = 0
    expect(form.validate()).toBe(false)
    await settle()
    // Also the widgets in the page's own components:
    const rank = getContainer(wrapper, 'Rank')
    expect(rank.find('.dito-errors').text()).toBe(
      'The Rank field must be 1 or more.'
    )
    expect(document.activeElement).toBe(rank.find('input').element)
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Please correct the highlighted errors.'
      })
    )
    // Collapsed again, the section keeps its content with the errors hidden,
    // which marks its label:
    await section.find('.dito-schema-header .dito-label').trigger('click')
    await settle()
    expect(section.find('.dito-schema').classes()).not.toContain(
      'dito-schema--open'
    )
    expect(content().isVisible()).toBe(false)
    expect(content().find('.dito-container--has-errors').exists()).toBe(true)
    // Without errors, it unmounts its content again:
    form.item.rank = 2
    expect(form.validate()).toBe(true)
    await settle()
    expect(content().exists()).toBe(false)
  })

  it('hide themselves for irrelevant properties', async () => {
    const { wrapper } = await mountDesignerPage()
    await getContainer(wrapper, 'Ranking')
      .find('.dito-schema-header .dito-label')
      .trigger('click')
    await settle()
    expect(getContainer(wrapper, 'Rank')).toBeDefined()
    form.item.rank = 0
    form.item.isFeatured = false
    await nextTick()
    expect(getContainer(wrapper, 'Rank')).toBeUndefined()
    expect(getContainer(wrapper, 'Ranking')).toBeDefined()
    expect(form.validate()).toBe(true)
  })

  it('notify the errors that no widget shows', async () => {
    const { notify } = await mountDesignerPage()
    showsEmail.value = false
    form.item.email = 'ada'
    await nextTick()
    expect(form.validate()).toBe(false)
    await settle()
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Validation Errors',
        text: 'The field Email must be a valid email'
      })
    )
  })

  it('notify the errors of values that are irrelevant', async () => {
    const { notify, request } = await mountDesignerPage()
    form.item.isFeatured = false
    await nextTick()
    request.mockImplementation(() => {
      throw Object.assign(new Error('Validation failed'), {
        response: {
          status: 400,
          data: {
            type: 'ValidationError',
            errors: { rank: [{ message: 'is too low' }] }
          }
        }
      })
    })
    expect(await form.submit()).toBe(false)
    await settle()
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Validation Errors',
        text: 'The field Rank is too low'
      })
    )
  })

  it('show errors in the other widget of the same name', async () => {
    const { wrapper, notify } = await mountDesignerPage()
    showsName.value = false
    form.item.name = ''
    await nextTick()
    expect(await form.submit()).toBe(false)
    await settle()
    await settle()
    expect(
      getContainer(wrapper, 'Display Name').find('.dito-errors').text()
    ).toBe('The Display Name field is required.')
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Validation Errors',
        text: 'Please correct the highlighted errors.'
      })
    )
  })

  it('keep their state while their section is collapsed', async () => {
    const { wrapper } = await mountDesignerPage({
      setup() {
        form = useDitoForm({ resource: 'designers', id: 7, properties })
        return () =>
          h(DitoSchemaForm, null, {
            default: () =>
              h(
                DitoSection,
                { label: 'Location', collapsible: true },
                {
                  default: () =>
                    h(
                      DitoSection,
                      { name: 'address', label: 'Address', collapsible: true },
                      { default: () => h(DitoTextField, { name: 'city' }) }
                    )
                }
              )
          })
      }
    })
    const toggle = async label => {
      await getContainer(wrapper, label)
        .find('.dito-schema-header .dito-label')
        .trigger('click')
      await settle()
    }
    await toggle('Address')
    expect(getContainer(wrapper, 'City')).toBeUndefined()
    await toggle('Location')
    await toggle('Location')
    expect(getContainer(wrapper, 'Address')).toBeDefined()
    expect(getContainer(wrapper, 'City')).toBeUndefined()
  })

  it('throw for names without a property', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await mountDesignerPage({
      setup() {
        useDitoForm({ resource: 'designers', id: 7, properties })
        return () =>
          h(DitoSchemaForm, null, {
            default: () => h(DitoTextField, { name: 'title' })
          })
      }
    })
    expect([...error.mock.calls, ...warn.mock.calls].flat()).toContainEqual(
      expect.objectContaining({ message: `Unknown property 'title'.` })
    )
  })
})
