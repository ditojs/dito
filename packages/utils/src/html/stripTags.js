export function stripTags(html) {
  return html != null
    ? html.toString().replace(/<[^>]+>/g, '')
    : ''
}
