import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountSchema, mountForm } from '../test/mount.js'

function getNotificationTexts() {
  return [...document.querySelectorAll('.dito-notification')].map(
    notification => notification.textContent
  )
}

describe('DitoTypeButton', () => {
  it('renders the text and calls the click handler with the item', async () => {
    const onClick = vi.fn()
    const { findField } = await mountSchema({
      schema: {
        components: {
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
        components: {
          title: { type: 'text' },
          uppercase: {
            type: 'button',
            events: {
              click({ item }) {
                item.title = item.title.toUpperCase()
              }
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
      schema: { components: { cancel: { type: 'button' } } }
    })
    const button = findField('cancel')
    expect(button.classes()).toContain('dito-button--cancel')
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('title')).toBe('Cancel')
    expect(button.attributes('aria-label')).toBe('Cancel')
  })

  it('names buttons with text by it, not by their verb', async () => {
    const { findField } = await mountSchema({
      schema: { components: { cancel: { type: 'button', text: 'Discard' } } }
    })
    const button = findField('cancel')
    expect(button.classes()).toContain('dito-button--cancel')
    expect(button.attributes('title')).toBe('Discard')
    expect(button.attributes('aria-label')).toBeUndefined()
  })

  it('is excluded from the data', async () => {
    const { data } = await mountSchema({
      schema: { components: { shuffle: { type: 'button' } } }
    })
    expect('shuffle' in data).toBe(false)
  })

  it('disables the button through `disabled()`', async () => {
    const { findField, data, settle } = await mountSchema({
      schema: {
        components: {
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
        components: {
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
        components: {
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
    expect(onError.mock.calls[0][0].error?.errors[0].message).toBe(
      'Publishing failed'
    )
  })

  it('is disabled when readonly', async () => {
    const { findField } = await mountSchema({
      schema: {
        components: {
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
        components: {
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
        components: { title: { type: 'text' } },
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
        components: {
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

  it('lets error handlers prevent the notification of errors', async () => {
    const onError = vi.fn(() => false)
    const { findField } = await mountSchema({
      schema: {
        components: {
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

  it('submits the form to the resource of the button', async () => {
    const request = vi.fn(({ data }) => ({ data }))
    const { findField } = await mountForm({
      schema: {
        components: {
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

  it('notifies errors of preparing the data to submit', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const request = vi.fn(({ data }) => ({ data }))
    const { findField } = await mountForm({
      schema: {
        components: {
          title: {
            type: 'text',
            process() {
              throw new Error('Title cannot be processed')
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
      'Title cannot be processed'
    )
    expect(findField('publish').attributes('aria-busy')).toBe('false')
  })

  it('shows default notifications after handlers notified before', async () => {
    // Handlers that notify replace the default notification, but only for
    // the request that they handle.
    let notifyCount = 0
    const { findField } = await mountForm({
      schema: {
        components: {
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
