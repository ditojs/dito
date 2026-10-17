export function getCommonOffset(...strings) {
  const [string1 = ''] = strings
  let offset = 0
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

export function getCommonPrefix(...strings) {
  return strings.length === 0
    ? ''
    : strings[0].slice(0, getCommonOffset(...strings))
}
