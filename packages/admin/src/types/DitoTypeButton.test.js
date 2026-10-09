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

  // Bug: `onClick()` passes the error to `emitEvent()` as `{ error }` instead
  // of `{ context: { error } }`, so error handlers don't receive it.
  test.fails(
    'passes the errors of click handlers to error handlers',
    async () => {
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
      expect(onError.mock.calls[0][0].error?.message).toBe(
        'Publishing failed'
      )
    }
  )

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
})
