export function stripTags(html) {
  return html != null
    ? html
        .toString()
        .replace(/<br\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
    : ''
}
