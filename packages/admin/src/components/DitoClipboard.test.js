import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import appState from '../appState.js'
import { copyClipboardData } from '../utils/clipboard.js'
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
  const isChrome = appState.agent.chrome
  let alert

  beforeEach(() => {
    // Notifications are logged too:
    vi.spyOn(console, 'error').mockImplementation(() => {})
    alert = vi.fn()
    vi.stubGlobal('alert', alert)
  })

  afterEach(async () => {
    appState.agent.chrome = isChrome
    await copyClipboardData('reset', null)
    vi.restoreAllMocks()
  })

  it('pastes copied data, also without a system clipboard', async () => {
    const { copyButton, pasteButton, findField } = await mountBookForm()
    vi.spyOn(navigator.clipboard, 'readText').mockRejectedValue(
      new Error('Read permission denied')
    )
    expect(pasteButton.attributes('disabled')).toBeDefined()
    await copyButton.trigger('click')
    await flushPromises()
    expect(pasteButton.attributes('disabled')).toBeUndefined()
    const input = findField('title').find('input')
    await input.setValue('Persuasion')
    await pasteButton.trigger('click')
    await flushPromises()
    expect(input.element.value).toBe('Emma')
  })

  it('reads the system clipboard in Chrome to enable pasting', async () => {
    appState.agent.chrome = true
    vi.spyOn(navigator.clipboard, 'readText').mockResolvedValue(
      JSON.stringify({ title: 'Dune' })
    )
    const { pasteButton, findField } = await mountBookForm()
    await flushPromises()
    expect(pasteButton.attributes('disabled')).toBeUndefined()
    await pasteButton.trigger('click')
    await flushPromises()
    expect(findField('title').find('input').element.value).toBe('Dune')
  })

  it(`doesn't enable pasting data of other schemas`, async () => {
    const { pasteButton } = await mountBookForm()
    await copyClipboardData('author', { name: 'Jane' })
    await flushPromises()
    expect(pasteButton.attributes('disabled')).toBeDefined()
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
