// eslint-disable-next-line n/no-deprecated-api
import punycode from 'punycode'

// Best effort approach, allowing Internationalized domain name (with punycode)
const domainRegExp = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/i

export function isDomain(str) {
  return !!(str && domainRegExp.test(punycode.toASCII(str)))
}
