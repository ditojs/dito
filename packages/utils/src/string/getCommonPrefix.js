/**
 * Computes the index of the end of the longest common prefix from an array of
 * strings.
 * @param {string[]} strings
 * @returns {number}
 */
export function getCommonOffset(...strings) {
  if (strings.length === 0) return 0
  let offset = 0
  const string1 = strings[0]
  const length1 = string1.length
  for (let i = 0; i < length1; i++) {
    const char = string1.charCodeAt(i)
    for (let j = 1; j < strings.length; j++) {
      const string2 = strings[j]
      if (i >= string2.length || char !== string2.charCodeAt(i)) {
        return offset
      }
    }
    offset++
  }
  return offset
}

/**
 * Computes the longest common prefix from an array of strings.
 *
 * @param {string[]} strings
 * @returns {string}
 */
export function getCommonPrefix(...strings) {
  return strings.length === 0
    ? ''
    : strings[0].slice(0, getCommonOffset(...strings))
}
