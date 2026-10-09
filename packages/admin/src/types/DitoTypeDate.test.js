import { mountSchema, mountForm, enterValue } from '../test/mount.js'

describe('DitoTypeDate', () => {
  it('displays plain dates in the format of the locale', async () => {
    const { findField } = await mountSchema({
      schema: { components: { publishedOn: { type: 'date' } } },
      data: { publishedOn: '2024-03-05' }
    })
    expect(findField('publishedOn').find('input').element.value).toBe(
      'March 5, 2024'
    )
  })

  it('displays date-times and times in the format of the locale', async () => {
    const { findField } = await mountSchema({
      schema: {
        components: {
          createdAt: { type: 'datetime' },
          opensAt: { type: 'time' }
        }
      },
      data: {
        createdAt: new Date(2024, 2, 5, 14, 30).toISOString(),
        opensAt: new Date(2024, 2, 5, 9, 15).toISOString()
      }
    })
    const getText = name => findField(name).find('input').element.value
    expect(getText('createdAt')).toMatch(/^March 5, 2024, 02:30/)
    expect(getText('opensAt')).toMatch(/^09:15/)
  })

  it('uses the date and time formats of `formats`', async () => {
    const { findField } = await mountSchema({
      schema: {
        components: {
          publishedOn: {
            type: 'date',
            formats: { date: { month: 'short' } }
          }
        }
      },
      data: { publishedOn: '2024-03-05' }
    })
    expect(findField('publishedOn').find('input').element.value).toBe(
      'Mar 5, 2024'
    )
  })

  it('parses entered dates into the data', async () => {
    const { findField, data } = await mountSchema({
      schema: { components: { publishedOn: { type: 'date' } } }
    })
    await enterValue(findField('publishedOn').find('input'), 'May 14, 2026')
    expect(data.publishedOn).toBeInstanceOf(Date)
    expect(data.publishedOn.getFullYear()).toBe(2026)
    expect(data.publishedOn.getMonth()).toBe(4)
    expect(data.publishedOn.getDate()).toBe(14)
  })

  it('sends dates as plain dates and date-times as ISO strings', async () => {
    const createdAt = new Date(2026, 4, 14, 8, 0)
    const { findField, getComponent, submit } = await mountForm({
      schema: {
        components: {
          publishedOn: { type: 'date' },
          createdAt: { type: 'datetime' }
        }
      },
      data: { publishedOn: null, createdAt: null },
      request: ({ data }) => ({ data })
    })
    await enterValue(findField('publishedOn').find('input'), 'May 14, 2026')
    getComponent('createdAt').value = createdAt
    expect(await submit()).toMatchObject({
      publishedOn: '2026-05-14',
      createdAt: createdAt.toISOString()
    })
  })

  it('positions `prefix` and `suffix` over the picker', async () => {
    const { findField } = await mountSchema({
      schema: {
        components: {
          published: { type: 'date', prefix: 'On', clearable: true }
        }
      },
      data: { published: '2024-03-01' }
    })
    const field = findField('published')
    const prefix = field.find('.dito-affixes--prefix')
    expect(prefix.text()).toBe('On')
    expect(prefix.classes()).toContain('dito-affixes--absolute')
    await field.find('.dito-affixes__clear').trigger('click')
    expect(field.find('.dito-affixes__clear').exists()).toBe(false)
  })
})
