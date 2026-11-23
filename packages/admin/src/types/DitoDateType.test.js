import { clone } from '@ditojs/utils'
import { CalendarDate, CalendarDateTime } from '@internationalized/date'
import { mountSchema, mountForm } from '../test/mount.js'

// Adds `getText(name)`, the text of the field with its parts, and
// `enterDate(name, date)`, which enters a date of `@internationalized/date` as
// the field emits it, to the result of `mount()`:
async function mountDates(mount, options) {
  const result = await mount(options)
  const { findField, getComponent, settle } = result
  return {
    ...result,
    // Some ICU versions put a narrow no-break space before AM and PM:
    getText: name =>
      findField(name).find('[role="group"]').text().replace(/\s/g, ' '),
    async enterDate(name, date) {
      getComponent(name).$refs.element.$emit('update:modelValue', date)
      await settle()
    }
  }
}

describe('DitoDateType', () => {
  it('shows dates, date-times and times in the parts of the locale', async () => {
    const { getText } = await mountDates(mountSchema, {
      schema: {
        fields: {
          publishedOn: { type: 'date' },
          createdAt: { type: 'datetime' },
          opensAt: { type: 'time' }
        }
      },
      data: {
        publishedOn: '2024-03-05',
        createdAt: new Date(2024, 2, 5, 14, 30).toISOString(),
        opensAt: new Date(2024, 2, 5, 9, 15).toISOString()
      }
    })
    expect(getText('publishedOn')).toBe('3/5/2024')
    expect(getText('createdAt')).toBe('3/5/2024, 2:30:00 PM')
    expect(getText('opensAt')).toBe('9:15:00 AM')
  })

  it('edits the parts of the time and the hours of `formats`', async () => {
    const { getText } = await mountDates(mountSchema, {
      schema: {
        fields: {
          createdAt: {
            type: 'datetime',
            formats: { time: { second: false, hour12: false } }
          }
        }
      },
      data: { createdAt: new Date(2024, 2, 5, 14, 30).toISOString() }
    })
    expect(getText('createdAt')).toBe('3/5/2024, 14:30')
  })

  it('focuses the field from its label, and with `autofocus`', async () => {
    const { findContainer } = await mountSchema({
      schema: {
        fields: {
          publishedOn: { type: 'date', label: 'Published', autofocus: true },
          opensAt: { type: 'time', label: 'Opens' }
        }
      }
    })
    const [published, opens] = ['publishedOn', 'opensAt'].map(name =>
      findContainer(name)
    )
    expect(document.activeElement).toBe(
      published.find('[role="spinbutton"]').element
    )
    const { htmlFor } = opens.find('label').element
    opens.find(`[id="${htmlFor}"]`).element.focus()
    expect(document.activeElement).toBe(
      opens.find('[role="spinbutton"]').element
    )
  })

  it('writes entered dates into the data as local dates', async () => {
    const { data, enterDate } = await mountDates(mountSchema, {
      schema: {
        fields: {
          publishedOn: { type: 'date' },
          createdAt: { type: 'datetime' }
        }
      }
    })
    await enterDate('publishedOn', new CalendarDate(2026, 5, 14))
    await enterDate('createdAt', new CalendarDateTime(2026, 5, 14, 11, 30))
    expect(data.publishedOn).toEqual(new Date(2026, 4, 14))
    expect(data.createdAt).toEqual(new Date(2026, 4, 14, 11, 30))
    await enterDate('publishedOn', null)
    expect(data.publishedOn).toBe(null)
  })

  it('keeps the time of date-times when picking a day', async () => {
    const { findField, data, settle } = await mountSchema({
      schema: { fields: { createdAt: { type: 'datetime' } } },
      data: { createdAt: new Date(2026, 4, 14, 11, 30).toISOString() }
    })
    const field = findField('createdAt')
    await field.find('.dito-date-picker__toggle').trigger('click')
    await settle()
    // The days of the calendar have the time of the value:
    await field.find('[data-value^="2026-05-20"]').trigger('click')
    await settle()
    expect(data.createdAt).toEqual(new Date(2026, 4, 20, 11, 30))
  })

  it('sends dates as plain dates, date-times and times as ISO strings', async () => {
    const createdAt = new Date(2026, 4, 14, 8, 0)
    const opensAt = new Date(2026, 4, 14, 14, 30)
    const { dataModel, data, submit } = await mountForm({
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
    dataModel.set(
      { data, name: 'publishedOn', dataPath: 'publishedOn' },
      new Date(2026, 4, 14)
    )
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
    const { data, getText, getErrors, submit } = await mountDates(mountForm, {
      schema: { fields: { opensAt: { type: 'time' } } },
      data: { opensAt: '14:30' },
      request: ({ data }) => ({ data: clone(data) })
    })
    expect(data.opensAt).toBe('14:30')
    expect(getText('opensAt')).toBe('––:––:–– AM')
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
      mountDates(mountForm, {
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

    it('shows them as dates', async () => {
      const { findField, getText, settle } = await mountWithWrite()
      await findField('renew').trigger('click')
      await settle()
      expect(getText('expiryDate')).toBe('10/13/2026')
      expect(getText('expiresAt')).toBe('10/13/2026, 2:30:00 PM')
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
      const { findField, enterDate, data, settle } = await mountWithWrite()
      await findField('renew').trigger('click')
      await settle()
      await enterDate('expiryDate', new CalendarDate(2026, 5, 14))
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
    expect(field.find('.dito-affixes--suffix').classes()).toContain(
      'dito-affixes--absolute'
    )
    await field.find('button[title="Clear"]').trigger('click')
    expect(field.find('button[title="Clear"]').exists()).toBe(false)
  })

  it('opens the popup of clearable fields by a click on a part', async () => {
    // The clear button lies over the button of the popup while it shows:
    const { findField, settle } = await mountSchema({
      schema: {
        fields: {
          publishedOn: { type: 'date', clearable: true },
          opensAt: { type: 'time', clearable: true }
        }
      },
      data: {
        publishedOn: '2024-03-01',
        opensAt: new Date(2024, 2, 5, 9, 15).toISOString()
      }
    })
    for (const [name, popup] of [
      ['publishedOn', '.dito-calendar'],
      ['opensAt', '.dito-time-panel']
    ]) {
      const field = findField(name)
      expect(field.find('button[title="Clear"]').exists()).toBe(true)
      await field.find('[role="spinbutton"]').trigger('click')
      await settle()
      expect(field.find(popup).exists()).toBe(true)
    }
  })
})
