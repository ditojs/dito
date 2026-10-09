import { flushPromises } from '@vue/test-utils'
import { mountSchema, mountForm } from '../test/mount.js'

describe('DitoTypeSection', () => {
  it('renders its components with the data of the parent', async () => {
    const { findField, findContainer, data } = await mountSchema({
      schema: {
        components: {
          details: {
            type: 'section',
            label: 'Details',
            components: {
              title: { type: 'text' },
              pages: { type: 'number' }
            }
          }
        }
      },
      data: { title: 'Emma', pages: 474 }
    })
    const section = findField('details')
    // The section displays its label in the header of its schema, instead of
    // the label of its container:
    expect(section.find('.dito-schema-header').text()).toBe('Details')
    const container = findContainer('details')
    expect(container.find(':scope > .dito-label').exists()).toBe(false)
    expect(container.text().match(/Details/g)).toHaveLength(1)
    const title = section.find('input[name="title"]')
    expect(title.element.value).toBe('Emma')
    await title.setValue('Persuasion')
    expect(data.title).toBe('Persuasion')
    expect('details' in data).toBe(false)
  })

  it('displays its label in its container with a compact form', async () => {
    const { findContainer } = await mountSchema({
      schema: {
        components: {
          dimensions: {
            type: 'section',
            label: 'Dimensions',
            nested: true,
            form: {
              type: 'form',
              compact: true,
              components: { width: { type: 'number' } }
            }
          }
        }
      },
      data: { dimensions: { width: 12 } }
    })
    // Compact schemas don't display labels in their header, see
    // `DitoSchemaInlined`, so the container displays it:
    const container = findContainer('dimensions')
    expect(container.find(':scope > .dito-label').text()).toBe('Dimensions')
    expect(container.text().match(/Dimensions/g)).toHaveLength(1)
  })

  it('holds its data in an object with `nested`', async () => {
    const { findField, data, submit } = await mountForm({
      schema: {
        components: {
          dimensions: {
            type: 'section',
            nested: true,
            components: {
              width: { type: 'number' },
              height: { type: 'number', default: 20 }
            }
          }
        }
      },
      data: { dimensions: null },
      request: ({ data }) => ({ data })
    })
    expect(data.dimensions).toEqual({ width: null, height: 20 })
    await findField('dimensions')
      .find('input[name="dimensions/width"]')
      .setValue('12')
    expect(await submit()).toMatchObject({
      dimensions: { width: 12, height: 20 }
    })
  })

  it('opens collapsed sections when their label is clicked', async () => {
    const { findField, findContainer } = await mountSchema({
      schema: {
        components: {
          details: {
            type: 'section',
            label: 'Details',
            collapsible: true,
            collapsed: true,
            components: { title: { type: 'text' } }
          }
        }
      },
      data: { title: 'Emma' }
    })
    const section = findField('details')
    expect(section.find('input').exists()).toBe(false)
    await findContainer('details')
      .find('.dito-schema-header .dito-label')
      .trigger('click')
    await flushPromises()
    expect(findField('details').find('input').exists()).toBe(true)
  })

  it('renders components conditionally with `if`', async () => {
    const { findField, data, settle } = await mountSchema({
      schema: {
        components: {
          isSeries: { type: 'checkbox' },
          series: {
            type: 'section',
            if: ({ item }) => item.isSeries,
            components: { volume: { type: 'number' } }
          }
        }
      },
      data: { isSeries: false }
    })
    expect(findField('series').exists()).toBe(false)
    data.isSeries = true
    await settle()
    expect(findField('series').find('input[name="volume"]').exists()).toBe(
      true
    )
  })

  it('reveals the components with errors in collapsed sections', async () => {
    const { findField, submit, getErrors } = await mountForm({
      schema: {
        components: {
          details: {
            type: 'section',
            label: 'Details',
            collapsible: true,
            collapsed: true,
            components: { title: { type: 'text', required: true } }
          }
        }
      },
      data: { title: '' },
      request: ({ data }) => ({ data })
    })
    expect(findField('details').find('input').exists()).toBe(false)
    expect(await submit()).toBe(null)
    expect(findField('details').find('input').exists()).toBe(true)
    expect(getErrors('title')).toEqual(['The Title field is required.'])
  })

  it('shares the width of its container with its components', async () => {
    const { findContainer } = await mountSchema({
      schema: {
        components: {
          details: {
            type: 'section',
            label: 'Details',
            width: '1/2',
            components: {
              title: { type: 'text', width: '1/4' },
              subtitle: { type: 'text', width: '1/2' }
            }
          }
        }
      },
      data: { title: 'Emma', subtitle: 'A Novel' }
    })
    // Components that take a quarter of the page or less double their width
    // on narrow pages:
    const getMobileBasis = name =>
      findContainer(name).element.style.getPropertyValue('--basis-mobile')
    expect(getMobileBasis('title')).toBe('50%')
    expect(getMobileBasis('subtitle')).toBe('100%')
  })
})
