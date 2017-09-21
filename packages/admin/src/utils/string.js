export function camelize(str, upper = true) {
  return str
    ? str.replace(/(^|[-_\s]+)(\w)/g, (all, sep, chr) => {
      return upper || sep ? chr.toUpperCase() : chr.toLowerCase()
    })
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
