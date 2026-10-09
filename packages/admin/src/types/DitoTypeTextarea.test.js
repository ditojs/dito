import { mountSchema, mountForm } from '../test/mount.js'

describe('DitoTypeTextarea', () => {
  it('displays the value in a textarea with the number of `lines`', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        components: {
          summary: { type: 'textarea', lines: 6, resizable: true }
        }
      },
      data: { summary: 'A story.' }
    })
    const textarea = findField('summary')
    expect(textarea.element.tagName).toBe('TEXTAREA')
    expect(textarea.element.value).toBe('A story.')
    expect(textarea.attributes('rows')).toBe('6')
    expect(textarea.classes()).toContain('dito-textarea--resizable')
    await textarea.setValue('A longer story.')
    expect(data.summary).toBe('A longer story.')
  })

  it('defaults to four lines', async () => {
    const { findField } = await mountSchema({
      schema: { components: { summary: { type: 'textarea' } } }
    })
    expect(findField('summary').attributes('rows')).toBe('4')
  })

  it('sends trimmed values with `trim`, and empty values as `null`', async () => {
    const { findField, submit } = await mountForm({
      schema: {
        components: {
          summary: { type: 'textarea', trim: true },
          notes: { type: 'textarea' }
        }
      },
      data: { summary: '', notes: 'Some' },
      request: ({ data }) => ({ data })
    })
    await findField('summary').setValue('\n A story. \n')
    await findField('notes').setValue('')
    expect(await submit()).toMatchObject({
      summary: 'A story.',
      notes: null
    })
  })
})
