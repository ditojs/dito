import { vi } from 'vitest'
import { mountSchema, mountForm, enterValue } from '../test/mount.js'

describe('DitoValueType', () => {
  it('computes the value from other values of the item', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        components: {
          title: { type: 'text' },
          slug: {
            type: 'value',
            computeValue: ({ item }) => (
              item.title?.toLowerCase().replaceAll(' ', '-') ?? null
            )
          }
        }
      },
      data: { title: 'The Hobbit' }
    })
    expect(data.slug).toBe('the-hobbit')
    await enterValue(findField('title').find('input'), 'Middle March')
    expect(data.slug).toBe('middle-march')
  })

  it(`isn't visible, unless it's made visible as readonly field`, async () => {
    const { findField } = await mountSchema({
      schema: {
        components: {
          hidden: { type: 'value', computeValue: () => 'secret' },
          shown: {
            type: 'value',
            visible: true,
            computeValue: () => 'shown'
          }
        }
      }
    })
    expect(findField('hidden').isVisible()).toBe(false)
    const input = findField('shown')
    expect(input.element.value).toBe('shown')
    expect(input.attributes('readonly')).toBeDefined()
  })

  it('supports the deprecated names, warning once for each', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { findField, data } = await mountSchema({
      schema: {
        components: {
          title: { type: 'text' },
          slug: {
            type: 'computed',
            computeValue: ({ item }) => item.title?.toLowerCase()
          },
          initials: {
            type: 'computed',
            computeValue: ({ item }) => item.title?.[0]
          },
          copy: { type: 'data', dataPath: 'title' },
          count: { type: 'hidden', data: () => 42 }
        }
      },
      data: { title: 'Dune' }
    })
    expect(data).toMatchObject({
      slug: 'dune',
      initials: 'D',
      copy: 'Dune',
      count: 42
    })
    expect(findField('slug').isVisible()).toBe(false)
    expect(warn.mock.calls).toEqual(
      ['computed', 'data', 'hidden'].map(type => [
        `\`type: '${type}'\` is deprecated, use \`type: 'value'\` instead.`
      ])
    )
    warn.mockRestore()
  })

  it('resolves the value of `data` and `dataPath`', async () => {
    const { data } = await mountSchema({
      schema: {
        components: {
          shelf: {
            type: 'object',
            form: {
              type: 'form',
              components: { name: { type: 'text' } }
            }
          },
          shelfName: { type: 'value', dataPath: 'shelf/name' },
          loadedCount: { type: 'value', data: async () => 42 }
        }
      },
      data: { shelf: { name: 'Classics' } }
    })
    expect(data.shelfName).toBe('Classics')
    expect(data.loadedCount).toBe(42)
  })

  it('sends the computed value, unless it is excluded', async () => {
    const { submit } = await mountForm({
      schema: {
        components: {
          pages: { type: 'number' },
          sheets: {
            type: 'value',
            computeValue: ({ item }) => Math.ceil(item.pages / 2)
          },
          isLong: {
            type: 'value',
            exclude: true,
            computeValue: ({ item }) => item.pages > 500
          }
        }
      },
      data: { pages: 301 },
      request: ({ data }) => ({ data })
    })
    const payload = await submit()
    expect(payload).toMatchObject({ pages: 301, sheets: 151 })
    expect('isLong' in payload).toBe(false)
  })

  it(`doesn't make the form dirty with computed values`, async () => {
    const { routeComponent } = await mountForm({
      schema: {
        components: {
          title: { type: 'text' },
          initials: {
            type: 'value',
            computeValue: ({ item }) => item.title?.[0] ?? null
          }
        }
      },
      data: { title: 'Dune', initials: null }
    })
    expect(routeComponent.data.initials).toBe('D')
    expect(routeComponent.routeContext.isDirty).toBe(false)
  })

  it('reports computes that keep changing their value', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { data } = await mountSchema({
      schema: {
        components: {
          counter: {
            type: 'value',
            computeValue: ({ value }) => (value ?? 0) + 1
          }
        }
      }
    })
    expect(data.counter).toBeGreaterThan(0)
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/'counter' keeps changing/)
      })
    )
  })
})

describe('DitoLabelType', () => {
  it('displays the value as label without sending it', async () => {
    const { findField, submit } = await mountForm({
      schema: {
        components: {
          heading: { type: 'label', default: 'Details' },
          title: { type: 'text' }
        }
      },
      data: { title: 'Dune' },
      request: ({ data }) => ({ data })
    })
    expect(findField('heading').text()).toBe('Details')
    const payload = await submit()
    expect('heading' in payload).toBe(false)
  })
})
