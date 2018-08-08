export function isAbsoluteUrl(str) {
  // A URL is considered absolute if it begins with "<scheme>://" or "//"
  // (protocol-relative URL).  RFC 3986 defines scheme name as a sequence of
  // characters beginning with a letter and followed by any combination of
  // letters, digits, plus, period, or hyphen.
  return /^([a-z][a-z\d+-.]*:)?\/\//i.test(str)
}

export function isHostName(str) {
  // https://tools.ietf.org/html/rfc1034#section-3.5
  // https://tools.ietf.org/html/rfc1123#section-2
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*$/i.test(str)
}
