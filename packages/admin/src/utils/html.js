import { isPlainObject, isHtml, escapeHtml } from '@ditojs/utils'

// Content is text unless it's marked with `html`. Labels and affixes hold it as
// `text`:
export function getContent(content) {
  return isPlainObject(content) ? content.text : content
}

export function getHtml(content) {
  content = getContent(content)
  return isHtml(content)
    ? content.value
    : content != null
      ? escapeHtml(content)
      : null
}

export function getText(content) {
  content = getContent(content)
  return isHtml(content) ? getTextFromHtml(content.value) : (content ?? null)
}

// Unlike `stripHtml()`, also unescape characters. Documents that `DOMParser`
// creates are inert: they don't run scripts or load images.
export function getTextFromHtml(html) {
  if (html == null) return null
  const { body } = new DOMParser().parseFromString(html, 'text/html')
  return body.textContent.trim()
}
