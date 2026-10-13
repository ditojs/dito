import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import SchemaContext from '../SchemaContext.js'
import { mountSchema, enterValue } from '../test/mount.js'

describe('useSchemaEvents()', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls `on[A-Z]` handlers of native events', async () => {
    const onMouseenter = vi.fn()
    const onDblclick = vi.fn()
    const { findField } = await mountSchema({
      schema: {
        components: {
          title: {
            type: 'text',
            onMouseenter,
            onDblclick
          }
        }
      }
    })
    const input = findField('title').find('input')
    await input.trigger('mouseenter')
    await input.trigger('dblclick')
    await flushPromises()
    expect(onMouseenter).toHaveBeenCalledOnce()
    expect(onDblclick).toHaveBeenCalledOnce()
  })

  it('calls the handlers with their context only', async () => {
    let receiver = null
    let context = null
    const { findField } = await mountSchema({
      schema: {
        components: {
          title: {
            type: 'text',
            onChange(ctx) {
              receiver = this
              context = ctx
            }
          }
        }
      }
    })
    await enterValue(findField('title').find('input'), 'Emma')
    expect(receiver).toBe(undefined)
    expect(context).toBeInstanceOf(SchemaContext)
    expect(context.value).toBe('Emma')
  })

  it('passes changes of nested data with their data paths', async () => {
    const dataPaths = []
    const { findField, data, settle } = await mountSchema({
      schema: {
        components: {
          title: { type: 'text' },
          author: {
            type: 'object',
            inlined: true,
            form: {
              type: 'form',
              components: { name: { type: 'text' } }
            }
          },
          chapters: {
            type: 'list',
            inlined: true,
            form: {
              type: 'form',
              components: { heading: { type: 'text' } }
            }
          }
        },
        onChange({ dataPath }) {
          dataPaths.push(dataPath)
        }
      },
      data: {
        title: 'Emma',
        author: { name: 'Austen' },
        chapters: [{ heading: 'One' }]
      }
    })
    await enterValue(findField('author/name').find('input'), 'Jane Austen')
    await enterValue(findField('chapters/0/heading').find('input'), 'I')
    // Writes that aren't edits don't emit `change`:
    data.title = 'Persuasion'
    await settle()
    expect(dataPaths).toEqual(['author/name', 'chapters/0/heading'])
  })

  it('passes bubbled changes with the data path of the handler', async () => {
    const dataPaths = []
    const onChange = ({ dataPath, currentDataPath }) => {
      dataPaths.push([dataPath, currentDataPath])
    }
    const { findField } = await mountSchema({
      schema: {
        components: {
          chapters: {
            type: 'list',
            inlined: true,
            form: {
              type: 'form',
              components: { heading: { type: 'text', onChange } },
              onChange
            }
          }
        },
        onChange
      },
      data: { chapters: [{ heading: 'One' }] }
    })
    await enterValue(findField('chapters/0/heading').find('input'), 'I')
    expect(dataPaths).toEqual([
      ['chapters/0/heading', 'chapters/0/heading'],
      ['chapters/0/heading', 'chapters/0'],
      ['chapters/0/heading', '']
    ])
  })

  it('logs errors for events that are no functions', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { findField } = await mountSchema({
      schema: {
        components: {
          title: { type: 'text', onDblclick: 'not a function' }
        }
      }
    })
    await findField('title').find('input').trigger('dblclick')
    expect(error).toHaveBeenCalledWith(
      'Invalid event definition: onDblclick: not a function'
    )
  })

  it('stops bubbling changes when a handler returns `false`', async () => {
    const onChange = vi.fn()
    const { findField } = await mountSchema({
      schema: {
        components: {
          title: { type: 'text', onChange: () => false },
          author: { type: 'text' }
        },
        onChange
      }
    })
    await enterValue(findField('title').find('input'), 'Emma')
    expect(onChange).not.toHaveBeenCalled()
    await enterValue(findField('author').find('input'), 'Austen')
    expect(onChange).toHaveBeenCalledOnce()
  })
})
