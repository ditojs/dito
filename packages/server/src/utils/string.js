export function camelize(str) {
  return str
    ? str.replace(/(?:^|[-_])(\w)/g, (all, chr) => chr.toUpperCase())
    : ''
}

export function decamelize(str, sep) {
  return str
    ? str.replace(/([a-z\d])([A-Z])/g, `$1${sep || ''}$2`).toLowerCase()
    : ''
}

export function hyphenate(str) {
  return decamelize(str, '-')
}

export function underscore(str) {
  return decamelize(str, '_')
}
