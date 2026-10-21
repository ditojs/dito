import { mountSchema, mountForm } from '../test/mount.js'

describe('DitoTextareaType', () => {
  it('displays the value in a textarea with the number of `lines`', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        fields: {
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

  it('resolves `lines` callbacks', async () => {
    const { findField } = await mountSchema({
      schema: {
        fields: {
          summary: { type: 'textarea', lines: ({ item }) => item.size }
        }
      },
      data: { size: 8 }
    })
    expect(findField('summary').attributes('rows')).toBe('8')
  })

  it('defaults to four lines', async () => {
    const { findField } = await mountSchema({
      schema: { fields: { summary: { type: 'textarea' } } }
    })
    expect(findField('summary').attributes('rows')).toBe('4')
  })

  it('sends trimmed values with `trim`, and empty values as `null`', async () => {
    const { findField, submit } = await mountForm({
      schema: {
        fields: {
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

  it('sends empty values as empty strings with `nullable: false`', async () => {
    const { findField, submit } = await mountForm({
      schema: {
        fields: {
          summary: { type: 'textarea', trim: true, nullable: false },
          notes: { type: 'textarea', nullable: false }
        }
      },
      data: { summary: 'Fine' },
      request: ({ data }) => ({ data })
    })
    await findField('summary').setValue('  ')
    expect(await submit()).toMatchObject({ summary: '', notes: '' })
  })
})
