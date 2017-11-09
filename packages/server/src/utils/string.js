import { asArray } from './object'
import os from 'os'

export function camelize(str, upper = false) {
  return str
    ? str.replace(/(^|[-_\s]+)(\w)/g, (all, sep, chr) => (
      upper || sep ? chr.toUpperCase() : chr.toLowerCase()
    ))
    : ''
}

export function decamelize(str, sep = ' ') {
  // TODO: Once JavaScript supports Unicode properties in regexps, switch to
  // better parsing that matches non-ASCII uppercase letters:
  // /([\p{Ll}\d])(\p{Lu})/gu
  return str
    ? str.replace(/([a-z\d])([A-Z])/g, `$1${sep}$2`).toLowerCase()
    : ''
}

export function hyphenate(str) {
  return decamelize(str, '-')
}

export function underscore(str) {
  return decamelize(str, '_')
}

export function capitalize(str) {
  return str
    ? str.replace(/(^|[^a-zA-Z\u00C0-\u017F'])([a-zA-Z\u00C0-\u017F])/g,
      chr => chr.toUpperCase())
    : ''
}

export function labelize(str) {
  // Handle hyphenated, underscored and camel-cased property names and
  // expand them to title cased labels if no label was provided:
  // console.log(labelize('some-hyphenated-label'))
  // console.log(labelize('one_underscored_label'))
  // console.log(labelize('MyCamelCasedLabel'))
  // console.log(labelize('hello world'))
  return str
    ? str.replace(
      /([-_ ]|^)(\w)|([a-z])([A-Z])/g,
      function (all, hyphen, hyphenated, camelLeft, camelRight) {
        return hyphenated
          ? `${hyphen ? ' ' : ''}${hyphenated.toUpperCase()}`
          : `${camelLeft} ${camelRight}`
      })
    : ''
}

// ES6 string tag that strips indentation from multi-line strings
// Based on, and further improved from https://github.com/dmnd/dedent
export function deindent(strings, ...values) {
  strings = asArray(strings)
  // First, perform interpolation
  let result = ''
  for (let i = 0; i < strings.length; i++) {
    result += strings[i]
      // Join lines when there is a suppressed newline
      .replace(/\\\n[ \t]*/g, '')
      // Handle escaped back-ticks
      .replace(/\\`/g, '`')
    if (i < values.length) {
      // See if the value itself contains multiple lines, and if so, indent
      // each of them by the whitespace that precedes it except the first.
      const value = `${values[i]}`
      const lines = value.split(/\r\n|\n|\r/)
      if (lines.length > 1) {
        // Determine indent by finding preceding white-space up to the previous
        // line-break or beginning of the string.
        const indent = (result.match(/(?:^|[\n\r])(\s*)$/) || [])[1] || ''
        result += lines.join(`${os.EOL}${indent}`)
      } else {
        result += value
      }
    }
  }
  const lines = result.split(/\r\n|\n|\r/)
  // Remove the first line-break at the beginning of the result, to allow this:
  // const value = `
  //   content...
  //   ` // line break at the end remains
  if (!lines[0]) lines.shift()
  let indent = Infinity
  for (const line of lines) {
    const match = line.match(/^(\s*)\S+/)
    if (match) {
      indent = Math.min(indent, match[1].length)
    }
  }
  return indent > 0
    ? lines.map(line => line.slice(indent)).join(os.EOL)
    : result
}
