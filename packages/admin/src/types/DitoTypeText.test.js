import { vi } from 'vitest'
import { mountSchema, mountForm, enterValue } from '../test/mount.js'

describe('DitoTypeText', () => {
  it('displays the value and writes input back into the data', async () => {
    const { findField, data } = await mountSchema({
      schema: { components: { title: { type: 'text' } } },
      data: { title: 'Dune' }
    })
    const input = findField('title').find('input')
    expect(input.element.value).toBe('Dune')
    await input.setValue('Emma')
    expect(data.title).toBe('Emma')
  })

  it('sets the default value for missing values', async () => {
    const { data, findField } = await mountSchema({
      schema: {
        components: {
          title: { type: 'text', default: 'Untitled' },
          subtitle: { type: 'text' }
        }
      }
    })
    expect(data).toEqual({ title: 'Untitled', subtitle: null })
    expect(findField('title').find('input').element.value).toBe('Untitled')
  })

  it('displays the value through `format()` and stores it through `parse()`', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        components: {
          tags: {
            type: 'text',
            format: ({ value }) => value?.join(', '),
            parse: ({ value }) =>
              value
                .split(',')
                .map(tag => tag.trim())
                .filter(Boolean)
          }
        }
      },
      data: { tags: ['fiction', 'classic'] }
    })
    const input = findField('tags').find('input')
    expect(input.element.value).toBe('fiction, classic')
    await input.setValue('poetry, , drama ')
    expect(data.tags).toEqual(['poetry', 'drama'])
  })

  it('clears the value with the clear button of clearable fields', async () => {
    const onChange = vi.fn()
    const { findField, data } = await mountSchema({
      schema: {
        components: {
          title: { type: 'text', clearable: true, onChange }
        }
      },
      data: { title: 'Dune' }
    })
    await findField('title').find('.dito-affixes__clear').trigger('click')
    expect(data.title).toBe(null)
    expect(findField('title').find('.dito-affixes__clear').exists()).toBe(
      false
    )
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledOnce())
    expect(onChange.mock.calls[0][0].value).toBe(null)
  })

  it(`doesn't show the clear button for readonly fields`, async () => {
    const { findField } = await mountSchema({
      schema: {
        components: {
          title: { type: 'text', clearable: true, readonly: true }
        }
      },
      data: { title: 'Dune' }
    })
    const input = findField('title').find('input')
    expect(input.attributes('readonly')).toBeDefined()
    expect(input.attributes('disabled')).toBeUndefined()
    expect(findField('title').find('.dito-affixes__clear').exists()).toBe(
      false
    )
  })

  it('renders `prefix` and `suffix`, and `info` inline without label', async () => {
    const { findField } = await mountSchema({
      schema: {
        components: {
          price: {
            type: 'text',
            label: 'Price',
            prefix: 'EUR',
            suffix: 'net',
            info: 'Without taxes'
          },
          title: { type: 'text', info: 'As printed' }
        }
      },
      data: { price: '10', title: 'Dune' }
    })
    const price = findField('price')
    expect(price.find('.dito-affixes--prefix').text()).toBe('EUR')
    expect(price.find('.dito-affixes--suffix').text()).toBe('net')
    // With a label, the label shows the info:
    expect(price.find('.dito-info').exists()).toBe(false)
    expect(
      findField('title').find('.dito-affixes--suffix .dito-info').attributes(
        'data-info'
      )
    ).toBe('As printed')
  })

  it('disables the input through a `disabled()` callback on the data', async () => {
    const { findField, data, settle } = await mountSchema({
      schema: {
        components: {
          locked: { type: 'checkbox' },
          title: { type: 'text', disabled: ({ item }) => item.locked }
        }
      },
      data: { locked: false, title: 'Dune' }
    })
    const input = () => findField('title').find('input')
    expect(input().attributes('disabled')).toBeUndefined()
    data.locked = true
    await settle()
    expect(input().attributes('disabled')).toBeDefined()
  })

  it('passes `maxLength`, `placeholder` and `autocomplete` to the input', async () => {
    const { findField } = await mountSchema({
      schema: {
        components: {
          title: {
            type: 'text',
            maxLength: 20,
            placeholder: 'Book title',
            autocomplete: 'off'
          }
        }
      }
    })
    const input = findField('title').find('input')
    expect(input.attributes()).toMatchObject({
      maxlength: '20',
      placeholder: 'Book title',
      autocomplete: 'off',
      name: 'title'
    })
  })

  it('uses the matching input types for the text based types', async () => {
    const { findField } = await mountSchema({
      schema: {
        components: {
          email: { type: 'email' },
          website: { type: 'url' },
          host: { type: 'hostname' },
          phone: { type: 'tel' },
          card: { type: 'creditcard' }
        }
      }
    })
    const getInputType = name =>
      findField(name).find('input').attributes('type')
    expect(getInputType('email')).toBe('email')
    expect(getInputType('website')).toBe('url')
    expect(getInputType('host')).toBe('text')
    expect(getInputType('phone')).toBe('tel')
    expect(getInputType('card')).toBe('text')
  })

  it('masks passwords without value until they are focused', async () => {
    const { findField, data } = await mountForm({
      schema: { components: { password: { type: 'password' } } },
      data: { name: 'Ada' }
    })
    // Passwords are never sent by the server, and missing values aren't set:
    expect('password' in data).toBe(false)
    const input = findField('password').find('input')
    expect(input.element.value).toBe('****************')
    await input.trigger('focus')
    expect(input.element.value).toBe('')
  })

  describe('validation', () => {
    it('shows the errors of required fields on blur', async () => {
      const { findField, getErrors } = await mountSchema({
        schema: {
          components: { title: { type: 'text', required: true } }
        }
      })
      const input = findField('title').find('input')
      await input.trigger('focus')
      await input.trigger('blur')
      expect(getErrors('title')).toEqual(['The title field is required.'])
      await input.setValue('Dune')
      expect(getErrors('title')).toEqual([])
    })

    it('validates the format of the email type', async () => {
      const { findField, getComponent, getErrors } = await mountSchema({
        schema: { components: { email: { type: 'email' } } }
      })
      const input = findField('email').find('input')
      await input.setValue('reader@')
      await input.trigger('blur')
      expect(getComponent('email').isValid).toBe(false)
      expect(getErrors('email')).toHaveLength(1)
      await input.setValue('reader@example.com')
      await input.trigger('blur')
      expect(getComponent('email').isValid).toBe(true)
      expect(getErrors('email')).toEqual([])
    })

    it(`doesn't submit forms with invalid values`, async () => {
      const request = vi.fn(({ data }) => ({ data }))
      const { submit, getErrors } = await mountForm({
        schema: {
          components: {
            title: { type: 'text', required: true },
            email: { type: 'email' }
          }
        },
        data: { title: '', email: 'reader@example.com' },
        request
      })
      expect(await submit()).toBe(null)
      expect(request).not.toHaveBeenCalled()
      expect(getErrors('title')).toEqual(['The Title field is required.'])
    })
  })

  describe('processing', () => {
    it('trims values with `trim` and sends empty values as defaults', async () => {
      const { findField, submit } = await mountForm({
        schema: {
          components: {
            title: { type: 'text', trim: true },
            subtitle: { type: 'text' },
            note: { type: 'text', default: 'none' }
          }
        },
        data: { title: 'Dune', subtitle: 'Book', note: 'Read' },
        request: ({ data }) => ({ data })
      })
      await findField('title').find('input').setValue('  Emma ')
      await findField('subtitle').find('input').setValue('')
      await findField('note').find('input').setValue('')
      expect(await submit()).toMatchObject({
        title: 'Emma',
        subtitle: null,
        note: 'none'
      })
    })
  })

  describe('events', () => {
    it('calls the focus, input, change and blur handlers of the schema', async () => {
      const events = []
      const record = event => () => events.push(event)
      const onChange = vi.fn()
      const { findField } = await mountSchema({
        schema: {
          components: {
            title: {
              type: 'text',
              onFocus: record('focus'),
              onInput: record('input'),
              onBlur: record('blur'),
              onChange: context => {
                record('change')()
                onChange(context.value)
              }
            }
          }
        },
        data: { title: 'Dune' }
      })
      const input = findField('title').find('input')
      await input.trigger('focus')
      await enterValue(input, 'Emma')
      await input.trigger('blur')
      await vi.waitFor(() => expect(onChange).toHaveBeenCalled())
      expect(events).toEqual(['focus', 'input', 'change', 'blur'])
      expect(onChange).toHaveBeenCalledWith('Emma')
    })

    it('lets change handlers update other values of the item', async () => {
      const { findField, data } = await mountSchema({
        schema: {
          components: {
            title: {
              type: 'text',
              onChange: ({ item, value }) => {
                item.slug = value.toLowerCase().replaceAll(' ', '-')
              }
            },
            slug: { type: 'text' }
          }
        },
        data: { title: '', slug: '' }
      })
      await enterValue(findField('title').find('input'), 'The Hobbit')
      await vi.waitFor(() => expect(data.slug).toBe('the-hobbit'))
      expect(findField('slug').find('input').element.value).toBe(
        'the-hobbit'
      )
    })
  })
})
