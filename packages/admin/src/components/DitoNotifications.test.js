import { vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { mountAdmin } from '../test/mount.js'

function findNotifications() {
  return [...document.querySelectorAll('.dito-notification')]
}

async function mountNotifications() {
  const admin = await mountAdmin({
    views: { books: { type: 'view', label: 'Books', components: {} } }
  })
  return admin.root.$refs.notifications
}

describe('DitoNotifications', () => {
  beforeEach(() => {
    // Notifications are logged too:
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('escapes the title and the paragraphs of `text`', async () => {
    const notifications = await mountNotifications()
    notifications.notify({
      title: '<i>Saved</i>',
      text: ['<img src="x" onerror="alert(1)">', 'Tom & Jerry']
    })
    await flushPromises()
    const [notification] = findNotifications()
    expect(notification.querySelector('img, i')).toBe(null)
    expect(notification.querySelector('.notification-title').textContent).toBe(
      '<i>Saved</i>'
    )
    expect(
      [...notification.querySelectorAll('p')].map(p => p.textContent)
    ).toEqual(['<img src="x" onerror="alert(1)">', 'Tom & Jerry'])
  })

  it('renders the paragraphs of `html` as HTML', async () => {
    const notifications = await mountNotifications()
    notifications.notify({ html: ['<b>Emma</b> was saved.', 'Line\nbreak'] })
    await flushPromises()
    const [notification] = findNotifications()
    expect(notification.querySelector('p b').textContent).toBe('Emma')
    expect(notification.querySelectorAll('p')[1].innerHTML).toBe(
      'Line<br>break'
    )
  })

  it('warns when `text` seems to contain HTML markup', async () => {
    const notifications = await mountNotifications()
    notifications.notify({ text: '<a href="/books/1">Book created</a>' })
    expect(console.warn).toHaveBeenCalledTimes(1)
    expect(console.warn.mock.calls[0][0]).toMatch('Use the `html` option')
  })

  it("doesn't warn about plain text or `html`", async () => {
    const notifications = await mountNotifications()
    notifications.notify({ text: ['Sorted by price < 10', 'Tom & Jerry'] })
    notifications.notify({ html: '<b>Saved</b>' })
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('skips empty paragraphs', async () => {
    const notifications = await mountNotifications()
    notifications.notify({ text: ['Saved.', false, null] })
    notifications.notify({ html: ['<b>Saved.</b>', false] })
    await flushPromises()
    expect(
      findNotifications().map(notification =>
        [...notification.querySelectorAll('p')].map(p => p.textContent)
      )
    ).toEqual([['Saved.'], ['Saved.']])
  })

  it('closes all notifications', async () => {
    const notifications = await mountNotifications()
    notifications.notify({ text: 'One' })
    notifications.notify({ text: 'Two' })
    await flushPromises()
    expect(findNotifications()).toHaveLength(2)
    notifications.destroyAll()
    await flushPromises()
    await vi.waitFor(() => expect(findNotifications()).toHaveLength(0))
  })
})
