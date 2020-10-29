export function getCommonPrefix(str1, str2) {
  return str1.slice(0, getCommonOffset(str1, str2))
}

export function getCommonOffset(str1, str2) {
  const length1 = str1.length
  const length2 = str2.length
  const max = length2 < length1 ? length2 : length1
  let pos = 0
  while (pos < max && str2.charCodeAt(pos) === str1.charCodeAt(pos)) {
    pos++
  }
  return pos
}
