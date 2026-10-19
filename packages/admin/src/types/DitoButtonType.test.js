import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSchema, mountForm } from '../test/mount.js'
import { defineType } from '../utils/schema/types.ts'
import DitoButtonType from './DitoButtonType.vue'

function getNotificationTexts() {
  return [...document.querySelectorAll('.dito-notification')].map(
    notification => notification.textContent
  )
}

describe('DitoButtonType', () => {
  it('renders the text and calls the click handler with the item', async () => {
    const onClick = vi.fn()
    const { findField } = await mountSchema({
      schema: {
        fields: {
          title: { type: 'text' },
          shuffle: { type: 'button', text: 'Shuffle', onClick }
        }
      },
      data: { title: 'Emma' }
    })
    const button = findField('shuffle')
    expect(button.text()).toBe('Shuffle')
    await button.trigger('click')
    await flushPromises()
    expect(onClick).toHaveBeenCalledOnce()
    expect(onClick.mock.calls[0][0].item.title).toBe('Emma')
  })

  it('lets click handlers change the data', async () => {
    const { findField, data } = await mountSchema({
      schema: {
        fields: {
          title: { type: 'text' },
          uppercase: {
            type: 'button',
            onClick({ item }) {
              item.title = item.title.toUpperCase()
            }
          }
        }
      },
      data: { title: 'Emma' }
    })
    await findField('uppercase').trigger('click')
    await flushPromises()
    expect(data.title).toBe('EMMA')
    expect(findField('title').find('input').element.value).toBe('EMMA')
  })

  it('styles and names buttons without text by their verb', async () => {
    const { findField } = await mountSchema({
      schema: { fields: { cancel: { type: 'button' } } }
    })
    const button = findField('cancel')
    expect(button.classes()).toContain('dito-button--cancel')
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('title')).toBe('Cancel')
    expect(button.attributes('aria-label')).toBe('Cancel')
  })

  it('names buttons with text by it, not by their verb', async () => {
    const { findField } = await mountSchema({
      schema: { fields: { cancel: { type: 'button', text: 'Discard' } } }
    })
    const button = findField('cancel')
    expect(button.classes()).toContain('dito-button--cancel')
    expect(button.attributes('title')).toBe('Discard')
    expect(button.attributes('aria-label')).toBeUndefined()
  })

  it('styles buttons as primary through `primary`', async () => {
    const { findField } = await mountSchema({
      schema: {
        fields: {
          remove: { type: 'button', primary: ({ item }) => item.isSaved },
          cancel: { type: 'button' }
        }
      },
      data: { isSaved: true }
    })
    expect(findField('remove').classes()).toContain('dito-button--primary')
    expect(findField('cancel').classes()).not.toContain('dito-button--primary')
  })

  it('is excluded from the data', async () => {
    const { data } = await mountSchema({
      schema: { fields: { shuffle: { type: 'button' } } }
    })
    expect('shuffle' in data).toBe(false)
  })

  it('disables the button through `disabled()`', async () => {
    const { findField, data, settle } = await mountSchema({
      schema: {
        fields: {
          title: { type: 'text' },
          clear: {
            type: 'button',
            disabled: ({ item }) => !item.title
          }
        }
      },
      data: { title: '' }
    })
    expect(findField('clear').attributes('disabled')).toBeDefined()
    data.title = 'Emma'
    await settle()
    expect(findField('clear').attributes('disabled')).toBeUndefined()
  })

  it('notifies errors that click handlers throw', async () => {
    // Notifications are logged too:
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { findField } = await mountSchema({
      schema: {
        fields: {
          publish: {
            type: 'button',
            onClick() {
              throw new Error('Publishing failed')
            }
          }
        }
      }
    })
    await findField('publish').trigger('click')
    await flushPromises()
    expect(getNotificationTexts().join()).toContain('Publishing failed')
  })

  it('passes the errors of click handlers to error handlers', async () => {
    const onError = vi.fn(() => false)
    const { findField } = await mountSchema({
      schema: {
        fields: {
          publish: {
            type: 'button',
            onClick() {
              throw new Error('Publishing failed')
            },
            onError
          }
        }
      }
    })
    await findField('publish').trigger('click')
    await flushPromises()
    expect(onError.mock.calls[0][0].error?.message).toBe(
      'Publishing failed'
    )
  })

  it('is disabled when readonly', async () => {
    const { findField } = await mountSchema({
      schema: {
        fields: {
          publish: { type: 'button', readonly: true }
        }
      }
    })
    expect(findField('publish').attributes('disabled')).toBeDefined()
  })

  it('is busy and ignores clicks while its action runs', async () => {
    let finishClick
    const onClick = vi.fn(
      () =>
        new Promise(resolve => {
          finishClick = resolve
        })
    )
    const { findField } = await mountSchema({
      schema: {
        fields: {
          publish: { type: 'button', onClick }
        }
      }
    })
    const button = findField('publish')
    await button.trigger('click')
    await flushPromises()
    expect(button.attributes('aria-busy')).toBe('true')
    await button.trigger('click')
    await flushPromises()
    expect(onClick).toHaveBeenCalledOnce()
    finishClick()
    await flushPromises()
    expect(button.attributes('aria-busy')).toBe('false')
    await button.trigger('click')
    await flushPromises()
    expect(onClick).toHaveBeenCalledTimes(2)
  })

  it('keeps the disabled state of its schema while its action runs', async () => {
    // `disabled` reflects the state of the schema, e.g. of a form that can't
    // be submitted, and only changes with it, not with the running action.
    let finishSubmit
    const request = vi.fn(
      ({ data }) =>
        new Promise(resolve => {
          finishSubmit = () => resolve({ data })
        })
    )
    const { findField } = await mountForm({
      schema: {
        fields: { title: { type: 'text' } },
        buttons: { submit: { closeForm: false } }
      },
      data: { title: 'Dune' },
      request
    })
    const button = findField('submit')
    await button.trigger('click')
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce())
    expect(button.attributes('aria-busy')).toBe('true')
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    await flushPromises()
    expect(request).toHaveBeenCalledOnce()
    finishSubmit()
    await flushPromises()
    expect(button.attributes('aria-busy')).toBe('false')
  })

  it('lets click handlers end the running state early', async () => {
    let finishClick
    const { findField } = await mountSchema({
      schema: {
        fields: {
          publish: {
            type: 'button',
            onClick(context) {
              context.isRunning = false
              return new Promise(resolve => {
                finishClick = resolve
              })
            }
          }
        }
      }
    })
    const button = findField('publish')
    await button.trigger('click')
    await flushPromises()
    expect(button.attributes('aria-busy')).toBe('false')
    finishClick()
  })

  it('tells the schema values whether its action is running', async () => {
    let finishClick
    const { findField } = await mountSchema({
      schema: {
        fields: {
          publish: {
            type: 'button',
            suffix: {
              type: 'text',
              text: 'Running',
              if: ({ isRunning }) => isRunning
            },
            onClick() {
              return new Promise(resolve => {
                finishClick = resolve
              })
            }
          }
        }
      }
    })
    const button = findField('publish')
    expect(button.text()).not.toContain('Running')
    await button.trigger('click')
    await flushPromises()
    expect(button.text()).toContain('Running')
    finishClick()
    await flushPromises()
    expect(button.text()).not.toContain('Running')
  })

  it('lets error handlers prevent the notification of errors', async () => {
    const onError = vi.fn(() => false)
    const { findField } = await mountSchema({
      schema: {
        fields: {
          publish: {
            type: 'button',
            onClick() {
              throw new Error('Publishing failed')
            },
            onError
          }
        }
      }
    })
    await findField('publish').trigger('click')
    await flushPromises()
    expect(onError).toHaveBeenCalledOnce()
    expect(getNotificationTexts().join()).not.toContain(
      'Publishing failed'
    )
  })

  it('only shows the notifications of error handlers that notify', async () => {
    const { findField } = await mountSchema({
      schema: {
        fields: {
          publish: {
            type: 'button',
            onClick() {
              throw new Error('Publishing failed')
            },
            onError({ notify }) {
              notify({ type: 'error', text: 'Try again later' })
            }
          }
        }
      }
    })
    await findField('publish').trigger('click')
    await flushPromises()
    const texts = getNotificationTexts().join()
    expect(texts).toContain('Try again later')
    expect(texts).not.toContain('Publishing failed')
  })

  it('submits the form to the resource of the button', async () => {
    const request = vi.fn(({ data }) => ({ data }))
    const { findField } = await mountForm({
      schema: {
        fields: {
          title: { type: 'text' },
          publish: {
            type: 'button',
            resource: { path: 'publish', method: 'post' }
          }
        }
      },
      data: { title: 'Emma' },
      request
    })
    await findField('publish').trigger('click')
    await vi.waitFor(() => expect(request).toHaveBeenCalled())
    expect(request.mock.calls[0][0]).toMatchObject({
      method: 'post',
      url: '/items/1/publish',
      data: { title: 'Emma' }
    })
  })

  it('submits the form through `submit()` of its context', async () => {
    const request = vi.fn(({ data }) => ({ data }))
    let isSubmitted = null
    const { findField } = await mountForm({
      schema: {
        fields: { title: { type: 'text' } },
        buttons: {
          submit: {
            closeForm: false,
            async onClick({ submit }) {
              isSubmitted = await submit()
            }
          }
        }
      },
      data: { title: 'Emma' },
      request
    })
    await findField('submit').trigger('click')
    await vi.waitFor(() => expect(isSubmitted).toBe(true))
    expect(request).toHaveBeenCalledOnce()
    expect(request.mock.calls[0][0]).toMatchObject({
      url: '/items/1',
      data: { title: 'Emma' }
    })
  })

  it('submits through `submit()` of types that use its component', async () => {
    defineType({
      type: 'save-button',
      component: DitoButtonType,
      defaultValue: undefined,
      defaultExclude: true
    })
    const request = vi.fn(({ data }) => ({ data }))
    let isSubmitted = null
    const { findField } = await mountForm({
      schema: {
        fields: { title: { type: 'text' } },
        buttons: {
          save: {
            type: 'save-button',
            async onClick({ submit }) {
              isSubmitted = await submit({ closeForm: false })
            }
          }
        }
      },
      data: { title: 'Emma' },
      request
    })
    await findField('save').trigger('click')
    await vi.waitFor(() => expect(isSubmitted).toBe(true))
    expect(request.mock.calls[0][0]).toMatchObject({ url: '/items/1' })
  })

  it(`throws from \`submit()\` without a form or list to submit`, async () => {
    const onError = vi.fn(() => false)
    const { findField } = await mountSchema({
      schema: {
        fields: {
          publish: {
            type: 'button',
            onClick: ({ submit }) => submit(),
            onError
          }
        }
      }
    })
    await findField('publish').trigger('click')
    await flushPromises()
    expect(onError.mock.calls[0][0].error?.message).toBe(
      'Unable to submit: There is no button of a form or source.'
    )
  })

  it('notifies errors of preparing the data to submit', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const request = vi.fn(({ data }) => ({ data }))
    const { findField } = await mountForm({
      schema: {
        fields: {
          title: {
            type: 'text',
            serializeValue() {
              throw new Error('Title cannot be serialized')
            }
          },
          publish: {
            type: 'button',
            resource: { path: 'publish', method: 'post' }
          }
        }
      },
      data: { title: 'Emma' },
      request
    })
    await findField('publish').trigger('click')
    await flushPromises()
    expect(request).not.toHaveBeenCalled()
    expect(getNotificationTexts().join()).toContain(
      'Title cannot be serialized'
    )
    expect(findField('publish').attributes('aria-busy')).toBe('false')
  })

  it('shows default notifications after handlers notified before', async () => {
    // Handlers that notify replace the default notification, but only for
    // the request that they handle.
    let notifyCount = 0
    const { findField } = await mountForm({
      schema: {
        fields: {
          publish: {
            type: 'button',
            resource: { path: 'publish', method: 'post' },
            onSuccess({ notify }) {
              if (notifyCount++ === 0) {
                notify({ type: 'info', text: 'Published the first time' })
              }
            }
          }
        }
      },
      data: { title: 'Emma' },
      request: () => ({ data: {} })
    })
    const button = findField('publish')
    await button.trigger('click')
    await vi.waitFor(() => expect(notifyCount).toBe(1))
    await flushPromises()
    expect(getNotificationTexts().join()).not.toContain('Successfully Saved')
    await button.trigger('click')
    await vi.waitFor(() => expect(notifyCount).toBe(2))
    await flushPromises()
    expect(getNotificationTexts().join()).toContain('Successfully Saved')
  })
})
