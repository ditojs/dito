export function labelize(str) {
  // Handle hyphenated, underscored and camel-cased property names and
  // expand them to title cased labels.
  return str
    ? str.replace(
        /[-_](?=\W)|([-_ ]|^)(\w)|([a-z])(?=[A-Z0-9])|(\d)([a-zA-Z])/g,
        (all, hyphen, hyphenated, camel, decimal, decimalNext) =>
          all === '-' || all === '_'
            ? ' '
            : hyphenated
              ? `${hyphen ? ' ' : ''}${hyphenated.toUpperCase()}`
              : camel
                ? `${camel} `
                : `${decimal} ${decimalNext.toUpperCase()}`
      )
    : ''
}
