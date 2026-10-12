import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSchema, mountForm } from '../test/mount.js'

// Mounts a view with a text field for each width in `widths`, named by index,
// and returns the styles and classes of their containers.
async function mountWidths(widths, schema = {}) {
  const { findContainer } = await mountSchema({
    schema: {
      components: Object.fromEntries(
        widths.map((width, index) => [
          `field${index}`,
          { type: 'text', width, ...schema }
        ])
      )
    }
  })
  return widths.map((width, index) => {
    const { element } = findContainer(`field${index}`)
    const { style } = element
    return {
      grow: style.getPropertyValue('--grow'),
      shrink: style.getPropertyValue('--shrink'),
      basis: style.getPropertyValue('--basis'),
      classes: [...element.classList]
    }
  })
}

describe('DitoContainer', () => {
  it('evaluates its schema values with the value that the type displays', async () => {
    const { findContainer } = await mountSchema({
      schema: {
        components: {
          title: {
            type: 'text',
            formatValue: ({ value }) => value.toUpperCase(),
            label: ({ value, name, item }) => `${name} of ${item.id}: ${value}`
          }
        }
      },
      data: { id: 1, title: 'emma' }
    })
    expect(findContainer('title').find('.dito-label').text()).toBe(
      'title of 1: EMMA'
    )
  })

  it('sizes containers by numbers, percentages and fractions', async () => {
    const [number, percentage, fraction] = await mountWidths([
      0.5,
      '25%',
      '1/3'
    ])
    expect(number.basis).toBe('50%')
    expect(percentage.basis).toBe('25%')
    expect(fraction.basis).toBe(`${1 / 3 * 100}%`)
  })

  it('passes widths in native units on as they are', async () => {
    const [pixels] = await mountWidths(['200px'])
    expect(pixels.basis).toBe('200px')
  })

  it('grows and shrinks containers with width operators', async () => {
    const [grow, shrink, fill] = await mountWidths(['>50%', '<50%', 'fill'])
    expect(grow).toMatchObject({ grow: '1', shrink: '0', basis: '50%' })
    expect(shrink).toMatchObject({ grow: '0', shrink: '1', basis: '50%' })
    expect(fill).toMatchObject({ grow: '1', shrink: '0', basis: 'auto' })
  })

  it('replaces labels with the label of their container', async () => {
    const { wrapper } = await mountSchema({
      schema: {
        components: {
          heading: { type: 'label', label: 'Contents' },
          note: { type: 'label' }
        }
      },
      data: { heading: 'Ignored', note: 'Draft' }
    })
    expect(
      wrapper.findAll('.dito-container').map(container => container.text())
    ).toEqual(['Contents', 'Draft'])
  })

  it('adds the classes of the schema as a string or object', async () => {
    const [string] = await mountWidths([null], { class: 'featured' })
    expect(string.classes).toContain('featured')
    const [object] = await mountWidths([null], {
      class: { featured: true, archived: false }
    })
    expect(object.classes).toContain('featured')
    expect(object.classes).not.toContain('archived')
  })

  describe('field', () => {
    it('evaluates the value and info once for the container and the type', async () => {
      const formatValue = vi.fn(({ value }) => value?.toUpperCase())
      const info = vi.fn(({ value }) => `About ${value}`)
      const { findContainer, dataModel, data, settle } = await mountSchema({
        schema: {
          components: {
            title: { type: 'text', label: 'Title', formatValue, info }
          }
        },
        data: { title: 'emma' }
      })
      formatValue.mockClear()
      info.mockClear()
      dataModel.set(data, 'title', 'persuasion')
      await settle()
      const container = findContainer('title')
      expect(container.find('input').element.value).toBe('PERSUASION')
      expect(container.find('.dito-label').html()).toContain('About PERSUASION')
      expect(formatValue).toHaveBeenCalledOnce()
      expect(info).toHaveBeenCalledOnce()
    })

    it('disables the container with the members of the type', async () => {
      let finish
      const { findContainer, findField } = await mountSchema({
        schema: {
          components: {
            send: {
              type: 'button',
              disabled: ({ isRunning }) => isRunning,
              onClick: () => new Promise(resolve => (finish = resolve))
            }
          }
        }
      })
      const container = findContainer('send')
      expect(container.classes()).not.toContain('dito-container--disabled')
      await findField('send').trigger('click')
      await flushPromises()
      expect(container.classes()).toContain('dito-container--disabled')
      expect(findField('send').attributes('disabled')).toBeDefined()
      finish()
      await flushPromises()
      expect(container.classes()).not.toContain('dito-container--disabled')
    })

    it('shows the options of the type in its label and info', async () => {
      const { findContainer } = await mountSchema({
        schema: {
          components: {
            genre: {
              type: 'select',
              options: ['novel', 'poem'],
              label: ({ options }) => `Genre of ${options?.length}`,
              info: ({ options }) => options?.join(', ')
            }
          }
        },
        data: { genre: 'novel' }
      })
      const label = findContainer('genre').find('.dito-label')
      expect(label.text()).toContain('Genre of 2')
      expect(label.html()).toContain('novel, poem')
    })

    it('removes the members of the type when the type changes', async () => {
      const label = ({ options }) => (options ? 'Choose' : 'Enter')
      const { findContainer, data, settle } = await mountSchema({
        schema: {
          components: {
            blocks: {
              type: 'list',
              inlined: true,
              forms: {
                choice: {
                  type: 'form',
                  components: {
                    value: { type: 'select', options: ['a', 'b'], label }
                  }
                },
                entry: {
                  type: 'form',
                  components: { value: { type: 'text', label } }
                }
              }
            }
          }
        },
        data: { blocks: [{ type: 'choice', value: 'a' }] }
      })
      const getLabel = () =>
        findContainer('blocks/0/value').find('.dito-label').text()
      expect(getLabel()).toBe('Choose')
      data.blocks[0].type = 'entry'
      await settle()
      expect(findContainer('blocks/0/value').find('input').exists()).toBe(true)
      expect(getLabel()).toBe('Enter')
    })

    it('shows the query of lists in their own label', async () => {
      const { getComponent, findContainer } = await mountForm({
        schema: {
          components: {
            chapters: {
              type: 'list',
              resource: { path: 'chapters' },
              paginate: 10,
              label: ({ sourceQuery }) => `Page ${sourceQuery?.page}`,
              columns: { title: {} }
            }
          }
        },
        data: { title: 'Emma' },
        request: () => ({ data: { results: [], total: 0 } })
      })
      getComponent('chapters').listQuery.update({ page: 2 })
      await flushPromises()
      expect(findContainer('chapters').find('.dito-label').text()).toBe(
        'Page 2'
      )
    })
  })
})
