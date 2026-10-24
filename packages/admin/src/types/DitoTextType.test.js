import { vi } from 'vitest'
import { html } from '@ditojs/utils'
import { mountSchema, mountForm, enterValue } from '../test/mount.js'

describe('DitoTextType', () => {
  it('displays the value and writes input back into the data', async () => {
    const { findField, data } = await mountSchema({
      schema: { fields: { title: { type: 'text' } } },
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
        fields: {
          title: { type: 'text', default: 'Untitled' },
          subtitle: { type: 'text' }
        }
      }
    })
    expect(data).toEqual({ title: 'Untitled', subtitle: null })
    expect(findField('title').find('input').element.value).toBe('Untitled')
  })

  it('stores no value as empty strings with `nullable: false`', async () => {
    const { findField, data, submit } = await mountForm({
      schema: {
        fields: {
          title: { type: 'text', nullable: false },
          subtitle: { type: 'text', nullable: false, clearable: true },
          email: { type: 'email', nullable: false }
        }
      },
      data: { subtitle: 'Book', email: 'reader@example.com' },
      request: ({ data }) => ({ data })
    })
    expect(data.title).toBe('')
    await findField('subtitle').find('.dito-affixes__clear').trigger('click')
    expect(data.subtitle).toBe('')
    await findField('email').find('input').setValue('')
    expect(await submit()).toMatchObject({
      title: '',
      subtitle: '',
      email: ''
    })
  })

  it('saves `null` with `nullable: false` as the default or empty string', async () => {
    const { data, submit } = await mountForm({
      schema: {
        fields: {
          title: { type: 'text' },
          slug: {
            type: 'text',
            nullable: false,
            computeValue: ({ item }) => item.title?.toLowerCase() ?? null
          },
          code: { type: 'text', nullable: false, default: 'none' }
        }
      },
      data: { title: 'Emma', slug: 'emma', code: 'emma' },
      request: ({ data }) => ({ data })
    })
    data.title = null
    data.code = null
    await vi.waitFor(() => expect(data.slug).toBe(null))
    expect(data.code).toBe(null)
    expect(await submit()).toMatchObject({
      title: null,
      slug: '',
      code: 'none'
    })
  })

  it('displays the value through `formatValue()` and stores it through `parseValue()`', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        fields: {
          tags: {
            type: 'text',
            formatValue: ({ value }) => value?.join(', '),
            parseValue: ({ value }) =>
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
        fields: {
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

  it('clears the value to `null`, not to its default value', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        fields: {
          title: { type: 'text', clearable: true, default: 'Untitled' }
        }
      }
    })
    await findField('title').find('.dito-affixes__clear').trigger('click')
    expect(data.title).toBe(null)
  })

  it('clears values with `nullable: false` to their default', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        fields: {
          title: {
            type: 'text',
            nullable: false,
            clearable: true,
            default: 'Untitled'
          }
        }
      },
      data: { title: 'Dune' }
    })
    await findField('title').find('.dito-affixes__clear').trigger('click')
    expect(data.title).toBe('Untitled')
  })

  it(`doesn't show the clear button for readonly fields`, async () => {
    const { findField } = await mountSchema({
      schema: {
        fields: {
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
        fields: {
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
        fields: {
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
        fields: {
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

  it('keeps password managers out of fields that are not about logins', async () => {
    const { findField } = await mountSchema({
      schema: {
        fields: {
          username: { type: 'text' },
          email: { type: 'email', autocomplete: 'off' },
          login: { type: 'text', autocomplete: 'username' },
          password: { type: 'password', autocomplete: 'new-password' }
        }
      }
    })
    const ignore = {
      'data-1p-ignore': '',
      'data-lpignore': 'true',
      'data-bwignore': '',
      'data-form-type': 'other'
    }
    const attributes = name => findField(name).find('input').attributes()
    expect(attributes('username')).toMatchObject(ignore)
    expect(attributes('email')).toMatchObject(ignore)
    for (const name of ['login', 'password']) {
      for (const key in ignore) {
        expect(attributes(name)).not.toHaveProperty(key)
      }
    }
  })

  it('uses the text of label objects as the title of the input', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { findField } = await mountSchema({
      schema: {
        fields: {
          title: { type: 'text', label: { text: 'Title', suffix: 'Book' } },
          author: { type: 'text', label: html`<b>Author</b> &amp; ${'Co'}` }
        }
      }
    })
    const getTitle = name => findField(name).find('input').attributes('title')
    expect(getTitle('title')).toBe('Title')
    expect(getTitle('author')).toBe('Author & Co')
    expect(warn).not.toHaveBeenCalled()
    warn.mockRestore()
  })

  it('labels the input by the element of `labelledBy`', async () => {
    const { findField } = await mountSchema({
      schema: {
        fields: {
          title: { type: 'text', label: false, labelledBy: 'title-text' }
        }
      }
    })
    const input = findField('title').find('input')
    expect(input.attributes('aria-labelledby')).toBe('title-text')
  })

  it('uses the matching input types for the text based types', async () => {
    const { findField } = await mountSchema({
      schema: {
        fields: {
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
      schema: { fields: { password: { type: 'password' } } },
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
    it('shows the errors of required fields on blur after edits', async () => {
      const { findField, getErrors } = await mountSchema({
        schema: {
          fields: { title: { type: 'text', required: true } }
        },
        data: { title: 'Dune' }
      })
      const input = findField('title').find('input')
      await input.trigger('focus')
      await input.setValue('')
      await input.trigger('blur')
      expect(getErrors('title')).toEqual(['The title field is required.'])
      await input.setValue('Dune')
      expect(getErrors('title')).toEqual([])
    })

    it('validates the format of the email type', async () => {
      const { findField, getErrors } = await mountSchema({
        schema: { fields: { email: { type: 'email' } } }
      })
      const input = findField('email').find('input')
      await input.trigger('focus')
      await input.setValue('reader@')
      await input.trigger('blur')
      expect(getErrors('email')).toHaveLength(1)
      await input.trigger('focus')
      await input.setValue('reader@example.com')
      await input.trigger('blur')
      expect(getErrors('email')).toEqual([])
    })

    it(`doesn't submit forms with invalid values`, async () => {
      const request = vi.fn(({ data }) => ({ data }))
      const { submit, getErrors } = await mountForm({
        schema: {
          fields: {
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

  describe('serializing', () => {
    it('trims values with `trim` and sends empty values, not defaults', async () => {
      const { findField, submit } = await mountForm({
        schema: {
          fields: {
            title: { type: 'text', trim: true },
            subtitle: { type: 'text' },
            note: { type: 'text', default: 'none' },
            summary: { type: 'text', default: 'none', nullable: false }
          }
        },
        data: {
          title: 'Dune',
          subtitle: 'Book',
          note: 'Read',
          summary: 'Long'
        },
        request: ({ data }) => ({ data })
      })
      await findField('title').find('input').setValue('  Emma ')
      await findField('subtitle').find('input').setValue('')
      await findField('note').find('input').setValue('')
      await findField('summary').find('input').setValue('')
      expect(await submit()).toMatchObject({
        title: 'Emma',
        subtitle: null,
        note: null,
        summary: ''
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
          fields: {
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
          fields: {
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
