// Test helpers that dispatch events as browsers do, for the components that
// are built on reka-ui.
import { flushPromises } from '@vue/test-utils'

// Clicks the element at least a millisecond after it was mounted. Vue ignores
// events in the millisecond in which their listener was attached once another
// Vue listener saw them, e.g. the capture listener of `DitoButton`.
export async function click(element) {
  await new Promise(resolve => setTimeout(resolve, 1))
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }))
  await flushPromises()
}

// Presses the key on the focused element, like the keyboard does, and returns
// the event, e.g. to check whether it was prevented.
export async function pressKey(key, element = document.activeElement) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true
  })
  element.dispatchEvent(event)
  await flushPromises()
  return event
}

// Presses the mouse on the element. reka-ui listens for presses outside of its
// popups and dialogs only after a timeout:
export async function pointerDown(element) {
  await new Promise(resolve => setTimeout(resolve))
  element.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, button: 0 })
  )
  await flushPromises()
}
