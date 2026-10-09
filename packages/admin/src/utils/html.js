// Returns the text of `html`, e.g. of labels, which are HTML with escaped item
// values, see `getItemLabel()`: Unlike `stripHtml()`, this also unescapes the
// escaped characters. Documents that `DOMParser` creates are inert: they don't
// run scripts or load images. Returns `null` for `null` or `undefined`.
export function getTextFromHtml(html) {
  if (html == null) return null
  const { body } = new DOMParser().parseFromString(html, 'text/html')
  return body.textContent.trim()
}
