const entities = {
  '"': '&quot;',
  [`'`]: '&#39;',
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;'
}

export function escapeHtml(html) {
  return html != null
    ? html.toString().replace(/["'&<>]/g, chr => entities[chr])
    : ''
}
