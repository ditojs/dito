import punycode from 'punycode/punycode.js'

// Best effort approach, allowing Internationalized domain name (with punycode)
const domainRegExp =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i

export function isDomain(str) {
  return !!(str && domainRegExp.test(punycode.toASCII(str)))
}
