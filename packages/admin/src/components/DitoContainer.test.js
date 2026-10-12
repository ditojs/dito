import { mountSchema } from '../test/mount.js'

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
})
