export function pick(...args) {
  // Optimize for the most common case of two arguments:
  if (args.length === 2) {
    return args[0] !== undefined ? args[0] : args[1]
  }
  for (const arg of args) {
    if (arg !== undefined) {
      return arg
    }
  }
}
