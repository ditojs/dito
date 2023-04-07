// https://tools.ietf.org/html/rfc1034#section-3.5
// https://tools.ietf.org/html/rfc1123#section-2
const hostnameRegExp =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[-0-9a-z]{0,61}[0-9a-z])?)*$/i

export function isHostname(str) {
  return !!(str && hostnameRegExp.test(str))
}
