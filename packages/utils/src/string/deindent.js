import { asArray } from '../base/index.js'

// ES6 string tag that strips indentation from multi-line strings
// Based on, and further improved from https://github.com/dmnd/dedent
export function deindent(strings, ...values) {
  // Small helper to determine the actual line-break used in the strings, based
  // on the  line-breaks encountered.
  const getLineBreak = line => line.match(/^(\n|\r\n|\r)/)?.[1] || '\n'

  strings = asArray(strings)
  // First, perform interpolation
  let parts = []
  for (let i = 0; i < strings.length; i++) {
    parts.push(strings[i]
      // Join lines when there is a line-break suppressed by a preceding '\\'
      .replace(/\\\n\s*/g, '')
      // Handle escaped back-ticks
      .replace(/\\`/g, '`'))
    if (i < values.length) {
      // See if the value itself contains multiple lines, and if so, indent
      // each of them by the whitespace that precedes it except the first.
      const value = values[i].toString()
      const lines = value.split(/\n|\r\n|\r/)
      if (lines.length > 1) {
        // Determine the indent by finding the immediately preceding white-space
        // up to the previous line-break or the beginning of the string.
        // (?:^[\n\r]*|[\n\r])  # Start at either the beginning or the previous
        //                      # line break.
        // (?:[\n\r]*)          # The line break
        // (\s+)                # Collect the indenting white-space...
        // (?:[^\n\r]*)$        # ...up to the end or the next word, but in last
        //                      # line, by making sure no line breaks follow
        //                      # until the end.
        const str = parts.join('')
        const match = str.match(/((?:^[\n\r]*|[\n\r])(?:[\n\r]*))(\s+)(?:[^\n\r]*)$/)
        const [, lineBreaks = '', indent = ''] = match || []
        parts = [str]
        parts.push(lines.join(`${getLineBreak(lineBreaks)}${indent}`))
      } else {
        parts.push(value)
      }
    }
  }
  const str = parts.join('')
  const lines = str.split(/\n|\r\n|\r/)
  // Remove the first line-break at the beginning of the result, to allow this:
  // const value = `
  //   content...
  //   ` // line break at the end remains
  let offset = 0
  if (!lines[0]) {
    lines.shift()
    offset++
  }
  let indent = Infinity
  for (const line of lines) {
    const match = line.match(/^(\s*)\S+/)
    if (match) {
      indent = Math.min(indent, match[1].length)
    }
  }
  const index = lines[0].length + offset
  const lineBreak = getLineBreak(str.slice(index, index + 2))
  return lines.map(line => line.slice(indent)).join(lineBreak)
}
