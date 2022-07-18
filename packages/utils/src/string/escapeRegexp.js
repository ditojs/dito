export function escapeRegexp(string) {
  return string.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
}
