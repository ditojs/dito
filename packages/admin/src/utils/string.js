export function isFullyContained(str1, str2) {
  return str1.length > str2.length
    ? str1.startsWith(str2)
    : str2.startsWith(str1)
}
