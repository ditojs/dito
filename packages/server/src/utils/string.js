export function camelize(str, upper = false) {
  return str
    ? str.replace(/(^|[-_\s]+)(\w)/g, (all, sep, chr) => (
      upper || sep ? chr.toUpperCase() : chr.toLowerCase()
    ))
    : ''
}

export function decamelize(str, sep = ' ') {
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
