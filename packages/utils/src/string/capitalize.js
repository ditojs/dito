export function capitalize(str) {
  return str
    ? str.replace(
        /(^|[^a-zA-Z0-9\u00C0-\u017F'])([a-zA-Z\u00C0-\u017F])/g,
        chr => chr.toUpperCase()
      )
    : ''
}
