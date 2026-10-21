import {
  isPlainObject,
  isHtml,
  html,
  escapeHtml,
  deprecate
} from '@ditojs/utils'

// Content is text unless it's marked with `html`. Labels and affixes hold it as
// `text`, or as the deprecated `html` string:
export function getContent(content) {
  if (isPlainObject(content)) {
    const { text, html: htmlString } = content
    if (htmlString != null) {
      deprecate(
        '`{ html }` is deprecated, use the `html` template of @ditojs/utils ' +
        'instead, which escapes the values that it includes.'
      )
      return html([htmlString])
    }
    return text
  }
  return content
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
