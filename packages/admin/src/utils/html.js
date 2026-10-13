// Unlike `stripHtml()`, also unescape characters. Documents that `DOMParser`
// creates are inert: they don't run scripts or load images.
export function getTextFromHtml(html) {
  if (html == null) return null
  const { body } = new DOMParser().parseFromString(html, 'text/html')
  return body.textContent.trim()
}
