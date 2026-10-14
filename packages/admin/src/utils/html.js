import { isObject, escapeHtml } from '@ditojs/utils'

// Content is text, also as `{ text }`, unless it's given as `{ html }`:
export function getHtml(content) {
  const { text, html } = isObject(content) ? content : { text: content }
  return html ?? (text != null ? escapeHtml(text) : null)
}

export function getText(content) {
  const { text, html } = isObject(content) ? content : { text: content }
  return text ?? getTextFromHtml(html)
}

// Unlike `stripHtml()`, also unescape characters. Documents that `DOMParser`
// creates are inert: they don't run scripts or load images.
export function getTextFromHtml(html) {
  if (html == null) return null
  const { body } = new DOMParser().parseFromString(html, 'text/html')
  return body.textContent.trim()
}
