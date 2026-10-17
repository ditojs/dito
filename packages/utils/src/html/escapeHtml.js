export function escapeHtml(html) {
  return html != null
    ? html
        .toString()
        .replace(
          /["'&<>]/g,
          chr =>
            ({
              '"': '&quot;',
              [`'`]: '&#39;',
              '&': '&amp;',
              '<': '&lt;',
              '>': '&gt;'
            })[chr]
        )
    : ''
}
