export function camelize(str, pascalCase = false) {
  return str
    ? str
      // Trim beginnings and ends
      .replace(/^[-_\s]+|[-_\s]+$/g, '')
      .replace(
        /(^|[-_\s]+)(\w)([A-Z]*)([a-z]*)/g,
        (all, sep, first, upperRest, lowerRest) => `${
          pascalCase || sep ? first.toUpperCase() : first.toLowerCase()
        }${upperRest.toLowerCase()}${lowerRest}`
      )
    : ''
}
