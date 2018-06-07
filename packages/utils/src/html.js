export function escapeHtml(html) {
  return html
    ? `${html}`.replace(/["&<>]/g,
      chr => ({ '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;' })[chr])
    : ''
}

export function stripTags(html) {
  return html ? `${html}`.replace(/<[^>]+>/g, '') : ''
}
