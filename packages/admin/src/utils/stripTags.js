export default function stripTags(html) {
  return html ? html.replace(/<[^>]+>/g, '') : ''
}
