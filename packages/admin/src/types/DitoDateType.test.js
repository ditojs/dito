import { clone } from '@ditojs/utils'
import { mountSchema, mountForm, enterValue } from '../test/mount.js'

describe('DitoDateType', () => {
  it('displays plain dates in the format of the locale', async () => {
    const { findField } = await mountSchema({
      schema: { fields: { publishedOn: { type: 'date' } } },
      data: { publishedOn: '2024-03-05' }
    })
    expect(findField('publishedOn').find('input').element.value).toBe(
      'March 5, 2024'
    )
  })

  it('displays date-times and times in the format of the locale', async () => {
    const { findField } = await mountSchema({
      schema: {
        fields: {
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

  it('uses the date and time formats of `format`', async () => {
    const { findField } = await mountSchema({
      schema: {
        fields: {
          publishedOn: {
            type: 'date',
            format: { date: { month: 'short' } }
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
      schema: { fields: { publishedOn: { type: 'date' } } }
    })
    await enterValue(findField('publishedOn').find('input'), 'May 14, 2026')
    expect(data.publishedOn).toBeInstanceOf(Date)
    expect(data.publishedOn.getFullYear()).toBe(2026)
    expect(data.publishedOn.getMonth()).toBe(4)
    expect(data.publishedOn.getDate()).toBe(14)
  })

  it('sends dates as plain dates, date-times and times as ISO strings', async () => {
    const createdAt = new Date(2026, 4, 14, 8, 0)
    const opensAt = new Date(2026, 4, 14, 14, 30)
    const { findField, dataModel, data, submit } = await mountForm({
      schema: {
        fields: {
          publishedOn: { type: 'date' },
          createdAt: { type: 'datetime' },
          opensAt: { type: 'time' }
        }
      },
      data: { publishedOn: null, createdAt: null, opensAt: null },
      // Respond with a copy, like a server:
      request: ({ data }) => ({ data: clone(data) })
    })
    await enterValue(findField('publishedOn').find('input'), 'May 14, 2026')
    dataModel.set({ data, name: 'createdAt', dataPath: 'createdAt' }, createdAt)
    dataModel.set({ data, name: 'opensAt', dataPath: 'opensAt' }, opensAt)
    expect(await submit()).toMatchObject({
      publishedOn: '2026-05-14',
      createdAt: createdAt.toISOString(),
      opensAt: opensAt.toISOString()
    })
    // The response is deserialized again:
    expect(data.publishedOn).toBeInstanceOf(Date)
    expect(data.createdAt).toEqual(createdAt)
  })

  it(`keeps strings that aren't dates, e.g. times, but rejects them`, async () => {
    const { findField, data, getErrors, submit } = await mountForm({
      schema: { fields: { opensAt: { type: 'time' } } },
      data: { opensAt: '14:30' },
      request: ({ data }) => ({ data: clone(data) })
    })
    expect(data.opensAt).toBe('14:30')
    expect(findField('opensAt').find('input').element.value).toBe('')
    expect(await submit()).toBe(null)
    expect(getErrors('opensAt')).toEqual([
      'The Opens At field must be a valid date.'
    ])
  })

  it('rejects invalid dates that code wrote', async () => {
    const { data, getErrors, settle, submit } = await mountForm({
      schema: {
        fields: {
          publishedOn: { type: 'date' },
          createdAt: { type: 'datetime' }
        }
      },
      data: { publishedOn: null, createdAt: null },
      request: ({ data }) => ({ data: clone(data) })
    })
    data.publishedOn = new Date('soon')
    data.createdAt = 'soon'
    await settle()
    expect(await submit()).toBe(null)
    expect(getErrors('publishedOn')).toEqual([
      'The Published On field must be a valid date.'
    ])
    expect(getErrors('createdAt')).toEqual([
      'The Created At field must be a valid date.'
    ])
  })

  describe('date strings written by code', () => {
    const expiresAt = new Date(2026, 9, 13, 14, 30)

    const mountWithWrite = () =>
      mountForm({
        schema: {
          fields: {
            expiryDate: { type: 'date' },
            expiresAt: { type: 'datetime' },
            renew: {
              type: 'button',
              onClick({ item }) {
                item.expiryDate = '2026-10-13'
                item.expiresAt = expiresAt.toISOString()
              }
            }
          }
        },
        data: { expiryDate: null, expiresAt: null },
        request: ({ data }) => ({ data: clone(data) })
      })

    it('displays them and passes them to the picker as dates', async () => {
      const { findField, getComponent, settle } = await mountWithWrite()
      await findField('renew').trigger('click')
      await settle()
      expect(findField('expiryDate').find('input').element.value).toBe(
        'October 13, 2026'
      )
      expect(getComponent('expiryDate').$refs.element.modelValue).toEqual(
        new Date(2026, 9, 13)
      )
      expect(getComponent('expiresAt').$refs.element.modelValue).toEqual(
        expiresAt
      )
    })

    it('keeps them in the data and sends them unchanged', async () => {
      const { findField, data, settle, submit } = await mountWithWrite()
      await findField('renew').trigger('click')
      await settle()
      expect(data.expiryDate).toBe('2026-10-13')
      expect(await submit()).toMatchObject({
        expiryDate: '2026-10-13',
        expiresAt: expiresAt.toISOString()
      })
    })

    it('converts them to dates once the user edits them', async () => {
      const { findField, data, settle } = await mountWithWrite()
      await findField('renew').trigger('click')
      await settle()
      await enterValue(findField('expiryDate').find('input'), 'May 14, 2026')
      expect(data.expiryDate).toEqual(new Date(2026, 4, 14))
    })

    it('displays them in item labels as their type formats them', async () => {
      const { findField, data, settle } = await mountForm({
        schema: {
          fields: {
            milestones: {
              type: 'list',
              itemLabel: 'due',
              form: {
                type: 'form',
                fields: { due: { type: 'date' } }
              }
            }
          }
        },
        data: { milestones: [{ due: '2026-06-01' }] }
      })
      data.milestones[0].due = '2026-07-01'
      await settle()
      expect(findField('milestones').find('tbody td').text()).toBe(
        'July 1, 2026'
      )
    })
  })

  it('positions `prefix` and `suffix` over the picker', async () => {
    const { findField } = await mountSchema({
      schema: {
        fields: {
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
