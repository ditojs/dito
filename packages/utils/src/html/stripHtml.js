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
