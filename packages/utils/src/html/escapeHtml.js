export function escapeHtml(html) {
  return html != null
    ? html
        .toString()
        .replace(
          /["&<>]/g,
          chr =>
            ({ '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;' }[chr])
        )
    : ''
}
