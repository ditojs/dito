export function describeFunction(func) {
  // A helper that describes a method by turning it int a short version without
  // printing its body.
  const match = func.toString().match(
    /^\s*(?:function[^(]*\(([^)]*)\)|\(([^)]*)\)\s*=>|(\S*)\s*=>)\s*(.)/
  )
  if (match) {
    const body = match[4] === '{' ? '{ ... }' : '...'
    return match[1] !== undefined ? `function (${match[1]}) ${body}`
      : match[2] !== undefined ? `(${match[2]}) => ${body}`
      : match[3] !== undefined ? `${match[3]} => ${body}`
      : ''
  }
}
