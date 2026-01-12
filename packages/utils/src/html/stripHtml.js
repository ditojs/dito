import { deprecate } from '../function/deprecate.js'

export function stripHtml(html) {
  return html != null
    ? html
        .toString()
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .trim()
    : ''
}

/**
 * @deprecated Use stripHtml() instead
 */
export function stripTags(html) {
  deprecate(
    'The `stripTags` function is deprecated in favour of `stripHtml`. ' +
    'Update your code to use `stripHtml` instead.'
  )
  return stripHtml(html)
}
