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

export function label(str) {
  // Handle hyphenated, underscored and camel-cased property names and
  // expand them to title cased labels if no label was provided:
  // console.log(label('some-hyphenated-label'))
  // console.log(label('one_underscored_label'))
  // console.log(label('MyCamelcasedLabel'))
  return str
    ? str.replace(
      /([-_]|^)(\w)|([a-z])([A-Z])/g,
      function(all, hyphen, hyphenated, camelLeft, camelRight) {
        return hyphenated
          ? `${hyphen ? ' ' : ''}${hyphenated.toUpperCase()}`
          : `${camelLeft} ${camelRight}`
      })
    : ''
}
