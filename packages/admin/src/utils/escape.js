export default function escape(html) {
  return html.replace(/["&<>]/g, function (chr) {
    return { '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;' }[chr]
  })
}
