export function decamelize(str, sep = ' ') {
  return str
    ? str
        .replace(
          // TODO: Once JavaScript supports Unicode property escapes in regexps,
          // switch to better parsing that matches non-ASCII uppercase letters:
          // /([\p{Ll}\d])(\p{Lu})/gu
          // See: https://caniuse.com/?search=Unicode%20property%20escape
          /([a-z\d])([A-Z])|(\S)(?:\s+)(\S)/g,
          (all, lower, upper, beforeSpace, afterSpace) =>
            upper
              ? `${lower}${sep}${upper}`
              : `${beforeSpace}${sep}${afterSpace}`
        )
        .toLowerCase()
    : ''
}

export function hyphenate(str) {
  return decamelize(str, '-')
}

export function underscore(str) {
  return decamelize(str, '_')
}
