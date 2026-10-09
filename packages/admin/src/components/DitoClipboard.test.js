import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import appState from '../appState.js'
import { mountForm } from '../test/mount.js'

function getNotificationTexts() {
  return [...document.querySelectorAll('.dito-notification')].map(
    notification => notification.textContent
  )
}

async function mountBookForm(clipboard = true) {
  const result = await mountForm({
    schema: {
      clipboard,
      components: { title: { type: 'text' } }
    },
    data: { title: 'Emma' }
  })
  const { wrapper } = result
  return {
    ...result,
    copyButton: wrapper.find('.dito-clipboard .dito-button--copy'),
    pasteButton: wrapper.find('.dito-clipboard .dito-button--paste')
  }
}

describe('DitoClipboard', () => {
  let alert

  beforeEach(() => {
    // Notifications are logged too:
    vi.spyOn(console, 'error').mockImplementation(() => {})
    alert = vi.fn()
    vi.stubGlobal('alert', alert)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    appState.clipboardData = null
  })

  it('notifies malformed clipboard data when pasting', async () => {
    const { copyButton, pasteButton } = await mountBookForm()
    await copyButton.trigger('click')
    await flushPromises()
    vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue('{ title')
    await pasteButton.trigger('click')
    await flushPromises()
    expect(alert).not.toHaveBeenCalled()
    expect(getNotificationTexts().join()).toContain(
      'The data in the clipboard appears to be malformed'
    )
  })

  it('notifies errors of `clipboard.copy()`', async () => {
    const { copyButton } = await mountBookForm({
      copy() {
        throw new Error('Copying failed')
      }
    })
    await copyButton.trigger('click')
    await flushPromises()
    expect(alert).not.toHaveBeenCalled()
    expect(getNotificationTexts().join()).toContain('Copying failed')
  })

  it('notifies errors of `clipboard.paste()`', async () => {
    const { copyButton, pasteButton } = await mountBookForm({
      paste() {
        throw new Error('Pasting failed')
      }
    })
    await copyButton.trigger('click')
    await flushPromises()
    await pasteButton.trigger('click')
    await flushPromises()
    expect(alert).not.toHaveBeenCalled()
    expect(getNotificationTexts().join()).toContain('Pasting failed')
  })
})
