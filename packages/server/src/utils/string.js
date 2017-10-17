export function camelCase(str, upper = false) {
  return str
    ? str.replace(/(^|[-_\s]+)(\w)/g, (all, sep, chr) => (
      upper || sep ? chr.toUpperCase() : chr.toLowerCase()
    ))
    : ''
}

export function lowerCase(str, sep = ' ') {
  return str
    ? str.replace(/([a-z\d])([A-Z])/g, `$1${sep}$2`).toLowerCase()
    : ''
}

export function kebabCase(str) {
  return lowerCase(str, '-')
}

export function snakeCase(str) {
  return lowerCase(str, '_')
}
