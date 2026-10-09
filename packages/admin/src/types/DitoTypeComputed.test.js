import { vi } from 'vitest'
import { mountSchema, mountForm, enterValue } from '../test/mount.js'

describe('DitoTypeComputed', () => {
  it('computes the value from other values of the item', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        components: {
          title: { type: 'text' },
          slug: {
            type: 'computed',
            compute: ({ item }) => (
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
          hidden: { type: 'computed', compute: () => 'secret' },
          shown: { type: 'computed', visible: true, compute: () => 'shown' }
        }
      }
    })
    expect(findField('hidden').isVisible()).toBe(false)
    const input = findField('shown')
    expect(input.element.value).toBe('shown')
    expect(input.attributes('readonly')).toBeDefined()
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
          shelfName: { type: 'data', dataPath: '../shelf/name' },
          loadedCount: { type: 'data', data: async () => 42 }
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
            type: 'computed',
            compute: ({ item }) => Math.ceil(item.pages / 2)
          },
          isLong: {
            type: 'computed',
            exclude: true,
            compute: ({ item }) => item.pages > 500
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
            type: 'computed',
            compute: ({ item }) => item.title?.[0] ?? null
          }
        }
      },
      data: { title: 'Dune', initials: null }
    })
    expect(routeComponent.data.initials).toBe('D')
    expect(routeComponent.isDirty).toBe(false)
  })

  it('reports computes that keep changing their value', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { data } = await mountSchema({
      schema: {
        components: {
          counter: {
            type: 'computed',
            compute: ({ value }) => (value ?? 0) + 1
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

describe('DitoTypeLabel', () => {
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
