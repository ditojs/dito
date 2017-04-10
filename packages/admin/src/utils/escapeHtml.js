export default function escapeHtml(html) {
  return html.replace(/["&<>]/g, function (chr) {
    return { '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;' }[chr]
  })
}
