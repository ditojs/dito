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

  it('sends trimmed values with `trim`, and empty values as empty strings', async () => {
    const { findField, submit } = await mountForm({
      schema: {
        fields: {
          summary: { type: 'textarea', trim: true },
          notes: { type: 'textarea' },
          comment: { type: 'textarea', trim: true, nullable: true }
        }
      },
      data: { summary: '', notes: 'Some', comment: 'Fine' },
      request: ({ data }) => ({ data })
    })
    await findField('summary').setValue('\n A story. \n')
    await findField('notes').setValue('')
    await findField('comment').setValue('  ')
    expect(await submit()).toMatchObject({
      summary: 'A story.',
      notes: '',
      comment: null
    })
  })

  it('stores no value as `null` with `nullable`', async () => {
    const { submit } = await mountForm({
      schema: {
        fields: {
          summary: { type: 'textarea' },
          notes: { type: 'textarea', nullable: true }
        }
      },
      request: ({ data }) => ({ data })
    })
    expect(await submit()).toEqual({ summary: '', notes: null })
  })
})
