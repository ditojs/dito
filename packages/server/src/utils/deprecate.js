const loggedDeprecations = new Set()

export function deprecate(message) {
  // Only log deprecation messages once.
  if (!loggedDeprecations.has(message)) {
    loggedDeprecations.add(message)
    console.warn(message)
  }
}
