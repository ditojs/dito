export function describeFunction(func) {
  // A helper that describes a method by turning it int a short version without
  // printing its body.
  const match = func.toString().match(
    /^\s*(async\s*|)(?:function[^(]*\(([^)]*)\)|\(([^)]*)\)\s*=>|(\S*)\s*=>)\s*(.)/
  )
  if (match) {
    const body = match[5] === '{' ? '{ ... }' : '...'
    return match[2] !== undefined
      ? `${match[1]}function (${match[2]}) ${body}`
      : match[3] !== undefined
        ? `${match[1]}(${match[3]}) => ${body}`
        : match[4] !== undefined
          ? `${match[1]}${match[4]} => ${body}`
          : ''
  }
}
