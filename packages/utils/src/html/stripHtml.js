import { deprecate } from '../function/deprecate.js'

export function stripHtml(html) {
  return html != null
    ? html
        .toString()
        .replace(/<br\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
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
